
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
import { JobStats } from '@/types/Job';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { api } from '@/utils/api';

export default function DashboardScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [todayStats, setTodayStats] = useState<JobStats>({ jobCount: 0, totalAw: 0, totalMinutes: 0, averageAw: 0 });
  const [weekStats, setWeekStats] = useState<JobStats>({ jobCount: 0, totalAw: 0, totalMinutes: 0, averageAw: 0 });
  const [monthStats, setMonthStats] = useState<JobStats>({ jobCount: 0, totalAw: 0, totalMinutes: 0, averageAw: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('DashboardScreen: Loading dashboard data');
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('DashboardScreen: Fetching stats from API');
      const [today, week, month] = await Promise.all([
        api.getTodayStats(),
        api.getWeekStats(),
        api.getMonthStats(),
      ]);

      setTodayStats({
        jobCount: today.jobCount,
        totalAw: today.totalAw,
        totalMinutes: today.totalMinutes,
        totalHours: today.totalMinutes / 60,
        averageAw: today.averageAw,
      });

      setWeekStats({
        jobCount: week.jobCount,
        totalAw: week.totalAw,
        totalMinutes: week.totalMinutes,
        totalHours: week.totalMinutes / 60,
        averageAw: week.averageAw,
      });

      setMonthStats({
        jobCount: month.jobCount,
        totalAw: month.totalAw,
        totalMinutes: month.totalMinutes,
        totalHours: month.totalMinutes / 60,
        averageAw: month.averageAw,
      });

      console.log('DashboardScreen: Stats loaded successfully');
    } catch (error) {
      console.error('DashboardScreen: Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    console.log('DashboardScreen: User refreshing dashboard');
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

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
              <Text style={[styles.title, { color: '#ffffff' }]}>TechTimes</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>Dashboard</Text>
            </View>
            <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
              <IconSymbol
                ios_icon_name="wrench.and.screwdriver.fill"
                android_material_icon_name="build"
                size={32}
                color="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Today</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{todayStats.jobCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{todayStats.totalAw}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AW</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {formatTime(todayStats.totalMinutes)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {todayStats.averageAw.toFixed(1)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg AW</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="calendar.badge.clock"
                android_material_icon_name="date-range"
                size={24}
                color={theme.secondary}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>This Week</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.secondary }]}>{weekStats.jobCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.secondary }]}>{weekStats.totalAw}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AW</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.secondary }]}>
                  {formatDecimalHours(weekStats.totalMinutes)}h
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hours</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="calendar.badge.plus"
                android_material_icon_name="event"
                size={24}
                color={theme.accent}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>This Month</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.accent }]}>{monthStats.jobCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.accent }]}>{monthStats.totalAw}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AW</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={[styles.statValue, { color: theme.accent }]}>
                  {formatDecimalHours(monthStats.totalMinutes)}h
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hours</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('DashboardScreen: User tapped Add Job button');
                router.push('/(tabs)/add-job');
              }}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={24}
                color="#ffffff"
              />
              <Text style={styles.actionButtonText}>Add Job</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.secondary }]}
              onPress={() => {
                console.log('DashboardScreen: User tapped View Jobs button');
                router.push('/(tabs)/jobs');
              }}
            >
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={24}
                color="#ffffff"
              />
              <Text style={styles.actionButtonText}>View Jobs</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.statsButton, { backgroundColor: theme.accent }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Performance Stats button');
              router.push('/(tabs)/stats');
            }}
          >
            <IconSymbol
              ios_icon_name="chart.pie.fill"
              android_material_icon_name="pie-chart"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.statsButtonText}>View Performance Stats</Text>
          </TouchableOpacity>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statColumn: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  statsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
