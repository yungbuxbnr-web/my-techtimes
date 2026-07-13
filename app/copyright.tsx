
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

export default function CopyrightScreen() {
  console.log('CopyrightScreen: Rendering copyright notice');
  const { theme } = useThemeContext();

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          title: 'Copyright',
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
            ios_icon_name="c.circle.fill"
            android_material_icon_name="copyright"
            size={52}
            color={theme.primary}
          />
          <Text style={[styles.appName, { color: theme.text }]}>Copyright Notice</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Tech Times</Text>
          <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>
            © 2025 b.rugge. All Rights Reserved.
          </Text>
        </View>

        {/* Section 1 — Copyright Ownership */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Copyright Ownership</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times and all of its content, features, functionality, design, source code, algorithms, user interface, graphics, icons, and documentation are the exclusive intellectual property of b.rugge ("the Owner") and are protected by copyright law, trade secret law, and other applicable intellectual property laws and treaties.
          </Text>
        </View>

        {/* Section 2 — What Is Protected */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>2. What Is Protected</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • The Tech Times application name, logo, and branding{'\n'}
            • All source code, algorithms, and software architecture{'\n'}
            • The AW-based efficiency calculation system and methodology{'\n'}
            • All user interface designs, layouts, and visual elements{'\n'}
            • All written content, documentation, and user guides{'\n'}
            • The Smart Job Entry AI parsing system{'\n'}
            • All PDF report templates and export formats{'\n'}
            • The notification scheduling system and background processing logic{'\n'}
            • The widget designs for iOS and Android
          </Text>
        </View>

        {/* Section 3 — Permitted Use */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Permitted Use</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            You are granted a personal, non-exclusive, non-transferable, revocable licence to use Tech Times on your personal device(s) solely for your own personal job tracking purposes. This licence does not include the right to:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Copy, modify, or distribute the application or its source code{'\n'}
            • Reverse engineer, decompile, or disassemble the application{'\n'}
            • Create derivative works based on the application{'\n'}
            • Use the application for commercial purposes beyond personal job tracking{'\n'}
            • Remove or alter any copyright, trademark, or proprietary notices
          </Text>
        </View>

        {/* Section 4 — Restrictions */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Restrictions</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            You may not:
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            • Reproduce, duplicate, copy, sell, resell, or exploit any portion of the application{'\n'}
            • Use the Tech Times name, logo, or branding without prior written permission{'\n'}
            • Claim ownership of any part of the application{'\n'}
            • Distribute modified versions of the application{'\n'}
            • Use the application's design or methodology to create a competing product
          </Text>
          <View style={[styles.warningBox, { backgroundColor: theme.background, borderLeftColor: '#ff9800' }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ⚠️ Unauthorised use of any copyrighted material may result in civil and/or criminal penalties.
            </Text>
          </View>
        </View>

        {/* Section 5 — Third-Party Components */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Third-Party Components</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Tech Times is built using open-source components including React Native, Expo, and various open-source libraries. These components are used under their respective licences (MIT, Apache 2.0, etc.) and their copyright notices are retained as required. The use of these components does not affect the copyright ownership of Tech Times itself.
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.background, borderLeftColor: theme.primary }]}>
            <Text style={[styles.text, { color: theme.text, marginBottom: 0 }]}>
              ℹ️ Open-source licence notices are available in the app's package metadata and source repository.
            </Text>
          </View>
        </View>

        {/* Section 6 — Trademarks */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Trademarks</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            "Tech Times" is a trademark of b.rugge. All other trademarks, service marks, and trade names referenced in the application are the property of their respective owners.
          </Text>
        </View>

        {/* Section 7 — Infringement */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>7. Infringement</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Unauthorised use of any copyrighted material from Tech Times may violate copyright law, trademark law, and other applicable laws and could result in civil and/or criminal penalties. If you believe your copyright has been infringed by Tech Times, please contact the developer via the app store listing.
          </Text>
        </View>

        {/* Section 8 — Governing Law */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>8. Governing Law</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            This copyright notice and any disputes arising from it shall be governed by the laws of England and Wales. Any legal proceedings shall be subject to the exclusive jurisdiction of the courts of England and Wales.
          </Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            © 2025 b.rugge. All Rights Reserved.
          </Text>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Tech Times is a registered trademark of b.rugge.
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
