
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import AppBackground from '@/components/AppBackground';

const PIN_KEY = 'user_pin';
const BIOMETRICS_KEY = 'biometrics_enabled';

// Helper functions for cross-platform storage
async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

export default function PinLoginScreen() {
  const router = useRouter();
  const { isDarkMode } = useThemeContext();
  
  const [pin, setPin] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    loadTechnicianName();
    checkBiometrics();
  }, []);

  const loadTechnicianName = async () => {
    try {
      console.log('PinLogin: Loading technician name');
      const profile = await api.getTechnicianProfile();
      if (profile && profile.name) {
        setTechnicianName(profile.name);
        console.log('PinLogin: Technician name loaded:', profile.name);
      }
    } catch (error) {
      console.error('PinLogin: Error loading technician name:', error);
    }
  };

  const checkBiometrics = async () => {
    try {
      // Biometrics only available on native platforms
      if (Platform.OS === 'web') {
        console.log('PinLogin: Biometrics not available on web');
        setBiometricsAvailable(false);
        return;
      }
      
      const enabled = await getSecureItem(BIOMETRICS_KEY);
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      const available = compatible && enrolled;
      setBiometricsAvailable(available);
      setBiometricsEnabled(enabled === 'true' && available);
      
      console.log('PinLogin: Biometrics - enabled:', enabled === 'true', 'available:', available);
    } catch (error) {
      console.error('PinLogin: Error checking biometrics:', error);
    }
  };

  const handleNumberPress = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      console.log('PinLogin: PIN length:', newPin.length);
      
      // Auto-verify when PIN reaches 4-6 digits
      if (newPin.length >= 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const verifyPin = async (enteredPin: string) => {
    try {
      console.log('PinLogin: Verifying PIN');
      const storedPin = await getSecureItem(PIN_KEY);
      
      if (!storedPin) {
        console.error('PinLogin: No stored PIN found');
        Alert.alert('Error', 'No PIN found. Please reset the app.');
        return;
      }
      
      if (storedPin === enteredPin) {
        console.log('PinLogin: PIN correct, navigating to app');
        router.replace('/(tabs)');
      } else {
        console.log('PinLogin: Incorrect PIN');
        Vibration.vibrate(500);
        setPin('');
        Alert.alert('Incorrect PIN', 'Please try again');
      }
    } catch (error) {
      console.error('PinLogin: Error verifying PIN:', error);
      Alert.alert('Error', 'Failed to verify PIN');
    }
  };

  const handleBiometricAuth = async () => {
    try {
      console.log('PinLogin: Attempting biometric authentication');
      
      if (!biometricsAvailable) {
        console.log('PinLogin: Biometrics not available');
        return;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        console.log('PinLogin: Biometric authentication successful');
        router.replace('/(tabs)');
      } else {
        console.log('PinLogin: Biometric authentication failed');
      }
    } catch (error) {
      console.error('PinLogin: Error with biometric authentication:', error);
    }
  };

  return (
    <AppBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.appName, isDarkMode ? styles.textLight : styles.textDark]}>
            TechTimes
          </Text>
          {technicianName ? (
            <Text style={[styles.welcomeText, isDarkMode ? styles.textLight : styles.textDark]}>
              Welcome back, {technicianName}
            </Text>
          ) : null}
        </View>

        <View style={styles.pinDisplay}>
          <View style={styles.pinDots}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < pin.length && styles.pinDotFilled,
                  isDarkMode ? styles.pinDotDark : styles.pinDotLight,
                ]}
              />
            ))}
          </View>
          <Text style={[styles.pinLabel, isDarkMode ? styles.textLight : styles.textDark]}>
            Enter your PIN
          </Text>
        </View>

        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'backspace'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key, keyIndex) => {
                if (key === '') {
                  return <View key={keyIndex} style={styles.keypadButton} />;
                }
                
                if (key === 'backspace') {
                  return (
                    <TouchableOpacity
                      key={keyIndex}
                      style={styles.keypadButton}
                      onPress={handleBackspace}
                    >
                      <IconSymbol
                        ios_icon_name="delete.left"
                        android_material_icon_name="backspace"
                        size={28}
                        color={isDarkMode ? '#fff' : '#000'}
                      />
                    </TouchableOpacity>
                  );
                }
                
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={[
                      styles.keypadButton,
                      isDarkMode ? styles.keypadButtonDark : styles.keypadButtonLight,
                    ]}
                    onPress={() => handleNumberPress(key)}
                  >
                    <Text
                      style={[
                        styles.keypadButtonText,
                        isDarkMode ? styles.textLight : styles.textDark,
                      ]}
                    >
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {biometricsEnabled && biometricsAvailable && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricAuth}
          >
            <IconSymbol
              ios_icon_name="faceid"
              android_material_icon_name="fingerprint"
              size={32}
              color="#2196F3"
            />
            <Text style={[styles.biometricText, isDarkMode ? styles.textLight : styles.textDark]}>
              Use Biometrics
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 18,
    opacity: 0.8,
  },
  pinDisplay: {
    alignItems: 'center',
    marginBottom: 60,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  pinDotLight: {
    borderColor: '#2196F3',
  },
  pinDotDark: {
    borderColor: '#2196F3',
  },
  pinDotFilled: {
    backgroundColor: '#2196F3',
  },
  pinLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keypadButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  keypadButtonDark: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '500',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    padding: 16,
  },
  biometricText: {
    fontSize: 16,
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#000',
  },
});
