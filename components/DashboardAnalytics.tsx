
import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const safeHaptics = {
  selectionAsync: async () => {
    if (Platform.OS === 'web') return;
    try { await Haptics.selectionAsync(); } catch {}
  },
  impactAsync: async (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'web') return;
    try { await Haptics.impactAsync(style); } catch {}
  },
};

export interface DashboardAnalyticsProps {
  billingStats: {
    recordedHours: number;
    billedHours: number;
    openHours: number;
    unbilledHours: number;
    recordedAW: number;
    billedAW: number;
    jobsRecorded: number;
    jobsBilled: number;
    jobsOpen: number;
  } | null;
  todayStats: {
    totalAw: number;
    soldHours: number;
    efficiency: number;
    availableHours: number;
  } | null;
  monthlyStats: {
    totalAw: number;
    soldHours: number;
    efficiency: number;
    availableHours: number;
  } | null;
}

type AnalyticsPeriod = 'day' | 'month' | 'year' | 'entire';
type AnalyticsSection = 'billing' | 'performance' | 'jobs' | 'insights';

// ─── CIRCLE COMPONENT ────────────────────────────────────────────────────────

interface CircleCardProps {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  progress?: number; // 0–1
  onPress: () => void;
  size?: number;
}

function CircleCard({ label, value, subValue, color, progress = 0, onPress, size = 90 }: CircleCardProps) {
  const { theme } = useThemeContext();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, damping: 15, stiffness: 300 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }).start();
  };

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const valueFontSize = value.length > 5 ? 13 : 16;

  return (
    <TouchableOpacity
      onPress={() => {
        console.log('[DashboardAnalytics] CircleCard pressed — label:', label, 'value:', value);
        safeHaptics.selectionAsync();
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.circleCard, { backgroundColor: theme.card, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.circleRing, {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.border,
          borderWidth: 3,
        }]}>
          <View style={[styles.circleProgress, {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderWidth: 3,
            opacity: clampedProgress > 0 ? 1 : 0,
            transform: [{ rotate: `${-90 + (clampedProgress * 360)}deg` }],
          }]} />
          <View style={styles.circleInner}>
            <Text style={[styles.circleValue, { color: color, fontSize: valueFontSize }]} numberOfLines={1}>{value}</Text>
            {subValue ? <Text style={[styles.circleSubValue, { color: theme.textSecondary }]} numberOfLines={1}>{subValue}</Text> : null}
          </View>
        </View>
        <Text style={[styles.circleLabel, { color: theme.textSecondary }]} numberOfLines={2}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function DashboardAnalytics({ billingStats, todayStats, monthlyStats }: DashboardAnalyticsProps) {
  const { theme } = useThemeContext();
  const [activeSection, setActiveSection] = useState<AnalyticsSection>('billing');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');

  // ─── CALCULATIONS ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const bs = billingStats;
    const ps = period === 'day' ? todayStats : monthlyStats;

    const recordedHours = bs?.recordedHours ?? 0;
    const billedHours = bs?.billedHours ?? 0;
    const openHours = bs?.openHours ?? 0;
    const billingConversion = recordedHours > 0 ? (billedHours / recordedHours) * 100 : 0;
    const billingGap = recordedHours - billedHours;

    const availableHours = ps?.availableHours ?? 0;
    const soldHours = ps?.soldHours ?? 0;
    const recordedEfficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
    const billedEfficiency = availableHours > 0 ? (billedHours / availableHours) * 100 : 0;
    const efficiencyGap = recordedEfficiency - billedEfficiency;

    const jobsRecorded = bs?.jobsRecorded ?? 0;
    const jobsBilled = bs?.jobsBilled ?? 0;
    const jobsOpen = bs?.jobsOpen ?? 0;
    const closureRate = jobsRecorded > 0 ? (jobsBilled / jobsRecorded) * 100 : 0;

    const avgHoursPerJob = jobsRecorded > 0 ? recordedHours / jobsRecorded : 0;
    const avgBilledHoursPerJob = jobsBilled > 0 ? billedHours / jobsBilled : 0;

    const potentialBilledHours = billedHours + openHours;
    const potentialBilledEfficiency = availableHours > 0 ? (potentialBilledHours / availableHours) * 100 : 0;

    return {
      recordedHours, billedHours, openHours, billingConversion, billingGap,
      availableHours, recordedEfficiency, billedEfficiency, efficiencyGap,
      jobsRecorded, jobsBilled, jobsOpen, closureRate,
      avgHoursPerJob, avgBilledHoursPerJob,
      potentialBilledHours, potentialBilledEfficiency,
    };
  }, [billingStats, todayStats, monthlyStats, period]);

  // ─── SECTION CONTENT ───────────────────────────────────────────────────────

  const sections: { key: AnalyticsSection; label: string }[] = [
    { key: 'billing', label: 'Billing' },
    { key: 'performance', label: 'Performance' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'insights', label: 'Insights' },
  ];

  const handleCircleTap = useCallback((type: string) => {
    console.log('[DashboardAnalytics] Circle tapped — type:', type);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (type) {
      case 'recorded':
        console.log('[DashboardAnalytics] Navigating to jobs tab');
        router.push('/(tabs)/jobs' as any);
        break;
      case 'billed':
        console.log('[DashboardAnalytics] Navigating to billing tab');
        router.push('/(tabs)/billing' as any);
        break;
      case 'open':
        console.log('[DashboardAnalytics] Navigating to billing tab (open jobs)');
        router.push('/(tabs)/billing' as any);
        break;
      case 'conversion':
        console.log('[DashboardAnalytics] Showing billing conversion alert — conversion:', stats.billingConversion.toFixed(0) + '%');
        Alert.alert(
          'Billing Conversion',
          `Recorded: ${stats.recordedHours.toFixed(1)}h\nBilled: ${stats.billedHours.toFixed(1)}h\nOpen: ${stats.openHours.toFixed(1)}h\nConversion: ${stats.billingConversion.toFixed(0)}%\n\nBilling Conversion = Billed ÷ Recorded × 100`,
          [{ text: 'View Billing', onPress: () => { console.log('[DashboardAnalytics] Alert CTA — navigating to billing'); router.push('/(tabs)/billing' as any); } }, { text: 'OK' }]
        );
        break;
      case 'rec_efficiency':
        console.log('[DashboardAnalytics] Showing recorded efficiency alert — efficiency:', stats.recordedEfficiency.toFixed(0) + '%');
        Alert.alert(
          'Recorded Efficiency',
          `Recorded Hours: ${stats.recordedHours.toFixed(1)}h\nAvailable Hours: ${stats.availableHours.toFixed(1)}h\nEfficiency: ${stats.recordedEfficiency.toFixed(0)}%\n\nRecorded Efficiency = Recorded ÷ Available × 100`,
          [{ text: 'View Stats', onPress: () => { console.log('[DashboardAnalytics] Alert CTA — navigating to stats'); router.push('/(tabs)/stats' as any); } }, { text: 'OK' }]
        );
        break;
      case 'billed_efficiency':
        console.log('[DashboardAnalytics] Showing billed efficiency alert — billed efficiency:', stats.billedEfficiency.toFixed(0) + '%');
        Alert.alert(
          'Billed Efficiency',
          `Billed Hours: ${stats.billedHours.toFixed(1)}h\nAvailable Hours: ${stats.availableHours.toFixed(1)}h\nBilled Efficiency: ${stats.billedEfficiency.toFixed(0)}%\nRecorded Efficiency: ${stats.recordedEfficiency.toFixed(0)}%\nGap: ${stats.efficiencyGap.toFixed(0)}%\n\nBilled Efficiency = Billed ÷ Available × 100`,
          [{ text: 'View Billing', onPress: () => { console.log('[DashboardAnalytics] Alert CTA — navigating to billing'); router.push('/(tabs)/billing' as any); } }, { text: 'OK' }]
        );
        break;
      case 'closure':
        console.log('[DashboardAnalytics] Showing closure rate alert — rate:', stats.closureRate.toFixed(0) + '%');
        Alert.alert(
          'Job Closure Rate',
          `Total Jobs: ${stats.jobsRecorded}\nBilled Jobs: ${stats.jobsBilled}\nOpen Jobs: ${stats.jobsOpen}\nClosure Rate: ${stats.closureRate.toFixed(0)}%\n\nClosure Rate = Billed Jobs ÷ Total Jobs × 100`,
          [{ text: 'View Billing', onPress: () => { console.log('[DashboardAnalytics] Alert CTA — navigating to billing'); router.push('/(tabs)/billing' as any); } }, { text: 'OK' }]
        );
        break;
      case 'potential':
        console.log('[DashboardAnalytics] Showing potential on closure alert — potential hours:', stats.potentialBilledHours.toFixed(1) + 'h');
        Alert.alert(
          'Potential on Closure',
          `Current Billed: ${stats.billedHours.toFixed(1)}h\nOpen Hours: ${stats.openHours.toFixed(1)}h\nPotential Total: ${stats.potentialBilledHours.toFixed(1)}h\nPotential Efficiency: ${stats.potentialBilledEfficiency.toFixed(0)}%\n\nIf all open jobs were billed today.`,
          [{ text: 'View Open Jobs', onPress: () => { console.log('[DashboardAnalytics] Alert CTA — navigating to billing (open jobs)'); router.push('/(tabs)/billing' as any); } }, { text: 'OK' }]
        );
        break;
      case 'data_health':
        console.log('[DashboardAnalytics] Navigating to data-quality screen');
        router.push('/data-quality' as any);
        break;
      case 'reconciliation':
        console.log('[DashboardAnalytics] Navigating to reconciliation screen');
        router.push('/reconciliation' as any);
        break;
      case 'vhc':
        console.log('[DashboardAnalytics] Navigating to vhc-intelligence screen');
        router.push('/vhc-intelligence' as any);
        break;
    }
  }, [stats]);

  // ─── RENDER SECTIONS ───────────────────────────────────────────────────────

  const billingConversionColor = stats.billingConversion >= 80
    ? theme.chartGreen
    : stats.billingConversion >= 50
      ? theme.chartYellow
      : theme.chartRed;

  const billingConversionProgress = stats.billingConversion / 100;

  const recEfficiencyColor = stats.recordedEfficiency >= 100
    ? theme.chartGreen
    : stats.recordedEfficiency >= 80
      ? theme.chartYellow
      : theme.chartRed;

  const billedEfficiencyColor = stats.billedEfficiency >= 100
    ? theme.chartGreen
    : stats.billedEfficiency >= 80
      ? theme.chartYellow
      : theme.chartRed;

  const billingGapColor = stats.billingGap > 5
    ? theme.chartRed
    : stats.billingGap > 0
      ? theme.chartYellow
      : theme.chartGreen;

  const billingGapSubValue = stats.billingGap > 0 ? 'unbilled' : 'clear';

  const closureRateColor = stats.closureRate >= 80
    ? theme.chartGreen
    : stats.closureRate >= 50
      ? theme.chartYellow
      : theme.chartRed;

  const jobsOpenColor = stats.jobsOpen > 0 ? theme.chartRed : theme.chartGreen;

  const reconciliationBalanced = Math.abs(stats.billingGap - stats.openHours) < 0.1;
  const reconciliationValue = reconciliationBalanced ? '✓' : '!';
  const reconciliationSubValue = reconciliationBalanced ? 'Balanced' : 'Check';
  const reconciliationColor = reconciliationBalanced ? theme.chartGreen : theme.chartYellow;

  const openJobsStatusText = stats.jobsOpen > 0
    ? `${stats.jobsOpen} open job${stats.jobsOpen !== 1 ? 's' : ''} · ${stats.openHours.toFixed(1)}h currently unbilled`
    : 'All jobs billed ✓';
  const openJobsStatusColor = stats.jobsOpen > 0 ? theme.chartYellow : theme.chartGreen;

  const efficiencyGapText = `Efficiency gap: ${stats.efficiencyGap.toFixed(0)}% · Avg ${stats.avgHoursPerJob.toFixed(1)}h/job`;
  const jobsSummaryText = `Avg ${stats.avgBilledHoursPerJob.toFixed(1)}h billed/job · ${stats.jobsBilled}/${stats.jobsRecorded} closed`;
  const reconciliationStatusText = reconciliationBalanced
    ? 'Recorded = Billed + Open ✓'
    : `Reconciliation gap: ${Math.abs(stats.billingGap - stats.openHours).toFixed(1)}h`;

  const renderBillingSection = () => (
    <View style={styles.sectionContent}>
      <View style={styles.circlesGrid}>
        <CircleCard
          label="Recorded Hours"
          value={`${stats.recordedHours.toFixed(1)}h`}
          color={theme.primary}
          progress={Math.min(1, stats.recordedHours / 20)}
          onPress={() => handleCircleTap('recorded')}
        />
        <CircleCard
          label="Billed Hours"
          value={`${stats.billedHours.toFixed(1)}h`}
          color={theme.chartGreen}
          progress={stats.recordedHours > 0 ? stats.billedHours / stats.recordedHours : 0}
          onPress={() => handleCircleTap('billed')}
        />
        <CircleCard
          label="Open Hours"
          value={`${stats.openHours.toFixed(1)}h`}
          color={theme.chartRed}
          progress={stats.recordedHours > 0 ? stats.openHours / stats.recordedHours : 0}
          onPress={() => handleCircleTap('open')}
        />
        <CircleCard
          label="Billing Conversion"
          value={`${stats.billingConversion.toFixed(0)}%`}
          color={billingConversionColor}
          progress={billingConversionProgress}
          onPress={() => handleCircleTap('conversion')}
        />
      </View>
      <View style={[styles.quickStatus, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => {
          console.log('[DashboardAnalytics] Quick status pressed — navigating to billing tab');
          router.push('/(tabs)/billing' as any);
        }}>
          <Text style={[styles.quickStatusText, { color: openJobsStatusColor }]}>
            {openJobsStatusText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPerformanceSection = () => (
    <View style={styles.sectionContent}>
      <View style={styles.circlesGrid}>
        <CircleCard
          label="Recorded Efficiency"
          value={`${stats.recordedEfficiency.toFixed(0)}%`}
          color={recEfficiencyColor}
          progress={Math.min(1, stats.recordedEfficiency / 120)}
          onPress={() => handleCircleTap('rec_efficiency')}
        />
        <CircleCard
          label="Billed Efficiency"
          value={`${stats.billedEfficiency.toFixed(0)}%`}
          color={billedEfficiencyColor}
          progress={Math.min(1, stats.billedEfficiency / 120)}
          onPress={() => handleCircleTap('billed_efficiency')}
        />
        <CircleCard
          label="Billing Gap"
          value={`${stats.billingGap.toFixed(1)}h`}
          subValue={billingGapSubValue}
          color={billingGapColor}
          progress={stats.recordedHours > 0 ? Math.min(1, stats.billingGap / stats.recordedHours) : 0}
          onPress={() => handleCircleTap('open')}
        />
        <CircleCard
          label="Potential Efficiency"
          value={`${stats.potentialBilledEfficiency.toFixed(0)}%`}
          subValue="if all billed"
          color={theme.primary}
          progress={Math.min(1, stats.potentialBilledEfficiency / 120)}
          onPress={() => handleCircleTap('potential')}
        />
      </View>
      <View style={[styles.quickStatus, { backgroundColor: theme.background }]}>
        <Text style={[styles.quickStatusText, { color: theme.textSecondary }]}>
          {efficiencyGapText}
        </Text>
      </View>
    </View>
  );

  const renderJobsSection = () => (
    <View style={styles.sectionContent}>
      <View style={styles.circlesGrid}>
        <CircleCard
          label="Jobs Worked"
          value={String(stats.jobsRecorded)}
          color={theme.primary}
          progress={1}
          onPress={() => {
            console.log('[DashboardAnalytics] Jobs Worked circle pressed — navigating to jobs tab');
            router.push('/(tabs)/jobs' as any);
          }}
        />
        <CircleCard
          label="Jobs Billed"
          value={String(stats.jobsBilled)}
          color={theme.chartGreen}
          progress={stats.jobsRecorded > 0 ? stats.jobsBilled / stats.jobsRecorded : 0}
          onPress={() => handleCircleTap('billed')}
        />
        <CircleCard
          label="Jobs Open"
          value={String(stats.jobsOpen)}
          color={jobsOpenColor}
          progress={stats.jobsRecorded > 0 ? stats.jobsOpen / stats.jobsRecorded : 0}
          onPress={() => handleCircleTap('open')}
        />
        <CircleCard
          label="Closure Rate"
          value={`${stats.closureRate.toFixed(0)}%`}
          color={closureRateColor}
          progress={stats.closureRate / 100}
          onPress={() => handleCircleTap('closure')}
        />
      </View>
      <View style={[styles.quickStatus, { backgroundColor: theme.background }]}>
        <Text style={[styles.quickStatusText, { color: theme.textSecondary }]}>
          {jobsSummaryText}
        </Text>
      </View>
    </View>
  );

  const renderInsightsSection = () => (
    <View style={styles.sectionContent}>
      <View style={styles.circlesGrid}>
        <CircleCard
          label="Data Health"
          value="Scan"
          color={theme.primary}
          progress={0}
          onPress={() => handleCircleTap('data_health')}
        />
        <CircleCard
          label="Reconciliation"
          value={reconciliationValue}
          subValue={reconciliationSubValue}
          color={reconciliationColor}
          progress={0}
          onPress={() => handleCircleTap('reconciliation')}
        />
        <CircleCard
          label="VHC Intelligence"
          value="View"
          color={theme.chartGreen}
          progress={0}
          onPress={() => handleCircleTap('vhc')}
        />
        <CircleCard
          label="Potential Billed"
          value={`${stats.potentialBilledHours.toFixed(1)}h`}
          subValue="if all closed"
          color={theme.primary}
          progress={stats.recordedHours > 0 ? Math.min(1, stats.potentialBilledHours / stats.recordedHours) : 0}
          onPress={() => handleCircleTap('potential')}
        />
      </View>
      <View style={[styles.quickStatus, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => {
          console.log('[DashboardAnalytics] Reconciliation status pressed — navigating to reconciliation screen');
          router.push('/reconciliation' as any);
        }}>
          <Text style={[styles.quickStatusText, { color: theme.textSecondary }]}>
            {reconciliationStatusText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Analytics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
          {(['day', 'month', 'year', 'entire'] as AnalyticsPeriod[]).map(p => {
            const isActive = period === p;
            const btnBg = isActive ? theme.primary : 'transparent';
            const btnTextColor = isActive ? '#fff' : theme.textSecondary;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, { backgroundColor: btnBg }]}
                onPress={() => {
                  console.log('[DashboardAnalytics] Period selector pressed — period:', p);
                  setPeriod(p);
                  safeHaptics.selectionAsync();
                }}
              >
                <Text style={[styles.periodBtnText, { color: btnTextColor }]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Section tabs */}
      <View style={[styles.sectionTabs, { borderBottomColor: theme.border }]}>
        {sections.map(s => {
          const isActive = activeSection === s.key;
          const tabBorderColor = isActive ? theme.primary : 'transparent';
          const tabTextColor = isActive ? theme.primary : theme.textSecondary;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.sectionTab, { borderBottomColor: tabBorderColor, borderBottomWidth: 2.5 }]}
              onPress={() => {
                console.log('[DashboardAnalytics] Section tab pressed — section:', s.key);
                setActiveSection(s.key);
                safeHaptics.selectionAsync();
              }}
            >
              <Text style={[styles.sectionTabText, { color: tabTextColor }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section content */}
      {activeSection === 'billing' && renderBillingSection()}
      {activeSection === 'performance' && renderPerformanceSection()}
      {activeSection === 'jobs' && renderJobsSection()}
      {activeSection === 'insights' && renderInsightsSection()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  periodRow: {
    gap: 6,
    paddingRight: 4,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionTabs: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  sectionTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionContent: {
    paddingBottom: 16,
  },
  circlesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
    justifyContent: 'space-around',
  },
  circleCard: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 12,
    width: 90,
  },
  circleRing: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circleProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  circleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleValue: {
    fontWeight: '700',
    textAlign: 'center',
  },
  circleSubValue: {
    fontSize: 9,
    textAlign: 'center',
  },
  circleLabel: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  quickStatus: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickStatusText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
