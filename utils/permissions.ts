
import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_GRANTED_KEY = 'permissions_granted_v1';
const BACKGROUND_PERMISSION_KEY = 'background_permission_granted_v1';

// Request notification permissions — skips if already granted and stored
export async function requestNotificationPermissions(): Promise<boolean> {
  console.log('Permissions: Requesting notification permissions');

  try {
    // Always check actual system status first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      // System says granted — persist flag and skip dialog
      await AsyncStorage.setItem(PERMISSIONS_GRANTED_KEY, 'true');
      console.log('Permissions: Notification already granted by system, skipping dialog');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      return true;
    }

    // Check if we previously stored a "granted" flag but system revoked it
    const storedGranted = await AsyncStorage.getItem(PERMISSIONS_GRANTED_KEY);
    if (storedGranted === 'true' && existingStatus !== 'granted') {
      // Permission was revoked — clear stored flag so we re-ask
      console.log('Permissions: Stored flag says granted but system says denied — clearing flag');
      await AsyncStorage.removeItem(PERMISSIONS_GRANTED_KEY);
    }

    // Request from user
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      console.log('Permissions: Notification permission denied');
      Alert.alert(
        'Notifications Disabled',
        'You can enable notifications in your device settings to receive reminders and alerts.'
      );
      return false;
    }

    console.log('Permissions: Notification permission granted — storing flag');
    await AsyncStorage.setItem(PERMISSIONS_GRANTED_KEY, 'true');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    return true;
  } catch (error) {
    console.error('Permissions: Error requesting notification permissions:', error);
    return false;
  }
}

// Request background permissions — only shows dialog once on Android
export async function requestBackgroundPermissions(): Promise<boolean> {
  console.log('Permissions: Requesting background permissions');

  if (Platform.OS !== 'android') {
    console.log('Permissions: Background permissions only needed on Android');
    return true;
  }

  try {
    // Check if we already asked and user accepted
    const stored = await AsyncStorage.getItem(BACKGROUND_PERMISSION_KEY);
    if (stored === 'true') {
      console.log('Permissions: Background permission already granted (stored), skipping dialog');
      return true;
    }

    return new Promise((resolve) => {
      Alert.alert(
        'Background Permissions Required',
        'TechTimes needs permission to run in the background to keep the live clock and work schedule progression active. This ensures accurate time tracking even when the app is minimized.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('Permissions: User cancelled background permission request');
              resolve(false);
            },
          },
          {
            text: 'Grant Permission',
            onPress: async () => {
              console.log('Permissions: User granted background permission — storing flag');
              await AsyncStorage.setItem(BACKGROUND_PERMISSION_KEY, 'true');
              resolve(true);
            },
          },
        ]
      );
    });
  } catch (error) {
    console.error('Permissions: Error requesting background permissions:', error);
    return false;
  }
}

// Open device notification settings
export async function openNotificationSettings(): Promise<void> {
  console.log('Permissions: Opening device notification settings');

  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    } else if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    }
  } catch (error) {
    console.error('Permissions: Error opening notification settings:', error);
    Alert.alert('Error', 'Could not open notification settings');
  }
}

// Request all app permissions
export async function requestAllPermissions(): Promise<{
  notifications: boolean;
  storage: boolean;
}> {
  console.log('Permissions: Requesting all app permissions');

  const notifications = await requestNotificationPermissions();
  const storage = true;

  console.log('Permissions: All permissions requested - notifications:', notifications, 'storage:', storage);

  return { notifications, storage };
}

// Check if permissions are granted
export async function checkPermissions(): Promise<{
  notifications: boolean;
  storage: boolean;
}> {
  console.log('Permissions: Checking app permissions');

  const { status: notificationStatus } = await Notifications.getPermissionsAsync();
  const notifications = notificationStatus === 'granted';

  // Sync stored flag with actual system status
  if (!notifications) {
    await AsyncStorage.removeItem(PERMISSIONS_GRANTED_KEY);
  }

  const storage = true;

  console.log('Permissions: Current permissions - notifications:', notifications, 'storage:', storage);

  return { notifications, storage };
}

// Show permissions info
export function showPermissionsInfo(): void {
  Alert.alert(
    'App Permissions',
    'TechTimes requires the following permissions:\n\n' +
    '• Notifications: To remind you about daily targets and important updates\n' +
    '• Storage: To save and export your job data securely on your device\n\n' +
    'All data is stored locally on your device and never sent to external servers.',
    [{ text: 'OK' }]
  );
}
