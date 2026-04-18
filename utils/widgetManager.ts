
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { offlineStorage } from './offlineStorage';

// Lazy-load ExtensionStorage to avoid crashing on Android/web
let _ExtensionStorage: typeof import('@bacons/apple-targets').ExtensionStorage | null = null;
async function getExtensionStorage() {
  if (Platform.OS !== 'ios') return null;
  if (!_ExtensionStorage) {
    try {
      const mod = await import('@bacons/apple-targets');
      _ExtensionStorage = mod.ExtensionStorage;
    } catch {
      return null;
    }
  }
  return _ExtensionStorage;
}

// Widget data storage key
const WIDGET_DATA_KEY = '@techtimes_widget_data';

export interface WidgetData {
  todayAW: number;
  todayJobs: number;
  todayHours: string; // formatted as hh:mm
  lastBackupDate: string | null;
  lastBackupDaysAgo: number | null;
  latestJobWIP: string | null;
  latestJobReg: string | null;
  currentStreak: number | null;
  lastUpdated: string;
}

/**
 * Calculate daily aggregates for widget display
 */
async function calculateDailyAggregates(): Promise<WidgetData> {
  console.log('WidgetManager: Calculating daily aggregates');
  
  // Get today's jobs
  const todayJobs = await offlineStorage.getTodayJobs();
  const todayAW = todayJobs.reduce((sum, job) => sum + job.aw, 0);
  const todayMinutes = todayAW * 5;
  const hours = Math.floor(todayMinutes / 60);
  const minutes = todayMinutes % 60;
  const todayHours = `${hours}:${String(minutes).padStart(2, '0')}`;

  // Get latest job
  const recentJobs = await offlineStorage.getRecentJobs(1);
  const latestJob = recentJobs.length > 0 ? recentJobs[0] : null;

  // Get last backup date (from settings or a dedicated backup timestamp)
  // For now, we'll use a placeholder - this should be updated when backup is performed
  const lastBackupTimestamp = await AsyncStorage.getItem('@techtimes_last_backup');
  let lastBackupDate: string | null = null;
  let lastBackupDaysAgo: number | null = null;
  
  if (lastBackupTimestamp) {
    lastBackupDate = lastBackupTimestamp;
    const backupDate = new Date(lastBackupTimestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - backupDate.getTime());
    lastBackupDaysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Get current streak (if streaks are enabled)
  const settings = await offlineStorage.getSettings();
  let currentStreak: number | null = null;
  
  if (settings.streaksEnabled) {
    try {
      // Calculate streaks
      const allJobs = await offlineStorage.getAllJobs();
      const jobsByDay = new Map<string, number>();
      
      allJobs.forEach(job => {
        const day = job.createdAt.split('T')[0];
        jobsByDay.set(day, (jobsByDay.get(day) || 0) + 1);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let streakDate = jobsByDay.has(todayStr) ? new Date(today) : jobsByDay.has(yesterdayStr) ? new Date(yesterday) : null;

      if (streakDate) {
        currentStreak = 0;
        while (true) {
          const dateStr = streakDate.toISOString().split('T')[0];
          if (jobsByDay.has(dateStr)) {
            currentStreak++;
            streakDate.setDate(streakDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    } catch (error) {
      console.error('WidgetManager: Error calculating streak:', error);
    }
  }

  const widgetData: WidgetData = {
    todayAW,
    todayJobs: todayJobs.length,
    todayHours,
    lastBackupDate,
    lastBackupDaysAgo,
    latestJobWIP: latestJob?.wipNumber || null,
    latestJobReg: latestJob?.vehicleReg || null,
    currentStreak,
    lastUpdated: new Date().toISOString(),
  };

  console.log('WidgetManager: Calculated widget data:', widgetData);
  return widgetData;
}

/**
 * Update widget data in shared storage
 * This data will be read by the Android widget
 */
export async function updateWidgetData(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('WidgetManager: Skipping widget update (not Android)');
    return;
  }

  try {
    console.log('WidgetManager: Updating widget data');
    const widgetData = await calculateDailyAggregates();
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
    console.log('WidgetManager: Widget data updated successfully');

    // Trigger widget refresh via native module (if available)
    // This would require a native module to be implemented
    // For now, we'll just update the data and the widget will read it on its next update cycle
  } catch (error) {
    console.error('WidgetManager: Error updating widget data:', error);
  }
}

/**
 * Get current widget data
 */
export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('WidgetManager: Error getting widget data:', error);
    return null;
  }
}

/**
 * Update last backup timestamp
 * Call this after performing a backup
 */
export async function updateLastBackupTimestamp(): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    await AsyncStorage.setItem('@techtimes_last_backup', timestamp);
    console.log('WidgetManager: Last backup timestamp updated:', timestamp);
    
    // Refresh widget data
    await updateWidgetData();
  } catch (error) {
    console.error('WidgetManager: Error updating backup timestamp:', error);
  }
}

/**
 * Reload the iOS Day Progress Widget timeline.
 * The widget computes time from the system clock so no data needs to be written —
 * we just ask WidgetKit to invalidate its timeline so it picks up a fresh entry.
 */
export async function updateDayProgressWidget(): Promise<void> {
  console.log('WidgetManager: updateDayProgressWidget called');
  if (Platform.OS !== 'ios') {
    console.log('WidgetManager: Skipping Day Progress widget reload (not iOS)');
    return;
  }
  try {
    const ExtStorage = await getExtensionStorage();
    if (ExtStorage) {
      ExtStorage.reloadWidget('DayProgressWidget');
      console.log('WidgetManager: Day Progress widget timeline reloaded');
    } else {
      console.log('WidgetManager: ExtensionStorage unavailable, skipping reload');
    }
  } catch (error) {
    console.error('WidgetManager: Error reloading Day Progress widget:', error);
  }
}

/**
 * Schedule daily widget refresh at midnight
 * This should be called when the app starts
 */
export function scheduleDailyWidgetRefresh(): void {
  if (Platform.OS !== 'android') {
    return;
  }

  console.log('WidgetManager: Scheduling daily widget refresh');
  
  // Calculate time until midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();

  // Schedule refresh at midnight
  setTimeout(() => {
    updateWidgetData();
    // Reschedule for next day
    setInterval(() => {
      updateWidgetData();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, timeUntilMidnight);

  console.log('WidgetManager: Daily refresh scheduled for midnight');
}
