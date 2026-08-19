
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { caseStorage, TechnicalCase } from '@/utils/moduleStorage';

interface CaseFormState {
  title: string;
  vehicleReg: string;
  vehicle: string;
  date: string;
  wipNumber: string;
  symptoms: string;
  faultCodes: string;
  initialFindings: string;
  testsPerformed: string;
  measurements: string;
  diagnosis: string;
  rootCause: string;
  repairAction: string;
  result: string;
  notes: string;
  tags: string;
}

const EMPTY_FORM: CaseFormState = {
  title: '',
  vehicleReg: '',
  vehicle: '',
  date: new Date().toISOString().split('T')[0],
  wipNumber: '',
  symptoms: '',
  faultCodes: '',
  initialFindings: '',
  testsPerformed: '',
  measurements: '',
  diagnosis: '',
  rootCause: '',
  repairAction: '',
  result: '',
  notes: '',
  tags: '',
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  theme: { card: string; text: string; textSecondary: string; border: string };
}) {
  return (
    <>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.multiline,
          { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
        ]}
        placeholder={placeholder || ''}
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </>
  );
}

export default function TechnicalCasesScreen() {
  console.log('TechnicalCasesScreen: Rendering');
  const { theme } = useThemeContext();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const [cases, setCases] = useState<TechnicalCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingCase, setViewingCase] = useState<TechnicalCase | null>(null);
  const [form, setForm] = useState<CaseFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const loadCases = useCallback(async () => {
    console.log('TechnicalCasesScreen: Loading cases');
    const all = await caseStorage.getAll();
    console.log('TechnicalCasesScreen: Loaded', all.length, 'cases');
    setCases(all);
  }, []);

  useEffect(() => {
    loadCases();
    if (params.jobId) {
      console.log('TechnicalCasesScreen: Pre-filling from jobId', params.jobId);
      setForm(f => ({ ...f, wipNumber: params.jobId || '' }));
      setShowModal(true);
    }
  }, [loadCases, params.jobId]);

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        c.symptoms.toLowerCase().includes(q) ||
        c.faultCodes.toLowerCase().includes(q) ||
        c.vehicleReg.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [cases, searchQuery]);

  const openCreate = () => {
    console.log('TechnicalCasesScreen: Opening create case modal');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (c: TechnicalCase) => {
    console.log('TechnicalCasesScreen: Opening edit modal for case', c.id, c.title);
    setEditingId(c.id);
    setForm({
      title: c.title,
      vehicleReg: c.vehicleReg,
      vehicle: c.vehicle,
      date: c.date,
      wipNumber: c.wipNumber,
      symptoms: c.symptoms,
      faultCodes: c.faultCodes,
      initialFindings: c.initialFindings,
      testsPerformed: c.testsPerformed,
      measurements: c.measurements,
      diagnosis: c.diagnosis,
      rootCause: c.rootCause,
      repairAction: c.repairAction,
      result: c.result,
      notes: c.notes,
      tags: c.tags.join(', '),
    });
    setViewingCase(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Case title is required.');
      return;
    }
    setSaving(true);
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    console.log('TechnicalCasesScreen: Saving case', editingId ? 'update' : 'create', form.title);
    try {
      if (editingId) {
        await caseStorage.update(editingId, { ...form, tags });
        console.log('TechnicalCasesScreen: Case updated', editingId);
      } else {
        await caseStorage.create({
          ...form,
          tags,
          linkedJobId: params.jobId,
          isFavourite: false,
        });
        console.log('TechnicalCasesScreen: Case created');
      }
      await loadCases();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavourite = async (c: TechnicalCase) => {
    console.log('TechnicalCasesScreen: Toggle favourite for case', c.id, 'current:', c.isFavourite);
    await caseStorage.update(c.id, { isFavourite: !c.isFavourite });
    await loadCases();
    if (viewingCase?.id === c.id) {
      setViewingCase(prev => prev ? { ...prev, isFavourite: !prev.isFavourite } : null);
    }
  };

  const handleDelete = (c: TechnicalCase) => {
    console.log('TechnicalCasesScreen: Delete requested for case', c.id, c.title);
    Alert.alert('Delete Case', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('TechnicalCasesScreen: Confirmed delete for case', c.id);
          await caseStorage.delete(c.id);
          await loadCases();
          if (viewingCase?.id === c.id) setViewingCase(null);
        },
      },
    ]);
  };

  if (viewingCase) {
    const detailRows: { label: string; value: string }[] = [
      { label: 'Vehicle', value: viewingCase.vehicle },
      { label: 'Registration', value: viewingCase.vehicleReg },
      { label: 'WIP Number', value: viewingCase.wipNumber },
      { label: 'Date', value: viewingCase.date },
      { label: 'Symptoms', value: viewingCase.symptoms },
      { label: 'Fault Codes', value: viewingCase.faultCodes },
      { label: 'Initial Findings', value: viewingCase.initialFindings },
      { label: 'Tests Performed', value: viewingCase.testsPerformed },
      { label: 'Measurements', value: viewingCase.measurements },
      { label: 'Diagnosis', value: viewingCase.diagnosis },
      { label: 'Root Cause', value: viewingCase.rootCause },
      { label: 'Repair Action', value: viewingCase.repairAction },
      { label: 'Result', value: viewingCase.result },
      { label: 'Notes', value: viewingCase.notes },
    ];

    return (
      <AppBackground>
        <View style={[styles.header, { paddingTop: PT }]}>
          <TouchableOpacity
            onPress={() => {
              console.log('TechnicalCasesScreen: Back from case detail');
              setViewingCase(null);
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
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {viewingCase.title}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => handleToggleFavourite(viewingCase)} style={styles.iconBtn}>
              <IconSymbol
                ios_icon_name={viewingCase.isFavourite ? 'star.fill' : 'star'}
                android_material_icon_name={viewingCase.isFavourite ? 'star' : 'star-border'}
                size={20}
                color={viewingCase.isFavourite ? '#f59e0b' : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEdit(viewingCase)} style={styles.iconBtn}>
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {viewingCase.tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {viewingCase.tags.map(tag => (
                <View key={tag} style={[styles.tag, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {detailRows.map(row =>
            row.value ? (
              <View key={row.label} style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{row.value}</Text>
              </View>
            ) : null
          )}
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: theme.chartRed }]}
            onPress={() => handleDelete(viewingCase)}
          >
            <Text style={[styles.deleteBtnText, { color: theme.chartRed }]}>Delete Case</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('TechnicalCasesScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Technical Cases</Text>
        <TouchableOpacity onPress={openCreate} style={styles.iconBtn}>
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <IconSymbol
          ios_icon_name="magnifyingglass"
          android_material_icon_name="search"
          size={18}
          color={theme.textSecondary}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search cases..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={text => {
            console.log('TechnicalCasesScreen: Search changed to', text);
            setSearchQuery(text);
          }}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredCases}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No cases yet. Tap + to create one.
            </Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const caseDate = c.date;
          return (
            <TouchableOpacity
              style={[styles.caseCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                console.log('TechnicalCasesScreen: Viewing case', c.id, c.title);
                setViewingCase(c);
              }}
            >
              <View style={styles.caseTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.caseTitle, { color: theme.text }]}>{c.title}</Text>
                  <Text style={[styles.caseMeta, { color: theme.textSecondary }]}>
                    {c.vehicle || c.vehicleReg} · {caseDate}
                  </Text>
                  {c.symptoms ? (
                    <Text style={[styles.caseSymptoms, { color: theme.textSecondary }]} numberOfLines={2}>
                      {c.symptoms}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => handleToggleFavourite(c)} style={styles.iconBtn}>
                  <IconSymbol
                    ios_icon_name={c.isFavourite ? 'star.fill' : 'star'}
                    android_material_icon_name={c.isFavourite ? 'star' : 'star-border'}
                    size={20}
                    color={c.isFavourite ? '#f59e0b' : theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {c.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {c.tags.slice(0, 4).map(tag => (
                    <View key={tag} style={[styles.tag, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => {
                  console.log('TechnicalCasesScreen: Modal cancelled');
                  setShowModal(false);
                }}
              >
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingId ? 'Edit Case' : 'New Case'}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[styles.modalSave, { color: theme.primary }]}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <FormField label="TITLE *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Case title" theme={theme} />
              <FormField label="VEHICLE" value={form.vehicle} onChange={v => setForm(f => ({ ...f, vehicle: v }))} placeholder="e.g. Ford Focus 1.5 TDCi" theme={theme} />
              <FormField label="REGISTRATION" value={form.vehicleReg} onChange={v => setForm(f => ({ ...f, vehicleReg: v }))} placeholder="e.g. AB12 CDE" theme={theme} />
              <FormField label="WIP NUMBER" value={form.wipNumber} onChange={v => setForm(f => ({ ...f, wipNumber: v }))} placeholder="WIP number" theme={theme} />
              <FormField label="DATE" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" theme={theme} />
              <FormField label="SYMPTOMS" value={form.symptoms} onChange={v => setForm(f => ({ ...f, symptoms: v }))} placeholder="Describe the symptoms..." theme={theme} multiline />
              <FormField label="FAULT CODES" value={form.faultCodes} onChange={v => setForm(f => ({ ...f, faultCodes: v }))} placeholder="e.g. P0300, P0301" theme={theme} />
              <FormField label="INITIAL FINDINGS" value={form.initialFindings} onChange={v => setForm(f => ({ ...f, initialFindings: v }))} placeholder="Initial inspection findings..." theme={theme} multiline />
              <FormField label="TESTS PERFORMED" value={form.testsPerformed} onChange={v => setForm(f => ({ ...f, testsPerformed: v }))} placeholder="Tests and procedures performed..." theme={theme} multiline />
              <FormField label="MEASUREMENTS" value={form.measurements} onChange={v => setForm(f => ({ ...f, measurements: v }))} placeholder="Key measurements and readings..." theme={theme} multiline />
              <FormField label="DIAGNOSIS" value={form.diagnosis} onChange={v => setForm(f => ({ ...f, diagnosis: v }))} placeholder="Final diagnosis..." theme={theme} multiline />
              <FormField label="ROOT CAUSE" value={form.rootCause} onChange={v => setForm(f => ({ ...f, rootCause: v }))} placeholder="Root cause of the fault..." theme={theme} multiline />
              <FormField label="REPAIR ACTION" value={form.repairAction} onChange={v => setForm(f => ({ ...f, repairAction: v }))} placeholder="Repair steps taken..." theme={theme} multiline />
              <FormField label="RESULT" value={form.result} onChange={v => setForm(f => ({ ...f, result: v }))} placeholder="Outcome of the repair..." theme={theme} multiline />
              <FormField label="NOTES" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Additional notes..." theme={theme} multiline />
              <FormField label="TAGS (comma-separated)" value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="e.g. misfire, injector, diesel" theme={theme} />
            </ScrollView>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  caseCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  caseTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  caseTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  caseMeta: { fontSize: 13, marginBottom: 4 },
  caseSymptoms: { fontSize: 13 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  detailRow: { paddingVertical: 12, borderBottomWidth: 1 },
  detailLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  detailValue: { fontSize: 15 },
  deleteBtn: {
    marginTop: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalCancel: { fontSize: 16 },
  modalSave: { fontSize: 16, fontWeight: '700' },
  modalContent: { padding: 16, paddingBottom: 60 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  fieldInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
