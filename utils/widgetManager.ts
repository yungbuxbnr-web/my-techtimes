
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
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

// Storage keys
const WIDGET_DATA_KEY = '@techtimes_widget_data';
const WIDGET_PREFS_KEY = 'widget_prefs';
const APP_GROUP_ID = 'group.com.buxrug.techtime';

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

export interface WidgetPrefs {
  theme: 'dark' | 'light' | 'auto';
  showSeconds: boolean;
  workHoursMode: boolean;
}

export const DEFAULT_WIDGET_PREFS: WidgetPrefs = {
  theme: 'dark',
  showSeconds: false,
  workHoursMode: false,
};

/**
 * Load widget preferences from AsyncStorage
 */
export async function getWidgetPrefs(): Promise<WidgetPrefs> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_WIDGET_PREFS, ...JSON.parse(raw) };
    }
  } catch (error) {
    console.error('WidgetManager: Error loading widget prefs:', error);
  }
  return DEFAULT_WIDGET_PREFS;
}

/**
 * Save widget preferences to AsyncStorage and sync to shared container
 */
export async function saveWidgetPrefs(prefs: WidgetPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(prefs));
    console.log('WidgetManager: Widget prefs saved:', prefs);
    // Sync prefs to shared container so Swift widget can read them
    await syncWidgetPrefsToSharedContainer(prefs);
  } catch (error) {
    console.error('WidgetManager: Error saving widget prefs:', error);
  }
}

/**
 * Write widget preferences to the iOS App Group shared container (or Android SharedPreferences)
 */
async function syncWidgetPrefsToSharedContainer(prefs: WidgetPrefs): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const { WidgetBridge } = NativeModules;
      if (!WidgetBridge) return;
      console.log('WidgetManager: Syncing widget prefs to Android SharedPreferences');
      WidgetBridge.updateWidget({
        showTimeElapsed: prefs.showSeconds !== false,
        showPercentage: prefs.workHoursMode !== true,
      });
    } catch (e) {
      console.warn('Android widget prefs sync failed:', e);
    }
    return;
  }
  if (Platform.OS !== 'ios') return;
  try {
    const ExtStorage = await getExtensionStorage();
    if (ExtStorage) {
      await ExtStorage.setItem('widget_theme', prefs.theme, APP_GROUP_ID);
      await ExtStorage.setItem('widget_show_seconds', prefs.showSeconds ? 'true' : 'false', APP_GROUP_ID);
      await ExtStorage.setItem('widget_work_hours_mode', prefs.workHoursMode ? 'true' : 'false', APP_GROUP_ID);
      console.log('WidgetManager: Widget prefs synced to shared container');
    }
  } catch (error) {
    console.error('WidgetManager: Error syncing prefs to shared container:', error);
  }
}

/**
 * Sync live app data to the shared container so the Swift widget can read it.
 */
export async function syncWidgetData(data: {
  jobsToday?: number;
  timeLoggedToday?: number; // minutes
  workStatus?: 'working' | 'break' | 'off';
  workStartTime?: string;
  workEndTime?: string;
}): Promise<void> {
  console.log('WidgetManager: syncWidgetData called', data);
  if (Platform.OS !== 'ios') return;

  try {
    const ExtStorage = await getExtensionStorage();
    if (!ExtStorage) {
      console.log('WidgetManager: ExtensionStorage unavailable, skipping syncWidgetData');
      return;
    }

    if (data.jobsToday !== undefined) {
      await ExtStorage.setItem('widget_jobs_today', String(data.jobsToday), APP_GROUP_ID);
    }
    if (data.timeLoggedToday !== undefined) {
      await ExtStorage.setItem('widget_time_logged', String(data.timeLoggedToday), APP_GROUP_ID);
    }
    if (data.workStatus !== undefined) {
      await ExtStorage.setItem('widget_work_status', data.workStatus, APP_GROUP_ID);
    }
    if (data.workStartTime !== undefined) {
      await ExtStorage.setItem('widget_work_start', data.workStartTime, APP_GROUP_ID);
    }
    if (data.workEndTime !== undefined) {
      await ExtStorage.setItem('widget_work_end', data.workEndTime, APP_GROUP_ID);
    }

    console.log('WidgetManager: Live data synced to shared container');

    // Reload widget timeline after data sync
    ExtStorage.reloadWidget('DayProgressWidget');
    console.log('WidgetManager: Widget timeline reloaded after data sync');
  } catch (error) {
    console.error('WidgetManager: Error in syncWidgetData:', error);
  }
}

/**
 * Full sync: pull today's data from offlineStorage and push to widget shared container
 */
export async function syncWidgetDataFromStorage(): Promise<void> {
  console.log('WidgetManager: syncWidgetDataFromStorage called');
  if (Platform.OS === 'android') {
    await updateWidgetData();
    return;
  }
  if (Platform.OS !== 'ios') return;

  try {
    const [todayJobs, schedule, prefs] = await Promise.all([
      offlineStorage.getTodayJobs(),
      offlineStorage.getSchedule(),
      getWidgetPrefs(),
    ]);

    const jobsToday = todayJobs.length;
    const todayAW = todayJobs.reduce((sum, job) => sum + job.aw, 0);
    const timeLoggedToday = todayAW * 5; // minutes

    await syncWidgetData({
      jobsToday,
      timeLoggedToday,
      workStartTime: schedule.startTime ?? '07:00',
      workEndTime: schedule.endTime ?? '18:00',
    });

    // Also sync prefs
    await syncWidgetPrefsToSharedContainer(prefs);

    console.log('WidgetManager: Full widget sync complete — jobs:', jobsToday, 'time:', timeLoggedToday, 'min');
  } catch (error) {
    console.error('WidgetManager: Error in syncWidgetDataFromStorage:', error);
  }
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

  // Get last backup date
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

  // Get current streak
  const settings = await offlineStorage.getSettings();
  let currentStreak: number | null = null;

  if (settings.streaksEnabled) {
    try {
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

      let streakDate = jobsByDay.has(todayStr)
        ? new Date(today)
        : jobsByDay.has(yesterdayStr)
        ? new Date(yesterday)
        : null;

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
 * Update widget data in shared storage (Android)
 */
export async function updateWidgetData(): Promise<void> {
  if (Platform.OS !== 'android') {
    // On iOS, use the full sync instead
    await syncWidgetDataFromStorage();
    return;
  }

  try {
    console.log('WidgetManager: Updating Android widget via native bridge');
    const { WidgetBridge } = NativeModules;
    if (!WidgetBridge) {
      console.log('WidgetManager: WidgetBridge not available, skipping');
      return;
    }

    const [schedule, todayJobs, prefs] = await Promise.all([
      offlineStorage.getSchedule(),
      offlineStorage.getTodayJobs(),
      getWidgetPrefs(),
    ]);

    const now = new Date();
    const [startHour, startMin] = (schedule.startTime || '07:00').split(':').map(Number);
    const [endHour, endMin] = (schedule.endTime || '18:00').split(':').map(Number);

    const startOfDay = new Date(now);
    startOfDay.setHours(startHour, startMin, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(endHour, endMin, 0, 0);

    const totalDayMs = endOfDay.getTime() - startOfDay.getTime();
    const elapsedMs = Math.max(0, Math.min(now.getTime() - startOfDay.getTime(), totalDayMs));
    const percentage = totalDayMs > 0 ? Math.min(100, Math.round((elapsedMs / totalDayMs) * 100)) : 0;

    const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeElapsed = `${elapsedHours}h ${elapsedMinutes}m elapsed`;

    const todayAW = todayJobs.reduce((sum, job) => sum + job.aw, 0);
    const todayJobCount = todayJobs.length;

    console.log('WidgetManager: Calling WidgetBridge.updateWidget', { timeElapsed, percentage, todayJobCount });
    WidgetBridge.updateWidget({
      timeElapsed,
      percentage,
      showTimeElapsed: prefs.showSeconds !== false,
      showPercentage: prefs.workHoursMode !== true,
      todayJobs: todayJobCount,
      todayAW,
    });

    console.log('WidgetManager: Android widget updated successfully');
  } catch (error) {
    console.warn('Android widget update failed:', error);
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
 */
export async function updateLastBackupTimestamp(): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    await AsyncStorage.setItem('@techtimes_last_backup', timestamp);
    console.log('WidgetManager: Last backup timestamp updated:', timestamp);
    await updateWidgetData();
  } catch (error) {
    console.error('WidgetManager: Error updating backup timestamp:', error);
  }
}

/**
 * Reload the iOS Day Progress Widget timeline.
 */
export async function updateDayProgressWidget(): Promise<void> {
  console.log('WidgetManager: updateDayProgressWidget called');
  if (Platform.OS !== 'ios') {
    console.log('WidgetManager: Skipping Day Progress widget reload (not iOS)');
    return;
  }
  try {
    // Also do a full data sync before reloading
    await syncWidgetDataFromStorage();
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
 * Schedule daily widget refresh at midnight (Android only)
 */
export function scheduleDailyWidgetRefresh(): void {
  if (Platform.OS !== 'android') {
    return;
  }

  console.log('WidgetManager: Scheduling daily widget refresh');

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(() => {
    updateWidgetData();
    setInterval(() => {
      updateWidgetData();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);

  console.log('WidgetManager: Daily refresh scheduled for midnight');
}
