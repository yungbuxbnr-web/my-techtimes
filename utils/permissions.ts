
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  console.log('Permissions: Requesting notification permissions');
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permissions: Notification permission denied');
      Alert.alert(
        'Notifications Disabled',
        'You can enable notifications in your device settings to receive reminders and alerts.'
      );
      return false;
    }
    
    console.log('Permissions: Notification permission granted');
    
    // Configure notification handler
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

// Request all app permissions
export async function requestAllPermissions(): Promise<{
  notifications: boolean;
  storage: boolean;
}> {
  console.log('Permissions: Requesting all app permissions');
  
  const notifications = await requestNotificationPermissions();
  
  // Storage permissions are automatically granted on modern Android/iOS
  // File system access through expo-file-system doesn't require explicit permissions
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
  
  // Storage is always available
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
