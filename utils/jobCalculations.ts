
export function awToMinutes(aw: number): number {
  return aw * 5;
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function validateWipNumber(wip: string): boolean {
  return /^\d{5}$/.test(wip);
}

export function validateAW(aw: number): boolean {
  return aw >= 0 && aw <= 100 && Number.isInteger(aw);
}

/**
 * Count actual working days in a given month based on the user's scheduled working days.
 * Optionally skips bank holidays.
 * @param year - Full year (e.g. 2025)
 * @param month - Month 1-12
 * @param workingDays - Array of day-of-week numbers (0=Sun, 1=Mon … 6=Sat)
 * @param bankHolidays - Optional array of bank holidays to exclude
 */
export function countWorkingDaysInMonth(
  year: number,
  month: number,
  workingDays: number[],
  bankHolidays?: { date: string }[]
): number {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    if (!workingDays.includes(dow)) continue;
    if (bankHolidays && bankHolidays.length > 0) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (bankHolidays.some(h => h.date === dateStr)) continue;
    }
    count++;
  }
  console.log(`jobCalculations: ${count} working days in ${year}-${month} for schedule`, workingDays);
  return count;
}

/**
 * Calculate daily working hours from start/end time strings (HH:MM) minus lunch break minutes.
 */
export function calcDailyHoursFromSchedule(
  startTime: string,
  endTime: string,
  lunchStartTime: string,
  lunchEndTime: string
): number {
  try {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const workMinutes = toMinutes(endTime) - toMinutes(startTime);
    const lunchMinutes = toMinutes(lunchEndTime) - toMinutes(lunchStartTime);
    const net = workMinutes - Math.max(0, lunchMinutes);
    return net > 0 ? net / 60 : 0;
  } catch {
    return 0;
  }
}
