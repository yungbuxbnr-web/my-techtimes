
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AppBackground from '@/components/AppBackground';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { offlineStorage } from '@/utils/offlineStorage';
import { exportToPdf, exportToJson, ExportOptions } from '@/utils/exportUtils';

type ExportType = 'daily' | 'weekly' | 'monthly' | 'all';
type ExportFormat = 'pdf' | 'json';

export default function ExportDataScreen() {
  const router = useRouter();
  const { theme } = useThemeContext();

  const [exportType, setExportType] = useState<ExportType>('monthly');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [exportDate, setExportDate] = useState(new Date());
  const [exportWeekStart, setExportWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const [exportMonth, setExportMonth] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    console.log('[ExportData] Export button pressed — type:', exportType, 'format:', exportFormat);
    setIsExporting(true);
    try {
      const profile = await api.getTechnicianProfile();
      const settings = await api.getSettings();
      const schedule = await api.getSchedule();

      let jobs: any[] = [];
      let exportOptions: ExportOptions = {
        type: exportType,
        targetHours: settings.monthlyTarget,
        availableHours: 0,
      };

      if (exportType === 'daily') {
        const dayStr = exportDate.toISOString().split('T')[0];
        console.log('[ExportData] Fetching jobs for day:', dayStr);
        jobs = await api.getJobsInRange(dayStr, dayStr);
        exportOptions.day = dayStr;
        const { getNetScheduledHours, buildWorkScheduleInput } = await import('@/utils/workTimeEngine');
        const dayOfWeek = exportDate.getDay();
        const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
        const isWorkingDay = workingDays.includes(dayOfWeek);
        exportOptions.availableHours = isWorkingDay ? getNetScheduledHours(buildWorkScheduleInput(schedule)) : 0;
      } else if (exportType === 'weekly') {
        const weekEnd = new Date(exportWeekStart);
        weekEnd.setDate(exportWeekStart.getDate() + 6);
        const startStr = exportWeekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];
        console.log('[ExportData] Fetching jobs for week:', startStr, '→', endStr);
        jobs = await api.getJobsInRange(startStr, endStr);
        const { getNetScheduledHours, buildWorkScheduleInput } = await import('@/utils/workTimeEngine');
        const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
        let weekAvailableHours = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(exportWeekStart);
          day.setDate(exportWeekStart.getDate() + i);
          if (workingDays.includes(day.getDay())) {
            weekAvailableHours += getNetScheduledHours(buildWorkScheduleInput(schedule));
          }
        }
        exportOptions.availableHours = weekAvailableHours;
      } else if (exportType === 'monthly') {
        const monthStr = `${exportMonth.getFullYear()}-${String(exportMonth.getMonth() + 1).padStart(2, '0')}`;
        console.log('[ExportData] Fetching jobs for month:', monthStr);
        jobs = await api.getJobsForMonth(monthStr);
        exportOptions.month = monthStr;
        const monthlyStats = await api.getMonthlyStats(monthStr);
        exportOptions.availableHours = monthlyStats.availableHours;
      } else {
        console.log('[ExportData] Fetching all jobs');
        jobs = await api.getAllJobs();
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const monthlyStats = await api.getMonthlyStats(currentMonth);
        exportOptions.availableHours = monthlyStats.availableHours;
      }

      console.log('[ExportData] Jobs fetched:', jobs.length, '— calling', exportFormat, 'export');

      if (exportFormat === 'pdf') {
        await exportToPdf(jobs, profile.name, exportOptions);
      } else {
        await exportToJson(jobs);
      }

      console.log('[ExportData] Export complete');
    } catch (err: any) {
      console.error('[ExportData] Export failed:', err);
      Alert.alert('Export Failed', err?.message || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportTypeLabel = exportType.toUpperCase();

  const weekEndDate = new Date(exportWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekStartLabel = exportWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekEndLabel = weekEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dailyLabel = exportDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const monthlyLabel = exportMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: statusBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('[ExportData] Back button pressed');
              router.back();
            }}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={22}
              color={theme.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Export Data</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Export Period */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>EXPORT PERIOD</Text>
          <View style={styles.typeGrid}>
            {(
              [
                { id: 'daily', label: 'Daily', ios: 'calendar', android: 'calendar-today' },
                { id: 'weekly', label: 'Weekly', ios: 'calendar', android: 'date-range' },
                { id: 'monthly', label: 'Monthly', ios: 'calendar', android: 'event' },
                { id: 'all', label: 'All Time', ios: 'clock', android: 'history' },
              ] as { id: ExportType; label: string; ios: string; android: string }[]
            ).map(type => {
              const isSelected = exportType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeChip,
                    { borderColor: isSelected ? theme.primary : theme.border },
                    isSelected && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    console.log('[ExportData] Export type selected:', type.id);
                    setExportType(type.id);
                  }}
                >
                  <IconSymbol
                    ios_icon_name={type.ios}
                    android_material_icon_name={type.android as any}
                    size={18}
                    color={isSelected ? '#ffffff' : theme.textSecondary}
                  />
                  <Text style={[styles.typeChipText, { color: isSelected ? '#ffffff' : theme.text }]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Daily navigator */}
          {exportType === 'daily' && (
            <View style={[styles.dateNavigator, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportDate);
                  d.setDate(d.getDate() - 1);
                  console.log('[ExportData] Daily date navigated back to:', d.toISOString().split('T')[0]);
                  setExportDate(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.dateNavText, { color: theme.text }]}>{dailyLabel}</Text>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportDate);
                  d.setDate(d.getDate() + 1);
                  console.log('[ExportData] Daily date navigated forward to:', d.toISOString().split('T')[0]);
                  setExportDate(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="arrow-forward" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Weekly navigator */}
          {exportType === 'weekly' && (
            <View style={[styles.dateNavigator, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportWeekStart);
                  d.setDate(d.getDate() - 7);
                  console.log('[ExportData] Week navigated back to:', d.toISOString().split('T')[0]);
                  setExportWeekStart(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={theme.primary} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[styles.dateNavText, { color: theme.text }]}>
                  {weekStartLabel}
                </Text>
                <Text style={[styles.dateNavText, { color: theme.text }]}>
                  {weekEndLabel}
                </Text>
                <Text style={[styles.dateNavSubtext, { color: theme.textSecondary }]}>Sunday to Saturday</Text>
              </View>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportWeekStart);
                  d.setDate(d.getDate() + 7);
                  console.log('[ExportData] Week navigated forward to:', d.toISOString().split('T')[0]);
                  setExportWeekStart(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="arrow-forward" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Monthly navigator */}
          {exportType === 'monthly' && (
            <View style={[styles.dateNavigator, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportMonth);
                  d.setMonth(d.getMonth() - 1);
                  console.log('[ExportData] Month navigated back to:', d.toISOString().split('T')[0]);
                  setExportMonth(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.dateNavText, { color: theme.text }]}>{monthlyLabel}</Text>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => {
                  const d = new Date(exportMonth);
                  d.setMonth(d.getMonth() + 1);
                  console.log('[ExportData] Month navigated forward to:', d.toISOString().split('T')[0]);
                  setExportMonth(d);
                }}
              >
                <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="arrow-forward" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Format selector */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>FORMAT</Text>

          <TouchableOpacity
            style={[
              styles.formatOption,
              { backgroundColor: exportFormat === 'pdf' ? theme.primary : theme.background, borderColor: theme.border },
            ]}
            onPress={() => {
              console.log('[ExportData] Format selected: pdf');
              setExportFormat('pdf');
            }}
          >
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={24}
              color={exportFormat === 'pdf' ? '#ffffff' : theme.text}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.formatTitle, { color: exportFormat === 'pdf' ? '#ffffff' : theme.text }]}>
                PDF
              </Text>
              <Text style={[styles.formatSubtitle, { color: exportFormat === 'pdf' ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
                Recommended — with efficiency bars
              </Text>
            </View>
            {exportFormat === 'pdf' && (
              <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={22} color="#ffffff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.formatOption,
              { backgroundColor: exportFormat === 'json' ? theme.primary : theme.background, borderColor: theme.border },
            ]}
            onPress={() => {
              console.log('[ExportData] Format selected: json');
              setExportFormat('json');
            }}
          >
            <IconSymbol
              ios_icon_name="doc.fill"
              android_material_icon_name="insert-drive-file"
              size={24}
              color={exportFormat === 'json' ? '#ffffff' : theme.text}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.formatTitle, { color: exportFormat === 'json' ? '#ffffff' : theme.text }]}>
                JSON Backup
              </Text>
              <Text style={[styles.formatSubtitle, { color: exportFormat === 'json' ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
                Best for backup and restore
              </Text>
            </View>
            {exportFormat === 'json' && (
              <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={22} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: isExporting ? theme.border : theme.primary }]}
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <IconSymbol
              ios_icon_name="square.and.arrow.up"
              android_material_icon_name="ios-share"
              size={20}
              color="#ffffff"
            />
          )}
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Exporting…' : `Export ${exportTypeLabel}`}
          </Text>
        </TouchableOpacity>

        {/* Footer note */}
        <Text style={[styles.footerNote, { color: theme.textSecondary }]}>
          PDF exports include performance charts, job tables and billing breakdown.
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: { width: 38 },
  section: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '45%',
    flex: 1,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dateNavBtn: {
    padding: 8,
  },
  dateNavText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  dateNavSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  formatTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  formatSubtitle: {
    fontSize: 13,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
