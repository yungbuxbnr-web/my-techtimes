
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { formatTime } from '@/utils/jobCalculations';

export default function TotalAwsDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = params.month as string;
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [month]);

  const loadStats = async () => {
    try {
      const monthlyStats = await api.getMonthlyStats(month);
      const jobs = await api.getJobsForMonth(month);
      
      // Calculate distribution
      const awDistribution: { [key: number]: number } = {};
      jobs.forEach(job => {
        awDistribution[job.aw] = (awDistribution[job.aw] || 0) + 1;
      });
      
      const sortedDistribution = Object.entries(awDistribution)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .slice(0, 10);
      
      setStats({
        ...monthlyStats,
        jobs,
        awDistribution: sortedDistribution,
        averageAw: jobs.length > 0 ? monthlyStats.totalAw / jobs.length : 0,
        maxAw: jobs.length > 0 ? Math.max(...jobs.map(j => j.aw)) : 0,
        minAw: jobs.length > 0 ? Math.min(...jobs.map(j => j.aw)) : 0,
      });
    } catch (error) {
      console.error('TotalAwsDetailsScreen: Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Total AWs Details',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading details...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Total AWs Details',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
      >
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>Total AWs Summary</Text>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>{stats.totalAw}</Text>
          <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
            {new Date(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Statistics */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Statistics</Text>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Jobs:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalJobs}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Average AW per Job:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.averageAw.toFixed(2)}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Highest AW:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.maxAw}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lowest AW:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.minAw}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Time:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{formatTime(stats.totalAw * 5)}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Hours:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.soldHours.toFixed(2)}h</Text>
          </View>
        </View>

        {/* AW Distribution */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Top 10 AW Values</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Most common AW values this month
          </Text>
          
          {stats.awDistribution.map(([aw, count]: [string, number], index: number) => {
            const percentage = (count / stats.totalJobs) * 100;
            return (
              <View key={aw} style={styles.distributionRow}>
                <View style={styles.distributionInfo}>
                  <Text style={[styles.distributionAw, { color: theme.text }]}>{aw} AWs</Text>
                  <Text style={[styles.distributionCount, { color: theme.textSecondary }]}>
                    {count} job{count !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
                  </Text>
                </View>
                <View style={[styles.distributionBar, { backgroundColor: theme.background }]}>
                  <View
                    style={[
                      styles.distributionBarFill,
                      { width: `${percentage}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
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
    fontSize: 16,
  },
  summaryCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  distributionRow: {
    marginBottom: 16,
  },
  distributionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  distributionAw: {
    fontSize: 14,
    fontWeight: '600',
  },
  distributionCount: {
    fontSize: 12,
  },
  distributionBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
