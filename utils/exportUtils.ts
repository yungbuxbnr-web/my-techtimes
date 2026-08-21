
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

// ── VHC dot + label ───────────────────────────────────────────────────────────

function vhcCell(status?: string): string {
  const s = (status || 'NONE').toUpperCase();
  let dotColor = '#9CA3AF';
  let label = 'N/A';
  if (s === 'RED')    { dotColor = '#EF4444'; label = 'Red'; }
  if (s === 'ORANGE' || s === 'AMBER') { dotColor = '#F97316'; label = 'Orange'; }
  if (s === 'GREEN')  { dotColor = '#22C55E'; label = 'Green'; }
  return `<span style="display:inline-flex;align-items:center;gap:4px;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
    <span style="color:#374151;font-size:11px;">${label}</span>
  </span>`;
}

// ── Efficiency Graph card ─────────────────────────────────────────────────────

function efficiencyGraphCard(stats: PeriodStats, billedHours?: number): string {
  const barPct = Math.min(Math.max(stats.efficiency, 0), 100).toFixed(1);
  const soldHoursDisplay = stats.soldHours.toFixed(2) + 'h';
  const availHoursDisplay = stats.availableHours > 0 ? stats.availableHours.toFixed(1) + 'h' : '—';
  const efficiencyDisplay = stats.availableHours > 0 ? stats.efficiency.toFixed(1) + '%' : '—';
  const billedHoursDisplay = billedHours !== undefined ? billedHours.toFixed(2) + 'h' : '—';

  return `
    <div style="background:#EEF4FF;border:1px solid #BFDBFE;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
      <div style="text-align:center;font-size:16px;font-weight:700;color:#1565C0;margin-bottom:16px;">Efficiency Graph</div>
      <div style="background:#E5E7EB;border-radius:999px;height:28px;width:100%;position:relative;overflow:hidden;margin-bottom:12px;">
        <div style="background:#F59E0B;height:100%;border-radius:999px;width:${barPct}%;position:absolute;top:0;left:0;"></div>
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:13px;font-weight:700;color:#1C1917;z-index:1;">${barPct}%</span>
        </div>
      </div>
      <div style="font-size:12px;color:#374151;line-height:2;">
        Sold Hours: <span style="color:#06B6D4;font-weight:700;">${soldHoursDisplay}</span>
      </div>
      <div style="font-size:12px;color:#374151;line-height:2;">
        Available Hours: <span style="color:#06B6D4;font-weight:700;">${availHoursDisplay}</span>
      </div>
      <div style="font-size:12px;color:#374151;line-height:2;">
        Efficiency: <span style="color:#EAB308;font-weight:700;">${efficiencyDisplay}</span>
      </div>
      <div style="font-size:12px;color:#374151;line-height:2;">
        Total Invoiced: <span style="color:#16A34A;font-weight:700;">${billedHoursDisplay}</span>
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

  const metricCard = (value: string, label: string, subtitle: string) => `
    <div style="flex:1;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:16px 12px;text-align:center;margin:4px;">
      <div style="font-size:22px;font-weight:700;color:#16A34A;margin-bottom:4px;">${value}</div>
      <div style="font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#6B7280;margin-bottom:3px;">${label}</div>
      <div style="font-size:9px;color:#9CA3AF;">${subtitle}</div>
    </div>
  `;

  return `
    <div style="background:#EEF4FF;border:1px solid #BFDBFE;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <div style="text-align:center;font-size:16px;font-weight:700;color:#1565C0;margin-bottom:16px;">&#128202; Performance Metrics</div>
      <div style="display:flex;gap:0;margin-bottom:0;">
        <div style="display:flex;flex-direction:column;flex:1;gap:0;">
          <div style="display:flex;gap:0;margin-bottom:0;">
            ${metricCard(utilizationDisplay, 'UTILIZATION', 'Out of ' + (stats.availableHours > 0 ? stats.availableHours.toFixed(1) + 'h' : '—') + ' available')}
            ${metricCard(awPerHourDisplay, 'AWS PER HOUR', 'Average productivity')}
          </div>
          <div style="display:flex;gap:0;">
            ${metricCard(efficiencyDisplay, 'EFFICIENCY', 'Since first entry')}
            ${metricCard(availHoursDisplay, 'AVAILABLE HOURS', 'From first entry')}
          </div>
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

const TH = `background:#1565C0;color:#FFFFFF;padding:10px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;border-right:1px solid #1E40AF;`;

function tableHeaderRow(): string {
  return `
    <thead>
      <tr>
        <th style="${TH}width:9%;">WIP<br/>NUMBER</th>
        <th style="${TH}width:12%;">VEHICLE REG</th>
        <th style="${TH}width:10%;">VHC</th>
        <th style="${TH}width:28%;">JOB DESCRIPTION</th>
        <th style="${TH}width:7%;text-align:center;">AWS</th>
        <th style="${TH}width:9%;text-align:center;">TIME</th>
        <th style="${TH}width:12%;text-align:center;">DATE &amp;<br/>TIME</th>
        <th style="${TH}width:10%;border-right:none;text-align:center;">STATUS</th>
      </tr>
    </thead>`;
}

// ── Single job row ────────────────────────────────────────────────────────────

function jobRow(job: Job, isEven: boolean, billingRecord?: any): string {
  const rowBg = isEven ? '#FFFFFF' : '#F9FAFB';
  const TD = `padding:9px 10px;font-size:11px;color:#374151;vertical-align:middle;border-right:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;`;
  const jobMinutes = awToMinutes(Number(job.aw) || 0);
  const timeFormatted = fmtTime(jobMinutes);
  const notes = job.notes ? job.notes.trim() : '';
  const dateTimeStr = fmtJobDateTime(job.createdAt);
  const datePart = dateTimeStr.split(' ')[0];
  const timePart = dateTimeStr.split(' ')[1];
  const status = billingRecord ? normaliseBillingStatus(billingRecord.billingStatus) : 'open';
  const statusBadge = status === 'billed'
    ? `<span style="background:#16A34A;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">INVOICED</span>`
    : `<span style="background:#DC2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">OPEN</span>`;
  return `
    <tr style="background:${rowBg};">
      <td style="${TD}font-weight:700;color:#2563EB;">${job.wipNumber}</td>
      <td style="${TD}font-weight:500;">${job.vehicleReg}</td>
      <td style="${TD}">${vhcCell(job.vhcStatus)}</td>
      <td style="${TD}line-height:1.5;">${notes}</td>
      <td style="${TD}font-weight:700;color:#2563EB;text-align:center;font-size:13px;">${job.aw}</td>
      <td style="${TD}text-align:center;">${timeFormatted}</td>
      <td style="${TD}text-align:center;font-size:11px;color:#374151;">${datePart}<br/><span style="color:#6B7280;">${timePart}</span></td>
      <td style="${TD}border-right:none;text-align:center;">${statusBadge}</td>
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
  billingByJobId: Map<string, any>,
  availableHours: number,
  totalSoldHours: number
): string {
  const totalClosedHours = closedJobs.reduce((sum, j) => sum + awToHours(j.aw ?? 0), 0);
  const totalOpenHours = openJobs.reduce((sum, j) => sum + awToHours(j.aw ?? 0), 0);

  // Use billedHours snapshot for invoiced hours (more accurate)
  const billedSnapshotHours = closedJobs.reduce((sum, j) => {
    const rec = billingByJobId.get(j.id);
    return sum + (rec?.billedHours ?? awToHours(j.aw ?? 0));
  }, 0);

  const closedRowsHtml = closedJobs.map((job, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#F0FDF4';
    const hrs = awToHours(job.aw ?? 0).toFixed(2) + 'h';
    return `<tr style="background:${bg};">
      <td style="padding:6px 8px;font-size:11px;color:#2563EB;font-weight:700;border-bottom:1px solid #E5E7EB;">${job.wipNumber}</td>
      <td style="padding:6px 8px;font-size:11px;color:#374151;border-bottom:1px solid #E5E7EB;">${job.vehicleReg}</td>
      <td style="padding:6px 8px;font-size:11px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${hrs}</td>
    </tr>`;
  }).join('');

  const openRowsHtml = openJobs.map((job, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#FFF5F5';
    const hrs = awToHours(job.aw ?? 0).toFixed(2) + 'h';
    return `<tr style="background:${bg};">
      <td style="padding:6px 8px;font-size:11px;color:#2563EB;font-weight:700;border-bottom:1px solid #E5E7EB;">${job.wipNumber}</td>
      <td style="padding:6px 8px;font-size:11px;color:#374151;border-bottom:1px solid #E5E7EB;">${job.vehicleReg}</td>
      <td style="padding:6px 8px;font-size:11px;color:#374151;text-align:right;border-bottom:1px solid #E5E7EB;">${hrs}</td>
    </tr>`;
  }).join('');

  const pieChartSVG = buildPieChartSVG(billedSnapshotHours, totalOpenHours, totalSoldHours, availableHours);

  return `
    <div class="page-break"></div>
    <div style="padding:0;">
      <div style="text-align:center;font-size:16px;font-weight:700;color:#1565C0;margin-bottom:20px;padding-top:8px;">
        Job Closure Summary
      </div>
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="flex:1;">
          <div style="background:#16A34A;color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;font-size:12px;font-weight:700;text-align:center;">
            CLOSED / INVOICED JOBS (${closedJobs.length})
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;">
            <thead>
              <tr>
                <th style="background:#D1FAE5;color:#065F46;padding:7px 8px;font-size:10px;font-weight:700;text-align:left;border-bottom:1px solid #A7F3D0;">WIP</th>
                <th style="background:#D1FAE5;color:#065F46;padding:7px 8px;font-size:10px;font-weight:700;text-align:left;border-bottom:1px solid #A7F3D0;">REG</th>
                <th style="background:#D1FAE5;color:#065F46;padding:7px 8px;font-size:10px;font-weight:700;text-align:right;border-bottom:1px solid #A7F3D0;">HOURS</th>
              </tr>
            </thead>
            <tbody>${closedRowsHtml}</tbody>
            <tfoot>
              <tr style="background:#D1FAE5;">
                <td colspan="2" style="padding:8px;font-size:11px;font-weight:700;color:#065F46;border-top:2px solid #16A34A;">TOTAL</td>
                <td style="padding:8px;font-size:12px;font-weight:700;color:#065F46;text-align:right;border-top:2px solid #16A34A;">${totalClosedHours.toFixed(2)}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style="flex:1;">
          <div style="background:#DC2626;color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;font-size:12px;font-weight:700;text-align:center;">
            OPEN / AWAITING JOBS (${openJobs.length})
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;">
            <thead>
              <tr>
                <th style="background:#FEE2E2;color:#7F1D1D;padding:7px 8px;font-size:10px;font-weight:700;text-align:left;border-bottom:1px solid #FECACA;">WIP</th>
                <th style="background:#FEE2E2;color:#7F1D1D;padding:7px 8px;font-size:10px;font-weight:700;text-align:left;border-bottom:1px solid #FECACA;">REG</th>
                <th style="background:#FEE2E2;color:#7F1D1D;padding:7px 8px;font-size:10px;font-weight:700;text-align:right;border-bottom:1px solid #FECACA;">HOURS</th>
              </tr>
            </thead>
            <tbody>${openRowsHtml}</tbody>
            <tfoot>
              <tr style="background:#FEE2E2;">
                <td colspan="2" style="padding:8px;font-size:11px;font-weight:700;color:#7F1D1D;border-top:2px solid #DC2626;">TOTAL</td>
                <td style="padding:8px;font-size:12px;font-weight:700;color:#7F1D1D;text-align:right;border-top:2px solid #DC2626;">${totalOpenHours.toFixed(2)}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      ${pieChartSVG}
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
      <div style="font-size:13px;font-weight:600;color:#1565C0;margin-bottom:12px;">Overall Summary</div>
      ${summaryDashboard(overallStats, billedSnapshotHours)}
    `;

    // Section title
    bodyContent += `
      <div style="margin-bottom:12px;margin-top:8px;">
        <div style="font-size:18px;font-weight:700;color:#1565C0;">&#128295; Detailed Job Records</div>
      </div>
    `;

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

    bodyContent += `
      <div style="margin-bottom:12px;margin-top:8px;">
        <div style="font-size:18px;font-weight:700;color:#1565C0;">&#128295; Detailed Job Records</div>
      </div>
    `;

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
  bodyContent += buildClosureSummaryPage(
    closedJobs,
    openJobs,
    billingByJobId,
    availableHours,
    overallStats.soldHours
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #FFFFFF;
      color: #374151;
      font-size: 12px;
      line-height: 1.5;
    }
    table { border-collapse: collapse; width: 100%; }
    .page-break { page-break-before: always; break-before: page; margin-top: 32px; }
    @media print {
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .page-break { page-break-before: always; break-before: page; }
    }
  </style>
</head>
<body style="padding:24px 28px;">

  <!-- ═══ HEADER ═══ -->
  <div style="text-align:center;padding:20px 0 16px;border-bottom:2px solid #BFDBFE;margin-bottom:24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#2563EB;margin-bottom:6px;">TECH TIMES</div>
    <div style="font-size:24px;font-weight:800;color:#1565C0;letter-spacing:-0.5px;line-height:1.1;margin-bottom:6px;">${reportType}</div>
    <div style="font-size:12px;color:#6B7280;font-weight:500;">${technicianName} &nbsp;·&nbsp; ${periodLabel}</div>
  </div>

  <!-- ═══ BODY ═══ -->
  ${bodyContent}

  <!-- ═══ FOOTER ═══ -->
  <div style="border-top:1px solid #BFDBFE;text-align:center;padding:12px 0;margin-top:24px;">
    <span style="font-size:10px;color:#9CA3AF;letter-spacing:0.5px;">
      TECH TIMES &nbsp;•&nbsp; Generated on ${generatedDate}
    </span>
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
