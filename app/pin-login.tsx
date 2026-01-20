
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useThemeContext } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';

const PIN_KEY = 'user_pin';
const BIOMETRICS_KEY = 'biometrics_enabled';

export default function PinLoginScreen() {
  const router = useRouter();
  const { isDarkMode, overlayStrength, backgroundImage } = useThemeContext();
  
  const [pin, setPin] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicianName();
    checkBiometrics();
  }, []);

  const loadTechnicianName = async () => {
    try {
      console.log('PinLogin: Loading technician name');
      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
    } catch (error) {
      console.error('PinLogin: Error loading technician name:', error);
      setTechnicianName('Technician');
    } finally {
      setLoading(false);
    }
  };

  const checkBiometrics = async () => {
    try {
      console.log('PinLogin: Checking biometrics availability');
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      setBiometricsAvailable(available);

      if (available) {
        const enabled = await SecureStore.getItemAsync(BIOMETRICS_KEY);
        setBiometricsEnabled(enabled === 'true');
        console.log('PinLogin: Biometrics available:', available, 'enabled:', enabled === 'true');
      } else {
        console.log('PinLogin: Biometrics not available on this device');
      }
    } catch (error) {
      console.error('PinLogin: Error checking biometrics:', error);
    }
  };

  const handleNumberPress = (num: string) => {
    console.log('PinLogin: Number pressed:', num);
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-verify when PIN reaches 4-6 digits
      if (newPin.length >= 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    console.log('PinLogin: Backspace pressed');
    setPin(pin.slice(0, -1));
  };

  const verifyPin = async (enteredPin: string) => {
    try {
      console.log('PinLogin: Verifying PIN, length:', enteredPin.length);
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      
      if (!storedPin) {
        console.error('PinLogin: No stored PIN found, redirecting to setup');
        Alert.alert('Error', 'No PIN found. Please complete setup.');
        router.replace('/setup');
        return;
      }

      if (enteredPin === storedPin) {
        console.log('PinLogin: PIN verified successfully, navigating to home');
        router.replace('/(tabs)');
      } else if (enteredPin.length >= storedPin.length) {
        console.log('PinLogin: Incorrect PIN entered');
        Vibration.vibrate(500);
        Alert.alert('Incorrect PIN', 'Please try again');
        setPin('');
      }
    } catch (error) {
      console.error('PinLogin: Error verifying PIN:', error);
      Alert.alert('Error', 'Failed to verify PIN');
      setPin('');
    }
  };

  const handleBiometricAuth = async () => {
    try {
      console.log('PinLogin: Attempting biometric authentication');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access TechTimes',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        console.log('PinLogin: Biometric authentication successful');
        router.replace('/(tabs)');
      } else {
        console.log('PinLogin: Biometric authentication failed or cancelled');
        Alert.alert('Authentication Failed', 'Please use your PIN to login');
      }
    } catch (error) {
      console.error('PinLogin: Error with biometric authentication:', error);
      Alert.alert('Error', 'Biometric authentication failed. Please use your PIN.');
    }
  };

  if (loading) {
    return (
      <ImageBackground
        source={backgroundImage}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]} />
        <View style={styles.container}>
          <Text style={[styles.loadingText, isDarkMode ? styles.textLight : styles.textDark]}>
            Loading...
          </Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.welcomeText, isDarkMode ? styles.textLight : styles.textDark]}>
            Welcome back,
          </Text>
          <Text style={[styles.nameText, isDarkMode ? styles.textLight : styles.textDark]}>
            {technicianName}
          </Text>
        </View>

        <View style={styles.pinDisplay}>
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

        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.keypadButton,
                    isDarkMode ? styles.keypadButtonDark : styles.keypadButtonLight,
                  ]}
                  onPress={() => handleNumberPress(num)}
                >
                  <Text style={[styles.keypadText, isDarkMode ? styles.textLight : styles.textDark]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          
          <View style={styles.keypadRow}>
            {biometricsEnabled && biometricsAvailable ? (
              <TouchableOpacity
                style={[
                  styles.keypadButton,
                  isDarkMode ? styles.keypadButtonDark : styles.keypadButtonLight,
                ]}
                onPress={handleBiometricAuth}
              >
                <IconSymbol
                  ios_icon_name="faceid"
                  android_material_icon_name="fingerprint"
                  size={32}
                  color={isDarkMode ? '#fff' : '#000'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.keypadButton} />
            )}
            
            <TouchableOpacity
              style={[
                styles.keypadButton,
                isDarkMode ? styles.keypadButtonDark : styles.keypadButtonLight,
              ]}
              onPress={() => handleNumberPress('0')}
            >
              <Text style={[styles.keypadText, isDarkMode ? styles.textLight : styles.textDark]}>
                0
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.keypadButton,
                isDarkMode ? styles.keypadButtonDark : styles.keypadButtonLight,
              ]}
              onPress={handleBackspace}
            >
              <IconSymbol
                ios_icon_name="delete.left"
                android_material_icon_name="backspace"
                size={28}
                color={isDarkMode ? '#fff' : '#000'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.hintText, isDarkMode ? styles.textLight : styles.textDark]}>
          Enter your PIN to continue
        </Text>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  welcomeText: {
    fontSize: 18,
    opacity: 0.8,
    marginBottom: 8,
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  pinDotLight: {
    borderColor: '#2196F3',
    backgroundColor: 'transparent',
  },
  pinDotDark: {
    borderColor: '#2196F3',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#2196F3',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
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
    borderWidth: 2,
  },
  keypadButtonLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#2196F3',
  },
  keypadButtonDark: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderColor: '#2196F3',
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '600',
  },
  hintText: {
    marginTop: 32,
    fontSize: 14,
    opacity: 0.7,
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#000',
  },
});
