
// utils/firestoreSync.ts
// Firestore sync operations — safe to call even if Firebase is not configured

import { getCurrentGoogleUser, isGoogleSyncAvailable, FIREBASE_CONFIG } from './googleSync';
import { syncQueue, SyncQueueItem } from './syncQueue';
import { offlineStorage } from './offlineStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = '@techtimes_last_sync';
const DEVICE_ID_KEY = '@techtimes_device_id';
const SCHEMA_VERSION = 1;

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getFirestore(): any {
  if (!isGoogleSyncAvailable() || !FIREBASE_CONFIG.isConfigured) return null;
  try {
    return require('@react-native-firebase/firestore').default();
  } catch {
    return null;
  }
}

/**
 * Build a Firestore document with required sync metadata.
 */
async function buildSyncDoc(data: any, uid: string): Promise<any> {
  const deviceId = await getDeviceId();
  return {
    ...data,
    ownerUid: uid,
    deviceId,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Process the sync queue — upload pending local changes to Firestore.
 * Safe to call at any time — returns silently if not configured or offline.
 */
export async function processSyncQueue(): Promise<{ uploaded: number; errors: number }> {
  const user = getCurrentGoogleUser();
  const db = getFirestore();

  if (!user || !db) {
    return { uploaded: 0, errors: 0 };
  }

  const queue = await syncQueue.getAll();
  let uploaded = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      await uploadQueueItem(item, user.uid, db);
      await syncQueue.remove(item.id);
      uploaded++;
    } catch (error) {
      console.error('FirestoreSync: failed to upload item', item.id, error);
      await syncQueue.incrementRetry(item.id);
      errors++;
    }
  }

  if (uploaded > 0) {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  return { uploaded, errors };
}

async function uploadQueueItem(item: SyncQueueItem, uid: string, db: any): Promise<void> {
  const collectionPath = `users/${uid}/${item.collection}`;

  if (item.operation === 'delete') {
    // Use tombstone instead of hard delete
    await db.collection(collectionPath).doc(item.recordId).set({
      ownerUid: uid,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    }, { merge: true });
    return;
  }

  if (!item.data) return;

  const doc = await buildSyncDoc(item.data, uid);

  if (item.operation === 'create') {
    await db.collection(collectionPath).doc(item.recordId).set(doc);
  } else if (item.operation === 'update') {
    await db.collection(collectionPath).doc(item.recordId).set(doc, { merge: true });
  }
}

/**
 * Download cloud changes and merge with local data.
 * Uses "last write wins" with revision numbers.
 * Never silently deletes local data.
 */
export async function downloadCloudChanges(): Promise<{ downloaded: number; conflicts: number }> {
  const user = getCurrentGoogleUser();
  const db = getFirestore();

  if (!user || !db) {
    return { downloaded: 0, conflicts: 0 };
  }

  let downloaded = 0;
  let conflicts = 0;

  try {
    // Download jobs
    const jobsSnap = await db.collection(`users/${user.uid}/jobs`).get();
    const localJobs = await offlineStorage.getAllJobs();

    for (const doc of jobsSnap.docs) {
      const cloudJob = doc.data();
      if (cloudJob.deletedAt) continue; // Skip tombstones

      const localJob = localJobs.find((j: any) => j.id === doc.id);
      if (!localJob) {
        // New job from cloud — add locally
        const allJobs = await offlineStorage.getAllJobs();
        allJobs.push({ ...cloudJob, id: doc.id });
        await offlineStorage.saveJobs(allJobs);
        downloaded++;
      } else {
        // Check for conflict
        const cloudUpdated = new Date(cloudJob.updatedAt || 0).getTime();
        const localUpdated = new Date(localJob.updatedAt || localJob.createdAt).getTime();
        if (cloudUpdated > localUpdated) {
          // Cloud is newer — update local
          await offlineStorage.updateJob(doc.id, cloudJob);
          downloaded++;
        } else if (localUpdated > cloudUpdated) {
          conflicts++;
        }
      }
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    console.error('FirestoreSync: download failed', error);
  }

  return { downloaded, conflicts };
}

/**
 * Get the last successful sync timestamp.
 */
export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

/**
 * Upload ALL local data to Firestore (first-time sync or restore).
 * Creates a local backup first.
 */
export async function uploadAllLocalData(): Promise<void> {
  const user = getCurrentGoogleUser();
  const db = getFirestore();

  if (!user || !db) {
    throw new Error('Not signed in or Firebase not configured');
  }

  // Create local backup first
  const backupJson = await offlineStorage.exportAllData();
  await AsyncStorage.setItem('@techtimes_pre_sync_backup', backupJson);

  const jobs = await offlineStorage.getAllJobs();
  const absences = await offlineStorage.getAllAbsences();
  const schedule = await offlineStorage.getSchedule();
  const settings = await offlineStorage.getSettings();

  const batch = db.batch();
  const deviceId = await getDeviceId();

  for (const job of jobs) {
    const ref = db.collection(`users/${user.uid}/jobs`).doc(job.id);
    batch.set(ref, { ...job, ownerUid: user.uid, deviceId, schemaVersion: SCHEMA_VERSION });
  }

  for (const absence of absences) {
    const ref = db.collection(`users/${user.uid}/absences`).doc(absence.id);
    batch.set(ref, { ...absence, ownerUid: user.uid, deviceId, schemaVersion: SCHEMA_VERSION });
  }

  const scheduleRef = db.collection(`users/${user.uid}/schedule`).doc('current');
  batch.set(scheduleRef, { ...schedule, ownerUid: user.uid, deviceId, schemaVersion: SCHEMA_VERSION });

  const settingsRef = db.collection(`users/${user.uid}/settings`).doc('current');
  batch.set(settingsRef, { ...settings, ownerUid: user.uid, deviceId, schemaVersion: SCHEMA_VERSION });

  await batch.commit();
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

/**
 * Firestore Security Rules (paste into Firebase Console → Firestore → Rules):
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/{collection}/{document} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */
export const FIRESTORE_SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{collection}/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
`;
