
import React, { useState, useEffect, useCallback } from 'react';
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
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { api } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';

export default function StatsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [todayStats, setTodayStats] = useState<any>(null);
  const [weekStats, setWeekStats] = useState<any>(null);
  const [allTimeStats, setAllTimeStats] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [schedule, setSchedule] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay()); // Go back to Sunday
    return sunday;
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDayStats, setSelectedDayStats] = useState<any>(null);
  const [selectedWeekStats, setSelectedWeekStats] = useState<any>(null);
  const [selectedMonthStats, setSelectedMonthStats] = useState<any>(null);

  const loadStats = useCallback(async () => {
    try {
      console.log('StatsScreen: Fetching all statistics');
      const currentMonth = getCurrentMonth();
      const [monthly, today, week, allTime, jobs, sched] = await Promise.all([
        api.getMonthlyStats(currentMonth),
        api.getTodayStats(),
        api.getWeekStats(),
        api.getAllTimeStats(),
        api.getRecentJobs(10),
        api.getSchedule(),
      ]);

      setMonthlyStats(monthly);
      setTodayStats(today);
      setWeekStats(week);
      setAllTimeStats(allTime);
      setRecentJobs(jobs);
      setSchedule(sched);
      console.log('StatsScreen: Stats loaded successfully');
    } catch (error) {
      console.error('StatsScreen: Error loading stats:', error);
    }
  }, []);

  const loadDayStats = useCallback(async (date: Date) => {
    try {
      console.log('StatsScreen: Loading stats for day:', date.toLocaleDateString());
      const dateStr = date.toISOString().split('T')[0];
      const jobs = await api.getJobsInRange(dateStr, dateStr);
      
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      
      setSelectedDayStats({
        jobCount: jobs.length,
        totalAw,
        totalMinutes,
        totalHours: totalMinutes / 60,
      });
    } catch (error) {
      console.error('StatsScreen: Error loading day stats:', error);
    }
  }, []);

  const loadWeekStats = useCallback(async (weekStart: Date) => {
    try {
      console.log('StatsScreen: Loading stats for week starting (Sunday):', weekStart.toLocaleDateString());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Saturday is 6 days after Sunday
      
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      const jobs = await api.getJobsInRange(startStr, endStr);
      
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      
      setSelectedWeekStats({
        jobCount: jobs.length,
        totalAw,
        totalMinutes,
        totalHours: totalMinutes / 60,
      });
    } catch (error) {
      console.error('StatsScreen: Error loading week stats:', error);
    }
  }, []);

  const loadMonthStats = useCallback(async (month: Date) => {
    try {
      console.log('StatsScreen: Loading stats for month:', month.toLocaleDateString());
      const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const jobs = await api.getJobsForMonth(monthStr);
      
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      
      setSelectedMonthStats({
        jobCount: jobs.length,
        totalAw,
        totalMinutes,
        totalHours: totalMinutes / 60,
      });
    } catch (error) {
      console.error('StatsScreen: Error loading month stats:', error);
    }
  }, []);

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
    loadDayStats(newDate);
    console.log('StatsScreen: Navigating to day:', newDate.toLocaleDateString());
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeekStart(newDate);
    loadWeekStats(newDate);
    console.log('StatsScreen: Navigating to week starting:', newDate.toLocaleDateString());
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newDate);
    loadMonthStats(newDate);
    console.log('StatsScreen: Navigating to month:', newDate.toLocaleDateString());
  };

  useEffect(() => {
    console.log('StatsScreen: Loading statistics');
    loadStats();
    loadDayStats(selectedDate);
    loadWeekStats(selectedWeekStart);
    loadMonthStats(selectedMonth);
    
    // Update time every second for live timers and reload stats every 30 seconds for live updates
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    const statsRefresh = setInterval(() => {
      console.log('StatsScreen: Auto-refreshing stats for live updates');
      loadStats();
      loadDayStats(selectedDate);
      loadWeekStats(selectedWeekStart);
      loadMonthStats(selectedMonth);
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(timer);
      clearInterval(statsRefresh);
    };
  }, [loadStats, loadDayStats, loadWeekStats, loadMonthStats, selectedDate, selectedWeekStart, selectedMonth]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    console.log('StatsScreen: User refreshing stats');
    setRefreshing(true);
    await loadStats();
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

  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Calculate time elapsed today (from start time to now)
  const calculateTimeElapsed = (): string => {
    if (!schedule) return '00:00:00';
    
    const now = currentTime;
    const [startHour, startMin] = (schedule.startTime || '08:00').split(':').map(Number);
    const startOfDay = new Date(now);
    startOfDay.setHours(startHour, startMin, 0, 0);
    
    if (now < startOfDay) return '00:00:00';
    
    const elapsed = now.getTime() - startOfDay.getTime();
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate time remaining today (from now to end time)
  const calculateTimeRemaining = (): string => {
    if (!schedule) return '00:00:00';
    
    const now = currentTime;
    const [endHour, endMin] = (schedule.endTime || '17:00').split(':').map(Number);
    const endOfDay = new Date(now);
    endOfDay.setHours(endHour, endMin, 0, 0);
    
    if (now > endOfDay) return '00:00:00';
    
    const remaining = endOfDay.getTime() - now.getTime();
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate available hours timer (cumulative from start time)
  const calculateAvailableHours = (): string => {
    if (!schedule) return '0.00';
    
    const now = currentTime;
    const [startHour, startMin] = (schedule.startTime || '08:00').split(':').map(Number);
    const [endHour, endMin] = (schedule.endTime || '17:00').split(':').map(Number);
    const lunchMinutes = schedule.lunchBreakMinutes || 30;
    
    const startOfDay = new Date(now);
    startOfDay.setHours(startHour, startMin, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(endHour, endMin, 0, 0);
    
    // If before start time, return 0
    if (now < startOfDay) return '0.00';
    
    // If after end time, return full day hours
    if (now > endOfDay) {
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin) - lunchMinutes;
      return (totalMinutes / 60).toFixed(2);
    }
    
    // Calculate elapsed minutes from start time
    const elapsedMinutes = (now.getTime() - startOfDay.getTime()) / 60000;
    const availableMinutes = Math.max(0, elapsedMinutes - lunchMinutes);
    
    return (availableMinutes / 60).toFixed(2);
  };

  if (!monthlyStats || !todayStats || !weekStats || !allTimeStats || !schedule) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading statistics...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const efficiencyColor = getEfficiencyColor(monthlyStats.efficiency);
  const efficiencyLabel = getEfficiencyLabel(monthlyStats.efficiency);

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
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
            <Text style={[styles.title, { color: '#ffffff' }]}>Time Statistics</Text>
          </View>

          {/* Live Clock */}
          <View style={[styles.clockCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.clockLabel, { color: theme.textSecondary }]}>Current Time</Text>
            <Text style={[styles.clockValue, { color: theme.primary }]}>
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
            <Text style={[styles.clockDate, { color: theme.textSecondary }]}>
              {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          {/* Live Timers Section */}
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>Live Timers</Text>

          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <View style={styles.timerRow}>
              <IconSymbol
                ios_icon_name="clock.fill"
                android_material_icon_name="access-time"
                size={32}
                color={theme.primary}
              />
              <View style={styles.timerInfo}>
                <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Available Hours Today</Text>
                <Text style={[styles.timerValue, { color: theme.primary }]}>
                  {calculateAvailableHours()}h
                </Text>
                <Text style={[styles.timerSubtext, { color: theme.textSecondary }]}>
                  Counting from {schedule.startTime || '08:00'} to {schedule.endTime || '17:00'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <View style={styles.timerRow}>
              <IconSymbol
                ios_icon_name="arrow.up.circle.fill"
                android_material_icon_name="arrow-upward"
                size={32}
                color={theme.chartGreen}
              />
              <View style={styles.timerInfo}>
                <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Time Elapsed Today</Text>
                <Text style={[styles.timerValue, { color: theme.chartGreen }]}>
                  {calculateTimeElapsed()}
                </Text>
                <Text style={[styles.timerSubtext, { color: theme.textSecondary }]}>
                  Since {schedule.startTime || '08:00'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
            <View style={styles.timerRow}>
              <IconSymbol
                ios_icon_name="arrow.down.circle.fill"
                android_material_icon_name="arrow-downward"
                size={32}
                color={theme.chartYellow}
              />
              <View style={styles.timerInfo}>
                <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Time Remaining Today</Text>
                <Text style={[styles.timerValue, { color: theme.chartYellow }]}>
                  {calculateTimeRemaining()}
                </Text>
                <Text style={[styles.timerSubtext, { color: theme.textSecondary }]}>
                  Until {schedule.endTime || '17:00'}
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly Efficiency Card */}
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>Monthly Performance</Text>

          <View style={[styles.efficiencyCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.efficiencyPercent, { color: efficiencyColor }]}>
              {monthlyStats.efficiency.toFixed(0)}%
            </Text>
            <Text style={[styles.efficiencyLabel, { color: efficiencyColor }]}>
              {efficiencyLabel}
            </Text>
            
            <View style={styles.efficiencyDetails}>
              <View style={styles.efficiencyRow}>
                <Text style={[styles.efficiencyDetailLabel, { color: theme.textSecondary }]}>Total AW:</Text>
                <Text style={[styles.efficiencyDetailValue, { color: theme.text }]}>{monthlyStats.totalAw}</Text>
              </View>
              <View style={styles.efficiencyRow}>
                <Text style={[styles.efficiencyDetailLabel, { color: theme.textSecondary }]}>Sold Hours:</Text>
                <Text style={[styles.efficiencyDetailValue, { color: theme.text }]}>{monthlyStats.soldHours.toFixed(2)}h</Text>
              </View>
              <View style={styles.efficiencyRow}>
                <Text style={[styles.efficiencyDetailLabel, { color: theme.textSecondary }]}>Available Hours:</Text>
                <Text style={[styles.efficiencyDetailValue, { color: theme.text }]}>{monthlyStats.availableHours.toFixed(2)}h</Text>
              </View>
              <View style={styles.efficiencyRow}>
                <Text style={[styles.efficiencyDetailLabel, { color: theme.textSecondary }]}>Remaining Hours:</Text>
                <Text style={[styles.efficiencyDetailValue, { color: theme.text }]}>{monthlyStats.remainingHours.toFixed(1)}h</Text>
              </View>
            </View>
          </View>

          {/* Period Statistics */}
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>Period Statistics</Text>

          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <View style={styles.periodHeader}>
              <TouchableOpacity onPress={() => navigateDay('prev')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
              <View style={styles.periodTitleContainer}>
                <Text style={[styles.periodTitle, { color: theme.text }]}>
                  {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigateDay('next')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
            {selectedDayStats && (
              <View style={styles.periodStats}>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Jobs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedDayStats.jobCount}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>AWs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedDayStats.totalAw}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Hours</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>
                    {selectedDayStats.totalHours.toFixed(2)}h
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <View style={styles.periodHeader}>
              <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
              <View style={styles.periodTitleContainer}>
                <Text style={[styles.periodTitle, { color: theme.text }]}>
                  Week {getWeekNumber(selectedWeekStart)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
            {selectedWeekStats && (
              <View style={styles.periodStats}>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Jobs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedWeekStats.jobCount}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>AWs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedWeekStats.totalAw}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Hours</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>
                    {selectedWeekStats.totalHours.toFixed(2)}h
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <View style={styles.periodHeader}>
              <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
              <View style={styles.periodTitleContainer}>
                <Text style={[styles.periodTitle, { color: theme.text }]}>
                  {selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
            {selectedMonthStats && (
              <View style={styles.periodStats}>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Jobs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedMonthStats.jobCount}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>AWs</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>{selectedMonthStats.totalAw}</Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Hours</Text>
                  <Text style={[styles.periodStatValue, { color: theme.primary }]}>
                    {selectedMonthStats.totalHours.toFixed(2)}h
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* All Time Stats */}
          <View style={[styles.allTimeCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.allTimeTitle, { color: theme.text }]}>All Time</Text>
            <View style={styles.allTimeStats}>
              <View style={styles.allTimeStat}>
                <Text style={[styles.allTimeValue, { color: theme.primary }]}>{allTimeStats.totalJobs}</Text>
                <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Total Jobs</Text>
              </View>
              <View style={styles.allTimeStat}>
                <Text style={[styles.allTimeValue, { color: theme.primary }]}>{allTimeStats.totalAw}</Text>
                <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Total AWs</Text>
              </View>
              <View style={styles.allTimeStat}>
                <Text style={[styles.allTimeValue, { color: theme.primary }]}>
                  {allTimeStats.totalHours.toFixed(1)}h
                </Text>
                <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Total Hours</Text>
              </View>
            </View>
          </View>

          {/* Recent Jobs */}
          <View style={[styles.recentJobsCard, { backgroundColor: theme.card }]}>
            <View style={styles.recentJobsHeader}>
              <Text style={[styles.recentJobsTitle, { color: theme.text }]}>Recent Jobs</Text>
              <TouchableOpacity>
                <Text style={[styles.selectJobsText, { color: theme.primary }]}>Select Jobs</Text>
              </TouchableOpacity>
            </View>
            
            {recentJobs.map((job, index) => (
              <View key={job.id} style={[styles.recentJobRow, index < recentJobs.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <View style={styles.recentJobInfo}>
                  <Text style={[styles.recentJobWip, { color: theme.text }]}>WIP: {job.wipNumber}</Text>
                  <Text style={[styles.recentJobReg, { color: theme.textSecondary }]}>{job.vehicleReg}</Text>
                  <Text style={[styles.recentJobDate, { color: theme.textSecondary }]}>
                    {new Date(job.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(job.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.recentJobStats}>
                  <Text style={[styles.recentJobAw, { color: theme.primary }]}>{job.aw} AWs</Text>
                  <Text style={[styles.recentJobTime, { color: theme.textSecondary }]}>
                    {formatTime(job.aw * 5)}
                  </Text>
                </View>
              </View>
            ))}
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
  clockCard: {
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
  clockLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  clockValue: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  clockDate: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  timerCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timerInfo: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  timerSubtext: {
    fontSize: 12,
  },
  efficiencyCard: {
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
  efficiencyPercent: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  efficiencyLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  efficiencyDetails: {
    width: '100%',
    gap: 8,
  },
  efficiencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  efficiencyDetailLabel: {
    fontSize: 14,
  },
  efficiencyDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  periodTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  navButton: {
    padding: 8,
  },
  periodStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  periodStat: {
    alignItems: 'center',
  },
  periodStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  periodStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  allTimeCard: {
    padding: 20,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  allTimeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  allTimeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  allTimeStat: {
    alignItems: 'center',
  },
  allTimeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  allTimeLabel: {
    fontSize: 12,
  },
  recentJobsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recentJobsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentJobsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  selectJobsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  recentJobInfo: {
    flex: 1,
  },
  recentJobWip: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  recentJobReg: {
    fontSize: 12,
    marginBottom: 2,
  },
  recentJobDate: {
    fontSize: 11,
  },
  recentJobStats: {
    alignItems: 'flex-end',
  },
  recentJobAw: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recentJobTime: {
    fontSize: 12,
  },
});
