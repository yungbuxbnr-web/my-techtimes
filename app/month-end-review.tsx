
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { billingStorage } from '@/utils/billingStorage';
import { completeWip, normalizeWip } from '@/utils/wipEngine';
import {
  buildOpenWipList,
  getPendingReviewMonth,
  formatReviewMonth,
  monthEndReviewStorage,
  OpenWipItem,
  MonthEndReviewRecord,
} from '@/utils/monthEndReview';

type SortOption = 'oldest' | 'newest' | 'hours_desc' | 'aw_desc' | 'wip';
type FilterOption = 'all' | 'this_month' | 'carried' | 'attention';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MonthEndReviewScreen() {
  const { theme } = useThemeContext();

  const [loading, setLoading] = useState(true);
  const [wipList, setWipList] = useState<OpenWipItem[]>([]);
  const [reviewMonth, setReviewMonth] = useState<string>('');
  const [selectedWips, setSelectedWips] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>('oldest');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [processing, setProcessing] = useState(false);
  const [resultScreen, setResultScreen] = useState<{
    closed: number;
    carried: number;
    hoursClosed: number;
    hoursCarried: number;
    skipped: string[];
  } | null>(null);

  // Keep a ref to allJobs/allBillingRecords for completeWip
  const allJobsRef = useRef<any[]>([]);
  const allBillingRef = useRef<any[]>([]);

  const loadData = useCallback(async () => {
    console.log('MonthEndReview: Loading data');
    setLoading(true);
    try {
      const [allJobs, allBillingRecords] = await Promise.all([
        api.getAllJobs(),
        billingStorage.getAllRecords(),
      ]);
      allJobsRef.current = allJobs;
      allBillingRef.current = allBillingRecords;

      const pending = await getPendingReviewMonth();
      const month = pending ?? (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      })();
      setReviewMonth(month);

      const list = await buildOpenWipList(allJobs, allBillingRecords);
      setWipList(list);

      // Select all by default (preserve existing selection if already set)
      setSelectedWips(prev => {
        if (prev.size === 0) {
          return new Set(list.map(w => w.normalizedWip));
        }
        // Keep only wips that still exist
        const next = new Set<string>();
        for (const wip of prev) {
          if (list.some(w => w.normalizedWip === wip)) next.add(wip);
        }
        return next;
      });

      console.log('MonthEndReview: Loaded', list.length, 'open WIPs for month:', month);
    } catch (err) {
      console.error('MonthEndReview: Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Derived values ──────────────────────────────────────────────────────────

  const currentMonthStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const filteredList = wipList.filter(item => {
    switch (filter) {
      case 'this_month': {
        const firstMonth = item.firstWorked ? item.firstWorked.slice(0, 7) : '';
        return firstMonth === currentMonthStr;
      }
      case 'carried': {
        const firstMonth = item.firstWorked ? item.firstWorked.slice(0, 7) : '';
        return firstMonth < currentMonthStr;
      }
      case 'attention':
        return item.hasBillingAttention;
      default:
        return true;
    }
  });

  const sortedList = [...filteredList].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return new Date(b.firstWorked).getTime() - new Date(a.firstWorked).getTime();
      case 'hours_desc':
        return b.openHours - a.openHours;
      case 'aw_desc':
        return b.openAW - a.openAW;
      case 'wip':
        return a.displayWip.localeCompare(b.displayWip);
      default: // oldest
        return new Date(a.firstWorked).getTime() - new Date(b.firstWorked).getTime();
    }
  });

  const totalOpenWips = wipList.length;
  const totalOpenHours = wipList.reduce((s, w) => s + w.openHours, 0);
  const totalOpenAW = wipList.reduce((s, w) => s + w.openAW, 0);

  const selectedCount = selectedWips.size;
  const selectedHours = wipList
    .filter(w => selectedWips.has(w.normalizedWip))
    .reduce((s, w) => s + w.openHours, 0);
  const selectedAW = wipList
    .filter(w => selectedWips.has(w.normalizedWip))
    .reduce((s, w) => s + w.openAW, 0);
  const remainingCount = totalOpenWips - selectedCount;

  const monthLabel = reviewMonth ? formatReviewMonth(reviewMonth) : '';

  // ── Actions ─────────────────────────────────────────────────────────────────

  const toggleWip = (normalizedWip: string) => {
    console.log('MonthEndReview: Toggling WIP selection:', normalizedWip);
    setSelectedWips(prev => {
      const next = new Set(prev);
      if (next.has(normalizedWip)) {
        next.delete(normalizedWip);
      } else {
        next.add(normalizedWip);
      }
      return next;
    });
  };

  const selectAll = () => {
    console.log('MonthEndReview: Select All tapped');
    setSelectedWips(new Set(wipList.map(w => w.normalizedWip)));
  };

  const clearAll = () => {
    console.log('MonthEndReview: Clear All tapped');
    setSelectedWips(new Set());
  };

  const handleCloseSelected = () => {
    if (selectedCount === 0) return;
    console.log('MonthEndReview: Close Selected tapped —', selectedCount, 'WIPs,', selectedHours.toFixed(1), 'h,', selectedAW, 'AW');

    const selectedHoursDisplay = selectedHours.toFixed(1);
    const selectedAWDisplay = selectedAW;
    const remainingDisplay = remainingCount;

    Alert.alert(
      `CLOSE ${selectedCount} WIP${selectedCount !== 1 ? 'S' : ''}?`,
      `${selectedCount} WIP${selectedCount !== 1 ? 's' : ''} · ${selectedHoursDisplay}h · ${selectedAWDisplay} AW\n\nThese WIPs will be marked INVOICED / CLOSED.\n${remainingDisplay} unticked WIP${remainingDisplay !== 1 ? 's' : ''} will remain OPEN / AWAITING.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: `CLOSE ${selectedCount} WIP${selectedCount !== 1 ? 'S' : ''}`,
          style: 'destructive',
          onPress: processClosures,
        },
      ]
    );
  };

  const handleKeepAllOpen = () => {
    console.log('MonthEndReview: Keep All Open tapped');
    Alert.alert(
      `KEEP ALL ${totalOpenWips} WIPS OPEN?`,
      'These Jobs will carry into the next month.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'KEEP OPEN',
          onPress: async () => {
            console.log('MonthEndReview: Confirmed keep all open — saving review record');
            const record: MonthEndReviewRecord = {
              id: generateId(),
              month: reviewMonth,
              reviewedAt: new Date().toISOString(),
              openWipsFound: totalOpenWips,
              wipsClosed: 0,
              wipsCarriedForward: totalOpenWips,
              totalHoursClosed: 0,
              totalHoursCarried: totalOpenHours,
            };
            await monthEndReviewStorage.save(record);
            setResultScreen({
              closed: 0,
              carried: totalOpenWips,
              hoursClosed: 0,
              hoursCarried: totalOpenHours,
              skipped: [],
            });
          },
        },
      ]
    );
  };

  const processClosures = async () => {
    console.log('MonthEndReview: Processing closures for', selectedCount, 'WIPs');
    setProcessing(true);

    let closed = 0;
    let carried = 0;
    let hoursClosed = 0;
    let hoursCarried = 0;
    const skipped: string[] = [];

    const allJobs = allJobsRef.current;
    const allBilling = allBillingRef.current;

    for (const item of wipList) {
      const isSelected = selectedWips.has(item.normalizedWip);

      if (!isSelected) {
        carried++;
        hoursCarried += item.openHours;
        continue;
      }

      // Skip WIPs with billing attention — mark as needs review
      if (item.hasBillingAttention) {
        console.log('MonthEndReview: Skipping WIP with billing attention:', item.normalizedWip);
        skipped.push(item.displayWip);
        carried++;
        hoursCarried += item.openHours;
        continue;
      }

      try {
        const lastSession = item.sessionCount > 0
          ? allJobs
              .filter((j: any) => normalizeWip(j.wipNumber) === item.normalizedWip)
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;

        if (!lastSession) {
          console.warn('MonthEndReview: No sessions found for WIP:', item.normalizedWip);
          skipped.push(item.displayWip);
          carried++;
          hoursCarried += item.openHours;
          continue;
        }

        console.log('MonthEndReview: Closing WIP:', item.normalizedWip, 'trigger session:', lastSession.id);
        await completeWip(lastSession.id, item.normalizedWip, allJobs, allBilling);
        closed++;
        hoursClosed += item.openHours;
      } catch (err) {
        console.error('MonthEndReview: Failed to close WIP:', item.normalizedWip, err);
        skipped.push(item.displayWip);
        carried++;
        hoursCarried += item.openHours;
      }
    }

    console.log('MonthEndReview: Processing complete — closed:', closed, 'carried:', carried, 'skipped:', skipped.length);

    // Save review record
    const record: MonthEndReviewRecord = {
      id: generateId(),
      month: reviewMonth,
      reviewedAt: new Date().toISOString(),
      openWipsFound: totalOpenWips,
      wipsClosed: closed,
      wipsCarriedForward: carried,
      totalHoursClosed: hoursClosed,
      totalHoursCarried: hoursCarried,
    };
    await monthEndReviewStorage.save(record);

    setProcessing(false);
    setResultScreen({ closed, carried, hoursClosed, hoursCarried, skipped });
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'oldest', label: 'Oldest' },
    { key: 'newest', label: 'Newest' },
    { key: 'hours_desc', label: 'Hours ↓' },
    { key: 'aw_desc', label: 'AW ↓' },
    { key: 'wip', label: 'WIP' },
  ];

  const filterOptions: { key: FilterOption; label: string }[] = [
    { key: 'all', label: 'All Open' },
    { key: 'this_month', label: 'This Month' },
    { key: 'carried', label: 'Carried Forward' },
    { key: 'attention', label: 'Attention' },
  ];

  const renderWipRow = ({ item }: { item: OpenWipItem }) => {
    const isSelected = selectedWips.has(item.normalizedWip);
    const lastWorkedDisplay = formatDate(item.lastWorked);
    const openHoursDisplay = item.openHours.toFixed(1);
    const sessionLabel = `${item.sessionCount} Session${item.sessionCount !== 1 ? 's' : ''}`;

    return (
      <TouchableOpacity
        style={[
          styles.wipRow,
          {
            backgroundColor: theme.card,
            borderColor: isSelected ? theme.primary : theme.border,
            borderLeftColor: isSelected ? theme.primary : theme.border,
          },
        ]}
        onPress={() => {
          console.log('MonthEndReview: WIP row tapped — navigating to wip-workspace:', item.normalizedWip);
          router.push(`/wip-workspace?wip=${encodeURIComponent(item.normalizedWip)}`);
        }}
        onLongPress={() => {
          console.log('MonthEndReview: WIP row long-pressed — toggling selection:', item.normalizedWip);
          toggleWip(item.normalizedWip);
        }}
        activeOpacity={0.8}
      >
        {/* Checkbox */}
        <TouchableOpacity
          style={[
            styles.checkbox,
            {
              backgroundColor: isSelected ? theme.primary : 'transparent',
              borderColor: isSelected ? theme.primary : theme.border,
            },
          ]}
          onPress={() => toggleWip(item.normalizedWip)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSelected && (
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="check"
              size={14}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.wipRowContent}>
          <View style={styles.wipRowTop}>
            <Text style={[styles.wipNumber, { color: theme.text }]}>
              {item.displayWip}
            </Text>
            <Text style={[styles.wipReg, { color: theme.textSecondary }]}>
              {item.vehicleReg}
            </Text>
          </View>
          <Text style={[styles.wipMeta, { color: theme.textSecondary }]}>
            {sessionLabel}
          </Text>
          <Text style={[styles.wipMeta, { color: theme.textSecondary }]}>
            {openHoursDisplay}h Open
          </Text>
          <Text style={[styles.wipMeta, { color: theme.textSecondary }]}>
            {item.openAW} AW
          </Text>
          <Text style={[styles.wipLastWorked, { color: theme.textSecondary }]}>
            Last Worked: {lastWorkedDisplay}
          </Text>
          {item.hasBillingAttention && (
            <View style={[styles.attentionBadge, { backgroundColor: '#FF980022' }]}>
              <Text style={styles.attentionBadgeText}>NEEDS REVIEW</Text>
            </View>
          )}
        </View>

        {/* Navigate arrow */}
        <IconSymbol
          ios_icon_name="chevron.right"
          android_material_icon_name="chevron-right"
          size={16}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  // ── Result screen ───────────────────────────────────────────────────────────

  if (resultScreen) {
    const closedHoursDisplay = resultScreen.hoursClosed.toFixed(1);
    const carriedHoursDisplay = resultScreen.hoursCarried.toFixed(1);

    return (
      <AppBackground>
        <View style={[styles.container, Platform.OS === 'android' && { paddingTop: 48 }]}>
          <View style={styles.resultContainer}>
            <Text style={[styles.resultTitle, { color: theme.text }]}>MONTH END REVIEW COMPLETE</Text>
            <Text style={[styles.resultMonth, { color: theme.primary }]}>{monthLabel.toUpperCase()}</Text>

            <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
              <View style={[styles.resultStat, { borderBottomColor: theme.border }]}>
                <Text style={[styles.resultStatValue, { color: '#22C55E' }]}>{resultScreen.closed}</Text>
                <Text style={[styles.resultStatLabel, { color: theme.textSecondary }]}>WIPs Closed</Text>
              </View>
              <View style={[styles.resultStat, { borderBottomColor: theme.border }]}>
                <Text style={[styles.resultStatValue, { color: '#22C55E' }]}>{closedHoursDisplay}h</Text>
                <Text style={[styles.resultStatLabel, { color: theme.textSecondary }]}>Invoiced</Text>
              </View>
            </View>

            <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
              <View style={[styles.resultStat, { borderBottomColor: theme.border }]}>
                <Text style={[styles.resultStatValue, { color: '#FF9800' }]}>{resultScreen.carried}</Text>
                <Text style={[styles.resultStatLabel, { color: theme.textSecondary }]}>WIPs Carried Open</Text>
              </View>
              <View style={[styles.resultStat, { borderBottomColor: theme.border }]}>
                <Text style={[styles.resultStatValue, { color: '#FF9800' }]}>{carriedHoursDisplay}h</Text>
                <Text style={[styles.resultStatLabel, { color: theme.textSecondary }]}>Remaining Open</Text>
              </View>
            </View>

            {resultScreen.skipped.length > 0 && (
              <View style={[styles.skippedCard, { backgroundColor: '#FF980015', borderColor: '#FF9800' }]}>
                <Text style={[styles.skippedTitle, { color: '#FF9800' }]}>
                  {resultScreen.skipped.length} WIP{resultScreen.skipped.length !== 1 ? 's' : ''} Need Manual Review
                </Text>
                <Text style={[styles.skippedBody, { color: theme.textSecondary }]}>
                  {resultScreen.skipped.join(', ')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('MonthEndReview: View Closed WIPs tapped — navigating to billing tab');
                router.push('/(tabs)/billing');
              }}
            >
              <Text style={styles.resultBtnText}>VIEW CLOSED WIPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => {
                console.log('MonthEndReview: View Remaining Open WIPs tapped — navigating to open-job-control');
                router.push('/open-job-control');
              }}
            >
              <Text style={[styles.resultBtnText, { color: theme.text }]}>VIEW REMAINING OPEN WIPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: 'transparent' }]}
              onPress={() => {
                console.log('MonthEndReview: Done tapped — going back');
                router.back();
              }}
            >
              <Text style={[styles.resultBtnText, { color: theme.textSecondary }]}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppBackground>
    );
  }

  // ── Processing overlay ──────────────────────────────────────────────────────

  if (processing) {
    return (
      <AppBackground>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.processingText, { color: theme.text }]}>Processing WIP Closures…</Text>
          <Text style={[styles.processingSubText, { color: theme.textSecondary }]}>Please wait</Text>
        </View>
      </AppBackground>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.processingText, { color: theme.text }]}>Loading Open WIPs…</Text>
        </View>
      </AppBackground>
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────────────

  const totalOpenHoursDisplay = totalOpenHours.toFixed(1);
  const selectedHoursDisplay = selectedHours.toFixed(1);

  return (
    <AppBackground>
      <View style={[styles.container, Platform.OS === 'android' && { paddingTop: 48 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              console.log('MonthEndReview: Back button pressed');
              router.back();
            }}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={22}
              color={theme.primary}
            />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>MONTH END REVIEW</Text>
            <Text style={[styles.headerMonth, { color: theme.primary }]}>{monthLabel.toUpperCase()}</Text>
            <Text style={[styles.headerStats, { color: theme.textSecondary }]}>
              {totalOpenWips} Open WIP{totalOpenWips !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.headerStats, { color: theme.textSecondary }]}>
              {totalOpenHoursDisplay}h Open · {totalOpenAW} AW
            </Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}>
          <Text style={[styles.infoBannerText, { color: theme.primary }]}>
            Selected WIPs will be marked INVOICED / CLOSED. Unticked WIPs will remain OPEN / AWAITING.
          </Text>
        </View>

        {/* Live summary bar */}
        <View style={[styles.summaryBar, { backgroundColor: theme.card }]}>
          <View style={styles.summaryBarRow}>
            <Text style={[styles.summaryBarTotal, { color: theme.text }]}>
              {totalOpenWips} Open WIP{totalOpenWips !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.summaryBarRow}>
            <Text style={[styles.summaryBarSelected, { color: theme.primary }]}>
              {selectedCount} Selected to Close
            </Text>
            <Text style={[styles.summaryBarRemaining, { color: '#FF9800' }]}>
              {remainingCount} Remaining Open
            </Text>
          </View>
          <Text style={[styles.summaryBarDetail, { color: theme.textSecondary }]}>
            Selected: {selectedHoursDisplay}h / {selectedAW} AW
          </Text>
        </View>

        {/* Sort chips */}
        <View style={styles.chipsSection}>
          <Text style={[styles.chipsLabel, { color: theme.textSecondary }]}>SORT</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={sortOptions}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item: opt }) => {
              const active = sort === opt.key;
              return (
                <TouchableOpacity
                  style={[styles.chip, { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.card }]}
                  onPress={() => {
                    console.log('MonthEndReview: Sort changed to', opt.key);
                    setSort(opt.key);
                  }}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Filter chips */}
        <View style={styles.chipsSection}>
          <Text style={[styles.chipsLabel, { color: theme.textSecondary }]}>FILTER</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filterOptions}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item: opt }) => {
              const active = filter === opt.key;
              return (
                <TouchableOpacity
                  style={[styles.chip, { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.card }]}
                  onPress={() => {
                    console.log('MonthEndReview: Filter changed to', opt.key);
                    setFilter(opt.key);
                  }}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : theme.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* WIP list */}
        {sortedList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name={'check-circle' as any}
              size={40}
              color="#22C55E"
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Open WIPs</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              All WIPs are billed or no jobs exist.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedList}
            keyExtractor={item => item.normalizedWip}
            renderItem={renderWipRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Bottom action bar */}
        <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          {/* Row 1: Select All / Clear All */}
          <View style={styles.bottomBarRow}>
            <TouchableOpacity
              style={[styles.bottomBarSecondaryBtn, { borderColor: theme.border }]}
              onPress={selectAll}
            >
              <Text style={[styles.bottomBarSecondaryBtnText, { color: theme.text }]}>SELECT ALL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomBarSecondaryBtn, { borderColor: theme.border }]}
              onPress={clearAll}
            >
              <Text style={[styles.bottomBarSecondaryBtnText, { color: theme.text }]}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Primary action */}
          <View style={styles.bottomBarRow}>
            {selectedCount > 0 ? (
              <TouchableOpacity
                style={[styles.bottomBarPrimaryBtn, { backgroundColor: theme.primary }]}
                onPress={handleCloseSelected}
              >
                <Text style={styles.bottomBarPrimaryBtnText}>
                  CLOSE {selectedCount} SELECTED WIP{selectedCount !== 1 ? 'S' : ''}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.bottomBarPrimaryBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
                onPress={handleKeepAllOpen}
              >
                <Text style={[styles.bottomBarPrimaryBtnText, { color: theme.text }]}>
                  KEEP ALL OPEN
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    paddingTop: 4,
    minWidth: 32,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerMonth: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  headerStats: {
    fontSize: 13,
    marginTop: 2,
  },

  infoBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  infoBannerText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },

  summaryBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryBarTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryBarSelected: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryBarRemaining: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryBarDetail: {
    fontSize: 12,
    marginTop: 2,
  },

  chipsSection: {
    marginBottom: 4,
  },
  chipsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 16,
    marginBottom: 4,
  },
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  wipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 8,
    padding: 12,
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wipRowContent: {
    flex: 1,
    gap: 2,
  },
  wipRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  wipNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  wipReg: {
    fontSize: 13,
    fontWeight: '500',
  },
  wipMeta: {
    fontSize: 12,
  },
  wipLastWorked: {
    fontSize: 11,
    marginTop: 2,
  },
  attentionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  attentionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF9800',
    letterSpacing: 0.5,
  },

  emptyCard: {
    margin: 16,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },

  bottomBar: {
    borderTopWidth: 1,
    padding: 12,
    gap: 8,
  },
  bottomBarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomBarSecondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  bottomBarSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bottomBarPrimaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bottomBarPrimaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Processing / loading
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  processingSubText: {
    fontSize: 14,
  },

  // Result screen
  resultContainer: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 20,
  },
  resultMonth: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultCard: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 0,
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultStatValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  resultStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  skippedCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  skippedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  skippedBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  resultBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
