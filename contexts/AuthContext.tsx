
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';

interface AuthContextType {
  isAuthenticated: boolean;
  setupComplete: boolean;
  biometricsEnabled: boolean;
  lockOnResume: boolean;
  biometricsAvailable: boolean;
  loading: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
  setLockOnResume: (enabled: boolean) => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIN_KEY = 'user_pin';
const BIOMETRICS_KEY = 'biometrics_enabled';
const LOCK_ON_RESUME_KEY = 'lock_on_resume';
const SETUP_COMPLETE_KEY = 'setup_complete';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [lockOnResume, setLockOnResumeState] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [lockOnResume, isAuthenticated]);

  const initializeAuth = async () => {
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
  };

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      console.log('AuthContext: Checking setup status');
      const setupDone = await SecureStore.getItemAsync(SETUP_COMPLETE_KEY);
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      // Setup is complete if both the flag is set AND a PIN exists
      const isComplete = setupDone === 'true' && !!storedPin;
      console.log('AuthContext: Setup complete:', isComplete);
      setSetupComplete(isComplete);
      return isComplete;
    } catch (error) {
      console.error('AuthContext: Error checking setup status:', error);
      setSetupComplete(false);
      return false;
    }
  };

  const checkBiometricsAvailability = async () => {
    try {
      console.log('AuthContext: Checking biometrics availability');
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      setBiometricsAvailable(available);
      console.log('AuthContext: Biometrics available:', available);
      
      // If biometrics become unavailable, disable the setting
      if (!available && biometricsEnabled) {
        console.log('AuthContext: Biometrics no longer available, disabling');
        await setBiometricsEnabled(false);
      }
    } catch (error) {
      console.error('AuthContext: Error checking biometrics:', error);
      setBiometricsAvailable(false);
    }
  };

  const loadSettings = async () => {
    try {
      console.log('AuthContext: Loading settings');
      const biometrics = await SecureStore.getItemAsync(BIOMETRICS_KEY);
      const lockResume = await SecureStore.getItemAsync(LOCK_ON_RESUME_KEY);
      
      setBiometricsEnabledState(biometrics === 'true');
      setLockOnResumeState(lockResume !== 'false'); // Default to true
      console.log('AuthContext: Settings loaded - biometrics:', biometrics === 'true', 'lockOnResume:', lockResume !== 'false');
    } catch (error) {
      console.error('AuthContext: Failed to load settings:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      if (lockOnResume && isAuthenticated) {
        console.log('AuthContext: App resumed, locking due to lockOnResume setting');
        setIsAuthenticated(false);
      }
    }
    setAppState(nextAppState);
  };

  const login = async (pin: string): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting login with PIN');
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      if (!storedPin) {
        console.error('AuthContext: No stored PIN found');
        return false;
      }
      
      if (storedPin === pin) {
        console.log('AuthContext: PIN verified successfully');
        setIsAuthenticated(true);
        return true;
      }
      
      console.log('AuthContext: Incorrect PIN');
      return false;
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('AuthContext: Logging out');
    setIsAuthenticated(false);
  };

  const setBiometricsEnabled = async (enabled: boolean): Promise<boolean> => {
    try {
      console.log('AuthContext: Setting biometrics enabled:', enabled);
      
      // Check if biometrics are available
      if (enabled && !biometricsAvailable) {
        console.error('AuthContext: Cannot enable biometrics - not available');
        return false;
      }
      
      await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled.toString());
      setBiometricsEnabledState(enabled);
      console.log('AuthContext: Biometrics setting saved');
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to save biometrics setting:', error);
      return false;
    }
  };

  const setLockOnResume = async (enabled: boolean) => {
    try {
      console.log('AuthContext: Setting lock on resume:', enabled);
      await SecureStore.setItemAsync(LOCK_ON_RESUME_KEY, enabled.toString());
      setLockOnResumeState(enabled);
    } catch (error) {
      console.error('AuthContext: Failed to save lock on resume setting:', error);
    }
  };

  const changePin = async (currentPin: string, newPin: string): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting to change PIN');
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      if (storedPin !== currentPin) {
        console.log('AuthContext: Current PIN incorrect');
        return false;
      }
      
      await SecureStore.setItemAsync(PIN_KEY, newPin);
      console.log('AuthContext: PIN changed successfully');
      return true;
    } catch (error) {
      console.error('AuthContext: Failed to change PIN:', error);
      return false;
    }
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      console.log('AuthContext: Attempting biometric authentication');
      
      if (!biometricsAvailable) {
        console.error('AuthContext: Biometrics not available');
        return false;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        console.log('AuthContext: Biometric authentication successful');
        setIsAuthenticated(true);
        return true;
      }
      
      console.log('AuthContext: Biometric authentication failed');
      return false;
    } catch (error) {
      console.error('AuthContext: Error with biometric authentication:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setupComplete,
        biometricsEnabled,
        lockOnResume,
        biometricsAvailable,
        loading,
        login,
        logout,
        setBiometricsEnabled,
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
