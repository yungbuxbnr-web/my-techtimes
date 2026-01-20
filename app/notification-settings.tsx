
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { offlineStorage } from '@/utils/offlineStorage';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function NotificationSettingsScreen() {
  console.log('NotificationSettingsScreen: Rendering notification settings');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [dailyReminder, setDailyReminder] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('08:00');
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState(1); // Monday
  const [monthlyReport, setMonthlyReport] = useState(true);
  const [targetReminder, setTargetReminder] = useState(true);
  const [efficiencyAlert, setEfficiencyAlert] = useState(true);
  const [lowEfficiencyThreshold, setLowEfficiencyThreshold] = useState('75');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    console.log('NotificationSettingsScreen: Loading notification settings');
    try {
      const settings = await offlineStorage.getNotificationSettings();
      
      setDailyReminder(settings.dailyReminder);
      setDailyReminderTime(settings.dailyReminderTime);
      setWeeklyReport(settings.weeklyReport);
      setWeeklyReportDay(settings.weeklyReportDay);
      setMonthlyReport(settings.monthlyReport);
      setTargetReminder(settings.targetReminder);
      setEfficiencyAlert(settings.efficiencyAlert);
      setLowEfficiencyThreshold(settings.lowEfficiencyThreshold.toString());
      
      console.log('NotificationSettingsScreen: Settings loaded');
    } catch (error) {
      console.error('NotificationSettingsScreen: Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('NotificationSettingsScreen: Saving notification settings');
    
    const threshold = parseInt(lowEfficiencyThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      Alert.alert('Error', 'Efficiency threshold must be between 0 and 100');
      return;
    }
    
    try {
      await offlineStorage.updateNotificationSettings({
        dailyReminder,
        dailyReminderTime,
        weeklyReport,
        weeklyReportDay,
        monthlyReport,
        targetReminder,
        efficiencyAlert,
        lowEfficiencyThreshold: threshold,
      });
      
      Alert.alert(
        'Success',
        'Notification settings updated successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('NotificationSettingsScreen: Error saving settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Notification Settings',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading settings...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notification Settings',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <AppBackground>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
        >
          <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Customize which notifications you receive and when. All notifications run in the background to keep you informed about your progress.
            </Text>
          </View>

          {/* Daily Reminder */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Reminder</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Reminds you to log jobs at a set time each day
                </Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            {dailyReminder && (
              <View style={styles.timeInputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Reminder Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={dailyReminderTime}
                  onChangeText={setDailyReminderTime}
                  placeholder="08:00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  24-hour format (e.g., 08:00 for 8 AM)
                </Text>
              </View>
            )}
          </View>

          {/* Weekly Report */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Weekly Report</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Summary of your week's performance
                </Text>
              </View>
              <Switch
                value={weeklyReport}
                onValueChange={setWeeklyReport}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            {weeklyReport && (
              <View style={styles.dayPickerContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Report Day</Text>
                <View style={styles.dayPicker}>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayPickerButton,
                        { borderColor: theme.border },
                        weeklyReportDay === index && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setWeeklyReportDay(index)}
                    >
                      <Text
                        style={[
                          styles.dayPickerText,
                          { color: weeklyReportDay === index ? '#ffffff' : theme.text },
                        ]}
                      >
                        {day.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Monthly Report */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Monthly Report</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  End-of-month statistics and summary
                </Text>
              </View>
              <Switch
                value={monthlyReport}
                onValueChange={setMonthlyReport}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>

          {/* Target Reminder */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Target Reminder</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Alerts when approaching monthly target
                </Text>
              </View>
              <Switch
                value={targetReminder}
                onValueChange={setTargetReminder}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>

          {/* Efficiency Alert */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Efficiency Alert</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Notifies when efficiency drops below threshold
                </Text>
              </View>
              <Switch
                value={efficiencyAlert}
                onValueChange={setEfficiencyAlert}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            {efficiencyAlert && (
              <View style={styles.thresholdInputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Low Efficiency Threshold (%)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={lowEfficiencyThreshold}
                  onChangeText={setLowEfficiencyThreshold}
                  placeholder="75"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  You'll be notified when efficiency falls below this percentage
                </Text>
              </View>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSave}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppBackground>
    </>
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
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  timeInputContainer: {
    marginTop: 16,
  },
  dayPickerContainer: {
    marginTop: 16,
  },
  thresholdInputContainer: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPickerButton: {
    flex: 1,
    minWidth: 45,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  dayPickerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
