
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { activityLogger, LogEntry, LogLevel, LogCategory } from '@/utils/activityLogger';

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: '#9e9e9e',
  INFO: '#00bcd4',
  WARN: '#ff9800',
  ERROR: '#f44336',
  FATAL: '#b71c1c',
};

const ALL_LEVELS: ('ALL' | LogLevel)[] = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

const ALL_CATEGORIES: ('ALL' | LogCategory)[] = [
  'ALL',
  'APP_LIFECYCLE',
  'AUTH',
  'SETUP',
  'NAVIGATION',
  'STORAGE',
  'NOTIFICATIONS',
  'WIDGET',
  'BACKGROUND',
  'IMPORT_EXPORT',
  'JOBS',
  'NETWORK',
  'CRASH',
  'GENERAL',
];

const ITEM_HEIGHT = 90;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  } catch {
    return iso;
  }
}

interface LogRowProps {
  item: LogEntry;
}

function LogRow({ item }: LogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const levelColor = LEVEL_COLORS[item.level] ?? '#9e9e9e';
  const shortSession = item.sessionId.slice(0, 6);
  const timeStr = formatTimestamp(item.timestamp);

  return (
    <TouchableOpacity
      onPress={() => {
        if (item.data) {
          console.log('ActivityLogs: Log row tapped, toggling data expand for id:', item.id);
          setExpanded(prev => !prev);
        }
      }}
      activeOpacity={item.data ? 0.7 : 1}
      style={styles.logRow}
    >
      {/* Left colour bar */}
      <View style={[styles.levelBar, { backgroundColor: levelColor }]} />

      <View style={styles.logContent}>
        {/* Top row: timestamp + level badge + category badge + session */}
        <View style={styles.logMeta}>
          <Text style={styles.logTimestamp}>{timeStr}</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
            <Text style={styles.levelBadgeText}>{item.level}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
          <Text style={styles.sessionText}>{shortSession}</Text>
        </View>

        {/* Message */}
        <Text style={styles.logMessage} numberOfLines={expanded ? undefined : 2}>
          {item.message}
        </Text>

        {/* Data (collapsible) */}
        {item.data && expanded && (
          <Text style={styles.logData}>{item.data}</Text>
        )}
        {item.data && !expanded && (
          <Text style={styles.tapToExpand}>tap to expand data</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ActivityLogsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | LogLevel>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | LogCategory>('ALL');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stats = activityLogger.getStats();
  const errorFatalCount = stats.byLevel.ERROR + stats.byLevel.FATAL;

  const loadLogs = useCallback(() => {
    try {
      const filter: Parameters<typeof activityLogger.getLogs>[0] = {};
      if (selectedLevel !== 'ALL') filter.level = selectedLevel;
      if (selectedCategory !== 'ALL') filter.category = selectedCategory;
      if (searchText.trim()) filter.search = searchText.trim();
      const result = activityLogger.getLogs(filter);
      setAllLogs(result);
      setFilteredLogs(result);
    } catch {
      // Never crash
    }
  }, [selectedLevel, selectedCategory, searchText]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadLogs();
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadLogs]);

  const handleRefresh = useCallback(async () => {
    console.log('ActivityLogs: Pull-to-refresh triggered');
    setRefreshing(true);
    loadLogs();
    setRefreshing(false);
  }, [loadLogs]);

  const handleClear = useCallback(() => {
    console.log('ActivityLogs: Clear logs button pressed');
    Alert.alert(
      'Clear All Logs',
      'This will permanently delete all activity logs. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            console.log('ActivityLogs: Confirmed clear logs');
            await activityLogger.clearLogs();
            loadLogs();
          },
        },
      ]
    );
  }, [loadLogs]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    console.log('ActivityLogs: Export logs button pressed');
    setExporting(true);
    try {
      await activityLogger.exportLogs();
    } catch {
      Alert.alert('Export Failed', 'Could not export logs.');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  const renderItem = useCallback(({ item }: { item: LogEntry }) => (
    <LogRow item={item} />
  ), []);

  const shortSession = stats.sessionId.slice(0, 6);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log('ActivityLogs: Back button pressed');
            router.back();
          }}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBtnText}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Activity Logs</Text>
          <Text style={styles.loggingActive}>● Logging Active</Text>
        </View>
        <TouchableOpacity
          onPress={handleExport}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#9e9e9e' }]}>{shortSession}</Text>
          <Text style={styles.statLabel}>Session</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: errorFatalCount > 0 ? '#f44336' : '#4caf50' }]}>
            {errorFatalCount}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleClear}>
          <Text style={[styles.statValue, { color: '#f44336', fontSize: 13 }]}>Clear</Text>
          <Text style={styles.statLabel}>All Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Export button */}
      <TouchableOpacity
        style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
        onPress={handleExport}
        disabled={exporting}
        activeOpacity={0.8}
      >
        <Text style={styles.exportBtnText}>
          {exporting ? '⏳ Exporting...' : '📤  Export Logs (.txt)'}
        </Text>
      </TouchableOpacity>

      {/* Level filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {ALL_LEVELS.map(level => {
          const isActive = selectedLevel === level;
          const color = level === 'ALL' ? '#607d8b' : LEVEL_COLORS[level as LogLevel];
          return (
            <TouchableOpacity
              key={level}
              onPress={() => {
                console.log('ActivityLogs: Level filter pressed:', level);
                setSelectedLevel(level);
              }}
              style={[
                styles.pill,
                { borderColor: color },
                isActive && { backgroundColor: color },
              ]}
            >
              <Text style={[styles.pillText, { color: isActive ? '#fff' : color }]}>
                {level}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {ALL_CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                console.log('ActivityLogs: Category filter pressed:', cat);
                setSelectedCategory(cat as 'ALL' | LogCategory);
              }}
              style={[
                styles.pill,
                { borderColor: '#607d8b' },
                isActive && { backgroundColor: '#607d8b' },
              ]}
            >
              <Text style={[styles.pillText, { color: isActive ? '#fff' : '#9e9e9e' }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#555"
          value={searchText}
          onChangeText={text => {
            console.log('ActivityLogs: Search text changed');
            setSearchText(text);
          }}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Log list */}
      {filteredLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No logs yet</Text>
          <Text style={styles.emptySubtext}>Activity will appear here as you use the app</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00bcd4"
              colors={['#00bcd4']}
            />
          }
          initialNumToRender={30}
          maxToRenderPerBatch={30}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerBtn: {
    minWidth: 60,
  },
  headerBtnText: {
    color: '#00bcd4',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loggingActive: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  exportBtn: {
    backgroundColor: '#00bcd4',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2a2a2a',
  },
  filterRow: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  filterRowContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    minHeight: ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  levelBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  logContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  logTimestamp: {
    color: '#666',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  levelBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  categoryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#2a2a2a',
  },
  categoryBadgeText: {
    color: '#9e9e9e',
    fontSize: 9,
    fontWeight: '600',
  },
  sessionText: {
    color: '#444',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMessage: {
    color: '#e0e0e0',
    fontSize: 13,
    lineHeight: 18,
  },
  logData: {
    color: '#888',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
    lineHeight: 16,
  },
  tapToExpand: {
    color: '#444',
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
