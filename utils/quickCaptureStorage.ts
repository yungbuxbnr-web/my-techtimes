
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QuickPreset {
  id: string;
  name: string;
  description: string;
  category: 'service' | 'workshop' | 'brakes' | 'pdi' | 'custom';
  suggestedAW?: number;
  isFavourite: boolean;
  isDefault: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickCaptureStats {
  frequencyMap: Record<string, number>;
  awHistory: Record<string, number[]>;
  recentDescriptions: string[];
  newPresetCandidates: string[];
  updatedAt: string;
}

const KEYS = {
  PRESETS: '@techtimes_quick_presets',
  STATS: '@techtimes_quick_capture_stats',
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function normaliseDescription(desc: string): string {
  return desc.trim().toLowerCase()
    .replace(/\bpdi\b/g, 'pdi')
    .replace(/\bvhc\b/g, 'vhc')
    .replace(/\bauc\b/g, 'auc')
    .replace(/oil\s*[&and]+\s*micro/g, 'oil and micro')
    .replace(/brake\s*fluid\s*(service)?/g, 'brake fluid')
    .replace(/\bbfs\b/g, 'brake fluid')
    .replace(/\s+/g, ' ');
}

const now = () => new Date().toISOString();

const DEFAULT_PRESETS_DATA: Omit<QuickPreset, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // PDI
  { name: 'PDI', description: 'PDI', category: 'pdi', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'PDI & Plates', description: 'PDI and plates', category: 'pdi', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'PDI Battery', description: 'PDI with battery charge', category: 'pdi', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'AUC', description: 'AUC', category: 'pdi', isFavourite: false, isDefault: true, usageCount: 0 },
  // Service
  { name: 'Oil & Micro', description: 'Oil and micro', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Full Service', description: 'Full service', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'EV Full Service', description: 'EV full service', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Brake Fluid', description: 'Brake fluid service', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Transmission', description: 'Transmission service', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'AC Service', description: 'AC service', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'AC Regas', description: 'AC regas', category: 'service', isFavourite: false, isDefault: true, usageCount: 0 },
  // Workshop
  { name: 'VHC', description: 'VHC', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Diagnostic', description: 'Diagnostic', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Software Update', description: 'Software update', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Programming', description: 'Programming', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Battery', description: 'Battery replacement', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Airbag', description: 'Airbag', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Starter', description: 'Starter', category: 'workshop', isFavourite: false, isDefault: true, usageCount: 0 },
  // Brakes
  { name: 'Front Brakes', description: 'Front brakes', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'Rear Brakes', description: 'Rear brakes', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'F&R Brakes', description: 'Front and rear brakes', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: 'All Discs & Pads', description: 'All discs and pads', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: '1 Tyre', description: '1 tyre', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: '2 Tyres', description: '2 tyres', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
  { name: '4 Tyres', description: '4 tyres', category: 'brakes', isFavourite: false, isDefault: true, usageCount: 0 },
];

function buildDefaultPresets(): QuickPreset[] {
  const ts = now();
  return DEFAULT_PRESETS_DATA.map(d => ({
    ...d,
    id: genId(),
    createdAt: ts,
    updatedAt: ts,
  }));
}

export const quickCaptureStorage = {
  async getAll(): Promise<QuickPreset[]> {
    try {
      const r = await AsyncStorage.getItem(KEYS.PRESETS);
      if (r) {
        const parsed: QuickPreset[] = JSON.parse(r);
        if (parsed.length > 0) return parsed;
      }
      // Seed defaults on first call
      const defaults = buildDefaultPresets();
      await AsyncStorage.setItem(KEYS.PRESETS, JSON.stringify(defaults));
      console.log('quickCaptureStorage: Seeded', defaults.length, 'default presets');
      return defaults;
    } catch {
      return buildDefaultPresets();
    }
  },

  async saveAll(presets: QuickPreset[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.PRESETS, JSON.stringify(presets));
  },

  async create(
    data: Omit<QuickPreset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isDefault'>
  ): Promise<QuickPreset> {
    const all = await this.getAll();
    const ts = now();
    const preset: QuickPreset = {
      ...data,
      id: genId(),
      isDefault: false,
      usageCount: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.saveAll([...all, preset]);
    console.log('quickCaptureStorage: Created preset', preset.id, preset.name);
    return preset;
  },

  async update(id: string, data: Partial<QuickPreset>): Promise<void> {
    const all = await this.getAll();
    await this.saveAll(
      all.map(p => (p.id === id ? { ...p, ...data, updatedAt: now() } : p))
    );
    console.log('quickCaptureStorage: Updated preset', id);
  },

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    const target = all.find(p => p.id === id);
    if (target?.isDefault) {
      console.warn('quickCaptureStorage: Cannot delete default preset', id);
      return;
    }
    await this.saveAll(all.filter(p => p.id !== id));
    console.log('quickCaptureStorage: Deleted preset', id);
  },

  async toggleFavourite(id: string): Promise<void> {
    const all = await this.getAll();
    const target = all.find(p => p.id === id);
    if (!target) return;
    const newVal = !target.isFavourite;
    await this.saveAll(
      all.map(p => (p.id === id ? { ...p, isFavourite: newVal, updatedAt: now() } : p))
    );
    console.log('quickCaptureStorage: Toggled favourite for preset', id, '->', newVal);
  },

  async recordUsage(id: string): Promise<void> {
    const all = await this.getAll();
    await this.saveAll(
      all.map(p =>
        p.id === id
          ? { ...p, usageCount: p.usageCount + 1, lastUsed: now(), updatedAt: now() }
          : p
      )
    );
    console.log('quickCaptureStorage: Recorded usage for preset', id);
  },

  async resetDefaults(): Promise<void> {
    const all = await this.getAll();
    const custom = all.filter(p => !p.isDefault);
    const defaults = buildDefaultPresets();
    await this.saveAll([...defaults, ...custom]);
    console.log('quickCaptureStorage: Reset defaults, preserved', custom.length, 'custom presets');
  },
};

const EMPTY_STATS: QuickCaptureStats = {
  frequencyMap: {},
  awHistory: {},
  recentDescriptions: [],
  newPresetCandidates: [],
  updatedAt: new Date().toISOString(),
};

export const quickCaptureStats = {
  async getStats(): Promise<QuickCaptureStats> {
    try {
      const r = await AsyncStorage.getItem(KEYS.STATS);
      return r ? JSON.parse(r) : { ...EMPTY_STATS };
    } catch {
      return { ...EMPTY_STATS };
    }
  },

  async saveStats(stats: QuickCaptureStats): Promise<void> {
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  },

  async learnFromSavedJob(description: string, aw: number): Promise<void> {
    if (!description.trim()) return;
    const stats = await this.getStats();
    const key = normaliseDescription(description);

    // Update frequency map
    stats.frequencyMap[key] = (stats.frequencyMap[key] ?? 0) + 1;

    // Update AW history
    if (aw > 0) {
      const hist = stats.awHistory[key] ?? [];
      hist.push(aw);
      // Keep last 20 values
      stats.awHistory[key] = hist.slice(-20);
    }

    // Update recent descriptions (most recent first, unique, max 10)
    stats.recentDescriptions = [
      key,
      ...stats.recentDescriptions.filter(d => d !== key),
    ].slice(0, 10);

    // Update new preset candidates (used 3+ times, not already a preset)
    const allPresets = await quickCaptureStorage.getAll();
    const presetDescriptions = new Set(
      allPresets.map(p => normaliseDescription(p.description))
    );
    stats.newPresetCandidates = Object.entries(stats.frequencyMap)
      .filter(([desc, count]) => count >= 3 && !presetDescriptions.has(desc))
      .sort((a, b) => b[1] - a[1])
      .map(([desc]) => desc)
      .slice(0, 10);

    stats.updatedAt = now();
    await this.saveStats(stats);
    console.log('quickCaptureStats: Learned from saved job, description:', key, 'aw:', aw);
  },

  async getSuggestedAW(
    description: string
  ): Promise<{ suggested: number; range: [number, number]; count: number } | null> {
    if (!description.trim()) return null;
    const stats = await this.getStats();
    const key = normaliseDescription(description);
    const hist = stats.awHistory[key];
    if (!hist || hist.length === 0) return null;

    const sorted = [...hist].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];

    return {
      suggested: median,
      range: [sorted[0], sorted[sorted.length - 1]],
      count: sorted.length,
    };
  },

  async getFrequentDescriptions(n: number = 8): Promise<string[]> {
    const stats = await this.getStats();
    return Object.entries(stats.frequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([desc]) => desc);
  },

  async getRecentDescriptions(n: number = 8): Promise<string[]> {
    const stats = await this.getStats();
    return stats.recentDescriptions.slice(0, n);
  },

  async getNewPresetCandidates(): Promise<string[]> {
    const stats = await this.getStats();
    return stats.newPresetCandidates;
  },
};
