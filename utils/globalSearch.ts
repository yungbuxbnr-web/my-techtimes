
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeReg } from './comebackDetection';
import { groupJobsByWip } from './wipEngine';

const SEARCH_HISTORY_KEY = '@techtimes_global_search_history';
const MAX_HISTORY = 20;

export interface SearchResult {
  id: string;
  type: 'wip' | 'vehicle' | 'job' | 'technical_case' | 'billing' | 'blocker';
  title: string;
  subtitle: string;
  detail?: string;
  wipNumber?: string;
  vehicleReg?: string;
  jobId?: string;
  status?: string;
  navigateTo: string;
  navigateParams?: Record<string, string>;
}

export interface SearchResultGroup {
  type: string;
  label: string;
  results: SearchResult[];
}

const GROUP_LABELS: Record<string, string> = {
  wip: 'WIPS',
  vehicle: 'VEHICLES',
  job: 'JOBS',
  technical_case: 'TECHNICAL CASES',
  billing: 'BILLING',
  blocker: 'BLOCKERS',
};

export async function searchAll(
  query: string,
  jobs: any[],
  billingRecords: any[],
  technicalCases: any[],
  wipBlockers: any[]
): Promise<SearchResultGroup[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  const seenWips = new Set<string>();
  const seenVehicles = new Set<string>();

  // WIP and Vehicle search from jobs
  const wipMap = groupJobsByWip(jobs, billingRecords);
  for (const [normalizedWip, wip] of wipMap.entries()) {
    const wipNum = normalizedWip.toLowerCase();
    const reg = (wip.vehicleReg || '').toLowerCase();
    const normalizedQueryReg = normalizeReg(query).toLowerCase();

    const wipMatch = wipNum.includes(q);
    const regMatch = reg.includes(q) || normalizeReg(wip.vehicleReg || '').toLowerCase().includes(normalizedQueryReg);

    if (wipMatch && !seenWips.has(normalizedWip)) {
      seenWips.add(normalizedWip);
      results.push({
        id: `wip_${normalizedWip}`,
        type: 'wip',
        title: `WIP ${wip.displayWip}`,
        subtitle: wip.vehicleReg || 'No registration',
        detail: `${wip.sessions.length} session${wip.sessions.length !== 1 ? 's' : ''} · ${wip.totalAW} AW`,
        wipNumber: normalizedWip,
        vehicleReg: wip.vehicleReg,
        status: wip.status,
        navigateTo: '/wip-workspace',
        navigateParams: { wip: normalizedWip },
      });
    }

    if (regMatch && wip.vehicleReg && !seenVehicles.has(wip.vehicleReg.toUpperCase())) {
      seenVehicles.add(wip.vehicleReg.toUpperCase());
      results.push({
        id: `vehicle_${wip.vehicleReg}`,
        type: 'vehicle',
        title: wip.vehicleReg.toUpperCase(),
        subtitle: `${wip.sessions.length} visit${wip.sessions.length !== 1 ? 's' : ''}`,
        detail: `Last WIP: ${wip.displayWip}`,
        vehicleReg: wip.vehicleReg,
        navigateTo: '/vehicle-history',
        navigateParams: { reg: wip.vehicleReg.toUpperCase() },
      });
    }
  }

  // Job notes search
  for (const job of jobs) {
    const notes = (job.notes || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    if (notes.includes(q) || desc.includes(q)) {
      results.push({
        id: `job_${job.id}`,
        type: 'job',
        title: job.notes ? job.notes.slice(0, 60) : 'No description',
        subtitle: `WIP ${job.wipNumber || '—'} · ${job.vehicleReg || '—'}`,
        detail: `${job.aw} AW`,
        wipNumber: job.wipNumber,
        vehicleReg: job.vehicleReg,
        jobId: job.id,
        navigateTo: '/wip-workspace',
        navigateParams: { wip: job.wipNumber || '' },
      });
    }
  }

  // Technical cases search
  for (const tc of technicalCases) {
    const title = (tc.title || '').toLowerCase();
    const description = (tc.description || '').toLowerCase();
    const caseNum = (tc.caseNumber || tc.id || '').toLowerCase();
    if (title.includes(q) || description.includes(q) || caseNum.includes(q)) {
      results.push({
        id: `tc_${tc.id}`,
        type: 'technical_case',
        title: tc.title || 'Untitled Case',
        subtitle: tc.caseNumber ? `Case #${tc.caseNumber}` : 'Technical Case',
        detail: tc.description ? tc.description.slice(0, 60) : undefined,
        status: tc.status,
        navigateTo: '/technical-cases',
      });
    }
  }

  // Billing search
  for (const br of billingRecords) {
    const wipNum = (br.wipNumber || '').toLowerCase();
    const status = (br.billingStatus || br.status || '').toLowerCase();
    const reg = (br.vehicleReg || '').toLowerCase();
    if (wipNum.includes(q) || status.includes(q) || reg.includes(q)) {
      results.push({
        id: `billing_${br.id}`,
        type: 'billing',
        title: `WIP ${br.wipNumber || '—'}`,
        subtitle: `${br.vehicleReg || '—'} · ${(br.billingStatus || br.status || '').toUpperCase()}`,
        detail: br.billedAW ? `${br.billedAW} AW` : undefined,
        wipNumber: br.wipNumber,
        status: br.billingStatus || br.status,
        navigateTo: '/wip-workspace',
        navigateParams: { wip: br.wipNumber || '' },
      });
    }
  }

  // Blocker search
  for (const blocker of wipBlockers) {
    const note = (blocker.note || '').toLowerCase();
    const reason = (blocker.reason || '').toLowerCase();
    const wipNum = (blocker.normalizedWip || '').toLowerCase();
    if (note.includes(q) || reason.includes(q) || wipNum.includes(q)) {
      results.push({
        id: `blocker_${blocker.id}`,
        type: 'blocker',
        title: `WIP ${blocker.normalizedWip || '—'} Blocked`,
        subtitle: blocker.reason ? blocker.reason.replace(/_/g, ' ').toUpperCase() : 'Blocked',
        detail: blocker.note || undefined,
        wipNumber: blocker.normalizedWip,
        navigateTo: '/open-job-control',
      });
    }
  }

  // Group by type
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!grouped.has(r.type)) grouped.set(r.type, []);
    grouped.get(r.type)!.push(r);
  }

  const typeOrder = ['wip', 'vehicle', 'job', 'technical_case', 'billing', 'blocker'];
  const groups: SearchResultGroup[] = [];
  for (const type of typeOrder) {
    const typeResults = grouped.get(type);
    if (typeResults && typeResults.length > 0) {
      groups.push({
        type,
        label: GROUP_LABELS[type] || type.toUpperCase(),
        results: typeResults.slice(0, 10),
      });
    }
  }

  return groups;
}

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addSearchHistory(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  try {
    const history = await getSearchHistory();
    const filtered = history.filter(h => h.toLowerCase() !== q.toLowerCase());
    filtered.unshift(q);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
  } catch {}
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
}
