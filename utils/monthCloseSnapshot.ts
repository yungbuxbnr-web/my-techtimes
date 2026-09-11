
import AsyncStorage from '@react-native-async-storage/async-storage';

const SNAPSHOT_KEY = '@techtimes_month_close_snapshots';

export interface OpenWipSnapshot {
  normalizedWip: string;
  displayWip: string;
  vehicleReg: string;
  openHours: number;
  openAW: number;
  blockerReason?: string;
  lastWorked: string;
}

export interface MonthCloseSnapshot {
  id: string;
  monthKey: string;           // 'YYYY-MM'
  revision: number;           // 0 = original, 1+ = amendments
  createdAt: string;
  sourceReviewId?: string;
  amendmentNote?: string;

  // Summary totals
  adjustedAvailableHours: number;
  soldHours: number;
  invoicedHours: number;
  openHours: number;
  recordedEfficiency: number;
  billedEfficiency: number;
  totalAW: number;
  uniqueWipsWorked: number;
  workSessions: number;
  wipsClosed: number;
  wipsRemainingOpen: number;
  billingConversion: number;
  absenceHours: number;
  effectiveAvailableWorkingDays: number;

  // Open WIP position at close
  openWips: OpenWipSnapshot[];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const monthCloseSnapshotStorage = {
  async getAll(): Promise<MonthCloseSnapshot[]> {
    try {
      const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async getForMonth(monthKey: string): Promise<MonthCloseSnapshot[]> {
    const all = await monthCloseSnapshotStorage.getAll();
    return all.filter(s => s.monthKey === monthKey)
      .sort((a, b) => a.revision - b.revision);
  },

  async getOriginal(monthKey: string): Promise<MonthCloseSnapshot | null> {
    const snapshots = await monthCloseSnapshotStorage.getForMonth(monthKey);
    return snapshots.find(s => s.revision === 0) ?? null;
  },

  async getLatest(monthKey: string): Promise<MonthCloseSnapshot | null> {
    const snapshots = await monthCloseSnapshotStorage.getForMonth(monthKey);
    if (snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1];
  },

  async save(snapshot: MonthCloseSnapshot): Promise<void> {
    try {
      const all = await monthCloseSnapshotStorage.getAll();
      // Never overwrite an existing snapshot — always append
      const exists = all.find(s => s.id === snapshot.id);
      if (!exists) all.push(snapshot);
      await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
      console.log('monthCloseSnapshotStorage.save: Saved snapshot', snapshot.id, 'month:', snapshot.monthKey, 'rev:', snapshot.revision);
    } catch (err) {
      console.error('monthCloseSnapshotStorage.save: Error:', err);
    }
  },

  async createAmendment(
    monthKey: string,
    updatedData: Partial<Omit<MonthCloseSnapshot, 'id' | 'monthKey' | 'revision' | 'createdAt'>>,
    amendmentNote?: string
  ): Promise<MonthCloseSnapshot | null> {
    const existing = await monthCloseSnapshotStorage.getForMonth(monthKey);
    if (existing.length === 0) return null;
    const latest = existing[existing.length - 1];
    const newRevision: MonthCloseSnapshot = {
      ...latest,
      ...updatedData,
      id: generateId(),
      revision: latest.revision + 1,
      createdAt: new Date().toISOString(),
      amendmentNote: amendmentNote ?? latest.amendmentNote,
    };
    await monthCloseSnapshotStorage.save(newRevision);
    return newRevision;
  },

  async hasSnapshot(monthKey: string): Promise<boolean> {
    const snapshots = await monthCloseSnapshotStorage.getForMonth(monthKey);
    return snapshots.length > 0;
  },
};

// Build a snapshot from current live data
export function buildSnapshotFromReview(params: {
  monthKey: string;
  sourceReviewId: string;
  soldHours: number;
  invoicedHours: number;
  openHours: number;
  totalAW: number;
  uniqueWipsWorked: number;
  workSessions: number;
  wipsClosed: number;
  wipsRemainingOpen: number;
  adjustedAvailableHours: number;
  absenceHours: number;
  effectiveAvailableWorkingDays: number;
  openWips: OpenWipSnapshot[];
}): MonthCloseSnapshot {
  const recordedEfficiency = params.adjustedAvailableHours > 0
    ? (params.soldHours / params.adjustedAvailableHours) * 100
    : 0;
  const billedEfficiency = params.adjustedAvailableHours > 0
    ? (params.invoicedHours / params.adjustedAvailableHours) * 100
    : 0;
  const billingConversion = params.soldHours > 0
    ? (params.invoicedHours / params.soldHours) * 100
    : 0;

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    monthKey: params.monthKey,
    revision: 0,
    createdAt: new Date().toISOString(),
    sourceReviewId: params.sourceReviewId,
    adjustedAvailableHours: params.adjustedAvailableHours,
    soldHours: params.soldHours,
    invoicedHours: params.invoicedHours,
    openHours: params.openHours,
    recordedEfficiency,
    billedEfficiency,
    totalAW: params.totalAW,
    uniqueWipsWorked: params.uniqueWipsWorked,
    workSessions: params.workSessions,
    wipsClosed: params.wipsClosed,
    wipsRemainingOpen: params.wipsRemainingOpen,
    billingConversion,
    absenceHours: params.absenceHours,
    effectiveAvailableWorkingDays: params.effectiveAvailableWorkingDays,
    openWips: params.openWips,
  };
}

// Compare live data against original snapshot
export interface SnapshotDiff {
  soldHoursDiff: number;
  invoicedHoursDiff: number;
  openHoursDiff: number;
  awDiff: number;
  hasChanges: boolean;
}

export function compareWithSnapshot(
  snapshot: MonthCloseSnapshot,
  liveSoldHours: number,
  liveInvoicedHours: number,
  liveOpenHours: number,
  liveTotalAW: number
): SnapshotDiff {
  const soldHoursDiff = liveSoldHours - snapshot.soldHours;
  const invoicedHoursDiff = liveInvoicedHours - snapshot.invoicedHours;
  const openHoursDiff = liveOpenHours - snapshot.openHours;
  const awDiff = liveTotalAW - snapshot.totalAW;
  const threshold = 0.05; // 3 minutes — ignore floating point noise
  const hasChanges = Math.abs(soldHoursDiff) > threshold
    || Math.abs(invoicedHoursDiff) > threshold
    || Math.abs(openHoursDiff) > threshold
    || Math.abs(awDiff) > 0;
  return { soldHoursDiff, invoicedHoursDiff, openHoursDiff, awDiff, hasChanges };
}
