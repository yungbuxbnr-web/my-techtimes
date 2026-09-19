
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { offlineStorage } from '@/utils/offlineStorage';
import { billingStorage } from '@/utils/billingStorage';
import { groupJobsByWip, WipSummary, normalizeWip } from '@/utils/wipEngine';
import { normalizeReg } from '@/utils/comebackDetection';
import { wipBlockerStorage, WipBlocker, BLOCKER_REASON_LABELS } from '@/utils/wipBlockerStorage';
import { awToHours } from '@/utils/billingEngine';
import { Job } from '@/utils/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function daysBetween(isoA: string, isoB: string): number {
  if (!isoA || !isoB) return 0;
  const diff = Math.abs(new Date(isoB).getTime() - new Date(isoA).getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysSince(iso: string): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Vehicle group type ────────────────────────────────────────────────────────

interface VehicleGroup {
  normalizedReg: string;
  displayReg: string;
  totalSessions: number;
  uniqueWips: number;
  firstSeen: string;
  lastSeen: string;
  lastWip: string;
  totalHours: number;
  daysBetweenFirstLast: number;
}

// ── Summary bar ───────────────────────────────────────────────────────────────

interface SummaryBarProps {
  multiVisitWips: number;
  returningVehicles: number;
  openMultiVisitWips: number;
  visitsThisMonth: number;
  theme: any;
}

function SummaryBar({ multiVisitWips, returningVehicles, openMultiVisitWips, visitsThisMonth, theme }: SummaryBarProps) {
  return (
    <View style={[summaryStyles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: theme.primary }]}>{multiVisitWips}</Text>
        <Text style={[summaryStyles.label, { color: theme.textSecondary }]}>Multi-Visit WIPs</Text>
      </View>
      <View style={[summaryStyles.divider, { backgroundColor: theme.border }]} />
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: '#4fc3f7' }]}>{returningVehicles}</Text>
        <Text style={[summaryStyles.label, { color: theme.textSecondary }]}>Returning Vehicles</Text>
      </View>
      <View style={[summaryStyles.divider, { backgroundColor: theme.border }]} />
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: '#ff9800' }]}>{openMultiVisitWips}</Text>
        <Text style={[summaryStyles.label, { color: theme.textSecondary }]}>Open Multi-Visit</Text>
      </View>
      <View style={[summaryStyles.divider, { backgroundColor: theme.border }]} />
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: '#4caf50' }]}>{visitsThisMonth}</Text>
        <Text style={[summaryStyles.label, { color: theme.textSecondary }]}>Visits This Month</Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  divider: {
    width: 1,
    marginVertical: 4,
  },
});

// ── WIP Card ──────────────────────────────────────────────────────────────────

interface WipCardProps {
  summary: WipSummary;
  blocker: WipBlocker | null;
  theme: any;
  onPress: () => void;
}

function WipCard({ summary, blocker, theme, onPress }: WipCardProps) {
  const sessionCount = summary.sessionCount;
  const totalHoursDisplay = formatHours(summary.totalHours);
  const firstDate = formatShortDate(summary.firstWorked);
  const lastDate = formatShortDate(summary.lastWorked);
  const gapDays = daysBetween(summary.firstWorked, summary.lastWorked);
  const isReturnedQuick = gapDays <= 30 && sessionCount > 1;

  let statusBg = '#3a2a0a';
  let statusColor = '#ff9800';
  let statusLabel = 'OPEN';
  if (summary.status === 'billed') {
    statusBg = '#1a3a1a';
    statusColor = '#4caf50';
    statusLabel = 'INVOICED';
  } else if (summary.status === 'mixed') {
    statusBg = '#2a1a3a';
    statusColor = '#ce93d8';
    statusLabel = 'MIXED';
  }

  return (
    <TouchableOpacity
      style={[cardStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top row */}
      <View style={cardStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.wipNumber, { color: theme.text }]}>WIP {summary.displayWip}</Text>
          <Text style={[cardStyles.reg, { color: theme.textSecondary }]}>{summary.vehicleReg}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[cardStyles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[cardStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {sessionCount > 1 && (
            <View style={[cardStyles.visitBadge, { backgroundColor: theme.primary + '22' }]}>
              <Text style={[cardStyles.visitText, { color: theme.primary }]}>{sessionCount} VISITS</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats row */}
      <View style={cardStyles.statsRow}>
        <Text style={[cardStyles.stat, { color: theme.textSecondary }]}>AW: {summary.totalAW}</Text>
        <Text style={[cardStyles.stat, { color: theme.primary }]}>{totalHoursDisplay}</Text>
        <Text style={[cardStyles.stat, { color: theme.textSecondary }]}>{firstDate} → {lastDate}</Text>
      </View>

      {/* Badges row */}
      <View style={cardStyles.badgesRow}>
        {isReturnedQuick && (
          <View style={[cardStyles.badge, { backgroundColor: 'rgba(255,152,0,0.15)', borderColor: 'rgba(255,152,0,0.4)' }]}>
            <Text style={{ color: '#ff9800', fontSize: 9, fontWeight: '700' }}>RETURNED IN {gapDays}d</Text>
          </View>
        )}
        {blocker && (
          <View style={[cardStyles.badge, { backgroundColor: 'rgba(244,67,54,0.12)', borderColor: 'rgba(244,67,54,0.35)' }]}>
            <Text style={{ color: '#f44336', fontSize: 9, fontWeight: '700' }}>⏸ {BLOCKER_REASON_LABELS[blocker.reason]}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  wipNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  reg: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  visitBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visitText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  stat: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
});

// ── Vehicle Card ──────────────────────────────────────────────────────────────

interface VehicleCardProps {
  group: VehicleGroup;
  theme: any;
  onPress: () => void;
}

function VehicleCard({ group, theme, onPress }: VehicleCardProps) {
  const daysAgo = daysSince(group.lastSeen);
  const lastSeenLabel = daysAgo === 0 ? 'Last Seen Today' : `Last Seen ${daysAgo}d ago`;
  const totalHoursDisplay = formatHours(group.totalHours);
  const isReturnedQuick = group.daysBetweenFirstLast <= 30 && group.totalSessions > 1;

  return (
    <TouchableOpacity
      style={[cardStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={cardStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: theme.text }]}>{group.displayReg}</Text>
          <Text style={[{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }]}>Last WIP: {group.lastWip}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[cardStyles.visitBadge, { backgroundColor: theme.primary + '22' }]}>
            <Text style={[cardStyles.visitText, { color: theme.primary }]}>VISITS {group.totalSessions}</Text>
          </View>
          <View style={[cardStyles.visitBadge, { backgroundColor: '#4fc3f7' + '22' }]}>
            <Text style={[cardStyles.visitText, { color: '#4fc3f7' }]}>WIPS {group.uniqueWips}</Text>
          </View>
        </View>
      </View>
      <View style={cardStyles.statsRow}>
        <Text style={[cardStyles.stat, { color: daysAgo <= 7 ? '#4caf50' : theme.textSecondary }]}>{lastSeenLabel}</Text>
        <Text style={[cardStyles.stat, { color: theme.primary }]}>{totalHoursDisplay}</Text>
      </View>
      {isReturnedQuick && (
        <View style={cardStyles.badgesRow}>
          <View style={[cardStyles.badge, { backgroundColor: 'rgba(255,152,0,0.15)', borderColor: 'rgba(255,152,0,0.4)' }]}>
            <Text style={{ color: '#ff9800', fontSize: 9, fontWeight: '700' }}>RETURNED IN {group.daysBetweenFirstLast}d</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}

function FilterChip({ label, active, onPress, theme }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: active ? theme.primary : theme.card,
        borderWidth: 1,
        borderColor: active ? theme.primary : theme.border,
      }}
      activeOpacity={0.7}
    >
      <Text style={{ color: active ? '#fff' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type WipFilter = 'MULTI VISIT' | 'ALL' | 'OPEN' | 'CLOSED';
type WipSort = 'Most Visits' | 'Recently Seen' | 'Oldest Open' | 'Highest Hours';
type VehicleFilter = '2+ VISITS' | '3+ VISITS' | 'RECENT' | 'ALL';
type VehicleSort = 'Most Visits' | 'Recently Seen' | 'Most WIPs';
type TabView = 'WIP WORKSPACES' | 'RETURNING VEHICLES';

export default function WorkspacesScreen() {
  const { theme } = useThemeContext();
  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const [activeTab, setActiveTab] = useState<TabView>('WIP WORKSPACES');
  const [wipFilter, setWipFilter] = useState<WipFilter>('MULTI VISIT');
  const [wipSort, setWipSort] = useState<WipSort>('Most Visits');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('2+ VISITS');
  const [vehicleSort, setVehicleSort] = useState<VehicleSort>('Most Visits');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [wipMap, setWipMap] = useState<Map<string, WipSummary>>(new Map());
  const [blockers, setBlockers] = useState<Map<string, WipBlocker>>(new Map());

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    console.log('[Workspaces] Loading data');
    setLoading(true);
    try {
      const [jobs, billingRecords, allBlockers] = await Promise.all([
        offlineStorage.getAllJobs(),
        billingStorage.getAllRecords(),
        wipBlockerStorage.getAll(),
      ]);

      const map = groupJobsByWip(jobs, billingRecords);
      const blockerMap = new Map<string, WipBlocker>();
      allBlockers.forEach(b => {
        if (!b.clearedAt) blockerMap.set(b.normalizedWip, b);
      });

      setAllJobs(jobs);
      setWipMap(map);
      setBlockers(blockerMap);
      console.log('[Workspaces] Loaded — WIPs:', map.size, 'jobs:', jobs.length, 'blockers:', blockerMap.size);
    } catch (err) {
      console.error('[Workspaces] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('[Workspaces] Screen focused — reloading data');
      loadData();
    }, [loadData])
  );

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  };

  // ── WIP summaries derived ─────────────────────────────────────────────────

  const wipSummaries = useMemo(() => Array.from(wipMap.values()), [wipMap]);

  const filteredWips = useMemo(() => {
    let list = wipSummaries;

    // Filter
    if (wipFilter === 'MULTI VISIT') list = list.filter(s => s.sessionCount >= 2);
    else if (wipFilter === 'OPEN') list = list.filter(s => s.status === 'open' || s.status === 'mixed' || s.status === 'unknown');
    else if (wipFilter === 'CLOSED') list = list.filter(s => s.status === 'billed');

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toUpperCase();
      list = list.filter(s =>
        s.normalizedWip.includes(q) ||
        s.displayWip.includes(q) ||
        s.vehicleReg.toUpperCase().includes(q)
      );
    }

    // Sort
    if (wipSort === 'Most Visits') list = [...list].sort((a, b) => b.sessionCount - a.sessionCount);
    else if (wipSort === 'Recently Seen') list = [...list].sort((a, b) => new Date(b.lastWorked).getTime() - new Date(a.lastWorked).getTime());
    else if (wipSort === 'Oldest Open') {
      list = [...list]
        .filter(s => s.status !== 'billed')
        .sort((a, b) => new Date(a.firstWorked).getTime() - new Date(b.firstWorked).getTime())
        .concat(list.filter(s => s.status === 'billed'));
    }
    else if (wipSort === 'Highest Hours') list = [...list].sort((a, b) => b.totalHours - a.totalHours);

    return list;
  }, [wipSummaries, wipFilter, wipSort, debouncedSearch]);

  // ── Vehicle groups derived ────────────────────────────────────────────────

  const vehicleGroups = useMemo((): VehicleGroup[] => {
    const regMap = new Map<string, Job[]>();
    allJobs.forEach(job => {
      const nreg = normalizeReg(job.vehicleReg);
      if (!nreg) return;
      const existing = regMap.get(nreg) ?? [];
      existing.push(job);
      regMap.set(nreg, existing);
    });

    const groups: VehicleGroup[] = [];
    regMap.forEach((jobs, nreg) => {
      const sorted = [...jobs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const uniqueWips = new Set(sorted.map(j => normalizeWip(j.wipNumber))).size;
      const firstSeen = sorted[0]?.createdAt ?? '';
      const lastSeen = sorted[sorted.length - 1]?.createdAt ?? '';
      const lastWip = sorted[sorted.length - 1]?.wipNumber ?? '';
      const totalHours = sorted.reduce((s, j) => s + awToHours(j.aw ?? 0), 0);
      const gapDays = daysBetween(firstSeen, lastSeen);

      groups.push({
        normalizedReg: nreg,
        displayReg: sorted[0]?.vehicleReg?.toUpperCase() ?? nreg,
        totalSessions: sorted.length,
        uniqueWips,
        firstSeen,
        lastSeen,
        lastWip,
        totalHours,
        daysBetweenFirstLast: gapDays,
      });
    });

    return groups;
  }, [allJobs]);

  const filteredVehicles = useMemo(() => {
    let list = vehicleGroups;

    if (vehicleFilter === '2+ VISITS') list = list.filter(g => g.totalSessions >= 2 || g.uniqueWips >= 2);
    else if (vehicleFilter === '3+ VISITS') list = list.filter(g => g.totalSessions >= 3);
    else if (vehicleFilter === 'RECENT') list = list.filter(g => daysSince(g.lastSeen) <= 30);

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toUpperCase();
      list = list.filter(g => g.normalizedReg.includes(q) || g.displayReg.includes(q));
    }

    if (vehicleSort === 'Most Visits') list = [...list].sort((a, b) => b.totalSessions - a.totalSessions);
    else if (vehicleSort === 'Recently Seen') list = [...list].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    else if (vehicleSort === 'Most WIPs') list = [...list].sort((a, b) => b.uniqueWips - a.uniqueWips);

    return list;
  }, [vehicleGroups, vehicleFilter, vehicleSort, debouncedSearch]);

  // ── Summary bar values ────────────────────────────────────────────────────

  const multiVisitWipCount = useMemo(() => wipSummaries.filter(s => s.sessionCount >= 2).length, [wipSummaries]);
  const returningVehicleCount = useMemo(() => vehicleGroups.filter(g => g.totalSessions >= 2 || g.uniqueWips >= 2).length, [vehicleGroups]);
  const openMultiVisitCount = useMemo(() => wipSummaries.filter(s => s.sessionCount >= 2 && s.status !== 'billed').length, [wipSummaries]);
  const visitsThisMonthCount = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return allJobs.filter(j => new Date(j.createdAt).getTime() >= monthStart).length;
  }, [allJobs]);

  // ── Sort options ──────────────────────────────────────────────────────────

  const wipSortOptions: WipSort[] = ['Most Visits', 'Recently Seen', 'Oldest Open', 'Highest Hours'];
  const vehicleSortOptions: VehicleSort[] = ['Most Visits', 'Recently Seen', 'Most WIPs'];

  return (
    <AppBackground>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: PT, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Workspaces</Text>
        <TouchableOpacity
          onPress={() => {
            console.log('[Workspaces] Refresh tapped');
            loadData();
          }}
          style={styles.refreshBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* SEGMENTED CONTROL */}
      <View style={[styles.segmentedControl, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {(['WIP WORKSPACES', 'RETURNING VEHICLES'] as TabView[]).map(tab => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                console.log('[Workspaces] Tab switched to:', tab);
                setActiveTab(tab);
                setSearchText('');
                setDebouncedSearch('');
              }}
              style={[
                styles.segmentBtn,
                isActive && { backgroundColor: theme.primary },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading workspaces…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* SUMMARY BAR */}
          <SummaryBar
            multiVisitWips={multiVisitWipCount}
            returningVehicles={returningVehicleCount}
            openMultiVisitWips={openMultiVisitCount}
            visitsThisMonth={visitsThisMonthCount}
            theme={theme}
          />

          {/* SEARCH BAR */}
          <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={searchText}
              onChangeText={handleSearchChange}
              placeholder={activeTab === 'WIP WORKSPACES' ? 'Search WIP or registration…' : 'Search registration…'}
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCapitalize="characters"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  console.log('[Workspaces] Search cleared');
                  setSearchText('');
                  setDebouncedSearch('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeTab === 'WIP WORKSPACES' ? (
            <>
              {/* WIP FILTER CHIPS */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {(['MULTI VISIT', 'ALL', 'OPEN', 'CLOSED'] as WipFilter[]).map(f => (
                  <FilterChip
                    key={f}
                    label={f}
                    active={wipFilter === f}
                    onPress={() => {
                      console.log('[Workspaces] WIP filter changed to:', f);
                      setWipFilter(f);
                    }}
                    theme={theme}
                  />
                ))}
              </ScrollView>

              {/* WIP SORT */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {wipSortOptions.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      console.log('[Workspaces] WIP sort changed to:', s);
                      setWipSort(s);
                    }}
                    style={[
                      styles.sortChip,
                      { borderColor: wipSort === s ? theme.primary : theme.border },
                      wipSort === s && { backgroundColor: theme.primary + '22' },
                    ]}
                  >
                    <Text style={{ color: wipSort === s ? theme.primary : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* WIP COUNT */}
              <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
                {filteredWips.length} WIP{filteredWips.length !== 1 ? 's' : ''}
              </Text>

              {/* WIP CARDS */}
              <View style={styles.cardList}>
                {filteredWips.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {debouncedSearch ? 'No WIPs match your search.' : 'No WIPs match this filter.'}
                    </Text>
                  </View>
                ) : (
                  filteredWips.map(summary => (
                    <WipCard
                      key={summary.normalizedWip}
                      summary={summary}
                      blocker={blockers.get(summary.normalizedWip) ?? null}
                      theme={theme}
                      onPress={() => {
                        console.log('[Workspaces] WIP card tapped — navigating to WIP workspace:', summary.normalizedWip);
                        router.push({ pathname: '/wip-workspace', params: { wip: summary.normalizedWip } } as any);
                      }}
                    />
                  ))
                )}
              </View>
            </>
          ) : (
            <>
              {/* VEHICLE FILTER CHIPS */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {(['2+ VISITS', '3+ VISITS', 'RECENT', 'ALL'] as VehicleFilter[]).map(f => (
                  <FilterChip
                    key={f}
                    label={f}
                    active={vehicleFilter === f}
                    onPress={() => {
                      console.log('[Workspaces] Vehicle filter changed to:', f);
                      setVehicleFilter(f);
                    }}
                    theme={theme}
                  />
                ))}
              </ScrollView>

              {/* VEHICLE SORT */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {vehicleSortOptions.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      console.log('[Workspaces] Vehicle sort changed to:', s);
                      setVehicleSort(s);
                    }}
                    style={[
                      styles.sortChip,
                      { borderColor: vehicleSort === s ? theme.primary : theme.border },
                      vehicleSort === s && { backgroundColor: theme.primary + '22' },
                    ]}
                  >
                    <Text style={{ color: vehicleSort === s ? theme.primary : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* VEHICLE COUNT */}
              <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
                {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''}
              </Text>

              {/* VEHICLE CARDS */}
              <View style={styles.cardList}>
                {filteredVehicles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {debouncedSearch ? 'No vehicles match your search.' : 'No vehicles match this filter.'}
                    </Text>
                  </View>
                ) : (
                  filteredVehicles.map(group => (
                    <VehicleCard
                      key={group.normalizedReg}
                      group={group}
                      theme={theme}
                      onPress={() => {
                        console.log('[Workspaces] Vehicle card tapped — navigating to vehicle history:', group.normalizedReg);
                        router.push({ pathname: '/vehicle-history', params: { reg: group.normalizedReg } } as any);
                      }}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  refreshBtn: {
    padding: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterRow: {
    marginBottom: 8,
  },
  sortRow: {
    marginBottom: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  cardList: {
    paddingHorizontal: 16,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 120,
  },
});
