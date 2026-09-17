
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { toastManager } from '@/utils/toastManager';
import { getUndoHistory, performUndo, UndoAction, UndoActionType } from '@/utils/undoCentre';

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

const ACTION_TYPE_LABELS: Record<UndoActionType, string> = {
  WIP_CLOSED: 'WIP Closed',
  WIP_REOPENED: 'WIP Reopened',
  BLOCKER_SET: 'Blocker Set',
  BLOCKER_CHANGED: 'Blocker Changed',
  BLOCKER_CLEARED: 'Blocker Cleared',
  ABSENCE_DELETED: 'Absence Deleted',
  ABSENCE_EDITED: 'Absence Edited',
  MONTH_END_CLOSED: 'Month End Closed',
};

const ACTION_TYPE_COLORS: Record<UndoActionType, string> = {
  WIP_CLOSED: '#f44336',
  WIP_REOPENED: '#4CAF50',
  BLOCKER_SET: '#FF9800',
  BLOCKER_CHANGED: '#FF9800',
  BLOCKER_CLEARED: '#4fc3f7',
  ABSENCE_DELETED: '#f44336',
  ABSENCE_EDITED: '#FF9800',
  MONTH_END_CLOSED: '#9E9E9E',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UndoCentreScreen() {
  const { theme } = useThemeContext();
  const [actions, setActions] = useState<UndoAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getUndoHistory();
      setActions(history);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleUndo = async (action: UndoAction) => {
    console.log('[UndoCentre] User pressed UNDO for action:', action.id, action.label);
    setUndoing(action.id);
    try {
      const result = await performUndo(action);
      if (result.success) {
        toastManager.success(`Undone: ${action.label}`);
        await loadHistory();
      } else {
        toastManager.error(result.error ?? 'Undo failed');
      }
    } catch (e: any) {
      toastManager.error(e?.message ?? 'Undo failed');
    } finally {
      setUndoing(null);
    }
  };

  const renderItem = ({ item }: { item: UndoAction }) => {
    const typeColor = ACTION_TYPE_COLORS[item.type] ?? theme.primary;
    const typeLabel = ACTION_TYPE_LABELS[item.type] ?? item.type;
    const isDisabled = item.expired || item.undone;
    const timeAgoText = timeAgo(item.createdAt);
    const isUndoing = undoing === item.id;

    return (
      <View
        style={[
          styles.actionRow,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            opacity: isDisabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.actionLeft}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <Text style={[styles.actionLabel, { color: theme.text }]} numberOfLines={2}>
            {item.label}
          </Text>
          <View style={styles.actionMeta}>
            <Text style={[styles.actionTime, { color: theme.textSecondary }]}>{timeAgoText}</Text>
            {item.undone && (
              <Text style={[styles.actionStatus, { color: '#4CAF50' }]}>✓ Undone</Text>
            )}
            {item.expired && !item.undone && (
              <Text style={[styles.actionStatus, { color: theme.textSecondary }]}>Expired</Text>
            )}
          </View>
        </View>
        {!isDisabled && (
          <TouchableOpacity
            style={[styles.undoBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleUndo(item)}
            disabled={isUndoing}
          >
            {isUndoing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.undoBtnText}>UNDO</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('[UndoCentre] Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>UNDO CENTRE</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : actions.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="arrow.uturn.backward.circle"
            android_material_icon_name="undo"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>No recent actions</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Actions like closing WIPs, setting blockers, and deleting absences will appear here for 30 minutes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={actions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text style={[styles.listHint, { color: theme.textSecondary }]}>
              Actions expire after 30 minutes. Tap UNDO to reverse.
            </Text>
          }
        />
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
  },
  backBtn: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listHint: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  actionLeft: {
    flex: 1,
    gap: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionTime: {
    fontSize: 12,
  },
  actionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  undoBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
