
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job } from './offlineStorage';

const COMEBACK_KEY = '@techtimes_comeback_classifications';

export interface VehicleHistoryMatch {
  job: Job;
  ageDays: number;
  isRelated: boolean;
  relatedReason?: string;
}

export interface ComebackClassification {
  id: string;
  wipNumber: string;          // normalised WIP of the NEW job
  vehicleReg: string;
  relatedWip?: string;        // normalised WIP of the previous job
  classification: 'related_previous_repair' | 'confirmed_comeback' | 'not_related';
  classifiedAt: string;
}

// Normalise registration: trim, uppercase, remove spaces
export function normalizeReg(reg: string): string {
  if (!reg) return '';
  return reg.trim().toUpperCase().replace(/\s+/g, '');
}

// Lookback thresholds in days
const LOOKBACK_RECENT = 30;
const LOOKBACK_EXTENDED = 90;

// Related repair keyword groups — conservative matching only
const RELATED_GROUPS: string[][] = [
  ['front brake', 'brake pad', 'brake disc', 'brake vibrat', 'front disc'],
  ['rear brake', 'rear pad', 'rear disc'],
  ['all disc', 'all brake', 'front & rear', 'front and rear'],
  ['brake fluid', 'bfs'],
  ['ac ', 'air con', 'ac regas', 'ac service', 'air conditioning', 'ac not cold'],
  ['battery', 'battery issue', 'battery replac'],
  ['software update', 'programming', 'software'],
  ['diagnostic', 'warning light', 'diag'],
  ['starter', 'starter motor'],
  ['transmission', 'gearbox'],
  ['tyre', 'tire'],
  ['pdi'],
  ['auc'],
  ['oil', 'service', 'full service', 'oil and micro'],
];

export function isRelatedRepair(currentDesc: string, previousDesc: string): { related: boolean; reason?: string } {
  if (!currentDesc || !previousDesc) return { related: false };
  const curr = currentDesc.toLowerCase();
  const prev = previousDesc.toLowerCase();
  for (const group of RELATED_GROUPS) {
    const currMatch = group.some(kw => curr.includes(kw));
    const prevMatch = group.some(kw => prev.includes(kw));
    if (currMatch && prevMatch) {
      return { related: true, reason: group[0] };
    }
  }
  return { related: false };
}

// Get recent vehicle history for a registration
// Returns jobs sorted newest-first, within LOOKBACK_EXTENDED days
export function getRecentVehicleHistory(
  normalizedReg: string,
  allJobs: Job[],
  currentWip?: string   // exclude jobs belonging to the current WIP
): VehicleHistoryMatch[] {
  if (!normalizedReg) return [];
  const now = Date.now();
  return allJobs
    .filter(j => {
      const reg = normalizeReg(j.vehicleReg);
      if (reg !== normalizedReg) return false;
      if (currentWip && j.wipNumber?.trim().toUpperCase().replace(/\s+/g, '') === currentWip) return false;
      const ageDays = Math.floor((now - new Date(j.createdAt).getTime()) / 86400000);
      return ageDays <= LOOKBACK_EXTENDED;
    })
    .map(j => ({
      job: j,
      ageDays: Math.floor((now - new Date(j.createdAt).getTime()) / 86400000),
      isRelated: false,
    }))
    .sort((a, b) => a.ageDays - b.ageDays);
}

// Enrich matches with related-repair detection against a current description
export function enrichWithRelatedRepair(
  matches: VehicleHistoryMatch[],
  currentDesc: string
): VehicleHistoryMatch[] {
  return matches.map(m => {
    const { related, reason } = isRelatedRepair(currentDesc, m.job.notes ?? '');
    return { ...m, isRelated: related, relatedReason: reason };
  });
}

export const comebackStorage = {
  async getAll(): Promise<ComebackClassification[]> {
    try {
      const raw = await AsyncStorage.getItem(COMEBACK_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  async save(entry: ComebackClassification): Promise<void> {
    try {
      const all = await comebackStorage.getAll();
      const idx = all.findIndex(e => e.wipNumber === entry.wipNumber);
      if (idx !== -1) all[idx] = entry; else all.push(entry);
      await AsyncStorage.setItem(COMEBACK_KEY, JSON.stringify(all));
    } catch {}
  },
  async getForWip(normalizedWip: string): Promise<ComebackClassification | null> {
    const all = await comebackStorage.getAll();
    return all.find(e => e.wipNumber === normalizedWip) ?? null;
  },
};
