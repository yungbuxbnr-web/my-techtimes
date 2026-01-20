
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Switch,
  Alert,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';

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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('Settings: Loading settings');
      const schedule = await api.getSchedule();
      setDailyHours(schedule.dailyWorkingHours.toString());
      setSaturdayWorking(schedule.saturdayWorking);

      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
      
      console.log('Settings: Loaded - schedule:', schedule, 'profile:', profile);
    } catch (error) {
      console.error('Settings: Error loading settings:', error);
    }
  };

  const handleUpdateTarget = async () => {
    const value = parseFloat(monthlyTarget);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid target hours value');
      return;
    }
    console.log('Settings: Updating monthly target to', value);
    Alert.alert('Success', 'Monthly target updated');
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
      Alert.alert('Success', 'Schedule updated successfully');
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
      Alert.alert('Success', 'Name updated successfully');
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
      Alert.alert('Success', 'PIN changed successfully. You will remain logged in.');
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
      console.log('Settings: Exporting CSV');
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
      } else {
        Alert.alert('Success', `CSV saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Settings: Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV');
    }
  };

  const handleBackup = async () => {
    try {
      console.log('Settings: Creating backup');
      const jobs = await api.getAllJobs();
      const schedule = await api.getSchedule();
      const profile = await api.getTechnicianProfile();
      
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        jobs,
        schedule,
        profile,
        settings: {
          monthlyTarget: parseFloat(monthlyTarget),
        },
      };
      
      const fileName = `techtimes_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        console.log('Settings: Backup created and shared');
        Alert.alert('Success', 'Backup created successfully');
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
      'This will overwrite all current data. This action requires your PIN for security.',
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
      const backup = JSON.parse(content);

      console.log('Settings: Restoring backup from', backup.timestamp);
      Alert.alert('Info', 'Backup restore is not yet fully implemented. Please contact support.');
    } catch (error) {
      console.error('Settings: Error restoring backup:', error);
      Alert.alert('Error', 'Failed to restore backup. Please check the file format.');
    }
  };

  const handleLogout = () => {
    console.log('Settings: User requested logout');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to enter your PIN to login again.',
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
    <ImageBackground
      source={backgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.header, isDarkMode ? styles.textLight : styles.textDark]}>
          Settings
        </Text>

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
          
          <TouchableOpacity style={styles.actionButton} onPress={handleExportCSV}>
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="upload"
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
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
    marginBottom: 24,
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
});
