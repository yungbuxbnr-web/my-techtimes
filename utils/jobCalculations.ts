
export function awToMinutes(aw: number): number {
  return aw * 5;
}

// ─── Absence adjustment types ────────────────────────────────────────────────

export interface AbsenceRecord {
  id: string;
  absenceDate: string; // ISO date string YYYY-MM-DD
  hours: number;       // hours absent that day
  type: string;        // 'sick' | 'holiday' | 'personal' | etc.
  month: string;       // YYYY-MM
}

export interface RawStats {
  /** Original contracted hours for the full month (before any absence deductions) */
  originalTotalHours: number;
  /** Original available hours from start-of-month to today (before any absence deductions) */
  originalAvailableHours: number;
  /** Hours the technician has actually sold/worked */
  hoursWorked: number;
}

export interface AdjustedStats {
  /** originalTotalHours − all absence hours (past + future) */
  adjustedTotalHours: number;
  /** originalAvailableHours − past/today absence hours only */
  adjustedAvailableHours: number;
  /** hoursWorked / adjustedTotalHours × 100 */
  progressPercent: number;
  /** adjustedAvailableHours / adjustedTotalHours × 100 */
  availablePercent: number;
  /**
   * hoursWorked / (adjustedTotalHours − adjustedAvailableHours) × 100
   * i.e. how much of the "elapsed" contracted time has been filled
   */
  efficiencyPercent: number;
  /** Sum of hours for all absences in the month (past + future) */
  totalAbsenceHours: number;
  /** Sum of hours for past/today absences only */
  pastAbsenceHours: number;
  /** Sum of hours for future absences only */
  futureAbsenceHours: number;
}

/**
 * Apply absence adjustments to raw monthly stats.
 *
 * Rules:
 *  - adjustedTotalHours  = originalTotalHours  − ALL absence hours (past + future)
 *  - adjustedAvailableHours = originalAvailableHours − past/today absence hours only
 *  - Future absences are already removed from total but not yet from available;
 *    available will naturally decrease on the day the future absence arrives.
 *
 * @param stats   Raw (unadjusted) stats for the month
 * @param absences All absence records for the month (any date)
 * @param today   Reference date string YYYY-MM-DD (defaults to today)
 */
export function applyAbsenceAdjustments(
  stats: RawStats,
  absences: AbsenceRecord[],
  today?: string
): AdjustedStats {
  const todayStr = today ?? new Date().toISOString().split('T')[0];

  console.log(
    'jobCalculations.applyAbsenceAdjustments: applying',
    absences.length,
    'absences, today =',
    todayStr
  );

  // Split absences into past/today vs future
  const pastAbsences = absences.filter(a => a.absenceDate <= todayStr);
  const futureAbsences = absences.filter(a => a.absenceDate > todayStr);

  const pastAbsenceHours = pastAbsences.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
  const futureAbsenceHours = futureAbsences.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
  const totalAbsenceHours = pastAbsenceHours + futureAbsenceHours;

  console.log(
    'jobCalculations.applyAbsenceAdjustments: pastAbsenceHours =',
    pastAbsenceHours.toFixed(2),
    'futureAbsenceHours =',
    futureAbsenceHours.toFixed(2),
    'totalAbsenceHours =',
    totalAbsenceHours.toFixed(2)
  );

  // Clamp to 0 to avoid negative values
  const adjustedTotalHours = Math.max(0, stats.originalTotalHours - totalAbsenceHours);
  const adjustedAvailableHours = Math.max(0, stats.originalAvailableHours - pastAbsenceHours);

  // Percentages — guard against division by zero
  const progressPercent =
    adjustedTotalHours > 0
      ? Math.min(100, (stats.hoursWorked / adjustedTotalHours) * 100)
      : 0;

  const availablePercent =
    adjustedTotalHours > 0
      ? Math.min(100, (adjustedAvailableHours / adjustedTotalHours) * 100)
      : 0;

  // Elapsed contracted hours = total − remaining available
  const elapsedContractedHours = adjustedTotalHours - adjustedAvailableHours;
  const efficiencyPercent =
    elapsedContractedHours > 0
      ? Math.min(999, (stats.hoursWorked / elapsedContractedHours) * 100)
      : 0;

  console.log(
    'jobCalculations.applyAbsenceAdjustments: adjustedTotal =',
    adjustedTotalHours.toFixed(2),
    'adjustedAvailable =',
    adjustedAvailableHours.toFixed(2),
    'progress =',
    progressPercent.toFixed(1) + '%',
    'efficiency =',
    efficiencyPercent.toFixed(1) + '%'
  );

  return {
    adjustedTotalHours,
    adjustedAvailableHours,
    progressPercent,
    availablePercent,
    efficiencyPercent,
    totalAbsenceHours,
    pastAbsenceHours,
    futureAbsenceHours,
  };
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
