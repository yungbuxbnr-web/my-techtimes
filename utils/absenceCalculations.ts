
// utils/absenceCalculations.ts

import { buildWorkScheduleInput, getNetScheduledHours } from './workTimeEngine';
import { Schedule } from './offlineStorage';

export type AbsenceDuration = 'full_day' | 'half_day' | 'custom_hours';
export type HalfDayPeriod = 'morning' | 'afternoon';

/**
 * Get the scheduled working hours for a specific date based on the user's schedule.
 * Handles regular weekdays and Saturdays separately.
 */
export function getScheduledHoursForDate(date: Date, schedule: Schedule): number {
  const dayOfWeek = date.getDay();

  // Saturday
  if (dayOfWeek === 6 && schedule.saturdayStartTime && schedule.saturdayEndTime) {
    const lunchStart = (schedule as any).saturdayLunchStartTime || '12:00';
    let lunchEnd = (schedule as any).saturdayLunchEndTime;
    if (!lunchEnd && schedule.saturdayLunchBreakMinutes) {
      const totalMins = 12 * 60 + schedule.saturdayLunchBreakMinutes;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      lunchEnd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const satSchedule = {
      startTime: schedule.saturdayStartTime,
      endTime: schedule.saturdayEndTime,
      lunchStartTime: lunchStart,
      lunchEndTime: lunchEnd || '12:30',
    };
    return getNetScheduledHours(buildWorkScheduleInput(satSchedule));
  }

  // Regular weekday
  return getNetScheduledHours(buildWorkScheduleInput(schedule));
}

/**
 * Calculate the actual absence hours for a given duration type.
 *
 * Rules:
 *   Full Day    = 100% of scheduled hours for that date
 *   Half Day    = 50% of scheduled hours for that date
 *   Custom Hours = exact entered hours, capped at scheduled hours
 */
export function calculateAbsenceHours(
  duration: AbsenceDuration,
  scheduledHours: number,
  customHours?: number
): number {
  const safeScheduled = isFinite(scheduledHours) && scheduledHours > 0 ? scheduledHours : 0;
  switch (duration) {
    case 'full_day':
      return safeScheduled;
    case 'half_day':
      return safeScheduled / 2;
    case 'custom_hours': {
      const safe = isFinite(customHours ?? 0) ? (customHours ?? 0) : 0;
      return Math.min(Math.max(0, safe), safeScheduled);
    }
    default:
      return safeScheduled;
  }
}

/**
 * Calculate the day fraction for an absence.
 *
 * Examples:
 *   Full Day (8.5h day)     → 1.0
 *   Half Day (8.5h day)     → 0.5
 *   2 custom hours (8h day) → 0.25
 */
export function calculateDayFraction(absenceHours: number, scheduledHours: number): number {
  if (scheduledHours <= 0) return 0;
  return Math.min(1, absenceHours / scheduledHours);
}

/**
 * Get the absence hours for a specific date, given existing absence records.
 * Returns 0 if no absence exists for that date.
 */
export function getAbsenceHoursForDate(
  dateStr: string,
  absences: Array<{ absenceDate: string; absenceHours?: number; customHours?: number; isHalfDay?: boolean }>,
  scheduledHours: number
): number {
  if (!dateStr || !Array.isArray(absences)) return 0;
  const safeScheduled = isFinite(scheduledHours) && scheduledHours > 0 ? scheduledHours : 0;
  const absence = absences.find(a => a.absenceDate === dateStr);
  if (!absence) return 0;

  // Use stored absenceHours if available (new format)
  if (absence.absenceHours !== undefined && isFinite(absence.absenceHours) && absence.absenceHours > 0) {
    return absence.absenceHours;
  }

  // Fall back to legacy format
  if (absence.customHours !== undefined && isFinite(absence.customHours) && absence.customHours > 0) {
    return absence.customHours;
  }
  if (absence.isHalfDay) {
    return safeScheduled / 2;
  }
  return safeScheduled;
}

/**
 * Get remaining work hours for a date after absence deduction.
 */
export function getRemainingWorkHoursForDate(
  dateStr: string,
  absences: Array<{ absenceDate: string; absenceHours?: number; customHours?: number; isHalfDay?: boolean }>,
  scheduledHours: number
): number {
  const absenceHours = getAbsenceHoursForDate(dateStr, absences, scheduledHours);
  return Math.max(0, scheduledHours - absenceHours);
}

/**
 * Get the day fraction absent for a specific date.
 * Returns 0 if no absence, 1.0 for full day, 0.5 for half day, etc.
 */
export function getAbsenceDayFractionForDate(
  dateStr: string,
  absences: Array<{ absenceDate: string; absenceHours?: number; customHours?: number; isHalfDay?: boolean; dayFraction?: number }>,
  scheduledHours: number
): number {
  const absence = absences.find(a => a.absenceDate === dateStr);
  if (!absence) return 0;

  // Use stored dayFraction if available (new format)
  if (absence.dayFraction !== undefined) {
    return absence.dayFraction;
  }

  const absenceHours = getAbsenceHoursForDate(dateStr, absences, scheduledHours);
  return calculateDayFraction(absenceHours, scheduledHours);
}

/**
 * Migrate a legacy absence record to the new format.
 * Preserves historical data — does not change stored hours.
 */
export function migrateLegacyAbsence(
  absence: any,
  schedule: Schedule
): any {
  try {
    // Already migrated
    if (absence.duration && absence.absenceHours !== undefined && absence.dayFraction !== undefined) {
      return absence;
    }

    const date = new Date(absence.absenceDate);
    const scheduledHours = getScheduledHoursForDate(date, schedule);

    // Determine duration type from legacy fields
    let duration: AbsenceDuration;
    let absenceHours: number;

    if (absence.isHalfDay) {
      duration = 'half_day';
      absenceHours = absence.customHours !== undefined && absence.customHours > 0
        ? absence.customHours
        : scheduledHours / 2;
    } else if (absence.customHours !== undefined && absence.customHours > 0 && absence.customHours !== scheduledHours) {
      duration = 'custom_hours';
      absenceHours = absence.customHours;
    } else {
      duration = 'full_day';
      absenceHours = absence.customHours !== undefined && absence.customHours > 0
        ? absence.customHours
        : scheduledHours;
    }

    const safeScheduled = isFinite(scheduledHours) && scheduledHours > 0 ? scheduledHours : absenceHours;
    const dayFraction = calculateDayFraction(absenceHours, safeScheduled);

    return {
      ...absence,
      duration,
      absenceHours,
      scheduledHoursSnapshot: scheduledHours,
      dayFraction,
      updatedAt: absence.updatedAt || absence.createdAt,
    };
  } catch (err) {
    // Never crash — return original record on any error
    return absence;
  }
}
