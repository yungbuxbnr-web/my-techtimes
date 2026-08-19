
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';

type Period = 'MONTH' | 'YEAR' | 'ENTIRE';

const PERIODS: Period[] = ['MONTH', 'YEAR', 'ENTIRE'];

function filterByPeriod(jobs: Job[], period: Period): Job[] {
  if (period === 'ENTIRE') return jobs;
  const now = new Date();
  const cutoff = new Date();
  if (period === 'MONTH') cutoff.setMonth(now.getMonth(), 1);
  else if (period === 'YEAR') cutoff.setMonth(0, 1);
  return jobs.filter(j => new Date(j.createdAt) >= cutoff);
}

interface DiscrepancyItem {
  jobId: string;
  wipNumber: string;
  vehicleReg: string;
  recordedHours: number;
  billedHours: number;
  diff: number;
}

export default function ReconciliationScreen() {
  console.log('ReconciliationScreen: Rendering');
  const { theme } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [period, setPeriod] = useState<Period>('MONTH');
  const [loading, setLoading] = useState(true);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  useEffect(() => {
    console.log('ReconciliationScreen: Loading jobs and billing records');
    Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]).then(([jobs, billing]) => {
      console.log('ReconciliationScreen: Loaded', jobs.length, 'jobs and', billing.length, 'billing records');
      setAllJobs(jobs);
      setBillingRecords(billing);
      setLoading(false);
    });
  }, []);

  const billingByJobId = useMemo(() => {
    const m = new Map<string, BillingRecord>();
    billingRecords.forEach(r => m.set(r.jobId, r));
    return m;
  }, [billingRecords]);

  const filteredJobs = useMemo(() => filterByPeriod(allJobs, period), [allJobs, period]);

  const reconciliation = useMemo(() => {
    let recordedHours = 0;
    let billedHours = 0;
    let openHours = 0;
    const discrepancies: DiscrepancyItem[] = [];

    filteredJobs.forEach(j => {
      const jobHours = (j.aw * 5) / 60;
      recordedHours += jobHours;
      const br = billingByJobId.get(j.id);
      if (br?.billingStatus === 'billed') {
        billedHours += br.billedHours;
        if (Math.abs(br.billedAW - j.aw) > 0.001) {
          discrepancies.push({
            jobId: j.id,
            wipNumber: j.wipNumber,
            vehicleReg: j.vehicleReg,
            recordedHours: jobHours,
            billedHours: br.billedHours,
            diff: br.billedHours - jobHours,
          });
        }
      } else {
        openHours += jobHours;
      }
    });

    const expectedTotal = billedHours + openHours;
    const difference = recordedHours - expectedTotal;
    const isReconciled = Math.abs(difference) < 0.01;

    return { recordedHours, billedHours, openHours, expectedTotal, difference, isReconciled, discrepancies };
  }, [filteredJobs, billingByJobId]);

  const statusColor = reconciliation.isReconciled ? theme.chartGreen : theme.chartRed;
  const statusLabel = reconciliation.isReconciled ? 'Reconciled ✓' : 'Discrepancy Detected';

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Reconciliation</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
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
      </View>

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

            {/* Summary cards */}
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

            {/* Post-billing discrepancies */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              POST-BILLING EDITS ({reconciliation.discrepancies.length})
            </Text>

            {reconciliation.discrepancies.length === 0 ? (
              <View style={[styles.noDiscrepancies, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.noDiscrepanciesText, { color: theme.chartGreen }]}>
                  No post-billing edits detected
                </Text>
              </View>
            ) : (
              reconciliation.discrepancies.map(d => {
                const diffLabel = `${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)}h`;
                const diffColor = d.diff > 0 ? theme.chartGreen : theme.chartRed;
                return (
                  <View
                    key={d.jobId}
                    style={[styles.discrepancyCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
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
                    </View>
                    <Text style={[styles.discDiff, { color: diffColor }]}>{diffLabel}</Text>
                  </View>
                );
              })
            )}

            {/* Adjust billing button */}
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('ReconciliationScreen: Adjust Billing button pressed');
                router.push('/(tabs)/billing' as never);
              }}
            >
              <Text style={styles.adjustBtnText}>Adjust Billing</Text>
            </TouchableOpacity>
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
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodBtnText: { fontSize: 13, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  loadingText: { textAlign: 'center', paddingTop: 60, fontSize: 16 },
  statusBanner: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statusDiff: { color: '#fff', fontSize: 14, marginTop: 4 },
  summaryGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700' },
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  discWip: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  discReg: { fontSize: 13, marginBottom: 4 },
  discRow: { flexDirection: 'row', gap: 12 },
  discMeta: { fontSize: 12 },
  discDiff: { fontSize: 18, fontWeight: '800' },
  adjustBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  adjustBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
