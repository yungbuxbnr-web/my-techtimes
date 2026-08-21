
// utils/workTimeEngine.ts
// Central lunch-aware work time engine.
// Pure TypeScript — no React Native imports.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreakInterval {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface WorkScheduleInput {
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
  breaks: BreakInterval[]; // all unpaid breaks (lunch + any others)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "HH:MM" to total minutes since midnight. Returns 0 on invalid input. */
export function parseHHMM(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Convert break intervals to minutes, clamp to shift bounds, discard zero-duration
 * breaks, sort by start, and merge overlapping intervals.
 */
export function mergeBreaks(
  breaks: BreakInterval[],
  shiftStartMins: number,
  shiftEndMins: number
): { start: number; end: number }[] {
  const clamped = breaks
    .map(b => ({
      start: Math.max(parseHHMM(b.startTime), shiftStartMins),
      end: Math.min(parseHHMM(b.endTime), shiftEndMins),
    }))
    .filter(b => b.end > b.start);

  if (clamped.length === 0) return [];

  clamped.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [clamped[0]];
  for (let i = 1; i < clamped.length; i++) {
    const last = merged[merged.length - 1];
    const cur = clamped[i];
    if (cur.start < last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getBreaksForSchedule(schedule: WorkScheduleInput): BreakInterval[] {
  return schedule.breaks;
}

export function getTotalBreakMinutes(schedule: WorkScheduleInput): number {
  const shiftStartMins = parseHHMM(schedule.startTime);
  const shiftEndMins = parseHHMM(schedule.endTime);
  const merged = mergeBreaks(schedule.breaks, shiftStartMins, shiftEndMins);
  return merged.reduce((sum, b) => sum + (b.end - b.start), 0);
}

export function getNetScheduledMinutes(schedule: WorkScheduleInput): number {
  const shiftStartMins = parseHHMM(schedule.startTime);
  const shiftEndMins = parseHHMM(schedule.endTime);
  const shiftSpanMins = shiftEndMins - shiftStartMins;
  const netMins = shiftSpanMins - getTotalBreakMinutes(schedule);
  return Math.max(0, netMins);
}

export function getNetScheduledHours(schedule: WorkScheduleInput): number {
  return getNetScheduledMinutes(schedule) / 60;
}

export function getNetElapsedWorkingMinutes(
  schedule: WorkScheduleInput,
  nowMins: number
): number {
  const shiftStartMins = parseHHMM(schedule.startTime);
  const shiftEndMins = parseHHMM(schedule.endTime);

  if (nowMins <= shiftStartMins) return 0;
  if (nowMins >= shiftEndMins) return getNetScheduledMinutes(schedule);

  const rawElapsed = nowMins - shiftStartMins;
  const merged = mergeBreaks(schedule.breaks, shiftStartMins, shiftEndMins);

  let totalBreakElapsed = 0;
  for (const b of merged) {
    if (nowMins >= b.end) {
      totalBreakElapsed += b.end - b.start;
    } else if (nowMins > b.start) {
      totalBreakElapsed += nowMins - b.start;
    }
    // break is in the future — subtract nothing
  }

  return Math.max(0, rawElapsed - totalBreakElapsed);
}

export function getNetRemainingWorkingMinutes(
  schedule: WorkScheduleInput,
  nowMins: number
): number {
  const netScheduled = getNetScheduledMinutes(schedule);
  const netElapsed = getNetElapsedWorkingMinutes(schedule, nowMins);
  return Math.max(0, netScheduled - netElapsed);
}

export function getWorkingProgress(
  schedule: WorkScheduleInput,
  nowMins: number
): number {
  const netScheduled = getNetScheduledMinutes(schedule);
  if (netScheduled <= 0) return 0;
  const netElapsed = getNetElapsedWorkingMinutes(schedule, nowMins);
  return Math.min(1, netElapsed / netScheduled);
}

export function isCurrentlyOnBreak(
  schedule: WorkScheduleInput,
  nowMins: number
): boolean {
  const shiftStartMins = parseHHMM(schedule.startTime);
  const shiftEndMins = parseHHMM(schedule.endTime);
  const merged = mergeBreaks(schedule.breaks, shiftStartMins, shiftEndMins);
  return merged.some(b => nowMins >= b.start && nowMins < b.end);
}

export function getNextBreakEnd(
  schedule: WorkScheduleInput,
  nowMins: number
): number | null {
  const shiftStartMins = parseHHMM(schedule.startTime);
  const shiftEndMins = parseHHMM(schedule.endTime);
  const merged = mergeBreaks(schedule.breaks, shiftStartMins, shiftEndMins);
  const current = merged.find(b => nowMins >= b.start && nowMins < b.end);
  return current ? current.end : null;
}

// ─── Schedule converters ──────────────────────────────────────────────────────

/**
 * Convert the app's Schedule object (from offlineStorage) into a WorkScheduleInput.
 * Only adds a lunch break if both lunchStartTime and lunchEndTime are set and valid.
 */
export function buildWorkScheduleInput(schedule: any): WorkScheduleInput {
  const breaks: BreakInterval[] = [];
  const lunchStart = schedule.lunchStartTime;
  const lunchEnd = schedule.lunchEndTime;
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) {
    breaks.push({ startTime: lunchStart, endTime: lunchEnd });
  }
  return {
    startTime: schedule.startTime || '07:00',
    endTime: schedule.endTime || '18:00',
    breaks,
  };
}

/**
 * Build a WorkScheduleInput for Saturday shifts.
 * Derives lunch end from saturdayLunchBreakMinutes starting at 12:00 if explicit
 * lunchEndTime is not available.
 */
export function buildSaturdayWorkScheduleInput(schedule: any): WorkScheduleInput {
  const breaks: BreakInterval[] = [];
  const lunchStart = schedule.saturdayLunchStartTime || '12:00';
  let lunchEnd = schedule.saturdayLunchEndTime;
  if (!lunchEnd && schedule.saturdayLunchBreakMinutes) {
    const totalMins = 12 * 60 + schedule.saturdayLunchBreakMinutes;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    lunchEnd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) {
    breaks.push({ startTime: lunchStart, endTime: lunchEnd });
  }
  return {
    startTime: schedule.saturdayStartTime || '07:00',
    endTime: schedule.saturdayEndTime || '12:00',
    breaks,
  };
}

// ─── Date-aware schedule functions ───────────────────────────────────────────

/**
 * Returns whether a given date is a configured working day.
 * Uses schedule.workingDays (0=Sun,1=Mon...6=Sat). Defaults to Mon-Fri if missing.
 * Saturday (6) is working only if schedule.saturdayWorking === true.
 */
export function isWorkingDay(schedule: any, date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const workingDays: number[] = Array.isArray(schedule?.workingDays)
    ? schedule.workingDays
    : [1, 2, 3, 4, 5];

  if (dayOfWeek === 6) {
    // Saturday is only working if saturdayWorking is true AND 6 is in workingDays
    return schedule?.saturdayWorking === true && workingDays.includes(6);
  }
  return workingDays.includes(dayOfWeek);
}

/**
 * Returns the appropriate WorkScheduleInput for a given date.
 * Uses Saturday schedule if it's Saturday and saturdayWorking is true.
 */
export function getScheduleInputForDate(schedule: any, date: Date): WorkScheduleInput {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 6 && schedule?.saturdayWorking === true) {
    return buildSaturdayWorkScheduleInput(schedule);
  }
  return buildWorkScheduleInput(schedule);
}

/**
 * Returns net scheduled minutes for a specific date.
 * Returns 0 for non-working days.
 */
export function getNetScheduledMinutesForDate(schedule: any, date: Date): number {
  if (!isWorkingDay(schedule, date)) return 0;
  const input = getScheduleInputForDate(schedule, date);
  return getNetScheduledMinutes(input);
}

/**
 * Returns net scheduled hours for a specific date.
 * Returns 0 for non-working days.
 */
export function getNetScheduledHoursForDate(schedule: any, date: Date): number {
  return getNetScheduledMinutesForDate(schedule, date) / 60;
}
