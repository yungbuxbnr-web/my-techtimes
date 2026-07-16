
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { activityLogger } from '@/utils/activityLogger';

interface AuthContextType {
  isAuthenticated: boolean;
  setupComplete: boolean;
  biometricsEnabled: boolean;
  lockOnResume: boolean;
  biometricsAvailable: boolean;
  pinAuthEnabled: boolean;
  loading: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
  setPinAuthEnabled: (enabled: boolean) => Promise<boolean>;
  setLockOnResume: (enabled: boolean) => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIN_KEY = 'user_pin';
const BIOMETRICS_KEY = 'biometrics_enabled';
const PIN_AUTH_KEY = 'pin_auth_enabled';
const LOCK_ON_RESUME_KEY = 'lock_on_resume';
const SETUP_COMPLETE_KEY = 'setup_complete';
const LAST_BACKGROUND_TIME_KEY = 'last_background_time';

// Lock timeout thresholds in milliseconds
const LOCK_TIMEOUT = 60 * 60 * 1000; // 1 hour
const RESUME_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Helper functions for cross-platform storage
async function setSecureItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error('AuthContext: Error setting secure item:', key, error);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (error) {
    console.error('AuthContext: Error getting secure item:', key, error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [pinAuthEnabled, setPinAuthEnabledState] = useState(true);
  const [lockOnResume, setLockOnResumeState] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Use refs to track current values without causing re-renders
  const isAuthenticatedRef = useRef(isAuthenticated);
  const lockOnResumeRef = useRef(lockOnResume);
  const lastBackgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const biometricsEnabledRef = useRef(false);
  const biometricsAvailableRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  
  useEffect(() => {
    lockOnResumeRef.current = lockOnResume;
  }, [lockOnResume]);

  useEffect(() => {
    biometricsEnabledRef.current = biometricsEnabled;
  }, [biometricsEnabled]);

  useEffect(() => {
    biometricsAvailableRef.current = biometricsAvailable;
  }, [biometricsAvailable]);

  const checkBiometricsAvailability = useCallback(async () => {
    try {
      activityLogger.info('AUTH', 'Checking biometrics availability');

      // Biometrics only available on native platforms
      if (Platform.OS === 'web') {
        activityLogger.info('AUTH', 'Biometrics not available on web');
        setBiometricsAvailable(false);
        return;
      }

      const checkOnce = async (): Promise<boolean> => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        return compatible && enrolled;
      };

      let available = await checkOnce();
      activityLogger.debug('AUTH', 'Biometrics first check result', { available });

      // If not available, check if user previously had biometrics enabled.
      // If so, retry up to 3 times (handles transient Android startup failures).
      if (!available) {
        const storedBiometrics = await getSecureItem(BIOMETRICS_KEY);
        if (storedBiometrics === 'true') {
          activityLogger.warn('AUTH', 'Biometrics not available on first check but previously enabled — retrying');
          for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 500));
            available = await checkOnce();
            activityLogger.debug('AUTH', `Biometrics retry ${i + 1}`, { available });
            if (available) break;
          }
        }
      }

      setBiometricsAvailable(available);
      activityLogger.info('AUTH', 'Biometrics availability check complete', { available });
    } catch (error) {
      console.error('AuthContext: Error checking biometrics:', error);
      activityLogger.error('AUTH', 'Error checking biometrics', { error: String(error) });
      setBiometricsAvailable(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const biometrics = await getSecureItem(BIOMETRICS_KEY);
      const pinAuth = await getSecureItem(PIN_AUTH_KEY);
      const lockResume = await getSecureItem(LOCK_ON_RESUME_KEY);
      
      setBiometricsEnabledState(biometrics === 'true');
      setPinAuthEnabledState(pinAuth !== 'false'); // Default to true
      setLockOnResumeState(lockResume !== 'false'); // Default to true
    } catch (error) {
      console.error('AuthContext: Failed to load settings:', error);
    }
  }, []);

  const checkSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      const setupDone = await getSecureItem(SETUP_COMPLETE_KEY);
      const storedPin = await getSecureItem(PIN_KEY);
      
      // Setup is complete if both the flag is set AND a PIN exists
      const isComplete = setupDone === 'true' && !!storedPin;
      setSetupComplete(isComplete);
      return isComplete;
    } catch (error) {
      console.error('AuthContext: Error checking setup status:', error);
      setSetupComplete(false);
      return false;
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      await loadSettings();
      await checkBiometricsAvailability();
      await checkSetupStatus();
    } catch (error) {
      console.error('AuthContext: Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  }, [checkBiometricsAvailability, loadSettings, checkSetupStatus]);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Handle app state changes with time-based locking
  useEffect(() => {
    const isHandlingRef = { current: false };
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (isHandlingRef.current) { appStateRef.current = nextAppState; return; }
      isHandlingRef.current = true;
      try {
      const currentAppState = appStateRef.current;
      
      // App going to background - record the time
      if (currentAppState === 'active' && nextAppState.match(/inactive|background/)) {
        const now = Date.now();
        lastBackgroundTimeRef.current = now;
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, now.toString());
      }
      
      // App coming back to foreground - check time elapsed
      if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        if (!isAuthenticatedRef.current) {
          return;
        }
        
        // Get the time when app went to background
        const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
        const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
        
        if (!lastBackgroundTime) {
          setIsAuthenticated(false);
          return;
        }
        
        const now = Date.now();
        const timeElapsed = now - lastBackgroundTime;
        
        // If more than 1 hour, lock and return to home
        if (timeElapsed >= LOCK_TIMEOUT) {
          setIsAuthenticated(false);
        }
        // If between 30 minutes and 1 hour, lock but allow resume to current page
        else if (timeElapsed >= RESUME_TIMEOUT && lockOnResumeRef.current) {
          setIsAuthenticated(false);
        }
        // If less than 30 minutes, allow resume without lock
      }

      appStateRef.current = nextAppState;
      } finally {
        isHandlingRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []); // Empty dependency array - uses refs instead

  const login = useCallback(async (pin: string): Promise<boolean> => {
    try {
      activityLogger.info('AUTH', 'Attempting PIN login');
      const storedPin = await getSecureItem(PIN_KEY);
      
      if (!storedPin) {
        console.error('AuthContext: No stored PIN found');
        activityLogger.error('AUTH', 'Login failed — no stored PIN found');
        return false;
      }
      
      if (storedPin === pin) {
        activityLogger.info('AUTH', 'Login success — PIN verified');
        setIsAuthenticated(true);
        // Clear the background time on successful login (use '0' to avoid parseInt('', 10) = NaN)
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, '0');
        lastBackgroundTimeRef.current = null;
        return true;
      }
      
      activityLogger.warn('AUTH', 'Login failure — incorrect PIN');
      return false;
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      activityLogger.error('AUTH', 'Login error', { error: String(error) });
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    activityLogger.info('AUTH', 'Logout');
    setIsAuthenticated(false);
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      // Check if biometrics are available
      if (enabled && !biometricsAvailable) {
        console.error('AuthContext: Cannot enable biometrics - not available');
        return false;
      }
      
      await setSecureItem(BIOMETRICS_KEY, enabled.toString());
      setBiometricsEnabledState(enabled);
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to save biometrics setting:', error);
      return false;
    }
  }, [biometricsAvailable]);

  const setPinAuthEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      // If disabling PIN, biometrics must be enabled
      if (!enabled && !biometricsEnabled) {
        console.error('AuthContext: Cannot disable PIN - biometrics not enabled');
        return false;
      }
      
      await setSecureItem(PIN_AUTH_KEY, enabled.toString());
      setPinAuthEnabledState(enabled);
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to save PIN auth setting:', error);
      return false;
    }
  }, [biometricsEnabled]);

  const setLockOnResume = useCallback(async (enabled: boolean) => {
    try {
      await setSecureItem(LOCK_ON_RESUME_KEY, enabled.toString());
      setLockOnResumeState(enabled);
    } catch (error) {
      console.error('AuthContext: Failed to save lock on resume setting:', error);
    }
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    try {
      const storedPin = await getSecureItem(PIN_KEY);
      
      if (storedPin !== currentPin) {
        return false;
      }
      
      await setSecureItem(PIN_KEY, newPin);
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to change PIN:', error);
      return false;
    }
  }, []);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const currentBiometricsAvailable = biometricsAvailableRef.current;
      const currentBiometricsEnabled = biometricsEnabledRef.current;
      activityLogger.info('AUTH', 'Attempting biometric authentication', { biometricsAvailable: currentBiometricsAvailable, biometricsEnabled: currentBiometricsEnabled });
      
      // Check if biometrics are available on native platforms
      if (Platform.OS === 'web') {
        activityLogger.info('AUTH', 'Biometric auth skipped — web platform');
        return false;
      }
      
      if (!currentBiometricsAvailable) {
        // Log but don't bail out — availability check may have been transient on Android.
        // Let the OS attempt auth and fail naturally if truly unavailable.
        activityLogger.warn('AUTH', 'biometricsAvailable is false — attempting auth anyway (may be transient)');
      }

      // Check if biometrics are enabled in settings
      if (!currentBiometricsEnabled) {
        activityLogger.info('AUTH', 'Biometric auth skipped — not enabled in settings');
        return false;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        activityLogger.info('AUTH', 'Biometric authentication successful');
        setIsAuthenticated(true);
        // Clear the background time on successful login (use '0' to avoid parseInt('', 10) = NaN)
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, '0');
        lastBackgroundTimeRef.current = null;
        return true;
      }
      
      activityLogger.warn('AUTH', 'Biometric authentication failed or cancelled', { error: (result as any).error });
      return false;
    } catch (error) {
      console.error('AuthContext: Error with biometric authentication:', error);
      activityLogger.error('AUTH', 'Biometric authentication error', { error: String(error) });
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setupComplete,
        biometricsEnabled,
        pinAuthEnabled,
        lockOnResume,
        biometricsAvailable,
        loading,
        login,
        logout,
        setBiometricsEnabled,
        setPinAuthEnabled,
        setLockOnResume,
        changePin,
        authenticateWithBiometrics,
        checkSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
