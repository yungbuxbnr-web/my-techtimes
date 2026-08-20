
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { normaliseBillingStatus } from '@/utils/billingEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKUP_HISTORY_KEY = '@techtimes_billing_backup_history';
const IGNORE_NOTES_KEY = '@techtimes_dq_ignore_notes';

type Severity = 'error' | 'warning' | 'info';

interface Issue {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  recommendedAction: string;
  affectedRecord?: string;
  canAutoRepair: boolean;
  repairAction?: () => Promise<void>;
  jobId?: string;
  wipNumber?: string;
}

interface ScanResult {
  issues: Issue[];
  scannedAt: string;
}

async function runScan(jobs: Job[], billing: BillingRecord[]): Promise<Issue[]> {
  const issues: Issue[] = [];

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const jobIds = new Set(jobs.map(j => j.id));
  const billingByJobId = new Map<string, BillingRecord[]>();
  billing.forEach(r => {
    if (!billingByJobId.has(r.jobId)) billingByJobId.set(r.jobId, []);
    billingByJobId.get(r.jobId)!.push(r);
  });

  // ── JOB checks ─────────────────────────────────────────────────────────────

  // Missing WIP
  jobs.forEach(j => {
    if (!j.wipNumber?.trim()) {
      issues.push({
        id: `no-wip-${j.id}`,
        severity: 'warning',
        category: 'Jobs',
        title: 'Missing WIP Number',
        description: `A job created on ${j.createdAt.split('T')[0]} has no WIP number.`,
        recommendedAction: 'Edit the job and add a WIP number for proper tracking.',
        affectedRecord: j.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Missing registration
  jobs.forEach(j => {
    if (!j.vehicleReg?.trim()) {
      issues.push({
        id: `no-reg-${j.id}`,
        severity: 'warning',
        category: 'Jobs',
        title: 'Missing Vehicle Registration',
        description: `WIP ${j.wipNumber || 'unknown'} has no vehicle registration.`,
        recommendedAction: 'Edit the job and add the vehicle registration.',
        affectedRecord: j.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Invalid AW
  jobs.forEach(j => {
    if (j.aw <= 0) {
      issues.push({
        id: `invalid-aw-${j.id}`,
        severity: 'error',
        category: 'Jobs',
        title: 'Invalid AW Value',
        description: `WIP ${j.wipNumber} has AW of ${j.aw} which is ≤ 0.`,
        recommendedAction: 'Edit the job and set a valid AW value.',
        affectedRecord: j.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Duplicate WIPs
  const wipCounts = new Map<string, Job[]>();
  jobs.forEach(j => {
    if (!j.wipNumber?.trim()) return;
    const key = j.wipNumber.trim().toUpperCase();
    if (!wipCounts.has(key)) wipCounts.set(key, []);
    wipCounts.get(key)!.push(j);
  });
  wipCounts.forEach((dupes, wip) => {
    if (dupes.length > 1) {
      issues.push({
        id: `dup-wip-${wip}`,
        severity: 'warning',
        category: 'Jobs',
        title: 'Duplicate WIP Number',
        description: `WIP ${wip} appears ${dupes.length} times across different jobs.`,
        recommendedAction: 'Review these jobs and ensure each WIP number is unique.',
        affectedRecord: wip,
        canAutoRepair: false,
        wipNumber: wip,
      });
    }
  });

  // ── BILLING checks ─────────────────────────────────────────────────────────

  // Job without any billing record
  jobs.forEach(j => {
    const recs = billingByJobId.get(j.id);
    if (!recs || recs.length === 0) {
      issues.push({
        id: `no-billing-${j.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Missing Billing Record',
        description: `WIP ${j.wipNumber} (${j.vehicleReg}) has no billing record.`,
        recommendedAction: 'Run "Ensure Billing Record" to create a record for this job.',
        affectedRecord: j.id,
        canAutoRepair: true,
        repairAction: async () => {
          await billingStorage.ensureBillingRecordForJob({
            id: j.id,
            wipNumber: j.wipNumber,
            vehicleReg: j.vehicleReg,
            createdAt: j.createdAt,
            aw: j.aw,
          }, false);
        },
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Duplicate billing records for same jobId
  billingByJobId.forEach((recs, jobId) => {
    if (recs.length > 1) {
      const job = jobs.find(j => j.id === jobId);
      const wipNum = job?.wipNumber || recs[0].wipNumber || jobId;
      issues.push({
        id: `dup-billing-${jobId}`,
        severity: 'error',
        category: 'Billing',
        title: 'Duplicate Billing Records',
        description: `WIP ${wipNum} has ${recs.length} billing records. Only one is expected.`,
        recommendedAction: 'Keep the newest record and archive duplicates.',
        affectedRecord: jobId,
        canAutoRepair: true,
        repairAction: async () => {
          const sorted = [...recs].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          const toRemove = sorted.slice(1);
          const allRecords = await billingStorage.getAllRecords();
          const filtered = allRecords.filter(r => !toRemove.some(d => d.id === r.id));
          await AsyncStorage.setItem('@techtimes_billing_records', JSON.stringify(filtered));
          console.log('DataQuality: Removed', toRemove.length, 'duplicate billing records for job', jobId);
        },
        wipNumber: wipNum,
      });
    }
  });

  // Billing record referencing non-existent jobId
  billing.forEach(r => {
    if (!jobIds.has(r.jobId)) {
      issues.push({
        id: `orphan-${r.id}`,
        severity: 'error',
        category: 'Billing',
        title: 'Orphan Billing Record',
        description: `Billing record for job ID ${r.jobId} (WIP: ${r.wipNumber || 'unknown'}) has no matching job.`,
        recommendedAction: 'This billing record references a deleted job. Review and remove if no longer needed.',
        affectedRecord: r.id,
        canAutoRepair: false,
        wipNumber: r.wipNumber,
      });
    }
  });

  // Finished job with zero billedHours when job has hours > 0
  jobs.forEach(j => {
    const recs = billingByJobId.get(j.id);
    if (!recs) return;
    const br = recs[0];
    if (normaliseBillingStatus(br.billingStatus) === 'billed' && j.aw > 0 && br.billedHours <= 0) {
      issues.push({
        id: `zero-billed-hours-${j.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Billed Job with Zero Hours',
        description: `WIP ${j.wipNumber} is marked billed but has 0 billed hours (job AW: ${j.aw}).`,
        recommendedAction: 'Adjust the billing record to reflect the correct hours.',
        affectedRecord: br.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Finished job with zero billedAW when job has AW > 0
  jobs.forEach(j => {
    const recs = billingByJobId.get(j.id);
    if (!recs) return;
    const br = recs[0];
    if (normaliseBillingStatus(br.billingStatus) === 'billed' && j.aw > 0 && br.billedAW <= 0) {
      issues.push({
        id: `zero-billed-aw-${j.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Billed Job with Zero AW',
        description: `WIP ${j.wipNumber} is marked billed but has 0 billed AW (job AW: ${j.aw}).`,
        recommendedAction: 'Adjust the billing record to reflect the correct AW.',
        affectedRecord: br.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // legacy_unknown status still active
  billing.forEach(r => {
    if (r.billingStatus === 'legacy_unknown') {
      const job = jobs.find(j => j.id === r.jobId);
      issues.push({
        id: `legacy-status-${r.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Legacy Status Not Migrated',
        description: `Billing record for WIP ${r.wipNumber || job?.wipNumber || r.jobId} still has legacy_unknown status.`,
        recommendedAction: 'Migrate to "billed" status.',
        affectedRecord: r.id,
        canAutoRepair: true,
        repairAction: async () => {
          await billingStorage.updateRecord(r.id, { billingStatus: 'billed' });
          console.log('DataQuality: Migrated legacy_unknown → billed for record', r.id);
        },
        wipNumber: r.wipNumber || job?.wipNumber,
      });
    }
  });

  // ready_to_bill status still active
  billing.forEach(r => {
    if (r.billingStatus === 'ready_to_bill') {
      const job = jobs.find(j => j.id === r.jobId);
      issues.push({
        id: `ready-status-${r.id}`,
        severity: 'info',
        category: 'Billing',
        title: 'Ready-to-Bill Status Not Migrated',
        description: `Billing record for WIP ${r.wipNumber || job?.wipNumber || r.jobId} still has ready_to_bill status.`,
        recommendedAction: 'Migrate to "open" status.',
        affectedRecord: r.id,
        canAutoRepair: true,
        repairAction: async () => {
          await billingStorage.updateRecord(r.id, { billingStatus: 'open' });
          console.log('DataQuality: Migrated ready_to_bill → open for record', r.id);
        },
        wipNumber: r.wipNumber || job?.wipNumber,
      });
    }
  });

  // Post-billing edits (job.aw changed after billing)
  jobs.forEach(j => {
    const recs = billingByJobId.get(j.id);
    if (!recs) return;
    const br = recs[0];
    if (normaliseBillingStatus(br.billingStatus) === 'billed' && Math.abs(br.billedAW - j.aw) > 0.001) {
      issues.push({
        id: `post-edit-${j.id}`,
        severity: 'error',
        category: 'Billing',
        title: 'Post-Billing Edit Detected',
        description: `WIP ${j.wipNumber}: billed at ${br.billedAW} AW but job now shows ${j.aw} AW.`,
        recommendedAction: 'Review and adjust the billing record to match the current job AW.',
        affectedRecord: br.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Billed job edited after billing (updatedAt > billedAt)
  jobs.forEach(j => {
    const recs = billingByJobId.get(j.id);
    if (!recs) return;
    const br = recs[0];
    if (
      normaliseBillingStatus(br.billingStatus) === 'billed' &&
      br.billedAt &&
      new Date(j.createdAt) > new Date(br.billedAt)
    ) {
      issues.push({
        id: `edited-after-billing-${j.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Job Edited After Billing',
        description: `WIP ${j.wipNumber} was created/modified after its billing date (${br.billedDate || 'unknown'}).`,
        recommendedAction: 'Review the billing record and update the snapshot if needed.',
        affectedRecord: br.id,
        canAutoRepair: false,
        jobId: j.id,
        wipNumber: j.wipNumber,
      });
    }
  });

  // Invalid billing date
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  billing.forEach(r => {
    if (!r.billedAt) return;
    const billedDate = new Date(r.billedAt);
    if (isNaN(billedDate.getTime())) {
      issues.push({
        id: `invalid-billed-date-${r.id}`,
        severity: 'error',
        category: 'Billing',
        title: 'Invalid Billing Date',
        description: `Billing record for WIP ${r.wipNumber || r.jobId} has an invalid billedAt date.`,
        recommendedAction: 'Correct the billing date in the billing record.',
        affectedRecord: r.id,
        canAutoRepair: false,
        wipNumber: r.wipNumber,
      });
    } else if (billedDate > tomorrow) {
      issues.push({
        id: `future-billed-date-${r.id}`,
        severity: 'warning',
        category: 'Billing',
        title: 'Future Billing Date',
        description: `Billing record for WIP ${r.wipNumber || r.jobId} has a billing date in the future (${r.billedDate}).`,
        recommendedAction: 'Verify the billing date is correct.',
        affectedRecord: r.id,
        canAutoRepair: false,
        wipNumber: r.wipNumber,
      });
    }
  });

  // ── BACKUP checks ──────────────────────────────────────────────────────────

  try {
    const backupHistoryRaw = await AsyncStorage.getItem(BACKUP_HISTORY_KEY);
    if (backupHistoryRaw) {
      const history: string[] = JSON.parse(backupHistoryRaw);
      if (history.length > 0) {
        const lastBackupStr = history[0];
        const lastBackup = new Date(lastBackupStr);
        const daysSince = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
          issues.push({
            id: 'backup-stale',
            severity: 'warning',
            category: 'Backup',
            title: 'Backup Overdue',
            description: `Last backup was ${Math.floor(daysSince)} days ago (${lastBackupStr}).`,
            recommendedAction: 'Export a billing backup from the Billing → Backup tab.',
            affectedRecord: 'backup',
            canAutoRepair: false,
          });
        }
      } else {
        issues.push({
          id: 'backup-never',
          severity: 'info',
          category: 'Backup',
          title: 'No Backup Found',
          description: 'No billing backup has been exported yet.',
          recommendedAction: 'Export a billing backup from the Billing → Backup tab.',
          affectedRecord: 'backup',
          canAutoRepair: false,
        });
      }
    } else {
      issues.push({
        id: 'backup-never',
        severity: 'info',
        category: 'Backup',
        title: 'No Backup Found',
        description: 'No billing backup has been exported yet.',
        recommendedAction: 'Export a billing backup from the Billing → Backup tab.',
        affectedRecord: 'backup',
        canAutoRepair: false,
      });
    }
  } catch {}

  return issues;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const SEVERITY_COLOR: Record<Severity, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};
const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const CATEGORIES = ['All', 'Jobs', 'Billing', 'Backup'];

export default function DataQualityScreen() {
  console.log('DataQualityScreen: Rendering');
  const { theme } = useThemeContext();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [repairing, setRepairing] = useState<string | null>(null);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const handleScan = useCallback(async () => {
    console.log('DataQualityScreen: Starting scan');
    setScanning(true);
    try {
      const [jobs, billing] = await Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]);
      console.log('DataQualityScreen: Scanning', jobs.length, 'jobs and', billing.length, 'billing records');
      const issues = await runScan(jobs, billing);
      const sorted = [...issues].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      );
      console.log('DataQualityScreen: Scan complete —', issues.length, 'issues found');
      setScanResult({ issues: sorted, scannedAt: new Date().toISOString() });
    } finally {
      setScanning(false);
    }
  }, []);

  const handleRepair = async (issue: Issue) => {
    if (!issue.repairAction) return;
    console.log('DataQualityScreen: Repair requested for issue', issue.id);
    Alert.alert(
      'Confirm Repair',
      `Apply auto-repair for: "${issue.title}"?\n\n${issue.recommendedAction}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Repair',
          onPress: async () => {
            console.log('DataQualityScreen: Confirmed repair for issue', issue.id);
            setRepairing(issue.id);
            try {
              await issue.repairAction!();
              Alert.alert('Repair Complete', `"${issue.title}" has been repaired.`);
              await handleScan();
            } catch (err: any) {
              console.error('DataQualityScreen: Repair failed for issue', issue.id, err);
              Alert.alert('Repair Failed', err?.message ?? 'Could not complete repair.');
            } finally {
              setRepairing(null);
            }
          },
        },
      ]
    );
  };

  const handleReview = (issue: Issue) => {
    console.log('DataQualityScreen: Review pressed for issue', issue.id, issue.title);
    if (issue.jobId) {
      router.push({
        pathname: '/add-job-modal',
        params: { editId: issue.jobId },
      });
    }
  };

  const filteredIssues = scanResult
    ? activeCategory === 'All'
      ? scanResult.issues
      : scanResult.issues.filter(i => i.category === activeCategory)
    : [];

  const errorCount = scanResult ? scanResult.issues.filter(i => i.severity === 'error').length : 0;
  const warningCount = scanResult ? scanResult.issues.filter(i => i.severity === 'warning').length : 0;
  const infoCount = scanResult ? scanResult.issues.filter(i => i.severity === 'info').length : 0;

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('DataQualityScreen: Back button pressed');
            router.back();
          }}
          style={styles.iconBtn}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Data Health Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!scanResult && !scanning ? (
          <View style={styles.preScan}>
            <View style={[styles.preScanIcon, { backgroundColor: theme.card }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass.circle"
                android_material_icon_name="search"
                size={48}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.preScanTitle, { color: theme.text }]}>Data Health Scanner</Text>
            <Text style={[styles.preScanDesc, { color: theme.textSecondary }]}>
              Scan your jobs and billing records for missing data, orphan records, legacy statuses, post-billing edits, duplicate records, and backup health.
            </Text>
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: theme.primary }]}
              onPress={handleScan}
            >
              <Text style={styles.scanBtnText}>Run Full Scan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {scanning ? (
          <View style={styles.preScan}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.preScanDesc, { color: theme.textSecondary, marginTop: 16 }]}>
              Scanning data...
            </Text>
          </View>
        ) : null}

        {scanResult && !scanning ? (
          <>
            {/* Summary row */}
            <View style={[styles.summaryRow, { backgroundColor: theme.card }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: SEVERITY_COLOR.error }]}>{errorCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Errors</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: SEVERITY_COLOR.warning }]}>{warningCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Warnings</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: SEVERITY_COLOR.info }]}>{infoCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Info</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: errorCount === 0 && warningCount === 0 ? theme.chartGreen : theme.text }]}>
                  {errorCount === 0 && warningCount === 0 ? '✓' : '!'}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Status</Text>
              </View>
            </View>

            <Text style={[styles.scannedAt, { color: theme.textSecondary }]}>
              Scanned: {scanResult.scannedAt.replace('T', ' ').split('.')[0]}
            </Text>

            {/* Category filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryContent}
            >
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      { borderColor: theme.border },
                      isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('DataQualityScreen: Category filter changed to', cat);
                      setActiveCategory(cat);
                    }}
                  >
                    <Text style={[styles.categoryBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Issue list */}
            {filteredIssues.length === 0 ? (
              <View style={[styles.noIssues, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[{ fontSize: 14, fontWeight: '600' }, { color: theme.chartGreen }]}>
                  No issues found in this category.
                </Text>
              </View>
            ) : (
              filteredIssues.map(issue => {
                const severityColor = SEVERITY_COLOR[issue.severity];
                const isRepairing = repairing === issue.id;
                return (
                  <View
                    key={issue.id}
                    style={[styles.issueCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: severityColor }]}
                  >
                    <View style={styles.issueHeader}>
                      <View style={[styles.severityBadge, { backgroundColor: severityColor + '22' }]}>
                        <Text style={[styles.severityText, { color: severityColor }]}>
                          {SEVERITY_LABEL[issue.severity]}
                        </Text>
                      </View>
                      <Text style={[styles.categoryTag, { color: theme.textSecondary }]}>{issue.category}</Text>
                    </View>
                    <Text style={[styles.issueTitle, { color: theme.text }]}>{issue.title}</Text>
                    <Text style={[styles.issueDesc, { color: theme.textSecondary }]}>{issue.description}</Text>
                    <Text style={[styles.issueRec, { color: theme.primary }]}>{issue.recommendedAction}</Text>
                    <View style={styles.issueActions}>
                      {issue.jobId ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.primary }]}
                          onPress={() => handleReview(issue)}
                        >
                          <Text style={[styles.actionBtnText, { color: theme.primary }]}>Review Job</Text>
                        </TouchableOpacity>
                      ) : null}
                      {issue.canAutoRepair ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.chartGreen, opacity: isRepairing ? 0.5 : 1 }]}
                          onPress={() => handleRepair(issue)}
                          disabled={isRepairing}
                        >
                          <Text style={[styles.actionBtnText, { color: theme.chartGreen }]}>
                            {isRepairing ? 'Repairing…' : 'Auto-Repair'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: theme.primary, marginTop: 8 }]}
              onPress={handleScan}
            >
              <Text style={styles.scanBtnText}>Re-scan</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  preScan: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  preScanIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  preScanTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  preScanDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  scanBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  summaryDivider: { width: 1, height: 40 },
  scannedAt: { fontSize: 12, marginBottom: 12, textAlign: 'center' },
  categoryScroll: { flexGrow: 0, marginBottom: 12 },
  categoryContent: { gap: 8 },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryBtnText: { fontSize: 12, fontWeight: '700' },
  noIssues: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  issueCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityText: { fontSize: 11, fontWeight: '700' },
  categoryTag: { fontSize: 11 },
  issueTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  issueDesc: { fontSize: 13, marginBottom: 4 },
  issueRec: { fontSize: 12, marginBottom: 8 },
  issueActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
