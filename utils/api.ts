
import Constants from 'expo-constants';
import { offlineStorage, Job as OfflineJob, Schedule, TechnicianProfile, Absence } from './offlineStorage';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://ampq3swwzgcg2uwbx64vdbw83nxxnays.app.specular.dev';

console.log('API: Running in OFFLINE MODE - all data stored locally on device');

export const BACKEND_URL = API_URL;

export interface Job {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes?: string;
  vhcStatus?: 'GREEN' | 'AMBER' | 'RED' | 'N/A';
  createdAt: string;
  updatedAt?: string;
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
  weeklyBreakdown: Array<{ week: number; jobs: number; aw: number; hours: number }>;
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

export { Schedule, TechnicianProfile, Absence };

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

function getWeekdaysInMonth(year: number, month: number, saturdayWorking: boolean): number {
  const date = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  let weekdays = 0;

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdays++;
    } else if (dayOfWeek === 6 && saturdayWorking) {
      weekdays++;
    }
  }

  return weekdays;
}

function getEfficiencyColor(efficiency: number): 'green' | 'yellow' | 'red' {
  if (efficiency >= 65) return 'green';
  if (efficiency >= 31) return 'yellow';
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
    console.log('API: Fetching week jobs from local storage');
    return await offlineStorage.getWeekJobs();
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
    vhcStatus?: 'GREEN' | 'AMBER' | 'RED' | 'N/A';
    createdAt?: string;
  }): Promise<Job> {
    console.log('API: Creating job in local storage', job);
    const newJob = await offlineStorage.createJob({
      wipNumber: job.wipNumber,
      vehicleReg: job.vehicleReg,
      aw: job.aw,
      notes: job.notes,
      vhcStatus: job.vhcStatus || 'N/A',
    });
    
    // If a custom createdAt was provided, update it
    if (job.createdAt) {
      return await offlineStorage.updateJob(newJob.id, { createdAt: job.createdAt });
    }
    
    return newJob;
  },

  async updateJob(id: string, updates: Partial<{ 
    wipNumber: string; 
    vehicleReg: string; 
    aw: number; 
    notes: string;
    vhcStatus: 'GREEN' | 'AMBER' | 'RED' | 'N/A';
    createdAt: string;
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
    console.log('API: Calculating week stats from local storage');
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
    const weekdaysInMonth = getWeekdaysInMonth(year, monthNum, schedule.saturdayWorking);
    const availableHours = weekdaysInMonth * schedule.dailyWorkingHours;

    // Calculate absence deductions
    let absenceHoursFromAvailable = 0;
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

      if (absence.deductionType === 'available') {
        absenceHoursFromAvailable += hours;
      } else {
        absenceHoursFromTarget += hours;
      }
    });

    const adjustedAvailableHours = availableHours - absenceHoursFromAvailable;
    const adjustedTargetHours = (settings.monthlyTarget || targetHours) - absenceHoursFromTarget;

    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const soldHours = (totalAw * 5) / 60;
    const efficiency = adjustedAvailableHours > 0 ? (soldHours / adjustedAvailableHours) * 100 : 0;

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
    const weekdaysInMonth = getWeekdaysInMonth(year, monthNum, schedule.saturdayWorking);

    return {
      month,
      soldHours: monthlyStats.soldHours,
      availableHours: monthlyStats.availableHours,
      efficiency: monthlyStats.efficiency,
      efficiencyColor: monthlyStats.efficiencyColor,
      weekdaysInMonth,
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
};
