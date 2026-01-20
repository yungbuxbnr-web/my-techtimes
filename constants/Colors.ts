
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

// TechTimes Workshop Themes - Premium Blue Corporate Palette
export const workshopThemes = {
  dark: {
    background: '#0a0e1a', // Deep blue-black
    card: '#1a2332', // Dark blue-grey card
    text: '#ffffff',
    textSecondary: '#94a3b8',
    primary: '#3b82f6', // Bright corporate blue
    secondary: '#2563eb', // Deeper blue
    accent: '#60a5fa', // Light blue accent
    border: '#1e293b',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    chartGreen: '#22c55e',
    chartYellow: '#eab308',
    chartRed: '#ef4444',
  },
  light: {
    background: '#f1f5f9', // Light blue-grey
    card: '#ffffff',
    text: '#0f172a',
    textSecondary: '#64748b',
    primary: '#3b82f6', // Bright corporate blue
    secondary: '#2563eb', // Deeper blue
    accent: '#60a5fa', // Light blue accent
    border: '#e2e8f0',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    chartGreen: '#22c55e',
    chartYellow: '#eab308',
    chartRed: '#ef4444',
  },
};
