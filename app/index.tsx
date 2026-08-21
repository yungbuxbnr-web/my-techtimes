
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { SplashScreen } from '@/components/SplashScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { isAuthenticated, setupComplete, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [animMode, setAnimMode] = useState<'full' | 'quick' | 'off'>('full');
  const [animModeLoaded, setAnimModeLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@techtimes_startup_animation').then(val => {
      if (val === 'quick' || val === 'off' || val === 'full') {
        console.log('Index: Loaded startup animation mode:', val);
        setAnimMode(val);
      }
      setAnimModeLoaded(true);
    }).catch(() => {
      console.warn('Index: Failed to load startup animation mode, defaulting to full');
      setAnimModeLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      setAuthReady(true);
    }
  }, [loading]);

  const handleSplashComplete = () => {
    console.log('Index: Splash screen animation complete');
    setSplashDone(true);
  };

  // Wait for animation mode to load (near-instant)
  if (!animModeLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#050d1a' }} />;
  }

  // Show splash until animation completes
  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} mode={animMode} />;
  }

  // Splash done but auth still loading
  if (!authReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Both done — redirect once only
  if (!setupComplete) {
    console.log('Index: Setup not complete, redirecting to /setup');
    return <Redirect href="/setup" />;
  }
  if (!isAuthenticated) {
    console.log('Index: Not authenticated, redirecting to /pin-login');
    return <Redirect href="/pin-login" />;
  }
  console.log('Index: Authenticated, redirecting to /(tabs)');
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
