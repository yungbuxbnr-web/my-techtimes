
// utils/reportEngine.ts
// Unified report engine for Tech Times PDF generation.

import { getBillingPosition, resolvePeriodFilter, PeriodMode, BillingPosition } from './billingEngine';
import { getNetScheduledHoursForDate, isWorkingDay } from './workTimeEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportPeriod = PeriodMode | 'custom';
export type DateMode = 'work_date' | 'billing_date';
export type DetailLevel = 'summary' | 'standard' | 'full';

export type PDFTheme =
  | 'tech_times_glass'
  | 'midnight_performance'
  | 'carbon_workshop'
  | 'blueprint_technical'
  | 'executive_light'
  | 'minimal_print';

export interface ReportOptions {
  period: ReportPeriod;
  customStart?: string;  // ISO date
  customEnd?: string;    // ISO date
  dateMode: DateMode;
  detailLevel: DetailLevel;
  theme: PDFTheme;
  includeSections: {
    summary: boolean;
    availability: boolean;
    dailyPerformance: boolean;
    billedJobsTable: boolean;
    openJobsTable: boolean;
    billingClosure: boolean;
    charts: boolean;
    jobMovement: boolean;
    vhcSummary: boolean;
    technicalCases: boolean;
    recordHistory: boolean;
    timeline: boolean;
    notes: boolean;
  };
  includeImages: 'none' | 'key' | 'all';
  imageQuality: 'standard' | 'high' | 'original';
  coverPage: boolean;
  pageNumbers: boolean;
  branding: boolean;
  signatureSection: boolean;
}

export interface ReportData {
  period: { label: string; start: string; end: string };
  billing: BillingPosition;
  availableHours: number;
  recordedEfficiency: number;
  billedEfficiency: number;
  jobs: any[];
  billingRecords: any[];
  billedJobs: { job: any; billing: any }[];
  openJobs: { job: any; billing: any }[];
  generatedAt: string;
  appVersion: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function getDefaultReportOptions(): ReportOptions {
  return {
    period: 'month',
    dateMode: 'work_date',
    detailLevel: 'standard',
    theme: 'tech_times_glass',
    includeSections: {
      summary: true,
      availability: true,
      dailyPerformance: true,
      billedJobsTable: true,
      openJobsTable: true,
      billingClosure: true,
      charts: false,
      jobMovement: false,
      vhcSummary: false,
      technicalCases: false,
      recordHistory: false,
      timeline: false,
      notes: false,
    },
    includeImages: 'none',
    imageQuality: 'standard',
    coverPage: true,
    pageNumbers: true,
    branding: true,
    signatureSection: false,
  };
}

// ─── Period helpers ────────────────────────────────────────────────────────────

function getPeriodBounds(options: ReportOptions): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (options.period === 'custom' && options.customStart && options.customEnd) {
    return {
      start: new Date(options.customStart),
      end: new Date(options.customEnd),
      label: `${options.customStart} to ${options.customEnd}`,
    };
  }
  switch (options.period) {
    case 'day': {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start: s, end: e, label: s.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
    }
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59);
      return { start: s, end: e, label: `Week of ${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start: s, end: e, label: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
    }
    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { start: s, end: e, label: String(now.getFullYear()) };
    }
    default: {
      const s = new Date(2000, 0, 1);
      return { start: s, end: now, label: 'Entire History' };
    }
  }
}

// ─── Build report data ────────────────────────────────────────────────────────

export async function buildReportData(
  options: ReportOptions,
  jobs: any[],
  billingRecords: any[],
  schedule: any,
  absences: any[]
): Promise<ReportData> {
  console.log('[reportEngine] buildReportData — period:', options.period, '| jobs:', jobs.length, '| records:', billingRecords.length);

  const bounds = getPeriodBounds(options);
  const periodMode: PeriodMode = (options.period === 'custom' ? 'entire' : options.period) as PeriodMode;
  const filter = resolvePeriodFilter(periodMode, bounds.start, options.dateMode);

  const billing = getBillingPosition(jobs, billingRecords, filter);

  // Calculate available hours for the period
  let availableHours = 0;
  if (schedule) {
    const cursor = new Date(bounds.start);
    while (cursor <= bounds.end) {
      const dateStr = cursor.toISOString().split('T')[0];
      const absence = absences.find((a: any) => a.absenceDate === dateStr);
      const scheduledHrs = getNetScheduledHoursForDate(schedule, cursor);
      const absenceHrs = absence ? (absence.absenceHours ?? 0) : 0;
      availableHours += Math.max(0, scheduledHrs - absenceHrs);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const safeAvailable = availableHours > 0 ? availableHours : 1;
  const recordedEfficiency = Math.min(200, (billing.recordedHours / safeAvailable) * 100);
  const billedEfficiency = Math.min(200, (billing.billedHours / safeAvailable) * 100);

  // Build billed/open job pairs
  const byJobId = new Map(billingRecords.map((r: any) => [r.jobId, r]));
  const billedJobs: { job: any; billing: any }[] = [];
  const openJobs: { job: any; billing: any }[] = [];

  for (const job of jobs) {
    const rec = byJobId.get(job.id);
    if (!rec) continue;
    const jobDate = job.createdAt.split('T')[0];
    if (jobDate < bounds.start.toISOString().split('T')[0] || jobDate > bounds.end.toISOString().split('T')[0]) continue;
    const status = rec.billingStatus === 'billed' || rec.billingStatus === 'legacy_unknown' ? 'billed' : 'open';
    if (status === 'billed') billedJobs.push({ job, billing: rec });
    else openJobs.push({ job, billing: rec });
  }

  console.log('[reportEngine] Report data built — availableHours:', availableHours.toFixed(2), '| recEff:', recordedEfficiency.toFixed(1) + '%', '| billEff:', billedEfficiency.toFixed(1) + '%');

  return {
    period: {
      label: bounds.label,
      start: bounds.start.toISOString().split('T')[0],
      end: bounds.end.toISOString().split('T')[0],
    },
    billing,
    availableHours,
    recordedEfficiency,
    billedEfficiency,
    jobs,
    billingRecords,
    billedJobs,
    openJobs,
    generatedAt: new Date().toISOString(),
    appVersion: '1.9.0',
  };
}

// ─── Theme CSS ────────────────────────────────────────────────────────────────

function getThemeCSS(theme: PDFTheme): string {
  switch (theme) {
    case 'tech_times_glass':
      return `
        body { background: #0a1628; color: #e8f4fd; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
        .card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px; margin: 16px 0; backdrop-filter: blur(10px); }
        .accent { color: #4fc3f7; }
        h1, h2, h3 { color: #4fc3f7; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(79,195,247,0.2); color: #4fc3f7; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #e8f4fd; }
        tr:hover td { background: rgba(255,255,255,0.04); }
        .cover { background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%); }
        .stat-value { color: #4fc3f7; font-size: 28px; font-weight: 700; }
        .stat-label { color: rgba(232,244,253,0.6); font-size: 12px; }
        .badge-billed { background: #2e7d32; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #c62828; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: rgba(232,244,253,0.4); font-size: 11px; text-align: center; margin-top: 40px; }
      `;
    case 'midnight_performance':
      return `
        body { background: #000; color: #e0e0e0; font-family: 'Courier New', monospace; }
        .card { background: #111; border: 1px solid #00e5ff; border-radius: 4px; padding: 20px; margin: 16px 0; }
        .accent { color: #00e5ff; }
        h1, h2, h3 { color: #00e5ff; text-transform: uppercase; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #00e5ff; color: #000; padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 700; }
        td { padding: 8px; border-bottom: 1px solid #222; font-size: 12px; }
        .stat-value { color: #00e5ff; font-size: 28px; font-weight: 700; }
        .stat-label { color: #666; font-size: 12px; }
        .badge-billed { background: #00e5ff; color: #000; padding: 2px 8px; border-radius: 2px; font-size: 11px; font-weight: 700; }
        .badge-open { background: #ff1744; color: #fff; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: #444; font-size: 11px; text-align: center; margin-top: 40px; }
      `;
    case 'carbon_workshop':
      return `
        body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, Arial, sans-serif; }
        .card { background: #242424; border: 1px solid #333; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #ff6b35; }
        .accent { color: #ff6b35; }
        h1, h2, h3 { color: #ff6b35; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #ff6b35; color: #fff; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #333; font-size: 12px; }
        .stat-value { color: #ff6b35; font-size: 28px; font-weight: 700; }
        .stat-label { color: #888; font-size: 12px; }
        .badge-billed { background: #2e7d32; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #ff6b35; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: #555; font-size: 11px; text-align: center; margin-top: 40px; }
      `;
    case 'blueprint_technical':
      return `
        body { background: #0d1b2a; color: #b0c4de; font-family: 'Courier New', monospace; }
        .card { background: rgba(100,181,246,0.05); border: 1px solid rgba(100,181,246,0.3); border-radius: 4px; padding: 20px; margin: 16px 0; }
        .accent { color: #64b5f6; }
        h1, h2, h3 { color: #64b5f6; font-family: 'Courier New', monospace; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(100,181,246,0.15); color: #64b5f6; padding: 10px 8px; text-align: left; font-size: 12px; border: 1px solid rgba(100,181,246,0.3); }
        td { padding: 8px; border: 1px solid rgba(100,181,246,0.1); font-size: 12px; }
        .stat-value { color: #64b5f6; font-size: 28px; font-weight: 700; }
        .stat-label { color: rgba(176,196,222,0.6); font-size: 12px; }
        .badge-billed { background: #1b5e20; color: #a5d6a7; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .badge-open { background: #b71c1c; color: #ef9a9a; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: rgba(176,196,222,0.3); font-size: 11px; text-align: center; margin-top: 40px; }
      `;
    case 'executive_light':
      return `
        body { background: #fff; color: #1a237e; font-family: Georgia, 'Times New Roman', serif; }
        .card { background: #f8f9ff; border: 1px solid #c5cae9; border-radius: 8px; padding: 20px; margin: 16px 0; }
        .accent { color: #1a237e; }
        h1, h2, h3 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a237e; color: #fff; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #e8eaf6; font-size: 12px; color: #1a237e; }
        tr:nth-child(even) td { background: #f3f4ff; }
        .stat-value { color: #1a237e; font-size: 28px; font-weight: 700; }
        .stat-label { color: #5c6bc0; font-size: 12px; }
        .badge-billed { background: #1b5e20; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #b71c1c; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: #9fa8da; font-size: 11px; text-align: center; margin-top: 40px; border-top: 1px solid #c5cae9; padding-top: 16px; }
      `;
    case 'minimal_print':
    default:
      return `
        body { background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
        .card { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin: 12px 0; }
        .accent { color: #000; }
        h1, h2, h3 { color: #000; border-bottom: 1px solid #000; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f5f5; color: #000; padding: 8px; text-align: left; font-size: 12px; border: 1px solid #ddd; }
        td { padding: 7px 8px; border: 1px solid #ddd; font-size: 12px; }
        .stat-value { color: #000; font-size: 24px; font-weight: 700; }
        .stat-label { color: #555; font-size: 12px; }
        .badge-billed { background: #000; color: #fff; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .badge-open { background: #fff; color: #000; border: 1px solid #000; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: #888; font-size: 11px; text-align: center; margin-top: 40px; }
      `;
  }
}

// ─── PDF HTML generator ───────────────────────────────────────────────────────

export function generatePDFHTML(data: ReportData, options: ReportOptions): string {
  console.log('[reportEngine] generatePDFHTML — theme:', options.theme, '| period:', data.period.label);

  const css = getThemeCSS(options.theme);
  const { billing } = data;

  const safeAvailable = data.availableHours > 0 ? data.availableHours : 1;

  const sections: string[] = [];

  // ── Cover Page ──────────────────────────────────────────────────────────────
  if (options.coverPage) {
    sections.push(`
      <div class="cover" style="text-align:center; padding: 60px 40px; min-height: 300px;">
        <div style="font-size: 48px; font-weight: 900; letter-spacing: 4px;" class="accent">TECH TIMES</div>
        <div style="font-size: 14px; margin-top: 8px; opacity: 0.6;">Technician Performance Report</div>
        <div style="font-size: 24px; font-weight: 700; margin-top: 32px;">${data.period.label}</div>
        <div style="font-size: 13px; margin-top: 12px; opacity: 0.5;">${data.period.start} to ${data.period.end}</div>
        <div style="font-size: 12px; margin-top: 40px; opacity: 0.4;">Generated: ${new Date(data.generatedAt).toLocaleString('en-GB')}</div>
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.3;">Tech Times v${data.appVersion}</div>
      </div>
      <div style="page-break-after: always;"></div>
    `);
  }

  // ── Executive Summary ───────────────────────────────────────────────────────
  if (options.includeSections.summary) {
    sections.push(`
      <div class="card">
        <h2>Executive Summary</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 16px;">
          ${statBox('Recorded Hours', billing.recordedHours.toFixed(1) + 'h')}
          ${statBox('Billed Hours', billing.billedHours.toFixed(1) + 'h')}
          ${statBox('Open Hours', billing.openHours.toFixed(1) + 'h')}
          ${statBox('Available Hours', data.availableHours.toFixed(1) + 'h')}
          ${statBox('Recorded AW', String(billing.recordedAW))}
          ${statBox('Billed AW', String(billing.billedAW))}
          ${statBox('Rec. Efficiency', data.recordedEfficiency.toFixed(0) + '%')}
          ${statBox('Billed Efficiency', data.billedEfficiency.toFixed(0) + '%')}
          ${statBox('Billing Conversion', billing.billingConversion.toFixed(0) + '%')}
          ${statBox('Closure Rate', billing.closureRate.toFixed(0) + '%')}
          ${statBox('Billing Gap', billing.billingGap.toFixed(1) + 'h')}
          ${statBox('Total Jobs', String(billing.totalJobs))}
        </div>
      </div>
    `);
  }

  // ── Availability Breakdown ──────────────────────────────────────────────────
  if (options.includeSections.availability) {
    sections.push(`
      <div class="card">
        <h2>Availability Breakdown</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Period</td><td>${data.period.label}</td></tr>
          <tr><td>Available Hours (after absences)</td><td>${data.availableHours.toFixed(2)}h</td></tr>
          <tr><td>Recorded Hours</td><td>${billing.recordedHours.toFixed(2)}h</td></tr>
          <tr><td>Billed Hours</td><td>${billing.billedHours.toFixed(2)}h</td></tr>
          <tr><td>Open Hours</td><td>${billing.openHours.toFixed(2)}h</td></tr>
          <tr><td>Recorded Efficiency</td><td>${data.recordedEfficiency.toFixed(1)}%</td></tr>
          <tr><td>Billed Efficiency</td><td>${data.billedEfficiency.toFixed(1)}%</td></tr>
        </table>
      </div>
    `);
  }

  // ── Closed/Billed Jobs Table ────────────────────────────────────────────────
  if (options.includeSections.billedJobsTable && data.billedJobs.length > 0) {
    const rows = data.billedJobs.map(({ job, billing: rec }) => {
      const workDate = job.createdAt.split('T')[0];
      const billedDate = rec.billedDate ?? '—';
      const closureDelay = rec.billedDate
        ? Math.round((new Date(rec.billedDate).getTime() - new Date(workDate).getTime()) / 86400000)
        : '—';
      const recAW = job.aw;
      const recHrs = ((job.aw * 5) / 60).toFixed(2);
      const billAW = rec.billedAW ?? 0;
      const billHrs = (rec.billedHours ?? 0).toFixed(2);
      const vhc = job.vhcStatus ?? 'NONE';
      return `<tr>
        <td>${workDate}</td>
        <td>${job.wipNumber ?? '—'}</td>
        <td>${job.vehicleReg ?? '—'}</td>
        <td>${recAW}</td>
        <td>${recHrs}h</td>
        <td>${billAW}</td>
        <td>${billHrs}h</td>
        <td>${billedDate}</td>
        <td>${closureDelay}d</td>
        <td>${vhc}</td>
        <td>${job.notes ?? ''}</td>
      </tr>`;
    }).join('');

    sections.push(`
      <div class="card">
        <h2>Closed / Billed Jobs (${data.billedJobs.length})</h2>
        <table>
          <thead><tr>
            <th>Work Date</th><th>WIP</th><th>Reg</th>
            <th>Rec AW</th><th>Rec Hrs</th>
            <th>Bill AW</th><th>Bill Hrs</th>
            <th>Closed Date</th><th>Delay</th>
            <th>VHC</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // ── Open Jobs Table ─────────────────────────────────────────────────────────
  if (options.includeSections.openJobsTable && data.openJobs.length > 0) {
    const today = new Date();
    const rows = data.openJobs.map(({ job }) => {
      const workDate = job.createdAt.split('T')[0];
      const jobAge = Math.round((today.getTime() - new Date(workDate).getTime()) / 86400000);
      const currAW = job.aw;
      const currHrs = ((job.aw * 5) / 60).toFixed(2);
      const vhc = job.vhcStatus ?? 'NONE';
      const priority = jobAge > 7 ? 'HIGH' : jobAge > 3 ? 'MED' : 'LOW';
      return `<tr>
        <td>${workDate}</td>
        <td>${job.wipNumber ?? '—'}</td>
        <td>${job.vehicleReg ?? '—'}</td>
        <td>${currAW}</td>
        <td>${currHrs}h</td>
        <td>${jobAge}d</td>
        <td>${vhc}</td>
        <td>${priority}</td>
        <td>${job.notes ?? ''}</td>
      </tr>`;
    }).join('');

    sections.push(`
      <div class="card">
        <h2>Open Jobs (${data.openJobs.length})</h2>
        <table>
          <thead><tr>
            <th>Work Date</th><th>WIP</th><th>Reg</th>
            <th>Curr AW</th><th>Curr Hrs</th>
            <th>Job Age</th><th>VHC</th><th>Priority</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // ── Billing & Job Closure Summary ───────────────────────────────────────────
  if (options.includeSections.billingClosure) {
    sections.push(`
      <div class="card">
        <h2>Billing &amp; Job Closure Summary</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Recorded Hours</td><td>${billing.recordedHours.toFixed(2)}h</td></tr>
          <tr><td>Billed Hours</td><td>${billing.billedHours.toFixed(2)}h</td></tr>
          <tr><td>Open Hours</td><td>${billing.openHours.toFixed(2)}h</td></tr>
          <tr><td>Recorded AW</td><td>${billing.recordedAW}</td></tr>
          <tr><td>Billed AW</td><td>${billing.billedAW}</td></tr>
          <tr><td>Open AW</td><td>${billing.openAW}</td></tr>
          <tr><td>Total Jobs</td><td>${billing.totalJobs}</td></tr>
          <tr><td>Jobs Billed</td><td>${billing.billedJobs}</td></tr>
          <tr><td>Jobs Open</td><td>${billing.openJobs}</td></tr>
          <tr><td>Recorded Efficiency</td><td>${data.recordedEfficiency.toFixed(1)}%</td></tr>
          <tr><td>Billed Efficiency</td><td>${data.billedEfficiency.toFixed(1)}%</td></tr>
          <tr><td>Billing Conversion</td><td>${billing.billingConversion.toFixed(1)}%</td></tr>
          <tr><td>Closure Rate</td><td>${billing.closureRate.toFixed(1)}%</td></tr>
          <tr><td>Billing Gap</td><td>${billing.billingGap.toFixed(2)}h</td></tr>
        </table>
      </div>
    `);
  }

  // ── Signature Section ───────────────────────────────────────────────────────
  if (options.signatureSection) {
    sections.push(`
      <div class="card" style="margin-top: 40px;">
        <h3>Signature</h3>
        <div style="display: flex; gap: 60px; margin-top: 20px;">
          <div>
            <div style="border-bottom: 1px solid currentColor; width: 200px; margin-bottom: 8px; height: 40px;"></div>
            <div style="font-size: 12px; opacity: 0.6;">Technician Signature</div>
          </div>
          <div>
            <div style="border-bottom: 1px solid currentColor; width: 200px; margin-bottom: 8px; height: 40px;"></div>
            <div style="font-size: 12px; opacity: 0.6;">Date</div>
          </div>
        </div>
      </div>
    `);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footer = options.pageNumbers
    ? `<div class="footer">Tech Times v${data.appVersion} · Generated ${new Date(data.generatedAt).toLocaleString('en-GB')} · ${data.period.label}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tech Times Report — ${data.period.label}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${css}
    body { padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    h3 { font-size: 16px; margin-bottom: 8px; }
    .stat-grid { display: flex; flex-wrap: wrap; gap: 16px; }
    .stat-box { min-width: 120px; }
    @media print {
      .card { page-break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${sections.join('\n')}
  ${footer}
</body>
</html>`;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function statBox(label: string, value: string): string {
  return `<div class="stat-box">
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

// ─── Technical Evidence Pack ──────────────────────────────────────────────────

export async function generateTechnicalEvidencePackHTML(
  job: any,
  billing: any | null,
  technicalCase: any | null,
  options: { theme: PDFTheme; includeImages: boolean }
): Promise<string> {
  console.log('[reportEngine] generateTechnicalEvidencePackHTML — job:', job?.wipNumber, '| theme:', options.theme);

  const css = getThemeCSS(options.theme);
  const workDate = job?.createdAt?.split('T')[0] ?? '—';
  const billedDate = billing?.billedDate ?? '—';
  const recAW = job?.aw ?? 0;
  const recHrs = ((recAW * 5) / 60).toFixed(2);
  const billAW = billing?.billedAW ?? 0;
  const billHrs = (billing?.billedHours ?? 0).toFixed(2);

  const sections: string[] = [];

  // 1. Cover / Job Identification
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Technical Evidence Pack</div>
      <div style="margin-top: 24px; font-size: 14px; opacity: 0.7;">WIP: ${job?.wipNumber ?? '—'}</div>
      <div style="font-size: 14px; opacity: 0.7;">Registration: ${job?.vehicleReg ?? '—'}</div>
      <div style="font-size: 14px; opacity: 0.7;">Work Date: ${workDate}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${new Date().toLocaleString('en-GB')}</div>
    </div>
  `);

  // 2. Job Info & Complaint
  sections.push(`
    <div class="card">
      <h2>Job Information &amp; Complaint</h2>
      <table>
        <tr><th>Field</th><th>Value</th></tr>
        <tr><td>WIP Number</td><td>${job?.wipNumber ?? '—'}</td></tr>
        <tr><td>Vehicle Registration</td><td>${job?.vehicleReg ?? '—'}</td></tr>
        <tr><td>Work Date</td><td>${workDate}</td></tr>
        <tr><td>Recorded AW</td><td>${recAW}</td></tr>
        <tr><td>Recorded Hours</td><td>${recHrs}h</td></tr>
        <tr><td>VHC Status</td><td>${job?.vhcStatus ?? 'NONE'}</td></tr>
        <tr><td>Billing Status</td><td>${billing?.billingStatus ?? 'open'}</td></tr>
        <tr><td>Billed AW</td><td>${billAW}</td></tr>
        <tr><td>Billed Hours</td><td>${billHrs}h</td></tr>
        <tr><td>Billed Date</td><td>${billedDate}</td></tr>
      </table>
      ${job?.notes ? `<div style="margin-top: 16px;"><strong>Notes:</strong><br>${job.notes}</div>` : ''}
    </div>
  `);

  // 3. Diagnostic Findings
  sections.push(`
    <div class="card">
      <h2>Diagnostic Findings</h2>
      ${technicalCase?.diagnosticFindings
        ? `<p>${technicalCase.diagnosticFindings}</p>`
        : '<p style="opacity:0.5;">No diagnostic findings recorded.</p>'}
    </div>
  `);

  // 4. Tests / Measurements / Diagnosis
  sections.push(`
    <div class="card">
      <h2>Tests / Measurements / Diagnosis</h2>
      ${technicalCase?.measurements
        ? `<p>${technicalCase.measurements}</p>`
        : '<p style="opacity:0.5;">No measurements recorded.</p>'}
    </div>
  `);

  // 5. Repair / Action / Result
  sections.push(`
    <div class="card">
      <h2>Repair / Action / Result</h2>
      ${technicalCase?.repairAction
        ? `<p>${technicalCase.repairAction}</p>`
        : '<p style="opacity:0.5;">No repair action recorded.</p>'}
    </div>
  `);

  // 6. Photographic Evidence
  if (options.includeImages && job?.imageUri) {
    sections.push(`
      <div class="card">
        <h2>Photographic Evidence</h2>
        <img src="${job.imageUri}" style="max-width: 100%; border-radius: 8px; margin-top: 12px;" />
      </div>
    `);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Technical Evidence Pack — ${job?.wipNumber ?? 'Unknown'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${css}
    body { padding: 24px; max-width: 900px; margin: 0 auto; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    @media print { .card { page-break-inside: avoid; } }
  </style>
</head>
<body>
  ${sections.join('\n')}
  <div class="footer">Tech Times · Technical Evidence Pack · ${new Date().toLocaleDateString('en-GB')}</div>
</body>
</html>`;
}
