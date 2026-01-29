
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Absence } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AbsenceLoggerScreen() {
  console.log('AbsenceLoggerScreen: Rendering absence logger');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [absenceType, setAbsenceType] = useState<'holiday' | 'sickness' | 'training'>('holiday');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [schedule, setSchedule] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const sched = await api.getSchedule();
      setSchedule(sched);
      
      const monthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const monthAbsences = await api.getAbsences(monthStr);
      setAbsences(monthAbsences);
    } catch (error) {
      console.error('AbsenceLoggerScreen: Error loading data:', error);
    }
  };

  const getHoursForDate = (date: Date): number => {
    if (!schedule) return 0;
    
    const dayOfWeek = date.getDay();
    
    // Check if it's Saturday and has custom hours
    if (dayOfWeek === 6 && schedule.saturdayDailyHours !== undefined) {
      return schedule.saturdayDailyHours;
    }
    
    // Otherwise use regular daily hours
    return schedule.dailyWorkingHours;
  };

  const handleLogAbsence = async () => {
    console.log('AbsenceLoggerScreen: Logging absence');
    
    if (!schedule) {
      Alert.alert('Error', 'Schedule not loaded');
      return;
    }
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    const monthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if absence already exists for this date
    const existingAbsence = absences.find(a => a.absenceDate === dateStr);
    if (existingAbsence) {
      Alert.alert('Error', 'An absence is already logged for this date');
      return;
    }
    
    // Get the hours for this specific day (might be Saturday with different hours)
    const dailyHours = getHoursForDate(selectedDate);
    const hours = isHalfDay ? dailyHours / 2 : dailyHours;
    
    const absenceTypeName = absenceType.charAt(0).toUpperCase() + absenceType.slice(1);
    const durationName = isHalfDay ? 'Half Day' : 'Full Day';
    
    try {
      // Create absence that marks the day as absent
      // This single absence record will:
      // 1. Remove the day from the working days count (affects available hours)
      // 2. Deduct hours from the monthly target
      await api.createAbsence({
        month: monthStr,
        absenceDate: dateStr,
        daysCount: 1,
        isHalfDay,
        customHours: hours,
        deductionType: 'target',
        absenceType,
        note: `${absenceTypeName} - ${durationName}`,
      });
      
      console.log('AbsenceLoggerScreen: Absence logged successfully - day will not be counted as a work day');
      Alert.alert(
        'Success',
        `${absenceTypeName} logged for ${selectedDate.toLocaleDateString('en-GB')}\n\n✅ Day Marked as Absent\n\nThis day will:\n• NOT be counted as a work day\n• NOT contribute to available hours\n• Have ${hours.toFixed(2)}h deducted from monthly target\n\nThe workday progress bar will show "Absent" for this day.`,
        [
          {
            text: 'OK',
            onPress: () => {
              loadData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('AbsenceLoggerScreen: Error logging absence:', error);
      Alert.alert('Error', 'Failed to log absence');
    }
  };

  const handleDeleteAbsence = async (absence: Absence) => {
    console.log('AbsenceLoggerScreen: Deleting absence:', absence.id);
    
    Alert.alert(
      'Delete Absence',
      `Remove ${absence.absenceType} on ${new Date(absence.absenceDate).toLocaleDateString('en-GB')}?\n\nThis will restore the day as a working day and add hours back to your monthly target.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAbsence(absence.id);
              console.log('AbsenceLoggerScreen: Absence deleted - day restored as working day');
              loadData();
            } catch (error) {
              console.error('AbsenceLoggerScreen: Error deleting absence:', error);
              Alert.alert('Error', 'Failed to delete absence');
            }
          },
        },
      ]
    );
  };

  const getAbsenceColor = (type: string) => {
    switch (type) {
      case 'holiday': return '#4CAF50';
      case 'sickness': return '#f44336';
      case 'training': return '#2196F3';
      default: return theme.textSecondary;
    }
  };

  // Group absences by date to show only one entry per day (in case there are duplicates)
  const groupedAbsences = absences.reduce((acc, absence) => {
    if (!acc[absence.absenceDate]) {
      acc[absence.absenceDate] = absence;
    }
    return acc;
  }, {} as Record<string, Absence>);

  const uniqueAbsences = Object.values(groupedAbsences);
  
  console.log('AbsenceLoggerScreen: Displaying', uniqueAbsences.length, 'unique absences for month');

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Absence Logger',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primary }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#ffffff"
          />
          <Text style={[styles.infoText, { color: '#ffffff' }]}>
            ℹ️ Logging an absence marks the day as NOT a work day. It will not count toward available hours and will be excluded from efficiency calculations.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Log New Absence</Text>
          
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Select Date</Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.background }]}
              onPress={() => setShowDatePicker(true)}
            >
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={20}
                color={theme.primary}
              />
              <Text style={[styles.dateText, { color: theme.text }]}>
                {selectedDate.toLocaleDateString('en-GB', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Absence Type</Text>
            <View style={styles.typeButtons}>
              {(['holiday', 'sickness', 'training'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    { borderColor: getAbsenceColor(type) },
                    absenceType === type && { backgroundColor: getAbsenceColor(type) },
                  ]}
                  onPress={() => {
                    console.log('AbsenceLoggerScreen: Setting absence type to', type);
                    setAbsenceType(type);
                  }}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: absenceType === type ? '#ffffff' : getAbsenceColor(type) },
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Duration</Text>
            <View style={styles.durationButtons}>
              <TouchableOpacity
                style={[
                  styles.durationButton,
                  { borderColor: theme.primary },
                  !isHalfDay && { backgroundColor: theme.primary },
                ]}
                onPress={() => {
                  console.log('AbsenceLoggerScreen: Setting full day');
                  setIsHalfDay(false);
                }}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    { color: !isHalfDay ? '#ffffff' : theme.primary },
                  ]}
                >
                  Full Day
                </Text>
                {schedule && (
                  <Text
                    style={[
                      styles.durationHours,
                      { color: !isHalfDay ? '#ffffff' : theme.textSecondary },
                    ]}
                  >
                    {getHoursForDate(selectedDate).toFixed(2)}h
                  </Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.durationButton,
                  { borderColor: theme.primary },
                  isHalfDay && { backgroundColor: theme.primary },
                ]}
                onPress={() => {
                  console.log('AbsenceLoggerScreen: Setting half day');
                  setIsHalfDay(true);
                }}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    { color: isHalfDay ? '#ffffff' : theme.primary },
                  ]}
                >
                  Half Day
                </Text>
                {schedule && (
                  <Text
                    style={[
                      styles.durationHours,
                      { color: isHalfDay ? '#ffffff' : theme.textSecondary },
                    ]}
                  >
                    {(getHoursForDate(selectedDate) / 2).toFixed(2)}h
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.deductionInfo, { backgroundColor: theme.background }]}>
            <Text style={[styles.deductionTitle, { color: theme.text }]}>
              This absence will:
            </Text>
            <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
              ✓ Mark the day as NOT a work day
            </Text>
            <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
              ✓ Exclude it from available hours calculation
            </Text>
            <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
              ✓ Deduct {schedule ? (isHalfDay ? (getHoursForDate(selectedDate) / 2).toFixed(2) : getHoursForDate(selectedDate).toFixed(2)) : '0'}h from monthly target
            </Text>
            <Text style={[styles.deductionNote, { color: theme.textSecondary }]}>
              The workday progress bar will show "Absent" for this day
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.logButton, { backgroundColor: theme.primary }]}
            onPress={handleLogAbsence}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.logButtonText}>Log 1 Day Absence</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Logged Absences</Text>
          
          {uniqueAbsences.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No absences logged for this month
            </Text>
          ) : (
            uniqueAbsences
              .sort((a, b) => new Date(b.absenceDate).getTime() - new Date(a.absenceDate).getTime())
              .map((absence) => (
                <View
                  key={absence.id}
                  style={[styles.absenceItem, { borderLeftColor: getAbsenceColor(absence.absenceType || 'holiday') }]}
                >
                  <View style={styles.absenceInfo}>
                    <Text style={[styles.absenceDate, { color: theme.text }]}>
                      {new Date(absence.absenceDate).toLocaleDateString('en-GB', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </Text>
                    <Text style={[styles.absenceType, { color: getAbsenceColor(absence.absenceType || 'holiday') }]}>
                      {absence.absenceType?.charAt(0).toUpperCase() + absence.absenceType?.slice(1)}
                    </Text>
                    <Text style={[styles.absenceDuration, { color: theme.textSecondary }]}>
                      {absence.isHalfDay ? 'Half Day' : 'Full Day'} • {absence.customHours?.toFixed(2)}h
                    </Text>
                    <Text style={[styles.absenceDeduction, { color: theme.textSecondary }]}>
                      Day not counted as work day
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteAbsence(absence)}
                  >
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

        <View style={{ height: 40 }} />
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(date);
            }
          }}
        />
      )}
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
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  durationHours: {
    fontSize: 12,
  },
  deductionInfo: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  deductionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  deductionItem: {
    fontSize: 13,
    marginBottom: 4,
    paddingLeft: 8,
  },
  deductionNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 8,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  absenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  absenceInfo: {
    flex: 1,
  },
  absenceDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  absenceType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  absenceDuration: {
    fontSize: 12,
    marginBottom: 2,
  },
  absenceDeduction: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
  },
});
