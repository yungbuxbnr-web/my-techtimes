
import React, { useState, useEffect, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ImageBackground,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime } from '@/utils/jobCalculations';
import { router, useFocusEffect } from 'expo-router';
import { api, Job } from '@/utils/api';
import { exportToPdf } from '@/utils/exportUtils';
import { updateWidgetData } from '@/utils/widgetManager';

// Android status bar height helper
const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

export default function JobRecordsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [technicianName, setTechnicianName] = useState('Technician');

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const loadJobs = useCallback(async () => {
    try {
      console.log('JobRecordsScreen: Fetching jobs for month:', selectedMonth);
      const fetchedJobs = await api.getJobsForMonth(selectedMonth);
      const sorted = [...fetchedJobs].sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (!isNaN(tB - tA) && tB !== tA) return tB - tA;
        return Number(b.id.split('-')[0]) - Number(a.id.split('-')[0]);
      });
      setJobs(sorted);
      console.log('JobRecordsScreen: Loaded', sorted.length, 'jobs (sorted newest first)');
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
    console.log('JobRecordsScreen: User tapped previous month');
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    setSelectedMonth(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    console.log('JobRecordsScreen: User tapped next month');
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

  useFocusEffect(
    React.useCallback(() => {
      console.log('JobRecordsScreen: Screen focused, reloading jobs');
      loadJobs();
    }, [loadJobs])
  );

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
              console.log('JobRecordsScreen: Updating widget data after delete');
              await updateWidgetData();
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

  const openEditModal = (job: Job) => {
    console.log('JobRecordsScreen: Opening add-job-modal pre-filled for edit, job:', job.id);
    // All params must be strings for Android React Navigation compatibility
    router.push({
      pathname: '/add-job-modal',
      params: {
        editId: String(job.id),
        editWipNumber: String(job.wipNumber),
        editVehicleReg: String(job.vehicleReg),
        editAw: String(job.aw),
        editNotes: String(job.notes || ''),
        editVhcStatus: String(job.vhcStatus || 'NONE'),
        editCreatedAt: String(job.createdAt),
        editImageUri: String(job.imageUri || ''),
      },
    });
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
  // selectedTotals kept for potential future use
  void calculateSelectedTotals;
  const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);
    const date = new Date(item.createdAt);
    const vhcColor = getVhcColor(item.vhcStatus || 'NONE');
    const isSelected = selectedJobs.has(item.id);
    const hasPhotos = !!item.imageUri;
    const dateDisplay = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeDisplay = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const timeFormatted = formatTime(minutes);

    return (
      <View
        style={[
          styles.jobCard,
          { backgroundColor: theme.card },
          isSelected && { borderWidth: 3, borderColor: theme.primary },
        ]}
      >
        {item.vhcStatus && item.vhcStatus !== 'NONE' && (
          <View style={[styles.vhcStrip, { backgroundColor: vhcColor }]} />
        )}

        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            {/* Use Pressable for reliable long-press on Android */}
            <Pressable
              style={styles.jobInfo}
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
              onPress={() => {
                if (selectionMode) {
                  console.log('JobRecordsScreen: User tapped job to toggle selection:', item.id);
                  toggleJobSelection(item.id);
                }
              }}
              onLongPress={() => {
                if (!selectionMode) {
                  console.log('JobRecordsScreen: User long-pressed job, entering selection mode:', item.id);
                  setSelectionMode(true);
                  toggleJobSelection(item.id);
                }
              }}
              delayLongPress={300}
            >
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
                  <Text style={styles.vhcText}>
                    VHC: {item.vhcStatus}
                  </Text>
                </View>
              )}
            </Pressable>

            {!selectionMode && (
              <View style={styles.jobActions}>
                <TouchableOpacity
                  onPress={() => {
                    console.log('JobRecordsScreen: User tapped Edit button for job:', item.id);
                    openEditModal(item);
                  }}
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    console.log('JobRecordsScreen: User tapped Delete button for job:', item.id);
                    handleDeleteJob(item.id);
                  }}
                  style={[styles.actionButton, { backgroundColor: theme.error }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

          <Pressable
            onPress={() => {
              if (selectionMode) {
                console.log('JobRecordsScreen: User tapped job details to toggle selection:', item.id);
                toggleJobSelection(item.id);
              }
            }}
            onLongPress={() => {
              if (!selectionMode) {
                console.log('JobRecordsScreen: User long-pressed job details, entering selection mode:', item.id);
                setSelectionMode(true);
                toggleJobSelection(item.id);
              }
            }}
            delayLongPress={300}
            android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
          >
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
                <Text style={[styles.detailValue, { color: theme.text }]}>{timeFormatted}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Date:</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{dateDisplay}</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>, </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{timeDisplay}</Text>
                </View>
              </View>
            </View>

            {item.notes && (
              <View style={styles.notesSection}>
                <Text style={[styles.notesLabel, { color: theme.textSecondary }]}>Notes:</Text>
                <Text style={[styles.notesText, { color: theme.text }]}>{item.notes}</Text>
              </View>
            )}

            {hasPhotos && (
              <View style={styles.photoBadgeRow}>
                <IconSymbol
                  ios_icon_name="photo.fill"
                  android_material_icon_name="image"
                  size={14}
                  color={theme.primary}
                />
                <Text style={[styles.photoBadgeText, { color: theme.primary }]}>Has photos</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  // Header top padding: on Android add status bar height + extra breathing room
  const headerPaddingTop = Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT + 12 : 16;

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <View style={styles.container}>
            <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
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
              <TouchableOpacity
                onPress={handlePreviousMonth}
                style={styles.monthArrow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
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
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.monthArrow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
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
                {/* Fixed-width label so it never wraps */}
                <Text style={styles.selectionText} numberOfLines={1} ellipsizeMode="clip">
                  {selectedJobs.size} selected
                </Text>
                <View style={styles.selectionActions}>
                  {selectedJobs.size === 1 && (
                    <TouchableOpacity
                      style={styles.selectionButton}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      onPress={() => {
                        const selectedId = Array.from(selectedJobs)[0];
                        const selectedJob = jobs.find(j => j.id === selectedId);
                        console.log('JobRecordsScreen: User tapped Edit Record for job:', selectedId);
                        if (selectedJob) {
                          setSelectionMode(false);
                          setSelectedJobs(new Set());
                          openEditModal(selectedJob);
                        }
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="pencil"
                        android_material_icon_name="edit"
                        size={14}
                        color="#ffffff"
                      />
                      <Text style={styles.selectionButtonText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.selectionButton}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    onPress={() => {
                      console.log('JobRecordsScreen: User tapped Export PDF for', selectedJobs.size, 'jobs');
                      handleExportSelected();
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="square.and.arrow.up"
                      android_material_icon_name="share"
                      size={14}
                      color="#ffffff"
                    />
                    <Text style={styles.selectionButtonText}>Export PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.selectionButton}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    onPress={() => {
                      console.log('JobRecordsScreen: User cancelled selection mode');
                      setSelectionMode(false);
                      setSelectedJobs(new Set());
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="xmark"
                      android_material_icon_name="close"
                      size={14}
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
              data={[...jobs].sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id.split('-')[0]);
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id.split('-')[0]);
                const diff = timeB - timeA;
                if (!isNaN(diff) && diff !== 0) return diff;
                return Number(b.id.split('-')[0]) - Number(a.id.split('-')[0]);
              })}
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
        </View>
      </ImageBackground>
    </View>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
    minHeight: 44,
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
    elevation: 3,
  },
  monthArrow: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Selection bar: single horizontal row, no wrapping
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 5,
    minHeight: 52,
  },
  selectionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    flexShrink: 0,
    marginRight: 8,
    // Fixed minimum width so it never causes layout shift
    minWidth: 80,
  },
  selectionActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'nowrap',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
    flexShrink: 0,
    minHeight: 36,
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
    minHeight: 44,
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
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  notesLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
  },
  photoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
});
