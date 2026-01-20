
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
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { offlineStorage } from '@/utils/offlineStorage';
import AppBackground from '@/components/AppBackground';
import { exportToPdf, exportToJson, importFromJson, ExportOptions } from '@/utils/exportUtils';
import { requestAllPermissions, checkPermissions, showPermissionsInfo } from '@/utils/permissions';

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme, overlayStrength, setOverlayStrength, backgroundImage } = useThemeContext();
  const { 
    biometricsEnabled, 
    lockOnResume, 
    biometricsAvailable,
    setBiometricsEnabled, 
    setLockOnResume, 
    changePin,
    logout,
  } = useAuth();

  const [monthlyTarget, setMonthlyTarget] = useState('180');
  const [dailyHours, setDailyHours] = useState('8.5');
  const [saturdayWorking, setSaturdayWorking] = useState(false);
  const [technicianName, setTechnicianName] = useState('');
  
  // Change PIN modal
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  
  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'json'>('pdf');
  const [exportRange, setExportRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, job: null as any });
  
  // Permissions
  const [permissions, setPermissions] = useState({ notifications: false, storage: false });

  useEffect(() => {
    loadSettings();
    checkAppPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('Settings: Loading settings from local storage');
      const schedule = await api.getSchedule();
      setDailyHours(schedule.dailyWorkingHours.toString());
      setSaturdayWorking(schedule.saturdayWorking);

      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);

      const target = await api.getMonthlyTarget();
      setMonthlyTarget(target.value.toString());
      
      // Set default month to current
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      setSelectedDay(now.toISOString().split('T')[0]);
      
      console.log('Settings: Loaded - schedule:', schedule, 'profile:', profile, 'target:', target.value);
    } catch (error) {
      console.error('Settings: Error loading settings:', error);
    }
  };
  
  const checkAppPermissions = async () => {
    const perms = await checkPermissions();
    setPermissions(perms);
  };
  
  const handleRequestPermissions = async () => {
    console.log('Settings: User requesting app permissions');
    const perms = await requestAllPermissions();
    setPermissions(perms);
    
    if (perms.notifications && perms.storage) {
      Alert.alert('Success', 'All permissions granted successfully!');
    } else {
      Alert.alert(
        'Permissions',
        'Some permissions were not granted. You can enable them later in your device settings.'
      );
    }
  };

  const handleUpdateTarget = async () => {
    const value = parseFloat(monthlyTarget);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid target hours value');
      return;
    }
    try {
      console.log('Settings: Updating monthly target to', value);
      await api.updateMonthlyTarget(value);
      Alert.alert('Success', 'Monthly target updated and saved to device');
    } catch (error) {
      console.error('Settings: Error updating target:', error);
      Alert.alert('Error', 'Failed to update target');
    }
  };

  const handleUpdateSchedule = async () => {
    const hours = parseFloat(dailyHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Invalid Input', 'Please enter valid daily working hours (0-24)');
      return;
    }

    try {
      console.log('Settings: Updating schedule - hours:', hours, 'saturday:', saturdayWorking);
      await api.updateSchedule({
        dailyWorkingHours: hours,
        saturdayWorking,
      });
      Alert.alert('Success', 'Schedule updated and saved to device');
    } catch (error) {
      console.error('Settings: Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    }
  };

  const handleUpdateName = async () => {
    if (!technicianName.trim()) {
      Alert.alert('Invalid Input', 'Please enter your name');
      return;
    }

    try {
      console.log('Settings: Updating technician name to', technicianName);
      await api.updateTechnicianProfile({ name: technicianName.trim() });
      Alert.alert('Success', 'Name updated and saved to device');
    } catch (error) {
      console.error('Settings: Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleChangePIN = async () => {
    console.log('Settings: Opening change PIN modal');
    setShowChangePinModal(true);
  };

  const handleSubmitPinChange = async () => {
    console.log('Settings: Submitting PIN change');
    
    if (!currentPin || !newPin || !confirmNewPin) {
      Alert.alert('Required', 'Please fill in all PIN fields');
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      Alert.alert('Invalid PIN', 'New PIN must be 4-6 digits');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must contain only numbers');
      return;
    }

    if (newPin !== confirmNewPin) {
      Alert.alert('PIN Mismatch', 'New PIN and confirmation do not match');
      return;
    }

    const success = await changePin(currentPin, newPin);
    
    if (success) {
      console.log('Settings: PIN changed successfully');
      Alert.alert('Success', 'PIN changed successfully and saved securely on device. You will remain logged in.');
      setShowChangePinModal(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } else {
      console.log('Settings: Current PIN incorrect');
      Alert.alert('Error', 'Current PIN is incorrect');
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    console.log('Settings: Toggling biometrics to', value);
    
    if (value && !biometricsAvailable) {
      Alert.alert(
        'Biometrics Not Available',
        'Your device does not have biometrics enrolled. Please set up fingerprint or face recognition in your device settings first.'
      );
      return;
    }

    if (value) {
      // Require PIN before enabling biometrics
      Alert.prompt(
        'Enable Biometrics',
        'Enter your PIN to enable biometric authentication',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async (pin) => {
              if (pin) {
                const success = await setBiometricsEnabled(true);
                if (success) {
                  Alert.alert('Success', 'Biometric authentication enabled');
                } else {
                  Alert.alert('Error', 'Failed to enable biometrics');
                }
              }
            },
          },
        ],
        'secure-text'
      );
    } else {
      await setBiometricsEnabled(false);
      Alert.alert('Success', 'Biometric authentication disabled');
    }
  };

  const handleExportCSV = async () => {
    try {
      console.log('Settings: Exporting CSV from local storage');
      const jobs = await api.getAllJobs();
      
      const csvHeader = 'Created At,WIP Number,Vehicle Reg,AW,Minutes,Notes,VHC Status\n';
      const csvRows = jobs.map(job => {
        const minutes = job.aw * 5;
        return `${job.createdAt},"${job.wipNumber}","${job.vehicleReg}",${job.aw},${minutes},"${job.notes || ''}","${job.vhcStatus || 'N/A'}"`;
      }).join('\n');
      
      const csv = csvHeader + csvRows;
      const fileName = `techtimes_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        console.log('Settings: CSV exported and shared');
        Alert.alert('Success', 'CSV exported successfully from local device storage');
      } else {
        Alert.alert('Success', `CSV saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Settings: Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV');
    }
  };
  
  const handleOpenExportModal = () => {
    console.log('Settings: Opening export modal');
    setShowExportModal(true);
  };
  
  const handleExport = async () => {
    console.log('Settings: Starting export -', exportType, exportRange);
    setExporting(true);
    
    try {
      let jobs = await api.getAllJobs();
      
      // Filter jobs based on range
      if (exportRange === 'daily') {
        jobs = jobs.filter(job => job.createdAt.startsWith(selectedDay));
      } else if (exportRange === 'weekly') {
        const weekStart = new Date(selectedMonth + '-01');
        weekStart.setDate(1 + (selectedWeek - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        jobs = jobs.filter(job => {
          const jobDate = new Date(job.createdAt);
          return jobDate >= weekStart && jobDate <= weekEnd;
        });
      } else if (exportRange === 'monthly') {
        jobs = jobs.filter(job => job.createdAt.startsWith(selectedMonth));
      }
      
      if (jobs.length === 0) {
        Alert.alert('No Data', 'No jobs found for the selected period');
        setExporting(false);
        return;
      }
      
      const profile = await api.getTechnicianProfile();
      
      if (exportType === 'pdf') {
        await exportToPdf(jobs, profile.name, {
          type: exportRange,
          month: selectedMonth,
          week: selectedWeek,
          day: selectedDay,
        });
        Alert.alert('Success', 'PDF report exported successfully!');
      } else {
        await exportToJson(jobs);
        Alert.alert('Success', 'JSON data exported successfully!');
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Settings: Error exporting:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };
  
  const handleOpenImportModal = async () => {
    console.log('Settings: Opening import modal');
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      setShowImportModal(true);
      setImporting(true);
      
      await importFromJson(
        fileUri,
        async (current, total, job) => {
          console.log('Settings: Importing job', current, 'of', total);
          setImportProgress({ current, total, job });
          
          // Import the job
          await api.createJob({
            wipNumber: job.wipNumber,
            vehicleReg: job.vehicleReg,
            aw: job.aw,
            notes: job.notes,
            vhcStatus: job.vhcStatus,
            createdAt: job.createdAt,
          });
        }
      );
      
      setImporting(false);
      Alert.alert(
        'Import Complete',
        `Successfully imported ${importProgress.total} jobs!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowImportModal(false);
              setImportProgress({ current: 0, total: 0, job: null });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Settings: Error importing:', error);
      setImporting(false);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to import data');
    }
  };

  const handleBackup = async () => {
    try {
      console.log('Settings: Creating backup from local storage');
      const backupData = await offlineStorage.exportAllData();
      
      const fileName = `techtimes_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, backupData);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        console.log('Settings: Backup created and shared');
        Alert.alert('Success', 'Backup created successfully from local device storage. Save this file in a safe location.');
      } else {
        Alert.alert('Success', `Backup saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Settings: Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Backup',
      'This will overwrite all current data on this device. This action requires your PIN for security.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Enter PIN',
              'Enter your PIN to restore backup',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restore',
                  onPress: async (pin) => {
                    if (pin) {
                      await performRestore();
                    }
                  },
                },
              ],
              'secure-text'
            );
          },
        },
      ]
    );
  };

  const performRestore = async () => {
    try {
      console.log('Settings: Selecting backup file');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      console.log('Settings: Restoring backup to local storage');
      await offlineStorage.importAllData(content);
      
      Alert.alert(
        'Success', 
        'Backup restored successfully to device storage. Please restart the app to see the changes.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reload settings
              loadSettings();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Settings: Error restoring backup:', error);
      Alert.alert('Error', 'Failed to restore backup. Please check the file format.');
    }
  };

  const handleLogout = () => {
    console.log('Settings: User requested logout');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to enter your PIN to login again. All data remains safely stored on your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            console.log('Settings: Logging out');
            logout();
          },
        },
      ]
    );
  };

  return (
    <AppBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.header, isDarkMode ? styles.textLight : styles.textDark]}>
          Settings
        </Text>

        {/* Offline Mode Notice */}
        <View style={[styles.noticeCard, { backgroundColor: '#2196F3' }]}>
          <IconSymbol
            ios_icon_name="checkmark.shield.fill"
            android_material_icon_name="offline-pin"
            size={24}
            color="#ffffff"
          />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Offline Mode Active</Text>
            <Text style={styles.noticeText}>
              All data is stored securely on your device. No internet connection required.
            </Text>
          </View>
        </View>
        
        {/* Permissions Section */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            App Permissions
          </Text>
          
          <View style={styles.permissionRow}>
            <View style={styles.permissionLeft}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={24}
                color={permissions.notifications ? '#4CAF50' : '#999'}
              />
              <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                Notifications
              </Text>
            </View>
            <Text style={[styles.permissionStatus, { color: permissions.notifications ? '#4CAF50' : '#999' }]}>
              {permissions.notifications ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          
          <View style={styles.permissionRow}>
            <View style={styles.permissionLeft}>
              <IconSymbol
                ios_icon_name="folder.fill"
                android_material_icon_name="folder"
                size={24}
                color={permissions.storage ? '#4CAF50' : '#999'}
              />
              <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                Storage Access
              </Text>
            </View>
            <Text style={[styles.permissionStatus, { color: permissions.storage ? '#4CAF50' : '#999' }]}>
              {permissions.storage ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.updateButton} onPress={handleRequestPermissions}>
            <Text style={styles.updateButtonText}>Request Permissions</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.infoButton} onPress={showPermissionsInfo}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color="#2196F3"
            />
            <Text style={styles.infoButtonText}>Why does the app need these?</Text>
          </TouchableOpacity>
        </View>

        {/* Technician Profile */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Technician Profile
          </Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
              Full Name
            </Text>
            <TextInput
              style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder="Your name"
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
            />
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateName}>
              <Text style={styles.updateButtonText}>Update Name</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Settings */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Security
          </Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleChangePIN}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={24}
                color={isDarkMode ? '#fff' : '#000'}
              />
              <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                Change PIN
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={isDarkMode ? '#888' : '#999'}
            />
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="faceid"
                android_material_icon_name="fingerprint"
                size={24}
                color={isDarkMode ? '#fff' : '#000'}
              />
              <View>
                <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                  Enable Biometrics
                </Text>
                {!biometricsAvailable && (
                  <Text style={[styles.settingSubtext, isDarkMode ? styles.textLight : styles.textDark]}>
                    Not available on this device
                  </Text>
                )}
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              disabled={!biometricsAvailable}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="lock.shield"
                android_material_icon_name="lock"
                size={24}
                color={isDarkMode ? '#fff' : '#000'}
              />
              <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                Lock on Resume
              </Text>
            </View>
            <Switch
              value={lockOnResume}
              onValueChange={setLockOnResume}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Appearance
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="moon.fill"
                android_material_icon_name="dark-mode"
                size={24}
                color={isDarkMode ? '#fff' : '#000'}
              />
              <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
                Dark Workshop Theme
              </Text>
            </View>
            <Switch value={isDarkMode} onValueChange={toggleTheme} />
          </View>

          <View style={styles.sliderContainer}>
            <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
              Overlay Strength: {Math.round(overlayStrength * 100)}%
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={0.6}
              value={overlayStrength}
              onValueChange={setOverlayStrength}
              minimumTrackTintColor="#2196F3"
              maximumTrackTintColor={isDarkMode ? '#444' : '#ddd'}
            />
          </View>
        </View>

        {/* Work Schedule */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Work Schedule
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
              Daily Working Hours
            </Text>
            <TextInput
              style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
              value={dailyHours}
              onChangeText={setDailyHours}
              keyboardType="decimal-pad"
              placeholder="8.5"
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingText, isDarkMode ? styles.textLight : styles.textDark]}>
              Saturday Working
            </Text>
            <Switch value={saturdayWorking} onValueChange={setSaturdayWorking} />
          </View>

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdateSchedule}>
            <Text style={styles.updateButtonText}>Update Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Target */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Monthly Target
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
              Target Hours
            </Text>
            <TextInput
              style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
              value={monthlyTarget}
              onChangeText={setMonthlyTarget}
              keyboardType="decimal-pad"
              placeholder="180"
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
            />
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTarget}>
              <Text style={styles.updateButtonText}>Update Target</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Management */}
        <View style={[styles.section, isDarkMode ? styles.sectionDark : styles.sectionLight]}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            Data Management
          </Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenExportModal}>
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="upload"
              size={24}
              color="#2196F3"
            />
            <Text style={styles.actionButtonText}>Export Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenImportModal}>
            <IconSymbol
              ios_icon_name="square.and.arrow.down"
              android_material_icon_name="download"
              size={24}
              color="#4CAF50"
            />
            <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Import Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleExportCSV}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={24}
              color="#2196F3"
            />
            <Text style={styles.actionButtonText}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleBackup}>
            <IconSymbol
              ios_icon_name="arrow.up.doc"
              android_material_icon_name="backup"
              size={24}
              color="#2196F3"
            />
            <Text style={styles.actionButtonText}>Create Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleRestore}>
            <IconSymbol
              ios_icon_name="arrow.down.doc"
              android_material_icon_name="restore"
              size={24}
              color="#FF9800"
            />
            <Text style={[styles.actionButtonText, { color: '#FF9800' }]}>
              Restore Backup
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal
        visible={showChangePinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode ? styles.modalDark : styles.modalLight]}>
            <Text style={[styles.modalTitle, isDarkMode ? styles.textLight : styles.textDark]}>
              Change PIN
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                Current PIN
              </Text>
              <TextInput
                style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                value={currentPin}
                onChangeText={setCurrentPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Enter current PIN"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                New PIN (4-6 digits)
              </Text>
              <TextInput
                style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                value={newPin}
                onChangeText={setNewPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Enter new PIN"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                Confirm New PIN
              </Text>
              <TextInput
                style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                value={confirmNewPin}
                onChangeText={setConfirmNewPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Confirm new PIN"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowChangePinModal(false);
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSubmitPinChange}
              >
                <Text style={styles.modalButtonTextConfirm}>Change PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode ? styles.modalDark : styles.modalLight]}>
            <Text style={[styles.modalTitle, isDarkMode ? styles.textLight : styles.textDark]}>
              Export Reports
            </Text>
            
            <View style={styles.modalInputGroup}>
              <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                Export Format
              </Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportType('pdf')}
                >
                  <View style={[styles.radio, exportType === 'pdf' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    PDF Report (Stylish)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportType('json')}
                >
                  <View style={[styles.radio, exportType === 'json' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    JSON Data
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.modalInputGroup}>
              <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                Export Range
              </Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportRange('daily')}
                >
                  <View style={[styles.radio, exportRange === 'daily' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    Daily
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportRange('weekly')}
                >
                  <View style={[styles.radio, exportRange === 'weekly' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    Weekly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportRange('monthly')}
                >
                  <View style={[styles.radio, exportRange === 'monthly' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    Monthly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setExportRange('all')}
                >
                  <View style={[styles.radio, exportRange === 'all' && styles.radioSelected]} />
                  <Text style={[styles.radioLabel, isDarkMode ? styles.textLight : styles.textDark]}>
                    All Data
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {exportRange === 'daily' && (
              <View style={styles.modalInputGroup}>
                <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                  Select Day
                </Text>
                <TextInput
                  style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                  value={selectedDay}
                  onChangeText={setSelectedDay}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                />
              </View>
            )}
            
            {exportRange === 'weekly' && (
              <>
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                    Select Month
                  </Text>
                  <TextInput
                    style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                    value={selectedMonth}
                    onChangeText={setSelectedMonth}
                    placeholder="YYYY-MM"
                    placeholderTextColor={isDarkMode ? '#888' : '#999'}
                  />
                </View>
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                    Select Week (1-5)
                  </Text>
                  <TextInput
                    style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                    value={selectedWeek.toString()}
                    onChangeText={(text) => setSelectedWeek(parseInt(text) || 1)}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={isDarkMode ? '#888' : '#999'}
                  />
                </View>
              </>
            )}
            
            {exportRange === 'monthly' && (
              <View style={styles.modalInputGroup}>
                <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
                  Select Month
                </Text>
                <TextInput
                  style={[styles.input, isDarkMode ? styles.inputDark : styles.inputLight]}
                  value={selectedMonth}
                  onChangeText={setSelectedMonth}
                  placeholder="YYYY-MM"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                />
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowExportModal(false)}
                disabled={exporting}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Export</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Import Progress Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode ? styles.modalDark : styles.modalLight]}>
            <Text style={[styles.modalTitle, isDarkMode ? styles.textLight : styles.textDark]}>
              Importing Jobs
            </Text>
            
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={[styles.progressText, isDarkMode ? styles.textLight : styles.textDark]}>
                {importProgress.current} of {importProgress.total}
              </Text>
              {importProgress.job && (
                <View style={styles.currentJobInfo}>
                  <Text style={[styles.currentJobText, isDarkMode ? styles.textLight : styles.textDark]}>
                    WIP: {importProgress.job.wipNumber}
                  </Text>
                  <Text style={[styles.currentJobText, isDarkMode ? styles.textLight : styles.textDark]}>
                    Reg: {importProgress.job.vehicleReg}
                  </Text>
                </View>
              )}
            </View>
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
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noticeText: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.9,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  sectionDark: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  permissionStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 8,
  },
  infoButtonText: {
    color: '#2196F3',
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 16,
  },
  settingSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#fff',
    borderColor: '#2196F3',
    color: '#000',
  },
  inputDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2196F3',
    color: '#fff',
  },
  sliderContainer: {
    marginTop: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  updateButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalLight: {
    backgroundColor: '#fff',
  },
  modalDark: {
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  radioSelected: {
    backgroundColor: '#2196F3',
  },
  radioLabel: {
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#666',
  },
  modalButtonConfirm: {
    backgroundColor: '#2196F3',
  },
  modalButtonTextCancel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  currentJobInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  currentJobText: {
    fontSize: 14,
    marginTop: 4,
  },
});
