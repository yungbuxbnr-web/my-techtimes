
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Absence, Schedule } from '@/utils/api';

interface DayInfo {
  date: Date;
  dateString: string;
  isWorkingDay: boolean;
  absenceType: 'holiday' | 'sickness' | 'training' | null;
  absenceId?: string;
}

export default function WorkCalendarScreen() {
  console.log('WorkCalendarScreen: Rendering work calendar');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([]);
  const [dailyHours, setDailyHours] = useState(8.5);

  useEffect(() => {
    loadScheduleAndAbsences();
  }, [selectedMonth]);

  const loadScheduleAndAbsences = async () => {
    try {
      const schedule = await api.getSchedule();
      console.log('WorkCalendarScreen: Loaded schedule with working days:', schedule.workingDays);
      
      // Handle Saturday frequency
      let effectiveWorkingDays = [...(schedule.workingDays || [1, 2, 3, 4, 5])];
      
      // If Saturday frequency is 'every', ensure Saturday (6) is in working days
      if (schedule.saturdayFrequency === 'every' && !effectiveWorkingDays.includes(6)) {
        effectiveWorkingDays.push(6);
        effectiveWorkingDays.sort();
      }
      
      // If Saturday frequency is 'none', ensure Saturday is NOT in working days
      if (schedule.saturdayFrequency === 'none') {
        effectiveWorkingDays = effectiveWorkingDays.filter(d => d !== 6);
      }
      
      console.log('WorkCalendarScreen: Effective working days after Saturday frequency:', effectiveWorkingDays);
      
      setWorkingDays(effectiveWorkingDays);
      setDailyHours(schedule.dailyWorkingHours || 8.5);
      
      const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
      const monthAbsences = await api.getAbsences(monthStr);
      setAbsences(monthAbsences);
      
      generateCalendar(effectiveWorkingDays, monthAbsences, schedule);
    } catch (error) {
      console.error('WorkCalendarScreen: Error loading data:', error);
    }
  };

  const generateCalendar = (workDays: number[], monthAbsences: Absence[], schedule: Schedule) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: DayInfo[] = [];
    
    // Helper function to check if a date is a working Saturday based on frequency
    const isWorkingSaturday = (date: Date): boolean => {
      if (date.getDay() !== 6) return false; // Not a Saturday
      
      if (schedule.saturdayFrequency === 'every') return true;
      if (schedule.saturdayFrequency === 'none') return false;
      
      // For custom frequency patterns (1-in-2, 1-in-3, 1-in-4, custom)
      if (schedule.nextWorkingSaturday) {
        const nextWorkingSat = new Date(schedule.nextWorkingSaturday);
        const dateStr = date.toISOString().split('T')[0];
        const nextWorkingSatStr = nextWorkingSat.toISOString().split('T')[0];
        
        if (dateStr === nextWorkingSatStr) return true;
        
        // Calculate pattern-based Saturdays
        if (schedule.saturdayFrequency === '1-in-2') {
          const weeksDiff = Math.floor((date.getTime() - nextWorkingSat.getTime()) / (7 * 24 * 60 * 60 * 1000));
          return weeksDiff % 2 === 0;
        } else if (schedule.saturdayFrequency === '1-in-3') {
          const weeksDiff = Math.floor((date.getTime() - nextWorkingSat.getTime()) / (7 * 24 * 60 * 60 * 1000));
          return weeksDiff % 3 === 0;
        } else if (schedule.saturdayFrequency === '1-in-4') {
          const weeksDiff = Math.floor((date.getTime() - nextWorkingSat.getTime()) / (7 * 24 * 60 * 60 * 1000));
          return weeksDiff % 4 === 0;
        }
      }
      
      // Check custom Saturday dates
      if (schedule.customSaturdayDates && schedule.customSaturdayDates.length > 0) {
        const dateStr = date.toISOString().split('T')[0];
        return schedule.customSaturdayDates.includes(dateStr);
      }
      
      return false;
    };
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Check if it's a working day (including Saturday logic)
      let isWorkingDay = workDays.includes(dayOfWeek);
      
      // Special handling for Saturdays based on frequency
      if (dayOfWeek === 6) {
        isWorkingDay = isWorkingSaturday(date);
      }
      
      // Check if there's an absence for this date
      const absence = monthAbsences.find(a => a.absenceDate === dateString);
      
      days.push({
        date,
        dateString,
        isWorkingDay,
        absenceType: absence?.absenceType || null,
        absenceId: absence?.id,
      });
    }
    
    console.log('WorkCalendarScreen: Generated calendar with', days.filter(d => d.isWorkingDay).length, 'working days');
    setCalendarDays(days);
  };

  const handleDayPress = async (dayInfo: DayInfo) => {
    if (!dayInfo.isWorkingDay) {
      Alert.alert('Not a Working Day', 'This day is not in your work schedule');
      return;
    }

    const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    
    // Cycle through absence types: null -> holiday -> sickness -> training -> null
    let newAbsenceType: 'holiday' | 'sickness' | 'training' | null = null;
    
    if (dayInfo.absenceType === null) {
      newAbsenceType = 'holiday';
    } else if (dayInfo.absenceType === 'holiday') {
      newAbsenceType = 'sickness';
    } else if (dayInfo.absenceType === 'sickness') {
      newAbsenceType = 'training';
    } else {
      newAbsenceType = null;
    }

    try {
      if (newAbsenceType === null) {
        // Remove absence
        if (dayInfo.absenceId) {
          await api.deleteAbsence(dayInfo.absenceId);
          console.log('WorkCalendarScreen: Removed absence for', dayInfo.dateString);
        }
      } else {
        // Add or update absence
        if (dayInfo.absenceId) {
          // Delete old and create new (simpler than update)
          await api.deleteAbsence(dayInfo.absenceId);
        }
        
        await api.createAbsence({
          month: monthStr,
          absenceDate: dayInfo.dateString,
          daysCount: 1,
          deductionType: 'available',
          absenceType: newAbsenceType,
          note: `${newAbsenceType.charAt(0).toUpperCase() + newAbsenceType.slice(1)} day`,
        });
        
        console.log('WorkCalendarScreen: Set absence type to', newAbsenceType, 'for', dayInfo.dateString);
      }
      
      await loadScheduleAndAbsences();
    } catch (error) {
      console.error('WorkCalendarScreen: Error updating absence:', error);
      Alert.alert('Error', 'Failed to update absence');
    }
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
  };

  const getAbsenceColor = (absenceType: string | null) => {
    switch (absenceType) {
      case 'holiday': return '#4CAF50'; // Green
      case 'sickness': return '#f44336'; // Red
      case 'training': return '#2196F3'; // Blue
      default: return 'transparent';
    }
  };

  const getAbsenceIcon = (absenceType: string | null) => {
    switch (absenceType) {
      case 'holiday': return 'H';
      case 'sickness': return 'S';
      case 'training': return 'T';
      default: return '';
    }
  };

  const calculateStats = () => {
    const totalWorkingDays = calendarDays.filter(d => d.isWorkingDay).length;
    const holidayDays = calendarDays.filter(d => d.absenceType === 'holiday').length;
    const sicknessDays = calendarDays.filter(d => d.absenceType === 'sickness').length;
    const trainingDays = calendarDays.filter(d => d.absenceType === 'training').length;
    const totalAbsenceDays = holidayDays + sicknessDays + trainingDays;
    const actualWorkingDays = totalWorkingDays - totalAbsenceDays;
    const totalAvailableHours = actualWorkingDays * dailyHours;
    
    return {
      totalWorkingDays,
      holidayDays,
      sicknessDays,
      trainingDays,
      totalAbsenceDays,
      actualWorkingDays,
      totalAvailableHours,
    };
  };

  const stats = calculateStats();
  const monthName = selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Work Calendar',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
      >
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Tap working days to mark absences. First tap: Holiday (H), Second: Sickness (S), Third: Training (T), Fourth: Remove.
          </Text>
        </View>

        {/* Month Selector */}
        <View style={[styles.monthSelector, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthArrow}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
          <View style={styles.monthInfo}>
            <Text style={[styles.monthText, { color: theme.text }]}>{monthName}</Text>
          </View>
          <TouchableOpacity onPress={handleNextMonth} style={styles.monthArrow}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: theme.card }]}>
          <Text style={[styles.legendTitle, { color: theme.text }]}>Legend:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: getAbsenceColor('holiday') }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Holiday (H)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: getAbsenceColor('sickness') }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Sickness (S)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: getAbsenceColor('training') }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>Training (T)</Text>
            </View>
          </View>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendar, { backgroundColor: theme.card }]}>
          <View style={styles.weekDaysHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.weekDayText, { color: theme.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>
          
          <View style={styles.daysGrid}>
            {/* Add empty cells for days before the first of the month */}
            {Array.from({ length: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() }).map((_, index) => (
              <View key={`empty-${index}`} style={styles.dayCell} />
            ))}
            
            {calendarDays.map((dayInfo) => {
              const isToday = dayInfo.dateString === new Date().toISOString().split('T')[0];
              const absenceColor = getAbsenceColor(dayInfo.absenceType);
              const absenceIcon = getAbsenceIcon(dayInfo.absenceType);
              
              return (
                <TouchableOpacity
                  key={dayInfo.dateString}
                  style={[
                    styles.dayCell,
                    dayInfo.isWorkingDay && { backgroundColor: theme.background },
                    !dayInfo.isWorkingDay && { opacity: 0.3 },
                    isToday && { borderWidth: 2, borderColor: theme.primary },
                    dayInfo.absenceType && { backgroundColor: absenceColor },
                  ]}
                  onPress={() => handleDayPress(dayInfo)}
                  disabled={!dayInfo.isWorkingDay}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: dayInfo.absenceType ? '#ffffff' : theme.text },
                      !dayInfo.isWorkingDay && { color: theme.textSecondary },
                    ]}
                  >
                    {dayInfo.date.getDate()}
                  </Text>
                  {absenceIcon && (
                    <Text style={styles.absenceIcon}>{absenceIcon}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Statistics */}
        <View style={[styles.stats, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>Monthly Summary</Text>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Working Days:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalWorkingDays}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Holiday Days:</Text>
            <Text style={[styles.statValue, { color: getAbsenceColor('holiday') }]}>{stats.holidayDays}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sickness Days:</Text>
            <Text style={[styles.statValue, { color: getAbsenceColor('sickness') }]}>{stats.sicknessDays}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Training Days:</Text>
            <Text style={[styles.statValue, { color: getAbsenceColor('training') }]}>{stats.trainingDays}</Text>
          </View>
          
          <View style={[styles.statRow, styles.totalRow]}>
            <Text style={[styles.statLabel, { color: theme.text, fontWeight: 'bold' }]}>Total Absence Days:</Text>
            <Text style={[styles.statValue, { color: theme.error, fontWeight: 'bold' }]}>{stats.totalAbsenceDays}</Text>
          </View>
          
          <View style={[styles.statRow, styles.totalRow]}>
            <Text style={[styles.statLabel, { color: theme.text, fontWeight: 'bold' }]}>Actual Working Days:</Text>
            <Text style={[styles.statValue, { color: theme.primary, fontWeight: 'bold' }]}>{stats.actualWorkingDays}</Text>
          </View>
          
          <View style={[styles.statRow, styles.totalRow]}>
            <Text style={[styles.statLabel, { color: theme.text, fontWeight: 'bold' }]}>Total Available Hours:</Text>
            <Text style={[styles.statValue, { color: theme.primary, fontWeight: 'bold' }]}>
              {stats.totalAvailableHours.toFixed(2)}h
            </Text>
          </View>
          
          <View style={[styles.noteBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.noteText, { color: theme.textSecondary }]}>
              ℹ️ Absence days are automatically deducted from your available hours for efficiency calculations.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthArrow: {
    padding: 8,
  },
  monthInfo: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  legend: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  calendar: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  absenceIcon: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: 2,
  },
  stats: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
