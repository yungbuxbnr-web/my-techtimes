
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys
const KEYS = {
  JOBS: '@techtimes_jobs',
  SCHEDULE: '@techtimes_schedule',
  PROFILE: '@techtimes_profile',
  ABSENCES: '@techtimes_absences',
  SETTINGS: '@techtimes_settings',
  NOTIFICATION_SETTINGS: '@techtimes_notification_settings',
};

// Types
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

export interface Schedule {
  dailyWorkingHours: number;
  saturdayWorking: boolean;
  workingDays?: number[]; // Array of day numbers: 0=Sunday, 1=Monday, etc.
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  lunchStartTime?: string; // HH:MM format
  lunchEndTime?: string; // HH:MM format
  lunchBreakMinutes?: number;
  saturdayFrequency?: 'none' | 'every' | '1-in-2' | '1-in-3' | '1-in-4' | 'custom'; // Saturday frequency
  nextWorkingSaturday?: string; // ISO date string for next working Saturday
  customSaturdayDates?: string[]; // Array of ISO date strings for custom Saturday schedule
}

export interface TechnicianProfile {
  name: string;
}

export interface Absence {
  id: string;
  month: string;
  absenceDate: string;
  daysCount?: number;
  isHalfDay?: boolean;
  customHours?: number;
  deductionType: 'target' | 'available';
  absenceType?: 'holiday' | 'sickness' | 'training';
  note?: string;
  createdAt: string;
}

export interface Settings {
  monthlyTarget: number;
}

export interface NotificationSettings {
  dailyReminder: boolean;
  dailyReminderTime: string; // HH:MM format
  weeklyReport: boolean;
  weeklyReportDay: number; // 0-6, 0=Sunday
  monthlyReport: boolean;
  targetReminder: boolean;
  efficiencyAlert: boolean;
  lowEfficiencyThreshold: number; // Percentage
}

// Helper functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    console.log('OfflineStorage: Getting item from key:', key);
    const value = await AsyncStorage.getItem(key);
    if (value === null) {
      console.log('OfflineStorage: No value found, returning default');
      return defaultValue;
    }
    const parsed = JSON.parse(value);
    console.log('OfflineStorage: Retrieved and parsed value');
    return parsed;
  } catch (error) {
    console.error('OfflineStorage: Error getting item:', key, error);
    return defaultValue;
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    console.log('OfflineStorage: Setting item for key:', key);
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    console.log('OfflineStorage: Item saved successfully');
  } catch (error) {
    console.error('OfflineStorage: Error setting item:', key, error);
    throw error;
  }
}

// Jobs operations
export const offlineStorage = {
  // Jobs
  async getAllJobs(): Promise<Job[]> {
    console.log('OfflineStorage: Getting all jobs');
    return await getItem<Job[]>(KEYS.JOBS, []);
  },

  async getJobsForMonth(month: string): Promise<Job[]> {
    console.log('OfflineStorage: Getting jobs for month:', month);
    const allJobs = await this.getAllJobs();
    return allJobs.filter(job => {
      const jobMonth = job.createdAt.substring(0, 7); // YYYY-MM
      return jobMonth === month;
    });
  },

  async getTodayJobs(): Promise<Job[]> {
    console.log('OfflineStorage: Getting today jobs');
    const allJobs = await this.getAllJobs();
    const today = new Date().toISOString().split('T')[0];
    return allJobs.filter(job => job.createdAt.startsWith(today));
  },

  async getWeekJobs(): Promise<Job[]> {
    console.log('OfflineStorage: Getting week jobs');
    const allJobs = await this.getAllJobs();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return allJobs.filter(job => {
      const jobDate = new Date(job.createdAt);
      return jobDate >= weekAgo && jobDate <= now;
    });
  },

  async getMonthJobs(): Promise<Job[]> {
    console.log('OfflineStorage: Getting month jobs');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return await this.getJobsForMonth(month);
  },

  async getRecentJobs(limit: number = 10): Promise<Job[]> {
    console.log('OfflineStorage: Getting recent jobs, limit:', limit);
    const allJobs = await this.getAllJobs();
    return allJobs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },

  async createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    console.log('OfflineStorage: Creating job');
    const allJobs = await this.getAllJobs();
    const newJob: Job = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    allJobs.push(newJob);
    await setItem(KEYS.JOBS, allJobs);
    console.log('OfflineStorage: Job created with id:', newJob.id);
    return newJob;
  },

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    console.log('OfflineStorage: Updating job:', id);
    const allJobs = await this.getAllJobs();
    const index = allJobs.findIndex(job => job.id === id);
    if (index === -1) {
      throw new Error('Job not found');
    }
    allJobs[index] = {
      ...allJobs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await setItem(KEYS.JOBS, allJobs);
    console.log('OfflineStorage: Job updated');
    return allJobs[index];
  },

  async deleteJob(id: string): Promise<{ success: boolean }> {
    console.log('OfflineStorage: Deleting job:', id);
    const allJobs = await this.getAllJobs();
    const filtered = allJobs.filter(job => job.id !== id);
    if (filtered.length === allJobs.length) {
      throw new Error('Job not found');
    }
    await setItem(KEYS.JOBS, filtered);
    console.log('OfflineStorage: Job deleted');
    return { success: true };
  },

  // Schedule
  async getSchedule(): Promise<Schedule> {
    console.log('OfflineStorage: Getting schedule');
    return await getItem<Schedule>(KEYS.SCHEDULE, {
      dailyWorkingHours: 8.5,
      saturdayWorking: false,
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      startTime: '07:00',
      endTime: '18:00',
      lunchStartTime: '12:00',
      lunchEndTime: '12:30',
      lunchBreakMinutes: 30,
      saturdayFrequency: 'none',
      nextWorkingSaturday: undefined,
      customSaturdayDates: [],
    });
  },

  async updateSchedule(schedule: Partial<Schedule>): Promise<Schedule> {
    console.log('OfflineStorage: Updating schedule');
    const current = await this.getSchedule();
    const updated = { ...current, ...schedule };
    await setItem(KEYS.SCHEDULE, updated);
    console.log('OfflineStorage: Schedule updated');
    return updated;
  },

  // Profile
  async getTechnicianProfile(): Promise<TechnicianProfile> {
    console.log('OfflineStorage: Getting technician profile');
    return await getItem<TechnicianProfile>(KEYS.PROFILE, { name: 'Technician' });
  },

  async updateTechnicianProfile(profile: TechnicianProfile): Promise<TechnicianProfile> {
    console.log('OfflineStorage: Updating technician profile');
    await setItem(KEYS.PROFILE, profile);
    console.log('OfflineStorage: Profile updated');
    return profile;
  },

  // Absences
  async getAbsences(month: string): Promise<Absence[]> {
    console.log('OfflineStorage: Getting absences for month:', month);
    const allAbsences = await getItem<Absence[]>(KEYS.ABSENCES, []);
    return allAbsences.filter(absence => absence.month === month);
  },

  async createAbsence(absence: Omit<Absence, 'id' | 'createdAt'>): Promise<Absence> {
    console.log('OfflineStorage: Creating absence');
    const allAbsences = await getItem<Absence[]>(KEYS.ABSENCES, []);
    const newAbsence: Absence = {
      ...absence,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    allAbsences.push(newAbsence);
    await setItem(KEYS.ABSENCES, allAbsences);
    console.log('OfflineStorage: Absence created with id:', newAbsence.id);
    return newAbsence;
  },

  async deleteAbsence(id: string): Promise<{ success: boolean }> {
    console.log('OfflineStorage: Deleting absence:', id);
    const allAbsences = await getItem<Absence[]>(KEYS.ABSENCES, []);
    const filtered = allAbsences.filter(absence => absence.id !== id);
    if (filtered.length === allAbsences.length) {
      throw new Error('Absence not found');
    }
    await setItem(KEYS.ABSENCES, filtered);
    console.log('OfflineStorage: Absence deleted');
    return { success: true };
  },

  // Settings
  async getSettings(): Promise<Settings> {
    console.log('OfflineStorage: Getting settings');
    return await getItem<Settings>(KEYS.SETTINGS, { monthlyTarget: 180 });
  },

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    console.log('OfflineStorage: Updating settings');
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await setItem(KEYS.SETTINGS, updated);
    console.log('OfflineStorage: Settings updated');
    return updated;
  },

  // Notification Settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    console.log('OfflineStorage: Getting notification settings');
    return await getItem<NotificationSettings>(KEYS.NOTIFICATION_SETTINGS, {
      dailyReminder: true,
      dailyReminderTime: '08:00',
      weeklyReport: true,
      weeklyReportDay: 1, // Monday
      monthlyReport: true,
      targetReminder: true,
      efficiencyAlert: true,
      lowEfficiencyThreshold: 75,
    });
  },

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    console.log('OfflineStorage: Updating notification settings');
    const current = await this.getNotificationSettings();
    const updated = { ...current, ...settings };
    await setItem(KEYS.NOTIFICATION_SETTINGS, updated);
    console.log('OfflineStorage: Notification settings updated');
    return updated;
  },

  // Export all data for backup
  async exportAllData(): Promise<string> {
    console.log('OfflineStorage: Exporting all data');
    const jobs = await this.getAllJobs();
    const schedule = await this.getSchedule();
    const profile = await this.getTechnicianProfile();
    const absences = await getItem<Absence[]>(KEYS.ABSENCES, []);
    const settings = await this.getSettings();
    const notificationSettings = await this.getNotificationSettings();

    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      jobs,
      schedule,
      profile,
      absences,
      settings,
      notificationSettings,
    };

    return JSON.stringify(backup, null, 2);
  },

  // Import data from backup
  async importAllData(backupJson: string): Promise<void> {
    console.log('OfflineStorage: Importing all data');
    const backup = JSON.parse(backupJson);
    
    if (backup.jobs) await setItem(KEYS.JOBS, backup.jobs);
    if (backup.schedule) await setItem(KEYS.SCHEDULE, backup.schedule);
    if (backup.profile) await setItem(KEYS.PROFILE, backup.profile);
    if (backup.absences) await setItem(KEYS.ABSENCES, backup.absences);
    if (backup.settings) await setItem(KEYS.SETTINGS, backup.settings);
    if (backup.notificationSettings) await setItem(KEYS.NOTIFICATION_SETTINGS, backup.notificationSettings);
    
    console.log('OfflineStorage: All data imported successfully');
  },

  // Clear all data (for testing or reset)
  async clearAllData(): Promise<void> {
    console.log('OfflineStorage: Clearing all data');
    await AsyncStorage.multiRemove([
      KEYS.JOBS,
      KEYS.SCHEDULE,
      KEYS.PROFILE,
      KEYS.ABSENCES,
      KEYS.SETTINGS,
      KEYS.NOTIFICATION_SETTINGS,
    ]);
    console.log('OfflineStorage: All data cleared');
  },
};
