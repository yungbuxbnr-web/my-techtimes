
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
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

  console.log('NotificationScheduler: Setting up Android notification channels');

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

  console.log('NotificationScheduler: Android channels set up');
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
  console.log('NotificationScheduler: Configuring notification handler');

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log('NotificationScheduler: Handling notification:', notification.request.identifier);

      // Trigger vibration if enabled
      if (settings.vibrationEnabled && Platform.OS !== 'web') {
        try {
          if (Platform.OS === 'ios') {
            if (settings.vibrationPattern === 'short') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else if (settings.vibrationPattern === 'long') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } else if (settings.vibrationPattern === 'double') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 100);
            } else {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        } catch (error) {
          console.error('NotificationScheduler: Error triggering vibration:', error);
        }
      }

      return {
        shouldShowAlert: true,
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
 * Schedule work start notification
 */
async function scheduleWorkStartNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.workStartNotification || !schedule.startTime) {
    console.log('NotificationScheduler: Work start notification disabled or no start time');
    return;
  }

  console.log('NotificationScheduler: Scheduling work start notification');

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
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });

    console.log(`NotificationScheduler: Scheduled work start for weekday ${expoWeekday} at ${schedule.startTime}`);
  }
}

/**
 * Schedule work end notification
 */
async function scheduleWorkEndNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.workEndNotification || !schedule.endTime) {
    console.log('NotificationScheduler: Work end notification disabled or no end time');
    return;
  }

  console.log('NotificationScheduler: Scheduling work end notification');

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
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });

    console.log(`NotificationScheduler: Scheduled work end for weekday ${expoWeekday} at ${schedule.endTime}`);
  }
}

/**
 * Schedule lunch start notification
 */
async function scheduleLunchStartNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.lunchStartNotification || !schedule.lunchStartTime) {
    console.log('NotificationScheduler: Lunch start notification disabled or no lunch start time');
    return;
  }

  console.log('NotificationScheduler: Scheduling lunch start notification');

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
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });

    console.log(`NotificationScheduler: Scheduled lunch start for weekday ${expoWeekday} at ${schedule.lunchStartTime}`);
  }
}

/**
 * Schedule lunch end notification
 */
async function scheduleLunchEndNotification(schedule: Schedule, settings: NotificationSettings): Promise<void> {
  if (!settings.lunchEndNotification || !schedule.lunchEndTime) {
    console.log('NotificationScheduler: Lunch end notification disabled or no lunch end time');
    return;
  }

  console.log('NotificationScheduler: Scheduling lunch end notification');

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
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });

    console.log(`NotificationScheduler: Scheduled lunch end for weekday ${expoWeekday} at ${schedule.lunchEndTime}`);
  }
}

/**
 * Schedule daily reminder notification
 */
async function scheduleDailyReminder(settings: NotificationSettings): Promise<void> {
  if (!settings.dailyReminder) {
    console.log('NotificationScheduler: Daily reminder disabled');
    return;
  }

  console.log('NotificationScheduler: Scheduling daily reminder');

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
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  console.log(`NotificationScheduler: Scheduled daily reminder at ${settings.dailyReminderTime}`);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  console.log('NotificationScheduler: Cancelling all scheduled notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('NotificationScheduler: All notifications cancelled');
}

/**
 * Schedule all notifications based on current settings and schedule
 */
export async function scheduleAllNotifications(): Promise<void> {
  console.log('NotificationScheduler: Scheduling all notifications');

  try {
    // Set up Android channels first
    await setupAndroidNotificationChannels();

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

    console.log('NotificationScheduler: All notifications scheduled successfully');

    // Log scheduled notifications for debugging
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('NotificationScheduler: Total scheduled notifications:', scheduled.length);
    scheduled.forEach(notif => {
      console.log(`  - ${notif.identifier}: ${notif.content.title}`);
    });
  } catch (error) {
    console.error('NotificationScheduler: Error scheduling notifications:', error);
    throw error;
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
  console.log('NotificationScheduler: Sending test notification');

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
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: null, // Send immediately
  });

  console.log('NotificationScheduler: Test notification sent');
}
