
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'https://ampq3swwzgcg2uwbx64vdbw83nxxnays.app.specular.dev';

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
  averageAw: number;
}

export const api = {
  // Get all jobs
  async getAllJobs(): Promise<Job[]> {
    console.log('API: Fetching all jobs from', `${API_URL}/api/jobs`);
    const response = await fetch(`${API_URL}/api/jobs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }
    return response.json();
  },

  // Get today's jobs
  async getTodayJobs(): Promise<Job[]> {
    console.log('API: Fetching today jobs');
    const response = await fetch(`${API_URL}/api/jobs/today`);
    if (!response.ok) {
      throw new Error(`Failed to fetch today jobs: ${response.statusText}`);
    }
    return response.json();
  },

  // Get this week's jobs
  async getWeekJobs(): Promise<Job[]> {
    console.log('API: Fetching week jobs');
    const response = await fetch(`${API_URL}/api/jobs/week`);
    if (!response.ok) {
      throw new Error(`Failed to fetch week jobs: ${response.statusText}`);
    }
    return response.json();
  },

  // Get this month's jobs
  async getMonthJobs(): Promise<Job[]> {
    console.log('API: Fetching month jobs');
    const response = await fetch(`${API_URL}/api/jobs/month`);
    if (!response.ok) {
      throw new Error(`Failed to fetch month jobs: ${response.statusText}`);
    }
    return response.json();
  },

  // Get jobs in date range
  async getJobsInRange(start: string, end: string): Promise<Job[]> {
    console.log('API: Fetching jobs in range', start, 'to', end);
    const response = await fetch(`${API_URL}/api/jobs/range?start=${start}&end=${end}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs in range: ${response.statusText}`);
    }
    return response.json();
  },

  // Create a new job
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

  // Update a job
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

  // Delete a job
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

  // Get today's stats
  async getTodayStats(): Promise<JobStats> {
    console.log('API: Fetching today stats');
    const response = await fetch(`${API_URL}/api/stats/today`);
    if (!response.ok) {
      throw new Error('Failed to fetch today stats');
    }
    return response.json();
  },

  // Get week stats
  async getWeekStats(): Promise<JobStats> {
    console.log('API: Fetching week stats');
    const response = await fetch(`${API_URL}/api/stats/week`);
    if (!response.ok) {
      throw new Error('Failed to fetch week stats');
    }
    return response.json();
  },

  // Get month stats
  async getMonthStats(): Promise<JobStats> {
    console.log('API: Fetching month stats');
    const response = await fetch(`${API_URL}/api/stats/month`);
    if (!response.ok) {
      throw new Error('Failed to fetch month stats');
    }
    return response.json();
  },
};
