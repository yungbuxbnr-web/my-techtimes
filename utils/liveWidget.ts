
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from './offlineStorage';

const LIVE_WIDGET_CHANNEL = 'live-widget';
const LIVE_WIDGET_ID = 'techtimes-live-widget';
const LIVE_WIDGET_PREF_KEY = 'live_widget_enabled';

// Throttle: skip update if called within 30 seconds of the last successful update
let lastWidgetUpdate = 0;

export async function setupLiveWidgetChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Guard against re-creating the channel on every launch — calling
  // setNotificationChannelAsync repeatedly on Samsung devices can cause a race
  // condition that corrupts the channel configuration.
  const existing = await Notifications.getNotificationChannelAsync(LIVE_WIDGET_CHANNEL);
  if (existing) {
    return;
  }
  await Notifications.setNotificationChannelAsync(LIVE_WIDGET_CHANNEL, {
    name: 'Live Widget',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: undefined,
    description: 'Persistent day progress widget in your notification shade',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: false,
  });
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = (timeStr || '').split(':').map(Number);
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

export async function updateLiveWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Throttle: skip if called within 30 seconds of the last successful update
  const now = Date.now();
  if (now - lastWidgetUpdate < 30_000) return;

  try {
    // Respect the live_widget_enabled preference
    const prefVal = await AsyncStorage.getItem(LIVE_WIDGET_PREF_KEY);
    const isEnabled = prefVal === null ? true : prefVal === 'true';
    if (!isEnabled) {
      await dismissLiveWidget();
      return;
    }

    const [schedule, jobs] = await Promise.all([
      offlineStorage.getSchedule(),
      offlineStorage.getAllJobs(),
    ]);

    const nowDate = new Date();
    const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();

    const { hour: startH, minute: startM } = parseTime(schedule?.startTime || '07:00');
    const { hour: endH, minute: endM } = parseTime(schedule?.endTime || '18:00');
    const { hour: lunchStartH, minute: lunchStartM } = parseTime(schedule?.lunchStartTime || '12:00');
    const { hour: lunchEndH, minute: lunchEndM } = parseTime(schedule?.lunchEndTime || '12:30');

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const lunchStartMins = lunchStartH * 60 + lunchStartM;
    const lunchEndMins = lunchEndH * 60 + lunchEndM;
    const totalMins = Math.max(endMins - startMins, 1);

    const elapsedMins = Math.min(Math.max(nowMins - startMins, 0), totalMins);
    const percent = Math.round((elapsedMins / totalMins) * 100);
    const elapsedH = Math.floor(elapsedMins / 60);
    const elapsedM = elapsedMins % 60;

    // Total shift hours/minutes for display
    const totalH = Math.floor(totalMins / 60);
    const totalM = totalMins % 60;

    // Work status
    let status = 'Off';
    if (nowMins >= startMins && nowMins < endMins) {
      if (nowMins >= lunchStartMins && nowMins < lunchEndMins) {
        status = 'Lunch Break';
      } else {
        status = 'Working';
      }
    }

    // Jobs today
    const today = nowDate.toISOString().split('T')[0];
    const todayJobs = (jobs || []).filter((j: any) => {
      const d = j.date || j.createdAt || '';
      return d.startsWith(today);
    }).length;

    // Clean format: percentage prominent in title, details in body
    const title = `Tech Times · ${percent}% · ${status}`;
    const bodyLine1 = `${elapsedH}h ${elapsedM}m of ${totalH}h ${totalM}m elapsed`;
    const bodyLine2 = `${todayJobs} jobs today · Tap to open`;
    const body = `${bodyLine1}\n${bodyLine2}`;

    // Use presentNotificationAsync to fire immediately without scheduling.
    // Avoids Samsung One UI bug where scheduleNotificationAsync (even with trigger: null)
    // throws an empty error {} on some firmware versions.
    try {
      await (Notifications as any).presentNotificationAsync({
        identifier: LIVE_WIDGET_ID,
        title,
        body,
        priority: Notifications.AndroidNotificationPriority.LOW,
        ongoing: true,
        data: { type: 'live-widget' },
        channelId: LIVE_WIDGET_CHANNEL,
        autoDismiss: false,
      });
    } catch {
      // Fallback: scheduleNotificationAsync with trigger: null
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: LIVE_WIDGET_ID,
          content: {
            title,
            body,
            priority: Notifications.AndroidNotificationPriority.LOW,
            ongoing: true,
            data: { type: 'live-widget' },
            channelId: LIVE_WIDGET_CHANNEL,
            autoDismiss: false,
          } as any,
          trigger: null,
        });
      } catch { /* silently swallow */ }
    }

    // Mark successful update time
    lastWidgetUpdate = now;
  } catch (err) {
    console.error('LiveWidget: updateLiveWidget error:', err);
  }
}

export async function dismissLiveWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(LIVE_WIDGET_ID);
  } catch (err) {
    console.error('LiveWidget: dismissNotificationAsync failed, falling back to dismissAll:', err);
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (fallbackErr) {
      console.error('LiveWidget: dismissAllNotificationsAsync also failed:', fallbackErr);
    }
  }
}
