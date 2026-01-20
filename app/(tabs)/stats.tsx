
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { api, MonthlyStats, Absence } from '@/utils/api';
import CircularProgress from '@/components/CircularProgress';

export default function StatsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceDays, setAbsenceDays] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [deductionType, setDeductionType] = useState<'target' | 'available'>('available');

  useEffect(() => {
    console.log('StatsScreen: Loading stats for month:', selectedMonth);
    loadMonthlyData();
  }, [selectedMonth]);

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const loadMonthlyData = async () => {
    try {
      console.log('StatsScreen: Fetching monthly stats and absences');
      const [stats, absenceList] = await Promise.all([
        api.getMonthlyStats(selectedMonth),
        api.getAbsences(selectedMonth),
      ]);
      setMonthlyStats(stats);
      setAbsences(absenceList);
      console.log('StatsScreen: Loaded stats:', stats);
    } catch (error) {
      console.error('StatsScreen: Error loading monthly data:', error);
    }
  };

  const onRefresh = async () => {
    console.log('StatsScreen: User refreshing stats');
    setRefreshing(true);
    await loadMonthlyData();
    setRefreshing(false);
  };

  const handleAddAbsence = async () => {
    console.log('StatsScreen: User adding absence');
    const days = parseFloat(absenceDays);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days');
      return;
    }

    try {
      await api.createAbsence({
        month: selectedMonth,
        daysCount: days,
        isHalfDay,
        deductionType,
      });
      setShowAbsenceModal(false);
      setAbsenceDays('');
      setIsHalfDay(false);
      setDeductionType('available');
      await loadMonthlyData();
      Alert.alert('Success', 'Absence logged successfully');
    } catch (error) {
      console.error('StatsScreen: Error adding absence:', error);
      Alert.alert('Error', 'Failed to log absence');
    }
  };

  const handleDeleteAbsence = (id: string) => {
    Alert.alert('Delete Absence', 'Are you sure you want to delete this absence?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('StatsScreen: User deleting absence:', id);
          try {
            await api.deleteAbsence(id);
            await loadMonthlyData();
          } catch (error) {
            console.error('StatsScreen: Error deleting absence:', error);
            Alert.alert('Error', 'Failed to delete absence');
          }
        },
      },
    ]);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 65) return theme.chartGreen;
    if (efficiency >= 31) return theme.chartYellow;
    return theme.chartRed;
  };

  if (!monthlyStats) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading stats...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const targetProgress = (monthlyStats.soldHours / monthlyStats.targetHours) * 100;
  const efficiencyColor = getEfficiencyColor(monthlyStats.efficiency);

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
            <View>
              <Text style={[styles.title, { color: '#ffffff' }]}>Performance</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>
                {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <View style={styles.circlesContainer}>
            <CircularProgress
              size={160}
              strokeWidth={12}
              progress={targetProgress}
              color={theme.primary}
              title="Target"
              value={`${monthlyStats.soldHours.toFixed(1)}h`}
              subtitle={`of ${monthlyStats.targetHours}h`}
              onPress={() => {
                console.log('StatsScreen: User tapped Target circle');
                router.push(`/target-details?month=${selectedMonth}`);
              }}
            />
            <CircularProgress
              size={160}
              strokeWidth={12}
              progress={monthlyStats.efficiency}
              color={efficiencyColor}
              title="Efficiency"
              value={`${monthlyStats.efficiency.toFixed(0)}%`}
              subtitle={`${monthlyStats.availableHours.toFixed(0)}h avail`}
              onPress={() => {
                console.log('StatsScreen: User tapped Efficiency circle');
                router.push(`/efficiency-details?month=${selectedMonth}`);
              }}
            />
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Summary</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalJobs}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalAw}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total AW</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {monthlyStats.remainingHours.toFixed(1)}h
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Remaining</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Weekly Breakdown</Text>
            </View>
            {monthlyStats.weeklyBreakdown.map((week) => (
              <View key={week.week} style={[styles.weekRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.weekLabel, { color: theme.text }]}>Week {week.week}</Text>
                <View style={styles.weekStats}>
                  <Text style={[styles.weekStat, { color: theme.textSecondary }]}>
                    {week.jobs} jobs
                  </Text>
                  <Text style={[styles.weekStat, { color: theme.textSecondary }]}>
                    {week.aw} AW
                  </Text>
                  <Text style={[styles.weekStat, { color: theme.primary }]}>
                    {week.hours.toFixed(1)}h
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Absences</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  console.log('StatsScreen: User tapped Add Absence button');
                  setShowAbsenceModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus"
                  android_material_icon_name="add"
                  size={20}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
            {absences.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No absences logged this month
              </Text>
            ) : (
              absences.map((absence) => (
                <View key={absence.id} style={[styles.absenceRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.absenceInfo}>
                    <Text style={[styles.absenceText, { color: theme.text }]}>
                      {absence.daysCount} {absence.isHalfDay ? 'half-day' : 'full-day'}
                      {absence.daysCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.absenceType, { color: theme.textSecondary }]}>
                      Deducted from {absence.deductionType === 'target' ? 'Target' : 'Available'} Hours
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteAbsence(absence.id)}>
                    <IconSymbol
                      ios_icon_name="trash.fill"
                      android_material_icon_name="delete"
                      size={20}
                      color={theme.error}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <Modal
          visible={showAbsenceModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAbsenceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Log Absence</Text>
                <TouchableOpacity onPress={() => setShowAbsenceModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={[styles.label, { color: theme.text }]}>Number of Days</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={absenceDays}
                  onChangeText={setAbsenceDays}
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor={theme.textSecondary}
                />

                <View style={styles.switchRow}>
                  <Text style={[styles.label, { color: theme.text }]}>Half Day</Text>
                  <TouchableOpacity
                    style={[styles.checkbox, isHalfDay && { backgroundColor: theme.primary }]}
                    onPress={() => setIsHalfDay(!isHalfDay)}
                  >
                    {isHalfDay && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={16}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Deduction Type</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setDeductionType('target')}
                  >
                    <View style={[styles.radio, deductionType === 'target' && { backgroundColor: theme.primary }]}>
                      {deductionType === 'target' && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={[styles.radioLabel, { color: theme.text }]}>
                      Deduct from Monthly Target Hours
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setDeductionType('available')}
                  >
                    <View style={[styles.radio, deductionType === 'available' && { backgroundColor: theme.primary }]}>
                      {deductionType === 'available' && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={[styles.radioLabel, { color: theme.text }]}>
                      Deduct from Total Available Hours (efficiency)
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleAddAbsence}
                >
                  <Text style={styles.saveButtonText}>Log Absence</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  circlesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekStats: {
    flexDirection: 'row',
    gap: 12,
  },
  weekStat: {
    fontSize: 14,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  absenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  absenceInfo: {
    flex: 1,
  },
  absenceText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  absenceType: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  radioLabel: {
    fontSize: 14,
    flex: 1,
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
