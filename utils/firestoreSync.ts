// utils/firestoreSync.ts
// Temporary placeholder — Firestore not yet configured.

export async function processSyncQueue(): Promise<{ uploaded: number; errors: number }> {
  return { uploaded: 0, errors: 0 };
}

export async function downloadCloudChanges(): Promise<{ downloaded: number; conflicts: number }> {
  return { downloaded: 0, conflicts: 0 };
}

export async function getLastSyncTime(): Promise<string | null> {
  return null;
}

export async function uploadAllLocalData(): Promise<void> {
  return;
}

export const FIRESTORE_SECURITY_RULES = '';
