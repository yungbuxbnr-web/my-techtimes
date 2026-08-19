
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { searchHistoryStorage } from '@/utils/moduleStorage';

type ActiveFilter = 'all' | 'open' | 'billed' | 'today' | 'month';

const COMMAND_SHORTCUTS: { label: string; filter: ActiveFilter; description: string }[] = [
  { label: 'open jobs', filter: 'open', description: 'Show all open/unbilled jobs' },
  { label: 'billed jobs', filter: 'billed', description: 'Show all billed jobs' },
  { label: 'jobs today', filter: 'today', description: 'Show jobs from today' },
  { label: 'jobs this month', filter: 'month', description: 'Show jobs from this month' },
];

function normaliseReg(reg: string): string {
  return (reg || '').toUpperCase().replace(/\s+/g, '');
}

function isToday(dateStr: string): boolean {
  return dateStr.split('T')[0] === new Date().toISOString().split('T')[0];
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function SmartSearchScreen() {
  console.log('SmartSearchScreen: Rendering');
  const { theme } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  useEffect(() => {
    console.log('SmartSearchScreen: Loading data');
    Promise.all([
      api.getAllJobs(),
      billingStorage.getAllRecords(),
      searchHistoryStorage.getRecent(),
    ]).then(([jobs, billing, history]) => {
      console.log('SmartSearchScreen: Loaded', jobs.length, 'jobs,', billing.length, 'billing records,', history.length, 'history items');
      setAllJobs(jobs);
      setBillingRecords(billing);
      setSearchHistory(history);
      setLoading(false);
    });
    // Auto-focus
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const billingByJobId = useMemo(() => {
    const m = new Map<string, BillingRecord>();
    billingRecords.forEach(r => m.set(r.jobId, r));
    return m;
  }, [billingRecords]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      console.log('SmartSearchScreen: Debounced search for', text);
      setDebouncedQuery(text);
    }, 300);
  };

  const handleSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    console.log('SmartSearchScreen: Search submitted', q);
    await searchHistoryStorage.add(q);
    const updated = await searchHistoryStorage.getRecent();
    setSearchHistory(updated);
    setDebouncedQuery(q);
  }, [query]);

  const handleClearHistory = async () => {
    console.log('SmartSearchScreen: Clear search history');
    await searchHistoryStorage.clear();
    setSearchHistory([]);
  };

  const handleHistoryItem = (item: string) => {
    console.log('SmartSearchScreen: History item selected', item);
    setQuery(item);
    setDebouncedQuery(item);
  };

  const handleFilterChip = (filter: ActiveFilter) => {
    console.log('SmartSearchScreen: Filter chip pressed', filter);
    setActiveFilter(prev => (prev === filter ? 'all' : filter));
  };

  const handleShortcut = (shortcut: typeof COMMAND_SHORTCUTS[0]) => {
    console.log('SmartSearchScreen: Shortcut pressed', shortcut.label);
    setActiveFilter(shortcut.filter);
    setQuery(shortcut.label);
    setDebouncedQuery(shortcut.label);
  };

  const filteredJobs = useMemo(() => {
    let jobs = allJobs;

    // Apply filter
    if (activeFilter === 'open') {
      jobs = jobs.filter(j => {
        const br = billingByJobId.get(j.id);
        return !br || br.billingStatus !== 'billed';
      });
    } else if (activeFilter === 'billed') {
      jobs = jobs.filter(j => {
        const br = billingByJobId.get(j.id);
        return br?.billingStatus === 'billed';
      });
    } else if (activeFilter === 'today') {
      jobs = jobs.filter(j => isToday(j.createdAt));
    } else if (activeFilter === 'month') {
      jobs = jobs.filter(j => isThisMonth(j.createdAt));
    }

    // Apply text search
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || COMMAND_SHORTCUTS.some(s => s.label === q)) return jobs;

    return jobs.filter(
      j =>
        j.wipNumber.toLowerCase().includes(q) ||
        normaliseReg(j.vehicleReg).includes(normaliseReg(q)) ||
        (j.notes || '').toLowerCase().includes(q)
    );
  }, [allJobs, billingByJobId, debouncedQuery, activeFilter]);

  const vehicleResults = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q || activeFilter !== 'all') return [];
    const normQ = normaliseReg(q);
    if (!normQ) return [];
    const regs = new Set<string>();
    allJobs.forEach(j => {
      const norm = normaliseReg(j.vehicleReg);
      if (norm && norm.includes(normQ)) regs.add(j.vehicleReg);
    });
    return Array.from(regs).slice(0, 10);
  }, [allJobs, debouncedQuery, activeFilter]);

  const showResults = debouncedQuery.trim().length > 0 || activeFilter !== 'all';
  const showHistory = !showResults && searchHistory.length > 0;
  const showShortcuts = !showResults;

  const filterChips: { filter: ActiveFilter; label: string }[] = [
    { filter: 'open', label: 'Open' },
    { filter: 'billed', label: 'Billed' },
    { filter: 'today', label: 'Today' },
    { filter: 'month', label: 'This Month' },
  ];

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('SmartSearchScreen: Back button pressed');
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
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={18}
            color={theme.textSecondary}
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search jobs, vehicles, WIP..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => {
                console.log('SmartSearchScreen: Search cleared');
                setQuery('');
                setDebouncedQuery('');
                setActiveFilter('all');
              }}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {filterChips.map(chip => {
          const isActive = activeFilter === chip.filter;
          return (
            <TouchableOpacity
              key={chip.filter}
              style={[
                styles.chip,
                { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleFilterChip(chip.filter)}
            >
              <Text style={[styles.chipText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Shortcuts */}
        {showShortcuts ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>QUICK COMMANDS</Text>
            {COMMAND_SHORTCUTS.map(s => (
              <TouchableOpacity
                key={s.label}
                style={[styles.shortcutRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleShortcut(s)}
              >
                <IconSymbol
                  ios_icon_name="bolt"
                  android_material_icon_name="flash-on"
                  size={16}
                  color={theme.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shortcutLabel, { color: theme.text }]}>{s.label}</Text>
                  <Text style={[styles.shortcutDesc, { color: theme.textSecondary }]}>{s.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {/* History */}
        {showHistory ? (
          <>
            <View style={styles.historyHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>RECENT SEARCHES</Text>
              <TouchableOpacity onPress={handleClearHistory}>
                <Text style={[styles.clearText, { color: theme.chartRed }]}>Clear</Text>
              </TouchableOpacity>
            </View>
            {searchHistory.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.historyRow, { borderBottomColor: theme.border }]}
                onPress={() => handleHistoryItem(item)}
              >
                <IconSymbol
                  ios_icon_name="clock"
                  android_material_icon_name="history"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text style={[styles.historyText, { color: theme.text }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {/* Results */}
        {showResults ? (
          <>
            {/* Vehicle results */}
            {vehicleResults.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>VEHICLES</Text>
                {vehicleResults.map(reg => (
                  <TouchableOpacity
                    key={reg}
                    style={[styles.resultRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                      console.log('SmartSearchScreen: Vehicle result tapped', reg);
                      router.push({ pathname: '/vehicle-history', params: { reg } });
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="car"
                      android_material_icon_name="directions-car"
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={[styles.resultPrimary, { color: theme.primary }]}>{reg}</Text>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={14}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {/* Job results */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              JOBS ({filteredJobs.length})
            </Text>
            {filteredJobs.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {loading ? 'Loading...' : 'No jobs found'}
                </Text>
              </View>
            ) : (
              filteredJobs.slice(0, 50).map(j => {
                const br = billingByJobId.get(j.id);
                const isBilled = br?.billingStatus === 'billed';
                const jobDate = j.createdAt.split('T')[0];
                const chipLabel = isBilled ? 'Billed' : 'Open';
                const chipColor = isBilled ? theme.chartGreen : theme.chartRed;
                const jobHours = ((j.aw * 5) / 60).toFixed(2);
                return (
                  <TouchableOpacity
                    key={j.id}
                    style={[styles.jobRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                      console.log('SmartSearchScreen: Job result tapped', j.wipNumber, j.vehicleReg);
                      router.push({
                        pathname: '/add-job-modal',
                        params: {
                          editId: j.id,
                          editWipNumber: j.wipNumber,
                          editVehicleReg: j.vehicleReg,
                          editAw: String(j.aw),
                          editNotes: j.notes || '',
                          editVhcStatus: j.vhcStatus,
                          editCreatedAt: j.createdAt,
                          editImageUri: j.imageUri || '',
                        },
                      });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jobWip, { color: theme.text }]}>WIP {j.wipNumber}</Text>
                      <Text style={[styles.jobMeta, { color: theme.textSecondary }]}>
                        {j.vehicleReg} · {jobDate}
                      </Text>
                      {j.notes ? (
                        <Text style={[styles.jobNotes, { color: theme.textSecondary }]} numberOfLines={1}>
                          {j.notes}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.jobRight}>
                      <Text style={[styles.jobHours, { color: theme.primary }]}>{jobHours}h</Text>
                      <View style={[styles.statusChip, { backgroundColor: chipColor }]}>
                        <Text style={styles.statusChipText}>{chipLabel}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  chipsRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  shortcutLabel: { fontSize: 14, fontWeight: '600' },
  shortcutDesc: { fontSize: 12 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 12,
  },
  clearText: { fontSize: 13, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  historyText: { fontSize: 15 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  resultPrimary: { flex: 1, fontSize: 16, fontWeight: '700' },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  jobWip: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  jobMeta: { fontSize: 12 },
  jobNotes: { fontSize: 12, marginTop: 2 },
  jobRight: { alignItems: 'flex-end', gap: 6 },
  jobHours: { fontSize: 14, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 15 },
});
