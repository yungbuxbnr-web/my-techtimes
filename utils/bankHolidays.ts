
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANK_HOLIDAYS_KEY = 'england_bank_holidays';
const LAST_FETCH_KEY = 'bank_holidays_last_fetch';

export interface BankHoliday {
  title: string;
  date: string; // YYYY-MM-DD
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
