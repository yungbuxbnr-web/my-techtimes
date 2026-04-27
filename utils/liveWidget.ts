
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from './offlineStorage';

const LIVE_WIDGET_CHANNEL = 'live-widget';
const LIVE_WIDGET_ID = 'techtimes-live-widget';
const LIVE_WIDGET_PREF_KEY = 'live_widget_enabled';

export async function setupLiveWidgetChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  console.log('LiveWidget: Setting up live-widget notification channel');
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
  console.log('LiveWidget: Channel created successfully');
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = (timeStr || '').split(':').map(Number);
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

export async function updateLiveWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Respect the live_widget_enabled preference
    const prefVal = await AsyncStorage.getItem(LIVE_WIDGET_PREF_KEY);
    const isEnabled = prefVal === null ? true : prefVal === 'true';
    if (!isEnabled) {
      console.log('LiveWidget: Live widget is disabled — dismissing instead of updating');
      await dismissLiveWidget();
      return;
    }

    console.log('LiveWidget: Fetching schedule and jobs for widget update');
    const [schedule, jobs] = await Promise.all([
      offlineStorage.getSchedule(),
      offlineStorage.getJobs(),
    ]);

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const { hour: startH, minute: startM } = parseTime(schedule?.startTime || '07:00');
    const { hour: endH, minute: endM } = parseTime(schedule?.endTime || '18:00');
    const { hour: lunchStartH, minute: lunchStartM } = parseTime(schedule?.lunchStartTime || '12:00');
    const { hour: lunchEndH, minute: lunchEndM } = parseTime(schedule?.lunchEndTime || '13:00');

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
    const today = now.toISOString().split('T')[0];
    const todayJobs = (jobs || []).filter((j: any) => {
      const d = j.date || j.createdAt || '';
      return d.startsWith(today);
    }).length;

    // Clean format: percentage prominent in title, details in body
    const title = `Tech Times · ${percent}% · ${status}`;
    const bodyLine1 = `${elapsedH}h ${elapsedM}m of ${totalH}h ${totalM}m elapsed`;
    const bodyLine2 = `${todayJobs} jobs today · Tap to open`;
    const body = `${bodyLine1}\n${bodyLine2}`;

    console.log('LiveWidget: Posting notification —', title, '|', bodyLine1, '|', bodyLine2);

    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_WIDGET_ID,
      content: {
        title,
        body,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
        // @ts-expect-error — ongoing is a valid Android field not in expo-notifications types
        ongoing: true,
        data: { type: 'live-widget' },
        channelId: LIVE_WIDGET_CHANNEL,
        autoDismiss: false,
        actions: [
          {
            identifier: 'ADD_JOB',
            buttonTitle: '+ Add Job',
            options: { opensAppToForeground: true },
          },
        ],
      } as any,
      trigger: null,
    });

    console.log('LiveWidget: Notification posted successfully');
  } catch (err) {
    console.error('LiveWidget: updateLiveWidget error:', err);
  }
}

export async function dismissLiveWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  console.log('LiveWidget: Dismissing live widget notification');
  try {
    await Notifications.dismissNotificationAsync(LIVE_WIDGET_ID);
    console.log('LiveWidget: Notification dismissed by identifier');
  } catch (err) {
    console.error('LiveWidget: dismissNotificationAsync failed, falling back to dismissAll:', err);
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('LiveWidget: All notifications dismissed as fallback');
    } catch (fallbackErr) {
      console.error('LiveWidget: dismissAllNotificationsAsync also failed:', fallbackErr);
    }
  }
}
