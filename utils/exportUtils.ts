
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Job } from './api';

export interface ExportOptions {
  type: 'daily' | 'weekly' | 'monthly' | 'all';
  month?: string;
  week?: number;
  day?: string;
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

// Get week range (Monday to Saturday)
function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(date.setDate(diff));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { start: monday, end: saturday };
}

// Generate PDF HTML
function generatePdfHtml(
  jobs: Job[],
  technicianName: string,
  options: ExportOptions
): string {
  const groupedByDay = groupJobsByDay(jobs);
  const sortedDays = Array.from(groupedByDay.keys()).sort();
  
  // Group days by week
  const weekGroups = new Map<string, { days: string[]; jobs: Job[] }>();
  sortedDays.forEach(day => {
    const date = new Date(day);
    const weekRange = getWeekRange(new Date(date));
    const weekKey = `${weekRange.start.toISOString().split('T')[0]}_${weekRange.end.toISOString().split('T')[0]}`;
    
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, { days: [], jobs: [] });
    }
    weekGroups.get(weekKey)!.days.push(day);
    weekGroups.get(weekKey)!.jobs.push(...groupedByDay.get(day)!);
  });
  
  // Group by month
  const monthGroups = new Map<string, Job[]>();
  jobs.forEach(job => {
    const month = job.createdAt.substring(0, 7);
    if (!monthGroups.has(month)) {
      monthGroups.set(month, []);
    }
    monthGroups.get(month)!.push(job);
  });
  
  const overallTotals = calculateTotals(jobs);
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #2196F3;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #2196F3;
          margin: 0;
          font-size: 24px;
        }
        .header .technician {
          font-size: 18px;
          color: #333;
          margin: 10px 0;
        }
        .header .date {
          color: #666;
          font-size: 14px;
        }
        .summary {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
        }
        .summary-label {
          font-weight: bold;
          color: #333;
        }
        .summary-value {
          color: #2196F3;
          font-weight: bold;
        }
        .day-section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .day-header {
          background: #2196F3;
          color: white;
          padding: 10px;
          border-radius: 5px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .job-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        .job-table th {
          background: #e3f2fd;
          padding: 8px;
          text-align: left;
          border: 1px solid #ddd;
          font-weight: bold;
        }
        .job-table td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        .job-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .day-total {
          background: #fff3cd;
          padding: 10px;
          border-radius: 5px;
          margin-top: 10px;
          font-weight: bold;
        }
        .week-total {
          background: #d1ecf1;
          padding: 12px;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
          border-left: 4px solid #0c5460;
        }
        .month-total {
          background: #d4edda;
          padding: 15px;
          border-radius: 5px;
          margin: 25px 0;
          font-weight: bold;
          border-left: 4px solid #155724;
        }
        .total-label {
          color: #333;
        }
        .total-value {
          color: #2196F3;
          float: right;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TechTimes Job Report</h1>
        <div class="technician">${technicianName}</div>
        <div class="date">Generated: ${new Date().toLocaleString('en-GB')}</div>
      </div>
      
      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Total Jobs:</span>
          <span class="summary-value">${overallTotals.jobCount}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total AW:</span>
          <span class="summary-value">${overallTotals.totalAw}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Hours:</span>
          <span class="summary-value">${overallTotals.totalHours.toFixed(2)}h</span>
        </div>
      </div>
  `;
  
  // Generate daily sections
  sortedDays.forEach(day => {
    const dayJobs = groupedByDay.get(day)!;
    const dayTotals = calculateTotals(dayJobs);
    const dayDate = new Date(day);
    const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    html += `
      <div class="day-section">
        <div class="day-header">${dayName}</div>
        <table class="job-table">
          <thead>
            <tr>
              <th>WIP Number</th>
              <th>Work Done</th>
              <th>AW</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    dayJobs.forEach(job => {
      const hours = (job.aw * 5) / 60;
      const workDone = job.notes || job.vehicleReg;
      html += `
        <tr>
          <td>${job.wipNumber}</td>
          <td>${workDone}</td>
          <td>${job.aw}</td>
          <td>${hours.toFixed(2)}h</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
        <div class="day-total">
          <span class="total-label">Day Total:</span>
          <span class="total-value">${dayTotals.jobCount} jobs | ${dayTotals.totalAw} AW | ${dayTotals.totalHours.toFixed(2)}h</span>
        </div>
      </div>
    `;
  });
  
  // Add week totals (Monday to Saturday)
  Array.from(weekGroups.entries()).forEach(([weekKey, weekData]) => {
    const [startStr, endStr] = weekKey.split('_');
    const weekTotals = calculateTotals(weekData.jobs);
    const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    html += `
      <div class="week-total">
        <div><span class="total-label">Week Total (${startDate} - ${endDate}):</span></div>
        <div><span class="total-value">${weekTotals.jobCount} jobs | ${weekTotals.totalAw} AW | ${weekTotals.totalHours.toFixed(2)}h</span></div>
      </div>
    `;
  });
  
  // Add month totals
  Array.from(monthGroups.entries()).sort().forEach(([month, monthJobs]) => {
    const monthTotals = calculateTotals(monthJobs);
    const monthDate = new Date(month + '-01');
    const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    
    html += `
      <div class="month-total">
        <div><span class="total-label">Month Total (${monthName}):</span></div>
        <div><span class="total-value">${monthTotals.jobCount} jobs | ${monthTotals.totalAw} AW | ${monthTotals.totalHours.toFixed(2)}h</span></div>
      </div>
    `;
  });
  
  html += `
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
  console.log('ExportUtils: Generating PDF with', jobs.length, 'jobs');
  
  const html = generatePdfHtml(jobs, technicianName, options);
  
  const { uri } = await Print.printToFileAsync({ html });
  console.log('ExportUtils: PDF generated at', uri);
  
  // Move to a permanent location
  const fileName = `techtimes_report_${options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
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

// Export to JSON
export async function exportToJson(jobs: Job[]): Promise<void> {
  console.log('ExportUtils: Exporting', jobs.length, 'jobs to JSON');
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    jobs: jobs.map(job => ({
      wipNumber: job.wipNumber,
      vehicleReg: job.vehicleReg,
      aw: job.aw,
      notes: job.notes || '',
      vhcStatus: job.vhcStatus || 'N/A',
      createdAt: job.createdAt,
    })),
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const fileName = `techtimes_jobs_${new Date().toISOString().split('T')[0]}.json`;
  const fileUri = FileSystem.documentDirectory + fileName;
  
  await FileSystem.writeAsStringAsync(fileUri, jsonString);
  console.log('ExportUtils: JSON exported to', fileUri);
  
  // Share the JSON
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Share TechTimes Jobs Data',
    });
    console.log('ExportUtils: JSON shared successfully');
  }
}

// Import from JSON
export async function importFromJson(
  jsonUri: string,
  onProgress: (current: number, total: number, job: any) => void
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  console.log('ExportUtils: Importing jobs from', jsonUri);
  
  const jsonString = await FileSystem.readAsStringAsync(jsonUri);
  const importData = JSON.parse(jsonString);
  
  if (!importData.jobs || !Array.isArray(importData.jobs)) {
    throw new Error('Invalid JSON format: missing jobs array');
  }
  
  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };
  
  const total = importData.jobs.length;
  
  for (let i = 0; i < importData.jobs.length; i++) {
    const job = importData.jobs[i];
    
    try {
      onProgress(i + 1, total, job);
      
      // Validate job data
      if (!job.wipNumber || !job.vehicleReg || job.aw === undefined) {
        results.skipped++;
        results.errors.push(`Job ${i + 1}: Missing required fields`);
        continue;
      }
      
      // Job will be imported by the calling function
      results.imported++;
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.skipped++;
      results.errors.push(`Job ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('ExportUtils: Error importing job', i + 1, error);
    }
  }
  
  console.log('ExportUtils: Import complete -', results.imported, 'imported,', results.skipped, 'skipped');
  return results;
}
