
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
  const [successModal, setSuccessModal] = useState<{ visible: boolean; date: string; hours: number; type: string }>({
    visible: false,
    date: '',
    hours: 0,
    type: 'holiday',
  });

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (dayOfWeek === 6 && schedule.saturdayDailyHours !== undefined) {
      return schedule.saturdayDailyHours;
    }
    return schedule.dailyWorkingHours;
  };

  const isAbsenceFuture = (absenceDate: string): boolean => {
    return absenceDate > todayStr;
  };

  const isAbsenceToday = (absenceDate: string): boolean => {
    return absenceDate === todayStr;
  };

  const handleLogAbsence = async () => {
    console.log('AbsenceLoggerScreen: Log absence button pressed');

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

    const dailyHours = getHoursForDate(selectedDate);
    const hours = isHalfDay ? dailyHours / 2 : dailyHours;

    const absenceTypeName = absenceType.charAt(0).toUpperCase() + absenceType.slice(1);
    const durationName = isHalfDay ? 'Half Day' : 'Full Day';
    const isFuture = dateStr > todayStr;

    const deductionNote = isFuture
      ? `Scheduled for ${selectedDate.toLocaleDateString('en-GB')} — will be deducted when the date arrives`
      : `Deducted immediately from available hours`;

    try {
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

      console.log('AbsenceLoggerScreen: Absence logged successfully —', isFuture ? 'FUTURE (pending)' : 'PAST/TODAY (active)');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      setSuccessModal({ visible: true, date: formattedDate, hours, type: absenceType });
    } catch (error) {
      console.error('AbsenceLoggerScreen: Error logging absence:', error);
      Alert.alert('Error', 'Failed to log absence');
    }
  };

  const handleDeleteAbsence = async (absence: Absence) => {
    console.log('AbsenceLoggerScreen: Delete absence button pressed for id:', absence.id);

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
              console.log('AbsenceLoggerScreen: Absence deleted — day restored as working day');
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

  // Summary totals
  const totalAbsenceHours = uniqueAbsences.reduce((sum, a) => sum + (Number(a.customHours) || 0), 0);
  const pastAbsenceHours = activeAbsences.reduce((sum, a) => sum + (Number(a.customHours) || 0), 0);
  const futureAbsenceHours = futureAbsences.reduce((sum, a) => sum + (Number(a.customHours) || 0), 0);

  console.log('AbsenceLoggerScreen: Displaying', activeAbsences.length, 'active,', futureAbsences.length, 'future absences');
  console.log('AbsenceLoggerScreen: Summary — total:', totalAbsenceHours.toFixed(2), 'h, past:', pastAbsenceHours.toFixed(2), 'h, future:', futureAbsenceHours.toFixed(2), 'h');

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const selectedIsFuture = selectedDateStr > todayStr;
  const hoursDisplay = schedule
    ? (isHalfDay ? getHoursForDate(selectedDate) / 2 : getHoursForDate(selectedDate)).toFixed(2)
    : '0';

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
                {selectedDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              {selectedIsFuture && (
                <View style={[styles.futureBadge, { backgroundColor: '#FF9800' }]}>
                  <Text style={styles.futureBadgeText}>Future</Text>
                </View>
              )}
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
                <Text style={[styles.durationButtonText, { color: !isHalfDay ? '#ffffff' : theme.primary }]}>
                  Full Day
                </Text>
                {schedule && (
                  <Text style={[styles.durationHours, { color: !isHalfDay ? '#ffffff' : theme.textSecondary }]}>
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
                <Text style={[styles.durationButtonText, { color: isHalfDay ? '#ffffff' : theme.primary }]}>
                  Half Day
                </Text>
                {schedule && (
                  <Text style={[styles.durationHours, { color: isHalfDay ? '#ffffff' : theme.textSecondary }]}>
                    {(getHoursForDate(selectedDate) / 2).toFixed(2)}h
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

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
                  ✓ {hoursDisplay}h will be deducted from monthly target on that date
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
                  ✓ Deduct {hoursDisplay}h from monthly target immediately
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
              {selectedIsFuture ? 'Schedule Absence' : 'Log 1 Day Absence'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Summary */}
        {uniqueAbsences.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>This Month Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{totalAbsenceHours.toFixed(2)}h</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Absent</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{pastAbsenceHours.toFixed(2)}h</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Deducted</Text>
                <Text style={[styles.summarySubLabel, { color: theme.textSecondary }]}>{activeAbsences.length} day{activeAbsences.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{futureAbsenceHours.toFixed(2)}h</Text>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Scheduled</Text>
                <Text style={[styles.summarySubLabel, { color: theme.textSecondary }]}>{futureAbsences.length} day{futureAbsences.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Future (Scheduled) Absences */}
        {futureAbsences.length > 0 && (
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
            {futureAbsences.map((absence) => (
              <AbsenceRow
                key={absence.id}
                absence={absence}
                isFuture
                onDelete={handleDeleteAbsence}
                getAbsenceColor={getAbsenceColor}
                theme={theme}
              />
            ))}
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

          {activeAbsences.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No absences logged for this month
            </Text>
          ) : (
            activeAbsences.map((absence) => (
              <AbsenceRow
                key={absence.id}
                absence={absence}
                isFuture={false}
                onDelete={handleDeleteAbsence}
                getAbsenceColor={getAbsenceColor}
                theme={theme}
              />
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
              console.log('AbsenceLoggerScreen: Date selected:', date.toISOString().split('T')[0]);
              setSelectedDate(date);
            }
          }}
        />
      )}

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
                {'h deducted from monthly target'}
              </Text>
            </View>

            <Text style={styles.modalNote}>
              {'The workday progress bar will show "Absent" for this day.'}
            </Text>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  console.log('AbsenceLoggerScreen: Success modal OK pressed');
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

interface AbsenceRowProps {
  absence: Absence;
  isFuture: boolean;
  onDelete: (absence: Absence) => void;
  getAbsenceColor: (type: string) => string;
  theme: any;
}

function AbsenceRow({ absence, isFuture, onDelete, getAbsenceColor, theme }: AbsenceRowProps) {
  const absenceTypeDisplay = absence.absenceType
    ? absence.absenceType.charAt(0).toUpperCase() + absence.absenceType.slice(1)
    : 'Absence';
  const durationDisplay = absence.isHalfDay ? 'Half Day' : 'Full Day';
  const hoursDisplay = absence.customHours !== undefined ? Number(absence.customHours).toFixed(2) : '—';
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
        <Text style={[styles.absenceDuration, { color: theme.textSecondary }]}>
          {hoursDisplay}h
        </Text>
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
  absenceDeduction: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
  },
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
