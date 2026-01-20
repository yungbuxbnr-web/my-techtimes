
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 0, name: 'Sunday', short: 'Sun' },
];

const SATURDAY_FREQUENCIES = [
  { id: 'none', label: 'No Saturdays' },
  { id: 'every', label: 'Every Saturday' },
  { id: '1-in-2', label: '1 in 2 (Every Other)' },
  { id: '1-in-3', label: '1 in 3' },
  { id: '1-in-4', label: '1 in 4' },
  { id: 'custom', label: 'Custom Dates' },
];

export default function EditWorkScheduleScreen() {
  console.log('EditWorkScheduleScreen: Rendering work schedule editor');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('18:00');
  const [lunchBreakMinutes, setLunchBreakMinutes] = useState('30');
  const [saturdayFrequency, setSaturdayFrequency] = useState<string>('none');
  const [nextWorkingSaturday, setNextWorkingSaturday] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    console.log('EditWorkScheduleScreen: Loading current schedule');
    try {
      const schedule = await api.getSchedule();
      
      if (schedule.workingDays && schedule.workingDays.length > 0) {
        setWorkingDays(schedule.workingDays);
      }
      
      if (schedule.startTime) {
        setStartTime(schedule.startTime);
      }
      if (schedule.endTime) {
        setEndTime(schedule.endTime);
      }
      
      if (schedule.lunchBreakMinutes !== undefined) {
        setLunchBreakMinutes(schedule.lunchBreakMinutes.toString());
      }
      
      if (schedule.saturdayFrequency) {
        setSaturdayFrequency(schedule.saturdayFrequency);
      }
      
      if (schedule.nextWorkingSaturday) {
        setNextWorkingSaturday(new Date(schedule.nextWorkingSaturday));
      }
      
      console.log('EditWorkScheduleScreen: Schedule loaded', schedule);
    } catch (error) {
      console.error('EditWorkScheduleScreen: Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkingDay = (dayId: number) => {
    console.log('EditWorkScheduleScreen: Toggling working day', dayId);
    
    if (dayId === 6 && saturdayFrequency !== 'none') {
      Alert.alert('Saturday Schedule', 'Saturday is managed by the Saturday Frequency setting below');
      return;
    }
    
    if (workingDays.includes(dayId)) {
      const newDays = workingDays.filter(d => d !== dayId);
      if (newDays.length === 0) {
        Alert.alert('Error', 'You must have at least one working day selected');
        return;
      }
      setWorkingDays(newDays);
    } else {
      setWorkingDays([...workingDays, dayId].sort());
    }
  };

  const calculateDailyHours = (): number => {
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const lunchMinutes = parseInt(lunchBreakMinutes) || 0;
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const workMinutes = endMinutes - startMinutes - lunchMinutes;
      
      return workMinutes / 60;
    } catch (error) {
      return 0;
    }
  };

  const validateTime = (time: string): boolean => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  const getNextSaturday = (): Date => {
    const today = new Date();
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
    const nextSat = new Date(today);
    nextSat.setDate(today.getDate() + daysUntilSaturday);
    return nextSat;
  };

  const handleSave = async () => {
    console.log('EditWorkScheduleScreen: Saving work schedule');
    
    let finalWorkingDays = [...workingDays];
    
    if (saturdayFrequency === 'none') {
      finalWorkingDays = finalWorkingDays.filter(d => d !== 6);
    }
    
    if (saturdayFrequency === 'every' && !finalWorkingDays.includes(6)) {
      finalWorkingDays.push(6);
      finalWorkingDays.sort();
    }
    
    if (finalWorkingDays.length === 0) {
      Alert.alert('Error', 'Please select at least one working day');
      return;
    }
    
    if (!validateTime(startTime)) {
      Alert.alert('Error', 'Invalid start time format. Use HH:MM (e.g., 07:00)');
      return;
    }
    
    if (!validateTime(endTime)) {
      Alert.alert('Error', 'Invalid end time format. Use HH:MM (e.g., 18:00)');
      return;
    }
    
    const dailyHours = calculateDailyHours();
    if (dailyHours <= 0) {
      Alert.alert('Error', 'End time must be after start time, and total hours must be positive');
      return;
    }
    
    if (dailyHours > 24) {
      Alert.alert('Error', 'Daily working hours cannot exceed 24 hours');
      return;
    }
    
    const lunchMinutes = parseInt(lunchBreakMinutes) || 0;
    if (lunchMinutes < 0 || lunchMinutes > 180) {
      Alert.alert('Error', 'Lunch break must be between 0 and 180 minutes');
      return;
    }
    
    if (saturdayFrequency !== 'none' && saturdayFrequency !== 'every' && !nextWorkingSaturday) {
      Alert.alert('Error', 'Please set the date of your next working Saturday');
      return;
    }
    
    try {
      await api.updateSchedule({
        workingDays: finalWorkingDays,
        startTime,
        endTime,
        lunchBreakMinutes: lunchMinutes,
        dailyWorkingHours: dailyHours,
        saturdayWorking: finalWorkingDays.includes(6),
        saturdayFrequency,
        nextWorkingSaturday: nextWorkingSaturday ? nextWorkingSaturday.toISOString() : undefined,
      });
      
      let saturdayInfo = '';
      if (saturdayFrequency === 'none') {
        saturdayInfo = '\nSaturdays: Not working';
      } else if (saturdayFrequency === 'every') {
        saturdayInfo = '\nSaturdays: Every Saturday';
      } else if (nextWorkingSaturday) {
        saturdayInfo = `\nSaturdays: ${saturdayFrequency}\nNext: ${nextWorkingSaturday.toLocaleDateString('en-GB')}`;
      }
      
      Alert.alert(
        'Success',
        `Work schedule updated!\n\nWorking Days: ${finalWorkingDays.length}\nDaily Hours: ${dailyHours.toFixed(2)}h${saturdayInfo}\n\nThe work calendar has been updated to reflect these changes.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('EditWorkScheduleScreen: Error saving schedule:', error);
      Alert.alert('Error', 'Failed to save work schedule');
    }
  };

  const handleReset = () => {
    console.log('EditWorkScheduleScreen: Resetting to defaults');
    Alert.alert(
      'Reset to Defaults',
      'Reset to Monday-Friday, 7:00 AM - 6:00 PM with 30 min lunch break and no Saturdays?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setWorkingDays([1, 2, 3, 4, 5]);
            setStartTime('07:00');
            setEndTime('18:00');
            setLunchBreakMinutes('30');
            setSaturdayFrequency('none');
            setNextWorkingSaturday(null);
          },
        },
      ]
    );
  };

  const dailyHours = calculateDailyHours();

  if (loading) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Edit Work Schedule',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading schedule...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Work Schedule',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'android' && { paddingTop: 16 }]}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Customize your work schedule. Changes will automatically update the work calendar for the entire year.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Working Days</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Select the days you work each week (Saturday managed below)
          </Text>
          
          <View style={styles.daysGrid}>
            {DAYS_OF_WEEK.filter(day => day.id !== 6).map((day) => {
              const isSelected = workingDays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayButton,
                    { borderColor: theme.border },
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => toggleWorkingDay(day.id)}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      { color: isSelected ? '#ffffff' : theme.text },
                    ]}
                  >
                    {day.short}
                  </Text>
                  <Text
                    style={[
                      styles.dayButtonSubtext,
                      { color: isSelected ? '#ffffff' : theme.textSecondary },
                    ]}
                  >
                    {day.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          <View style={[styles.summaryBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              Selected: {workingDays.filter(d => d !== 6).length} day{workingDays.filter(d => d !== 6).length !== 1 ? 's' : ''} per week
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Saturday Schedule</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Configure how often you work on Saturdays
          </Text>
          
          <View style={styles.frequencyGrid}>
            {SATURDAY_FREQUENCIES.map((freq) => {
              const isSelected = saturdayFrequency === freq.id;
              return (
                <TouchableOpacity
                  key={freq.id}
                  style={[
                    styles.frequencyButton,
                    { borderColor: theme.border },
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    console.log('EditWorkScheduleScreen: Setting Saturday frequency to', freq.id);
                    setSaturdayFrequency(freq.id);
                    if (freq.id === 'none') {
                      setNextWorkingSaturday(null);
                    } else if (freq.id === 'every') {
                      setNextWorkingSaturday(null);
                    } else if (!nextWorkingSaturday) {
                      setNextWorkingSaturday(getNextSaturday());
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.frequencyButtonText,
                      { color: isSelected ? '#ffffff' : theme.text },
                    ]}
                  >
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {saturdayFrequency !== 'none' && saturdayFrequency !== 'every' && (
            <View style={styles.saturdayDateSection}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Next Working Saturday</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.background }]}
                onPress={() => {
                  console.log('EditWorkScheduleScreen: User tapped Next Working Saturday picker');
                  setShowDatePicker(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="calendar-today"
                  size={20}
                  color={theme.primary}
                />
                <Text style={[styles.datePickerText, { color: theme.text }]}>
                  {nextWorkingSaturday 
                    ? nextWorkingSaturday.toLocaleDateString('en-GB', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })
                    : 'Select Date'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                The app will track your Saturday schedule based on this date and frequency
              </Text>
            </View>
          )}
          
          {saturdayFrequency === 'every' && (
            <View style={[styles.summaryBox, { backgroundColor: theme.background }]}>
              <Text style={[styles.summaryText, { color: theme.text }]}>
                ✅ Working every Saturday
              </Text>
            </View>
          )}
          
          {saturdayFrequency === 'none' && (
            <View style={[styles.summaryBox, { backgroundColor: theme.background }]}>
              <Text style={[styles.summaryText, { color: theme.text }]}>
                ❌ Not working Saturdays
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Working Hours</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Set your daily start and end times
          </Text>
          
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Start Time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="07:00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>24-hour format</Text>
            </View>
            
            <View style={styles.timeInput}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>End Time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="18:00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>24-hour format</Text>
            </View>
          </View>
          
          <View style={styles.lunchBreakInput}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Lunch Break (minutes)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={lunchBreakMinutes}
              onChangeText={setLunchBreakMinutes}
              placeholder="30"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Unpaid break time deducted from daily hours
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Calculation Summary</Text>
          
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: theme.textSecondary }]}>
              Daily Working Hours:
            </Text>
            <Text style={[styles.calculationValue, { color: theme.primary }]}>
              {dailyHours.toFixed(2)}h
            </Text>
          </View>
          
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: theme.textSecondary }]}>
              Weekly Working Days:
            </Text>
            <Text style={[styles.calculationValue, { color: theme.primary }]}>
              {workingDays.length} days
            </Text>
          </View>
          
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: theme.textSecondary }]}>
              Weekly Working Hours:
            </Text>
            <Text style={[styles.calculationValue, { color: theme.primary }]}>
              {(dailyHours * workingDays.length).toFixed(2)}h
            </Text>
          </View>
          
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: theme.textSecondary }]}>
              Approx. Monthly Hours:
            </Text>
            <Text style={[styles.calculationValue, { color: theme.primary }]}>
              {(dailyHours * workingDays.length * 4.33).toFixed(2)}h
            </Text>
          </View>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>How it works:</Text>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              • Available Hours = Working Days × Daily Hours{'\n'}
              • Efficiency % = (Sold Hours ÷ Available Hours) × 100{'\n'}
              • Only selected working days count toward available hours{'\n'}
              • Saturday schedule is tracked separately based on frequency{'\n'}
              • 1 AW = 5 minutes = 0.0833 hours
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSave}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color="#ffffff"
            />
            <Text style={styles.saveButtonText}>Save Schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: theme.textSecondary }]}
            onPress={handleReset}
          >
            <IconSymbol
              ios_icon_name="arrow.counterclockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#ffffff"
            />
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.calendarButton, { backgroundColor: theme.accent }]}
            onPress={() => {
              console.log('EditWorkScheduleScreen: User tapped Work Calendar button');
              router.push('/work-calendar');
            }}
          >
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color="#ffffff"
            />
            <Text style={styles.calendarButtonText}>Work Calendar & Absences</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Next Working Saturday</Text>
              <DateTimePicker
                value={nextWorkingSaturday || getNextSaturday()}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    if (selectedDate.getDay() !== 6) {
                      Alert.alert('Invalid Date', 'Please select a Saturday');
                      return;
                    }
                    setNextWorkingSaturday(selectedDate);
                    console.log('EditWorkScheduleScreen: User selected next working Saturday:', selectedDate.toLocaleDateString('en-GB'));
                  }
                }}
              />
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    width: '30%',
    minWidth: 100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dayButtonSubtext: {
    fontSize: 11,
  },
  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  frequencyButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saturdayDateSection: {
    marginTop: 12,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  datePickerText: {
    fontSize: 16,
    flex: 1,
  },
  summaryBox: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeInput: {
    flex: 1,
  },
  lunchBreakInput: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calculationLabel: {
    fontSize: 14,
  },
  calculationValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formulaBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  formulaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 13,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  calendarButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
