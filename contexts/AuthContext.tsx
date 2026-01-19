
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus } from 'react-native';

interface AuthContextType {
  isAuthenticated: boolean;
  pin: string;
  biometricsEnabled: boolean;
  lockOnResume: boolean;
  biometricsAvailable: boolean;
  login: (enteredPin: string) => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  logout: () => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  setLockOnResume: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PIN = '3101';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState(DEFAULT_PIN);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [lockOnResume, setLockOnResumeState] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication settings');
    loadAuthSettings();
    checkBiometrics();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('AuthProvider: App state changed to:', nextAppState);
    if (nextAppState === 'background' && lockOnResume && isAuthenticated) {
      console.log('AuthProvider: App going to background, locking app');
      setIsAuthenticated(false);
    }
  };

  const loadAuthSettings = async () => {
    try {
      const savedPin = await SecureStore.getItemAsync('userPin');
      const savedBiometrics = await SecureStore.getItemAsync('biometricsEnabled');
      const savedLockOnResume = await SecureStore.getItemAsync('lockOnResume');

      if (savedPin) {
        console.log('AuthProvider: Loaded custom PIN');
        setPin(savedPin);
      }
      if (savedBiometrics) {
        console.log('AuthProvider: Biometrics enabled:', savedBiometrics);
        setBiometricsEnabledState(savedBiometrics === 'true');
      }
      if (savedLockOnResume !== null) {
        console.log('AuthProvider: Lock on resume:', savedLockOnResume);
        setLockOnResumeState(savedLockOnResume === 'true');
      }
    } catch (error) {
      console.error('AuthProvider: Error loading auth settings:', error);
    }
  };

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      console.log('AuthProvider: Biometrics available:', available);
      setBiometricsAvailable(available);
    } catch (error) {
      console.error('AuthProvider: Error checking biometrics:', error);
      setBiometricsAvailable(false);
    }
  };

  const login = async (enteredPin: string): Promise<boolean> => {
    console.log('AuthProvider: Attempting PIN login');
    if (enteredPin === pin) {
      console.log('AuthProvider: PIN login successful');
      setIsAuthenticated(true);
      return true;
    }
    console.log('AuthProvider: PIN login failed');
    return false;
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    if (!biometricsAvailable || !biometricsEnabled) {
      console.log('AuthProvider: Biometrics not available or not enabled');
      return false;
    }

    try {
      console.log('AuthProvider: Attempting biometric authentication');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        console.log('AuthProvider: Biometric authentication successful');
        setIsAuthenticated(true);
        return true;
      }
      console.log('AuthProvider: Biometric authentication failed');
      return false;
    } catch (error) {
      console.error('AuthProvider: Biometric authentication error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('AuthProvider: User logged out');
    setIsAuthenticated(false);
  };

  const changePin = async (currentPin: string, newPin: string): Promise<boolean> => {
    console.log('AuthProvider: Attempting to change PIN');
    if (currentPin !== pin) {
      console.log('AuthProvider: Current PIN incorrect');
      return false;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      console.log('AuthProvider: New PIN invalid format');
      return false;
    }

    try {
      await SecureStore.setItemAsync('userPin', newPin);
      setPin(newPin);
      console.log('AuthProvider: PIN changed successfully');
      return true;
    } catch (error) {
      console.error('AuthProvider: Error changing PIN:', error);
      return false;
    }
  };

  const setBiometricsEnabled = async (enabled: boolean) => {
    console.log('AuthProvider: Setting biometrics enabled to:', enabled);
    setBiometricsEnabledState(enabled);
    try {
      await SecureStore.setItemAsync('biometricsEnabled', enabled.toString());
    } catch (error) {
      console.error('AuthProvider: Error saving biometrics setting:', error);
    }
  };

  const setLockOnResume = async (enabled: boolean) => {
    console.log('AuthProvider: Setting lock on resume to:', enabled);
    setLockOnResumeState(enabled);
    try {
      await SecureStore.setItemAsync('lockOnResume', enabled.toString());
    } catch (error) {
      console.error('AuthProvider: Error saving lock on resume setting:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        pin,
        biometricsEnabled,
        lockOnResume,
        biometricsAvailable,
        login,
        loginWithBiometrics,
        logout,
        changePin,
        setBiometricsEnabled,
        setLockOnResume,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
