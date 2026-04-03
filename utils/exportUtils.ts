
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Job } from './api';

export interface ExportOptions {
  type: 'daily' | 'weekly' | 'monthly' | 'all';
  month?: string;
  week?: number;
  day?: string;
  year?: number;
  targetHours?: number;
  availableHours?: number;
}

// Group jobs by day
function groupJobsByDay(jobs: Job[]): Map<string, Job[]> {
  const grouped = new Map<string, Job[]>();
  
  jobs.forEach(job => {
    const day = job.createdAt.split('T')[0];
    if (!grouped.has(day)) {
      grouped.set(day, []);
    }
    grouped.get(day)!.push(job);
  });
  
  return grouped;
}

// Calculate totals for a group of jobs
function calculateTotals(jobs: Job[]) {
  const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
  const totalHours = (totalAw * 5) / 60;
  return { totalAw, totalHours, jobCount: jobs.length };
}

// Get week number from date
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Get week range (Sunday to Saturday)
function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day); // Go back to Sunday
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6); // Saturday is 6 days after Sunday
  return { start: sunday, end: saturday };
}

// Group days by week (Sunday to Saturday)
function groupDaysByWeek(days: string[]): Map<string, string[]> {
  const weekGroups = new Map<string, string[]>();
  
  days.forEach(day => {
    const date = new Date(day);
    const weekRange = getWeekRange(new Date(date));
    const weekKey = `${weekRange.start.toISOString().split('T')[0]}_${weekRange.end.toISOString().split('T')[0]}`;
    
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(day);
  });
  
  return weekGroups;
}

// Group days by month
function groupDaysByMonth(days: string[]): Map<string, string[]> {
  const monthGroups = new Map<string, string[]>();
  
  days.forEach(day => {
    const month = day.substring(0, 7); // YYYY-MM
    if (!monthGroups.has(month)) {
      monthGroups.set(month, []);
    }
    monthGroups.get(month)!.push(day);
  });
  
  return monthGroups;
}

// ── Theme constants ──────────────────────────────────────────────────────────
const T = {
  pageBg:        '#0A1628',
  headerBg:      '#00B4D8',
  headerText:    '#FFFFFF',
  rowEven:       '#0D1F3C',
  rowOdd:        '#0A1628',
  rowText:       '#E0F4FF',
  colBorder:     '#1A3A5C',
  titleText:     '#00E5FF',
  subtitleText:  '#7EC8E3',
  sectionBg:     '#00B4D8',
  notesText:     '#B0D4E8',
  footerBg:      '#0D1F3C',
  footerText:    '#7EC8E3',
  accentCyan:    '#00B4D8',
  accentGlow:    '#00E5FF',
  statsBg:       '#0D1F3C',
  awsColor:      '#00E5FF',
  barGreen:      '#22C55E',
  barAmber:      '#F59E0B',
  barRed:        '#F87171',
};

// ── VHC pill badge ──────────────────────────────────────────────────────────
function getVhcDisplayHtml(vhcStatus?: string): string {
  if (!vhcStatus || vhcStatus === 'NONE') {
    return `<span style="display:inline-block;background:#1A3A5C;color:#7EC8E3;border-radius:10px;padding:2px 9px;font-size:10px;font-weight:600;letter-spacing:0.3px;">N/A</span>`;
  }
  const colors: Record<string, string> = {
    GREEN:  '#22C55E',
    ORANGE: '#F59E0B',
    AMBER:  '#F59E0B',
    RED:    '#F87171',
  };
  const color = colors[vhcStatus.toUpperCase()] || T.accentCyan;
  return `<span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}55;border-radius:10px;padding:2px 9px;font-size:10px;font-weight:700;letter-spacing:0.3px;">${vhcStatus}</span>`;
}

// ── Efficiency progress bar ──────────────────────────────────────────────────
function generateEfficiencyBar(soldHours: number, availableHours: number, label: string): string {
  const efficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const barColor = efficiency >= 90 ? T.barGreen : efficiency >= 75 ? T.barAmber : T.barRed;
  const barWidth = Math.min(efficiency, 100);
  const efficiencyDisplay = efficiency.toFixed(1);
  const soldDisplay = soldHours.toFixed(2);
  const availableDisplay = availableHours.toFixed(2);
  return `
    <div style="margin:10px 0;padding:14px 16px;background:#0D1F3C;border-radius:6px;border:1px solid ${T.colBorder};">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:center;">
        <span style="font-weight:700;font-size:11px;color:${T.subtitleText};letter-spacing:1px;text-transform:uppercase;">${label}</span>
        <span style="font-weight:800;color:${barColor};font-size:13px;font-family:monospace;">${efficiencyDisplay}%</span>
      </div>
      <div style="width:100%;height:6px;background:#1A3A5C;border-radius:3px;overflow:hidden;">
        <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:3px;box-shadow:0 0 6px ${barColor}88;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:${T.subtitleText};font-family:monospace;">
        <span>SOLD ${soldDisplay}h</span>
        <span>AVAILABLE ${availableDisplay}h</span>
      </div>
    </div>
  `;
}

// ── Shared th style ──────────────────────────────────────────────────────────
const TH = `background:${T.headerBg};color:${T.headerText};padding:9px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-right:1px solid ${T.colBorder};`;

// ── Table column headers (7 cols, Notes last) ────────────────────────────────
function jobTableColHeaders(): string {
  return `
    <thead>
      <tr>
        <th style="${TH}width:8%;">DATE</th>
        <th style="${TH}width:10%;">WIP #</th>
        <th style="${TH}width:10%;">VEHICLE REG</th>
        <th style="${TH}width:9%;">VHC STATUS</th>
        <th style="${TH}width:22%;">DESCRIPTION</th>
        <th style="${TH}width:6%;text-align:right;">AWS</th>
        <th style="${TH}width:35%;border-right:none;">NOTES</th>
      </tr>
    </thead>
  `;
}

// ── Single job row ───────────────────────────────────────────────────────────
function jobTableRow(job: Job, isEven: boolean): string {
  const rowBg = isEven ? T.rowEven : T.rowOdd;
  const dateStr = new Date(job.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const description = job.notes ? job.notes.trim() : '';
  const notesText = job.notes ? job.notes.trim() : '';
  const TD = `padding:9px 10px;font-size:12px;color:${T.rowText};vertical-align:top;border-right:1px solid ${T.colBorder};`;
  return `
    <tr style="background:${rowBg};border-bottom:1px solid ${T.colBorder};">
      <td style="${TD}">${dateStr}</td>
      <td style="${TD}font-weight:600;">${job.wipNumber}</td>
      <td style="${TD}font-weight:600;">${job.vehicleReg}</td>
      <td style="${TD}">${getVhcDisplayHtml(job.vhcStatus)}</td>
      <td style="${TD}line-height:1.5;">${description}</td>
      <td style="${TD}font-size:13px;font-weight:700;color:${T.awsColor};text-align:right;">${job.aw}</td>
      <td style="${TD}color:${T.notesText};line-height:1.5;border-right:none;">${notesText}</td>
    </tr>
  `;
}

// ── Section group header row (spans 7 cols) ──────────────────────────────────
function monthGroupHeaderRow(monthName: string): string {
  return `
    <tr>
      <td colspan="7" style="background:${T.sectionBg};color:${T.headerText};font-weight:700;font-size:12px;padding:9px 14px;letter-spacing:0.5px;">
        ${monthName}
      </td>
    </tr>
  `;
}

// ── Total summary row ────────────────────────────────────────────────────────
function totalRow(label: string, jobCount: number, totalAw: number, totalHours: string): string {
  return `
    <div style="background:${T.statsBg};padding:11px 18px;margin:10px 0 18px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid ${T.accentCyan};border:1px solid ${T.colBorder};border-left:3px solid ${T.accentCyan};">
      <span style="color:${T.subtitleText};font-size:11px;font-weight:600;letter-spacing:0.5px;">${label}</span>
      <span style="color:${T.accentGlow};font-size:12px;font-weight:800;font-family:monospace;letter-spacing:0.5px;">${jobCount} JOBS &nbsp;·&nbsp; ${totalAw} AWS &nbsp;·&nbsp; ${totalHours}h</span>
    </div>
  `;
}

// ── Main PDF HTML generator ──────────────────────────────────────────────────
function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): string {
  console.log('ExportUtils: Generating PDF HTML for', options.type, 'export with', jobs.length, 'jobs');

  const groupedByDay = groupJobsByDay(jobs);
  const sortedDays = Array.from(groupedByDay.keys()).sort().reverse();
  const overallTotals = calculateTotals(jobs);
  const availableHours = options.availableHours || 0;

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Period label for header
  let periodLabel = '';
  if (options.type === 'daily' && options.day) {
    periodLabel = new Date(options.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } else if (options.type === 'weekly') {
    periodLabel = 'Weekly Report';
  } else if (options.type === 'monthly') {
    periodLabel = 'Monthly Report';
  } else {
    periodLabel = 'All-Time Report';
  }

  // Report type badge label
  const reportTypeBadge = options.type === 'daily' ? 'DAILY REPORT'
    : options.type === 'weekly' ? 'WEEKLY REPORT'
    : options.type === 'monthly' ? 'MONTHLY REPORT'
    : 'ALL-TIME REPORT';

  // Stats bar values
  const avgAwPerJob = overallTotals.jobCount > 0
    ? (overallTotals.totalAw / overallTotals.jobCount).toFixed(1)
    : '0.0';

  // Date range for stats bar
  const allDates = sortedDays;
  const dateRangeLabel = allDates.length > 0
    ? (allDates[allDates.length - 1] === allDates[0]
        ? new Date(allDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : `${new Date(allDates[allDates.length - 1]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(allDates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    : '—';

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: ${T.pageBg};
      color: ${T.rowText};
      font-size: 13px;
      line-height: 1.5;
    }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div style="
    background: ${T.pageBg};
    background-image: repeating-linear-gradient(45deg, rgba(0,180,216,0.04) 0px, rgba(0,180,216,0.04) 1px, transparent 1px, transparent 12px);
    color: ${T.headerText};
    padding: 28px 32px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid ${T.accentCyan};
  ">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${T.accentCyan};margin-bottom:8px;">TECH TIMES</div>
      <div style="font-size:26px;font-weight:800;color:${T.headerText};letter-spacing:-0.5px;line-height:1.1;margin-bottom:6px;text-shadow:0 0 18px ${T.accentGlow}44;">${technicianName}</div>
      <div style="font-size:13px;color:${T.subtitleText};font-weight:600;letter-spacing:0.5px;">${periodLabel}</div>
    </div>
    <div style="border:1px solid ${T.accentCyan};padding:10px 20px;text-align:center;background:${T.accentCyan}18;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.accentGlow};">${reportTypeBadge}</div>
    </div>
  </div>

  <!-- STATS BAR -->
  <div style="background:${T.statsBg};display:flex;border-bottom:2px solid ${T.accentCyan};">
    <div style="flex:1;padding:12px 16px;border-left:3px solid ${T.accentCyan};border-right:1px solid ${T.colBorder};">
      <div style="font-size:22px;font-weight:800;color:${T.accentGlow};font-family:monospace;line-height:1;margin-bottom:4px;">${overallTotals.jobCount}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.subtitleText};">TOTAL JOBS</div>
    </div>
    <div style="flex:1;padding:12px 16px;border-left:1px solid ${T.colBorder};border-right:1px solid ${T.colBorder};">
      <div style="font-size:22px;font-weight:800;color:${T.accentGlow};font-family:monospace;line-height:1;margin-bottom:4px;">${overallTotals.totalAw}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.subtitleText};">TOTAL AWS</div>
    </div>
    <div style="flex:1;padding:12px 16px;border-left:1px solid ${T.colBorder};border-right:1px solid ${T.colBorder};">
      <div style="font-size:22px;font-weight:800;color:${T.accentGlow};font-family:monospace;line-height:1;margin-bottom:4px;">${avgAwPerJob}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.subtitleText};">AVG AWS/JOB</div>
    </div>
    <div style="flex:1;padding:12px 16px;border-left:1px solid ${T.colBorder};">
      <div style="font-size:14px;font-weight:800;color:${T.accentGlow};font-family:monospace;line-height:1;margin-bottom:4px;">${dateRangeLabel}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.subtitleText};">DATE RANGE</div>
    </div>
  </div>

  <!-- TABLE SECTION -->
  <div style="padding:20px 28px;background:${T.pageBg};">
`;

  // ── DAILY ──────────────────────────────────────────────────────────────────
  if (options.type === 'daily') {
    const dayJobs = (groupedByDay.get(options.day!) || []).slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const dayTotals = calculateTotals(dayJobs);
    const dayName = new Date(options.day!).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const dayTotalHours = dayTotals.totalHours.toFixed(2);

    html += `<table style="width:100%;border-collapse:collapse;background:${T.rowOdd};margin-bottom:16px;border:1px solid ${T.colBorder};">`;
    html += jobTableColHeaders();
    html += `<tbody>`;
    html += `<tr><td colspan="7" style="background:${T.sectionBg};color:${T.headerText};font-weight:700;font-size:12px;padding:9px 14px;letter-spacing:0.5px;">${dayName}</td></tr>`;
    dayJobs.forEach((job, i) => { html += jobTableRow(job, i % 2 === 0); });
    html += `</tbody></table>`;
    html += totalRow(`DAY TOTAL — ${dayName}`, dayTotals.jobCount, dayTotals.totalAw, dayTotalHours);
    if (availableHours > 0) {
      console.log('ExportUtils: Daily efficiency - soldHours:', dayTotals.totalHours, 'availableHours:', availableHours);
      html += `<div style="background:${T.statsBg};border:1px solid ${T.colBorder};border-left:3px solid ${T.accentCyan};padding:14px 18px;margin-bottom:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.subtitleText};margin-bottom:8px;">Daily Efficiency</div>${generateEfficiencyBar(dayTotals.totalHours, availableHours, 'Day Performance')}</div>`;
    }

  // ── WEEKLY ─────────────────────────────────────────────────────────────────
  } else if (options.type === 'weekly') {
    const weekGroups = groupDaysByWeek(sortedDays);
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const weekJobs = weekDays.sort().reverse().flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      const weekTotalHours = weekTotals.totalHours.toFixed(2);

      html += `<table style="width:100%;border-collapse:collapse;background:${T.rowOdd};margin-bottom:16px;border:1px solid ${T.colBorder};">`;
      html += jobTableColHeaders();
      html += `<tbody>`;
      html += `<tr><td colspan="7" style="background:${T.sectionBg};color:${T.headerText};font-weight:700;font-size:12px;padding:9px 14px;letter-spacing:0.5px;">Week: ${startDate} – ${endDate}</td></tr>`;
      weekJobs.forEach((job, i) => { html += jobTableRow(job, i % 2 === 0); });
      html += `</tbody></table>`;
      html += totalRow(`WEEK TOTAL (${startDate} – ${endDate})`, weekTotals.jobCount, weekTotals.totalAw, weekTotalHours);
      if (availableHours > 0) {
        console.log('ExportUtils: Weekly efficiency - soldHours:', weekTotals.totalHours, 'availableHours:', availableHours);
        html += `<div style="background:${T.statsBg};border:1px solid ${T.colBorder};border-left:3px solid ${T.accentCyan};padding:14px 18px;margin-bottom:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.subtitleText};margin-bottom:8px;">Weekly Efficiency</div>${generateEfficiencyBar(weekTotals.totalHours, availableHours, 'Week Performance')}</div>`;
      }
    });

  // ── MONTHLY ────────────────────────────────────────────────────────────────
  } else if (options.type === 'monthly') {
    const monthGroups = groupDaysByMonth(sortedDays);
    Array.from(monthGroups.entries()).sort().reverse().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const monthJobs = monthDays.sort().reverse().flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      const monthTotalHours = monthTotals.totalHours.toFixed(2);

      html += `<table style="width:100%;border-collapse:collapse;background:${T.rowOdd};margin-bottom:16px;border:1px solid ${T.colBorder};">`;
      html += jobTableColHeaders();
      html += `<tbody>`;
      html += monthGroupHeaderRow(monthName);
      monthJobs.forEach((job, i) => { html += jobTableRow(job, i % 2 === 0); });
      html += `</tbody></table>`;
      html += totalRow(`MONTH TOTAL — ${monthName}`, monthTotals.jobCount, monthTotals.totalAw, monthTotalHours);
      if (availableHours > 0) {
        html += `<div style="background:${T.statsBg};border:1px solid ${T.colBorder};border-left:3px solid ${T.accentCyan};padding:14px 18px;margin-bottom:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.subtitleText};margin-bottom:8px;">Monthly Efficiency</div>${generateEfficiencyBar(monthTotals.totalHours, availableHours, 'Month Performance')}</div>`;
      }
    });

  // ── ALL-TIME ───────────────────────────────────────────────────────────────
  } else {
    const monthGroups = groupDaysByMonth(sortedDays);
    const weekGroups = groupDaysByWeek(sortedDays);

    html += `<table style="width:100%;border-collapse:collapse;background:${T.rowOdd};margin-bottom:16px;border:1px solid ${T.colBorder};">`;
    html += jobTableColHeaders();
    html += `<tbody>`;
    Array.from(monthGroups.entries()).sort().reverse().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const monthJobs = monthDays.sort().reverse().flatMap(day => groupedByDay.get(day)!);
      html += monthGroupHeaderRow(monthName);
      monthJobs.forEach((job, i) => { html += jobTableRow(job, i % 2 === 0); });
    });
    html += `</tbody></table>`;

    // Monthly totals
    Array.from(monthGroups.entries()).sort().reverse().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const monthJobs = monthDays.flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      const monthTotalHours = monthTotals.totalHours.toFixed(2);
      html += totalRow(`MONTH TOTAL — ${monthName}`, monthTotals.jobCount, monthTotals.totalAw, monthTotalHours);
    });

    // Weekly summary
    html += `<div style="height:1px;background:${T.colBorder};margin:20px 0;"></div>`;
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      const weekTotalHours = weekTotals.totalHours.toFixed(2);
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      html += totalRow(`WEEK (${startDate} – ${endDate})`, weekTotals.jobCount, weekTotals.totalAw, weekTotalHours);
    });

    if (availableHours > 0) {
      html += `<div style="height:1px;background:${T.colBorder};margin:20px 0;"></div><div style="background:${T.statsBg};border:1px solid ${T.colBorder};border-left:3px solid ${T.accentCyan};padding:14px 18px;margin-bottom:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.subtitleText};margin-bottom:8px;">Overall Efficiency Summary</div>${generateEfficiencyBar(overallTotals.totalHours, availableHours, 'Entire Period')}</div>`;
    }
  }

  html += `
  </div><!-- /table section -->

  <!-- FOOTER -->
  <div style="background:${T.footerBg};border-top:2px solid ${T.accentCyan};text-align:center;padding:14px 32px;">
    <span style="font-size:11px;color:${T.footerText};letter-spacing:0.5px;">TECH TIMES &nbsp;•&nbsp; Generated on ${generatedDate} &nbsp;•&nbsp; Confidential</span>
  </div>

</body>
</html>`;

  return html;
}

// Export to PDF
export async function exportToPdf(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): Promise<void> {
  console.log('ExportUtils: Generating PDF with', jobs.length, 'jobs for', options.type, 'export');
  
  const html = generatePdfHtml(jobs, technicianName, options);
  
  const { uri } = await Print.printToFileAsync({ html });
  console.log('ExportUtils: PDF generated at', uri);
  
  // Move to a permanent location
  const fileName = `techtimes_${options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
  const newUri = FileSystem.documentDirectory + fileName;
  await FileSystem.moveAsync({ from: uri, to: newUri });
  
  console.log('ExportUtils: PDF moved to', newUri);
  
  // Share the PDF
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share TechTimes Report',
    });
    console.log('ExportUtils: PDF shared successfully');
  }
}

// Export to JSON - Format matching the exact format (PRIORITY)
export async function exportToJson(jobs: Job[]): Promise<string> {
  console.log('ExportUtils: Exporting', jobs.length, 'jobs to JSON (PRIORITY FORMAT)');
  
  // Format exactly as the user's JSON format
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
  const fileUri = FileSystem.documentDirectory + fileName;
  
  await FileSystem.writeAsStringAsync(fileUri, jsonString);
  console.log('ExportUtils: JSON exported to', fileUri);
  
  // Share the JSON
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export TechTimes Backup',
    });
    console.log('ExportUtils: JSON shared successfully');
  }
  
  return fileUri;
}

// Import from JSON - Parse the exact format from the user (PRIORITY)
export async function importFromJson(
  fileUri: string,
  onProgress: (current: number, total: number, job: any) => void
): Promise<{ imported: number; skipped: number; errors: string[]; jobs: any[] }> {
  console.log('ExportUtils: Starting import from JSON (PRIORITY FORMAT):', fileUri);
  
  try {
    // Read the file content
    const jsonString = await FileSystem.readAsStringAsync(fileUri);
    console.log('ExportUtils: Read JSON file, length:', jsonString.length);
    
    // Parse the JSON
    let importData;
    try {
      importData = JSON.parse(jsonString);
      console.log('ExportUtils: Successfully parsed JSON');
    } catch (parseError) {
      console.error('ExportUtils: JSON parse error:', parseError);
      throw new Error('Invalid JSON file format. Please ensure the file is a valid TechTimes backup.');
    }
    
    // Validate the JSON structure
    if (!importData) {
      throw new Error('Empty JSON file');
    }
    
    if (!importData.jobs) {
      throw new Error('Invalid JSON format: missing "jobs" array');
    }
    
    if (!Array.isArray(importData.jobs)) {
      throw new Error('Invalid JSON format: "jobs" must be an array');
    }
    
    console.log('ExportUtils: Found', importData.jobs.length, 'jobs in import file');
    console.log('ExportUtils: Export date:', importData.exportDate);
    console.log('ExportUtils: Version:', importData.version);
    
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
    
    // Process each job
    for (let i = 0; i < importData.jobs.length; i++) {
      const job = importData.jobs[i];
      
      try {
        // Report progress
        onProgress(i + 1, total, job);
        
        // Map the JSON format to our internal format
        // JSON format: wipNumber, vehicleReg, vhcStatus, description, aws, jobDateTime
        // Internal format: wipNumber, vehicleReg, vhcStatus, notes, aw, createdAt
        
        const wipNumber = job.wipNumber;
        const vehicleReg = job.vehicleReg;
        const awValue = job.aws !== undefined ? job.aws : job.aw;
        const notes = job.description !== undefined ? job.description : (job.notes || '');
        const createdAt = job.jobDateTime !== undefined ? job.jobDateTime : job.createdAt;
        const vhcStatus = job.vhcStatus || 'NONE';
        
        // Validate required fields
        if (!wipNumber) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing wipNumber`);
          console.warn('ExportUtils: Skipping job', i + 1, '- missing wipNumber');
          continue;
        }
        
        if (!vehicleReg) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing vehicleReg`);
          console.warn('ExportUtils: Skipping job', i + 1, '- missing vehicleReg');
          continue;
        }
        
        if (awValue === undefined || awValue === null) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing aws/aw value`);
          console.warn('ExportUtils: Skipping job', i + 1, '- missing aws/aw value');
          continue;
        }
        
        if (!createdAt) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Missing jobDateTime/createdAt`);
          console.warn('ExportUtils: Skipping job', i + 1, '- missing jobDateTime/createdAt');
          continue;
        }
        
        // Validate vhcStatus
        const validVhcStatuses = ['NONE', 'GREEN', 'ORANGE', 'RED', 'AMBER'];
        let normalizedVhcStatus = vhcStatus.toUpperCase();
        
        // Handle AMBER -> ORANGE conversion
        if (normalizedVhcStatus === 'AMBER') {
          normalizedVhcStatus = 'ORANGE';
        }
        
        if (!validVhcStatuses.includes(normalizedVhcStatus)) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Invalid vhcStatus "${vhcStatus}". Must be one of: NONE, GREEN, ORANGE/AMBER, RED`);
          console.warn('ExportUtils: Skipping job', i + 1, '- invalid vhcStatus:', vhcStatus);
          continue;
        }
        
        // Validate AW value
        const awNumber = Number(awValue);
        if (isNaN(awNumber) || awNumber < 0) {
          results.skipped++;
          results.errors.push(`Job ${i + 1}: Invalid aws value "${awValue}". Must be a positive number`);
          console.warn('ExportUtils: Skipping job', i + 1, '- invalid aws value:', awValue);
          continue;
        }
        
        // Create the job object in the format expected by the API
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
        
        console.log('ExportUtils: Prepared job', i + 1, '/', total, ':', {
          wipNumber: jobToImport.wipNumber,
          vehicleReg: jobToImport.vehicleReg,
          aw: jobToImport.aw,
          vhcStatus: jobToImport.vhcStatus,
        });
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        results.skipped++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Job ${i + 1}: ${errorMessage}`);
        console.error('ExportUtils: Error processing job', i + 1, ':', error);
      }
    }
    
    console.log('ExportUtils: Import parsing complete -', results.imported, 'prepared,', results.skipped, 'skipped');
    
    if (results.errors.length > 0) {
      console.log('ExportUtils: Import errors:', results.errors);
    }
    
    return results;
  } catch (error) {
    console.error('ExportUtils: Fatal import error:', error);
    throw error;
  }
}
