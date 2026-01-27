
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
import { formatTime } from '@/utils/jobCalculations';

export default function JobsDoneDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = (params.month as string) || getCurrentMonth();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vhcBreakdown, setVhcBreakdown] = useState<{ status: string; count: number; percentage: number }[]>([]);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [weeklyAverage, setWeeklyAverage] = useState(0);
  const [busiestDay, setBusiestDay] = useState<{ date: string; count: number } | null>(null);

  useEffect(() => {
    loadJobsDetails();
  }, [month]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const loadJobsDetails = async () => {
    try {
      console.log('JobsDoneDetailsScreen: Loading jobs details for month', month);
      setLoading(true);
      
      const monthJobs = await api.getJobsForMonth(month);
      setJobs(monthJobs);
      
      // Calculate VHC breakdown
      const vhcCounts = {
        NONE: 0,
        GREEN: 0,
        ORANGE: 0,
        RED: 0,
      };
      
      monthJobs.forEach(job => {
        vhcCounts[job.vhcStatus]++;
      });
      
      const vhcData = Object.entries(vhcCounts).map(([status, count]) => ({
        status,
        count,
        percentage: monthJobs.length > 0 ? (count / monthJobs.length) * 100 : 0,
      }));
      setVhcBreakdown(vhcData);
      
      // Calculate daily breakdown
      const dailyMap = new Map<string, number>();
      monthJobs.forEach(job => {
        const date = job.createdAt.split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });
      
      const workingDays = dailyMap.size;
      const dailyAvg = workingDays > 0 ? monthJobs.length / workingDays : 0;
      setDailyAverage(dailyAvg);
      
      // Find busiest day
      let maxCount = 0;
      let maxDate = '';
      dailyMap.forEach((count, date) => {
        if (count > maxCount) {
          maxCount = count;
          maxDate = date;
        }
      });
      
      if (maxDate) {
        setBusiestDay({ date: maxDate, count: maxCount });
      }
      
      // Calculate weekly average (approximate)
      const weeklyAvg = dailyAvg * 5; // Assuming 5 working days per week
      setWeeklyAverage(weeklyAvg);
      
      console.log('JobsDoneDetailsScreen: Jobs details loaded successfully');
    } catch (error) {
      console.error('JobsDoneDetailsScreen: Error loading jobs details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVhcColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return theme.chartGreen;
      case 'ORANGE':
        return theme.chartYellow;
      case 'RED':
        return theme.chartRed;
      default:
        return theme.textSecondary;
    }
  };

  const getVhcLabel = (status: string) => {
    switch (status) {
      case 'NONE':
        return 'No VHC';
      case 'GREEN':
        return 'Green VHC';
      case 'ORANGE':
        return 'Orange VHC';
      case 'RED':
        return 'Red VHC';
      default:
        return status;
    }
  };

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Jobs Done Details',
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Jobs Done Analysis</Text>
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
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Jobs:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{jobs.length}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Daily Average:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{dailyAverage.toFixed(1)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Weekly Average:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{weeklyAverage.toFixed(1)}</Text>
              </View>
              
              {busiestDay && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Busiest Day:</Text>
                  <View style={styles.busiestDayContainer}>
                    <Text style={[styles.summaryValue, { color: theme.primary }]}>
                      {new Date(busiestDay.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                    <Text style={[styles.busiestDayCount, { color: theme.textSecondary }]}>
                      ({busiestDay.count} jobs)
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* VHC Breakdown */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>VHC Status Breakdown</Text>
              
              {vhcBreakdown.map((item, index) => (
                <View key={index} style={styles.vhcRow}>
                  <View style={styles.vhcHeader}>
                    <View style={[styles.vhcIndicator, { backgroundColor: getVhcColor(item.status) }]} />
                    <Text style={[styles.vhcLabel, { color: theme.text }]}>
                      {getVhcLabel(item.status)}
                    </Text>
                  </View>
                  <View style={styles.vhcBar}>
                    <View
                      style={[
                        styles.vhcFill,
                        { backgroundColor: getVhcColor(item.status), width: `${item.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.vhcCount, { color: theme.textSecondary }]}>
                    {item.count} jobs ({item.percentage.toFixed(0)}%)
                  </Text>
                </View>
              ))}
            </View>

            {/* Quick Stats */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Quick Stats</Text>
              
              <View style={styles.quickStatsGrid}>
                <View style={styles.quickStatItem}>
                  <Text style={[styles.quickStatValue, { color: theme.primary }]}>
                    {jobs.length}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>
                    Total Jobs
                  </Text>
                </View>
                
                <View style={styles.quickStatItem}>
                  <Text style={[styles.quickStatValue, { color: theme.chartGreen }]}>
                    {vhcBreakdown.find(v => v.status === 'GREEN')?.count || 0}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>
                    Green VHCs
                  </Text>
                </View>
                
                <View style={styles.quickStatItem}>
                  <Text style={[styles.quickStatValue, { color: theme.chartYellow }]}>
                    {vhcBreakdown.find(v => v.status === 'ORANGE')?.count || 0}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>
                    Orange VHCs
                  </Text>
                </View>
                
                <View style={styles.quickStatItem}>
                  <Text style={[styles.quickStatValue, { color: theme.chartRed }]}>
                    {vhcBreakdown.find(v => v.status === 'RED')?.count || 0}
                  </Text>
                  <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>
                    Red VHCs
                  </Text>
                </View>
              </View>
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
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.accent }]}
                onPress={() => router.push('/job-stats')}
              >
                <IconSymbol
                  ios_icon_name="chart.bar"
                  android_material_icon_name="bar-chart"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>Job Stats</Text>
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
  busiestDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busiestDayCount: {
    fontSize: 12,
  },
  vhcRow: {
    marginBottom: 20,
  },
  vhcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  vhcIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  vhcLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  vhcBar: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  vhcFill: {
    height: '100%',
    borderRadius: 12,
  },
  vhcCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStatItem: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    textAlign: 'center',
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
