
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import Constants from 'expo-constants';

type Section = {
  title: string;
  body: string;
};

const MANUAL_SECTIONS: Section[] = [
  {
    title: 'Getting Started',
    body: `Welcome to Tech Times — a fully offline, PIN-secured job tracking app for vehicle technicians.\n\nOn first launch you will be guided through the Setup wizard to configure your work schedule, daily hours, lunch break, and monthly target. After setup, create a 4-digit PIN to secure the app.\n\nAll data is stored locally on your device. No account or internet connection is required for core features.`,
  },
  {
    title: 'Home Dashboard',
    body: `The Dashboard is your real-time command centre. It auto-refreshes every 30 seconds.\n\n• Live Clock — large digital clock updating every second.\n• Streaks Card — current streak, best streak, best day this month.\n• Workday Progress Bar — spans your configured work start to end time with a lunch window.\n• 3 Concentric Rings — inner: daily target; middle: time elapsed; outer: sold hours vs target.\n• Monthly Target Ring — sold hours vs monthly target.\n• Efficiency Ring — sold hours ÷ available hours × 100.\n• Monthly Breakdown Card — total AW, sold hours, target, available hours, efficiency.\n• 4 Stat Tiles — Total AWs, Time Logged, Jobs Done, Hours Remaining.\n• Today & This Week Cards — tappable for detailed breakdowns.\n• Add New Job Button — opens the Add Job modal.`,
  },
  {
    title: 'Jobs',
    body: `Tap Add New Job on the Dashboard or the + Add Job button in Job Records.\n\nFields:\n• WIP Number — exactly 5 digits (e.g. 12345).\n• Vehicle Registration — auto-uppercased. Scan button available.\n• AW Value — 0–100. Live time preview shown.\n• VHC Status — Green / Orange / Red / None.\n• Date & Time — defaults to now. Cannot be set in the future.\n• Notes — optional free-text.\n• Job Card Photo — optional. Take a photo or choose from gallery.\n\nScan Buttons:\n• Scan Card — OCR scans a job card image to extract WIP and registration.\n• Scan Reg — OCR scans a number plate image.\n\nMemory Autocomplete — as you type, a dropdown shows matching previous jobs.`,
  },
  {
    title: 'Billing',
    body: `The Billing screen (Billed & Open tab) tracks the billing lifecycle of every job.\n\nSub-tabs:\n• Overview — period summary cards: Recorded, Billed, Ready to Bill, Open hours.\n• Records — filterable list of all jobs with billing status. Swipe right to bill, swipe left to edit.\n• Trends — compare current period vs previous period for key billing metrics.\n• Reports — generate a PDF billing report for any period.\n• Backup — export billing data as JSON or restore from a previous backup.\n\nBilling Statuses:\n• Open — job recorded, work not yet complete.\n• Ready to Bill — work marked complete, awaiting billing closure.\n• Billed — job closed and billed.\n• Legacy — imported jobs with unknown status.\n\nBulk Actions — long-press any row to enter selection mode, then mark multiple jobs as billed at once.`,
  },
  {
    title: 'Work Schedule & Lunch Rules',
    body: `Configure your work schedule in Settings → Edit Work Schedule.\n\nSettings:\n• Work days — toggle each day on/off.\n• Start time / End time — your shift hours.\n• Daily hours — total paid hours per day.\n• Lunch break duration — deducted from available hours.\n• Lunch start / end window — shown on the workday progress bar.\n\nThese settings affect efficiency calculations, the workday progress bar, and notification scheduling. Keep them accurate for correct efficiency figures.`,
  },
  {
    title: 'Absences',
    body: `Log absences in Settings → Absence Logger to keep efficiency calculations accurate.\n\nAbsence types: Holiday, Sick, Training, Other.\n\nEach absence deducts the appropriate hours from your available hours for the period. Absences are shown on the Performance Calendar with a distinct colour.\n\nTip: log absences on the day they occur for the most accurate real-time efficiency.`,
  },
  {
    title: 'Billing Calculations',
    body: `Core formula:\n1 AW = 5 minutes\nSold Hours = Total AW × 5 ÷ 60\nEfficiency = Sold Hours ÷ Available Hours × 100\nAvailable Hours = Working Days Elapsed × Daily Hours − Absences\nTarget Hours = Working Days in Month × Daily Hours\n\nBilling Conversion = Billed Hours ÷ Recorded Hours × 100\n\nEfficiency thresholds (configurable in Formula Settings):\n• ≥ 65% — Excellent (green)\n• ≥ 31% — Good (yellow)\n• < 31% — Needs Improvement (red)`,
  },
  {
    title: 'Vehicle History',
    body: `Vehicle History shows all jobs for a specific registration across all time.\n\nAccess via the Vehicle History screen (Settings → Tools → Vehicle History) or by tapping a registration in any job list.\n\nShows: visit count, total AW, average AW per visit, first and last seen dates, full job history sorted by date.\n\nUseful for identifying repeat customers and tracking vehicle service history.`,
  },
  {
    title: 'Job Templates',
    body: `Job Templates let you save common job configurations for quick re-use.\n\nCreate a template from any job or from scratch. Templates store: AW value, VHC status, and notes.\n\nWhen adding a new job, tap the Templates button to apply a template — it pre-fills the AW, VHC, and notes fields instantly.`,
  },
  {
    title: 'Smart Search',
    body: `Smart Search lets you search all jobs across all time by WIP number, vehicle registration, or notes.\n\nFilters:\n• Date range — All Time, Today, This Week, This Month.\n• VHC status — Green, Orange, Red, None.\n\nSort options: Newest, Oldest, Highest AW, Lowest AW, WIP A–Z, WIP Z–A.\n\nA live totals bar shows job count and total AW for the filtered results.`,
  },
  {
    title: 'Handover Board',
    body: `The Handover Board is a digital end-of-day handover tool.\n\nAdd handover notes for jobs that need attention the next day. Each note has a priority (High / Medium / Low), a WIP number, and a description.\n\nNotes can be marked as resolved and are automatically cleared after 7 days. Export the handover board as a PDF to share with colleagues.`,
  },
  {
    title: 'Technical Cases',
    body: `Technical Cases lets you log complex diagnostic jobs with detailed notes, fault codes, and resolution steps.\n\nEach case links to a WIP number and vehicle registration. Cases can be marked as Open, In Progress, or Resolved.\n\nSearch cases by WIP, reg, or keyword. Export individual cases or all cases as PDF.`,
  },
  {
    title: 'Performance Heatmap',
    body: `The Performance Heatmap shows your daily AW output as a colour-coded calendar grid.\n\nColour intensity reflects AW volume — darker = more AW. Tap any day to see the jobs logged that day.\n\nView modes: Month, Quarter, Year. Useful for identifying your most and least productive periods.`,
  },
  {
    title: 'VHC Intelligence',
    body: `VHC Intelligence analyses your VHC (Vehicle Health Check) data across all jobs.\n\nShows:\n• VHC conversion rate — percentage of jobs with a VHC status.\n• Status breakdown — Green / Orange / Red / None counts and percentages.\n• Trend over time — VHC rate by week or month.\n• Top vehicles by VHC status.\n\nUse this to track your advisory and upsell performance.`,
  },
  {
    title: 'Reconciliation',
    body: `Reconciliation compares your recorded hours against your billed hours to identify discrepancies.\n\nFor any period, it shows:\n• Recorded hours vs billed hours.\n• Unbilled hours (open + ready to bill).\n• Billing conversion percentage.\n• Jobs with no billing record.\n\nUse reconciliation at the end of each week or month to ensure all completed work has been billed.`,
  },
  {
    title: 'Data Quality',
    body: `Data Quality scans your job records for potential issues:\n\n• Duplicate WIP numbers — same WIP logged more than once on the same day.\n• Missing fields — jobs with no AW value or no registration.\n• Unusually high AW — jobs with AW above a configurable threshold.\n• Future-dated jobs — jobs with a date in the future.\n\nTap any issue to navigate directly to the affected job for correction.`,
  },
  {
    title: 'Reports & PDFs',
    body: `Tech Times can generate PDF reports for:\n\n• Complete User Guide — from About screen.\n• Billing Report — from Billing → Reports sub-tab.\n• Job Records — from Job Records tab (long-press for bulk export).\n• Handover Board — from Handover screen.\n• Technical Cases — from Technical Cases screen.\n\nAll PDFs are generated on-device and can be shared via any app (email, AirDrop, WhatsApp, etc.).`,
  },
  {
    title: 'AI Assistant',
    body: `The AI Assistant (Smart Job Entry) lets you describe a job in plain English and extracts the structured data automatically.\n\nExample inputs:\n• "12345 ABC123 20 AW green vhc"\n• "Job 11111 for ABC456 took 25 AW, orange VHC, brake service"\n• "WIP 54321 reg XYZ789 15 hours"\n\nA confidence score (0–100%) is shown. Below 70% triggers a clarification prompt.\n\nNote: the AI Assistant sends your text query to an AI service over the internet. Your raw job database is not sent.`,
  },
  {
    title: 'Backup Centre',
    body: `The Backup Centre (Billing → Backup sub-tab) lets you export and restore your billing data.\n\nExport:\n• Tap Export Billing Backup to save all billing records as a JSON file.\n• Share the file via email, AirDrop, or cloud storage.\n• The last 5 export timestamps are shown in Recent Exports.\n\nRestore:\n• Tap Restore Billing Backup and pick a previously exported JSON file.\n• The app validates the file and shows the record count before importing.\n• Records are merged — existing records are not overwritten.\n\nFor full job data backup, use the JSON export in Job Records.`,
  },
  {
    title: 'Troubleshooting',
    body: `Efficiency wrong:\nCheck work schedule, absence logger, formula settings, and job dates.\n\nBiometrics not working:\nCheck device enrollment, app permissions, try disable/re-enable, use PIN fallback.\n\nExport/PDF not working:\nCheck storage permissions, free space, try smaller date range, restart app.\n\nNotifications not appearing:\nCheck permissions, Do Not Disturb, Android battery optimisation, use Test Notification.\n\nImport failing:\nEnsure valid Tech Times JSON (not PDF/CSV), check file not corrupted, must contain "jobs" array.\n\nWidget not updating (iOS):\nSave a job or create backup to trigger refresh, remove and re-add widget.\n\nBilling backup restore failing:\nEnsure the file is a Tech Times billing backup JSON with billingBackupVersion and records fields.`,
  },
  {
    title: 'Privacy & Data',
    body: `Core job records, billing data, work schedules and absences are stored locally on your device and never automatically uploaded.\n\nWhen you use the AI Assistant, your query is sent to an AI service over the internet — your raw job database is not sent.\n\nOptional Google Drive sync, if enabled, uses the internet to back up data to your own Google Drive.\n\nPIN and biometric secrets never leave your device.\n\nPermissions used:\n• Camera — optional, for job card photos and OCR scanning.\n• Photo Library — optional, for attaching photos.\n• Notifications — optional, for work reminders.\n• Biometrics — optional, for PIN-free login.`,
  },
];

export default function UserManualScreen() {
  console.log('UserManualScreen: Rendering user manual');
  const { theme } = useThemeContext();
  const appVersion = Constants.expoConfig?.version ?? '1.7.0';
  const [searchQuery, setSearchQuery] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter(
      s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleToggle = (title: string) => {
    const next = openSection === title ? null : title;
    console.log('UserManualScreen: Section toggled:', title, '→', next ? 'open' : 'closed');
    setOpenSection(next);
  };

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          title: 'User Manual',
          headerShown: true,
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="book.fill"
            android_material_icon_name="menu-book"
            size={40}
            color={theme.primary}
          />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tech Times User Manual</Text>
          <Text style={[styles.headerVersion, { color: theme.primary }]}>v{appVersion}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Complete guide to all features
          </Text>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={18}
            color={theme.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={text => {
              console.log('UserManualScreen: Search query changed:', text);
              setSearchQuery(text);
            }}
            placeholder="Search manual…"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              console.log('UserManualScreen: Search cleared');
              setSearchQuery('');
            }}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Sections count */}
        {searchQuery.length > 0 && (
          <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
            {filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Accordion sections */}
        {filteredSections.map((section, index) => {
          const isOpen = openSection === section.title;
          return (
            <View
              key={section.title}
              style={[styles.sectionCard, { backgroundColor: theme.card }]}
            >
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => handleToggle(section.title)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={[styles.sectionNumber, { color: theme.primary }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                </View>
                <IconSymbol
                  ios_icon_name={isOpen ? 'chevron.up' : 'chevron.down'}
                  android_material_icon_name={isOpen ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {isOpen && (
                <View style={[styles.sectionBody, { borderTopColor: theme.border }]}>
                  <Text style={[styles.sectionBodyText, { color: theme.textSecondary }]}>
                    {section.body}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {filteredSections.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search-off"
              size={40}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No sections match your search
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerVersion: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  resultsCount: {
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionNumber: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    minWidth: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sectionBody: {
    borderTopWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionBodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
