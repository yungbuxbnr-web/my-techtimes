
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';

type Period = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ENTIRE';
type CardType = 'withVhc' | 'withoutVhc' | 'green' | 'amber' | 'red';

const PERIODS: Period[] = ['DAY', 'WEEK', 'MONTH', 'YEAR', 'ENTIRE'];

function filterByPeriod(jobs: Job[], period: Period): Job[] {
  if (period === 'ENTIRE') return jobs;
  const now = new Date();
  const cutoff = new Date();
  if (period === 'DAY') cutoff.setHours(0, 0, 0, 0);
  else if (period === 'WEEK') cutoff.setDate(now.getDate() - 7);
  else if (period === 'MONTH') cutoff.setMonth(now.getMonth(), 1);
  else if (period === 'YEAR') cutoff.setMonth(0, 1);
  return jobs.filter(j => new Date(j.createdAt) >= cutoff);
}

export default function VhcIntelligenceScreen() {
  console.log('VhcIntelligenceScreen: Rendering');
  const { theme } = useThemeContext();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [period, setPeriod] = useState<Period>('MONTH');
  const [expandedCard, setExpandedCard] = useState<CardType | null>(null);

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  useEffect(() => {
    console.log('VhcIntelligenceScreen: Loading jobs');
    api.getAllJobs().then(jobs => {
      console.log('VhcIntelligenceScreen: Loaded', jobs.length, 'jobs');
      setAllJobs(jobs);
    });
  }, []);

  const filteredJobs = useMemo(() => filterByPeriod(allJobs, period), [allJobs, period]);

  const stats = useMemo(() => {
    const total = filteredJobs.length;
    const withVhc = filteredJobs.filter(j => j.vhcStatus !== 'NONE');
    const withoutVhc = filteredJobs.filter(j => j.vhcStatus === 'NONE');
    const green = filteredJobs.filter(j => j.vhcStatus === 'GREEN');
    const amber = filteredJobs.filter(j => j.vhcStatus === 'ORANGE');
    const red = filteredJobs.filter(j => j.vhcStatus === 'RED');
    const vhcRate = total > 0 ? (withVhc.length / total) * 100 : 0;
    return { total, withVhc, withoutVhc, green, amber, red, vhcRate };
  }, [filteredJobs]);

  const cardData: { type: CardType; label: string; value: string; sub: string; color: string; jobs: Job[] }[] = [
    {
      type: 'withVhc',
      label: 'Jobs with VHC',
      value: String(stats.withVhc.length),
      sub: `${stats.vhcRate.toFixed(1)}% rate`,
      color: theme.chartGreen,
      jobs: stats.withVhc,
    },
    {
      type: 'withoutVhc',
      label: 'Jobs without VHC',
      value: String(stats.withoutVhc.length),
      sub: `${stats.total > 0 ? (100 - stats.vhcRate).toFixed(1) : '0.0'}% of total`,
      color: theme.chartRed,
      jobs: stats.withoutVhc,
    },
    {
      type: 'green',
      label: 'Green VHC',
      value: String(stats.green.length),
      sub: 'No advisories',
      color: '#22c55e',
      jobs: stats.green,
    },
    {
      type: 'amber',
      label: 'Amber VHC',
      value: String(stats.amber.length),
      sub: 'Advisories present',
      color: '#f97316',
      jobs: stats.amber,
    },
    {
      type: 'red',
      label: 'Red VHC',
      value: String(stats.red.length),
      sub: 'Urgent attention',
      color: '#ef4444',
      jobs: stats.red,
    },
  ];

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('VhcIntelligenceScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>VHC Intelligence</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => {
          const isActive = period === p;
          return (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodBtn,
                { backgroundColor: isActive ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => {
                console.log('VhcIntelligenceScreen: Period changed to', p);
                setPeriod(p);
                setExpandedCard(null);
              }}
            >
              <Text style={[styles.periodBtnText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* VHC Rate banner */}
        <View style={[styles.rateBanner, { backgroundColor: theme.card }]}>
          <Text style={[styles.rateValue, { color: stats.vhcRate >= 70 ? theme.chartGreen : theme.chartRed }]}>
            {stats.vhcRate.toFixed(1)}%
          </Text>
          <Text style={[styles.rateLabel, { color: theme.textSecondary }]}>VHC Rate</Text>
          <Text style={[styles.rateTotal, { color: theme.textSecondary }]}>
            {stats.total} total jobs in period
          </Text>
        </View>

        {/* Cards */}
        {cardData.map(card => {
          const isExpanded = expandedCard === card.type;
          return (
            <View key={card.type}>
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: card.color }]}
                onPress={() => {
                  console.log('VhcIntelligenceScreen: Card tapped', card.type, 'expanded:', !isExpanded);
                  setExpandedCard(isExpanded ? null : card.type);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{card.label}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{card.sub}</Text>
                </View>
                <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
                <IconSymbol
                  ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                  android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {isExpanded ? (
                <View style={[styles.expandedPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {card.jobs.length === 0 ? (
                    <Text style={[styles.expandedEmpty, { color: theme.textSecondary }]}>No jobs in this category</Text>
                  ) : (
                    card.jobs.map(j => {
                      const jobDate = j.createdAt.split('T')[0];
                      return (
                        <View key={j.id} style={[styles.expandedJob, { borderBottomColor: theme.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.expandedWip, { color: theme.text }]}>WIP {j.wipNumber}</Text>
                            <Text style={[styles.expandedReg, { color: theme.textSecondary }]}>
                              {j.vehicleReg} · {jobDate}
                            </Text>
                          </View>
                          <View style={[styles.vhcBadge, { backgroundColor: card.color }]}>
                            <Text style={styles.vhcBadgeText}>{j.vhcStatus}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
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
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodBtnText: { fontSize: 11, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  rateBanner: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  rateValue: { fontSize: 40, fontWeight: '800' },
  rateLabel: { fontSize: 14, marginTop: 2 },
  rateTotal: { fontSize: 12, marginTop: 4 },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 6,
    gap: 12,
  },
  cardLabel: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardSub: { fontSize: 12 },
  cardValue: { fontSize: 24, fontWeight: '800' },
  expandedPanel: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
  },
  expandedEmpty: { fontSize: 14, textAlign: 'center', padding: 16 },
  expandedJob: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  expandedWip: { fontSize: 14, fontWeight: '600' },
  expandedReg: { fontSize: 12 },
  vhcBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vhcBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
