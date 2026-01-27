
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
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { offlineStorage } from '@/utils/offlineStorage';
import { scheduleAllNotifications, sendTestNotification } from '@/utils/notificationScheduler';
import { requestNotificationPermissions, openNotificationSettings } from '@/utils/permissions';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SOUND_OPTIONS = [
  { id: 'default', label: 'Default Sound' },
  { id: 'none', label: 'No Sound (Silent)' },
];

const VIBRATION_PATTERNS = [
  { id: 'default', label: 'Default', description: 'Standard vibration' },
  { id: 'short', label: 'Short', description: 'Quick buzz' },
  { id: 'long', label: 'Long', description: 'Extended vibration' },
  { id: 'double', label: 'Double', description: 'Two quick buzzes' },
];

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
  
  // New notification options
  const [workStartNotification, setWorkStartNotification] = useState(true);
  const [workEndNotification, setWorkEndNotification] = useState(true);
  const [lunchStartNotification, setLunchStartNotification] = useState(true);
  const [lunchEndNotification, setLunchEndNotification] = useState(true);
  const [notificationSound, setNotificationSound] = useState('default');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [vibrationPattern, setVibrationPattern] = useState('default');
  
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showVibrationPicker, setShowVibrationPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      
      // New settings
      setWorkStartNotification(settings.workStartNotification ?? true);
      setWorkEndNotification(settings.workEndNotification ?? true);
      setLunchStartNotification(settings.lunchStartNotification ?? true);
      setLunchEndNotification(settings.lunchEndNotification ?? true);
      setNotificationSound(settings.notificationSound ?? 'default');
      setVibrationEnabled(settings.vibrationEnabled ?? true);
      setVibrationPattern(settings.vibrationPattern ?? 'default');
      
      console.log('NotificationSettingsScreen: Settings loaded');
    } catch (error) {
      console.error('NotificationSettingsScreen: Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    console.log('NotificationSettingsScreen: User tapped Test Notification');
    
    // Check permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please enable notifications in your device settings to test notifications.');
      return;
    }
    
    try {
      const settings = {
        dailyReminder,
        dailyReminderTime,
        weeklyReport,
        weeklyReportDay,
        monthlyReport,
        targetReminder,
        efficiencyAlert,
        lowEfficiencyThreshold: parseInt(lowEfficiencyThreshold),
        workStartNotification,
        workEndNotification,
        lunchStartNotification,
        lunchEndNotification,
        notificationSound,
        vibrationEnabled,
        vibrationPattern,
      };
      
      await sendTestNotification(settings);
      Alert.alert('Test Sent', 'A test notification has been sent with your current settings.');
    } catch (error) {
      console.error('NotificationSettingsScreen: Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleOpenDeviceNotificationSettings = async () => {
    console.log('NotificationSettingsScreen: User tapped Open Device Notification Settings');
    await openNotificationSettings();
  };

  const handleSave = async () => {
    console.log('NotificationSettingsScreen: Saving notification settings');
    
    const threshold = parseInt(lowEfficiencyThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      Alert.alert('Error', 'Efficiency threshold must be between 0 and 100');
      return;
    }
    
    setSaving(true);
    
    try {
      // Check permissions
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Notifications are disabled. Please enable them in your device settings to receive alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openNotificationSettings },
          ]
        );
        setSaving(false);
        return;
      }
      
      // Save settings to storage
      const settingsToSave = {
        dailyReminder,
        dailyReminderTime,
        weeklyReport,
        weeklyReportDay,
        monthlyReport,
        targetReminder,
        efficiencyAlert,
        lowEfficiencyThreshold: threshold,
        workStartNotification,
        workEndNotification,
        lunchStartNotification,
        lunchEndNotification,
        notificationSound,
        vibrationEnabled,
        vibrationPattern,
      };
      
      console.log('NotificationSettingsScreen: Saving settings:', settingsToSave);
      await offlineStorage.updateNotificationSettings(settingsToSave);
      console.log('NotificationSettingsScreen: Settings saved to storage');
      
      // Reschedule all notifications with new settings
      console.log('NotificationSettingsScreen: Rescheduling notifications');
      await scheduleAllNotifications();
      console.log('NotificationSettingsScreen: Notifications rescheduled');
      
      Alert.alert(
        'Success',
        'Notification settings updated successfully. All notifications have been rescheduled based on your work schedule.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('NotificationSettingsScreen: Error saving settings:', error);
      Alert.alert('Error', `Failed to save notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
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

  const selectedSound = SOUND_OPTIONS.find(s => s.id === notificationSound);
  const selectedVibration = VIBRATION_PATTERNS.find(v => v.id === vibrationPattern);

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
              Customize which notifications you receive and when. All notifications are automatically synced with your work schedule.
            </Text>
          </View>

          {/* Device Notification Settings */}
          <TouchableOpacity
            style={[styles.deviceSettingsButton, { backgroundColor: theme.card }]}
            onPress={handleOpenDeviceNotificationSettings}
          >
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={24}
              color={theme.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.deviceSettingsTitle, { color: theme.text }]}>
                Device Notification Settings
              </Text>
              <Text style={[styles.deviceSettingsSubtitle, { color: theme.textSecondary }]}>
                Open system settings to manage notification sounds and permissions
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Work Schedule Notifications */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Work Schedule Notifications</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Receive notifications based on your work schedule times
            </Text>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Work Start</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Notify when your work day starts
                </Text>
              </View>
              <Switch
                value={workStartNotification}
                onValueChange={setWorkStartNotification}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Work End</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Notify when your work day ends
                </Text>
              </View>
              <Switch
                value={workEndNotification}
                onValueChange={setWorkEndNotification}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Lunch Start</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Notify when lunch break starts
                </Text>
              </View>
              <Switch
                value={lunchStartNotification}
                onValueChange={setLunchStartNotification}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Lunch End</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Notify when lunch break ends
                </Text>
              </View>
              <Switch
                value={lunchEndNotification}
                onValueChange={setLunchEndNotification}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>

          {/* Sound & Vibration Settings */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>Sound & Vibration</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Customize notification sound and vibration
            </Text>
            
            <View style={styles.pickerContainer}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Notification Sound</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: theme.background }]}
                onPress={() => setShowSoundPicker(true)}
              >
                <Text style={[styles.pickerButtonText, { color: theme.text }]}>
                  {selectedSound?.label || 'Default Sound'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Vibration</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Enable vibration for notifications
                </Text>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={setVibrationEnabled}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            
            {vibrationEnabled && (
              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Vibration Pattern</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: theme.background }]}
                  onPress={() => setShowVibrationPicker(true)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerButtonText, { color: theme.text }]}>
                      {selectedVibration?.label || 'Default'}
                    </Text>
                    <Text style={[styles.pickerButtonSubtext, { color: theme.textSecondary }]}>
                      {selectedVibration?.description || 'Standard vibration'}
                    </Text>
                  </View>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="arrow-forward"
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: theme.accent }]}
              onPress={handleTestNotification}
            >
              <IconSymbol
                ios_icon_name="speaker.wave.2.fill"
                android_material_icon_name="volume-up"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.testButtonText}>Test Notification</Text>
            </TouchableOpacity>
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
            style={[styles.saveButton, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
        
        {/* Sound Picker Modal */}
        <Modal
          visible={showSoundPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowSoundPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Notification Sound</Text>
                <TouchableOpacity onPress={() => setShowSoundPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsList}>
                {SOUND_OPTIONS.map((sound) => {
                  const isSelected = notificationSound === sound.id;
                  return (
                    <TouchableOpacity
                      key={sound.id}
                      style={[
                        styles.optionItem,
                        { backgroundColor: isSelected ? theme.primary : theme.background },
                      ]}
                      onPress={() => {
                        setNotificationSound(sound.id);
                        setShowSoundPicker(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: isSelected ? '#ffffff' : theme.text }]}>
                        {sound.label}
                      </Text>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color="#ffffff"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        
        {/* Vibration Pattern Picker Modal */}
        <Modal
          visible={showVibrationPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowVibrationPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Vibration Pattern</Text>
                <TouchableOpacity onPress={() => setShowVibrationPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsList}>
                {VIBRATION_PATTERNS.map((pattern) => {
                  const isSelected = vibrationPattern === pattern.id;
                  return (
                    <TouchableOpacity
                      key={pattern.id}
                      style={[
                        styles.optionItem,
                        { backgroundColor: isSelected ? theme.primary : theme.background },
                      ]}
                      onPress={() => {
                        setVibrationPattern(pattern.id);
                        setShowVibrationPicker(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionText, { color: isSelected ? '#ffffff' : theme.text }]}>
                          {pattern.label}
                        </Text>
                        <Text style={[styles.optionSubtext, { color: isSelected ? '#ffffff' : theme.textSecondary }]}>
                          {pattern.description}
                        </Text>
                      </View>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color="#ffffff"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  deviceSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceSettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceSettingsSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  timeInputContainer: {
    marginTop: 8,
  },
  dayPickerContainer: {
    marginTop: 8,
  },
  thresholdInputContainer: {
    marginTop: 8,
  },
  pickerContainer: {
    marginBottom: 16,
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
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerButtonSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
});
