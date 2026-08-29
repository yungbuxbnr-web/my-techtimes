
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { billingStorage, BillingRecord, BillingHistoryEntry } from '@/utils/billingStorage';
import { getJobImages, StoredImage } from '@/utils/imageStorage';
import { caseStorage, TechnicalCase } from '@/utils/moduleStorage';
import {
  normalizeWip,
  getJobsForWip,
  getBillingRecordsForWip,
  getWipSummary,
  WipSummary,
} from '@/utils/wipEngine';
import { normaliseBillingStatus, awToHours } from '@/utils/billingEngine';
import { Job } from '@/utils/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  billing_created: 'Billing Created',
  work_marked_complete: 'Work Completed',
  marked_billed: 'Marked Invoiced',
  billing_reopened: 'Reopened',
  billing_adjusted: 'Billing Adjusted',
  notes_changed: 'Notes Updated',
  returned_to_in_progress: 'Returned to In Progress',
};

// ── CollapsibleSection ────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultOpen: boolean;
  children: React.ReactNode;
  theme: any;
}

function CollapsibleSection({ title, badge, defaultOpen, children, theme }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !open;
    console.log('WipWorkspace: CollapsibleSection toggled:', title, 'open:', next);
    setOpen(next);
  };

  const chevronIcon = open ? 'chevron.up' : 'chevron.down';
  const chevronAndroid = open ? 'expand-less' : 'expand-more';
  const chevronText = open ? '▲' : '▼';

  return (
    <View style={[sectionStyles.wrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity onPress={handleToggle} style={sectionStyles.header} activeOpacity={0.75}>
        <Text style={[sectionStyles.title, { color: theme.primary }]}>{title}</Text>
        {badge !== undefined && badge !== null && (
          <View style={[sectionStyles.badge, { backgroundColor: theme.primary + '22' }]}>
            <Text style={[sectionStyles.badgeText, { color: theme.primary }]}>{badge}</Text>
          </View>
        )}
        <Text style={[sectionStyles.chevron, { color: theme.textSecondary }]}>{chevronText}</Text>
      </TouchableOpacity>
      {open && <View style={[sectionStyles.body, { borderTopColor: theme.border }]}>{children}</View>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 11,
  },
  body: {
    borderTopWidth: 1,
    padding: 14,
  },
});

// ── MetricCard ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  theme: any;
}

function MetricCard({ label, value, color, theme }: MetricCardProps) {
  return (
    <View style={[metricStyles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Text style={[metricStyles.value, { color: color ?? theme.primary }]}>{value}</Text>
      <Text style={[metricStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
  },
});

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  let bg = '#3a2a0a';
  let color = '#ff9800';
  let label = 'OPEN / AWAITING';

  if (status === 'billed') {
    bg = '#1a3a1a';
    color = '#4caf50';
    label = 'INVOICED / CLOSED';
  } else if (status === 'mixed') {
    bg = '#3a2a0a';
    color = '#ffb74d';
    label = 'MIXED';
  }

  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

function VhcBadge({ status }: { status: string }) {
  let color = '#666';
  if (status === 'GREEN') color = '#4caf50';
  else if (status === 'ORANGE') color = '#ff9800';
  else if (status === 'RED') color = '#f44336';

  return (
    <View style={[badgeStyles.badge, { backgroundColor: color + '22', borderWidth: 1, borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{status}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

interface WipData {
  summary: WipSummary;
  sessions: Job[];
  billingRecords: BillingRecord[];
  billingHistory: BillingHistoryEntry[];
  imagesByJobId: Map<string, StoredImage[]>;
  cases: TechnicalCase[];
}

export default function WipWorkspaceScreen() {
  const { theme } = useThemeContext();
  const params = useLocalSearchParams<{ wip: string }>();
  const wip = params.wip ?? '';

  const [data, setData] = useState<WipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  const load = useCallback(async () => {
    console.log('WipWorkspace: Loading data for WIP:', wip);
    setLoading(true);
    setError(null);
    try {
      const [allJobs, allRecords, allHistory, allCases] = await Promise.all([
        api.getAllJobs(),
        billingStorage.getAllRecords(),
        billingStorage.getAllHistory(),
        caseStorage.getAll(),
      ]);

      const sessions = getJobsForWip(wip, allJobs).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const billingRecords = getBillingRecordsForWip(wip, allRecords);
      const billingRecordIds = new Set(billingRecords.map(r => r.id));
      const billingHistory = allHistory.filter(h => billingRecordIds.has(h.billingRecordId));
      const sessionIds = new Set(sessions.map(s => s.id));

      // Load images for each session in parallel
      const imageResults = await Promise.all(
        sessions.map(async (s) => {
          try {
            const imgs = await getJobImages(s.id);
            return { jobId: s.id, images: imgs };
          } catch {
            return { jobId: s.id, images: [] };
          }
        })
      );
      const imagesByJobId = new Map<string, StoredImage[]>();
      imageResults.forEach(r => imagesByJobId.set(r.jobId, r.images));

      const cases = allCases.filter(
        c => normalizeWip(c.wipNumber) === wip || (c.linkedJobId && sessionIds.has(c.linkedJobId))
      );

      const summary = getWipSummary(wip, allJobs, allRecords);

      console.log('WipWorkspace: Loaded — sessions:', sessions.length, 'billing records:', billingRecords.length, 'history:', billingHistory.length, 'cases:', cases.length);

      setData({ summary, sessions, billingRecords, billingHistory, imagesByJobId, cases });
    } catch (err: any) {
      console.error('WipWorkspace: Error loading data:', err);
      setError(err?.message ?? 'Failed to load WIP data');
    } finally {
      setLoading(false);
    }
  }, [wip]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppBackground>
        <View style={[styles.centered, { paddingTop: PT }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading WIP workspace…</Text>
        </View>
      </AppBackground>
    );
  }

  if (error || !data) {
    return (
      <AppBackground>
        <View style={[styles.centered, { paddingTop: PT }]}>
          <Text style={[styles.errorText, { color: theme.chartRed ?? '#f44336' }]}>{error ?? 'Unknown error'}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log('WipWorkspace: Retry button pressed');
              load();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </AppBackground>
    );
  }

  const { summary, sessions, billingRecords, billingHistory, imagesByJobId, cases } = data;

  // ── Derived values ──────────────────────────────────────────────────────────

  const displayWip = summary.displayWip;
  const vehicleReg = summary.vehicleReg;
  const sessionCount = summary.sessionCount;
  const totalAW = summary.totalAW;
  const totalHours = summary.totalHours;
  const firstWorked = summary.firstWorked;
  const lastWorked = summary.lastWorked;
  const hasConflict = summary.hasConflict;
  const wipStatus = summary.status;

  const billedRecords = billingRecords.filter(r => normaliseBillingStatus(r.billingStatus) === 'billed');
  const openRecords = billingRecords.filter(r => normaliseBillingStatus(r.billingStatus) === 'open');

  const invoicedHours = billedRecords.reduce((s, r) => s + (r.billedHours ?? 0), 0);
  const openHours = openRecords.length > 0
    ? openRecords.reduce((s, r) => s + (r.billedHours ?? 0), 0)
    : billingRecords.length === 0 ? totalHours : 0;

  const latestBilledDate = billedRecords
    .map(r => r.billedDate ?? '')
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  const totalImageCount = Array.from(imagesByJobId.values()).reduce((s, imgs) => s + imgs.length, 0);

  const vhcSessions = sessions.filter(s => s.vhcStatus !== 'NONE');
  const vhcGreen = sessions.filter(s => s.vhcStatus === 'GREEN').length;
  const vhcOrange = sessions.filter(s => s.vhcStatus === 'ORANGE').length;
  const vhcRed = sessions.filter(s => s.vhcStatus === 'RED').length;
  const latestVhc = sessions.find(s => s.vhcStatus !== 'NONE')?.vhcStatus ?? 'NONE';

  const hasBillingAttention = wipStatus === 'mixed' || (sessions.length > 0 && billingRecords.length === 0);

  // ── Timeline events ─────────────────────────────────────────────────────────

  interface TimelineEvent {
    timestamp: string;
    label: string;
    detail: string;
    type: 'session' | 'billing';
  }

  const timelineEvents: TimelineEvent[] = [
    ...sessions.map(s => {
      const hoursVal = awToHours(s.aw ?? 0);
      const hoursDisplay = hoursVal.toFixed(1);
      return {
        timestamp: s.createdAt,
        label: 'Work session recorded',
        detail: `${s.notes || 'No description'} — ${s.aw}AW ${hoursDisplay}h`,
        type: 'session' as const,
      };
    }),
    ...billingHistory.map(h => ({
      timestamp: h.timestamp,
      label: EVENT_TYPE_LABELS[h.eventType] ?? h.eventType,
      detail: h.description,
      type: 'billing' as const,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // ── Today's date for footer ─────────────────────────────────────────────────
  const todayDisplay = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Metric grid values ──────────────────────────────────────────────────────
  const soldHoursDisplay = totalHours.toFixed(1) + 'h';
  const invoicedHoursDisplay = invoicedHours.toFixed(1) + 'h';
  const openHoursDisplay = openHours.toFixed(1) + 'h';
  const firstWorkedDisplay = formatDate(firstWorked);
  const lastWorkedDisplay = formatDate(lastWorked);

  return (
    <AppBackground>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: PT, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('WipWorkspace: Back button pressed');
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
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>WIP {displayWip}</Text>
            <StatusBadge status={wipStatus} />
          </View>
          {vehicleReg ? (
            <Text style={[styles.headerReg, { color: theme.textSecondary }]}>{vehicleReg}</Text>
          ) : null}
        </View>
      </View>

      {/* CONFLICT BANNER */}
      {hasConflict && (
        <View style={[styles.conflictBanner, { backgroundColor: '#3a0a0a' }]}>
          <Text style={styles.conflictText}>⚠ WIP VEHICLE CONFLICT</Text>
          <TouchableOpacity
            onPress={() => {
              console.log('WipWorkspace: Review in Reconciliation pressed');
              router.push('/reconciliation' as any);
            }}
            style={styles.conflictBtn}
          >
            <Text style={styles.conflictBtnText}>Review in Reconciliation</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SECTION 1 — SUMMARY */}
        <View style={[sectionStyles.wrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={sectionStyles.header}>
            <Text style={[sectionStyles.title, { color: theme.primary }]}>SUMMARY</Text>
          </View>
          <View style={[sectionStyles.body, { borderTopColor: theme.border }]}>
            <View style={styles.metricGrid}>
              <MetricCard label="Work Sessions" value={String(sessionCount)} theme={theme} />
              <MetricCard label="Total AW" value={String(totalAW)} theme={theme} />
              <MetricCard label="Sold Hours" value={soldHoursDisplay} theme={theme} color={theme.primary} />
              <MetricCard label="Invoiced Hours" value={invoicedHoursDisplay} theme={theme} color="#4caf50" />
              <MetricCard label="Open Hours" value={openHoursDisplay} theme={theme} color="#ff9800" />
              <MetricCard label="First Worked" value={firstWorkedDisplay} theme={theme} color={theme.textSecondary} />
              <MetricCard label="Last Worked" value={lastWorkedDisplay} theme={theme} color={theme.textSecondary} />
            </View>
          </View>
        </View>

        {/* SECTION 2 — WORK SESSIONS */}
        <CollapsibleSection title="WORK SESSIONS" badge={sessionCount} defaultOpen={true} theme={theme}>
          {sessions.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No work sessions recorded.</Text>
          ) : (
            sessions.map(session => {
              const sessionDate = session.createdAt.split('T')[0];
              const sessionTime = formatTime(session.createdAt);
              const sessionImages = imagesByJobId.get(session.id) ?? [];
              const sessionCase = cases.find(c => c.linkedJobId === session.id);
              const sessionHoursVal = awToHours(session.aw ?? 0);
              const sessionHoursDisplay = sessionHoursVal.toFixed(1);

              let vhcColor = '#666';
              if (session.vhcStatus === 'GREEN') vhcColor = '#4caf50';
              else if (session.vhcStatus === 'ORANGE') vhcColor = '#ff9800';
              else if (session.vhcStatus === 'RED') vhcColor = '#f44336';

              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.sessionCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => {
                    console.log('WipWorkspace: Session card tapped — jobId:', session.id, 'WIP:', session.wipNumber);
                    router.push({ pathname: '/edit-job', params: { jobId: session.id } } as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.sessionTop}>
                    <View style={styles.sessionDateRow}>
                      <Text style={[styles.sessionDate, { color: theme.text }]}>{sessionDate}</Text>
                      {sessionTime ? (
                        <Text style={[styles.sessionTime, { color: theme.textSecondary }]}>{sessionTime}</Text>
                      ) : null}
                    </View>
                    <VhcBadge status={session.vhcStatus} />
                  </View>
                  <Text style={[styles.sessionNotes, { color: theme.textSecondary }]} numberOfLines={2}>
                    {session.notes || 'No description'}
                  </Text>
                  <View style={styles.sessionStats}>
                    <Text style={[styles.sessionStat, { color: theme.text }]}>AW: {session.aw}</Text>
                    <Text style={[styles.sessionStat, { color: theme.primary }]}>Hours: {sessionHoursDisplay}h</Text>
                    <View style={[styles.vhcInlineBadge, { backgroundColor: vhcColor + '22', borderColor: vhcColor }]}>
                      <Text style={[styles.vhcInlineText, { color: vhcColor }]}>VHC: {session.vhcStatus}</Text>
                    </View>
                  </View>
                  <View style={styles.sessionBadges}>
                    {sessionImages.length > 0 && (
                      <View style={[styles.imageBadge, { backgroundColor: theme.primary + '22' }]}>
                        <Text style={[styles.imageBadgeText, { color: theme.primary }]}>
                          {sessionImages.length} image{sessionImages.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                    {sessionCase && (
                      <View style={[styles.caseBadge, { backgroundColor: '#ff980022' }]}>
                        <Text style={[styles.caseBadgeText, { color: '#ff9800' }]}>Technical Case</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </CollapsibleSection>

        {/* SECTION 3 — BILLING POSITION */}
        <CollapsibleSection title="BILLING POSITION" defaultOpen={true} theme={theme}>
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Status</Text>
            <StatusBadge status={wipStatus} />
          </View>
          <View style={[styles.billingDivider, { backgroundColor: theme.border }]} />
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Sold</Text>
            <Text style={[styles.billingValue, { color: theme.text }]}>{totalHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Invoiced</Text>
            <Text style={[styles.billingValue, { color: '#4caf50' }]}>{invoicedHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Open</Text>
            <Text style={[styles.billingValue, { color: '#ff9800' }]}>{openHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Total AW</Text>
            <Text style={[styles.billingValue, { color: theme.text }]}>{totalAW}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Latest Closure</Text>
            <Text style={[styles.billingValue, { color: theme.text }]}>{latestBilledDate ? formatDate(latestBilledDate) : '—'}</Text>
          </View>
          {hasBillingAttention && (
            <View style={[styles.attentionRow, { backgroundColor: '#3a2a0a', borderColor: '#ff9800' }]}>
              <Text style={styles.attentionText}>⚠ BILLING ATTENTION</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log('WipWorkspace: View Reconciliation pressed from billing attention');
                  router.push('/reconciliation' as any);
                }}
                style={styles.attentionBtn}
              >
                <Text style={styles.attentionBtnText}>View Reconciliation</Text>
              </TouchableOpacity>
            </View>
          )}
        </CollapsibleSection>

        {/* SECTION 4 — BILLING HISTORY */}
        <CollapsibleSection title="BILLING HISTORY" badge={billingHistory.length} defaultOpen={false} theme={theme}>
          {billingHistory.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No billing history recorded.</Text>
          ) : (
            billingHistory
              .slice()
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map(entry => {
                const entryLabel = EVENT_TYPE_LABELS[entry.eventType] ?? entry.eventType;
                const entryTime = formatDateTime(entry.timestamp);
                return (
                  <View key={entry.id} style={[styles.historyEntry, { borderBottomColor: theme.border }]}>
                    <View style={styles.historyEntryTop}>
                      <Text style={[styles.historyTime, { color: theme.textSecondary }]}>{entryTime}</Text>
                      <View style={[styles.historyBadge, { backgroundColor: theme.primary + '22' }]}>
                        <Text style={[styles.historyBadgeText, { color: theme.primary }]}>{entryLabel}</Text>
                      </View>
                    </View>
                    <Text style={[styles.historyDesc, { color: theme.text }]}>{entry.description}</Text>
                  </View>
                );
              })
          )}
        </CollapsibleSection>

        {/* SECTION 5 — VHC SUMMARY (only if any session has VHC) */}
        {vhcSessions.length > 0 && (
          <CollapsibleSection title="VHC SUMMARY" defaultOpen={true} theme={theme}>
            <View style={styles.vhcSummaryRow}>
              <Text style={[styles.billingLabel, { color: theme.textSecondary }]}>Latest VHC</Text>
              <VhcBadge status={latestVhc} />
            </View>
            <Text style={[styles.vhcCountText, { color: theme.textSecondary }]}>
              Sessions with VHC: {vhcSessions.length} of {sessionCount}
            </Text>
            <View style={styles.vhcBreakdown}>
              <Text style={[styles.vhcBreakdownItem, { color: '#4caf50' }]}>Green: {vhcGreen}</Text>
              <Text style={[styles.vhcBreakdownItem, { color: '#ff9800' }]}>Amber: {vhcOrange}</Text>
              <Text style={[styles.vhcBreakdownItem, { color: '#f44336' }]}>Red: {vhcRed}</Text>
            </View>
            <View style={[styles.vhcDivider, { backgroundColor: theme.border }]} />
            {vhcSessions.map(s => {
              const sDate = s.createdAt.split('T')[0];
              const sHours = awToHours(s.aw ?? 0).toFixed(1);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.vhcSessionRow, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    console.log('WipWorkspace: VHC session row tapped — jobId:', s.id);
                    router.push({ pathname: '/edit-job', params: { jobId: s.id } } as any);
                  }}
                >
                  <Text style={[styles.vhcSessionDate, { color: theme.text }]}>{sDate}</Text>
                  <VhcBadge status={s.vhcStatus} />
                  <Text style={[styles.vhcSessionStat, { color: theme.textSecondary }]}>{s.aw}AW</Text>
                  <Text style={[styles.vhcSessionStat, { color: theme.primary }]}>{sHours}h</Text>
                </TouchableOpacity>
              );
            })}
          </CollapsibleSection>
        )}

        {/* SECTION 6 — IMAGES / EVIDENCE */}
        {totalImageCount > 0 && (
          <CollapsibleSection title="IMAGES / EVIDENCE" badge={totalImageCount} defaultOpen={false} theme={theme}>
            <Text style={[styles.imageCountText, { color: theme.textSecondary }]}>
              {totalImageCount} IMAGE{totalImageCount !== 1 ? 'S' : ''}
            </Text>
            {sessions.map(session => {
              const imgs = imagesByJobId.get(session.id) ?? [];
              if (imgs.length === 0) return null;
              const sessionDate = session.createdAt.split('T')[0];
              return (
                <View key={session.id} style={styles.imageGroup}>
                  <Text style={[styles.imageGroupDate, { color: theme.textSecondary }]}>{sessionDate}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                    {imgs.map(img => (
                      <TouchableOpacity
                        key={img.id}
                        onPress={() => {
                          console.log('WipWorkspace: Image thumbnail tapped — imageId:', img.id, 'jobId:', img.jobId);
                        }}
                        style={styles.imageThumbnailWrapper}
                      >
                        <Image
                          source={{ uri: img.uri }}
                          style={styles.imageThumbnail}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              );
            })}
          </CollapsibleSection>
        )}

        {/* SECTION 7 — TECHNICAL CASES */}
        {cases.length > 0 && (
          <CollapsibleSection title="TECHNICAL CASES" badge={cases.length} defaultOpen={false} theme={theme}>
            <Text style={[styles.casesCountText, { color: theme.textSecondary }]}>
              {cases.length} TECHNICAL CASE{cases.length !== 1 ? 'S' : ''}
            </Text>
            {cases.map(tc => (
              <TouchableOpacity
                key={tc.id}
                style={[styles.caseRow, { borderBottomColor: theme.border }]}
                onPress={() => {
                  console.log('WipWorkspace: Technical case tapped — caseId:', tc.id, 'linkedJobId:', tc.linkedJobId);
                  router.push({ pathname: '/technical-cases', params: { jobId: tc.linkedJobId ?? '' } } as any);
                }}
              >
                <Text style={[styles.caseTitle, { color: theme.text }]}>{tc.title}</Text>
                <View style={styles.caseMeta}>
                  <Text style={[styles.caseMetaText, { color: theme.textSecondary }]}>{tc.date}</Text>
                  <Text style={[styles.caseMetaText, { color: theme.textSecondary }]}>{tc.vehicleReg}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </CollapsibleSection>
        )}

        {/* SECTION 8 — WIP TIMELINE */}
        <CollapsibleSection title="WIP TIMELINE" badge={timelineEvents.length} defaultOpen={false} theme={theme}>
          {timelineEvents.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No timeline events recorded.</Text>
          ) : (
            timelineEvents.map((event, idx) => {
              const dotColor = event.type === 'session' ? theme.primary : '#ff9800';
              const eventTime = formatDateTime(event.timestamp);
              return (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                    {idx < timelineEvents.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTime, { color: theme.textSecondary }]}>{eventTime}</Text>
                    <Text style={[styles.timelineLabel, { color: theme.text }]}>{event.label}</Text>
                    <Text style={[styles.timelineDetail, { color: theme.textSecondary }]} numberOfLines={2}>
                      {event.detail}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </CollapsibleSection>

        {/* FOOTER */}
        <Text style={[styles.footer, { color: theme.textSecondary }]}>
          WIP {displayWip} · {sessionCount} Work Session{sessionCount !== 1 ? 's' : ''} · Generated {todayDisplay}
        </Text>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerReg: {
    fontSize: 14,
    marginTop: 2,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  conflictText: {
    color: '#f44336',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  conflictBtn: {
    backgroundColor: '#f4433622',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  conflictBtnText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 0,
  },
  sessionCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 12,
  },
  sessionNotes: {
    fontSize: 13,
    marginBottom: 6,
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sessionStat: {
    fontSize: 12,
    fontWeight: '600',
  },
  vhcInlineBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  vhcInlineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sessionBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  imageBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  caseBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  caseBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  billingLabel: {
    fontSize: 13,
  },
  billingValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  billingDivider: {
    height: 1,
    marginVertical: 4,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  attentionText: {
    color: '#ff9800',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  attentionBtn: {
    backgroundColor: '#ff980022',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attentionBtnText: {
    color: '#ff9800',
    fontSize: 11,
    fontWeight: '600',
  },
  historyEntry: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  historyEntryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 11,
  },
  historyBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyDesc: {
    fontSize: 13,
  },
  vhcSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vhcCountText: {
    fontSize: 13,
    marginBottom: 6,
  },
  vhcBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  vhcBreakdownItem: {
    fontSize: 13,
    fontWeight: '600',
  },
  vhcDivider: {
    height: 1,
    marginVertical: 8,
  },
  vhcSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  vhcSessionDate: {
    fontSize: 13,
    flex: 1,
  },
  vhcSessionStat: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  imageGroup: {
    marginBottom: 12,
  },
  imageGroupDate: {
    fontSize: 12,
    marginBottom: 6,
  },
  imageScroll: {
    flexGrow: 0,
  },
  imageThumbnailWrapper: {
    marginRight: 8,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  casesCountText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  caseRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  caseTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  caseMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  caseMetaText: {
    fontSize: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
  },
  timelineTime: {
    fontSize: 11,
    marginBottom: 2,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  timelineDetail: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  footer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingBottom: 8,
  },
});
