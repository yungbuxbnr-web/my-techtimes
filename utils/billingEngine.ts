
import { BillingRecord } from './billingStorage';
import { Job } from './offlineStorage';

export interface PeriodFilter {
  type: 'day' | 'week' | 'month' | 'year' | 'entire';
  date?: string; // ISO date string — reference date for the period
  viewBy?: 'work_date' | 'billing_date';
}

// ── AW to hours ───────────────────────────────────────────────────────────────

export function awToHours(aw: number): number {
  return (aw * 5) / 60;
}

// ── Status normalisation ──────────────────────────────────────────────────────

/**
 * Normalise a billing status to the simplified OPEN/BILLED model.
 *   billed          → 'billed'
 *   legacy_unknown  → 'billed'  (historical jobs = billed by default)
 *   ready_to_bill   → 'open'
 *   unbilled        → 'open'
 *   open            → 'open'
 *   anything else   → 'open'
 */
export function normaliseBillingStatus(status: string): 'open' | 'billed' {
  if (status === 'billed') return 'billed';
  if (status === 'legacy_unknown') return 'billed';
  return 'open';
}

// ── Period helpers ────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function getJobDate(
  job: Job,
  billing: BillingRecord | null,
  viewBy: 'work_date' | 'billing_date'
): string {
  if (viewBy === 'billing_date' && billing?.billedDate) {
    return billing.billedDate;
  }
  return job.createdAt.split('T')[0];
}

export function isInPeriod(
  job: Job,
  billing: BillingRecord | null,
  filter: PeriodFilter
): boolean {
  if (filter.type === 'entire') return true;

  const refDate = filter.date ? new Date(filter.date) : new Date();
  const viewBy = filter.viewBy ?? 'work_date';
  const dateStr = getJobDate(job, billing, viewBy);

  switch (filter.type) {
    case 'day': {
      const refStr = refDate.toISOString().split('T')[0];
      return dateStr === refStr;
    }
    case 'week': {
      const monday = getMonday(refDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const d = new Date(dateStr);
      return d >= monday && d <= sunday;
    }
    case 'month': {
      const refYM = refDate.toISOString().slice(0, 7);
      return dateStr.slice(0, 7) === refYM;
    }
    case 'year': {
      const refY = String(refDate.getFullYear());
      return dateStr.slice(0, 4) === refY;
    }
    default:
      return true;
  }
}

// ── Core selectors ────────────────────────────────────────────────────────────

export function getRecordedJobs(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): Job[] {
  const byJobId = new Map(billingRecords.map(r => [r.jobId, r]));
  return jobs.filter(job => {
    const billing = byJobId.get(job.id) ?? null;
    return isInPeriod(job, billing, filter);
  });
}

export function getBilledJobs(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): { job: Job; billing: BillingRecord }[] {
  const byJobId = new Map(billingRecords.map(r => [r.jobId, r]));
  const result: { job: Job; billing: BillingRecord }[] = [];
  for (const job of jobs) {
    const billing = byJobId.get(job.id);
    if (!billing) continue;
    if (normaliseBillingStatus(billing.billingStatus) !== 'billed') continue;
    if (!isInPeriod(job, billing, filter)) continue;
    result.push({ job, billing });
  }
  return result;
}

export function getOpenJobs(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): { job: Job; billing: BillingRecord }[] {
  const byJobId = new Map(billingRecords.map(r => [r.jobId, r]));
  const result: { job: Job; billing: BillingRecord }[] = [];
  for (const job of jobs) {
    const billing = byJobId.get(job.id);
    if (!billing) continue;
    if (normaliseBillingStatus(billing.billingStatus) !== 'open') continue;
    if (!isInPeriod(job, billing, filter)) continue;
    result.push({ job, billing });
  }
  return result;
}

// ── AW aggregators ────────────────────────────────────────────────────────────

export function getRecordedAW(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getRecordedJobs(jobs, billingRecords, filter).reduce((s, j) => s + j.aw, 0);
}

export function getBilledAW(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getBilledJobs(jobs, billingRecords, filter).reduce((s, { billing }) => s + billing.billedAW, 0);
}

export function getOpenAW(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getOpenJobs(jobs, billingRecords, filter).reduce((s, { job }) => s + job.aw, 0);
}

// ── Hours aggregators ─────────────────────────────────────────────────────────

/**
 * Recorded Hours = sum of (job.aw * 5 / 60) for ALL jobs in period.
 */
export function getRecordedHours(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getRecordedJobs(jobs, billingRecords, filter).reduce((s, j) => s + awToHours(j.aw), 0);
}

/**
 * Billed Hours = sum of billedHours from BillingRecord snapshots where normaliseBillingStatus = 'billed'.
 */
export function getBilledHours(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getBilledJobs(jobs, billingRecords, filter).reduce((s, { billing }) => s + billing.billedHours, 0);
}

/**
 * Open Hours = sum of (job.aw * 5 / 60) for jobs where normaliseBillingStatus = 'open'.
 */
export function getOpenHours(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): number {
  return getOpenJobs(jobs, billingRecords, filter).reduce((s, { job }) => s + awToHours(job.aw), 0);
}

// ── Derived metrics ───────────────────────────────────────────────────────────

/** Billing Conversion = billedHours / recordedHours × 100. Safe division. */
export function getBillingConversion(billedHours: number, recordedHours: number): number {
  if (!isFinite(recordedHours) || recordedHours <= 0) return 0;
  return (billedHours / recordedHours) * 100;
}

/** Closure Rate = billedJobs / totalJobs × 100. Safe division. */
export function getClosureRate(billedJobs: number, totalJobs: number): number {
  if (!isFinite(totalJobs) || totalJobs <= 0) return 0;
  return (billedJobs / totalJobs) * 100;
}

/** Billing Gap = recordedHours - billedHours. */
export function getBillingGap(recordedHours: number, billedHours: number): number {
  return recordedHours - billedHours;
}

// ── Period resolver ───────────────────────────────────────────────────────────

export type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'entire';

/**
 * Maps a PeriodMode to a PeriodFilter.
 * Uses referenceDate (defaults to today) as the anchor date.
 */
export function resolvePeriodFilter(
  mode: PeriodMode,
  referenceDate?: Date,
  viewBy?: 'work_date' | 'billing_date'
): PeriodFilter {
  const ref = referenceDate ?? new Date();
  const dateISO = ref.toISOString();
  const vb = viewBy ?? 'work_date';

  if (mode === 'entire') {
    return { type: 'entire', viewBy: vb };
  }
  return { type: mode, date: dateISO, viewBy: vb };
}

// ── Unified billing position ──────────────────────────────────────────────────

export interface BillingPosition {
  // Counts
  totalJobs: number;
  billedJobs: number;
  openJobs: number;
  // Recorded
  recordedAW: number;
  recordedHours: number;
  // Billed
  billedAW: number;
  billedHours: number;
  // Open
  openAW: number;
  openHours: number;
  // Derived
  billingConversion: number;  // billedHours / recordedHours * 100
  closureRate: number;        // billedJobs / totalJobs * 100
  billingGap: number;         // recordedHours - billedHours
}

/**
 * The ONE function all screens must call for billing metrics.
 * Uses the existing selectors already in billingEngine.ts.
 */
export function getBillingPosition(
  jobs: Job[],
  billingRecords: BillingRecord[],
  filter: PeriodFilter
): BillingPosition {
  const recordedJobsList = getRecordedJobs(jobs, billingRecords, filter);
  const billedJobsList = getBilledJobs(jobs, billingRecords, filter);
  const openJobsList = getOpenJobs(jobs, billingRecords, filter);

  const totalJobs = recordedJobsList.length;
  const billedJobsCount = billedJobsList.length;
  const openJobsCount = openJobsList.length;

  const recAW = recordedJobsList.reduce((s, j) => s + (j.aw ?? 0), 0);
  const recHours = recordedJobsList.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);

  const billAW = billedJobsList.reduce((s, { billing }) => s + (billing.billedAW ?? 0), 0);
  const billHours = billedJobsList.reduce((s, { billing }) => s + (billing.billedHours ?? 0), 0);

  const opAW = openJobsList.reduce((s, { job }) => s + (job.aw ?? 0), 0);
  const opHours = openJobsList.reduce((s, { job }) => s + awToHours(job.aw ?? 0), 0);

  const billingConversion = getBillingConversion(billHours, recHours);
  const closureRate = getClosureRate(billedJobsCount, totalJobs);
  const billingGapVal = getBillingGap(recHours, billHours);

  console.log('[billingEngine] getBillingPosition — filter:', filter.type, '| totalJobs:', totalJobs, '| billedJobs:', billedJobsCount, '| openJobs:', openJobsCount, '| recHours:', recHours.toFixed(2), '| billHours:', billHours.toFixed(2));

  return {
    totalJobs,
    billedJobs: billedJobsCount,
    openJobs: openJobsCount,
    recordedAW: recAW,
    recordedHours: recHours,
    billedAW: billAW,
    billedHours: billHours,
    openAW: opAW,
    openHours: opHours,
    billingConversion,
    closureRate,
    billingGap: billingGapVal,
  };
}
