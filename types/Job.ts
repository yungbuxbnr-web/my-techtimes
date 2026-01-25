
export interface Job {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes?: string;
  vhcStatus: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
  createdAt: string;
  imageUri?: string; // Optional job card image attachment
}

export interface JobStats {
  totalJobs: number;
  totalAW: number;
  totalMinutes: number;
  totalHours: number;
  averageAW: number;
}
