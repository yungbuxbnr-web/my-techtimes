
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

// ── SVG Donut chart ───────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
  hours: number;
}

function buildDonutSVG(
  segments: DonutSegment[],
  total: number,
  centerLine1: string,
  centerLine2: string,
  centerLine3: string,
  size: number = 200
): string {
  const r = size * 0.35;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.14;
  const circumference = 2 * Math.PI * r;

  const safeTotal = Math.max(total, 0.001);
  let cumulativeDash = 0;

  const circles = segments.map(seg => {
    const pct = Math.min(Math.max(seg.value / safeTotal, 0), 1);
    const dash = pct * circumference;
    const gap = circumference - dash;
    const offset = -cumulativeDash;
    cumulativeDash += dash;
    if (dash < 0.01) return '';
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}"
      stroke-dasharray="${dash.toFixed(3)} ${gap.toFixed(3)}"
      stroke-dashoffset="${offset.toFixed(3)}"
      transform="rotate(-90 ${cx} ${cy})"/>`;
  }).join('');

  const fs1 = size * 0.09;
  const fs2 = size * 0.055;
  const fs3 = size * 0.048;
  const y1 = cy - size * 0.04;
  const y2 = cy + size * 0.06;
  const y3 = cy + size * 0.115;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="${strokeWidth}"/>
    ${circles}
    <text x="${cx}" y="${y1}" text-anchor="middle" font-size="${fs1}" font-weight="800" fill="#1565C0">${centerLine1}</text>
    <text x="${cx}" y="${y2}" text-anchor="middle" font-size="${fs2}" fill="#6B7280">${centerLine2}</text>
    <text x="${cx}" y="${y3}" text-anchor="middle" font-size="${fs3}" font-weight="700" fill="#1565C0">${centerLine3}</text>
  </svg>`;
}

// ── Hours utilisation donut ───────────────────────────────────────────────────

function buildHoursDonut(
  invoicedHours: number,
  openHours: number,
  availableHours: number,
  size: number = 200
): { svg: string; overPerf: boolean; overPerfHours: number; overPerfPct: number } {
  const soldHours = invoicedHours + openHours;
  const overPerf = soldHours > availableHours && availableHours > 0;
  const overPerfHours = overPerf ? soldHours - availableHours : 0;
  const overPerfPct = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const remaining = Math.max(0, availableHours - soldHours);
  const total = Math.max(availableHours, soldHours, 0.001);

  const segments: DonutSegment[] = overPerf
    ? [
        { value: invoicedHours, color: '#16A34A', label: 'Invoiced/Closed', hours: invoicedHours },
        { value: openHours,     color: '#D97706', label: 'Open/Awaiting',   hours: openHours },
      ]
    : [
        { value: invoicedHours, color: '#16A34A', label: 'Invoiced/Closed', hours: invoicedHours },
        { value: openHours,     color: '#D97706', label: 'Open/Awaiting',   hours: openHours },
        { value: remaining,     color: '#D1D5DB', label: 'Remaining',       hours: remaining },
      ];

  const utilPct = availableHours > 0 ? Math.min((soldHours / availableHours) * 100, 119) : 0;
  const svg = buildDonutSVG(
    segments,
    total,
    `${soldHours.toFixed(2)}h`,
    `of ${availableHours.toFixed(1)}h available`,
    `${utilPct.toFixed(1)}% utilised`,
    size
  );
  return { svg, overPerf, overPerfHours, overPerfPct };
}

// ── Job closure donut ─────────────────────────────────────────────────────────

function buildClosureDonut(
  invoicedCount: number,
  openCount: number,
  size: number = 200
): string {
  const total = invoicedCount + openCount;
  const closurePct = total > 0 ? (invoicedCount / total) * 100 : 0;
  const segments: DonutSegment[] = [
    { value: invoicedCount, color: '#16A34A', label: 'Invoiced/Closed', hours: invoicedCount },
    { value: openCount,     color: '#D97706', label: 'Open/Awaiting',   hours: openCount },
  ];
  return buildDonutSVG(
    segments,
    Math.max(total, 0.001),
    String(total),
    'JOBS',
    `${closurePct.toFixed(0)}% closure rate`,
    size
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function metricCard(
  icon: string,
  value: string,
  label: string,
  colorClass: string
): string {
  return `<div class="metric-card metric-${colorClass}">
    <div class="metric-icon-wrap metric-icon-${colorClass}">${icon}</div>
    <div class="metric-value">${value}</div>
    <div class="metric-label">${label}</div>
  </div>`;
}

// ── Page 1: Performance Dashboard ────────────────────────────────────────────

function buildPerformanceDashboard(
  stats: PeriodStats,
  closedJobs: Job[],
  openJobs: Job[],
  billedHours: number,
  availableHours: number,
  periodLabel: string,
  reportType: string,
  technicianName: string,
  generatedDate: string,
  options: ExportOptions,
  billingByJobId: Map<string, any>
): string {
  const soldHours = stats.soldHours;
  const openHours = openJobs.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);
  const invoicedHours = billedHours;
  const remaining = Math.max(0, availableHours - soldHours);
  const recEffPct = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const billedEffPct = availableHours > 0 ? (invoicedHours / availableHours) * 100 : 0;
  const totalJobs = stats.jobCount;
  const invoicedCount = closedJobs.length;
  const openCount = openJobs.length;
  const closurePct = totalJobs > 0 ? (invoicedCount / totalJobs) * 100 : 0;

  // Row 1 metric cards
  const row1 = `<div class="metric-row">
    ${metricCard('&#9201;', availableHours.toFixed(1) + 'h', 'AVAILABLE HOURS', 'blue')}
    ${metricCard('&#10003;', soldHours.toFixed(2) + 'h', 'SOLD HOURS', 'blue')}
    ${metricCard('&#128196;', invoicedHours.toFixed(1) + 'h', 'INVOICED / CLOSED HOURS', 'green')}
    ${metricCard('&#9711;', openHours.toFixed(2) + 'h', 'OPEN / AWAITING HOURS', 'orange')}
  </div>`;

  // Row 2 metric cards
  const row2 = `<div class="metric-row">
    ${metricCard('&#8599;', recEffPct.toFixed(1) + '%', 'RECORDED EFFICIENCY %', 'blue')}
    ${metricCard('&#9679;', billedEffPct.toFixed(1) + '%', 'BILLED EFFICIENCY %', 'green')}
    ${metricCard('&#9783;', String(totalJobs), 'TOTAL JOBS', 'blue')}
    ${metricCard('&#10003;', String(invoicedCount), 'INVOICED JOBS', 'green')}
    ${metricCard('&#9711;', String(openCount), 'OPEN JOBS', 'orange')}
  </div>`;

  // Working time table
  let weekStartStr = '';
  let weekEndStr = '';
  if (options.type === 'weekly' && options.week !== undefined) {
    // derive from jobs
  }
  // Derive period dates from jobs if available
  const allJobDates = [...closedJobs, ...openJobs].map(j => new Date(j.createdAt).getTime()).filter(t => !isNaN(t));
  const minDate = allJobDates.length > 0 ? new Date(Math.min(...allJobDates)) : null;
  const maxDate = allJobDates.length > 0 ? new Date(Math.max(...allJobDates)) : null;

  let periodRows = '';
  if (options.type === 'weekly' && minDate && maxDate) {
    const wRange = getWeekRange(minDate);
    const wStartFmt = wRange.start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const wEndFmt = wRange.end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const wStartDay = wRange.start.toLocaleDateString('en-GB', { weekday: 'short' });
    const wEndDay = wRange.end.toLocaleDateString('en-GB', { weekday: 'short' });
    periodRows = `<tr><td class="wt-label">Week Start</td><td class="wt-value">${wStartFmt} (${wStartDay})</td></tr>
      <tr><td class="wt-label">Week End</td><td class="wt-value">${wEndFmt} (${wEndDay})</td></tr>`;
  } else if (options.type === 'monthly' && options.month) {
    periodRows = `<tr><td class="wt-label">Month</td><td class="wt-value">${fmtMonthLabel(options.month)}</td></tr>`;
  } else if (options.type === 'daily' && options.day) {
    periodRows = `<tr><td class="wt-label">Day</td><td class="wt-value">${fmtDateShort(options.day)}</td></tr>`;
  } else if (options.type === 'all') {
    if (minDate && maxDate) {
      periodRows = `<tr><td class="wt-label">From</td><td class="wt-value">${fmtDateShort(minDate.toISOString())}</td></tr>
        <tr><td class="wt-label">To</td><td class="wt-value">${fmtDateShort(maxDate.toISOString())}</td></tr>`;
    }
  }

  const workingTimeTable = `<div class="three-col-title">&#128197; WORKING TIME &amp; AVAILABILITY</div>
    <table class="wt-table">
      <tbody>
        <tr><td class="wt-label">Standard Available Hours</td><td class="wt-value">${availableHours.toFixed(1)}h</td></tr>
        <tr><td class="wt-label">Sold Hours (Recorded)</td><td class="wt-value">${soldHours.toFixed(2)}h</td></tr>
        <tr><td class="wt-label">Invoiced / Closed Hours</td><td class="wt-value">${invoicedHours.toFixed(1)}h</td></tr>
        <tr><td class="wt-label">Open / Awaiting Hours</td><td class="wt-value">${openHours.toFixed(2)}h</td></tr>
        <tr><td class="wt-label">Remaining Available Hours</td><td class="wt-value">${remaining.toFixed(2)}h</td></tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        ${periodRows}
      </tbody>
    </table>`;

  // Centre donut
  const { svg: hoursDonutSvg, overPerf, overPerfHours, overPerfPct } = buildHoursDonut(invoicedHours, openHours, availableHours, 180);
  const invPct = availableHours > 0 ? (invoicedHours / availableHours) * 100 : 0;
  const opPct = availableHours > 0 ? (openHours / availableHours) * 100 : 0;
  const remPct = availableHours > 0 ? (remaining / availableHours) * 100 : 0;

  const hoursDonutLegend = `<div class="donut-legend">
    <div class="legend-row">
      <span class="legend-swatch" style="background:#16A34A;"></span>
      <span class="legend-label">Invoiced / Closed</span>
      <span class="legend-val">${invoicedHours.toFixed(1)}h</span>
      <span class="legend-pct">(${invPct.toFixed(1)}%)</span>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:#D97706;"></span>
      <span class="legend-label">Open / Awaiting</span>
      <span class="legend-val">${openHours.toFixed(2)}h</span>
      <span class="legend-pct">(${opPct.toFixed(1)}%)</span>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:#D1D5DB;"></span>
      <span class="legend-label">Remaining Available</span>
      <span class="legend-val">${remaining.toFixed(2)}h</span>
      <span class="legend-pct">(${remPct.toFixed(1)}%)</span>
    </div>
    <div class="legend-footer">Whole donut = Available Hours (${availableHours.toFixed(1)}h)</div>
  </div>`;

  const overPerfCallout = overPerf ? `<div class="overperf-callout">
    +${overPerfHours.toFixed(1)}h ABOVE AVAILABLE HOURS<br/>
    ${overPerfPct.toFixed(1)}% EFFICIENCY
  </div>` : '';

  const centreDonut = `<div class="three-col-title">AVAILABLE HOURS UTILISATION</div>
    <div style="text-align:center;">${hoursDonutSvg}</div>
    ${overPerfCallout}
    ${hoursDonutLegend}`;

  // Right donut — job closure
  const closureDonutSvg = buildClosureDonut(invoicedCount, openCount, 160);
  const invJobPct = totalJobs > 0 ? (invoicedCount / totalJobs) * 100 : 0;
  const opJobPct = totalJobs > 0 ? (openCount / totalJobs) * 100 : 0;
  const closureDonutLegend = `<div class="donut-legend">
    <div class="legend-row">
      <span class="legend-swatch" style="background:#16A34A;"></span>
      <span class="legend-label">Invoiced / Closed Jobs</span>
      <span class="legend-val">${invoicedCount}</span>
      <span class="legend-pct">(${invJobPct.toFixed(0)}%)</span>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:#D97706;"></span>
      <span class="legend-label">Open / Awaiting Jobs</span>
      <span class="legend-val">${openCount}</span>
      <span class="legend-pct">(${opJobPct.toFixed(0)}%)</span>
    </div>
    <div class="legend-footer">Total Jobs: ${totalJobs}</div>
  </div>`;

  const rightDonut = `<div class="three-col-title">JOB CLOSURE POSITION</div>
    <div style="text-align:center;">${closureDonutSvg}</div>
    ${closureDonutLegend}`;

  return `
    <div class="dashboard-header">
      <div class="brand-title">T E C H &nbsp; T I M E S</div>
      <div class="report-type">${reportType}</div>
      <div class="report-sub">${technicianName} &nbsp;&middot;&nbsp; ${periodLabel}</div>
    </div>
    ${row1}
    ${row2}
    <div class="three-col-section">
      <div class="three-col-left">${workingTimeTable}</div>
      <div class="three-col-centre">${centreDonut}</div>
      <div class="three-col-right">${rightDonut}</div>
    </div>
  `;
}

// ── Table header row ──────────────────────────────────────────────────────────

function tableHeaderRow(): string {
  return `
    <thead>
      <tr>
        <th style="width:9%;">WIP</th>
        <th style="width:12%;">VEHICLE REG</th>
        <th style="width:9%;">VHC</th>
        <th style="width:28%;">JOB DESCRIPTION</th>
        <th style="width:6%;text-align:center;">AW</th>
        <th style="width:9%;text-align:center;">TIME</th>
        <th style="width:15%;text-align:center;">DATE &amp; TIME</th>
        <th style="width:12%;text-align:center;">STATUS</th>
      </tr>
    </thead>`;
}

// ── Single job row ────────────────────────────────────────────────────────────

function jobRow(job: Job, _isEven: boolean, billingRecord?: any): string {
  const TD = `padding:7px 9px;font-size:10.5px;color:#1C2B3A;vertical-align:middle;border-bottom:1px solid #E5E7EB;`;
  const jobMinutes = awToMinutes(Number(job.aw) || 0);
  const timeFormatted = fmtTime(jobMinutes);
  const notes = job.notes ? job.notes.trim() : '';
  const dateTimeStr = fmtJobDateTime(job.createdAt);
  const datePart = dateTimeStr.split(' ')[0];
  const timePart = dateTimeStr.split(' ')[1];
  const status = billingRecord ? normaliseBillingStatus(billingRecord.billingStatus) : 'open';
  const statusBadge = status === 'billed'
    ? `<span class="tt-badge tt-badge-invoiced">INVOICED</span>`
    : `<span class="tt-badge tt-badge-open">OPEN /<br/>AWAITING</span>`;
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

  const weekMap = new Map<string, Job[]>();
  jobs.forEach(job => {
    const d = new Date(job.createdAt);
    const wk = getWeekKey(d);
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(job);
  });

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

  const closedJobs = jobs.filter(j => {
    const rec = billingByJobId.get(j.id);
    return rec && normaliseBillingStatus(rec.billingStatus) === 'billed';
  });
  const openJobs = jobs.filter(j => {
    const rec = billingByJobId.get(j.id);
    return !rec || normaliseBillingStatus(rec.billingStatus) === 'open';
  });

  const openHours = openJobs.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);
  const { svg: donutSvg, overPerf, overPerfHours, overPerfPct } = buildHoursDonut(yearBilledHours, openHours, availHours, 160);
  const invPct = availHours > 0 ? (yearBilledHours / availHours) * 100 : 0;
  const opPct = availHours > 0 ? (openHours / availHours) * 100 : 0;
  const rem = Math.max(0, availHours - stats.soldHours);
  const remPct = availHours > 0 ? (rem / availHours) * 100 : 0;

  const overPerfCallout = overPerf ? `<div class="overperf-callout">+${overPerfHours.toFixed(1)}h ABOVE AVAILABLE HOURS &nbsp; ${overPerfPct.toFixed(1)}% EFFICIENCY</div>` : '';

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
      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px;">
        <div style="text-align:center;">${donutSvg}${overPerfCallout}</div>
        <div style="flex:1;min-width:180px;">
          <div class="donut-legend">
            <div class="legend-row"><span class="legend-swatch" style="background:#16A34A;"></span><span class="legend-label">Invoiced/Closed</span><span class="legend-val">${yearBilledHours.toFixed(1)}h</span><span class="legend-pct">(${invPct.toFixed(1)}%)</span></div>
            <div class="legend-row"><span class="legend-swatch" style="background:#D97706;"></span><span class="legend-label">Open/Awaiting</span><span class="legend-val">${openHours.toFixed(1)}h</span><span class="legend-pct">(${opPct.toFixed(1)}%)</span></div>
            <div class="legend-row"><span class="legend-swatch" style="background:#D1D5DB;"></span><span class="legend-label">Remaining</span><span class="legend-val">${rem.toFixed(1)}h</span><span class="legend-pct">(${remPct.toFixed(1)}%)</span></div>
            <div class="legend-footer">Available Hours: ${availHours.toFixed(1)}h &nbsp;|&nbsp; Sold: ${stats.soldHours.toFixed(2)}h &nbsp;|&nbsp; Jobs: ${stats.jobCount} &nbsp;|&nbsp; Invoiced: ${closedJobs.length} &nbsp;|&nbsp; Open: ${openJobs.length}</div>
          </div>
        </div>
      </div>
    </div>
    ${monthsHtml}
  `;
}

// ── Daily performance table ───────────────────────────────────────────────────

function buildDailyPerformanceTable(
  sortedJobs: Job[],
  billingByJobId: Map<string, any>,
  schedule: Schedule
): string {
  const dayMap = groupJobsByDay(sortedJobs);
  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));

  if (sortedDays.length === 0) return '';

  let totAvail = 0, totSold = 0, totInv = 0, totOpen = 0, totClosed = 0, totOpenJobs = 0;

  const rows = sortedDays.map(day => {
    const dayJobs = dayMap.get(day)!;
    const dayDate = new Date(day);
    const avail = calcAvailableHoursForPeriod(dayDate, dayDate, schedule);
    const dayStats = calcPeriodStats(dayJobs, avail);
    const dayClosedJobs = dayJobs.filter(j => {
      const rec = billingByJobId.get(j.id);
      return rec && normaliseBillingStatus(rec.billingStatus) === 'billed';
    });
    const dayOpenJobs = dayJobs.filter(j => {
      const rec = billingByJobId.get(j.id);
      return !rec || normaliseBillingStatus(rec.billingStatus) === 'open';
    });
    const dayInv = dayClosedJobs.reduce((s, j) => {
      const rec = billingByJobId.get(j.id);
      return s + (rec?.billedHours ?? awToHours(j.aw ?? 0));
    }, 0);
    const dayOpenH = dayOpenJobs.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);
    const recEff = avail > 0 ? (dayStats.soldHours / avail) * 100 : 0;
    const billedEff = avail > 0 ? (dayInv / avail) * 100 : 0;

    totAvail += avail;
    totSold += dayStats.soldHours;
    totInv += dayInv;
    totOpen += dayOpenH;
    totClosed += dayClosedJobs.length;
    totOpenJobs += dayOpenJobs.length;

    const dayLabel = dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `<tr>
      <td style="font-weight:600;">${dayLabel}</td>
      <td style="text-align:center;">${avail.toFixed(1)}h</td>
      <td style="text-align:center;">${dayStats.soldHours.toFixed(1)}h</td>
      <td style="text-align:center;">${dayInv.toFixed(1)}h</td>
      <td style="text-align:center;">${dayOpenH.toFixed(1)}h</td>
      <td style="text-align:center;">${recEff.toFixed(0)}%</td>
      <td style="text-align:center;">${billedEff.toFixed(0)}%</td>
      <td style="text-align:center;">${dayClosedJobs.length}</td>
      <td style="text-align:center;">${dayOpenJobs.length}</td>
    </tr>`;
  }).join('');

  const totRecEff = totAvail > 0 ? (totSold / totAvail) * 100 : 0;
  const totBilledEff = totAvail > 0 ? (totInv / totAvail) * 100 : 0;

  return `
    <div class="page-section-heading" style="margin-top:24px;">
      <span class="section-title">DAILY PERFORMANCE</span>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;margin-top:8px;">
      <thead><tr>
        <th>DATE</th>
        <th style="text-align:center;">AVAILABLE</th>
        <th style="text-align:center;">SOLD</th>
        <th style="text-align:center;">INVOICED</th>
        <th style="text-align:center;">OPEN</th>
        <th style="text-align:center;">REC EFF</th>
        <th style="text-align:center;">BILLED EFF</th>
        <th style="text-align:center;">CLOSED</th>
        <th style="text-align:center;">OPEN</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#EFF6FF;font-weight:700;">
        <td>TOTALS</td>
        <td style="text-align:center;">${totAvail.toFixed(1)}h</td>
        <td style="text-align:center;">${totSold.toFixed(1)}h</td>
        <td style="text-align:center;">${totInv.toFixed(1)}h</td>
        <td style="text-align:center;">${totOpen.toFixed(1)}h</td>
        <td style="text-align:center;">${totRecEff.toFixed(0)}%</td>
        <td style="text-align:center;">${totBilledEff.toFixed(0)}%</td>
        <td style="text-align:center;">${totClosed}</td>
        <td style="text-align:center;">${totOpenJobs}</td>
      </tr></tfoot>
    </table>
  `;
}

// ── Page 3: Invoiced & Open Job Breakdown ─────────────────────────────────────

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

  // Large donut for page 3
  const { svg: donutSvg, overPerf, overPerfHours, overPerfPct } = buildHoursDonut(totalClosedHours, totalOpenHours, availableHours, 220);
  const invPct = availableHours > 0 ? (totalClosedHours / availableHours) * 100 : 0;
  const opPct = availableHours > 0 ? (totalOpenHours / availableHours) * 100 : 0;
  const remaining = Math.max(0, availableHours - totalSoldHours);
  const remPct = availableHours > 0 ? (remaining / availableHours) * 100 : 0;

  const overPerfCallout = overPerf ? `<div class="overperf-callout">+${overPerfHours.toFixed(1)}h ABOVE AVAILABLE HOURS &nbsp; ${overPerfPct.toFixed(1)}% EFFICIENCY</div>` : '';

  return `
    <div class="page-break"></div>
    <div class="page-section-heading">
      <span class="section-num">PAGE 3</span>
      <span class="section-title">INVOICED &amp; OPEN JOB BREAKDOWN</span>
    </div>
    <div style="display:flex;gap:16px;align-items:flex-start;margin-top:12px;">
      <div style="flex:1;">
        <div class="tt-closure-col-header tt-closure-col-header-invoiced">INVOICED / CLOSED JOBS</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #BBF7D0;">
          <thead><tr>
            <th style="background:#15803D;">WIP</th>
            <th style="background:#15803D;">REG</th>
            <th style="background:#15803D;text-align:right;">HOURS</th>
          </tr></thead>
          <tbody>${closedRows || '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;font-style:italic;padding:10px;">No invoiced jobs</td></tr>'}</tbody>
          <tfoot><tr style="background:#F0FDF4;">
            <td colspan="2" style="font-weight:700;color:#15803D;border-top:2px solid #15803D;padding:8px 10px;">TOTAL</td>
            <td style="font-weight:700;color:#15803D;text-align:right;border-top:2px solid #15803D;padding:8px 10px;">${totalClosedHours.toFixed(1)}h</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="flex:1;">
        <div class="tt-closure-col-header tt-closure-col-header-open">OPEN / AWAITING JOBS</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #FDE68A;">
          <thead><tr>
            <th style="background:#D97706;">WIP</th>
            <th style="background:#D97706;">REG</th>
            <th style="background:#D97706;text-align:right;">HOURS</th>
          </tr></thead>
          <tbody>${openRows || '<tr><td colspan="3" style="text-align:center;color:#9CA3AF;font-style:italic;padding:10px;">No open jobs</td></tr>'}</tbody>
          <tfoot><tr style="background:#FFFBEB;">
            <td colspan="2" style="font-weight:700;color:#D97706;border-top:2px solid #D97706;padding:8px 10px;">TOTAL</td>
            <td style="font-weight:700;color:#D97706;text-align:right;border-top:2px solid #D97706;padding:8px 10px;">${totalOpenHours.toFixed(2)}h</td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <div class="page-section-heading" style="margin-top:24px;">
      <span class="section-title">AVAILABLE HOURS UTILISATION</span>
    </div>
    <div style="display:flex;gap:32px;align-items:center;justify-content:center;margin-top:16px;flex-wrap:wrap;">
      <div style="text-align:center;">${donutSvg}${overPerfCallout}</div>
      <div>
        <div class="donut-legend">
          <div class="legend-row"><span class="legend-swatch" style="background:#16A34A;"></span><span class="legend-label">Invoiced / Closed</span><span class="legend-val">${totalClosedHours.toFixed(1)}h</span><span class="legend-pct">(${invPct.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D97706;"></span><span class="legend-label">Open / Awaiting</span><span class="legend-val">${totalOpenHours.toFixed(2)}h</span><span class="legend-pct">(${opPct.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D1D5DB;"></span><span class="legend-label">Remaining Available</span><span class="legend-val">${remaining.toFixed(2)}h</span><span class="legend-pct">(${remPct.toFixed(1)}%)</span></div>
          <div class="legend-row" style="border-top:1px solid #E5E7EB;padding-top:6px;margin-top:4px;"><span class="legend-swatch" style="background:#1565C0;"></span><span class="legend-label">Total Available</span><span class="legend-val">${availableHours.toFixed(1)}h</span><span class="legend-pct">(100%)</span></div>
        </div>
        <div style="font-size:9px;color:#9CA3AF;margin-top:10px;max-width:220px;line-height:1.5;">
          Whole donut = Available Hours &nbsp;&middot;&nbsp; Invoiced + Open = Sold Hours &nbsp;&middot;&nbsp; Remaining = Unused Available Capacity
        </div>
      </div>
    </div>
  `;
}

// ── Page 4: Donut chart examples (ENTIRE/ALL export only) ─────────────────────

function buildChartExamplesPage(
  invoicedHours: number,
  openHours: number,
  availableHours: number,
  invoicedCount: number,
  openCount: number
): string {
  // Example A: Normal period
  const { svg: svgA, overPerf: opA, overPerfHours: ophA, overPerfPct: oppA } = buildHoursDonut(invoicedHours, openHours, availableHours, 160);
  const invPctA = availableHours > 0 ? (invoicedHours / availableHours) * 100 : 0;
  const opPctA = availableHours > 0 ? (openHours / availableHours) * 100 : 0;
  const remA = Math.max(0, availableHours - invoicedHours - openHours);
  const remPctA = availableHours > 0 ? (remA / availableHours) * 100 : 0;

  // Example B: Job closure
  const svgB = buildClosureDonut(invoicedCount, openCount, 160);
  const invJobPctB = (invoicedCount + openCount) > 0 ? (invoicedCount / (invoicedCount + openCount)) * 100 : 0;
  const opJobPctB = (invoicedCount + openCount) > 0 ? (openCount / (invoicedCount + openCount)) * 100 : 0;

  // Example C: Over-performance (sold = available * 1.19)
  const overAvail = availableHours > 0 ? availableHours : 42;
  const overInv = overAvail * 0.857;
  const overOpen = overAvail * 0.333;
  const { svg: svgC, overPerf: opC, overPerfHours: ophC, overPerfPct: oppC } = buildHoursDonut(overInv, overOpen, overAvail, 160);
  const invPctC = overAvail > 0 ? (overInv / overAvail) * 100 : 0;
  const opPctC = overAvail > 0 ? (overOpen / overAvail) * 100 : 0;
  const remC = Math.max(0, overAvail - overInv - overOpen);
  const remPctC = overAvail > 0 ? (remC / overAvail) * 100 : 0;

  const overPerfCalloutA = opA ? `<div class="overperf-callout">+${ophA.toFixed(1)}h ABOVE AVAILABLE HOURS<br/>${oppA.toFixed(1)}% EFFICIENCY</div>` : '';
  const overPerfCalloutC = `<div class="overperf-callout">+${ophC.toFixed(1)}h ABOVE AVAILABLE HOURS<br/>${oppC.toFixed(1)}% EFFICIENCY</div>`;

  return `
    <div class="page-break"></div>
    <div class="page-section-heading">
      <span class="section-num">PAGE 4</span>
      <span class="section-title">PIE / DONUT CHART EXAMPLES</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:180px;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#1565C0;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Example A</div>
        <div style="font-size:9px;color:#6B7280;margin-bottom:10px;">Normal Period Example</div>
        ${svgA}
        ${overPerfCalloutA}
        <div class="donut-legend" style="text-align:left;margin-top:8px;">
          <div class="legend-row"><span class="legend-swatch" style="background:#16A34A;"></span><span class="legend-label">Invoiced / Closed</span><span class="legend-val">${invoicedHours.toFixed(1)}h</span><span class="legend-pct">(${invPctA.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D97706;"></span><span class="legend-label">Open / Awaiting</span><span class="legend-val">${openHours.toFixed(1)}h</span><span class="legend-pct">(${opPctA.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D1D5DB;"></span><span class="legend-label">Remaining Available</span><span class="legend-val">${remA.toFixed(1)}h</span><span class="legend-pct">(${remPctA.toFixed(1)}%)</span></div>
          <div class="legend-footer">Available Hours: ${availableHours.toFixed(1)}h</div>
        </div>
      </div>
      <div style="flex:1;min-width:180px;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#1565C0;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Example B</div>
        <div style="font-size:9px;color:#6B7280;margin-bottom:10px;">Job Closure Example</div>
        ${svgB}
        <div class="donut-legend" style="text-align:left;margin-top:8px;">
          <div class="legend-row"><span class="legend-swatch" style="background:#16A34A;"></span><span class="legend-label">Invoiced / Closed Jobs</span><span class="legend-val">${invoicedCount}</span><span class="legend-pct">(${invJobPctB.toFixed(0)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D97706;"></span><span class="legend-label">Open / Awaiting Jobs</span><span class="legend-val">${openCount}</span><span class="legend-pct">(${opJobPctB.toFixed(0)}%)</span></div>
          <div class="legend-footer">Total Jobs: ${invoicedCount + openCount}</div>
        </div>
      </div>
      <div style="flex:1;min-width:180px;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#1565C0;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Example C</div>
        <div style="font-size:9px;color:#6B7280;margin-bottom:10px;">Over-Performance Example</div>
        ${svgC}
        ${overPerfCalloutC}
        <div class="donut-legend" style="text-align:left;margin-top:8px;">
          <div class="legend-row"><span class="legend-swatch" style="background:#16A34A;"></span><span class="legend-label">Invoiced / Closed</span><span class="legend-val">${overInv.toFixed(1)}h</span><span class="legend-pct">(${invPctC.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D97706;"></span><span class="legend-label">Open / Awaiting</span><span class="legend-val">${overOpen.toFixed(1)}h</span><span class="legend-pct">(${opPctC.toFixed(1)}%)</span></div>
          <div class="legend-row"><span class="legend-swatch" style="background:#D1D5DB;"></span><span class="legend-label">Remaining Available</span><span class="legend-val">${remC.toFixed(1)}h</span><span class="legend-pct">(${remPctC.toFixed(1)}%)</span></div>
          <div class="legend-footer">Available Hours: ${overAvail.toFixed(1)}h</div>
        </div>
        <div style="font-size:8.5px;color:#9CA3AF;margin-top:6px;line-height:1.4;">Donut still represents 100% of available capacity.<br/>Extra performance shown as a separate callout.</div>
      </div>
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

  const billingRecords = await billingStorage.getAllRecords();
  console.log('ExportUtils: Loaded', billingRecords.length, 'billing records');
  const billingByJobId = new Map(billingRecords.map((r: any) => [r.jobId, r]));

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
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

  const sortedJobs = jobs.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let availableHours = options.availableHours ?? 0;
  if (availableHours === 0 && sortedJobs.length > 0) {
    const oldest = new Date(sortedJobs[sortedJobs.length - 1].createdAt);
    const newest = new Date(sortedJobs[0].createdAt);
    availableHours = calcAvailableHoursForPeriod(oldest, newest, schedule);
  }
  const overallStats = calcPeriodStats(sortedJobs, availableHours);

  const closedJobs = sortedJobs.filter(job => {
    const rec = billingByJobId.get(job.id);
    return rec && normaliseBillingStatus(rec.billingStatus) === 'billed';
  });
  const openJobs = sortedJobs.filter(job => {
    const rec = billingByJobId.get(job.id);
    return !rec || normaliseBillingStatus(rec.billingStatus) === 'open';
  });
  console.log('ExportUtils: Closed jobs:', closedJobs.length, 'Open jobs:', openJobs.length);

  const billedSnapshotHours = closedJobs.reduce((sum, j) => {
    const rec = billingByJobId.get(j.id);
    return sum + (rec?.billedHours ?? awToHours(j.aw ?? 0));
  }, 0);

  const totalClosedHours = billedSnapshotHours;
  const totalOpenHours = openJobs.reduce((sum, j) => sum + awToHours(j.aw ?? 0), 0);

  // ── PAGE 1: Performance Dashboard ──
  const page1 = buildPerformanceDashboard(
    overallStats,
    closedJobs,
    openJobs,
    billedSnapshotHours,
    availableHours,
    periodLabel,
    reportType,
    technicianName,
    generatedDate,
    options,
    billingByJobId
  );

  // ── PAGE 2: Detailed Job Records ──
  let page2 = `
    <div class="page-break"></div>
    <div class="page-section-heading">
      <span class="section-num">PAGE 2</span>
      <span class="section-title">DETAILED JOB RECORDS</span>
    </div>
  `;

  if (options.type === 'all') {
    const yearMap = new Map<number, Job[]>();
    sortedJobs.forEach(job => {
      const yr = new Date(job.createdAt).getFullYear();
      if (!yearMap.has(yr)) yearMap.set(yr, []);
      yearMap.get(yr)!.push(job);
    });
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);
    sortedYears.forEach(yr => {
      page2 += yearSectionHtml(yr, yearMap.get(yr)!, schedule, billingByJobId);
    });
  } else {
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

    page2 += `
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;margin-top:8px;">
        ${tableHeaderRow()}
        <tbody>${tableRows}</tbody>
      </table>
      <div style="font-size:9px;color:#6B7280;text-align:center;margin-top:8px;font-style:italic;">All times recorded during the selected reporting period.</div>
    `;

    // Daily performance table for week/month
    if (options.type === 'weekly' || options.type === 'monthly') {
      page2 += buildDailyPerformanceTable(sortedJobs, billingByJobId, schedule);
    }
  }

  // ── PAGE 3: Invoiced & Open Job Breakdown ──
  const page3 = buildClosureSummaryPage(
    closedJobs,
    openJobs,
    totalClosedHours,
    totalOpenHours,
    availableHours,
    overallStats.soldHours
  );

  // ── PAGE 4: Chart examples (all export only) ──
  const page4 = options.type === 'all'
    ? buildChartExamplesPage(billedSnapshotHours, totalOpenHours, availableHours, closedJobs.length, openJobs.length)
    : '';

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 12mm 14mm; size: A4 portrait; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, Helvetica, sans-serif;
      background: #FFFFFF;
      color: #1C2B3A;
      font-size: 11px;
      line-height: 1.5;
    }

    /* ── Dashboard header ── */
    .dashboard-header {
      text-align: center;
      padding: 18px 0 14px;
      border-bottom: 2px solid #BFDBFE;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 11px; font-weight: 800; letter-spacing: 5px;
      color: #2563EB; text-transform: uppercase; margin-bottom: 4px;
    }
    .report-type {
      font-size: 24px; font-weight: 800; color: #1565C0;
      letter-spacing: -0.3px; line-height: 1.1; margin-bottom: 4px;
    }
    .report-sub { font-size: 11px; color: #6B7280; font-weight: 500; }

    /* ── Metric cards ── */
    .metric-row {
      display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
    }
    .metric-card {
      flex: 1; min-width: 90px;
      border-radius: 8px; padding: 12px 10px 10px;
      page-break-inside: avoid;
      position: relative;
    }
    .metric-icon-wrap {
      width: 26px; height: 26px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; margin-bottom: 8px;
    }
    .metric-value { font-size: 22px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; }
    .metric-label { font-size: 8.5px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; color: #6B7280; }

    .metric-blue { background: #EFF6FF; border: 1px solid #BFDBFE; border-left: 4px solid #1565C0; }
    .metric-blue .metric-value { color: #1565C0; }
    .metric-icon-blue { background: #DBEAFE; color: #1565C0; }

    .metric-green { background: #F0FDF4; border: 1px solid #BBF7D0; border-left: 4px solid #15803D; }
    .metric-green .metric-value { color: #15803D; }
    .metric-icon-green { background: #DCFCE7; color: #15803D; }

    .metric-orange { background: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #D97706; }
    .metric-orange .metric-value { color: #D97706; }
    .metric-icon-orange { background: #FEF3C7; color: #D97706; }

    /* ── Three-column section ── */
    .three-col-section {
      display: flex; gap: 0; margin-top: 14px;
      border: 1px solid #BFDBFE; border-radius: 8px; overflow: hidden;
    }
    .three-col-left, .three-col-centre, .three-col-right {
      flex: 1; padding: 14px 12px;
    }
    .three-col-centre { border-left: 1px solid #BFDBFE; border-right: 1px solid #BFDBFE; }
    .three-col-title {
      font-size: 9.5px; font-weight: 800; color: #1565C0;
      text-transform: uppercase; letter-spacing: 0.6px;
      margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 1px solid #BFDBFE;
    }

    /* ── Working time table ── */
    .wt-table { width: 100%; border-collapse: collapse; }
    .wt-label { font-size: 10px; color: #6B7280; padding: 4px 0; }
    .wt-value { font-size: 10px; font-weight: 700; color: #1C2B3A; padding: 4px 0; text-align: right; }

    /* ── Donut legend ── */
    .donut-legend { margin-top: 8px; }
    .legend-row {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 5px; font-size: 9.5px;
    }
    .legend-swatch { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }
    .legend-label { flex: 1; color: #374151; }
    .legend-val { font-weight: 700; color: #1C2B3A; min-width: 36px; text-align: right; }
    .legend-pct { color: #6B7280; min-width: 42px; text-align: right; }
    .legend-footer { font-size: 8.5px; color: #9CA3AF; margin-top: 6px; padding-top: 5px; border-top: 1px solid #E5E7EB; }

    /* ── Over-performance callout ── */
    .overperf-callout {
      background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px;
      padding: 6px 10px; margin: 8px auto; text-align: center;
      font-size: 9.5px; font-weight: 700; color: #D97706;
      max-width: 220px;
    }

    /* ── Section heading ── */
    .page-section-heading {
      background: #1565C0; color: #FFFFFF;
      padding: 9px 14px; margin: 0 0 0;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; gap: 10px;
      page-break-after: avoid;
    }
    .section-num { font-size: 9px; opacity: 0.8; letter-spacing: 0.5px; }
    .section-title { letter-spacing: 0.5px; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; margin: 0; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    th {
      background: #1565C0; color: #FFFFFF;
      padding: 8px 9px; text-align: left;
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
      border-right: 1px solid #1E40AF;
    }
    th:last-child { border-right: none; }
    td {
      padding: 7px 9px; font-size: 10.5px; color: #1C2B3A;
      border-bottom: 1px solid #E5E7EB; vertical-align: middle;
    }
    tr:nth-child(even) td { background: #F8FAFF; }
    tr { page-break-inside: avoid; }

    /* ── Status badges ── */
    .tt-badge {
      display: inline-block; padding: 2px 7px; border-radius: 4px;
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    }
    .tt-badge-invoiced { background: #15803D; color: #fff; }
    .tt-badge-open { background: #D97706; color: #fff; }
    .tt-badge-green { background: #15803D; color: #fff; }
    .tt-badge-amber { background: #B45309; color: #fff; }
    .tt-badge-red { background: #B91C1C; color: #fff; }
    .tt-badge-none { background: #6B7280; color: #fff; }

    /* ── Closure page ── */
    .tt-closure-col-header {
      padding: 8px 12px; border-radius: 6px 6px 0 0;
      font-size: 10px; font-weight: 700; text-align: center; color: #fff;
      letter-spacing: 0.4px;
    }
    .tt-closure-col-header-invoiced { background: #15803D; }
    .tt-closure-col-header-open { background: #D97706; }

    /* ── Footer ── */
    .tt-footer {
      border-top: 1px solid #BFDBFE; text-align: center;
      padding: 10px 0; margin-top: 28px;
      font-size: 8.5px; color: #9CA3AF; letter-spacing: 0.4px;
    }

    /* ── Page break ── */
    .page-break { page-break-after: always; }
    .avoid-break { page-break-inside: avoid; }
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body style="padding:16px 20px;">

  <!-- ═══ PAGE 1: PERFORMANCE DASHBOARD ═══ -->
  ${page1}

  <!-- ═══ PAGE 2: DETAILED JOB RECORDS ═══ -->
  ${page2}

  <!-- ═══ PAGE 3: INVOICED & OPEN JOB BREAKDOWN ═══ -->
  ${page3}

  <!-- ═══ PAGE 4: CHART EXAMPLES (all only) ═══ -->
  ${page4}

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
    let resolvedUri = fileUri;
    if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
      const tmpPath = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '') + `import_tmp_${Date.now()}.json`;
      try {
        await FileSystem.copyAsync({ from: fileUri, to: tmpPath });
        resolvedUri = tmpPath;
        console.log('ExportUtils: Copied content:// URI to temp file:', tmpPath);
      } catch (copyErr: any) {
        console.error('ExportUtils: Failed to copy content:// URI:', copyErr);
        try {
          const testRead = await FileSystem.readAsStringAsync(fileUri);
          resolvedUri = fileUri;
          console.log('ExportUtils: Direct read of content:// URI succeeded (length:', testRead.length, ')');
        } catch {
          throw new Error('Could not read the selected file. Please try exporting the backup again and re-importing.');
        }
      }
    }

    const jsonString = await FileSystem.readAsStringAsync(resolvedUri);

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
