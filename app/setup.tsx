
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useThemeContext } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import AppBackground from '@/components/AppBackground';
import { SetupCompleteScreen } from '@/components/SetupCompleteScreen';
import { activityLogger } from '@/utils/activityLogger';
import { requestAllPermissions } from '@/utils/permissions';

const PIN_KEY = 'user_pin';
const SETUP_COMPLETE_KEY = 'setup_complete';

// Helper functions for cross-platform storage
async function setSecureItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

export default function SetupScreen() {
  const router = useRouter();
  const { isDarkMode } = useThemeContext();

  const [step, setStep] = useState<'name' | 'pin' | 'confirm' | 'permissions' | 'complete'>('name');
  const [technicianName, setTechnicianName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<Record<string, boolean>>({});
  const [requestingPermissions, setRequestingPermissions] = useState(false);

  const handleNameSubmit = () => {
    console.log('Setup: Name step — Continue pressed, name:', technicianName.trim());
    activityLogger.info('SETUP', 'Name submitted', { name: technicianName.trim() });
    if (!technicianName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    setStep('pin');
  };

  const handlePinSubmit = () => {
    console.log('Setup: PIN step — Continue pressed, PIN length:', pin.length);
    activityLogger.info('SETUP', 'PIN submitted');
    if (pin.length < 4 || pin.length > 6) {
      Alert.alert('Invalid PIN', 'PIN must be 4-6 digits');
      return;
    }
    if (!/^\d+$/.test(pin)) {
      Alert.alert('Invalid PIN', 'PIN must contain only numbers');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmPinSubmit = async () => {
    console.log('Setup: Confirm PIN step — Finish Setup pressed');
    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      activityLogger.info('SETUP', 'Saving profile to backend');
      await api.updateTechnicianProfile({ name: technicianName.trim() });
      console.log('Setup: Profile saved to backend');

      await setSecureItem(PIN_KEY, pin);
      console.log('Setup: PIN saved to secure storage');

      await setSecureItem(SETUP_COMPLETE_KEY, 'true');
      console.log('Setup: Setup marked complete — proceeding to permissions step');

      activityLogger.info('SETUP', 'Setup complete — showing permissions step');
      setStep('permissions');
    } catch (error) {
      console.error('Setup: Error completing setup:', error);
      activityLogger.error('SETUP', 'Setup failed', { error: String(error) });
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
      setLoading(false);
    }
  };

  const handleGrantPermissions = async () => {
    console.log('Setup: Permissions step — Grant Permissions pressed');
    setRequestingPermissions(true);
    try {
      const results = await requestAllPermissions();
      console.log('Setup: Permission results:', results);
      setPermissionsGranted({
        notifications: results.notifications,
        camera: results.camera,
        mediaLibrary: results.mediaLibrary,
        background: results.background,
      });
      setTimeout(() => {
        console.log('Setup: Permissions done — proceeding to complete animation');
        setStep('complete');
      }, 800);
    } catch {
      console.log('Setup: Permission request error — skipping to complete');
      setStep('complete');
    } finally {
      setRequestingPermissions(false);
    }
  };

  const handleSkipPermissions = () => {
    console.log('Setup: Permissions step — Skip for now pressed');
    setStep('complete');
  };

  const handleSetupComplete = () => {
    console.log('Setup: Animation complete — navigating to pin-login');
    activityLogger.info('SETUP', 'Navigating to pin-login after setup');
    router.replace('/pin-login');
  };

  // Show setup complete animation
  if (step === 'complete') {
    return (
      <SetupCompleteScreen
        technicianName={technicianName}
        onComplete={handleSetupComplete}
      />
    );
  }

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, isDarkMode ? styles.textLight : styles.textDark]}>
        Welcome to TechTimes
      </Text>
      <Text style={[styles.subtitle, isDarkMode ? styles.textLight : styles.textDark]}>
        Let&apos;s set up your profile
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
          Full Name *
        </Text>
        <TextInput
          style={[
            styles.input,
            isDarkMode ? styles.inputDark : styles.inputLight,
          ]}
          placeholder="Enter your full name"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={technicianName}
          onChangeText={setTechnicianName}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={handleNameSubmit}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleNameSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
        Step 1 of 3
      </Text>
    </View>
  );

  const renderPinStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, isDarkMode ? styles.textLight : styles.textDark]}>
        Create Security PIN
      </Text>
      <Text style={[styles.subtitle, isDarkMode ? styles.textLight : styles.textDark]}>
        Choose a 4-6 digit PIN to secure your app
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
          Enter PIN (4-6 digits) *
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.pinInput,
            isDarkMode ? styles.inputDark : styles.inputLight,
          ]}
          placeholder="••••"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          returnKeyType="next"
          onSubmitEditing={handlePinSubmit}
        />
      </View>

      <View style={styles.warningBox}>
        <Text style={[styles.warningText, isDarkMode ? styles.textLight : styles.textDark]}>
          ⚠️ Important: If you forget your PIN, you must reset the app. There is no recovery option.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePinSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          console.log('Setup: PIN step — Back pressed');
          setStep('name');
        }}
      >
        <Text style={[styles.backButtonText, isDarkMode ? styles.textLight : styles.textDark]}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
        Step 2 of 3
      </Text>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, isDarkMode ? styles.textLight : styles.textDark]}>
        Confirm Your PIN
      </Text>
      <Text style={[styles.subtitle, isDarkMode ? styles.textLight : styles.textDark]}>
        Enter your PIN again to confirm
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, isDarkMode ? styles.textLight : styles.textDark]}>
          Confirm PIN *
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.pinInput,
            isDarkMode ? styles.inputDark : styles.inputLight,
          ]}
          placeholder="••••"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={confirmPin}
          onChangeText={setConfirmPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={handleConfirmPinSubmit}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleConfirmPinSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Setting up...' : 'Finish Setup'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          console.log('Setup: Confirm PIN step — Back pressed');
          setConfirmPin('');
          setStep('pin');
        }}
      >
        <Text style={[styles.backButtonText, isDarkMode ? styles.textLight : styles.textDark]}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
        Step 2 of 3
      </Text>
    </View>
  );

  const renderPermissionsStep = () => {
    const permissions = [
      {
        key: 'notifications',
        icon: '🔔',
        name: 'Notifications',
        description: 'Work schedule reminders and daily alerts',
      },
      {
        key: 'camera',
        icon: '📷',
        name: 'Camera',
        description: 'Take photos for job records and profile',
      },
      {
        key: 'mediaLibrary',
        icon: '🖼️',
        name: 'Gallery',
        description: 'Import images from your photo library',
      },
      {
        key: 'background',
        icon: '⚙️',
        name: 'Background',
        description: 'Keep the live clock and widget updated',
      },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, isDarkMode ? styles.textLight : styles.textDark]}>
          App Permissions
        </Text>
        <Text style={[styles.subtitle, isDarkMode ? styles.textLight : styles.textDark]}>
          Grant the following permissions so TechTimes works fully
        </Text>

        <View style={styles.permissionsContainer}>
          {permissions.map((perm) => {
            const isGranted = permissionsGranted[perm.key] === true;
            const isPending = requestingPermissions && permissionsGranted[perm.key] === undefined;
            const statusIcon = isGranted ? '✅' : isPending ? '⏳' : '○';
            const statusColor = isGranted ? '#4CAF50' : isDarkMode ? '#666' : '#ccc';

            return (
              <View
                key={perm.key}
                style={[
                  styles.permissionRow,
                  isDarkMode ? styles.permissionRowDark : styles.permissionRowLight,
                ]}
              >
                <Text style={styles.permissionIcon}>{perm.icon}</Text>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionName, isDarkMode ? styles.textLight : styles.textDark]}>
                    {perm.name}
                  </Text>
                  <Text style={[styles.permissionDesc, isDarkMode ? styles.textMutedDark : styles.textMutedLight]}>
                    {perm.description}
                  </Text>
                </View>
                <Text style={[styles.permissionStatus, { color: statusColor }]}>
                  {statusIcon}
                </Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.button, requestingPermissions && styles.buttonDisabled]}
          onPress={handleGrantPermissions}
          disabled={requestingPermissions}
        >
          <Text style={styles.buttonText}>
            {requestingPermissions ? 'Requesting...' : 'Grant Permissions'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleSkipPermissions}
          disabled={requestingPermissions}
        >
          <Text style={[styles.backButtonText, isDarkMode ? styles.textLight : styles.textDark]}>
            Skip for now
          </Text>
        </TouchableOpacity>

        <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
          Step 3 of 3
        </Text>
      </View>
    );
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'name' && renderNameStep()}
          {step === 'pin' && renderPinStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'permissions' && renderPermissionsStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stepContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.8,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
  },
  inputLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#2196F3',
    color: '#000',
  },
  inputDark: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderColor: '#2196F3',
    color: '#fff',
  },
  pinInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    height: 56,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
  stepIndicator: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
    opacity: 0.6,
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#000',
  },
  // Permissions step styles
  permissionsContainer: {
    marginBottom: 28,
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  permissionRowLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  permissionRowDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  permissionIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  permissionStatus: {
    fontSize: 20,
    marginLeft: 10,
  },
  textMutedDark: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
  textMutedLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
});
