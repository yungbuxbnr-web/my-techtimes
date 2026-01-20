
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus } from 'react-native';

interface AuthContextType {
  isAuthenticated: boolean;
  biometricsEnabled: boolean;
  lockOnResume: boolean;
  biometricsAvailable: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setBiometricsEnabled: (enabled: boolean) => void;
  setLockOnResume: (enabled: boolean) => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIN_KEY = 'user_pin';
const BIOMETRICS_KEY = 'biometrics_enabled';
const LOCK_ON_RESUME_KEY = 'lock_on_resume';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [lockOnResume, setLockOnResumeState] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    checkBiometricsAvailability();
    loadSettings();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [lockOnResume, isAuthenticated]);

  const checkBiometricsAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricsAvailable(compatible && enrolled);
  };

  const loadSettings = async () => {
    try {
      const biometrics = await SecureStore.getItemAsync(BIOMETRICS_KEY);
      const lockResume = await SecureStore.getItemAsync(LOCK_ON_RESUME_KEY);
      
      setBiometricsEnabledState(biometrics === 'true');
      setLockOnResumeState(lockResume !== 'false'); // Default to true
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      if (lockOnResume && isAuthenticated) {
        console.log('App resumed, locking...');
        setIsAuthenticated(false);
      }
    }
    setAppState(nextAppState);
  };

  const login = async (pin: string): Promise<boolean> => {
    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      // If no PIN is set, set this as the new PIN
      if (!storedPin) {
        await SecureStore.setItemAsync(PIN_KEY, pin);
        setIsAuthenticated(true);
        return true;
      }
      
      // Verify PIN
      if (storedPin === pin) {
        setIsAuthenticated(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const setBiometricsEnabled = async (enabled: boolean) => {
    try {
      await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled.toString());
      setBiometricsEnabledState(enabled);
    } catch (error) {
      console.error('Failed to save biometrics setting:', error);
    }
  };

  const setLockOnResume = async (enabled: boolean) => {
    try {
      await SecureStore.setItemAsync(LOCK_ON_RESUME_KEY, enabled.toString());
      setLockOnResumeState(enabled);
    } catch (error) {
      console.error('Failed to save lock on resume setting:', error);
    }
  };

  const changePin = async (currentPin: string, newPin: string): Promise<boolean> => {
    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      if (storedPin !== currentPin) {
        return false;
      }
      
      await SecureStore.setItemAsync(PIN_KEY, newPin);
      return true;
    } catch (error) {
      console.error('Failed to change PIN:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        biometricsEnabled,
        lockOnResume,
        biometricsAvailable,
        login,
        logout,
        setBiometricsEnabled,
        setLockOnResume,
        changePin,
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
