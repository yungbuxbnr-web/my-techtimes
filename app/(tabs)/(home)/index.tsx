
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
import CircularProgress from '@/components/CircularProgress';
import AppBackground from '@/components/AppBackground';

export default function HomeScreen() {
  const { theme } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [technicianName, setTechnicianName] = useState('Technician');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workSchedule, setWorkSchedule] = useState({ startTime: '07:00', endTime: '18:00', dailyWorkingHours: 8.5 });
  const [liveAvailableHours, setLiveAvailableHours] = useState(0);

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
      });
    } catch (error) {
      console.error('HomeScreen: Error loading schedule:', error);
    }
  }, []);

  const calculateLiveAvailableHours = useCallback(() => {
    const now = new Date();
    const [startHour, startMinute] = workSchedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = workSchedule.endTime.split(':').map(Number);
    
    const startTime = new Date(now);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    // Check if current time is within work hours
    if (now >= startTime && now <= endTime) {
      const elapsedMs = now.getTime() - startTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      setLiveAvailableHours(elapsedHours);
    } else if (now > endTime) {
      // Work day is over
      setLiveAvailableHours(workSchedule.dailyWorkingHours);
    } else {
      // Before work starts
      setLiveAvailableHours(0);
    }
  }, [workSchedule]);

  useEffect(() => {
    console.log('HomeScreen: Loading dashboard data');
    loadDashboard();
    loadProfile();
    loadSchedule();
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [loadDashboard, loadProfile, loadSchedule]);

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
    await loadDashboard();
    await loadProfile();
    await loadSchedule();
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
  
  const totalWorkMs = endTime.getTime() - startTime.getTime();
  const elapsedMs = now.getTime() - startTime.getTime();
  const workDayProgress = Math.max(0, Math.min(100, (elapsedMs / totalWorkMs) * 100));
  
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
                {liveAvailableHours.toFixed(2)}h / {workSchedule.dailyWorkingHours.toFixed(2)}h
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
});
