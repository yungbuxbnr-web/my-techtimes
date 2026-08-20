
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';
import { normaliseBillingStatus } from '@/utils/billingEngine';
import AppBackground from '@/components/AppBackground';
import * as Haptics from 'expo-haptics';

const safeHaptics = {
  impactAsync: async (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'web') return;
    try { await Haptics.impactAsync(style); } catch {}
  },
  selectionAsync: async () => {
    if (Platform.OS === 'web') return;
    try { await Haptics.selectionAsync(); } catch {}
  },
};

type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'entire';
type TabKey = 'all' | 'open' | 'ready' | 'billed' | 'legacy';
type SubTab = 'overview' | 'records' | 'trends' | 'reports' | 'backup';

// ── Period boundary helpers ──────────────────────────────────────────────────

function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}

function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYearBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function getPeriodBounds(mode: PeriodMode, date: Date): { start: Date; end: Date } | null {
  switch (mode) {
    case 'day': return getDayBounds(date);
    case 'week': return getWeekBounds(date);
    case 'month': return getMonthBounds(date);
    case 'year': return getYearBounds(date);
    case 'entire': return null;
  }
}

function navigatePeriod(mode: PeriodMode, date: Date, direction: -1 | 1): Date {
  const d = new Date(date);
  switch (mode) {
    case 'day':
      d.setDate(d.getDate() + direction);
      break;
    case 'week':
      d.setDate(d.getDate() + direction * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() + direction);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + direction);
      break;
    case 'entire':
      break;
  }
  return d;
}

function getPeriodLabel(mode: PeriodMode, date: Date): string {
  switch (mode) {
    case 'day': {
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return isToday ? `Today — ${label}` : label;
    }
    case 'week': {
      const { start, end } = getWeekBounds(date);
      const s = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const e = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${s} – ${e}`;
    }
    case 'month':
      return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    case 'year':
      return String(date.getFullYear());
    case 'entire':
      return 'Entire History';
  }
}

function getJobDateForViewBy(
  job: { createdAt: string },
  billing: { billedDate?: string; billedAt?: string },
  viewBy: 'work_date' | 'billing_date'
): Date {
  if (viewBy === 'billing_date' && billing.billedDate) {
    return new Date(billing.billedDate);
  }
  return new Date(job.createdAt);
}

// ── Status chip helper (outside component so BillingJobRow can use it) ───────

function getStatusChipStyle(billing: BillingRecord, theme: any) {
  const normalised = normaliseBillingStatus(billing.billingStatus);
  if (normalised === 'billed') {
    // Show 'Legacy' label for legacy_unknown, 'Billed' for everything else billed
    if (billing.billingStatus === 'legacy_unknown') {
      return { bg: theme.textSecondary, label: 'Legacy' };
    }
    return { bg: theme.chartGreen, label: 'Billed' };
  }
  // open statuses
  if (billing.billingStatus === 'ready_to_bill') {
    return { bg: theme.chartYellow, label: 'Ready' };
  }
  if (billing.workStatus === 'in_progress') {
    return { bg: theme.chartYellow, label: 'In Progress' };
  }
  return { bg: theme.chartRed, label: 'Open' };
}

// ── Swipeable job row component ───────────────────────────────────────────────

function BillingJobRow({
  job,
  billing,
  selectionMode,
  isSelected,
  onPress,
  onLongPress,
  onMarkBilled,
  onEdit,
  theme,
}: {
  job: Job;
  billing: BillingRecord;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMarkBilled: () => void;
  onEdit: () => void;
  theme: any;
}) {
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        translateX.setValue(Math.max(-100, Math.min(80, gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 60 && normaliseBillingStatus(billing.billingStatus) === 'open') {
          console.log('BillingScreen: Swipe right — mark billed for job:', job.wipNumber);
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          onMarkBilled();
        } else if (gs.dx < -60) {
          console.log('BillingScreen: Swipe left — reveal edit for job:', job.wipNumber);
          RNAnimated.spring(translateX, { toValue: -100, useNativeDriver: true }).start();
        } else {
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const chip = getStatusChipStyle(billing, theme);
  const hoursDisplay = ((job.aw * 5) / 60).toFixed(2);
  const dateDisplay = job.createdAt.split('T')[0];

  return (
    <View style={styles.swipeContainer}>
      {/* Background action — right (swipe right = bill) */}
      <View style={[styles.swipeActionsRight, { backgroundColor: theme.chartGreen }]}>
        <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={24} color="#fff" />
        <Text style={styles.swipeActionText}>Bill</Text>
      </View>
      {/* Background action — left (swipe left = edit) */}
      <View style={[styles.swipeActionsLeft, { backgroundColor: theme.primary }]}>
        <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={24} color="#fff" />
        <Text style={styles.swipeActionText}>Edit</Text>
      </View>
      <RNAnimated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[
            styles.jobRow,
            { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border },
            isSelected && { borderWidth: 2 },
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.75}
        >
          {selectionMode && (
            <View style={[
              styles.selectionCheckbox,
              { borderColor: theme.primary },
              isSelected && { backgroundColor: theme.primary },
            ]}>
              {isSelected && (
                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={12} color="#ffffff" />
              )}
            </View>
          )}
          <View style={styles.jobRowContent}>
            <View style={styles.jobRowTop}>
              <Text style={[styles.jobWip, { color: theme.primary }]}>{job.wipNumber}</Text>
              <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                <Text style={styles.statusChipText}>{chip.label}</Text>
              </View>
            </View>
            <View style={styles.jobRowMid}>
              <Text style={[styles.jobReg, { color: theme.text }]}>{job.vehicleReg}</Text>
              <Text style={[styles.jobAw, { color: theme.textSecondary }]}>{job.aw} AW</Text>
              <Text style={[styles.jobHours, { color: theme.primary }]}>{hoursDisplay}h</Text>
            </View>
            <Text style={[styles.jobDate, { color: theme.textSecondary }]}>{dateDisplay}</Text>
          </View>
          {!selectionMode && (
            <TouchableOpacity
              onPress={() => {
                console.log('BillingScreen: Edit chevron tapped for job:', job.wipNumber);
                onEdit();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </RNAnimated.View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const { theme } = useThemeContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewBy, setViewBy] = useState<'work_date' | 'billing_date'>('work_date');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subTab, setSubTab] = useState<SubTab>('overview');

  const loadData = useCallback(async () => {
    console.log('BillingScreen: Loading billing data');
    try {
      const allJobs = await api.getAllJobs();
      setJobs(allJobs);
      await billingStorage.ensureRecordsForJobs(
        allJobs.map(j => ({
          id: j.id,
          wipNumber: j.wipNumber,
          vehicleReg: j.vehicleReg,
          createdAt: j.createdAt,
          aw: j.aw,
        }))
      );
      const records = await billingStorage.getAllRecords();
      setBillingRecords(records);
      console.log('BillingScreen: Data loaded — jobs:', allJobs.length, 'records:', records.length);
    } catch (error) {
      console.error('BillingScreen: Error loading data:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    console.log('BillingScreen: Pull-to-refresh triggered');
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Period stats (computed from all period items before tab filter) ────────
  const periodStats = useMemo(() => {
    const recordsByJobId = new Map(billingRecords.map(r => [r.jobId, r]));
    const bounds = getPeriodBounds(periodMode, selectedDate);

    const allPeriodItems = jobs
      .map(job => ({ job, billing: recordsByJobId.get(job.id) }))
      .filter((item): item is { job: Job; billing: BillingRecord } => item.billing !== undefined)
      .filter(({ job, billing }) => {
        if (!bounds) return true;
        const d = getJobDateForViewBy(job, billing, viewBy);
        return d >= bounds.start && d <= bounds.end;
      });

    const recordedAW = allPeriodItems.reduce((s, { job }) => s + job.aw, 0);
    const recordedHours = (recordedAW * 5) / 60;

    const billedItems = allPeriodItems.filter(({ billing }) => normaliseBillingStatus(billing.billingStatus) === 'billed');
    const billedHours = billedItems.reduce((s, { billing }) => s + billing.billedHours, 0);

    const readyItems = allPeriodItems.filter(({ billing }) => billing.billingStatus === 'ready_to_bill');
    const readyHours = readyItems.reduce((s, { job }) => s + (job.aw * 5) / 60, 0);

    const openItems = allPeriodItems.filter(({ billing }) =>
      normaliseBillingStatus(billing.billingStatus) === 'open' && billing.billingStatus !== 'ready_to_bill'
    );
    const openHours = openItems.reduce((s, { job }) => s + (job.aw * 5) / 60, 0);

    const unbilledHours = readyHours + openHours;

    return {
      recordedAW,
      recordedHours,
      billedHours,
      readyHours,
      openHours,
      unbilledHours,
      jobsRecorded: allPeriodItems.length,
      jobsBilled: billedItems.length,
      jobsReady: readyItems.length,
      jobsOpen: openItems.length,
    };
  }, [jobs, billingRecords, periodMode, selectedDate, viewBy]);

  // ── Filtered items (period + tab + search) ────────────────────────────────
  const filteredItems = useMemo(() => {
    const recordsByJobId = new Map(billingRecords.map(r => [r.jobId, r]));
    const bounds = getPeriodBounds(periodMode, selectedDate);

    const items = jobs
      .map(job => ({ job, billing: recordsByJobId.get(job.id) }))
      .filter((item): item is { job: Job; billing: BillingRecord } => item.billing !== undefined);

    const periodItems = bounds
      ? items.filter(({ job, billing }) => {
          const d = getJobDateForViewBy(job, billing, viewBy);
          return d >= bounds.start && d <= bounds.end;
        })
      : items;

    let filtered = periodItems;
    if (activeTab === 'open') {
      // Show all open-normalised jobs (unbilled, open, in_progress, ready_to_bill)
      filtered = periodItems.filter(({ billing }) => normaliseBillingStatus(billing.billingStatus) === 'open');
    } else if (activeTab === 'ready') {
      filtered = periodItems.filter(({ billing }) => billing.billingStatus === 'ready_to_bill');
    } else if (activeTab === 'billed') {
      filtered = periodItems.filter(({ billing }) => normaliseBillingStatus(billing.billingStatus) === 'billed');
    } else if (activeTab === 'legacy') {
      // Legacy tab still shows legacy_unknown specifically for manual resolution
      filtered = periodItems.filter(({ billing }) => billing.billingStatus === 'legacy_unknown');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(({ job }) =>
        job.wipNumber.toLowerCase().includes(q) ||
        job.vehicleReg.toLowerCase().includes(q) ||
        (job.notes || '').toLowerCase().includes(q)
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime()
    );
  }, [jobs, billingRecords, activeTab, searchQuery, periodMode, selectedDate, viewBy]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleMarkWorkComplete = async (job: Job, billing: BillingRecord) => {
    console.log('BillingScreen: Marking work complete for job:', job.wipNumber);
    await billingStorage.updateRecord(billing.id, {
      workStatus: 'work_complete',
      billingStatus: 'ready_to_bill',
      workCompletedAt: new Date().toISOString(),
    });
    await billingStorage.addHistoryEntry({
      billingRecordId: billing.id,
      jobId: job.id,
      eventType: 'work_marked_complete',
      description: `Work marked complete — ${((job.aw * 5) / 60).toFixed(2)}h`,
    });
    await loadData();
  };

  const handleReturnToInProgress = async (job: Job, billing: BillingRecord) => {
    console.log('BillingScreen: Returning job to in-progress:', job.wipNumber);
    await billingStorage.updateRecord(billing.id, {
      workStatus: 'in_progress',
      billingStatus: 'unbilled',
    });
    await billingStorage.addHistoryEntry({
      billingRecordId: billing.id,
      jobId: job.id,
      eventType: 'returned_to_in_progress',
      description: 'Returned to In Progress',
    });
    await loadData();
  };

  const handleMarkBilled = (job: Job, billing: BillingRecord) => {
    const hoursDisplay = ((job.aw * 5) / 60).toFixed(2);
    console.log('BillingScreen: Mark billed tapped for job:', job.wipNumber);
    Alert.alert(
      'Mark Closed / Billed',
      `WIP: ${job.wipNumber}\nReg: ${job.vehicleReg}\nAW: ${job.aw}\nHours: ${hoursDisplay}h\n\nThis will create a billing snapshot. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Billed',
          style: 'default',
          onPress: async () => {
            console.log('BillingScreen: Confirmed mark billed for job:', job.wipNumber);
            const now = new Date().toISOString();
            await billingStorage.updateRecord(billing.id, {
              billingStatus: 'billed',
              billedAW: job.aw,
              billedHours: (job.aw * 5) / 60,
              billedAt: now,
              billedDate: now.split('T')[0],
            });
            await billingStorage.addHistoryEntry({
              billingRecordId: billing.id,
              jobId: job.id,
              eventType: 'marked_billed',
              description: `Marked Closed / Billed — ${hoursDisplay}h`,
              newAW: job.aw,
              newHours: (job.aw * 5) / 60,
            });
            await loadData();
          },
        },
      ]
    );
  };

  const handleReopenBilling = (job: Job, billing: BillingRecord) => {
    console.log('BillingScreen: Reopen billing tapped for job:', job.wipNumber);
    Alert.alert(
      'Reopen Billing',
      `Reopen billing for WIP ${job.wipNumber}? This will set it back to Ready to Bill.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: async () => {
            console.log('BillingScreen: Confirmed reopen billing for job:', job.wipNumber);
            await billingStorage.updateRecord(billing.id, {
              billingStatus: 'open',
              workStatus: 'open',
              billedAt: undefined,
              billedDate: undefined,
            });
            await billingStorage.addHistoryEntry({
              billingRecordId: billing.id,
              jobId: job.id,
              eventType: 'billing_reopened',
              description: 'Billing reopened',
            });
            await loadData();
          },
        },
      ]
    );
  };

  const handleLegacyAction = (job: Job, billing: BillingRecord) => {
    console.log('BillingScreen: Legacy action tapped for job:', job.wipNumber);
    Alert.alert(
      `Legacy Job — ${job.wipNumber}`,
      'Set billing status for this job:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Open',
          onPress: async () => {
            console.log('BillingScreen: Legacy job marked as Open:', job.wipNumber);
            await billingStorage.updateRecord(billing.id, {
              billingStatus: 'unbilled',
              workStatus: 'open',
            });
            await loadData();
          },
        },
        {
          text: 'Mark as Ready to Bill',
          onPress: async () => {
            console.log('BillingScreen: Legacy job marked as Ready to Bill:', job.wipNumber);
            await billingStorage.updateRecord(billing.id, {
              billingStatus: 'ready_to_bill',
              workStatus: 'work_complete',
            });
            await loadData();
          },
        },
        {
          text: 'Mark as Billed',
          onPress: async () => {
            console.log('BillingScreen: Legacy job marked as Billed:', job.wipNumber);
            const now = new Date().toISOString();
            await billingStorage.updateRecord(billing.id, {
              billingStatus: 'billed',
              billedAt: now,
              billedDate: now.split('T')[0],
            });
            await loadData();
          },
        },
      ]
    );
  };

  const handleJobAction = (job: Job, billing: BillingRecord) => {
    console.log('BillingScreen: Job action tapped for job:', job.wipNumber, 'status:', billing.billingStatus);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (billing.billingStatus === 'legacy_unknown') {
      handleLegacyAction(job, billing);
      return;
    }

    const normalised = normaliseBillingStatus(billing.billingStatus);

    if (normalised === 'billed') {
      Alert.alert(
        `Billed — ${job.wipNumber}`,
        `WIP: ${job.wipNumber}\nReg: ${job.vehicleReg}\nAW: ${billing.billedAW}\nHours: ${billing.billedHours.toFixed(2)}h\nBilled: ${billing.billedDate || 'Unknown'}`,
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Reopen Billing', onPress: () => handleReopenBilling(job, billing) },
        ]
      );
      return;
    }

    if (billing.billingStatus === 'ready_to_bill') {
      Alert.alert(
        `Ready to Bill — ${job.wipNumber}`,
        `WIP: ${job.wipNumber}\nReg: ${job.vehicleReg}\nAW: ${job.aw}\nHours: ${((job.aw * 5) / 60).toFixed(2)}h`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Return to In Progress', onPress: () => handleReturnToInProgress(job, billing) },
          { text: 'Mark Closed / Billed', onPress: () => handleMarkBilled(job, billing) },
        ]
      );
      return;
    }

    // open / unbilled / in_progress
    Alert.alert(
      `Open — ${job.wipNumber}`,
      `WIP: ${job.wipNumber}\nReg: ${job.vehicleReg}\nAW: ${job.aw}\nHours: ${((job.aw * 5) / 60).toFixed(2)}h`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit Job',
          onPress: () => {
            console.log('BillingScreen: Navigating to edit job:', job.id);
            router.push({
              pathname: '/add-job-modal',
              params: {
                editId: job.id,
                editWipNumber: job.wipNumber,
                editVehicleReg: job.vehicleReg,
                editAw: String(job.aw),
                editNotes: job.notes || '',
                editVhcStatus: job.vhcStatus,
                editCreatedAt: job.createdAt,
                editImageUri: job.imageUri || '',
              },
            });
          },
        },
        { text: 'Mark Closed / Billed', onPress: () => handleMarkBilled(job, billing) },
      ]
    );
  };

  const handleBulkMarkBilled = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    console.log('BillingScreen: Bulk mark billed tapped for', count, 'jobs');
    Alert.alert(
      'Mark Selected as Billed',
      `Mark ${count} job${count !== 1 ? 's' : ''} as Closed / Billed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Billed',
          onPress: async () => {
            console.log('BillingScreen: Confirmed bulk mark billed for', count, 'jobs');
            const now = new Date().toISOString();
            for (const billingId of selectedIds) {
              const billing = billingRecords.find(r => r.id === billingId);
              if (!billing) continue;
              const job = jobs.find(j => j.id === billing.jobId);
              if (!job) continue;
              await billingStorage.updateRecord(billingId, {
                billingStatus: 'billed',
                billedAW: job.aw,
                billedHours: (job.aw * 5) / 60,
                billedAt: now,
                billedDate: now.split('T')[0],
              });
              await billingStorage.addHistoryEntry({
                billingRecordId: billingId,
                jobId: job.id,
                eventType: 'marked_billed',
                description: `Bulk marked Closed / Billed — ${((job.aw * 5) / 60).toFixed(2)}h`,
                newAW: job.aw,
                newHours: (job.aw * 5) / 60,
              });
            }
            setSelectedIds(new Set());
            setSelectionMode(false);
            await loadData();
          },
        },
      ]
    );
  };

  const toggleSelection = (billingId: string) => {
    const next = new Set(selectedIds);
    if (next.has(billingId)) {
      next.delete(billingId);
    } else {
      next.add(billingId);
    }
    setSelectedIds(next);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const readyCount = periodStats.jobsReady;
  const unbilledHours = periodStats.unbilledHours;

  let healthStatus = 'All caught up';
  let healthColor = theme.chartGreen;
  if (readyCount > 0) { healthStatus = 'Jobs awaiting closure'; healthColor = theme.chartYellow; }
  if (unbilledHours > 10) { healthStatus = 'Attention — high unbilled hours'; healthColor = theme.chartRed; }

  const selectedBillingHours = useMemo(() => {
    let total = 0;
    for (const billingId of selectedIds) {
      const billing = billingRecords.find(r => r.id === billingId);
      if (!billing) continue;
      const job = jobs.find(j => j.id === billing.jobId);
      if (job) total += (job.aw * 5) / 60;
    }
    return total;
  }, [selectedIds, billingRecords, jobs]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'open', label: 'OPEN' },
    { key: 'ready', label: 'READY' },
    { key: 'billed', label: 'BILLED' },
    { key: 'legacy', label: 'LEGACY' },
  ];

  const periodLabel = getPeriodLabel(periodMode, selectedDate);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: { job: Job; billing: BillingRecord } }) => {
    const { job, billing } = item;
    return (
      <BillingJobRow
        job={job}
        billing={billing}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(billing.id)}
        theme={theme}
        onPress={() => {
          if (selectionMode) {
            console.log('BillingScreen: Selection toggled for billing id:', billing.id);
            toggleSelection(billing.id);
          } else {
            handleJobAction(job, billing);
          }
        }}
        onLongPress={() => {
          console.log('BillingScreen: Long press on job row — entering selection mode');
          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectionMode(true);
          setSelectedIds(new Set([billing.id]));
        }}
        onMarkBilled={() => handleMarkBilled(job, billing)}
        onEdit={() => router.push({
          pathname: '/add-job-modal',
          params: {
            editId: job.id,
            editWipNumber: job.wipNumber,
            editVehicleReg: job.vehicleReg,
            editAw: String(job.aw),
            editNotes: job.notes || '',
            editVhcStatus: job.vhcStatus,
            editCreatedAt: job.createdAt,
            editImageUri: job.imageUri || '',
          },
        })}
      />
    );
  };

  // ── Sub-tab labels ────────────────────────────────────────────────────────
  const subTabLabels: Record<SubTab, string> = {
    overview: 'Overview',
    records: 'Records',
    trends: 'Trends',
    reports: 'Reports',
    backup: 'Backup',
  };

  // ── Period selector block (shared between overview and records) ───────────
  const renderPeriodSelector = () => (
    <>
      {/* Period Mode Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodModeScroll}
        contentContainerStyle={styles.periodModeContent}
      >
        {(['day', 'week', 'month', 'year', 'entire'] as PeriodMode[]).map(mode => {
          const isActive = periodMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[
                styles.periodModeBtn,
                { borderColor: theme.border },
                isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => {
                console.log('BillingScreen: Period mode changed to:', mode);
                setPeriodMode(mode);
              }}
            >
              <Text style={[
                styles.periodModeBtnText,
                { color: isActive ? '#ffffff' : theme.textSecondary },
              ]}>
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Period Navigator */}
      {periodMode !== 'entire' ? (
        <View style={[styles.periodNav, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            onPress={() => {
              console.log('BillingScreen: Period navigate backward, mode:', periodMode);
              setSelectedDate(navigatePeriod(periodMode, selectedDate, -1));
            }}
            style={styles.periodNavBtn}
          >
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="chevron-left" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('BillingScreen: Period reset to today');
              setSelectedDate(new Date());
            }}
            style={styles.periodNavCenter}
          >
            <Text style={[styles.periodNavLabel, { color: theme.text }]}>
              {periodLabel}
            </Text>
            <Text style={[styles.periodNavToday, { color: theme.textSecondary }]}>Tap for today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('BillingScreen: Period navigate forward, mode:', periodMode);
              setSelectedDate(navigatePeriod(periodMode, selectedDate, 1));
            }}
            style={styles.periodNavBtn}
          >
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.periodNav, { backgroundColor: theme.card }]}>
          <Text style={[styles.periodNavLabel, { color: theme.text, textAlign: 'center', flex: 1 }]}>
            Entire History
          </Text>
        </View>
      )}

      {/* View By toggle */}
      <View style={[styles.viewByRow, { backgroundColor: theme.card }]}>
        <Text style={[styles.viewByLabel, { color: theme.textSecondary }]}>View by:</Text>
        <TouchableOpacity
          style={[
            styles.viewByBtn,
            viewBy === 'work_date' && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            console.log('BillingScreen: View by changed to work_date');
            setViewBy('work_date');
          }}
        >
          <Text style={[styles.viewByBtnText, { color: viewBy === 'work_date' ? '#ffffff' : theme.textSecondary }]}>
            Work Date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewByBtn,
            viewBy === 'billing_date' && { backgroundColor: theme.primary },
          ]}
          onPress={() => {
            console.log('BillingScreen: View by changed to billing_date');
            setViewBy('billing_date');
          }}
        >
          <Text style={[styles.viewByBtnText, { color: viewBy === 'billing_date' ? '#ffffff' : theme.textSecondary }]}>
            Billing Date
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Summary cards block ───────────────────────────────────────────────────
  const renderSummaryCards = () => (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryScroll}
        contentContainerStyle={styles.summaryScrollContent}
      >
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryValue, { color: theme.primary }]}>
            {periodStats.recordedHours.toFixed(1)}h
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Recorded</Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {periodStats.jobsRecorded} jobs
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryValue, { color: theme.chartGreen }]}>
            {periodStats.billedHours.toFixed(1)}h
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Billed</Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {periodStats.jobsBilled} jobs
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryValue, { color: theme.chartYellow }]}>
            {periodStats.readyHours.toFixed(1)}h
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Ready to Bill</Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {periodStats.jobsReady} jobs
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryValue, { color: theme.chartRed }]}>
            {periodStats.openHours.toFixed(1)}h
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Open Work</Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {periodStats.jobsOpen} jobs
          </Text>
        </View>
      </ScrollView>

      {/* Unbilled Banner */}
      <View style={[styles.unbilledBanner, { backgroundColor: theme.card }]}>
        <View style={styles.unbilledLeft}>
          <Text style={[styles.unbilledLabel, { color: theme.textSecondary }]}>Total Unbilled</Text>
          <Text style={[styles.unbilledValue, { color: theme.chartYellow }]}>
            {unbilledHours.toFixed(1)}h
          </Text>
        </View>
        <View style={[styles.healthBadge, { backgroundColor: healthColor + '22' }]}>
          <View style={[styles.healthDot, { backgroundColor: healthColor }]} />
          <Text style={[styles.healthText, { color: healthColor }]}>{healthStatus}</Text>
        </View>
      </View>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppBackground>
      <View style={[styles.container, Platform.OS === 'android' && { paddingTop: 48 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Billed & Open</Text>
          <View style={styles.headerActions}>
            {selectionMode ? (
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: theme.chartRed }]}
                onPress={() => {
                  console.log('BillingScreen: Exiting selection mode');
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
              >
                <Text style={styles.headerBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.headerBtn, { backgroundColor: theme.card }]}
                  onPress={() => {
                    console.log('BillingScreen: Search icon tapped, showSearch:', !showSearch);
                    setShowSearch(s => !s);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="magnifyingglass"
                    android_material_icon_name="search"
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerBtn, { backgroundColor: theme.card }]}
                  onPress={() => {
                    console.log('BillingScreen: Select button tapped');
                    setSelectionMode(true);
                  }}
                >
                  <Text style={[styles.headerBtnText, { color: theme.primary }]}>Select</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Sub-navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.subNavScroll, { borderBottomColor: theme.border }]}
          contentContainerStyle={styles.subNavContent}
        >
          {(['overview', 'records', 'trends', 'reports', 'backup'] as SubTab[]).map(tab => {
            const isActive = subTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.subNavTab,
                  isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 },
                ]}
                onPress={() => {
                  console.log('BillingScreen: Sub-tab pressed:', tab);
                  setSubTab(tab);
                  safeHaptics.selectionAsync();
                }}
              >
                <Text style={[styles.subNavTabText, { color: isActive ? theme.primary : theme.textSecondary }]}>
                  {subTabLabels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search bar (shown when search is active) */}
        {showSearch && (
          <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={18}
              color={theme.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={text => {
                console.log('BillingScreen: Search query changed:', text);
                setSearchQuery(text);
              }}
              placeholder="Search WIP, reg, notes..."
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                console.log('BillingScreen: Search cleared');
                setSearchQuery('');
              }}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── OVERVIEW sub-tab ─────────────────────────────────────────────── */}
        {subTab === 'overview' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.subTabContent}
          >
            {renderPeriodSelector()}
            {renderSummaryCards()}
          </ScrollView>
        )}

        {/* ── RECORDS sub-tab ──────────────────────────────────────────────── */}
        {subTab === 'records' && (
          <>
            {renderPeriodSelector()}

            {/* Tab Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabScrollContent}
            >
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tab,
                      { borderColor: theme.border },
                      isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('BillingScreen: Tab pressed:', tab.key);
                      setActiveTab(tab.key);
                    }}
                  >
                    <Text style={[styles.tabText, { color: isActive ? '#ffffff' : theme.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Job List */}
            <FlatList
              data={filteredItems}
              keyExtractor={item => item.billing.id}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
              }
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <IconSymbol
                    ios_icon_name="creditcard"
                    android_material_icon_name="receipt"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No jobs found for this filter
                  </Text>
                </View>
              }
            />
          </>
        )}

        {/* ── TRENDS sub-tab ───────────────────────────────────────────────── */}
        {subTab === 'trends' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.subTabContent}
          >
            <View style={[styles.placeholderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <IconSymbol
                ios_icon_name="chart.line.uptrend.xyaxis"
                android_material_icon_name="trending-up"
                size={48}
                color={theme.primary}
              />
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>Trends</Text>
              <Text style={[styles.placeholderSubtitle, { color: theme.textSecondary }]}>
                Billing trends and historical charts coming soon
              </Text>
            </View>
          </ScrollView>
        )}

        {/* ── REPORTS sub-tab ──────────────────────────────────────────────── */}
        {subTab === 'reports' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.subTabContent}
          >
            <View style={[styles.placeholderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <IconSymbol
                ios_icon_name="doc.text.fill"
                android_material_icon_name="description"
                size={48}
                color={theme.primary}
              />
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>Generate Report</Text>
              <Text style={[styles.placeholderSubtitle, { color: theme.textSecondary }]}>
                Create a billing summary report for any period
              </Text>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  console.log('BillingScreen: Generate billing report tapped');
                  Alert.alert(
                    'Generate Billing Report',
                    `Generate a billing report for ${periodLabel}?\n\nRecorded: ${periodStats.recordedHours.toFixed(1)}h\nBilled: ${periodStats.billedHours.toFixed(1)}h\nUnbilled: ${unbilledHours.toFixed(1)}h`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Generate',
                        onPress: () => {
                          console.log('BillingScreen: Billing report generation confirmed');
                          Alert.alert('Report Generated', 'Billing report feature coming soon.');
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.reportBtnText}>Generate Billing Report</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── BACKUP sub-tab ───────────────────────────────────────────────── */}
        {subTab === 'backup' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.subTabContent}
          >
            <View style={[styles.placeholderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <IconSymbol
                ios_icon_name="arrow.up.doc.fill"
                android_material_icon_name="backup"
                size={48}
                color={theme.primary}
              />
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>Backup Centre</Text>
              <Text style={[styles.placeholderSubtitle, { color: theme.textSecondary }]}>
                Export or restore your billing data
              </Text>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  console.log('BillingScreen: Export billing backup tapped');
                  Alert.alert('Export Backup', 'Billing backup export coming soon.');
                }}
              >
                <Text style={styles.reportBtnText}>Export Billing Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginTop: 8 }]}
                onPress={() => {
                  console.log('BillingScreen: Restore billing backup tapped');
                  Alert.alert('Restore Backup', 'Billing backup restore coming soon.');
                }}
              >
                <Text style={[styles.reportBtnText, { color: theme.text }]}>Restore Billing Backup</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* Bulk Action Bar */}
        {selectionMode && selectedIds.size > 0 && (
          <View style={[styles.bulkBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <View>
              <Text style={[styles.bulkCount, { color: theme.text }]}>
                {selectedIds.size} selected
              </Text>
              <Text style={[styles.bulkHours, { color: theme.textSecondary }]}>
                {selectedBillingHours.toFixed(2)}h
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: theme.chartGreen }]}
              onPress={handleBulkMarkBilled}
            >
              <Text style={styles.bulkBtnText}>Mark Selected as Billed</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  subNavScroll: {
    flexGrow: 0,
    borderBottomWidth: 0.5,
  },
  subNavContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  subNavTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  subNavTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subTabContent: {
    paddingBottom: 120,
  },
  periodModeScroll: {
    flexGrow: 0,
    marginBottom: 6,
    marginTop: 8,
  },
  periodModeContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  periodModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  periodModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  periodNavBtn: {
    padding: 8,
  },
  periodNavCenter: {
    flex: 1,
    alignItems: 'center',
  },
  periodNavLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  periodNavToday: {
    fontSize: 10,
    marginTop: 1,
  },
  viewByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  viewByLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  viewByBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewByBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  summaryScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  summaryScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 14,
    minWidth: 110,
    alignItems: 'center',
    elevation: 2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryCount: {
    fontSize: 11,
  },
  unbilledBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 2,
  },
  unbilledLeft: {
    gap: 2,
  },
  unbilledLabel: {
    fontSize: 12,
  },
  unbilledValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeActionsRight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionsLeft: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    elevation: 2,
    gap: 10,
  },
  selectionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobRowContent: {
    flex: 1,
  },
  jobRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobWip: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  jobRowMid: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 2,
  },
  jobReg: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobAw: {
    fontSize: 13,
  },
  jobHours: {
    fontSize: 13,
    fontWeight: '600',
  },
  jobDate: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    elevation: 8,
  },
  bulkCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  bulkHours: {
    fontSize: 13,
  },
  bulkBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bulkBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  placeholderCard: {
    margin: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  reportBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  reportBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
