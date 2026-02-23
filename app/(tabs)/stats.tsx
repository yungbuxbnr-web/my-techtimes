
import { useThemeContext } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';
import { IconSymbol } from '@/components/IconSymbol';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  efficiencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  efficiencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default function StatsScreen() {
  const { theme } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  
  // Day stats
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayStats, setDayStats] = useState({ jobs: 0, aw: 0, hours: 0 });
  
  // Week stats
  const [selectedWeekStart, setSelectedWeekStart] = useState(getWeekStart(new Date()));
  const [weekStats, setWeekStats] = useState({ jobs: 0, aw: 0, hours: 0 });
  
  // Month stats
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [monthStats, setMonthStats] = useState({
    soldHours: 0,
    targetHours: 180,
    remainingHours: 0,
    availableHours: 0,
    efficiency: 0,
    efficiencyColor: 'red' as 'green' | 'yellow' | 'red',
    totalJobs: 0,
    totalAw: 0,
  });

  // FIXED: Define loadStats function
  const loadStats = useCallback(async () => {
    try {
      console.log('Stats: Loading all stats');
      await Promise.all([loadDayStats(), loadWeekStats(), loadMonthStats()]);
    } catch (error) {
      console.error('Stats: Error loading stats:', error);
    }
  }, []);

  // FIXED: Define loadDayStats function
  const loadDayStats = useCallback(async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Stats: Loading day stats for:', dateStr);
      
      const jobs = await api.getJobsInRange(dateStr, dateStr);
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      
      setDayStats({
        jobs: jobs.length,
        aw: totalAw,
        hours: totalMinutes / 60,
      });
    } catch (error) {
      console.error('Stats: Error loading day stats:', error);
    }
  }, [selectedDate]);

  // FIXED: Define loadWeekStats function
  const loadWeekStats = useCallback(async () => {
    try {
      const weekEnd = getWeekEnd(selectedWeekStart);
      const startStr = selectedWeekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      console.log('Stats: Loading week stats from', startStr, 'to', endStr);
      
      const jobs = await api.getJobsInRange(startStr, endStr);
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      
      setWeekStats({
        jobs: jobs.length,
        aw: totalAw,
        hours: totalMinutes / 60,
      });
    } catch (error) {
      console.error('Stats: Error loading week stats:', error);
    }
  }, [selectedWeekStart]);

  // FIXED: Define loadMonthStats function
  const loadMonthStats = useCallback(async () => {
    try {
      console.log('Stats: Loading month stats for:', selectedMonth);
      const stats = await api.getMonthlyStats(selectedMonth);
      setMonthStats(stats);
    } catch (error) {
      console.error('Stats: Error loading month stats:', error);
    }
  }, [selectedMonth]);

  // FIXED: Now the dependency array is correct
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadDayStats();
  }, [loadDayStats, selectedDate]);

  useEffect(() => {
    loadWeekStats();
  }, [loadWeekStats, selectedWeekStart]);

  useEffect(() => {
    loadMonthStats();
  }, [loadMonthStats, selectedMonth]);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeekEnd(weekStart: Date): Date {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(selectedWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeekStart(newWeekStart);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return '#4CAF50';
    if (efficiency >= 75) return '#FF9800';
    return '#F44336';
  };

  const getEfficiencyLabel = (efficiency: number) => {
    if (efficiency >= 90) return 'Excellent';
    if (efficiency >= 75) return 'Good';
    return 'Needs Improvement';
  };

  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const calculateTimeElapsed = () => {
    const now = new Date();
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const daysPassed = Math.floor((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return daysPassed;
  };

  const calculateTimeRemaining = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const now = new Date();
    const currentDay = now.getDate();
    return Math.max(0, lastDay - currentDay);
  };

  const calculateAvailableHours = () => {
    return monthStats.availableHours;
  };

  return (
    <ImageBackground
      source={require('@/assets/images/c7530b94-d069-450b-8eb8-e35e3dd41e52.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Statistics</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Track your performance
          </Text>
        </View>

        {/* Day Stats */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Daily Stats
          </Text>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateDay('prev')}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="chevron-left"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateDay('next')}
            >
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>Jobs</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dayStats.jobs}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Total AW
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dayStats.aw}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Hours
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dayStats.hours.toFixed(2)}h
            </Text>
          </View>
        </View>

        {/* Week Stats */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Weekly Stats
          </Text>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateWeek('prev')}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="chevron-left"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <Text style={[styles.dateText, { color: theme.text }]}>
              Week {getWeekNumber(selectedWeekStart)}
            </Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateWeek('next')}
            >
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>Jobs</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {weekStats.jobs}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Total AW
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {weekStats.aw}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Hours
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {weekStats.hours.toFixed(2)}h
            </Text>
          </View>
        </View>

        {/* Month Stats */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Monthly Stats
          </Text>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth('prev')}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="chevron-left"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigateMonth('next')}
            >
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>Jobs</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {monthStats.totalJobs}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Total AW
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {monthStats.totalAw}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Sold Hours
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {monthStats.soldHours.toFixed(2)}h
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Target
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {monthStats.targetHours.toFixed(2)}h
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Remaining
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {monthStats.remainingHours.toFixed(2)}h
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Available Hours
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {calculateAvailableHours().toFixed(2)}h
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Efficiency
            </Text>
            <View
              style={[
                styles.efficiencyBadge,
                { backgroundColor: getEfficiencyColor(monthStats.efficiency) },
              ]}
            >
              <Text style={styles.efficiencyText}>
                {monthStats.efficiency.toFixed(1)}% -{' '}
                {getEfficiencyLabel(monthStats.efficiency)}
              </Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Days Elapsed
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {calculateTimeElapsed()}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Days Remaining
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {calculateTimeRemaining()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}
