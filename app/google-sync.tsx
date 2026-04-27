
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  useGoogleAuth,
  exchangeCodeForTokens,
  saveTokens,
  fetchGoogleUserInfo,
  getStoredUser,
  signOutGoogle,
  runGoogleDriveSync,
} from '@/utils/googleDriveSync';
import type { GoogleUser, SyncResult } from '@/utils/googleDriveSync';

const LAST_SYNC_KEY = '@gdrive_last_sync';

const WHAT_SYNCED = [
  { icon: '🔧', label: 'All job records (WIP, reg, AW, notes)' },
  { icon: '📅', label: 'Work schedule (hours, days, lunch)' },
  { icon: '🔄', label: 'Two-way merge — newest record wins' },
  { icon: '📁', label: 'Stored in TechTimesAppData folder on your Drive' },
];

export default function GoogleSyncScreen() {
  const { theme } = useThemeContext();
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  const [user, setUser] = useState<GoogleUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const loadState = useCallback(async () => {
    console.log('GoogleSyncScreen: Loading stored auth state');
    const [storedUser, storedLastSync] = await Promise.all([
      getStoredUser(),
      AsyncStorage.getItem(LAST_SYNC_KEY),
    ]);
    setUser(storedUser);
    setLastSync(storedLastSync);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleAuthCode = useCallback(async (code: string) => {
    console.log('GoogleSyncScreen: Handling auth code exchange');
    setLoading(true);
    try {
      const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(
        code,
        redirectUri
      );
      await saveTokens(accessToken, refreshToken, expiresIn);
      const userInfo = await fetchGoogleUserInfo(accessToken);
      setUser(userInfo);
      console.log('GoogleSyncScreen: Sign-in complete for:', userInfo.email);
    } catch (err: any) {
      console.error('GoogleSyncScreen: Sign-in error:', err.message);
      Alert.alert('Sign-in error', err.message ?? 'Failed to complete sign-in');
    } finally {
      setLoading(false);
    }
  }, [redirectUri]);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
      console.log('GoogleSyncScreen: OAuth response received — success');
      handleAuthCode(response.params.code);
    } else if (response?.type === 'error') {
      console.log('GoogleSyncScreen: OAuth response received — error:', response.error?.message);
      Alert.alert('Sign-in failed', response.error?.message ?? 'Unknown error');
    }
  }, [response, handleAuthCode]);

  const handleSync = async () => {
    console.log('GoogleSyncScreen: User tapped Sync Now');
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await runGoogleDriveSync();
      const now = new Date().toLocaleString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      setSyncResult(result);
      console.log('GoogleSyncScreen: Sync complete:', result);
    } catch (err: any) {
      console.error('GoogleSyncScreen: Sync failed:', err.message);
      Alert.alert('Sync failed', err.message ?? 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    console.log('GoogleSyncScreen: User tapped Disconnect Google Account');
    Alert.alert(
      'Disconnect Google Account',
      'This will remove your Google sign-in from this device. Your data on Google Drive will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            console.log('GoogleSyncScreen: Confirmed disconnect');
            await signOutGoogle();
            setUser(null);
            setSyncResult(null);
          },
        },
      ]
    );
  };

  const handleConnectPress = () => {
    console.log('GoogleSyncScreen: User tapped Connect Google Account');
    promptAsync();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Google Drive Sync', headerBackTitle: 'Settings' }} />
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  const statusDotColor = user ? '#22c55e' : '#9ca3af';
  const statusText = user ? `Connected as ${user.name}` : 'Not connected';

  const jobsAddedLine = syncResult
    ? syncResult.jobsAdded > 0
      ? `✓ ${syncResult.jobsAdded} jobs added from Drive`
      : '✓ No new jobs from Drive'
    : '';

  const jobsUpdatedLine =
    syncResult && syncResult.jobsUpdated > 0
      ? `✓ ${syncResult.jobsUpdated} jobs updated`
      : null;

  const scheduleLine = syncResult
    ? syncResult.scheduleUpdated
      ? '✓ Schedule updated from Drive'
      : '✓ Schedule is up to date'
    : '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: 'Google Drive Sync', headerBackTitle: 'Settings' }} />

      {/* Header */}
      <View style={styles.header}>
        <AntDesign name="google" size={48} color="#4285F4" />
        <Text style={[styles.title, { color: theme.text }]}>Google Drive Sync</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sync your jobs and work schedule across devices using Google Drive
        </Text>
      </View>

      {/* Status card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>{statusText}</Text>
        </View>
        {user ? (
          <Text style={[styles.emailText, { color: theme.textSecondary }]}>{user.email}</Text>
        ) : null}
        {lastSync ? (
          <Text style={[styles.lastSyncText, { color: theme.textSecondary }]}>
            Last synced: {lastSync}
          </Text>
        ) : null}
      </View>

      {/* Sync result */}
      {syncResult ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.resultTitle, { color: theme.text }]}>Last Sync Result</Text>
          <Text style={[styles.resultLine, { color: theme.textSecondary }]}>{jobsAddedLine}</Text>
          {jobsUpdatedLine ? (
            <Text style={[styles.resultLine, { color: theme.textSecondary }]}>{jobsUpdatedLine}</Text>
          ) : null}
          <Text style={[styles.resultLine, { color: theme.textSecondary }]}>{scheduleLine}</Text>
        </View>
      ) : null}

      {/* What gets synced */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>What gets synced</Text>
        {WHAT_SYNCED.map((item, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{item.icon}</Text>
            <Text style={[styles.featureLabel, { color: theme.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Action buttons */}
      {!user ? (
        <TouchableOpacity
          style={[styles.primaryButton, !request && styles.buttonDisabled]}
          onPress={handleConnectPress}
          disabled={!request}
        >
          <AntDesign name="google" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Connect Google Account</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.primaryButton, syncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={[styles.disconnectText, { color: theme.textSecondary }]}>
              Disconnect Google Account
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        Note: A Google OAuth Client ID is required. Open{' '}
        <Text style={{ fontWeight: '600' }}>utils/googleDriveSync.ts</Text> and replace{' '}
        <Text style={{ fontStyle: 'italic' }}>YOUR_GOOGLE_WEB_CLIENT_ID</Text> with your Web
        client ID from Google Cloud Console (APIs &amp; Services → Credentials).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emailText: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 18,
  },
  lastSyncText: {
    fontSize: 12,
    marginTop: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultLine: {
    fontSize: 13,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 18,
  },
  featureLabel: {
    fontSize: 13,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  disconnectButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  disconnectText: {
    fontSize: 14,
  },
  note: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});
