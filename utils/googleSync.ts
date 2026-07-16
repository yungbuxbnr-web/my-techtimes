// utils/googleSync.ts
// Temporary placeholder — Google Sign-In and Firebase not yet configured.
// Replace this file once Firebase project is set up and packages are installed.

export type GoogleSyncStatus = {
  available: boolean;
  connected: boolean;
  message: string;
};

export function getGoogleSyncStatus(): GoogleSyncStatus {
  return {
    available: false,
    connected: false,
    message: 'Google Sync has not been configured yet.',
  };
}

export async function initialiseGoogleSync(): Promise<void> {
  return;
}

export async function syncWithGoogle(): Promise<{
  success: false;
  reason: 'not_configured';
}> {
  return {
    success: false,
    reason: 'not_configured',
  };
}
