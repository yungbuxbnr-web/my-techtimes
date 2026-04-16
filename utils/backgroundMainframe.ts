
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from './offlineStorage';
import { calcDailyHoursFromSchedule } from './jobCalculations';
import { markDueHolidaysAsCounted, ensureTrackedHolidaysInitialised } from './bankHolidays';
import {
  maybeSendTargetReminderNotification,
  maybeSendEfficiencyAlertNotification,
  ensureWorkScheduleNotificationsScheduled,
} from './notificationScheduler';

const TASK_NAME = 'TECH_TIMES_MAINFRAME';
const MAINFRAME_LAST_SYNC_KEY = 'mainframe_last_sync';
const DAILY_PROGRESS_KEY = 'daily_progress';

// ─── Core sync logic (shared between background task and foreground sync) ────

export async function runMainframeSync(): Promise<void> {
  console.log('Mainframe: Running sync at', new Date().toISOString());

  // Safety-net: re-register OS-level work-schedule notifications if they were cleared
  await ensureWorkScheduleNotificationsScheduled();

  try {
    const schedule = await offlineStorage.getSchedule();
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun … 6=Sat

    const workingDays = schedule.workingDays ?? [1, 2, 3, 4, 5];
    const isTodayWorkingDay = workingDays.includes(todayDow);

    console.log('Mainframe: Today is', ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][todayDow], '— working day:', isTodayWorkingDay);

    // Calculate elapsed hours today
    let elapsedHours = 0;
    if (isTodayWorkingDay && schedule.startTime && schedule.endTime) {
      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const startMin = toMinutes(schedule.startTime);
      const endMin = toMinutes(schedule.endTime);
      const lunchStartMin = schedule.lunchStartTime ? toMinutes(schedule.lunchStartTime) : startMin;
      const lunchEndMin = schedule.lunchEndTime ? toMinutes(schedule.lunchEndTime) : startMin;
      const lunchDuration = Math.max(0, lunchEndMin - lunchStartMin);

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const clampedNow = Math.min(nowMinutes, endMin);
      const rawElapsed = Math.max(0, clampedNow - startMin);

      // Subtract lunch if we're past lunch start
      let lunchElapsed = 0;
      if (nowMinutes > lunchStartMin) {
        lunchElapsed = Math.min(lunchDuration, Math.max(0, clampedNow - lunchStartMin));
      }

      elapsedHours = Math.max(0, rawElapsed - lunchElapsed) / 60;
    }

    // Calculate daily hours from schedule
    const dailyHours = schedule.startTime && schedule.endTime
      ? calcDailyHoursFromSchedule(
          schedule.startTime,
          schedule.endTime,
          schedule.lunchStartTime ?? '12:00',
          schedule.lunchEndTime ?? '12:30'
        )
      : schedule.dailyWorkingHours;

    const progressPercent = dailyHours > 0 ? Math.min(100, (elapsedHours / dailyHours) * 100) : 0;

    // Persist daily progress
    await AsyncStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify({
      date: now.toISOString().split('T')[0],
      elapsedHours,
      dailyHours,
      progressPercent,
      isWorkingDay: isTodayWorkingDay,
      updatedAt: now.toISOString(),
    }));

    // Mark any due bank holidays as counted
    await ensureTrackedHolidaysInitialised();
    await markDueHolidaysAsCounted();

    // Mark any future absences that are now past/today
    await markDueAbsences();

    // ─── Notification checks ──────────────────────────────────────────────────
    const notifSettings = await offlineStorage.getNotificationSettings();

    if (isTodayWorkingDay && schedule.startTime && schedule.endTime) {
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
        console.log('Mainframe: Within work hours — running notification checks');

        // Target reminder: fire when approaching end of day
        await maybeSendTargetReminderNotification(progressPercent, notifSettings);

        // Efficiency alert: read cached job_stats written by the main app
        const statsRaw = await AsyncStorage.getItem('job_stats');
        if (statsRaw) {
          try {
            const stats = JSON.parse(statsRaw);
            if (stats.efficiencyPercent !== undefined) {
              console.log('Mainframe: Cached efficiency:', stats.efficiencyPercent);
              await maybeSendEfficiencyAlertNotification(stats.efficiencyPercent, notifSettings);
            } else {
              console.log('Mainframe: job_stats found but efficiencyPercent missing, skipping efficiency alert');
            }
          } catch (parseError) {
            console.error('Mainframe: Failed to parse job_stats:', parseError);
          }
        } else {
          console.log('Mainframe: No job_stats cached yet, skipping efficiency alert');
        }
      } else {
        console.log('Mainframe: Outside work hours — skipping notification checks');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Update last sync timestamp
    await AsyncStorage.setItem(MAINFRAME_LAST_SYNC_KEY, now.toISOString());

    console.log('Mainframe: Sync complete — elapsed:', elapsedHours.toFixed(2), 'h /', dailyHours.toFixed(2), 'h (', progressPercent.toFixed(1), '%)');
  } catch (error) {
    console.error('Mainframe: Error during sync:', error);
  }
}

/**
 * Check if any future absences have become past/today and flag them for recalculation.
 * We don't change the absence records themselves — the calculation layer already filters
 * by date <= today. This just logs the transition for debugging.
 */
async function markDueAbsences(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Get all absences across all months by reading raw storage
    const raw = await AsyncStorage.getItem('@techtimes_absences');
    if (!raw) return;

    const allAbsences: { absenceDate: string; id: string }[] = JSON.parse(raw);
    const dueAbsences = allAbsences.filter(a => a.absenceDate && a.absenceDate <= todayStr);

    if (dueAbsences.length > 0) {
      console.log('Mainframe: markDueAbsences —', dueAbsences.length, 'absences are now active (date <= today)');
    }
  } catch (error) {
    console.error('Mainframe: Error checking due absences:', error);
  }
}

// ─── Background task definition ──────────────────────────────────────────────

TaskManager.defineTask(TASK_NAME, async () => {
  console.log('Mainframe: Background task triggered');
  try {
    await runMainframeSync();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Mainframe: Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helpers ─────────────────────────────────────────────────────

export async function registerBackgroundMainframe(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    console.log('Mainframe: BackgroundFetch status:', status);

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log('Mainframe: Background fetch not available on this device');
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      console.log('Mainframe: Task already registered, skipping');
      return;
    }

    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('Mainframe: Background task registered successfully');
  } catch (error) {
    console.error('Mainframe: Error registering background task:', error);
  }
}

export async function unregisterBackgroundMainframe(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      console.log('Mainframe: Background task unregistered');
    }
  } catch (error) {
    console.error('Mainframe: Error unregistering background task:', error);
  }
}

export { DAILY_PROGRESS_KEY, MAINFRAME_LAST_SYNC_KEY };
