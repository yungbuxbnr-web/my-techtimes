
// utils/reportEngine.ts
// Unified report engine for Tech Times PDF generation.

import { getBillingPosition, resolvePeriodFilter, awToHours, PeriodMode, BillingPosition } from './billingEngine';
import { getNetScheduledHoursForDate, isWorkingDay } from './workTimeEngine';

const APP_VERSION = '1.10.0';

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
  customStart?: string;
  customEnd?: string;
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
  // Extended fields
  technicianName?: string;
  showTechnicianName?: boolean;
  showCreatedBy?: boolean;
  showGenerationDate?: boolean;
  accentColour?: string;
  imageLayout?: 'auto' | '1per' | '2per' | 'grid';
  orientation?: 'auto' | 'portrait' | 'landscape';
  reportType?: string;
}

export interface DailyRow {
  date: string;
  dayName: string;
  isWorkingDay: boolean;
  scheduledHours: number;
  absenceHours: number;
  availableHours: number;
  recordedHours: number;
  billedHours: number;
  openHours: number;
  recordedEfficiency: number;
  billedEfficiency: number;
  totalJobs: number;
  billedJobs: number;
  openJobs: number;
}

export interface VehicleHistoryData {
  registration: string;
  totalJobs: number;
  firstVisit: string;
  lastVisit: string;
  recordedAW: number;
  recordedHours: number;
  billedAW: number;
  billedHours: number;
  openAW: number;
  openHours: number;
  jobs: { job: any; billing: any }[];
}

export interface VHCData {
  totalJobs: number;
  jobsWithVHC: number;
  jobsWithoutVHC: number;
  completionRate: number;
  greenItems: number;
  amberItems: number;
  redItems: number;
  totalItems: number;
  avgItemsPerJob: number;
}

export interface ComparisonData {
  periodALabel: string;
  periodBLabel: string;
  periodA: BillingPosition & { availableHours: number; recordedEfficiency: number; billedEfficiency: number };
  periodB: BillingPosition & { availableHours: number; recordedEfficiency: number; billedEfficiency: number };
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
  // Extended fields
  schedule?: any;
  absences?: any[];
  dailyRows?: DailyRow[];
  vehicleHistory?: VehicleHistoryData | null;
  vhcData?: VHCData | null;
  comparisonData?: ComparisonData | null;
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
    technicianName: '',
    showTechnicianName: true,
    showCreatedBy: true,
    showGenerationDate: true,
    accentColour: '',
    imageLayout: 'auto',
    orientation: 'portrait',
    reportType: 'custom',
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

  // Build billed/open job pairs
  const byJobId = new Map(billingRecords.map((r: any) => [r.jobId, r]));
  const billedJobs: { job: any; billing: any }[] = [];
  const openJobs: { job: any; billing: any }[] = [];

  const startStr = bounds.start.toISOString().split('T')[0];
  const endStr = bounds.end.toISOString().split('T')[0];

  for (const job of jobs) {
    const rec = byJobId.get(job.id);
    if (!rec) continue;
    const jobDate = job.createdAt.split('T')[0];
    if (jobDate < startStr || jobDate > endStr) continue;
    const status = rec.billingStatus === 'billed' || rec.billingStatus === 'legacy_unknown' ? 'billed' : 'open';
    if (status === 'billed') billedJobs.push({ job, billing: rec });
    else openJobs.push({ job, billing: rec });
  }

  // Build daily rows
  const dailyRows: DailyRow[] = [];
  let availableHours = 0;

  if (schedule) {
    const cursor = new Date(bounds.start);
    while (cursor <= bounds.end) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dayName = cursor.toLocaleDateString('en-GB', { weekday: 'short' });
      const absence = absences.find((a: any) => a.absenceDate === dateStr);
      const scheduledHrs = getNetScheduledHoursForDate(schedule, cursor);
      const absenceHrs = absence ? (absence.absenceHours ?? 0) : 0;
      const dayAvailable = Math.max(0, scheduledHrs - absenceHrs);
      availableHours += dayAvailable;

      const isWorking = isWorkingDay(schedule, cursor);

      // Jobs for this date
      const dayJobs = jobs.filter((j: any) => j.createdAt.split('T')[0] === dateStr);
      const dayBilledJobs = dayJobs.filter((j: any) => {
        const rec = byJobId.get(j.id);
        return rec && (rec.billingStatus === 'billed' || rec.billingStatus === 'legacy_unknown');
      });
      const dayOpenJobs = dayJobs.filter((j: any) => {
        const rec = byJobId.get(j.id);
        return rec && rec.billingStatus !== 'billed' && rec.billingStatus !== 'legacy_unknown';
      });

      const recHrs = dayJobs.reduce((sum: number, j: any) => sum + awToHours(j.aw ?? 0), 0);
      const billHrs = dayBilledJobs.reduce((sum: number, j: any) => {
        const rec = byJobId.get(j.id);
        return sum + (rec?.billedHours ?? 0);
      }, 0);
      const openHrs = dayOpenJobs.reduce((sum: number, j: any) => sum + awToHours(j.aw ?? 0), 0);

      const safeAvail = dayAvailable > 0 ? dayAvailable : 1;
      const recEff = dayAvailable > 0 ? (recHrs / safeAvail) * 100 : 0;
      const billEff = dayAvailable > 0 ? (billHrs / safeAvail) * 100 : 0;

      dailyRows.push({
        date: dateStr,
        dayName,
        isWorkingDay: isWorking,
        scheduledHours: scheduledHrs,
        absenceHours: absenceHrs,
        availableHours: dayAvailable,
        recordedHours: recHrs,
        billedHours: billHrs,
        openHours: openHrs,
        recordedEfficiency: recEff,
        billedEfficiency: billEff,
        totalJobs: dayJobs.length,
        billedJobs: dayBilledJobs.length,
        openJobs: dayOpenJobs.length,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    // No schedule — still calculate available hours from absences
    const cursor = new Date(bounds.start);
    while (cursor <= bounds.end) {
      const dateStr = cursor.toISOString().split('T')[0];
      const absence = absences.find((a: any) => a.absenceDate === dateStr);
      const absenceHrs = absence ? (absence.absenceHours ?? 0) : 0;
      availableHours += Math.max(0, 8 - absenceHrs); // default 8h day
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const safeAvailable = availableHours > 0 ? availableHours : 1;
  const recordedEfficiency = Math.min(200, (billing.recordedHours / safeAvailable) * 100);
  const billedEfficiency = Math.min(200, (billing.billedHours / safeAvailable) * 100);

  // VHC data
  const totalJobs = jobs.length;
  const jobsWithVHC = jobs.filter((j: any) => j.vhcStatus && j.vhcStatus !== 'NONE').length;
  const greenItems = jobs.filter((j: any) => j.vhcStatus === 'GREEN').length;
  const amberItems = jobs.filter((j: any) => j.vhcStatus === 'AMBER').length;
  const redItems = jobs.filter((j: any) => j.vhcStatus === 'RED').length;
  const totalItems = greenItems + amberItems + redItems;
  const vhcData: VHCData = {
    totalJobs,
    jobsWithVHC,
    jobsWithoutVHC: totalJobs - jobsWithVHC,
    completionRate: totalJobs > 0 ? (jobsWithVHC / totalJobs) * 100 : 0,
    greenItems,
    amberItems,
    redItems,
    totalItems,
    avgItemsPerJob: jobsWithVHC > 0 ? totalItems / jobsWithVHC : 0,
  };

  console.log('[reportEngine] Report data built — availableHours:', availableHours.toFixed(2), '| recEff:', recordedEfficiency.toFixed(1) + '%', '| billEff:', billedEfficiency.toFixed(1) + '%', '| dailyRows:', dailyRows.length);

  return {
    period: {
      label: bounds.label,
      start: startStr,
      end: endStr,
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
    appVersion: APP_VERSION,
    schedule,
    absences,
    dailyRows,
    vhcData,
    vehicleHistory: null,
    comparisonData: null,
  };
}

// ─── Theme CSS ────────────────────────────────────────────────────────────────

function getThemeCSS(theme: PDFTheme): string {
  const commonExtras = `
    .section-header { padding: 12px 16px; margin: 24px 0 12px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; margin-top: 12px; }
    .metric-card { border-radius: 10px; padding: 16px; text-align: center; }
    .efficiency-bar { height: 8px; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .efficiency-fill { height: 100%; border-radius: 4px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; margin-bottom: 20px; font-size: 11px; opacity: 0.5; }
    .page-footer { padding-top: 8px; margin-top: 40px; font-size: 11px; opacity: 0.4; display: flex; justify-content: space-between; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .avoid-break { page-break-inside: avoid; }
    .page-break { page-break-after: always; }
    .badge-green { background: #2e7d32; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge-amber { background: #e65100; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge-red { background: #c62828; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge-none { background: #555; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .age-high { color: #ef5350; font-weight: 700; }
    .age-med { color: #ffa726; font-weight: 600; }
    .age-low { color: inherit; }
    .row-highlight td { background: rgba(79,195,247,0.08) !important; }
  `;

  switch (theme) {
    case 'tech_times_glass':
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #888; } }
        body { background: #0a1628; color: #e8f4fd; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
        .card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px; margin: 16px 0; }
        .accent { color: #4fc3f7; }
        .accent-bg { background: #4fc3f7; }
        h1, h2, h3 { color: #4fc3f7; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(79,195,247,0.2); color: #4fc3f7; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #e8f4fd; }
        tr:hover td { background: rgba(255,255,255,0.04); }
        .cover { background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%); }
        .stat-value { color: #4fc3f7; font-size: 26px; font-weight: 700; }
        .stat-label { color: rgba(232,244,253,0.6); font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #2e7d32; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #c62828; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: rgba(232,244,253,0.4); font-size: 11px; text-align: center; margin-top: 40px; }
        .section-header { background: linear-gradient(90deg, rgba(79,195,247,0.2), transparent); padding: 12px 16px; border-left: 3px solid #4fc3f7; margin: 24px 0 12px; }
        .metric-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(79,195,247,0.2); }
        .efficiency-bar { background: rgba(255,255,255,0.1); }
        .efficiency-fill { background: linear-gradient(90deg, #4fc3f7, #81d4fa); }
        .page-header { border-bottom: 1px solid rgba(79,195,247,0.2); }
        .page-footer { border-top: 1px solid rgba(79,195,247,0.15); }
        ${commonExtras}
      `;
    case 'midnight_performance':
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #555; } }
        body { background: #000; color: #e0e0e0; font-family: 'Courier New', monospace; }
        .card { background: #111; border: 1px solid #00e5ff; border-radius: 4px; padding: 20px; margin: 16px 0; }
        .accent { color: #00e5ff; }
        .accent-bg { background: #00e5ff; }
        h1, h2, h3 { color: #00e5ff; text-transform: uppercase; letter-spacing: 2px; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #00e5ff; color: #000; padding: 10px 8px; text-align: left; font-size: 12px; font-weight: 700; }
        td { padding: 8px; border-bottom: 1px solid #222; font-size: 12px; }
        .stat-value { color: #00e5ff; font-size: 26px; font-weight: 700; }
        .stat-label { color: #666; font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #00e5ff; color: #000; padding: 2px 8px; border-radius: 2px; font-size: 11px; font-weight: 700; }
        .badge-open { background: #ff1744; color: #fff; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: #444; font-size: 11px; text-align: center; margin-top: 40px; }
        .section-header { background: rgba(0,229,255,0.08); padding: 12px 16px; border-left: 3px solid #00e5ff; margin: 24px 0 12px; }
        .metric-card { background: #111; border: 1px solid #00e5ff; }
        .efficiency-bar { background: #222; }
        .efficiency-fill { background: linear-gradient(90deg, #00e5ff, #80deea); }
        .page-header { border-bottom: 1px solid #00e5ff; }
        .page-footer { border-top: 1px solid #222; }
        ${commonExtras}
      `;
    case 'carbon_workshop':
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #666; } }
        body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, Arial, sans-serif; }
        .card { background: #242424; border: 1px solid #333; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #ff6b35; }
        .accent { color: #ff6b35; }
        .accent-bg { background: #ff6b35; }
        h1, h2, h3 { color: #ff6b35; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #ff6b35; color: #fff; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #333; font-size: 12px; }
        .stat-value { color: #ff6b35; font-size: 26px; font-weight: 700; }
        .stat-label { color: #888; font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #2e7d32; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #ff6b35; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: #555; font-size: 11px; text-align: center; margin-top: 40px; }
        .section-header { background: rgba(255,107,53,0.1); padding: 12px 16px; border-left: 3px solid #ff6b35; margin: 24px 0 12px; }
        .metric-card { background: #2a2a2a; border: 1px solid #444; }
        .efficiency-bar { background: #333; }
        .efficiency-fill { background: linear-gradient(90deg, #ff6b35, #ffab76); }
        .page-header { border-bottom: 1px solid #333; }
        .page-footer { border-top: 1px solid #333; }
        ${commonExtras}
      `;
    case 'blueprint_technical':
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #64b5f6; } }
        body { background: #0d1b2a; color: #b0c4de; font-family: 'Courier New', monospace; }
        .card { background: rgba(100,181,246,0.05); border: 1px solid rgba(100,181,246,0.3); border-radius: 4px; padding: 20px; margin: 16px 0; }
        .accent { color: #64b5f6; }
        .accent-bg { background: #64b5f6; }
        h1, h2, h3 { color: #64b5f6; font-family: 'Courier New', monospace; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(100,181,246,0.15); color: #64b5f6; padding: 10px 8px; text-align: left; font-size: 12px; border: 1px solid rgba(100,181,246,0.3); }
        td { padding: 8px; border: 1px solid rgba(100,181,246,0.1); font-size: 12px; }
        .stat-value { color: #64b5f6; font-size: 26px; font-weight: 700; }
        .stat-label { color: rgba(176,196,222,0.6); font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #1b5e20; color: #a5d6a7; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .badge-open { background: #b71c1c; color: #ef9a9a; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: rgba(176,196,222,0.3); font-size: 11px; text-align: center; margin-top: 40px; }
        .section-header { background: rgba(100,181,246,0.08); padding: 12px 16px; border-left: 3px solid #64b5f6; margin: 24px 0 12px; }
        .metric-card { background: rgba(100,181,246,0.05); border: 1px solid rgba(100,181,246,0.2); }
        .efficiency-bar { background: rgba(100,181,246,0.1); }
        .efficiency-fill { background: linear-gradient(90deg, #64b5f6, #90caf9); }
        .page-header { border-bottom: 1px solid rgba(100,181,246,0.2); }
        .page-footer { border-top: 1px solid rgba(100,181,246,0.15); }
        ${commonExtras}
      `;
    case 'executive_light':
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #5c6bc0; } }
        body { background: #fff; color: #1a237e; font-family: Georgia, 'Times New Roman', serif; }
        .card { background: #f8f9ff; border: 1px solid #c5cae9; border-radius: 8px; padding: 20px; margin: 16px 0; }
        .accent { color: #1a237e; }
        .accent-bg { background: #1a237e; }
        h1, h2, h3 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 6px; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a237e; color: #fff; padding: 10px 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #e8eaf6; font-size: 12px; color: #1a237e; }
        tr:nth-child(even) td { background: #f3f4ff; }
        .stat-value { color: #1a237e; font-size: 26px; font-weight: 700; }
        .stat-label { color: #5c6bc0; font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #1b5e20; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .badge-open { background: #b71c1c; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { color: #9fa8da; font-size: 11px; text-align: center; margin-top: 40px; border-top: 1px solid #c5cae9; padding-top: 16px; }
        .section-header { background: #f0f4ff; padding: 12px 16px; border-left: 3px solid #1a237e; margin: 24px 0 12px; }
        .metric-card { background: #f8f9ff; border: 1px solid #c5cae9; }
        .efficiency-bar { background: #e8eaf6; }
        .efficiency-fill { background: linear-gradient(90deg, #1a237e, #3949ab); }
        .page-header { border-bottom: 1px solid #c5cae9; }
        .page-footer { border-top: 1px solid #c5cae9; }
        ${commonExtras}
      `;
    case 'minimal_print':
    default:
      return `
        @page { margin: 15mm; size: A4 portrait; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #888; } }
        body { background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
        .card { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin: 12px 0; }
        .accent { color: #000; }
        .accent-bg { background: #000; }
        h1, h2, h3 { color: #000; border-bottom: 1px solid #000; padding-bottom: 4px; }
        h2 { font-size: 18px; margin-bottom: 12px; }
        h3 { font-size: 15px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f5f5; color: #000; padding: 8px; text-align: left; font-size: 12px; border: 1px solid #ddd; }
        td { padding: 7px 8px; border: 1px solid #ddd; font-size: 12px; }
        .stat-value { color: #000; font-size: 24px; font-weight: 700; }
        .stat-label { color: #555; font-size: 11px; margin-top: 4px; }
        .badge-billed { background: #000; color: #fff; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .badge-open { background: #fff; color: #000; border: 1px solid #000; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
        .footer { color: #888; font-size: 11px; text-align: center; margin-top: 40px; }
        .section-header { background: #f5f5f5; padding: 12px 16px; border-left: 3px solid #000; margin: 24px 0 12px; }
        .metric-card { background: #fafafa; border: 1px solid #ddd; }
        .efficiency-bar { background: #eee; }
        .efficiency-fill { background: #000; }
        .page-header { border-bottom: 1px solid #ddd; }
        .page-footer { border-top: 1px solid #ddd; }
        ${commonExtras}
      `;
  }
}

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function wrapHTML(title: string, theme: PDFTheme, body: string): string {
  const css = getThemeCSS(theme);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ${css}
    body { padding: 0; font-size: 13px; line-height: 1.5; }
    h1 { font-size: 28px; margin-bottom: 8px; }
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
${body}
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statBox(label: string, value: string): string {
  return `<div class="stat-box">
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function metricCard(label: string, value: string): string {
  return `<div class="metric-card avoid-break">
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function efficiencyCard(label: string, value: number): string {
  const pct = Math.min(value, 100);
  const display = (value || 0).toFixed(0);
  return `<div class="metric-card avoid-break">
    <div class="stat-value">${display}%</div>
    <div class="stat-label">${label}</div>
    <div class="efficiency-bar">
      <div class="efficiency-fill" style="width: ${pct}%;"></div>
    </div>
  </div>`;
}

function vhcBadge(status: string): string {
  const s = (status ?? 'NONE').toUpperCase();
  if (s === 'GREEN') return `<span class="badge-green">GREEN</span>`;
  if (s === 'AMBER') return `<span class="badge-amber">AMBER</span>`;
  if (s === 'RED') return `<span class="badge-red">RED</span>`;
  return `<span class="badge-none">NONE</span>`;
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function reportTypeLabel(reportType?: string): string {
  const map: Record<string, string> = {
    daily_performance: 'Daily Performance Report',
    weekly_performance: 'Weekly Performance Report',
    monthly_performance: 'Monthly Performance Report',
    yearly_performance: 'Yearly Performance Report',
    billing: 'Billing & Job Closure Report',
    open_jobs: 'Open Jobs Report',
    job_record: 'Job Record',
    vehicle_history: 'Vehicle History Report',
    technical_evidence: 'Technical Evidence Pack',
    vhc: 'VHC Report',
    period_comparison: 'Period Comparison Report',
    data_audit: 'Data Audit / Reconciliation',
    custom: 'Custom Report',
  };
  return map[reportType ?? 'custom'] ?? 'Performance Report';
}

// ─── PDF HTML generator ───────────────────────────────────────────────────────

export function generatePDFHTML(data: ReportData, options: ReportOptions): string {
  console.log('[reportEngine] generatePDFHTML — theme:', options.theme, '| period:', data.period.label, '| reportType:', options.reportType);

  const { billing } = data;
  const safeAvailable = data.availableHours > 0 ? data.availableHours : 1;
  const genDate = new Date(data.generatedAt).toLocaleString('en-GB');
  const rptLabel = reportTypeLabel(options.reportType);

  const sections: string[] = [];

  // ── Page header ─────────────────────────────────────────────────────────────
  const pageHeader = `
    <div class="page-header">
      <span>TECH TIMES</span>
      <span>${rptLabel} — ${data.period.label}</span>
      ${options.showGenerationDate !== false ? `<span>${genDate}</span>` : '<span></span>'}
    </div>
  `;
  sections.push(pageHeader);

  // ── Cover Page ──────────────────────────────────────────────────────────────
  if (options.coverPage) {
    const techLine = options.showTechnicianName && options.technicianName
      ? `<div style="margin-top: 32px; font-size: 14px; opacity: 0.6;">Prepared for: ${options.technicianName}</div>`
      : '';
    const genLine = options.showGenerationDate !== false
      ? `<div style="font-size: 12px; margin-top: 8px; opacity: 0.4;">Generated: ${genDate}</div>`
      : '';
    sections.push(`
      <div class="cover" style="min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 40px;">
        <div style="font-size: 52px; font-weight: 900; letter-spacing: 6px;" class="accent">TECH TIMES</div>
        <div style="font-size: 13px; margin-top: 6px; opacity: 0.5; letter-spacing: 2px;">TECHNICIAN PERFORMANCE SYSTEM</div>
        <div style="width: 60px; height: 3px; margin: 24px auto;" class="accent-bg"></div>
        <div style="font-size: 26px; font-weight: 700; margin-top: 8px;">${rptLabel}</div>
        <div style="font-size: 18px; margin-top: 8px; opacity: 0.8;">${data.period.label}</div>
        <div style="font-size: 13px; margin-top: 6px; opacity: 0.5;">${data.period.start} — ${data.period.end}</div>
        ${techLine}
        ${genLine}
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.3;">Tech Times v${data.appVersion}</div>
      </div>
      <div class="page-break"></div>
    `);
  }

  // ── Executive Summary ───────────────────────────────────────────────────────
  if (options.includeSections.summary) {
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>Executive Summary</h2></div>
        <div class="metric-grid">
          ${metricCard('Recorded Hours', (safeNum(billing.recordedHours) || 0).toFixed(1) + 'h')}
          ${metricCard('Billed Hours', (safeNum(billing.billedHours) || 0).toFixed(1) + 'h')}
          ${metricCard('Open Hours', (safeNum(billing.openHours) || 0).toFixed(1) + 'h')}
          ${metricCard('Available Hours', (safeNum(data.availableHours) || 0).toFixed(1) + 'h')}
          ${metricCard('Recorded AW', String(safeNum(billing.recordedAW)))}
          ${metricCard('Billed AW', String(safeNum(billing.billedAW)))}
          ${metricCard('Open AW', String(safeNum(billing.openAW)))}
          ${metricCard('Billing Gap', (safeNum(billing.billingGap) || 0).toFixed(1) + 'h')}
          ${efficiencyCard('Rec. Efficiency', safeNum(data.recordedEfficiency))}
          ${efficiencyCard('Billed Efficiency', safeNum(data.billedEfficiency))}
          ${metricCard('Billing Conversion', (safeNum(billing.billingConversion) || 0).toFixed(0) + '%')}
          ${metricCard('Closure Rate', (safeNum(billing.closureRate) || 0).toFixed(0) + '%')}
          ${metricCard('Total Jobs', String(safeNum(billing.totalJobs)))}
          ${metricCard('Jobs Billed', String(safeNum(billing.billedJobs)))}
          ${metricCard('Jobs Open', String(safeNum(billing.openJobs)))}
        </div>
      </div>
    `);
  }

  // ── Availability Breakdown ──────────────────────────────────────────────────
  if (options.includeSections.availability) {
    const dailyRows = data.dailyRows ?? [];
    const workingDays = dailyRows.filter(r => r.isWorkingDay).length;
    const totalScheduled = dailyRows.reduce((s, r) => s + r.scheduledHours, 0);
    const totalAbsence = dailyRows.reduce((s, r) => s + r.absenceHours, 0);

    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>Availability Breakdown</h2></div>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Period</td><td>${data.period.label}</td></tr>
            <tr><td>Working Days in Period</td><td>${workingDays}</td></tr>
            <tr><td>Net Scheduled Hours</td><td>${totalScheduled.toFixed(2)}h</td></tr>
            <tr><td>Total Absence Hours</td><td>${totalAbsence.toFixed(2)}h</td></tr>
            <tr><td>Adjusted Available Hours</td><td>${data.availableHours.toFixed(2)}h</td></tr>
            <tr><td>Recorded Hours</td><td>${(safeNum(billing.recordedHours) || 0).toFixed(2)}h</td></tr>
            <tr><td>Billed Hours</td><td>${(safeNum(billing.billedHours) || 0).toFixed(2)}h</td></tr>
            <tr><td>Open Hours</td><td>${(safeNum(billing.openHours) || 0).toFixed(2)}h</td></tr>
            <tr><td>Recorded Efficiency</td><td>${(safeNum(data.recordedEfficiency) || 0).toFixed(1)}%</td></tr>
            <tr><td>Billed Efficiency</td><td>${(safeNum(data.billedEfficiency) || 0).toFixed(1)}%</td></tr>
          </tbody>
        </table>
      </div>
    `);
  }

  // ── Daily Performance Table ─────────────────────────────────────────────────
  if (options.includeSections.dailyPerformance && data.dailyRows && options.detailLevel !== 'summary') {
    const visibleRows = data.dailyRows.filter(r => r.isWorkingDay || r.totalJobs > 0);
    if (visibleRows.length > 0) {
      const rows = visibleRows.map(r => {
        const highlight = r.recordedEfficiency >= 100 ? ' class="row-highlight"' : '';
        return `<tr${highlight}>
          <td>${r.date}</td>
          <td>${r.dayName}</td>
          <td>${(r.availableHours || 0).toFixed(1)}h</td>
          <td>${(r.recordedHours || 0).toFixed(1)}h</td>
          <td>${(r.billedHours || 0).toFixed(1)}h</td>
          <td>${(r.openHours || 0).toFixed(1)}h</td>
          <td>${(r.recordedEfficiency || 0).toFixed(0)}%</td>
          <td>${(r.billedEfficiency || 0).toFixed(0)}%</td>
          <td>${r.totalJobs}</td>
          <td>${r.billedJobs}</td>
          <td>${r.openJobs}</td>
        </tr>`;
      }).join('');

      sections.push(`
        <div class="card">
          <div class="section-header"><h2>Daily Performance</h2></div>
          <table>
            <thead><tr>
              <th>Date</th><th>Day</th><th>Avail Hrs</th><th>Rec Hrs</th><th>Bill Hrs</th><th>Open Hrs</th>
              <th>Rec Eff%</th><th>Bill Eff%</th><th>Jobs</th><th>Closed</th><th>Open</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `);
    }
  }

  // ── Closed/Billed Jobs Table ────────────────────────────────────────────────
  if (options.includeSections.billedJobsTable && data.billedJobs.length > 0) {
    const totalBilledHrs = data.billedJobs.reduce((s, { billing: rec }) => s + safeNum(rec?.billedHours), 0);
    const totalBilledAW = data.billedJobs.reduce((s, { billing: rec }) => s + safeNum(rec?.billedAW), 0);

    const rows = data.billedJobs.map(({ job, billing: rec }) => {
      const workDate = job.createdAt ? job.createdAt.split('T')[0] : '—';
      const billedDate = rec?.billedDate ?? '—';
      const closureDelay = rec?.billedDate
        ? Math.round((new Date(rec.billedDate).getTime() - new Date(workDate).getTime()) / 86400000)
        : null;
      const delayStr = closureDelay === null ? '—' : closureDelay === 0 ? 'Same day' : `${closureDelay}d`;
      const recAW = safeNum(job.aw);
      const recHrs = awToHours(recAW).toFixed(2);
      const billAW = safeNum(rec?.billedAW);
      const billHrs = safeNum(rec?.billedHours).toFixed(2);
      const notes = options.detailLevel === 'full' ? (job.notes ?? '') : truncate(job.notes ?? '', 80);
      return `<tr>
        <td>${workDate}</td>
        <td>${job.wipNumber ?? '—'}</td>
        <td>${job.vehicleReg ?? '—'}</td>
        <td>${recAW}</td>
        <td>${recHrs}h</td>
        <td>${billAW}</td>
        <td>${billHrs}h</td>
        <td>${billedDate}</td>
        <td>${delayStr}</td>
        <td>${vhcBadge(job.vhcStatus)}</td>
        <td style="max-width:160px; word-break:break-word;">${notes}</td>
      </tr>`;
    }).join('');

    sections.push(`
      <div class="card">
        <div class="section-header"><h2>Closed / Billed Jobs (${data.billedJobs.length})</h2></div>
        <div style="display:flex; gap:24px; margin-bottom:12px; flex-wrap:wrap;">
          <span>Closed Jobs: <strong>${data.billedJobs.length}</strong></span>
          <span>Billed Hours: <strong>${totalBilledHrs.toFixed(1)}h</strong></span>
          <span>Billed AW: <strong>${totalBilledAW}</strong></span>
          <span>Closure Rate: <strong>${(safeNum(billing.closureRate) || 0).toFixed(1)}%</strong></span>
        </div>
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
    const ages = data.openJobs.map(({ job }) => {
      const workDate = job.createdAt ? job.createdAt.split('T')[0] : '';
      return workDate ? Math.round((today.getTime() - new Date(workDate).getTime()) / 86400000) : 0;
    });
    const oldestAge = ages.length > 0 ? Math.max(...ages) : 0;
    const totalOpenHrs = data.openJobs.reduce((s, { job }) => s + awToHours(safeNum(job.aw)), 0);
    const totalOpenAW = data.openJobs.reduce((s, { job }) => s + safeNum(job.aw), 0);

    const rows = data.openJobs.map(({ job }, i) => {
      const workDate = job.createdAt ? job.createdAt.split('T')[0] : '—';
      const jobAge = ages[i];
      const ageClass = jobAge > 7 ? 'age-high' : jobAge > 3 ? 'age-med' : 'age-low';
      const priority = jobAge > 7 ? 'HIGH' : jobAge > 3 ? 'MED' : 'LOW';
      const currAW = safeNum(job.aw);
      const currHrs = awToHours(currAW).toFixed(2);
      const notes = options.detailLevel === 'full' ? (job.notes ?? '') : truncate(job.notes ?? '', 80);
      return `<tr>
        <td>${workDate}</td>
        <td>${job.wipNumber ?? '—'}</td>
        <td>${job.vehicleReg ?? '—'}</td>
        <td>${currAW}</td>
        <td>${currHrs}h</td>
        <td class="${ageClass}">${jobAge}d</td>
        <td>${vhcBadge(job.vhcStatus)}</td>
        <td class="${ageClass}">${priority}</td>
        <td style="max-width:160px; word-break:break-word;">${notes}</td>
      </tr>`;
    }).join('');

    sections.push(`
      <div class="card">
        <div class="section-header"><h2>Open Jobs (${data.openJobs.length})</h2></div>
        <div style="display:flex; gap:24px; margin-bottom:12px; flex-wrap:wrap;">
          <span>Open Jobs: <strong>${data.openJobs.length}</strong></span>
          <span>Open Hours: <strong>${totalOpenHrs.toFixed(1)}h</strong></span>
          <span>Open AW: <strong>${totalOpenAW}</strong></span>
          <span>Oldest: <strong>${oldestAge} days</strong></span>
        </div>
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
    const potentialOnClosure = safeAvailable > 0
      ? ((safeNum(billing.openHours) + safeNum(billing.billedHours)) / safeAvailable) * 100
      : 0;

    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>Billing &amp; Job Closure Summary</h2></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
          <div>
            <h3>Hours Metrics</h3>
            <table>
              <tr><td>Recorded Hours</td><td><strong>${(safeNum(billing.recordedHours) || 0).toFixed(2)}h</strong></td></tr>
              <tr><td>Billed Hours</td><td><strong>${(safeNum(billing.billedHours) || 0).toFixed(2)}h</strong></td></tr>
              <tr><td>Open Hours</td><td><strong>${(safeNum(billing.openHours) || 0).toFixed(2)}h</strong></td></tr>
              <tr><td>Available Hours</td><td><strong>${data.availableHours.toFixed(2)}h</strong></td></tr>
              <tr><td>Recorded Efficiency</td><td><strong>${(safeNum(data.recordedEfficiency) || 0).toFixed(1)}%</strong></td></tr>
              <tr><td>Billed Efficiency</td><td><strong>${(safeNum(data.billedEfficiency) || 0).toFixed(1)}%</strong></td></tr>
              <tr><td>Potential on Closure</td><td><strong>${potentialOnClosure.toFixed(1)}%</strong></td></tr>
            </table>
          </div>
          <div>
            <h3>Job Metrics</h3>
            <table>
              <tr><td>Total Jobs</td><td><strong>${safeNum(billing.totalJobs)}</strong></td></tr>
              <tr><td>Jobs Billed</td><td><strong>${safeNum(billing.billedJobs)}</strong></td></tr>
              <tr><td>Jobs Open</td><td><strong>${safeNum(billing.openJobs)}</strong></td></tr>
              <tr><td>Recorded AW</td><td><strong>${safeNum(billing.recordedAW)}</strong></td></tr>
              <tr><td>Billed AW</td><td><strong>${safeNum(billing.billedAW)}</strong></td></tr>
              <tr><td>Billing Conversion</td><td><strong>${(safeNum(billing.billingConversion) || 0).toFixed(1)}%</strong></td></tr>
              <tr><td>Closure Rate</td><td><strong>${(safeNum(billing.closureRate) || 0).toFixed(1)}%</strong></td></tr>
              <tr><td>Billing Gap</td><td><strong>${(safeNum(billing.billingGap) || 0).toFixed(2)}h</strong></td></tr>
            </table>
          </div>
        </div>
      </div>
    `);
  }

  // ── VHC Summary ─────────────────────────────────────────────────────────────
  if (options.includeSections.vhcSummary && data.vhcData) {
    const v = data.vhcData;
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>VHC Summary</h2></div>
        <div class="metric-grid">
          ${metricCard('Total Jobs', String(v.totalJobs))}
          ${metricCard('Jobs with VHC', String(v.jobsWithVHC))}
          ${metricCard('Jobs without VHC', String(v.jobsWithoutVHC))}
          ${efficiencyCard('Completion Rate', v.completionRate)}
          ${metricCard('Green Items', String(v.greenItems))}
          ${metricCard('Amber Items', String(v.amberItems))}
          ${metricCard('Red Items', String(v.redItems))}
          ${metricCard('Total Items', String(v.totalItems))}
          ${metricCard('Avg Items/Job', (v.avgItemsPerJob || 0).toFixed(1))}
        </div>
      </div>
    `);
  }

  // ── Signature Section ───────────────────────────────────────────────────────
  if (options.signatureSection) {
    sections.push(`
      <div class="avoid-break" style="margin-top: 40px; page-break-before: always;">
        <h2>Signatures</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px;">
          <div>
            <div style="font-weight: 600; margin-bottom: 8px;">PREPARED BY</div>
            <div style="border-bottom: 1px solid currentColor; height: 50px; margin-bottom: 8px;"></div>
            <div style="font-size: 12px; opacity: 0.6;">Name: ___________________</div>
            <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">Date: ___________________</div>
          </div>
          <div>
            <div style="font-weight: 600; margin-bottom: 8px;">REVIEWED BY</div>
            <div style="border-bottom: 1px solid currentColor; height: 50px; margin-bottom: 8px;"></div>
            <div style="font-size: 12px; opacity: 0.6;">Name: ___________________</div>
            <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">Date: ___________________</div>
          </div>
        </div>
      </div>
    `);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const createdBy = options.showCreatedBy !== false ? '<span>Created by BNR</span>' : '';
  const genDateSpan = options.showGenerationDate !== false ? `<span>Generated ${genDate}</span>` : '';
  sections.push(`
    <div class="page-footer">
      ${createdBy}
      ${genDateSpan}
      <span>Tech Times v${data.appVersion}</span>
    </div>
  `);

  return wrapHTML(`Tech Times Report — ${data.period.label}`, options.theme, sections.join('\n'));
}

// ─── Technical Evidence Pack ──────────────────────────────────────────────────

export async function generateTechnicalEvidencePackHTML(
  job: any,
  billing: any | null,
  technicalCase: any | null,
  options: { theme: PDFTheme; includeImages: boolean }
): Promise<string> {
  console.log('[reportEngine] generateTechnicalEvidencePackHTML — job:', job?.wipNumber, '| theme:', options.theme);

  const workDate = job?.createdAt?.split('T')[0] ?? '—';
  const billedDate = billing?.billedDate ?? '—';
  const recAW = safeNum(job?.aw);
  const recHrs = awToHours(recAW).toFixed(2);
  const billAW = safeNum(billing?.billedAW);
  const billHrs = safeNum(billing?.billedHours).toFixed(2);
  const genDate = new Date().toLocaleString('en-GB');

  const sections: string[] = [];

  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Technical Evidence Pack</div>
      <div style="margin-top: 24px; font-size: 14px; opacity: 0.7;">WIP: ${job?.wipNumber ?? '—'}</div>
      <div style="font-size: 14px; opacity: 0.7;">Registration: ${job?.vehicleReg ?? '—'}</div>
      <div style="font-size: 14px; opacity: 0.7;">Work Date: ${workDate}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
  `);

  sections.push(`
    <div class="card">
      <h2>Job Information &amp; Complaint</h2>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>WIP Number</td><td>${job?.wipNumber ?? '—'}</td></tr>
          <tr><td>Vehicle Registration</td><td>${job?.vehicleReg ?? '—'}</td></tr>
          <tr><td>Work Date</td><td>${workDate}</td></tr>
          <tr><td>Recorded AW</td><td>${recAW}</td></tr>
          <tr><td>Recorded Hours</td><td>${recHrs}h</td></tr>
          <tr><td>VHC Status</td><td>${vhcBadge(job?.vhcStatus)}</td></tr>
          <tr><td>Billing Status</td><td>${billing?.billingStatus ?? 'open'}</td></tr>
          <tr><td>Billed AW</td><td>${billAW}</td></tr>
          <tr><td>Billed Hours</td><td>${billHrs}h</td></tr>
          <tr><td>Billed Date</td><td>${billedDate}</td></tr>
        </tbody>
      </table>
      ${job?.notes ? `<div style="margin-top: 16px; white-space: pre-wrap;"><strong>Notes:</strong><br>${job.notes}</div>` : ''}
    </div>
  `);

  sections.push(`
    <div class="card">
      <h2>Diagnostic Findings</h2>
      ${technicalCase?.diagnosticFindings
        ? `<p style="white-space: pre-wrap;">${technicalCase.diagnosticFindings}</p>`
        : '<p style="opacity:0.5;">No diagnostic findings recorded.</p>'}
    </div>
  `);

  sections.push(`
    <div class="card">
      <h2>Tests / Measurements / Diagnosis</h2>
      ${technicalCase?.measurements
        ? `<p style="white-space: pre-wrap;">${technicalCase.measurements}</p>`
        : '<p style="opacity:0.5;">No measurements recorded.</p>'}
    </div>
  `);

  sections.push(`
    <div class="card">
      <h2>Repair / Action / Result</h2>
      ${technicalCase?.repairAction
        ? `<p style="white-space: pre-wrap;">${technicalCase.repairAction}</p>`
        : '<p style="opacity:0.5;">No repair action recorded.</p>'}
    </div>
  `);

  if (options.includeImages && job?.imageUri) {
    sections.push(`
      <div class="card">
        <h2>Photographic Evidence</h2>
        <img src="${job.imageUri}" style="max-width: 100%; border-radius: 8px; margin-top: 12px;" />
      </div>
    `);
  }

  sections.push(`<div class="footer">Tech Times · Technical Evidence Pack · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`Technical Evidence Pack — ${job?.wipNumber ?? 'Unknown'}`, options.theme, sections.join('\n'));
}

// ─── Job Record HTML ──────────────────────────────────────────────────────────

export function generateJobRecordHTML(
  job: any,
  billing: any | null,
  options: { theme: PDFTheme; detailLevel: DetailLevel; includeImages: boolean; showTechnicianName?: boolean; technicianName?: string }
): string {
  console.log('[reportEngine] generateJobRecordHTML — job:', job?.wipNumber, '| theme:', options.theme);

  const workDate = job?.createdAt?.split('T')[0] ?? '—';
  const billedDate = billing?.billedDate ?? '—';
  const recAW = safeNum(job?.aw);
  const recHrs = awToHours(recAW).toFixed(2);
  const billAW = safeNum(billing?.billedAW);
  const billHrs = safeNum(billing?.billedHours).toFixed(2);
  const genDate = new Date().toLocaleString('en-GB');
  const isBilled = billing?.billingStatus === 'billed' || billing?.billingStatus === 'legacy_unknown';
  const closureDelay = billing?.billedDate
    ? Math.round((new Date(billing.billedDate).getTime() - new Date(workDate).getTime()) / 86400000)
    : null;
  const delayStr = closureDelay === null ? '—' : closureDelay === 0 ? 'Same day' : `${closureDelay}d`;

  const sections: string[] = [];

  // Cover
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Job Record</div>
      <div style="margin-top: 24px; font-size: 22px; font-weight: 700;">WIP: ${job?.wipNumber ?? '—'}</div>
      <div style="font-size: 18px; margin-top: 4px; opacity: 0.8;">${job?.vehicleReg ?? '—'}</div>
      <div style="font-size: 14px; margin-top: 8px; opacity: 0.6;">Work Date: ${workDate}</div>
      <div style="margin-top: 12px; display: flex; gap: 12px; justify-content: center;">
        ${isBilled ? '<span class="badge-billed">BILLED</span>' : '<span class="badge-open">OPEN</span>'}
        ${vhcBadge(job?.vhcStatus)}
      </div>
      ${options.showTechnicianName && options.technicianName ? `<div style="margin-top: 16px; font-size: 13px; opacity: 0.5;">Technician: ${options.technicianName}</div>` : ''}
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
    <div class="page-break"></div>
  `);

  // Job Information
  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>Job Information</h2></div>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>WIP Number</td><td>${job?.wipNumber ?? '—'}</td></tr>
          <tr><td>Vehicle Registration</td><td>${job?.vehicleReg ?? '—'}</td></tr>
          <tr><td>Work Date</td><td>${workDate}</td></tr>
          <tr><td>Recorded AW</td><td>${recAW}</td></tr>
          <tr><td>Recorded Hours</td><td>${recHrs}h</td></tr>
          <tr><td>VHC Status</td><td>${vhcBadge(job?.vhcStatus)}</td></tr>
          <tr><td>Job Status</td><td>${isBilled ? '<span class="badge-billed">BILLED</span>' : '<span class="badge-open">OPEN</span>'}</td></tr>
        </tbody>
      </table>
    </div>
  `);

  // Billing section
  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>Billing Details</h2></div>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Billing Status</td><td>${billing?.billingStatus ?? 'open'}</td></tr>
          <tr><td>Billed AW</td><td>${billAW}</td></tr>
          <tr><td>Billed Hours</td><td>${billHrs}h</td></tr>
          <tr><td>Billing Date</td><td>${billedDate}</td></tr>
          <tr><td>Closure Delay</td><td>${delayStr}</td></tr>
        </tbody>
      </table>
    </div>
  `);

  // Job Notes
  if (job?.notes) {
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>Job Notes</h2></div>
        <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${job.notes}</div>
      </div>
    `);
  }

  // VHC section
  if (job?.vhcStatus && job.vhcStatus !== 'NONE') {
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>VHC Status</h2></div>
        <div style="font-size: 16px; margin-top: 8px;">${vhcBadge(job.vhcStatus)}</div>
      </div>
    `);
  }

  // Images
  if (options.includeImages && job?.imageUri) {
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>Images</h2></div>
        <img src="${job.imageUri}" style="max-width: 100%; border-radius: 8px; margin-top: 12px;" />
      </div>
    `);
  }

  sections.push(`<div class="footer">Tech Times · Job Record · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`Job Record — ${job?.wipNumber ?? 'Unknown'}`, options.theme, sections.join('\n'));
}

// ─── Vehicle History HTML ─────────────────────────────────────────────────────

export function generateVehicleHistoryHTML(
  vehicleData: VehicleHistoryData,
  options: { theme: PDFTheme; detailLevel: DetailLevel }
): string {
  console.log('[reportEngine] generateVehicleHistoryHTML — reg:', vehicleData.registration, '| jobs:', vehicleData.totalJobs);

  const genDate = new Date().toLocaleString('en-GB');
  const sections: string[] = [];

  // Cover
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Vehicle History Report</div>
      <div style="font-size: 28px; font-weight: 900; margin-top: 24px;">${vehicleData.registration}</div>
      <div style="font-size: 14px; margin-top: 8px; opacity: 0.6;">Total Jobs: ${vehicleData.totalJobs}</div>
      <div style="font-size: 13px; margin-top: 4px; opacity: 0.5;">First Visit: ${vehicleData.firstVisit} · Last Visit: ${vehicleData.lastVisit}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
    <div class="page-break"></div>
  `);

  // Summary metrics
  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>Summary</h2></div>
      <div class="metric-grid">
        ${metricCard('Recorded AW', String(vehicleData.recordedAW))}
        ${metricCard('Recorded Hours', vehicleData.recordedHours.toFixed(1) + 'h')}
        ${metricCard('Billed AW', String(vehicleData.billedAW))}
        ${metricCard('Billed Hours', vehicleData.billedHours.toFixed(1) + 'h')}
        ${metricCard('Open AW', String(vehicleData.openAW))}
        ${metricCard('Open Hours', vehicleData.openHours.toFixed(1) + 'h')}
        ${metricCard('Total Jobs', String(vehicleData.totalJobs))}
      </div>
    </div>
  `);

  // Chronological job history
  if (vehicleData.jobs.length > 0) {
    const rows = vehicleData.jobs.map(({ job, billing: rec }) => {
      const workDate = job?.createdAt?.split('T')[0] ?? '—';
      const recAW = safeNum(job?.aw);
      const recHrs = awToHours(recAW).toFixed(2);
      const billAW = safeNum(rec?.billedAW);
      const billHrs = safeNum(rec?.billedHours).toFixed(2);
      const isBilled = rec?.billingStatus === 'billed' || rec?.billingStatus === 'legacy_unknown';
      const notes = options.detailLevel === 'full' ? (job?.notes ?? '') : truncate(job?.notes ?? '', 60);
      return `<tr>
        <td>${workDate}</td>
        <td>${job?.wipNumber ?? '—'}</td>
        <td>${recAW}</td>
        <td>${recHrs}h</td>
        <td>${billAW}</td>
        <td>${billHrs}h</td>
        <td>${isBilled ? '<span class="badge-billed">BILLED</span>' : '<span class="badge-open">OPEN</span>'}</td>
        <td>${vhcBadge(job?.vhcStatus)}</td>
        <td style="max-width:140px; word-break:break-word;">${notes}</td>
      </tr>`;
    }).join('');

    sections.push(`
      <div class="card">
        <div class="section-header"><h2>Job History</h2></div>
        <table>
          <thead><tr>
            <th>Date</th><th>WIP</th><th>Rec AW</th><th>Rec Hrs</th>
            <th>Bill AW</th><th>Bill Hrs</th><th>Status</th><th>VHC</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // VHC history
  const vhcJobs = vehicleData.jobs.filter(({ job }) => job?.vhcStatus && job.vhcStatus !== 'NONE');
  if (vhcJobs.length > 0) {
    const rows = vhcJobs.map(({ job }) => `<tr>
      <td>${job?.createdAt?.split('T')[0] ?? '—'}</td>
      <td>${job?.wipNumber ?? '—'}</td>
      <td>${vhcBadge(job?.vhcStatus)}</td>
    </tr>`).join('');

    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>VHC History</h2></div>
        <table>
          <thead><tr><th>Date</th><th>WIP</th><th>VHC Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  sections.push(`<div class="footer">Tech Times · Vehicle History · ${vehicleData.registration} · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`Vehicle History — ${vehicleData.registration}`, options.theme, sections.join('\n'));
}

// ─── VHC Report HTML ──────────────────────────────────────────────────────────

export function generateVHCReportHTML(
  data: ReportData,
  options: ReportOptions
): string {
  console.log('[reportEngine] generateVHCReportHTML — period:', data.period.label, '| theme:', options.theme);

  const genDate = new Date(data.generatedAt).toLocaleString('en-GB');
  const v = data.vhcData;
  const sections: string[] = [];

  // Cover
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">VHC Report</div>
      <div style="font-size: 18px; margin-top: 16px; opacity: 0.8;">${data.period.label}</div>
      <div style="font-size: 13px; margin-top: 4px; opacity: 0.5;">${data.period.start} — ${data.period.end}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
    <div class="page-break"></div>
  `);

  // Summary metrics
  if (v) {
    sections.push(`
      <div class="card avoid-break">
        <div class="section-header"><h2>VHC Summary</h2></div>
        <div class="metric-grid">
          ${metricCard('Total Jobs', String(v.totalJobs))}
          ${metricCard('Jobs with VHC', String(v.jobsWithVHC))}
          ${metricCard('Jobs without VHC', String(v.jobsWithoutVHC))}
          ${efficiencyCard('Completion Rate', v.completionRate)}
          ${metricCard('Green Items', String(v.greenItems))}
          ${metricCard('Amber Items', String(v.amberItems))}
          ${metricCard('Red Items', String(v.redItems))}
          ${metricCard('Total Items', String(v.totalItems))}
          ${metricCard('Avg Items/Job', (v.avgItemsPerJob || 0).toFixed(1))}
        </div>
      </div>
    `);
  }

  // Jobs with VHC
  const withVHC = data.jobs.filter((j: any) => j.vhcStatus && j.vhcStatus !== 'NONE');
  if (withVHC.length > 0) {
    const rows = withVHC.map((job: any) => `<tr>
      <td>${job.createdAt?.split('T')[0] ?? '—'}</td>
      <td>${job.wipNumber ?? '—'}</td>
      <td>${job.vehicleReg ?? '—'}</td>
      <td>${vhcBadge(job.vhcStatus)}</td>
      <td style="max-width:160px; word-break:break-word;">${truncate(job.notes ?? '', 80)}</td>
    </tr>`).join('');

    sections.push(`
      <div class="card">
        <div class="section-header"><h2>Jobs with VHC (${withVHC.length})</h2></div>
        <table>
          <thead><tr><th>Date</th><th>WIP</th><th>Reg</th><th>VHC Status</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  // Jobs without VHC
  const withoutVHC = data.jobs.filter((j: any) => !j.vhcStatus || j.vhcStatus === 'NONE');
  if (withoutVHC.length > 0) {
    const rows = withoutVHC.map((job: any) => `<tr>
      <td>${job.createdAt?.split('T')[0] ?? '—'}</td>
      <td>${job.wipNumber ?? '—'}</td>
      <td>${job.vehicleReg ?? '—'}</td>
    </tr>`).join('');

    sections.push(`
      <div class="card">
        <div class="section-header"><h2>Jobs without VHC (${withoutVHC.length})</h2></div>
        <table>
          <thead><tr><th>Date</th><th>WIP</th><th>Reg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  sections.push(`<div class="footer">Tech Times · VHC Report · ${data.period.label} · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`VHC Report — ${data.period.label}`, options.theme, sections.join('\n'));
}

// ─── Period Comparison HTML ───────────────────────────────────────────────────

export function generatePeriodComparisonHTML(
  data: ReportData,
  options: ReportOptions
): string {
  console.log('[reportEngine] generatePeriodComparisonHTML — period:', data.period.label, '| theme:', options.theme);

  const genDate = new Date(data.generatedAt).toLocaleString('en-GB');
  const { billing } = data;
  const sections: string[] = [];

  // Cover
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Period Comparison Report</div>
      <div style="font-size: 18px; margin-top: 16px; opacity: 0.8;">${data.period.label}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
    <div class="page-break"></div>
  `);

  // Note
  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>About This Report</h2></div>
      <p style="opacity: 0.7; line-height: 1.7;">
        Period comparison requires two separate data sets. This report shows current period data (Period A).
        Use the Custom Report Builder to generate reports for each period separately and compare them manually.
        Period B values are shown as N/A below.
      </p>
    </div>
  `);

  // Comparison table
  const metrics: { label: string; a: string; b: string }[] = [
    { label: 'Recorded Hours', a: (safeNum(billing.recordedHours) || 0).toFixed(2) + 'h', b: 'N/A' },
    { label: 'Billed Hours', a: (safeNum(billing.billedHours) || 0).toFixed(2) + 'h', b: 'N/A' },
    { label: 'Open Hours', a: (safeNum(billing.openHours) || 0).toFixed(2) + 'h', b: 'N/A' },
    { label: 'Available Hours', a: data.availableHours.toFixed(2) + 'h', b: 'N/A' },
    { label: 'Rec. Efficiency', a: (safeNum(data.recordedEfficiency) || 0).toFixed(1) + '%', b: 'N/A' },
    { label: 'Billed Efficiency', a: (safeNum(data.billedEfficiency) || 0).toFixed(1) + '%', b: 'N/A' },
    { label: 'Total Jobs', a: String(safeNum(billing.totalJobs)), b: 'N/A' },
    { label: 'Jobs Billed', a: String(safeNum(billing.billedJobs)), b: 'N/A' },
    { label: 'Jobs Open', a: String(safeNum(billing.openJobs)), b: 'N/A' },
    { label: 'Billing Conversion', a: (safeNum(billing.billingConversion) || 0).toFixed(1) + '%', b: 'N/A' },
    { label: 'Closure Rate', a: (safeNum(billing.closureRate) || 0).toFixed(1) + '%', b: 'N/A' },
    { label: 'Billing Gap', a: (safeNum(billing.billingGap) || 0).toFixed(2) + 'h', b: 'N/A' },
  ];

  const rows = metrics.map(m => `<tr>
    <td>${m.label}</td>
    <td><strong>${m.a}</strong></td>
    <td style="opacity:0.4;">${m.b}</td>
    <td style="opacity:0.4;">—</td>
    <td style="opacity:0.4;">—</td>
  </tr>`).join('');

  sections.push(`
    <div class="card">
      <div class="section-header"><h2>Comparison Table</h2></div>
      <table>
        <thead><tr>
          <th>Metric</th>
          <th>Period A (${data.period.label})</th>
          <th>Period B</th>
          <th>Difference</th>
          <th>% Change</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  sections.push(`<div class="footer">Tech Times · Period Comparison · ${data.period.label} · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`Period Comparison — ${data.period.label}`, options.theme, sections.join('\n'));
}

// ─── Data Audit HTML ──────────────────────────────────────────────────────────

export function generateDataAuditHTML(
  data: ReportData,
  options: ReportOptions
): string {
  console.log('[reportEngine] generateDataAuditHTML — period:', data.period.label, '| theme:', options.theme);

  const genDate = new Date(data.generatedAt).toLocaleString('en-GB');
  const { billing } = data;
  const sections: string[] = [];

  // Cover
  sections.push(`
    <div class="card" style="text-align:center; padding: 40px;">
      <div style="font-size: 36px; font-weight: 900;" class="accent">TECH TIMES</div>
      <div style="font-size: 18px; margin-top: 8px; font-weight: 700;">Data Audit / Reconciliation Report</div>
      <div style="font-size: 18px; margin-top: 16px; opacity: 0.8;">${data.period.label}</div>
      <div style="font-size: 13px; margin-top: 4px; opacity: 0.5;">${data.period.start} — ${data.period.end}</div>
      <div style="font-size: 12px; margin-top: 16px; opacity: 0.4;">Generated: ${genDate}</div>
    </div>
    <div class="page-break"></div>
  `);

  // Reconciliation summary
  const recHrs = safeNum(billing.recordedHours);
  const billHrs = safeNum(billing.billedHours);
  const openHrs = safeNum(billing.openHours);
  const sumBilledOpen = billHrs + openHrs;
  const diff = recHrs - sumBilledOpen;
  const reconciled = Math.abs(diff) < 0.01;

  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>Reconciliation Summary</h2></div>
      <table>
        <thead><tr><th>Check</th><th>Value</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Recorded Hours</td><td>${recHrs.toFixed(2)}h</td><td>—</td></tr>
          <tr><td>Billed Hours</td><td>${billHrs.toFixed(2)}h</td><td>—</td></tr>
          <tr><td>Open Hours</td><td>${openHrs.toFixed(2)}h</td><td>—</td></tr>
          <tr><td>Billed + Open</td><td>${sumBilledOpen.toFixed(2)}h</td><td>—</td></tr>
          <tr><td>Difference (Recorded − Billed − Open)</td><td>${diff.toFixed(2)}h</td>
            <td>${reconciled ? '<span class="badge-billed">OK</span>' : '<span class="badge-open">DISCREPANCY</span>'}</td></tr>
          <tr><td>Total Jobs</td><td>${safeNum(billing.totalJobs)}</td><td>—</td></tr>
          <tr><td>Jobs Billed + Open</td><td>${safeNum(billing.billedJobs) + safeNum(billing.openJobs)}</td><td>—</td></tr>
        </tbody>
      </table>
    </div>
  `);

  // Data quality notes
  const byJobId = new Map((data.billingRecords ?? []).map((r: any) => [r.jobId, r]));
  const jobsWithoutBilling = data.jobs.filter((j: any) => !byJobId.has(j.id));
  const zeroSnapshotBilled = data.billedJobs.filter(({ billing: rec }) => safeNum(rec?.billedAW) === 0 && safeNum(rec?.billedHours) === 0);

  sections.push(`
    <div class="card avoid-break">
      <div class="section-header"><h2>Data Quality Notes</h2></div>
      <table>
        <thead><tr><th>Issue</th><th>Count</th><th>Detail</th></tr></thead>
        <tbody>
          <tr>
            <td>Jobs without billing records</td>
            <td>${jobsWithoutBilling.length}</td>
            <td>${jobsWithoutBilling.length > 0 ? jobsWithoutBilling.slice(0, 5).map((j: any) => j.wipNumber ?? j.id).join(', ') + (jobsWithoutBilling.length > 5 ? '…' : '') : 'None'}</td>
          </tr>
          <tr>
            <td>Zero-snapshot billed jobs</td>
            <td>${zeroSnapshotBilled.length}</td>
            <td>${zeroSnapshotBilled.length > 0 ? zeroSnapshotBilled.slice(0, 5).map(({ job }) => job.wipNumber ?? job.id).join(', ') + (zeroSnapshotBilled.length > 5 ? '…' : '') : 'None'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `);

  sections.push(`<div class="footer">Tech Times · Data Audit · ${data.period.label} · ${new Date().toLocaleDateString('en-GB')}</div>`);

  return wrapHTML(`Data Audit — ${data.period.label}`, options.theme, sections.join('\n'));
}

// ─── PDF Filename ─────────────────────────────────────────────────────────────

export function getPDFFilename(
  reportType: string,
  period: { label: string; start: string; end: string },
  job?: { wipNumber?: string; vehicleReg?: string }
): string {
  console.log('[reportEngine] getPDFFilename — reportType:', reportType, '| period:', period.start);

  const sanitise = (s: string) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\-_]/g, '');
  const start = period.start ?? '';

  // Derive period suffix
  let suffix = sanitise(start);
  if (reportType === 'weekly_performance') {
    // Compute ISO week number
    const d = new Date(start);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    suffix = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  } else if (reportType === 'monthly_performance' || reportType === 'billing' || reportType === 'vhc' || reportType === 'period_comparison') {
    suffix = start.slice(0, 7); // YYYY-MM
  } else if (reportType === 'yearly_performance') {
    suffix = start.slice(0, 4); // YYYY
  }

  switch (reportType) {
    case 'daily_performance':
      return `TechTimes_Daily_${suffix}.pdf`;
    case 'weekly_performance':
      return `TechTimes_Weekly_${suffix}.pdf`;
    case 'monthly_performance':
      return `TechTimes_Monthly_${suffix}.pdf`;
    case 'yearly_performance':
      return `TechTimes_Yearly_${suffix}.pdf`;
    case 'billing':
      return `TechTimes_Billing_${suffix}.pdf`;
    case 'open_jobs':
      return `TechTimes_Open_Jobs_${sanitise(start)}.pdf`;
    case 'job_record': {
      const wip = sanitise(job?.wipNumber ?? 'Unknown');
      const reg = sanitise(job?.vehicleReg ?? 'Unknown');
      return `TechTimes_Job_${wip}_${reg}.pdf`;
    }
    case 'vehicle_history': {
      const reg = sanitise(job?.vehicleReg ?? 'Unknown');
      return `TechTimes_Vehicle_History_${reg}.pdf`;
    }
    case 'technical_evidence': {
      const wip = sanitise(job?.wipNumber ?? 'Unknown');
      const reg = sanitise(job?.vehicleReg ?? 'Unknown');
      return `TechTimes_Technical_Evidence_${wip}_${reg}.pdf`;
    }
    case 'vhc':
      return `TechTimes_VHC_${suffix}.pdf`;
    case 'period_comparison':
      return `TechTimes_Comparison_${suffix}.pdf`;
    case 'data_audit':
      return `TechTimes_Data_Audit_${sanitise(start)}.pdf`;
    default:
      return `TechTimes_Report_${sanitise(start)}.pdf`;
  }
}
