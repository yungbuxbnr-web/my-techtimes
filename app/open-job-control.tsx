
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { Job } from '@/utils/offlineStorage';
import { getOpenJobs, awToHours } from '@/utils/billingEngine';
import {
  getBillingRiskForJob,
  getRiskColour,
  getRiskLabel,
  RiskLevel,
} from '@/utils/billingRiskEngine';

type SortOption = 'oldest' | 'newest' | 'highest_hours' | 'highest_aw' | 'highest_risk';
type FilterOption = 'all' | 'today' | 'older' | 'with_vhc' | 'without_vhc' | 'billing_attention';

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, none: 3 };

function getAgeDays(job: Job, now: Date): number {
  const jobDate = new Date(job.createdAt);
  return Math.floor((now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));
}

function getAgeLabel(ageDays: number): string {
  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return 'Yesterday';
  return `${ageDays} days ago`;
}

function getAgeGroup(ageDays: number): string {
  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return 'Yesterday';
  if (ageDays <= 3) return '2–3 Days';
  if (ageDays <= 7) return '4–7 Days';
  return '7+ Days';
}

const AGE_GROUP_ORDER = ['Today', 'Yesterday', '2–3 Days', '4–7 Days', '7+ Days'];

export default function OpenJobControlScreen() {
  const { theme } = useThemeContext();
  const params = useLocalSearchParams<{ filter?: string }>();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('oldest');
  const [filter, setFilter] = useState<FilterOption>(
    params.filter === 'billing_attention' ? 'billing_attention' : 'all'
  );

  const load = useCallback(async () => {
    console.log('OpenJobControl: Loading jobs and billing records');
    setLoading(true);
    try {
      const [j, b] = await Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]);
      setJobs(j);
      setBillingRecords(b);
      console.log('OpenJobControl: Loaded', j.length, 'jobs and', b.length, 'billing records');
    } catch (err) {
      console.error('OpenJobControl: Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = new Date();
  const openJobsList = getOpenJobs(jobs, billingRecords, { type: 'entire' });

  // Enrich with risk and age
  const enriched = openJobsList.map(({ job, billing }) => {
    const risk = getBillingRiskForJob(job, billing, now);
    const ageDays = getAgeDays(job, now);
    return { job, billing, risk, ageDays };
  });

  // Summary stats
  const totalOpenJobs = enriched.length;
  const totalOpenHours = enriched.reduce((s, { job }) => s + awToHours(job.aw ?? 0), 0);
  const totalOpenAW = enriched.reduce((s, { job }) => s + (job.aw ?? 0), 0);
  const oldestAgeDays = enriched.length > 0 ? Math.max(...enriched.map(e => e.ageDays)) : 0;
  const avgAge = enriched.length > 0
    ? enriched.reduce((s, e) => s + e.ageDays, 0) / enriched.length
    : 0;

  // Apply filter
  const filtered = enriched.filter(({ job, risk, ageDays }) => {
    switch (filter) {
      case 'today': return ageDays === 0;
      case 'older': return ageDays >= 2;
      case 'with_vhc': return job.vhcStatus !== 'NONE';
      case 'without_vhc': return job.vhcStatus === 'NONE';
      case 'billing_attention': return risk.riskLevel !== 'none';
      default: return true;
    }
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'newest': return a.ageDays - b.ageDays;
      case 'oldest': return b.ageDays - a.ageDays;
      case 'highest_hours': return awToHours(b.job.aw ?? 0) - awToHours(a.job.aw ?? 0);
      case 'highest_aw': return (b.job.aw ?? 0) - (a.job.aw ?? 0);
      case 'highest_risk': return RISK_ORDER[a.risk.riskLevel] - RISK_ORDER[b.risk.riskLevel];
      default: return 0;
    }
  });

  // Group by age
  const groups: Record<string, typeof sorted> = {};
  for (const item of sorted) {
    const group = getAgeGroup(item.ageDays);
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
  }
  const groupKeys = AGE_GROUP_ORDER.filter(g => groups[g]?.length > 0);

  const vhcColour = (status: string) => {
    switch (status) {
      case 'GREEN': return theme.chartGreen;
      case 'ORANGE': return theme.chartYellow;
      case 'RED': return theme.chartRed;
      default: return theme.textSecondary;
    }
  };

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'oldest', label: 'Oldest First' },
    { key: 'newest', label: 'Newest First' },
    { key: 'highest_hours', label: 'Highest Hours' },
    { key: 'highest_aw', label: 'Highest AW' },
    { key: 'highest_risk', label: 'Highest Risk' },
  ];

  const filterOptions: { key: FilterOption; label: string }[] = [
    { key: 'all', label: 'All Open' },
    { key: 'today', label: 'Today' },
    { key: 'older', label: 'Older Jobs' },
    { key: 'with_vhc', label: 'With VHC' },
    { key: 'without_vhc', label: 'Without VHC' },
    { key: 'billing_attention', label: 'Billing Attention' },
  ];

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading open jobs…</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.pageTitle, { color: theme.text }]}>Open Job Control Centre</Text>

        {/* Summary bar */}
        <View style={[styles.summaryBar, { backgroundColor: theme.card }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalOpenJobs}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Open Jobs</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalOpenHours.toFixed(1)}h</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Open Hours</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalOpenAW}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Open AW</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.chartRed }]}>{oldestAgeDays}d</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Oldest</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.chartYellow }]}>{avgAge.toFixed(1)}d</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Avg Age</Text>
          </View>
        </View>

        {/* Sort chips */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SORT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {sortOptions.map(opt => {
            const active = sort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.card }]}
                onPress={() => {
                  console.log('OpenJobControl: Sort changed to', opt.key);
                  setSort(opt.key);
                }}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter chips */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>FILTER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {filterOptions.map(opt => {
            const active = filter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.card }]}
                onPress={() => {
                  console.log('OpenJobControl: Filter changed to', opt.key);
                  setFilter(opt.key);
                }}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Age groups */}
        {sorted.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name={'check-circle' as any} size={32} color={theme.chartGreen} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Open Jobs</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>All jobs are billed or no jobs match the current filter.</Text>
          </View>
        ) : (
          groupKeys.map(groupKey => (
            <View key={groupKey}>
              <Text style={[styles.groupHeader, { color: theme.textSecondary }]}>{groupKey.toUpperCase()}</Text>
              {groups[groupKey].map(({ job, billing, risk, ageDays }) => {
                const hours = awToHours(job.aw ?? 0);
                const riskColour = getRiskColour(risk.riskLevel, theme);
                const riskLabel = getRiskLabel(risk.riskLevel);
                const workDate = new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const ageLabel = getAgeLabel(ageDays);

                return (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                      console.log('OpenJobControl: Tapped job card — WIP:', job.wipNumber, 'id:', job.id);
                      router.push({ pathname: '/edit-job', params: { jobId: job.id } } as any);
                    }}
                    activeOpacity={0.75}
                  >
                    {/* Top row */}
                    <View style={styles.jobCardTop}>
                      <View>
                        <Text style={[styles.wipNumber, { color: theme.text }]}>{job.wipNumber}</Text>
                        <Text style={[styles.regText, { color: theme.textSecondary }]}>{job.vehicleReg}</Text>
                      </View>
                      <View style={styles.jobCardTopRight}>
                        {/* VHC badge */}
                        <View style={[styles.vhcBadge, { backgroundColor: vhcColour(job.vhcStatus) + '22', borderColor: vhcColour(job.vhcStatus) }]}>
                          <Text style={[styles.vhcBadgeText, { color: vhcColour(job.vhcStatus) }]}>{job.vhcStatus}</Text>
                        </View>
                        {/* Notes indicator */}
                        {!!job.notes && (
                          <IconSymbol ios_icon_name="note.text" android_material_icon_name={'notes' as any} size={16} color={theme.textSecondary} />
                        )}
                      </View>
                    </View>

                    {/* Middle row */}
                    <View style={styles.jobCardMid}>
                      <View style={styles.jobStat}>
                        <Text style={[styles.jobStatValue, { color: theme.text }]}>{job.aw ?? 0}</Text>
                        <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>AW</Text>
                      </View>
                      <View style={styles.jobStat}>
                        <Text style={[styles.jobStatValue, { color: theme.text }]}>{hours.toFixed(1)}h</Text>
                        <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>Hours</Text>
                      </View>
                      <View style={styles.jobStat}>
                        <Text style={[styles.jobStatValue, { color: theme.textSecondary }]}>{workDate}</Text>
                        <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>Date</Text>
                      </View>
                      <View style={styles.jobStat}>
                        <Text style={[styles.jobStatValue, { color: ageDays >= 4 ? theme.chartRed : theme.chartYellow }]}>{ageLabel}</Text>
                        <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>Age</Text>
                      </View>
                    </View>

                    {/* Risk row */}
                    {risk.riskLevel !== 'none' && (
                      <TouchableOpacity
                        style={[styles.riskRow, { borderTopColor: theme.border }]}
                        onPress={() => {
                          console.log('OpenJobControl: Risk indicator tapped — WIP:', job.wipNumber, 'level:', risk.riskLevel, 'reasons:', risk.reasons);
                          Alert.alert(
                            `${riskLabel} — ${job.wipNumber}`,
                            risk.reasons.join('\n\n'),
                            [{ text: 'OK' }]
                          );
                        }}
                      >
                        <View style={[styles.riskDot, { backgroundColor: riskColour }]} />
                        <Text style={[styles.riskLabel, { color: riskColour }]}>{riskLabel}</Text>
                        <Text style={[styles.riskHint, { color: theme.textSecondary }]}>Tap for details</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, marginTop: 8 },

  summaryBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: 1, height: 32, marginHorizontal: 4 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },
  chipScroll: { marginBottom: 4 },
  chipRow: { gap: 8, paddingRight: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },

  groupHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 4, marginLeft: 2 },

  jobCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  jobCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 8,
  },
  wipNumber: { fontSize: 20, fontWeight: '700' },
  regText: { fontSize: 14, marginTop: 2 },
  jobCardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vhcBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  vhcBadgeText: { fontSize: 11, fontWeight: '700' },

  jobCardMid: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 4,
  },
  jobStat: { flex: 1, alignItems: 'center' },
  jobStatValue: { fontSize: 13, fontWeight: '600' },
  jobStatLabel: { fontSize: 10, marginTop: 2 },

  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    gap: 8,
  },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  riskHint: { fontSize: 11 },

  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});
