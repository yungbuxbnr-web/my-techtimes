
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { reportTemplateStorage, ReportTemplate } from '@/utils/moduleStorage';

type Period = ReportTemplate['period'];
type ViewBy = ReportTemplate['viewBy'];

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'entire', label: 'Entire' },
];

const ALL_SECTIONS = [
  'Summary',
  'Jobs',
  'Recorded Hours',
  'Billed Hours',
  'Open Hours',
  'Efficiency',
  'VHC',
  'Vehicle History',
];

export default function ReportBuilderScreen() {
  console.log('ReportBuilderScreen: Rendering');
  const { theme } = useThemeContext();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>(['Summary', 'Jobs', 'Recorded Hours']);
  const [period, setPeriod] = useState<Period>('month');
  const [viewBy, setViewBy] = useState<ViewBy>('work_date');
  const [includeJobList, setIncludeJobList] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRegistrations, setIncludeRegistrations] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const loadTemplates = useCallback(async () => {
    console.log('ReportBuilderScreen: Loading templates');
    const all = await reportTemplateStorage.getAll();
    console.log('ReportBuilderScreen: Loaded', all.length, 'templates');
    setTemplates(all);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const toggleSection = (section: string) => {
    console.log('ReportBuilderScreen: Toggle section', section);
    setSelectedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const loadTemplate = (t: ReportTemplate) => {
    console.log('ReportBuilderScreen: Loading template', t.id, t.name);
    setSelectedSections(t.sections);
    setPeriod(t.period);
    setViewBy(t.viewBy);
    setIncludeJobList(t.includeJobList);
    setIncludeCharts(t.includeCharts);
    setIncludeRegistrations(t.includeRegistrations);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Validation', 'Please enter a template name.');
      return;
    }
    setSaving(true);
    console.log('ReportBuilderScreen: Saving template', templateName);
    try {
      await reportTemplateStorage.create({
        name: templateName.trim(),
        sections: selectedSections,
        period,
        viewBy,
        includeJobList,
        includeCharts,
        includeRegistrations,
      });
      console.log('ReportBuilderScreen: Template saved');
      await loadTemplates();
      setShowSaveModal(false);
      setTemplateName('');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = (t: ReportTemplate) => {
    console.log('ReportBuilderScreen: Delete requested for template', t.id, t.name);
    Alert.alert('Delete Template', `Delete "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('ReportBuilderScreen: Confirmed delete for template', t.id);
          await reportTemplateStorage.delete(t.id);
          await loadTemplates();
        },
      },
    ]);
  };

  const handleGenerate = () => {
    console.log('ReportBuilderScreen: Generate Report pressed', {
      sections: selectedSections,
      period,
      viewBy,
      includeJobList,
      includeCharts,
      includeRegistrations,
    });
    const periodLabel = PERIODS.find(p => p.value === period)?.label || period;
    const viewByLabel = viewBy === 'work_date' ? 'Work Date' : 'Billing Date';
    const extras: string[] = [];
    if (includeJobList) extras.push('Job List');
    if (includeCharts) extras.push('Charts');
    if (includeRegistrations) extras.push('Registrations');
    Alert.alert(
      'Report Preview',
      `Period: ${periodLabel}\nView By: ${viewByLabel}\n\nSections:\n${selectedSections.join('\n')}\n\nExtras: ${extras.join(', ') || 'None'}`,
      [{ text: 'OK' }]
    );
  };

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
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report Builder</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sections */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SECTIONS</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {ALL_SECTIONS.map((section, idx) => {
            const isChecked = selectedSections.includes(section);
            const isLast = idx === ALL_SECTIONS.length - 1;
            return (
              <TouchableOpacity
                key={section}
                style={[styles.checkRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
                onPress={() => toggleSection(section)}
              >
                <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: isChecked ? theme.primary : 'transparent' }]}>
                  {isChecked ? (
                    <IconSymbol
                      ios_icon_name="checkmark"
                      android_material_icon_name="check"
                      size={12}
                      color="#fff"
                    />
                  ) : null}
                </View>
                <Text style={[styles.checkLabel, { color: theme.text }]}>{section}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PERIOD</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => {
            const isActive = period === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.periodBtn,
                  { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
                ]}
                onPress={() => {
                  console.log('ReportBuilderScreen: Period changed to', p.value);
                  setPeriod(p.value);
                }}
              >
                <Text style={[styles.periodBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* View By */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>VIEW BY</Text>
        <View style={styles.viewByRow}>
          {([
            { value: 'work_date' as ViewBy, label: 'Work Date' },
            { value: 'billing_date' as ViewBy, label: 'Billing Date' },
          ]).map(opt => {
            const isActive = viewBy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.viewByBtn,
                  { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
                ]}
                onPress={() => {
                  console.log('ReportBuilderScreen: View by changed to', opt.value);
                  setViewBy(opt.value);
                }}
              >
                <Text style={[styles.viewByBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Extras */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INCLUDE</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: 'Job List', value: includeJobList, setter: setIncludeJobList },
            { label: 'Charts', value: includeCharts, setter: setIncludeCharts },
            { label: 'Registrations', value: includeRegistrations, setter: setIncludeRegistrations },
          ].map((item, idx, arr) => {
            const isLast = idx === arr.length - 1;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.checkRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
                onPress={() => {
                  console.log('ReportBuilderScreen: Toggle extra', item.label, !item.value);
                  item.setter(!item.value);
                }}
              >
                <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: item.value ? theme.primary : 'transparent' }]}>
                  {item.value ? (
                    <IconSymbol
                      ios_icon_name="checkmark"
                      android_material_icon_name="check"
                      size={12}
                      color="#fff"
                    />
                  ) : null}
                </View>
                <Text style={[styles.checkLabel, { color: theme.text }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.saveTemplateBtn, { borderColor: theme.primary }]}
            onPress={() => {
              console.log('ReportBuilderScreen: Save as Template pressed');
              setShowSaveModal(true);
            }}
          >
            <Text style={[styles.saveTemplateBtnText, { color: theme.primary }]}>Save as Template</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: theme.primary }]}
            onPress={handleGenerate}
          >
            <Text style={styles.generateBtnText}>Generate Report</Text>
          </TouchableOpacity>
        </View>

        {/* Saved templates */}
        {templates.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SAVED TEMPLATES</Text>
            {templates.map(t => {
              const periodLabel = PERIODS.find(p => p.value === t.period)?.label || t.period;
              const sectionsLabel = `${t.sections.length} section${t.sections.length !== 1 ? 's' : ''}`;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => loadTemplate(t)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateName, { color: theme.text }]}>{t.name}</Text>
                    <Text style={[styles.templateMeta, { color: theme.textSecondary }]}>
                      {sectionsLabel} · {periodLabel}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteTemplate(t)}
                    style={styles.iconBtn}
                  >
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={18}
                      color={theme.chartRed}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
      </ScrollView>

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
                onPress={handleSaveTemplate}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { fontSize: 15 },
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  periodBtnText: { fontSize: 13, fontWeight: '600' },
  viewByRow: { flexDirection: 'row', gap: 8 },
  viewByBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewByBtnText: { fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  saveTemplateBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveTemplateBtnText: { fontSize: 14, fontWeight: '700' },
  generateBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
