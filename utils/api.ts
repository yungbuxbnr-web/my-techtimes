
import Constants from 'expo-constants';
import { offlineStorage, Job as OfflineJob, Schedule, TechnicianProfile, Absence, StreakData } from './offlineStorage';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://ampq3swwzgcg2uwbx64vdbw83nxxnays.app.specular.dev';

console.log('API: Running in OFFLINE MODE - all data stored locally on device');

export const BACKEND_URL = API_URL;

export interface Job {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes?: string;
  vhcStatus: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
  createdAt: string;
  updatedAt?: string;
  imageUri?: string; // Optional job card image attachment
}

export interface JobStats {
  jobCount: number;
  totalAw: number;
  totalMinutes: number;
  totalHours?: number;
  averageAw: number;
}

export interface MonthlyStats {
  month: string;
  soldHours: number;
  targetHours: number;
  remainingHours: number;
  availableHours: number;
  efficiency: number;
  efficiencyColor: 'green' | 'yellow' | 'red';
  totalJobs: number;
  totalAw: number;
  weeklyBreakdown: { week: number; jobs: number; aw: number; hours: number }[];
}

export interface TargetDetails {
  month: string;
  targetHours: number;
  soldHours: number;
  remainingHours: number;
  totalJobs: number;
  totalAw: number;
  percentComplete: number;
}

export interface EfficiencyDetails {
  month: string;
  soldHours: number;
  availableHours: number;
  efficiency: number;
  efficiencyColor: string;
  weekdaysInMonth: number;
  absenceDays: number;
  formula: string;
}

export interface AllTimeStats {
  totalJobs: number;
  totalAw: number;
  totalHours: number;
}

export interface DashboardData {
  month: string;
  soldHours: number;
  targetHours: number;
  targetAdjusted: number;
  remainingHours: number;
  availableHours: number;
  efficiency: number;
  efficiencyColor: 'green' | 'yellow' | 'red';
  totalJobs: number;
  totalAw: number;
  today: {
    jobs: number;
    aw: number;
  };
  week: {
    jobs: number;
    aw: number;
  };
}

export interface OCRRegResult {
  registration: string;
  alternatives: string[];
  confidence: number;
}

export interface OCRJobCardResult {
  wipNumber: string;
  wipAlternatives: string[];
  registration: string;
  regAlternatives: string[];
  confidence: number;
}

export type { Schedule, TechnicianProfile, Absence, StreakData };

// Helper functions for calculations
function calculateJobStats(jobs: Job[]): JobStats {
  const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
  const totalMinutes = totalAw * 5;
  return {
    jobCount: jobs.length,
    totalAw,
    totalMinutes,
    totalHours: totalMinutes / 60,
    averageAw: jobs.length > 0 ? totalAw / jobs.length : 0,
  };
}

/**
 * Get the start of the current week (Sunday)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = day; // Days since Sunday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the current week (Saturday)
 */
function getWeekEnd(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = 6 - day; // Days until Saturday
  d.setDate(d.getDate() + diff);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Calculate working days in a month based on custom schedule
 * @param year - Year
 * @param month - Month (1-12)
 * @param schedule - Work schedule with working days array
 * @returns Number of working days in the month
 */
function getWorkingDaysInMonth(year: number, month: number, schedule: Schedule): number {
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5]; // Default Mon-Fri
  const date = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    if (workingDays.includes(dayOfWeek)) {
      count++;
    }
  }

  console.log(`API: Calculated ${count} working days in ${year}-${month} based on schedule:`, workingDays);
  return count;
}

/**
 * Calculate working days from start of month to today
 * @param year - Year
 * @param month - Month (1-12)
 * @param schedule - Work schedule with working days array
 * @returns Number of working days from month start to today
 */
function getWorkingDaysToDate(year: number, month: number, schedule: Schedule): number {
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  
  // If the month is in the future, return 0
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return 0;
  }
  
  // Determine the last day to count
  let lastDay: number;
  if (year === currentYear && month === currentMonth) {
    lastDay = currentDay; // Count up to today
  } else {
    lastDay = new Date(year, month, 0).getDate(); // Count full month
  }
  
  const date = new Date(year, month - 1, 1);
  let count = 0;

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    if (workingDays.includes(dayOfWeek)) {
      count++;
    }
  }

  console.log(`API: Calculated ${count} working days from ${year}-${month}-01 to ${year}-${month}-${lastDay}`);
  return count;
}

function getEfficiencyColor(efficiency: number): 'green' | 'yellow' | 'red' {
  if (efficiency >= 90) return 'green';
  if (efficiency >= 75) return 'yellow';
  return 'red';
}

export const api = {
  // Job endpoints
  async getAllJobs(): Promise<Job[]> {
    console.log('API: Fetching all jobs from local storage');
    return await offlineStorage.getAllJobs();
  },

  async getTodayJobs(): Promise<Job[]> {
    console.log('API: Fetching today jobs from local storage');
    return await offlineStorage.getTodayJobs();
  },

  async getWeekJobs(): Promise<Job[]> {
    console.log('API: Fetching week jobs from local storage (Sunday-Saturday)');
    const allJobs = await offlineStorage.getAllJobs();
    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();
    
    console.log('API: Week range:', weekStart.toISOString(), 'to', weekEnd.toISOString());
    
    const weekJobs = allJobs.filter(job => {
      const jobDate = new Date(job.createdAt);
      return jobDate >= weekStart && jobDate <= weekEnd;
    });
    
    console.log(`API: Found ${weekJobs.length} jobs in current week (Sunday-Saturday)`);
    return weekJobs;
  },

  async getMonthJobs(): Promise<Job[]> {
    console.log('API: Fetching month jobs from local storage');
    return await offlineStorage.getMonthJobs();
  },

  async getJobsForMonth(month: string): Promise<Job[]> {
    console.log('API: Fetching jobs for month from local storage:', month);
    return await offlineStorage.getJobsForMonth(month);
  },

  async getJobsInRange(start: string, end: string): Promise<Job[]> {
    console.log('API: Fetching jobs in range from local storage', start, 'to', end);
    const allJobs = await offlineStorage.getAllJobs();
    return allJobs.filter(job => {
      const jobDate = job.createdAt.split('T')[0];
      return jobDate >= start && jobDate <= end;
    });
  },

  async createJob(job: { 
    wipNumber: string; 
    vehicleReg: string; 
    aw: number; 
    notes?: string;
    vhcStatus?: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
    createdAt?: string;
    imageUri?: string;
  }): Promise<Job> {
    console.log('API: Creating job in local storage', job);
    const newJob = await offlineStorage.createJob({
      wipNumber: job.wipNumber,
      vehicleReg: job.vehicleReg,
      aw: job.aw,
      notes: job.notes,
      vhcStatus: job.vhcStatus || 'NONE',
      createdAt: job.createdAt || new Date().toISOString(),
      imageUri: job.imageUri,
    });
    
    return newJob;
  },

  async updateJob(id: string, updates: Partial<{ 
    wipNumber: string; 
    vehicleReg: string; 
    aw: number; 
    notes: string;
    vhcStatus: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
    createdAt: string;
    imageUri: string;
  }>): Promise<Job> {
    console.log('API: Updating job in local storage', id, updates);
    return await offlineStorage.updateJob(id, updates);
  },

  async deleteJob(id: string): Promise<{ success: boolean }> {
    console.log('API: Deleting job from local storage', id);
    return await offlineStorage.deleteJob(id);
  },

  // Stats endpoints
  async getTodayStats(): Promise<JobStats> {
    console.log('API: Calculating today stats from local storage');
    const jobs = await this.getTodayJobs();
    return calculateJobStats(jobs);
  },

  async getWeekStats(): Promise<JobStats> {
    console.log('API: Calculating week stats from local storage (Sunday-Saturday)');
    const jobs = await this.getWeekJobs();
    return calculateJobStats(jobs);
  },

  async getMonthStats(): Promise<JobStats> {
    console.log('API: Calculating month stats from local storage');
    const jobs = await this.getMonthJobs();
    return calculateJobStats(jobs);
  },

  async getMonthlyStats(month: string, targetHours: number = 180): Promise<MonthlyStats> {
    console.log('API: Calculating monthly stats from local storage for', month);
    const jobs = await this.getJobsForMonth(month);
    const schedule = await offlineStorage.getSchedule();
    const absences = await offlineStorage.getAbsences(month);
    const settings = await offlineStorage.getSettings();

    const [year, monthNum] = month.split('-').map(Number);
    
    // Calculate available hours based on working days from start of month to today
    const workingDaysToDate = getWorkingDaysToDate(year, monthNum, schedule);
    
    // Count unique absent days (each date should only be counted once, regardless of how many absence records exist)
    const absentDates = new Set<string>();
    absences.forEach(absence => {
      if (absence.absenceDate) {
        absentDates.add(absence.absenceDate);
      }
    });
    
    // Subtract absent days from working days count
    const actualWorkingDays = workingDaysToDate - absentDates.size;
    const availableHours = actualWorkingDays * schedule.dailyWorkingHours;

    console.log(`API: Month ${month} - ${workingDaysToDate} working days - ${absentDates.size} absent days = ${actualWorkingDays} actual working days × ${schedule.dailyWorkingHours}h = ${availableHours}h available`);

    // Calculate absence deductions for target hours
    let absenceHoursFromTarget = 0;

    absences.forEach(absence => {
      let hours = 0;
      if (absence.customHours !== undefined) {
        hours = absence.customHours;
      } else if (absence.isHalfDay) {
        hours = schedule.dailyWorkingHours / 2;
      } else if (absence.daysCount) {
        hours = absence.daysCount * schedule.dailyWorkingHours;
      } else {
        hours = schedule.dailyWorkingHours;
      }

      // Only deduct from target if it's a target deduction type
      if (absence.deductionType === 'target') {
        absenceHoursFromTarget += hours;
      }
    });

    // Available hours are already reduced by removing absent days from the working days count
    const adjustedAvailableHours = availableHours;
    const adjustedTargetHours = (settings.monthlyTarget || targetHours) - absenceHoursFromTarget;

    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const soldHours = (totalAw * 5) / 60; // 1 AW = 5 minutes = 0.0833 hours
    const efficiency = adjustedAvailableHours > 0 ? (soldHours / adjustedAvailableHours) * 100 : 0;

    console.log(`API: Sold Hours: ${soldHours.toFixed(2)}h, Available Hours: ${adjustedAvailableHours.toFixed(2)}h (${actualWorkingDays} days), Efficiency: ${efficiency.toFixed(1)}%`);

    return {
      month,
      soldHours,
      targetHours: adjustedTargetHours,
      remainingHours: Math.max(0, adjustedTargetHours - soldHours),
      availableHours: adjustedAvailableHours,
      efficiency,
      efficiencyColor: getEfficiencyColor(efficiency),
      totalJobs: jobs.length,
      totalAw,
      weeklyBreakdown: [],
    };
  },

  async getTargetDetails(month: string): Promise<TargetDetails> {
    console.log('API: Calculating target details from local storage for', month);
    const monthlyStats = await this.getMonthlyStats(month);
    return {
      month,
      targetHours: monthlyStats.targetHours,
      soldHours: monthlyStats.soldHours,
      remainingHours: monthlyStats.remainingHours,
      totalJobs: monthlyStats.totalJobs,
      totalAw: monthlyStats.totalAw,
      percentComplete: monthlyStats.targetHours > 0 
        ? (monthlyStats.soldHours / monthlyStats.targetHours) * 100 
        : 0,
    };
  },

  async getEfficiencyDetails(month: string): Promise<EfficiencyDetails> {
    console.log('API: Calculating efficiency details from local storage for', month);
    const monthlyStats = await this.getMonthlyStats(month);
    const schedule = await offlineStorage.getSchedule();
    const absences = await offlineStorage.getAbsences(month);
    const [year, monthNum] = month.split('-').map(Number);
    const workingDaysToDate = getWorkingDaysToDate(year, monthNum, schedule);

    return {
      month,
      soldHours: monthlyStats.soldHours,
      availableHours: monthlyStats.availableHours,
      efficiency: monthlyStats.efficiency,
      efficiencyColor: monthlyStats.efficiencyColor,
      weekdaysInMonth: workingDaysToDate,
      absenceDays: absences.length,
      formula: 'Efficiency = (Sold Hours / Available Hours) × 100',
    };
  },

  async getAllTimeStats(): Promise<AllTimeStats> {
    console.log('API: Calculating all-time stats from local storage');
    const allJobs = await offlineStorage.getAllJobs();
    const totalAw = allJobs.reduce((sum, job) => sum + job.aw, 0);
    const totalHours = (totalAw * 5) / 60;

    return {
      totalJobs: allJobs.length,
      totalAw,
      totalHours,
    };
  },

  // Absence endpoints
  async getAbsences(month: string): Promise<Absence[]> {
    console.log('API: Fetching absences from local storage for', month);
    return await offlineStorage.getAbsences(month);
  },

  async createAbsence(absence: { 
    month: string; 
    absenceDate: string;
    daysCount?: number; 
    isHalfDay?: boolean;
    customHours?: number;
    deductionType: 'target' | 'available';
    absenceType?: 'overtime' | 'compensation' | 'absence';
    note?: string;
  }): Promise<Absence> {
    console.log('API: Creating absence in local storage', absence);
    return await offlineStorage.createAbsence(absence);
  },

  async deleteAbsence(id: string): Promise<{ success: boolean }> {
    console.log('API: Deleting absence from local storage', id);
    return await offlineStorage.deleteAbsence(id);
  },

  // Schedule endpoints
  async getSchedule(): Promise<Schedule> {
    console.log('API: Fetching schedule from local storage');
    return await offlineStorage.getSchedule();
  },

  async updateSchedule(schedule: Partial<Schedule>): Promise<Schedule> {
    console.log('API: Updating schedule in local storage', schedule);
    return await offlineStorage.updateSchedule(schedule);
  },

  // Technician Profile endpoints
  async getTechnicianProfile(): Promise<TechnicianProfile> {
    console.log('API: Fetching technician profile from local storage');
    return await offlineStorage.getTechnicianProfile();
  },

  async updateTechnicianProfile(profile: TechnicianProfile): Promise<TechnicianProfile> {
    console.log('API: Updating technician profile in local storage', profile);
    return await offlineStorage.updateTechnicianProfile(profile);
  },

  // Settings endpoints
  async getMonthlyTarget(): Promise<{ value: number }> {
    console.log('API: Fetching monthly target from local storage');
    const settings = await offlineStorage.getSettings();
    return { value: settings.monthlyTarget };
  },

  async updateMonthlyTarget(value: number): Promise<{ value: number }> {
    console.log('API: Updating monthly target in local storage to', value);
    await offlineStorage.updateSettings({ monthlyTarget: value });
    return { value };
  },

  async getSettings(): Promise<{ monthlyTarget: number; streaksEnabled?: boolean; weeklyStreakTarget?: number }> {
    console.log('API: Fetching settings from local storage');
    return await offlineStorage.getSettings();
  },

  async updateSettings(settings: Partial<{ monthlyTarget: number; streaksEnabled: boolean; weeklyStreakTarget: number }>): Promise<void> {
    console.log('API: Updating settings in local storage', settings);
    await offlineStorage.updateSettings(settings);
  },

  // OCR endpoints - These would need a backend or local ML model
  // For now, returning mock data to keep the app functional
  async scanRegistration(imageUri: string): Promise<OCRRegResult> {
    console.log('API: OCR scanning not available in offline mode');
    throw new Error('OCR scanning requires an internet connection. Please enter the registration manually.');
  },

  async scanJobCard(imageUri: string): Promise<OCRJobCardResult> {
    console.log('API: OCR scanning not available in offline mode');
    throw new Error('OCR scanning requires an internet connection. Please enter the details manually.');
  },

  // Dashboard endpoint
  async getDashboard(month: string, targetHours: number = 180): Promise<DashboardData> {
    console.log('API: Calculating dashboard data from local storage for', month);
    const monthlyStats = await this.getMonthlyStats(month, targetHours);
    const todayJobs = await this.getTodayJobs();
    const weekJobs = await this.getWeekJobs();

    const todayAw = todayJobs.reduce((sum, job) => sum + job.aw, 0);
    const weekAw = weekJobs.reduce((sum, job) => sum + job.aw, 0);

    return {
      month,
      soldHours: monthlyStats.soldHours,
      targetHours: monthlyStats.targetHours,
      targetAdjusted: monthlyStats.targetHours,
      remainingHours: monthlyStats.remainingHours,
      availableHours: monthlyStats.availableHours,
      efficiency: monthlyStats.efficiency,
      efficiencyColor: monthlyStats.efficiencyColor,
      totalJobs: monthlyStats.totalJobs,
      totalAw: monthlyStats.totalAw,
      today: {
        jobs: todayJobs.length,
        aw: todayAw,
      },
      week: {
        jobs: weekJobs.length,
        aw: weekAw,
      },
    };
  },

  // Recent jobs endpoint
  async getRecentJobs(limit: number = 10): Promise<Job[]> {
    console.log('API: Fetching recent jobs from local storage, limit:', limit);
    return await offlineStorage.getRecentJobs(limit);
  },

  // Streaks calculation
  async calculateStreaks(): Promise<StreakData> {
    console.log('API: Calculating streaks');
    const allJobs = await offlineStorage.getAllJobs();
    const settings = await offlineStorage.getSettings();
    const weeklyTarget = settings.weeklyStreakTarget || 5;

    // Group jobs by day
    const jobsByDay = new Map<string, Job[]>();
    allJobs.forEach(job => {
      const day = job.createdAt.split('T')[0];
      if (!jobsByDay.has(day)) {
        jobsByDay.set(day, []);
      }
      jobsByDay.get(day)!.push(job);
    });

    // Sort days in descending order (most recent first)
    const sortedDays = Array.from(jobsByDay.keys()).sort((a, b) => b.localeCompare(a));

    // Calculate daily streak
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's a job today or yesterday (to maintain streak)
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let streakDate = jobsByDay.has(todayStr) ? new Date(today) : jobsByDay.has(yesterdayStr) ? new Date(yesterday) : null;

    if (streakDate) {
      // Count consecutive days backwards from streak start
      while (true) {
        const dateStr = streakDate.toISOString().split('T')[0];
        if (jobsByDay.has(dateStr)) {
          currentStreak++;
          streakDate.setDate(streakDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate best streak (scan all days)
    let checkDate = sortedDays.length > 0 ? new Date(sortedDays[0]) : new Date();
    const oldestDate = sortedDays.length > 0 ? new Date(sortedDays[sortedDays.length - 1]) : new Date();
    
    while (checkDate >= oldestDate) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (jobsByDay.has(dateStr)) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate weekly streaks (Sunday-Saturday)
    const jobsByWeek = new Map<string, Job[]>();
    allJobs.forEach(job => {
      const date = new Date(job.createdAt);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!jobsByWeek.has(weekKey)) {
        jobsByWeek.set(weekKey, []);
      }
      jobsByWeek.get(weekKey)!.push(job);
    });

    const sortedWeeks = Array.from(jobsByWeek.keys()).sort((a, b) => b.localeCompare(a));

    let currentWeeklyStreak = 0;
    let bestWeeklyStreak = 0;
    let tempWeeklyStreak = 0;

    // Get current week start (Sunday)
    const currentWeekStart = getWeekStart();
    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];

    // Check current and previous week for streak
    let weekCheckDate = jobsByWeek.has(currentWeekKey) && jobsByWeek.get(currentWeekKey)!.length >= weeklyTarget
      ? new Date(currentWeekStart)
      : new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const prevWeekKey = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (jobsByWeek.has(prevWeekKey) && jobsByWeek.get(prevWeekKey)!.length >= weeklyTarget) {
      weekCheckDate = new Date(prevWeekKey);
    }

    // Count consecutive weeks
    while (true) {
      const weekKey = weekCheckDate.toISOString().split('T')[0];
      if (jobsByWeek.has(weekKey) && jobsByWeek.get(weekKey)!.length >= weeklyTarget) {
        currentWeeklyStreak++;
        weekCheckDate.setDate(weekCheckDate.getDate() - 7);
      } else {
        break;
      }
    }

    // Calculate best weekly streak
    sortedWeeks.forEach(weekKey => {
      const weekJobs = jobsByWeek.get(weekKey)!;
      if (weekJobs.length >= weeklyTarget) {
        tempWeeklyStreak++;
        bestWeeklyStreak = Math.max(bestWeeklyStreak, tempWeeklyStreak);
      } else {
        tempWeeklyStreak = 0;
      }
    });

    // Find best day this month
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthJobs = allJobs.filter(job => job.createdAt.startsWith(currentMonth));
    
    const monthDayStats = new Map<string, { aw: number; jobs: number }>();
    monthJobs.forEach(job => {
      const day = job.createdAt.split('T')[0];
      if (!monthDayStats.has(day)) {
        monthDayStats.set(day, { aw: 0, jobs: 0 });
      }
      const stats = monthDayStats.get(day)!;
      stats.aw += job.aw;
      stats.jobs += 1;
    });

    let bestDayThisMonth = null;
    let maxAw = 0;
    monthDayStats.forEach((stats, day) => {
      if (stats.aw > maxAw) {
        maxAw = stats.aw;
        bestDayThisMonth = { date: day, aw: stats.aw, jobs: stats.jobs };
      }
    });

    let mostProductiveDayThisMonth = null;
    let maxJobs = 0;
    monthDayStats.forEach((stats, day) => {
      if (stats.jobs > maxJobs) {
        maxJobs = stats.jobs;
        mostProductiveDayThisMonth = { date: day, jobs: stats.jobs, aw: stats.aw };
      }
    });

    return {
      currentStreak,
      bestStreak: Math.max(bestStreak, currentStreak),
      currentWeeklyStreak,
      bestWeeklyStreak: Math.max(bestWeeklyStreak, currentWeeklyStreak),
      bestDayThisMonth,
      mostProductiveDayThisMonth,
    };
  },
};
