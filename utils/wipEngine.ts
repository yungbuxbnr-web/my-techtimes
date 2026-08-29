
import { billingStorage, BillingRecord } from './billingStorage';
import { Job } from './offlineStorage';
import { normaliseBillingStatus, awToHours } from './billingEngine';
import { jobHistoryStorage, JobHistoryEntry } from './jobHistoryStorage';
import { getAllImages, StoredImage } from './imageStorage';
import { caseStorage, handoverStorage } from './moduleStorage';

// ── Normalisation ─────────────────────────────────────────────────────────────
export function normalizeWip(wip: string): string {
  if (!wip) return '';
  return wip.trim().replace(/\s+/g, '').toUpperCase();
}

// ── WIP conflict detection ────────────────────────────────────────────────────
export interface WipConflict {
  type: 'vehicle_mismatch';
  wip: string;
  existingReg: string;
  newReg: string;
}

export function detectWipVehicleConflict(
  normalizedWip: string,
  newReg: string,
  existingJobs: Job[]
): WipConflict | null {
  const wipJobs = existingJobs.filter(j => normalizeWip(j.wipNumber) === normalizedWip);
  if (wipJobs.length === 0) return null;
  const normalizedNewReg = newReg.trim().toUpperCase();
  const conflict = wipJobs.find(j => j.vehicleReg.trim().toUpperCase() !== normalizedNewReg);
  if (!conflict) return null;
  return {
    type: 'vehicle_mismatch',
    wip: normalizedWip,
    existingReg: conflict.vehicleReg.toUpperCase(),
    newReg: normalizedNewReg,
  };
}

// ── WIP status ────────────────────────────────────────────────────────────────
export type WipStatus = 'open' | 'billed' | 'mixed' | 'unknown';

export interface WipSummary {
  normalizedWip: string;
  displayWip: string;
  vehicleReg: string;
  sessions: Job[];
  billingRecords: BillingRecord[];
  totalAW: number;
  totalHours: number;
  firstWorked: string;
  lastWorked: string;
  sessionCount: number;
  status: WipStatus;
  hasConflict: boolean;
}

export function getWipBillingStatus(billingRecords: BillingRecord[]): WipStatus {
  if (billingRecords.length === 0) return 'unknown';
  const statuses = billingRecords.map(r => normaliseBillingStatus(r.billingStatus));
  const allBilled = statuses.every(s => s === 'billed');
  const allOpen = statuses.every(s => s === 'open');
  if (allBilled) return 'billed';
  if (allOpen) return 'open';
  return 'mixed';
}

export function getJobsForWip(normalizedWip: string, allJobs: Job[]): Job[] {
  return allJobs.filter(j => normalizeWip(j.wipNumber) === normalizedWip);
}

export function getBillingRecordsForWip(normalizedWip: string, allRecords: BillingRecord[]): BillingRecord[] {
  return allRecords.filter(r => normalizeWip(r.wipNumber ?? '') === normalizedWip);
}

export function getWipSummary(
  normalizedWip: string,
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): WipSummary {
  const sessions = getJobsForWip(normalizedWip, allJobs);
  const billingRecords = getBillingRecordsForWip(normalizedWip, allBillingRecords);

  const totalAW = sessions.reduce((s, j) => s + (j.aw ?? 0), 0);
  const totalHours = sessions.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);

  const dates = sessions.map(j => j.createdAt).sort();
  const firstWorked = dates[0] ?? '';
  const lastWorked = dates[dates.length - 1] ?? '';

  const vehicleReg = sessions[0]?.vehicleReg ?? '';
  const regs = new Set(sessions.map(j => j.vehicleReg.trim().toUpperCase()));
  const hasConflict = regs.size > 1;

  const status = getWipBillingStatus(billingRecords);

  return {
    normalizedWip,
    displayWip: sessions[0]?.wipNumber ?? normalizedWip,
    vehicleReg,
    sessions,
    billingRecords,
    totalAW,
    totalHours,
    firstWorked,
    lastWorked,
    sessionCount: sessions.length,
    status,
    hasConflict,
  };
}

// ── Complete WIP (Job Finished) ───────────────────────────────────────────────
export async function completeWip(
  triggerJobId: string,
  normalizedWip: string,
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): Promise<{ updated: number; skipped: number; failed: number }> {
  console.log('wipEngine.completeWip: Starting for WIP:', normalizedWip, 'trigger:', triggerJobId);
  const sessions = getJobsForWip(normalizedWip, allJobs);
  const billingByJobId = new Map(allBillingRecords.map(r => [r.jobId, r]));

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  for (const session of sessions) {
    try {
      const billing = billingByJobId.get(session.id);
      if (!billing) {
        console.log('wipEngine.completeWip: No billing record for session', session.id, '— creating one');
        const newRecord = await billingStorage.createRecord({
          jobId: session.id,
          workStatus: 'work_complete',
          billingStatus: 'billed',
          billedAW: session.aw,
          billedHours: awToHours(session.aw),
          billedDate: today,
          billedAt: now,
          wipNumber: session.wipNumber,
          vehicleReg: session.vehicleReg,
          workDate: session.createdAt.split('T')[0],
        });
        await billingStorage.addHistoryEntry({
          billingRecordId: newRecord.id,
          jobId: session.id,
          eventType: 'marked_billed',
          description: `WIP ${normalizedWip} completed — session billed (${session.aw} AW)`,
          newAW: session.aw,
          newHours: awToHours(session.aw),
        });
        updated++;
        continue;
      }

      if (normaliseBillingStatus(billing.billingStatus) === 'billed') {
        console.log('wipEngine.completeWip: Session', session.id, 'already billed — skipping');
        skipped++;
        continue;
      }

      await billingStorage.updateRecord(billing.id, {
        workStatus: 'work_complete',
        billingStatus: 'billed',
        billedAW: session.aw,
        billedHours: awToHours(session.aw),
        billedDate: today,
        billedAt: now,
      });
      await billingStorage.addHistoryEntry({
        billingRecordId: billing.id,
        jobId: session.id,
        eventType: 'marked_billed',
        description: `WIP ${normalizedWip} completed — session billed (${session.aw} AW)${session.id === triggerJobId ? ' [trigger session]' : ''}`,
        previousAW: billing.billedAW,
        previousHours: billing.billedHours,
        newAW: session.aw,
        newHours: awToHours(session.aw),
      });
      updated++;
    } catch (err) {
      console.error('wipEngine.completeWip: Failed for session', session.id, err);
      failed++;
    }
  }

  console.log('wipEngine.completeWip: Done — updated:', updated, 'skipped:', skipped, 'failed:', failed);
  return { updated, skipped, failed };
}

// ── Reopen WIP ────────────────────────────────────────────────────────────────
export async function reopenWip(
  normalizedWip: string,
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): Promise<{ updated: number; failed: number }> {
  console.log('wipEngine.reopenWip: Starting for WIP:', normalizedWip);
  const sessions = getJobsForWip(normalizedWip, allJobs);
  const billingByJobId = new Map(allBillingRecords.map(r => [r.jobId, r]));

  let updated = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      const billing = billingByJobId.get(session.id);
      if (!billing) continue;
      if (normaliseBillingStatus(billing.billingStatus) === 'open') continue;

      await billingStorage.updateRecord(billing.id, {
        workStatus: 'open',
        billingStatus: 'open',
      });
      await billingStorage.addHistoryEntry({
        billingRecordId: billing.id,
        jobId: session.id,
        eventType: 'billing_reopened',
        description: `WIP ${normalizedWip} reopened — session returned to Open`,
        previousAW: billing.billedAW,
        previousHours: billing.billedHours,
      });
      updated++;
    } catch (err) {
      console.error('wipEngine.reopenWip: Failed for session', session.id, err);
      failed++;
    }
  }

  console.log('wipEngine.reopenWip: Done — updated:', updated, 'failed:', failed);
  return { updated, failed };
}

// ── Validate WIP group ────────────────────────────────────────────────────────
export async function validateWipGroup(
  normalizedWip: string,
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): Promise<{ repaired: number; conflicts: WipConflict[] }> {
  console.log('wipEngine.validateWipGroup: Validating WIP:', normalizedWip);
  const sessions = getJobsForWip(normalizedWip, allJobs);
  const billingRecords = getBillingRecordsForWip(normalizedWip, allBillingRecords);
  const status = getWipBillingStatus(billingRecords);

  const conflicts: WipConflict[] = [];
  let repaired = 0;

  const regs = new Set(sessions.map(j => j.vehicleReg.trim().toUpperCase()));
  if (regs.size > 1) {
    const regsArr = Array.from(regs);
    conflicts.push({
      type: 'vehicle_mismatch',
      wip: normalizedWip,
      existingReg: regsArr[0],
      newReg: regsArr[1],
    });
  }

  if (status === 'mixed' && conflicts.length === 0) {
    const billedCount = billingRecords.filter(r => normaliseBillingStatus(r.billingStatus) === 'billed').length;
    const openCount = billingRecords.length - billedCount;
    if (billedCount > openCount) {
      const billingByJobId = new Map(allBillingRecords.map(r => [r.jobId, r]));
      for (const session of sessions) {
        const billing = billingByJobId.get(session.id);
        if (!billing) continue;
        if (normaliseBillingStatus(billing.billingStatus) === 'open') {
          await billingStorage.updateRecord(billing.id, {
            workStatus: 'work_complete',
            billingStatus: 'billed',
            billedAW: session.aw,
            billedHours: awToHours(session.aw),
          });
          await billingStorage.addHistoryEntry({
            billingRecordId: billing.id,
            jobId: session.id,
            eventType: 'marked_billed',
            description: `WIP ${normalizedWip} status repaired — session was Open while WIP was majority Billed`,
          });
          repaired++;
        }
      }
    }
  }

  console.log('wipEngine.validateWipGroup: Done — repaired:', repaired, 'conflicts:', conflicts.length);
  return { repaired, conflicts };
}

// ── Group all jobs by WIP ─────────────────────────────────────────────────────
export function groupJobsByWip(
  allJobs: Job[],
  allBillingRecords: BillingRecord[]
): Map<string, WipSummary> {
  const wipMap = new Map<string, WipSummary>();
  const normalizedWips = new Set(allJobs.map(j => normalizeWip(j.wipNumber)));

  for (const nwip of normalizedWips) {
    if (!nwip) continue;
    wipMap.set(nwip, getWipSummary(nwip, allJobs, allBillingRecords));
  }

  return wipMap;
}

// ── WIP Timeline ──────────────────────────────────────────────────────────────

export interface WipTimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  category: 'work' | 'billing' | 'vhc' | 'evidence' | 'changes' | 'system';
  label: string;
  detail: string;
  jobId?: string;
  sessionNumber?: number;
  previousValue?: string;
  newValue?: string;
  awValue?: number;
  hoursValue?: number;
  imageCount?: number;
  relatedId?: string;
  expandable: boolean;
}

function buildDetailFromHistory(h: JobHistoryEntry): string {
  if (h.eventType === 'AW_CHANGED' && h.previousValue && h.newValue) {
    return `AW: ${h.previousValue} → ${h.newValue}`;
  }
  if (h.eventType === 'HOURS_CHANGED' && h.previousValue && h.newValue) {
    return `Hours: ${h.previousValue} → ${h.newValue}`;
  }
  if (h.eventType === 'VHC_UPDATED' && h.newValue) {
    return `VHC: ${h.newValue}`;
  }
  if (h.eventType === 'NOTES_UPDATED') {
    return h.newValue ? `"${h.newValue.slice(0, 60)}${h.newValue.length > 60 ? '…' : ''}"` : 'Notes updated';
  }
  if (h.eventType === 'WORK_SESSION_ADDED') {
    const parts: string[] = [];
    if (h.awValue) parts.push(`${h.awValue} AW`);
    if (h.hoursValue) parts.push(`${h.hoursValue.toFixed(1)}h`);
    return parts.join(' · ') || h.description;
  }
  return h.description;
}

export async function buildWipTimeline(
  normalizedWip: string,
  allJobs: Job[],
): Promise<WipTimelineEvent[]> {
  console.log('wipEngine.buildWipTimeline: Building timeline for WIP:', normalizedWip);
  const events: WipTimelineEvent[] = [];

  // 1. Job history events
  const jobHistory = await jobHistoryStorage.getForWip(normalizedWip);
  const wipJobs = getJobsForWip(normalizedWip, allJobs);

  // Build session number map (sorted by createdAt ascending)
  const sortedSessions = [...wipJobs].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const sessionNumberMap: Record<string, number> = {};
  sortedSessions.forEach((j, i) => { sessionNumberMap[j.id] = i + 1; });

  for (const h of jobHistory) {
    const sessionNum = sessionNumberMap[h.jobId];
    let category: WipTimelineEvent['category'] = 'work';
    if (h.eventType === 'VHC_UPDATED') category = 'vhc';
    else if (h.eventType === 'IMAGE_ADDED' || h.eventType === 'IMAGE_REMOVED') category = 'evidence';
    else if (['AW_CHANGED', 'HOURS_CHANGED', 'NOTES_UPDATED', 'WIP_CHANGED', 'REG_CHANGED', 'DATE_CHANGED'].includes(h.eventType)) category = 'changes';
    else if (['WIP_COMPLETED', 'WIP_INVOICED', 'WIP_REOPENED', 'BILLING_ADJUSTED'].includes(h.eventType)) category = 'billing';
    else if (['DATA_RESTORED', 'DATA_REPAIRED', 'WIP_CONFLICT_DETECTED'].includes(h.eventType)) category = 'system';

    events.push({
      id: h.id,
      timestamp: h.timestamp,
      eventType: h.eventType,
      category,
      label: h.description,
      detail: buildDetailFromHistory(h),
      jobId: h.jobId,
      sessionNumber: sessionNum,
      previousValue: h.previousValue,
      newValue: h.newValue,
      awValue: h.awValue,
      hoursValue: h.hoursValue,
      imageCount: h.imageCount,
      relatedId: h.relatedId,
      expandable: !!(h.previousValue || h.newValue || h.awValue),
    });
  }

  // 2. Billing history events
  const allBillingHistory = await billingStorage.getAllHistory();
  const allRecords = await billingStorage.getAllRecords();
  const wipBillingRecords = getBillingRecordsForWip(normalizedWip, allRecords);
  const wipBillingIds = new Set(wipBillingRecords.map(r => r.id));
  const billingEvents = allBillingHistory.filter(h => wipBillingIds.has(h.billingRecordId));

  // Deduplicate: skip billing events that are already covered by jobHistory WIP_COMPLETED/WIP_REOPENED
  const existingBillingTimestamps = new Set(
    events.filter(e => e.category === 'billing').map(e => e.timestamp.slice(0, 16))
  );

  const BILLING_LABELS: Record<string, string> = {
    billing_created: 'Billing Created',
    work_marked_complete: 'WIP Completed',
    marked_billed: 'WIP Invoiced / Closed',
    billing_reopened: 'WIP Reopened',
    billing_adjusted: 'Billing Adjusted',
    notes_changed: 'Billing Notes Updated',
    returned_to_in_progress: 'Returned to Open',
  };

  for (const h of billingEvents) {
    const tsKey = h.timestamp.slice(0, 16);
    if (existingBillingTimestamps.has(tsKey)) continue;

    events.push({
      id: h.id,
      timestamp: h.timestamp,
      eventType: h.eventType,
      category: 'billing',
      label: BILLING_LABELS[h.eventType] ?? h.eventType,
      detail: h.description,
      jobId: h.jobId,
      previousValue: h.previousAW !== undefined ? String(h.previousAW) : undefined,
      newValue: h.newAW !== undefined ? String(h.newAW) : undefined,
      relatedId: h.billingRecordId,
      expandable: !!(h.previousAW || h.newAW || h.previousHours || h.newHours),
    });
  }

  // 3. Image events — group by jobId+date (avoid one event per image)
  try {
    const allImages = await getAllImages();
    const wipImages = allImages.filter(img => wipJobs.some(j => j.id === img.jobId));
    const imageGroups: Record<string, StoredImage[]> = {};
    for (const img of wipImages) {
      const key = `${img.jobId}::${img.createdAt?.slice(0, 10) ?? 'unknown'}`;
      if (!imageGroups[key]) imageGroups[key] = [];
      imageGroups[key].push(img);
    }
    for (const [key, imgs] of Object.entries(imageGroups)) {
      const [jobId] = key.split('::');
      const sessionNum = sessionNumberMap[jobId];
      const ts = imgs[0].createdAt ?? new Date().toISOString();
      const imgCount = imgs.length;
      const imgLabel = `${imgCount} Image${imgCount !== 1 ? 's' : ''} Added`;
      const imgDetail = `Session ${sessionNum ?? '?'} · ${imgCount} image${imgCount !== 1 ? 's' : ''} attached`;
      events.push({
        id: `img-${key}`,
        timestamp: ts,
        eventType: 'IMAGE_ADDED',
        category: 'evidence',
        label: imgLabel,
        detail: imgDetail,
        jobId,
        sessionNumber: sessionNum,
        imageCount: imgCount,
        expandable: false,
      });
    }
  } catch {}

  // 4. Technical case events
  try {
    const cases = await caseStorage.getAll();
    const wipCases = cases.filter(c => normalizeWip(c.wipNumber ?? '') === normalizedWip);
    for (const c of wipCases) {
      events.push({
        id: `case-${c.id}`,
        timestamp: c.createdAt,
        eventType: 'TECHNICAL_CASE',
        category: 'evidence',
        label: 'Technical Case Created',
        detail: c.title || 'Technical case linked to WIP',
        relatedId: c.id,
        expandable: false,
      });
    }
  } catch {}

  // 5. Handover events
  try {
    const handovers = await handoverStorage.getAll();
    const wipHandovers = handovers.filter(h => normalizeWip(h.wipNumber ?? '') === normalizedWip);
    for (const h of wipHandovers) {
      events.push({
        id: `handover-${h.id}`,
        timestamp: h.createdAt,
        eventType: 'HANDOVER_CREATED',
        category: 'work',
        label: 'Handover Created',
        detail: h.note ? h.note.slice(0, 80) : 'Handover note added',
        jobId: h.jobId,
        relatedId: h.id,
        expandable: false,
      });
    }
  } catch {}

  // Sort by timestamp ascending
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log('wipEngine.buildWipTimeline: Built', events.length, 'events for WIP:', normalizedWip);
  return events;
}
