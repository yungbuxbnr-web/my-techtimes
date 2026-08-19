
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { billingStorage, BillingRecord } from '@/utils/billingStorage';

function normaliseReg(reg: string): string {
  return (reg || '').toUpperCase().replace(/\s+/g, '');
}

interface VehicleGroup {
  reg: string;
  normReg: string;
  jobs: Job[];
  totalAW: number;
  totalHours: number;
  billedHours: number;
  openHours: number;
  firstVisit: string;
  lastVisit: string;
}

export default function VehicleHistoryScreen() {
  console.log('VehicleHistoryScreen: Rendering');
  const { theme } = useThemeContext();
  const params = useLocalSearchParams<{ reg?: string }>();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState(params.reg || '');
  const [selectedNormReg, setSelectedNormReg] = useState<string | null>(
    params.reg ? normaliseReg(params.reg) : null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('VehicleHistoryScreen: Loading jobs and billing records');
    Promise.all([api.getAllJobs(), billingStorage.getAllRecords()]).then(([jobs, billing]) => {
      console.log('VehicleHistoryScreen: Loaded', jobs.length, 'jobs and', billing.length, 'billing records');
      setAllJobs(jobs);
      setBillingRecords(billing);
      setLoading(false);
    });
  }, []);

  const billingMap = useMemo(() => {
    const m = new Map<string, BillingRecord>();
    billingRecords.forEach(r => m.set(r.jobId, r));
    return m;
  }, [billingRecords]);

  const vehicleGroups = useMemo((): VehicleGroup[] => {
    const groups = new Map<string, Job[]>();
    allJobs.forEach(job => {
      const key = normaliseReg(job.vehicleReg);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(job);
    });
    return Array.from(groups.entries())
      .map(([normReg, jobs]) => {
        const sorted = [...jobs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const totalAW = jobs.reduce((s, j) => s + j.aw, 0);
        const totalHours = (totalAW * 5) / 60;
        let billedHours = 0;
        let openHours = 0;
        jobs.forEach(j => {
          const br = billingMap.get(j.id);
          if (br?.billingStatus === 'billed') {
            billedHours += br.billedHours;
          } else {
            openHours += (j.aw * 5) / 60;
          }
        });
        return {
          reg: sorted[0]?.vehicleReg || normReg,
          normReg,
          jobs: sorted,
          totalAW,
          totalHours,
          billedHours,
          openHours,
          firstVisit: sorted[sorted.length - 1]?.createdAt?.split('T')[0] || '',
          lastVisit: sorted[0]?.createdAt?.split('T')[0] || '',
        };
      })
      .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
  }, [allJobs, billingMap]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return vehicleGroups;
    const q = normaliseReg(searchQuery);
    return vehicleGroups.filter(g => g.normReg.includes(q));
  }, [vehicleGroups, searchQuery]);

  const selectedGroup = useMemo(
    () => (selectedNormReg ? vehicleGroups.find(g => g.normReg === selectedNormReg) ?? null : null),
    [vehicleGroups, selectedNormReg]
  );

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16;

  if (selectedGroup) {
    const summaryItems = [
      { label: 'Visits', value: String(selectedGroup.jobs.length), color: theme.primary },
      { label: 'Recorded', value: `${selectedGroup.totalHours.toFixed(1)}h`, color: theme.text },
      { label: 'Billed', value: `${selectedGroup.billedHours.toFixed(1)}h`, color: theme.chartGreen },
      { label: 'Open', value: `${selectedGroup.openHours.toFixed(1)}h`, color: theme.chartRed },
    ];

    return (
      <AppBackground>
        <View style={[styles.header, { paddingTop: PT }]}>
          <TouchableOpacity
            onPress={() => {
              console.log('VehicleHistoryScreen: Back to vehicle list');
              setSelectedNormReg(null);
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>{selectedGroup.reg}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
            <View style={styles.summaryRow}>
              {summaryItems.map(item => (
                <View key={item.label} style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.summaryDates, { color: theme.textSecondary }]}>
              First: {selectedGroup.firstVisit} · Last: {selectedGroup.lastVisit}
            </Text>
          </View>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>JOB TIMELINE</Text>
          {selectedGroup.jobs.map(job => {
            const br = billingMap.get(job.id);
            const isBilled = br?.billingStatus === 'billed';
            const jobHours = ((job.aw * 5) / 60).toFixed(2);
            const jobDate = job.createdAt.split('T')[0];
            const chipLabel = isBilled ? 'Billed' : 'Open';
            const chipColor = isBilled ? theme.chartGreen : theme.chartRed;
            return (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                  console.log('VehicleHistoryScreen: Tapped job', job.wipNumber, 'for vehicle', job.vehicleReg);
                  router.push({
                    pathname: '/add-job-modal',
                    params: {
                      editId: job.id,
                      editWipNumber: job.wipNumber,
                      editVehicleReg: job.vehicleReg,
                      editAw: String(job.aw),
                      editNotes: job.notes || '',
                      editVhcStatus: job.vhcStatus,
                      editCreatedAt: job.createdAt,
                      editImageUri: job.imageUri || '',
                    },
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.jobDate, { color: theme.textSecondary }]}>{jobDate}</Text>
                  <Text style={[styles.jobWip, { color: theme.text }]}>WIP {job.wipNumber}</Text>
                  {job.notes ? (
                    <Text style={[styles.jobNotes, { color: theme.textSecondary }]} numberOfLines={1}>
                      {job.notes}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.jobRight}>
                  <Text style={[styles.jobHours, { color: theme.primary }]}>{jobHours}h</Text>
                  <View style={[styles.chip, { backgroundColor: chipColor }]}>
                    <Text style={styles.chipText}>{chipLabel}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={[styles.header, { paddingTop: PT }]}>
        <TouchableOpacity
          onPress={() => {
            console.log('VehicleHistoryScreen: Back button pressed');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Vehicle History</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <IconSymbol
          ios_icon_name="magnifyingglass"
          android_material_icon_name="search"
          size={18}
          color={theme.textSecondary}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search registration..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={text => {
            console.log('VehicleHistoryScreen: Search query changed to', text);
            setSearchQuery(text);
          }}
          autoCapitalize="characters"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
              console.log('VehicleHistoryScreen: Search cleared');
              setSearchQuery('');
            }}
          >
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        data={filteredGroups}
        keyExtractor={g => g.normReg}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loading ? 'Loading...' : 'No vehicles found'}
            </Text>
          </View>
        }
        renderItem={({ item: g }) => {
          const jobCountLabel = `${g.jobs.length} job${g.jobs.length !== 1 ? 's' : ''} · Last: ${g.lastVisit}`;
          const totalHoursLabel = `${g.totalHours.toFixed(1)}h`;
          return (
            <TouchableOpacity
              style={[styles.vehicleCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                console.log('VehicleHistoryScreen: Selected vehicle', g.reg);
                setSelectedNormReg(g.normReg);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.vehicleReg, { color: theme.primary }]}>{g.reg}</Text>
                <Text style={[styles.vehicleMeta, { color: theme.textSecondary }]}>{jobCountLabel}</Text>
              </View>
              <View style={styles.vehicleRight}>
                <Text style={[styles.vehicleHours, { color: theme.text }]}>{totalHoursLabel}</Text>
                <Text style={[styles.vehicleHoursLabel, { color: theme.textSecondary }]}>recorded</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          );
        }}
      />
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  vehicleReg: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  vehicleMeta: { fontSize: 13 },
  vehicleRight: { alignItems: 'flex-end', marginRight: 8 },
  vehicleHours: { fontSize: 16, fontWeight: '700' },
  vehicleHoursLabel: { fontSize: 11 },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  summaryCard: { borderRadius: 14, padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  summaryDates: { fontSize: 12, textAlign: 'center' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  jobDate: { fontSize: 12, marginBottom: 2 },
  jobWip: { fontSize: 15, fontWeight: '600' },
  jobNotes: { fontSize: 12, marginTop: 2 },
  jobRight: { alignItems: 'flex-end', gap: 6 },
  jobHours: { fontSize: 15, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16 },
});
