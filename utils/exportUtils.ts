
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

// Helper to get VHC display HTML
function getVhcDisplayHtml(vhcStatus?: string): string {
  if (!vhcStatus || vhcStatus === 'NONE') return '-';
  const vhcColor = vhcStatus === 'GREEN' ? '#4CAF50' : 
                  vhcStatus === 'ORANGE' ? '#FF9800' : 
                  vhcStatus === 'RED' ? '#f44336' : '#999';
  return `<span style="color: ${vhcColor}; font-weight: bold;">● ${vhcStatus}</span>`;
}

// Generate efficiency progress bar HTML
function generateEfficiencyBar(soldHours: number, availableHours: number, label: string): string {
  const efficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
  const efficiencyColor = efficiency >= 90 ? '#4CAF50' : efficiency >= 75 ? '#FF9800' : '#f44336';
  const barWidth = Math.min(efficiency, 100);
  
  return `
    <div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <span style="font-weight: bold; font-size: 12px;">${label}</span>
        <span style="font-weight: bold; color: ${efficiencyColor}; font-size: 12px;">${efficiency.toFixed(1)}%</span>
      </div>
      <div style="width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="width: ${barWidth}%; height: 100%; background: ${efficiencyColor}; transition: width 0.3s;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; color: #666;">
        <span>Sold: ${soldHours.toFixed(2)}h</span>
        <span>Available: ${availableHours.toFixed(2)}h</span>
      </div>
    </div>
  `;
}

// Generate PDF HTML with enhanced grouping and efficiency bars
function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): string {
  console.log('ExportUtils: Generating PDF HTML for', options.type, 'export');
  
  const groupedByDay = groupJobsByDay(jobs);
  const sortedDays = Array.from(groupedByDay.keys()).sort();
  const overallTotals = calculateTotals(jobs);
  
  // Calculate overall efficiency if available hours provided
  const targetHours = options.targetHours || 0;
  const availableHours = options.availableHours || 0;
  const generatedDate = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f0f2f5;
          color: #1a1a2e;
          font-size: 12px;
          line-height: 1.5;
        }
        /* ── HEADER ── */
        .header {
          background: linear-gradient(135deg, #1a237e 0%, #00695c 100%);
          color: #ffffff;
          padding: 32px 40px 24px;
          position: relative;
          overflow: hidden;
        }
        .header::after {
          content: '';
          position: absolute;
          right: -60px;
          top: -60px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
        }
        .header-brand {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          opacity: 0.75;
          margin-bottom: 6px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }
        .header .technician {
          font-size: 15px;
          opacity: 0.9;
          margin-bottom: 12px;
        }
        .header-meta {
          display: flex;
          gap: 24px;
          margin-top: 16px;
        }
        .header-badge {
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        /* ── ACCENT BAR ── */
        .accent-bar {
          height: 4px;
          background: linear-gradient(90deg, #00bcd4, #1a237e, #00695c, #ff6f00);
        }
        /* ── CONTENT WRAPPER ── */
        .content {
          padding: 28px 32px;
        }
        /* ── SUMMARY CARDS ── */
        .summary-grid {
          display: flex;
          gap: 16px;
          margin-bottom: 28px;
        }
        .summary-card {
          flex: 1;
          background: #ffffff;
          border-radius: 10px;
          padding: 16px 20px;
          border-left: 4px solid #1a237e;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }
        .summary-card.green  { border-left-color: #00695c; }
        .summary-card.amber  { border-left-color: #ff6f00; }
        .summary-card-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 6px;
        }
        .summary-card-value {
          font-size: 26px;
          font-weight: 800;
          color: #1a237e;
        }
        .summary-card.green  .summary-card-value { color: #00695c; }
        .summary-card.amber  .summary-card-value { color: #ff6f00; }
        /* ── SECTION HEADERS ── */
        .section-heading {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #1a237e;
          margin: 28px 0 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #e8eaf6;
        }
        /* ── EFFICIENCY BAR ── */
        .efficiency-section {
          background: #ffffff;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 20px;
          border-left: 4px solid #00695c;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }
        .efficiency-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 10px;
        }
        /* ── DAY SECTION ── */
        .day-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }
        .day-header {
          background: #1a237e;
          color: #ffffff;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.3px;
        }
        /* ── JOB TABLE ── */
        .job-table {
          width: 100%;
          border-collapse: collapse;
        }
        .job-table th {
          background: #e8eaf6;
          padding: 9px 12px;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #3949ab;
          border-bottom: 2px solid #c5cae9;
        }
        .job-table td {
          padding: 9px 12px;
          border-bottom: 1px solid #f0f2f5;
          font-size: 12px;
          color: #374151;
        }
        .job-table tr:nth-child(even) td {
          background: #f5f5f5;
        }
        .job-table tr:last-child td {
          border-bottom: none;
        }
        /* ── TOTALS ── */
        .day-total {
          background: #fffde7;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 12px;
          color: #f57f17;
          border-top: 2px solid #fff9c4;
          display: flex;
          justify-content: space-between;
        }
        .week-total {
          background: #e0f7fa;
          padding: 14px 20px;
          border-radius: 10px;
          margin: 16px 0;
          font-weight: 700;
          border-left: 4px solid #00838f;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .month-total {
          background: #e8f5e9;
          padding: 16px 20px;
          border-radius: 10px;
          margin: 20px 0;
          font-weight: 700;
          border-left: 4px solid #2e7d32;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .total-label { color: #374151; font-size: 13px; }
        .total-value { color: #1a237e; font-size: 14px; font-weight: 800; }
        /* ── SECTION DIVIDER ── */
        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, #e8eaf6, transparent);
          margin: 28px 0;
        }
        /* ── FOOTER ── */
        .footer {
          background: #1a237e;
          color: rgba(255,255,255,0.7);
          text-align: center;
          padding: 16px 32px;
          font-size: 11px;
          margin-top: 40px;
        }
        .footer strong { color: #ffffff; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-brand">Tech Times</div>
        <h1>Job Performance Report</h1>
        <div class="technician">${technicianName}</div>
        <div class="header-meta">
          <span class="header-badge">${options.type.toUpperCase()} EXPORT</span>
          <span class="header-badge">${generatedDate}</span>
        </div>
      </div>
      <div class="accent-bar"></div>

      <div class="content">
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-card-label">Total Jobs</div>
            <div class="summary-card-value">${overallTotals.jobCount}</div>
          </div>
          <div class="summary-card green">
            <div class="summary-card-label">Total AW</div>
            <div class="summary-card-value">${overallTotals.totalAw}</div>
          </div>
          <div class="summary-card amber">
            <div class="summary-card-label">Total Hours</div>
            <div class="summary-card-value">${overallTotals.totalHours.toFixed(2)}h</div>
          </div>
        </div>
  `;
  
  if (options.type === 'daily') {
    const dayJobs = groupedByDay.get(options.day!) || [];
    const dayTotals = calculateTotals(dayJobs);
    const dayDate = new Date(options.day!);
    const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    html += `<div class="section-heading">Daily Jobs</div>`;
    html += `
      <div class="day-section">
        <div class="day-header">${dayName}</div>
        <table class="job-table">
          <thead><tr>
            <th>WIP Number</th><th>Vehicle Reg</th><th>VHC</th><th>AW</th><th>Hours</th>
          </tr></thead>
          <tbody>
    `;
    dayJobs.forEach(job => {
      const hours = (job.aw * 5) / 60;
      html += `<tr>
        <td>${job.wipNumber}</td><td>${job.vehicleReg}</td>
        <td>${getVhcDisplayHtml(job.vhcStatus)}</td>
        <td><strong>${job.aw}</strong></td><td>${hours.toFixed(2)}h</td>
      </tr>`;
    });
    html += `</tbody></table>
        <div class="day-total">
          <span class="total-label">Day Total</span>
          <span class="total-value">${dayTotals.jobCount} jobs &nbsp;|&nbsp; ${dayTotals.totalAw} AW &nbsp;|&nbsp; ${dayTotals.totalHours.toFixed(2)}h</span>
        </div>
      </div>
    `;
    if (availableHours > 0) {
      console.log('ExportUtils: Daily efficiency - soldHours:', dayTotals.totalHours, 'availableHours:', availableHours);
      html += `<div class="efficiency-section"><div class="efficiency-title">Daily Efficiency</div>${generateEfficiencyBar(dayTotals.totalHours, availableHours, 'Day Performance')}</div>`;
    }
  } else if (options.type === 'weekly') {
    const weekGroups = groupDaysByWeek(sortedDays);
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      html += `<div class="section-heading">Week: ${startDate} – ${endDate}</div>`;

      weekDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayName = new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead><tr><th>WIP Number</th><th>Vehicle Reg</th><th>VHC</th><th>AW</th><th>Hours</th></tr></thead>
              <tbody>
        `;
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `<tr><td>${job.wipNumber}</td><td>${job.vehicleReg}</td><td>${getVhcDisplayHtml(job.vhcStatus)}</td><td><strong>${job.aw}</strong></td><td>${hours.toFixed(2)}h</td></tr>`;
        });
        html += `</tbody></table>
            <div class="day-total">
              <span class="total-label">Day Total</span>
              <span class="total-value">${dayTotals.jobCount} jobs &nbsp;|&nbsp; ${dayTotals.totalAw} AW &nbsp;|&nbsp; ${dayTotals.totalHours.toFixed(2)}h</span>
            </div>
          </div>
        `;
      });

      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      html += `
        <div class="week-total">
          <span class="total-label">Week Total (${startDate} – ${endDate})</span>
          <span class="total-value">${weekTotals.jobCount} jobs &nbsp;|&nbsp; ${weekTotals.totalAw} AW &nbsp;|&nbsp; ${weekTotals.totalHours.toFixed(2)}h</span>
        </div>
      `;
      if (availableHours > 0) {
        console.log('ExportUtils: Weekly efficiency - soldHours:', weekTotals.totalHours, 'availableHours:', availableHours);
        html += `<div class="efficiency-section"><div class="efficiency-title">Weekly Efficiency</div>${generateEfficiencyBar(weekTotals.totalHours, availableHours, 'Week Performance')}</div>`;
      }
    });
  } else if (options.type === 'monthly') {
    const monthGroups = groupDaysByMonth(sortedDays);
    Array.from(monthGroups.entries()).sort().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      html += `<div class="section-heading">${monthName}</div>`;

      monthDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayName = new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead><tr><th>WIP Number</th><th>Vehicle Reg</th><th>VHC</th><th>AW</th><th>Hours</th></tr></thead>
              <tbody>
        `;
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `<tr><td>${job.wipNumber}</td><td>${job.vehicleReg}</td><td>${getVhcDisplayHtml(job.vhcStatus)}</td><td><strong>${job.aw}</strong></td><td>${hours.toFixed(2)}h</td></tr>`;
        });
        html += `</tbody></table>
            <div class="day-total">
              <span class="total-label">Day Total</span>
              <span class="total-value">${dayTotals.jobCount} jobs &nbsp;|&nbsp; ${dayTotals.totalAw} AW &nbsp;|&nbsp; ${dayTotals.totalHours.toFixed(2)}h</span>
            </div>
          </div>
        `;
      });

      const monthJobs = monthDays.flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      html += `
        <div class="month-total">
          <span class="total-label">Month Total — ${monthName}</span>
          <span class="total-value">${monthTotals.jobCount} jobs &nbsp;|&nbsp; ${monthTotals.totalAw} AW &nbsp;|&nbsp; ${monthTotals.totalHours.toFixed(2)}h</span>
        </div>
      `;
      if (availableHours > 0) {
        html += `<div class="efficiency-section"><div class="efficiency-title">Monthly Efficiency</div>${generateEfficiencyBar(monthTotals.totalHours, availableHours, 'Month Performance')}</div>`;
      }
    });
  } else {
    // All/Entire export
    const weekGroups = groupDaysByWeek(sortedDays);
    const monthGroups = groupDaysByMonth(sortedDays);

    Array.from(monthGroups.entries()).sort().forEach(([month, monthDays]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      html += `<div class="section-heading">${monthName}</div>`;

      monthDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayName = new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead><tr><th>WIP Number</th><th>Vehicle Reg</th><th>VHC</th><th>AW</th><th>Hours</th></tr></thead>
              <tbody>
        `;
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `<tr><td>${job.wipNumber}</td><td>${job.vehicleReg}</td><td>${getVhcDisplayHtml(job.vhcStatus)}</td><td><strong>${job.aw}</strong></td><td>${hours.toFixed(2)}h</td></tr>`;
        });
        html += `</tbody></table>
            <div class="day-total">
              <span class="total-label">Day Total</span>
              <span class="total-value">${dayTotals.jobCount} jobs &nbsp;|&nbsp; ${dayTotals.totalAw} AW &nbsp;|&nbsp; ${dayTotals.totalHours.toFixed(2)}h</span>
            </div>
          </div>
        `;
      });

      const monthJobs = monthDays.flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      html += `
        <div class="month-total">
          <span class="total-label">Month Total — ${monthName}</span>
          <span class="total-value">${monthTotals.jobCount} jobs &nbsp;|&nbsp; ${monthTotals.totalAw} AW &nbsp;|&nbsp; ${monthTotals.totalHours.toFixed(2)}h</span>
        </div>
      `;
    });

    html += `<div class="section-heading">Weekly Summary</div>`;
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      html += `
        <div class="week-total">
          <span class="total-label">Week (${startDate} – ${endDate})</span>
          <span class="total-value">${weekTotals.jobCount} jobs &nbsp;|&nbsp; ${weekTotals.totalAw} AW &nbsp;|&nbsp; ${weekTotals.totalHours.toFixed(2)}h</span>
        </div>
      `;
    });

    if (availableHours > 0) {
      html += `<div class="section-divider"></div><div class="efficiency-section"><div class="efficiency-title">Overall Efficiency Summary</div>${generateEfficiencyBar(overallTotals.totalHours, availableHours, 'Entire Period')}</div>`;
    }
  }

  html += `
      </div><!-- /content -->
      <div class="footer">
        Generated by <strong>Tech Times</strong> &nbsp;·&nbsp; ${generatedDate}
      </div>
    </body>
    </html>
  `;

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
