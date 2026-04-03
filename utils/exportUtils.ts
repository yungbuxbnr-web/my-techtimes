
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

function calculateTotals(jobs: Job[]) {
  const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
  const totalHours = (totalAw * 5) / 60;
  return { totalAw, totalHours, jobCount: jobs.length };
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { start: sunday, end: saturday };
}

function groupDaysByWeek(days: string[]): Map<string, string[]> {
  const weekGroups = new Map<string, string[]>();
  days.forEach(day => {
    const weekRange = getWeekRange(new Date(day));
    const weekKey = `${weekRange.start.toISOString().split('T')[0]}_${weekRange.end.toISOString().split('T')[0]}`;
    if (!weekGroups.has(weekKey)) weekGroups.set(weekKey, []);
    weekGroups.get(weekKey)!.push(day);
  });
  return weekGroups;
}

function groupDaysByMonth(days: string[]): Map<string, string[]> {
  const monthGroups = new Map<string, string[]>();
  days.forEach(day => {
    const month = day.substring(0, 7);
    if (!monthGroups.has(month)) monthGroups.set(month, []);
    monthGroups.get(month)!.push(day);
  });
  return monthGroups;
}

// ── HTML building blocks ──────────────────────────────────────────────────────

function vhcBadge(vhcStatus?: string): string {
  const val = vhcStatus && vhcStatus !== 'NONE' ? vhcStatus : null;
  if (val) {
    return `<span style="display:inline-block;background:#0e6ba8;color:#ffffff;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;letter-spacing:0.3px;">${val}</span>`;
  }
  return `<span style="display:inline-block;background:#e2e8f0;color:#94a3b8;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:600;">N/A</span>`;
}

function tableColHeaders(): string {
  const th = (label: string, width: string, align: string) =>
    `<th style="width:${width};background:#1a3a5c;color:#ffffff;padding:11px 12px;text-align:${align};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${label}</th>`;
  return `
    <thead>
      <tr>
        ${th('DATE', '9%', 'center')}
        ${th('WIP #', '10%', 'center')}
        ${th('VEHICLE REG', '10%', 'center')}
        ${th('VHC STATUS', '9%', 'center')}
        ${th('NOTES / WORK DONE', '54%', 'left')}
        ${th('AWS', '8%', 'right')}
      </tr>
    </thead>`;
}

function jobRow(job: Job, isEven: boolean): string {
  const rowBg = isEven ? '#ffffff' : '#f0f7ff';
  const dateStr = new Date(job.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const notes = job.notes && job.notes.trim() ? job.notes.trim() : '—';
  const notesStyle = job.notes && job.notes.trim()
    ? 'color:#334155;font-style:normal;'
    : 'color:#94a3b8;font-style:italic;';
  return `
    <tr style="background:${rowBg};border-bottom:1px solid #cce4f7;">
      <td style="padding:10px 12px;font-size:12px;color:#475569;vertical-align:top;text-align:center;">${dateStr}</td>
      <td style="padding:10px 12px;font-size:13px;color:#0e6ba8;vertical-align:top;text-align:center;font-weight:700;">${job.wipNumber}</td>
      <td style="padding:10px 12px;font-size:13px;color:#0f172a;vertical-align:top;text-align:center;font-weight:600;">${job.vehicleReg}</td>
      <td style="padding:10px 12px;font-size:13px;vertical-align:top;text-align:center;">${vhcBadge(job.vhcStatus)}</td>
      <td style="padding:10px 12px;font-size:12px;${notesStyle}vertical-align:top;text-align:left;line-height:1.6;">${notes}</td>
      <td style="padding:10px 12px;font-size:14px;color:#0f172a;vertical-align:top;text-align:right;font-weight:700;">${job.aw}</td>
    </tr>`;
}

function monthGroupRow(label: string): string {
  return `
    <tr>
      <td colspan="6" style="background:#dbeafe;color:#1a3a5c;font-weight:700;font-size:13px;padding:10px 16px;border-left:4px solid #0e6ba8;">
        &#128197; ${label}
      </td>
    </tr>`;
}

function summaryRow(label: string, jobCount: number, totalAw: number, totalHours: string): string {
  return `
    <div style="background:#1a3a5c;padding:12px 20px;margin:10px 0 18px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid #00b4d8;">
      <span style="color:#94c8e8;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${label}</span>
      <span style="color:#00d4ff;font-size:12px;font-weight:800;font-family:monospace;letter-spacing:0.5px;">${jobCount} JOBS &nbsp;·&nbsp; ${totalAw} AWS &nbsp;·&nbsp; ${totalHours}h</span>
    </div>`;
}

function statCard(value: string, label: string, isLast: boolean): string {
  const divider = isLast ? '' : `border-right:1px solid rgba(255,255,255,0.15);`;
  return `
    <div style="flex:1;padding:16px 24px;${divider}">
      <div style="font-size:24px;font-weight:700;color:#00d4ff;font-family:monospace;line-height:1;margin-bottom:5px;">${value}</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94c8e8;">${label}</div>
    </div>`;
}

// ── Main PDF HTML generator ───────────────────────────────────────────────────

function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): string {
  console.log('ExportUtils: Generating PDF HTML for', options.type, 'export with', jobs.length, 'jobs');

  const groupedByDay = groupJobsByDay(jobs);
  const sortedDays = Array.from(groupedByDay.keys()).sort().reverse();
  const overallTotals = calculateTotals(jobs);

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  let periodLabel = '';
  if (options.type === 'daily' && options.day) {
    periodLabel = new Date(options.day).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } else if (options.type === 'weekly') {
    periodLabel = 'Weekly Report';
  } else if (options.type === 'monthly') {
    periodLabel = 'Monthly Report';
  } else {
    periodLabel = 'All-Time Report';
  }

  const reportTypeBadge =
    options.type === 'daily' ? 'DAILY REPORT'
    : options.type === 'weekly' ? 'WEEKLY REPORT'
    : options.type === 'monthly' ? 'MONTHLY REPORT'
    : 'ALL-TIME REPORT';

  const avgAwPerJob = overallTotals.jobCount > 0
    ? (overallTotals.totalAw / overallTotals.jobCount).toFixed(1)
    : '0.0';

  const dateRangeLabel = sortedDays.length > 0
    ? (sortedDays[sortedDays.length - 1] === sortedDays[0]
        ? new Date(sortedDays[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : `${new Date(sortedDays[sortedDays.length - 1]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(sortedDays[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    : '—';

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #f0f6ff;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.5;
    }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div style="
    background: linear-gradient(135deg, #1a3a5c 0%, #0e6ba8 50%, #00b4d8 100%);
    background-image:
      repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px),
      linear-gradient(135deg, #1a3a5c 0%, #0e6ba8 50%, #00b4d8 100%);
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  ">
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#00d4ff;margin-bottom:10px;">TECH TIMES</div>
      <div style="font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;margin-bottom:8px;">${technicianName}</div>
      <div style="font-size:14px;color:#94c8e8;font-weight:500;">${reportTypeBadge} &nbsp;·&nbsp; ${periodLabel}</div>
    </div>
  </div>
  <div style="height:3px;background:#00d4ff;"></div>

  <!-- STATS BAR -->
  <div style="background:#1a3a5c;display:flex;">
    ${statCard(String(overallTotals.jobCount), 'TOTAL JOBS', false)}
    ${statCard(String(overallTotals.totalAw), 'TOTAL AWS', false)}
    ${statCard(avgAwPerJob, 'AVG AWS / JOB', false)}
    ${statCard(dateRangeLabel, 'PERIOD', true)}
  </div>

  <!-- TABLE SECTION -->
  <div style="padding:24px 32px;background:#f0f6ff;">
`;

  // ── DAILY ──────────────────────────────────────────────────────────────────
  if (options.type === 'daily') {
    const dayJobs = (groupedByDay.get(options.day!) || []).slice().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const dayTotals = calculateTotals(dayJobs);
    const dayName = new Date(options.day!).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const dayTotalHours = dayTotals.totalHours.toFixed(2);

    html += `<table style="width:100%;border-collapse:collapse;background:#ffffff;margin-bottom:12px;">`;
    html += tableColHeaders();
    html += `<tbody>`;
    html += monthGroupRow(dayName);
    dayJobs.forEach((job, i) => { html += jobRow(job, i % 2 === 0); });
    html += `</tbody></table>`;
    html += summaryRow(`DAY TOTAL — ${dayName}`, dayTotals.jobCount, dayTotals.totalAw, dayTotalHours);

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

      html += `<table style="width:100%;border-collapse:collapse;background:#ffffff;margin-bottom:12px;">`;
      html += tableColHeaders();
      html += `<tbody>`;
      html += monthGroupRow(`Week: ${startDate} – ${endDate}`);
      weekJobs.forEach((job, i) => { html += jobRow(job, i % 2 === 0); });
      html += `</tbody></table>`;
      html += summaryRow(`WEEK TOTAL (${startDate} – ${endDate})`, weekTotals.jobCount, weekTotals.totalAw, weekTotalHours);
    });

  // ── MONTHLY ────────────────────────────────────────────────────────────────
  } else if (options.type === 'monthly') {
    const monthGroups = groupDaysByMonth(sortedDays);
    Array.from(monthGroups.entries()).sort().reverse().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
      const monthJobs = monthDays.sort().reverse().flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      const monthTotalHours = monthTotals.totalHours.toFixed(2);

      html += `<table style="width:100%;border-collapse:collapse;background:#ffffff;margin-bottom:12px;">`;
      html += tableColHeaders();
      html += `<tbody>`;
      html += monthGroupRow(monthName);
      monthJobs.forEach((job, i) => { html += jobRow(job, i % 2 === 0); });
      html += `</tbody></table>`;
      html += summaryRow(`MONTH TOTAL — ${monthName}`, monthTotals.jobCount, monthTotals.totalAw, monthTotalHours);
    });

  // ── ALL-TIME ───────────────────────────────────────────────────────────────
  } else {
    const monthGroups = groupDaysByMonth(sortedDays);
    const weekGroups = groupDaysByWeek(sortedDays);

    // One table per month
    Array.from(monthGroups.entries()).sort().reverse().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
      const monthJobs = monthDays.sort().reverse().flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      const monthTotalHours = monthTotals.totalHours.toFixed(2);

      html += `<table style="width:100%;border-collapse:collapse;background:#ffffff;margin-bottom:12px;">`;
      html += tableColHeaders();
      html += `<tbody>`;
      html += monthGroupRow(monthName);
      monthJobs.forEach((job, i) => { html += jobRow(job, i % 2 === 0); });
      html += `</tbody></table>`;
      html += summaryRow(`MONTH TOTAL — ${monthName}`, monthTotals.jobCount, monthTotals.totalAw, monthTotalHours);
    });

    // Weekly breakdown divider
    html += `<div style="height:1px;background:#cce4f7;margin:20px 0;"></div>`;
    html += `<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#0e6ba8;margin-bottom:10px;">WEEKLY BREAKDOWN</div>`;
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      const weekTotalHours = weekTotals.totalHours.toFixed(2);
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      html += summaryRow(`WEEK (${startDate} – ${endDate})`, weekTotals.jobCount, weekTotals.totalAw, weekTotalHours);
    });

    // Grand total
    html += `<div style="height:1px;background:#cce4f7;margin:20px 0;"></div>`;
    html += summaryRow('GRAND TOTAL — ALL TIME', overallTotals.jobCount, overallTotals.totalAw, overallTotals.totalHours.toFixed(2));
  }

  html += `
  </div><!-- /table section -->

  <!-- FOOTER -->
  <div style="background:#1a3a5c;border-top:3px solid #00d4ff;text-align:center;padding:14px 32px;">
    <span style="font-size:11px;color:#94c8e8;letter-spacing:1px;">TECH TIMES &nbsp;•&nbsp; Confidential Report &nbsp;•&nbsp; Generated ${generatedDate}</span>
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
  console.log('ExportUtils: exportToPdf called — type:', options.type, 'jobs:', jobs.length, 'technician:', technicianName);

  const html = generatePdfHtml(jobs, technicianName, options);

  const { uri } = await Print.printToFileAsync({ html });
  console.log('ExportUtils: PDF generated at', uri);

  const fileName = `techtimes_${options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
  const newUri = FileSystem.documentDirectory + fileName;
  await FileSystem.moveAsync({ from: uri, to: newUri });
  console.log('ExportUtils: PDF moved to', newUri);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share TechTimes Report',
    });
    console.log('ExportUtils: PDF shared successfully');
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
  const fileUri = FileSystem.documentDirectory + fileName;

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
    const jsonString = await FileSystem.readAsStringAsync(fileUri);
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

        await new Promise(resolve => setTimeout(resolve, 50));
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
