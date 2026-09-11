
import AsyncStorage from '@react-native-async-storage/async-storage';

const BLOCKER_KEY = '@techtimes_wip_blockers';
const BLOCKER_HISTORY_KEY = '@techtimes_wip_blocker_history';

export type BlockerReason =
  | 'waiting_for_parts'
  | 'waiting_for_technical_support'
  | 'waiting_for_customer'
  | 'waiting_for_authorisation'
  | 'vehicle_returning'
  | 'waiting_for_workshop_capacity'
  | 'waiting_for_equipment'
  | 'diagnostic_investigation'
  | 'other';

export const BLOCKER_REASON_LABELS: Record<BlockerReason, string> = {
  waiting_for_parts: 'Waiting for Parts',
  waiting_for_technical_support: 'Waiting for Technical Support',
  waiting_for_customer: 'Waiting for Customer',
  waiting_for_authorisation: 'Waiting for Authorisation',
  vehicle_returning: 'Vehicle Returning',
  waiting_for_workshop_capacity: 'Waiting for Workshop Capacity',
  waiting_for_equipment: 'Waiting for Equipment',
  diagnostic_investigation: 'Diagnostic Investigation',
  other: 'Other',
};

export interface WipBlocker {
  id: string;
  normalizedWip: string;
  reason: BlockerReason;
  note?: string;
  startedAt: string;    // ISO timestamp when this blocker was set
  updatedAt: string;
  clearedAt?: string;   // ISO timestamp when cleared (null = still active)
}

export interface WipBlockerHistoryEntry {
  id: string;
  normalizedWip: string;
  eventType: 'blocker_set' | 'blocker_changed' | 'blocker_cleared';
  reason?: BlockerReason;
  previousReason?: BlockerReason;
  note?: string;
  timestamp: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getBlockerAgeDays(blocker: WipBlocker): number {
  const start = new Date(blocker.startedAt).getTime();
  return Math.floor((Date.now() - start) / 86400000);
}

export const wipBlockerStorage = {
  async getAll(): Promise<WipBlocker[]> {
    try {
      const raw = await AsyncStorage.getItem(BLOCKER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async getActive(normalizedWip: string): Promise<WipBlocker | null> {
    const all = await wipBlockerStorage.getAll();
    return all.find(b => b.normalizedWip === normalizedWip && !b.clearedAt) ?? null;
  },

  async setBlocker(normalizedWip: string, reason: BlockerReason, note?: string): Promise<WipBlocker> {
    const all = await wipBlockerStorage.getAll();
    const now = new Date().toISOString();
    const existing = all.find(b => b.normalizedWip === normalizedWip && !b.clearedAt);

    let eventType: WipBlockerHistoryEntry['eventType'] = 'blocker_set';
    let previousReason: BlockerReason | undefined;

    if (existing) {
      // Close the existing blocker
      existing.clearedAt = now;
      eventType = 'blocker_changed';
      previousReason = existing.reason;
    }

    const newBlocker: WipBlocker = {
      id: generateId(),
      normalizedWip,
      reason,
      note,
      startedAt: now,
      updatedAt: now,
    };
    all.push(newBlocker);
    await AsyncStorage.setItem(BLOCKER_KEY, JSON.stringify(all));

    // Record history
    await wipBlockerStorage.addHistory({
      normalizedWip,
      eventType,
      reason,
      previousReason,
      note,
      timestamp: now,
    });

    console.log('wipBlockerStorage.setBlocker:', normalizedWip, reason);
    return newBlocker;
  },

  async clearBlocker(normalizedWip: string): Promise<void> {
    const all = await wipBlockerStorage.getAll();
    const now = new Date().toISOString();
    const existing = all.find(b => b.normalizedWip === normalizedWip && !b.clearedAt);
    if (!existing) return;
    existing.clearedAt = now;
    await AsyncStorage.setItem(BLOCKER_KEY, JSON.stringify(all));
    await wipBlockerStorage.addHistory({
      normalizedWip,
      eventType: 'blocker_cleared',
      previousReason: existing.reason,
      timestamp: now,
    });
    console.log('wipBlockerStorage.clearBlocker:', normalizedWip);
  },

  async getHistory(normalizedWip: string): Promise<WipBlockerHistoryEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(BLOCKER_HISTORY_KEY);
      const all: WipBlockerHistoryEntry[] = raw ? JSON.parse(raw) : [];
      return all.filter(e => e.normalizedWip === normalizedWip)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch { return []; }
  },

  async addHistory(entry: Omit<WipBlockerHistoryEntry, 'id'>): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(BLOCKER_HISTORY_KEY);
      const all: WipBlockerHistoryEntry[] = raw ? JSON.parse(raw) : [];
      all.push({ ...entry, id: generateId() });
      await AsyncStorage.setItem(BLOCKER_HISTORY_KEY, JSON.stringify(all));
    } catch {}
  },
};
