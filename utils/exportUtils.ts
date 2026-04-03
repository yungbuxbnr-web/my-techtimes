
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Job } from './api';
import { awToMinutes, formatTime } from './jobCalculations';

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
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { start: sunday, end: saturday };
}



// ── Stats calculation (uses same logic as jobCalculations.ts) ─────────────────

interface PeriodStats {
  jobCount: number;
  totalAw: number;
  totalMinutes: number;
  soldHours: number;
  availableHours: number;
  efficiency: number;
  awPerHour: number;
}

function calcPeriodStats(jobs: Job[], availableHours: number): PeriodStats {
  const jobCount = jobs.length;
  const totalAw = jobs.reduce((sum, j) => sum + j.aw, 0);
  const totalMinutes = jobs.reduce((sum, j) => sum + awToMinutes(j.aw), 0);
  const soldHours = totalMinutes / 60;
  const efficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const awPerHour = soldHours > 0 ? totalAw / soldHours : 0;
  return { jobCount, totalAw, totalMinutes, soldHours, availableHours, efficiency, awPerHour };
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  pageBg:      '#0A1628',
  cardBg:      '#0D1F3C',
  tableHeader: '#2563EB',
  rowEven:     '#0D1F3C',
  rowOdd:      '#0A1628',
  rowText:     '#E0F4FF',
  border:      '#1A3A5C',
  cyan:        '#00E5FF',
  cyanMid:     '#00B4D8',
  white:       '#FFFFFF',
  wipColor:    '#00B4D8',
  awsColor:    '#00B4D8',
  footerText:  '#7EC8E3',
  vhcRed:      '#EF4444',
  vhcOrange:   '#F97316',
  vhcGreen:    '#22C55E',
  vhcGrey:     '#6B7280',
};

// ── VHC dot + label ───────────────────────────────────────────────────────────

function vhcCell(status?: string): string {
  const s = (status || 'NONE').toUpperCase();
  let dotColor = C.vhcGrey;
  let label = 'N/A';
  if (s === 'RED')    { dotColor = C.vhcRed;    label = 'Red'; }
  if (s === 'ORANGE' || s === 'AMBER') { dotColor = C.vhcOrange; label = 'Orange'; }
  if (s === 'GREEN')  { dotColor = C.vhcGreen;  label = 'Green'; }
  return `<span style="display:inline-flex;align-items:center;gap:5px;">
    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
    <span style="color:${C.rowText};font-size:11px;">${label}</span>
  </span>`;
}

// ── Format job date/time for the DATE & TIME column ───────────────────────────

function formatJobDateTime(createdAt: string): string {
  const d = new Date(createdAt);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `<div style="font-size:11px;color:${C.rowText};line-height:1.6;">${date}<br/><span style="color:${C.footerText};">${time}</span></div>`;
}

// ── Stats cards section ───────────────────────────────────────────────────────

function statsCardsHtml(stats: PeriodStats): string {
  const soldHoursDisplay = stats.soldHours.toFixed(2) + 'h';
  const availHoursDisplay = stats.availableHours > 0 ? stats.availableHours.toFixed(1) + 'h' : '—';
  const efficiencyDisplay = stats.availableHours > 0 ? stats.efficiency.toFixed(1) + '%' : '—';
  const awPerHourDisplay = stats.soldHours > 0 ? stats.awPerHour.toFixed(1) : '—';

  const totalMinutesFormatted = formatTime(stats.totalMinutes);

  const cards = [
    { value: String(stats.jobCount),      label: 'Total Jobs Done' },
    { value: String(stats.totalAw),        label: 'Total AWS' },
    { value: totalMinutesFormatted,        label: 'Time Logged' },
    { value: efficiencyDisplay,            label: 'Efficiency %' },
    { value: availHoursDisplay,            label: 'Available Hours' },
    { value: awPerHourDisplay,             label: 'AWS per Hour' },
  ];

  const cardHtml = cards.map(card => `
    <div style="
      flex:1;
      background:${C.cardBg};
      border:1px solid ${C.cyanMid};
      border-radius:6px;
      padding:14px 10px;
      text-align:center;
      margin:0 4px;
    ">
      <div style="font-size:20px;font-weight:800;color:${C.cyanMid};font-family:monospace;line-height:1.1;margin-bottom:5px;">${card.value}</div>
      <div style="font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${C.white};opacity:0.85;">${card.label}</div>
    </div>
  `).join('');

  return `
    <div style="padding:18px 28px 10px;background:${C.pageBg};">
      <div style="display:flex;gap:0;">${cardHtml}</div>
    </div>
  `;
}

// ── Table header row (repeatable) ─────────────────────────────────────────────

const TH_STYLE = `background:${C.tableHeader};color:${C.white};padding:10px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid ${C.border};`;

function tableHeaderRow(): string {
  return `
    <thead>
      <tr>
        <th style="${TH_STYLE}width:9%;">WIP<br/>NUMBER</th>
        <th style="${TH_STYLE}width:11%;">VEHICLE REG</th>
        <th style="${TH_STYLE}width:10%;">VHC</th>
        <th style="${TH_STYLE}width:34%;">JOB DESCRIPTION</th>
        <th style="${TH_STYLE}width:7%;text-align:center;">AWS</th>
        <th style="${TH_STYLE}width:9%;text-align:center;">TIME</th>
        <th style="${TH_STYLE}width:14%;border-right:none;text-align:center;">DATE &amp;<br/>TIME</th>
      </tr>
    </thead>`;
}

// ── Single job row ────────────────────────────────────────────────────────────

function jobRow(job: Job, isEven: boolean): string {
  const rowBg = isEven ? C.rowEven : C.rowOdd;
  const TD = `padding:9px 10px;font-size:11px;color:${C.rowText};vertical-align:middle;border-right:1px solid ${C.border};border-bottom:1px solid ${C.border};`;
  const jobMinutes = awToMinutes(job.aw);
  const timeFormatted = formatTime(jobMinutes);
  const notes = job.notes ? job.notes.trim() : '';
  return `
    <tr style="background:${rowBg};">
      <td style="${TD}font-weight:700;color:${C.wipColor};">${job.wipNumber}</td>
      <td style="${TD}font-weight:600;">${job.vehicleReg}</td>
      <td style="${TD}">${vhcCell(job.vhcStatus)}</td>
      <td style="${TD}line-height:1.5;">${notes}</td>
      <td style="${TD}font-weight:800;color:${C.awsColor};text-align:center;font-size:13px;">${job.aw}</td>
      <td style="${TD}text-align:center;">${timeFormatted}</td>
      <td style="${TD}border-right:none;text-align:center;">${formatJobDateTime(job.createdAt)}</td>
    </tr>
  `;
}

// ── Full PDF HTML ─────────────────────────────────────────────────────────────

function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): string {
  console.log('ExportUtils: Generating PDF HTML for', options.type, 'export with', jobs.length, 'jobs');

  const availableHours = options.availableHours ?? 0;
  const stats = calcPeriodStats(jobs, availableHours);

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

  // Build job rows with repeated header every ~20 rows
  const ROWS_PER_PAGE = 20;
  let jobRowsHtml = '';
  sortedJobs.forEach((job, i) => {
    if (i > 0 && i % ROWS_PER_PAGE === 0) {
      // Close current tbody/table and open a new one with repeated header
      jobRowsHtml += `
        </tbody></table>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${C.border};margin-top:0;page-break-before:always;">
        ${tableHeaderRow()}
        <tbody>
      `;
    }
    jobRowsHtml += jobRow(job, i % 2 === 0);
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: ${C.pageBg};
      color: ${C.rowText};
      font-size: 12px;
      line-height: 1.5;
    }
    table { border-collapse: collapse; width: 100%; }
    @media print {
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- ═══ HEADER ═══ -->
  <div style="
    background:${C.pageBg};
    padding:28px 32px 20px;
    text-align:center;
    border-bottom:2px solid ${C.cyanMid};
  ">
    <div style="font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${C.cyanMid};margin-bottom:10px;">TECH TIMES</div>
    <div style="font-size:28px;font-weight:800;color:${C.cyan};letter-spacing:-0.5px;line-height:1.1;margin-bottom:8px;text-shadow:0 0 20px ${C.cyan}55;">${reportType}</div>
    <div style="font-size:13px;color:${C.footerText};font-weight:500;letter-spacing:0.5px;">${technicianName} &nbsp;·&nbsp; ${periodLabel}</div>
  </div>

  <!-- ═══ STATS CARDS ═══ -->
  ${statsCardsHtml(stats)}

  <!-- ═══ SECTION TITLE ═══ -->
  <div style="padding:16px 28px 10px;background:${C.pageBg};">
    <div style="font-size:16px;font-weight:700;color:${C.cyan};letter-spacing:0.3px;">🔧 Detailed Job Records</div>
  </div>

  <!-- ═══ JOB TABLE ═══ -->
  <div style="padding:0 28px 28px;background:${C.pageBg};">
    <table style="width:100%;border-collapse:collapse;border:1px solid ${C.border};">
      ${tableHeaderRow()}
      <tbody>
        ${jobRowsHtml}
      </tbody>
    </table>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div style="
    background:${C.cardBg};
    border-top:2px solid ${C.cyanMid};
    text-align:center;
    padding:12px 32px;
  ">
    <span style="font-size:10px;color:${C.footerText};letter-spacing:0.5px;">
      TECH TIMES &nbsp;•&nbsp; Generated on ${generatedDate} &nbsp;•&nbsp; Page <span class="pageNumber"></span>
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
  const html = generatePdfHtml(safeJobs, technicianName, options);

  console.log('ExportUtils: Calling printToFileAsync...');
  const printResult = await Print.printToFileAsync({ html });
  const sourceUri = printResult.uri;
  console.log('ExportUtils: PDF generated at', sourceUri);

  // Copy to a named file in the cache directory (works cross-platform on Android).
  // We use copyAsync instead of moveAsync because moveAsync can fail on Android
  // when the source and destination are on different storage partitions.
  const fileName = `techtimes_${options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
  const cacheDir = FileSystem.cacheDirectory ?? '';
  const destUri = cacheDir + fileName;

  // Only copy if the destination differs from the source (printToFileAsync may
  // already place the file in cacheDirectory with a random name).
  if (sourceUri !== destUri) {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    console.log('ExportUtils: PDF copied to', destUri);
    // Clean up the original temp file
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
