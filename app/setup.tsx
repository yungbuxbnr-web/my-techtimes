
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

const PIN_KEY = 'user_pin';
const SETUP_COMPLETE_KEY = 'setup_complete';

export default function SetupScreen() {
  const router = useRouter();
  const { isDarkMode } = useThemeContext();
  
  const [step, setStep] = useState<'name' | 'pin' | 'confirm'>('name');
  const [technicianName, setTechnicianName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('Setup: Current step:', step);

  const handleNameSubmit = () => {
    console.log('Setup: Submitting technician name:', technicianName);
    if (!technicianName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    setStep('pin');
  };

  const handlePinSubmit = () => {
    console.log('Setup: Submitting PIN, length:', pin.length);
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
    console.log('Setup: Confirming PIN');
    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      console.log('Setup: Saving technician profile to backend');
      // Save technician profile to backend
      await api.updateTechnicianProfile({ name: technicianName.trim() });
      
      console.log('Setup: Saving PIN to secure storage');
      // Save PIN to secure storage
      await SecureStore.setItemAsync(PIN_KEY, pin);
      
      console.log('Setup: Marking setup as complete');
      // Mark setup as complete
      await SecureStore.setItemAsync(SETUP_COMPLETE_KEY, 'true');
      
      console.log('Setup: Setup complete, navigating to login');
      // Navigate to login screen
      router.replace('/pin-login');
    } catch (error) {
      console.error('Setup: Error completing setup:', error);
      Alert.alert('Error', 'Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        Step 1 of 2
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
        onPress={() => setStep('name')}
      >
        <Text style={[styles.backButtonText, isDarkMode ? styles.textLight : styles.textDark]}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
        Step 2 of 2
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
          setConfirmPin('');
          setStep('pin');
        }}
      >
        <Text style={[styles.backButtonText, isDarkMode ? styles.textLight : styles.textDark]}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.stepIndicator, isDarkMode ? styles.textLight : styles.textDark]}>
        Step 2 of 2
      </Text>
    </View>
  );

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
});
