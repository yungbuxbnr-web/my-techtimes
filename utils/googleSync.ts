
// utils/googleSync.ts
// Google Sign-In and Firebase Auth integration
// Firebase packages are optional — app works fully without them

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GoogleUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

export interface GoogleSyncConfig {
  isConfigured: boolean;
  projectId?: string;
  apiKey?: string;
}

// Placeholder config — user fills this in after creating Firebase project
// See: https://console.firebase.google.com
export const FIREBASE_CONFIG: GoogleSyncConfig = {
  isConfigured: false,
  // projectId: 'your-firebase-project-id',
  // apiKey: 'your-firebase-api-key',
};

const GOOGLE_USER_KEY = '@techtimes_google_user';
const GOOGLE_SYNC_ENABLED_KEY = '@techtimes_google_sync_enabled';

let _currentUser: GoogleUser | null = null;
let _isInitialised = false;

/**
 * Check if Firebase/Google Sign-In packages are available.
 * Returns false if packages are not installed yet.
 */
export function isGoogleSyncAvailable(): boolean {
  try {
    // These will be available after:
    // pnpm add @react-native-google-signin/google-signin @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
    require('@react-native-google-signin/google-signin');
    require('@react-native-firebase/auth');
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialise Google Sign-In. Safe to call even if packages are not installed.
 */
export async function initialiseGoogleSignIn(): Promise<void> {
  if (_isInitialised) return;
  _isInitialised = true;

  if (!isGoogleSyncAvailable()) {
    console.log('GoogleSync: packages not installed — sync unavailable');
    return;
  }

  if (!FIREBASE_CONFIG.isConfigured) {
    console.log('GoogleSync: Firebase not configured — sync unavailable');
    return;
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: FIREBASE_CONFIG.apiKey, // Replace with your Web Client ID from Firebase Console
      offlineAccess: true,
    });

    // Restore cached user
    const cached = await AsyncStorage.getItem(GOOGLE_USER_KEY);
    if (cached) {
      _currentUser = JSON.parse(cached);
    }

    console.log('GoogleSync: initialised successfully');
  } catch (error) {
    console.error('GoogleSync: initialisation failed', error);
  }
}

/**
 * Sign in with Google. Returns the user or null on failure.
 */
export async function signInWithGoogle(): Promise<GoogleUser | null> {
  if (!isGoogleSyncAvailable() || !FIREBASE_CONFIG.isConfigured) {
    throw new Error('Google Sign-In is not configured yet. Firebase setup required.');
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    const auth = require('@react-native-firebase/auth').default;

    await GoogleSignin.hasPlayServices();
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);

    const user: GoogleUser = {
      uid: userCredential.user.uid,
      email: userCredential.user.email ?? '',
      displayName: userCredential.user.displayName,
      photoURL: userCredential.user.photoURL,
    };

    _currentUser = user;
    await AsyncStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(user));

    return user;
  } catch (error) {
    console.error('GoogleSync: sign-in failed', error);
    throw error;
  }
}

/**
 * Sign out from Google.
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    if (isGoogleSyncAvailable()) {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      const auth = require('@react-native-firebase/auth').default;
      await GoogleSignin.signOut();
      await auth().signOut();
    }
    _currentUser = null;
    await AsyncStorage.removeItem(GOOGLE_USER_KEY);
    await AsyncStorage.setItem(GOOGLE_SYNC_ENABLED_KEY, 'false');
  } catch (error) {
    console.error('GoogleSync: sign-out failed', error);
  }
}

/**
 * Get the currently signed-in Google user.
 */
export function getCurrentGoogleUser(): GoogleUser | null {
  return _currentUser;
}

/**
 * Check if Google sync is enabled.
 */
export async function isGoogleSyncEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(GOOGLE_SYNC_ENABLED_KEY);
    return val === 'true' && _currentUser !== null;
  } catch {
    return false;
  }
}

/**
 * Enable or disable Google sync.
 */
export async function setGoogleSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}
