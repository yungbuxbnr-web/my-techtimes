
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { toastManager } from '@/utils/toastManager';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { api } from '@/utils/api';
import { offlineStorage } from '@/utils/offlineStorage';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { ProcessNotification } from '@/components/ProcessNotification';
import { requestAllPermissions, checkPermissions, showPermissionsInfo } from '@/utils/permissions';
import AppBackground from '@/components/AppBackground';
import * as FileSystem from 'expo-file-system/legacy';
import { exportToPdf, exportToJson, importFromJson, ExportOptions } from '@/utils/exportUtils';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen() {
  console.log('SettingsScreen: Rendering settings screen');
  const { theme, isDarkMode, toggleTheme, overlayStrength, setOverlayStrength } = useThemeContext();
  const { logout } = useAuth();
  
  const [technicianName, setTechnicianName] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('180');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [pinAuthEnabled, setPinAuthEnabled] = useState(true);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, job: null as any });
  const [isImporting, setIsImporting] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    loadSettings();
    checkAppPermissions();
  }, []);

  const loadSettings = async () => {
    console.log('SettingsScreen: Loading settings');
    try {
      const profile = await api.getTechnicianProfile();
      const settings = await api.getSettings();
      
      setTechnicianName(profile.name);
      setMonthlyTarget(settings.monthlyTarget.toString());
      
      console.log('SettingsScreen: Settings loaded');
    } catch (error) {
      console.error('SettingsScreen: Error loading settings:', error);
    }
  };

  const checkAppPermissions = async () => {
    const permissions = await checkPermissions();
    setHasPermissions(permissions.notifications && permissions.storage);
  };

  const handleRequestPermissions = async () => {
    console.log('SettingsScreen: User requesting permissions');
    await requestAllPermissions();
    await checkAppPermissions();
  };

  const handleUpdateTarget = async () => {
    console.log('SettingsScreen: Updating monthly target');
    const target = parseFloat(monthlyTarget);
    
    if (isNaN(target) || target <= 0) {
      Alert.alert('Error', 'Please enter a valid monthly target (greater than 0)');
      return;
    }
    
    try {
      await api.updateMonthlyTarget(target);
      toastManager.show('Monthly target updated successfully', 'success');
      console.log('SettingsScreen: Monthly target updated to', target);
    } catch (error) {
      console.error('SettingsScreen: Error updating target:', error);
      Alert.alert('Error', 'Failed to update monthly target');
    }
  };

  const handleUpdateName = async () => {
    console.log('SettingsScreen: Updating technician name');
    if (!technicianName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }
    
    try {
      await api.updateTechnicianProfile({ name: technicianName });
      toastManager.show('Name updated successfully', 'success');
      console.log('SettingsScreen: Name updated to', technicianName);
    } catch (error) {
      console.error('SettingsScreen: Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleChangePIN = () => {
    console.log('SettingsScreen: User tapped Change PIN');
    setShowChangePinModal(true);
  };

  const handleSubmitPinChange = async () => {
    console.log('SettingsScreen: Submitting PIN change');
    
    if (currentPin !== '3101') {
      Alert.alert('Error', 'Current PIN is incorrect');
      return;
    }
    
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert('Error', 'New PIN must be exactly 4 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'New PIN and confirmation do not match');
      return;
    }
    
    Alert.alert('Success', 'PIN changed successfully');
    setShowChangePinModal(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleToggleBiometrics = async (value: boolean) => {
    console.log('SettingsScreen: Toggling biometrics to', value);
    setBiometricsEnabled(value);
    toastManager.show(value ? 'Biometrics enabled' : 'Biometrics disabled', 'success');
  };

  const handleTogglePinAuth = async (value: boolean) => {
    console.log('SettingsScreen: Toggling PIN auth to', value);
    
    if (!value && !biometricsEnabled) {
      Alert.alert('Error', 'You must have either PIN or biometrics enabled for security');
      return;
    }
    
    setPinAuthEnabled(value);
    toastManager.show(value ? 'PIN authentication enabled' : 'PIN authentication disabled', 'success');
  };

  const handleOpenExportModal = () => {
    console.log('SettingsScreen: User tapped Export Data');
    setShowExportModal(true);
  };

  const [exportType, setExportType] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'json'>('json');

  const handleExport = async () => {
    console.log('SettingsScreen: Exporting as', exportFormat, 'type:', exportType);
    try {
      const profile = await api.getTechnicianProfile();
      const settings = await api.getSettings();
      const schedule = await api.getSchedule();
      
      // Get current date info
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentDay = now.toISOString().split('T')[0];
      
      // Get jobs based on export type
      let jobs = [];
      let exportOptions: ExportOptions = {
        type: exportType,
        targetHours: settings.monthlyTarget,
        availableHours: 0,
      };
      
      if (exportType === 'daily') {
        jobs = await api.getJobsForDay(currentDay);
        exportOptions.day = currentDay;
        const dayStats = await api.getDayStats(currentDay);
        exportOptions.availableHours = dayStats.availableHours;
      } else if (exportType === 'weekly') {
        // Get current week jobs
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Saturday
        
        jobs = await api.getAllJobs();
        jobs = jobs.filter(job => {
          const jobDate = new Date(job.createdAt);
          return jobDate >= weekStart && jobDate <= weekEnd;
        });
        
        const weekStats = await api.getWeekStats(weekStart.toISOString().split('T')[0]);
        exportOptions.availableHours = weekStats.availableHours;
      } else if (exportType === 'monthly') {
        jobs = await api.getJobsForMonth(currentMonth);
        exportOptions.month = currentMonth;
        const monthlyStats = await api.getMonthlyStats(currentMonth);
        exportOptions.availableHours = monthlyStats.availableHours;
      } else {
        jobs = await api.getAllJobs();
        const monthlyStats = await api.getMonthlyStats(currentMonth);
        exportOptions.availableHours = monthlyStats.availableHours;
      }
      
      if (exportFormat === 'pdf') {
        await exportToPdf(jobs, profile.name, exportOptions);
        toastManager.show(`${exportType.toUpperCase()} PDF exported successfully with efficiency bars`, 'success');
      } else {
        await exportToJson(jobs);
        toastManager.show(`${exportType.toUpperCase()} JSON exported successfully (priority format)`, 'success');
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('SettingsScreen: Error exporting:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleOpenImportModal = () => {
    console.log('SettingsScreen: User tapped Import Data');
    setShowImportModal(true);
  };

  const handleImportJobs = async () => {
    console.log('SettingsScreen: User starting import process');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log('SettingsScreen: User cancelled import');
        return;
      }
      
      const fileUri = result.assets[0].uri;
      console.log('SettingsScreen: Selected file:', fileUri);
      
      setIsImporting(true);
      setShowImportModal(false);
      
      const importResults = await importFromJson(
        fileUri,
        (current, total, job) => {
          setImportProgress({ current, total, job });
        }
      );
      
      console.log('SettingsScreen: Import results:', importResults);
      
      // Now import the jobs to the API
      let successCount = 0;
      let failCount = 0;
      
      for (const job of importResults.jobs) {
        try {
          await api.createJob(job);
          successCount++;
        } catch (error) {
          console.error('SettingsScreen: Error creating job:', error);
          failCount++;
        }
      }
      
      setIsImporting(false);
      
      if (importResults.errors.length > 0) {
        Alert.alert(
          'Import Complete with Warnings',
          `Successfully imported: ${successCount}\nFailed: ${failCount}\nSkipped: ${importResults.skipped}\n\nErrors:\n${importResults.errors.slice(0, 5).join('\n')}${importResults.errors.length > 5 ? '\n...' : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Import Successful',
          `Successfully imported ${successCount} job(s) from JSON backup.`,
          [{ text: 'OK' }]
        );
      }
      
      toastManager.show(`Imported ${successCount} jobs successfully`, 'success');
    } catch (error) {
      console.error('SettingsScreen: Error importing:', error);
      setIsImporting(false);
      Alert.alert('Error', `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBackup = async () => {
    console.log('SettingsScreen: Creating backup (JSON priority format)');
    try {
      const jobs = await api.getAllJobs();
      await exportToJson(jobs);
      toastManager.show('Backup created successfully', 'success');
    } catch (error) {
      console.error('SettingsScreen: Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    console.log('SettingsScreen: User tapped Restore');
    Alert.alert(
      'Restore Backup',
      'This will import jobs from a JSON backup file. Existing jobs will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: handleImportJobs,
        },
      ]
    );
  };

  const handleClearAllData = () => {
    console.log('SettingsScreen: User tapped Clear All Data');
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all jobs, settings, and data. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await offlineStorage.clearAllData();
              Alert.alert('Success', 'All data cleared. Please restart the app.');
            } catch (error) {
              console.error('SettingsScreen: Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    console.log('SettingsScreen: User tapped Logout');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/pin-login');
          },
        },
      ]
    );
  };

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 48 }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: '#ffffff' }]}>Settings</Text>
        </View>

        {!hasPermissions && (
          <View style={[styles.permissionsCard, { backgroundColor: theme.chartYellow }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={24}
              color="#000000"
            />
            <View style={styles.permissionsText}>
              <Text style={styles.permissionsTitle}>Permissions Required</Text>
              <Text style={styles.permissionsSubtitle}>
                Grant permissions for notifications and background tasks
              </Text>
            </View>
            <TouchableOpacity
              style={styles.permissionsButton}
              onPress={handleRequestPermissions}
            >
              <Text style={styles.permissionsButtonText}>Grant</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile</Text>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Technician Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder="Enter your name"
              placeholderTextColor={theme.textSecondary}
            />
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: theme.primary }]}
              onPress={handleUpdateName}
            >
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Monthly Target</Text>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Target Hours</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={monthlyTarget}
              onChangeText={setMonthlyTarget}
              placeholder="180"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: theme.primary }]}
              onPress={handleUpdateTarget}
            >
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Links</Text>
          
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/formulas')}
          >
            <IconSymbol
              ios_icon_name="function"
              android_material_icon_name="calculate"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.linkButtonText, { color: theme.text }]}>Formula Settings</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/job-stats')}
          >
            <IconSymbol
              ios_icon_name="chart.bar.fill"
              android_material_icon_name="bar-chart"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.linkButtonText, { color: theme.text }]}>Job Stats</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/edit-work-schedule')}
          >
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.linkButtonText, { color: theme.text }]}>Work Schedule</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/notification-settings')}
          >
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.linkButtonText, { color: theme.text }]}>Notifications</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
            Background Overlay Strength
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.3}
            maximumValue={0.9}
            value={overlayStrength}
            onValueChange={setOverlayStrength}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
          />
          <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
            {Math.round(overlayStrength * 100)}%
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>PIN Authentication</Text>
            <Switch
              value={pinAuthEnabled}
              onValueChange={handleTogglePinAuth}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Biometric Login</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={handleChangePIN}
          >
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Change PIN</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Data Management</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={handleOpenExportModal}
          >
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="share"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Export Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={handleBackup}
          >
            <IconSymbol
              ios_icon_name="arrow.up.doc"
              android_material_icon_name="backup"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Create Backup (JSON)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={handleRestore}
          >
            <IconSymbol
              ios_icon_name="arrow.down.doc"
              android_material_icon_name="restore"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>Import Jobs (JSON)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.chartRed }]}
            onPress={handleClearAllData}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#ffffff"
            />
            <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={() => router.push('/about')}
          >
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>About TechTimes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background }]}
            onPress={handleLogout}
          >
            <IconSymbol
              ios_icon_name="arrow.right.square"
              android_material_icon_name="exit-to-app"
              size={20}
              color={theme.chartRed}
            />
            <Text style={[styles.actionButtonText, { color: theme.chartRed }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={showChangePinModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Change PIN</Text>
              <TouchableOpacity onPress={() => setShowChangePinModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Current PIN"
              placeholderTextColor={theme.textSecondary}
              value={currentPin}
              onChangeText={setCurrentPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
            
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="New PIN"
              placeholderTextColor={theme.textSecondary}
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
            
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Confirm New PIN"
              placeholderTextColor={theme.textSecondary}
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={handleSubmitPinChange}
            >
              <Text style={styles.modalButtonText}>Change PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Export Data</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary, marginBottom: 12 }]}>
              Choose export period
            </Text>
            
            <View style={styles.exportTypeContainer}>
              {[
                { id: 'daily', label: 'Daily', icon: 'calendar-today' },
                { id: 'weekly', label: 'Weekly', icon: 'date-range' },
                { id: 'monthly', label: 'Monthly', icon: 'event' },
                { id: 'all', label: 'All Time', icon: 'history' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.exportTypeButton,
                    { borderColor: theme.border },
                    exportType === type.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setExportType(type.id as any)}
                >
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name={type.icon}
                    size={20}
                    color={exportType === type.id ? '#ffffff' : theme.text}
                  />
                  <Text
                    style={[
                      styles.exportTypeText,
                      { color: exportType === type.id ? '#ffffff' : theme.text },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary, marginTop: 20, marginBottom: 12 }]}>
              Choose export format
            </Text>
            
            <TouchableOpacity
              style={[
                styles.exportOption,
                { backgroundColor: exportFormat === 'json' ? theme.secondary : theme.background },
              ]}
              onPress={() => setExportFormat('json')}
            >
              <IconSymbol
                ios_icon_name="doc.fill"
                android_material_icon_name="insert-drive-file"
                size={24}
                color={exportFormat === 'json' ? '#ffffff' : theme.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionText, { color: exportFormat === 'json' ? '#ffffff' : theme.text }]}>
                  Export as JSON (Priority)
                </Text>
                <Text style={[styles.exportOptionSubtext, { color: exportFormat === 'json' ? '#ffffff' : theme.textSecondary }]}>
                  Best for backup & restore
                </Text>
              </View>
              {exportFormat === 'json' && (
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.exportOption,
                { backgroundColor: exportFormat === 'pdf' ? theme.primary : theme.background },
              ]}
              onPress={() => setExportFormat('pdf')}
            >
              <IconSymbol
                ios_icon_name="doc.text.fill"
                android_material_icon_name="description"
                size={24}
                color={exportFormat === 'pdf' ? '#ffffff' : theme.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionText, { color: exportFormat === 'pdf' ? '#ffffff' : theme.text }]}>
                  Export as PDF
                </Text>
                <Text style={[styles.exportOptionSubtext, { color: exportFormat === 'pdf' ? '#ffffff' : theme.textSecondary }]}>
                  With efficiency progress bars
                </Text>
              </View>
              {exportFormat === 'pdf' && (
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: theme.primary }]}
              onPress={handleExport}
            >
              <IconSymbol
                ios_icon_name="square.and.arrow.up"
                android_material_icon_name="share"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.exportButtonText}>Export {exportType.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isImporting && (
        <ProcessNotification
          visible={isImporting}
          message={`Importing job ${importProgress.current} of ${importProgress.total}`}
          progress={importProgress.current / importProgress.total}
        />
      )}
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
  header: {
    marginBottom: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  permissionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  permissionsText: {
    flex: 1,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  permissionsSubtitle: {
    fontSize: 12,
    color: '#000000',
    marginTop: 2,
  },
  permissionsButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  updateButton: {
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  linkButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
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
    padding: 24,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
  },
  pinInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    gap: 6,
  },
  exportTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  exportOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  exportOptionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
