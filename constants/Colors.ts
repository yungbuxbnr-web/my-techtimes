
export const zincColors = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

export const appleBlue = '#007AFF';
export const appleRed = '#FF3B30';

export function borderColor(isDark: boolean) {
  return isDark ? zincColors[800] : zincColors[200];
}

// TechTimes Workshop Themes
export const workshopThemes = {
  dark: {
    background: '#0a0a0a',
    card: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    primary: '#ff6b35', // Orange - automotive/workshop accent
    secondary: '#ffa500',
    accent: '#ffcc00',
    border: '#27272a',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  },
  light: {
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#18181b',
    textSecondary: '#52525b',
    primary: '#ff6b35',
    secondary: '#ff8c42',
    accent: '#ffa500',
    border: '#e4e4e7',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  },
};
