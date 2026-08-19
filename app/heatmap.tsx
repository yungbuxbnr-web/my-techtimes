
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';

type Metric = 'recorded' | 'billed' | 'jobs' | 'efficiency';

const METRIC_LABELS: Record<Metric, string> = {
  recorded: 'Recorded',
  billed: 'Billed',
  jobs: 'Jobs',
  efficiency: 'Efficiency',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayColor(value: number, metric: Metric): string {
  if (value === 0) return 'transparent';
  if (metric === 'efficiency') {
    if (value < 70) return '#fde68a';
    if (value <= 100) return '#22c55e';
    return '#60a5fa';
  }
  if (metric === 'jobs') {
    if (value <= 2) return '#86efac';
    if (value <= 5) return '#22c55e';
    return '#15803d';
  }
  // hours
  if (value < 1) return '#bbf7d0';
  if (value < 3) return '#86efac';
  if (value < 6) return '#22c55e';
  return '#15803d';
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function HeatmapScreen() {
  console.log('HeatmapScreen: Rendering');
  const { theme } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [metric, setMetric] = useState<Metric>('recorded');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  useEffect(() => {
    console.log('HeatmapScreen: Loading jobs and billing records');
    Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]).then(([jobs, billing]) => {
      console.log('HeatmapScreen: Loaded', jobs.length, 'jobs and', billing.length, 'billing records');
      setAllJobs(jobs);
      setBillingRecords(billing);
    });
  }, []);

  const billingByJobId = useMemo(() => {
    const m = new Map<string, BillingRecord>();
    billingRecords.forEach(r => m.set(r.jobId, r));
    return m;
  }, [billingRecords]);

  const jobsByDate = useMemo(() => {
    const m = new Map<string, Job[]>();
    allJobs.forEach(j => {
      const d = j.createdAt.split('T')[0];
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(j);
    });
    return m;
  }, [allJobs]);

  const metricByDate = useMemo(() => {
    const m = new Map<string, number>();
    jobsByDate.forEach((jobs, date) => {
      let val = 0;
      if (metric === 'jobs') {
        val = jobs.length;
      } else if (metric === 'recorded') {
        val = jobs.reduce((s, j) => s + (j.aw * 5) / 60, 0);
      } else if (metric === 'billed') {
        val = jobs.reduce((s, j) => {
          const br = billingByJobId.get(j.id);
          return s + (br?.billingStatus === 'billed' ? br.billedHours : 0);
        }, 0);
      } else if (metric === 'efficiency') {
        const recorded = jobs.reduce((s, j) => s + (j.aw * 5) / 60, 0);
        const available = 8;
        val = recorded > 0 ? (recorded / available) * 100 : 0;
      }
      m.set(date, val);
    });
    return m;
  }, [jobsByDate, billingByJobId, metric]);

  const monthDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    // Monday = 0
    return (d.getDay() + 6) % 7;
  }, [viewYear, viewMonth]);

  const monthLabel = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    console.log('HeatmapScreen: Navigate to previous month');
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    console.log('HeatmapScreen: Navigate to next month');
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  const selectedJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobsByDate.get(selectedDate) || [];
  }, [selectedDate, jobsByDate]);

  // Build grid cells: leading empty + day cells
  const gridCells = useMemo(() => {
    const cells: (null | Date)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    monthDays.forEach(d => cells.push(d));
    return cells;
  }, [monthDays, firstDayOfWeek]);

  const CELL_SIZE = 40;

  const legendItems = [
    { label: 'No Data', color: theme.border },
    { label: 'Low', color: '#86efac' },
    { label: 'Average', color: '#22c55e' },
    { label: 'Strong', color: '#15803d' },
    { label: 'Excellent', color: '#166534' },
  ];

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('HeatmapScreen: Back button pressed');
            router.back();
          }}
          style={styles.iconBtn}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Performance Heatmap</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Metric selector */}
        <View style={styles.metricRow}>
          {(Object.keys(METRIC_LABELS) as Metric[]).map(m => {
            const isActive = metric === m;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.metricBtn,
                  { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
                ]}
                onPress={() => {
                  console.log('HeatmapScreen: Metric changed to', m);
                  setMetric(m);
                  setSelectedDate(null);
                }}
              >
                <Text style={[styles.metricBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                  {METRIC_LABELS[m]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.iconBtn}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={22}
              color={theme.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: theme.text }]}>{monthLabel}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.iconBtn}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={22}
              color={theme.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={styles.dayLabelsRow}>
          {DAY_LABELS.map(d => (
            <View key={d} style={[styles.dayLabelCell, { width: CELL_SIZE }]}>
              <Text style={[styles.dayLabelText, { color: theme.textSecondary }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {gridCells.map((cell, idx) => {
            if (!cell) {
              return <View key={`empty-${idx}`} style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]} />;
            }
            const dateStr = isoDate(cell);
            const val = metricByDate.get(dateStr) || 0;
            const cellColor = val > 0 ? getDayColor(val, metric) : 'transparent';
            const isSelected = selectedDate === dateStr;
            const dayNum = cell.getDate();
            const isToday = dateStr === isoDate(new Date());
            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.cell,
                  {
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: cellColor,
                    borderColor: isSelected ? theme.primary : isToday ? theme.primary : theme.border,
                    borderWidth: isSelected || isToday ? 2 : 1,
                    opacity: val === 0 ? 0.4 : 1,
                  },
                ]}
                onPress={() => {
                  console.log('HeatmapScreen: Day cell tapped', dateStr, 'value:', val);
                  setSelectedDate(prev => (prev === dateStr ? null : dateStr));
                }}
              >
                <Text
                  style={[
                    styles.cellText,
                    { color: val > 0 ? '#fff' : theme.textSecondary },
                  ]}
                >
                  {dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {legendItems.map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Selected day panel */}
        {selectedDate ? (
          <View style={[styles.dayPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dayPanelTitle, { color: theme.text }]}>{selectedDate}</Text>
            {selectedJobs.length === 0 ? (
              <Text style={[styles.dayPanelEmpty, { color: theme.textSecondary }]}>No jobs on this day</Text>
            ) : (
              selectedJobs.map(j => {
                const br = billingByJobId.get(j.id);
                const isBilled = br?.billingStatus === 'billed';
                const jobHours = ((j.aw * 5) / 60).toFixed(2);
                const chipLabel = isBilled ? 'Billed' : 'Open';
                const chipColor = isBilled ? theme.chartGreen : theme.chartRed;
                return (
                  <View key={j.id} style={[styles.dayPanelJob, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dayPanelWip, { color: theme.text }]}>WIP {j.wipNumber}</Text>
                      <Text style={[styles.dayPanelReg, { color: theme.textSecondary }]}>{j.vehicleReg}</Text>
                    </View>
                    <Text style={[styles.dayPanelHours, { color: theme.primary }]}>{jobHours}h</Text>
                    <View style={[styles.chip, { backgroundColor: chipColor }]}>
                      <Text style={styles.chipText}>{chipLabel}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  metricBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  metricBtnText: { fontSize: 13, fontWeight: '600' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: { fontSize: 17, fontWeight: '700' },
  dayLabelsRow: { flexDirection: 'row', marginBottom: 4 },
  dayLabelCell: { alignItems: 'center' },
  dayLabelText: { fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginBottom: 16 },
  cell: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 11, fontWeight: '600' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11 },
  dayPanel: { borderRadius: 14, borderWidth: 1, padding: 14 },
  dayPanelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  dayPanelEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  dayPanelJob: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  dayPanelWip: { fontSize: 14, fontWeight: '600' },
  dayPanelReg: { fontSize: 12 },
  dayPanelHours: { fontSize: 14, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
