
// contexts/GoogleSyncContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GoogleUser,
  getCurrentGoogleUser,
  initialiseGoogleSignIn,
  signInWithGoogle,
  signOutFromGoogle,
  isGoogleSyncEnabled,
  setGoogleSyncEnabled,
  isGoogleSyncAvailable,
  FIREBASE_CONFIG,
} from '@/utils/googleSync';
import { processSyncQueue, downloadCloudChanges, getLastSyncTime } from '@/utils/firestoreSync';
import { syncQueue } from '@/utils/syncQueue';
import NetInfo from '@react-native-community/netinfo';

interface GoogleSyncContextValue {
  // Auth state
  googleUser: GoogleUser | null;
  isSignedIn: boolean;
  isSyncEnabled: boolean;
  isAvailable: boolean;
  isConfigured: boolean;

  // Sync state
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
  isOnline: boolean;
  syncError: string | null;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  enableSync: (enabled: boolean) => Promise<void>;
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
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAvailable = isGoogleSyncAvailable();
  const isConfigured = FIREBASE_CONFIG.isConfigured;

  const refreshStatus = useCallback(async () => {
    try {
      const user = getCurrentGoogleUser();
      setGoogleUser(user);
      const enabled = await isGoogleSyncEnabled();
      setIsSyncEnabled(enabled);
      const lastSync = await getLastSyncTime();
      setLastSyncTime(lastSync);
      const pending = await syncQueue.getPendingCount();
      setPendingChanges(pending);
    } catch (error) {
      console.error('GoogleSyncContext: refreshStatus failed', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await initialiseGoogleSignIn();
        if (!cancelled) await refreshStatus();
      } catch (error) {
        console.error('GoogleSyncContext: init failed', error);
      }
    };

    void init();

    // Monitor network
    const unsubscribeNet = NetInfo.addEventListener(state => {
      if (!cancelled) setIsOnline(state.isConnected ?? true);
    });

    return () => {
      cancelled = true;
      unsubscribeNet();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [refreshStatus]);

  // Auto-sync every 5 minutes when online and signed in
  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

    if (isSyncEnabled && isOnline && googleUser) {
      syncIntervalRef.current = setInterval(() => {
        void processSyncQueue().catch(console.error);
      }, 5 * 60 * 1000);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isSyncEnabled, isOnline, googleUser]);

  const signIn = useCallback(async () => {
    console.log('GoogleSyncContext: signIn pressed');
    try {
      setSyncError(null);
      const user = await signInWithGoogle();
      setGoogleUser(user);
      await refreshStatus();
    } catch (error: any) {
      setSyncError(error?.message || 'Sign-in failed');
      throw error;
    }
  }, [refreshStatus]);

  const signOut = useCallback(async () => {
    console.log('GoogleSyncContext: signOut pressed');
    try {
      await signOutFromGoogle();
      setGoogleUser(null);
      setIsSyncEnabled(false);
      await refreshStatus();
    } catch (error: any) {
      setSyncError(error?.message || 'Sign-out failed');
    }
  }, [refreshStatus]);

  const enableSync = useCallback(async (enabled: boolean) => {
    console.log('GoogleSyncContext: enableSync toggled', enabled);
    await setGoogleSyncEnabled(enabled);
    setIsSyncEnabled(enabled);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    console.log('GoogleSyncContext: syncNow pressed');
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await processSyncQueue();
      await downloadCloudChanges();
      const lastSync = await getLastSyncTime();
      setLastSyncTime(lastSync);
      const pending = await syncQueue.getPendingCount();
      setPendingChanges(pending);
      if (result.errors > 0) {
        setSyncError(`${result.errors} item(s) failed to sync`);
      }
    } catch (error: any) {
      setSyncError(error?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return (
    <GoogleSyncContext.Provider value={{
      googleUser,
      isSignedIn: googleUser !== null,
      isSyncEnabled,
      isAvailable,
      isConfigured,
      isSyncing,
      lastSyncTime,
      pendingChanges,
      isOnline,
      syncError,
      signIn,
      signOut,
      enableSync,
      syncNow,
      refreshStatus,
    }}>
      {children}
    </GoogleSyncContext.Provider>
  );
}

export function useGoogleSync() {
  return useContext(GoogleSyncContext);
}
