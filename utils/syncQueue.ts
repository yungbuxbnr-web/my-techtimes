// utils/syncQueue.ts
// Temporary placeholder — sync queue not yet active.

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncCollection = 'jobs' | 'absences' | 'schedule' | 'settings' | 'bankHolidays';

export interface SyncQueueItem {
  id: string;
  collection: SyncCollection;
  operation: SyncOperation;
  recordId: string;
  data?: any;
  timestamp: string;
  retryCount: number;
}

export const syncQueue = {
  async getAll(): Promise<SyncQueueItem[]> {
    return [];
  },
  async add(_collection: SyncCollection, _operation: SyncOperation, _recordId: string, _data?: any): Promise<void> {
    return;
  },
  async remove(_queueId: string): Promise<void> {
    return;
  },
  async incrementRetry(_queueId: string): Promise<void> {
    return;
  },
  async getPendingCount(): Promise<number> {
    return 0;
  },
  async clear(): Promise<void> {
    return;
  },
};
