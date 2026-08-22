
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
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Absence } from '@/utils/api';
import {
  getScheduledHoursForDate,
  calculateAbsenceHours,
  calculateDayFraction,
  AbsenceDuration,
  HalfDayPeriod,
} from '@/utils/absenceCalculations';
import { getCachedBankHolidays, isBankHolidaySync, BankHoliday } from '@/utils/bankHolidays';
import DateTimePicker from '@react-native-community/datetimepicker';

// ── Range day entry ────────────────────────────────────────────────────────────

interface RangeDayEntry {
  dateStr: string;
  date: Date;
  dayOfWeek: number;
  scheduledHours: number;
  isBankHoliday: boolean;
  isExcluded: boolean;
  label: string;
  included: boolean;
  absenceHours: number;
}

type EntryMode = 'single' | 'range';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function dateToStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildRangeDays(
  fromDate: Date,
  toDate: Date,
  schedule: any,
  bankHolidays: BankHoliday[],
  duration: AbsenceDuration,
  customHoursPerDay: number
): RangeDayEntry[] {
  const entries: RangeDayEntry[] = [];
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

  while (cursor <= end) {
    const dateStr = dateToStr(cursor);
    const dayOfWeek = cursor.getDay();
    const scheduledHours = schedule ? getScheduledHoursForDate(new Date(cursor), schedule) : 0;
    const isBH = isBankHolidaySync(dateStr, bankHolidays);
    const excludeBH = schedule?.excludeBankHolidays === true;
    const isExcluded = scheduledHours <= 0 || (isBH && excludeBH);

    let label: string;
    if (isBH && excludeBH) {
      label = 'Bank Holiday';
    } else if (scheduledHours <= 0 && dayOfWeek === 0) {
      label = 'Day Off';
    } else if (scheduledHours <= 0 && dayOfWeek === 6) {
      label = 'Not Scheduled';
    } else if (scheduledHours <= 0) {
      label = 'Day Off';
    } else if (dayOfWeek === 6) {
      label = 'Working Saturday';
    } else {
      label = 'Working Day';
    }

    let absenceHours = 0;
    if (!isExcluded) {
      if (duration === 'full_day') {
        absenceHours = scheduledHours;
      } else if (duration === 'half_day') {
        absenceHours = scheduledHours / 2;
      } else {
        absenceHours = Math.min(customHoursPerDay, scheduledHours);
      }
    }

    entries.push({
      dateStr,
      date: new Date(cursor),
      dayOfWeek,
      scheduledHours,
      isBankHoliday: isBH,
      isExcluded,
      label,
      included: !isExcluded,
      absenceHours,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return entries;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AbsenceLoggerScreen() {
  const { theme } = useThemeContext();

  // ── Shared state ──────────────────────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<EntryMode>('single');
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);

  // ── Single day state ──────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [absenceType, setAbsenceType] = useState<'holiday' | 'sickness' | 'training'>('holiday');
  const [duration, setDuration] = useState<AbsenceDuration>('full_day');
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('morning');
  const [customHoursInput, setCustomHoursInput] = useState('');
  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    date: string;
    hours: number;
    dayFraction: number;
    type: string;
  }>({ visible: false, date: '', hours: 0, dayFraction: 0, type: 'holiday' });

  // ── Range state ───────────────────────────────────────────────────────────
  const [rangeFromDate, setRangeFromDate] = useState(new Date());
  const [rangeToDate, setRangeToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d;
  });
  const [showRangeFromPicker, setShowRangeFromPicker] = useState(false);
  const [showRangeToPicker, setShowRangeToPicker] = useState(false);
  const [rangeAbsenceType, setRangeAbsenceType] = useState<'holiday' | 'sickness' | 'training'>('holiday');
  const [rangeDuration, setRangeDuration] = useState<AbsenceDuration>('full_day');
  const [rangeHalfDayPeriod, setRangeHalfDayPeriod] = useState<HalfDayPeriod>('morning');
  const [rangeCustomHoursInput, setRangeCustomHoursInput] = useState('');
  const [rangeNote, setRangeNote] = useState('');
  const [rangeDays, setRangeDays] = useState<RangeDayEntry[]>([]);
  const [rangeSaving, setRangeSaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (entryMode === 'range' && schedule) {
      rebuildRangeDays();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFromDate, rangeToDate, rangeDuration, rangeCustomHoursInput, schedule, bankHolidays, entryMode]);

  const loadData = async () => {
    try {
      const sched = await api.getSchedule();
      setSchedule(sched);
      const bh = await getCachedBankHolidays();
      setBankHolidays(bh);

      const monthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const monthAbsences = await api.getAbsences(monthStr);
      setAbsences(monthAbsences);
    } catch (error) {
      console.error('AbsenceLoggerScreen: Error loading data:', error);
    }
  };

  const rebuildRangeDays = () => {
    if (!schedule) return;
    const customHoursPerDay = parseFloat(rangeCustomHoursInput) || 0;
    const days = buildRangeDays(rangeFromDate, rangeToDate, schedule, bankHolidays, rangeDuration, customHoursPerDay);
    setRangeDays(days);
  };

  // ── Single day computed values ────────────────────────────────────────────
  const scheduledHours = schedule ? getScheduledHoursForDate(selectedDate, schedule) : 0;
  const customHoursValue = parseFloat(customHoursInput) || 0;
  const absenceHours = calculateAbsenceHours(duration, scheduledHours, customHoursValue);
  const dayFraction = calculateDayFraction(absenceHours, scheduledHours);
  const fullDayHoursDisplay = scheduledHours > 0 ? scheduledHours.toFixed(2) + 'h' : '—';
  const halfDayHoursDisplay = scheduledHours > 0 ? (scheduledHours / 2).toFixed(2) + 'h' : '—';

  // ── Range computed values ─────────────────────────────────────────────────
  const rangeIncludedDays = rangeDays.filter(d => d.included);
  const rangeExcludedCount = rangeDays.filter(d => !d.included).length;
  const rangeTotalHours = rangeIncludedDays.reduce((s, d) => s + d.absenceHours, 0);

  const isAbsenceFuture = (absenceDate: string): boolean => absenceDate > todayStr;

  // ── Single day handlers ───────────────────────────────────────────────────

  const handleLogAbsence = async () => {
    console.log('AbsenceLoggerScreen: Log absence button pressed', { duration, absenceType, selectedDate: selectedDate.toISOString().split('T')[0] });

    if (!schedule) {
      Alert.alert('Error', 'Schedule not loaded');
      return;
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const monthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;

    const existingAbsence = absences.find(a => a.absenceDate === dateStr);
    if (existingAbsence) {
      Alert.alert('Error', 'An absence is already logged for this date');
      return;
    }

    if (scheduledHours <= 0) {
      Alert.alert('Error', 'No scheduled hours found for this date');
      return;
    }

    if (duration === 'custom_hours') {
      if (customHoursValue <= 0) {
        Alert.alert('Error', 'Please enter a valid number of hours');
        return;
      }
      if (customHoursValue > scheduledHours) {
        Alert.alert('Error', `Custom hours cannot exceed scheduled hours (${scheduledHours.toFixed(2)}h)`);
        return;
      }
    }

    const finalAbsenceHours = calculateAbsenceHours(duration, scheduledHours, customHoursValue);
    const finalDayFraction = calculateDayFraction(finalAbsenceHours, scheduledHours);
    const isFuture = dateStr > todayStr;
    const deductionType = isFuture ? 'target' : 'available';

    const absenceTypeName = absenceType.charAt(0).toUpperCase() + absenceType.slice(1);
    const durationLabel = duration === 'full_day' ? 'Full Day' : duration === 'half_day' ? 'Half Day' : `Custom ${finalAbsenceHours.toFixed(2)}h`;

    try {
      await api.createAbsence({
        month: monthStr,
        absenceDate: dateStr,
        duration,
        absenceHours: finalAbsenceHours,
        scheduledHoursSnapshot: scheduledHours,
        dayFraction: finalDayFraction,
        halfDayPeriod: duration === 'half_day' ? halfDayPeriod : undefined,
        daysCount: 1,
        isHalfDay: duration === 'half_day',
        customHours: finalAbsenceHours,
        deductionType,
        absenceType,
        note: `${absenceTypeName} - ${durationLabel}`,
      });

      console.log('AbsenceLoggerScreen: Absence logged successfully', { isFuture, finalAbsenceHours, finalDayFraction });

      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      setSuccessModal({ visible: true, date: formattedDate, hours: finalAbsenceHours, dayFraction: finalDayFraction, type: absenceType });
    } catch (error) {
      console.error('AbsenceLoggerScreen: Error logging absence:', error);
      Alert.alert('Error', 'Failed to log absence');
    }
  };

  const handleDeleteAbsence = async (absence: Absence) => {
    console.log('AbsenceLoggerScreen: Delete absence button pressed', { id: absence.id, date: absence.absenceDate });

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
              console.log('AbsenceLoggerScreen: Absence deleted successfully', { id: absence.id });
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

  const handleDeleteRangeGroup = async (rangeId: string, groupAbsences: Absence[]) => {
    console.log('AbsenceLoggerScreen: Delete range group pressed', { rangeId, count: groupAbsences.length });
    Alert.alert(
      `Delete This Range (${groupAbsences.length} records)?`,
      `This will remove all ${groupAbsences.length} absence records in this range.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const a of groupAbsences) {
                await api.deleteAbsence(a.id);
              }
              console.log('AbsenceLoggerScreen: Range group deleted', { rangeId, count: groupAbsences.length });
              loadData();
            } catch (error) {
              console.error('AbsenceLoggerScreen: Error deleting range group:', error);
              Alert.alert('Error', 'Failed to delete range');
            }
          },
        },
      ]
    );
  };

  // ── Range handlers ────────────────────────────────────────────────────────

  const toggleRangeDay = (dateStr: string) => {
    console.log('AbsenceLoggerScreen: Range day toggled:', dateStr);
    setRangeDays(prev => prev.map(d =>
      d.dateStr === dateStr && !d.isExcluded ? { ...d, included: !d.included } : d
    ));
  };

  const selectAllWorkingDays = () => {
    console.log('AbsenceLoggerScreen: Select all working days tapped');
    setRangeDays(prev => prev.map(d => ({ ...d, included: !d.isExcluded })));
  };

  const clearAllWorkingDays = () => {
    console.log('AbsenceLoggerScreen: Clear all working days tapped');
    setRangeDays(prev => prev.map(d => ({ ...d, included: false })));
  };

  const handleSaveRange = async () => {
    console.log('AbsenceLoggerScreen: Save range button pressed', {
      from: dateToStr(rangeFromDate),
      to: dateToStr(rangeToDate),
      includedDays: rangeIncludedDays.length,
      type: rangeAbsenceType,
      duration: rangeDuration,
    });

    if (!schedule) {
      Alert.alert('Error', 'Schedule not loaded');
      return;
    }

    if (rangeIncludedDays.length === 0) {
      Alert.alert('Error', 'No working days selected');
      return;
    }

    if (rangeDuration === 'custom_hours') {
      const customVal = parseFloat(rangeCustomHoursInput) || 0;
      if (customVal <= 0) {
        Alert.alert('Error', 'Please enter valid hours per day');
        return;
      }
    }

    // Duplicate detection — gather all months in range
    const monthsInRange = new Set<string>();
    for (const d of rangeIncludedDays) {
      monthsInRange.add(d.dateStr.slice(0, 7));
    }

    let existingAbsenceDates = new Set<string>();
    try {
      for (const monthStr of monthsInRange) {
        const monthAbsences = await api.getAbsences(monthStr);
        for (const a of monthAbsences) {
          existingAbsenceDates.add(a.absenceDate);
        }
      }
    } catch (err) {
      console.error('AbsenceLoggerScreen: Error checking existing absences:', err);
    }

    const conflictingDays = rangeIncludedDays.filter(d => existingAbsenceDates.has(d.dateStr));
    const nonConflictingDays = rangeIncludedDays.filter(d => !existingAbsenceDates.has(d.dateStr));

    const proceedWithSave = async (daysToSave: RangeDayEntry[]) => {
      const fromStr = formatDateShort(rangeFromDate);
      const toStr = formatDateShort(rangeToDate);
      const absenceTypeName = rangeAbsenceType.charAt(0).toUpperCase() + rangeAbsenceType.slice(1);
      const durationLabel = rangeDuration === 'full_day' ? 'Full Day' : rangeDuration === 'half_day' ? 'Half Day' : `Custom ${rangeCustomHoursInput}h`;
      const totalHoursForAlert = daysToSave.reduce((s, d) => s + d.absenceHours, 0);

      Alert.alert(
        `Save ${absenceTypeName}?`,
        `${fromStr} to ${toStr}\n\n${daysToSave.length} Working Day${daysToSave.length !== 1 ? 's' : ''}\n${totalHoursForAlert.toFixed(2)}h Total Absence\n\n${rangeExcludedCount} non-working or excluded dates will be ignored.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async () => {
              console.log('AbsenceLoggerScreen: Confirmed save range — saving', daysToSave.length, 'days');
              setRangeSaving(true);
              const absenceRangeId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
              let saved = 0;
              let failed = 0;

              for (const dayEntry of daysToSave) {
                try {
                  const monthStr = dayEntry.dateStr.slice(0, 7);
                  const isFuture = dayEntry.dateStr > todayStr;
                  const deductionType = isFuture ? 'target' : 'available';
                  const finalDayFraction = calculateDayFraction(dayEntry.absenceHours, dayEntry.scheduledHours);
                  const noteText = rangeNote.trim()
                    ? rangeNote.trim()
                    : `${absenceTypeName} - ${durationLabel} (Range: ${dateToStr(rangeFromDate)} to ${dateToStr(rangeToDate)})`;

                  await api.createAbsence({
                    month: monthStr,
                    absenceDate: dayEntry.dateStr,
                    duration: rangeDuration,
                    absenceHours: dayEntry.absenceHours,
                    scheduledHoursSnapshot: dayEntry.scheduledHours,
                    dayFraction: finalDayFraction,
                    halfDayPeriod: rangeDuration === 'half_day' ? rangeHalfDayPeriod : undefined,
                    daysCount: 1,
                    isHalfDay: rangeDuration === 'half_day',
                    customHours: dayEntry.absenceHours,
                    deductionType,
                    absenceType: rangeAbsenceType,
                    note: noteText,
                    absenceRangeId,
                  });
                  saved++;
                } catch (err) {
                  console.error('AbsenceLoggerScreen: Failed to save range day:', dayEntry.dateStr, err);
                  failed++;
                }
              }

              setRangeSaving(false);
              console.log('AbsenceLoggerScreen: Range save complete — saved:', saved, 'failed:', failed);
              Alert.alert(
                'Range Saved',
                `${saved} absence record${saved !== 1 ? 's' : ''} saved${failed > 0 ? `\n${failed} failed` : ''}`,
                [{ text: 'OK', onPress: () => loadData() }]
              );
            },
          },
        ]
      );
    };

    if (conflictingDays.length > 0) {
      const conflictList = conflictingDays.slice(0, 5).map(d => `• ${formatDateShort(d.date)}`).join('\n');
      const moreText = conflictingDays.length > 5 ? `\n• ...and ${conflictingDays.length - 5} more` : '';
      Alert.alert(
        'Absence conflicts found',
        `${conflictingDays.length} date${conflictingDays.length !== 1 ? 's' : ''} already have absence records:\n${conflictList}${moreText}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip existing',
            onPress: () => {
              if (nonConflictingDays.length === 0) {
                Alert.alert('Nothing to save', 'All selected dates already have absence records.');
                return;
              }
              proceedWithSave(nonConflictingDays);
            },
          },
        ]
      );
    } else {
      proceedWithSave(rangeIncludedDays);
    }
  };

  // ── Absence colour ────────────────────────────────────────────────────────

  const getAbsenceColor = (type: string) => {
    switch (type) {
      case 'holiday': return '#4CAF50';
      case 'sickness': return '#f44336';
      case 'training': return '#2196F3';
      default: return theme.textSecondary;
    }
  };

  // ── Group absences by rangeId ─────────────────────────────────────────────

  const groupedAbsences = absences.reduce((acc, absence) => {
    if (!acc[absence.absenceDate]) {
      acc[absence.absenceDate] = absence;
    }
    return acc;
  }, {} as Record<string, Absence>);

  const uniqueAbsences = Object.values(groupedAbsences);
  const sortedAbsences = uniqueAbsences.sort(
    (a, b) => new Date(b.absenceDate).getTime() - new Date(a.absenceDate).getTime()
  );

  const activeAbsences = sortedAbsences.filter(a => a.absenceDate <= todayStr);
  const futureAbsences = sortedAbsences.filter(a => a.absenceDate > todayStr);

  // Group by absenceRangeId
  const groupByRangeId = (list: Absence[]): { rangeId: string | null; items: Absence[] }[] => {
    const rangeMap = new Map<string, Absence[]>();
    const singles: Absence[] = [];

    for (const a of list) {
      if (a.absenceRangeId) {
        const existing = rangeMap.get(a.absenceRangeId) || [];
        existing.push(a);
        rangeMap.set(a.absenceRangeId, existing);
      } else {
        singles.push(a);
      }
    }

    const result: { rangeId: string | null; items: Absence[] }[] = [];
    for (const [rangeId, items] of rangeMap.entries()) {
      result.push({ rangeId, items: items.sort((a, b) => a.absenceDate.localeCompare(b.absenceDate)) });
    }
    for (const a of singles) {
      result.push({ rangeId: null, items: [a] });
    }

    return result.sort((a, b) => {
      const aDate = a.items[a.items.length - 1]?.absenceDate || '';
      const bDate = b.items[b.items.length - 1]?.absenceDate || '';
      return bDate.localeCompare(aDate);
    });
  };

  const activeGroups = groupByRangeId(activeAbsences);
  const futureGroups = groupByRangeId(futureAbsences);

  // ── Summary totals ────────────────────────────────────────────────────────

  const totalDayFraction = uniqueAbsences.reduce((sum, a) => {
    if (a.dayFraction !== undefined) return sum + a.dayFraction;
    const h = a.absenceHours ?? a.customHours ?? 0;
    const s = a.scheduledHoursSnapshot ?? scheduledHours;
    return sum + calculateDayFraction(h, s > 0 ? s : h);
  }, 0);
  const totalAbsenceHours = uniqueAbsences.reduce((sum, a) => sum + (a.absenceHours ?? Number(a.customHours) ?? 0), 0);
  const pastAbsenceHours = activeAbsences.reduce((sum, a) => sum + (a.absenceHours ?? Number(a.customHours) ?? 0), 0);
  const futureAbsenceHours = futureAbsences.reduce((sum, a) => sum + (a.absenceHours ?? Number(a.customHours) ?? 0), 0);
  const pastDayFraction = activeAbsences.reduce((sum, a) => {
    if (a.dayFraction !== undefined) return sum + a.dayFraction;
    const h = a.absenceHours ?? a.customHours ?? 0;
    const s = a.scheduledHoursSnapshot ?? scheduledHours;
    return sum + calculateDayFraction(h, s > 0 ? s : h);
  }, 0);
  const futureDayFraction = futureAbsences.reduce((sum, a) => {
    if (a.dayFraction !== undefined) return sum + a.dayFraction;
    const h = a.absenceHours ?? a.customHours ?? 0;
    const s = a.scheduledHoursSnapshot ?? scheduledHours;
    return sum + calculateDayFraction(h, s > 0 ? s : h);
  }, 0);

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const selectedIsFuture = selectedDateStr > todayStr;
  const absenceHoursDisplay = absenceHours > 0 ? absenceHours.toFixed(2) + 'h' : '0h';
  const dayFractionDisplay = dayFraction > 0 ? dayFraction.toFixed(2) + ' day' : '0 day';

  const rangeFromIsFuture = dateToStr(rangeFromDate) > todayStr;

  // ── Render ────────────────────────────────────────────────────────────────

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
            Past/today absences are deducted immediately. Future absences are stored as "Scheduled" and only deducted when their date arrives.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Log New Absence</Text>

          {/* Mode Toggle */}
          <View style={[styles.modeToggleRow, { backgroundColor: theme.background }]}>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                entryMode === 'single' && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                console.log('AbsenceLoggerScreen: Mode switched to single day');
                setEntryMode('single');
              }}
            >
              <Text style={[styles.modeToggleBtnText, { color: entryMode === 'single' ? '#ffffff' : theme.textSecondary }]}>
                SINGLE DAY
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                entryMode === 'range' && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                console.log('AbsenceLoggerScreen: Mode switched to date range');
                setEntryMode('range');
              }}
            >
              <Text style={[styles.modeToggleBtnText, { color: entryMode === 'range' ? '#ffffff' : theme.textSecondary }]}>
                DATE RANGE
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── SINGLE DAY MODE ─────────────────────────────────────────── */}
          {entryMode === 'single' && (
            <>
              {/* Date Picker */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Select Date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    console.log('AbsenceLoggerScreen: Date picker opened');
                    setShowDatePicker(true);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={20}
                    color={theme.primary}
                  />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDateFull(selectedDate)}
                  </Text>
                  {selectedIsFuture && (
                    <View style={[styles.futureBadge, { backgroundColor: '#FF9800' }]}>
                      <Text style={styles.futureBadgeText}>Future</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Absence Type */}
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
                        console.log('AbsenceLoggerScreen: Absence type selected', type);
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

              {/* Duration */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Duration</Text>
                <View style={styles.durationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      duration === 'full_day' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Duration selected: full_day');
                      setDuration('full_day');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: duration === 'full_day' ? '#ffffff' : theme.primary }]}>
                      Full Day
                    </Text>
                    <Text style={[styles.durationHours, { color: duration === 'full_day' ? '#ffffff' : theme.textSecondary }]}>
                      {fullDayHoursDisplay}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      duration === 'half_day' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Duration selected: half_day');
                      setDuration('half_day');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: duration === 'half_day' ? '#ffffff' : theme.primary }]}>
                      Half Day
                    </Text>
                    <Text style={[styles.durationHours, { color: duration === 'half_day' ? '#ffffff' : theme.textSecondary }]}>
                      {halfDayHoursDisplay}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      duration === 'custom_hours' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Duration selected: custom_hours');
                      setDuration('custom_hours');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: duration === 'custom_hours' ? '#ffffff' : theme.primary }]}>
                      Custom
                    </Text>
                    <Text style={[styles.durationHours, { color: duration === 'custom_hours' ? '#ffffff' : theme.textSecondary }]}>
                      enter hours
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Half Day Period Selector */}
              {duration === 'half_day' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Half Day Period</Text>
                  <View style={styles.periodButtons}>
                    {(['morning', 'afternoon'] as const).map((period) => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.periodButton,
                          { borderColor: theme.primary },
                          halfDayPeriod === period && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => {
                          console.log('AbsenceLoggerScreen: Half day period selected', period);
                          setHalfDayPeriod(period);
                        }}
                      >
                        <Text style={[styles.periodButtonText, { color: halfDayPeriod === period ? '#ffffff' : theme.primary }]}>
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Custom Hours Input */}
              {duration === 'custom_hours' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Custom Hours (max {scheduledHours.toFixed(2)}h)
                  </Text>
                  <TextInput
                    style={[styles.customHoursInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={customHoursInput}
                    onChangeText={(text) => {
                      console.log('AbsenceLoggerScreen: Custom hours input changed', text);
                      setCustomHoursInput(text);
                    }}
                    placeholder={`0 – ${scheduledHours.toFixed(2)}`}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Live Preview */}
              {scheduledHours > 0 && (
                <View style={[styles.previewCard, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                  <Text style={[styles.previewTitle, { color: theme.text }]}>Preview</Text>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Hours absent:</Text>
                    <Text style={[styles.previewValue, { color: theme.primary }]}>{absenceHoursDisplay}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Day fraction:</Text>
                    <Text style={[styles.previewValue, { color: theme.primary }]}>{dayFractionDisplay}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Scheduled hours:</Text>
                    <Text style={[styles.previewValue, { color: theme.textSecondary }]}>{scheduledHours.toFixed(2)}h</Text>
                  </View>
                </View>
              )}

              {/* Deduction Info */}
              <View style={[styles.deductionInfo, { backgroundColor: selectedIsFuture ? 'rgba(255,152,0,0.1)' : theme.background, borderWidth: selectedIsFuture ? 1 : 0, borderColor: '#FF9800' }]}>
                {selectedIsFuture ? (
                  <>
                    <Text style={[styles.deductionTitle, { color: '#FF9800' }]}>
                      🕐 Scheduled Absence (Future Date)
                    </Text>
                    <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
                      ✓ Stored as a scheduled absence
                    </Text>
                    <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
                      ✓ Will be deducted when {selectedDate.toLocaleDateString('en-GB')} arrives
                    </Text>
                    <Text style={[styles.deductionItem, { color: theme.textSecondary }]}>
                      ✓ {absenceHoursDisplay} will be deducted from monthly target on that date
                    </Text>
                    <Text style={[styles.deductionNote, { color: '#FF9800' }]}>
                      No immediate impact on current available hours
                    </Text>
                  </>
                ) : (
                  <>
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
                      ✓ Deduct {absenceHoursDisplay} from monthly target immediately
                    </Text>
                    <Text style={[styles.deductionNote, { color: theme.textSecondary }]}>
                      The workday progress bar will show "Absent" for this day
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={[styles.logButton, { backgroundColor: selectedIsFuture ? '#FF9800' : theme.primary }]}
                onPress={handleLogAbsence}
              >
                <IconSymbol
                  ios_icon_name={selectedIsFuture ? 'clock.fill' : 'checkmark.circle.fill'}
                  android_material_icon_name={selectedIsFuture ? 'schedule' : 'check-circle'}
                  size={24}
                  color="#ffffff"
                />
                <Text style={styles.logButtonText}>
                  {selectedIsFuture ? 'Schedule Absence' : 'Log Absence'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── DATE RANGE MODE ──────────────────────────────────────────── */}
          {entryMode === 'range' && (
            <>
              {/* From Date */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>From Date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    console.log('AbsenceLoggerScreen: Range from date picker opened');
                    setShowRangeFromPicker(true);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={20}
                    color={theme.primary}
                  />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDateFull(rangeFromDate)}
                  </Text>
                  {rangeFromIsFuture && (
                    <View style={[styles.futureBadge, { backgroundColor: '#FF9800' }]}>
                      <Text style={styles.futureBadgeText}>Future</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* To Date */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>To Date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.background }]}
                  onPress={() => {
                    console.log('AbsenceLoggerScreen: Range to date picker opened');
                    setShowRangeToPicker(true);
                  }}
                >
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={20}
                    color={theme.primary}
                  />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {formatDateFull(rangeToDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Absence Type */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Absence Type</Text>
                <View style={styles.typeButtons}>
                  {(['holiday', 'sickness', 'training'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        { borderColor: getAbsenceColor(type) },
                        rangeAbsenceType === type && { backgroundColor: getAbsenceColor(type) },
                      ]}
                      onPress={() => {
                        console.log('AbsenceLoggerScreen: Range absence type selected', type);
                        setRangeAbsenceType(type);
                      }}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          { color: rangeAbsenceType === type ? '#ffffff' : getAbsenceColor(type) },
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Duration */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Duration</Text>
                <View style={styles.durationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      rangeDuration === 'full_day' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Range duration selected: full_day');
                      setRangeDuration('full_day');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: rangeDuration === 'full_day' ? '#ffffff' : theme.primary }]}>
                      Full Day
                    </Text>
                    <Text style={[styles.durationHours, { color: rangeDuration === 'full_day' ? '#ffffff' : theme.textSecondary }]}>
                      per day
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      rangeDuration === 'half_day' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Range duration selected: half_day');
                      setRangeDuration('half_day');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: rangeDuration === 'half_day' ? '#ffffff' : theme.primary }]}>
                      Half Day
                    </Text>
                    <Text style={[styles.durationHours, { color: rangeDuration === 'half_day' ? '#ffffff' : theme.textSecondary }]}>
                      per day
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      { borderColor: theme.primary },
                      rangeDuration === 'custom_hours' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      console.log('AbsenceLoggerScreen: Range duration selected: custom_hours');
                      setRangeDuration('custom_hours');
                    }}
                  >
                    <Text style={[styles.durationButtonText, { color: rangeDuration === 'custom_hours' ? '#ffffff' : theme.primary }]}>
                      Custom
                    </Text>
                    <Text style={[styles.durationHours, { color: rangeDuration === 'custom_hours' ? '#ffffff' : theme.textSecondary }]}>
                      hours/day
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Half Day Period for range */}
              {rangeDuration === 'half_day' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Half Day Period</Text>
                  <View style={styles.periodButtons}>
                    {(['morning', 'afternoon'] as const).map((period) => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.periodButton,
                          { borderColor: theme.primary },
                          rangeHalfDayPeriod === period && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => {
                          console.log('AbsenceLoggerScreen: Range half day period selected', period);
                          setRangeHalfDayPeriod(period);
                        }}
                      >
                        <Text style={[styles.periodButtonText, { color: rangeHalfDayPeriod === period ? '#ffffff' : theme.primary }]}>
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Custom hours per day for range */}
              {rangeDuration === 'custom_hours' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Hours per day</Text>
                  <TextInput
                    style={[styles.customHoursInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={rangeCustomHoursInput}
                    onChangeText={(text) => {
                      console.log('AbsenceLoggerScreen: Range custom hours per day changed', text);
                      setRangeCustomHoursInput(text);
                    }}
                    placeholder="e.g. 4.5"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.notesInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={rangeNote}
                  onChangeText={(text) => {
                    console.log('AbsenceLoggerScreen: Range note changed');
                    setRangeNote(text);
                  }}
                  placeholder="Add a note..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </View>

              {/* Working Day Preview */}
              {rangeDays.length > 0 && (
                <View style={styles.formGroup}>
                  <View style={styles.rangePreviewHeader}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Working Day Preview</Text>
                    <View style={styles.rangePreviewActions}>
                      <TouchableOpacity
                        style={[styles.rangePreviewBtn, { borderColor: theme.primary }]}
                        onPress={selectAllWorkingDays}
                      >
                        <Text style={[styles.rangePreviewBtnText, { color: theme.primary }]}>Select All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rangePreviewBtn, { borderColor: theme.textSecondary }]}
                        onPress={clearAllWorkingDays}
                      >
                        <Text style={[styles.rangePreviewBtnText, { color: theme.textSecondary }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView
                    style={[styles.rangeDayList, { borderColor: theme.border }]}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {rangeDays.map((day) => {
                      const labelColor = day.isExcluded ? theme.textSecondary : theme.text;
                      const hoursText = day.scheduledHours > 0 ? day.absenceHours.toFixed(1) + 'h' : '';
                      return (
                        <View
                          key={day.dateStr}
                          style={[
                            styles.rangeDayRow,
                            { borderBottomColor: theme.border },
                            day.included && { backgroundColor: theme.primary + '11' },
                          ]}
                        >
                          <View style={styles.rangeDayInfo}>
                            <Text style={[styles.rangeDayDate, { color: labelColor }]}>
                              {formatDateShort(day.date)}
                            </Text>
                            <Text style={[styles.rangeDayLabel, { color: day.isExcluded ? theme.textSecondary : theme.primary }]}>
                              {day.label}
                            </Text>
                            {hoursText !== '' && (
                              <Text style={[styles.rangeDayHours, { color: theme.textSecondary }]}>
                                {hoursText}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleRangeDay(day.dateStr)}
                            disabled={day.isExcluded}
                            style={styles.rangeDayToggle}
                          >
                            {day.isExcluded ? (
                              <Text style={[styles.rangeDayExcluded, { color: theme.textSecondary }]}>— Excluded</Text>
                            ) : (
                              <View style={[
                                styles.rangeDayCheckbox,
                                { borderColor: theme.primary },
                                day.included && { backgroundColor: theme.primary },
                              ]}>
                                {day.included && (
                                  <IconSymbol
                                    ios_icon_name="checkmark"
                                    android_material_icon_name="check"
                                    size={12}
                                    color="#ffffff"
                                  />
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Summary */}
                  <View style={[styles.rangeSummary, { backgroundColor: theme.background }]}>
                    <Text style={[styles.rangeSummaryText, { color: theme.text }]}>
                      {rangeIncludedDays.length} working day{rangeIncludedDays.length !== 1 ? 's' : ''} selected
                    </Text>
                    <Text style={[styles.rangeSummaryText, { color: theme.primary }]}>
                      {rangeTotalHours.toFixed(2)}h total absence hours
                    </Text>
                    {rangeExcludedCount > 0 && (
                      <Text style={[styles.rangeSummaryText, { color: theme.textSecondary }]}>
                        {rangeExcludedCount} non-working or excluded date{rangeExcludedCount !== 1 ? 's' : ''} ignored
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Save Range Button */}
              <TouchableOpacity
                style={[styles.logButton, { backgroundColor: rangeFromIsFuture ? '#FF9800' : theme.primary, opacity: rangeSaving ? 0.6 : 1 }]}
                onPress={handleSaveRange}
                disabled={rangeSaving}
              >
                <IconSymbol
                  ios_icon_name={rangeFromIsFuture ? 'clock.fill' : 'checkmark.circle.fill'}
                  android_material_icon_name={rangeFromIsFuture ? 'schedule' : 'check-circle'}
                  size={24}
                  color="#ffffff"
                />
                <Text style={styles.logButtonText}>
                  {rangeSaving ? 'Saving...' : rangeFromIsFuture ? 'Schedule Range' : 'Save Range'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Monthly Summary */}
        {uniqueAbsences.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>This Month Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{totalDayFraction.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Days</Text>
                <Text style={[styles.summarySubLabel, { color: theme.textSecondary }]}>{totalAbsenceHours.toFixed(2)}h</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{pastDayFraction.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Deducted</Text>
                <Text style={[styles.summarySubLabel, { color: theme.textSecondary }]}>{pastAbsenceHours.toFixed(2)}h</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{futureDayFraction.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Scheduled</Text>
                <Text style={[styles.summarySubLabel, { color: theme.textSecondary }]}>{futureAbsenceHours.toFixed(2)}h</Text>
              </View>
            </View>
          </View>
        )}

        {/* Future (Scheduled) Absences */}
        {futureGroups.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Scheduled Absences</Text>
              <View style={[styles.sectionBadge, { backgroundColor: '#FF9800' }]}>
                <Text style={styles.sectionBadgeText}>{futureAbsences.length}</Text>
              </View>
            </View>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Future dates — not yet deducted from available hours
            </Text>
            {futureGroups.map((group) => {
              if (group.rangeId && group.items.length > 1) {
                return (
                  <RangeGroupRow
                    key={group.rangeId}
                    rangeId={group.rangeId}
                    items={group.items}
                    isFuture
                    onDelete={handleDeleteRangeGroup}
                    onDeleteSingle={handleDeleteAbsence}
                    getAbsenceColor={getAbsenceColor}
                    theme={theme}
                    fallbackScheduledHours={scheduledHours}
                  />
                );
              }
              return group.items.map(absence => (
                <AbsenceRow
                  key={absence.id}
                  absence={absence}
                  isFuture
                  onDelete={handleDeleteAbsence}
                  getAbsenceColor={getAbsenceColor}
                  theme={theme}
                  fallbackScheduledHours={scheduledHours}
                />
              ));
            })}
          </View>
        )}

        {/* Past / Today Absences */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Logged Absences</Text>
            {activeAbsences.length > 0 && (
              <View style={[styles.sectionBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.sectionBadgeText}>{activeAbsences.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Past & today — already deducted from available hours
          </Text>

          {activeGroups.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No absences logged for this month
            </Text>
          ) : (
            activeGroups.map((group) => {
              if (group.rangeId && group.items.length > 1) {
                return (
                  <RangeGroupRow
                    key={group.rangeId}
                    rangeId={group.rangeId}
                    items={group.items}
                    isFuture={false}
                    onDelete={handleDeleteRangeGroup}
                    onDeleteSingle={handleDeleteAbsence}
                    getAbsenceColor={getAbsenceColor}
                    theme={theme}
                    fallbackScheduledHours={scheduledHours}
                  />
                );
              }
              return group.items.map(absence => (
                <AbsenceRow
                  key={absence.id}
                  absence={absence}
                  isFuture={false}
                  onDelete={handleDeleteAbsence}
                  getAbsenceColor={getAbsenceColor}
                  theme={theme}
                  fallbackScheduledHours={scheduledHours}
                />
              ));
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Single day date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              console.log('AbsenceLoggerScreen: Date selected', date.toISOString().split('T')[0]);
              setSelectedDate(date);
            }
          }}
        />
      )}

      {/* Range from date picker */}
      {showRangeFromPicker && (
        <DateTimePicker
          value={rangeFromDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowRangeFromPicker(false);
            if (date) {
              console.log('AbsenceLoggerScreen: Range from date selected', date.toISOString().split('T')[0]);
              setRangeFromDate(date);
              if (date > rangeToDate) {
                const newTo = new Date(date);
                newTo.setDate(newTo.getDate() + 4);
                setRangeToDate(newTo);
              }
            }
          }}
        />
      )}

      {/* Range to date picker */}
      {showRangeToPicker && (
        <DateTimePicker
          value={rangeToDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowRangeToPicker(false);
            if (date) {
              console.log('AbsenceLoggerScreen: Range to date selected', date.toISOString().split('T')[0]);
              if (date < rangeFromDate) {
                Alert.alert('Invalid Date', 'To date must be on or after From date');
              } else {
                setRangeToDate(date);
              }
            }
          }}
        />
      )}

      {/* Success Modal */}
      <Modal
        visible={successModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Success</Text>
            <Text style={styles.modalSubtitle}>
              {successModal.type.charAt(0).toUpperCase() + successModal.type.slice(1)}
              {' logged for '}
              {successModal.date}
            </Text>

            <View style={styles.modalCheckRow}>
              <Text style={styles.modalCheckEmoji}>✅</Text>
              <Text style={styles.modalCheckText}>Day Marked as Absent</Text>
            </View>

            <Text style={styles.modalBulletHeader}>This day will:</Text>
            <View style={styles.modalBulletRow}>
              <Text style={styles.modalBulletDot}>•</Text>
              <Text style={styles.modalBulletText}>NOT be counted as a work day</Text>
            </View>
            <View style={styles.modalBulletRow}>
              <Text style={styles.modalBulletDot}>•</Text>
              <Text style={styles.modalBulletText}>NOT contribute to available hours</Text>
            </View>
            <View style={styles.modalBulletRow}>
              <Text style={styles.modalBulletDot}>•</Text>
              <Text style={styles.modalBulletText}>
                {'Have '}
                {Number(successModal.hours).toFixed(2)}
                {'h ('}
                {Number(successModal.dayFraction).toFixed(2)}
                {' day) deducted from monthly target'}
              </Text>
            </View>

            <Text style={styles.modalNote}>
              {'The workday progress bar will show "Absent" for this day.'}
            </Text>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  console.log('AbsenceLoggerScreen: Success modal dismissed');
                  setSuccessModal(prev => ({ ...prev, visible: false }));
                  loadData();
                }}
              >
                <Text style={styles.modalOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppBackground>
  );
}

// ── RangeGroupRow ──────────────────────────────────────────────────────────────

interface RangeGroupRowProps {
  rangeId: string;
  items: Absence[];
  isFuture: boolean;
  onDelete: (rangeId: string, items: Absence[]) => void;
  onDeleteSingle: (absence: Absence) => void;
  getAbsenceColor: (type: string) => string;
  theme: any;
  fallbackScheduledHours: number;
}

function RangeGroupRow({ rangeId, items, isFuture, onDelete, onDeleteSingle, getAbsenceColor, theme, fallbackScheduledHours }: RangeGroupRowProps) {
  const [expanded, setExpanded] = useState(false);

  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const totalHours = items.reduce((s, a) => s + (a.absenceHours ?? Number(a.customHours) ?? 0), 0);
  const absenceTypeName = firstItem.absenceType
    ? firstItem.absenceType.charAt(0).toUpperCase() + firstItem.absenceType.slice(1)
    : 'Absence';
  const borderColor = getAbsenceColor(firstItem.absenceType || 'holiday');

  const fromDisplay = new Date(firstItem.absenceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const toDisplay = new Date(lastItem.absenceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={[styles.rangeGroupContainer, { borderLeftColor: borderColor }]}>
      <TouchableOpacity
        style={styles.rangeGroupHeader}
        onPress={() => {
          console.log('AbsenceLoggerScreen: Range group toggled', { rangeId, expanded: !expanded });
          setExpanded(e => !e);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.rangeGroupInfo}>
          <Text style={[styles.rangeGroupType, { color: borderColor }]}>{absenceTypeName}</Text>
          <Text style={[styles.rangeGroupDates, { color: theme.text }]}>
            {fromDisplay}
          </Text>
          <Text style={[styles.rangeGroupDates, { color: theme.textSecondary }]}>
            {' – '}
            {toDisplay}
          </Text>
          <View style={styles.rangeGroupMeta}>
            <Text style={[styles.rangeGroupMetaText, { color: theme.textSecondary }]}>
              {items.length} day{items.length !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.rangeGroupMetaSep, { color: theme.textSecondary }]}> · </Text>
            <Text style={[styles.rangeGroupMetaText, { color: theme.textSecondary }]}>
              {totalHours.toFixed(2)}h
            </Text>
          </View>
        </View>
        <View style={styles.rangeGroupActions}>
          <IconSymbol
            ios_icon_name={expanded ? 'chevron.up' : 'chevron.down'}
            android_material_icon_name={expanded ? 'expand-less' : 'expand-more'}
            size={16}
            color={theme.textSecondary}
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(rangeId, items)}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color={theme.error}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && items.map(absence => (
        <AbsenceRow
          key={absence.id}
          absence={absence}
          isFuture={isFuture}
          onDelete={onDeleteSingle}
          getAbsenceColor={getAbsenceColor}
          theme={theme}
          fallbackScheduledHours={fallbackScheduledHours}
        />
      ))}
    </View>
  );
}

// ── AbsenceRow ─────────────────────────────────────────────────────────────────

interface AbsenceRowProps {
  absence: Absence;
  isFuture: boolean;
  onDelete: (absence: Absence) => void;
  getAbsenceColor: (type: string) => string;
  theme: any;
  fallbackScheduledHours: number;
}

function AbsenceRow({ absence, isFuture, onDelete, getAbsenceColor, theme, fallbackScheduledHours }: AbsenceRowProps) {
  const absenceTypeDisplay = absence.absenceType
    ? absence.absenceType.charAt(0).toUpperCase() + absence.absenceType.slice(1)
    : 'Absence';

  let durationDisplay: string;
  if (absence.duration === 'full_day') {
    durationDisplay = 'Full Day';
  } else if (absence.duration === 'half_day') {
    const period = absence.halfDayPeriod ? ` (${absence.halfDayPeriod.charAt(0).toUpperCase() + absence.halfDayPeriod.slice(1)})` : '';
    durationDisplay = `Half Day${period}`;
  } else if (absence.duration === 'custom_hours') {
    durationDisplay = 'Custom';
  } else if (absence.isHalfDay) {
    durationDisplay = 'Half Day';
  } else {
    durationDisplay = 'Full Day';
  }

  const hoursVal = absence.absenceHours ?? absence.customHours ?? 0;
  const hoursDisplay = hoursVal > 0 ? Number(hoursVal).toFixed(2) + 'h' : '—';

  const scheduledH = absence.scheduledHoursSnapshot ?? fallbackScheduledHours;
  const fraction = absence.dayFraction ?? calculateDayFraction(hoursVal, scheduledH > 0 ? scheduledH : hoursVal);
  const fractionDisplay = fraction > 0 ? fraction.toFixed(2) + ' day' : '—';

  const dateDisplay = new Date(absence.absenceDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const borderColor = getAbsenceColor(absence.absenceType || 'holiday');

  return (
    <View
      style={[
        styles.absenceItem,
        { borderLeftColor: borderColor },
        isFuture && styles.absenceItemFuture,
      ]}
    >
      <View style={styles.absenceInfo}>
        <View style={styles.absenceDateRow}>
          <Text style={[styles.absenceDate, { color: theme.text }]}>{dateDisplay}</Text>
          {isFuture && (
            <View style={[styles.scheduledBadge, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.scheduledBadgeText}>Scheduled</Text>
            </View>
          )}
        </View>
        <Text style={[styles.absenceType, { color: borderColor }]}>{absenceTypeDisplay}</Text>
        <Text style={[styles.absenceDuration, { color: theme.textSecondary }]}>
          {durationDisplay}
        </Text>
        <View style={styles.absenceMetaRow}>
          <Text style={[styles.absenceMeta, { color: theme.textSecondary }]}>{hoursDisplay}</Text>
          <Text style={[styles.absenceMetaSep, { color: theme.textSecondary }]}> · </Text>
          <Text style={[styles.absenceMeta, { color: theme.textSecondary }]}>{fractionDisplay}</Text>
        </View>
        <Text style={[styles.absenceDeduction, { color: isFuture ? '#FF9800' : theme.textSecondary }]}>
          {isFuture ? 'Pending — deducted when date arrives' : 'Day not counted as work day'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(absence)}
      >
        <IconSymbol
          ios_icon_name="trash.fill"
          android_material_icon_name="delete"
          size={20}
          color={theme.error}
        />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  sectionBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  sectionBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  futureBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  futureBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
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
    gap: 8,
  },
  durationButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  durationHours: {
    fontSize: 11,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customHoursInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 13,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '700',
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
  // Range preview
  rangePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rangePreviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rangePreviewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  rangePreviewBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rangeDayList: {
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rangeDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  rangeDayInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rangeDayDate: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 80,
  },
  rangeDayLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  rangeDayHours: {
    fontSize: 12,
  },
  rangeDayToggle: {
    paddingLeft: 8,
  },
  rangeDayCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeDayExcluded: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  rangeSummary: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  rangeSummaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Absence list
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
  absenceItemFuture: {
    opacity: 0.8,
    borderStyle: 'dashed',
  },
  absenceInfo: {
    flex: 1,
  },
  absenceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  absenceDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  scheduledBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scheduledBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
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
  absenceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  absenceMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  absenceMetaSep: {
    fontSize: 12,
  },
  absenceDeduction: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
  },
  // Range group
  rangeGroupContainer: {
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  rangeGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  rangeGroupInfo: {
    flex: 1,
  },
  rangeGroupType: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  rangeGroupDates: {
    fontSize: 15,
    fontWeight: '600',
  },
  rangeGroupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rangeGroupMetaText: {
    fontSize: 12,
  },
  rangeGroupMetaSep: {
    fontSize: 12,
  },
  rangeGroupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summarySubLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    opacity: 0.3,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1e2a3a',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 24,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  modalCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modalCheckEmoji: {
    fontSize: 20,
  },
  modalCheckText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalBulletHeader: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 6,
  },
  modalBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  modalBulletDot: {
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  modalBulletText: {
    fontSize: 15,
    color: '#ffffff',
    flex: 1,
    lineHeight: 22,
  },
  modalNote: {
    fontSize: 14,
    color: '#a0aec0',
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 20,
  },
  modalFooter: {
    alignItems: 'flex-end',
    marginTop: 20,
  },
  modalOkText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
});
