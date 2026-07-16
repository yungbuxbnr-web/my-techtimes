
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage, Schedule, NotificationSettings } from './offlineStorage';

// Notification identifiers
const NOTIFICATION_IDS = {
  WORK_START: 'work-start',
  WORK_END: 'work-end',
  LUNCH_START: 'lunch-start',
  LUNCH_END: 'lunch-end',
  DAILY_REMINDER: 'daily-reminder',
  WEEKLY_REPORT: 'weekly-report',
  MONTHLY_REPORT: 'monthly-report',
};

// AsyncStorage keys for one-shot daily notification guards
const NOTIF_TARGET_FIRED_KEY = '@techtimes_notif_target_fired_date';
const NOTIF_EFFICIENCY_FIRED_KEY = '@techtimes_notif_efficiency_fired_date';

// Android notification channel IDs
export const NOTIFICATION_CHANNELS = {
  DEFAULT: 'default',
  SILENT: 'silent',
  WORK: 'work-schedule',
  REMINDERS: 'reminders',
};

// Vibration patterns (in milliseconds)
const VIBRATION_PATTERNS: Record<string, number[]> = {
  default: [0, 400],
  short: [0, 200],
  long: [0, 800],
  double: [0, 200, 100, 200],
};

/**
 * Set up Android notification channels.
 * Must be called before scheduling any notifications on Android.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEFAULT, {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 400],
    lightColor: '#2196F3',
    description: 'Default notification sound',
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.SILENT, {
    name: 'Silent',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: undefined,
    description: 'No sound notifications',
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.WORK, {
    name: 'Work Schedule',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 400],
    lightColor: '#4CAF50',
    description: 'Work start, end, and lunch notifications',
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.REMINDERS, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 200],
    lightColor: '#FF9800',
    description: 'Daily and weekly reminder notifications',
  });
}

/**
 * Get the appropriate Android channel ID based on notification sound setting.
 */
function getChannelId(notificationSound: string, channelType: 'work' | 'reminder' = 'reminder'): string {
  if (notificationSound === 'none') return NOTIFICATION_CHANNELS.SILENT;
  if (channelType === 'work') return NOTIFICATION_CHANNELS.WORK;
  return NOTIFICATION_CHANNELS.DEFAULT;
}

/**
 * Configure notification handler with sound and vibration
 */
export async function configureNotificationHandler(settings: NotificationSettings): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async (_notification) => {
      // Trigger vibration if enabled (iOS only — Android handles vibration via channel config)
      if (settings.vibrationEnabled && Platform.OS === 'ios') {
        try {
          if (settings.vibrationPattern === 'short') {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else if (settings.vibrationPattern === 'long') {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } else if (settings.vibrationPattern === 'double') {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e) {
              console.error('NotificationScheduler: Haptics double (first) failed:', e);
            }
            setTimeout(() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (e) {
                console.error('NotificationScheduler: Haptics double (second) failed:', e);
              }
            }, 100);
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch (error) {
          console.error('NotificationScheduler: Error triggering vibration:', error);
        }
      }

      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: settings.notificationSound !== 'none',
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

/**
 * Parse time string (HH:MM) to hour and minute
 */
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: isNaN(hour) ? 8 : hour, minute: isNaN(minute) ? 0 : minute };
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Schedule work start notification
 */
async function scheduleWorkStartNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.workStartNotification || !schedule.startTime) {
    return;
  }

  const { hour, minute } = parseTime(schedule.startTime);
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const channelId = getChannelId(settings.notificationSound, 'work');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  for (const dayOfWeek of workingDays) {
    // expo-notifications weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
    const expoWeekday = dayOfWeek + 1;

    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDS.WORK_START}-${dayOfWeek}`,
      content: {
        title: '🚗 Work Day Starting',
        body: `Your work day starts at ${schedule.startTime}. Time to get productive!`,
        sound: settings.notificationSound !== 'none' ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}

/**
 * Schedule work end notification
 */
async function scheduleWorkEndNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.workEndNotification || !schedule.endTime) {
    return;
  }

  const { hour, minute } = parseTime(schedule.endTime);
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const channelId = getChannelId(settings.notificationSound, 'work');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  for (const dayOfWeek of workingDays) {
    const expoWeekday = dayOfWeek + 1;

    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDS.WORK_END}-${dayOfWeek}`,
      content: {
        title: '🏁 Work Day Ending',
        body: `Your work day ends at ${schedule.endTime}. Great job today!`,
        sound: settings.notificationSound !== 'none' ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}

/**
 * Schedule lunch start notification
 */
async function scheduleLunchStartNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.lunchStartNotification || !schedule.lunchStartTime) {
    return;
  }

  const { hour, minute } = parseTime(schedule.lunchStartTime);
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const channelId = getChannelId(settings.notificationSound, 'work');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  for (const dayOfWeek of workingDays) {
    const expoWeekday = dayOfWeek + 1;

    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDS.LUNCH_START}-${dayOfWeek}`,
      content: {
        title: '🍽️ Lunch Break',
        body: `Time for your lunch break at ${schedule.lunchStartTime}. Enjoy your meal!`,
        sound: settings.notificationSound !== 'none' ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        vibrate,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}

/**
 * Schedule lunch end notification
 */
async function scheduleLunchEndNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.lunchEndNotification || !schedule.lunchEndTime) {
    return;
  }

  const { hour, minute } = parseTime(schedule.lunchEndTime);
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const channelId = getChannelId(settings.notificationSound, 'work');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  for (const dayOfWeek of workingDays) {
    const expoWeekday = dayOfWeek + 1;

    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDS.LUNCH_END}-${dayOfWeek}`,
      content: {
        title: '⏰ Back to Work',
        body: `Lunch break ends at ${schedule.lunchEndTime}. Time to get back to it!`,
        sound: settings.notificationSound !== 'none' ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        vibrate,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}

/**
 * Schedule daily reminder notification
 */
async function scheduleDailyReminder(settings: NotificationSettings): Promise<void> {
  if (!settings.dailyReminder) {
    return;
  }

  const { hour, minute } = parseTime(settings.dailyReminderTime);
  const channelId = getChannelId(settings.notificationSound, 'reminder');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.DAILY_REMINDER,
    content: {
      title: '📊 Daily Reminder',
      body: "Don't forget to log your jobs for today!",
      sound: settings.notificationSound !== 'none' ? 'default' : undefined,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      vibrate,
      badge: 1,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * Fire a one-shot target reminder notification if progress >= 90% and not already fired today.
 */
export async function maybeSendTargetReminderNotification(
  progressPercent: number,
  settings: NotificationSettings
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!settings.targetReminder) {
    return;
  }

  if (progressPercent < 90) {
    return;
  }

  const today = getTodayDateString();
  const firedDate = await AsyncStorage.getItem(NOTIF_TARGET_FIRED_KEY);
  if (firedDate === today) {
    return;
  }

  const roundedProgress = Math.round(progressPercent);

  // FIX 6: wrap in try/catch; if ERR_NOTIFICATIONS_FAILED_TO_SCHEDULE, retry with trigger: null
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Almost there! 🎯',
        body: `You've completed ${roundedProgress}% of today's hours. Keep it up!`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.WORK }),
      },
      trigger: { seconds: 1 } as any,
    });
  } catch {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Almost there! 🎯',
          body: `You've completed ${roundedProgress}% of today's hours. Keep it up!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          badge: 1,
          ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.WORK }),
        },
        trigger: null,
      });
    } catch { /* silently swallow */ }
  }

  await AsyncStorage.setItem(NOTIF_TARGET_FIRED_KEY, today);
}

/**
 * Fire a one-shot efficiency alert notification if efficiency is below threshold and not already fired today.
 */
export async function maybeSendEfficiencyAlertNotification(
  efficiencyPercent: number,
  settings: NotificationSettings
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!settings.efficiencyAlert) {
    return;
  }

  const threshold = Number(settings.lowEfficiencyThreshold);
  if (efficiencyPercent >= threshold) {
    return;
  }

  const today = getTodayDateString();
  const firedDate = await AsyncStorage.getItem(NOTIF_EFFICIENCY_FIRED_KEY);
  if (firedDate === today) {
    return;
  }

  const roundedEfficiency = Math.round(efficiencyPercent);

  // FIX 6: wrap in try/catch; if ERR_NOTIFICATIONS_FAILED_TO_SCHEDULE, retry with trigger: null
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Efficiency check 📊',
        body: `Your efficiency is at ${roundedEfficiency}%. Consider logging more jobs to stay on track.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        badge: 1,
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.REMINDERS }),
      },
      trigger: { seconds: 1 } as any,
    });
  } catch {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Efficiency check 📊',
          body: `Your efficiency is at ${roundedEfficiency}%. Consider logging more jobs to stay on track.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          badge: 1,
          ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.REMINDERS }),
        },
        trigger: null,
      });
    } catch { /* silently swallow */ }
  }

  await AsyncStorage.setItem(NOTIF_EFFICIENCY_FIRED_KEY, today);
}

/**
 * Schedule (or cancel) the weekly report notification.
 */
export async function scheduleWeeklyReportNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') return;
  // Cancel any existing weekly-report notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter(n => n.identifier.startsWith(NOTIFICATION_IDS.WEEKLY_REPORT));
  for (const notif of existing) {
    await Notifications.cancelScheduledNotificationAsync(notif.identifier);
  }

  if (!settings.weeklyReport) {
    return;
  }

  // expo-notifications weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
  const expoWeekday = settings.weeklyReportDay === 0 ? 1 : settings.weeklyReportDay + 1;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.WEEKLY_REPORT,
    content: {
      title: 'Weekly Summary 📋',
      body: 'Check your weekly work report and see how you performed this week.',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      badge: 1,
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.REMINDERS }),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.WEEKLY,
      weekday: expoWeekday,
      hour: 18,
      minute: 0,
    },
  });
}

/**
 * Schedule (or cancel) the monthly report notification.
 */
export async function scheduleMonthlyReportNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') return;
  // Cancel any existing monthly-report notification
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.MONTHLY_REPORT);
  } catch {
    // No existing notification to cancel — that's fine
  }

  if (!settings.monthlyReport) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.MONTHLY_REPORT,
    content: {
      title: 'Monthly Report 📅',
      body: 'Your monthly work summary is ready. Tap to review your performance.',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      badge: 1,
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.REMINDERS }),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.CALENDAR,
      day: 28,
      hour: 17,
      minute: 0,
      repeats: true,
    },
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Force cancel all notifications and reschedule from scratch.
 * Returns the count of newly scheduled notifications.
 */
export async function forceRescheduleAllNotifications(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await scheduleAllNotifications();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

/**
 * Schedule all notifications based on current settings and schedule
 */
export async function scheduleAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // Set up Android channels first
    await setupAndroidNotificationChannels();

    // On Android, ensure notification permissions are granted before scheduling
    if (Platform.OS === 'android') {
      await Notifications.requestPermissionsAsync();
    }

    // Cancel existing notifications first
    await cancelAllNotifications();

    // Load settings and schedule
    const settings = await offlineStorage.getNotificationSettings();
    const schedule = await offlineStorage.getSchedule();

    // Configure notification handler
    await configureNotificationHandler(settings);

    // Schedule work-related notifications
    await scheduleWorkStartNotification(schedule, settings);
    await scheduleWorkEndNotification(schedule, settings);
    await scheduleLunchStartNotification(schedule, settings);
    await scheduleLunchEndNotification(schedule, settings);

    // Schedule reminder notifications
    await scheduleDailyReminder(settings);

    // Schedule report notifications
    await scheduleWeeklyReportNotification(settings);
    await scheduleMonthlyReportNotification(settings);
  } catch (error) {
    console.error('NotificationScheduler: Error scheduling notifications:', error);
  }
}

// Cooldown: only run ensureWorkScheduleNotificationsScheduled once per 5 minutes
let lastEnsureCheck = 0;

/**
 * Safety-net: ensure work-schedule notifications are registered with the OS.
 * Called on app mount, foreground resume, and every background sync.
 * If any of the 4 work-schedule notification types are missing AND their
 * corresponding setting is enabled, re-schedules everything.
 */
export async function ensureWorkScheduleNotificationsScheduled(): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (now - lastEnsureCheck < 5 * 60 * 1000) return; // 5-minute cooldown
  lastEnsureCheck = now;

  try {
    const [settings, schedule, scheduled] = await Promise.all([
      offlineStorage.getNotificationSettings(),
      offlineStorage.getSchedule(),
      Notifications.getAllScheduledNotificationsAsync(),
    ]);

    const ids = scheduled.map(n => n.identifier);

    const hasWorkStart    = ids.some(id => id.startsWith('work-start-'));
    const hasWorkEnd      = ids.some(id => id.startsWith('work-end-'));
    const hasLunchStart   = ids.some(id => id.startsWith('lunch-start-'));
    const hasLunchEnd     = ids.some(id => id.startsWith('lunch-end-'));
    const hasDailyReminder  = ids.includes(NOTIFICATION_IDS.DAILY_REMINDER);
    const hasWeeklyReport   = ids.includes(NOTIFICATION_IDS.WEEKLY_REPORT);
    const hasMonthlyReport  = ids.includes(NOTIFICATION_IDS.MONTHLY_REPORT);

    const needsWorkStart    = settings.workStartNotification  && !hasWorkStart;
    const needsWorkEnd      = settings.workEndNotification    && !hasWorkEnd;
    const needsLunchStart   = settings.lunchStartNotification && !hasLunchStart;
    const needsLunchEnd     = settings.lunchEndNotification   && !hasLunchEnd;
    const needsDailyReminder  = settings.dailyReminder  && !hasDailyReminder;
    const needsWeeklyReport   = settings.weeklyReport   && !hasWeeklyReport;
    const needsMonthlyReport  = settings.monthlyReport  && !hasMonthlyReport;

    if (needsWorkStart || needsWorkEnd || needsLunchStart || needsLunchEnd ||
        needsDailyReminder || needsWeeklyReport || needsMonthlyReport) {
      await scheduleAllNotifications();
    }
  } catch (error) {
    console.error('NotificationScheduler: ensureWorkScheduleNotificationsScheduled — error:', error);
  }
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Test notification (for testing sound and vibration)
 */
export async function sendTestNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') return;

  await setupAndroidNotificationChannels();
  await configureNotificationHandler(settings);

  const channelId = getChannelId(settings.notificationSound, 'reminder');
  const vibrate = settings.vibrationEnabled ? (VIBRATION_PATTERNS[settings.vibrationPattern] ?? VIBRATION_PATTERNS.default) : undefined;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Test Notification',
      body: 'This is a test notification with your selected sound and vibration settings.',
      sound: settings.notificationSound !== 'none' ? 'default' : undefined,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate,
      badge: 1,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: { seconds: 1 } as any, // Fire immediately (trigger: null can throw on some Samsung firmware)
  });
}
