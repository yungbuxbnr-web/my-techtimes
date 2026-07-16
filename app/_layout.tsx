
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
import { activityLogger } from '@/utils/activityLogger';

const LAST_ROUTE_KEY = 'last_route';
const LAST_BACKGROUND_TIME_KEY = 'last_background_time';
const LOCK_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Module-level debounce timer for app state changes
let appStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  const hasNavigatedRef = useRef(false);

  // Install global error handlers exactly once after mount
  useEffect(() => {
    activityLogger.installGlobalHandlers();
  }, []);

  // Reset badge count on initial mount
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setBadgeCountAsync(0).catch(err =>
      console.error('RootLayout: Failed to reset badge count on mount:', err)
    );
  }, []);

  // Reset badge count when a notification is tapped; handle ADD_JOB action
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      Notifications.setBadgeCountAsync(0).catch(err =>
        console.error('RootLayout: Failed to reset badge count on notification tap:', err)
      );

      // Handle ADD_JOB notification action button
      const actionId = response.actionIdentifier;
      if (actionId === 'ADD_JOB') {
        router.push('/add-job-modal');
      }
    });
    return () => subscription.remove();
  }, [router]);

  // Clear badge when notification arrives in foreground
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    });
    return () => receivedSub.remove();
  }, []);

  useEffect(() => {
    activityLogger.info('APP_LIFECYCLE', 'App initializing');
    
    // Initialize notifications and background permissions
    const initApp = async () => {
      try {
        activityLogger.info('NOTIFICATIONS', 'Requesting notification permissions');
        const hasNotificationPermission = await requestNotificationPermissions();
        
        if (hasNotificationPermission) {
          activityLogger.info('NOTIFICATIONS', 'Scheduling all notifications');
          await scheduleAllNotifications();
          activityLogger.info('NOTIFICATIONS', 'Notifications scheduled successfully');
        } else {
          activityLogger.warn('NOTIFICATIONS', 'Notification permissions not granted');
        }

        // Request background permissions for live clock and work schedule
        activityLogger.info('BACKGROUND', 'Requesting background permissions');
        const hasBackgroundPermission = await requestBackgroundPermissions();
        
        if (hasBackgroundPermission) {
          activityLogger.info('BACKGROUND', 'Background permissions granted');
        } else {
          activityLogger.warn('BACKGROUND', 'Background permissions not granted');
        }

        // Initialize widget data and schedule daily refresh
        if (Platform.OS === 'android') {
          activityLogger.info('WIDGET', 'Initializing Android widget');
          await updateWidgetData();
          scheduleDailyWidgetRefresh();
          activityLogger.info('WIDGET', 'Widget initialized and daily refresh scheduled');

          activityLogger.info('WIDGET', 'Setting up live widget notification channel');
          await setupLiveWidgetChannel();
          await updateLiveWidget();
          activityLogger.info('WIDGET', 'Live widget initialized');
        }

        // Register background mainframe for time tracking
        activityLogger.info('BACKGROUND', 'Registering background mainframe');
        await registerBackgroundMainframe();
        activityLogger.info('BACKGROUND', 'Background mainframe registered');
      } catch (error) {
        console.error('RootLayout: Error initializing app:', error);
        activityLogger.error('APP_LIFECYCLE', 'Error initializing app', { error: String(error) });
      } finally {
        setIsReady(true);
        activityLogger.info('APP_LIFECYCLE', 'App init complete — isReady=true');
      }
    };
    
    initApp();
  }, []);

  // Save current route when navigating
  useEffect(() => {
    const currentRoute = segments.join('/');
    if (currentRoute && currentRoute !== 'pin-login' && currentRoute !== 'setup' && currentRoute !== 'index') {
      lastRouteRef.current = currentRoute;
      setSecureItem(LAST_ROUTE_KEY, currentRoute);
      activityLogger.debug('NAVIGATION', 'Route saved', { route: currentRoute });
    }
  }, [segments]);

  // Handle deep links (e.g. from widget)
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url === 'techtimes://add-job' || url === 'techtimes://add-job/') {
        router.push('/add-job-modal');
      }
      // techtimes:// bare — just foreground, no navigation needed
    };

    // Handle URL that launched the app
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl(url);
      }
    }).catch(err => console.error('RootLayout: getInitialURL error:', err));

    // Handle URLs while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [router]);

  // Handle app state changes with debounce to prevent Samsung One UI rapid-fire events
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Always update the ref immediately so we track the latest state
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Debounce: only act after state has been stable for 400ms
      if (appStateDebounceTimer) clearTimeout(appStateDebounceTimer);
      appStateDebounceTimer = setTimeout(async () => {
        try {
          activityLogger.info('APP_LIFECYCLE', 'App state changed', { from: prevState, to: nextAppState });

          if (nextAppState.match(/inactive|background/) && prevState === 'active') {
            updateDayProgressWidget().catch(() => {});
          }

          if (prevState.match(/inactive|background/) && nextAppState === 'active') {
            Notifications.setBadgeCountAsync(0).catch(() => {});
            runMainframeSync().catch(() => {});
            syncWidgetDataFromStorage().catch(() => {});
            if (Platform.OS === 'android') {
              updateLiveWidget().catch(() => {});
            }
            ensureWorkScheduleNotificationsScheduled().catch(() => {});

            const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
            const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
            if (lastBackgroundTime) {
              const timeElapsed = Date.now() - lastBackgroundTime;
              if (timeElapsed >= LOCK_TIMEOUT) {
                await setSecureItem(LAST_ROUTE_KEY, '(tabs)');
                lastRouteRef.current = null;
              }
            }
          }

          if (nextAppState.match(/inactive|background/)) {
            await setSecureItem(LAST_BACKGROUND_TIME_KEY, Date.now().toString());
          }
        } catch (err) {
          // swallow
        }
      }, 400);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (appStateDebounceTimer) {
        clearTimeout(appStateDebounceTimer);
        appStateDebounceTimer = null;
      }
    };
  }, []);

  // Reset navigation guard when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasNavigatedRef.current = false;
    }
  }, [isAuthenticated]);

  // Handle navigation after authentication
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) return;
    if (hasNavigatedRef.current) return;
    
    const handleNavigation = async () => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      // Check if we should resume to a saved route
      const savedRoute = await getSecureItem(LAST_ROUTE_KEY);
      const lastBackgroundTimeStr = await getSecureItem(LAST_BACKGROUND_TIME_KEY);
      const lastBackgroundTime = lastBackgroundTimeStr ? parseInt(lastBackgroundTimeStr, 10) : null;
      
      if (savedRoute && lastBackgroundTime) {
        const timeElapsed = Date.now() - lastBackgroundTime;
        
        // If less than 1 hour, resume to saved route
        if (timeElapsed < LOCK_TIMEOUT) {
          activityLogger.info('NAVIGATION', 'Resuming to saved route', { route: savedRoute });
          router.replace(`/${savedRoute}` as any);
          return;
        }
      }
      
      // Otherwise go to home
      activityLogger.info('NAVIGATION', 'Navigating to home screen after auth');
      router.replace('/(tabs)');
    };
    
    handleNavigation();
  }, [isAuthenticated, isReady, router]);

  // Handle Android back button - single press to go back, double press to show minimize/exit dialog
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      activityLogger.debug('APP_LIFECYCLE', 'Android back button pressed', { count: backPressCount + 1 });
      
      // Check if we're on a screen that can go back
      const canGoBack = segments.length > 1 || (segments[0] !== '(tabs)' && segments[0] !== 'index');
      
      if (canGoBack && backPressCount === 0) {
        // First press - go back
        router.back();
        return true;
      }
      
      // On root screen or second press - handle exit
      if (backPressCount === 0) {
        // First press on root - show warning
        Alert.alert(
          'Exit App',
          'Press back again to exit',
          [{ text: 'OK' }]
        );
        
        setBackPressCount(1);
        
        // Reset counter after 2 seconds
        if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current);
        backPressTimerRef.current = setTimeout(() => {
          setBackPressCount(0);
        }, 2000);
        
        return true;
      } else {
        // Second press - show minimize/exit dialog
        Alert.alert(
          'Exit TechTimes',
          'What would you like to do?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setBackPressCount(0);
              },
            },
            {
              text: 'Minimize',
              onPress: () => {
                BackHandler.exitApp();
              },
            },
            {
              text: 'Exit',
              style: 'destructive',
              onPress: () => {
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
      <Stack.Screen name="activity-logs" options={{ headerShown: false }} />
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
