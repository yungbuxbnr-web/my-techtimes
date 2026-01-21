
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { exportToPdf, exportToJson } from '@/utils/exportUtils';
import * as Sharing from 'expo-sharing';

type SearchFilter = 'all' | 'wip' | 'reg';

export default function JobStatsScreen() {
  console.log('JobStatsScreen: Rendering job stats screen');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [technicianName, setTechnicianName] = useState('Technician');

  useEffect(() => {
    loadJobs();
    loadProfile();
  }, []);

  const loadJobs = async () => {
    console.log('JobStatsScreen: Loading all jobs');
    try {
      const jobs = await api.getAllJobs();
      const sorted = jobs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllJobs(sorted);
      setFilteredJobs(sorted);
      console.log('JobStatsScreen: Loaded', sorted.length, 'jobs');
    } catch (error) {
      console.error('JobStatsScreen: Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const profile = await api.getTechnicianProfile();
      setTechnicianName(profile.name);
    } catch (error) {
      console.error('JobStatsScreen: Error loading profile:', error);
    }
  };

  const handleSearch = useCallback((query: string) => {
    console.log('JobStatsScreen: Searching with query:', query, 'filter:', searchFilter);
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredJobs(allJobs);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = allJobs.filter(job => {
      if (searchFilter === 'wip') {
        return job.wipNumber.toLowerCase().includes(lowerQuery);
      } else if (searchFilter === 'reg') {
        return job.vehicleReg.toLowerCase().includes(lowerQuery);
      } else {
        return job.wipNumber.toLowerCase().includes(lowerQuery) ||
               job.vehicleReg.toLowerCase().includes(lowerQuery);
      }
    });
    
    setFilteredJobs(filtered);
    console.log('JobStatsScreen: Found', filtered.length, 'matching jobs');
  }, [allJobs, searchFilter]);

  const toggleJobSelection = (jobId: string) => {
    console.log('JobStatsScreen: Toggling job selection:', jobId);
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const selectAll = () => {
    console.log('JobStatsScreen: Selecting all jobs');
    const allIds = new Set(filteredJobs.map(job => job.id));
    setSelectedJobs(allIds);
  };

  const deselectAll = () => {
    console.log('JobStatsScreen: Deselecting all jobs');
    setSelectedJobs(new Set());
  };

  const handleExportSelected = async (format: 'pdf' | 'json') => {
    console.log('JobStatsScreen: Exporting selected jobs as', format);
    
    if (selectedJobs.size === 0) {
      Alert.alert('No Jobs Selected', 'Please select at least one job to export');
      return;
    }
    
    const jobsToExport = allJobs.filter(job => selectedJobs.has(job.id));
    
    try {
      if (format === 'pdf') {
        await exportToPdf(jobsToExport, technicianName, {
          groupBy: 'none',
          includeVhc: true,
          includeNotes: true,
        });
      } else {
        const jsonUri = await exportToJson(jobsToExport);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(jsonUri);
        }
      }
      
      setShowExportModal(false);
      Alert.alert('Success', `Exported ${selectedJobs.size} job(s) successfully`);
    } catch (error) {
      console.error('JobStatsScreen: Error exporting jobs:', error);
      Alert.alert('Error', 'Failed to export jobs');
    }
  };

  const calculateSelectedTotals = () => {
    const selectedJobsList = allJobs.filter(job => selectedJobs.has(job.id));
    const totalAw = selectedJobsList.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    const totalHours = totalMinutes / 60;
    
    return {
      count: selectedJobsList.length,
      totalAw,
      totalHours,
    };
  };

  const getVhcColor = (vhc: string) => {
    switch (vhc) {
      case 'GREEN': return theme.chartGreen;
      case 'ORANGE': return theme.chartYellow;
      case 'RED': return theme.chartRed;
      default: return theme.textSecondary;
    }
  };

  const renderJob = ({ item }: { item: Job }) => {
    const isSelected = selectedJobs.has(item.id);
    const jobDate = new Date(item.createdAt);
    const vhcColor = getVhcColor(item.vhcStatus);
    
    return (
      <TouchableOpacity
        style={[
          styles.jobCard,
          { backgroundColor: theme.card },
          isSelected && { borderColor: theme.primary, borderWidth: 2 },
        ]}
        onPress={() => toggleJobSelection(item.id)}
      >
        <View style={styles.jobHeader}>
          <View style={styles.checkboxContainer}>
            <View
              style={[
                styles.checkbox,
                { borderColor: theme.border },
                isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              {isSelected && (
                <IconSymbol
                  ios_icon_name="checkmark"
                  android_material_icon_name="check"
                  size={16}
                  color="#ffffff"
                />
              )}
            </View>
          </View>
          
          <View style={styles.jobInfo}>
            <View style={styles.jobRow}>
              <Text style={[styles.jobWip, { color: theme.text }]}>WIP: {item.wipNumber}</Text>
              {item.vhcStatus !== 'NONE' && (
                <View style={[styles.vhcBadge, { backgroundColor: vhcColor }]}>
                  <Text style={styles.vhcText}>{item.vhcStatus}</Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.jobReg, { color: theme.textSecondary }]}>{item.vehicleReg}</Text>
            
            <Text style={[styles.jobDate, { color: theme.textSecondary }]}>
              {jobDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {jobDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            
            {item.notes && (
              <Text style={[styles.jobNotes, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </View>
          
          <View style={styles.jobStats}>
            <Text style={[styles.jobAw, { color: theme.primary }]}>{item.aw}</Text>
            <Text style={[styles.jobAwLabel, { color: theme.textSecondary }]}>AWs</Text>
            <Text style={[styles.jobTime, { color: theme.textSecondary }]}>
              {formatTime(item.aw * 5)}
            </Text>
            <Text style={[styles.jobHours, { color: theme.textSecondary }]}>
              {formatDecimalHours(item.aw * 5)}h
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Job Stats',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading jobs...</Text>
        </View>
      </AppBackground>
    );
  }

  const selectedTotals = calculateSelectedTotals();

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Job Stats',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      
      <View style={[styles.container, Platform.OS === 'android' && { paddingTop: 16 }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={theme.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search jobs..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Filters */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: theme.border },
              searchFilter === 'all' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => {
              setSearchFilter('all');
              handleSearch(searchQuery);
            }}
          >
            <Text style={[styles.filterText, { color: searchFilter === 'all' ? '#ffffff' : theme.text }]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: theme.border },
              searchFilter === 'wip' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => {
              setSearchFilter('wip');
              handleSearch(searchQuery);
            }}
          >
            <Text style={[styles.filterText, { color: searchFilter === 'wip' ? '#ffffff' : theme.text }]}>
              WIP Number
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: theme.border },
              searchFilter === 'reg' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => {
              setSearchFilter('reg');
              handleSearch(searchQuery);
            }}
          >
            <Text style={[styles.filterText, { color: searchFilter === 'reg' ? '#ffffff' : theme.text }]}>
              Registration
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selection Controls */}
        <View style={[styles.controlsContainer, { backgroundColor: theme.card }]}>
          <View style={styles.selectionInfo}>
            <Text style={[styles.selectionText, { color: theme.text }]}>
              {selectedJobs.size} of {filteredJobs.length} selected
            </Text>
            {selectedJobs.size > 0 && (
              <View style={styles.selectedTotals}>
                <Text style={[styles.selectedTotalText, { color: theme.primary }]}>
                  {selectedTotals.totalAw} AWs • {selectedTotals.totalHours.toFixed(2)}h
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: theme.background }]}
              onPress={selectAll}
            >
              <Text style={[styles.controlButtonText, { color: theme.primary }]}>Select All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: theme.background }]}
              onPress={deselectAll}
            >
              <Text style={[styles.controlButtonText, { color: theme.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.exportButton,
                { backgroundColor: selectedJobs.size > 0 ? theme.primary : theme.textSecondary },
              ]}
              onPress={() => setShowExportModal(true)}
              disabled={selectedJobs.size === 0}
            >
              <IconSymbol
                ios_icon_name="square.and.arrow.up"
                android_material_icon_name="share"
                size={16}
                color="#ffffff"
              />
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Jobs List */}
        <FlatList
          data={filteredJobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={64}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQuery ? 'No jobs found matching your search' : 'No jobs recorded yet'}
              </Text>
            </View>
          }
        />
      </View>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Export Selected Jobs</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Exporting {selectedJobs.size} job(s)
            </Text>
            
            <TouchableOpacity
              style={[styles.exportOptionButton, { backgroundColor: theme.primary }]}
              onPress={() => handleExportSelected('pdf')}
            >
              <IconSymbol
                ios_icon_name="doc.text.fill"
                android_material_icon_name="description"
                size={24}
                color="#ffffff"
              />
              <Text style={styles.exportOptionText}>Export as PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.exportOptionButton, { backgroundColor: theme.secondary }]}
              onPress={() => handleExportSelected('json')}
            >
              <IconSymbol
                ios_icon_name="doc.fill"
                android_material_icon_name="insert-drive-file"
                size={24}
                color="#ffffff"
              />
              <Text style={styles.exportOptionText}>Export as JSON</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlsContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionInfo: {
    marginBottom: 12,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedTotals: {
    marginTop: 4,
  },
  selectedTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  jobCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  jobWip: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  vhcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vhcText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  jobReg: {
    fontSize: 14,
    marginBottom: 4,
  },
  jobDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  jobNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  jobStats: {
    alignItems: 'flex-end',
  },
  jobAw: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  jobAwLabel: {
    fontSize: 10,
    marginTop: -4,
    marginBottom: 4,
  },
  jobTime: {
    fontSize: 12,
    marginBottom: 2,
  },
  jobHours: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  exportOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  exportOptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
