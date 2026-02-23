
import { awToMinutes, formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { useThemeContext } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { api, Job } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { exportToPdf } from '@/utils/exportUtils';
import { IconSymbol } from '@/components/IconSymbol';
import { updateWidgetData } from '@/utils/widgetManager';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  monthButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  statsContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  jobCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobWip: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  jobReg: {
    fontSize: 16,
    fontWeight: '600',
  },
  jobDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  jobAw: {
    fontSize: 14,
  },
  jobTime: {
    fontSize: 14,
  },
  jobDate: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  jobActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  vhcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  vhcText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  selectionMode: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});

export default function JobRecordsScreen() {
  const { theme } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [refreshing, setRefreshing] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editWip, setEditWip] = useState('');
  const [editReg, setEditReg] = useState('');
  const [editAw, setEditAw] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [technicianName, setTechnicianName] = useState('Technician');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  // FIXED: Define loadJobs function
  const loadJobs = useCallback(async () => {
    try {
      console.log('JobRecords: Loading jobs for month:', selectedMonth);
      const monthJobs = await api.getJobsForMonth(selectedMonth);
      setJobs(monthJobs);
      setFilteredJobs(monthJobs);
      console.log('JobRecords: Loaded', monthJobs.length, 'jobs');
    } catch (error) {
      console.error('JobRecords: Error loading jobs:', error);
      Alert.alert('Error', 'Failed to load jobs');
    }
  }, [selectedMonth]);

  // FIXED: Define loadProfile function
  const loadProfile = useCallback(async () => {
    try {
      console.log('JobRecords: Loading technician profile');
      const profile = await api.getTechnicianProfile();
      if (profile && profile.name) {
        setTechnicianName(profile.name);
        console.log('JobRecords: Loaded profile:', profile.name);
      }
    } catch (error) {
      console.error('JobRecords: Error loading profile:', error);
    }
  }, []);

  // FIXED: Now the dependency array is correct
  useEffect(() => {
    loadJobs();
    loadProfile();
  }, [selectedMonth, loadJobs, loadProfile]);

  useEffect(() => {
    // Filter jobs based on search query
    if (searchQuery.trim() === '') {
      setFilteredJobs(jobs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = jobs.filter(
        (job) =>
          job.wipNumber.toLowerCase().includes(query) ||
          job.vehicleReg.toLowerCase().includes(query) ||
          (job.notes && job.notes.toLowerCase().includes(query))
      );
      setFilteredJobs(filtered);
    }
  }, [searchQuery, jobs]);

  function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    await loadProfile();
    setRefreshing(false);
  }, [loadJobs, loadProfile]);

  const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1); // month - 2 because month is 1-indexed
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month, 1); // month is already correct for next month
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobs);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobs(newSelection);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setEditWip(job.wipNumber);
    setEditReg(job.vehicleReg);
    setEditAw(job.aw.toString());
    setEditNotes(job.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;

    try {
      await api.updateJob(editingJob.id, {
        wipNumber: editWip,
        vehicleReg: editReg.toUpperCase(),
        aw: parseInt(editAw, 10),
        notes: editNotes,
      });

      setEditingJob(null);
      await loadJobs();
      await updateWidgetData();
      Alert.alert('Success', 'Job updated successfully');
    } catch (error) {
      console.error('JobRecords: Error updating job:', error);
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
            try {
              await api.deleteJob(jobId);
              await loadJobs();
              await updateWidgetData();
              Alert.alert('Success', 'Job deleted successfully');
            } catch (error) {
              console.error('JobRecords: Error deleting job:', error);
              Alert.alert('Error', 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const handleExportSelected = async () => {
    if (selectedJobs.size === 0) {
      Alert.alert('No Selection', 'Please select jobs to export');
      return;
    }

    const jobsToExport = jobs.filter((job) => selectedJobs.has(job.id));

    try {
      await exportToPdf(jobsToExport, technicianName, {
        groupBy: 'day',
        includeVhc: true,
        includeNotes: true,
        includeImages: false,
      });
      setSelectionMode(false);
      setSelectedJobs(new Set());
    } catch (error) {
      console.error('JobRecords: Error exporting jobs:', error);
      Alert.alert('Error', 'Failed to export jobs');
    }
  };

  const getVhcColor = (vhc: string) => {
    switch (vhc) {
      case 'GREEN':
        return '#4CAF50';
      case 'ORANGE':
        return '#FF9800';
      case 'RED':
        return '#F44336';
      default:
        return 'transparent';
    }
  };

  const calculateTotals = () => {
    const totalAw = filteredJobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = awToMinutes(totalAw);
    return {
      jobs: filteredJobs.length,
      aw: totalAw,
      time: formatTime(totalMinutes),
      hours: formatDecimalHours(totalMinutes),
    };
  };

  const calculateSelectedTotals = () => {
    const selectedJobsList = jobs.filter((job) => selectedJobs.has(job.id));
    const totalAw = selectedJobsList.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = awToMinutes(totalAw);
    return {
      jobs: selectedJobsList.length,
      aw: totalAw,
      time: formatTime(totalMinutes),
      hours: formatDecimalHours(totalMinutes),
    };
  };

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);
    const isSelected = selectedJobs.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.jobCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          isSelected && { borderColor: theme.primary, borderWidth: 2 },
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
        <View style={styles.jobHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {selectionMode && (
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.primary },
                  isSelected && { backgroundColor: theme.primary },
                ]}
              >
                {isSelected && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={16}
                    color="#fff"
                  />
                )}
              </View>
            )}
            <View>
              <Text style={[styles.jobWip, { color: theme.text }]}>
                WIP: {item.wipNumber}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.jobReg, { color: theme.text }]}>
                  {item.vehicleReg}
                </Text>
                {item.vhcStatus !== 'NONE' && (
                  <View
                    style={[
                      styles.vhcBadge,
                      { backgroundColor: getVhcColor(item.vhcStatus) },
                    ]}
                  >
                    <Text style={styles.vhcText}>{item.vhcStatus}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {!selectionMode && (
            <View style={styles.jobActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEditJob(item)}
              >
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteJob(item.id)}
              >
                <IconSymbol
                  ios_icon_name="trash"
                  android_material_icon_name="delete"
                  size={20}
                  color="#F44336"
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.jobDetails}>
          <Text style={[styles.jobAw, { color: theme.text }]}>
            AW: {item.aw}
          </Text>
          <Text style={[styles.jobTime, { color: theme.text }]}>
            {formatTime(minutes)} ({formatDecimalHours(minutes)}h)
          </Text>
        </View>

        {item.notes && (
          <Text style={[styles.jobDate, { color: theme.text }]}>
            Notes: {item.notes}
          </Text>
        )}

        <Text style={[styles.jobDate, { color: theme.text }]}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const totals = selectionMode ? calculateSelectedTotals() : calculateTotals();

  return (
    <ImageBackground
      source={require('@/assets/images/c7530b94-d069-450b-8eb8-e35e3dd41e52.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Job Records
        </Text>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={handlePreviousMonth}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: theme.text }]}>
            {new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={handleNextMonth}
          >
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {selectionMode && (
        <View
          style={[
            styles.selectionMode,
            { backgroundColor: theme.card, borderBottomColor: theme.border },
          ]}
        >
          <Text style={[styles.selectionText, { color: theme.text }]}>
            {selectedJobs.size} selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleExportSelected}>
              <IconSymbol
                ios_icon_name="square.and.arrow.up"
                android_material_icon_name="file-download"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSelectionMode(false);
                setSelectedJobs(new Set());
              }}
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: theme.card, color: theme.text },
          ]}
          placeholder="Search by WIP, Reg, or Notes..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {totals.jobs}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text }]}>Jobs</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {totals.aw}
          </Text>
          <Text style={[styles.statLabel, { color: theme.text }]}>
            Total AW
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {totals.hours}h
          </Text>
          <Text style={[styles.statLabel, { color: theme.text }]}>Hours</Text>
        </View>
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No jobs found for this month
            </Text>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal
        visible={editingJob !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingJob(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Edit Job
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="WIP Number"
              placeholderTextColor={theme.textSecondary}
              value={editWip}
              onChangeText={setEditWip}
              keyboardType="number-pad"
              maxLength={5}
            />

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Vehicle Registration"
              placeholderTextColor={theme.textSecondary}
              value={editReg}
              onChangeText={(text) => setEditReg(text.toUpperCase())}
              autoCapitalize="characters"
            />

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="AW (0-100)"
              placeholderTextColor={theme.textSecondary}
              value={editAw}
              onChangeText={setEditAw}
              keyboardType="number-pad"
            />

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.textSecondary}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => setEditingJob(null)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}
