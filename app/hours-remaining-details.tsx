
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
import { api } from '@/utils/api';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { formatDecimalHours } from '@/utils/jobCalculations';

export default function HoursRemainingDetailsScreen() {
  const { theme } = useThemeContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = (params.month as string) || getCurrentMonth();
  
  const [loading, setLoading] = useState(true);
  const [targetHours, setTargetHours] = useState(0);
  const [soldHours, setSoldHours] = useState(0);
  const [remainingHours, setRemainingHours] = useState(0);
  const [availableHours, setAvailableHours] = useState(0);
  const [workingDaysLeft, setWorkingDaysLeft] = useState(0);
  const [dailyTargetNeeded, setDailyTargetNeeded] = useState(0);
  const [percentComplete, setPercentComplete] = useState(0);

  useEffect(() => {
    loadRemainingDetails();
  }, [month]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const loadRemainingDetails = async () => {
    try {
      console.log('HoursRemainingDetailsScreen: Loading remaining hours details for month', month);
      setLoading(true);
      
      const monthlyStats = await api.getMonthlyStats(month);
      const schedule = await api.getSchedule();
      
      setTargetHours(monthlyStats.targetHours);
      setSoldHours(monthlyStats.soldHours);
      setRemainingHours(monthlyStats.remainingHours);
      setAvailableHours(monthlyStats.availableHours);
      
      const percent = monthlyStats.targetHours > 0 
        ? (monthlyStats.soldHours / monthlyStats.targetHours) * 100 
        : 0;
      setPercentComplete(percent);
      
      // Calculate working days left in month
      const [year, monthNum] = month.split('-').map(Number);
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      let daysLeft = 0;
      if (year === currentYear && monthNum === currentMonth) {
        const lastDay = new Date(year, monthNum, 0).getDate();
        const currentDay = today.getDate();
        const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
        
        for (let day = currentDay + 1; day <= lastDay; day++) {
          const date = new Date(year, monthNum - 1, day);
          const dayOfWeek = date.getDay();
          if (workingDays.includes(dayOfWeek)) {
            daysLeft++;
          }
        }
      }
      
      setWorkingDaysLeft(daysLeft);
      
      // Calculate daily target needed
      const dailyNeeded = daysLeft > 0 ? monthlyStats.remainingHours / daysLeft : 0;
      setDailyTargetNeeded(dailyNeeded);
      
      console.log('HoursRemainingDetailsScreen: Remaining hours details loaded successfully');
    } catch (error) {
      console.error('HoursRemainingDetailsScreen: Error loading remaining hours details:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOnTrack = remainingHours <= 0 || (workingDaysLeft > 0 && dailyTargetNeeded <= 8.5);
  const statusColor = remainingHours <= 0 ? theme.chartGreen : isOnTrack ? theme.chartYellow : theme.chartRed;
  const statusText = remainingHours <= 0 ? 'Target Achieved!' : isOnTrack ? 'On Track' : 'Behind Target';

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Hours Remaining Details',
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Hours Remaining Analysis</Text>
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
            {/* Status Card */}
            <View style={[styles.statusCard, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
              <Text style={styles.statusValue}>
                {remainingHours > 0 ? `${remainingHours.toFixed(1)}h remaining` : 'Target Complete'}
              </Text>
            </View>

            {/* Progress Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Progress</Text>
              
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: theme.primary, width: `${Math.min(percentComplete, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.text }]}>
                  {percentComplete.toFixed(1)}%
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Sold Hours:</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>
                  {soldHours.toFixed(1)}h
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Target Hours:</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {targetHours.toFixed(1)}h
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Remaining:</Text>
                <Text style={[styles.summaryValue, { color: statusColor }]}>
                  {remainingHours > 0 ? `${remainingHours.toFixed(1)}h` : '0h'}
                </Text>
              </View>
            </View>

            {/* Projection Card */}
            {workingDaysLeft > 0 && remainingHours > 0 && (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Projection</Text>
                
                <View style={styles.projectionItem}>
                  <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                    Working Days Left:
                  </Text>
                  <Text style={[styles.projectionValue, { color: theme.text }]}>
                    {workingDaysLeft} days
                  </Text>
                </View>
                
                <View style={styles.projectionItem}>
                  <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                    Daily Target Needed:
                  </Text>
                  <Text style={[styles.projectionValue, { color: statusColor }]}>
                    {dailyTargetNeeded.toFixed(1)}h per day
                  </Text>
                </View>
                
                <View style={styles.projectionItem}>
                  <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                    Available Hours Left:
                  </Text>
                  <Text style={[styles.projectionValue, { color: theme.text }]}>
                    {(workingDaysLeft * 8.5).toFixed(1)}h
                  </Text>
                </View>
                
                {dailyTargetNeeded > 8.5 && (
                  <View style={[styles.warningBox, { backgroundColor: 'rgba(255, 0, 0, 0.1)' }]}>
                    <IconSymbol
                      ios_icon_name="exclamationmark.triangle.fill"
                      android_material_icon_name="warning"
                      size={20}
                      color={theme.chartRed}
                    />
                    <Text style={[styles.warningText, { color: theme.chartRed }]}>
                      Daily target exceeds standard working hours. Consider overtime or adjusting target.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Breakdown Card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Breakdown</Text>
              
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                    {soldHours.toFixed(1)}h
                  </Text>
                  <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                    Sold
                  </Text>
                </View>
                
                <View style={styles.breakdownDivider} />
                
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: theme.text }]}>
                    {targetHours.toFixed(1)}h
                  </Text>
                  <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                    Target
                  </Text>
                </View>
                
                <View style={styles.breakdownDivider} />
                
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: statusColor }]}>
                    {remainingHours > 0 ? `${remainingHours.toFixed(1)}h` : '0h'}
                  </Text>
                  <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                    Remaining
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push(`/target-details?month=${month}`)}
              >
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="track-changes"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>Target Details</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.accent }]}
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
  statusCard: {
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
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 16,
    color: '#ffffff',
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
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 16,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
  projectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  projectionLabel: {
    fontSize: 14,
  },
  projectionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
