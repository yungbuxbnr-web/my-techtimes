
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { router } from 'expo-router';
import { api, Job } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { exportToPdf } from '@/utils/exportUtils';

export default function JobRecordsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [technicianName, setTechnicianName] = useState('Technician');
  
  const [editWip, setEditWip] = useState('');
  const [editReg, setEditReg] = useState('');
  const [editAw, setEditAw] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editVhc, setEditVhc] = useState<'NONE' | 'GREEN' | 'ORANGE' | 'RED'>('NONE');
  const [editDate, setEditDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const loadJobs = useCallback(async () => {
    try {
      console.log('JobRecordsScreen: Fetching jobs for month:', selectedMonth);
      const fetchedJobs = await api.getJobsForMonth(selectedMonth);
      setJobs(fetchedJobs);
      console.log('JobRecordsScreen: Loaded', fetchedJobs.length, 'jobs');
    } catch (error) {
      console.error('JobRecordsScreen: Error loading jobs:', error);
      Alert.alert('Error', 'Failed to load jobs');
    }
  }, [selectedMonth]);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
    } catch (error) {
      console.error('JobRecordsScreen: Error loading profile:', error);
    }
  }, []);

  useEffect(() => {
    console.log('JobRecordsScreen: Loading jobs for month:', selectedMonth);
    loadJobs();
    loadProfile();
  }, [selectedMonth, loadJobs, loadProfile]);

  const onRefresh = async () => {
    console.log('JobRecordsScreen: User refreshing jobs list');
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    setSelectedMonth(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    setSelectedMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobs);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobs(newSelection);
    console.log('JobRecordsScreen: Selected jobs count:', newSelection.size);
  };

  const handleEditJob = (job: Job) => {
    console.log('JobRecordsScreen: User editing job:', job.id);
    setEditingJob(job);
    setEditWip(job.wipNumber);
    setEditReg(job.vehicleReg);
    setEditAw(job.aw.toString());
    setEditNotes(job.notes || '');
    setEditVhc(job.vhcStatus || 'NONE');
    setEditDate(new Date(job.createdAt));
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;

    const aw = parseInt(editAw);
    if (isNaN(aw) || aw < 0 || aw > 100) {
      Alert.alert('Invalid AW', 'AW must be between 0 and 100');
      return;
    }

    if (editWip.length !== 5 || !/^\d+$/.test(editWip)) {
      Alert.alert('Invalid WIP', 'WIP must be exactly 5 digits');
      return;
    }

    try {
      console.log('JobRecordsScreen: Saving job edit');
      await api.updateJob(editingJob.id, {
        wipNumber: editWip,
        vehicleReg: editReg.toUpperCase(),
        aw,
        notes: editNotes,
        vhcStatus: editVhc,
        createdAt: editDate.toISOString(),
      });
      setShowEditModal(false);
      await loadJobs();
      Alert.alert('Success', 'Job updated successfully');
    } catch (error) {
      console.error('JobRecordsScreen: Error updating job:', error);
      Alert.alert('Error', 'Failed to update job');
    }
  };

  const handleDeleteJob = (jobId: string) => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('JobRecordsScreen: User confirmed delete job:', jobId);
            try {
              await api.deleteJob(jobId);
              await loadJobs();
            } catch (error) {
              console.error('JobRecordsScreen: Error deleting job:', error);
              Alert.alert('Error', 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const handleExportSelected = async () => {
    if (selectedJobs.size === 0) {
      Alert.alert('No Jobs Selected', 'Please select jobs to export');
      return;
    }

    const selectedJobsArray = jobs.filter(job => selectedJobs.has(job.id));
    console.log('JobRecordsScreen: Exporting', selectedJobsArray.length, 'selected jobs to PDF');

    try {
      await exportToPdf(selectedJobsArray, technicianName, { type: 'all' });
      Alert.alert('Success', `Exported ${selectedJobsArray.length} jobs to PDF`);
    } catch (error) {
      console.error('JobRecordsScreen: Error exporting to PDF:', error);
      Alert.alert('Error', 'Failed to export jobs to PDF');
    }
  };

  const getVhcColor = (vhc: string) => {
    switch (vhc) {
      case 'GREEN': return theme.chartGreen;
      case 'ORANGE': return theme.chartYellow;
      case 'RED': return theme.chartRed;
      default: return 'transparent';
    }
  };

  const calculateTotals = () => {
    const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      count: jobs.length,
      totalAw,
      totalTime: formatTime(totalMinutes),
      totalHours: totalMinutes / 60,
    };
  };

  const calculateSelectedTotals = () => {
    const selectedJobsArray = jobs.filter(job => selectedJobs.has(job.id));
    const totalAw = selectedJobsArray.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      count: selectedJobsArray.length,
      totalAw,
      totalTime: formatTime(totalMinutes),
      totalHours: totalMinutes / 60,
    };
  };

  const totals = calculateTotals();
  const selectedTotals = calculateSelectedTotals();
  const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);
    const date = new Date(item.createdAt);
    const vhcColor = getVhcColor(item.vhcStatus || 'NONE');
    const isSelected = selectedJobs.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.jobCard,
          { backgroundColor: theme.card },
          isSelected && { borderWidth: 3, borderColor: theme.primary },
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleJobSelection(item.id);
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleJobSelection(item.id);
          }
        }}
      >
        {item.vhcStatus && item.vhcStatus !== 'NONE' && (
          <View style={[styles.vhcStrip, { backgroundColor: vhcColor }]} />
        )}
        
        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <View style={styles.jobInfo}>
              {selectionMode && (
                <View style={[styles.checkbox, isSelected && { backgroundColor: theme.primary }]}>
                  {isSelected && (
                    <IconSymbol
                      ios_icon_name="checkmark"
                      android_material_icon_name="check"
                      size={16}
                      color="#ffffff"
                    />
                  )}
                </View>
              )}
              <Text style={[styles.wipNumber, { color: theme.primary }]}>
                WIP: {item.wipNumber}
              </Text>
              {item.vhcStatus && item.vhcStatus !== 'NONE' && (
                <View style={[styles.vhcBadge, { backgroundColor: vhcColor }]}>
                  <Text style={styles.vhcText}>● VHC: {item.vhcStatus}</Text>
                </View>
              )}
            </View>
            {!selectionMode && (
              <View style={styles.jobActions}>
                <TouchableOpacity
                  onPress={() => handleEditJob(item)}
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteJob(item.id)}
                  style={[styles.actionButton, { backgroundColor: theme.error }]}
                >
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={16}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.jobDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Vehicle:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{item.vehicleReg}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>AWs:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{item.aw}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Time:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{formatTime(minutes)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Date:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          {item.notes && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesLabel, { color: theme.textSecondary }]}>Notes:</Text>
              <Text style={[styles.notesText, { color: theme.text }]}>{item.notes}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1200' }}
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <View style={styles.container}>
          <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
            <Text style={[styles.title, { color: '#ffffff' }]}>Job Records</Text>
            {!selectionMode && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  console.log('JobRecordsScreen: User tapped Add Job button');
                  router.push('/add-job-modal');
                }}
              >
                <IconSymbol
                  ios_icon_name="plus"
                  android_material_icon_name="add"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.addButtonText}>Add Job</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.monthSelector, { backgroundColor: theme.card }]}>
            <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthArrow}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <View style={styles.monthInfo}>
              <Text style={[styles.monthText, { color: theme.text }]}>{monthName}</Text>
              <Text style={[styles.monthSubtext, { color: theme.textSecondary }]}>
                {totals.count} jobs
              </Text>
            </View>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthArrow}>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>

          {selectionMode ? (
            <View style={[styles.selectionBar, { backgroundColor: theme.primary }]}>
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionText}>
                  {selectedJobs.size} selected
                </Text>
                <Text style={styles.selectionSubtext}>
                  {selectedTotals.totalAw} AW • {selectedTotals.totalHours.toFixed(2)}h
                </Text>
              </View>
              <View style={styles.selectionActions}>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={handleExportSelected}
                >
                  <IconSymbol
                    ios_icon_name="square.and.arrow.up"
                    android_material_icon_name="share"
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.selectionButtonText}>Export PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={() => {
                    setSelectionMode(false);
                    setSelectedJobs(new Set());
                  }}
                >
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.selectionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.totalsRow, { backgroundColor: theme.card }]}>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.count}</Text>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Jobs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.totalAw}</Text>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>AWs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.totalTime}</Text>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Time</Text>
              </View>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.secondary }]}
                onPress={() => {
                  console.log('JobRecordsScreen: User enabled selection mode');
                  setSelectionMode(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="checkmark.circle"
                  android_material_icon_name="check-circle"
                  size={20}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={jobs}
            renderItem={renderJob}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <IconSymbol
                  ios_icon_name="tray.fill"
                  android_material_icon_name="inbox"
                  size={64}
                  color={theme.textSecondary}
                />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No jobs found for this month
                </Text>
              </View>
            }
          />
        </View>

        <Modal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Job</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={[styles.label, { color: theme.text }]}>WIP Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={editWip}
                  onChangeText={setEditWip}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={[styles.label, { color: theme.text }]}>Vehicle Registration</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={editReg}
                  onChangeText={(text) => setEditReg(text.toUpperCase())}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={[styles.label, { color: theme.text }]}>AW Value</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={editAw}
                  onChangeText={setEditAw}
                  keyboardType="number-pad"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={[styles.label, { color: theme.text }]}>VHC Status</Text>
                <View style={styles.vhcSelector}>
                  {(['NONE', 'GREEN', 'ORANGE', 'RED'] as const).map((vhc) => (
                    <TouchableOpacity
                      key={vhc}
                      style={[
                        styles.vhcOption,
                        { backgroundColor: editVhc === vhc ? getVhcColor(vhc) || theme.primary : theme.background },
                      ]}
                      onPress={() => setEditVhc(vhc)}
                    >
                      <Text style={[styles.vhcOptionText, { color: editVhc === vhc ? '#ffffff' : theme.text }]}>
                        {vhc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.text }]}>
                      {editDate.toLocaleDateString('en-GB')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.text }]}>
                      {editDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={editDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) setEditDate(selectedDate);
                    }}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={editDate}
                    mode="time"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) setEditDate(selectedDate);
                    }}
                  />
                )}

                <Text style={[styles.label, { color: theme.text }]}>Notes</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={theme.textSecondary}
                />

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthArrow: {
    padding: 8,
  },
  monthInfo: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 12,
  },
  selectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectionSubtext: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 2,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
  },
  selectionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  jobCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vhcStrip: {
    width: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  jobContent: {
    padding: 16,
    paddingLeft: 20,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wipNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  vhcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  vhcText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  jobActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  jobDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  vhcSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  vhcOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  vhcOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
