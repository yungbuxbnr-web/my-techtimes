
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { normaliseBillingStatus } from '@/utils/billingEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IGNORE_NOTES_KEY = '@techtimes_reconciliation_ignore_notes';

type Period = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ENTIRE';
const PERIODS: Period[] = ['DAY', 'WEEK', 'MONTH', 'YEAR', 'ENTIRE'];

type DiscrepancyCause =
  | 'edited_after_billing'
  | 'missing_billing_record'
  | 'duplicate_billing_record'
  | 'historical_snapshot_difference'
  | 'none';

interface DiscrepancyItem {
  jobId: string;
  wipNumber: string;
  vehicleReg: string;
  recordedHours: number;
  billedHours: number;
  diff: number;
  cause: DiscrepancyCause;
  causeLabel: string;
  billingRecordId?: string;
  billingRecord?: BillingRecord;
}

function getPeriodBounds(period: Period): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'ENTIRE') return null;
  if (period === 'DAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'WEEK') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'YEAR') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

function diagnoseCause(
  job: Job,
  br: BillingRecord | undefined,
  allBillingForJob: BillingRecord[]
): { cause: DiscrepancyCause; label: string } {
  if (!br) return { cause: 'missing_billing_record', label: 'Missing billing record' };
  if (allBillingForJob.length > 1) return { cause: 'duplicate_billing_record', label: 'Duplicate billing record' };
  if (br.billedAt && new Date(job.createdAt) > new Date(br.billedAt)) {
    return { cause: 'edited_after_billing', label: 'Job edited after billing' };
  }
  if (Math.abs(br.billedAW - job.aw) > 0.001) {
    return { cause: 'historical_snapshot_difference', label: 'Historical snapshot difference' };
  }
  return { cause: 'none', label: '' };
}

export default function ReconciliationScreen() {
  console.log('ReconciliationScreen: Rendering');
  const { theme } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [period, setPeriod] = useState<Period>('MONTH');
  const [loading, setLoading] = useState(true);
  const [ignoreNotes, setIgnoreNotes] = useState<Record<string, string>>({});
  const [showIgnoreInput, setShowIgnoreInput] = useState<string | null>(null);
  const [ignoreNoteText, setIgnoreNoteText] = useState('');

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const loadData = useCallback(async () => {
    console.log('ReconciliationScreen: Loading jobs and billing records');
    const [jobs, billing] = await Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]);
    console.log('ReconciliationScreen: Loaded', jobs.length, 'jobs and', billing.length, 'billing records');
    setAllJobs(jobs);
    setBillingRecords(billing);
    setLoading(false);
    // Load ignore notes
    try {
      const raw = await AsyncStorage.getItem(IGNORE_NOTES_KEY);
      if (raw) setIgnoreNotes(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build billing lookup: jobId → all records
  const billingByJobId = useMemo(() => {
    const m = new Map<string, BillingRecord[]>();
    billingRecords.forEach(r => {
      if (!m.has(r.jobId)) m.set(r.jobId, []);
      m.get(r.jobId)!.push(r);
    });
    return m;
  }, [billingRecords]);

  const filteredJobs = useMemo(() => {
    const bounds = getPeriodBounds(period);
    if (!bounds) return allJobs;
    return allJobs.filter(j => {
      const d = new Date(j.createdAt);
      return d >= bounds.start && d <= bounds.end;
    });
  }, [allJobs, period]);

  const reconciliation = useMemo(() => {
    let recordedHours = 0;
    let billedHours = 0;
    let openHours = 0;
    const discrepancies: DiscrepancyItem[] = [];

    filteredJobs.forEach(j => {
      const jobHours = (j.aw * 5) / 60;
      recordedHours += jobHours;
      const recs = billingByJobId.get(j.id) || [];
      const br = recs[0];

      if (br && normaliseBillingStatus(br.billingStatus) === 'billed') {
        billedHours += br.billedHours;
        // Check for discrepancy
        if (Math.abs(br.billedHours - jobHours) > 0.001) {
          const { cause, label } = diagnoseCause(j, br, recs);
          discrepancies.push({
            jobId: j.id,
            wipNumber: j.wipNumber,
            vehicleReg: j.vehicleReg,
            recordedHours: jobHours,
            billedHours: br.billedHours,
            diff: br.billedHours - jobHours,
            cause,
            causeLabel: label,
            billingRecordId: br.id,
            billingRecord: br,
          });
        }
      } else {
        openHours += jobHours;
        // Missing billing record is a discrepancy
        if (!br) {
          const { cause, label } = diagnoseCause(j, undefined, []);
          discrepancies.push({
            jobId: j.id,
            wipNumber: j.wipNumber,
            vehicleReg: j.vehicleReg,
            recordedHours: jobHours,
            billedHours: 0,
            diff: -jobHours,
            cause,
            causeLabel: label,
          });
        }
      }
    });

    const expectedTotal = billedHours + openHours;
    const difference = recordedHours - expectedTotal;
    const isReconciled = Math.abs(difference) < 0.01 && discrepancies.length === 0;

    return { recordedHours, billedHours, openHours, expectedTotal, difference, isReconciled, discrepancies };
  }, [filteredJobs, billingByJobId]);

  const statusColor = reconciliation.isReconciled ? theme.chartGreen : theme.chartRed;
  const statusLabel = reconciliation.isReconciled ? 'Reconciled ✓' : 'Discrepancy Detected';

  const handleAdjustBilling = (item: DiscrepancyItem) => {
    console.log('ReconciliationScreen: Adjust Billing pressed for job', item.wipNumber);
    if (!item.billingRecord) {
      Alert.alert('No Billing Record', 'This job has no billing record. Go to the Billing tab to create one.');
      return;
    }
    const job = allJobs.find(j => j.id === item.jobId);
    if (!job) return;
    const newHours = (job.aw * 5) / 60;
    Alert.alert(
      'Adjust Billing Snapshot',
      `Update billing snapshot for WIP ${item.wipNumber} to match current job values?\n\nCurrent billed: ${item.billedHours.toFixed(2)}h\nNew value: ${newHours.toFixed(2)}h (${job.aw} AW)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Snapshot',
          onPress: async () => {
            console.log('ReconciliationScreen: Confirmed adjust billing for job', item.wipNumber);
            try {
              await billingStorage.updateRecord(item.billingRecord!.id, {
                billedAW: job.aw,
                billedHours: newHours,
              });
              await billingStorage.addHistoryEntry({
                billingRecordId: item.billingRecord!.id,
                jobId: job.id,
                eventType: 'billing_adjusted',
                description: `Reconciliation snapshot update — ${newHours.toFixed(2)}h`,
                previousAW: item.billingRecord!.billedAW,
                previousHours: item.billedHours,
                newAW: job.aw,
                newHours,
              });
              await loadData();
              Alert.alert('Updated', 'Billing snapshot updated successfully.');
            } catch (err: any) {
              console.error('ReconciliationScreen: Adjust billing failed', err);
              Alert.alert('Error', err?.message ?? 'Could not update billing snapshot.');
            }
          },
        },
      ]
    );
  };

  const handleIgnoreWithNote = (item: DiscrepancyItem) => {
    console.log('ReconciliationScreen: Ignore with Note pressed for job', item.wipNumber);
    setShowIgnoreInput(item.jobId);
    setIgnoreNoteText('');
  };

  const confirmIgnore = async (jobId: string) => {
    console.log('ReconciliationScreen: Saving ignore note for job', jobId, ':', ignoreNoteText);
    const updated = { ...ignoreNotes, [jobId]: ignoreNoteText || 'Ignored' };
    setIgnoreNotes(updated);
    await AsyncStorage.setItem(IGNORE_NOTES_KEY, JSON.stringify(updated));
    setShowIgnoreInput(null);
    setIgnoreNoteText('');
  };

  const handleReviewJob = (item: DiscrepancyItem) => {
    console.log('ReconciliationScreen: Review Job pressed for job', item.wipNumber);
    router.push({
      pathname: '/add-job-modal',
      params: { editId: item.jobId },
    });
  };

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('ReconciliationScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Reconciliation Centre</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodScroll}
        contentContainerStyle={styles.periodContent}
      >
        {PERIODS.map(p => {
          const isActive = period === p;
          return (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodBtn,
                { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => {
                console.log('ReconciliationScreen: Period changed to', p);
                setPeriod(p);
              }}
            >
              <Text style={[styles.periodBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
        ) : (
          <>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              {!reconciliation.isReconciled ? (
                <Text style={styles.statusDiff}>
                  Difference: {reconciliation.difference > 0 ? '+' : ''}{reconciliation.difference.toFixed(2)}h
                </Text>
              ) : null}
            </View>

            {/* Core rule explanation */}
            <View style={[styles.ruleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.ruleTitle, { color: theme.text }]}>Reconciliation Rule</Text>
              <Text style={[styles.ruleFormula, { color: theme.primary }]}>
                Recorded = Billed + Open
              </Text>
              <Text style={[styles.ruleDesc, { color: theme.textSecondary }]}>
                All recorded hours must equal the sum of billed and open hours. Any difference indicates a data inconsistency.
              </Text>
            </View>

            {/* Summary grid */}
            <View style={[styles.summaryGrid, { backgroundColor: theme.card }]}>
              {[
                { label: 'Recorded', value: `${reconciliation.recordedHours.toFixed(2)}h`, color: theme.text },
                { label: 'Billed', value: `${reconciliation.billedHours.toFixed(2)}h`, color: theme.chartGreen },
                { label: 'Open', value: `${reconciliation.openHours.toFixed(2)}h`, color: theme.chartRed },
                { label: 'Expected', value: `${reconciliation.expectedTotal.toFixed(2)}h`, color: theme.primary },
              ].map(item => (
                <View key={item.label} style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Discrepancies */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              DISCREPANCIES ({reconciliation.discrepancies.filter(d => !ignoreNotes[d.jobId]).length})
            </Text>

            {reconciliation.discrepancies.filter(d => !ignoreNotes[d.jobId]).length === 0 ? (
              <View style={[styles.noDiscrepancies, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.noDiscrepanciesText, { color: theme.chartGreen }]}>
                  No discrepancies detected
                </Text>
              </View>
            ) : (
              reconciliation.discrepancies
                .filter(d => !ignoreNotes[d.jobId])
                .map(d => {
                  const diffLabel = `${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)}h`;
                  const diffColor = d.diff > 0 ? theme.chartGreen : theme.chartRed;
                  const isShowingIgnoreInput = showIgnoreInput === d.jobId;
                  return (
                    <View
                      key={d.jobId}
                      style={[styles.discrepancyCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    >
                      <View style={styles.discTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.discWip, { color: theme.text }]}>WIP {d.wipNumber}</Text>
                          <Text style={[styles.discReg, { color: theme.textSecondary }]}>{d.vehicleReg}</Text>
                          <View style={styles.discRow}>
                            <Text style={[styles.discMeta, { color: theme.textSecondary }]}>
                              Recorded: {d.recordedHours.toFixed(2)}h
                            </Text>
                            <Text style={[styles.discMeta, { color: theme.textSecondary }]}>
                              Billed: {d.billedHours.toFixed(2)}h
                            </Text>
                          </View>
                          {d.causeLabel ? (
                            <View style={[styles.causeBadge, { backgroundColor: theme.chartYellow + '22' }]}>
                              <Text style={[styles.causeText, { color: theme.chartYellow }]}>
                                {d.causeLabel}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.discDiff, { color: diffColor }]}>{diffLabel}</Text>
                      </View>

                      {isShowingIgnoreInput ? (
                        <View style={styles.ignoreInputRow}>
                          <TextInput
                            style={[styles.ignoreInput, { color: theme.text, borderColor: theme.border }]}
                            value={ignoreNoteText}
                            onChangeText={setIgnoreNoteText}
                            placeholder="Enter reason for ignoring..."
                            placeholderTextColor={theme.textSecondary}
                          />
                          <TouchableOpacity
                            style={[styles.ignoreConfirmBtn, { backgroundColor: theme.primary }]}
                            onPress={() => confirmIgnore(d.jobId)}
                          >
                            <Text style={styles.ignoreConfirmText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.ignoreCancelBtn, { borderColor: theme.border }]}
                            onPress={() => setShowIgnoreInput(null)}
                          >
                            <Text style={[styles.ignoreCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.discActions}>
                          <TouchableOpacity
                            style={[styles.discActionBtn, { borderColor: theme.primary }]}
                            onPress={() => handleReviewJob(d)}
                          >
                            <Text style={[styles.discActionText, { color: theme.primary }]}>Review Job</Text>
                          </TouchableOpacity>
                          {d.billingRecord ? (
                            <TouchableOpacity
                              style={[styles.discActionBtn, { borderColor: theme.chartGreen }]}
                              onPress={() => handleAdjustBilling(d)}
                            >
                              <Text style={[styles.discActionText, { color: theme.chartGreen }]}>Adjust Billing</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={[styles.discActionBtn, { borderColor: theme.textSecondary }]}
                            onPress={() => handleIgnoreWithNote(d)}
                          >
                            <Text style={[styles.discActionText, { color: theme.textSecondary }]}>Ignore</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
            )}

            {/* Ignored items */}
            {Object.keys(ignoreNotes).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>
                  IGNORED ({Object.keys(ignoreNotes).length})
                </Text>
                {reconciliation.discrepancies
                  .filter(d => ignoreNotes[d.jobId])
                  .map(d => (
                    <View
                      key={d.jobId}
                      style={[styles.ignoredCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    >
                      <Text style={[styles.discWip, { color: theme.textSecondary }]}>WIP {d.wipNumber}</Text>
                      <Text style={[styles.ignoreNote, { color: theme.textSecondary }]}>
                        Note: {ignoreNotes[d.jobId]}
                      </Text>
                      <TouchableOpacity
                        onPress={async () => {
                          console.log('ReconciliationScreen: Unignore pressed for job', d.wipNumber);
                          const updated = { ...ignoreNotes };
                          delete updated[d.jobId];
                          setIgnoreNotes(updated);
                          await AsyncStorage.setItem(IGNORE_NOTES_KEY, JSON.stringify(updated));
                        }}
                      >
                        <Text style={[styles.unignoreText, { color: theme.primary }]}>Unignore</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </>
            )}

            {/* Calculation Sources */}
            <View style={[styles.sourcesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sourcesTitle, { color: theme.text }]}>Calculation Sources</Text>
              <Text style={[styles.sourcesDesc, { color: theme.textSecondary }]}>
                All figures use selectors from{' '}
                <Text style={{ color: theme.primary }}>billingEngine.ts</Text>
                {' '}via{' '}
                <Text style={{ color: theme.primary }}>normaliseBillingStatus()</Text>.
              </Text>
              <View style={styles.sourceRow}>
                <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>Recorded Hours</Text>
                <Text style={[styles.sourceValue, { color: theme.text }]}>job.aw × 5 ÷ 60</Text>
              </View>
              <View style={styles.sourceRow}>
                <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>Billed Hours</Text>
                <Text style={[styles.sourceValue, { color: theme.text }]}>billing.billedHours (snapshot)</Text>
              </View>
              <View style={styles.sourceRow}>
                <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>Open Hours</Text>
                <Text style={[styles.sourceValue, { color: theme.text }]}>Recorded − Billed</Text>
              </View>
              <View style={styles.sourceRow}>
                <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>Status Check</Text>
                <Text style={[styles.sourceValue, { color: theme.text }]}>normaliseBillingStatus()</Text>
              </View>
            </View>
          </>
        )}
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
  periodScroll: { flexGrow: 0, marginBottom: 8 },
  periodContent: { paddingHorizontal: 16, gap: 8 },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  periodBtnText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  loadingText: { textAlign: 'center', paddingTop: 60, fontSize: 16 },
  statusBanner: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statusDiff: { color: '#fff', fontSize: 14, marginTop: 4 },
  ruleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  ruleTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  ruleFormula: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  ruleDesc: { fontSize: 13, lineHeight: 18 },
  summaryGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  noDiscrepancies: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  noDiscrepanciesText: { fontSize: 14, fontWeight: '600' },
  discrepancyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  discTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  discWip: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  discReg: { fontSize: 13, marginBottom: 4 },
  discRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  discMeta: { fontSize: 12 },
  causeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  causeText: { fontSize: 11, fontWeight: '600' },
  discDiff: { fontSize: 18, fontWeight: '800', minWidth: 60, textAlign: 'right' },
  discActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  discActionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  discActionText: { fontSize: 12, fontWeight: '600' },
  ignoreInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ignoreInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  ignoreConfirmBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ignoreConfirmText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  ignoreCancelBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ignoreCancelText: { fontSize: 13 },
  ignoredCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    opacity: 0.7,
  },
  ignoreNote: { fontSize: 12, marginTop: 2, marginBottom: 6 },
  unignoreText: { fontSize: 12, fontWeight: '600' },
  sourcesCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
  },
  sourcesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sourcesDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sourceLabel: { fontSize: 12 },
  sourceValue: { fontSize: 12, fontWeight: '600' },
});
