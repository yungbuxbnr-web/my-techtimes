
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

export default function TermsScreen() {
  console.log('TermsScreen: Rendering terms and conditions');
  const { theme } = useThemeContext();

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          title: 'Terms & Conditions',
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
            ios_icon_name="doc.text.fill"
            android_material_icon_name="description"
            size={52}
            color={theme.primary}
          />
          <Text style={[styles.appName, { color: theme.text }]}>Terms &amp; Conditions</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Tech Times</Text>
          <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>
            Effective date: January 2025
          </Text>
        </View>

        {/* Section 1 — Acceptance */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            By downloading, installing, or using Tech Times ("the App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, do not use the App. These Terms constitute a legally binding agreement between you ("User") and b.rugge ("Owner", "we", "us").
          </Text>
        </View>

        {/* Section 2 — Description */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>2. Description of the App</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is a personal job tracking application designed for vehicle technicians. It allows users to log jobs, track performance metrics, calculate efficiency, and generate reports. The App operates entirely offline and does not require an internet connection for any core functionality.
          </Text>
        </View>

        {/* Section 3 — Licence */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Licence</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Subject to these Terms, the Owner grants you a limited, non-exclusive, non-transferable, revocable licence to use the App on your personal device(s) for your own personal, non-commercial job tracking purposes. This licence does not include any right to:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            (a) sublicence, sell, resell, transfer, assign, or otherwise commercially exploit the App{'\n'}
            (b) modify or make derivative works based upon the App{'\n'}
            (c) reverse engineer or access the App in order to build a competitive product or service{'\n'}
            (d) copy any features, functions, or graphics of the App
          </Text>
        </View>

        {/* Section 4 — User Responsibilities */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>4. User Responsibilities</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            You are solely responsible for:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • The accuracy of all data you enter into the App{'\n'}
            • Maintaining the security of your PIN and device{'\n'}
            • Creating regular backups of your data (JSON export){'\n'}
            • Ensuring the App is used in compliance with your employer's policies{'\n'}
            • Any decisions made based on the App's calculations and reports
          </Text>
        </View>

        {/* Section 5 — Data & Privacy */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Data &amp; Privacy</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Your use of the App is also governed by our Privacy Notice (accessible from Settings → Privacy Notice). All data is stored locally on your device. We have no access to your data. You are the sole owner and controller of all data you enter into the App.
          </Text>
        </View>

        {/* Section 6 — Accuracy */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Accuracy of Calculations</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            The App's efficiency calculations, target calculations, and performance metrics are provided for informational and personal tracking purposes only. While we strive for accuracy, the Owner makes no warranty that the calculations are error-free or suitable for any particular purpose.
          </Text>
          <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ⚠️ Do not rely solely on the App's calculations for employment, payroll, or contractual purposes. Always verify important figures independently.
            </Text>
          </View>
        </View>

        {/* Section 7 — Disclaimer */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>7. Disclaimer of Warranties</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE OWNER DOES NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </Text>
        </View>

        {/* Section 8 — Limitation of Liability */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>8. Limitation of Liability</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OWNER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE APP, EVEN IF THE OWNER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THE OWNER'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE APP.
          </Text>
        </View>

        {/* Section 9 — Data Loss */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>9. Data Loss</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            The Owner is not responsible for any loss of data resulting from: device failure, app reinstallation, OS updates, accidental deletion, forgotten PIN, or any other cause. You are solely responsible for maintaining backups of your data.
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ℹ️ We strongly recommend creating regular JSON backups via Settings → Data Management → Create Backup.
            </Text>
          </View>
        </View>

        {/* Section 10 — Updates */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>10. Updates &amp; Changes</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            The Owner reserves the right to modify, update, or discontinue the App at any time without notice. Updates may change features, fix bugs, or alter calculations. Continued use of the App after an update constitutes acceptance of any changes. These Terms may also be updated; the effective date at the top of this page reflects the most recent revision.
          </Text>
        </View>

        {/* Section 11 — Intellectual Property */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>11. Intellectual Property</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            All intellectual property rights in the App are owned by the Owner as described in the Copyright Notice (accessible from Settings → Copyright). Nothing in these Terms grants you any rights in the App's intellectual property except the limited licence described in Section 3.
          </Text>
        </View>

        {/* Section 12 — Termination */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>12. Termination</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            This licence is effective until terminated. It will terminate automatically if you fail to comply with any of these Terms. Upon termination, you must cease all use of the App and delete it from your device. Sections 7, 8, 9, 11, and 13 shall survive termination.
          </Text>
        </View>

        {/* Section 13 — Governing Law */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>13. Governing Law &amp; Dispute Resolution</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales. If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.
          </Text>
        </View>

        {/* Section 14 — Contact */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>14. Contact</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            For questions about these Terms, contact the developer via the app store listing.
          </Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            © 2025 b.rugge. All Rights Reserved.
          </Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            By using Tech Times you agree to these Terms &amp; Conditions.
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
