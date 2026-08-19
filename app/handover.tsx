
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { handoverStorage, HandoverEntry } from '@/utils/moduleStorage';
import { api, Job } from '@/utils/api';

type TabType = 'active' | 'resolved';
type Priority = HandoverEntry['priority'];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export default function HandoverScreen() {
  console.log('HandoverScreen: Rendering');
  const { theme } = useThemeContext();
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [showModal, setShowModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [saving, setSaving] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const loadData = useCallback(async () => {
    console.log('HandoverScreen: Loading handover entries and jobs');
    const [all, allJobs] = await Promise.all([handoverStorage.getAll(), api.getAllJobs()]);
    console.log('HandoverScreen: Loaded', all.length, 'entries and', allJobs.length, 'jobs');
    setEntries(all);
    setJobs(allJobs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayed = entries
    .filter(e => e.status === activeTab)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const openJobs = jobs.filter(j => {
    const entry = entries.find(e => e.jobId === j.id && e.status === 'active');
    return !entry;
  });

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const openCreate = () => {
    console.log('HandoverScreen: Opening create entry modal');
    setSelectedJobId('');
    setNote('');
    setPriority('medium');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedJobId) {
      Alert.alert('Validation', 'Please select a job.');
      return;
    }
    if (!note.trim()) {
      Alert.alert('Validation', 'Please add a handover note.');
      return;
    }
    setSaving(true);
    const job = jobs.find(j => j.id === selectedJobId);
    console.log('HandoverScreen: Creating handover entry for job', selectedJobId, job?.wipNumber);
    try {
      await handoverStorage.create({
        jobId: selectedJobId,
        wipNumber: job?.wipNumber || '',
        vehicleReg: job?.vehicleReg || '',
        note: note.trim(),
        priority,
        status: 'active',
        carryOverDate: new Date().toISOString().split('T')[0],
      });
      console.log('HandoverScreen: Entry created');
      await loadData();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = (entry: HandoverEntry) => {
    console.log('HandoverScreen: Resolving entry', entry.id, entry.wipNumber);
    Alert.alert('Mark Resolved', `Mark WIP ${entry.wipNumber} as resolved?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          console.log('HandoverScreen: Confirmed resolve for entry', entry.id);
          await handoverStorage.update(entry.id, {
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
          });
          await loadData();
        },
      },
    ]);
  };

  const handleDelete = (entry: HandoverEntry) => {
    console.log('HandoverScreen: Delete requested for entry', entry.id);
    Alert.alert('Delete Entry', `Delete handover for WIP ${entry.wipNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('HandoverScreen: Confirmed delete for entry', entry.id);
          await handoverStorage.delete(entry.id);
          await loadData();
        },
      },
    ]);
  };

  const priorityOptions: Priority[] = ['high', 'medium', 'low'];

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('HandoverScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Handover Board</Text>
        <TouchableOpacity onPress={openCreate} style={styles.iconBtn}>
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(['active', 'resolved'] as TabType[]).map(tab => {
          const isActive = activeTab === tab;
          const tabLabel = tab === 'active' ? 'Active' : 'Resolved';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('HandoverScreen: Tab switched to', tab);
                setActiveTab(tab);
              }}
            >
              <Text style={[styles.tabText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {activeTab === 'active' ? 'No active handovers' : 'No resolved handovers'}
            </Text>
          </View>
        }
        renderItem={({ item: entry }) => {
          const priorityColor = PRIORITY_COLORS[entry.priority];
          const priorityLabel = entry.priority.charAt(0).toUpperCase() + entry.priority.slice(1);
          return (
            <View style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: priorityColor }]}>
              <View style={styles.entryTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.entryTitleRow}>
                    <Text style={[styles.entryWip, { color: theme.text }]}>WIP {entry.wipNumber}</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                      <Text style={styles.priorityText}>{priorityLabel}</Text>
                    </View>
                  </View>
                  <Text style={[styles.entryReg, { color: theme.textSecondary }]}>{entry.vehicleReg}</Text>
                  <Text style={[styles.entryNote, { color: theme.text }]}>{entry.note}</Text>
                  <Text style={[styles.entryDate, { color: theme.textSecondary }]}>
                    {entry.status === 'resolved' && entry.resolvedAt
                      ? `Resolved: ${entry.resolvedAt.split('T')[0]}`
                      : `Carry over: ${entry.carryOverDate}`}
                  </Text>
                </View>
                <View style={styles.entryActions}>
                  {entry.status === 'active' ? (
                    <TouchableOpacity
                      onPress={() => handleResolve(entry)}
                      style={[styles.resolveBtn, { backgroundColor: theme.chartGreen }]}
                    >
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={16}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => handleDelete(entry)} style={styles.iconBtn}>
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={18}
                      color={theme.chartRed}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
                  console.log('HandoverScreen: Modal cancelled');
                  setShowModal(false);
                }}
              >
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Handover</Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[styles.modalSave, { color: theme.primary }]}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SELECT JOB</Text>
              <TouchableOpacity
                style={[styles.jobPickerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                  console.log('HandoverScreen: Opening job picker');
                  setShowJobPicker(true);
                }}
              >
                <Text style={[{ fontSize: 15 }, { color: selectedJob ? theme.text : theme.textSecondary }]}>
                  {selectedJob ? `WIP ${selectedJob.wipNumber} — ${selectedJob.vehicleReg}` : 'Tap to select a job...'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="expand-more"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PRIORITY</Text>
              <View style={styles.priorityRow}>
                {priorityOptions.map(opt => {
                  const isSelected = priority === opt;
                  const optColor = PRIORITY_COLORS[opt];
                  const optLabel = opt.charAt(0).toUpperCase() + opt.slice(1);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.priorityOption,
                        { backgroundColor: isSelected ? optColor : theme.card, borderColor: optColor },
                      ]}
                      onPress={() => {
                        console.log('HandoverScreen: Priority selected', opt);
                        setPriority(opt);
                      }}
                    >
                      <Text style={[styles.priorityOptionText, { color: isSelected ? '#fff' : optColor }]}>
                        {optLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>HANDOVER NOTE</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Describe what needs to be handed over..."
                placeholderTextColor={theme.textSecondary}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={4}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showJobPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              onPress={() => {
                console.log('HandoverScreen: Job picker cancelled');
                setShowJobPicker(false);
              }}
            >
              <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Job</Text>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={openJobs.slice(0, 50)}
            keyExtractor={j => j.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No open jobs available</Text>
              </View>
            }
            renderItem={({ item: j }) => {
              const jobDate = j.createdAt.split('T')[0];
              return (
                <TouchableOpacity
                  style={[styles.jobPickerItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => {
                    console.log('HandoverScreen: Job selected', j.id, j.wipNumber);
                    setSelectedJobId(j.id);
                    setShowJobPicker(false);
                  }}
                >
                  <Text style={[{ fontSize: 15, fontWeight: '600' }, { color: theme.text }]}>
                    WIP {j.wipNumber}
                  </Text>
                  <Text style={[{ fontSize: 13 }, { color: theme.textSecondary }]}>
                    {j.vehicleReg} · {jobDate}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  entryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  entryWip: { fontSize: 16, fontWeight: '700' },
  entryReg: { fontSize: 13, marginBottom: 4 },
  entryNote: { fontSize: 14, marginBottom: 4 },
  entryDate: { fontSize: 12 },
  entryActions: { gap: 8, alignItems: 'center' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  resolveBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
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
  jobPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  priorityOptionText: { fontSize: 13, fontWeight: '700' },
  noteInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  jobPickerItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 2,
  },
});
