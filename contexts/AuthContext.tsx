
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus, Platform } from 'react-native';

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
  
  // Update refs when state changes
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  
  useEffect(() => {
    lockOnResumeRef.current = lockOnResume;
  }, [lockOnResume]);

  const checkBiometricsAvailability = useCallback(async () => {
    try {
      console.log('AuthContext: Checking biometrics availability');
      
      // Biometrics only available on native platforms
      if (Platform.OS === 'web') {
        console.log('AuthContext: Biometrics not available on web');
        setBiometricsAvailable(false);
        return;
      }
      
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      setBiometricsAvailable(available);
      console.log('AuthContext: Biometrics available:', available);
      
      // If biometrics become unavailable, disable the setting
      if (!available) {
        const currentBiometrics = await getSecureItem(BIOMETRICS_KEY);
        if (currentBiometrics === 'true') {
          console.log('AuthContext: Biometrics no longer available, disabling');
          await setSecureItem(BIOMETRICS_KEY, 'false');
          setBiometricsEnabledState(false);
        }
      }
    } catch (error) {
      console.error('AuthContext: Error checking biometrics:', error);
      setBiometricsAvailable(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      console.log('AuthContext: Loading settings');
      const biometrics = await getSecureItem(BIOMETRICS_KEY);
      const pinAuth = await getSecureItem(PIN_AUTH_KEY);
      const lockResume = await getSecureItem(LOCK_ON_RESUME_KEY);
      
      setBiometricsEnabledState(biometrics === 'true');
      setPinAuthEnabledState(pinAuth !== 'false'); // Default to true
      setLockOnResumeState(lockResume !== 'false'); // Default to true
      console.log('AuthContext: Settings loaded - biometrics:', biometrics === 'true', 'pinAuth:', pinAuth !== 'false', 'lockOnResume:', lockResume !== 'false');
    } catch (error) {
      console.error('AuthContext: Failed to load settings:', error);
    }
  }, []);

  const checkSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      console.log('AuthContext: Checking setup status');
      const setupDone = await getSecureItem(SETUP_COMPLETE_KEY);
      const storedPin = await getSecureItem(PIN_KEY);
      
      // Setup is complete if both the flag is set AND a PIN exists
      const isComplete = setupDone === 'true' && !!storedPin;
      console.log('AuthContext: Setup complete:', isComplete, 'setupDone:', setupDone, 'hasPin:', !!storedPin);
      setSetupComplete(isComplete);
      return isComplete;
    } catch (error) {
      console.error('AuthContext: Error checking setup status:', error);
      setSetupComplete(false);
      return false;
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    console.log('AuthContext: Initializing authentication');
    try {
      await checkBiometricsAvailability();
      await loadSettings();
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
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const currentAppState = AppState.currentState;
      
      // App going to background - record the time
      if (currentAppState === 'active' && nextAppState.match(/inactive|background/)) {
        const now = Date.now();
        lastBackgroundTimeRef.current = now;
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, now.toString());
        console.log('AuthContext: App going to background at', new Date(now).toISOString());
      }
      
      // App coming back to foreground - check time elapsed
      if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('AuthContext: App resuming from background');
        
        if (!isAuthenticatedRef.current) {
          console.log('AuthContext: User not authenticated, no action needed');
          return;
        }
        
        // Get the time when app went to background
        const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
        const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
        
        if (!lastBackgroundTime) {
          console.log('AuthContext: No background time recorded, locking as precaution');
          setIsAuthenticated(false);
          return;
        }
        
        const now = Date.now();
        const timeElapsed = now - lastBackgroundTime;
        const minutesElapsed = Math.floor(timeElapsed / 60000);
        
        console.log('AuthContext: Time elapsed since background:', minutesElapsed, 'minutes');
        
        // If more than 1 hour, lock and return to home
        if (timeElapsed >= LOCK_TIMEOUT) {
          console.log('AuthContext: More than 1 hour elapsed, locking and returning to home');
          setIsAuthenticated(false);
          // The app will redirect to pin-login, and after login will go to home
        }
        // If between 30 minutes and 1 hour, lock but allow resume to current page
        else if (timeElapsed >= RESUME_TIMEOUT && lockOnResumeRef.current) {
          console.log('AuthContext: Between 30 min and 1 hour elapsed, locking (will resume to current page)');
          setIsAuthenticated(false);
          // The app will redirect to pin-login, but will resume to current page after login
        }
        // If less than 30 minutes, allow resume without lock
        else {
          console.log('AuthContext: Less than 30 minutes elapsed, allowing resume without lock');
          // No action needed, user stays authenticated
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []); // Empty dependency array - uses refs instead

  const login = useCallback(async (pin: string): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting login with PIN');
      const storedPin = await getSecureItem(PIN_KEY);
      
      if (!storedPin) {
        console.error('AuthContext: No stored PIN found');
        return false;
      }
      
      if (storedPin === pin) {
        console.log('AuthContext: PIN verified successfully');
        setIsAuthenticated(true);
        // Clear the background time on successful login
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, '');
        lastBackgroundTimeRef.current = null;
        return true;
      }
      
      console.log('AuthContext: Incorrect PIN');
      return false;
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    console.log('AuthContext: Logging out');
    setIsAuthenticated(false);
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      console.log('AuthContext: Setting biometrics enabled:', enabled);
      
      // Check if biometrics are available
      if (enabled && !biometricsAvailable) {
        console.error('AuthContext: Cannot enable biometrics - not available');
        return false;
      }
      
      await setSecureItem(BIOMETRICS_KEY, enabled.toString());
      setBiometricsEnabledState(enabled);
      console.log('AuthContext: Biometrics setting saved');
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to save biometrics setting:', error);
      return false;
    }
  }, [biometricsAvailable]);

  const setPinAuthEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      console.log('AuthContext: Setting PIN auth enabled:', enabled);
      
      // If disabling PIN, biometrics must be enabled
      if (!enabled && !biometricsEnabled) {
        console.error('AuthContext: Cannot disable PIN - biometrics not enabled');
        return false;
      }
      
      await setSecureItem(PIN_AUTH_KEY, enabled.toString());
      setPinAuthEnabledState(enabled);
      console.log('AuthContext: PIN auth setting saved');
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to save PIN auth setting:', error);
      return false;
    }
  }, [biometricsEnabled]);

  const setLockOnResume = useCallback(async (enabled: boolean) => {
    try {
      console.log('AuthContext: Setting lock on resume:', enabled);
      await setSecureItem(LOCK_ON_RESUME_KEY, enabled.toString());
      setLockOnResumeState(enabled);
    } catch (error) {
      console.error('AuthContext: Failed to save lock on resume setting:', error);
    }
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting to change PIN');
      const storedPin = await getSecureItem(PIN_KEY);
      
      if (storedPin !== currentPin) {
        console.log('AuthContext: Current PIN incorrect');
        return false;
      }
      
      await setSecureItem(PIN_KEY, newPin);
      console.log('AuthContext: PIN changed successfully');
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to change PIN:', error);
      return false;
    }
  }, []);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting biometric authentication');
      
      // Check if biometrics are available on native platforms
      if (Platform.OS === 'web') {
        console.log('AuthContext: Biometrics not available on web');
        return false;
      }
      
      if (!biometricsAvailable) {
        console.error('AuthContext: Biometrics not available on device');
        return false;
      }
      
      // Check if biometrics are enabled in settings
      if (!biometricsEnabled) {
        console.log('AuthContext: Biometrics not enabled in settings');
        return false;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log('AuthContext: Biometric authentication successful');
        setIsAuthenticated(true);
        // Clear the background time on successful login
        await setSecureItem(LAST_BACKGROUND_TIME_KEY, '');
        lastBackgroundTimeRef.current = null;
        return true;
      }
      
      console.log('AuthContext: Biometric authentication failed or cancelled');
      return false;
    } catch (error) {
      console.error('AuthContext: Error with biometric authentication:', error);
      return false;
    }
  }, [biometricsAvailable, biometricsEnabled]);

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
