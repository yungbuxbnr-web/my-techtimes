
import AsyncStorage from '@react-native-async-storage/async-storage';

const BILLING_KEYS = {
  RECORDS: '@techtimes_billing_records',
  HISTORY: '@techtimes_billing_history',
  RECYCLE: '@techtimes_billing_recycle',
};

export interface BillingRecord {
  id: string;
  jobId: string;

  workStatus: 'open' | 'in_progress' | 'work_complete';
  billingStatus: 'unbilled' | 'ready_to_bill' | 'billed' | 'legacy_unknown';

  billedAW: number;
  billedHours: number;

  workCompletedAt?: string;
  billedAt?: string;
  billedDate?: string;

  billingNotes?: string;

  // Reference snapshot (for display without joining Job)
  wipNumber?: string;
  vehicleReg?: string;
  workDate?: string;

  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface BillingHistoryEntry {
  id: string;
  billingRecordId: string;
  jobId: string;
  eventType:
    | 'billing_created'
    | 'work_marked_complete'
    | 'returned_to_in_progress'
    | 'marked_billed'
    | 'billing_adjusted'
    | 'billing_reopened'
    | 'notes_changed';
  timestamp: string;
  description: string;
  previousAW?: number;
  previousHours?: number;
  newAW?: number;
  newHours?: number;
  reason?: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const billingStorage = {
  async getAllRecords(): Promise<BillingRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(BILLING_KEYS.RECORDS);
      if (!raw) return [];
      return JSON.parse(raw) as BillingRecord[];
    } catch (error) {
      console.error('billingStorage.getAllRecords: Error reading records:', error);
      return [];
    }
  },

  async getRecordForJob(jobId: string): Promise<BillingRecord | null> {
    try {
      const records = await billingStorage.getAllRecords();
      return records.find(r => r.jobId === jobId) || null;
    } catch (error) {
      console.error('billingStorage.getRecordForJob: Error:', error);
      return null;
    }
  },

  async createRecord(
    record: Omit<BillingRecord, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
  ): Promise<BillingRecord> {
    console.log('billingStorage.createRecord: Creating billing record for jobId:', record.jobId);
    const now = new Date().toISOString();
    const newRecord: BillingRecord = {
      ...record,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    const records = await billingStorage.getAllRecords();
    records.push(newRecord);
    await AsyncStorage.setItem(BILLING_KEYS.RECORDS, JSON.stringify(records));
    console.log('billingStorage.createRecord: Created record id:', newRecord.id);
    return newRecord;
  },

  async updateRecord(id: string, updates: Partial<BillingRecord>): Promise<BillingRecord> {
    console.log('billingStorage.updateRecord: Updating record id:', id, 'updates:', updates);
    const records = await billingStorage.getAllRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error(`billingStorage.updateRecord: Record not found: ${id}`);
    }
    const updated: BillingRecord = {
      ...records[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      revision: (records[idx].revision || 1) + 1,
    };
    records[idx] = updated;
    await AsyncStorage.setItem(BILLING_KEYS.RECORDS, JSON.stringify(records));
    return updated;
  },

  async deleteRecord(id: string): Promise<void> {
    console.log('billingStorage.deleteRecord: Soft-deleting record id:', id);
    const records = await billingStorage.getAllRecords();
    const record = records.find(r => r.id === id);
    if (record) {
      // Move to recycle bin
      const recycleRaw = await AsyncStorage.getItem(BILLING_KEYS.RECYCLE);
      const recycle: BillingRecord[] = recycleRaw ? JSON.parse(recycleRaw) : [];
      recycle.push({ ...record, updatedAt: new Date().toISOString() });
      await AsyncStorage.setItem(BILLING_KEYS.RECYCLE, JSON.stringify(recycle));
    }
    const remaining = records.filter(r => r.id !== id);
    await AsyncStorage.setItem(BILLING_KEYS.RECORDS, JSON.stringify(remaining));
  },

  async ensureRecordsForJobs(
    jobs: { id: string; wipNumber: string; vehicleReg: string; createdAt: string; aw: number }[]
  ): Promise<number> {
    const records = await billingStorage.getAllRecords();
    const existingJobIds = new Set(records.map(r => r.jobId));
    let created = 0;

    const newRecords: BillingRecord[] = [];
    for (const job of jobs) {
      if (!existingJobIds.has(job.id)) {
        const now = new Date().toISOString();
        const newRecord: BillingRecord = {
          id: generateId(),
          jobId: job.id,
          workStatus: 'open',
          billingStatus: 'legacy_unknown',
          billedAW: job.aw,
          billedHours: (job.aw * 5) / 60,
          wipNumber: job.wipNumber,
          vehicleReg: job.vehicleReg,
          workDate: job.createdAt.split('T')[0],
          createdAt: now,
          updatedAt: now,
          revision: 1,
        };
        newRecords.push(newRecord);
        created++;
      }
    }

    if (newRecords.length > 0) {
      console.log('billingStorage.ensureRecordsForJobs: Creating', newRecords.length, 'missing billing records');
      const allRecords = [...records, ...newRecords];
      await AsyncStorage.setItem(BILLING_KEYS.RECORDS, JSON.stringify(allRecords));
    }

    return created;
  },

  async getHistory(billingRecordId: string): Promise<BillingHistoryEntry[]> {
    try {
      const all = await billingStorage.getAllHistory();
      return all.filter(e => e.billingRecordId === billingRecordId);
    } catch (error) {
      console.error('billingStorage.getHistory: Error:', error);
      return [];
    }
  },

  async addHistoryEntry(
    entry: Omit<BillingHistoryEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const all = await billingStorage.getAllHistory();
      const newEntry: BillingHistoryEntry = {
        ...entry,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      all.push(newEntry);
      await AsyncStorage.setItem(BILLING_KEYS.HISTORY, JSON.stringify(all));
    } catch (error) {
      console.error('billingStorage.addHistoryEntry: Error (non-fatal):', error);
    }
  },

  async getAllHistory(): Promise<BillingHistoryEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(BILLING_KEYS.HISTORY);
      if (!raw) return [];
      return JSON.parse(raw) as BillingHistoryEntry[];
    } catch (error) {
      console.error('billingStorage.getAllHistory: Error:', error);
      return [];
    }
  },

  async exportBillingBackup(): Promise<string> {
    console.log('billingStorage.exportBillingBackup: Exporting billing backup');
    const records = await billingStorage.getAllRecords();
    const history = await billingStorage.getAllHistory();
    const backup = {
      billingBackupVersion: '1.0',
      createdAt: new Date().toISOString(),
      records,
      history,
    };
    return JSON.stringify(backup, null, 2);
  },

  async importBillingBackup(json: string): Promise<{ imported: number; unmatched: number }> {
    console.log('billingStorage.importBillingBackup: Importing billing backup');
    let backup: any;
    try {
      backup = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON in billing backup file');
    }

    if (!backup.records || !Array.isArray(backup.records)) {
      throw new Error('Invalid billing backup format — missing records array');
    }

    const existingRecords = await billingStorage.getAllRecords();
    const existingByJobId = new Map(existingRecords.map(r => [r.jobId, r]));

    let imported = 0;
    let unmatched = 0;

    const updatedRecords = [...existingRecords];

    for (const incoming of backup.records as BillingRecord[]) {
      if (!incoming.jobId) {
        unmatched++;
        continue;
      }
      const existing = existingByJobId.get(incoming.jobId);
      if (existing) {
        // Update existing record
        const idx = updatedRecords.findIndex(r => r.jobId === incoming.jobId);
        if (idx !== -1) {
          updatedRecords[idx] = {
            ...incoming,
            id: existing.id,
            updatedAt: new Date().toISOString(),
            revision: (existing.revision || 1) + 1,
          };
          imported++;
        }
      } else {
        // New record — preserve as-is
        updatedRecords.push({
          ...incoming,
          id: incoming.id || generateId(),
          updatedAt: new Date().toISOString(),
        });
        unmatched++;
      }
    }

    await AsyncStorage.setItem(BILLING_KEYS.RECORDS, JSON.stringify(updatedRecords));

    // Import history if present
    if (backup.history && Array.isArray(backup.history)) {
      const existingHistory = await billingStorage.getAllHistory();
      const existingHistoryIds = new Set(existingHistory.map(h => h.id));
      const newHistory = (backup.history as BillingHistoryEntry[]).filter(
        h => !existingHistoryIds.has(h.id)
      );
      if (newHistory.length > 0) {
        await AsyncStorage.setItem(
          BILLING_KEYS.HISTORY,
          JSON.stringify([...existingHistory, ...newHistory])
        );
      }
    }

    console.log('billingStorage.importBillingBackup: imported:', imported, 'unmatched:', unmatched);
    return { imported, unmatched };
  },

  async getBillingStats(
    jobs: { id: string; aw: number; createdAt: string }[]
  ): Promise<{
    recordedAW: number;
    recordedHours: number;
    billedAW: number;
    billedHours: number;
    readyToBillAW: number;
    readyToBillHours: number;
    openAW: number;
    openHours: number;
    unbilledHours: number;
    jobsRecorded: number;
    jobsBilled: number;
    jobsReady: number;
    jobsOpen: number;
    jobsLegacy: number;
  }> {
    const records = await billingStorage.getAllRecords();
    const recordsByJobId = new Map(records.map(r => [r.jobId, r]));

    let recordedAW = 0;
    let billedAW = 0;
    let readyToBillAW = 0;
    let openAW = 0;
    let jobsBilled = 0;
    let jobsReady = 0;
    let jobsOpen = 0;
    let jobsLegacy = 0;

    for (const job of jobs) {
      recordedAW += job.aw;
      const billing = recordsByJobId.get(job.id);
      if (!billing) continue;

      if (billing.billingStatus === 'billed') {
        billedAW += job.aw;
        jobsBilled++;
      } else if (billing.billingStatus === 'ready_to_bill') {
        readyToBillAW += job.aw;
        jobsReady++;
      } else if (billing.billingStatus === 'unbilled') {
        openAW += job.aw;
        jobsOpen++;
      } else if (billing.billingStatus === 'legacy_unknown') {
        jobsLegacy++;
      }
    }

    const toHours = (aw: number) => (aw * 5) / 60;

    const recordedHours = toHours(recordedAW);
    const billedHours = toHours(billedAW);
    const readyToBillHours = toHours(readyToBillAW);
    const openHours = toHours(openAW);
    const unbilledHours = readyToBillHours + openHours;

    return {
      recordedAW,
      recordedHours,
      billedAW,
      billedHours,
      readyToBillAW,
      readyToBillHours,
      openAW,
      openHours,
      unbilledHours,
      jobsRecorded: jobs.length,
      jobsBilled,
      jobsReady,
      jobsOpen,
      jobsLegacy,
    };
  },
};
