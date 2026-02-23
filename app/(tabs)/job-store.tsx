
import { awToMinutes, formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { useThemeContext } from '@/contexts/ThemeContext';
import React, { useState, useEffect, useCallback } from 'react';
import { api, Job } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';

type FilterType = 'all' | 'today' | 'week' | 'month' | 'vhc-green' | 'vhc-orange' | 'vhc-red';
type SortType = 'date-desc' | 'date-asc' | 'aw-desc' | 'aw-asc';

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
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
  },
});

export default function JobStoreScreen() {
  const { theme } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('date-desc');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // FIXED: Define loadJobs function
  const loadJobs = useCallback(async () => {
    try {
      console.log('JobStore: Loading all jobs');
      const allJobs = await api.getAllJobs();
      setJobs(allJobs);
      console.log('JobStore: Loaded', allJobs.length, 'jobs');
    } catch (error) {
      console.error('JobStore: Error loading jobs:', error);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // FIXED: Define applyFiltersAndSearch function
  const applyFiltersAndSearch = useCallback(() => {
    console.log('JobStore: Applying filters and search');
    let filtered = [...jobs];

    // Apply filter
    switch (filter) {
      case 'today': {
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter((job) => job.createdAt.startsWith(today));
        break;
      }
      case 'week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(
          (job) => new Date(job.createdAt) >= weekAgo
        );
        break;
      }
      case 'month': {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(
          (job) => new Date(job.createdAt) >= monthAgo
        );
        break;
      }
      case 'vhc-green':
        filtered = filtered.filter((job) => job.vhcStatus === 'GREEN');
        break;
      case 'vhc-orange':
        filtered = filtered.filter((job) => job.vhcStatus === 'ORANGE');
        break;
      case 'vhc-red':
        filtered = filtered.filter((job) => job.vhcStatus === 'RED');
        break;
      default:
        break;
    }

    // Apply search
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.wipNumber.toLowerCase().includes(query) ||
          job.vehicleReg.toLowerCase().includes(query) ||
          (job.notes && job.notes.toLowerCase().includes(query))
      );
    }

    // Apply sort
    switch (sort) {
      case 'date-desc':
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'date-asc':
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'aw-desc':
        filtered.sort((a, b) => b.aw - a.aw);
        break;
      case 'aw-asc':
        filtered.sort((a, b) => a.aw - b.aw);
        break;
      default:
        break;
    }

    setFilteredJobs(filtered);
    console.log('JobStore: Filtered to', filtered.length, 'jobs');
  }, [jobs, filter, sort, searchQuery]);

  // FIXED: Now the dependency array is correct
  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  const clearFilters = () => {
    setFilter('all');
    setSort('date-desc');
    setSearchQuery('');
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

  const getFilterLabel = () => {
    switch (filter) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'vhc-green':
        return 'VHC Green';
      case 'vhc-orange':
        return 'VHC Orange';
      case 'vhc-red':
        return 'VHC Red';
      default:
        return 'All Jobs';
    }
  };

  const getSortLabel = () => {
    switch (sort) {
      case 'date-desc':
        return 'Newest First';
      case 'date-asc':
        return 'Oldest First';
      case 'aw-desc':
        return 'Highest AW';
      case 'aw-asc':
        return 'Lowest AW';
      default:
        return 'Sort';
    }
  };

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);

    return (
      <View
        style={[
          styles.jobCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.jobHeader}>
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
      </View>
    );
  };

  const totals = calculateTotals();

  return (
    <ImageBackground
      source={require('@/assets/images/c7530b94-d069-450b-8eb8-e35e3dd41e52.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Job Store
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.text }]}>
          Search and filter all jobs
        </Text>
      </View>

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

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filter !== 'all' ? theme.primary : 'transparent',
              borderColor: theme.primary,
            },
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text
            style={[
              styles.filterButtonText,
              {
                color: filter !== 'all' ? '#fff' : theme.primary,
              },
            ]}
          >
            {getFilterLabel()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: 'transparent',
              borderColor: theme.primary,
            },
          ]}
          onPress={() => setShowSortModal(true)}
        >
          <Text
            style={[
              styles.filterButtonText,
              {
                color: theme.primary,
              },
            ]}
          >
            {getSortLabel()}
          </Text>
        </TouchableOpacity>

        {(filter !== 'all' || sort !== 'date-desc' || searchQuery !== '') && (
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: 'transparent',
                borderColor: theme.border,
              },
            ]}
            onPress={clearFilters}
          >
            <Text
              style={[
                styles.filterButtonText,
                {
                  color: theme.text,
                },
              ]}
            >
              Clear
            </Text>
          </TouchableOpacity>
        )}
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
              No jobs found
            </Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Filter Jobs
            </Text>
            {[
              { value: 'all', label: 'All Jobs' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'vhc-green', label: 'VHC Green' },
              { value: 'vhc-orange', label: 'VHC Orange' },
              { value: 'vhc-red', label: 'VHC Red' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => {
                  setFilter(option.value as FilterType);
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    {
                      color:
                        filter === option.value ? theme.primary : theme.text,
                      fontWeight: filter === option.value ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Sort Jobs
            </Text>
            {[
              { value: 'date-desc', label: 'Newest First' },
              { value: 'date-asc', label: 'Oldest First' },
              { value: 'aw-desc', label: 'Highest AW' },
              { value: 'aw-asc', label: 'Lowest AW' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => {
                  setSort(option.value as SortType);
                  setShowSortModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    {
                      color:
                        sort === option.value ? theme.primary : theme.text,
                      fontWeight: sort === option.value ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}
