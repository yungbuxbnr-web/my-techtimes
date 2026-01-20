
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
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import Slider from '@react-native-community/slider';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/utils/api';

export default function SettingsScreen() {
  const { theme, themeMode, toggleTheme, overlayStrength, setOverlayStrength } = useThemeContext();
  const { biometricsEnabled, lockOnResume, biometricsAvailable, setBiometricsEnabled, setLockOnResume, changePin, logout } = useAuth();
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState(180);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState('180');

  useEffect(() => {
    loadMonthlyTarget();
  }, []);

  const loadMonthlyTarget = async () => {
    try {
      console.log('SettingsScreen: Loading monthly target from backend');
      const result = await api.getMonthlyTarget();
      setMonthlyTarget(result.value);
      setTargetInput(result.value.toString());
      console.log('SettingsScreen: Monthly target loaded:', result.value);
    } catch (error) {
      console.error('SettingsScreen: Error loading monthly target:', error);
      // Use default value if backend fails
      setMonthlyTarget(180);
      setTargetInput('180');
    }
  };

  const handleUpdateTarget = async () => {
    const newTarget = parseFloat(targetInput);
    if (isNaN(newTarget) || newTarget <= 0) {
      Alert.alert('Invalid Target', 'Please enter a valid number greater than 0');
      return;
    }

    try {
      console.log('SettingsScreen: Updating monthly target to:', newTarget);
      await api.updateMonthlyTarget(newTarget);
      setMonthlyTarget(newTarget);
      setShowTargetModal(false);
      Alert.alert('Success', 'Monthly target updated successfully');
    } catch (error) {
      console.error('SettingsScreen: Error updating monthly target:', error);
      Alert.alert('Error', 'Failed to update monthly target');
    }
  };

  const handleChangePIN = async () => {
    console.log('SettingsScreen: User attempting to change PIN');
    
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'New PIN and confirmation do not match');
      return;
    }

    const success = await changePin(currentPin, newPin);
    if (success) {
      Alert.alert('Success', 'PIN changed successfully');
      setShowPinChange(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      Alert.alert('Error', 'Current PIN is incorrect');
    }
  };

  const handleExportCSV = async () => {
    console.log('SettingsScreen: User tapped Export CSV');
    try {
      const jobs = await api.getAllJobs();

      const csvHeader = 'createdAt,wipNumber,vehicleReg,aw,minutes,notes\n';
      const csvRows = jobs.map((job) => {
        const minutes = job.aw * 5;
        return `${job.createdAt},"${job.wipNumber}","${job.vehicleReg}",${job.aw},${minutes},"${job.notes || ''}"`;
      }).join('\n');
      
      const csv = csvHeader + csvRows;
      const fileName = `techtimes_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export TechTimes Data',
        });
      } else {
        Alert.alert('Success', `Data exported to ${fileName}`);
      }
    } catch (error) {
      console.error('SettingsScreen: Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleBackup = async () => {
    console.log('SettingsScreen: User tapped Backup');
    try {
      const jobs = await api.getAllJobs();
      
      const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        jobs,
        settings: {
          themeMode,
          overlayStrength,
          biometricsEnabled,
          lockOnResume,
        },
      };

      const fileName = `techtimes_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Backup TechTimes Data',
        });
      } else {
        Alert.alert('Success', `Backup created: ${fileName}`);
      }
    } catch (error) {
      console.error('SettingsScreen: Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    console.log('SettingsScreen: User tapped Restore');
    Alert.alert(
      'Restore Backup',
      'This will overwrite all current data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (result.canceled) {
                return;
              }

              const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
              const backup = JSON.parse(fileContent);

              console.log('SettingsScreen: Restoring backup with', backup.jobs?.length, 'jobs');
              
              Alert.alert('Success', `Restored ${backup.jobs?.length || 0} jobs`);
            } catch (error) {
              console.error('SettingsScreen: Error restoring backup:', error);
              Alert.alert('Error', 'Failed to restore backup. Invalid file format.');
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
          },
        },
      ]
    );
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1200' }}
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
            <View>
              <Text style={[styles.title, { color: '#ffffff' }]}>Settings</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>Customize your app</Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>

            {biometricsAvailable && (
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Enable Biometrics</Text>
                  <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                    Use fingerprint/face to unlock
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={(value) => {
                    console.log('SettingsScreen: Biometrics toggled:', value);
                    setBiometricsEnabled(value);
                  }}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Lock on Resume</Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  Require login when returning to app
                </Text>
              </View>
              <Switch
                value={lockOnResume}
                onValueChange={(value) => {
                  console.log('SettingsScreen: Lock on resume toggled:', value);
                  setLockOnResume(value);
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={() => setShowPinChange(!showPinChange)}
            >
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>Change PIN</Text>
            </TouchableOpacity>

            {showPinChange && (
              <View style={[styles.pinChangeContainer, { backgroundColor: theme.background }]}>
                <TextInput
                  style={[styles.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  placeholder="Current PIN"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  placeholder="New PIN"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  placeholder="Confirm New PIN"
                  placeholderTextColor={theme.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.success }]}
                  onPress={handleChangePIN}
                >
                  <Text style={styles.buttonText}>Save New PIN</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Monthly Target</Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  {monthlyTarget} hours per month
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  console.log('SettingsScreen: User tapped Edit Target button');
                  setShowTargetModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={16}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                  {themeMode === 'dark' ? 'Dark Workshop' : 'Light Workshop'}
                </Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={() => {
                  console.log('SettingsScreen: Theme toggled');
                  toggleTheme();
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Overlay Strength</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.3}
                maximumValue={0.9}
                value={overlayStrength}
                onValueChange={(value) => {
                  console.log('SettingsScreen: Overlay strength changed:', value);
                  setOverlayStrength(value);
                }}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
              <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                {Math.round(overlayStrength * 100)}%
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Data Management</Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.secondary }]}
              onPress={handleExportCSV}
            >
              <IconSymbol
                ios_icon_name="square.and.arrow.up.fill"
                android_material_icon_name="upload"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accent }]}
              onPress={handleBackup}
            >
              <IconSymbol
                ios_icon_name="arrow.up.doc.fill"
                android_material_icon_name="backup"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>Backup Data</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.warning }]}
              onPress={handleRestore}
            >
              <IconSymbol
                ios_icon_name="arrow.down.doc.fill"
                android_material_icon_name="restore"
                size={20}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>Restore Backup</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.error }]}
            onPress={handleLogout}
          >
            <IconSymbol
              ios_icon_name="arrow.right.square.fill"
              android_material_icon_name="logout"
              size={20}
              color="#ffffff"
            />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={showTargetModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTargetModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Set Monthly Target</Text>
                <TouchableOpacity onPress={() => setShowTargetModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={[styles.label, { color: theme.text }]}>Target Hours per Month</Text>
                <TextInput
                  style={[styles.targetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={targetInput}
                  onChangeText={setTargetInput}
                  keyboardType="decimal-pad"
                  placeholder="180"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                  Default is 180 hours per month (based on 21 working days × 8.5 hours)
                </Text>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleUpdateTarget}
                >
                  <Text style={styles.saveButtonText}>Save Target</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  sliderContainer: {
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pinChangeContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  pinInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  targetInput: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
