
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { buildFullAnalytics, runScenario, FullAnalytics, ScenarioResult } from '@/utils/analyticsEngine';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ color, width = '100%', height = 16 }: { color: string; width?: string | number; height?: number }) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return (
    <Animated.View
      style={{ backgroundColor: color, borderRadius: 6, height, width: width as any, opacity, marginBottom: 8 }}
    />
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  step,
  min,
  max,
  onDecrement,
  onIncrement,
  primaryColor,
  textColor,
  textSecondary,
  cardColor,
  borderColor,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
  cardColor: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.stepperRow, { borderBottomColor: borderColor }]}>
      <Text style={[styles.stepperLabel, { color: textColor }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          onPress={onDecrement}
          disabled={value <= min}
          style={[styles.stepperBtn, { backgroundColor: value <= min ? borderColor : primaryColor }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="remove" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.stepperValue, { color: textColor }]}>{value.toFixed(step < 1 ? 1 : 0)}</Text>
        <TouchableOpacity
          onPress={onIncrement}
          disabled={value >= max}
          style={[styles.stepperBtn, { backgroundColor: value >= max ? borderColor : primaryColor }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────

function ScenarioCard({
  label,
  result,
  highlight,
  primaryColor,
  cardColor,
  textColor,
  textSecondary,
  borderColor,
  successColor,
  errorColor,
}: {
  label: string;
  result: ScenarioResult;
  highlight?: boolean;
  primaryColor: string;
  cardColor: string;
  textColor: string;
  textSecondary: string;
  borderColor: string;
  successColor: string;
  errorColor: string;
}) {
  const gapColor = result.onTrack ? successColor : errorColor;
  const projHours = result.projectedMonthSoldHours.toFixed(1);
  const projEff = result.projectedEfficiency.toFixed(1);

  return (
    <View
      style={[
        styles.scenarioCard,
        {
          backgroundColor: highlight ? `${primaryColor}18` : cardColor,
          borderColor: highlight ? primaryColor : borderColor,
        },
      ]}
    >
      <Text style={[styles.scenarioLabel, { color: highlight ? primaryColor : textSecondary }]}>{label}</Text>
      <Text style={[styles.scenarioHours, { color: textColor }]}>{projHours}h</Text>
      <Text style={[styles.scenarioEff, { color: textSecondary }]}>{projEff}% eff</Text>
      <View style={[styles.scenarioGapBadge, { backgroundColor: `${gapColor}22` }]}>
        <Text style={[styles.scenarioGapText, { color: gapColor }]}>
          {result.onTrack ? `+${Math.abs(result.targetGap).toFixed(1)}h` : `-${Math.abs(result.targetGap).toFixed(1)}h`}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProjectionsScreen() {
  const { theme } = useThemeContext();

  const [analytics, setAnalytics] = useState<FullAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioExtraHours, setScenarioExtraHours] = useState(0);
  const [scenarioAbsenceDays, setScenarioAbsenceDays] = useState(0);
  const [scenarioOvertimeHours, setScenarioOvertimeHours] = useState(0);
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      console.log('[Projections] Loading analytics');
      try {
        setLoading(true);
        const data = await buildFullAnalytics();
        if (!cancelled) {
          setAnalytics(data);
          console.log('[Projections] Analytics loaded, forecast:', data.month.forecast);
        }
      } catch (e) {
        console.error('[Projections] Analytics load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Scenario calculations
  const medianRate = analytics?.recent.medianDaily ?? 0;

  const conservativeResult: ScenarioResult | null = analytics
    ? (() => {
        const base = runScenario(analytics, {});
        const conservativeRate = medianRate * 0.85;
        const remainingDays = analytics.month.remainingWorkingDays;
        const projectedSold = analytics.month.soldHours + conservativeRate * remainingDays;
        const totalAvailable = analytics.month.availableHours;
        const projectedEfficiency = totalAvailable > 0 ? (projectedSold / totalAvailable) * 100 : 0;
        const targetGap = analytics.month.targetHours - projectedSold;
        const requiredDailyAverage = remainingDays > 0 ? Math.max(0, targetGap) / remainingDays : 0;
        const onTrack = targetGap <= 0;
        return {
          projectedMonthSoldHours: Math.round(projectedSold * 100) / 100,
          projectedEfficiency: Math.round(projectedEfficiency * 10) / 10,
          targetGap: Math.round(targetGap * 100) / 100,
          requiredDailyAverage: Math.round(requiredDailyAverage * 100) / 100,
          onTrack,
          description: onTrack
            ? `On track to exceed target by ${Math.abs(targetGap).toFixed(1)}h`
            : `${targetGap.toFixed(1)}h short — need ${requiredDailyAverage.toFixed(1)}h/day`,
        };
      })()
    : null;

  const expectedResult: ScenarioResult | null = analytics
    ? runScenario(analytics, {})
    : null;

  const optimisticResult: ScenarioResult | null = analytics
    ? (() => {
        const optimisticRate = medianRate * 1.15;
        const remainingDays = analytics.month.remainingWorkingDays;
        const projectedSold = analytics.month.soldHours + optimisticRate * remainingDays;
        const totalAvailable = analytics.month.availableHours;
        const projectedEfficiency = totalAvailable > 0 ? (projectedSold / totalAvailable) * 100 : 0;
        const targetGap = analytics.month.targetHours - projectedSold;
        const requiredDailyAverage = remainingDays > 0 ? Math.max(0, targetGap) / remainingDays : 0;
        const onTrack = targetGap <= 0;
        return {
          projectedMonthSoldHours: Math.round(projectedSold * 100) / 100,
          projectedEfficiency: Math.round(projectedEfficiency * 10) / 10,
          targetGap: Math.round(targetGap * 100) / 100,
          requiredDailyAverage: Math.round(requiredDailyAverage * 100) / 100,
          onTrack,
          description: onTrack
            ? `On track to exceed target by ${Math.abs(targetGap).toFixed(1)}h`
            : `${targetGap.toFixed(1)}h short — need ${requiredDailyAverage.toFixed(1)}h/day`,
        };
      })()
    : null;

  const userScenarioResult: ScenarioResult | null = analytics
    ? runScenario(analytics, {
        extraSoldHoursToday: scenarioExtraHours,
        futureAbsenceDays: scenarioAbsenceDays,
        additionalOvertimeHours: scenarioOvertimeHours,
      })
    : null;

  const handleAskAI = () => {
    console.log('[Projections] Ask AI button pressed');
    router.push('/(tabs)/ai');
  };

  const handleToggleSimulator = () => {
    console.log('[Projections] Toggle simulator:', !showSimulator);
    setShowSimulator(prev => !prev);
  };

  const handleExtraHoursDecrement = () => {
    console.log('[Projections] Extra hours decrement');
    setScenarioExtraHours(prev => Math.max(0, Math.round((prev - 0.5) * 10) / 10));
  };
  const handleExtraHoursIncrement = () => {
    console.log('[Projections] Extra hours increment');
    setScenarioExtraHours(prev => Math.min(12, Math.round((prev + 0.5) * 10) / 10));
  };
  const handleAbsenceDaysDecrement = () => {
    console.log('[Projections] Absence days decrement');
    setScenarioAbsenceDays(prev => Math.max(0, prev - 1));
  };
  const handleAbsenceDaysIncrement = () => {
    console.log('[Projections] Absence days increment');
    setScenarioAbsenceDays(prev => Math.min(analytics?.month.remainingWorkingDays ?? 20, prev + 1));
  };
  const handleOvertimeDecrement = () => {
    console.log('[Projections] Overtime decrement');
    setScenarioOvertimeHours(prev => Math.max(0, Math.round((prev - 0.5) * 10) / 10));
  };
  const handleOvertimeIncrement = () => {
    console.log('[Projections] Overtime increment');
    setScenarioOvertimeHours(prev => Math.min(40, Math.round((prev + 0.5) * 10) / 10));
  };

  // Progress bar value
  const progressValue =
    analytics && analytics.month.targetHours > 0
      ? Math.min(1, analytics.month.soldHours / analytics.month.targetHours)
      : 0;

  const confidenceColors: Record<string, string> = {
    high: theme.success,
    medium: theme.warning,
    low: theme.warning,
    insufficient: theme.textSecondary,
  };

  const onTrackColor = analytics?.month.remainingHours === 0 || (expectedResult?.onTrack ?? false)
    ? theme.success
    : theme.error;

  // Remaining working days list (next 7 days max)
  const remainingDaysList: { label: string; date: string }[] = [];
  if (analytics) {
    const now = new Date();
    const workingDays = [1, 2, 3, 4, 5]; // fallback; schedule not directly available here
    let count = 0;
    for (let i = 1; i <= 31 && count < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      if (d.getMonth() !== now.getMonth()) break;
      if (workingDays.includes(d.getDay())) {
        remainingDaysList.push({
          label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          date: d.toISOString().split('T')[0],
        });
        count++;
      }
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Projections & Forecast',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SkeletonBlock color={theme.border} width="50%" height={14} />
            <SkeletonBlock color={theme.border} width="80%" height={40} />
            <SkeletonBlock color={theme.border} width="100%" height={12} />
            <SkeletonBlock color={theme.border} width="60%" height={12} />
          </View>
        ) : analytics ? (
          <>
            {/* ── Hero Forecast Card ── */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="trending-up" size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Month Forecast</Text>
                <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColors[analytics.month.forecastConfidence]}22` }]}>
                  <Text style={[styles.confidenceText, { color: confidenceColors[analytics.month.forecastConfidence] }]}>
                    {analytics.month.forecastConfidence.toUpperCase()} CONFIDENCE
                  </Text>
                </View>
              </View>

              <Text style={[styles.heroHours, { color: theme.text }]}>
                {analytics.month.forecast.toFixed(1)}
                <Text style={[styles.heroHoursUnit, { color: theme.textSecondary }]}>h</Text>
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                projected sold hours this month
              </Text>

              {/* Progress bar */}
              <View style={styles.progressBarWrapper}>
                <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { backgroundColor: theme.primary, width: `${progressValue * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressBarLabels}>
                  <Text style={[styles.progressBarLabel, { color: theme.textSecondary }]}>
                    {analytics.month.soldHours.toFixed(1)}h sold
                  </Text>
                  <Text style={[styles.progressBarLabel, { color: theme.textSecondary }]}>
                    {analytics.month.targetHours.toFixed(1)}h target
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Three Scenario Cards ── */}
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Scenarios</Text>
            <View style={styles.scenarioRow}>
              {conservativeResult && (
                <ScenarioCard
                  label="Conservative"
                  result={conservativeResult}
                  primaryColor={theme.primary}
                  cardColor={theme.card}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  borderColor={theme.border}
                  successColor={theme.success}
                  errorColor={theme.error}
                />
              )}
              {expectedResult && (
                <ScenarioCard
                  label="Expected"
                  result={expectedResult}
                  highlight
                  primaryColor={theme.primary}
                  cardColor={theme.card}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  borderColor={theme.border}
                  successColor={theme.success}
                  errorColor={theme.error}
                />
              )}
              {optimisticResult && (
                <ScenarioCard
                  label="Optimistic"
                  result={optimisticResult}
                  primaryColor={theme.primary}
                  cardColor={theme.card}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  borderColor={theme.border}
                  successColor={theme.success}
                  errorColor={theme.error}
                />
              )}
            </View>

            {/* ── Target Gap Card ── */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <MaterialIcons
                  name={expectedResult?.onTrack ? 'check-circle' : 'warning'}
                  size={18}
                  color={onTrackColor}
                />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Target Gap</Text>
              </View>
              <View style={styles.gapRow}>
                <View style={styles.gapItem}>
                  <Text style={[styles.gapValue, { color: theme.text }]}>
                    {analytics.month.remainingHours.toFixed(1)}h
                  </Text>
                  <Text style={[styles.gapLabel, { color: theme.textSecondary }]}>Remaining</Text>
                </View>
                <View style={[styles.gapDivider, { backgroundColor: theme.border }]} />
                <View style={styles.gapItem}>
                  <Text style={[styles.gapValue, { color: theme.text }]}>
                    {analytics.month.remainingWorkingDays}
                  </Text>
                  <Text style={[styles.gapLabel, { color: theme.textSecondary }]}>Working Days Left</Text>
                </View>
                <View style={[styles.gapDivider, { backgroundColor: theme.border }]} />
                <View style={styles.gapItem}>
                  <Text style={[styles.gapValue, { color: onTrackColor }]}>
                    {analytics.month.requiredDailyAverage.toFixed(1)}h
                  </Text>
                  <Text style={[styles.gapLabel, { color: theme.textSecondary }]}>Needed/Day</Text>
                </View>
              </View>
              <View style={[styles.onTrackBanner, { backgroundColor: `${onTrackColor}18` }]}>
                <Text style={[styles.onTrackText, { color: onTrackColor }]}>
                  {expectedResult?.onTrack
                    ? `On track — projected to exceed by ${Math.abs(expectedResult.targetGap).toFixed(1)}h`
                    : `Behind — need ${analytics.month.requiredDailyAverage.toFixed(1)}h/day to hit target`}
                </Text>
              </View>
            </View>

            {/* ── Remaining Days Breakdown ── */}
            {remainingDaysList.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="calendar-today" size={18} color={theme.primary} />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Upcoming Working Days</Text>
                </View>
                {remainingDaysList.map((day, i) => (
                  <View
                    key={day.date}
                    style={[
                      styles.dayRow,
                      i < remainingDaysList.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.dayLabel, { color: theme.text }]}>{day.label}</Text>
                    <Text style={[styles.dayTarget, { color: theme.textSecondary }]}>
                      Target: {analytics.month.requiredDailyAverage.toFixed(1)}h
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Scenario Simulator ── */}
            <TouchableOpacity
              style={[styles.simulatorToggle, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleToggleSimulator}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <MaterialIcons name="tune" size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Scenario Simulator</Text>
              </View>
              <MaterialIcons
                name={showSimulator ? 'expand-less' : 'expand-more'}
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {showSimulator && (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 0, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
                <Stepper
                  label="Extra sold hours today"
                  value={scenarioExtraHours}
                  step={0.5}
                  min={0}
                  max={12}
                  onDecrement={handleExtraHoursDecrement}
                  onIncrement={handleExtraHoursIncrement}
                  primaryColor={theme.primary}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  cardColor={theme.card}
                  borderColor={theme.border}
                />
                <Stepper
                  label="Future absence days"
                  value={scenarioAbsenceDays}
                  step={1}
                  min={0}
                  max={analytics.month.remainingWorkingDays}
                  onDecrement={handleAbsenceDaysDecrement}
                  onIncrement={handleAbsenceDaysIncrement}
                  primaryColor={theme.primary}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  cardColor={theme.card}
                  borderColor={theme.border}
                />
                <Stepper
                  label="Additional overtime hours"
                  value={scenarioOvertimeHours}
                  step={0.5}
                  min={0}
                  max={40}
                  onDecrement={handleOvertimeDecrement}
                  onIncrement={handleOvertimeIncrement}
                  primaryColor={theme.primary}
                  textColor={theme.text}
                  textSecondary={theme.textSecondary}
                  cardColor={theme.card}
                  borderColor={theme.border}
                />

                {userScenarioResult && (
                  <View style={[styles.userScenarioResult, { backgroundColor: `${theme.primary}12`, borderColor: theme.primary }]}>
                    <Text style={[styles.userScenarioTitle, { color: theme.primary }]}>Your Scenario</Text>
                    <Text style={[styles.userScenarioHours, { color: theme.text }]}>
                      {userScenarioResult.projectedMonthSoldHours.toFixed(1)}h projected
                    </Text>
                    <Text style={[styles.userScenarioDesc, { color: userScenarioResult.onTrack ? theme.success : theme.error }]}>
                      {userScenarioResult.description}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Ask AI Button ── */}
            <TouchableOpacity
              style={[styles.askAIBtn, { backgroundColor: theme.primary }]}
              onPress={handleAskAI}
              activeOpacity={0.8}
            >
              <MaterialIcons name="auto-awesome" size={18} color="#fff" />
              <Text style={styles.askAIBtnText}>Ask AI to Explain</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              Failed to load analytics. Please try again.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  // Hero
  heroHours: { fontSize: 52, fontWeight: '800', lineHeight: 60 },
  heroHoursUnit: { fontSize: 28, fontWeight: '600' },
  heroSubtitle: { fontSize: 13, marginBottom: 14 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confidenceText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Progress bar
  progressBarWrapper: { marginTop: 4 },
  progressBarTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressBarLabel: { fontSize: 11 },
  // Scenario row
  scenarioRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  scenarioCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  scenarioLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  scenarioHours: { fontSize: 20, fontWeight: '800' },
  scenarioEff: { fontSize: 11, marginTop: 2 },
  scenarioGapBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scenarioGapText: { fontSize: 11, fontWeight: '700' },
  // Gap card
  gapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  gapItem: { flex: 1, alignItems: 'center' },
  gapValue: { fontSize: 22, fontWeight: '800' },
  gapLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  gapDivider: { width: 1, height: 40 },
  onTrackBanner: { borderRadius: 8, padding: 10 },
  onTrackText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Days list
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  dayLabel: { fontSize: 13, fontWeight: '500' },
  dayTarget: { fontSize: 12 },
  // Simulator
  simulatorToggle: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepperLabel: { fontSize: 13, flex: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  userScenarioResult: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  userScenarioTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  userScenarioHours: { fontSize: 28, fontWeight: '800' },
  userScenarioDesc: { fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  // Ask AI
  askAIBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  askAIBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Error
  errorText: { fontSize: 14, textAlign: 'center', padding: 8 },
});
