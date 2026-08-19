
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface JobTemplate {
  id: string;
  name: string;
  description: string;
  defaultNotes: string;
  defaultAW: number | null;
  defaultVhcStatus: 'NONE' | 'GREEN' | 'ORANGE' | 'RED';
  tags: string[];
  isFavourite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface HandoverEntry {
  id: string;
  jobId: string;
  wipNumber: string;
  vehicleReg: string;
  note: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  carryOverDate: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TechnicalCase {
  id: string;
  title: string;
  vehicleReg: string;
  vehicle: string;
  date: string;
  wipNumber: string;
  symptoms: string;
  faultCodes: string;
  initialFindings: string;
  testsPerformed: string;
  measurements: string;
  diagnosis: string;
  rootCause: string;
  repairAction: string;
  result: string;
  notes: string;
  tags: string[];
  linkedJobId?: string;
  isFavourite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: string[];
  period: 'day' | 'week' | 'month' | 'year' | 'entire' | 'custom';
  viewBy: 'work_date' | 'billing_date';
  includeJobList: boolean;
  includeCharts: boolean;
  includeRegistrations: boolean;
  createdAt: string;
  updatedAt: string;
}

const KEYS = {
  TEMPLATES: '@techtimes_job_templates',
  HANDOVER: '@techtimes_handover',
  CASES: '@techtimes_technical_cases',
  REPORT_TEMPLATES: '@techtimes_report_templates',
  SEARCH_HISTORY: '@techtimes_search_history',
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const templateStorage = {
  async getAll(): Promise<JobTemplate[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.TEMPLATES);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },
  async save(items: JobTemplate[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(items));
  },
  async create(data: Omit<JobTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<JobTemplate> {
    const all = await this.getAll();
    const t: JobTemplate = {
      ...data,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };
    await this.save([...all, t]);
    return t;
  },
  async update(id: string, updates: Partial<JobTemplate>): Promise<void> {
    const all = await this.getAll();
    await this.save(
      all.map(t => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
  },
  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await this.save(all.filter(t => t.id !== id));
  },
  async incrementUsage(id: string): Promise<void> {
    const all = await this.getAll();
    await this.save(all.map(t => (t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t)));
  },
};

export const handoverStorage = {
  async getAll(): Promise<HandoverEntry[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.HANDOVER);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },
  async save(items: HandoverEntry[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.HANDOVER, JSON.stringify(items));
  },
  async create(data: Omit<HandoverEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<HandoverEntry> {
    const all = await this.getAll();
    const e: HandoverEntry = {
      ...data,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.save([...all, e]);
    return e;
  },
  async update(id: string, updates: Partial<HandoverEntry>): Promise<void> {
    const all = await this.getAll();
    await this.save(
      all.map(e => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
    );
  },
  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await this.save(all.filter(e => e.id !== id));
  },
};

export const caseStorage = {
  async getAll(): Promise<TechnicalCase[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.CASES);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },
  async save(items: TechnicalCase[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CASES, JSON.stringify(items));
  },
  async create(data: Omit<TechnicalCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TechnicalCase> {
    const all = await this.getAll();
    const c: TechnicalCase = {
      ...data,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.save([...all, c]);
    return c;
  },
  async update(id: string, updates: Partial<TechnicalCase>): Promise<void> {
    const all = await this.getAll();
    await this.save(
      all.map(c => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c))
    );
  },
  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await this.save(all.filter(c => c.id !== id));
  },
};

export const reportTemplateStorage = {
  async getAll(): Promise<ReportTemplate[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.REPORT_TEMPLATES);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },
  async save(items: ReportTemplate[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.REPORT_TEMPLATES, JSON.stringify(items));
  },
  async create(data: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    const all = await this.getAll();
    const t: ReportTemplate = {
      ...data,
      id: genId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.save([...all, t]);
    return t;
  },
  async update(id: string, updates: Partial<ReportTemplate>): Promise<void> {
    const all = await this.getAll();
    await this.save(
      all.map(t => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
  },
  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    await this.save(all.filter(t => t.id !== id));
  },
};

export const searchHistoryStorage = {
  async getRecent(): Promise<string[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.SEARCH_HISTORY);
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },
  async add(query: string): Promise<void> {
    const h = await this.getRecent();
    await AsyncStorage.setItem(
      KEYS.SEARCH_HISTORY,
      JSON.stringify([query, ...h.filter(x => x !== query)].slice(0, 20))
    );
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.SEARCH_HISTORY);
  },
};
