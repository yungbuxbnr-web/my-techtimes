
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus } from 'react-native';
import { authClient } from '@/lib/auth';
import { useRouter } from 'expo-router';

interface AuthContextType {
  isAuthenticated: boolean;
  biometricsEnabled: boolean;
  lockOnResume: boolean;
  biometricsAvailable: boolean;
  loading: boolean;
  user: any;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setBiometricsEnabled: (enabled: boolean) => void;
  setLockOnResume: (enabled: boolean) => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkBiometricsAvailability();
    loadSettings();
    checkAuthStatus();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [lockOnResume, isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      console.log('AuthContext: Checking authentication status');
      const session = await authClient.getSession();
      if (session?.user) {
        console.log('AuthContext: User is authenticated:', session.user.email);
        setIsAuthenticated(true);
        setUser(session.user);
      } else {
        console.log('AuthContext: No active session');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('AuthContext: Error checking auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

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

  const signInWithEmail = async (email: string, password: string) => {
    console.log('AuthContext: Signing in with email:', email);
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await checkAuthStatus();
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log('AuthContext: Signing up with email:', email);
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await checkAuthStatus();
  };

  const signInWithGoogle = async () => {
    console.log('AuthContext: Signing in with Google');
    const result = await authClient.signIn.social({ provider: 'google' });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await checkAuthStatus();
  };

  const signInWithApple = async () => {
    console.log('AuthContext: Signing in with Apple');
    const result = await authClient.signIn.social({ provider: 'apple' });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await checkAuthStatus();
  };

  const signInWithGitHub = async () => {
    console.log('AuthContext: Signing in with GitHub');
    const result = await authClient.signIn.social({ provider: 'github' });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await checkAuthStatus();
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

  const logout = async () => {
    console.log('AuthContext: Logging out');
    await authClient.signOut();
    setIsAuthenticated(false);
    setUser(null);
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
        loading,
        user,
        login,
        logout,
        setBiometricsEnabled,
        setLockOnResume,
        changePin,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
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
