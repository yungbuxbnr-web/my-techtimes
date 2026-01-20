
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 0, name: 'Sunday', short: 'Sun' },
];

export default function EditWorkScheduleScreen() {
  console.log('EditWorkScheduleScreen: Rendering work schedule editor');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('18:00');
  const [lunchBreakMinutes, setLunchBreakMinutes] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    console.log('EditWorkScheduleScreen: Loading current schedule');
    try {
      const schedule = await api.getSchedule();
      
      // Load working days
      if (schedule.workingDays && schedule.workingDays.length > 0) {
        setWorkingDays(schedule.workingDays);
      }
      
      // Load start/end times
      if (schedule.startTime) {
        setStartTime(schedule.startTime);
      }
      if (schedule.endTime) {
        setEndTime(schedule.endTime);
      }
      
      // Load lunch break
      if (schedule.lunchBreakMinutes !== undefined) {
        setLunchBreakMinutes(schedule.lunchBreakMinutes.toString());
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
    if (workingDays.includes(dayId)) {
      // Remove day
      const newDays = workingDays.filter(d => d !== dayId);
      if (newDays.length === 0) {
        Alert.alert('Error', 'You must have at least one working day selected');
        return;
      }
      setWorkingDays(newDays);
    } else {
      // Add day
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

  const handleSave = async () => {
    console.log('EditWorkScheduleScreen: Saving work schedule');
    
    // Validate inputs
    if (workingDays.length === 0) {
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
    
    try {
      await api.updateSchedule({
        workingDays,
        startTime,
        endTime,
        lunchBreakMinutes: lunchMinutes,
        dailyWorkingHours: dailyHours,
        saturdayWorking: workingDays.includes(6),
      });
      
      Alert.alert(
        'Success',
        `Work schedule updated!\n\nWorking Days: ${workingDays.length}\nDaily Hours: ${dailyHours.toFixed(2)}h\n\nAll efficiency calculations will now use this schedule.`,
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
      'Reset to Monday-Friday, 7:00 AM - 6:00 PM with 30 min lunch break?',
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
            Customize your work schedule to accurately track efficiency. Select your working days and set your daily hours.
          </Text>
        </View>

        {/* Working Days Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Working Days</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Select the days you work each week
          </Text>
          
          <View style={styles.daysGrid}>
            {DAYS_OF_WEEK.map((day) => {
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
              Selected: {workingDays.length} day{workingDays.length !== 1 ? 's' : ''} per week
            </Text>
          </View>
        </View>

        {/* Working Hours Section */}
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

        {/* Calculation Summary */}
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
              • 1 AW = 5 minutes = 0.0833 hours
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
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
});
