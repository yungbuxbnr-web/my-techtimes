// contexts/GoogleSyncContext.tsx
// Temporary placeholder — Google Sync not yet configured.

import React, { createContext, useContext } from 'react';

interface GoogleSyncContextValue {
  googleUser: null;
  isSignedIn: false;
  isSyncEnabled: false;
  isAvailable: false;
  isConfigured: false;
  isSyncing: false;
  lastSyncTime: null;
  pendingChanges: 0;
  isOnline: boolean;
  syncError: null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  enableSync: (_enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const GoogleSyncContext = createContext<GoogleSyncContextValue>({
  googleUser: null,
  isSignedIn: false,
  isSyncEnabled: false,
  isAvailable: false,
  isConfigured: false,
  isSyncing: false,
  lastSyncTime: null,
  pendingChanges: 0,
  isOnline: true,
  syncError: null,
  signIn: async () => {},
  signOut: async () => {},
  enableSync: async () => {},
  syncNow: async () => {},
  refreshStatus: async () => {},
});

export function GoogleSyncProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleSyncContext.Provider value={{
      googleUser: null,
      isSignedIn: false,
      isSyncEnabled: false,
      isAvailable: false,
      isConfigured: false,
      isSyncing: false,
      lastSyncTime: null,
      pendingChanges: 0,
      isOnline: true,
      syncError: null,
      signIn: async () => {},
      signOut: async () => {},
      enableSync: async () => {},
      syncNow: async () => {},
      refreshStatus: async () => {},
    }}>
      {children}
    </GoogleSyncContext.Provider>
  );
}

export function useGoogleSync(): GoogleSyncContextValue {
  return useContext(GoogleSyncContext);
}
