
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { createTitaniumBackup } from './titaniumBackup';

const AUTO_BACKUP_SETTINGS_KEY = '@techtimes_auto_backup_settings';
const AUTO_BACKUP_HISTORY_KEY = '@techtimes_auto_backup_history';
const AUTO_BACKUP_LAST_RUN_KEY = '@techtimes_auto_backup_last_run';
const BACKUP_HEALTH_KEY = '@techtimes_backup_health';

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'manual';
  retentionCount: number;
}

export interface BackupHealthInfo {
  lastBackupDate: string | null;
  lastBackupVerified: boolean;
  lastBackupFileName: string | null;
  lastBackupJobCount: number;
  lastBackupAttachmentCount: number;
  lastBackupFilePath: string | null;
  daysSinceBackup: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'never';
  warningThresholdDays: number;
}

export interface AutoBackupHistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  filePath: string;
  isAutomatic: boolean;
  isSafetySnapshot: boolean;
  safetyReason?: string;
  verified: boolean;
  jobCount: number;
  attachmentCount: number;
  fileSize?: number;
}

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  enabled: true,
  frequency: 'daily',
  retentionCount: 14,
};

export async function getAutoBackupSettings(): Promise<AutoBackupSettings> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
  }
}

export async function saveAutoBackupSettings(settings: AutoBackupSettings): Promise<void> {
  await AsyncStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(settings));
}

export async function getBackupHealth(): Promise<BackupHealthInfo> {
  const defaultHealth: BackupHealthInfo = {
    lastBackupDate: null,
    lastBackupVerified: false,
    lastBackupFileName: null,
    lastBackupJobCount: 0,
    lastBackupAttachmentCount: 0,
    lastBackupFilePath: null,
    daysSinceBackup: null,
    status: 'never',
    warningThresholdDays: 7,
  };
  try {
    const raw = await AsyncStorage.getItem(BACKUP_HEALTH_KEY);
    if (!raw) return defaultHealth;
    const stored: BackupHealthInfo = JSON.parse(raw);
    // Recalculate daysSinceBackup and status dynamically
    if (stored.lastBackupDate) {
      const last = new Date(stored.lastBackupDate).getTime();
      const days = Math.floor((Date.now() - last) / 86400000);
      stored.daysSinceBackup = days;
      const threshold = stored.warningThresholdDays || 7;
      if (days <= threshold) {
        stored.status = 'healthy';
      } else if (days <= threshold * 2) {
        stored.status = 'warning';
      } else {
        stored.status = 'critical';
      }
    } else {
      stored.status = 'never';
    }
    return stored;
  } catch {
    return defaultHealth;
  }
}

export async function updateBackupHealth(entry: AutoBackupHistoryEntry): Promise<void> {
  const current = await getBackupHealth();
  const updated: BackupHealthInfo = {
    ...current,
    lastBackupDate: entry.createdAt,
    lastBackupVerified: entry.verified,
    lastBackupFileName: entry.fileName,
    lastBackupJobCount: entry.jobCount,
    lastBackupAttachmentCount: entry.attachmentCount,
    lastBackupFilePath: entry.filePath,
    daysSinceBackup: 0,
    status: 'healthy',
  };
  await AsyncStorage.setItem(BACKUP_HEALTH_KEY, JSON.stringify(updated));
}

export async function getAutoBackupHistory(): Promise<AutoBackupHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_BACKUP_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addAutoBackupHistoryEntry(entry: AutoBackupHistoryEntry): Promise<void> {
  const history = await getAutoBackupHistory();
  history.unshift(entry);
  // Keep max 100 entries
  const trimmed = history.slice(0, 100);
  await AsyncStorage.setItem(AUTO_BACKUP_HISTORY_KEY, JSON.stringify(trimmed));
}

export async function pruneOldAutoBackups(retentionCount: number): Promise<void> {
  const history = await getAutoBackupHistory();
  // Only prune automatic, non-safety entries
  const prunable = history.filter(e => e.isAutomatic && !e.isSafetySnapshot);
  const keep = history.filter(e => !e.isAutomatic || e.isSafetySnapshot);
  // Keep the most recent retentionCount prunable entries
  const prunableKeep = prunable.slice(0, retentionCount);
  const toDelete = prunable.slice(retentionCount);
  // Delete files for pruned entries
  for (const entry of toDelete) {
    try {
      if (entry.filePath) {
        const info = await FileSystem.getInfoAsync(entry.filePath);
        if (info.exists) {
          await FileSystem.deleteAsync(entry.filePath, { idempotent: true });
        }
      }
    } catch {}
  }
  const updated = [...keep, ...prunableKeep].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  await AsyncStorage.setItem(AUTO_BACKUP_HISTORY_KEY, JSON.stringify(updated));
}

export async function shouldRunAutoBackup(): Promise<boolean> {
  const settings = await getAutoBackupSettings();
  if (!settings.enabled || settings.frequency === 'manual') return false;
  try {
    const lastRunRaw = await AsyncStorage.getItem(AUTO_BACKUP_LAST_RUN_KEY);
    if (!lastRunRaw) return true;
    const lastRun = new Date(lastRunRaw).getTime();
    const now = Date.now();
    if (settings.frequency === 'daily') {
      return now - lastRun > 23 * 60 * 60 * 1000;
    } else if (settings.frequency === 'weekly') {
      return now - lastRun > 6 * 24 * 60 * 60 * 1000;
    }
    return false;
  } catch {
    return true;
  }
}

export async function runAutoBackupIfDue(
  password: string,
  appVersion: string,
  onProgress?: (step: string) => void
): Promise<{ ran: boolean; success: boolean; error?: string }> {
  const due = await shouldRunAutoBackup();
  if (!due) return { ran: false, success: false };

  onProgress?.('Creating automatic backup...');
  try {
    const result = await createTitaniumBackup(password, appVersion);
    await AsyncStorage.setItem(AUTO_BACKUP_LAST_RUN_KEY, new Date().toISOString());

    if (result.success && result.filePath && result.fileName && result.manifest) {
      const id = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${result.fileName}_${Date.now()}`
      );
      const entry: AutoBackupHistoryEntry = {
        id: id.slice(0, 16),
        createdAt: new Date().toISOString(),
        fileName: result.fileName,
        filePath: result.filePath,
        isAutomatic: true,
        isSafetySnapshot: false,
        verified: result.verified ?? false,
        jobCount: result.manifest.recordCounts.jobs,
        attachmentCount: result.manifest.attachmentCount,
      };
      try {
        const info = await FileSystem.getInfoAsync(result.filePath);
        if (info.exists && 'size' in info) {
          entry.fileSize = (info as any).size;
        }
      } catch {}
      await addAutoBackupHistoryEntry(entry);
      await updateBackupHealth(entry);
      const settings = await getAutoBackupSettings();
      await pruneOldAutoBackups(settings.retentionCount);
      onProgress?.('Backup complete');
      return { ran: true, success: true };
    } else {
      return { ran: true, success: false, error: result.error };
    }
  } catch (e: any) {
    return { ran: true, success: false, error: e?.message ?? 'Unknown error' };
  }
}

export async function createSafetySnapshot(
  password: string,
  appVersion: string,
  reason: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const result = await createTitaniumBackup(password, appVersion);
    if (result.success && result.filePath && result.fileName && result.manifest) {
      const id = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `safety_${result.fileName}_${Date.now()}`
      );
      const entry: AutoBackupHistoryEntry = {
        id: id.slice(0, 16),
        createdAt: new Date().toISOString(),
        fileName: result.fileName,
        filePath: result.filePath,
        isAutomatic: false,
        isSafetySnapshot: true,
        safetyReason: reason,
        verified: result.verified ?? false,
        jobCount: result.manifest.recordCounts.jobs,
        attachmentCount: result.manifest.attachmentCount,
      };
      await addAutoBackupHistoryEntry(entry);
      await updateBackupHealth(entry);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: result.error };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}
