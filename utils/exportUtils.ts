
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Job } from './api';
import { awToMinutes, calcDailyHoursFromSchedule, countWorkingDaysInMonth } from './jobCalculations';
import { offlineStorage, Schedule } from './offlineStorage';
import { billingStorage } from './billingStorage';
import { normaliseBillingStatus, awToHours } from './billingEngine';

export interface ExportOptions {
  type: 'daily' | 'weekly' | 'monthly' | 'all';
  month?: string;
  week?: number;
  day?: string;
  year?: number;
  targetHours?: number;
  availableHours?: number;
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

function groupJobsByDay(jobs: Job[]): Map<string, Job[]> {
  const grouped = new Map<string, Job[]>();
  jobs.forEach(job => {
    const day = job.createdAt.split('T')[0];
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(job);
  });
  return grouped;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getWeekKey(date: Date): string {
  const range = getWeekRange(date);
  return range.start.toISOString().split('T')[0];
}

// ── Available hours calculation ───────────────────────────────────────────────

function calcAvailableHoursForPeriod(
  startDate: Date,
  endDate: Date,
  schedule: Schedule
): number {
  const workingDays = schedule.workingDays ?? [1, 2, 3, 4, 5];
  const dailyHours = schedule.startTime && schedule.endTime
    ? calcDailyHoursFromSchedule(
        schedule.startTime,
        schedule.endTime,
        schedule.lunchStartTime ?? '12:00',
        schedule.lunchEndTime ?? '12:30'
      )
    : schedule.dailyWorkingHours ?? 8.5;

  let total = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const dow = cursor.getDay();
    if (workingDays.includes(dow)) {
      total += dailyHours;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

// ── Stats calculation ─────────────────────────────────────────────────────────

interface PeriodStats {
  jobCount: number;
  totalAw: number;
  totalMinutes: number;
  soldHours: number;
  availableHours: number;
  efficiency: number;
  utilization: number;
  awPerHour: number;
}

function calcPeriodStats(jobs: Job[], availableHours: number): PeriodStats {
  const jobCount = jobs.length;
  const totalAw = jobs.reduce((sum, j) => sum + (Number(j.aw) || 0), 0);
  const totalMinutes = jobs.reduce((sum, j) => sum + awToMinutes(Number(j.aw) || 0), 0);
  const soldHours = totalMinutes / 60;
  const rawEfficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const efficiency = Math.min(rawEfficiency, 100);
  const utilization = efficiency;
  const awPerHour = soldHours > 0 ? totalAw / soldHours : 0;
  return { jobCount, totalAw, totalMinutes, soldHours, availableHours, efficiency, utilization, awPerHour };
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function fmtJobDateTime(createdAt: string): string {
  const d = new Date(createdAt);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ── VHC badge ─────────────────────────────────────────────────────────────────

function vhcCell(status?: string): string {
  const s = (status || 'NONE').toUpperCase();
  if (s === 'RED')    return `<span class="tt-badge tt-badge-red">RED</span>`;
  if (s === 'ORANGE' || s === 'AMBER') return `<span class="tt-badge tt-badge-amber">AMBER</span>`;
  if (s === 'GREEN')  return `<span class="tt-badge tt-badge-green">GREEN</span>`;
  return `<span class="tt-badge tt-badge-none">N/A</span>`;
}

// ── Efficiency Graph card ─────────────────────────────────────────────────────

function efficiencyGraphCard(stats: PeriodStats, billedHours?: number): string {
  const barPct = Math.min(Math.max(stats.efficiency, 0), 100).toFixed(1);
  const soldHoursDisplay = stats.soldHours.toFixed(2) + 'h';
  const availHoursDisplay = stats.availableHours > 0 ? stats.availableHours.toFixed(1) + 'h' : '—';
  const efficiencyDisplay = stats.availableHours > 0 ? stats.efficiency.toFixed(1) + '%' : '—';
  const billedDisplay = billedHours !== undefined ? billedHours.toFixed(2) + 'h' : null;

  return `
    <div class="tt-summary-panel avoid-break">
      <div style="font-size:13px;font-weight:700;color:#1565C0;margin-bottom:14px;">Efficiency Overview</div>
      <div class="tt-metric-grid">
        <div class="tt-metric-card">
          <div class="tt-metric-value">${soldHoursDisplay}</div>
          <div class="tt-metric-label">Sold Hours</div>
        </div>
        <div class="tt-metric-card">
          <div class="tt-metric-value">${availHoursDisplay}</div>
          <div class="tt-metric-label">Available Hours</div>
        </div>
        <div class="tt-metric-card ${stats.efficiency >= 80 ? 'tt-metric-green' : stats.efficiency >= 50 ? 'tt-metric-amber' : 'tt-metric-red'}">
          <div class="tt-metric-value">${efficiencyDisplay}</div>
          <div class="tt-metric-label">Efficiency</div>
          <div class="tt-eff-bar-wrap"><div class="tt-eff-bar-fill" style="width:${barPct}%;"></div></div>
        </div>
        ${billedDisplay ? `<div class="tt-metric-card tt-metric-green">
          <div class="tt-metric-value">${billedDisplay}</div>
          <div class="tt-metric-label">Total Invoiced</div>
        </div>` : ''}
      </div>
    </div>
  `;
}

// ── Performance Metrics card ──────────────────────────────────────────────────

function performanceMetricsCard(stats: PeriodStats): string {
  const utilizationDisplay = stats.availableHours > 0 ? stats.utilization.toFixed(1) + '%' : '—';
  const awPerHourDisplay = stats.soldHours > 0 ? stats.awPerHour.toFixed(1) : '—';
  const efficiencyDisplay = stats.availableHours > 0 ? stats.efficiency.toFixed(0) + '%' : '—';
  const availHoursDisplay = stats.availableHours > 0 ? stats.availableHours.toFixed(1) + 'h' : '—';

  return `
    <div class="tt-summary-panel avoid-break" style="margin-top:0;">
      <div style="font-size:13px;font-weight:700;color:#1565C0;margin-bottom:14px;">Performance Metrics</div>
      <div class="tt-metric-grid">
        <div class="tt-metric-card">
          <div class="tt-metric-value">${utilizationDisplay}</div>
          <div class="tt-metric-label">Utilization</div>
          <div class="tt-metric-sub">of ${availHoursDisplay} available</div>
        </div>
        <div class="tt-metric-card">
          <div class="tt-metric-value">${awPerHourDisplay}</div>
          <div class="tt-metric-label">AW per Hour</div>
          <div class="tt-metric-sub">Average productivity</div>
        </div>
        <div class="tt-metric-card">
          <div class="tt-metric-value">${efficiencyDisplay}</div>
          <div class="tt-metric-label">Efficiency</div>
        </div>
        <div class="tt-metric-card">
          <div class="tt-metric-value">${stats.jobCount}</div>
          <div class="tt-metric-label">Total Jobs</div>
        </div>
      </div>
    </div>
  `;
}

// ── Summary dashboard (efficiency + metrics) ──────────────────────────────────

function summaryDashboard(stats: PeriodStats, billedHours?: number): string {
  return efficiencyGraphCard(stats, billedHours) + performanceMetricsCard(stats);
}

// ── Table header row ──────────────────────────────────────────────────────────

function tableHeaderRow(): string {
  return `
    <thead>
      <tr>
        <th style="width:9%;">WIP</th>
        <th style="width:12%;">Vehicle Reg</th>
        <th style="width:10%;">VHC</th>
        <th style="width:27%;">Job Notes</th>
        <th style="width:7%;text-align:center;">AW</th>
        <th style="width:9%;text-align:center;">Time</th>
        <th style="width:12%;text-align:center;">Date</th>
        <th style="width:10%;text-align:center;">Status</th>
      </tr>
    </thead>`;
}

// ── Single job row ────────────────────────────────────────────────────────────

function jobRow(job: Job, _isEven: boolean, billingRecord?: any): string {
  const TD = `padding:8px 10px;font-size:11px;color:#1C2B3A;vertical-align:middle;border-bottom:1px solid #E5E7EB;`;
  const jobMinutes = awToMinutes(Number(job.aw) || 0);
  const timeFormatted = fmtTime(jobMinutes);
  const notes = job.notes ? job.notes.trim() : '';
  const dateTimeStr = fmtJobDateTime(job.createdAt);
  const datePart = dateTimeStr.split(' ')[0];
  const timePart = dateTimeStr.split(' ')[1];
  const status = billingRecord ? normaliseBillingStatus(billingRecord.billingStatus) : 'open';
  const statusBadge = status === 'billed'
    ? `<span class="tt-badge tt-badge-invoiced">INVOICED</span>`
    : `<span class="tt-badge tt-badge-open">OPEN</span>`;
  return `
    <tr>
      <td style="${TD}font-weight:700;color:#2563EB;">${job.wipNumber}</td>
      <td style="${TD}">${job.vehicleReg}</td>
      <td style="${TD}">${vhcCell(job.vhcStatus)}</td>
      <td style="${TD}line-height:1.5;">${notes}</td>
      <td style="${TD}font-weight:700;color:#2563EB;text-align:center;">${job.aw}</td>
      <td style="${TD}text-align:center;">${timeFormatted}</td>
      <td style="${TD}text-align:center;">${datePart}<br/><span style="color:#6B7280;">${timePart}</span></td>
      <td style="${TD}text-align:center;">${statusBadge}</td>
    </tr>
  `;
}

// ── Week group (header + rows) ────────────────────────────────────────────────

function weekGroupHtml(weekStart: Date, weekEnd: Date, jobs: Job[], billingByJobId: Map<string, any>): string {
  const label = `Week of ${fmtDateShort(weekStart.toISOString())} – ${fmtDateShort(weekEnd.toISOString())}`;
  const rows = jobs.map((job, i) => jobRow(job, i % 2 === 0, billingByJobId.get(job.id))).join('');
  return `
    <div style="margin-bottom:4px;margin-top:12px;">
      <div style="font-size:12px;font-weight:600;color:#2563EB;padding:6px 0 4px;border-bottom:1px solid #BFDBFE;margin-bottom:0;">${label}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;margin-bottom:16px;">
      ${tableHeaderRow()}
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Month section ─────────────────────────────────────────────────────────────

function monthSectionHtml(yearMonth: string, jobs: Job[], billingByJobId: Map<string, any>): string {
  const monthLabel = fmtMonthLabel(yearMonth);

  // Group by week
  const weekMap = new Map<string, Job[]>();
  jobs.forEach(job => {
    const d = new Date(job.createdAt);
    const wk = getWeekKey(d);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(job);
  });

  // Sort weeks descending
  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a));

  const weeksHtml = sortedWeeks.map(wkKey => {
    const wkJobs = weekMap.get(wkKey)!.slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const wkStart = new Date(wkKey);
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkStart.getDate() + 6);
    return weekGroupHtml(wkStart, wkEnd, wkJobs, billingByJobId);
  }).join('');

  return `
    <div style="margin-bottom:8px;margin-top:20px;">
      <div style="font-size:14px;font-weight:700;color:#1565C0;padding:8px 0 6px;border-bottom:2px solid #BFDBFE;">${monthLabel}</div>
    </div>
    ${weeksHtml}
  `;
}

// ── Year section ──────────────────────────────────────────────────────────────

function yearSectionHtml(year: number, jobs: Job[], schedule: Schedule, billingByJobId: Map<string, any>): string {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const availHours = calcAvailableHoursForPeriod(yearStart, yearEnd, schedule);
  const stats = calcPeriodStats(jobs, availHours);

  const yearBilledHours = jobs.reduce((sum, j) => {
    const rec = billingByJobId.get(j.id);
    if (rec && normaliseBillingStatus(rec.billingStatus) === 'billed') {
      return sum + (rec.billedHours ?? awToHours(j.aw ?? 0));
    }
    return sum;
  }, 0);

  // Group by month
  const monthMap = new Map<string, Job[]>();
  jobs.forEach(job => {
    const ym = job.createdAt.substring(0, 7);
    if (!monthMap.has(ym)) monthMap.set(ym, []);
    monthMap.get(ym)!.push(job);
  });

  const sortedMonths = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
  const monthsHtml = sortedMonths.map(ym => monthSectionHtml(ym, monthMap.get(ym)!, billingByJobId)).join('');

  return `
    <div style="margin-top:32px;margin-bottom:8px;border-top:3px solid #1565C0;padding-top:16px;">
      <div style="font-size:20px;font-weight:800;color:#1565C0;margin-bottom:16px;">Year: ${year}</div>
      <div style="font-size:13px;font-weight:600;color:#1565C0;margin-bottom:12px;">Year Summary</div>
      ${summaryDashboard(stats, yearBilledHours)}
    </div>
    ${monthsHtml}
  `;
}

// ── Pie chart SVG ─────────────────────────────────────────────────────────────

function buildPieChartSVG(invoicedHours: number, openHours: number, totalSoldHours: number, availableHours: number): string {
  const total = Math.max(availableHours, totalSoldHours, 0.01);
  const invoicedPct = Math.min(invoicedHours / total, 1);
  const openPct = Math.min(openHours / total, 1 - invoicedPct);
  const unusedPct = Math.max(0, 1 - invoicedPct - openPct);

  const C = 2 * Math.PI * 80; // circumference ≈ 502.65

  const invoicedDash = invoicedPct * C;
  const invoicedGap = C - invoicedDash;

  const openDash = openPct * C;
  const openGap = C - openDash;

  const unusedDash = unusedPct * C;
  const unusedGap = C - unusedDash;

  const invoicedLabel = (invoicedPct * 100).toFixed(1) + '%';
  const openLabel = (openPct * 100).toFixed(1) + '%';
  const unusedLabel = (unusedPct * 100).toFixed(1) + '%';
  const unusedActual = Math.max(0, availableHours - totalSoldHours);
  const totalSoldDisplay = totalSoldHours.toFixed(1) + 'h';

  return `
    <div style="margin-top:32px;text-align:center;">
      <div style="font-size:14px;font-weight:700;color:#1565C0;margin-bottom:16px;">Hours Distribution</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:40px;flex-wrap:wrap;">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#E5E7EB" stroke-width="32"/>
          <circle cx="100" cy="100" r="80" fill="none" stroke="#16A34A" stroke-width="32"
            stroke-dasharray="${invoicedDash.toFixed(2)} ${invoicedGap.toFixed(2)}"
            stroke-dashoffset="${(C * 0.25).toFixed(2)}"
            transform="rotate(-90 100 100)"/>
          <circle cx="100" cy="100" r="80" fill="none" stroke="#DC2626" stroke-width="32"
            stroke-dasharray="${openDash.toFixed(2)} ${openGap.toFixed(2)}"
            stroke-dashoffset="${(C * 0.25 - invoicedDash).toFixed(2)}"
            transform="rotate(-90 100 100)"/>
          <circle cx="100" cy="100" r="80" fill="none" stroke="#D1D5DB" stroke-width="32"
            stroke-dasharray="${unusedDash.toFixed(2)} ${unusedGap.toFixed(2)}"
            stroke-dashoffset="${(C * 0.25 - invoicedDash - openDash).toFixed(2)}"
            transform="rotate(-90 100 100)"/>
          <text x="100" y="95" text-anchor="middle" font-size="13" font-weight="700" fill="#1565C0">${totalSoldDisplay}</text>
          <text x="100" y="112" text-anchor="middle" font-size="9" fill="#6B7280">SOLD</text>
        </svg>
        <div style="text-align:left;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:3px;background:#16A34A;flex-shrink:0;"></div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#374151;">Invoiced / Closed</div>
              <div style="font-size:11px;color:#6B7280;">${invoicedHours.toFixed(2)}h &nbsp; ${invoicedLabel}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:3px;background:#DC2626;flex-shrink:0;"></div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#374151;">Open / Awaiting</div>
              <div style="font-size:11px;color:#6B7280;">${openHours.toFixed(2)}h &nbsp; ${openLabel}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:16px;height:16px;border-radius:3px;background:#D1D5DB;flex-shrink:0;"></div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#374151;">Available (Unused)</div>
              <div style="font-size:11px;color:#6B7280;">${unusedActual.toFixed(2)}h &nbsp; ${unusedLabel}</div>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:10px;border-top:1px solid #E5E7EB;">
            <div style="font-size:11px;color:#6B7280;">Available Hours: <strong>${availableHours.toFixed(2)}h</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Closure summary page ──────────────────────────────────────────────────────

function buildClosureSummaryPage(
  closedJobs: Job[],
  openJobs: Job[],
  totalClosedHours: number,
  totalOpenHours: number,
  availableHours: number,
  totalSoldHours: number
): string {
  const closedRows = closedJobs.map(job => {
    const hrs = awToHours(job.aw ?? 0).toFixed(2) + 'h';
    return `<tr>
      <td style="font-weight:700;color:#2563EB;">${job.wipNumber}</td>
      <td>${job.vehicleReg}</td>
      <td style="text-align:right;">${hrs}</td>
    </tr>`;
  }).join('');

  const openRows = openJobs.map(job => {
    const hrs = awToHours(job.aw ?? 0).toFixed(2) + 'h';
    return `<tr>
      <td style="font-weight:700;color:#2563EB;">${job.wipNumber}</td>
      <td>${job.vehicleReg}</td>
      <td style="text-align:right;">${hrs}</td>
    </tr>`;
  }).join('');

  const pie = buildPieChartSVG(totalClosedHours, totalOpenHours, totalSoldHours, availableHours);

  return `
    <div class="page-break"></div>
    <div class="tt-section">Invoiced &amp; Open Job Breakdown</div>
    <div style="display:flex;gap:16px;align-items:flex-start;margin-top:12px;">
      <div style="flex:1;">
        <div class="tt-closure-col-header tt-closure-col-header-invoiced">
          INVOICED / CLOSED (${closedJobs.length})
        </div>
        <table>
          <thead><tr>
            <th style="background:#15803D;">WIP</th>
            <th style="background:#15803D;">Reg</th>
            <th style="background:#15803D;text-align:right;">Hours</th>
          </tr></thead>
          <tbody>${closedRows || '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;font-style:italic;">No invoiced jobs</td></tr>'}</tbody>
          <tfoot><tr style="background:#F0FDF4;">
            <td colspan="2" style="font-weight:700;color:#15803D;border-top:2px solid #15803D;">TOTAL</td>
            <td style="font-weight:700;color:#15803D;text-align:right;border-top:2px solid #15803D;">${totalClosedHours.toFixed(2)}h</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="flex:1;">
        <div class="tt-closure-col-header tt-closure-col-header-open">
          OPEN / AWAITING (${openJobs.length})
        </div>
        <table>
          <thead><tr>
            <th style="background:#B91C1C;">WIP</th>
            <th style="background:#B91C1C;">Reg</th>
            <th style="background:#B91C1C;text-align:right;">Hours</th>
          </tr></thead>
          <tbody>${openRows || '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;font-style:italic;">No open jobs</td></tr>'}</tbody>
          <tfoot><tr style="background:#FFF5F5;">
            <td colspan="2" style="font-weight:700;color:#B91C1C;border-top:2px solid #B91C1C;">TOTAL</td>
            <td style="font-weight:700;color:#B91C1C;text-align:right;border-top:2px solid #B91C1C;">${totalOpenHours.toFixed(2)}h</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
    <div class="tt-chart-container" style="margin-top:20px;">
      <div class="tt-chart-title">Available Hours Utilisation</div>
      ${pie}
    </div>
  `;
}

// ── Full PDF HTML ─────────────────────────────────────────────────────────────

async function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): Promise<string> {
  console.log('ExportUtils: Generating PDF HTML for', options.type, 'export with', jobs.length, 'jobs');

  const schedule = await offlineStorage.getSchedule();

  // Load billing records and build lookup map
  const billingRecords = await billingStorage.getAllRecords();
  console.log('ExportUtils: Loaded', billingRecords.length, 'billing records');
  const billingByJobId = new Map(billingRecords.map((r: any) => [r.jobId, r]));

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  let reportType = 'ALL-TIME REPORT';
  let periodLabel = 'All-Time';
  if (options.type === 'daily' && options.day) {
    reportType = 'DAILY REPORT';
    periodLabel = new Date(options.day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } else if (options.type === 'weekly') {
    reportType = 'WEEKLY REPORT';
    periodLabel = 'Weekly Report';
  } else if (options.type === 'monthly' && options.month) {
    reportType = 'MONTHLY REPORT';
    periodLabel = new Date(options.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  // Sort jobs newest first
  const sortedJobs = jobs.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // ── Calculate overall stats ──
  let availableHours = options.availableHours ?? 0;
  if (availableHours === 0 && sortedJobs.length > 0) {
    const oldest = new Date(sortedJobs[sortedJobs.length - 1].createdAt);
    const newest = new Date(sortedJobs[0].createdAt);
    availableHours = calcAvailableHoursForPeriod(oldest, newest, schedule);
  }
  const overallStats = calcPeriodStats(sortedJobs, availableHours);

  // ── Compute closed/open job lists for this period ──
  const closedJobs = sortedJobs.filter(job => {
    const rec = billingByJobId.get(job.id);
    return rec && normaliseBillingStatus(rec.billingStatus) === 'billed';
  });
  const openJobs = sortedJobs.filter(job => {
    const rec = billingByJobId.get(job.id);
    return !rec || normaliseBillingStatus(rec.billingStatus) === 'open';
  });
  console.log('ExportUtils: Closed jobs:', closedJobs.length, 'Open jobs:', openJobs.length);

  // Billed hours from billing snapshots (more accurate than awToHours)
  const billedSnapshotHours = closedJobs.reduce((sum, j) => {
    const rec = billingByJobId.get(j.id);
    return sum + (rec?.billedHours ?? awToHours(j.aw ?? 0));
  }, 0);

  // ── Build body content ──
  let bodyContent = '';

  if (options.type === 'all') {
    // Grand overall summary
    bodyContent += `
      <div class="tt-section">Performance Summary</div>
      ${summaryDashboard(overallStats, billedSnapshotHours)}
    `;

    // Section title
    bodyContent += `<div class="tt-section">Detailed Job Records</div>`;

    // Group by year
    const yearMap = new Map<number, Job[]>();
    sortedJobs.forEach(job => {
      const yr = new Date(job.createdAt).getFullYear();
      if (!yearMap.has(yr)) yearMap.set(yr, []);
      yearMap.get(yr)!.push(job);
    });

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);
    sortedYears.forEach(yr => {
      bodyContent += yearSectionHtml(yr, yearMap.get(yr)!, schedule, billingByJobId);
    });

  } else {
    // Non-entire exports: summary + flat table
    bodyContent += summaryDashboard(overallStats, billedSnapshotHours);

    bodyContent += `<div class="tt-section">Detailed Job Records</div>`;

    // Build flat table with repeated header every 20 rows
    const ROWS_PER_GROUP = 20;
    let tableRows = '';
    sortedJobs.forEach((job, i) => {
      if (i > 0 && i % ROWS_PER_GROUP === 0) {
        tableRows += `</tbody></table>
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;margin-top:0;page-break-before:always;">
          ${tableHeaderRow()}
          <tbody>`;
      }
      tableRows += jobRow(job, i % 2 === 0, billingByJobId.get(job.id));
    });

    bodyContent += `
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;">
        ${tableHeaderRow()}
        <tbody>${tableRows}</tbody>
      </table>
    `;
  }

  // ── Append closure summary page (all export types) ──
  const totalClosedHours = closedJobs.reduce((sum, j) => {
    const rec = billingByJobId.get(j.id);
    return sum + (rec?.billedHours ?? awToHours(j.aw ?? 0));
  }, 0);
  const totalOpenHours = openJobs.reduce((sum, j) => sum + awToHours(j.aw ?? 0), 0);
  bodyContent += buildClosureSummaryPage(
    closedJobs,
    openJobs,
    totalClosedHours,
    totalOpenHours,
    availableHours,
    overallStats.soldHours
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 14mm 16mm; size: A4 portrait; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, Helvetica, sans-serif;
      background: #FFFFFF;
      color: #1C2B3A;
      font-size: 12px;
      line-height: 1.55;
    }
    /* ── Typography ── */
    h1 { font-size: 26px; font-weight: 800; color: #1565C0; letter-spacing: -0.5px; line-height: 1.1; }
    h2 { font-size: 16px; font-weight: 700; color: #1565C0; margin-bottom: 10px; }
    h3 { font-size: 13px; font-weight: 700; color: #1565C0; margin-bottom: 6px; }
    /* ── Page header ── */
    .tt-page-header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 10px; margin-bottom: 20px;
      border-bottom: 2px solid #BFDBFE;
    }
    .tt-brand { font-size: 10px; font-weight: 800; letter-spacing: 4px; color: #2563EB; text-transform: uppercase; }
    .tt-report-title { font-size: 22px; font-weight: 800; color: #1565C0; letter-spacing: -0.3px; }
    .tt-period { font-size: 12px; color: #6B7280; font-weight: 500; margin-top: 2px; }
    /* ── Section heading ── */
    .tt-section {
      margin: 24px 0 10px;
      padding: 8px 12px;
      background: #EFF6FF;
      border-left: 4px solid #2563EB;
      border-radius: 0 6px 6px 0;
      font-size: 13px; font-weight: 700; color: #1E40AF;
      page-break-after: avoid;
    }
    /* ── Metric grid ── */
    .tt-metric-grid {
      display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0;
    }
    .tt-metric-card {
      flex: 1; min-width: 110px; max-width: 160px;
      background: #F0F7FF; border: 1px solid #BFDBFE; border-radius: 8px;
      padding: 14px 10px; text-align: center;
      page-break-inside: avoid;
    }
    .tt-metric-value { font-size: 22px; font-weight: 800; color: #1565C0; line-height: 1.1; }
    .tt-metric-label { font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #6B7280; margin-top: 4px; }
    .tt-metric-sub { font-size: 9px; color: #9CA3AF; margin-top: 2px; }
    .tt-metric-green .tt-metric-value { color: #15803D; }
    .tt-metric-green { background: #F0FDF4; border-color: #BBF7D0; }
    .tt-metric-amber .tt-metric-value { color: #B45309; }
    .tt-metric-amber { background: #FFFBEB; border-color: #FDE68A; }
    .tt-metric-red .tt-metric-value { color: #B91C1C; }
    .tt-metric-red { background: #FFF5F5; border-color: #FECACA; }
    /* ── Efficiency bar ── */
    .tt-eff-bar-wrap { background: #E5E7EB; border-radius: 999px; height: 10px; overflow: hidden; margin-top: 6px; }
    .tt-eff-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2563EB, #60A5FA); }
    /* ── Summary panel ── */
    .tt-summary-panel {
      background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px;
      padding: 18px 20px; margin: 14px 0;
    }
    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    th {
      background: #1565C0; color: #FFFFFF;
      padding: 9px 10px; text-align: left;
      font-size: 9px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase;
      border-right: 1px solid #1E40AF;
    }
    th:last-child { border-right: none; }
    td {
      padding: 8px 10px; font-size: 11px; color: #1C2B3A;
      border-bottom: 1px solid #E5E7EB; vertical-align: middle;
    }
    tr:nth-child(even) td { background: #F8FAFF; }
    tr { page-break-inside: avoid; }
    /* ── Status badges ── */
    .tt-badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
    }
    .tt-badge-invoiced { background: #15803D; color: #fff; }
    .tt-badge-open { background: #B91C1C; color: #fff; }
    .tt-badge-green { background: #15803D; color: #fff; }
    .tt-badge-amber { background: #B45309; color: #fff; }
    .tt-badge-red { background: #B91C1C; color: #fff; }
    .tt-badge-none { background: #6B7280; color: #fff; }
    /* ── Footer ── */
    .tt-footer {
      border-top: 1px solid #BFDBFE; text-align: center;
      padding: 10px 0; margin-top: 28px;
      font-size: 9px; color: #9CA3AF; letter-spacing: 0.5px;
    }
    /* ── Closure summary page ── */
    .tt-closure-col-header {
      padding: 8px 12px; border-radius: 6px 6px 0 0;
      font-size: 11px; font-weight: 700; text-align: center; color: #fff;
    }
    .tt-closure-col-header-invoiced { background: #15803D; }
    .tt-closure-col-header-open { background: #B91C1C; }
    .tt-closure-tfoot td { font-weight: 700; border-top: 2px solid currentColor; }
    /* ── Chart container ── */
    .tt-chart-container {
      background: #F8FAFF; border: 1px solid #BFDBFE; border-radius: 10px;
      padding: 20px; margin: 16px 0; text-align: center;
    }
    .tt-chart-title { font-size: 13px; font-weight: 700; color: #1565C0; margin-bottom: 16px; }
    /* ── Page break helpers ── */
    .page-break { page-break-after: always; }
    .avoid-break { page-break-inside: avoid; }
    /* ── Print ── */
    @media print {
      .tt-page-header { position: running(header); }
      .tt-footer { position: running(footer); }
    }
  </style>
</head>
<body style="padding:20px 24px;">

  <!-- ═══ HEADER ═══ -->
  <div class="tt-page-header">
    <div>
      <div class="tt-brand">T E C H &nbsp; T I M E S</div>
      <div class="tt-report-title">${reportType}</div>
      <div class="tt-period">${technicianName} &nbsp;&middot;&nbsp; ${periodLabel}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#9CA3AF;">
      Generated<br/>${generatedDate}
    </div>
  </div>

  <!-- ═══ BODY ═══ -->
  ${bodyContent}

  <!-- ═══ FOOTER ═══ -->
  <div class="tt-footer">
    TECH TIMES &nbsp;&bull;&nbsp; Created by BNR &nbsp;&bull;&nbsp; Generated ${generatedDate}
  </div>

</body>
</html>`;

  return html;
}

// ── Public export functions ───────────────────────────────────────────────────

export async function exportToPdf(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): Promise<void> {
  console.log('ExportUtils: exportToPdf called — type:', options.type, 'jobs:', jobs.length, 'technician:', technicianName, 'availableHours:', options.availableHours);

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const html = await generatePdfHtml(safeJobs, technicianName, options);

  console.log('ExportUtils: Calling printToFileAsync...');
  const printResult = await Print.printToFileAsync({ html });
  const sourceUri = printResult.uri;
  console.log('ExportUtils: PDF generated at', sourceUri);

  // Copy to a named file in the cache directory (works cross-platform on Android).
  const fileName = `techtimes_${options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
  const cacheDir = FileSystem.cacheDirectory ?? '';
  const destUri = cacheDir + fileName;

  if (sourceUri !== destUri) {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    console.log('ExportUtils: PDF copied to', destUri);
    try {
      await FileSystem.deleteAsync(sourceUri, { idempotent: true });
    } catch (cleanupErr) {
      console.warn('ExportUtils: Could not delete temp PDF file:', cleanupErr);
    }
  }

  const sharingAvailable = await Sharing.isAvailableAsync();
  console.log('ExportUtils: Sharing available:', sharingAvailable);

  if (sharingAvailable) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share TechTimes Report',
      UTI: 'com.adobe.pdf',
    });
    console.log('ExportUtils: PDF shared successfully');
  } else {
    console.warn('ExportUtils: Sharing not available on this device');
    throw new Error('Sharing is not available on this device.');
  }
}

export async function exportToJson(jobs: Job[]): Promise<string> {
  console.log('ExportUtils: exportToJson called — jobs:', jobs.length);

  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    jobCount: jobs.length,
    jobs: jobs.map(job => ({
      wipNumber: job.wipNumber,
      vehicleReg: job.vehicleReg,
      vhcStatus: job.vhcStatus,
      description: job.notes || '',
      aws: job.aw,
      jobDateTime: job.createdAt,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const fileName = `techtimes_backup_${new Date().toISOString().split('T')[0]}.json`;
  const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!docDir) {
    throw new Error('Storage not available. Please free up device storage and try again.');
  }
  const fileUri = docDir + fileName;

  await FileSystem.writeAsStringAsync(fileUri, jsonString);
  console.log('ExportUtils: JSON exported to', fileUri);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export TechTimes Backup',
    });
    console.log('ExportUtils: JSON shared successfully');
  }

  return fileUri;
}

export async function importFromJson(
  fileUri: string,
  onProgress: (current: number, total: number, job: any) => void
): Promise<{ imported: number; skipped: number; errors: string[]; jobs: any[] }> {
  console.log('ExportUtils: importFromJson called — fileUri:', fileUri);

  try {
    // On Android, DocumentPicker returns content:// URIs which expo-file-system/legacy
    // cannot read directly. Copy to a temp file first.
    let resolvedUri = fileUri;
    if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
      const tmpPath = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '') + `import_tmp_${Date.now()}.json`;
      try {
        await FileSystem.copyAsync({ from: fileUri, to: tmpPath });
        resolvedUri = tmpPath;
        console.log('ExportUtils: Copied content:// URI to temp file:', tmpPath);
      } catch (copyErr: any) {
        console.error('ExportUtils: Failed to copy content:// URI:', copyErr);
        // Try reading directly as last resort
        try {
          const testRead = await FileSystem.readAsStringAsync(fileUri);
          // If direct read works, use original URI
          resolvedUri = fileUri;
          console.log('ExportUtils: Direct read of content:// URI succeeded (length:', testRead.length, ')');
        } catch {
          throw new Error('Could not read the selected file. Please try exporting the backup again and re-importing.');
        }
      }
    }

    const jsonString = await FileSystem.readAsStringAsync(resolvedUri);

    // Clean up temp file after reading
    if (resolvedUri !== fileUri) {
      try { await FileSystem.deleteAsync(resolvedUri, { idempotent: true }); } catch {}
    }
    console.log('ExportUtils: Read JSON file, length:', jsonString.length);

    let importData;
    try {
      importData = JSON.parse(jsonString);
      console.log('ExportUtils: Successfully parsed JSON');
    } catch (parseError) {
      console.error('ExportUtils: JSON parse error:', parseError);
      throw new Error('Invalid JSON file format. Please ensure the file is a valid TechTimes backup.');
    }

    if (!importData) throw new Error('Empty JSON file');
    if (!importData.jobs) throw new Error('Invalid JSON format: missing "jobs" array');
    if (!Array.isArray(importData.jobs)) throw new Error('Invalid JSON format: "jobs" must be an array');

    console.log('ExportUtils: Found', importData.jobs.length, 'jobs in import file');
    console.log('ExportUtils: Export date:', importData.exportDate, '| Version:', importData.version);

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      jobs: [] as any[],
    };

    const total = importData.jobs.length;
    if (total === 0) {
      console.log('ExportUtils: No jobs to import');
      return results;
    }

    for (let i = 0; i < importData.jobs.length; i++) {
      const job = importData.jobs[i];

      try {
        onProgress(i + 1, total, job);

        const wipNumber = job.wipNumber;
        const vehicleReg = job.vehicleReg;
        const awValue = job.aws !== undefined ? job.aws : job.aw;
        const notes = job.description !== undefined ? job.description : (job.notes || '');
        const createdAt = job.jobDateTime !== undefined ? job.jobDateTime : job.createdAt;
        const vhcStatus = job.vhcStatus || 'NONE';

        if (!wipNumber) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing wipNumber`);
          console.warn('ExportUtils: Skipping job', i + 1, '— missing wipNumber');
          continue;
        }
        if (!vehicleReg) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing vehicleReg`);
          console.warn('ExportUtils: Skipping job', i + 1, '— missing vehicleReg');
          continue;
        }
        if (awValue === undefined || awValue === null) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing aws/aw value`);
          console.warn('ExportUtils: Skipping job', i + 1, '— missing aws/aw value');
          continue;
        }
        if (!createdAt) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing jobDateTime/createdAt`);
          console.warn('ExportUtils: Skipping job', i + 1, '— missing jobDateTime/createdAt');
          continue;
        }

        const validVhcStatuses = ['NONE', 'GREEN', 'ORANGE', 'RED', 'AMBER'];
        let normalizedVhcStatus = String(vhcStatus).toUpperCase();
        if (normalizedVhcStatus === 'AMBER') normalizedVhcStatus = 'ORANGE';

        if (!validVhcStatuses.includes(normalizedVhcStatus)) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Invalid vhcStatus "${vhcStatus}"`);
          console.warn('ExportUtils: Skipping job', i + 1, '— invalid vhcStatus:', vhcStatus);
          continue;
        }

        const awNumber = Number(awValue);
        if (isNaN(awNumber) || awNumber < 0) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Invalid aws value "${awValue}"`);
          console.warn('ExportUtils: Skipping job', i + 1, '— invalid aws value:', awValue);
          continue;
        }

        const jobToImport = {
          wipNumber: String(wipNumber).trim(),
          vehicleReg: String(vehicleReg).trim().toUpperCase(),
          aw: awNumber,
          notes: String(notes || '').trim(),
          vhcStatus: normalizedVhcStatus as 'NONE' | 'GREEN' | 'ORANGE' | 'RED',
          createdAt: createdAt,
        };

        results.jobs.push(jobToImport);
        results.imported++;

        console.log('ExportUtils: Prepared job', i + 1, '/', total, '—', jobToImport.wipNumber, jobToImport.vehicleReg, 'aw:', jobToImport.aw);

        if (i % 20 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } catch (error) {
        results.skipped++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Job ${i + 1}: ${errorMessage}`);
        console.error('ExportUtils: Error processing job', i + 1, ':', error);
      }
    }

    console.log('ExportUtils: Import complete —', results.imported, 'prepared,', results.skipped, 'skipped');
    if (results.errors.length > 0) console.log('ExportUtils: Import errors:', results.errors);

    return results;
  } catch (error) {
    console.error('ExportUtils: Fatal import error:', error);
    throw error;
  }
}
