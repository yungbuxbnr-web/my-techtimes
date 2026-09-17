
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchAll, getSearchHistory, addSearchHistory, clearSearchHistory, SearchResult, SearchResultGroup } from '@/utils/globalSearch';
import { billingStorage } from '@/utils/billingStorage';
import { wipBlockerStorage } from '@/utils/wipBlockerStorage';
import { api } from '@/utils/api';

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

export default function GlobalSearchScreen() {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data refs to avoid re-loading on every search
  const jobsRef = useRef<any[]>([]);
  const billingRef = useRef<any[]>([]);
  const casesRef = useRef<any[]>([]);
  const blockersRef = useRef<any[]>([]);
  const dataLoaded = useRef(false);

  useEffect(() => {
    loadInitialData();
    loadHistory();
    // Auto-focus
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadInitialData = async () => {
    try {
      const [jobs, billing, blockersRaw] = await Promise.all([
        api.getAllJobs().catch(() => []),
        billingStorage.getAllRecords().catch(() => []),
        wipBlockerStorage.getAll().catch(() => []),
      ]);
      const casesRaw = await AsyncStorage.getItem('@techtimes_technical_cases').catch(() => null);
      const cases = casesRaw ? JSON.parse(casesRaw) : [];
      jobsRef.current = jobs;
      billingRef.current = billing;
      casesRef.current = cases;
      blockersRef.current = blockersRaw;
      dataLoaded.current = true;
    } catch {}
  };

  const loadHistory = async () => {
    const h = await getSearchHistory();
    setHistory(h);
  };

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await searchAll(
        q,
        jobsRef.current,
        billingRef.current,
        casesRef.current,
        blockersRef.current
      );
      setGroups(results);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(text);
    }, 300);
  };

  const handleSubmit = async () => {
    if (!query.trim()) return;
    console.log('[GlobalSearch] User submitted search query:', query.trim());
    await addSearchHistory(query.trim());
    await loadHistory();
    runSearch(query.trim());
  };

  const handleHistoryTap = (q: string) => {
    console.log('[GlobalSearch] User tapped history item:', q);
    setQuery(q);
    runSearch(q);
  };

  const handleResultTap = (result: SearchResult) => {
    console.log('[GlobalSearch] User tapped result:', result.type, result.title, '→', result.navigateTo);
    if (result.navigateParams && Object.keys(result.navigateParams).length > 0) {
      router.push({ pathname: result.navigateTo as any, params: result.navigateParams });
    } else {
      router.push(result.navigateTo as any);
    }
  };

  const handleClearHistory = async () => {
    console.log('[GlobalSearch] User cleared search history');
    await clearSearchHistory();
    setHistory([]);
  };

  const statusColor = (status?: string) => {
    if (!status) return theme.textSecondary;
    const s = status.toLowerCase();
    if (s === 'open') return '#4fc3f7';
    if (s === 'billed' || s === 'invoiced') return '#4CAF50';
    if (s === 'closed') return '#9E9E9E';
    return theme.textSecondary;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'wip': return { ios: 'wrench.fill', android: 'build' };
      case 'vehicle': return { ios: 'car.fill', android: 'directions-car' };
      case 'job': return { ios: 'doc.text.fill', android: 'description' };
      case 'technical_case': return { ios: 'exclamationmark.triangle.fill', android: 'warning' };
      case 'billing': return { ios: 'creditcard.fill', android: 'payment' };
      case 'blocker': return { ios: 'lock.fill', android: 'lock' };
      default: return { ios: 'magnifyingglass', android: 'search' };
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => {
    const icon = typeIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.resultRow, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => handleResultTap(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.resultIcon, { backgroundColor: theme.primary + '20' }]}>
          <IconSymbol
            ios_icon_name={icon.ios}
            android_material_icon_name={icon.android as any}
            size={18}
            color={theme.primary}
          />
        </View>
        <View style={styles.resultContent}>
          <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.resultSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
          {item.detail ? (
            <Text style={[styles.resultDetail, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        {item.status ? (
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22', borderColor: statusColor(item.status) }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <IconSymbol
          ios_icon_name="chevron.right"
          android_material_icon_name="chevron-right"
          size={16}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (label: string) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: theme.primary }]}>{label}</Text>
    </View>
  );

  // Flatten groups for FlatList
  type ListItem =
    | { kind: 'header'; label: string; key: string }
    | { kind: 'result'; result: SearchResult; key: string };

  const listData: ListItem[] = [];
  for (const group of groups) {
    listData.push({ kind: 'header', label: group.label, key: `header_${group.type}` });
    for (const r of group.results) {
      listData.push({ kind: 'result', result: r, key: r.id });
    }
  }

  const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
  const showHistory = !query.trim() && history.length > 0;
  const showEmpty = query.trim().length > 0 && !loading && totalResults === 0;

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('[GlobalSearch] Back button pressed');
            router.back();
          }}
          style={styles.backBtn}
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
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            placeholder="Search WIPs, vehicles, jobs, technical cases..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                console.log('[GlobalSearch] Clear query button pressed');
                setQuery('');
                setGroups([]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Searching...</Text>
        </View>
      )}

      {showHistory && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: theme.textSecondary }]}>RECENT SEARCHES</Text>
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={[styles.clearHistoryText, { color: theme.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.map(h => (
            <TouchableOpacity
              key={h}
              style={[styles.historyRow, { borderBottomColor: theme.border }]}
              onPress={() => handleHistoryTap(h)}
            >
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="history"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.historyText, { color: theme.text }]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!query.trim() && !showHistory && (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            Search WIPs, vehicles, jobs, technical cases...
          </Text>
        </View>
      )}

      {showEmpty && (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No results for &apos;{query}&apos;
          </Text>
        </View>
      )}

      {listData.length > 0 && (
        <FlatList
          data={listData}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return renderSectionHeader(item.label);
            }
            return renderResult({ item: item.result });
          }}
        />
      )}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    padding: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  historySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clearHistoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingTop: 16,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  resultDetail: {
    fontSize: 11,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
