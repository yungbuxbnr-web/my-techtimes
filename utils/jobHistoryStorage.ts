
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@techtimes_job_history';

export type JobHistoryEventType =
  | 'WIP_FIRST_RECORDED'
  | 'WORK_SESSION_ADDED'
  | 'JOB_EDITED'
  | 'AW_CHANGED'
  | 'HOURS_CHANGED'
  | 'NOTES_UPDATED'
  | 'VHC_UPDATED'
  | 'WIP_CHANGED'
  | 'REG_CHANGED'
  | 'DATE_CHANGED'
  | 'IMAGE_ADDED'
  | 'IMAGE_REMOVED'
  | 'TECHNICAL_CASE_LINKED'
  | 'HANDOVER_CREATED'
  | 'WIP_COMPLETED'
  | 'WIP_INVOICED'
  | 'WIP_REOPENED'
  | 'BILLING_ADJUSTED'
  | 'DATA_RESTORED'
  | 'DATA_REPAIRED'
  | 'WIP_CONFLICT_DETECTED';

export interface JobHistoryEntry {
  id: string;           // uuid
  jobId: string;        // the Job record this event belongs to
  wipNumber: string;    // normalised WIP
  eventType: JobHistoryEventType;
  timestamp: string;    // ISO 8601
  description: string;  // human-readable summary
  // optional before/after for field changes
  previousValue?: string;
  newValue?: string;
  // optional metadata
  sessionNumber?: number;   // 1-based session index within WIP
  awValue?: number;
  hoursValue?: number;
  imageCount?: number;
  relatedId?: string;       // billingRecordId, caseId, handoverId etc.
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const jobHistoryStorage = {
  async getAll(): Promise<JobHistoryEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as JobHistoryEntry[]) : [];
    } catch { return []; }
  },

  async getForJob(jobId: string): Promise<JobHistoryEntry[]> {
    const all = await this.getAll();
    return all.filter(e => e.jobId === jobId).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  async getForWip(normalizedWip: string): Promise<JobHistoryEntry[]> {
    const all = await this.getAll();
    return all.filter(e => e.wipNumber === normalizedWip).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  async recordEvent(entry: Omit<JobHistoryEntry, 'id'>): Promise<void> {
    try {
      console.log('jobHistoryStorage.recordEvent:', entry.eventType, 'jobId:', entry.jobId, 'wip:', entry.wipNumber);
      const all = await this.getAll();
      const newEntry: JobHistoryEntry = { ...entry, id: generateId() };
      all.push(newEntry);
      // Keep max 5000 entries, drop oldest 500 if exceeded
      const trimmed = all.length > 5000 ? all.slice(500) : all;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('jobHistoryStorage.recordEvent: non-fatal error', e);
    }
  },

  async deleteForJob(jobId: string): Promise<void> {
    try {
      const all = await this.getAll();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(e => e.jobId !== jobId)));
    } catch {}
  },

  async clear(): Promise<void> {
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
  },
};
