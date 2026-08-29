
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api } from '@/utils/api';
import { offlineStorage } from '@/utils/offlineStorage';
import {
  getJobImages,
  saveJobImage,
  saveImageRecord,
  deleteJobImage,
  StoredImage,
} from '@/utils/imageStorage';
import { updateWidgetData } from '@/utils/widgetManager';
import { jobHistoryStorage, JobHistoryEntry } from '@/utils/jobHistoryStorage';
import { normalizeWip } from '@/utils/wipEngine';
import { awToHours } from '@/utils/billingEngine';

const VHC_COLORS: Record<string, string> = {
  NONE: '#636366',
  GREEN: '#30D158',
  ORANGE: '#FF9F0A',
  RED: '#FF453A',
};

export default function EditJobScreen() {
  const { theme } = useThemeContext();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<JobHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const originalJobRef = useRef<{ wipNumber: string; vehicleReg: string; aw: number; notes: string; vhcStatus: string } | null>(null);

  // Fields
  const [wipNumber, setWipNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [aw, setAw] = useState('');
  const [notes, setNotes] = useState('');
  const [vhcStatus, setVhcStatus] = useState<'NONE' | 'GREEN' | 'ORANGE' | 'RED'>('NONE');
  const [jobDate, setJobDate] = useState(new Date());
  const [images, setImages] = useState<StoredImage[]>([]);

  // Validation errors
  const [wipError, setWipError] = useState('');
  const [awError, setAwError] = useState('');

  // Date/time pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    console.log('EditJobScreen: Loading job:', jobId);
    try {
      const allJobs = await offlineStorage.getAllJobs();
      const job = allJobs.find((j) => j.id === jobId);
      if (job) {
        setWipNumber(job.wipNumber);
        setVehicleReg(job.vehicleReg);
        setAw(String(job.aw));
        setNotes(job.notes || '');
        setVhcStatus(job.vhcStatus || 'NONE');
        setJobDate(new Date(job.createdAt));
        // Store original values for change detection
        originalJobRef.current = {
          wipNumber: job.wipNumber,
          vehicleReg: job.vehicleReg,
          aw: job.aw ?? 0,
          notes: job.notes || '',
          vhcStatus: job.vhcStatus || 'NONE',
        };
        console.log('EditJobScreen: Job loaded successfully:', jobId);
        const imgs = await getJobImages(job.id);
        console.log('EditJobScreen: Loaded', imgs.length, 'images for job:', jobId);
        setImages(imgs);
        // Load session history
        try {
          const history = await jobHistoryStorage.getForJob(job.id);
          setSessionHistory(history);
          console.log('EditJobScreen: Loaded', history.length, 'history events for job:', jobId);
        } catch (histErr) {
          console.warn('EditJobScreen: Failed to load session history (non-fatal):', histErr);
        }
      } else {
        console.warn('EditJobScreen: Job not found:', jobId);
        Alert.alert('Error', 'Job not found', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (e) {
      console.error('EditJobScreen: Error loading job:', e);
      Alert.alert('Error', 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        const newDate = new Date(selectedDate);
        newDate.setHours(jobDate.getHours(), jobDate.getMinutes());
        setJobDate(newDate);
        console.log('EditJobScreen: Android date selected, chaining to time picker imperatively');
        // Chain to time picker using imperative API
        DateTimePickerAndroid.open({
          value: newDate,
          mode: 'time',
          is24Hour: true,
          onChange: (evt: any, selectedTime?: Date) => {
            if (evt.type === 'set' && selectedTime) {
              const finalDate = new Date(newDate);
              finalDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
              setJobDate(finalDate);
              console.log('EditJobScreen: Android time selected:', selectedTime.getHours(), selectedTime.getMinutes());
            }
          },
        });
      }
    } else {
      if (selectedDate) setJobDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedTime) {
        const newDate = new Date(jobDate);
        newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
        setJobDate(newDate);
        console.log('EditJobScreen: Android time selected:', selectedTime.getHours(), selectedTime.getMinutes());
      }
    } else {
      if (selectedTime) {
        const newDate = new Date(jobDate);
        newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
        setJobDate(newDate);
      }
    }
  };

  const handleAddImage = async (source: 'camera' | 'gallery') => {
    if (!jobId) return;
    console.log('EditJobScreen: User adding image from', source, 'for job:', jobId);
    setImageLoading(true);
    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

      if (!result.canceled && result.assets[0]) {
        console.log('EditJobScreen: Image selected, saving to storage...');
        const stored = await saveJobImage(jobId, result.assets[0].uri);
        await saveImageRecord(stored);
        await api.updateJob(jobId, { imageUri: stored.uri });
        const updated = await getJobImages(jobId);
        setImages(updated);
        console.log('EditJobScreen: Image saved, total images:', updated.length);
      }
    } catch (e) {
      console.error('EditJobScreen: Error adding image:', e);
      Alert.alert('Error', 'Failed to add image');
    } finally {
      setImageLoading(false);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    Alert.alert('Delete Photo', 'Remove this photo from the job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log('EditJobScreen: User confirmed delete image:', imageId);
          try {
            await deleteJobImage(imageId);
            if (jobId) {
              const updated = await getJobImages(jobId);
              setImages(updated);
              console.log('EditJobScreen: Image deleted, remaining:', updated.length);
            }
          } catch (e) {
            console.error('EditJobScreen: Error deleting image:', e);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    console.log('EditJobScreen: User tapped Save Changes button');
    setWipError('');
    setAwError('');

    if (wipNumber.length !== 5 || !/^\d+$/.test(wipNumber)) {
      setWipError('WIP must be exactly 5 digits');
      return;
    }
    const awNum = parseInt(aw, 10);
    if (isNaN(awNum) || awNum < 0 || awNum > 100) {
      setAwError('AW must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      console.log('EditJobScreen: Saving job:', jobId, { wipNumber, vehicleReg, aw: awNum, vhcStatus });
      await api.updateJob(jobId!, {
        wipNumber,
        vehicleReg: vehicleReg.toUpperCase(),
        aw: awNum,
        notes,
        vhcStatus,
        createdAt: jobDate.toISOString(),
      });
      console.log('EditJobScreen: Job saved successfully, recording history events');

      // Record history events for meaningful changes
      const normWip = normalizeWip(wipNumber);
      const orig = originalJobRef.current;
      if (orig) {
        const origAw = orig.aw ?? 0;
        const origHours = awToHours(origAw);
        const newHours = awToHours(awNum);

        if (awNum !== origAw) {
          console.log('EditJobScreen: AW changed:', origAw, '->', awNum, '— recording AW_CHANGED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'AW_CHANGED',
            timestamp: new Date().toISOString(),
            description: `AW changed: ${origAw} → ${awNum}`,
            previousValue: String(origAw),
            newValue: String(awNum),
            awValue: awNum,
          });
          console.log('EditJobScreen: Hours changed:', origHours.toFixed(1), '->', newHours.toFixed(1), '— recording HOURS_CHANGED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'HOURS_CHANGED',
            timestamp: new Date().toISOString(),
            description: `Hours changed: ${origHours.toFixed(1)}h → ${newHours.toFixed(1)}h`,
            previousValue: origHours.toFixed(1),
            newValue: newHours.toFixed(1),
            hoursValue: newHours,
          });
        }

        if (notes !== (orig.notes ?? '')) {
          console.log('EditJobScreen: Notes changed — recording NOTES_UPDATED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'NOTES_UPDATED',
            timestamp: new Date().toISOString(),
            description: 'Job notes updated',
            previousValue: orig.notes ?? '',
            newValue: notes,
          });
        }

        if (vhcStatus !== orig.vhcStatus) {
          console.log('EditJobScreen: VHC changed:', orig.vhcStatus, '->', vhcStatus, '— recording VHC_UPDATED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'VHC_UPDATED',
            timestamp: new Date().toISOString(),
            description: `VHC updated: ${orig.vhcStatus} → ${vhcStatus}`,
            previousValue: orig.vhcStatus,
            newValue: vhcStatus,
          });
        }

        if (normalizeWip(wipNumber) !== normalizeWip(orig.wipNumber ?? '')) {
          console.log('EditJobScreen: WIP changed:', orig.wipNumber, '->', wipNumber, '— recording WIP_CHANGED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'WIP_CHANGED',
            timestamp: new Date().toISOString(),
            description: `WIP changed: ${orig.wipNumber} → ${wipNumber}`,
            previousValue: orig.wipNumber,
            newValue: wipNumber,
          });
        }

        if (vehicleReg.toUpperCase() !== (orig.vehicleReg ?? '').toUpperCase()) {
          console.log('EditJobScreen: Reg changed:', orig.vehicleReg, '->', vehicleReg.toUpperCase(), '— recording REG_CHANGED');
          await jobHistoryStorage.recordEvent({
            jobId: jobId!,
            wipNumber: normWip,
            eventType: 'REG_CHANGED',
            timestamp: new Date().toISOString(),
            description: `Registration changed: ${orig.vehicleReg} → ${vehicleReg.toUpperCase()}`,
            previousValue: orig.vehicleReg,
            newValue: vehicleReg.toUpperCase(),
          });
        }
      }

      console.log('EditJobScreen: History recorded, updating widget data');
      await updateWidgetData();
      console.log('EditJobScreen: Closing screen after successful save (800ms delay)');
      setTimeout(() => router.back(), 800);
    } catch (e) {
      console.error('EditJobScreen: Error saving job:', e);
      Alert.alert('Error', 'Failed to save job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const dateDisplay = jobDate.toLocaleDateString('en-GB');
  const timeDisplay = jobDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading job...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* WIP Number */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>WIP Number</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text, borderColor: wipError ? '#FF453A' : theme.border },
          ]}
          value={wipNumber}
          onChangeText={(t) => {
            setWipNumber(t);
            if (wipError) setWipError('');
          }}
          keyboardType="number-pad"
          maxLength={5}
          placeholder="12345"
          placeholderTextColor={theme.textSecondary}
        />
        {wipError ? <Text style={styles.errorText}>{wipError}</Text> : null}

        {/* Vehicle Reg */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>Vehicle Registration</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          value={vehicleReg}
          onChangeText={(t) => setVehicleReg(t.toUpperCase())}
          autoCapitalize="characters"
          placeholder="AB12 CDE"
          placeholderTextColor={theme.textSecondary}
        />

        {/* AW Value */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>AW Value</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text, borderColor: awError ? '#FF453A' : theme.border },
          ]}
          value={aw}
          onChangeText={(t) => {
            setAw(t);
            if (awError) setAwError('');
          }}
          keyboardType="number-pad"
          placeholder="0–100"
          placeholderTextColor={theme.textSecondary}
        />
        {awError ? <Text style={styles.errorText}>{awError}</Text> : null}

        {/* VHC Status */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>VHC Status</Text>
        <View style={styles.vhcRow}>
          {(['NONE', 'GREEN', 'ORANGE', 'RED'] as const).map((v) => {
            const isActive = vhcStatus === v;
            const vhcColor = VHC_COLORS[v];
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.vhcButton,
                  {
                    backgroundColor: isActive ? vhcColor : theme.card,
                    borderColor: isActive ? vhcColor : theme.border,
                  },
                ]}
                onPress={() => {
                  console.log('EditJobScreen: User changed VHC status to:', v);
                  setVhcStatus(v);
                }}
              >
                <Text style={[styles.vhcButtonText, { color: isActive ? '#ffffff' : theme.textSecondary }]}>
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date & Time */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={[styles.dateTimeButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {
              console.log('EditJobScreen: User tapped date picker');
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: jobDate,
                  mode: 'date',
                  maximumDate: new Date(),
                  onChange: handleDateChange,
                });
              } else {
                setShowDatePicker(true);
              }
            }}
          >
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={16}
              color={theme.primary}
            />
            <Text style={[styles.dateTimeText, { color: theme.text }]}>{dateDisplay}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateTimeButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {
              console.log('EditJobScreen: User tapped time picker');
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: jobDate,
                  mode: 'time',
                  is24Hour: true,
                  onChange: handleTimeChange,
                });
              } else {
                setShowTimePicker(true);
              }
            }}
          >
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={16}
              color={theme.primary}
            />
            <Text style={[styles.dateTimeText, { color: theme.text }]}>{timeDisplay}</Text>
          </TouchableOpacity>
        </View>

        {/* iOS inline pickers */}
        {showDatePicker && Platform.OS === 'ios' && (
          <DateTimePicker
            value={jobDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
        {showTimePicker && Platform.OS === 'ios' && (
          <DateTimePicker
            value={jobDate}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}

        {/* Notes */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="Optional notes..."
          placeholderTextColor={theme.textSecondary}
          textAlignVertical="top"
        />

        {/* Job Photos */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>Job Photos</Text>

        {images.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailScroll}
            contentContainerStyle={styles.thumbnailScrollContent}
          >
            {images.map((img) => (
              <View key={img.id} style={styles.thumbnailWrapper}>
                <ExpoImage source={{ uri: img.uri }} style={styles.thumbnail} contentFit="cover" />
                <TouchableOpacity
                  style={styles.thumbnailDeleteBtn}
                  onPress={() => {
                    console.log('EditJobScreen: User tapped delete image:', img.id);
                    handleDeleteImage(img.id);
                  }}
                >
                  <Text style={styles.thumbnailDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {imageLoading ? (
          <View style={styles.imageLoadingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.imageLoadingText, { color: theme.textSecondary }]}>Saving image...</Text>
          </View>
        ) : (
          <View style={styles.imageButtonsRow}>
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                console.log('EditJobScreen: User tapped Camera button');
                handleAddImage('camera');
              }}
            >
              <Text style={styles.imagePickerButtonText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePickerButton, { backgroundColor: theme.secondary }]}
              onPress={() => {
                console.log('EditJobScreen: User tapped Gallery button');
                handleAddImage('gallery');
              }}
            >
              <Text style={styles.imagePickerButtonText}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SESSION HISTORY */}
        {sessionHistory.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <TouchableOpacity
              onPress={() => {
                console.log('EditJobScreen: Session history toggle tapped, expanding:', !historyExpanded);
                setHistoryExpanded(v => !v);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text style={[styles.label, { color: theme.textSecondary, marginTop: 0, marginBottom: 0 }]}>
                SESSION HISTORY
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                {historyExpanded ? '▲ HIDE' : `▼ SHOW (${sessionHistory.length})`}
              </Text>
            </TouchableOpacity>
            {historyExpanded && (
              <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }}>
                {sessionHistory.map((entry, idx) => {
                  const entryDate = new Date(entry.timestamp);
                  const entryDateStr = entryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                  const entryTimeStr = entryDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                  const isLast = idx === sessionHistory.length - 1;
                  return (
                    <View
                      key={entry.id}
                      style={{
                        flexDirection: 'row',
                        paddingBottom: isLast ? 0 : 10,
                        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                        marginBottom: isLast ? 0 : 10,
                      }}
                    >
                      <Text style={{ color: theme.textSecondary, fontSize: 10, width: 80 }}>
                        {entryDateStr}
                        {'\n'}
                        {entryTimeStr}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
                          {entry.eventType.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
                          {entry.description}
                        </Text>
                        {entry.previousValue !== undefined && entry.newValue !== undefined && (
                          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' }}>
                            <Text style={{ color: '#ff6b6b', fontSize: 11 }}>{entry.previousValue}</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>→</Text>
                            <Text style={{ color: '#4fc3f7', fontSize: 11 }}>{entry.newValue}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Bottom padding so save button doesn't overlap content */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Save Button */}
      <View style={[styles.saveContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: saving ? theme.secondary : theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
        {wipNumber.length === 5 && (
          <TouchableOpacity
            onPress={() => {
              console.log('EditJob: Continue This WIP tapped — WIP:', wipNumber);
              router.push({
                pathname: '/add-job-modal',
                params: {
                  continueWip: wipNumber,
                  continueReg: vehicleReg,
                  returnToWorkspace: 'true',
                },
              } as any);
            }}
            style={{
              backgroundColor: 'rgba(79,195,247,0.10)',
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginTop: 8,
              borderWidth: 1,
              borderColor: '#4fc3f7',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#4fc3f7', fontWeight: '700', fontSize: 14 }}>
              CONTINUE THIS WIP
            </Text>
            <Text style={{ color: '#4fc3f7', fontSize: 11, opacity: 0.8, marginTop: 2 }}>
              Add another work session to WIP {wipNumber}
            </Text>
          </TouchableOpacity>
        )}
      </View>


    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  vhcRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vhcButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  vhcButtonText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  thumbnailScroll: {
    marginBottom: 12,
  },
  thumbnailScrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 88,
    height: 88,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 10,
  },
  thumbnailDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF453A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailDeleteText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  imageLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  imageLoadingText: {
    fontSize: 14,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  imagePickerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 16,
  },
  saveContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
