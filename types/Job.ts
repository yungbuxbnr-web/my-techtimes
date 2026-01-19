
export interface Job {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes?: string;
  createdAt: string;
}

export interface JobStats {
  totalJobs: number;
  totalAW: number;
  totalMinutes: number;
  totalHours: number;
  averageAW: number;
}
