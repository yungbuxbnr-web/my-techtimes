
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_ASKED_KEY = 'permissions_asked_v2';

export interface PermissionResults {
  notifications: boolean;
  camera: boolean;
  mediaLibrary: boolean;
  background: boolean;
}

/** Request notification permission. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return true;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      return true;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Request camera permission via expo-image-picker. Returns true if granted. */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return true;
    const { status: existing } = await ImagePicker.getCameraPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Request media library (gallery) permission. Returns true if granted. */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return true;
    const { status: existing } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Request background fetch permission (Android only). Returns true if granted or not needed. */
export async function requestBackgroundPermissions(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') return true;
    // expo-background-fetch on Android is controlled by the manifest — no runtime dialog needed.
    return true;
  } catch {
    return false;
  }
}

/** Request all permissions in sequence. Returns results for each. */
export async function requestAllPermissions(): Promise<PermissionResults> {
  console.log('Permissions: Requesting all app permissions');
  const notifications = await requestNotificationPermissions();
  console.log('Permissions: notifications ->', notifications);
  const camera = await requestCameraPermissions();
  console.log('Permissions: camera ->', camera);
  const mediaLibrary = await requestMediaLibraryPermissions();
  console.log('Permissions: mediaLibrary ->', mediaLibrary);
  const background = await requestBackgroundPermissions();
  console.log('Permissions: background ->', background);
  await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
  return { notifications, camera, mediaLibrary, background };
}

/** Check current permission status without prompting. */
export async function checkPermissions(): Promise<PermissionResults> {
  try {
    const notifStatus = Platform.OS !== 'web'
      ? (await Notifications.getPermissionsAsync()).status === 'granted'
      : true;
    const cameraStatus = Platform.OS !== 'web'
      ? (await ImagePicker.getCameraPermissionsAsync()).status === 'granted'
      : true;
    const mediaStatus = Platform.OS !== 'web'
      ? (await ImagePicker.getMediaLibraryPermissionsAsync()).status === 'granted'
      : true;
    return {
      notifications: notifStatus,
      camera: cameraStatus,
      mediaLibrary: mediaStatus,
      background: true,
    };
  } catch {
    return { notifications: false, camera: false, mediaLibrary: false, background: false };
  }
}

/** Open device app settings so user can manually grant permissions. */
export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
    } else if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    }
  } catch {
    Alert.alert('Error', 'Could not open app settings');
  }
}

// Keep legacy export names for backward compatibility
export { openAppSettings as openNotificationSettings };

export function showPermissionsInfo(): void {
  Alert.alert(
    'App Permissions',
    'TechTimes requires:\n\n• Notifications: Work schedule reminders\n• Camera: Profile photos and job images\n• Gallery: Import images from your library\n• Background: Live clock and widget updates\n\nAll data stays on your device.',
    [{ text: 'OK' }]
  );
}
