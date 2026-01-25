
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import AppBackground from '@/components/AppBackground';
import { useThemeContext } from '@/contexts/ThemeContext';
import { api, StreakData } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StreaksScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [weeklyTarget, setWeeklyTarget] = useState(5);

  const loadStreakData = useCallback(async () => {
    try {
      console.log('StreaksScreen: Loading streak data');
      const [streaks, settings] = await Promise.all([
        api.calculateStreaks(),
        api.getSettings(),
      ]);
      
      setStreakData(streaks);
      setWeeklyTarget(settings.weeklyStreakTarget || 5);
      
      await loadMonthlyData();
      await loadCalendarData();
      
      console.log('StreaksScreen: Streak data loaded successfully');
    } catch (error) {
      console.error('StreaksScreen: Error loading streak data:', error);
    }
  }, [selectedMonth]);

  const loadMonthlyData = async () => {
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      
      const jobs = await api.getJobsForMonth(monthStr);
      const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
      const totalMinutes = totalAw * 5;
      const avgAwPerJob = jobs.length > 0 ? totalAw / jobs.length : 0;
      
      setMonthlyStats({
        totalJobs: jobs.length,
        totalAw,
        totalMinutes,
        avgAwPerJob,
      });
    } catch (error) {
      console.error('StreaksScreen: Error loading monthly data:', error);
    }
  };

  const loadCalendarData = async () => {
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startStr = firstDay.toISOString().split('T')[0];
      const endStr = lastDay.toISOString().split('T')[0];
      
      const jobs = await api.getJobsInRange(startStr, endStr);
      
      const jobsByDay = new Map<string, any[]>();
      jobs.forEach(job => {
        const day = job.createdAt.split('T')[0];
        if (!jobsByDay.has(day)) {
          jobsByDay.set(day, []);
        }
        jobsByDay.get(day)!.push(job);
      });
      
      const days: any[] = [];
      const currentDay = new Date(firstDay);
      
      while (currentDay <= lastDay) {
        const dateStr = currentDay.toISOString().split('T')[0];
        const dayJobs = jobsByDay.get(dateStr) || [];
        const totalAw = dayJobs.reduce((sum, job) => sum + job.aw, 0);
        
        days.push({
          date: new Date(currentDay),
          dateString: dateStr,
          jobs: dayJobs,
          totalAw,
          hasJobs: dayJobs.length > 0,
        });
        
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      setCalendarDays(days);
    } catch (error) {
      console.error('StreaksScreen: Error loading calendar data:', error);
    }
  };

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  const onRefresh = async () => {
    console.log('StreaksScreen: User refreshing');
    setRefreshing(true);
    await loadStreakData();
    setRefreshing(false);
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (!streakData || !monthlyStats) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Streaks & Analytics',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </AppBackground>
    );
  }

  const currentStreakText = `${streakData.currentStreak} ${streakData.currentStreak === 1 ? 'day' : 'days'}`;
  const bestStreakText = `${streakData.bestStreak} ${streakData.bestStreak === 1 ? 'day' : 'days'}`;
  const weeklyStreakText = `${streakData.currentWeeklyStreak} ${streakData.currentWeeklyStreak === 1 ? 'week' : 'weeks'}`;
  const bestWeeklyStreakText = `${streakData.bestWeeklyStreak} ${streakData.bestWeeklyStreak === 1 ? 'week' : 'weeks'}`;

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Streaks & Analytics',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={[styles.streakCard, { backgroundColor: theme.card }]}>
          <View style={styles.streakHeader}>
            <IconSymbol
              ios_icon_name="flame.fill"
              android_material_icon_name="local-fire-department"
              size={32}
              color={theme.primary}
            />
            <Text style={[styles.streakTitle, { color: theme.text }]}>Daily Logging Streak</Text>
          </View>
          
          <View style={styles.streakStats}>
            <View style={styles.streakStat}>
              <Text style={[styles.streakValue, { color: theme.primary }]}>{currentStreakText}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Current Streak</Text>
            </View>
            
            <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
            
            <View style={styles.streakStat}>
              <Text style={[styles.streakValue, { color: theme.chartGreen }]}>{bestStreakText}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Best Streak</Text>
            </View>
          </View>
          
          <Text style={[styles.streakHint, { color: theme.textSecondary }]}>
            Log at least 1 job per day to maintain your streak
          </Text>
        </View>

        <View style={[styles.streakCard, { backgroundColor: theme.card }]}>
          <View style={styles.streakHeader}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={32}
              color={theme.accent}
            />
            <Text style={[styles.streakTitle, { color: theme.text }]}>Weekly Streak</Text>
          </View>
          
          <View style={styles.streakStats}>
            <View style={styles.streakStat}>
              <Text style={[styles.streakValue, { color: theme.accent }]}>{weeklyStreakText}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Current Streak</Text>
            </View>
            
            <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
            
            <View style={styles.streakStat}>
              <Text style={[styles.streakValue, { color: theme.chartGreen }]}>{bestWeeklyStreakText}</Text>
              <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Best Streak</Text>
            </View>
          </View>
          
          <Text style={[styles.streakHint, { color: theme.textSecondary }]}>
            Log at least {weeklyTarget} jobs per week to maintain your streak
          </Text>
        </View>

        {streakData.bestDayThisMonth && (
          <View style={[styles.highlightCard, { backgroundColor: theme.card }]}>
            <View style={styles.highlightHeader}>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={24}
                color={theme.chartYellow}
              />
              <Text style={[styles.highlightTitle, { color: theme.text }]}>Best Day This Month</Text>
            </View>
            <Text style={[styles.highlightDate, { color: theme.primary }]}>
              {formatDate(streakData.bestDayThisMonth.date)}
            </Text>
            <Text style={[styles.highlightValue, { color: theme.text }]}>
              {streakData.bestDayThisMonth.aw} AWs
            </Text>
            <Text style={[styles.highlightSubtext, { color: theme.textSecondary }]}>
              {streakData.bestDayThisMonth.jobs} jobs • {formatTime(streakData.bestDayThisMonth.aw * 5)}
            </Text>
          </View>
        )}

        {streakData.mostProductiveDayThisMonth && (
          <View style={[styles.highlightCard, { backgroundColor: theme.card }]}>
            <View style={styles.highlightHeader}>
              <IconSymbol
                ios_icon_name="chart.bar.fill"
                android_material_icon_name="bar-chart"
                size={24}
                color={theme.chartGreen}
              />
              <Text style={[styles.highlightTitle, { color: theme.text }]}>Most Productive Day</Text>
            </View>
            <Text style={[styles.highlightDate, { color: theme.primary }]}>
              {formatDate(streakData.mostProductiveDayThisMonth.date)}
            </Text>
            <Text style={[styles.highlightValue, { color: theme.text }]}>
              {streakData.mostProductiveDayThisMonth.jobs} jobs
            </Text>
            <Text style={[styles.highlightSubtext, { color: theme.textSecondary }]}>
              {streakData.mostProductiveDayThisMonth.aw} AWs • {formatTime(streakData.mostProductiveDayThisMonth.aw * 5)}
            </Text>
          </View>
        )}

        <View style={[styles.monthlyCard, { backgroundColor: theme.card }]}>
          <View style={styles.monthlyHeader}>
            <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthArrow}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <View style={styles.monthInfo}>
              <Text style={[styles.monthText, { color: theme.text }]}>
                {selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthArrow}>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.monthlySummary}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>{monthlyStats.totalJobs}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Jobs</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>{monthlyStats.totalAw}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total AWs</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.primary }]}>
                {monthlyStats.avgAwPerJob.toFixed(1)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Avg AW/Job</Text>
            </View>
          </View>

          <View style={styles.weekdayHeader}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={index} style={[styles.weekdayText, { color: theme.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {Array.from({ 
              length: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() 
            }).map((_, index) => (
              <View key={`empty-${index}`} style={styles.dayCell} />
            ))}
            
            {calendarDays.map((dayInfo) => {
              const isToday = dayInfo.dateString === new Date().toISOString().split('T')[0];
              
              return (
                <View
                  key={dayInfo.dateString}
                  style={[
                    styles.dayCell,
                    isToday && { borderWidth: 2, borderColor: theme.primary },
                    dayInfo.hasJobs && { backgroundColor: theme.primary + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: theme.text },
                      !dayInfo.hasJobs && { opacity: 0.5 },
                    ]}
                  >
                    {dayInfo.date.getDate()}
                  </Text>
                  
                  {dayInfo.hasJobs && (
                    <View style={styles.dayIndicator}>
                      <View style={[styles.dayDot, { backgroundColor: theme.primary }]} />
                      <Text style={[styles.dayJobCount, { color: theme.primary }]}>
                        {dayInfo.jobs.length}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Jobs logged</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.primary }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Today</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  streakCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  streakStat: {
    alignItems: 'center',
    flex: 1,
  },
  streakValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 12,
  },
  streakDivider: {
    width: 1,
    height: '100%',
  },
  streakHint: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  highlightCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  highlightDate: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  highlightValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  highlightSubtext: {
    fontSize: 14,
  },
  monthlyCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  monthlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthArrow: {
    padding: 8,
  },
  monthInfo: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthlySummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: (SCREEN_WIDTH - 80) / 7,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayIndicator: {
    alignItems: 'center',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  dayJobCount: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
});
