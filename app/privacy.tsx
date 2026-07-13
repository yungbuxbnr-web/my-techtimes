
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';

export default function PrivacyScreen() {
  console.log('PrivacyScreen: Rendering privacy notice');
  const { theme } = useThemeContext();

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          title: 'Privacy Notice',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="shield.fill"
            android_material_icon_name="security"
            size={52}
            color={theme.primary}
          />
          <Text style={[styles.appName, { color: theme.text }]}>Privacy Notice</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Tech Times — Your Data, Your Device
          </Text>
          <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>
            Last updated: January 2025
          </Text>
        </View>

        {/* Section 1 — Overview */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Overview</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is designed with privacy as its foundation. The app operates entirely offline. No data is ever transmitted to external servers, third parties, or cloud services. Everything you enter stays on your device.
          </Text>
          <View style={[styles.successBox, { backgroundColor: theme.background, borderLeftColor: '#4caf50' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ✅ 100% offline. No cloud. No tracking. No servers. Your data stays on your device.
            </Text>
          </View>
        </View>

        {/* Section 2 — Data We Collect */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Data We Collect (On-Device Only)</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Job Records</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            WIP numbers, vehicle registrations, AW values, VHC statuses, notes, timestamps, job card photos.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Work Schedule</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Working days, start/end times, lunch times, Saturday frequency.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Absence Records</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Absence type, date, duration. No personal medical details stored.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Settings</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Monthly target, notification preferences, theme preferences, formula settings.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Security</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            PIN hash (stored in device secure keychain via expo-secure-store, never readable), biometric preference flag.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Profile</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Technician name (optional), phone (optional), location (optional).
          </Text>
        </View>

        {/* Section 3 — Data We Do NOT Collect */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Data We Do NOT Collect</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • No customer names, addresses, phone numbers, or emails{'\n'}
            • No vehicle owner information{'\n'}
            • No location data or GPS tracking{'\n'}
            • No device identifiers or advertising IDs{'\n'}
            • No usage analytics or crash reports sent externally{'\n'}
            • No payment information{'\n'}
            • No biometric data (biometric authentication is handled entirely by the device OS)
          </Text>
        </View>

        {/* Section 4 — How Data Is Stored */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>4. How Data Is Stored</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            All data is stored using React Native AsyncStorage (device local storage) and expo-secure-store (device keychain for PIN). Job card photos are stored in the app's local file system. No data is stored in the cloud.
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Data persists until you clear it via Settings → Data Management → Clear All Data, or until the app is uninstalled.
          </Text>
        </View>

        {/* Section 5 — Data Sharing */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Data Sharing</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            We do not share, sell, rent, or transmit your data to any third party. The only data movement is:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • PDF/JSON exports: initiated by you, shared only to destinations you choose (email, cloud storage, etc.){'\n'}
            • Google Drive Sync (optional): if you choose to use this feature, your job data is uploaded to your own Google Drive account using your own Google OAuth credentials. We do not have access to your Google account.
          </Text>
        </View>

        {/* Section 6 — Permissions */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Permissions</Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Camera</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Used only when you tap "Scan Card", "Scan Reg", or attach a photo. Never accessed in the background.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Photo Library</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Used only when you choose to attach a photo from your gallery. Never accessed in the background.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Used for work schedule reminders and performance alerts. You control which notifications are enabled.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Biometrics (Face ID / Fingerprint)</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Used only for app unlock. Biometric data is processed entirely by the device OS (iOS Secure Enclave / Android TEE). The app never sees or stores biometric data.
          </Text>
          <Text style={[styles.subsectionTitle, { color: theme.text }]}>Background App Refresh</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Used to update the home screen widget and check notification schedules. No data is transmitted.
          </Text>
        </View>

        {/* Section 7 — GDPR */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>7. GDPR Compliance</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is designed to be GDPR-compliant by default:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Data minimisation: only job-relevant data is stored{'\n'}
            • Purpose limitation: data is used only for performance tracking within the app{'\n'}
            • Storage limitation: you can delete all data at any time{'\n'}
            • Data portability: export all your data as JSON at any time{'\n'}
            • No consent required for processing: all processing is local and for your own use only{'\n'}
            • No data controller/processor relationship: you are the sole controller of your own data
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ℹ️ As all data is stored locally, you are both the data subject and the data controller. No GDPR obligations apply to the developer.
            </Text>
          </View>
        </View>

        {/* Section 8 — Data Retention */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>8. Data Retention</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Data is retained on your device until you delete it. There is no automatic expiry. We recommend creating regular JSON backups before clearing data or reinstalling the app.
          </Text>
        </View>

        {/* Section 9 — Children's Privacy */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>9. Children's Privacy</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is intended for use by working vehicle technicians (adults). It is not directed at children under 13. No data from children is knowingly collected.
          </Text>
        </View>

        {/* Section 10 — Changes */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>10. Changes to This Privacy Notice</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            This privacy notice may be updated with new app versions. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of the app after an update constitutes acceptance of the revised notice.
          </Text>
        </View>

        {/* Section 11 — Contact */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>11. Contact</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            For privacy-related questions, contact the developer via the app store listing. As all data is stored locally on your device, we have no access to your data and cannot assist with data recovery.
          </Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            © 2025 Tech Times. All rights reserved. Created by b.rugge.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  header: { alignItems: 'center', padding: 28, borderRadius: 16, marginBottom: 20 },
  appName: { fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, fontStyle: 'italic', paddingHorizontal: 20 },
  lastUpdated: { fontSize: 12, marginTop: 8 },
  section: { padding: 20, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 14 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  text: { fontSize: 14, lineHeight: 24, marginBottom: 8 },
  infoBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 12 },
  warningBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 8, marginBottom: 4 },
  successBox: { padding: 16, borderRadius: 8, borderLeftWidth: 4, marginTop: 8, marginBottom: 4 },
  footer: { padding: 24, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  footerText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
