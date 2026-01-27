
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
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';
import AppBackground from '@/components/AppBackground';

export default function PinLoginScreen() {
  const router = useRouter();
  const { isDarkMode } = useThemeContext();
  const { 
    login, 
    authenticateWithBiometrics, 
    biometricsEnabled, 
    biometricsAvailable,
    pinAuthEnabled 
  } = useAuth();
  
  const [pin, setPin] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    loadTechnicianName();
  }, []);

  useEffect(() => {
    // Auto-trigger biometric auth when biometrics are enabled and available
    // Only trigger once per mount to avoid repeated prompts
    if (biometricsEnabled && biometricsAvailable && !hasAutoTriggered) {
      console.log('PinLogin: Auto-triggering biometric authentication');
      setHasAutoTriggered(true);
      
      // Small delay to ensure UI is ready
      setTimeout(() => {
        handleBiometricAuth();
      }, 300);
    }
  }, [biometricsEnabled, biometricsAvailable, hasAutoTriggered]);

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

  const handleNumberPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      console.log('PinLogin: PIN length:', newPin.length);
      
      // Auto-verify when PIN reaches 4 digits
      if (newPin.length === 4) {
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
      const success = await login(enteredPin);
      
      if (success) {
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
      console.log('PinLogin: Biometric authentication triggered');
      
      // Check if biometrics are available on native platforms
      if (Platform.OS === 'web') {
        console.log('PinLogin: Biometrics not available on web');
        Alert.alert('Not Available', 'Biometric authentication is not available on web');
        return;
      }
      
      if (!biometricsAvailable) {
        console.log('PinLogin: Biometrics not available on device');
        Alert.alert(
          'Not Available', 
          'Biometric authentication is not available on this device. Please ensure you have enrolled fingerprint or face recognition in your device settings.'
        );
        return;
      }
      
      if (!biometricsEnabled) {
        console.log('PinLogin: Biometrics not enabled in settings');
        Alert.alert('Not Enabled', 'Biometric authentication is not enabled. Enable it in Settings.');
        return;
      }
      
      const success = await authenticateWithBiometrics();
      
      if (success) {
        console.log('PinLogin: Biometric authentication successful, navigating to app');
        router.replace('/(tabs)');
      } else {
        console.log('PinLogin: Biometric authentication failed or cancelled');
      }
    } catch (error) {
      console.error('PinLogin: Error with biometric authentication:', error);
      Alert.alert('Error', 'Failed to authenticate with biometrics. Please use your PIN.');
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

        {pinAuthEnabled && (
          <>
            <View style={styles.pinDisplay}>
              <View style={styles.pinDots}>
                {[0, 1, 2, 3].map((index) => (
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
          </>
        )}

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

        {!pinAuthEnabled && biometricsEnabled && (
          <View style={styles.biometricOnlyContainer}>
            <IconSymbol
              ios_icon_name="faceid"
              android_material_icon_name="fingerprint"
              size={64}
              color="#2196F3"
            />
            <Text style={[styles.biometricOnlyText, isDarkMode ? styles.textLight : styles.textDark]}>
              Biometric Authentication Required
            </Text>
            <TouchableOpacity
              style={[styles.biometricOnlyButton, { backgroundColor: '#2196F3' }]}
              onPress={handleBiometricAuth}
            >
              <Text style={styles.biometricOnlyButtonText}>Authenticate</Text>
            </TouchableOpacity>
          </View>
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
  biometricOnlyContainer: {
    alignItems: 'center',
    gap: 24,
  },
  biometricOnlyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  biometricOnlyButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  biometricOnlyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#000',
  },
});
