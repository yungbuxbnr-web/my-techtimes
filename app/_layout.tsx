
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Alert, Platform } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { scheduleAllNotifications } from '@/utils/notificationScheduler';
import { requestNotificationPermissions } from '@/utils/permissions';

let backPressCount = 0;
let backPressTimer: NodeJS.Timeout | null = null;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('RootLayout: App initializing');
    
    // Initialize notifications
    const initNotifications = async () => {
      try {
        console.log('RootLayout: Requesting notification permissions');
        const hasPermission = await requestNotificationPermissions();
        
        if (hasPermission) {
          console.log('RootLayout: Scheduling all notifications');
          await scheduleAllNotifications();
          console.log('RootLayout: Notifications scheduled successfully');
        } else {
          console.log('RootLayout: Notification permissions not granted');
        }
      } catch (error) {
        console.error('RootLayout: Error initializing notifications:', error);
      }
    };
    
    initNotifications();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('RootLayout: Back button pressed, count:', backPressCount + 1);
      
      backPressCount++;
      
      if (backPressCount === 1) {
        // First back press - show toast
        console.log('RootLayout: First back press - showing toast');
        Alert.alert(
          'Exit App',
          'Press back again to exit or minimize to run in background',
          [
            {
              text: 'Minimize to Background',
              onPress: () => {
                console.log('RootLayout: User chose to minimize to background');
                BackHandler.exitApp();
                backPressCount = 0;
              },
            },
            {
              text: 'Exit App',
              onPress: () => {
                console.log('RootLayout: User chose to exit app');
                BackHandler.exitApp();
              },
              style: 'destructive',
            },
            {
              text: 'Cancel',
              onPress: () => {
                console.log('RootLayout: User cancelled exit');
                backPressCount = 0;
              },
              style: 'cancel',
            },
          ]
        );
        
        // Reset counter after 2 seconds
        if (backPressTimer) clearTimeout(backPressTimer);
        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);
        
        return true; // Prevent default back behavior
      }
      
      return false;
    });

    return () => {
      backHandler.remove();
      if (backPressTimer) clearTimeout(backPressTimer);
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="pin-login" options={{ headerShown: false }} />
              <Stack.Screen name="setup" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-job-modal" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="calendar" options={{ headerShown: false }} />
              <Stack.Screen name="edit-work-schedule" options={{ headerShown: false }} />
              <Stack.Screen name="work-calendar" options={{ headerShown: false }} />
              <Stack.Screen name="absence-logger" options={{ headerShown: false }} />
              <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
              <Stack.Screen name="target-details" options={{ headerShown: false }} />
              <Stack.Screen name="efficiency-details" options={{ headerShown: false }} />
              <Stack.Screen name="about" options={{ headerShown: false }} />
              <Stack.Screen name="formulas" options={{ headerShown: false }} />
              <Stack.Screen name="job-stats" options={{ headerShown: false }} />
              <Stack.Screen name="total-aws-details" options={{ headerShown: false }} />
              <Stack.Screen name="time-logged-details" options={{ headerShown: false }} />
              <Stack.Screen name="jobs-done-details" options={{ headerShown: false }} />
              <Stack.Screen name="hours-remaining-details" options={{ headerShown: false }} />
              <Stack.Screen name="today-details" options={{ headerShown: false }} />
              <Stack.Screen name="week-details" options={{ headerShown: false }} />
            </Stack>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
