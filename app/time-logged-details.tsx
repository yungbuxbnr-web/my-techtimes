
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { api, Job } from '@/utils/api';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';

export default function TimeLoggedDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = (params.month as string) || getCurrentMonth();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<{ date: string; minutes: number; jobs: number }[]>([]);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<{ week: number; minutes: number; jobs: number }[]>([]);

  useEffect(() => {
    loadTimeDetails();
  }, [month]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getWeekNumber = (date: Date): number => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + firstDayOfMonth.getDay()) / 7);
  };

  const loadTimeDetails = async () => {
    try {
      console.log('TimeLoggedDetailsScreen: Loading time details for month', month);
      setLoading(true);
      
      const monthJobs = await api.getJobsForMonth(month);
      setJobs(monthJobs);
      
      const total = monthJobs.reduce((sum, job) => sum + (job.aw * 5), 0);
      setTotalMinutes(total);
      
      // Calculate daily breakdown
      const dailyMap = new Map<string, { minutes: number; jobs: number }>();
      monthJobs.forEach(job => {
        const date = job.createdAt.split('T')[0];
        const existing = dailyMap.get(date) || { minutes: 0, jobs: 0 };
        dailyMap.set(date, {
          minutes: existing.minutes + (job.aw * 5),
          jobs: existing.jobs + 1,
        });
      });
      
      const daily = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setDailyBreakdown(daily);
      
      // Calculate weekly breakdown
      const weeklyMap = new Map<number, { minutes: number; jobs: number }>();
      monthJobs.forEach(job => {
        const date = new Date(job.createdAt);
        const week = getWeekNumber(date);
        const existing = weeklyMap.get(week) || { minutes: 0, jobs: 0 };
        weeklyMap.set(week, {
          minutes: existing.minutes + (job.aw * 5),
          jobs: existing.jobs + 1,
        });
      });
      
      const weekly = Array.from(weeklyMap.entries())
        .map(([week, data]) => ({ week, ...data }))
        .sort((a, b) => a.week - b.week);
      setWeeklyBreakdown(weekly);
      
      console.log('TimeLoggedDetailsScreen: Time details loaded successfully');
    } catch (error) {
      console.error('TimeLoggedDetailsScreen: Error loading time details:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = totalMinutes / 60;
  const averageMinutesPerDay = dailyBreakdown.length > 0 ? totalMinutes / dailyBreakdown.length : 0;
  const averageMinutesPerJob = jobs.length > 0 ? totalMinutes / jobs.length : 0;

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Time Logged Details',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
      >
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Time Logged Analysis</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Time:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{formatTime(totalMinutes)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Decimal Hours:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{formatDecimalHours(totalMinutes)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Jobs:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{jobs.length}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Working Days:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{dailyBreakdown.length}</Text>
              </View>
            </View>

            {/* Averages Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Averages</Text>
              
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Per Day</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{formatTime(averageMinutesPerDay)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Per Job</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{formatTime(averageMinutesPerJob)}</Text>
                </View>
              </View>
            </View>

            {/* Weekly Breakdown */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Weekly Breakdown</Text>
              
              {weeklyBreakdown.map((item) => (
                <View key={item.week} style={styles.breakdownRow}>
                  <View style={styles.breakdownHeader}>
                    <Text style={[styles.breakdownLabel, { color: theme.text }]}>Week {item.week}</Text>
                    <Text style={[styles.breakdownJobs, { color: theme.textSecondary }]}>
                      {item.jobs} jobs
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                    {formatTime(item.minutes)}
                  </Text>
                  <Text style={[styles.breakdownDecimal, { color: theme.textSecondary }]}>
                    {formatDecimalHours(item.minutes)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Daily Breakdown */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Daily Breakdown</Text>
              
              {dailyBreakdown.slice(0, 10).map((item) => {
                const date = new Date(item.date);
                const dateStr = date.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                });
                
                return (
                  <View key={item.date} style={styles.breakdownRow}>
                    <View style={styles.breakdownHeader}>
                      <Text style={[styles.breakdownLabel, { color: theme.text }]}>{dateStr}</Text>
                      <Text style={[styles.breakdownJobs, { color: theme.textSecondary }]}>
                        {item.jobs} jobs
                      </Text>
                    </View>
                    <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                      {formatTime(item.minutes)}
                    </Text>
                    <Text style={[styles.breakdownDecimal, { color: theme.textSecondary }]}>
                      {formatDecimalHours(item.minutes)}
                    </Text>
                  </View>
                );
              })}
              
              {dailyBreakdown.length > 10 && (
                <Text style={[styles.moreText, { color: theme.textSecondary }]}>
                  Showing 10 of {dailyBreakdown.length} days
                </Text>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/(tabs)/jobs')}
              >
                <IconSymbol
                  ios_icon_name="list.bullet"
                  android_material_icon_name="list"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>View All Jobs</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
  header: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  breakdownRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownJobs: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  breakdownDecimal: {
    fontSize: 12,
  },
  moreText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
