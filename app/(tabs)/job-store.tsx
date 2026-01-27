
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
  Platform,
  Modal,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { api, Job } from '@/utils/api';

type FilterType = 'all' | 'today' | 'week' | 'month' | 'custom';
type SortType = 'date-desc' | 'date-asc' | 'aw-desc' | 'aw-asc' | 'wip-asc' | 'wip-desc';

export default function JobStoreScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('date-desc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [vhcFilter, setVhcFilter] = useState<'all' | 'NONE' | 'GREEN' | 'ORANGE' | 'RED'>('all');

  const loadJobs = useCallback(async () => {
    try {
      console.log('JobStoreScreen: Fetching all jobs from storage');
      const fetchedJobs = await api.getAllJobs();
      setAllJobs(fetchedJobs);
      console.log('JobStoreScreen: Loaded', fetchedJobs.length, 'jobs');
    } catch (error) {
      console.error('JobStoreScreen: Error loading jobs:', error);
    }
  }, []);

  useEffect(() => {
    console.log('JobStoreScreen: Initial load');
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    console.log('JobStoreScreen: Applying filters and search');
    applyFiltersAndSearch();
  }, [allJobs, searchQuery, filterType, sortType, vhcFilter]);

  const applyFiltersAndSearch = () => {
    let jobs = [...allJobs];

    // Apply date filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (filterType === 'today') {
      jobs = jobs.filter(job => new Date(job.createdAt) >= todayStart);
    } else if (filterType === 'week') {
      jobs = jobs.filter(job => new Date(job.createdAt) >= weekStart);
    } else if (filterType === 'month') {
      jobs = jobs.filter(job => new Date(job.createdAt) >= monthStart);
    }

    // Apply VHC filter
    if (vhcFilter !== 'all') {
      jobs = jobs.filter(job => job.vhcStatus === vhcFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      jobs = jobs.filter(job => 
        job.wipNumber.toLowerCase().includes(query) ||
        job.vehicleReg.toLowerCase().includes(query) ||
        (job.notes && job.notes.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    jobs.sort((a, b) => {
      switch (sortType) {
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'aw-desc':
          return b.aw - a.aw;
        case 'aw-asc':
          return a.aw - b.aw;
        case 'wip-asc':
          return a.wipNumber.localeCompare(b.wipNumber);
        case 'wip-desc':
          return b.wipNumber.localeCompare(a.wipNumber);
        default:
          return 0;
      }
    });

    setFilteredJobs(jobs);
    console.log('JobStoreScreen: Filtered to', jobs.length, 'jobs');
  };

  const onRefresh = async () => {
    console.log('JobStoreScreen: User refreshing jobs list');
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const clearFilters = () => {
    console.log('JobStoreScreen: Clearing all filters');
    setSearchQuery('');
    setFilterType('all');
    setSortType('date-desc');
    setVhcFilter('all');
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
    const totalAw = filteredJobs.reduce((sum, job) => sum + job.aw, 0);
    const totalMinutes = totalAw * 5;
    return {
      count: filteredJobs.length,
      totalAw,
      totalTime: formatTime(totalMinutes),
      totalHours: formatDecimalHours(totalMinutes),
    };
  };

  const totals = calculateTotals();

  const getFilterLabel = () => {
    switch (filterType) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'custom': return 'Custom';
      default: return 'All Time';
    }
  };

  const getSortLabel = () => {
    switch (sortType) {
      case 'date-desc': return 'Newest First';
      case 'date-asc': return 'Oldest First';
      case 'aw-desc': return 'Highest AW';
      case 'aw-asc': return 'Lowest AW';
      case 'wip-asc': return 'WIP A-Z';
      case 'wip-desc': return 'WIP Z-A';
      default: return 'Sort';
    }
  };

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);
    const date = new Date(item.createdAt);
    const vhcColor = getVhcColor(item.vhcStatus || 'NONE');
    const timeDisplay = formatTime(minutes);
    const hoursDisplay = formatDecimalHours(minutes);

    return (
      <View style={[styles.jobCard, { backgroundColor: theme.card }]}>
        {item.vhcStatus && item.vhcStatus !== 'NONE' && (
          <View style={[styles.vhcStrip, { backgroundColor: vhcColor }]} />
        )}
        
        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <View style={styles.jobInfo}>
              <Text style={[styles.wipNumber, { color: theme.primary }]}>
                {item.wipNumber}
              </Text>
              {item.vhcStatus && item.vhcStatus !== 'NONE' && (
                <View style={[styles.vhcBadge, { backgroundColor: vhcColor }]}>
                  <Text style={styles.vhcText}>{item.vhcStatus}</Text>
                </View>
              )}
            </View>
            <View style={styles.awBadge}>
              <Text style={[styles.awValue, { color: theme.primary }]}>{item.aw}</Text>
              <Text style={[styles.awLabel, { color: theme.textSecondary }]}>AW</Text>
            </View>
          </View>

          <View style={styles.jobDetails}>
            <View style={styles.detailRow}>
              <IconSymbol
                ios_icon_name="car"
                android_material_icon_name="directions-car"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.text }]}>{item.vehicleReg}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="access-time"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.text }]}>{timeDisplay}</Text>
              <Text style={[styles.detailSubtext, { color: theme.textSecondary }]}>
                ({hoursDisplay}h)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.text }]}>
                {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={[styles.detailSubtext, { color: theme.textSecondary }]}>
                {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          {item.notes && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesText, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>
      </View>
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
            <Text style={[styles.title, { color: '#ffffff' }]}>Job Store</Text>
            <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
              Search & Reference
            </Text>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={20}
              color={theme.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search WIP, Reg, or Notes..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.card }]}
              onPress={() => setShowFilterModal(true)}
            >
              <IconSymbol
                ios_icon_name="line.3.horizontal.decrease.circle"
                android_material_icon_name="filter-list"
                size={18}
                color={theme.primary}
              />
              <Text style={[styles.filterButtonText, { color: theme.text }]}>
                {getFilterLabel()}
              </Text>
              {(filterType !== 'all' || vhcFilter !== 'all') && (
                <View style={[styles.filterDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.card }]}
              onPress={() => setShowSortModal(true)}
            >
              <IconSymbol
                ios_icon_name="arrow.up.arrow.down"
                android_material_icon_name="sort"
                size={18}
                color={theme.primary}
              />
              <Text style={[styles.filterButtonText, { color: theme.text }]}>
                {getSortLabel()}
              </Text>
            </TouchableOpacity>

            {(searchQuery || filterType !== 'all' || vhcFilter !== 'all' || sortType !== 'date-desc') && (
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.error }]}
                onPress={clearFilters}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={16}
                  color="#ffffff"
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.totalsBar, { backgroundColor: theme.card }]}>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.count}</Text>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Jobs</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.totalAw}</Text>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>AWs</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: theme.primary }]}>{totals.totalHours}</Text>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Hours</Text>
            </View>
          </View>

          <FlatList
            data={filteredJobs}
            renderItem={renderJob}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <IconSymbol
                  ios_icon_name="magnifyingglass"
                  android_material_icon_name="search"
                  size={64}
                  color={theme.textSecondary}
                />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {searchQuery ? 'No jobs match your search' : 'No jobs found'}
                </Text>
                {(searchQuery || filterType !== 'all' || vhcFilter !== 'all') && (
                  <TouchableOpacity
                    style={[styles.clearFiltersButton, { backgroundColor: theme.primary }]}
                    onPress={clearFilters}
                  >
                    <Text style={styles.clearFiltersText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </View>

        {/* Filter Modal */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Jobs</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Date Range</Text>
                {(['all', 'today', 'week', 'month'] as FilterType[]).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.optionButton,
                      { backgroundColor: filterType === filter ? theme.primary : theme.background },
                    ]}
                    onPress={() => {
                      setFilterType(filter);
                      setShowFilterModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: filterType === filter ? '#ffffff' : theme.text },
                      ]}
                    >
                      {filter === 'all' ? 'All Time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
                    </Text>
                    {filterType === filter && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                ))}

                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>VHC Status</Text>
                {(['all', 'NONE', 'GREEN', 'ORANGE', 'RED'] as const).map((vhc) => (
                  <TouchableOpacity
                    key={vhc}
                    style={[
                      styles.optionButton,
                      { backgroundColor: vhcFilter === vhc ? (vhc === 'all' ? theme.primary : getVhcColor(vhc)) : theme.background },
                    ]}
                    onPress={() => {
                      setVhcFilter(vhc);
                      setShowFilterModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: vhcFilter === vhc ? '#ffffff' : theme.text },
                      ]}
                    >
                      {vhc === 'all' ? 'All VHC' : vhc === 'NONE' ? 'No VHC' : vhc}
                    </Text>
                    {vhcFilter === vhc && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* Sort Modal */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSortModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Sort Jobs</Text>
                <TouchableOpacity onPress={() => setShowSortModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                {([
                  { value: 'date-desc', label: 'Newest First' },
                  { value: 'date-asc', label: 'Oldest First' },
                  { value: 'aw-desc', label: 'Highest AW First' },
                  { value: 'aw-asc', label: 'Lowest AW First' },
                  { value: 'wip-asc', label: 'WIP Number (A-Z)' },
                  { value: 'wip-desc', label: 'WIP Number (Z-A)' },
                ] as { value: SortType; label: string }[]).map((sort) => (
                  <TouchableOpacity
                    key={sort.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: sortType === sort.value ? theme.primary : theme.background },
                    ]}
                    onPress={() => {
                      setSortType(sort.value);
                      setShowSortModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: sortType === sort.value ? '#ffffff' : theme.text },
                      ]}
                    >
                      {sort.label}
                    </Text>
                    {sortType === sort.value && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                ))}
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
    padding: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
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
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  totalDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    alignItems: 'center',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
    fontSize: 10,
    fontWeight: '600',
  },
  awBadge: {
    alignItems: 'center',
  },
  awValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  awLabel: {
    fontSize: 10,
  },
  jobDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailSubtext: {
    fontSize: 12,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
