
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANK_HOLIDAYS_KEY = 'england_bank_holidays';
const LAST_FETCH_KEY = 'bank_holidays_last_fetch';
// Tracked holidays with counted status — stored under a separate key
const TRACKED_HOLIDAYS_KEY = 'bank_holidays';

export interface BankHoliday {
  title: string;
  date: string; // YYYY-MM-DD
}

export interface TrackedBankHoliday {
  date: string;   // ISO date string YYYY-MM-DD
  name: string;
  counted: boolean;
}

export async function fetchAndStoreBankHolidays(): Promise<BankHoliday[]> {
  try {
    console.log('BankHolidays: Fetching from UK Government API');
    const response = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!response.ok) {
      const text = await response.text();
      console.error('BankHolidays: API error', response.status, text.slice(0, 200));
      return getCachedBankHolidays();
    }
    const data = await response.json();
    const holidays: BankHoliday[] = data['england-and-wales'].events.map((e: any) => ({
      title: e.title,
      date: e.date,
    }));
    await AsyncStorage.setItem(BANK_HOLIDAYS_KEY, JSON.stringify(holidays));
    await AsyncStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
    console.log('BankHolidays: Fetched and stored', holidays.length, 'holidays');

    // Sync into tracked holidays
    await syncTrackedHolidays(holidays);

    return holidays;
  } catch (error) {
    console.error('BankHolidays: Fetch failed, returning cached:', error);
    return getCachedBankHolidays();
  }
}

export async function getCachedBankHolidays(): Promise<BankHoliday[]> {
  try {
    const cached = await AsyncStorage.getItem(BANK_HOLIDAYS_KEY);
    const result = cached ? JSON.parse(cached) : [];
    console.log('BankHolidays: Returning', result.length, 'cached holidays');
    return result;
  } catch {
    return [];
  }
}

export async function isBankHoliday(dateStr: string): Promise<boolean> {
  const holidays = await getCachedBankHolidays();
  return holidays.some(h => h.date === dateStr);
}

export function isBankHolidaySync(dateStr: string, holidays: BankHoliday[]): boolean {
  return holidays.some(h => h.date === dateStr);
}

/**
 * Fetches UK bank holidays for England/Wales and returns an array of date strings (YYYY-MM-DD).
 * Results are cached in AsyncStorage. Falls back to cache on network failure.
 */
export async function fetchBankHolidays(): Promise<string[]> {
  try {
    console.log('BankHolidays: fetchBankHolidays — checking cache freshness');
    const lastFetch = await AsyncStorage.getItem(LAST_FETCH_KEY);
    const cacheAgeMs = lastFetch ? Date.now() - new Date(lastFetch).getTime() : Infinity;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (cacheAgeMs < ONE_DAY_MS) {
      console.log('BankHolidays: Cache is fresh, returning cached date strings');
      const cached = await getCachedBankHolidays();
      return cached.map(h => h.date);
    }

    console.log('BankHolidays: Cache stale, fetching from UK Government API');
    const holidays = await fetchAndStoreBankHolidays();
    return holidays.map(h => h.date);
  } catch (error) {
    console.error('BankHolidays: fetchBankHolidays failed, returning cached:', error);
    const cached = await getCachedBankHolidays();
    return cached.map(h => h.date);
  }
}

// ─── Tracked holiday helpers ────────────────────────────────────────────────

/**
 * Sync raw BankHoliday[] into TrackedBankHoliday[] without losing existing counted flags.
 */
async function syncTrackedHolidays(raw: BankHoliday[]): Promise<void> {
  try {
    const existing = await getTrackedHolidays();
    const existingMap = new Map(existing.map(h => [h.date, h]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const merged: TrackedBankHoliday[] = raw.map(h => {
      const prev = existingMap.get(h.date);
      const holidayDate = new Date(h.date);
      holidayDate.setHours(0, 0, 0, 0);
      // If it already existed, keep its counted flag; otherwise auto-count past holidays
      const counted = prev ? prev.counted : holidayDate <= today;
      return { date: h.date, name: h.title, counted };
    });

    await AsyncStorage.setItem(TRACKED_HOLIDAYS_KEY, JSON.stringify(merged));
    console.log('BankHolidays: Synced', merged.length, 'tracked holidays');
  } catch (error) {
    console.error('BankHolidays: Error syncing tracked holidays:', error);
  }
}

export async function getTrackedHolidays(): Promise<TrackedBankHoliday[]> {
  try {
    const stored = await AsyncStorage.getItem(TRACKED_HOLIDAYS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Check if any future holidays have now passed and mark them as counted.
 * Call this on app foreground / background task.
 */
export async function markDueHolidaysAsCounted(): Promise<void> {
  try {
    const holidays = await getTrackedHolidays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let changed = false;
    const updated = holidays.map(h => {
      if (!h.counted) {
        const holidayDate = new Date(h.date);
        holidayDate.setHours(0, 0, 0, 0);
        if (holidayDate <= today) {
          console.log('BankHolidays: Marking holiday as counted:', h.date, h.name);
          changed = true;
          return { ...h, counted: true };
        }
      }
      return h;
    });

    if (changed) {
      await AsyncStorage.setItem(TRACKED_HOLIDAYS_KEY, JSON.stringify(updated));
      console.log('BankHolidays: Updated counted flags for due holidays');
    }
  } catch (error) {
    console.error('BankHolidays: Error marking due holidays:', error);
  }
}

/**
 * Returns total holiday hours up to and including targetDate.
 * Each holiday = dailyHours for that day.
 * Only holidays on or before targetDate are counted.
 */
export async function getBankHolidayHoursUpToDate(
  targetDate: Date,
  dailyHours: number
): Promise<number> {
  try {
    const holidays = await getTrackedHolidays();
    const target = new Date(targetDate);
    target.setHours(23, 59, 59, 999);

    const total = holidays.reduce((sum, h) => {
      if (!h.counted) return sum;
      const holidayDate = new Date(h.date);
      if (holidayDate <= target) {
        return sum + dailyHours;
      }
      return sum;
    }, 0);

    console.log('BankHolidays: getBankHolidayHoursUpToDate —', total, 'hours up to', targetDate.toISOString().split('T')[0]);
    return total;
  } catch (error) {
    console.error('BankHolidays: Error calculating holiday hours:', error);
    return 0;
  }
}

/**
 * Ensure tracked holidays are initialised from the raw cache if TRACKED_HOLIDAYS_KEY is empty.
 */
export async function ensureTrackedHolidaysInitialised(): Promise<void> {
  try {
    const tracked = await AsyncStorage.getItem(TRACKED_HOLIDAYS_KEY);
    if (!tracked) {
      const raw = await getCachedBankHolidays();
      if (raw.length > 0) {
        await syncTrackedHolidays(raw);
        console.log('BankHolidays: Initialised tracked holidays from cache');
      }
    }
  } catch (error) {
    console.error('BankHolidays: Error ensuring tracked holidays:', error);
  }
}

/**
 * Import all bank holidays as absence records.
 * - Past holidays: created with absenceDate in the past → treated as already deducted
 * - Future holidays: created with absenceDate in the future → treated as pending/scheduled
 * - Skips any date that already has an absence record
 * - Returns { added: number, skipped: number }
 */
export async function importBankHolidaysAsAbsences(
  holidays: BankHoliday[],
  schedule: { dailyWorkingHours: number; startTime?: string; endTime?: string; saturdayDailyHours?: number }
): Promise<{ added: number; skipped: number }> {
  console.log('BankHolidays: importBankHolidaysAsAbsences — importing', holidays.length, 'holidays');
  const { offlineStorage } = await import('./offlineStorage');

  // Load ALL existing absences to check for duplicates
  const allAbsences = await offlineStorage.getAllAbsences();
  const existingDates = new Set(allAbsences.map((a: any) => a.absenceDate));

  let added = 0;
  let skipped = 0;

  for (const holiday of holidays) {
    if (existingDates.has(holiday.date)) {
      console.log('BankHolidays: Skipping already-existing absence for', holiday.date);
      skipped++;
      continue;
    }

    const holidayDate = new Date(holiday.date);
    holidayDate.setHours(0, 0, 0, 0);
    const monthStr = holiday.date.substring(0, 7); // YYYY-MM

    // Determine hours for this day
    const dayOfWeek = holidayDate.getDay();
    let dailyHours = schedule.dailyWorkingHours;
    if (dayOfWeek === 6 && schedule.saturdayDailyHours !== undefined) {
      dailyHours = schedule.saturdayDailyHours;
    }

    await offlineStorage.createAbsence({
      month: monthStr,
      absenceDate: holiday.date,
      daysCount: 1,
      isHalfDay: false,
      customHours: dailyHours,
      deductionType: 'target',
      absenceType: 'holiday',
      note: `Bank Holiday: ${holiday.title}`,
    });

    existingDates.add(holiday.date);
    added++;
    console.log('BankHolidays: Created absence for', holiday.date, holiday.title);
  }

  console.log('BankHolidays: importBankHolidaysAsAbsences complete — added:', added, 'skipped:', skipped);
  return { added, skipped };
}
