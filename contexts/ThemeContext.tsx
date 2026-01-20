
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { workshopThemes } from '@/constants/Colors';
import { ImageSourcePropType, Platform } from 'react-native';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: typeof workshopThemes.dark;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  overlayStrength: number;
  setOverlayStrength: (value: number) => void;
  backgroundImage: ImageSourcePropType;
  currentBackgroundIndex: number;
  rotateBackground: () => void;
}

// Workshop-themed background images
const darkWorkshopBackgrounds: ImageSourcePropType[] = [
  { uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&q=80' }, // Dark workshop bay
  { uri: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1200&q=80' }, // Tools and equipment
  { uri: 'https://images.unsplash.com/photo-1632823469850-1b4942f4e2e5?w=1200&q=80' }, // Engine bay work
];

const lightWorkshopBackgrounds: ImageSourcePropType[] = [
  { uri: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200&q=80' }, // Bright clean workshop
  { uri: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1200&q=80' }, // Modern workshop
  { uri: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200&q=80' }, // Clean garage
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper functions for cross-platform storage
async function setSecureItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error('ThemeContext: Error setting item:', key, error);
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
    console.error('ThemeContext: Error getting item:', key, error);
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [overlayStrength, setOverlayStrengthState] = useState(0.35); // Default 35% for dark mode
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      console.log('ThemeProvider: Loading theme settings');
      loadThemeSettings();
      setInitialized(true);
    }
  }, [initialized]);

  const loadThemeSettings = async () => {
    try {
      const savedTheme = await getSecureItem('themeMode');
      const savedOverlay = await getSecureItem('overlayStrength');
      const savedBgIndex = await getSecureItem('backgroundIndex');
      
      if (savedTheme) {
        console.log('ThemeProvider: Loaded theme mode:', savedTheme);
        setThemeMode(savedTheme as ThemeMode);
      }
      if (savedOverlay) {
        console.log('ThemeProvider: Loaded overlay strength:', savedOverlay);
        setOverlayStrengthState(parseFloat(savedOverlay));
      } else {
        // Set default overlay based on theme
        const defaultOverlay = savedTheme === 'light' ? 0.15 : 0.35;
        setOverlayStrengthState(defaultOverlay);
      }
      if (savedBgIndex) {
        setCurrentBackgroundIndex(parseInt(savedBgIndex, 10));
      }
    } catch (error) {
      console.error('ThemeProvider: Error loading theme settings:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    console.log('ThemeProvider: Toggling theme to:', newTheme);
    setThemeMode(newTheme);
    
    // Adjust overlay strength for the new theme if it's at default
    const newDefaultOverlay = newTheme === 'light' ? 0.15 : 0.35;
    setOverlayStrengthState(newDefaultOverlay);
    
    try {
      await setSecureItem('themeMode', newTheme);
      await setSecureItem('overlayStrength', newDefaultOverlay.toString());
    } catch (error) {
      console.error('ThemeProvider: Error saving theme:', error);
    }
  };

  const setOverlayStrength = async (value: number) => {
    console.log('ThemeProvider: Setting overlay strength to:', value);
    setOverlayStrengthState(value);
    try {
      await setSecureItem('overlayStrength', value.toString());
    } catch (error) {
      console.error('ThemeProvider: Error saving overlay strength:', error);
    }
  };

  const rotateBackground = async () => {
    const backgrounds = themeMode === 'dark' ? darkWorkshopBackgrounds : lightWorkshopBackgrounds;
    const newIndex = (currentBackgroundIndex + 1) % backgrounds.length;
    console.log('ThemeProvider: Rotating background to index:', newIndex);
    setCurrentBackgroundIndex(newIndex);
    try {
      await setSecureItem('backgroundIndex', newIndex.toString());
    } catch (error) {
      console.error('ThemeProvider: Error saving background index:', error);
    }
  };

  const theme = workshopThemes[themeMode];
  const isDarkMode = themeMode === 'dark';
  const backgrounds = isDarkMode ? darkWorkshopBackgrounds : lightWorkshopBackgrounds;
  const backgroundImage = backgrounds[currentBackgroundIndex % backgrounds.length];

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        themeMode, 
        isDarkMode,
        toggleTheme, 
        overlayStrength, 
        setOverlayStrength,
        backgroundImage,
        currentBackgroundIndex,
        rotateBackground,
      }}
    >
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
