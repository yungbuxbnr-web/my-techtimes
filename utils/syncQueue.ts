
// utils/syncQueue.ts
// Local sync queue — stores pending changes to upload when online

import AsyncStorage from '@react-native-async-storage/async-storage';

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

const SYNC_QUEUE_KEY = '@techtimes_sync_queue';
const MAX_RETRY = 3;

function generateQueueId(): string {
  return `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const syncQueue = {
  async getAll(): Promise<SyncQueueItem[]> {
    try {
      const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async add(
    collection: SyncCollection,
    operation: SyncOperation,
    recordId: string,
    data?: any
  ): Promise<void> {
    try {
      const queue = await this.getAll();

      // Remove any existing pending operation for the same record+collection
      const filtered = queue.filter(
        item => !(item.collection === collection && item.recordId === recordId)
      );

      // Don't queue deletes for records that haven't been synced yet
      if (operation === 'delete') {
        const hadPendingCreate = queue.some(
          item => item.collection === collection && item.recordId === recordId && item.operation === 'create'
        );
        if (hadPendingCreate) {
          // Just remove the pending create — no need to sync delete
          await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
          return;
        }
      }

      filtered.push({
        id: generateQueueId(),
        collection,
        operation,
        recordId,
        data,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('SyncQueue: failed to add item', error);
    }
  },

  async remove(queueId: string): Promise<void> {
    try {
      const queue = await this.getAll();
      const filtered = queue.filter(item => item.id !== queueId);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('SyncQueue: failed to remove item', error);
    }
  },

  async incrementRetry(queueId: string): Promise<void> {
    try {
      const queue = await this.getAll();
      const updated = queue.map(item =>
        item.id === queueId ? { ...item, retryCount: item.retryCount + 1 } : item
      );
      // Remove items that have exceeded max retries
      const filtered = updated.filter(item => item.retryCount <= MAX_RETRY);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('SyncQueue: failed to increment retry', error);
    }
  },

  async getPendingCount(): Promise<number> {
    const queue = await this.getAll();
    return queue.length;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
  },
};
