
import React, { useState, useEffect, useCallback } from 'react';
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
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { templateStorage, JobTemplate } from '@/utils/moduleStorage';

const VHC_OPTIONS: JobTemplate['defaultVhcStatus'][] = ['NONE', 'GREEN', 'ORANGE', 'RED'];

const VHC_COLORS: Record<JobTemplate['defaultVhcStatus'], string> = {
  NONE: '#6b7280',
  GREEN: '#22c55e',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

interface FormState {
  name: string;
  description: string;
  defaultNotes: string;
  defaultAW: string;
  defaultVhcStatus: JobTemplate['defaultVhcStatus'];
  tags: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  defaultNotes: '',
  defaultAW: '',
  defaultVhcStatus: 'NONE',
  tags: '',
};

export default function JobTemplatesScreen() {
  console.log('JobTemplatesScreen: Rendering');
  const { theme } = useThemeContext();
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const loadTemplates = useCallback(async () => {
    console.log('JobTemplatesScreen: Loading templates');
    const all = await templateStorage.getAll();
    console.log('JobTemplatesScreen: Loaded', all.length, 'templates');
    setTemplates(all);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  });

  const openCreate = () => {
    console.log('JobTemplatesScreen: Opening create template modal');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (t: JobTemplate) => {
    console.log('JobTemplatesScreen: Opening edit modal for template', t.id, t.name);
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description,
      defaultNotes: t.defaultNotes,
      defaultAW: t.defaultAW !== null ? String(t.defaultAW) : '',
      defaultVhcStatus: t.defaultVhcStatus,
      tags: t.tags.join(', '),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Template name is required.');
      return;
    }
    setSaving(true);
    console.log('JobTemplatesScreen: Saving template', editingId ? 'update' : 'create', form.name);
    const parsedAW = form.defaultAW.trim() ? parseFloat(form.defaultAW) : null;
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    try {
      if (editingId) {
        await templateStorage.update(editingId, {
          name: form.name.trim(),
          description: form.description.trim(),
          defaultNotes: form.defaultNotes.trim(),
          defaultAW: parsedAW,
          defaultVhcStatus: form.defaultVhcStatus,
          tags,
        });
        console.log('JobTemplatesScreen: Template updated', editingId);
      } else {
        await templateStorage.create({
          name: form.name.trim(),
          description: form.description.trim(),
          defaultNotes: form.defaultNotes.trim(),
          defaultAW: parsedAW,
          defaultVhcStatus: form.defaultVhcStatus,
          tags,
          isFavourite: false,
          isArchived: false,
        });
        console.log('JobTemplatesScreen: Template created');
      }
      await loadTemplates();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavourite = async (t: JobTemplate) => {
    console.log('JobTemplatesScreen: Toggle favourite for template', t.id, 'current:', t.isFavourite);
    await templateStorage.update(t.id, { isFavourite: !t.isFavourite });
    await loadTemplates();
  };

  const handleDelete = (t: JobTemplate) => {
    console.log('JobTemplatesScreen: Delete requested for template', t.id, t.name);
    Alert.alert('Delete Template', `Delete "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('JobTemplatesScreen: Confirmed delete for template', t.id);
          await templateStorage.delete(t.id);
          await loadTemplates();
        },
      },
    ]);
  };

  const vhcColor = VHC_COLORS[form.defaultVhcStatus];

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('JobTemplatesScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Job Templates</Text>
        <TouchableOpacity
          onPress={openCreate}
          style={styles.iconBtn}
        >
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
          placeholder="Search templates..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={text => {
            console.log('JobTemplatesScreen: Search changed to', text);
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
        data={filteredTemplates}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No templates yet. Tap + to create one.
            </Text>
          </View>
        }
        renderItem={({ item: t }) => {
          const awLabel = t.defaultAW !== null ? `${t.defaultAW} AW` : 'No AW';
          const usageLabel = `Used ${t.usageCount}x`;
          const vhcDotColor = VHC_COLORS[t.defaultVhcStatus];
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => openEdit(t)}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: theme.text }]}>{t.name}</Text>
                  {t.description ? (
                    <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {t.description}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleToggleFavourite(t)}
                  style={styles.iconBtn}
                >
                  <IconSymbol
                    ios_icon_name={t.isFavourite ? 'star.fill' : 'star'}
                    android_material_icon_name={t.isFavourite ? 'star' : 'star-border'}
                    size={20}
                    color={t.isFavourite ? '#f59e0b' : theme.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(t)}
                  style={styles.iconBtn}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={18}
                    color={theme.chartRed}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.cardMeta}>
                <View style={[styles.vhcDot, { backgroundColor: vhcDotColor }]} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{awLabel}</Text>
                <Text style={[styles.metaDot, { color: theme.textSecondary }]}>·</Text>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{usageLabel}</Text>
                {t.tags.length > 0 ? (
                  <>
                    <Text style={[styles.metaDot, { color: theme.textSecondary }]}>·</Text>
                    <Text style={[styles.metaText, { color: theme.primary }]} numberOfLines={1}>
                      {t.tags.join(', ')}
                    </Text>
                  </>
                ) : null}
              </View>
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
                  console.log('JobTemplatesScreen: Modal cancelled');
                  setShowModal(false);
                }}
              >
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingId ? 'Edit Template' : 'New Template'}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[styles.modalSave, { color: theme.primary }]}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NAME *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Template name"
                placeholderTextColor={theme.textSecondary}
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiline, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Short description"
                placeholderTextColor={theme.textSecondary}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT NOTES</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiline, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Default job notes"
                placeholderTextColor={theme.textSecondary}
                value={form.defaultNotes}
                onChangeText={v => setForm(f => ({ ...f, defaultNotes: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT AW</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. 12"
                placeholderTextColor={theme.textSecondary}
                value={form.defaultAW}
                onChangeText={v => setForm(f => ({ ...f, defaultAW: v }))}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT VHC STATUS</Text>
              <View style={styles.vhcRow}>
                {VHC_OPTIONS.map(opt => {
                  const isSelected = form.defaultVhcStatus === opt;
                  const optColor = VHC_COLORS[opt];
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.vhcOption,
                        {
                          backgroundColor: isSelected ? optColor : theme.card,
                          borderColor: optColor,
                        },
                      ]}
                      onPress={() => {
                        console.log('JobTemplatesScreen: VHC status selected', opt);
                        setForm(f => ({ ...f, defaultVhcStatus: opt }));
                      }}
                    >
                      <Text style={[styles.vhcOptionText, { color: isSelected ? '#fff' : optColor }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>TAGS (comma-separated)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. service, brakes, electrical"
                placeholderTextColor={theme.textSecondary}
                value={form.tags}
                onChangeText={v => setForm(f => ({ ...f, tags: v }))}
              />
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 13 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  vhcDot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { fontSize: 12 },
  metaDot: { fontSize: 12 },
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
  vhcRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  vhcOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  vhcOptionText: { fontSize: 13, fontWeight: '700' },
});
