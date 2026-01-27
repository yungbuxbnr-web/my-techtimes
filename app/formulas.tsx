
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
import AsyncStorage from '@react-native-async-storage/async-storage';

const FORMULAS_KEY = '@techtimes_formulas';

interface FormulaSettings {
  awToMinutes: number; // Default: 5 (1 AW = 5 minutes)
  efficiencyGreenThreshold: number; // Default: 65
  efficiencyYellowThreshold: number; // Default: 31
  defaultMonthlyTarget: number; // Default: 180
  defaultDailyHours: number; // Default: 8.5
  defaultLunchBreakMinutes: number; // Default: 30
}

export default function FormulasScreen() {
  console.log('FormulasScreen: Rendering formulas editor');
  const { theme } = useThemeContext();
  const router = useRouter();
  
  const [awToMinutes, setAwToMinutes] = useState('5');
  const [efficiencyGreen, setEfficiencyGreen] = useState('65');
  const [efficiencyYellow, setEfficiencyYellow] = useState('31');
  const [monthlyTarget, setMonthlyTarget] = useState('180');
  const [dailyHours, setDailyHours] = useState('8.5');
  const [lunchBreak, setLunchBreak] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFormulas();
  }, []);

  const loadFormulas = async () => {
    console.log('FormulasScreen: Loading formula settings');
    try {
      const stored = await AsyncStorage.getItem(FORMULAS_KEY);
      if (stored) {
        const formulas: FormulaSettings = JSON.parse(stored);
        setAwToMinutes(formulas.awToMinutes.toString());
        setEfficiencyGreen(formulas.efficiencyGreenThreshold.toString());
        setEfficiencyYellow(formulas.efficiencyYellowThreshold.toString());
        setMonthlyTarget(formulas.defaultMonthlyTarget.toString());
        setDailyHours(formulas.defaultDailyHours.toString());
        setLunchBreak(formulas.defaultLunchBreakMinutes.toString());
      }
    } catch (error) {
      console.error('FormulasScreen: Error loading formulas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('FormulasScreen: Saving formula settings');
    
    const awMin = parseFloat(awToMinutes);
    const effGreen = parseFloat(efficiencyGreen);
    const effYellow = parseFloat(efficiencyYellow);
    const target = parseFloat(monthlyTarget);
    const hours = parseFloat(dailyHours);
    const lunch = parseFloat(lunchBreak);
    
    if (isNaN(awMin) || awMin <= 0) {
      Alert.alert('Error', 'AW to Minutes must be a positive number');
      return;
    }
    
    if (isNaN(effGreen) || effGreen < 0 || effGreen > 100) {
      Alert.alert('Error', 'Efficiency thresholds must be between 0 and 100');
      return;
    }
    
    if (isNaN(effYellow) || effYellow < 0 || effYellow > 100) {
      Alert.alert('Error', 'Efficiency thresholds must be between 0 and 100');
      return;
    }
    
    if (effYellow >= effGreen) {
      Alert.alert('Error', 'Yellow threshold must be less than green threshold');
      return;
    }
    
    if (isNaN(target) || target <= 0) {
      Alert.alert('Error', 'Monthly target must be a positive number');
      return;
    }
    
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Error', 'Daily hours must be between 0 and 24');
      return;
    }
    
    if (isNaN(lunch) || lunch < 0 || lunch > 180) {
      Alert.alert('Error', 'Lunch break must be between 0 and 180 minutes');
      return;
    }
    
    const formulas: FormulaSettings = {
      awToMinutes: awMin,
      efficiencyGreenThreshold: effGreen,
      efficiencyYellowThreshold: effYellow,
      defaultMonthlyTarget: target,
      defaultDailyHours: hours,
      defaultLunchBreakMinutes: lunch,
    };
    
    try {
      await AsyncStorage.setItem(FORMULAS_KEY, JSON.stringify(formulas));
      Alert.alert(
        'Success',
        'Formula settings saved successfully!\n\nNote: These changes will apply to new calculations. Existing data will be recalculated on next app restart.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('FormulasScreen: Error saving formulas:', error);
      Alert.alert('Error', 'Failed to save formula settings');
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults',
      'Reset all formulas to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setAwToMinutes('5');
            setEfficiencyGreen('65');
            setEfficiencyYellow('31');
            setMonthlyTarget('180');
            setDailyHours('8.5');
            setLunchBreak('30');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <AppBackground>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Formula Settings',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading formulas...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Formula Settings',
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
            ios_icon_name="function"
            android_material_icon_name="calculate"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Customize all calculation formulas and values used throughout the app. Changes will apply to new calculations.
          </Text>
        </View>

        {/* AW Conversion */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>AW to Time Conversion</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            How many minutes equals 1 AW
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Minutes per AW</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={awToMinutes}
              onChangeText={setAwToMinutes}
              placeholder="5"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Default: 5 (1 AW = 5 minutes = 0.0833 hours)
            </Text>
          </View>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              Formula: Total Minutes = AW × {awToMinutes}
            </Text>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              Formula: Total Hours = (AW × {awToMinutes}) ÷ 60
            </Text>
          </View>
        </View>

        {/* Efficiency Thresholds */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Efficiency Thresholds</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Percentage thresholds for efficiency ratings
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.chartGreen }]}>Excellent (Green) Threshold (%)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={efficiencyGreen}
              onChangeText={setEfficiencyGreen}
              placeholder="65"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Efficiency ≥ {efficiencyGreen}% = Excellent (Green)
            </Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.chartYellow }]}>Good (Yellow) Threshold (%)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={efficiencyYellow}
              onChangeText={setEfficiencyYellow}
              placeholder="31"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Efficiency ≥ {efficiencyYellow}% = Good (Yellow)
            </Text>
          </View>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              Formula: Efficiency = (Sold Hours ÷ Available Hours) × 100
            </Text>
            <Text style={[styles.formulaText, { color: theme.chartGreen }]}>
              • ≥ {efficiencyGreen}% = Excellent (Green)
            </Text>
            <Text style={[styles.formulaText, { color: theme.chartYellow }]}>
              • {efficiencyYellow}% - {efficiencyGreen}% = Good (Yellow)
            </Text>
            <Text style={[styles.formulaText, { color: theme.chartRed }]}>
              • &lt; {efficiencyYellow}% = Poor (Red)
            </Text>
          </View>
        </View>

        {/* Default Values */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Default Values</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Default values for new schedules and targets
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Monthly Target (hours)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={monthlyTarget}
              onChangeText={setMonthlyTarget}
              placeholder="180"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Default monthly target hours for new months
            </Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Daily Working Hours</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={dailyHours}
              onChangeText={setDailyHours}
              placeholder="8.5"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Default daily working hours for new schedules
            </Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Lunch Break (minutes)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={lunchBreak}
              onChangeText={setLunchBreak}
              placeholder="30"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Default lunch break duration for new schedules
            </Text>
          </View>
        </View>

        {/* All Formulas Reference */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>All Formulas Reference</Text>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>Time Calculations:</Text>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              • Total Minutes = AW × {awToMinutes}{'\n'}
              • Total Hours = (AW × {awToMinutes}) ÷ 60{'\n'}
              • Daily Hours = (End Time - Start Time) - Lunch Break
            </Text>
          </View>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>Available Hours:</Text>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              • Available Hours = Working Days × Daily Hours{'\n'}
              • Working Days = Days in schedule - Absences{'\n'}
              • Adjusted Available = Available - Absence Hours
            </Text>
          </View>
          
          <View style={[styles.formulaBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>Performance Metrics:</Text>
            <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
              • Efficiency % = (Sold Hours ÷ Available Hours) × 100{'\n'}
              • Target Progress % = (Sold Hours ÷ Target Hours) × 100{'\n'}
              • Remaining Hours = Target Hours - Sold Hours{'\n'}
              • Average AW per Job = Total AW ÷ Job Count
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
            <Text style={styles.saveButtonText}>Save Formulas</Text>
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
  inputContainer: {
    marginBottom: 16,
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
