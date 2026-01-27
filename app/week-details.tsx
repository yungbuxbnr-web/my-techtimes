
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { api, Job } from '@/utils/api';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';

export default function WeekDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalAw, setTotalAw] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<{ date: string; jobs: number; aw: number; minutes: number }[]>([]);

  useEffect(() => {
    loadWeekDetails();
    
    // Refresh every 30 seconds for live updates
    const interval = setInterval(() => {
      console.log('WeekDetailsScreen: Auto-refreshing for live updates');
      loadWeekDetails();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadWeekDetails = async () => {
    try {
      console.log('WeekDetailsScreen: Loading week details');
      setLoading(true);
      
      const weekJobs = await api.getWeekJobs();
      setJobs(weekJobs);
      
      const aw = weekJobs.reduce((sum, job) => sum + job.aw, 0);
      setTotalAw(aw);
      
      const minutes = aw * 5;
      setTotalMinutes(minutes);
      
      // Calculate daily breakdown
      const dailyMap = new Map<string, { jobs: number; aw: number; minutes: number }>();
      weekJobs.forEach(job => {
        const date = job.createdAt.split('T')[0];
        const existing = dailyMap.get(date) || { jobs: 0, aw: 0, minutes: 0 };
        dailyMap.set(date, {
          jobs: existing.jobs + 1,
          aw: existing.aw + job.aw,
          minutes: existing.minutes + (job.aw * 5),
        });
      });
      
      const daily = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setDailyBreakdown(daily);
      
      console.log('WeekDetailsScreen: Week details loaded successfully');
    } catch (error) {
      console.error('WeekDetailsScreen: Error loading week details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const mondayStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sundayStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return `${mondayStr} - ${sundayStr}`;
  };

  const averagePerDay = dailyBreakdown.length > 0 ? totalMinutes / dailyBreakdown.length : 0;

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'This Week Details',
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>This Week&apos;s Performance</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{getWeekRange()}</Text>
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
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.primary }]}>{jobs.length}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Jobs</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalAw}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>AWs</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.primary }]}>
                    {formatTime(totalMinutes)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Time</Text>
                </View>
              </View>
              
              <View style={styles.decimalRow}>
                <Text style={[styles.decimalLabel, { color: theme.textSecondary }]}>Decimal Hours:</Text>
                <Text style={[styles.decimalValue, { color: theme.primary }]}>
                  {formatDecimalHours(totalMinutes)}
                </Text>
              </View>
            </View>

            {/* Averages Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Averages</Text>
              
              <View style={styles.averageRow}>
                <Text style={[styles.averageLabel, { color: theme.textSecondary }]}>Per Working Day:</Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {formatTime(averagePerDay)}
                </Text>
              </View>
              
              <View style={styles.averageRow}>
                <Text style={[styles.averageLabel, { color: theme.textSecondary }]}>Per Job:</Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {jobs.length > 0 ? formatTime(totalMinutes / jobs.length) : '0:00'}
                </Text>
              </View>
            </View>

            {/* Daily Breakdown */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Daily Breakdown</Text>
              
              {dailyBreakdown.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No jobs logged this week yet
                </Text>
              ) : (
                dailyBreakdown.map((item) => {
                  const date = new Date(item.date);
                  const dateStr = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  
                  return (
                    <View key={item.date} style={styles.dayRow}>
                      <View style={styles.dayHeader}>
                        <Text style={[styles.dayLabel, { color: theme.text }]}>{dateStr}</Text>
                        <Text style={[styles.dayJobs, { color: theme.textSecondary }]}>
                          {item.jobs} jobs • {item.aw} AWs
                        </Text>
                      </View>
                      <Text style={[styles.dayTime, { color: theme.primary }]}>
                        {formatTime(item.minutes)}
                      </Text>
                      <Text style={[styles.dayDecimal, { color: theme.textSecondary }]}>
                        {formatDecimalHours(item.minutes)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/(tabs)/add-job')}
              >
                <IconSymbol
                  ios_icon_name="plus"
                  android_material_icon_name="add"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>Add Job</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/(tabs)/jobs')}
              >
                <IconSymbol
                  ios_icon_name="list.bullet"
                  android_material_icon_name="list"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>All Jobs</Text>
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
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  decimalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  decimalLabel: {
    fontSize: 14,
  },
  decimalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  averageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  averageLabel: {
    fontSize: 14,
  },
  averageValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  dayRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayJobs: {
    fontSize: 12,
  },
  dayTime: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dayDecimal: {
    fontSize: 12,
  },
  actionsContainer: {
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
    fontSize: 14,
    fontWeight: '600',
  },
});
