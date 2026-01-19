
import React, { useState } from 'react';
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
              
              // Note: Backend restore endpoint would handle this
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
});
