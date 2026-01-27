
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

export default function TotalAwsDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = (params.month as string) || getCurrentMonth();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalAw, setTotalAw] = useState(0);
  const [averageAw, setAverageAw] = useState(0);
  const [highestAw, setHighestAw] = useState(0);
  const [lowestAw, setLowestAw] = useState(0);
  const [awDistribution, setAwDistribution] = useState<{ range: string; count: number; percentage: number }[]>([]);

  useEffect(() => {
    loadAwDetails();
  }, [month]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const loadAwDetails = async () => {
    try {
      console.log('TotalAwsDetailsScreen: Loading AW details for month', month);
      setLoading(true);
      
      const monthJobs = await api.getJobsForMonth(month);
      setJobs(monthJobs);
      
      const total = monthJobs.reduce((sum, job) => sum + job.aw, 0);
      setTotalAw(total);
      
      const avg = monthJobs.length > 0 ? total / monthJobs.length : 0;
      setAverageAw(avg);
      
      const awValues = monthJobs.map(job => job.aw);
      const highest = awValues.length > 0 ? Math.max(...awValues) : 0;
      const lowest = awValues.length > 0 ? Math.min(...awValues) : 0;
      setHighestAw(highest);
      setLowestAw(lowest);
      
      // Calculate AW distribution
      const ranges = [
        { range: '0-10 AWs', min: 0, max: 10 },
        { range: '11-20 AWs', min: 11, max: 20 },
        { range: '21-30 AWs', min: 21, max: 30 },
        { range: '31-40 AWs', min: 31, max: 40 },
        { range: '41-50 AWs', min: 41, max: 50 },
        { range: '51+ AWs', min: 51, max: Infinity },
      ];
      
      const distribution = ranges.map(({ range, min, max }) => {
        const count = monthJobs.filter(job => job.aw >= min && job.aw <= max).length;
        const percentage = monthJobs.length > 0 ? (count / monthJobs.length) * 100 : 0;
        return { range, count, percentage };
      });
      
      setAwDistribution(distribution);
      
      console.log('TotalAwsDetailsScreen: AW details loaded successfully');
    } catch (error) {
      console.error('TotalAwsDetailsScreen: Error loading AW details:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalMinutes = totalAw * 5;
  const totalHours = totalMinutes / 60;

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Total AWs Details',
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Total AWs Analysis</Text>
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
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total AWs:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalAw}</Text>
              </View>
              
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
            </View>

            {/* Statistics Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Statistics</Text>
              
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Average AW</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{averageAw.toFixed(1)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Highest AW</Text>
                  <Text style={[styles.statValue, { color: theme.chartGreen }]}>{highestAw}</Text>
                </View>
              </View>
              
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lowest AW</Text>
                  <Text style={[styles.statValue, { color: theme.chartRed }]}>{lowestAw}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Time/Job</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {jobs.length > 0 ? formatTime((totalMinutes / jobs.length)) : '0:00'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Distribution Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>AW Distribution</Text>
              
              {awDistribution.map((item, index) => (
                <View key={index} style={styles.distributionRow}>
                  <Text style={[styles.distributionLabel, { color: theme.textSecondary }]}>
                    {item.range}
                  </Text>
                  <View style={styles.distributionBar}>
                    <View
                      style={[
                        styles.distributionFill,
                        { backgroundColor: theme.primary, width: `${item.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.distributionCount, { color: theme.text }]}>
                    {item.count} ({item.percentage.toFixed(0)}%)
                  </Text>
                </View>
              ))}
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
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  distributionRow: {
    marginBottom: 16,
  },
  distributionLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  distributionBar: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  distributionFill: {
    height: '100%',
    borderRadius: 12,
  },
  distributionCount: {
    fontSize: 12,
    textAlign: 'right',
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
