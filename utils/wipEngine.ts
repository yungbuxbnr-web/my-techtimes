
import { billingStorage, BillingRecord } from './billingStorage';
import { Job } from './offlineStorage';
import { normaliseBillingStatus, awToHours } from './billingEngine';

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
