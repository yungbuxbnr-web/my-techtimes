
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job } from '@/utils/offlineStorage';
import { BillingRecord } from '@/utils/billingStorage';
import { groupJobsByWip } from '@/utils/wipEngine';
import { normaliseBillingStatus, awToHours } from '@/utils/billingEngine';

const MONTH_END_REVIEW_KEY = '@techtimes_month_end_reviews';
export const MONTH_END_NOTIF_GUARD_KEY = '@techtimes_month_end_notif_guard';

export interface MonthEndReviewRecord {
  id: string;
  month: string;           // 'YYYY-MM'
  reviewedAt: string;      // ISO timestamp
  openWipsFound: number;
  wipsClosed: number;
  wipsCarriedForward: number;
  totalHoursClosed: number;
  totalHoursCarried: number;
}

export interface OpenWipItem {
  normalizedWip: string;
  displayWip: string;
  vehicleReg: string;
  sessionCount: number;
  openHours: number;
  openAW: number;
  lastWorked: string;       // ISO date string
  firstWorked: string;
  hasConflict: boolean;
  hasBillingAttention: boolean;  // vehicle conflict or mixed status
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const monthEndReviewStorage = {
  async getAll(): Promise<MonthEndReviewRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(MONTH_END_REVIEW_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as MonthEndReviewRecord[];
    } catch (err) {
      console.error('monthEndReviewStorage.getAll: Error reading records:', err);
      return [];
    }
  },

  async getForMonth(month: string): Promise<MonthEndReviewRecord | null> {
    try {
      const all = await monthEndReviewStorage.getAll();
      return all.find(r => r.month === month) ?? null;
    } catch (err) {
      console.error('monthEndReviewStorage.getForMonth: Error:', err);
      return null;
    }
  },

  async save(record: MonthEndReviewRecord): Promise<void> {
    try {
      console.log('monthEndReviewStorage.save: Saving review for month:', record.month);
      const all = await monthEndReviewStorage.getAll();
      const idx = all.findIndex(r => r.month === record.month);
      if (idx !== -1) {
        all[idx] = record;
      } else {
        all.push(record);
      }
      await AsyncStorage.setItem(MONTH_END_REVIEW_KEY, JSON.stringify(all));
      console.log('monthEndReviewStorage.save: Saved review id:', record.id);
    } catch (err) {
      console.error('monthEndReviewStorage.save: Error saving review:', err);
    }
  },

  async isReviewDoneForMonth(month: string): Promise<boolean> {
    try {
      const record = await monthEndReviewStorage.getForMonth(month);
      return record !== null;
    } catch {
      return false;
    }
  },
};

// Returns 'YYYY-MM' of the month that needs review, or null if none needed
export async function getPendingReviewMonth(): Promise<string | null> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  // If we're in the last 3 days of the month, show current month review
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isNearMonthEnd = now.getDate() >= lastDayOfMonth - 2;

  if (isNearMonthEnd) {
    const done = await monthEndReviewStorage.isReviewDoneForMonth(currentMonth);
    if (!done) return currentMonth;
  }

  // Check if previous month review was missed
  const prevDone = await monthEndReviewStorage.isReviewDoneForMonth(prevMonth);
  if (!prevDone) return prevMonth;

  return null;
}

// Build the list of unique open WIPs for a given month's review
// Includes ALL currently open WIPs (not just ones worked in that month)
export async function buildOpenWipList(
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): Promise<OpenWipItem[]> {
  console.log('monthEndReview.buildOpenWipList: Building open WIP list from', allJobs.length, 'jobs');

  const wipMap = groupJobsByWip(allJobs, allBillingRecords);
  const billingByJobId = new Map(allBillingRecords.map(r => [r.jobId, r]));

  const items: OpenWipItem[] = [];

  for (const [, summary] of wipMap) {
    // Only include open or mixed WIPs
    if (summary.status === 'billed') continue;

    // Compute open hours/AW: sessions with no billing record OR billing status 'open'
    let openHours = 0;
    let openAW = 0;
    for (const session of summary.sessions) {
      const billing = billingByJobId.get(session.id);
      if (!billing || normaliseBillingStatus(billing.billingStatus) === 'open') {
        openHours += awToHours(session.aw ?? 0);
        openAW += session.aw ?? 0;
      }
    }

    const hasBillingAttention = summary.hasConflict || summary.status === 'mixed';

    items.push({
      normalizedWip: summary.normalizedWip,
      displayWip: summary.displayWip,
      vehicleReg: summary.vehicleReg,
      sessionCount: summary.sessionCount,
      openHours,
      openAW,
      lastWorked: summary.lastWorked,
      firstWorked: summary.firstWorked,
      hasConflict: summary.hasConflict,
      hasBillingAttention,
    });
  }

  // Sort by firstWorked ascending (oldest first)
  items.sort((a, b) => new Date(a.firstWorked).getTime() - new Date(b.firstWorked).getTime());

  console.log('monthEndReview.buildOpenWipList: Found', items.length, 'open WIPs');
  return items;
}

// Format month for display: 'YYYY-MM' -> 'August 2026'
export function formatReviewMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
