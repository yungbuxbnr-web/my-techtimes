
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { BackHandler, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { scheduleAllNotifications } from '@/utils/notificationScheduler';
import { requestNotificationPermissions, requestBackgroundPermissions } from '@/utils/permissions';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { logout } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [backPressCount, setBackPressCount] = useState(0);
  const backPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    console.log('RootLayout: App initializing');
    
    // Initialize notifications and background permissions
    const initApp = async () => {
      try {
        console.log('RootLayout: Requesting notification permissions');
        const hasNotificationPermission = await requestNotificationPermissions();
        
        if (hasNotificationPermission) {
          console.log('RootLayout: Scheduling all notifications');
          await scheduleAllNotifications();
          console.log('RootLayout: Notifications scheduled successfully');
        } else {
          console.log('RootLayout: Notification permissions not granted');
        }

        // Request background permissions for live clock and work schedule
        console.log('RootLayout: Requesting background permissions');
        const hasBackgroundPermission = await requestBackgroundPermissions();
        
        if (hasBackgroundPermission) {
          console.log('RootLayout: Background permissions granted');
          // Background execution is handled by Android system
          // The app will continue running in background with WAKE_LOCK and FOREGROUND_SERVICE permissions
        } else {
          console.log('RootLayout: Background permissions not granted');
        }
      } catch (error) {
        console.error('RootLayout: Error initializing app:', error);
      }
    };
    
    initApp();
    setIsReady(true);
  }, []);

  // Handle app state changes - require PIN when app comes back from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('RootLayout: App state changed from', appStateRef.current, 'to', nextAppState);
      
      // When app comes back to foreground from background, require PIN
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('RootLayout: App resumed from background, requiring PIN login');
        
        // Check if user is in the app (not on login/setup screens)
        const inApp = segments[0] === '(tabs)' || 
                      segments[0] === 'calendar' || 
                      segments[0] === 'edit-work-schedule' ||
                      segments[0] === 'work-calendar' ||
                      segments[0] === 'absence-logger' ||
                      segments[0] === 'notification-settings' ||
                      segments[0] === 'target-details' ||
                      segments[0] === 'efficiency-details' ||
                      segments[0] === 'about' ||
                      segments[0] === 'formulas' ||
                      segments[0] === 'job-stats' ||
                      segments[0] === 'total-aws-details' ||
                      segments[0] === 'time-logged-details' ||
                      segments[0] === 'jobs-done-details' ||
                      segments[0] === 'hours-remaining-details' ||
                      segments[0] === 'today-details' ||
                      segments[0] === 'week-details';
        
        if (inApp) {
          console.log('RootLayout: User was in app, logging out and requiring PIN');
          logout();
          router.replace('/pin-login');
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [segments, logout, router]);

  // Handle Android back button - single press to go back, double press to show minimize/exit dialog
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('RootLayout: Back button pressed, count:', backPressCount + 1);
      
      // Check if we're on a screen that can go back
      const canGoBack = segments.length > 1 || (segments[0] !== '(tabs)' && segments[0] !== 'index');
      
      if (canGoBack && backPressCount === 0) {
        // First press - go back
        console.log('RootLayout: First press - going back');
        router.back();
        return true;
      }
      
      // On root screen or second press - handle exit
      if (backPressCount === 0) {
        // First press on root - show warning
        console.log('RootLayout: First press on root - showing exit warning');
        Alert.alert(
          'Exit App',
          'Press back again to exit',
          [{ text: 'OK' }]
        );
        
        setBackPressCount(1);
        
        // Reset counter after 2 seconds
        if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
        backPressTimerRef.current = setTimeout(() => {
          console.log('RootLayout: Resetting back press counter');
          setBackPressCount(0);
        }, 2000);
        
        return true;
      } else {
        // Second press - show minimize/exit dialog
        console.log('RootLayout: Second press - showing minimize/exit dialog');
        Alert.alert(
          'Exit TechTimes',
          'What would you like to do?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('RootLayout: User cancelled exit');
                setBackPressCount(0);
              },
            },
            {
              text: 'Minimize',
              onPress: () => {
                console.log('RootLayout: User chose to minimize app');
                // Move app to background - it will return to dashboard when reopened
                BackHandler.exitApp();
              },
            },
            {
              text: 'Exit',
              style: 'destructive',
              onPress: () => {
                console.log('RootLayout: User chose to exit app completely');
                // Completely shut down the app
                BackHandler.exitApp();
              },
            },
          ],
          { cancelable: false }
        );
        
        // Reset counter
        setBackPressCount(0);
        return true;
      }
    });

    return () => {
      backHandler.remove();
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
    };
  }, [backPressCount, segments, router]);

  if (!isReady) {
    return null;
  }

  return (
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
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RootLayoutContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
