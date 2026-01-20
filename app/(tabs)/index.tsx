
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
  Platform,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { api } from '@/utils/api';
import CircularProgress from '@/components/CircularProgress';

export default function DashboardScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [technicianName, setTechnicianName] = useState('Buckston Rugge');
  
  // Monthly stats
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [todayStats, setTodayStats] = useState<any>(null);
  const [weekStats, setWeekStats] = useState<any>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      console.log('DashboardScreen: Fetching stats from API');
      const currentMonth = getCurrentMonth();
      const [monthly, today, week, profile] = await Promise.all([
        api.getMonthlyStats(currentMonth),
        api.getTodayStats(),
        api.getWeekStats(),
        api.getTechnicianProfile().catch(() => ({ name: 'Buckston Rugge' })),
      ]);

      setMonthlyStats(monthly);
      setTodayStats(today);
      setWeekStats(week);
      setTechnicianName(profile.name);
      console.log('DashboardScreen: Stats loaded successfully');
    } catch (error) {
      console.error('DashboardScreen: Error loading dashboard data:', error);
    }
  }, []);

  useEffect(() => {
    console.log('DashboardScreen: Loading dashboard data');
    loadDashboardData();
    
    // Update timer every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, [loadDashboardData]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    console.log('DashboardScreen: User refreshing dashboard');
    setRefreshing(true);
    await loadDashboardData();
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

  const formatTimer = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (!monthlyStats || !todayStats || !weekStats) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const targetProgress = (monthlyStats.soldHours / monthlyStats.targetHours) * 100;
  const efficiencyColor = getEfficiencyColor(monthlyStats.efficiency);
  const efficiencyLabel = getEfficiencyLabel(monthlyStats.efficiency);

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200' }}
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
            <View>
              <Text style={[styles.headerSubtitle, { color: '#cccccc' }]}>Technician Records</Text>
              <Text style={[styles.headerTitle, { color: '#ffffff' }]}>{technicianName}</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.primary }]}>
                <IconSymbol
                  ios_icon_name="gear.fill"
                  android_material_icon_name="settings"
                  size={24}
                  color="#ffffff"
                />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.card }]}>
                <IconSymbol
                  ios_icon_name="ellipsis"
                  android_material_icon_name="more-vert"
                  size={24}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Timer Card */}
          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.timerText, { color: theme.primary }]}>
              {formatTimer(currentTime)}
            </Text>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {formatDate(currentTime)}
            </Text>
          </View>

          {/* Progress Rings */}
          <View style={styles.ringsContainer}>
            <View style={styles.ringWrapper}>
              <CircularProgress
                size={140}
                strokeWidth={10}
                progress={targetProgress}
                color={theme.primary}
                title="Monthly Target"
                value={`${targetProgress.toFixed(1)}%`}
                subtitle={`${monthlyStats.soldHours.toFixed(1)}h / ${monthlyStats.targetHours.toFixed(1)}h`}
                onPress={() => {
                  console.log('DashboardScreen: User tapped Target ring');
                  router.push(`/target-details?month=${getCurrentMonth()}`);
                }}
              />
              <Text style={[styles.ringLabel, { color: theme.textSecondary }]}>
                {targetProgress.toFixed(0)}% Complete
              </Text>
            </View>

            <View style={styles.ringWrapper}>
              <CircularProgress
                size={140}
                strokeWidth={10}
                progress={monthlyStats.efficiency}
                color={efficiencyColor}
                title="Efficiency"
                value={`${monthlyStats.efficiency.toFixed(0)}%`}
                subtitle={efficiencyLabel}
                onPress={() => {
                  console.log('DashboardScreen: User tapped Efficiency ring');
                  router.push(`/efficiency-details?month=${getCurrentMonth()}`);
                }}
              />
              <Text style={[styles.ringLabel, { color: efficiencyColor }]}>
                {efficiencyLabel}
              </Text>
              <Text style={[styles.ringSubLabel, { color: theme.textSecondary }]}>
                {monthlyStats.availableHours.toFixed(1)}h available
              </Text>
            </View>
          </View>

          {/* Monthly Breakdown */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Breakdown</Text>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total AW:</Text>
              <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.totalAw}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Sold Hours:</Text>
              <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.soldHours.toFixed(2)}h</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Monthly Target Hours:</Text>
              <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.targetHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Available Hours:</Text>
              <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.availableHours.toFixed(2)}h</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownHighlight]}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Efficiency:</Text>
              <Text style={[styles.breakdownValue, { color: efficiencyColor, fontWeight: 'bold' }]}>
                {monthlyStats.efficiency.toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* Stat Tiles */}
          <View style={styles.statsGrid}>
            <View style={[styles.statTile, { backgroundColor: theme.card }]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalAw}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total AWs</Text>
              <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: theme.card }]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {formatTime(monthlyStats.totalAw * 5)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time Logged</Text>
              <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: theme.card }]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalJobs}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</Text>
              <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: theme.card }]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {monthlyStats.remainingHours.toFixed(1)}h
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hours Remaining</Text>
              <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>To Target</Text>
            </View>
          </View>

          {/* Today Card */}
          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.periodTitle, { color: theme.text }]}>Today</Text>
            <Text style={[styles.periodSubtitle, { color: theme.textSecondary }]}>
              {todayStats.jobCount} jobs • {todayStats.totalAw} AWs
            </Text>
            <Text style={[styles.periodTime, { color: theme.primary }]}>
              {formatTime(todayStats.totalMinutes)}
            </Text>
          </View>

          {/* This Week Card */}
          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.periodTitle, { color: theme.text }]}>This Week</Text>
            <Text style={[styles.periodSubtitle, { color: theme.textSecondary }]}>
              {weekStats.jobCount} jobs • {weekStats.totalAw} AWs
            </Text>
            <Text style={[styles.periodTime, { color: theme.primary }]}>
              {formatTime(weekStats.totalMinutes)}
            </Text>
          </View>

          {/* Add New Job Button */}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Add New Job button');
              router.push('/(tabs)/add-job');
            }}
          >
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.addButtonText}>Add New Job</Text>
          </TouchableOpacity>

          {/* Bottom Buttons */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={[styles.bottomButton, { backgroundColor: theme.card }]}
              onPress={() => {
                console.log('DashboardScreen: User tapped Job Records button');
                router.push('/(tabs)/jobs');
              }}
            >
              <Text style={[styles.bottomButtonText, { color: theme.text }]}>Job Records</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomButton, { backgroundColor: theme.card }]}
              onPress={() => {
                console.log('DashboardScreen: User tapped Statistics button');
                router.push('/(tabs)/stats');
              }}
            >
              <Text style={[styles.bottomButtonText, { color: theme.text }]}>Statistics</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  dateText: {
    fontSize: 14,
    marginTop: 8,
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ringLabel: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  ringSubLabel: {
    fontSize: 11,
    marginTop: 2,
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
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownHighlight: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    paddingTop: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statSubLabel: {
    fontSize: 10,
  },
  periodCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  periodSubtitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  periodTime: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bottomButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
