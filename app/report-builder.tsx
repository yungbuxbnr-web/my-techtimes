
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from '@/utils/api';
import { billingStorage } from '@/utils/billingStorage';
import {
  getDefaultReportOptions,
  buildReportData,
  generatePDFHTML,
  generateTechnicalEvidencePackHTML,
  ReportOptions,
  PDFTheme,
  DetailLevel,
  ReportPeriod,
} from '@/utils/reportEngine';

const TEMPLATES_KEY = '@techtimes_report_templates';
const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

interface SavedTemplate {
  id: string;
  name: string;
  options: ReportOptions;
  lastUsed: string;
}

const THEMES: { value: PDFTheme; label: string; desc: string; bg: string; accent: string }[] = [
  { value: 'tech_times_glass', label: 'Tech Times Glass', desc: 'Dark navy, glass', bg: '#0a1628', accent: '#4fc3f7' },
  { value: 'midnight_performance', label: 'Midnight Performance', desc: 'Black, cyan', bg: '#000', accent: '#00e5ff' },
  { value: 'carbon_workshop', label: 'Carbon Workshop', desc: 'Dark grey, orange', bg: '#1a1a1a', accent: '#ff6b35' },
  { value: 'blueprint_technical', label: 'Blueprint Technical', desc: 'Dark blue, grid', bg: '#0d1b2a', accent: '#64b5f6' },
  { value: 'executive_light', label: 'Executive Light', desc: 'White, navy', bg: '#fff', accent: '#1a237e' },
  { value: 'minimal_print', label: 'Minimal Print', desc: 'White, black', bg: '#f5f5f5', accent: '#000' },
];

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'day', label: 'DAY' },
  { value: 'week', label: 'WEEK' },
  { value: 'month', label: 'MONTH' },
  { value: 'year', label: 'YEAR' },
  { value: 'entire', label: 'ENTIRE' },
  { value: 'custom', label: 'CUSTOM' },
];

const DETAIL_LEVELS: { value: DetailLevel; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full Detail' },
];

const SECTION_KEYS: (keyof ReportOptions['includeSections'])[] = [
  'summary', 'availability', 'dailyPerformance', 'billedJobsTable',
  'openJobsTable', 'billingClosure', 'charts', 'jobMovement',
  'vhcSummary', 'technicalCases', 'recordHistory', 'timeline', 'notes',
];

const SECTION_LABELS: Record<keyof ReportOptions['includeSections'], string> = {
  summary: 'Summary',
  availability: 'Availability Breakdown',
  dailyPerformance: 'Daily Performance Table',
  billedJobsTable: 'Closed/Billed Jobs Table',
  openJobsTable: 'Open Jobs Table',
  billingClosure: 'Billing & Job Closure Summary',
  charts: 'Charts / Heatmap',
  jobMovement: 'Job Movement',
  vhcSummary: 'VHC Summary',
  technicalCases: 'Technical Cases',
  recordHistory: 'Record History',
  timeline: 'Timeline',
  notes: 'Notes',
};

const DEFAULT_CHECKED: (keyof ReportOptions['includeSections'])[] = [
  'summary', 'availability', 'dailyPerformance', 'billedJobsTable', 'openJobsTable', 'billingClosure',
];

export default function ReportBuilderScreen() {
  console.log('ReportBuilderScreen: Rendering');
  const { theme } = useThemeContext();
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [options, setOptions] = useState<ReportOptions>(getDefaultReportOptions());
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const loadTemplates = useCallback(async () => {
    console.log('ReportBuilderScreen: Loading saved templates');
    try {
      const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
      if (raw) setTemplates(JSON.parse(raw));
    } catch (e) {
      console.error('ReportBuilderScreen: Failed to load templates', e);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Validation', 'Please enter a template name.');
      return;
    }
    console.log('ReportBuilderScreen: Saving template —', templateName);
    const newTemplate: SavedTemplate = {
      id: `${Date.now()}`,
      name: templateName.trim(),
      options,
      lastUsed: new Date().toISOString(),
    };
    const updated = [newTemplate, ...templates].slice(0, 20);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setTemplates(updated);
    setShowSaveModal(false);
    setTemplateName('');
    console.log('ReportBuilderScreen: Template saved —', newTemplate.id);
  };

  const loadTemplate = (t: SavedTemplate) => {
    console.log('ReportBuilderScreen: Loading template —', t.id, t.name);
    setOptions(t.options);
    setShowCustomBuilder(true);
  };

  const deleteTemplate = (id: string) => {
    console.log('ReportBuilderScreen: Delete template —', id);
    Alert.alert('Delete Template', 'Delete this template?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = templates.filter(t => t.id !== id);
          await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
          setTemplates(updated);
          console.log('ReportBuilderScreen: Template deleted —', id);
        },
      },
    ]);
  };

  const generateReport = async (reportOptions: ReportOptions, label: string) => {
    console.log('ReportBuilderScreen: Generating report —', label, '| period:', reportOptions.period, '| theme:', reportOptions.theme);
    setGenerating(true);
    setGeneratingType(label);
    try {
      const [jobs, records, schedule, absences] = await Promise.all([
        api.getAllJobs(),
        billingStorage.getAllRecords(),
        api.getSchedule(),
        api.getAbsences(new Date().toISOString().slice(0, 7)),
      ]);
      console.log('ReportBuilderScreen: Data loaded — jobs:', jobs.length, '| records:', records.length);
      const data = await buildReportData(reportOptions, jobs, records, schedule, absences);
      const html = generatePDFHTML(data, reportOptions);
      console.log('ReportBuilderScreen: HTML generated — length:', html.length);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      console.log('ReportBuilderScreen: PDF created at', uri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share ${label}` });
        console.log('ReportBuilderScreen: PDF shared successfully');
      } else {
        Alert.alert('PDF Generated', `Saved to: ${uri}`);
      }
    } catch (err: any) {
      console.error('ReportBuilderScreen: Generate failed', err);
      Alert.alert('Generation Failed', err?.message ?? 'Could not generate report.');
    } finally {
      setGenerating(false);
      setGeneratingType('');
    }
  };

  const handleQuickReport = (period: ReportPeriod, label: string) => {
    console.log('ReportBuilderScreen: Quick report tapped —', label, '| period:', period);
    const opts: ReportOptions = {
      ...getDefaultReportOptions(),
      period,
    };
    generateReport(opts, label);
  };

  const handlePreview = async () => {
    console.log('ReportBuilderScreen: Preview tapped — period:', options.period, '| theme:', options.theme);
    try {
      const [jobs, records] = await Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]);
      const today = new Date();
      const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const absences = await api.getAbsences(monthStr);
      const schedule = await api.getSchedule();
      const data = await buildReportData(options, jobs, records, schedule, absences);
      const approxPages = Math.max(1, Math.round(
        (data.billedJobs.length + data.openJobs.length) / 20 + 2
      ));
      setPreviewData({
        period: data.period.label,
        theme: THEMES.find(t => t.value === options.theme)?.label ?? options.theme,
        detail: options.detailLevel,
        totalJobs: data.billing.totalJobs,
        billedJobs: data.billing.billedJobs,
        openJobs: data.billing.openJobs,
        approxPages,
      });
      setPreviewVisible(true);
    } catch (err: any) {
      console.error('ReportBuilderScreen: Preview failed', err);
      Alert.alert('Preview Failed', err?.message ?? 'Could not build preview.');
    }
  };

  const updateSection = (key: keyof ReportOptions['includeSections'], val: boolean) => {
    console.log('ReportBuilderScreen: Toggle section —', key, val);
    setOptions(prev => ({
      ...prev,
      includeSections: { ...prev.includeSections, [key]: val },
    }));
  };

  const updateOption = <K extends keyof ReportOptions>(key: K, val: ReportOptions[K]) => {
    console.log('ReportBuilderScreen: Update option —', key, val);
    setOptions(prev => ({ ...prev, [key]: val }));
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('ReportBuilderScreen: Back button pressed');
            router.back();
          }}
          style={styles.iconBtn}
        >
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="chevron-left" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report Centre</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 }]}>

        {/* Saved Templates */}
        {templates.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SAVED TEMPLATES</Text>
            {templates.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.templateCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => loadTemplate(t)}
                onLongPress={() => deleteTemplate(t.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.templateName, { color: theme.text }]}>{t.name}</Text>
                  <Text style={[styles.templateMeta, { color: theme.textSecondary }]}>
                    {t.options.period.toUpperCase()} · {THEMES.find(th => th.value === t.options.theme)?.label ?? t.options.theme}
                  </Text>
                  <Text style={[styles.templateMeta, { color: theme.textSecondary }]}>
                    Last used: {new Date(t.lastUsed).toLocaleDateString('en-GB')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={styles.iconBtn}>
                  <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={18} color={theme.chartRed} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Quick Reports */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>QUICK REPORTS</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Daily Performance', period: 'day' as ReportPeriod },
            { label: 'Weekly Performance', period: 'week' as ReportPeriod },
            { label: 'Monthly Performance', period: 'month' as ReportPeriod },
            { label: 'Yearly Performance', period: 'year' as ReportPeriod },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.reportRow, idx < arr.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              onPress={() => handleQuickReport(item.period, item.label)}
            >
              <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={18} color={theme.primary} />
              <Text style={[styles.reportRowLabel, { color: theme.text }]}>{item.label}</Text>
              {generating && generatingType === item.label
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={14} color={theme.textSecondary} />
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Operational Reports */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>OPERATIONAL REPORTS</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Billing & Job Closure', period: 'month' as ReportPeriod },
            { label: 'Open Jobs', period: 'entire' as ReportPeriod },
            { label: 'VHC Report', period: 'month' as ReportPeriod },
            { label: 'Vehicle History', period: 'entire' as ReportPeriod },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.reportRow, idx < arr.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              onPress={() => handleQuickReport(item.period, item.label)}
            >
              <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={18} color={theme.chartGreen} />
              <Text style={[styles.reportRowLabel, { color: theme.text }]}>{item.label}</Text>
              {generating && generatingType === item.label
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={14} color={theme.textSecondary} />
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Technical Reports */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TECHNICAL REPORTS</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Job Record PDF', period: 'month' as ReportPeriod },
            { label: 'Technical Evidence Pack', period: 'day' as ReportPeriod },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.reportRow, idx < arr.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              onPress={() => handleQuickReport(item.period, item.label)}
            >
              <IconSymbol ios_icon_name="wrench.fill" android_material_icon_name="build" size={18} color={theme.chartYellow} />
              <Text style={[styles.reportRowLabel, { color: theme.text }]}>{item.label}</Text>
              {generating && generatingType === item.label
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={14} color={theme.textSecondary} />
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Analysis */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ANALYSIS</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Period Comparison', period: 'month' as ReportPeriod },
            { label: 'Data Audit / Reconciliation', period: 'entire' as ReportPeriod },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.reportRow, idx < arr.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              onPress={() => handleQuickReport(item.period, item.label)}
            >
              <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={18} color={theme.accent} />
              <Text style={[styles.reportRowLabel, { color: theme.text }]}>{item.label}</Text>
              {generating && generatingType === item.label
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={14} color={theme.textSecondary} />
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Create Your Own */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CREATE YOUR OWN</Text>
        <TouchableOpacity
          style={[styles.customBuilderBtn, { backgroundColor: theme.primary }]}
          onPress={() => {
            console.log('ReportBuilderScreen: Custom Report Builder tapped — toggling builder');
            setShowCustomBuilder(v => !v);
          }}
        >
          <IconSymbol ios_icon_name="slider.horizontal.3" android_material_icon_name="tune" size={20} color="#fff" />
          <Text style={styles.customBuilderBtnText}>Custom Report Builder</Text>
          <IconSymbol
            ios_icon_name={showCustomBuilder ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={showCustomBuilder ? 'expand-less' : 'expand-more'}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>

        {/* ── Custom Builder ── */}
        {showCustomBuilder && (
          <View style={[styles.builderContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>

            {/* Period */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>PERIOD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {PERIODS.map(p => {
                const isActive = options.period === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => updateOption('period', p.value)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Date Mode */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>DATE MODE</Text>
            <View style={styles.chipRow}>
              {(['work_date', 'billing_date'] as const).map(dm => {
                const isActive = options.dateMode === dm;
                return (
                  <TouchableOpacity
                    key={dm}
                    style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => updateOption('dateMode', dm)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                      {dm === 'work_date' ? 'Work Date' : 'Billing Date'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Detail Level */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>DETAIL LEVEL</Text>
            <View style={styles.chipRow}>
              {DETAIL_LEVELS.map(dl => {
                const isActive = options.detailLevel === dl.value;
                return (
                  <TouchableOpacity
                    key={dl.value}
                    style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => updateOption('detailLevel', dl.value)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>{dl.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Theme */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>THEME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
              {THEMES.map(t => {
                const isActive = options.theme === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.themeCard, { backgroundColor: t.bg, borderColor: isActive ? t.accent : 'transparent', borderWidth: isActive ? 2 : 1 }]}
                    onPress={() => {
                      console.log('ReportBuilderScreen: Theme selected —', t.value);
                      updateOption('theme', t.value);
                    }}
                  >
                    <Text style={[styles.themeAccent, { color: t.accent }]}>{t.label}</Text>
                    <Text style={[styles.themeDesc, { color: t.accent, opacity: 0.7 }]}>{t.desc}</Text>
                    {isActive && <Text style={[styles.themeCheck, { color: t.accent }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Include Sections */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>INCLUDE SECTIONS</Text>
            {SECTION_KEYS.map(key => {
              const isChecked = options.includeSections[key];
              const isDefault = DEFAULT_CHECKED.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.checkRow, { borderBottomColor: theme.border }]}
                  onPress={() => updateSection(key, !isChecked)}
                >
                  <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: isChecked ? theme.primary : 'transparent' }]}>
                    {isChecked && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.checkLabel, { color: theme.text }]}>{SECTION_LABELS[key]}</Text>
                  {isDefault && <Text style={[styles.defaultBadge, { color: theme.textSecondary }]}>default</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Include Images */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>INCLUDE IMAGES</Text>
            <View style={styles.chipRow}>
              {(['none', 'key', 'all'] as const).map(img => {
                const isActive = options.includeImages === img;
                return (
                  <TouchableOpacity
                    key={img}
                    style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => updateOption('includeImages', img)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>{img.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Image Quality */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>IMAGE QUALITY</Text>
            <View style={styles.chipRow}>
              {(['standard', 'high', 'original'] as const).map(q => {
                const isActive = options.imageQuality === q;
                return (
                  <TouchableOpacity
                    key={q}
                    style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => updateOption('imageQuality', q)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>{q.charAt(0).toUpperCase() + q.slice(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Options toggles */}
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>OPTIONS</Text>
            {([
              { key: 'coverPage' as const, label: 'Cover Page' },
              { key: 'pageNumbers' as const, label: 'Page Numbers' },
              { key: 'branding' as const, label: 'Branding' },
              { key: 'signatureSection' as const, label: 'Signature Section' },
            ]).map(opt => (
              <View key={opt.key} style={[styles.toggleRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>{opt.label}</Text>
                <Switch
                  value={options[opt.key] as boolean}
                  onValueChange={val => {
                    console.log('ReportBuilderScreen: Toggle option —', opt.key, val);
                    updateOption(opt.key, val);
                  }}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            {/* Preview card */}
            {previewVisible && previewData && (
              <View style={[styles.previewCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.previewTitle, { color: theme.text }]}>Report Preview</Text>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Period:</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>{previewData.period}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Theme:</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>{previewData.theme}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Detail:</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>{previewData.detail}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Jobs:</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>
                    {previewData.totalJobs}  Closed: {previewData.billedJobs}  Open: {previewData.openJobs}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Approx Pages:</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>{previewData.approxPages}</Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: theme.primary, borderWidth: 1.5 }]}
                onPress={() => {
                  console.log('ReportBuilderScreen: Save Template pressed');
                  setShowSaveModal(true);
                }}
              >
                <Text style={[styles.actionBtnText, { color: theme.primary }]}>Save Template</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                onPress={handlePreview}
              >
                <Text style={[styles.actionBtnText, { color: theme.text }]}>Preview</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('ReportBuilderScreen: Generate PDF pressed — period:', options.period, '| theme:', options.theme);
                generateReport(options, 'Custom Report');
              }}
              disabled={generating}
            >
              {generating && generatingType === 'Custom Report'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.generateBtnText}>Generate PDF</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Save Template Modal */}
      <Modal visible={showSaveModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Save Template</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Template name..."
              placeholderTextColor={theme.textSecondary}
              value={templateName}
              onChangeText={setTemplateName}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => {
                  console.log('ReportBuilderScreen: Save template modal cancelled');
                  setShowSaveModal(false);
                  setTemplateName('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
                onPress={saveTemplate}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  content: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  reportRowLabel: { flex: 1, fontSize: 15 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  templateName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  templateMeta: { fontSize: 12 },
  customBuilderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
  },
  customBuilderBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  builderContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  builderLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  themeRow: { gap: 10, paddingBottom: 4 },
  themeCard: {
    width: 130,
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  themeAccent: { fontSize: 13, fontWeight: '700' },
  themeDesc: { fontSize: 11 },
  themeCheck: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { flex: 1, fontSize: 14 },
  defaultBadge: { fontSize: 10, fontStyle: 'italic' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toggleLabel: { fontSize: 14 },
  previewCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
  },
  previewTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  previewRow: { flexDirection: 'row', marginBottom: 6 },
  previewLabel: { width: 110, fontSize: 13 },
  previewValue: { flex: 1, fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  generateBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15 },
  modalSaveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
