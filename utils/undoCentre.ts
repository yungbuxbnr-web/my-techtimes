
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reopenWip, completeWip } from './wipEngine';
import { wipBlockerStorage } from './wipBlockerStorage';

const UNDO_HISTORY_KEY = '@techtimes_undo_history';
const UNDO_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_UNDO_ENTRIES = 50;

export type UndoActionType =
  | 'WIP_CLOSED'
  | 'WIP_REOPENED'
  | 'BLOCKER_SET'
  | 'BLOCKER_CHANGED'
  | 'BLOCKER_CLEARED'
  | 'ABSENCE_DELETED'
  | 'ABSENCE_EDITED'
  | 'MONTH_END_CLOSED';

export interface UndoAction {
  id: string;
  type: UndoActionType;
  label: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  undone: boolean;
  payload: any;
}

function generateId(): string {
  return `undo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function loadHistory(): Promise<UndoAction[]> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveHistory(history: UndoAction[]): Promise<void> {
  await AsyncStorage.setItem(UNDO_HISTORY_KEY, JSON.stringify(history));
}

export async function pushUndoAction(
  type: UndoActionType,
  label: string,
  payload: any
): Promise<UndoAction> {
  const now = new Date();
  const action: UndoAction = {
    id: generateId(),
    type,
    label,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + UNDO_EXPIRY_MS).toISOString(),
    expired: false,
    undone: false,
    payload,
  };
  const history = await loadHistory();
  history.unshift(action);
  const trimmed = history.slice(0, MAX_UNDO_ENTRIES);
  await saveHistory(trimmed);
  return action;
}

export async function getUndoHistory(): Promise<UndoAction[]> {
  const history = await loadHistory();
  const now = Date.now();
  return history.map(a => ({
    ...a,
    expired: a.expired || new Date(a.expiresAt).getTime() < now,
  }));
}

export async function getLatestUndoable(): Promise<UndoAction | null> {
  const history = await getUndoHistory();
  return history.find(a => !a.expired && !a.undone) ?? null;
}

export async function markUndone(id: string): Promise<void> {
  const history = await loadHistory();
  const updated = history.map(a => a.id === id ? { ...a, undone: true } : a);
  await saveHistory(updated);
}

export async function performUndo(action: UndoAction): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'WIP_CLOSED': {
        const jobsRaw = await AsyncStorage.getItem('@techtimes_jobs');
        const billingRaw = await AsyncStorage.getItem('@techtimes_billing_records');
        const allJobs = JSON.parse(jobsRaw || '[]');
        const allBilling = JSON.parse(billingRaw || '[]');
        await reopenWip(action.payload.wipNumber, allJobs, allBilling);
        break;
      }
      case 'WIP_REOPENED': {
        await completeWip(
          action.payload.jobId,
          action.payload.wipNumber,
          action.payload.jobs ?? [],
          action.payload.billingRecords ?? []
        );
        break;
      }
      case 'BLOCKER_SET': {
        // Undo a blocker being set — clear it
        await wipBlockerStorage.clearBlocker(action.payload.wipNumber);
        break;
      }
      case 'BLOCKER_CHANGED': {
        // Undo a blocker change — restore previous blocker
        if (action.payload.previousBlocker) {
          await wipBlockerStorage.setBlocker(
            action.payload.wipNumber,
            action.payload.previousBlocker.reason,
            action.payload.previousBlocker.note
          );
        }
        break;
      }
      case 'BLOCKER_CLEARED': {
        // Undo a blocker clear — restore the blocker
        if (action.payload.blocker) {
          await wipBlockerStorage.setBlocker(
            action.payload.wipNumber,
            action.payload.blocker.reason,
            action.payload.blocker.note
          );
        }
        break;
      }
      case 'ABSENCE_DELETED': {
        if (action.payload.absence) {
          const raw = await AsyncStorage.getItem('@techtimes_absences');
          const absences = JSON.parse(raw || '[]');
          if (!absences.find((a: any) => a.id === action.payload.absence.id)) {
            absences.push(action.payload.absence);
            await AsyncStorage.setItem('@techtimes_absences', JSON.stringify(absences));
          }
        }
        break;
      }
      case 'ABSENCE_EDITED': {
        if (action.payload.previousAbsence) {
          const raw = await AsyncStorage.getItem('@techtimes_absences');
          const absences = JSON.parse(raw || '[]');
          const idx = absences.findIndex((a: any) => a.id === action.payload.previousAbsence.id);
          if (idx >= 0) {
            absences[idx] = action.payload.previousAbsence;
          } else {
            absences.push(action.payload.previousAbsence);
          }
          await AsyncStorage.setItem('@techtimes_absences', JSON.stringify(absences));
        }
        break;
      }
      case 'MONTH_END_CLOSED': {
        return {
          success: false,
          error: 'Use Titanium Backup to restore a closed month-end review.',
        };
      }
      default:
        return { success: false, error: 'Unknown undo action type.' };
    }
    await markUndone(action.id);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Undo failed' };
  }
}

export async function clearExpiredActions(): Promise<void> {
  const history = await loadHistory();
  const now = Date.now();
  const updated = history.filter(a => new Date(a.expiresAt).getTime() >= now || a.undone);
  await saveHistory(updated);
}
