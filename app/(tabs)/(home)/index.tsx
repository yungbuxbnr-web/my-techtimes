import React, { useState, useEffect } from 'react';
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
import { api, DashboardData } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';
import CircularProgress from '@/components/CircularProgress';

export default function HomeScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [technicianName, setTechnicianName] = useState('Technician');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    console.log('HomeScreen: Loading dashboard data');
    loadDashboard();
    loadProfile();
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadDashboard = async () => {
    try {
      const currentMonth = getCurrentMonth();
      const data = await api.getDashboard(currentMonth);
      setDashboardData(data);
      console.log('HomeScreen: Dashboard data loaded:', data);
    } catch (error) {
      console.error('HomeScreen: Error loading dashboard:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
    } catch (error) {
      console.error('HomeScreen: Error loading profile:', error);
    }
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    console.log('HomeScreen: User refreshing dashboard');
    setRefreshing(true);
    await loadDashboard();
    await loadProfile();
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
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading dashboard...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const efficiencyColor = getEfficiencyColor(dashboardData.efficiency);
  const efficiencyLabel = getEfficiencyLabel(dashboardData.efficiency);
  const targetPercent = (dashboardData.soldHours / dashboardData.targetAdjusted) * 100;

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200' }}
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
          {/* Header */}
          <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
            <View>
              <Text style={[styles.title, { color: '#ffffff' }]}>Technician Records</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>{technicianName}</Text>
            </View>
          </View>

          {/* Live Timer Card */}
          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Current Time</Text>
            <Text style={[styles.timerValue, { color: theme.primary }]}>
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
            <Text style={[styles.dateValue, { color: theme.textSecondary }]}>
              {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
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
            onPress={() => router.push('/(tabs)/add-job')}
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
