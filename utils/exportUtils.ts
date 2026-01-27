
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
        .header .export-type {
          color: #2196F3;
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
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
        .efficiency-section {
          background: #fff;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 2px solid #2196F3;
        }
        .efficiency-title {
          font-size: 16px;
          font-weight: bold;
          color: #2196F3;
          margin-bottom: 15px;
          text-align: center;
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
        .section-divider {
          border-top: 2px dashed #ccc;
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TechTimes Job Report</h1>
        <div class="technician">${technicianName}</div>
        <div class="date">Generated: ${new Date().toLocaleString('en-GB')}</div>
        <div class="export-type">${options.type.toUpperCase()} EXPORT</div>
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
  
  if (options.type === 'daily') {
    // Daily export - show the selected day
    const dayJobs = groupedByDay.get(options.day!) || [];
    const dayTotals = calculateTotals(dayJobs);
    const dayDate = new Date(options.day!);
    const dayName = dayDate.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    html += `
      <div class="day-section">
        <div class="day-header">${dayName}</div>
        <table class="job-table">
          <thead>
            <tr>
              <th>WIP Number</th>
              <th>Vehicle Reg</th>
              <th>VHC</th>
              <th>AW</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    dayJobs.forEach(job => {
      const hours = (job.aw * 5) / 60;
      html += `
        <tr>
          <td>${job.wipNumber}</td>
          <td>${job.vehicleReg}</td>
          <td>${getVhcDisplayHtml(job.vhcStatus)}</td>
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
    
    // Add efficiency bar for the day
    if (availableHours > 0) {
      const dailyAvailable = availableHours / 30; // Rough estimate
      html += `
        <div class="efficiency-section">
          <div class="efficiency-title">Daily Efficiency</div>
          ${generateEfficiencyBar(dayTotals.totalHours, dailyAvailable, 'Day Performance')}
        </div>
      `;
    }
  } else if (options.type === 'weekly') {
    // Weekly export - show each day with totals, then week total
    const weekGroups = groupDaysByWeek(sortedDays);
    
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      
      html += `<div class="section-divider"></div>`;
      html += `<h2 style="color: #2196F3;">Week: ${startDate} - ${endDate}</h2>`;
      
      // Show each day in the week
      weekDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayDate = new Date(day);
        const dayName = dayDate.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead>
                <tr>
                  <th>WIP Number</th>
                  <th>Vehicle Reg</th>
                  <th>VHC</th>
                  <th>AW</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `
            <tr>
              <td>${job.wipNumber}</td>
              <td>${job.vehicleReg}</td>
              <td>${getVhcDisplayHtml(job.vhcStatus)}</td>
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
      
      // Week total
      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      
      html += `
        <div class="week-total">
          <div><span class="total-label">Week Total (${startDate} - ${endDate}):</span></div>
          <div><span class="total-value">${weekTotals.jobCount} jobs | ${weekTotals.totalAw} AW | ${weekTotals.totalHours.toFixed(2)}h</span></div>
        </div>
      `;
      
      // Add efficiency bar for the week
      if (availableHours > 0) {
        const weeklyAvailable = (availableHours / 30) * 6; // 6 working days per week
        html += `
          <div class="efficiency-section">
            <div class="efficiency-title">Weekly Efficiency</div>
            ${generateEfficiencyBar(weekTotals.totalHours, weeklyAvailable, 'Week Performance')}
          </div>
        `;
      }
    });
  } else if (options.type === 'monthly') {
    // Monthly export - show each day with totals, then month total
    const monthGroups = groupDaysByMonth(sortedDays);
    
    Array.from(monthGroups.entries()).sort().forEach(([month, monthDays]) => {
      const monthDate = new Date(month + '-01');
      const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      
      html += `<div class="section-divider"></div>`;
      html += `<h2 style="color: #2196F3;">${monthName}</h2>`;
      
      // Show each day in the month
      monthDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayDate = new Date(day);
        const dayName = dayDate.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead>
                <tr>
                  <th>WIP Number</th>
                  <th>Vehicle Reg</th>
                  <th>VHC</th>
                  <th>AW</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `
            <tr>
              <td>${job.wipNumber}</td>
              <td>${job.vehicleReg}</td>
              <td>${getVhcDisplayHtml(job.vhcStatus)}</td>
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
      
      // Month total
      const monthJobs = monthDays.flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      
      html += `
        <div class="month-total">
          <div><span class="total-label">Month Total (${monthName}):</span></div>
          <div><span class="total-value">${monthTotals.jobCount} jobs | ${monthTotals.totalAw} AW | ${monthTotals.totalHours.toFixed(2)}h</span></div>
        </div>
      `;
      
      // Add efficiency bar for the month
      if (availableHours > 0) {
        html += `
          <div class="efficiency-section">
            <div class="efficiency-title">Monthly Efficiency</div>
            ${generateEfficiencyBar(monthTotals.totalHours, availableHours, 'Month Performance')}
          </div>
        `;
      }
    });
  } else {
    // All/Entire export - show days, week totals, and month totals
    const weekGroups = groupDaysByWeek(sortedDays);
    const monthGroups = groupDaysByMonth(sortedDays);
    
    // Show all days grouped by month
    Array.from(monthGroups.entries()).sort().forEach(([month, monthDays]) => {
      const monthDate = new Date(month + '-01');
      const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      
      html += `<div class="section-divider"></div>`;
      html += `<h2 style="color: #2196F3;">${monthName}</h2>`;
      
      // Show each day
      monthDays.sort().forEach(day => {
        const dayJobs = groupedByDay.get(day)!;
        const dayTotals = calculateTotals(dayJobs);
        const dayDate = new Date(day);
        const dayName = dayDate.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        
        html += `
          <div class="day-section">
            <div class="day-header">${dayName}</div>
            <table class="job-table">
              <thead>
                <tr>
                  <th>WIP Number</th>
                  <th>Vehicle Reg</th>
                  <th>VHC</th>
                  <th>AW</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        dayJobs.forEach(job => {
          const hours = (job.aw * 5) / 60;
          html += `
            <tr>
              <td>${job.wipNumber}</td>
              <td>${job.vehicleReg}</td>
              <td>${getVhcDisplayHtml(job.vhcStatus)}</td>
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
      
      // Month total
      const monthJobs = monthDays.flatMap(day => groupedByDay.get(day)!);
      const monthTotals = calculateTotals(monthJobs);
      
      html += `
        <div class="month-total">
          <div><span class="total-label">Month Total (${monthName}):</span></div>
          <div><span class="total-value">${monthTotals.jobCount} jobs | ${monthTotals.totalAw} AW | ${monthTotals.totalHours.toFixed(2)}h</span></div>
        </div>
      `;
    });
    
    // Add week totals summary
    html += `<div class="section-divider"></div>`;
    html += `<h2 style="color: #2196F3;">Weekly Summary</h2>`;
    
    Array.from(weekGroups.entries()).forEach(([weekKey, weekDays]) => {
      const [startStr, endStr] = weekKey.split('_');
      const weekJobs = weekDays.flatMap(day => groupedByDay.get(day)!);
      const weekTotals = calculateTotals(weekJobs);
      const startDate = new Date(startStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endDate = new Date(endStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      
      html += `
        <div class="week-total">
          <div><span class="total-label">Week (${startDate} - ${endDate}):</span></div>
          <div><span class="total-value">${weekTotals.jobCount} jobs | ${weekTotals.totalAw} AW | ${weekTotals.totalHours.toFixed(2)}h</span></div>
        </div>
      `;
    });
    
    // Add overall efficiency section at the end
    if (availableHours > 0) {
      html += `
        <div class="section-divider"></div>
        <div class="efficiency-section">
          <div class="efficiency-title">Overall Efficiency Summary</div>
          ${generateEfficiencyBar(overallTotals.totalHours, availableHours, 'Entire Period')}
        </div>
      `;
    }
  }
  
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
