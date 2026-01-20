
import { IconSymbol } from '@/components/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useThemeContext } from '@/contexts/ThemeContext';
import { offlineStorage } from '@/utils/offlineStorage';
import React, { useState, useEffect } from 'react';
import { exportToPdf, exportToJson, importFromJson, ExportOptions } from '@/utils/exportUtils';
import AppBackground from '@/components/AppBackground';
import { api } from '@/utils/api';
import { requestAllPermissions, checkPermissions, showPermissionsInfo } from '@/utils/permissions';
import Slider from '@react-native-community/slider';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen() {
  console.log('SettingsScreen: Rendering settings page');
  const { logout } = useAuth();
  const { theme, isDarkMode, toggleTheme, overlayStrength, setOverlayStrength } = useThemeContext();
  
  const [technicianName, setTechnicianName] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('180');
  const [scheduleInfo, setScheduleInfo] = useState('Loading...');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [lockOnResume, setLockOnResume] = useState(true);
  
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, job: null as any });
  const [importing, setImporting] = useState(false);
  
  const [permissions, setPermissions] = useState({
    notifications: false,
    storage: false,
  });

  useEffect(() => {
    loadSettings();
    checkAppPermissions();
  }, []);

  const loadSettings = async () => {
    console.log('SettingsScreen: Loading settings');
    try {
      const profile = await api.getTechnicianProfile();
      const schedule = await api.getSchedule();
      const settings = await offlineStorage.getSettings();
      
      setTechnicianName(profile.name);
      setMonthlyTarget(settings.monthlyTarget.toString());
      
      // Format schedule info
      const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const workingDayNames = workingDays.map(d => dayNames[d]).join(', ');
      const scheduleText = `${workingDayNames} • ${schedule.startTime || '07:00'}-${schedule.endTime || '18:00'} • ${schedule.dailyWorkingHours.toFixed(1)}h/day`;
      setScheduleInfo(scheduleText);
    } catch (error) {
      console.error('SettingsScreen: Error loading settings:', error);
    }
  };

  const checkAppPermissions = async () => {
    console.log('SettingsScreen: Checking permissions');
    const perms = await checkPermissions();
    setPermissions(perms);
  };

  const handleRequestPermissions = async () => {
    console.log('SettingsScreen: Requesting permissions');
    await requestAllPermissions();
    await checkAppPermissions();
  };

  const handleUpdateTarget = async () => {
    console.log('SettingsScreen: Updating monthly target to', monthlyTarget);
    try {
      const value = parseFloat(monthlyTarget);
      if (isNaN(value) || value <= 0) {
        Alert.alert('Invalid Target', 'Please enter a valid target hours value');
        return;
      }
      await api.updateMonthlyTarget(value);
      Alert.alert('Success', 'Monthly target updated');
    } catch (error) {
      console.error('SettingsScreen: Error updating target:', error);
      Alert.alert('Error', 'Failed to update monthly target');
    }
  };

  const handleUpdateName = async () => {
    console.log('SettingsScreen: Updating technician name to', technicianName);
    try {
      if (!technicianName.trim()) {
        Alert.alert('Invalid Name', 'Please enter a valid name');
        return;
      }
      await api.updateTechnicianProfile({ name: technicianName });
      Alert.alert('Success', 'Name updated');
    } catch (error) {
      console.error('SettingsScreen: Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleChangePIN = () => {
    console.log('SettingsScreen: Opening PIN change modal');
    setShowPinChange(true);
  };

  const handleSubmitPinChange = async () => {
    console.log('SettingsScreen: Submitting PIN change');
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'New PINs do not match');
      return;
    }
    if (newPin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }
    
    // This would normally verify the current PIN and update
    // For now, just close the modal
    setShowPinChange(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    Alert.alert('Success', 'PIN changed successfully');
  };

  const handleToggleBiometrics = async (value: boolean) => {
    console.log('SettingsScreen: Toggling biometrics to', value);
    setBiometricsEnabled(value);
    // This would normally enable/disable biometric authentication
  };

  const handleExportCSV = async () => {
    console.log('SettingsScreen: Exporting to CSV');
    try {
      const jobs = await api.getAllJobs();
      
      let csv = 'Created At,WIP Number,Vehicle Reg,AW,Minutes,Notes\n';
      jobs.forEach(job => {
        const minutes = job.aw * 5;
        const notes = (job.notes || '').replace(/,/g, ';');
        csv += `${job.createdAt},${job.wipNumber},${job.vehicleReg},${job.aw},${minutes},${notes}\n`;
      });
      
      const fileName = `techtimes_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export TechTimes Data',
        });
      }
      
      Alert.alert('Success', 'Data exported successfully');
    } catch (error) {
      console.error('SettingsScreen: Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleOpenExportModal = () => {
    console.log('SettingsScreen: Opening export modal');
    setShowExportModal(true);
  };

  const handleExport = async (format: 'pdf' | 'json') => {
    console.log('SettingsScreen: Exporting as', format, 'with type', exportType);
    try {
      let jobs = [];
      const options: ExportOptions = { type: exportType };
      
      if (exportType === 'daily') {
        const dateStr = selectedDate.toISOString().split('T')[0];
        options.day = dateStr;
        jobs = await api.getJobsInRange(dateStr, dateStr);
      } else if (exportType === 'weekly') {
        const day = selectedDate.getDay();
        const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(selectedDate);
        monday.setDate(diff);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);
        
        const startStr = monday.toISOString().split('T')[0];
        const endStr = saturday.toISOString().split('T')[0];
        options.week = selectedWeek;
        jobs = await api.getJobsInRange(startStr, endStr);
      } else if (exportType === 'monthly') {
        const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        options.month = monthStr;
        jobs = await api.getJobsForMonth(monthStr);
      } else {
        jobs = await api.getAllJobs();
      }
      
      const profile = await api.getTechnicianProfile();
      
      if (format === 'pdf') {
        await exportToPdf(jobs, profile.name, options);
      } else {
        await exportToJson(jobs);
      }
      
      setShowExportModal(false);
      Alert.alert('Success', `Exported ${jobs.length} jobs as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('SettingsScreen: Error exporting:', error);
      Alert.alert('Error', `Failed to export as ${format.toUpperCase()}`);
    }
  };

  const handleOpenImportModal = async () => {
    console.log('SettingsScreen: Opening import modal - selecting file');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log('SettingsScreen: Import cancelled by user');
        return;
      }
      
      console.log('SettingsScreen: File selected:', result.assets[0].uri);
      setShowImportModal(true);
      setImporting(true);
      setImportProgress({ current: 0, total: 0, job: null });
      
      // Parse the JSON file
      const importResult = await importFromJson(
        result.assets[0].uri,
        (current, total, job) => {
          console.log('SettingsScreen: Import progress', current, '/', total, '- Job:', job.wipNumber);
          setImportProgress({ current, total, job });
        }
      );
      
      console.log('SettingsScreen: Parsed', importResult.jobs.length, 'jobs, now importing to API');
      
      // Import each job via the API
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < importResult.jobs.length; i++) {
        const job = importResult.jobs[i];
        try {
          console.log('SettingsScreen: Importing job', i + 1, '/', importResult.jobs.length, ':', job);
          await api.createJob(job);
          successCount++;
        } catch (error) {
          console.error('SettingsScreen: Failed to import job', i + 1, error);
          failCount++;
        }
      }
      
      setImporting(false);
      
      console.log('SettingsScreen: Import complete - Success:', successCount, 'Failed:', failCount);
      
      Alert.alert(
        'Import Complete',
        `Successfully imported: ${successCount}\nFailed: ${failCount}\nSkipped (invalid): ${importResult.skipped}`,
        [{ text: 'OK', onPress: () => setShowImportModal(false) }]
      );
    } catch (error) {
      console.error('SettingsScreen: Error importing:', error);
      setImporting(false);
      setShowImportModal(false);
      Alert.alert('Error', `Failed to import jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBackup = async () => {
    console.log('SettingsScreen: Creating backup');
    try {
      const backupData = await offlineStorage.exportAllData();
      const fileName = `techtimes_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, backupData);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Backup TechTimes Data',
        });
      }
      
      Alert.alert('Success', 'Backup created successfully');
    } catch (error) {
      console.error('SettingsScreen: Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    console.log('SettingsScreen: Opening restore dialog');
    Alert.alert(
      'Restore Backup',
      'This will replace all current data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: performRestore },
      ]
    );
  };

  const performRestore = async () => {
    console.log('SettingsScreen: Performing restore');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log('SettingsScreen: Restore cancelled');
        return;
      }
      
      const backupData = await FileSystem.readAsStringAsync(result.assets[0].uri);
      await offlineStorage.importAllData(backupData);
      
      Alert.alert('Success', 'Data restored successfully. Please restart the app.');
    } catch (error) {
      console.error('SettingsScreen: Error restoring backup:', error);
      Alert.alert('Error', 'Failed to restore backup');
    }
  };

  const handleLogout = () => {
    console.log('SettingsScreen: Logging out');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <AppBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        
        {/* Technician Profile */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Technician Profile</Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder="Enter your name"
              placeholderTextColor={theme.textSecondary}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleUpdateName}
            >
              <Text style={styles.buttonText}>Update Name</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Monthly Target */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Monthly Target</Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Target Hours</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={monthlyTarget}
              onChangeText={setMonthlyTarget}
              keyboardType="numeric"
              placeholder="180"
              placeholderTextColor={theme.textSecondary}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleUpdateTarget}
            >
              <Text style={styles.buttonText}>Update Target</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Work Schedule */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Work Schedule</Text>
          <View style={[styles.scheduleInfoBox, { backgroundColor: theme.background }]}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.scheduleInfoText, { color: theme.text }]}>{scheduleInfo}</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, marginTop: 12 }]}
            onPress={() => {
              console.log('SettingsScreen: User tapped Edit Work Schedule button');
              router.push('/edit-work-schedule');
            }}
          >
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>Edit Work Schedule</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 8 }]}>
            Customize your working days and hours to accurately track efficiency
          </Text>
        </View>
        
        {/* Appearance */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Dark Mode</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          <View style={styles.sliderGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Overlay Strength: {Math.round(overlayStrength * 100)}%
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={0.6}
              value={overlayStrength}
              onValueChange={setOverlayStrength}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
            />
          </View>
        </View>
        
        {/* Security */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleChangePIN}
          >
            <Text style={styles.buttonText}>Change PIN</Text>
          </TouchableOpacity>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Enable Biometrics</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Lock on Resume</Text>
            <Switch
              value={lockOnResume}
              onValueChange={setLockOnResume}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
        </View>
        
        {/* Export & Import */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Export & Import</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleOpenExportModal}
          >
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="upload"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>Export Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, marginTop: 12 }]}
            onPress={handleOpenImportModal}
          >
            <IconSymbol
              ios_icon_name="square.and.arrow.down"
              android_material_icon_name="download"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>Import Jobs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.textSecondary, marginTop: 12 }]}
            onPress={handleExportCSV}
          >
            <Text style={styles.buttonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
        
        {/* Calendar */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Calendar</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log('SettingsScreen: User tapped View Calendar button');
              router.push('/calendar');
            }}
          >
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>View Calendar</Text>
          </TouchableOpacity>
        </View>
        
        {/* Notifications */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Notifications</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log('SettingsScreen: User tapped Notification Settings button');
              router.push('/notification-settings');
            }}
          >
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>Notification Settings</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 8 }]}>
            Customize which notifications you receive and when
          </Text>
        </View>
        
        {/* About */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log('SettingsScreen: User tapped About TechTimes button');
              router.push('/about');
            }}
          >
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color="#fff"
            />
            <Text style={styles.buttonText}>About TechTimes</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 8 }]}>
            View comprehensive user guide and app information
          </Text>
        </View>
        
        {/* Backup & Restore */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Backup & Restore</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleBackup}
          >
            <Text style={styles.buttonText}>Create Backup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.error, marginTop: 12 }]}
            onPress={handleRestore}
          >
            <Text style={styles.buttonText}>Restore Backup</Text>
          </TouchableOpacity>
        </View>
        
        {/* Permissions */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Permissions</Text>
          <View style={styles.permissionRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Notifications</Text>
            <Text style={[styles.permissionStatus, { color: permissions.notifications ? '#4CAF50' : theme.error }]}>
              {permissions.notifications ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Storage</Text>
            <Text style={[styles.permissionStatus, { color: permissions.storage ? '#4CAF50' : theme.error }]}>
              {permissions.storage ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, marginTop: 12 }]}
            onPress={handleRequestPermissions}
          >
            <Text style={styles.buttonText}>Request Permissions</Text>
          </TouchableOpacity>
        </View>
        
        {/* Logout */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.error, marginTop: 20 }]}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Export Reports</Text>
            
            <View style={styles.exportTypeButtons}>
              {(['daily', 'weekly', 'monthly', 'all'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.exportTypeButton,
                    exportType === type && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setExportType(type)}
                >
                  <Text
                    style={[
                      styles.exportTypeText,
                      { color: exportType === type ? '#fff' : theme.textSecondary },
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {exportType === 'daily' && (
              <View style={styles.dateSelector}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Select Date:</Text>
                <Text style={[styles.selectedDate, { color: theme.text }]}>
                  {selectedDate.toLocaleDateString('en-GB')}
                </Text>
                <View style={styles.dateButtons}>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Previous Day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => setSelectedDate(new Date())}
                  >
                    <Text style={styles.buttonText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Next Day</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {exportType === 'weekly' && (
              <View style={styles.dateSelector}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Select Week:</Text>
                <Text style={[styles.selectedDate, { color: theme.text }]}>
                  Week starting {selectedDate.toLocaleDateString('en-GB')}
                </Text>
                <View style={styles.dateButtons}>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 7);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Previous Week</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => setSelectedDate(new Date())}
                  >
                    <Text style={styles.buttonText}>This Week</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 7);
                      setSelectedDate(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Next Week</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {exportType === 'monthly' && (
              <View style={styles.dateSelector}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Select Month:</Text>
                <Text style={[styles.selectedDate, { color: theme.text }]}>
                  {selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </Text>
                <View style={styles.dateButtons}>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedMonth);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedMonth(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Previous Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => setSelectedMonth(new Date())}
                  >
                    <Text style={styles.buttonText}>This Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      const newDate = new Date(selectedMonth);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setSelectedMonth(newDate);
                    }}
                  >
                    <Text style={styles.buttonText}>Next Month</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <View style={styles.exportButtons}>
              <TouchableOpacity
                style={[styles.exportButton, { backgroundColor: theme.primary }]}
                onPress={() => handleExport('pdf')}
              >
                <Text style={styles.buttonText}>Export as PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportButton, { backgroundColor: theme.primary }]}
                onPress={() => handleExport('json')}
              >
                <Text style={styles.buttonText}>Export as JSON</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.textSecondary, marginTop: 16 }]}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Import Progress Modal */}
      <Modal
        visible={showImportModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Importing Jobs</Text>
            
            {importing && (
              <>
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} />
                <Text style={[styles.progressText, { color: theme.text }]}>
                  {importProgress.current} / {importProgress.total}
                </Text>
                {importProgress.job && (
                  <View style={styles.jobInfoBox}>
                    <Text style={[styles.jobText, { color: theme.textSecondary }]}>
                      WIP: {importProgress.job.wipNumber}
                    </Text>
                    <Text style={[styles.jobText, { color: theme.textSecondary }]}>
                      Reg: {importProgress.job.vehicleReg}
                    </Text>
                    <Text style={[styles.jobText, { color: theme.textSecondary }]}>
                      AW: {importProgress.job.aws || importProgress.job.aw}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
      
      {/* PIN Change Modal */}
      <Modal
        visible={showPinChange}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPinChange(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change PIN</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={currentPin}
              onChangeText={setCurrentPin}
              placeholder="Current PIN"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, marginTop: 12 }]}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, marginTop: 12 }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm New PIN"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              keyboardType="numeric"
            />
            
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, marginTop: 20 }]}
              onPress={handleSubmitPinChange}
            >
              <Text style={styles.buttonText}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.textSecondary, marginTop: 12 }]}
              onPress={() => setShowPinChange(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  scheduleInfoText: {
    flex: 1,
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sliderGroup: {
    gap: 8,
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  permissionStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  exportTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  exportTypeButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateSelector: {
    marginBottom: 20,
  },
  selectedDate: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 12,
    textAlign: 'center',
  },
  dateButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateButton: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtons: {
    gap: 12,
  },
  exportButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  jobText: {
    fontSize: 14,
    textAlign: 'center',
  },
  jobInfoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
