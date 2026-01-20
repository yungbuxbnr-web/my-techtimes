
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://ampq3swwzgcg2uwbx64vdbw83nxxnays.app.specular.dev';

console.log('API: Backend URL configured as:', API_URL);

export const BACKEND_URL = API_URL;

export interface Job {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes?: string;
  createdAt: string;
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
  daysCount: number;
  isHalfDay: boolean;
  deductionType: 'target' | 'available';
  createdAt: string;
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
    const response = await fetch(`${API_URL}/api/jobs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getTodayJobs(): Promise<Job[]> {
    console.log('API: Fetching today jobs');
    const response = await fetch(`${API_URL}/api/jobs/today`);
    if (!response.ok) {
      throw new Error(`Failed to fetch today jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getWeekJobs(): Promise<Job[]> {
    console.log('API: Fetching week jobs');
    const response = await fetch(`${API_URL}/api/jobs/week`);
    if (!response.ok) {
      throw new Error(`Failed to fetch week jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getMonthJobs(): Promise<Job[]> {
    console.log('API: Fetching month jobs');
    const response = await fetch(`${API_URL}/api/jobs/month`);
    if (!response.ok) {
      throw new Error(`Failed to fetch month jobs: ${response.statusText}`);
    }
    return response.json();
  },

  async getJobsInRange(start: string, end: string): Promise<Job[]> {
    console.log('API: Fetching jobs in range', start, 'to', end);
    const response = await fetch(`${API_URL}/api/jobs/range?start=${start}&end=${end}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs in range: ${response.statusText}`);
    }
    return response.json();
  },

  async createJob(job: { wipNumber: string; vehicleReg: string; aw: number; notes?: string }): Promise<Job> {
    console.log('API: Creating job', job);
    const response = await fetch(`${API_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(job),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create job');
    }
    return response.json();
  },

  async updateJob(id: string, updates: Partial<{ wipNumber: string; vehicleReg: string; aw: number; notes: string }>): Promise<Job> {
    console.log('API: Updating job', id, updates);
    const response = await fetch(`${API_URL}/api/jobs/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_URL}/api/jobs/${id}`, {
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
    const response = await fetch(`${API_URL}/api/stats/today`);
    if (!response.ok) {
      throw new Error('Failed to fetch today stats');
    }
    return response.json();
  },

  async getWeekStats(): Promise<JobStats> {
    console.log('API: Fetching week stats');
    const response = await fetch(`${API_URL}/api/stats/week`);
    if (!response.ok) {
      throw new Error('Failed to fetch week stats');
    }
    return response.json();
  },

  async getMonthStats(): Promise<JobStats> {
    console.log('API: Fetching month stats');
    const response = await fetch(`${API_URL}/api/stats/month`);
    if (!response.ok) {
      throw new Error('Failed to fetch month stats');
    }
    return response.json();
  },

  async getMonthlyStats(month: string): Promise<MonthlyStats> {
    console.log('API: Fetching monthly stats for', month);
    const response = await fetch(`${API_URL}/api/stats/monthly/${month}`);
    if (!response.ok) {
      throw new Error('Failed to fetch monthly stats');
    }
    return response.json();
  },

  async getTargetDetails(month: string): Promise<TargetDetails> {
    console.log('API: Fetching target details for', month);
    const response = await fetch(`${API_URL}/api/stats/target-details/${month}`);
    if (!response.ok) {
      throw new Error('Failed to fetch target details');
    }
    return response.json();
  },

  async getEfficiencyDetails(month: string): Promise<EfficiencyDetails> {
    console.log('API: Fetching efficiency details for', month);
    const response = await fetch(`${API_URL}/api/stats/efficiency-details/${month}`);
    if (!response.ok) {
      throw new Error('Failed to fetch efficiency details');
    }
    return response.json();
  },

  // Absence endpoints
  async getAbsences(month: string): Promise<Absence[]> {
    console.log('API: Fetching absences for', month);
    const response = await fetch(`${API_URL}/api/absences/${month}`);
    if (!response.ok) {
      throw new Error('Failed to fetch absences');
    }
    return response.json();
  },

  async createAbsence(absence: { month: string; daysCount: number; isHalfDay: boolean; deductionType: 'target' | 'available' }): Promise<Absence> {
    console.log('API: Creating absence', absence);
    const response = await fetch(`${API_URL}/api/absences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_URL}/api/absences/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete absence');
    }
    return response.json();
  },

  // Settings endpoints
  async getMonthlyTarget(): Promise<{ value: number }> {
    console.log('API: Fetching monthly target');
    const response = await fetch(`${API_URL}/api/settings/monthly-target`);
    if (!response.ok) {
      throw new Error('Failed to fetch monthly target');
    }
    return response.json();
  },

  async updateMonthlyTarget(value: number): Promise<{ value: number }> {
    console.log('API: Updating monthly target to', value);
    const response = await fetch(`${API_URL}/api/settings/monthly-target`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update monthly target');
    }
    return response.json();
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
};
