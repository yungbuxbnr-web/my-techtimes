
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { SplashScreen } from '@/components/SplashScreen';

export default function Index() {
  const { isAuthenticated, setupComplete, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    console.log('Index: Auth state - loading:', loading, 'setupComplete:', setupComplete, 'isAuthenticated:', isAuthenticated);
    if (!loading) {
      setReady(true);
    }
  }, [loading, setupComplete, isAuthenticated]);

  const handleSplashComplete = () => {
    console.log('Index: Splash screen animation complete');
    setShowSplash(false);
  };

  // Show splash screen on first load
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!ready || loading) {
    console.log('Index: Showing loading screen');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // If setup is not complete, go to setup
  if (!setupComplete) {
    console.log('Index: Setup not complete, redirecting to /setup');
    return <Redirect href="/setup" />;
  }

  // If setup is complete but not authenticated, go to login
  if (!isAuthenticated) {
    console.log('Index: Not authenticated, redirecting to /pin-login');
    return <Redirect href="/pin-login" />;
  }

  // If authenticated, go to home
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
