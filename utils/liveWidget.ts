
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { offlineStorage } from './offlineStorage';

const LIVE_WIDGET_CHANNEL = 'live-widget';
const LIVE_WIDGET_ID = 'techtimes-live-widget';

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

    // Progress bar using unicode blocks
    const barLength = 20;
    const filled = Math.round((percent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    const title = `${percent}% · ${status}`;
    const body = `${bar}\n${elapsedH}h ${elapsedM}m elapsed · ${todayJobs} jobs today`;

    console.log('LiveWidget: Posting notification —', title, '|', `${elapsedH}h ${elapsedM}m`, `| ${todayJobs} jobs`);

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
    console.log('LiveWidget: Notification dismissed');
  } catch (err) {
    console.error('LiveWidget: dismissLiveWidget error:', err);
  }
}
