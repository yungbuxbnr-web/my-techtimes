
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { BackHandler, Alert, Platform, AppState, AppStateStatus, Linking } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { scheduleAllNotifications, ensureWorkScheduleNotificationsScheduled } from '@/utils/notificationScheduler';
import { requestNotificationPermissions, requestBackgroundPermissions } from '@/utils/permissions';
import { updateWidgetData, scheduleDailyWidgetRefresh, updateDayProgressWidget, syncWidgetDataFromStorage } from '@/utils/widgetManager';
import { registerBackgroundMainframe, runMainframeSync } from '@/utils/backgroundMainframe';
import { setupLiveWidgetChannel, updateLiveWidget } from '@/utils/liveWidget';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const LAST_ROUTE_KEY = 'last_route';
const LAST_BACKGROUND_TIME_KEY = 'last_background_time';
const LOCK_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Helper functions for cross-platform storage
async function setSecureItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error('RootLayout: Error setting secure item:', key, error);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (error) {
    console.error('RootLayout: Error getting secure item:', key, error);
    return null;
  }
}

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, logout } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [backPressCount, setBackPressCount] = useState(0);
  const backPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastRouteRef = useRef<string | null>(null);

  // Reset badge count on initial mount
  useEffect(() => {
    console.log('RootLayout: Resetting badge count on mount');
    Notifications.setBadgeCountAsync(0).catch(err =>
      console.error('RootLayout: Failed to reset badge count on mount:', err)
    );
  }, []);

  // Reset badge count when a notification is tapped; handle ADD_JOB action
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('RootLayout: Notification tapped — resetting badge count', response.notification.request.identifier);
      Notifications.setBadgeCountAsync(0).catch(err =>
        console.error('RootLayout: Failed to reset badge count on notification tap:', err)
      );

      // Handle ADD_JOB notification action button
      const actionId = response.actionIdentifier;
      if (actionId === 'ADD_JOB') {
        console.log('RootLayout: ADD_JOB notification action tapped — navigating to add-job-modal');
        router.push('/add-job-modal');
      }
    });
    return () => subscription.remove();
  }, [router]);

  // Clear badge when notification arrives in foreground
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      console.log('RootLayout: Notification received in foreground — clearing badge');
      Notifications.setBadgeCountAsync(0).catch(() => {});
    });
    return () => receivedSub.remove();
  }, []);

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

          // Safety-net: verify work-schedule notifications are present after scheduling
          console.log('RootLayout: Verifying work-schedule notifications on mount');
          await ensureWorkScheduleNotificationsScheduled();
        } else {
          console.log('RootLayout: Notification permissions not granted');
        }

        // Request background permissions for live clock and work schedule
        console.log('RootLayout: Requesting background permissions');
        const hasBackgroundPermission = await requestBackgroundPermissions();
        
        if (hasBackgroundPermission) {
          console.log('RootLayout: Background permissions granted');
        } else {
          console.log('RootLayout: Background permissions not granted');
        }

        // Initialize widget data and schedule daily refresh
        if (Platform.OS === 'android') {
          console.log('RootLayout: Initializing Android widget');
          await updateWidgetData();
          scheduleDailyWidgetRefresh();
          console.log('RootLayout: Widget initialized and daily refresh scheduled');

          console.log('RootLayout: Setting up live widget notification channel');
          await setupLiveWidgetChannel();
          await updateLiveWidget();
          console.log('RootLayout: Live widget initialized');
        }

        // Register background mainframe for time tracking
        console.log('RootLayout: Registering background mainframe');
        await registerBackgroundMainframe();

        // Run an immediate foreground sync on startup
        console.log('RootLayout: Running initial foreground mainframe sync');
        await runMainframeSync();
      } catch (error) {
        console.error('RootLayout: Error initializing app:', error);
      }
    };
    
    initApp();
    setIsReady(true);
  }, []);

  // Save current route when navigating
  useEffect(() => {
    const currentRoute = segments.join('/');
    if (currentRoute && currentRoute !== 'pin-login' && currentRoute !== 'setup' && currentRoute !== 'index') {
      lastRouteRef.current = currentRoute;
      setSecureItem(LAST_ROUTE_KEY, currentRoute);
      console.log('RootLayout: Saved current route:', currentRoute);
    }
  }, [segments]);

  // Handle deep links (e.g. from widget)
  useEffect(() => {
    const handleUrl = (url: string) => {
      console.log('RootLayout: Deep link received:', url);
      if (url === 'techtimes://add-job' || url === 'techtimes://add-job/') {
        console.log('RootLayout: Deep link — navigating to add-job-modal');
        router.push('/add-job-modal');
      }
      // techtimes:// bare — just foreground, no navigation needed
    };

    // Handle URL that launched the app
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('RootLayout: Initial URL:', url);
        handleUrl(url);
      }
    }).catch(err => console.error('RootLayout: getInitialURL error:', err));

    // Handle URLs while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [router]);

  // Handle app state changes with time-based navigation
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('RootLayout: App state changed from', appStateRef.current, 'to', nextAppState);
      
      // App going to background — reload iOS Day Progress widget timeline
      if (nextAppState.match(/inactive|background/) && appStateRef.current === 'active') {
        console.log('RootLayout: App going to background — reloading Day Progress widget');
        updateDayProgressWidget().catch(err =>
          console.error('RootLayout: updateDayProgressWidget failed:', err)
        );
      }

      // App coming back to foreground from background
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('RootLayout: App resumed from background — resetting badge count');
        Notifications.setBadgeCountAsync(0).catch(err =>
          console.error('RootLayout: Failed to reset badge count on foreground:', err)
        );

        console.log('RootLayout: App resumed from background — running foreground mainframe sync');
        // Run foreground sync immediately to refresh calculations
        runMainframeSync().catch(err =>
          console.error('RootLayout: Foreground mainframe sync failed:', err)
        );

        // Sync latest data to widget shared container
        console.log('RootLayout: App foregrounded — syncing widget data');
        syncWidgetDataFromStorage().catch(err =>
          console.error('RootLayout: syncWidgetDataFromStorage failed:', err)
        );

        if (Platform.OS === 'android') {
          console.log('RootLayout: App foregrounded — updating live widget');
          updateLiveWidget().catch(err =>
            console.error('RootLayout: updateLiveWidget failed:', err)
          );
        }

        // Safety-net: re-register work-schedule notifications if cleared (e.g. after OS reboot)
        console.log('RootLayout: App foregrounded — ensuring work-schedule notifications are scheduled');
        ensureWorkScheduleNotificationsScheduled().catch(err =>
          console.error('RootLayout: ensureWorkScheduleNotificationsScheduled failed on foreground:', err)
        );

        // Get the time when app went to background
        const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
        const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
        
        if (lastBackgroundTime) {
          const now = Date.now();
          const timeElapsed = now - lastBackgroundTime;
          const minutesElapsed = Math.floor(timeElapsed / 60000);
          
          console.log('RootLayout: Time elapsed since background:', minutesElapsed, 'minutes');
          
          // If more than 1 hour, return to home screen after login
          if (timeElapsed >= LOCK_TIMEOUT) {
            console.log('RootLayout: More than 1 hour elapsed, will return to home after login');
            // Clear the saved route so user goes to home
            await setSecureItem(LAST_ROUTE_KEY, '');
            lastRouteRef.current = null;
          }
          // Otherwise, the saved route will be used to resume
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Handle navigation after authentication
  useEffect(() => {
    if (!isReady) return;
    
    const handleNavigation = async () => {
      if (isAuthenticated) {
        // Check if we should resume to a saved route
        const savedRoute = await getSecureItem(LAST_ROUTE_KEY);
        const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
        const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
        
        if (savedRoute && lastBackgroundTime) {
          const timeElapsed = Date.now() - lastBackgroundTime;
          
          // If less than 1 hour, resume to saved route
          if (timeElapsed < LOCK_TIMEOUT) {
            console.log('RootLayout: Resuming to saved route:', savedRoute);
            router.replace(`/${savedRoute}` as any);
            return;
          }
        }
        
        // Otherwise go to home
        console.log('RootLayout: Going to home screen');
        router.replace('/(tabs)');
      }
    };
    
    handleNavigation();
  }, [isAuthenticated, isReady, router]);

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
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="pin-login" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add-job-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="calendar" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="edit-work-schedule" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="work-calendar" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="absence-logger" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="notification-settings" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="target-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="efficiency-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="about" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="formulas" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="job-stats" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="total-aws-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="time-logged-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="jobs-done-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="hours-remaining-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="today-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen name="week-details" options={{ headerShown: false, headerBackTitle: 'Back' }} />
      <Stack.Screen
        name="edit-job"
        options={{
          title: 'Edit Job',
          headerShown: true,
          presentation: 'card',
          headerBackTitle: 'Back',
        }}
      />
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
