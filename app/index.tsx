
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { SplashScreen } from '@/components/SplashScreen';

export default function Index() {
  const { isAuthenticated, setupComplete, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAuthReady(true);
    }
  }, [loading]);

  const handleSplashComplete = () => {
    console.log('Index: Splash screen animation complete');
    setSplashDone(true);
  };

  // Show splash until animation completes
  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
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
