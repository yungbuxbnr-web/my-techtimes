
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { workshopThemes } from '@/constants/Colors';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: typeof workshopThemes.dark;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  overlayStrength: number;
  setOverlayStrength: (value: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [overlayStrength, setOverlayStrengthState] = useState(0.7);

  useEffect(() => {
    console.log('ThemeProvider: Loading theme settings from SecureStore');
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('themeMode');
      const savedOverlay = await SecureStore.getItemAsync('overlayStrength');
      
      if (savedTheme) {
        console.log('ThemeProvider: Loaded theme mode:', savedTheme);
        setThemeMode(savedTheme as ThemeMode);
      }
      if (savedOverlay) {
        console.log('ThemeProvider: Loaded overlay strength:', savedOverlay);
        setOverlayStrengthState(parseFloat(savedOverlay));
      }
    } catch (error) {
      console.error('ThemeProvider: Error loading theme settings:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    console.log('ThemeProvider: Toggling theme to:', newTheme);
    setThemeMode(newTheme);
    try {
      await SecureStore.setItemAsync('themeMode', newTheme);
    } catch (error) {
      console.error('ThemeProvider: Error saving theme:', error);
    }
  };

  const setOverlayStrength = async (value: number) => {
    console.log('ThemeProvider: Setting overlay strength to:', value);
    setOverlayStrengthState(value);
    try {
      await SecureStore.setItemAsync('overlayStrength', value.toString());
    } catch (error) {
      console.error('ThemeProvider: Error saving overlay strength:', error);
    }
  };

  const theme = workshopThemes[themeMode];

  return (
    <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, overlayStrength, setOverlayStrength }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}
