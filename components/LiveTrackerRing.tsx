import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface LiveTrackerRingProps {
  size: number;
  soldHours: number;
  targetHours: number;
  shiftProgress: number;
  expectedSoldHours: number;
  paceDifference: number;
  isNonWorkingDay: boolean;
  isFullAbsence: boolean;
  isBeforeShift: boolean;
  isAfterShift: boolean;
  theme: any;
  onPress: () => void;
}

function getStatusInfo(
  paceDifference: number,
  shiftProgress: number,
  isNonWorkingDay: boolean,
  isFullAbsence: boolean,
  theme: any,
): { label: string; color: string } {
  if (isFullAbsence) {
    return { label: 'Full-day absence', color: theme.chartRed };
  }
  if (isNonWorkingDay) {
    return { label: 'Non-working day', color: theme.textSecondary };
  }
  if (shiftProgress >= 1.0) {
    return { label: 'Shift complete', color: theme.primary };
  }
  if (paceDifference >= 0.5) {
    return { label: 'Ahead of pace', color: theme.chartGreen };
  }
  if (paceDifference >= -0.25) {
    return { label: 'On target', color: theme.chartGreen };
  }
  if (paceDifference >= -0.75) {
    return { label: 'Slightly behind', color: theme.chartYellow };
  }
  return { label: 'Attention required', color: theme.chartRed };
}

export default function LiveTrackerRing({
  size,
  soldHours,
  targetHours,
  shiftProgress,
  expectedSoldHours: _expectedSoldHours,
  paceDifference,
  isNonWorkingDay,
  isFullAbsence,
  isBeforeShift: _isBeforeShift,
  isAfterShift: _isAfterShift,
  theme,
  onPress,
}: LiveTrackerRingProps) {
  const cx = size / 2;
  const cy = size / 2;

  const outerRadius = size / 2 - 8;
  const mainRadius = size / 2 - 22;

  const outerStrokeWidth = 5;
  const mainStrokeWidth = 16;

  const outerCirc = 2 * Math.PI * outerRadius;
  const mainCirc = 2 * Math.PI * mainRadius;

  const clampedShift = Math.min(1, Math.max(0, shiftProgress));
  const soldProgress = targetHours > 0 ? Math.min(1, soldHours / targetHours) : 0;

  const outerOffset = outerCirc * (1 - clampedShift);
  const mainOffset = mainCirc * (1 - soldProgress);

  const { label: statusLabel, color: statusColor } = getStatusInfo(
    paceDifference,
    shiftProgress,
    isNonWorkingDay,
    isFullAbsence,
    theme,
  );

  // Target marker position: angle based on shiftProgress
  const markerAngle = (clampedShift - 0.25) * 2 * Math.PI;
  const markerX = cx + mainRadius * Math.cos(markerAngle);
  const markerY = cy + mainRadius * Math.sin(markerAngle);

  const soldDisplay = soldHours.toFixed(2);
  const targetDisplay = targetHours.toFixed(1) + 'h';

  return (
    <TouchableOpacity
      onPress={() => {
        console.log('[LiveTrackerRing] Ring tapped — opening Live Tracker modal');
        onPress();
      }}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      <View style={[styles.svgContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Outer ring track (shift elapsed) */}
          <Circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={outerStrokeWidth}
            fill="none"
          />
          {/* Outer ring progress */}
          <Circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            stroke={theme.chartYellow}
            strokeWidth={outerStrokeWidth}
            fill="none"
            strokeDasharray={outerCirc}
            strokeDashoffset={outerOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />

          {/* Main ring track (sold hours) */}
          <Circle
            cx={cx}
            cy={cy}
            r={mainRadius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={mainStrokeWidth}
            fill="none"
          />
          {/* Main ring progress */}
          <Circle
            cx={cx}
            cy={cy}
            r={mainRadius}
            stroke={statusColor}
            strokeWidth={mainStrokeWidth}
            fill="none"
            strokeDasharray={mainCirc}
            strokeDashoffset={mainOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />

          {/* Target marker dot */}
          {clampedShift > 0.01 && (
            <Circle
              cx={markerX}
              cy={markerY}
              r={5}
              fill={theme.chartYellow}
            />
          )}
        </Svg>

        {/* Centre text */}
        <View style={styles.centreLabel} pointerEvents="none">
          <View style={styles.centreRow}>
            <Text style={[styles.soldText, { color: statusColor }]}>
              {soldDisplay}
            </Text>
            <Text style={[styles.separatorText, { color: theme.textSecondary }]}>
              /
            </Text>
            <Text style={[styles.targetText, { color: theme.textSecondary }]}>
              {targetDisplay}
            </Text>
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  soldText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  separatorText: {
    fontSize: 20,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  targetText: {
    fontSize: 16,
    fontWeight: '400',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
