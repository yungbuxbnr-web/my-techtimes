import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import LiveTrackerRing from '@/components/LiveTrackerRing';

interface LiveTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  soldHours: number;
  targetHours: number;
  shiftProgress: number;
  expectedSoldHours: number;
  paceDifference: number;
  forecastSoldHours: number;
  efficiency: number;
  shiftStart: string;
  shiftEnd: string;
  lunchStart: string;
  lunchEnd: string;
  scheduledHours: number;
  timeRemainingMinutes: number;
  elapsedMinutes: number;
  totalWorkMinutes: number;
  todayJobCount: number;
  todayTotalAw: number;
  isNonWorkingDay: boolean;
  isFullAbsence: boolean;
  isBeforeShift: boolean;
  isAfterShift: boolean;
  absenceType?: string;
  absenceHours?: number;
  isOvertime?: boolean;
  isCompensation?: boolean;
  theme: any;
  onViewJobs: () => void;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function getPaceColor(paceDifference: number, theme: any): string {
  if (paceDifference >= 0.5) return theme.chartGreen;
  if (paceDifference >= -0.25) return theme.chartGreen;
  if (paceDifference >= -0.75) return theme.chartYellow;
  return theme.chartRed;
}

function getStatusLabel(
  paceDifference: number,
  shiftProgress: number,
  isNonWorkingDay: boolean,
  isFullAbsence: boolean,
): string {
  if (isFullAbsence) return 'Full-day absence';
  if (isNonWorkingDay) return 'Non-working day';
  if (shiftProgress >= 1.0) return 'Shift complete';
  if (paceDifference >= 0.5) return 'Ahead of pace';
  if (paceDifference >= -0.25) return 'On target';
  if (paceDifference >= -0.75) return 'Slightly behind';
  return 'Attention required';
}

function getStatusColor(
  paceDifference: number,
  shiftProgress: number,
  isNonWorkingDay: boolean,
  isFullAbsence: boolean,
  theme: any,
): string {
  if (isFullAbsence) return theme.chartRed;
  if (isNonWorkingDay) return theme.textSecondary;
  if (shiftProgress >= 1.0) return theme.primary;
  if (paceDifference >= 0.5) return theme.chartGreen;
  if (paceDifference >= -0.25) return theme.chartGreen;
  if (paceDifference >= -0.75) return theme.chartYellow;
  return theme.chartRed;
}

export default function LiveTrackerModal({
  visible,
  onClose,
  soldHours,
  targetHours,
  shiftProgress,
  expectedSoldHours,
  paceDifference,
  forecastSoldHours,
  efficiency,
  shiftStart,
  shiftEnd,
  lunchStart,
  lunchEnd,
  scheduledHours,
  timeRemainingMinutes,
  elapsedMinutes,
  totalWorkMinutes,
  todayJobCount,
  todayTotalAw,
  isNonWorkingDay,
  isFullAbsence,
  isBeforeShift,
  isAfterShift,
  absenceType,
  absenceHours,
  isOvertime,
  isCompensation,
  theme,
  onViewJobs,
}: LiveTrackerModalProps) {
  const statusLabel = getStatusLabel(paceDifference, shiftProgress, isNonWorkingDay, isFullAbsence);
  const statusColor = getStatusColor(paceDifference, shiftProgress, isNonWorkingDay, isFullAbsence, theme);
  const paceColor = getPaceColor(paceDifference, theme);

  const paceSign = paceDifference >= 0 ? '+' : '';
  const paceDisplay = paceSign + paceDifference.toFixed(2) + 'h';

  const expectedDisplay = expectedSoldHours.toFixed(2) + 'h';
  const forecastDisplay = shiftProgress > 0.05 ? forecastSoldHours.toFixed(2) + 'h' : soldHours.toFixed(2) + 'h';
  const forecastEfficiency = targetHours > 0 ? (forecastSoldHours / targetHours) * 100 : 0;
  const forecastEffDisplay = forecastEfficiency.toFixed(0) + '%';

  const hoursNeeded = Math.max(0, targetHours - soldHours);
  const hoursNeededDisplay = hoursNeeded.toFixed(2) + 'h more';

  const avgAwPerJob = todayJobCount > 0 ? todayTotalAw / todayJobCount : 0;
  const avgAwDisplay = avgAwPerJob.toFixed(1);

  const soldTodayDisplay = soldHours.toFixed(2) + 'h';
  const targetDisplay = targetHours.toFixed(1) + 'h';
  const efficiencyDisplay = efficiency.toFixed(0) + '%';

  const elapsedPct = totalWorkMinutes > 0 ? Math.round((elapsedMinutes / totalWorkMinutes) * 100) : 0;
  const elapsedDisplay = formatMinutes(elapsedMinutes) + ' (' + elapsedPct + '%)';
  const remainingDisplay = formatMinutes(timeRemainingMinutes);
  const scheduledDisplay = scheduledHours.toFixed(1) + 'h';

  const hasAdjustments = !!(absenceType || isOvertime || isCompensation);

  // Progress bar widths (0–100)
  const soldBarPct = targetHours > 0 ? Math.min(100, (soldHours / targetHours) * 100) : 0;
  const expectedBarPct = targetHours > 0 ? Math.min(100, (expectedSoldHours / targetHours) * 100) : 0;

  const forecastOnTrack = forecastSoldHours >= targetHours * 0.95;
  const forecastBehind = forecastSoldHours < targetHours * 0.75;
  const forecastMessage = shiftProgress < 0.05
    ? 'Shift just started'
    : forecastOnTrack
    ? 'On track to reach target'
    : forecastBehind
    ? 'Behind — pace needs to increase'
    : 'Slightly behind target pace';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        console.log('[LiveTrackerModal] Modal closed via back button');
        onClose();
      }}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Today's Live Tracker</Text>
          <TouchableOpacity
            onPress={() => {
              console.log('[LiveTrackerModal] Close button pressed');
              onClose();
            }}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AntDesign name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Live Progress */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>LIVE PROGRESS</Text>

            <View style={styles.ringRow}>
              <LiveTrackerRing
                size={240}
                soldHours={soldHours}
                targetHours={targetHours}
                shiftProgress={shiftProgress}
                expectedSoldHours={expectedSoldHours}
                paceDifference={paceDifference}
                isNonWorkingDay={isNonWorkingDay}
                isFullAbsence={isFullAbsence}
                isBeforeShift={isBeforeShift}
                isAfterShift={isAfterShift}
                theme={theme}
                onPress={() => {
                  console.log('[LiveTrackerModal] Inner ring tapped — closing modal');
                  onClose();
                }}
              />
            </View>

            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{soldTodayDisplay}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sold Today</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{targetDisplay}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Target</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: paceColor }]}>{efficiencyDisplay}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Efficiency</Text>
              </View>
            </View>

            {/* Expected / Pace row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{expectedDisplay}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Expected by now</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: paceColor }]}>{paceDisplay}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pace difference</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Expected Performance */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>EXPECTED PERFORMANCE</Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Expected sold hours now</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{expectedDisplay}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                {paceDifference >= 0 ? 'You are ahead by' : 'You are behind by'}
              </Text>
              <Text style={[styles.infoValue, { color: paceColor }]}>
                {Math.abs(paceDifference).toFixed(2)}h
              </Text>
            </View>

            {/* Two-colour progress bar */}
            <View style={styles.progressBarWrapper}>
              <Text style={[styles.progressBarLabel, { color: theme.textSecondary }]}>Sold vs Expected</Text>
              <View style={[styles.progressBarTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                {/* Expected bar (behind) */}
                <View
                  style={[
                    styles.progressBarExpected,
                    {
                      width: `${expectedBarPct}%`,
                      backgroundColor: theme.chartYellow + '55',
                    },
                  ]}
                />
                {/* Sold bar (on top) */}
                <View
                  style={[
                    styles.progressBarSold,
                    {
                      width: `${soldBarPct}%`,
                      backgroundColor: paceColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressBarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: paceColor }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>Sold</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.chartYellow + '88' }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>Expected</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Still needed to reach target</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{hoursNeededDisplay}</Text>
            </View>
          </View>

          {/* Section 3: End-of-Day Forecast */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>END-OF-DAY FORECAST</Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Forecasted sold hours</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{forecastDisplay}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Forecasted efficiency</Text>
              <Text style={[styles.infoValue, { color: paceColor }]}>{forecastEffDisplay}</Text>
            </View>

            <View style={[styles.forecastMessage, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.forecastMessageText, { color: statusColor }]}>{forecastMessage}</Text>
            </View>
          </View>

          {/* Section 4: Today's Jobs */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>TODAY'S JOBS</Text>

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                console.log('[LiveTrackerModal] View jobs tapped');
                onViewJobs();
              }}
            >
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Completed jobs today</Text>
              <View style={styles.tappableValue}>
                <Text style={[styles.infoValue, { color: theme.primary }]}>{todayJobCount}</Text>
                <AntDesign name="right" size={12} color={theme.primary} style={styles.chevron} />
              </View>
            </TouchableOpacity>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Total AW today</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{todayTotalAw}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Total sold hours today</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{soldTodayDisplay}</Text>
            </View>

            {todayJobCount > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Average AW per job</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{avgAwDisplay}</Text>
              </View>
            )}
          </View>

          {/* Section 5: Time and Schedule */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>TIME AND SCHEDULE</Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Shift start</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{shiftStart}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Shift end</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{shiftEnd}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Lunch</Text>
              <Text style={[styles.infoValue, { color: theme.chartYellow }]}>
                {lunchStart}
                {' - '}
                {lunchEnd}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Time remaining</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{remainingDisplay}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Shift elapsed</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{elapsedDisplay}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Scheduled hours today</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{scheduledDisplay}</Text>
            </View>
          </View>

          {/* Section 6: Absence and Overtime Adjustments */}
          {hasAdjustments && (
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>ADJUSTMENTS</Text>

              {absenceType && !isOvertime && !isCompensation && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Today's absence</Text>
                  <Text style={[styles.infoValue, { color: theme.chartRed }]}>
                    {absenceType}
                    {absenceHours != null ? ' (' + absenceHours.toFixed(1) + 'h deducted)' : ''}
                  </Text>
                </View>
              )}

              {isOvertime && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Overtime day</Text>
                  <Text style={[styles.infoValue, { color: theme.chartGreen }]}>
                    {absenceHours != null ? '+' + absenceHours.toFixed(1) + 'h' : 'Marked'}
                  </Text>
                </View>
              )}

              {isCompensation && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Compensation day</Text>
                  <Text style={[styles.infoValue, { color: theme.chartYellow }]}>Applied</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Adjusted available hours</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{scheduledDisplay}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  ringRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  tappableValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 4,
  },
  progressBarWrapper: {
    marginVertical: 12,
  },
  progressBarLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarExpected: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 5,
  },
  progressBarSold: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 5,
  },
  progressBarLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  forecastMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  forecastMessageText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
