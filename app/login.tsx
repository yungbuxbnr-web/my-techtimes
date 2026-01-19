
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const { login, loginWithBiometrics, biometricsAvailable, biometricsEnabled } = useAuth();
  const { theme, overlayStrength } = useThemeContext();

  const handleLogin = async () => {
    console.log('LoginScreen: User attempting PIN login');
    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be 4 digits');
      return;
    }

    const success = await login(pin);
    if (success) {
      console.log('LoginScreen: Login successful, navigating to dashboard');
      router.replace('/(tabs)');
    } else {
      Alert.alert('Incorrect PIN', 'Please try again');
      setPin('');
    }
  };

  const handleBiometricLogin = async () => {
    console.log('LoginScreen: User attempting biometric login');
    const success = await loginWithBiometrics();
    if (success) {
      console.log('LoginScreen: Biometric login successful, navigating to dashboard');
      router.replace('/(tabs)');
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
      style={styles.background}
    >
      <StatusBar style="light" />
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
              <IconSymbol
                ios_icon_name="wrench.and.screwdriver.fill"
                android_material_icon_name="build"
                size={48}
                color="#ffffff"
              />
            </View>

            <Text style={[styles.title, { color: '#ffffff' }]}>TechTimes</Text>
            <Text style={[styles.subtitle, { color: '#cccccc' }]}>
              Vehicle Technician Job Tracker
            </Text>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.label, { color: theme.text }]}>Enter PIN</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={handleLogin}
              >
                <Text style={styles.buttonText}>Unlock</Text>
              </TouchableOpacity>

              {biometricsAvailable && biometricsEnabled && (
                <TouchableOpacity
                  style={[styles.biometricButton, { borderColor: theme.primary }]}
                  onPress={handleBiometricLogin}
                >
                  <IconSymbol
                    ios_icon_name="faceid"
                    android_material_icon_name="fingerprint"
                    size={24}
                    color={theme.primary}
                  />
                  <Text style={[styles.biometricText, { color: theme.primary }]}>
                    Use Biometrics
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.hint, { color: '#999999' }]}>
              Default PIN: 3101
            </Text>
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 48,
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    marginTop: 24,
    fontSize: 14,
  },
});
