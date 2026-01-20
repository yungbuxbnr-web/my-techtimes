
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WidgetProvider } from '@/contexts/WidgetContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a short delay
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1000);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <WidgetProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="setup" />
              <Stack.Screen name="pin-login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen 
                name="add-job-modal" 
                options={{ 
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Add Job',
                }} 
              />
              <Stack.Screen 
                name="target-details" 
                options={{ 
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Target Details',
                }} 
              />
              <Stack.Screen 
                name="efficiency-details" 
                options={{ 
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Efficiency Details',
                }} 
              />
              <Stack.Screen 
                name="calendar" 
                options={{ 
                  headerShown: true,
                  title: 'Calendar',
                }} 
              />
            </Stack>
          </WidgetProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
