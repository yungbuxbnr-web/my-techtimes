
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { api, DashboardData } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';
import { buildWorkScheduleInput, getNetElapsedWorkingMinutes, getWorkingProgress, getNetScheduledHours } from '@/utils/workTimeEngine';
import CircularProgress from '@/components/CircularProgress';
import AppBackground from '@/components/AppBackground';
import { billingStorage } from '@/utils/billingStorage';
import { getBillingPosition, resolvePeriodFilter, getOpenJobs } from '@/utils/billingEngine';
import { getBillingRiskForJob } from '@/utils/billingRiskEngine';

export default function HomeScreen() {
  const { theme } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [technicianName, setTechnicianName] = useState('Technician');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workSchedule, setWorkSchedule] = useState({ startTime: '07:00', endTime: '18:00', dailyWorkingHours: 8.5, lunchStartTime: '12:00', lunchEndTime: '12:30' });
  const [liveAvailableHours, setLiveAvailableHours] = useState(0);
  const [billingPos, setBillingPos] = useState({ recordedHours: 0, billedHours: 0, openHours: 0, billingConversion: 0 });
  const [attentionCount, setAttentionCount] = useState(0);
  const [attentionReasons, setAttentionReasons] = useState<string[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      const currentMonth = getCurrentMonth();
      const data = await api.getDashboard(currentMonth);
      setDashboardData(data);
      console.log('HomeScreen: Dashboard data loaded:', data);
    } catch (error) {
      console.error('HomeScreen: Error loading dashboard:', error);
    }
  }, []);

  const loadBillingPosition = useCallback(async () => {
    try {
      console.log('HomeScreen: Loading billing position for today');
      const [allJobs, allRecords] = await Promise.all([
        api.getAllJobs(),
        billingStorage.getAllRecords(),
      ]);
      const pos = getBillingPosition(allJobs, allRecords, resolvePeriodFilter('day'));
      setBillingPos({
        recordedHours: pos.recordedHours,
        billedHours: pos.billedHours,
        openHours: pos.openHours,
        billingConversion: pos.billingConversion,
      });
      console.log('HomeScreen: Billing position loaded — recorded:', pos.recordedHours.toFixed(2), 'billed:', pos.billedHours.toFixed(2), 'open:', pos.openHours.toFixed(2));

      // Billing attention
      const openJobsList = getOpenJobs(allJobs, allRecords, resolvePeriodFilter('entire'));
      const nowTs = new Date();
      const flagged = openJobsList.filter(({ job, billing }) => {
        const risk = getBillingRiskForJob(job, billing, nowTs);
        return risk.riskLevel !== 'none';
      });
      setAttentionCount(flagged.length);
      const reasons = flagged.slice(0, 3).map(({ job, billing }) => {
        const risk = getBillingRiskForJob(job, billing, nowTs);
        return risk.reasons[0] ?? '';
      }).filter(Boolean);
      setAttentionReasons(reasons);
      console.log('HomeScreen: Billing attention jobs:', flagged.length);
    } catch (error) {
      console.error('HomeScreen: Error loading billing position:', error);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
    } catch (error) {
      console.error('HomeScreen: Error loading profile:', error);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const schedule = await api.getSchedule();
      setWorkSchedule({
        startTime: schedule.startTime || '07:00',
        endTime: schedule.endTime || '18:00',
        dailyWorkingHours: schedule.dailyWorkingHours || 8.5,
        lunchStartTime: schedule.lunchStartTime || '12:00',
        lunchEndTime: schedule.lunchEndTime || '12:30',
      });
    } catch (error) {
      console.error('HomeScreen: Error loading schedule:', error);
    }
  }, []);

  const calculateLiveAvailableHours = useCallback(() => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const wsInput = buildWorkScheduleInput(workSchedule);
    const netElapsed = getNetElapsedWorkingMinutes(wsInput, nowMins);
    setLiveAvailableHours(netElapsed / 60);
  }, [workSchedule]);

  useEffect(() => {
    console.log('HomeScreen: Loading dashboard data');
    loadDashboard();
    loadProfile();
    loadSchedule();
    loadBillingPosition();
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [loadDashboard, loadProfile, loadSchedule, loadBillingPosition]);

  useEffect(() => {
    // Calculate live available hours every second
    calculateLiveAvailableHours();
  }, [currentTime, calculateLiveAvailableHours]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    console.log('HomeScreen: User refreshing dashboard');
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadProfile(), loadSchedule(), loadBillingPosition()]);
    setRefreshing(false);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 65) return theme.chartGreen;
    if (efficiency >= 31) return theme.chartYellow;
    return theme.chartRed;
  };

  const getEfficiencyLabel = (efficiency: number) => {
    if (efficiency >= 65) return 'Excellent';
    if (efficiency >= 31) return 'Good';
    return 'Poor';
  };

  if (!dashboardData) {
    return (
      <AppBackground>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading dashboard...</Text>
        </View>
      </AppBackground>
    );
  }

  const efficiencyColor = getEfficiencyColor(dashboardData.efficiency);
  const efficiencyLabel = getEfficiencyLabel(dashboardData.efficiency);
  const targetPercent = (dashboardData.soldHours / dashboardData.targetAdjusted) * 100;

  // Calculate work day progress
  const now = new Date();
  const [startHour, startMinute] = workSchedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = workSchedule.endTime.split(':').map(Number);
  
  const startTime = new Date(now);
  startTime.setHours(startHour, startMinute, 0, 0);
  
  const endTime = new Date(now);
  endTime.setHours(endHour, endMinute, 0, 0);
  
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const wsInputProgress = buildWorkScheduleInput(workSchedule);
  const workDayProgress = getWorkingProgress(wsInputProgress, nowMins) * 100;
  
  const isWorkTime = now >= startTime && now <= endTime;
  const workDayStatus = now < startTime ? 'Not Started' : now > endTime ? 'Completed' : 'In Progress';

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
          <View>
            <Text style={[styles.title, { color: '#ffffff' }]}>Technician Records</Text>
            <Text style={[styles.subtitle, { color: '#cccccc' }]}>{technicianName}</Text>
          </View>
        </View>

        {/* Live Timer Card with Progress Bar */}
        <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Current Time</Text>
          <Text style={[styles.timerValue, { color: theme.primary }]}>
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
          <Text style={[styles.dateValue, { color: theme.textSecondary }]}>
            {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          
          {/* Work Day Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Work Day Progress</Text>
              <Text style={[styles.progressStatus, { color: isWorkTime ? theme.primary : theme.textSecondary }]}>
                {workDayStatus}
              </Text>
            </View>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBarContainer, { backgroundColor: theme.background }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${workDayProgress}%`,
                      backgroundColor: isWorkTime ? theme.primary : theme.textSecondary
                    }
                  ]} 
                />
              </View>
              {/* Car doodle that rides along the bar */}
              <View style={[styles.carIndicator, { left: `${Math.min(workDayProgress, 96)}%` as any }]}>
                <Text style={styles.carEmoji}>🚗</Text>
              </View>
            </View>
            <View style={styles.progressTimes}>
              <Text style={[styles.progressTime, { color: theme.textSecondary }]}>
                {workSchedule.startTime}
              </Text>
              <Text style={[styles.progressTime, { color: theme.textSecondary }]}>
                {workSchedule.endTime}
              </Text>
            </View>
            <View style={styles.liveHoursRow}>
              <Text style={[styles.liveHoursLabel, { color: theme.textSecondary }]}>
                Available Hours Today:
              </Text>
              <Text style={[styles.liveHoursValue, { color: theme.primary }]}>
                {liveAvailableHours.toFixed(2)}h / {getNetScheduledHours(buildWorkScheduleInput(workSchedule)).toFixed(2)}h
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Rings */}
        <View style={styles.ringsContainer}>
          <View style={[styles.ringCard, { backgroundColor: theme.card }]}>
            <CircularProgress
              size={140}
              strokeWidth={12}
              progress={Math.min(targetPercent, 100)}
              color={theme.primary}
              backgroundColor={theme.background}
              title="Monthly Target"
              value={`${targetPercent.toFixed(0)}%`}
              subtitle={`${dashboardData.soldHours.toFixed(1)} / ${dashboardData.targetAdjusted.toFixed(1)}h`}
              onPress={() => router.push({ pathname: '/target-details', params: { month: getCurrentMonth() } })}
            />
          </View>

          <View style={[styles.ringCard, { backgroundColor: theme.card }]}>
            <CircularProgress
              size={140}
              strokeWidth={12}
              progress={Math.min(dashboardData.efficiency, 100)}
              color={efficiencyColor}
              backgroundColor={theme.background}
              title="Efficiency"
              value={`${dashboardData.efficiency.toFixed(0)}%`}
              subtitle={`${efficiencyLabel} • ${dashboardData.availableHours.toFixed(1)}h`}
              onPress={() => router.push({ pathname: '/efficiency-details', params: { month: getCurrentMonth() } })}
            />
          </View>
        </View>

        {/* Monthly Breakdown */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total AW:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{dashboardData.totalAw}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Sold Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{dashboardData.soldHours.toFixed(2)}h</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Monthly Target Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{dashboardData.targetHours.toFixed(0)}h</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Available Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{dashboardData.availableHours.toFixed(2)}h</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Efficiency %:</Text>
            <Text style={[styles.breakdownValue, { color: efficiencyColor }]}>{dashboardData.efficiency.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Stat Tiles */}
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={32}
              color={theme.primary}
            />
            <Text style={[styles.statValue, { color: theme.text }]}>{dashboardData.totalJobs}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total AWs</Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>this month</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="access-time"
              size={32}
              color={theme.secondary}
            />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTime(dashboardData.totalAw * 5)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time Logged</Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>this month</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={32}
              color={theme.chartGreen}
            />
            <Text style={[styles.statValue, { color: theme.text }]}>{dashboardData.totalJobs}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>this month</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="hourglass"
              android_material_icon_name="hourglass-empty"
              size={32}
              color={theme.chartYellow}
            />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dashboardData.remainingHours.toFixed(1)}h
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hours Remaining</Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>to target</Text>
          </View>
        </View>

        {/* Today Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Today</Text>
          <View style={styles.periodStats}>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>{dashboardData.today.jobs}</Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>Jobs</Text>
            </View>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>{dashboardData.today.aw}</Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>AWs</Text>
            </View>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>
                {formatTime(dashboardData.today.aw * 5)}
              </Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>Time</Text>
            </View>
          </View>
        </View>

        {/* This Week Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>This Week</Text>
          <View style={styles.periodStats}>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>{dashboardData.week.jobs}</Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>Jobs</Text>
            </View>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>{dashboardData.week.aw}</Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>AWs</Text>
            </View>
            <View style={styles.periodStat}>
              <Text style={[styles.periodValue, { color: theme.primary }]}>
                {formatTime(dashboardData.week.aw * 5)}
              </Text>
              <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>Time</Text>
            </View>
          </View>
        </View>

        {/* Billing Position — Today */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Billing Position — Today</Text>
          <View style={styles.billingRow}>
            <View style={styles.billingItem}>
              <Text style={[styles.billingValue, { color: theme.primary }]}>{billingPos.recordedHours.toFixed(1)}h</Text>
              <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Recorded</Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={[styles.billingValue, { color: theme.chartGreen }]}>{billingPos.billedHours.toFixed(1)}h</Text>
              <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Billed</Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={[styles.billingValue, { color: theme.chartYellow }]}>{billingPos.openHours.toFixed(1)}h</Text>
              <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Open</Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={[styles.billingValue, { color: theme.accent }]}>{billingPos.billingConversion.toFixed(0)}%</Text>
              <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Conversion</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              console.log('HomeScreen: Billing position card tapped — navigating to billing tab');
              router.push('/(tabs)/billing' as any);
            }}
            style={[styles.billingCta, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.billingCtaText, { color: theme.primary }]}>View Billing Details →</Text>
          </TouchableOpacity>
        </View>

        {/* Billing Attention card */}
        {attentionCount === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.attentionClearRow}>
              <IconSymbol ios_icon_name="checkmark.shield.fill" android_material_icon_name={'verified' as any} size={20} color={theme.chartGreen} />
              <Text style={[styles.attentionClearTitle, { color: theme.chartGreen }]}>Billing Clear</Text>
            </View>
            <Text style={[styles.attentionClearBody, { color: theme.textSecondary }]}>No Jobs currently need Billing attention.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.chartYellow }]}>
            <View style={styles.attentionHeaderRow}>
              <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name={'warning' as any} size={18} color={theme.chartYellow} />
              <Text style={[styles.attentionTitle, { color: theme.text }]}>Billing Attention</Text>
            </View>
            <Text style={[styles.attentionSubtitle, { color: theme.chartYellow }]}>
              {attentionCount} Job{attentionCount > 1 ? 's' : ''} Need{attentionCount === 1 ? 's' : ''} Attention
            </Text>
            {attentionReasons.map((reason, idx) => (
              <View key={idx} style={styles.attentionReasonRow}>
                <View style={[styles.attentionDot, { backgroundColor: theme.chartYellow }]} />
                <Text style={[styles.attentionReasonText, { color: theme.textSecondary }]}>{reason}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.attentionReviewBtn, { backgroundColor: theme.chartYellow + '22', borderColor: theme.chartYellow }]}
              onPress={() => {
                console.log('HomeScreen: Tapped Review Jobs button — navigating to open-job-control with billing_attention filter');
                router.push({ pathname: '/open-job-control', params: { filter: 'billing_attention' } } as any);
              }}
            >
              <Text style={[styles.attentionReviewText, { color: theme.chartYellow }]}>Review Jobs</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View Today's Summary button */}
        <TouchableOpacity
          style={[styles.summaryButton, { borderColor: theme.primary }]}
          onPress={() => {
            console.log('HomeScreen: Tapped View Today\'s Summary button');
            router.push('/end-of-day' as any);
          }}
        >
          <IconSymbol ios_icon_name="chart.bar.doc.horizontal" android_material_icon_name={'summarize' as any} size={18} color={theme.primary} />
          <Text style={[styles.summaryButtonText, { color: theme.primary }]}>View Today's Summary</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            console.log('HomeScreen: User tapped Add New Job button');
            router.push('/add-job-modal');
          }}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={24}
            color="#ffffff"
          />
          <Text style={styles.addButtonText}>Add New Job</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: theme.secondary }]}
            onPress={() => router.push('/(tabs)/jobs')}
          >
            <Text style={styles.secondaryButtonText}>Job Records</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/(tabs)/stats')}
          >
            <Text style={styles.secondaryButtonText}>Statistics</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  header: {
    marginBottom: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  timerCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  timerLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  dateValue: {
    fontSize: 14,
    marginTop: 4,
  },
  progressSection: {
    marginTop: 20,
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  carIndicator: {
    position: 'absolute',
    top: -14,
    marginLeft: -10,
  },
  carEmoji: {
    fontSize: 18,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressTime: {
    fontSize: 11,
  },
  liveHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  liveHoursLabel: {
    fontSize: 12,
  },
  liveHoursValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ringsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ringCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  periodStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  periodStat: {
    alignItems: 'center',
  },
  periodValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  periodLabel: {
    fontSize: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  billingItem: {
    alignItems: 'center',
    flex: 1,
  },
  billingValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  billingLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  billingCta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  billingCtaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  attentionClearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  attentionClearTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  attentionClearBody: {
    fontSize: 13,
  },
  attentionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  attentionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  attentionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  attentionReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  attentionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  attentionReasonText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  attentionReviewBtn: {
    marginTop: 10,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionReviewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 8,
  },
  summaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
