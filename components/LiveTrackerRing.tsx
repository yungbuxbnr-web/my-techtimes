import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface LiveTrackerRingProps {
  // Original DailyRings props
  dailyHours: number;
  timeElapsedProgress: number;   // 0–100
  timeElapsedLabel: string;
  soldHoursProgress: number;     // 0–100
  soldHoursLabel: string;
  soldColor: string;
  theme: any;
  // New props for tap + status
  onPress: () => void;
  shiftProgress: number;         // 0.0–1.0 (for target marker)
  paceDifference: number;
  isNonWorkingDay: boolean;
  isFullAbsence: boolean;
}

const SVG_SIZE = 200;
const CX = 100;
const CY = 100;

const RING_INNER_RADIUS = 45;
const RING_MIDDLE_RADIUS = 65;
const RING_OUTER_RADIUS = 85;
const STROKE_WIDTH = 10;

function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

function dashOffset(radius: number, progress: number): number {
  const circ = circumference(radius);
  const clamped = Math.min(100, Math.max(0, progress));
  const result = circ * (1 - clamped / 100);
  if (!isFinite(result) || isNaN(result)) return circ;
  return result;
}

function getStatusInfo(
  paceDifference: number,
  shiftProgress: number,
  isNonWorkingDay: boolean,
  isFullAbsence: boolean,
  theme: any,
): { label: string; color: string } {
  if (isFullAbsence) return { label: 'Full-day absence', color: theme.chartRed };
  if (isNonWorkingDay) return { label: 'Non-working day', color: theme.textSecondary };
  if (shiftProgress >= 1.0) return { label: 'Shift complete', color: theme.primary };
  if (shiftProgress < 0.01) return { label: 'Shift not started', color: theme.textSecondary };
  if (paceDifference >= 0.5) return { label: 'Ahead of pace', color: theme.chartGreen };
  if (paceDifference >= -0.25) return { label: 'On target', color: theme.chartGreen };
  if (paceDifference >= -0.75) return { label: 'Slightly behind', color: theme.chartYellow };
  return { label: 'Attention required', color: theme.chartRed };
}

export default function LiveTrackerRing({
  dailyHours,
  timeElapsedProgress,
  timeElapsedLabel,
  soldHoursProgress,
  soldHoursLabel,
  soldColor,
  theme,
  onPress,
  shiftProgress,
  paceDifference,
  isNonWorkingDay,
  isFullAbsence,
}: LiveTrackerRingProps) {
  const trackColor = 'rgba(255,255,255,0.08)';

  const innerCirc = circumference(RING_INNER_RADIUS);
  const middleCirc = circumference(RING_MIDDLE_RADIUS);
  const outerCirc = circumference(RING_OUTER_RADIUS);

  const innerOffset = dashOffset(RING_INNER_RADIUS, 100);
  const middleOffset = dashOffset(RING_MIDDLE_RADIUS, timeElapsedProgress);
  const outerOffset = dashOffset(RING_OUTER_RADIUS, soldHoursProgress);

  const dailyHoursDisplay = dailyHours.toFixed(1) + 'h';

  // Target marker: position on outer ring at shiftProgress angle
  const clampedShift = Math.min(1, Math.max(0, shiftProgress));
  const markerAngle = (clampedShift - 0.25) * 2 * Math.PI; // -90deg offset
  const markerX = CX + RING_OUTER_RADIUS * Math.cos(markerAngle);
  const markerY = CY + RING_OUTER_RADIUS * Math.sin(markerAngle);

  const { label: statusLabel, color: statusColor } = getStatusInfo(
    paceDifference,
    shiftProgress,
    isNonWorkingDay,
    isFullAbsence,
    theme,
  );

  return (
    <TouchableOpacity
      onPress={() => {
        console.log('[LiveTrackerRing] Ring tapped — opening Live Tracker modal');
        onPress();
      }}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      {/* SVG rings */}
      <View style={styles.svgContainer}>
        <Svg width={SVG_SIZE} height={SVG_SIZE}>
          {/* Ring 1 — Daily Target (innermost) — track */}
          <Circle
            cx={CX} cy={CY} r={RING_INNER_RADIUS}
            stroke={trackColor} strokeWidth={STROKE_WIDTH} fill="none"
          />
          {/* Ring 1 — Daily Target — full static arc */}
          <Circle
            cx={CX} cy={CY} r={RING_INNER_RADIUS}
            stroke={theme.primary + '66'} strokeWidth={STROKE_WIDTH} fill="none"
            strokeDasharray={innerCirc} strokeDashoffset={innerOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {/* Ring 2 — Time Elapsed (middle) — track */}
          <Circle
            cx={CX} cy={CY} r={RING_MIDDLE_RADIUS}
            stroke={trackColor} strokeWidth={STROKE_WIDTH} fill="none"
          />
          {/* Ring 2 — Time Elapsed — progress arc */}
          <Circle
            cx={CX} cy={CY} r={RING_MIDDLE_RADIUS}
            stroke={theme.chartYellow} strokeWidth={STROKE_WIDTH} fill="none"
            strokeDasharray={middleCirc} strokeDashoffset={middleOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {/* Ring 3 — Sold Hours (outermost) — track */}
          <Circle
            cx={CX} cy={CY} r={RING_OUTER_RADIUS}
            stroke={trackColor} strokeWidth={STROKE_WIDTH} fill="none"
          />
          {/* Ring 3 — Sold Hours — progress arc */}
          <Circle
            cx={CX} cy={CY} r={RING_OUTER_RADIUS}
            stroke={soldColor} strokeWidth={STROKE_WIDTH} fill="none"
            strokeDasharray={outerCirc} strokeDashoffset={outerOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {/* Target marker dot on outer ring */}
          {clampedShift > 0.01 && !isNonWorkingDay && !isFullAbsence && (
            <Circle
              cx={markerX} cy={markerY} r={5}
              fill={theme.chartYellow}
            />
          )}
        </Svg>

        {/* Centre label absolutely positioned over SVG */}
        <View style={styles.centreLabel} pointerEvents="none">
          <Text style={[styles.centreLabelValue, { color: theme.primary }]}>
            {dailyHoursDisplay}
          </Text>
          <Text style={[styles.centreLabelTitle, { color: theme.textSecondary }]}>
            Daily Target
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary + '66' }]} />
          <Text style={[styles.legendKey, { color: theme.textSecondary }]}>Daily Target</Text>
          <Text style={[styles.legendVal, { color: theme.text }]}>{dailyHoursDisplay}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: theme.chartYellow }]} />
          <Text style={[styles.legendKey, { color: theme.textSecondary }]}>Time Elapsed</Text>
          <Text style={[styles.legendVal, { color: theme.text }]}>{timeElapsedLabel}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: soldColor }]} />
          <Text style={[styles.legendKey, { color: theme.textSecondary }]}>Sold Today</Text>
          <Text style={[styles.legendVal, { color: theme.text }]}>{soldHoursLabel}</Text>
        </View>
      </View>

      {/* Status text */}
      <Text style={[styles.statusText, { color: statusColor }]}>
        {statusLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  svgContainer: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLabelValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  centreLabelTitle: {
    fontSize: 10,
    marginTop: 2,
  },
  legend: {
    marginTop: 12,
    width: '100%',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendKey: {
    fontSize: 12,
    flex: 1,
  },
  legendVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
