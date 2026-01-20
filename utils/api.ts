
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://ampq3swwzgcg2uwbx64vdbw83nxxnays.app.specular.dev';

console.log('API: Backend URL configured as:', API_URL);

export const BACKEND_URL = API_URL;

// Helper function to make API calls
async function apiFetch(url: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

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

export interface Absence {
  id: string;
  month: string;
  absenceDate: string;
  daysCount?: number;
  isHalfDay?: boolean;
  customHours?: number;
  deductionType: 'target' | 'available';
  note?: string;
  createdAt: string;
}

export interface Schedule {
  dailyWorkingHours: number;
  saturdayWorking: boolean;
}

export interface TechnicianProfile {
  name: string;
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

export const api = {
  // Job endpoints
  async getAllJobs(): Promise<Job[]> {
    console.log('API: Fetching all jobs from', `${API_URL}/api/jobs`);
    const response = await apiFetch(`${API_URL}/api/jobs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getTodayJobs(): Promise<Job[]> {
    console.log('API: Fetching today jobs');
    const response = await apiFetch(`${API_URL}/api/jobs/today`);
    if (!response.ok) {
      throw new Error(`Failed to fetch today jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getWeekJobs(): Promise<Job[]> {
    console.log('API: Fetching week jobs');
    const response = await apiFetch(`${API_URL}/api/jobs/week`);
    if (!response.ok) {
      throw new Error(`Failed to fetch week jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getMonthJobs(): Promise<Job[]> {
    console.log('API: Fetching month jobs');
    const response = await apiFetch(`${API_URL}/api/jobs/month`);
    if (!response.ok) {
      throw new Error(`Failed to fetch month jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getJobsForMonth(month: string): Promise<Job[]> {
    console.log('API: Fetching jobs for month:', month);
    const response = await apiFetch(`${API_URL}/api/jobs?month=${month}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs for month: ${response.statusText}`);
    }
    return response.json();
  },

  async getJobsInRange(start: string, end: string): Promise<Job[]> {
    console.log('API: Fetching jobs in range', start, 'to', end);
    const response = await apiFetch(`${API_URL}/api/jobs?start=${start}&end=${end}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs in range: ${response.statusText}`);
    }
    return response.json();
  },

  async createJob(job: { 
    wipNumber: string; 
    vehicleReg: string; 
    aw: number; 
    notes?: string;
    vhcStatus?: 'GREEN' | 'AMBER' | 'RED' | 'N/A';
    createdAt?: string;
  }): Promise<Job> {
    console.log('API: Creating job', job);
    const response = await apiFetch(`${API_URL}/api/jobs`, {
      method: 'POST',
      body: JSON.stringify(job),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create job');
    }
    return response.json();
  },

  async updateJob(id: string, updates: Partial<{ 
    wipNumber: string; 
    vehicleReg: string; 
    aw: number; 
    notes: string;
    vhcStatus: 'GREEN' | 'AMBER' | 'RED' | 'N/A';
    createdAt: string;
  }>): Promise<Job> {
    console.log('API: Updating job', id, updates);
    const response = await apiFetch(`${API_URL}/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update job');
    }
    return response.json();
  },

  async deleteJob(id: string): Promise<{ success: boolean }> {
    console.log('API: Deleting job', id);
    const response = await apiFetch(`${API_URL}/api/jobs/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete job');
    }
    return response.json();
  },

  // Stats endpoints
  async getTodayStats(): Promise<JobStats> {
    console.log('API: Fetching today stats');
    const jobs = await this.getTodayJobs();
    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      jobCount: jobs.length,
      totalAw,
      totalMinutes,
      totalHours: totalMinutes / 60,
      averageAw: jobs.length > 0 ? totalAw / jobs.length : 0,
    };
  },

  async getWeekStats(): Promise<JobStats> {
    console.log('API: Fetching week stats');
    const jobs = await this.getWeekJobs();
    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      jobCount: jobs.length,
      totalAw,
      totalMinutes,
      totalHours: totalMinutes / 60,
      averageAw: jobs.length > 0 ? totalAw / jobs.length : 0,
    };
  },

  async getMonthStats(): Promise<JobStats> {
    console.log('API: Fetching month stats');
    const jobs = await this.getMonthJobs();
    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      jobCount: jobs.length,
      totalAw,
      totalMinutes,
      totalHours: totalMinutes / 60,
      averageAw: jobs.length > 0 ? totalAw / jobs.length : 0,
    };
  },

  async getMonthlyStats(month: string, targetHours: number = 180): Promise<MonthlyStats> {
    console.log('API: Fetching monthly stats for', month);
    const response = await apiFetch(`${API_URL}/api/stats/month?month=${month}&targetHours=${targetHours}`);
    if (!response.ok) {
      throw new Error('Failed to fetch monthly stats');
    }
    return response.json();
  },

  async getTargetDetails(month: string): Promise<TargetDetails> {
    console.log('API: Fetching target details for', month);
    const monthlyStats = await this.getMonthlyStats(month);
    return {
      month,
      targetHours: monthlyStats.targetHours,
      soldHours: monthlyStats.soldHours,
      remainingHours: monthlyStats.remainingHours,
      totalJobs: monthlyStats.totalJobs,
      totalAw: monthlyStats.totalAw,
      percentComplete: (monthlyStats.soldHours / monthlyStats.targetHours) * 100,
    };
  },

  async getEfficiencyDetails(month: string): Promise<EfficiencyDetails> {
    console.log('API: Fetching efficiency details for', month);
    const monthlyStats = await this.getMonthlyStats(month);
    return {
      month,
      soldHours: monthlyStats.soldHours,
      availableHours: monthlyStats.availableHours,
      efficiency: monthlyStats.efficiency,
      efficiencyColor: monthlyStats.efficiencyColor,
      weekdaysInMonth: 22, // Approximate
      absenceDays: 0,
      formula: 'Efficiency = (Sold Hours / Available Hours) × 100',
    };
  },

  async getAllTimeStats(): Promise<AllTimeStats> {
    console.log('API: Fetching all-time stats');
    const response = await apiFetch(`${API_URL}/api/stats/all-time`);
    if (!response.ok) {
      throw new Error('Failed to fetch all-time stats');
    }
    return response.json();
  },

  // Absence endpoints
  async getAbsences(month: string): Promise<Absence[]> {
    console.log('API: Fetching absences for', month);
    const response = await apiFetch(`${API_URL}/api/absences/${month}`);
    if (!response.ok) {
      throw new Error('Failed to fetch absences');
    }
    return response.json();
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
    console.log('API: Creating absence', absence);
    const response = await apiFetch(`${API_URL}/api/absences`, {
      method: 'POST',
      body: JSON.stringify(absence),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create absence');
    }
    return response.json();
  },

  async deleteAbsence(id: string): Promise<{ success: boolean }> {
    console.log('API: Deleting absence', id);
    const response = await apiFetch(`${API_URL}/api/absences/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete absence');
    }
    return response.json();
  },

  // Schedule endpoints
  async getSchedule(): Promise<Schedule> {
    console.log('API: Fetching schedule');
    const response = await apiFetch(`${API_URL}/api/schedule`);
    if (!response.ok) {
      throw new Error('Failed to fetch schedule');
    }
    return response.json();
  },

  async updateSchedule(schedule: Partial<Schedule>): Promise<Schedule> {
    console.log('API: Updating schedule', schedule);
    const response = await apiFetch(`${API_URL}/api/schedule`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update schedule');
    }
    return response.json();
  },

  // Technician Profile endpoints
  async getTechnicianProfile(): Promise<TechnicianProfile> {
    console.log('API: Fetching technician profile');
    const response = await apiFetch(`${API_URL}/api/profile`);
    if (!response.ok) {
      throw new Error('Failed to fetch technician profile');
    }
    return response.json();
  },

  async updateTechnicianProfile(profile: TechnicianProfile): Promise<TechnicianProfile> {
    console.log('API: Updating technician profile', profile);
    const response = await apiFetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update technician profile');
    }
    return response.json();
  },

  // Settings endpoints (using dashboard endpoint for monthly target)
  async getMonthlyTarget(): Promise<{ value: number }> {
    console.log('API: Fetching monthly target (default 180)');
    return { value: 180 };
  },

  async updateMonthlyTarget(value: number): Promise<{ value: number }> {
    console.log('API: Updating monthly target to', value, '(stored locally)');
    return { value };
  },

  // OCR endpoints
  async scanRegistration(imageUri: string): Promise<OCRRegResult> {
    console.log('API: Scanning registration from image');
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'registration.jpg',
    } as any);

    const response = await fetch(`${API_URL}/api/ocr/scan-reg`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Failed to scan registration');
    }
    return response.json();
  },

  async scanJobCard(imageUri: string): Promise<OCRJobCardResult> {
    console.log('API: Scanning job card from image');
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'jobcard.jpg',
    } as any);

    const response = await fetch(`${API_URL}/api/ocr/scan-job-card`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Failed to scan job card');
    }
    return response.json();
  },

  // Dashboard endpoint
  async getDashboard(month: string, targetHours: number = 180): Promise<DashboardData> {
    console.log('API: Fetching dashboard data for', month);
    const response = await apiFetch(`${API_URL}/api/dashboard?month=${month}&targetHours=${targetHours}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data');
    }
    return response.json();
  },

  // Recent jobs endpoint
  async getRecentJobs(limit: number = 10): Promise<Job[]> {
    console.log('API: Fetching recent jobs, limit:', limit);
    const response = await apiFetch(`${API_URL}/api/jobs/recent?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch recent jobs');
    }
    return response.json();
  },
};
