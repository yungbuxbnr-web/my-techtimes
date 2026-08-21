
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { Job } from '@/utils/offlineStorage';
import {
  getBillingPosition,
  getOpenJobs,
  resolvePeriodFilter,
  awToHours,
} from '@/utils/billingEngine';
import { buildWorkScheduleInput, getNetScheduledHours } from '@/utils/workTimeEngine';
import { getBillingRiskForJob, getRiskColour, getRiskLabel } from '@/utils/billingRiskEngine';

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export default function EndOfDayScreen() {
  const { theme } = useThemeContext();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [netScheduledHours, setNetScheduledHours] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    console.log('EndOfDay: Loading data for date', selectedDate.toISOString().split('T')[0]);
    setLoading(true);
    try {
      const [j, b, schedule] = await Promise.all([
        api.getAllJobs(),
        billingStorage.getAllRecords(),
        api.getSchedule(),
      ]);
      setJobs(j);
      setBillingRecords(b);
      const wsInput = buildWorkScheduleInput(schedule);
      const nsh = getNetScheduledHours(wsInput);
      setNetScheduledHours(nsh);
      console.log('EndOfDay: Loaded', j.length, 'jobs, netScheduledHours:', nsh.toFixed(2));
    } catch (err) {
      console.error('EndOfDay: Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = new Date();
  const isToday = isSameDay(selectedDate, today);

  const goBack = () => {
    console.log('EndOfDay: Date navigation — going back one day');
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const goForward = () => {
    if (isToday) return;
    console.log('EndOfDay: Date navigation — going forward one day');
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const now = new Date();
  const pos = getBillingPosition(jobs, billingRecords, resolvePeriodFilter('day', selectedDate));
  const openJobsList = getOpenJobs(jobs, billingRecords, resolvePeriodFilter('day', selectedDate));

  // Title logic
  const isPastShiftEnd = !isToday;
  const screenTitle = isPastShiftEnd ? 'End-of-Day Workshop Summary' : "Today's Workshop Position";

  // Performance result
  const diff = pos.recordedHours - netScheduledHours;
  let performanceTitle = '';
  let performanceBody = '';
  let performanceColour = theme.chartGreen;
  if (diff >= 1.5) {
    performanceTitle = 'Strong Day';
    performanceBody = `You finished ${diff.toFixed(1)}h above today's adjusted available hours.`;
    performanceColour = theme.chartGreen;
  } else if (diff >= 0) {
    performanceTitle = 'On Target';
    performanceBody = `Recorded work matched today's adjusted available hours.`;
    performanceColour = theme.primary;
  } else {
    performanceTitle = 'Below Available Time';
    performanceBody = `Recorded work finished ${Math.abs(diff).toFixed(1)}h below today's adjusted available hours.`;
    performanceColour = theme.chartYellow;
  }

  // Billing attention jobs
  const attentionJobs = openJobsList.filter(({ job, billing }) => {
    const risk = getBillingRiskForJob(job, billing, now);
    return risk.riskLevel !== 'none';
  });

  // VHC summary
  const dayJobs = jobs.filter(j => {
    const d = new Date(j.createdAt);
    return isSameDay(d, selectedDate);
  });
  const vhcCount = dayJobs.filter(j => j.vhcStatus !== 'NONE').length;
  const noVhcCount = dayJobs.filter(j => j.vhcStatus === 'NONE').length;
  const greenCount = dayJobs.filter(j => j.vhcStatus === 'GREEN').length;
  const orangeCount = dayJobs.filter(j => j.vhcStatus === 'ORANGE').length;
  const redCount = dayJobs.filter(j => j.vhcStatus === 'RED').length;

  const recordedEfficiency = netScheduledHours > 0 ? (pos.recordedHours / netScheduledHours) * 100 : 0;
  const billedEfficiency = netScheduledHours > 0 ? (pos.billedHours / netScheduledHours) * 100 : 0;

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading summary…</Text>
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
        {/* Date navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity style={[styles.dateNavBtn, { backgroundColor: theme.card }]} onPress={goBack}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name={'chevron-left' as any} size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.dateNavText, { color: theme.text }]}>{formatDateHeader(selectedDate)}</Text>
          <TouchableOpacity
            style={[styles.dateNavBtn, { backgroundColor: theme.card, opacity: isToday ? 0.3 : 1 }]}
            onPress={goForward}
            disabled={isToday}
          >
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name={'chevron-right' as any} size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={[styles.pageTitle, { color: theme.text }]}>{screenTitle}</Text>

        {/* Main metrics card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Workshop Position</Text>

          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Adjusted Available</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{netScheduledHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Recorded</Text>
            <Text style={[styles.metricValue, { color: theme.primary }]}>{pos.recordedHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Billed</Text>
            <Text style={[styles.metricValue, { color: theme.chartGreen }]}>{pos.billedHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Open</Text>
            <Text style={[styles.metricValue, { color: theme.chartYellow }]}>{pos.openHours.toFixed(1)}h</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Recorded Efficiency</Text>
            <Text style={[styles.metricValue, { color: theme.primary }]}>{recordedEfficiency.toFixed(0)}%</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Billed Efficiency</Text>
            <Text style={[styles.metricValue, { color: theme.chartGreen }]}>{billedEfficiency.toFixed(0)}%</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
          <View style={styles.jobCountsRow}>
            <View style={styles.jobCountItem}>
              <Text style={[styles.jobCountValue, { color: theme.text }]}>{pos.totalJobs}</Text>
              <Text style={[styles.jobCountLabel, { color: theme.textSecondary }]}>Jobs</Text>
            </View>
            <View style={[styles.jobCountDivider, { backgroundColor: theme.border }]} />
            <View style={styles.jobCountItem}>
              <Text style={[styles.jobCountValue, { color: theme.chartGreen }]}>{pos.billedJobs}</Text>
              <Text style={[styles.jobCountLabel, { color: theme.textSecondary }]}>Closed</Text>
            </View>
            <View style={[styles.jobCountDivider, { backgroundColor: theme.border }]} />
            <View style={styles.jobCountItem}>
              <Text style={[styles.jobCountValue, { color: theme.chartYellow }]}>{pos.openJobs}</Text>
              <Text style={[styles.jobCountLabel, { color: theme.textSecondary }]}>Open</Text>
            </View>
            <View style={[styles.jobCountDivider, { backgroundColor: theme.border }]} />
            <View style={styles.jobCountItem}>
              <Text style={[styles.jobCountValue, { color: theme.accent }]}>{pos.billingConversion.toFixed(0)}%</Text>
              <Text style={[styles.jobCountLabel, { color: theme.textSecondary }]}>Conversion</Text>
            </View>
          </View>
        </View>

        {/* Performance result card */}
        <View style={[styles.performanceCard, { backgroundColor: performanceColour + '18', borderColor: performanceColour }]}>
          <Text style={[styles.performanceTitle, { color: performanceColour }]}>{performanceTitle}</Text>
          <Text style={[styles.performanceBody, { color: theme.text }]}>{performanceBody}</Text>
        </View>

        {/* Open Work section */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Open Work</Text>
            <Text style={[styles.sectionCount, { color: theme.chartYellow }]}>{openJobsList.length} jobs</Text>
          </View>
          {openJobsList.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No open jobs for this date.</Text>
          ) : (
            openJobsList.map(({ job, billing }) => {
              const risk = getBillingRiskForJob(job, billing, now);
              const riskColour = getRiskColour(risk.riskLevel, theme);
              const riskLabel = getRiskLabel(risk.riskLevel);
              const ageDays = Math.floor((now.getTime() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              const hours = awToHours(job.aw ?? 0);
              return (
                <View key={job.id} style={[styles.openJobRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.openJobLeft}>
                    <Text style={[styles.openJobWip, { color: theme.text }]}>{job.wipNumber}</Text>
                    <Text style={[styles.openJobReg, { color: theme.textSecondary }]}>{job.vehicleReg}</Text>
                  </View>
                  <View style={styles.openJobRight}>
                    <Text style={[styles.openJobHours, { color: theme.primary }]}>{hours.toFixed(1)}h</Text>
                    <Text style={[styles.openJobAw, { color: theme.textSecondary }]}>{job.aw ?? 0} AW</Text>
                    <Text style={[styles.openJobAge, { color: theme.textSecondary }]}>{ageDays}d</Text>
                    {risk.riskLevel !== 'none' && (
                      <View style={[styles.riskDot, { backgroundColor: riskColour }]} />
                    )}
                  </View>
                </View>
              );
            })
          )}
          {openJobsList.length > 0 && (
            <TouchableOpacity
              style={[styles.reviewBtn, { borderColor: theme.primary }]}
              onPress={() => {
                console.log('EndOfDay: Tapped Review Open Jobs button');
                router.push('/open-job-control' as any);
              }}
            >
              <Text style={[styles.reviewBtnText, { color: theme.primary }]}>Review Open Jobs</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Billing Attention section */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Billing Attention</Text>
            {attentionJobs.length > 0 && (
              <Text style={[styles.sectionCount, { color: theme.chartRed }]}>{attentionJobs.length} flagged</Text>
            )}
          </View>
          {attentionJobs.length === 0 ? (
            <View style={styles.clearRow}>
              <IconSymbol ios_icon_name="checkmark.shield.fill" android_material_icon_name={'verified' as any} size={18} color={theme.chartGreen} />
              <Text style={[styles.clearText, { color: theme.chartGreen }]}>No Billing issues detected.</Text>
            </View>
          ) : (
            attentionJobs.map(({ job, billing }) => {
              const risk = getBillingRiskForJob(job, billing, now);
              const firstReason = risk.reasons[0] ?? '';
              const riskColour = getRiskColour(risk.riskLevel, theme);
              return (
                <View key={job.id} style={[styles.attentionRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.riskDot, { backgroundColor: riskColour }]} />
                  <View style={styles.attentionText}>
                    <Text style={[styles.attentionWip, { color: theme.text }]}>{job.wipNumber}</Text>
                    <Text style={[styles.attentionReason, { color: theme.textSecondary }]}>{firstReason}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* VHC Summary */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>VHC Summary</Text>
          <View style={styles.vhcRow}>
            <View style={styles.vhcItem}>
              <Text style={[styles.vhcValue, { color: theme.primary }]}>{vhcCount}</Text>
              <Text style={[styles.vhcLabel, { color: theme.textSecondary }]}>With VHC</Text>
            </View>
            <View style={styles.vhcItem}>
              <Text style={[styles.vhcValue, { color: theme.textSecondary }]}>{noVhcCount}</Text>
              <Text style={[styles.vhcLabel, { color: theme.textSecondary }]}>No VHC</Text>
            </View>
            <View style={styles.vhcItem}>
              <Text style={[styles.vhcValue, { color: theme.chartGreen }]}>{greenCount}</Text>
              <Text style={[styles.vhcLabel, { color: theme.textSecondary }]}>Green</Text>
            </View>
            <View style={styles.vhcItem}>
              <Text style={[styles.vhcValue, { color: theme.chartYellow }]}>{orangeCount}</Text>
              <Text style={[styles.vhcLabel, { color: theme.textSecondary }]}>Orange</Text>
            </View>
            <View style={styles.vhcItem}>
              <Text style={[styles.vhcValue, { color: theme.chartRed }]}>{redCount}</Text>
              <Text style={[styles.vhcLabel, { color: theme.textSecondary }]}>Red</Text>
            </View>
          </View>
        </View>

        {/* Generate Daily PDF button */}
        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: theme.primary }]}
          onPress={() => {
            console.log('EndOfDay: Tapped Generate Daily PDF button for date', selectedDate.toISOString().split('T')[0]);
            router.push({ pathname: '/report-builder', params: { preset: 'daily', date: selectedDate.toISOString() } } as any);
          }}
        >
          <IconSymbol ios_icon_name="doc.richtext.fill" android_material_icon_name={'picture-as-pdf' as any} size={20} color="#fff" />
          <Text style={styles.pdfBtnText}>Generate Daily PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },

  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavText: { fontSize: 17, fontWeight: '600' },

  pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },

  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metricLabel: { fontSize: 14 },
  metricValue: { fontSize: 14, fontWeight: '600' },
  metricDivider: { height: 1, marginVertical: 10 },

  jobCountsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  jobCountItem: { alignItems: 'center', flex: 1 },
  jobCountValue: { fontSize: 20, fontWeight: '700' },
  jobCountLabel: { fontSize: 11, marginTop: 2 },
  jobCountDivider: { width: 1, height: 32 },

  performanceCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  performanceTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  performanceBody: { fontSize: 14, lineHeight: 20 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionCount: { fontSize: 13, fontWeight: '600' },

  emptyText: { fontSize: 14, fontStyle: 'italic' },

  openJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  openJobLeft: {},
  openJobWip: { fontSize: 15, fontWeight: '600' },
  openJobReg: { fontSize: 13, marginTop: 2 },
  openJobRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  openJobHours: { fontSize: 14, fontWeight: '600' },
  openJobAw: { fontSize: 13 },
  openJobAge: { fontSize: 13 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },

  reviewBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: { fontSize: 14, fontWeight: '600' },

  clearRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearText: { fontSize: 14, fontWeight: '500' },

  attentionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  attentionText: { flex: 1 },
  attentionWip: { fontSize: 14, fontWeight: '600' },
  attentionReason: { fontSize: 13, marginTop: 2 },

  vhcRow: { flexDirection: 'row', justifyContent: 'space-around' },
  vhcItem: { alignItems: 'center' },
  vhcValue: { fontSize: 20, fontWeight: '700' },
  vhcLabel: { fontSize: 11, marginTop: 2 },

  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pdfBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
