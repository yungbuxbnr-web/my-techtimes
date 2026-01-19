
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime } from '@/utils/jobCalculations';
import { router } from 'expo-router';
import { api, Job } from '@/utils/api';

export default function JobsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('JobsScreen: Loading jobs');
    loadJobs();
  }, [filter]);

  useEffect(() => {
    filterJobs();
  }, [searchQuery, jobs]);

  const loadJobs = async () => {
    try {
      console.log('JobsScreen: Fetching jobs with filter:', filter);
      let fetchedJobs: Job[] = [];
      
      switch (filter) {
        case 'today':
          fetchedJobs = await api.getTodayJobs();
          break;
        case 'week':
          fetchedJobs = await api.getWeekJobs();
          break;
        case 'month':
          fetchedJobs = await api.getMonthJobs();
          break;
        default:
          fetchedJobs = await api.getAllJobs();
      }
      
      setJobs(fetchedJobs);
      setFilteredJobs(fetchedJobs);
      console.log('JobsScreen: Loaded', fetchedJobs.length, 'jobs');
    } catch (error) {
      console.error('JobsScreen: Error loading jobs:', error);
      Alert.alert('Error', 'Failed to load jobs');
    }
  };

  const filterJobs = () => {
    if (!searchQuery.trim()) {
      setFilteredJobs(jobs);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = jobs.filter(
      (job) =>
        job.wipNumber.toLowerCase().includes(query) ||
        job.vehicleReg.toLowerCase().includes(query)
    );
    setFilteredJobs(filtered);
  };

  const onRefresh = async () => {
    console.log('JobsScreen: User refreshing jobs list');
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
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
            console.log('JobsScreen: User confirmed delete job:', jobId);
            try {
              await api.deleteJob(jobId);
              await loadJobs();
            } catch (error) {
              console.error('JobsScreen: Error deleting job:', error);
              Alert.alert('Error', 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const renderJob = ({ item }: { item: Job }) => {
    const minutes = awToMinutes(item.aw);
    const date = new Date(item.createdAt);

    return (
      <TouchableOpacity
        style={[styles.jobCard, { backgroundColor: theme.card }]}
        onPress={() => {
          console.log('JobsScreen: User tapped job:', item.id);
        }}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <Text style={[styles.wipNumber, { color: theme.primary }]}>
              WIP: {item.wipNumber}
            </Text>
            <Text style={[styles.vehicleReg, { color: theme.text }]}>
              {item.vehicleReg}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteJob(item.id)}
            style={styles.deleteButton}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color={theme.error}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailItem}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="access-time"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              {item.aw} AW ({formatTime(minutes)})
            </Text>
          </View>
          <View style={styles.detailItem}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {item.notes && (
          <Text style={[styles.notes, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
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
            <View>
              <Text style={[styles.title, { color: '#ffffff' }]}>Jobs</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>
                {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
              </Text>
            </View>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={20}
              color={theme.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by WIP or Reg..."
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.filterContainer}>
            {(['all', 'today', 'week', 'month'] as const).map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  { backgroundColor: filter === filterOption ? theme.primary : theme.card },
                ]}
                onPress={() => {
                  console.log('JobsScreen: User selected filter:', filterOption);
                  setFilter(filterOption);
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: filter === filterOption ? '#ffffff' : theme.text },
                  ]}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredJobs}
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
                  No jobs found
                </Text>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    console.log('JobsScreen: User tapped Add First Job button');
                    router.push('/(tabs)/add-job');
                  }}
                >
                  <Text style={styles.addButtonText}>Add Your First Job</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
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
    fontSize: 16,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
  },
  wipNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vehicleReg: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  jobDetails: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
  },
  notes: {
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
