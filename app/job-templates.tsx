
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
import { quickCaptureStorage, QuickPreset } from '@/utils/quickCaptureStorage';

const VHC_OPTIONS: JobTemplate['defaultVhcStatus'][] = ['NONE', 'GREEN', 'ORANGE', 'RED'];

const VHC_COLORS: Record<JobTemplate['defaultVhcStatus'], string> = {
  NONE: '#6b7280',
  GREEN: '#22c55e',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

const QC_CATEGORIES: QuickPreset['category'][] = ['pdi', 'service', 'workshop', 'brakes', 'custom'];
const QC_CATEGORY_LABELS: Record<QuickPreset['category'], string> = {
  pdi: 'PDI',
  service: 'Service',
  workshop: 'Workshop',
  brakes: 'Brakes & Tyres',
  custom: 'Custom',
};

interface TemplateFormState {
  name: string;
  description: string;
  defaultNotes: string;
  defaultAW: string;
  defaultVhcStatus: JobTemplate['defaultVhcStatus'];
  tags: string;
}

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: '',
  description: '',
  defaultNotes: '',
  defaultAW: '',
  defaultVhcStatus: 'NONE',
  tags: '',
};

interface QcFormState {
  name: string;
  description: string;
  category: QuickPreset['category'];
  suggestedAW: string;
}

const EMPTY_QC_FORM: QcFormState = {
  name: '',
  description: '',
  category: 'custom',
  suggestedAW: '',
};

type ActiveTab = 'templates' | 'quickcapture';

export default function JobTemplatesScreen() {
  console.log('JobTemplatesScreen: Rendering');
  const { theme, isDarkMode } = useThemeContext();

  const [activeTab, setActiveTab] = useState<ActiveTab>('templates');

  // Templates state
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Quick Capture state
  const [qcPresets, setQcPresets] = useState<QuickPreset[]>([]);
  const [qcSearch, setQcSearch] = useState('');
  const [qcFilterCategory, setQcFilterCategory] = useState<QuickPreset['category'] | 'all'>('all');
  const [showQcModal, setShowQcModal] = useState(false);
  const [editingQcId, setEditingQcId] = useState<string | null>(null);
  const [qcForm, setQcForm] = useState<QcFormState>(EMPTY_QC_FORM);
  const [savingQc, setSavingQc] = useState(false);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  // ── Templates ──────────────────────────────────────────────────────────────

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

  const openCreateTemplate = () => {
    console.log('JobTemplatesScreen: Opening create template modal');
    setEditingTemplateId(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t: JobTemplate) => {
    console.log('JobTemplatesScreen: Opening edit modal for template', t.id, t.name);
    setEditingTemplateId(t.id);
    setTemplateForm({
      name: t.name,
      description: t.description,
      defaultNotes: t.defaultNotes,
      defaultAW: t.defaultAW !== null ? String(t.defaultAW) : '',
      defaultVhcStatus: t.defaultVhcStatus,
      tags: t.tags.join(', '),
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      Alert.alert('Validation', 'Template name is required.');
      return;
    }
    setSavingTemplate(true);
    console.log('JobTemplatesScreen: Saving template', editingTemplateId ? 'update' : 'create', templateForm.name);
    const parsedAW = templateForm.defaultAW.trim() ? parseFloat(templateForm.defaultAW) : null;
    const tags = templateForm.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    try {
      if (editingTemplateId) {
        await templateStorage.update(editingTemplateId, {
          name: templateForm.name.trim(),
          description: templateForm.description.trim(),
          defaultNotes: templateForm.defaultNotes.trim(),
          defaultAW: parsedAW,
          defaultVhcStatus: templateForm.defaultVhcStatus,
          tags,
        });
        console.log('JobTemplatesScreen: Template updated', editingTemplateId);
      } else {
        await templateStorage.create({
          name: templateForm.name.trim(),
          description: templateForm.description.trim(),
          defaultNotes: templateForm.defaultNotes.trim(),
          defaultAW: parsedAW,
          defaultVhcStatus: templateForm.defaultVhcStatus,
          tags,
          isFavourite: false,
          isArchived: false,
        });
        console.log('JobTemplatesScreen: Template created');
      }
      await loadTemplates();
      setShowTemplateModal(false);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleToggleTemplateFavourite = async (t: JobTemplate) => {
    console.log('JobTemplatesScreen: Toggle favourite for template', t.id, 'current:', t.isFavourite);
    await templateStorage.update(t.id, { isFavourite: !t.isFavourite });
    await loadTemplates();
  };

  const handleDeleteTemplate = (t: JobTemplate) => {
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

  // ── Quick Capture ──────────────────────────────────────────────────────────

  const loadQcPresets = useCallback(async () => {
    console.log('JobTemplatesScreen: Loading Quick Capture presets');
    const all = await quickCaptureStorage.getAll();
    console.log('JobTemplatesScreen: Loaded', all.length, 'Quick Capture presets');
    setQcPresets(all);
  }, []);

  useEffect(() => {
    loadQcPresets();
  }, [loadQcPresets]);

  const filteredQcPresets = qcPresets.filter(p => {
    const matchesCategory = qcFilterCategory === 'all' || p.category === qcFilterCategory;
    if (!qcSearch.trim()) return matchesCategory;
    const q = qcSearch.toLowerCase();
    return matchesCategory && (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  const openCreateQc = () => {
    console.log('JobTemplatesScreen: Opening create Quick Capture preset modal');
    setEditingQcId(null);
    setQcForm(EMPTY_QC_FORM);
    setShowQcModal(true);
  };

  const openEditQc = (p: QuickPreset) => {
    console.log('JobTemplatesScreen: Opening edit Quick Capture preset modal for', p.id, p.name);
    setEditingQcId(p.id);
    setQcForm({
      name: p.name,
      description: p.description,
      category: p.category,
      suggestedAW: p.suggestedAW !== undefined ? String(p.suggestedAW) : '',
    });
    setShowQcModal(true);
  };

  const handleSaveQc = async () => {
    if (!qcForm.name.trim()) {
      Alert.alert('Validation', 'Preset name is required.');
      return;
    }
    if (qcForm.name.trim().length > 20) {
      Alert.alert('Validation', 'Preset name must be 20 characters or fewer.');
      return;
    }
    if (!qcForm.description.trim()) {
      Alert.alert('Validation', 'Description is required.');
      return;
    }
    const parsedAW = qcForm.suggestedAW.trim() ? parseInt(qcForm.suggestedAW, 10) : undefined;
    if (parsedAW !== undefined && (isNaN(parsedAW) || parsedAW < 0 || parsedAW > 100)) {
      Alert.alert('Validation', 'Suggested AW must be between 0 and 100.');
      return;
    }
    setSavingQc(true);
    console.log('JobTemplatesScreen: Saving Quick Capture preset', editingQcId ? 'update' : 'create', qcForm.name);
    try {
      if (editingQcId) {
        await quickCaptureStorage.update(editingQcId, {
          name: qcForm.name.trim(),
          description: qcForm.description.trim(),
          category: qcForm.category,
          suggestedAW: parsedAW,
        });
        console.log('JobTemplatesScreen: Quick Capture preset updated', editingQcId);
      } else {
        await quickCaptureStorage.create({
          name: qcForm.name.trim(),
          description: qcForm.description.trim(),
          category: qcForm.category,
          suggestedAW: parsedAW,
          isFavourite: false,
        });
        console.log('JobTemplatesScreen: Quick Capture preset created');
      }
      await loadQcPresets();
      setShowQcModal(false);
    } finally {
      setSavingQc(false);
    }
  };

  const handleToggleQcFavourite = async (p: QuickPreset) => {
    console.log('JobTemplatesScreen: Toggle favourite for Quick Capture preset', p.id, 'current:', p.isFavourite);
    await quickCaptureStorage.toggleFavourite(p.id);
    await loadQcPresets();
  };

  const handleDeleteQc = (p: QuickPreset) => {
    console.log('JobTemplatesScreen: Delete requested for Quick Capture preset', p.id, p.name);
    if (p.isDefault) {
      Alert.alert('Cannot Delete', 'Default presets cannot be deleted. You can reset defaults from the menu.');
      return;
    }
    Alert.alert('Delete Preset', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('JobTemplatesScreen: Confirmed delete for Quick Capture preset', p.id);
          await quickCaptureStorage.delete(p.id);
          await loadQcPresets();
        },
      },
    ]);
  };

  const handleResetDefaults = () => {
    console.log('JobTemplatesScreen: Reset defaults requested');
    Alert.alert(
      'Reset Default Presets',
      'This will restore all default presets. Your custom presets will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            console.log('JobTemplatesScreen: Confirmed reset defaults');
            await quickCaptureStorage.resetDefaults();
            await loadQcPresets();
          },
        },
      ]
    );
  };

  const vhcColor = VHC_COLORS[templateForm.defaultVhcStatus];

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {activeTab === 'templates' ? 'Job Templates' : 'Quick Capture'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (activeTab === 'templates') {
              openCreateTemplate();
            } else {
              openCreateQc();
            }
          }}
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

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'templates' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => {
            console.log('JobTemplatesScreen: Switched to Templates tab');
            setActiveTab('templates');
          }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'templates' ? theme.primary : theme.textSecondary }]}>
            Templates
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'quickcapture' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => {
            console.log('JobTemplatesScreen: Switched to Quick Capture tab');
            setActiveTab('quickcapture');
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash-on" size={12} color={activeTab === 'quickcapture' ? theme.primary : theme.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'quickcapture' ? theme.primary : theme.textSecondary }]}>
              Quick Capture
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── TEMPLATES TAB ── */}
      {activeTab === 'templates' && (
        <>
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
                console.log('JobTemplatesScreen: Template search changed to', text);
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
                  onPress={() => openEditTemplate(t)}
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
                      onPress={() => handleToggleTemplateFavourite(t)}
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
        </>
      )}

      {/* ── QUICK CAPTURE TAB ── */}
      {activeTab === 'quickcapture' && (
        <>
          {/* Search + Reset */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 8 }]}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={18}
                color={theme.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search presets..."
                placeholderTextColor={theme.textSecondary}
                value={qcSearch}
                onChangeText={text => {
                  console.log('JobTemplatesScreen: Quick Capture search changed to', text);
                  setQcSearch(text);
                }}
              />
              {qcSearch ? (
                <TouchableOpacity onPress={() => setQcSearch('')}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['all', ...QC_CATEGORIES] as const).map(cat => {
                const isActive = qcFilterCategory === cat;
                const label = cat === 'all' ? 'All' : QC_CATEGORY_LABELS[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      console.log('JobTemplatesScreen: Quick Capture filter category changed to:', cat);
                      setQcFilterCategory(cat);
                    }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 5, marginRight: 6, borderRadius: 14,
                      backgroundColor: isActive ? theme.primary : (isDarkMode ? '#2a2a2a' : '#e8e8e8'),
                    }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: isActive ? '#000' : theme.textSecondary,
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={filteredQcPresets}
            keyExtractor={p => p.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <TouchableOpacity
                onPress={handleResetDefaults}
                style={[styles.resetBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              >
                <IconSymbol ios_icon_name="arrow.counterclockwise" android_material_icon_name="refresh" size={14} color={theme.textSecondary} />
                <Text style={[styles.resetBtnText, { color: theme.textSecondary }]}>Reset Default Presets</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No presets found. Tap + to create a custom preset.
                </Text>
              </View>
            }
            renderItem={({ item: p }) => {
              const categoryLabel = QC_CATEGORY_LABELS[p.category];
              const usageLabel = `Used ${p.usageCount}x`;
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => openEditQc(p)}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {p.isFavourite && (
                          <Text style={{ fontSize: 12, color: '#f59e0b' }}>★</Text>
                        )}
                        <Text style={[styles.cardName, { color: theme.text }]}>{p.name}</Text>
                        {p.isDefault && (
                          <View style={[styles.defaultBadge, { backgroundColor: isDarkMode ? '#2a2a2a' : '#e8e8e8' }]}>
                            <Text style={[styles.defaultBadgeText, { color: theme.textSecondary }]}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {p.description}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleToggleQcFavourite(p)}
                      style={styles.iconBtn}
                    >
                      <IconSymbol
                        ios_icon_name={p.isFavourite ? 'star.fill' : 'star'}
                        android_material_icon_name={p.isFavourite ? 'star' : 'star-border'}
                        size={20}
                        color={p.isFavourite ? '#f59e0b' : theme.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteQc(p)}
                      style={styles.iconBtn}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={18}
                        color={p.isDefault ? theme.border : theme.chartRed}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardMeta}>
                    <View style={[styles.categoryPill, { backgroundColor: isDarkMode ? '#2a2a2a' : '#e8e8e8' }]}>
                      <Text style={[styles.categoryPillText, { color: theme.primary }]}>{categoryLabel}</Text>
                    </View>
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>{usageLabel}</Text>
                    {p.suggestedAW !== undefined && (
                      <>
                        <Text style={[styles.metaDot, { color: theme.textSecondary }]}>·</Text>
                        <Text style={[styles.metaText, { color: theme.primary }]}>{p.suggestedAW} AW suggested</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ── TEMPLATE MODAL ── */}
      <Modal visible={showTemplateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => {
                  console.log('JobTemplatesScreen: Template modal cancelled');
                  setShowTemplateModal(false);
                }}
              >
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingTemplateId ? 'Edit Template' : 'New Template'}
              </Text>
              <TouchableOpacity onPress={handleSaveTemplate} disabled={savingTemplate}>
                <Text style={[styles.modalSave, { color: theme.primary }]}>
                  {savingTemplate ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NAME *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Template name"
                placeholderTextColor={theme.textSecondary}
                value={templateForm.name}
                onChangeText={v => setTemplateForm(f => ({ ...f, name: v }))}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiline, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Short description"
                placeholderTextColor={theme.textSecondary}
                value={templateForm.description}
                onChangeText={v => setTemplateForm(f => ({ ...f, description: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT NOTES</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiline, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Default job notes"
                placeholderTextColor={theme.textSecondary}
                value={templateForm.defaultNotes}
                onChangeText={v => setTemplateForm(f => ({ ...f, defaultNotes: v }))}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT AW</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. 12"
                placeholderTextColor={theme.textSecondary}
                value={templateForm.defaultAW}
                onChangeText={v => setTemplateForm(f => ({ ...f, defaultAW: v }))}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT VHC STATUS</Text>
              <View style={styles.vhcRow}>
                {VHC_OPTIONS.map(opt => {
                  const isSelected = templateForm.defaultVhcStatus === opt;
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
                        setTemplateForm(f => ({ ...f, defaultVhcStatus: opt }));
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
                value={templateForm.tags}
                onChangeText={v => setTemplateForm(f => ({ ...f, tags: v }))}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QUICK CAPTURE PRESET MODAL ── */}
      <Modal visible={showQcModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => {
                  console.log('JobTemplatesScreen: Quick Capture modal cancelled');
                  setShowQcModal(false);
                }}
              >
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingQcId ? 'Edit Preset' : 'New Preset'}
              </Text>
              <TouchableOpacity onPress={handleSaveQc} disabled={savingQc}>
                <Text style={[styles.modalSave, { color: theme.primary }]}>
                  {savingQc ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>NAME * (max 20 chars)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. Oil & Micro"
                placeholderTextColor={theme.textSecondary}
                value={qcForm.name}
                onChangeText={v => setQcForm(f => ({ ...f, name: v.slice(0, 20) }))}
                maxLength={20}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DESCRIPTION * (inserted into Job Description)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. Oil and micro"
                placeholderTextColor={theme.textSecondary}
                value={qcForm.description}
                onChangeText={v => setQcForm(f => ({ ...f, description: v }))}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CATEGORY</Text>
              <View style={styles.vhcRow}>
                {QC_CATEGORIES.map(cat => {
                  const isSelected = qcForm.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.vhcOption,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.card,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        console.log('JobTemplatesScreen: Quick Capture category selected', cat);
                        setQcForm(f => ({ ...f, category: cat }));
                      }}
                    >
                      <Text style={[styles.vhcOptionText, { color: isSelected ? '#000' : theme.textSecondary }]}>
                        {QC_CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SUGGESTED AW (optional, 0–100)</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. 12"
                placeholderTextColor={theme.textSecondary}
                value={qcForm.suggestedAW}
                onChangeText={v => setQcForm(f => ({ ...f, suggestedAW: v }))}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>
                Advisory only — never auto-applied. Users must tap Apply to use it.
              </Text>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  fieldHint: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
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
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
