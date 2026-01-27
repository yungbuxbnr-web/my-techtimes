
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { api, Job } from '@/utils/api';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';

export default function TodayDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalAw, setTotalAw] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    loadTodayDetails();
    
    // Refresh every 30 seconds for live updates
    const interval = setInterval(() => {
      console.log('TodayDetailsScreen: Auto-refreshing for live updates');
      loadTodayDetails();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadTodayDetails = async () => {
    try {
      console.log('TodayDetailsScreen: Loading today details');
      setLoading(true);
      
      const todayJobs = await api.getTodayJobs();
      setJobs(todayJobs);
      
      const aw = todayJobs.reduce((sum, job) => sum + job.aw, 0);
      setTotalAw(aw);
      
      const minutes = aw * 5;
      setTotalMinutes(minutes);
      
      console.log('TodayDetailsScreen: Today details loaded successfully');
    } catch (error) {
      console.error('TodayDetailsScreen: Error loading today details:', error);
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

  const renderJob = ({ item }: { item: Job }) => {
    const jobMinutes = item.aw * 5;
    const jobTime = formatTime(jobMinutes);
    const jobDate = new Date(item.createdAt);
    const timeStr = jobDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return (
      <TouchableOpacity
        style={[styles.jobCard, { backgroundColor: theme.card }]}
        onPress={() => router.push('/(tabs)/jobs')}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text style={[styles.jobWip, { color: theme.text }]}>WIP: {item.wipNumber}</Text>
            <Text style={[styles.jobReg, { color: theme.textSecondary }]}>{item.vehicleReg}</Text>
          </View>
          <View style={[styles.vhcBadge, { backgroundColor: getVhcColor(item.vhcStatus) }]}>
            <Text style={styles.vhcText}>{item.vhcStatus}</Text>
          </View>
        </View>
        
        <View style={styles.jobStats}>
          <View style={styles.jobStat}>
            <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>AW</Text>
            <Text style={[styles.jobStatValue, { color: theme.primary }]}>{item.aw}</Text>
          </View>
          <View style={styles.jobStat}>
            <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>Time</Text>
            <Text style={[styles.jobStatValue, { color: theme.primary }]}>{jobTime}</Text>
          </View>
          <View style={styles.jobStat}>
            <Text style={[styles.jobStatLabel, { color: theme.textSecondary }]}>Logged</Text>
            <Text style={[styles.jobStatValue, { color: theme.textSecondary }]}>{timeStr}</Text>
          </View>
        </View>
        
        {item.notes && (
          <Text style={[styles.jobNotes, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const todayDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Today Details',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerBackTitle: 'Back',
        }}
      />
      
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.card }, Platform.OS === 'android' && { paddingTop: 16 }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Today&apos;s Performance</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{todayDate}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
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

            {/* Jobs List */}
            <View style={styles.jobsSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Jobs ({jobs.length})
              </Text>
              
              {jobs.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                  <IconSymbol
                    ios_icon_name="tray"
                    android_material_icon_name="inbox"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No jobs logged today yet
                  </Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.primary }]}
                    onPress={() => router.push('/(tabs)/add-job')}
                  >
                    <IconSymbol
                      ios_icon_name="plus"
                      android_material_icon_name="add"
                      size={20}
                      color="#ffffff"
                    />
                    <Text style={styles.addButtonText}>Add First Job</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={jobs}
                  renderItem={renderJob}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.jobsList}
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Quick Actions */}
            {jobs.length > 0 && (
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
            )}
          </>
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
  },
  loadingText: {
    fontSize: 16,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  jobsSection: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  jobsList: {
    paddingBottom: 100,
  },
  jobCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobWip: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  jobReg: {
    fontSize: 14,
  },
  vhcBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vhcText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  jobStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  jobStat: {
    alignItems: 'center',
  },
  jobStatLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  jobStatValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobNotes: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
