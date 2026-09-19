import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import AppBackground from '@/components/AppBackground';
import * as Sharing from 'expo-sharing';
import {
  createTitaniumBackup,
  verifyTitaniumBackup,
  pickAndDecryptTitaniumBackup,
  analyseTitaniumBackupForMerge,
  performOverwriteRestore,
  performMergeRestore,
  getRestoreHistory,
  TitaniumManifest,
  TitaniumPayload,
  TitaniumRestoreAnalysis,
  TitaniumRestoreResult,
  RestoreHistoryEntry,
} from '@/utils/titaniumBackup';
import {
  AutoBackupHistoryEntry,
  getAutoBackupHistory,
  protectBackup,
  unprotectBackup,
  deleteBackupEntry,
} from '@/utils/autoBackup';

type ViewState =
  | 'menu'
  | 'creating'
  | 'created'
  | 'pick_restore'
  | 'analysing'
  | 'merge_review'
  | 'merge_conflicts'
  | 'confirming_overwrite'
  | 'restoring'
  | 'complete'
  | 'history'
  | 'manage';

export default function TitaniumBackupScreen() {
  const { theme } = useThemeContext();
  const [view, setView] = useState<ViewState>('menu');
  const { action } = useLocalSearchParams<{ action?: string }>();

  // Create flow
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createProgress, setCreateProgress] = useState('');
  const [createdManifest, setCreatedManifest] = useState<TitaniumManifest | null>(null);
  const [createdFileName, setCreatedFileName] = useState('');
  const [createVerified, setCreateVerified] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Restore flow
  const [restorePassword, setRestorePassword] = useState('');
  const [pickedFileName, setPickedFileName] = useState('');
  const [pickedPayload, setPickedPayload] = useState<TitaniumPayload | null>(null);
  const [restoreAnalysis, setRestoreAnalysis] = useState<TitaniumRestoreAnalysis | null>(null);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [restoreResult, setRestoreResult] = useState<TitaniumRestoreResult | null>(null);

  // Merge options
  const [importSchedule, setImportSchedule] = useState(false);
  const [importSettings, setImportSettings] = useState(false);
  const [importProfile, setImportProfile] = useState(false);
  const [importPin, setImportPin] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'keep_current' | 'use_backup' | 'skip'>>({});
  const [conflictIndex, setConflictIndex] = useState(0);

  // History
  const [historyEntries, setHistoryEntries] = useState<RestoreHistoryEntry[]>([]);

  // Manage backups
  const [manageBackups, setManageBackups] = useState<AutoBackupHistoryEntry[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [verifyingEntryId, setVerifyingEntryId] = useState<string | null>(null);
  const [verifyPassword, setVerifyPassword] = useState('');

  // Animated dots
  const [dotCount, setDotCount] = useState(1);
  const dotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle action param on mount
  useEffect(() => {
    if (action === 'create') {
      console.log('TitaniumBackup: action=create param detected');
      setShowCreateForm(true);
    } else if (action === 'restore') {
      console.log('TitaniumBackup: action=restore param detected');
      setView('pick_restore');
    } else if (action === 'manage') {
      console.log('TitaniumBackup: action=manage param detected');
      handleOpenManage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'creating' || view === 'analysing' || view === 'restoring') {
      dotTimerRef.current = setInterval(() => {
        setDotCount(d => (d % 3) + 1);
      }, 400);
    } else {
      if (dotTimerRef.current) clearInterval(dotTimerRef.current);
    }
    return () => {
      if (dotTimerRef.current) clearInterval(dotTimerRef.current);
    };
  }, [view]);

  const dots = '.'.repeat(dotCount);

  // ---------------------------------------------------------------------------
  // Create flow
  // ---------------------------------------------------------------------------

  function handleOpenCreateForm() {
    console.log('TitaniumBackup: User opened create backup form');
    setCreatePassword('');
    setCreatePasswordConfirm('');
    setShowCreateForm(true);
  }

  async function handleCreateBackup() {
    console.log('TitaniumBackup: User pressed CREATE BACKUP button');
    if (!createPassword) {
      Alert.alert('Password Required', 'Please enter a password to encrypt your backup.');
      return;
    }
    if (createPassword !== createPasswordConfirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }
    if (createPassword.length < 4) {
      Alert.alert('Weak Password', 'Please use at least 4 characters.');
      return;
    }
    setShowCreateForm(false);
    setView('creating');
    setCreateProgress('Collecting Jobs and Billing...');
    console.log('TitaniumBackup: Starting backup creation');

    const result = await createTitaniumBackup(createPassword, '1.0.0', (step) => {
      console.log('TitaniumBackup: Progress step:', step);
      setCreateProgress(step);
    });

    if (result.success && result.manifest) {
      setCreatedManifest(result.manifest);
      setCreatedFileName(result.fileName ?? '');
      setCreateVerified(result.verified ?? false);
      setView('created');
      console.log('TitaniumBackup: Backup created successfully, verified:', result.verified);
    } else {
      console.error('TitaniumBackup: Backup creation failed:', result.error);
      Alert.alert('Backup Failed', result.error ?? 'An unknown error occurred.');
      setView('menu');
    }
  }

  // ---------------------------------------------------------------------------
  // Restore flow
  // ---------------------------------------------------------------------------

  async function handlePickFile() {
    console.log('TitaniumBackup: User pressed SELECT BACKUP FILE');
    if (!restorePassword) {
      Alert.alert('Password Required', 'Please enter the backup password first.');
      return;
    }
    try {
      const result = await pickAndDecryptTitaniumBackup(restorePassword);
      if (!result) return;
      setPickedPayload(result.payload);
      setPickedFileName(result.fileName);
      console.log('TitaniumBackup: File picked and decrypted:', result.fileName);
    } catch (err: any) {
      console.error('TitaniumBackup: Failed to decrypt backup:', err);
      Alert.alert('Decryption Failed', 'Could not decrypt the backup. Check your password and try again.');
    }
  }

  async function handleAnalyseBackup() {
    console.log('TitaniumBackup: User pressed ANALYSE BACKUP');
    if (!pickedPayload) {
      Alert.alert('No File Selected', 'Please select a backup file first.');
      return;
    }
    setView('analysing');
    try {
      const analysis = await analyseTitaniumBackupForMerge(pickedPayload);
      setRestoreAnalysis(analysis);
      setImportSchedule(!analysis.scheduleConflict);
      setImportSettings(!analysis.settingsConflict);
      setImportProfile(!analysis.profileConflict);
      setImportPin(false);
      const initialResolutions: Record<string, 'keep_current' | 'use_backup' | 'skip'> = {};
      for (const c of analysis.conflicts) {
        initialResolutions[c.id] = 'keep_current';
      }
      setConflictResolutions(initialResolutions);
      setConflictIndex(0);
      setView('merge_review');
      console.log('TitaniumBackup: Analysis complete');
    } catch (err: any) {
      console.error('TitaniumBackup: Analysis failed:', err);
      Alert.alert('Analysis Failed', String(err?.message ?? err));
      setView('pick_restore');
    }
  }

  async function handleOverwriteRestore() {
    console.log('TitaniumBackup: User confirmed OVERWRITE RESTORE');
    if (!pickedPayload) return;
    setView('restoring');
    setRestoreProgress('Creating safety backup...');

    const result = await performOverwriteRestore(pickedPayload, importPin, (step) => {
      console.log('TitaniumBackup: Restore progress:', step);
      setRestoreProgress(step);
    });

    setRestoreResult(result);
    setView('complete');
    console.log('TitaniumBackup: Overwrite restore complete, success:', result.success);
  }

  async function handleMergeRestore() {
    console.log('TitaniumBackup: User confirmed MERGE RESTORE');
    if (!pickedPayload || !restoreAnalysis) return;
    setView('restoring');
    setRestoreProgress('Merging records...');

    const result = await performMergeRestore(
      pickedPayload,
      restoreAnalysis,
      conflictResolutions,
      importSchedule,
      importSettings,
      importProfile,
      importPin,
      (step) => {
        console.log('TitaniumBackup: Merge progress:', step);
        setRestoreProgress(step);
      }
    );

    setRestoreResult(result);
    setView('complete');
    console.log('TitaniumBackup: Merge restore complete, success:', result.success);
  }

  async function handleViewHistory() {
    console.log('TitaniumBackup: User pressed VIEW RESTORE HISTORY');
    const entries = await getRestoreHistory();
    setHistoryEntries(entries);
    setView('history');
  }

  async function handleOpenManage() {
    console.log('TitaniumBackup: Opening manage backups view');
    setManageLoading(true);
    setView('manage');
    const history = await getAutoBackupHistory();
    setManageBackups(history);
    setManageLoading(false);
  }

  async function handleProtectToggle(entry: AutoBackupHistoryEntry) {
    if (entry.protected) {
      console.log('TitaniumBackup: Unprotecting backup', entry.id);
      await unprotectBackup(entry.id);
    } else {
      console.log('TitaniumBackup: Protecting backup', entry.id);
      await protectBackup(entry.id);
    }
    const updated = await getAutoBackupHistory();
    setManageBackups(updated);
  }

  async function handleDeleteEntry(entry: AutoBackupHistoryEntry) {
    if (entry.protected) {
      Alert.alert('Protected Backup', 'This backup is protected. Unprotect it first before deleting.');
      return;
    }
    Alert.alert(
      'Delete Backup',
      'Delete this backup? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('TitaniumBackup: Delete cancelled for', entry.id) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('TitaniumBackup: Deleting backup entry', entry.id);
            await deleteBackupEntry(entry.id);
            const updated = await getAutoBackupHistory();
            setManageBackups(updated);
          },
        },
      ]
    );
  }

  async function handleShareEntry(entry: AutoBackupHistoryEntry) {
    console.log('TitaniumBackup: Sharing backup', entry.id, entry.filePath);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(entry.filePath);
    } catch (err: any) {
      console.error('TitaniumBackup: Share failed:', err);
      Alert.alert('Share Failed', err?.message ?? 'Could not share the backup file.');
    }
  }

  async function handleVerifyEntry(entry: AutoBackupHistoryEntry, password: string) {
    console.log('TitaniumBackup: Verifying backup', entry.id);
    try {
      const result = await verifyTitaniumBackup(entry.filePath, password);
      if (result.valid && result.manifest) {
        const jobCount = result.manifest.recordCounts.jobs;
        const attachmentCount = result.manifest.attachmentCount;
        Alert.alert('Verification Passed', `Backup is valid.\n${jobCount} jobs · ${attachmentCount} attachments`);
        console.log('TitaniumBackup: Verification passed for', entry.id);
      } else {
        Alert.alert('Verification Failed', result.error ?? 'The backup file could not be verified.');
        console.warn('TitaniumBackup: Verification failed for', entry.id, result.error);
      }
    } catch (err: any) {
      console.error('TitaniumBackup: Verify error:', err);
      Alert.alert('Verification Error', err?.message ?? 'An error occurred during verification.');
    }
    setVerifyingEntryId(null);
    setVerifyPassword('');
  }

  function handleDone() {
    console.log('TitaniumBackup: User pressed DONE, returning to settings');
    router.back();
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const s = styles(theme);

  function renderHeader(title: string, showBack = true) {
    return (
      <View style={s.header}>
        {showBack ? (
          <TouchableOpacity
            style={s.backButton}
            onPress={() => {
              console.log('TitaniumBackup: Back button pressed from view:', view);
              if (view === 'history' || view === 'created' || view === 'complete' || view === 'manage') {
                setView('menu');
              } else if (view === 'pick_restore') {
                setView('menu');
              } else if (view === 'merge_review') {
                setView('pick_restore');
              } else if (view === 'merge_conflicts') {
                setView('merge_review');
              } else if (view === 'confirming_overwrite') {
                setView('merge_review');
              } else {
                setView('menu');
              }
            }}
          >
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="chevron-left" size={22} color={theme.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.backButton} onPress={handleDone}>
            <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
    );
  }

  function renderProgressStep(label: string, active: boolean) {
    return (
      <View key={label} style={s.progressStep}>
        <View style={[s.progressDot, active ? s.progressDotActive : s.progressDotDone]} />
        <Text style={[s.progressLabel, { color: active ? theme.primary : theme.textSecondary }]}>
          {label}
          {active ? dots : ''}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // MENU VIEW
  // ---------------------------------------------------------------------------

  if (view === 'menu') {
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Titanium Backup', false)}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <View style={s.heroSection}>
              <View style={s.heroIcon}>
                <IconSymbol ios_icon_name="lock.shield.fill" android_material_icon_name="security" size={40} color={theme.primary} />
              </View>
              <Text style={s.heroTitle}>TITANIUM BACKUP</Text>
              <Text style={s.heroSubtitle}>
                Complete encrypted Tech Times snapshot for disaster recovery and device migration.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handleOpenCreateForm}
            >
              <IconSymbol ios_icon_name="arrow.up.doc.fill" android_material_icon_name="backup" size={20} color="#fff" />
              <Text style={s.primaryButtonText}>CREATE TITANIUM BACKUP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.primary }]}
              onPress={() => {
                console.log('TitaniumBackup: User pressed RESTORE TITANIUM BACKUP');
                setRestorePassword('');
                setPickedFileName('');
                setPickedPayload(null);
                setView('pick_restore');
              }}
            >
              <IconSymbol ios_icon_name="arrow.down.doc.fill" android_material_icon_name="restore" size={20} color={theme.primary} />
              <Text style={[s.secondaryButtonText, { color: theme.primary }]}>RESTORE TITANIUM BACKUP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.textSecondary }]}
              onPress={handleOpenManage}
            >
              <IconSymbol ios_icon_name="list.bullet" android_material_icon_name="list" size={20} color={theme.textSecondary} />
              <Text style={[s.secondaryButtonText, { color: theme.textSecondary }]}>MANAGE BACKUPS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.textLink} onPress={handleViewHistory}>
              <Text style={[s.textLinkText, { color: theme.textSecondary }]}>View Restore History</Text>
            </TouchableOpacity>

            <View style={[s.infoCard, { backgroundColor: theme.card }]}>
              <Text style={[s.infoCardTitle, { color: theme.text }]}>What's Included</Text>
              {[
                'All Jobs and Work Sessions',
                'Billing Records and History',
                'Work Schedule and Absences',
                'VHC, Technical Cases, Handovers',
                'Month Close Snapshots',
                'Quick Capture Presets',
                'App Settings and Profile',
                'Security Configuration',
                'Job Images and Attachments',
              ].map(item => (
                <View key={item} style={s.infoRow}>
                  <Text style={[s.infoCheck, { color: theme.chartGreen }]}>✓</Text>
                  <Text style={[s.infoText, { color: theme.textSecondary }]}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={[s.infoCard, { backgroundColor: theme.card }]}>
              <Text style={[s.infoCardTitle, { color: theme.text }]}>Security</Text>
              {[
                'Encrypted with your password',
                'PIN stored as secure hash only',
                'Biometric templates never included',
              ].map(item => (
                <View key={item} style={s.infoRow}>
                  <Text style={[s.infoWarn, { color: theme.chartYellow ?? '#f59e0b' }]}>⚠</Text>
                  <Text style={[s.infoText, { color: theme.textSecondary }]}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Create password modal */}
          {showCreateForm && (
            <View style={s.modalOverlay}>
              <View style={[s.modalCard, { backgroundColor: theme.card }]}>
                <Text style={[s.modalTitle, { color: theme.text }]}>PROTECT YOUR TITANIUM BACKUP</Text>
                <Text style={[s.modalSubtitle, { color: theme.textSecondary }]}>
                  This password encrypts your complete Tech Times backup. Do not lose it — it cannot be recovered.
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  value={createPassword}
                  onChangeText={setCreatePassword}
                  autoFocus
                />
                <TextInput
                  style={[s.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  value={createPasswordConfirm}
                  onChangeText={setCreatePasswordConfirm}
                />
                <View style={s.modalButtons}>
                  <TouchableOpacity
                    style={[s.modalCancelBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      console.log('TitaniumBackup: User cancelled create backup form');
                      setShowCreateForm(false);
                    }}
                  >
                    <Text style={[s.modalCancelText, { color: theme.textSecondary }]}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalConfirmBtn, { backgroundColor: theme.primary }]}
                    onPress={handleCreateBackup}
                  >
                    <Text style={s.modalConfirmText}>CREATE BACKUP</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // CREATING VIEW
  // ---------------------------------------------------------------------------

  if (view === 'creating') {
    const steps = [
      'Collecting Jobs and Billing...',
      'Collecting Settings...',
      'Collecting Images...',
      'Encrypting...',
      'Verifying...',
    ];
    const currentIdx = steps.findIndex(s => createProgress.startsWith(s.replace('...', '')));
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Creating Backup', false)}
          <View style={s.centeredContent}>
            <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 24 }} />
            <Text style={[s.progressTitle, { color: theme.text }]}>CREATING TITANIUM BACKUP</Text>
            <View style={s.progressList}>
              {steps.map((step, idx) => renderProgressStep(step, idx === currentIdx || (currentIdx === -1 && idx === 0)))}
            </View>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // CREATED VIEW
  // ---------------------------------------------------------------------------

  if (view === 'created') {
    const m = createdManifest;
    const verified = createVerified;
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader(verified ? 'Backup Verified' : 'Backup Created', false)}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <View style={s.resultHeader}>
              <Text style={[s.resultIcon, { color: verified ? theme.chartGreen : theme.chartRed }]}>
                {verified ? '✓' : '✗'}
              </Text>
              <Text style={[s.resultTitle, { color: verified ? theme.chartGreen : theme.chartRed }]}>
                {verified ? 'TITANIUM BACKUP VERIFIED ✓' : 'TITANIUM BACKUP VERIFICATION FAILED ✗'}
              </Text>
            </View>

            {verified && m ? (
              <>
                <Text style={[s.fileNameText, { color: theme.textSecondary }]}>{createdFileName}</Text>
                <View style={[s.statsCard, { backgroundColor: theme.card }]}>
                  {[
                    ['Jobs', String(m.recordCounts.jobs)],
                    ['Unique WIPs', String(m.recordCounts.uniqueWips)],
                    ['Billing Records', String(m.recordCounts.billingRecords)],
                    ['Absences', String(m.recordCounts.absences)],
                    ['Attachments', String(m.recordCounts.attachments)],
                    ['Settings Included', '✓'],
                    ['Security Included', '✓'],
                    ['Backup Verified', '✓'],
                  ].map(([label, value]) => (
                    <View key={label} style={s.statRow}>
                      <Text style={[s.statLabel, { color: theme.textSecondary }]}>{label}</Text>
                      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={[s.statsCard, { backgroundColor: theme.card }]}>
                <Text style={[s.errorText, { color: theme.textSecondary }]}>
                  The backup file could not be verified. Your previous backup has not been affected.
                </Text>
              </View>
            )}

            <TouchableOpacity style={s.textLink} onPress={handleDone}>
              <Text style={[s.textLinkText, { color: theme.primary }]}>DONE</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // PICK RESTORE VIEW
  // ---------------------------------------------------------------------------

  if (view === 'pick_restore') {
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Restore Titanium Backup')}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>
              Select your .ttb backup file and enter the backup password.
            </Text>

            <TextInput
              style={[s.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Backup Password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              value={restorePassword}
              onChangeText={setRestorePassword}
            />

            <TouchableOpacity
              style={[s.secondaryButton, { borderColor: theme.primary, marginTop: 8 }]}
              onPress={handlePickFile}
            >
              <IconSymbol ios_icon_name="doc.badge.plus" android_material_icon_name="attach-file" size={18} color={theme.primary} />
              <Text style={[s.secondaryButtonText, { color: theme.primary }]}>
                {pickedFileName ? pickedFileName : 'SELECT BACKUP FILE'}
              </Text>
            </TouchableOpacity>

            {pickedFileName ? (
              <Text style={[s.fileNameText, { color: theme.chartGreen, marginTop: 8 }]}>
                ✓ {pickedFileName}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[s.primaryButton, { backgroundColor: pickedPayload ? theme.primary : theme.border, marginTop: 16 }]}
              onPress={handleAnalyseBackup}
              disabled={!pickedPayload}
            >
              <Text style={s.primaryButtonText}>ANALYSE BACKUP</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // ANALYSING VIEW
  // ---------------------------------------------------------------------------

  if (view === 'analysing') {
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Analysing Backup', false)}
          <View style={s.centeredContent}>
            <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 24 }} />
            <Text style={[s.progressTitle, { color: theme.text }]}>ANALYSING BACKUP{dots}</Text>
            <Text style={[s.progressLabel, { color: theme.textSecondary, marginTop: 8 }]}>Decrypting...</Text>
            <Text style={[s.progressLabel, { color: theme.textSecondary, marginTop: 4 }]}>Comparing records...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // MERGE REVIEW VIEW
  // ---------------------------------------------------------------------------

  if (view === 'merge_review' && restoreAnalysis) {
    const a = restoreAnalysis;
    const m = a.manifest;
    const createdDate = new Date(m.createdAt);
    const createdStr = createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Backup Analysed')}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <View style={[s.statsCard, { backgroundColor: theme.card }]}>
              <Text style={[s.cardTitle, { color: theme.text }]}>BACKUP ANALYSED</Text>
              <Text style={[s.fileNameText, { color: theme.textSecondary }]}>Created: {createdStr}</Text>
              <Text style={[s.fileNameText, { color: theme.textSecondary }]}>
                {m.recordCounts.jobs} Jobs · {m.recordCounts.uniqueWips} WIPs · {m.recordCounts.absences} Absences
              </Text>
            </View>

            <Text style={[s.sectionLabel, { color: theme.text, marginTop: 16 }]}>Choose restore mode:</Text>

            <TouchableOpacity
              style={[s.modeCard, { backgroundColor: theme.card, borderColor: theme.primary }]}
              onPress={() => {
                console.log('TitaniumBackup: User selected OVERWRITE mode');
                setView('confirming_overwrite');
              }}
            >
              <Text style={[s.modeTitle, { color: theme.primary }]}>OVERWRITE</Text>
              <Text style={[s.modeDesc, { color: theme.textSecondary }]}>
                Replace ALL current Tech Times data with this backup. Current data will be lost.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                console.log('TitaniumBackup: User selected MERGE mode');
              }}
            >
              <Text style={[s.modeTitle, { color: theme.text }]}>MERGE</Text>
              <Text style={[s.modeDesc, { color: theme.textSecondary }]}>
                Keep current data and add missing records from backup. Exact duplicates will be skipped.
              </Text>
              <View style={[s.mergeStats, { borderTopColor: theme.border }]}>
                <Text style={[s.mergeStat, { color: theme.chartGreen }]}>{a.newRecords} New Records</Text>
                <Text style={[s.mergeStat, { color: theme.textSecondary }]}>{a.exactDuplicates} Exact Duplicates (will be skipped)</Text>
                {a.possibleDuplicates.length > 0 && (
                  <Text style={[s.mergeStat, { color: theme.chartYellow ?? '#f59e0b' }]}>{a.possibleDuplicates.length} Possible Duplicates</Text>
                )}
                {a.conflicts.length > 0 && (
                  <Text style={[s.mergeStat, { color: theme.chartRed }]}>{a.conflicts.length} Conflicts</Text>
                )}
              </View>

              {a.conflicts.length > 0 && (
                <TouchableOpacity
                  style={[s.reviewBtn, { borderColor: theme.chartRed }]}
                  onPress={() => {
                    console.log('TitaniumBackup: User pressed REVIEW CONFLICTS');
                    setConflictIndex(0);
                    setView('merge_conflicts');
                  }}
                >
                  <Text style={[s.reviewBtnText, { color: theme.chartRed }]}>REVIEW CONFLICTS ({a.conflicts.length})</Text>
                </TouchableOpacity>
              )}

              {a.scheduleConflict && (
                <View style={s.optionRow}>
                  <Text style={[s.optionLabel, { color: theme.text }]}>Schedule:</Text>
                  <TouchableOpacity
                    style={[s.optionBtn, importSchedule ? s.optionBtnActive : {}, { borderColor: theme.border }]}
                    onPress={() => {
                      console.log('TitaniumBackup: Schedule option toggled to:', !importSchedule ? 'USE BACKUP' : 'KEEP CURRENT');
                      setImportSchedule(!importSchedule);
                    }}
                  >
                    <Text style={[s.optionBtnText, { color: importSchedule ? theme.primary : theme.textSecondary }]}>
                      {importSchedule ? 'USE BACKUP' : 'KEEP CURRENT'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {a.settingsConflict && (
                <View style={s.optionRow}>
                  <Text style={[s.optionLabel, { color: theme.text }]}>Settings:</Text>
                  <TouchableOpacity
                    style={[s.optionBtn, importSettings ? s.optionBtnActive : {}, { borderColor: theme.border }]}
                    onPress={() => {
                      console.log('TitaniumBackup: Settings option toggled to:', !importSettings ? 'USE BACKUP' : 'KEEP CURRENT');
                      setImportSettings(!importSettings);
                    }}
                  >
                    <Text style={[s.optionBtnText, { color: importSettings ? theme.primary : theme.textSecondary }]}>
                      {importSettings ? 'USE BACKUP' : 'KEEP CURRENT'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={() => {
                  console.log('TitaniumBackup: User pressed CONTINUE MERGE');
                  Alert.alert(
                    'Merge Titanium Backup',
                    `Current data will be kept.\n${a.newRecords} new records will be added.\n${a.exactDuplicates} exact duplicates will be skipped.\n${a.conflicts.length} conflicts resolved.\n\nContinue?`,
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => console.log('TitaniumBackup: Merge cancelled') },
                      { text: 'MERGE', style: 'default', onPress: handleMergeRestore },
                    ]
                  );
                }}
              >
                <Text style={s.primaryButtonText}>CONTINUE MERGE</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.textLink}
              onPress={() => {
                console.log('TitaniumBackup: User cancelled restore from merge review');
                setView('menu');
              }}
            >
              <Text style={[s.textLinkText, { color: theme.textSecondary }]}>CANCEL</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // MERGE CONFLICTS VIEW
  // ---------------------------------------------------------------------------

  if (view === 'merge_conflicts' && restoreAnalysis) {
    const conflicts = restoreAnalysis.conflicts;
    const conflict = conflicts[conflictIndex];
    const total = conflicts.length;
    const currentResolution = conflictResolutions[conflict?.id] ?? 'keep_current';

    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader(`Conflicts (${total})`)}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {conflict ? (
              <>
                <Text style={[s.conflictCounter, { color: theme.textSecondary }]}>
                  {conflictIndex + 1} of {total}
                </Text>
                <View style={[s.statsCard, { backgroundColor: theme.card }]}>
                  <Text style={[s.cardTitle, { color: theme.text }]}>{conflict.description}</Text>
                  <View style={s.conflictRow}>
                    <View style={s.conflictSide}>
                      <Text style={[s.conflictSideLabel, { color: theme.textSecondary }]}>CURRENT</Text>
                      <Text style={[s.conflictValue, { color: theme.text }]}>
                        {conflict.type === 'billing'
                          ? (conflict.currentData?.status ?? 'OPEN')
                          : (conflict.currentData?.aw ?? JSON.stringify(conflict.currentData).slice(0, 60))}
                      </Text>
                    </View>
                    <View style={s.conflictSide}>
                      <Text style={[s.conflictSideLabel, { color: theme.textSecondary }]}>BACKUP</Text>
                      <Text style={[s.conflictValue, { color: theme.primary }]}>
                        {conflict.type === 'billing'
                          ? (conflict.backupData?.status ?? 'OPEN')
                          : (conflict.backupData?.aw ?? JSON.stringify(conflict.backupData).slice(0, 60))}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={s.conflictButtons}>
                  {(['keep_current', 'use_backup', 'skip'] as const).map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        s.conflictBtn,
                        { borderColor: currentResolution === opt ? theme.primary : theme.border },
                        currentResolution === opt && { backgroundColor: theme.primary + '20' },
                      ]}
                      onPress={() => {
                        console.log('TitaniumBackup: Conflict resolution set for', conflict.id, ':', opt);
                        setConflictResolutions(prev => ({ ...prev, [conflict.id]: opt }));
                      }}
                    >
                      <Text style={[s.conflictBtnText, { color: currentResolution === opt ? theme.primary : theme.textSecondary }]}>
                        {opt === 'keep_current' ? 'KEEP CURRENT' : opt === 'use_backup' ? 'USE BACKUP' : 'SKIP'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.conflictNav}>
                  <TouchableOpacity
                    style={[s.navBtn, { borderColor: theme.border, opacity: conflictIndex === 0 ? 0.3 : 1 }]}
                    disabled={conflictIndex === 0}
                    onPress={() => {
                      console.log('TitaniumBackup: Previous conflict');
                      setConflictIndex(i => i - 1);
                    }}
                  >
                    <Text style={[s.navBtnText, { color: theme.text }]}>PREVIOUS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.navBtn, { borderColor: theme.border, opacity: conflictIndex === total - 1 ? 0.3 : 1 }]}
                    disabled={conflictIndex === total - 1}
                    onPress={() => {
                      console.log('TitaniumBackup: Next conflict');
                      setConflictIndex(i => i + 1);
                    }}
                  >
                    <Text style={[s.navBtnText, { color: theme.text }]}>NEXT</Text>
                  </TouchableOpacity>
                </View>

                {conflictIndex === total - 1 && (
                  <TouchableOpacity
                    style={[s.primaryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                    onPress={() => {
                      console.log('TitaniumBackup: All conflicts reviewed, returning to merge review');
                      setView('merge_review');
                    }}
                  >
                    <Text style={s.primaryButtonText}>DONE REVIEWING</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>No conflicts to review.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // CONFIRMING OVERWRITE VIEW
  // ---------------------------------------------------------------------------

  if (view === 'confirming_overwrite' && restoreAnalysis) {
    const m = restoreAnalysis.manifest;
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Overwrite Restore')}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <View style={[s.warningCard, { backgroundColor: theme.chartRed + '15', borderColor: theme.chartRed }]}>
              <Text style={[s.warningTitle, { color: theme.chartRed }]}>⚠ OVERWRITE RESTORE</Text>
              <Text style={[s.warningText, { color: theme.textSecondary }]}>
                This will REPLACE your current Tech Times data.
              </Text>
            </View>

            <View style={[s.statsCard, { backgroundColor: theme.card }]}>
              {[
                ['Jobs', String(m.recordCounts.jobs)],
                ['Billing Records', String(m.recordCounts.billingRecords)],
                ['Absences', String(m.recordCounts.absences)],
                ['Attachments', String(m.recordCounts.attachments)],
              ].map(([label, value]) => (
                <View key={label} style={s.statRow}>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>
              A safety backup will be created first.
            </Text>

            <View style={[s.infoCard, { backgroundColor: theme.card }]}>
              <Text style={[s.infoCardTitle, { color: theme.text }]}>PIN Notice</Text>
              <Text style={[s.infoText, { color: theme.textSecondary }]}>
                The backup PIN cannot be recovered from the hash. You will be prompted to set a new PIN after restore.
              </Text>
              <View style={s.optionRow}>
                <Text style={[s.optionLabel, { color: theme.text }]}>Restore PIN config:</Text>
                <TouchableOpacity
                  style={[s.optionBtn, importPin ? s.optionBtnActive : {}, { borderColor: theme.border }]}
                  onPress={() => {
                    console.log('TitaniumBackup: PIN restore option toggled to:', !importPin);
                    setImportPin(!importPin);
                  }}
                >
                  <Text style={[s.optionBtnText, { color: importPin ? theme.primary : theme.textSecondary }]}>
                    {importPin ? 'YES (reset required)' : 'NO'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => {
                  console.log('TitaniumBackup: User cancelled overwrite confirmation');
                  setView('merge_review');
                }}
              >
                <Text style={[s.modalCancelText, { color: theme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, { backgroundColor: theme.chartRed }]}
                onPress={handleOverwriteRestore}
              >
                <Text style={s.modalConfirmText}>OVERWRITE RESTORE</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // RESTORING VIEW
  // ---------------------------------------------------------------------------

  if (view === 'restoring') {
    const steps = [
      'Creating safety backup...',
      'Restoring Jobs...',
      'Restoring Billing...',
      'Restoring Settings...',
      'Restoring Images...',
      'Running integrity checks...',
    ];
    const currentIdx = steps.findIndex(s => restoreProgress.startsWith(s.replace('...', '')));
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Restoring...', false)}
          <View style={s.centeredContent}>
            <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 24 }} />
            <Text style={[s.progressTitle, { color: theme.text }]}>RESTORING{dots}</Text>
            <View style={s.progressList}>
              {steps.map((step, idx) => renderProgressStep(step, idx === currentIdx || (currentIdx === -1 && idx === 0)))}
            </View>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETE VIEW
  // ---------------------------------------------------------------------------

  if (view === 'complete' && restoreResult) {
    const r = restoreResult;
    const integrityPassed = r.criticalErrors === 0;
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Restore Complete', false)}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            <View style={s.resultHeader}>
              <Text style={[s.resultIcon, { color: r.success ? theme.chartGreen : theme.chartRed }]}>
                {r.success ? '✓' : '✗'}
              </Text>
              <Text style={[s.resultTitle, { color: r.success ? theme.chartGreen : theme.chartRed }]}>
                {r.success ? 'TITANIUM RESTORE COMPLETE ✓' : 'RESTORE FAILED ✗'}
              </Text>
            </View>

            <View style={[s.statsCard, { backgroundColor: theme.card }]}>
              {[
                ['Records Added', String(r.recordsAdded)],
                ['Exact Duplicates Skipped', String(r.exactDuplicatesSkipped)],
                ['Conflicts Resolved', String(r.conflictsResolved)],
                ['Records Skipped', String(r.recordsSkipped)],
                ['Critical Errors', String(r.criticalErrors)],
                ['Integrity Check', integrityPassed ? 'Passed ✓' : 'Failed ✗'],
              ].map(([label, value]) => (
                <View key={label} style={s.statRow}>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>{label}</Text>
                  <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
                </View>
              ))}
            </View>

            {r.error ? (
              <Text style={[s.errorText, { color: theme.chartRed, marginTop: 8 }]}>{r.error}</Text>
            ) : null}

            <TouchableOpacity style={s.textLink} onPress={handleViewHistory}>
              <Text style={[s.textLinkText, { color: theme.textSecondary }]}>View Restore History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handleDone}
            >
              <Text style={s.primaryButtonText}>DONE</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // HISTORY VIEW
  // ---------------------------------------------------------------------------

  if (view === 'history') {
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Restore History')}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {historyEntries.length === 0 ? (
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>No restore history yet.</Text>
            ) : (
              historyEntries.map(entry => {
                const entryDate = new Date(entry.date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                const resultColor = entry.result === 'success' ? theme.chartGreen : entry.result === 'partial' ? (theme.chartYellow ?? '#f59e0b') : theme.chartRed;
                const resultLabel = entry.result === 'success' ? '✓ Success' : entry.result === 'partial' ? '⚠ Partial' : '✗ Failed';
                return (
                  <View key={entry.id} style={[s.historyCard, { backgroundColor: theme.card }]}>
                    <Text style={[s.historyDate, { color: theme.text }]}>{entryDate}</Text>
                    <Text style={[s.historyMeta, { color: theme.textSecondary }]}>
                      {entry.restoreType === 'overwrite' ? 'Overwrite' : 'Merge'} · {entry.fileName}
                    </Text>
                    <Text style={[s.historyStats, { color: theme.textSecondary }]}>
                      {entry.recordsImported} records · {entry.conflicts} conflicts · {' '}
                      <Text style={{ color: resultColor }}>{resultLabel}</Text>
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // MANAGE VIEW
  // ---------------------------------------------------------------------------

  if (view === 'manage') {
    return (
      <AppBackground>
        <SafeAreaView style={s.safeArea}>
          {renderHeader('Manage Backups')}
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {manageLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[s.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>Loading backups...</Text>
              </View>
            ) : manageBackups.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <IconSymbol ios_icon_name="lock.shield" android_material_icon_name="security" size={48} color={theme.textSecondary} />
                <Text style={[s.sectionLabel, { color: theme.textSecondary, textAlign: 'center', marginTop: 16 }]}>
                  No backups found. Create your first Titanium Backup to protect your data.
                </Text>
              </View>
            ) : (
              manageBackups.map(entry => {
                const entryDate = new Date(entry.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                const typeBadge = entry.isSafetySnapshot ? 'SAFETY' : entry.isAutomatic ? 'AUTOMATIC' : 'MANUAL';
                const typeBadgeColor = entry.isSafetySnapshot
                  ? (theme.chartYellow ?? '#f59e0b')
                  : entry.isAutomatic ? theme.primary : theme.chartGreen;
                const fileSizeText = entry.fileSize
                  ? entry.fileSize >= 1024 * 1024
                    ? (entry.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                    : Math.round(entry.fileSize / 1024) + ' KB'
                  : null;
                const isVerifying = verifyingEntryId === entry.id;

                return (
                  <View key={entry.id} style={[s.manageCard, { backgroundColor: theme.card }]}>
                    {/* Date + badges row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      <Text style={[s.historyDate, { color: theme.text, flex: 1 }]}>{entryDate}</Text>
                      <View style={{ backgroundColor: typeBadgeColor + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: typeBadgeColor, letterSpacing: 0.3 }}>{typeBadge}</Text>
                      </View>
                      {entry.protected && (
                        <View style={{ backgroundColor: theme.chartGreen + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.chartGreen }}>🔒 PROTECTED</Text>
                        </View>
                      )}
                    </View>

                    {/* Stats row */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                        {entry.jobCount} jobs · {entry.attachmentCount} attachments
                      </Text>
                      {fileSizeText && (
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>{fileSizeText}</Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 12, color: entry.verified ? theme.chartGreen : theme.textSecondary }}>
                          {entry.verified ? '✓ VERIFIED' : 'UNVERIFIED'}
                        </Text>
                      </View>
                    </View>

                    {/* Safety reason */}
                    {entry.isSafetySnapshot && entry.safetyReason && (
                      <Text style={{ fontSize: 12, color: theme.chartYellow ?? '#f59e0b', marginBottom: 4 }}>
                        Reason: {entry.safetyReason}
                      </Text>
                    )}

                    {/* Verify inline form */}
                    {isVerifying && (
                      <View style={{ marginTop: 8, marginBottom: 4 }}>
                        <TextInput
                          style={[s.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginBottom: 8 }]}
                          placeholder="Enter backup password"
                          placeholderTextColor={theme.textSecondary}
                          secureTextEntry
                          value={verifyPassword}
                          onChangeText={setVerifyPassword}
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
                            onPress={() => {
                              console.log('TitaniumBackup: Confirm verify for entry', entry.id);
                              handleVerifyEntry(entry, verifyPassword);
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>CONFIRM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}
                            onPress={() => {
                              console.log('TitaniumBackup: Cancelled verify for entry', entry.id);
                              setVerifyingEntryId(null);
                              setVerifyPassword('');
                            }}
                          >
                            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>CANCEL</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Action buttons */}
                    {!isVerifying && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[s.manageActionBtn, { borderColor: theme.primary }]}
                          onPress={() => {
                            console.log('TitaniumBackup: User tapped VERIFY for entry', entry.id);
                            setVerifyingEntryId(entry.id);
                            setVerifyPassword('');
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.primary }}>VERIFY</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.manageActionBtn, { borderColor: theme.textSecondary }]}
                          onPress={() => handleShareEntry(entry)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>SHARE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.manageActionBtn, { borderColor: entry.protected ? theme.chartGreen : theme.primary }]}
                          onPress={() => handleProtectToggle(entry)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: entry.protected ? theme.chartGreen : theme.primary }}>
                            {entry.protected ? 'UNPROTECT' : 'PROTECT'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.manageActionBtn, { borderColor: theme.chartRed }]}
                          onPress={() => handleDeleteEntry(entry)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.chartRed }}>DELETE</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  // Fallback
  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function styles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: theme.text, flex: 1, textAlign: 'center' },

    heroSection: { alignItems: 'center', paddingVertical: 24 },
    heroIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: theme.primary + '20',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    heroTitle: { fontSize: 22, fontWeight: '700', color: theme.text, letterSpacing: 1, marginBottom: 8 },
    heroSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

    primaryButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
      marginBottom: 12, gap: 8,
    },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

    secondaryButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
      borderWidth: 1.5, marginBottom: 12, gap: 8,
    },
    secondaryButtonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },

    textLink: { alignItems: 'center', paddingVertical: 12 },
    textLinkText: { fontSize: 14, fontWeight: '500' },

    infoCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
    infoCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
    infoCheck: { fontSize: 14, fontWeight: '700', width: 16 },
    infoWarn: { fontSize: 14, width: 16 },
    infoText: { fontSize: 13, flex: 1, lineHeight: 18 },

    statsCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    statLabel: { fontSize: 14 },
    statValue: { fontSize: 14, fontWeight: '600' },

    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    fileNameText: { fontSize: 13, marginBottom: 8 },
    errorText: { fontSize: 14, lineHeight: 20 },

    resultHeader: { alignItems: 'center', paddingVertical: 24 },
    resultIcon: { fontSize: 48, marginBottom: 8 },
    resultTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },

    progressTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, letterSpacing: 0.5 },
    progressList: { alignSelf: 'stretch', paddingHorizontal: 16 },
    progressStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    progressDot: { width: 8, height: 8, borderRadius: 4 },
    progressDotActive: { backgroundColor: theme.primary },
    progressDotDone: { backgroundColor: theme.textSecondary },
    progressLabel: { fontSize: 14 },

    input: {
      borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, marginBottom: 12,
    },

    sectionLabel: { fontSize: 14, lineHeight: 20, marginBottom: 12 },

    modeCard: { borderRadius: 12, borderWidth: 1.5, padding: 16, marginBottom: 12 },
    modeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modeDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
    mergeStats: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
    mergeStat: { fontSize: 13 },
    reviewBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10, alignSelf: 'flex-start' },
    reviewBtnText: { fontSize: 13, fontWeight: '600' },

    optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    optionLabel: { fontSize: 14 },
    optionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
    optionBtnActive: { backgroundColor: theme.primary + '20' },
    optionBtnText: { fontSize: 13, fontWeight: '600' },

    warningCard: { borderRadius: 12, borderWidth: 1.5, padding: 16, marginBottom: 12 },
    warningTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    warningText: { fontSize: 13, lineHeight: 18 },

    conflictCounter: { fontSize: 13, textAlign: 'center', marginBottom: 12 },
    conflictRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    conflictSide: { flex: 1 },
    conflictSideLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
    conflictValue: { fontSize: 14, fontWeight: '500' },
    conflictButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
    conflictBtn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    conflictBtnText: { fontSize: 12, fontWeight: '600' },
    conflictNav: { flexDirection: 'row', gap: 12, marginTop: 16 },
    navBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    navBtnText: { fontSize: 13, fontWeight: '600' },

    historyCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
    historyDate: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
    historyMeta: { fontSize: 13, marginBottom: 4 },
    historyStats: { fontSize: 13 },

    manageCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
    manageActionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },

    modalOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    },
    modalCard: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
    modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16, textAlign: 'center' },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    modalCancelText: { fontSize: 14, fontWeight: '600' },
    modalConfirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
