
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import AppBackground from '@/components/AppBackground';
import * as Haptics from 'expo-haptics';

const safeHaptics = {
  selectionAsync: async () => {
    if (Platform.OS === 'web') return;
    try { await Haptics.selectionAsync(); } catch {}
  },
};

interface MoreItem {
  icon_ios: string;
  icon_android: string;
  label: string;
  subtitle: string;
  route: string;
  color: string;
}

export default function MoreScreen() {
  const { theme } = useThemeContext();

  const sections: { title: string; items: MoreItem[] }[] = [
    {
      title: 'Intelligence',
      items: [
        {
          icon_ios: 'sparkles',
          icon_android: 'auto-awesome',
          label: 'AI Assistant',
          subtitle: 'Ask questions about your performance',
          route: '/(tabs)/ai',
          color: '#7C3AED',
        },
        {
          icon_ios: 'chart.line.uptrend.xyaxis',
          icon_android: 'trending-up',
          label: 'Projections',
          subtitle: 'Forecasts and scenario simulator',
          route: '/projections',
          color: '#2563EB',
        },
        {
          icon_ios: 'chart.bar.xaxis',
          icon_android: 'insights',
          label: 'Insights',
          subtitle: 'Deep performance analytics',
          route: '/(tabs)/insights',
          color: '#0891B2',
        },
        {
          icon_ios: 'magnifyingglass',
          icon_android: 'search',
          label: 'Smart Search',
          subtitle: 'Search across all records',
          route: '/smart-search',
          color: '#2563EB',
        },
      ],
    },
    {
      title: 'Work Control',
      items: [
        {
          icon_ios: 'tray.full.fill',
          icon_android: 'inbox',
          label: 'Open Job Control Centre',
          subtitle: 'Review unfinished work and Billing attention',
          route: '/open-job-control',
          color: '#F59E0B',
        },
        {
          icon_ios: 'arrow.triangle.2.circlepath',
          icon_android: 'sync',
          label: 'Handover Board',
          subtitle: 'Carry-over jobs and notes',
          route: '/handover',
          color: '#D97706',
        },
        {
          icon_ios: 'book.closed.fill',
          icon_android: 'menu-book',
          label: 'Technical Cases',
          subtitle: 'Diagnostic and repair case library',
          route: '/technical-cases',
          color: '#7C3AED',
        },
      ],
    },
    {
      title: 'Tools',
      items: [
        {
          icon_ios: 'magnifyingglass.circle.fill',
          icon_android: 'search',
          label: 'Job Store',
          subtitle: 'Search all job history',
          route: '/(tabs)/job-store',
          color: '#059669',
        },
        {
          icon_ios: 'photo.stack.fill',
          icon_android: 'photo-library',
          label: 'Media',
          subtitle: 'Job photos and images',
          route: '/(tabs)/media',
          color: '#D97706',
        },
        {
          icon_ios: 'calendar',
          icon_android: 'calendar-today',
          label: 'Work Calendar',
          subtitle: 'Schedule and absences',
          route: '/work-calendar',
          color: '#DC2626',
        },
        {
          icon_ios: 'clock.arrow.circlepath',
          icon_android: 'history',
          label: 'Activity Log',
          subtitle: 'Recent app activity',
          route: '/activity-logs',
          color: '#7C3AED',
        },
        {
          icon_ios: 'car.fill',
          icon_android: 'directions-car',
          label: 'Vehicle History',
          subtitle: 'Browse history by registration',
          route: '/vehicle-history',
          color: '#0891B2',
        },
        {
          icon_ios: 'doc.text.fill',
          icon_android: 'description',
          label: 'Job Templates',
          subtitle: 'Speed up job entry with templates',
          route: '/job-templates',
          color: '#059669',
        },
      ],
    },
    {
      title: 'Account & Settings',
      items: [
        {
          icon_ios: 'gearshape.fill',
          icon_android: 'settings',
          label: 'Settings',
          subtitle: 'App preferences and configuration',
          route: '/(tabs)/settings',
          color: '#6B7280',
        },
        {
          icon_ios: 'bell.fill',
          icon_android: 'notifications',
          label: 'Notifications',
          subtitle: 'Alerts and reminders',
          route: '/notification-settings',
          color: '#F59E0B',
        },
        {
          icon_ios: 'arrow.up.doc.fill',
          icon_android: 'backup',
          label: 'Backup Centre',
          subtitle: 'Backup and restore your data',
          route: '/(tabs)/settings',
          color: '#10B981',
        },
      ],
    },
    {
      title: 'Reports & Analysis',
      items: [
        {
          icon_ios: 'doc.richtext.fill',
          icon_android: 'picture-as-pdf',
          label: 'PDF & Report Centre',
          subtitle: 'Performance, billing, job PDFs, technical evidence packs and custom reports',
          route: '/report-builder',
          color: '#DC2626',
        },
        {
          icon_ios: 'checkmark.shield.fill',
          icon_android: 'verified',
          label: 'Data Quality',
          subtitle: 'Scan records for issues',
          route: '/data-quality',
          color: '#10B981',
        },
        {
          icon_ios: 'arrow.left.arrow.right',
          icon_android: 'compare-arrows',
          label: 'Reconciliation',
          subtitle: 'Check recorded vs billed figures',
          route: '/reconciliation',
          color: '#F59E0B',
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon_ios: 'book.fill',
          icon_android: 'menu-book',
          label: 'Help & User Manual',
          subtitle: 'Complete guide to Tech Times',
          route: '/user-manual',
          color: '#2563EB',
        },
        {
          icon_ios: 'info.circle.fill',
          icon_android: 'info',
          label: 'About Tech Times',
          subtitle: 'Version and app information',
          route: '/about',
          color: '#3B82F6',
        },
        {
          icon_ios: 'doc.text.fill',
          icon_android: 'description',
          label: 'Privacy Notice',
          subtitle: 'How your data is used',
          route: '/privacy',
          color: '#6B7280',
        },
        {
          icon_ios: 'c.circle.fill',
          icon_android: 'copyright',
          label: 'Copyright',
          subtitle: 'Legal information',
          route: '/copyright',
          color: '#6B7280',
        },
        {
          icon_ios: 'doc.plaintext.fill',
          icon_android: 'article',
          label: 'Terms of Use',
          subtitle: 'Terms and conditions',
          route: '/terms',
          color: '#6B7280',
        },
      ],
    },
  ];

  const handlePress = (route: string, label: string) => {
    console.log('MoreScreen: Tapped item:', label, '→', route);
    safeHaptics.selectionAsync();
    router.push(route as any);
  };

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight ?? 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.text }]}>More</Text>

        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {section.title.toUpperCase()}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    index < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.border },
                  ]}
                  onPress={() => handlePress(item.route, item.label)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    <IconSymbol
                      ios_icon_name={item.icon_ios}
                      android_material_icon_name={item.icon_android as any}
                      size={22}
                      color={item.color}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
                  </View>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={16}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>Tech Times</Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 16 },
  pageTitle: { fontSize: 34, fontWeight: 'bold', marginBottom: 24, marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  rowSubtitle: { fontSize: 13 },
  footer: { alignItems: 'center', paddingVertical: 16 },
  footerText: { fontSize: 13 },
});
