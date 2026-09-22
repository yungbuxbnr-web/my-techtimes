import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { getAllImages } from './imageStorage';

export const TITANIUM_FORMAT_VERSION = 1;
export const TITANIUM_SCHEMA_VERSION = 1;
export const TITANIUM_FILE_EXT = '.ttb';

const ASYNC_STORAGE_KEYS = [
  '@techtimes_jobs',
  '@techtimes_schedule',
  '@techtimes_profile',
  '@techtimes_absences',
  '@techtimes_settings',
  '@techtimes_notification_settings',
  '@techtimes_job_templates',
  '@techtimes_handover',
  '@techtimes_technical_cases',
  '@techtimes_report_templates',
  '@techtimes_search_history',
  '@techtimes_billing_records',
  '@techtimes_billing_history',
  '@techtimes_billing_recycle',
  '@techtimes_job_history',
  '@techtimes_wip_blockers',
  '@techtimes_wip_blocker_history',
  '@techtimes_month_close_snapshots',
  '@techtimes_month_end_reviews',
  '@techtimes_month_end_notif_guard',
  '@techtimes_comeback_classifications',
  '@techtimes_quick_presets',
  '@techtimes_quick_capture_stats',
  '@techtimes_images',
  '@techtimes_word_prediction_index',
  '@techtimes_word_prediction_enabled',
  '@techtimes_restore_history',
];

const SECURE_STORE_KEYS = ['biometrics_enabled', 'pin_auth_enabled'];

export interface TitaniumManifest {
  backupType: 'titanium';
  formatVersion: number;
  schemaVersion: number;
  createdAt: string;
  appVersion: string;
  recordCounts: {
    jobs: number;
    uniqueWips: number;
    billingRecords: number;
    absences: number;
    technicalCases: number;
    attachments: number;
    monthCloseSnapshots: number;
    jobHistoryEvents: number;
    wipBlockers: number;
    quickPresets: number;
  };
  attachmentCount: number;
  payloadChecksum: string;
}

export interface TitaniumPayload {
  manifest: TitaniumManifest;
  asyncStorage: Record<string, string | null>;
  secureConfig: {
    biometricsEnabled: string | null;
    pinAuthEnabled: string | null;
    pinHash: string | null;
  };
  images: {
    id: string;
    jobId: string;
    uri: string;
    mimeType?: string;
    createdAt: string;
    base64Data: string | null;
  }[];
}

export interface TitaniumBackupResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  manifest?: TitaniumManifest;
  error?: string;
  verified?: boolean;
}

export interface TitaniumRestoreAnalysis {
  manifest: TitaniumManifest;
  newRecords: number;
  exactDuplicates: number;
  possibleDuplicates: {
    type: string;
    currentId: string;
    backupId: string;
    description: string;
    currentData: any;
    backupData: any;
  }[];
  conflicts: {
    type: string;
    id: string;
    description: string;
    currentData: any;
    backupData: any;
  }[];
  scheduleConflict: boolean;
  settingsConflict: boolean;
  profileConflict: boolean;
  pinConflict: boolean;
  missingAttachments: string[];
}

export interface TitaniumRestoreResult {
  success: boolean;
  recordsAdded: number;
  exactDuplicatesSkipped: number;
  conflictsResolved: number;
  recordsSkipped: number;
  criticalErrors: number;
  error?: string;
}

export interface RestoreHistoryEntry {
  id: string;
  date: string;
  fileName: string;
  restoreType: 'overwrite' | 'merge';
  recordsImported: number;
  duplicatesSkipped: number;
  conflicts: number;
  result: 'success' | 'partial' | 'failed';
}

// ---------------------------------------------------------------------------
// Encryption helpers — pure JS, Hermes/React Native compatible
// Uses @noble/ciphers (AES-256-GCM) + @noble/hashes (PBKDF2-SHA256)
// No dependency on crypto.subtle, window.crypto, or Node crypto
// ---------------------------------------------------------------------------

async function deriveKeyBytes(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  return pbkdf2Async(sha256, enc.encode(password), salt, { c: 100000, dkLen: 32 });
}

async function encryptPayload(plaintext: string, password: string): Promise<string> {
  const salt = Crypto.getRandomBytes(32);
  const nonce = Crypto.getRandomBytes(12);
  const keyBytes = await deriveKeyBytes(password, salt);
  const enc = new TextEncoder();
  const stream = gcm(keyBytes, nonce);
  const ciphertext = stream.encrypt(enc.encode(plaintext));
  // Layout: [32 salt][12 nonce][ciphertext+tag]
  const combined = new Uint8Array(salt.length + nonce.length + ciphertext.length);
  combined.set(salt, 0);
  combined.set(nonce, salt.length);
  combined.set(ciphertext, salt.length + nonce.length);
  return uint8ArrayToBase64(combined);
}

async function decryptPayload(base64: string, password: string): Promise<string> {
  const combined = base64ToUint8Array(base64);
  const salt = combined.slice(0, 32);
  const nonce = combined.slice(32, 44);
  const ciphertext = combined.slice(44);
  const keyBytes = await deriveKeyBytes(password, salt);
  const stream = gcm(keyBytes, nonce);
  const plaintext = stream.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Record count helpers
// ---------------------------------------------------------------------------

function safeParseArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildRecordCounts(asyncStorageData: Record<string, string | null>, attachmentCount: number) {
  const jobs = safeParseArray(asyncStorageData['@techtimes_jobs']);
  const billingRecords = safeParseArray(asyncStorageData['@techtimes_billing_records']);
  const absences = safeParseArray(asyncStorageData['@techtimes_absences']);
  const technicalCases = safeParseArray(asyncStorageData['@techtimes_technical_cases']);
  const monthCloseSnapshots = safeParseArray(asyncStorageData['@techtimes_month_close_snapshots']);
  const jobHistory = safeParseArray(asyncStorageData['@techtimes_job_history']);
  const wipBlockers = safeParseArray(asyncStorageData['@techtimes_wip_blockers']);
  const quickPresets = safeParseArray(asyncStorageData['@techtimes_quick_presets']);

  const uniqueWipSet = new Set<string>();
  for (const job of jobs) {
    if (job.wipNumber) uniqueWipSet.add(String(job.wipNumber));
  }

  return {
    jobs: jobs.length,
    uniqueWips: uniqueWipSet.size,
    billingRecords: billingRecords.length,
    absences: absences.length,
    technicalCases: technicalCases.length,
    attachments: attachmentCount,
    monthCloseSnapshots: monthCloseSnapshots.length,
    jobHistoryEvents: jobHistory.length,
    wipBlockers: wipBlockers.length,
    quickPresets: quickPresets.length,
  };
}

// ---------------------------------------------------------------------------
// Main exported functions
// ---------------------------------------------------------------------------

export async function createTitaniumBackup(
  password: string,
  appVersion: string,
  onProgress?: (step: string) => void
): Promise<TitaniumBackupResult> {
  console.log('TitaniumBackup: Starting backup creation, appVersion:', appVersion);
  try {
    onProgress?.('Collecting Jobs and Billing...');
    console.log('TitaniumBackup: Reading AsyncStorage keys:', ASYNC_STORAGE_KEYS.length);
    const pairs = await AsyncStorage.multiGet(ASYNC_STORAGE_KEYS);
    const asyncStorageData: Record<string, string | null> = {};
    for (const [key, value] of pairs) {
      asyncStorageData[key] = value;
    }
    console.log('TitaniumBackup: AsyncStorage read complete');

    onProgress?.('Collecting Settings...');
    const biometricsEnabled = await SecureStore.getItemAsync('biometrics_enabled').catch(() => null);
    const pinAuthEnabled = await SecureStore.getItemAsync('pin_auth_enabled').catch(() => null);
    const rawPin = await SecureStore.getItemAsync('user_pin').catch(() => null);
    let pinHash: string | null = null;
    if (rawPin) {
      pinHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawPin + 'techtimes_pin_salt'
      );
      console.log('TitaniumBackup: PIN hashed (raw PIN not stored)');
    }

    onProgress?.('Collecting Images...');
    console.log('TitaniumBackup: Reading images');
    const allImages = await getAllImages();
    console.log('TitaniumBackup: Found', allImages.length, 'images');

    const imagePayload: TitaniumPayload['images'] = [];
    for (const img of allImages) {
      let base64Data: string | null = null;
      try {
        base64Data = await FileSystem.readAsStringAsync(img.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.warn('TitaniumBackup: Could not read image file:', img.uri, err);
      }
      imagePayload.push({
        id: img.id,
        jobId: img.jobId,
        uri: img.uri,
        mimeType: 'image/jpeg',
        createdAt: img.createdAt,
        base64Data,
      });
    }
    console.log('TitaniumBackup: Images encoded, missing:', imagePayload.filter(i => !i.base64Data).length);

    const payloadChecksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(asyncStorageData)
    );
    console.log('TitaniumBackup: Payload checksum computed');

    const recordCounts = buildRecordCounts(asyncStorageData, imagePayload.filter(i => i.base64Data !== null).length);

    const now = new Date();
    const manifest: TitaniumManifest = {
      backupType: 'titanium',
      formatVersion: TITANIUM_FORMAT_VERSION,
      schemaVersion: TITANIUM_SCHEMA_VERSION,
      createdAt: now.toISOString(),
      appVersion,
      recordCounts,
      attachmentCount: imagePayload.filter(i => i.base64Data !== null).length,
      payloadChecksum,
    };

    const payload: TitaniumPayload = {
      manifest,
      asyncStorage: asyncStorageData,
      secureConfig: {
        biometricsEnabled,
        pinAuthEnabled,
        pinHash,
      },
      images: imagePayload,
    };

    onProgress?.('Encrypting...');
    console.log('TitaniumBackup: Encrypting payload');
    const encrypted = await encryptPayload(JSON.stringify(payload), password);
    console.log('TitaniumBackup: Encryption complete');

    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `TechTimes_Titanium_${dateStr}${TITANIUM_FILE_EXT}`;
    const filePath = (FileSystem.cacheDirectory ?? '') + fileName;

    await FileSystem.writeAsStringAsync(filePath, encrypted, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    console.log('TitaniumBackup: File written to:', filePath);

    onProgress?.('Verifying...');
    const verification = await verifyTitaniumBackup(filePath, password);
    console.log('TitaniumBackup: Verification result:', verification.valid);

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save Titanium Backup',
      UTI: 'public.data',
    });
    console.log('TitaniumBackup: Share dialog opened');

    return {
      success: true,
      filePath,
      fileName,
      manifest,
      verified: verification.valid,
    };
  } catch (error: any) {
    console.error('TitaniumBackup: Backup creation failed:', error);
    return { success: false, error: String(error?.message ?? error) };
  }
}

export async function verifyTitaniumBackup(
  filePath: string,
  password: string
): Promise<{ valid: boolean; manifest?: TitaniumManifest; error?: string }> {
  console.log('TitaniumBackup: Verifying backup at:', filePath);
  try {
    const encrypted = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const decrypted = await decryptPayload(encrypted, password);
    const payload: TitaniumPayload = JSON.parse(decrypted);

    if (!payload.manifest || payload.manifest.backupType !== 'titanium') {
      console.warn('TitaniumBackup: Invalid manifest backupType');
      return { valid: false, error: 'Invalid backup type' };
    }
    if (payload.manifest.formatVersion > TITANIUM_FORMAT_VERSION) {
      console.warn('TitaniumBackup: Incompatible format version:', payload.manifest.formatVersion);
      return { valid: false, error: `Incompatible format version: ${payload.manifest.formatVersion}` };
    }

    const recomputedChecksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(payload.asyncStorage)
    );
    if (recomputedChecksum !== payload.manifest.payloadChecksum) {
      console.warn('TitaniumBackup: Checksum mismatch');
      return { valid: false, error: 'Payload checksum mismatch — backup may be corrupted' };
    }

    const actualJobs = safeParseArray(payload.asyncStorage['@techtimes_jobs']).length;
    if (actualJobs !== payload.manifest.recordCounts.jobs) {
      console.warn('TitaniumBackup: Job count mismatch — manifest:', payload.manifest.recordCounts.jobs, 'actual:', actualJobs);
      return { valid: false, error: `Job count mismatch (manifest: ${payload.manifest.recordCounts.jobs}, actual: ${actualJobs})` };
    }

    console.log('TitaniumBackup: Verification passed');
    return { valid: true, manifest: payload.manifest };
  } catch (error: any) {
    console.error('TitaniumBackup: Verification failed:', error);
    return { valid: false, error: String(error?.message ?? error) };
  }
}

export async function pickAndDecryptTitaniumBackup(
  password: string
): Promise<{ payload: TitaniumPayload; filePath: string; fileName: string } | null> {
  console.log('TitaniumBackup: Opening document picker for .ttb file');
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    console.log('TitaniumBackup: Document picker cancelled');
    return null;
  }

  const asset = result.assets[0];
  const filePath = asset.uri;
  const fileName = asset.name ?? 'backup.ttb';
  console.log('TitaniumBackup: File selected:', fileName, 'uri:', filePath);

  const encrypted = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let decrypted: string;
  try {
    decrypted = await decryptPayload(encrypted, password);
  } catch (err) {
    console.error('TitaniumBackup: Decryption failed:', err);
    throw new Error('UNABLE TO DECRYPT TITANIUM BACKUP');
  }

  const payload: TitaniumPayload = JSON.parse(decrypted);
  if (!payload.manifest || payload.manifest.backupType !== 'titanium') {
    throw new Error('UNABLE TO DECRYPT TITANIUM BACKUP');
  }

  console.log('TitaniumBackup: Backup decrypted successfully, manifest:', payload.manifest.createdAt);
  return { payload, filePath, fileName };
}

export async function analyseTitaniumBackupForMerge(
  payload: TitaniumPayload
): Promise<TitaniumRestoreAnalysis> {
  console.log('TitaniumBackup: Analysing backup for merge');

  const currentJobsRaw = await AsyncStorage.getItem('@techtimes_jobs');
  const currentBillingRaw = await AsyncStorage.getItem('@techtimes_billing_records');
  const currentAbsencesRaw = await AsyncStorage.getItem('@techtimes_absences');
  const currentTechCasesRaw = await AsyncStorage.getItem('@techtimes_technical_cases');
  const currentScheduleRaw = await AsyncStorage.getItem('@techtimes_schedule');
  const currentSettingsRaw = await AsyncStorage.getItem('@techtimes_settings');
  const currentProfileRaw = await AsyncStorage.getItem('@techtimes_profile');

  const currentJobs: any[] = safeParseArray(currentJobsRaw);
  const currentBilling: any[] = safeParseArray(currentBillingRaw);
  const currentAbsences: any[] = safeParseArray(currentAbsencesRaw);
  const currentTechCases: any[] = safeParseArray(currentTechCasesRaw);

  const backupJobs: any[] = safeParseArray(payload.asyncStorage['@techtimes_jobs']);
  const backupBilling: any[] = safeParseArray(payload.asyncStorage['@techtimes_billing_records']);
  const backupAbsences: any[] = safeParseArray(payload.asyncStorage['@techtimes_absences']);
  const backupTechCases: any[] = safeParseArray(payload.asyncStorage['@techtimes_technical_cases']);

  const possibleDuplicates: TitaniumRestoreAnalysis['possibleDuplicates'] = [];
  const conflicts: TitaniumRestoreAnalysis['conflicts'] = [];
  let exactDuplicates = 0;
  let newRecords = 0;

  // --- Jobs ---
  const currentJobMap = new Map(currentJobs.map(j => [j.id, j]));
  for (const bJob of backupJobs) {
    const cJob = currentJobMap.get(bJob.id);
    if (!cJob) {
      // Check possible duplicate by wipNumber + vehicleReg + createdAt
      const possibleMatch = currentJobs.find(
        j => j.wipNumber && bJob.wipNumber &&
          String(j.wipNumber) === String(bJob.wipNumber) &&
          j.vehicleReg === bJob.vehicleReg &&
          j.createdAt === bJob.createdAt
      );
      if (possibleMatch) {
        possibleDuplicates.push({
          type: 'job',
          currentId: possibleMatch.id,
          backupId: bJob.id,
          description: `WIP ${bJob.wipNumber} — ${bJob.vehicleReg ?? 'No Reg'}`,
          currentData: possibleMatch,
          backupData: bJob,
        });
      } else {
        newRecords++;
      }
    } else if (JSON.stringify(cJob) === JSON.stringify(bJob)) {
      exactDuplicates++;
    } else if (cJob.aw !== bJob.aw) {
      conflicts.push({
        type: 'job',
        id: bJob.id,
        description: `WIP ${bJob.wipNumber ?? bJob.id} — AW mismatch (current: ${cJob.aw}, backup: ${bJob.aw})`,
        currentData: cJob,
        backupData: bJob,
      });
    } else {
      newRecords++;
    }
  }

  // --- Billing ---
  const currentBillingMap = new Map(currentBilling.map(b => [b.id, b]));
  for (const bRec of backupBilling) {
    const cRec = currentBillingMap.get(bRec.id);
    if (!cRec) {
      newRecords++;
    } else if (JSON.stringify(cRec) === JSON.stringify(bRec)) {
      exactDuplicates++;
    } else if (cRec.status !== bRec.status) {
      conflicts.push({
        type: 'billing',
        id: bRec.id,
        description: `WIP ${bRec.wipNumber ?? bRec.id} — Billing Status (current: ${cRec.status ?? 'OPEN'}, backup: ${bRec.status ?? 'OPEN'})`,
        currentData: cRec,
        backupData: bRec,
      });
    } else {
      newRecords++;
    }
  }

  // --- Absences ---
  const currentAbsenceMap = new Map(currentAbsences.map(a => [a.id, a]));
  for (const bAbs of backupAbsences) {
    const cAbs = currentAbsenceMap.get(bAbs.id);
    if (!cAbs) {
      newRecords++;
    } else if (JSON.stringify(cAbs) === JSON.stringify(bAbs)) {
      exactDuplicates++;
    } else {
      newRecords++;
    }
  }

  // --- Technical Cases ---
  const currentTechMap = new Map(currentTechCases.map(t => [t.id, t]));
  for (const bCase of backupTechCases) {
    const cCase = currentTechMap.get(bCase.id);
    if (!cCase) {
      newRecords++;
    } else if (JSON.stringify(cCase) === JSON.stringify(bCase)) {
      exactDuplicates++;
    } else {
      newRecords++;
    }
  }

  // --- Scalar conflicts ---
  const scheduleConflict =
    !!currentScheduleRaw &&
    !!payload.asyncStorage['@techtimes_schedule'] &&
    currentScheduleRaw !== payload.asyncStorage['@techtimes_schedule'];

  const settingsConflict =
    !!currentSettingsRaw &&
    !!payload.asyncStorage['@techtimes_settings'] &&
    currentSettingsRaw !== payload.asyncStorage['@techtimes_settings'];

  const profileConflict =
    !!currentProfileRaw &&
    !!payload.asyncStorage['@techtimes_profile'] &&
    currentProfileRaw !== payload.asyncStorage['@techtimes_profile'];

  const pinConflict = !!payload.secureConfig.pinHash;

  const missingAttachments = payload.images
    .filter(img => img.base64Data === null)
    .map(img => img.uri);

  console.log('TitaniumBackup: Analysis complete — new:', newRecords, 'exact dupes:', exactDuplicates, 'conflicts:', conflicts.length, 'possible dupes:', possibleDuplicates.length);

  return {
    manifest: payload.manifest,
    newRecords,
    exactDuplicates,
    possibleDuplicates,
    conflicts,
    scheduleConflict,
    settingsConflict,
    profileConflict,
    pinConflict,
    missingAttachments,
  };
}

export async function performOverwriteRestore(
  payload: TitaniumPayload,
  restorePin: boolean,
  onProgress?: (step: string) => void
): Promise<TitaniumRestoreResult> {
  console.log('TitaniumBackup: Starting overwrite restore, restorePin:', restorePin);
  let criticalErrors = 0;
  let recordsAdded = 0;

  try {
    onProgress?.('Restoring Jobs...');
    const pairs: [string, string][] = [];
    for (const [key, value] of Object.entries(payload.asyncStorage)) {
      if (value !== null) {
        pairs.push([key, value]);
      }
    }
    await AsyncStorage.multiSet(pairs);
    console.log('TitaniumBackup: AsyncStorage restored,', pairs.length, 'keys');

    onProgress?.('Restoring Settings...');
    if (payload.secureConfig.biometricsEnabled !== null) {
      await SecureStore.setItemAsync('biometrics_enabled', payload.secureConfig.biometricsEnabled).catch(e => {
        console.warn('TitaniumBackup: Could not restore biometrics_enabled:', e);
      });
    }
    if (payload.secureConfig.pinAuthEnabled !== null) {
      await SecureStore.setItemAsync('pin_auth_enabled', payload.secureConfig.pinAuthEnabled).catch(e => {
        console.warn('TitaniumBackup: Could not restore pin_auth_enabled:', e);
      });
    }

    if (restorePin && payload.secureConfig.pinHash) {
      // Cannot recover raw PIN from hash — clear PIN and flag for reset
      await SecureStore.deleteItemAsync('user_pin').catch(() => {});
      await AsyncStorage.setItem('@techtimes_pin_needs_reset', 'true');
      console.log('TitaniumBackup: PIN cleared, reset flag set');
    }

    onProgress?.('Restoring Images...');
    let imagesRestored = 0;
    for (const img of payload.images) {
      if (!img.base64Data) continue;
      try {
        const absolutePath = (FileSystem.documentDirectory ?? '') + img.uri;
        const dir = absolutePath.substring(0, absolutePath.lastIndexOf('/') + 1);
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        await FileSystem.writeAsStringAsync(absolutePath, img.base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imagesRestored++;
      } catch (imgErr) {
        console.warn('TitaniumBackup: Could not restore image:', img.uri, imgErr);
        criticalErrors++;
      }
    }
    console.log('TitaniumBackup: Images restored:', imagesRestored, 'errors:', criticalErrors);

    onProgress?.('Running integrity checks...');
    recordsAdded = safeParseArray(payload.asyncStorage['@techtimes_jobs']).length;

    const historyEntry: RestoreHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      fileName: `TechTimes_Titanium_${payload.manifest.createdAt.slice(0, 10).replace(/-/g, '')}${TITANIUM_FILE_EXT}`,
      restoreType: 'overwrite',
      recordsImported: recordsAdded,
      duplicatesSkipped: 0,
      conflicts: 0,
      result: criticalErrors === 0 ? 'success' : 'partial',
    };
    await saveRestoreHistory(historyEntry);

    console.log('TitaniumBackup: Overwrite restore complete, recordsAdded:', recordsAdded, 'criticalErrors:', criticalErrors);
    return {
      success: true,
      recordsAdded,
      exactDuplicatesSkipped: 0,
      conflictsResolved: 0,
      recordsSkipped: 0,
      criticalErrors,
    };
  } catch (error: any) {
    console.error('TitaniumBackup: Overwrite restore failed:', error);
    return {
      success: false,
      recordsAdded,
      exactDuplicatesSkipped: 0,
      conflictsResolved: 0,
      recordsSkipped: 0,
      criticalErrors: criticalErrors + 1,
      error: String(error?.message ?? error),
    };
  }
}

export async function performMergeRestore(
  payload: TitaniumPayload,
  analysis: TitaniumRestoreAnalysis,
  conflictResolutions: Record<string, 'keep_current' | 'use_backup' | 'skip'>,
  importSchedule: boolean,
  importSettings: boolean,
  importProfile: boolean,
  importPin: boolean,
  onProgress?: (step: string) => void
): Promise<TitaniumRestoreResult> {
  console.log('TitaniumBackup: Starting merge restore');
  let recordsAdded = 0;
  let exactDuplicatesSkipped = 0;
  let conflictsResolved = 0;
  let recordsSkipped = 0;
  let criticalErrors = 0;

  try {
    const exactDupeIds = new Set(analysis.possibleDuplicates.map(d => d.backupId));
    const exactDupeJobIds = new Set<string>();
    const exactDupeBillingIds = new Set<string>();
    const exactDupeAbsenceIds = new Set<string>();
    const exactDupeTechIds = new Set<string>();

    // Build exact duplicate sets from analysis
    const currentJobsRaw = await AsyncStorage.getItem('@techtimes_jobs');
    const currentBillingRaw = await AsyncStorage.getItem('@techtimes_billing_records');
    const currentAbsencesRaw = await AsyncStorage.getItem('@techtimes_absences');
    const currentTechCasesRaw = await AsyncStorage.getItem('@techtimes_technical_cases');

    const currentJobs: any[] = safeParseArray(currentJobsRaw);
    const currentBilling: any[] = safeParseArray(currentBillingRaw);
    const currentAbsences: any[] = safeParseArray(currentAbsencesRaw);
    const currentTechCases: any[] = safeParseArray(currentTechCasesRaw);

    const currentJobMap = new Map(currentJobs.map(j => [j.id, j]));
    const currentBillingMap = new Map(currentBilling.map(b => [b.id, b]));
    const currentAbsenceMap = new Map(currentAbsences.map(a => [a.id, a]));
    const currentTechMap = new Map(currentTechCases.map(t => [t.id, t]));

    // Mark exact duplicates
    for (const bJob of safeParseArray(payload.asyncStorage['@techtimes_jobs'])) {
      const cJob = currentJobMap.get(bJob.id);
      if (cJob && JSON.stringify(cJob) === JSON.stringify(bJob)) exactDupeJobIds.add(bJob.id);
    }
    for (const bRec of safeParseArray(payload.asyncStorage['@techtimes_billing_records'])) {
      const cRec = currentBillingMap.get(bRec.id);
      if (cRec && JSON.stringify(cRec) === JSON.stringify(bRec)) exactDupeBillingIds.add(bRec.id);
    }
    for (const bAbs of safeParseArray(payload.asyncStorage['@techtimes_absences'])) {
      const cAbs = currentAbsenceMap.get(bAbs.id);
      if (cAbs && JSON.stringify(cAbs) === JSON.stringify(bAbs)) exactDupeAbsenceIds.add(bAbs.id);
    }
    for (const bCase of safeParseArray(payload.asyncStorage['@techtimes_technical_cases'])) {
      const cCase = currentTechMap.get(bCase.id);
      if (cCase && JSON.stringify(cCase) === JSON.stringify(bCase)) exactDupeTechIds.add(bCase.id);
    }

    onProgress?.('Merging Jobs...');
    // Merge jobs
    const mergedJobs = [...currentJobs];
    for (const bJob of safeParseArray(payload.asyncStorage['@techtimes_jobs'])) {
      if (exactDupeJobIds.has(bJob.id)) { exactDuplicatesSkipped++; continue; }
      if (exactDupeIds.has(bJob.id)) { recordsSkipped++; continue; }
      const conflict = analysis.conflicts.find(c => c.type === 'job' && c.id === bJob.id);
      if (conflict) {
        const resolution = conflictResolutions[bJob.id] ?? 'keep_current';
        if (resolution === 'use_backup') {
          const idx = mergedJobs.findIndex(j => j.id === bJob.id);
          if (idx >= 0) mergedJobs[idx] = bJob; else mergedJobs.push(bJob);
          conflictsResolved++;
        } else if (resolution === 'skip') {
          recordsSkipped++;
        } else {
          conflictsResolved++;
        }
        continue;
      }
      if (!currentJobMap.has(bJob.id)) { mergedJobs.push(bJob); recordsAdded++; }
    }
    await AsyncStorage.setItem('@techtimes_jobs', JSON.stringify(mergedJobs));

    onProgress?.('Merging Billing...');
    const mergedBilling = [...currentBilling];
    for (const bRec of safeParseArray(payload.asyncStorage['@techtimes_billing_records'])) {
      if (exactDupeBillingIds.has(bRec.id)) { exactDuplicatesSkipped++; continue; }
      const conflict = analysis.conflicts.find(c => c.type === 'billing' && c.id === bRec.id);
      if (conflict) {
        const resolution = conflictResolutions[bRec.id] ?? 'keep_current';
        if (resolution === 'use_backup') {
          const idx = mergedBilling.findIndex(b => b.id === bRec.id);
          if (idx >= 0) mergedBilling[idx] = bRec; else mergedBilling.push(bRec);
          conflictsResolved++;
        } else if (resolution === 'skip') {
          recordsSkipped++;
        } else {
          conflictsResolved++;
        }
        continue;
      }
      if (!currentBillingMap.has(bRec.id)) { mergedBilling.push(bRec); recordsAdded++; }
    }
    await AsyncStorage.setItem('@techtimes_billing_records', JSON.stringify(mergedBilling));

    onProgress?.('Merging Absences...');
    const mergedAbsences = [...currentAbsences];
    for (const bAbs of safeParseArray(payload.asyncStorage['@techtimes_absences'])) {
      if (exactDupeAbsenceIds.has(bAbs.id)) { exactDuplicatesSkipped++; continue; }
      if (!currentAbsenceMap.has(bAbs.id)) { mergedAbsences.push(bAbs); recordsAdded++; }
    }
    await AsyncStorage.setItem('@techtimes_absences', JSON.stringify(mergedAbsences));

    onProgress?.('Merging Technical Cases...');
    const mergedTechCases = [...currentTechCases];
    for (const bCase of safeParseArray(payload.asyncStorage['@techtimes_technical_cases'])) {
      if (exactDupeTechIds.has(bCase.id)) { exactDuplicatesSkipped++; continue; }
      if (!currentTechMap.has(bCase.id)) { mergedTechCases.push(bCase); recordsAdded++; }
    }
    await AsyncStorage.setItem('@techtimes_technical_cases', JSON.stringify(mergedTechCases));

    onProgress?.('Applying Settings...');
    if (importSchedule && payload.asyncStorage['@techtimes_schedule']) {
      await AsyncStorage.setItem('@techtimes_schedule', payload.asyncStorage['@techtimes_schedule']!);
      console.log('TitaniumBackup: Schedule imported');
    }
    if (importSettings && payload.asyncStorage['@techtimes_settings']) {
      await AsyncStorage.setItem('@techtimes_settings', payload.asyncStorage['@techtimes_settings']!);
      console.log('TitaniumBackup: Settings imported');
    }
    if (importProfile && payload.asyncStorage['@techtimes_profile']) {
      await AsyncStorage.setItem('@techtimes_profile', payload.asyncStorage['@techtimes_profile']!);
      console.log('TitaniumBackup: Profile imported');
    }
    if (importPin && payload.secureConfig.pinHash) {
      await SecureStore.deleteItemAsync('user_pin').catch(() => {});
      await AsyncStorage.setItem('@techtimes_pin_needs_reset', 'true');
      console.log('TitaniumBackup: PIN cleared for reset (merge)');
    }

    onProgress?.('Restoring Images...');
    for (const img of payload.images) {
      if (!img.base64Data) continue;
      try {
        const absolutePath = (FileSystem.documentDirectory ?? '') + img.uri;
        const dir = absolutePath.substring(0, absolutePath.lastIndexOf('/') + 1);
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        await FileSystem.writeAsStringAsync(absolutePath, img.base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (imgErr) {
        console.warn('TitaniumBackup: Could not restore image during merge:', img.uri, imgErr);
        criticalErrors++;
      }
    }

    const historyEntry: RestoreHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      fileName: `TechTimes_Titanium_${payload.manifest.createdAt.slice(0, 10).replace(/-/g, '')}${TITANIUM_FILE_EXT}`,
      restoreType: 'merge',
      recordsImported: recordsAdded,
      duplicatesSkipped: exactDuplicatesSkipped,
      conflicts: conflictsResolved,
      result: criticalErrors === 0 ? 'success' : 'partial',
    };
    await saveRestoreHistory(historyEntry);

    console.log('TitaniumBackup: Merge restore complete — added:', recordsAdded, 'dupes skipped:', exactDuplicatesSkipped, 'conflicts:', conflictsResolved, 'errors:', criticalErrors);
    return {
      success: true,
      recordsAdded,
      exactDuplicatesSkipped,
      conflictsResolved,
      recordsSkipped,
      criticalErrors,
    };
  } catch (error: any) {
    console.error('TitaniumBackup: Merge restore failed:', error);
    return {
      success: false,
      recordsAdded,
      exactDuplicatesSkipped,
      conflictsResolved,
      recordsSkipped,
      criticalErrors: criticalErrors + 1,
      error: String(error?.message ?? error),
    };
  }
}

export async function getRestoreHistory(): Promise<RestoreHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem('@techtimes_restore_history');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveRestoreHistory(entry: RestoreHistoryEntry): Promise<void> {
  try {
    const existing = await getRestoreHistory();
    existing.unshift(entry);
    const trimmed = existing.slice(0, 50);
    await AsyncStorage.setItem('@techtimes_restore_history', JSON.stringify(trimmed));
    console.log('TitaniumBackup: Restore history saved, total entries:', trimmed.length);
  } catch (err) {
    console.warn('TitaniumBackup: Could not save restore history:', err);
  }
}
