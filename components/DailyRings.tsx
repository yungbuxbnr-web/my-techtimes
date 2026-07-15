import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface DailyRingsProps {
  dailyHours: number;
  timeElapsedProgress: number;
  timeElapsedLabel: string;
  soldHoursProgress: number;
  soldHoursLabel: string;
  soldColor: string;
  theme: any;
}

const SVG_SIZE = 200;
const CX = 100;
const CY = 100;

const RING_INNER_RADIUS = 45;
const RING_MIDDLE_RADIUS = 65;
const RING_OUTER_RADIUS = 85;
const STROKE_WIDTH = 10;

function circumference(radius: number) {
  return 2 * Math.PI * radius;
}

function dashOffset(radius: number, progress: number) {
  const circ = circumference(radius);
  const clamped = Math.min(100, Math.max(0, progress));
  const result = circ * (1 - clamped / 100);
  if (!isFinite(result) || isNaN(result)) return circ;
  return result;
}

export default function DailyRings({
  dailyHours,
  timeElapsedProgress,
  timeElapsedLabel,
  soldHoursProgress,
  soldHoursLabel,
  soldColor,
  theme,
}: DailyRingsProps) {
  const trackColor = 'rgba(255,255,255,0.08)';

  const innerCirc = circumference(RING_INNER_RADIUS);
  const middleCirc = circumference(RING_MIDDLE_RADIUS);
  const outerCirc = circumference(RING_OUTER_RADIUS);

  const innerOffset = dashOffset(RING_INNER_RADIUS, 100);
  const middleOffset = dashOffset(RING_MIDDLE_RADIUS, timeElapsedProgress);
  const outerOffset = dashOffset(RING_OUTER_RADIUS, soldHoursProgress);

  const dailyHoursDisplay = dailyHours.toFixed(1) + 'h';

  return (
    <View style={styles.wrapper}>
      {/* SVG rings */}
      <View style={styles.svgContainer}>
        <Svg width={SVG_SIZE} height={SVG_SIZE}>
          {/* Ring 1 — Daily Target (innermost) — track */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_INNER_RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Ring 1 — Daily Target — full static arc */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_INNER_RADIUS}
            stroke={theme.primary + '66'}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={innerCirc}
            strokeDashoffset={innerOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {/* Ring 2 — Time Elapsed (middle) — track */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_MIDDLE_RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Ring 2 — Time Elapsed — progress arc */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_MIDDLE_RADIUS}
            stroke={theme.chartYellow}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={middleCirc}
            strokeDashoffset={middleOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />

          {/* Ring 3 — Sold Hours (outermost) — track */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_OUTER_RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Ring 3 — Sold Hours — progress arc */}
          <Circle
            cx={CX}
            cy={CY}
            r={RING_OUTER_RADIUS}
            stroke={soldColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={outerCirc}
            strokeDashoffset={outerOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
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
    </View>
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
});
