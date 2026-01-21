
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours, validateWipNumber, validateAW } from '@/utils/jobCalculations';
import { api, OCRRegResult, OCRJobCardResult } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toastManager } from '@/utils/toastManager';
import { ProcessNotification } from '@/components/ProcessNotification';
import * as Haptics from 'expo-haptics';

export default function AddJobModal() {
  const { theme, overlayStrength, isDarkMode } = useThemeContext();
  const router = useRouter();
  const [wipNumber, setWipNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [aw, setAw] = useState(0);
  const [notes, setNotes] = useState('');
  const [vhcStatus, setVhcStatus] = useState<'NONE' | 'GREEN' | 'ORANGE' | 'RED'>('NONE');
  const [saving, setSaving] = useState(false);
  const [showAwPicker, setShowAwPicker] = useState(false);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [saveNotificationType, setSaveNotificationType] = useState<'loading' | 'success' | 'error'>('loading');
  const [jobDateTime, setJobDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [jobMemory, setJobMemory] = useState<Map<string, { wipNumber: string; vehicleReg: string }>>(new Map());

  const awOptions = Array.from({ length: 101 }, (_, i) => i);

  // Load job memory from previous jobs
  useEffect(() => {
    loadJobMemory();
  }, []);

  const loadJobMemory = async () => {
    try {
      const jobs = await api.getAllJobs();
      const memory = new Map<string, { wipNumber: string; vehicleReg: string }>();
      
      // Group by vehicle reg and remember the most recent WIP for each
      jobs.forEach(job => {
        const key = job.vehicleReg.toUpperCase();
        if (!memory.has(key) || new Date(job.createdAt) > new Date(memory.get(key)!.wipNumber)) {
          memory.set(key, { wipNumber: job.wipNumber, vehicleReg: job.vehicleReg });
        }
      });
      
      setJobMemory(memory);
      console.log('AddJobModal: Loaded job memory for', memory.size, 'vehicles');
    } catch (error) {
      console.error('AddJobModal: Error loading job memory:', error);
    }
  };

  // Auto-fill WIP when vehicle reg is entered
  useEffect(() => {
    if (vehicleReg.length >= 3) {
      const key = vehicleReg.toUpperCase();
      const remembered = jobMemory.get(key);
      if (remembered && !wipNumber) {
        console.log('AddJobModal: Auto-filling WIP from memory:', remembered.wipNumber);
        setWipNumber(remembered.wipNumber);
        toastManager.info(`Remembered WIP: ${remembered.wipNumber}`);
      }
    }
  }, [vehicleReg]);

  const handleSave = async (saveAnother: boolean = false) => {
    console.log('AddJobModal: User tapped Save button, saveAnother:', saveAnother);
    
    if (!validateWipNumber(wipNumber)) {
      toastManager.error('WIP number must be exactly 5 digits');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!vehicleReg.trim()) {
      toastManager.error('Vehicle registration is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!validateAW(aw)) {
      toastManager.error('AW must be between 0 and 100');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    setShowSaveNotification(true);
    setSaveNotificationType('loading');
    
    try {
      const jobData = {
        wipNumber,
        vehicleReg: vehicleReg.toUpperCase(),
        aw,
        notes: notes.trim() || undefined,
        vhcStatus,
        createdAt: jobDateTime.toISOString(),
      };
      
      console.log('AddJobModal: Saving job:', jobData);
      await api.createJob(jobData);
      
      // Show success notification
      setSaveNotificationType('success');
      toastManager.success('Job saved successfully!');
      
      // Wait a moment before hiding notification
      setTimeout(() => {
        setShowSaveNotification(false);
        
        if (saveAnother) {
          console.log('AddJobModal: Clearing form for next job');
          setWipNumber('');
          setVehicleReg('');
          setAw(0);
          setNotes('');
          setVhcStatus('NONE');
          setJobDateTime(new Date());
        } else {
          router.back();
        }
      }, 1500);
    } catch (error) {
      console.error('AddJobModal: Error saving job:', error);
      setSaveNotificationType('error');
      toastManager.error(error instanceof Error ? error.message : 'Failed to save job');
      
      setTimeout(() => {
        setShowSaveNotification(false);
      }, 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleScanReg = async (source: 'camera' | 'gallery') => {
    console.log('AddJobModal: User scanning registration from', source);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          });

      if (!result.canceled && result.assets[0]) {
        console.log('AddJobModal: Image selected, scanning...');
        toastManager.info('Scanning registration...');
        
        const ocrResult: OCRRegResult = await api.scanRegistration(result.assets[0].uri);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          'Confirm Registration',
          `Detected: ${ocrResult.registration}\n\nAlternatives:\n${ocrResult.alternatives.join('\n')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Detected',
              onPress: () => {
                console.log('AddJobModal: User confirmed registration:', ocrResult.registration);
                setVehicleReg(ocrResult.registration);
                toastManager.success('Registration scanned!');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobModal: Error scanning registration:', error);
      toastManager.error('Failed to scan registration');
    }
  };

  const handleScanJobCard = async (source: 'camera' | 'gallery') => {
    console.log('AddJobModal: User scanning job card from', source);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          });

      if (!result.canceled && result.assets[0]) {
        console.log('AddJobModal: Image selected, scanning job card...');
        toastManager.info('Scanning job card...');
        
        const ocrResult: OCRJobCardResult = await api.scanJobCard(result.assets[0].uri);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          'Confirm Job Card Details',
          `WIP: ${ocrResult.wipNumber}\nReg: ${ocrResult.registration}\n\nAlternatives:\nWIP: ${ocrResult.wipAlternatives.join(', ')}\nReg: ${ocrResult.regAlternatives.join(', ')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Detected',
              onPress: () => {
                console.log('AddJobModal: User confirmed job card data');
                setWipNumber(ocrResult.wipNumber);
                setVehicleReg(ocrResult.registration);
                toastManager.success('Job card scanned!');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobModal: Error scanning job card:', error);
      toastManager.error('Failed to scan job card');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    console.log('AddJobModal: Date picker event:', event.type, selectedDate);
    
    // On Android, the picker closes automatically after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    // Handle dismissal (user cancelled)
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    // Update date if a date was selected
    if (selectedDate) {
      const newDateTime = new Date(jobDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setJobDateTime(newDateTime);
      console.log('AddJobModal: Date updated to:', newDateTime.toLocaleDateString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // On iOS, close the picker after selection
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    console.log('AddJobModal: Time picker event:', event.type, selectedDate);
    
    // On Android, the picker closes automatically after selection
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    // Handle dismissal (user cancelled)
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    
    // Update time if a time was selected
    if (selectedDate) {
      const newDateTime = new Date(jobDateTime);
      newDateTime.setHours(selectedDate.getHours());
      newDateTime.setMinutes(selectedDate.getMinutes());
      setJobDateTime(newDateTime);
      console.log('AddJobModal: Time updated to:', newDateTime.toLocaleTimeString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // On iOS, close the picker after selection
      if (Platform.OS === 'ios') {
        setShowTimePicker(false);
      }
    }
  };

  const calculatedMinutes = awToMinutes(aw);
  
  const getVhcColor = (status: string) => {
    switch (status) {
      case 'GREEN': return '#4CAF50';
      case 'ORANGE': return '#FF9800';
      case 'RED': return '#f44336';
      default: return '#999';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: 'Add Job',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={28}
                color={isDarkMode ? '#fff' : '#000'}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>WIP Number *</Text>
                  <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.secondary }]}
                    onPress={() => {
                      console.log('AddJobModal: User tapped Scan Job Card button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Alert.alert('Scan Job Card', 'Choose source:', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Camera', onPress: () => handleScanJobCard('camera') },
                        { text: 'Gallery', onPress: () => handleScanJobCard('gallery') },
                      ]);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="doc.text.viewfinder"
                      android_material_icon_name="document-scanner"
                      size={16}
                      color="#ffffff"
                    />
                    <Text style={styles.scanButtonText}>Scan Card</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#000' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: theme.primary
                  }]}
                  value={wipNumber}
                  onChangeText={setWipNumber}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="12345"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>Vehicle Registration *</Text>
                  <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.secondary }]}
                    onPress={() => {
                      console.log('AddJobModal: User tapped Scan Reg button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      Alert.alert('Scan Registration', 'Choose source:', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Camera', onPress: () => handleScanReg('camera') },
                        { text: 'Gallery', onPress: () => handleScanReg('gallery') },
                      ]);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="camera.viewfinder"
                      android_material_icon_name="camera"
                      size={16}
                      color="#ffffff"
                    />
                    <Text style={styles.scanButtonText}>Scan Reg</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#000' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: theme.primary
                  }]}
                  value={vehicleReg}
                  onChangeText={(text) => setVehicleReg(text.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="ABC123"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>AW Value *</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { 
                    backgroundColor: isDarkMode ? '#000' : '#fff',
                    borderColor: theme.primary
                  }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAwPicker(true);
                  }}
                >
                  <Text style={[styles.pickerButtonText, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {aw} AW
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-drop-down"
                    size={24}
                    color={isDarkMode ? '#888' : '#999'}
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>VHC Status</Text>
                <View style={styles.vhcTickBoxes}>
                  <TouchableOpacity
                    style={[
                      styles.vhcTickBox,
                      { borderColor: '#4CAF50' },
                      vhcStatus === 'GREEN' && { backgroundColor: '#4CAF50' },
                    ]}
                    onPress={() => {
                      console.log('AddJobModal: User selected VHC GREEN');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVhcStatus(vhcStatus === 'GREEN' ? 'NONE' : 'GREEN');
                    }}
                  >
                    {vhcStatus === 'GREEN' && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={24}
                        color="#ffffff"
                      />
                    )}
                    <Text style={[styles.vhcTickLabel, { color: vhcStatus === 'GREEN' ? '#ffffff' : '#4CAF50' }]}>
                      Green
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.vhcTickBox,
                      { borderColor: '#FF9800' },
                      vhcStatus === 'ORANGE' && { backgroundColor: '#FF9800' },
                    ]}
                    onPress={() => {
                      console.log('AddJobModal: User selected VHC AMBER');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVhcStatus(vhcStatus === 'ORANGE' ? 'NONE' : 'ORANGE');
                    }}
                  >
                    {vhcStatus === 'ORANGE' && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={24}
                        color="#ffffff"
                      />
                    )}
                    <Text style={[styles.vhcTickLabel, { color: vhcStatus === 'ORANGE' ? '#ffffff' : '#FF9800' }]}>
                      Amber
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.vhcTickBox,
                      { borderColor: '#f44336' },
                      vhcStatus === 'RED' && { backgroundColor: '#f44336' },
                    ]}
                    onPress={() => {
                      console.log('AddJobModal: User selected VHC RED');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVhcStatus(vhcStatus === 'RED' ? 'NONE' : 'RED');
                    }}
                  >
                    {vhcStatus === 'RED' && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={24}
                        color="#ffffff"
                      />
                    )}
                    <Text style={[styles.vhcTickLabel, { color: vhcStatus === 'RED' ? '#ffffff' : '#f44336' }]}>
                      Red
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.timeDisplay, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
                <View style={styles.timeItem}>
                  <Text style={[styles.timeLabel, { color: isDarkMode ? '#888' : '#666' }]}>Time</Text>
                  <Text style={[styles.timeValue, { color: theme.primary }]}>
                    {formatTime(calculatedMinutes)}
                  </Text>
                </View>
                <View style={styles.timeItem}>
                  <Text style={[styles.timeLabel, { color: isDarkMode ? '#888' : '#666' }]}>Decimal Hours</Text>
                  <Text style={[styles.timeValue, { color: theme.primary }]}>
                    {formatDecimalHours(calculatedMinutes)}h
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { 
                      backgroundColor: isDarkMode ? '#000' : '#fff',
                      borderColor: theme.primary
                    }]}
                    onPress={() => {
                      console.log('AddJobModal: User tapped date picker button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowDatePicker(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: isDarkMode ? '#fff' : '#000' }]}>
                      {jobDateTime.toLocaleDateString('en-GB')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { 
                      backgroundColor: isDarkMode ? '#000' : '#fff',
                      borderColor: theme.primary
                    }]}
                    onPress={() => {
                      console.log('AddJobModal: User tapped time picker button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowTimePicker(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="clock"
                      android_material_icon_name="access-time"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: isDarkMode ? '#fff' : '#000' }]}>
                      {jobDateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: isDarkMode ? '#000' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: theme.primary
                  }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  placeholder="Add any additional notes..."
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSave(false);
                }}
                disabled={saving}
              >
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#ffffff"
                />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Job'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Save Process Notification */}
        <ProcessNotification
          visible={showSaveNotification}
          title={
            saveNotificationType === 'loading'
              ? 'Saving Job...'
              : saveNotificationType === 'success'
              ? 'Job Saved!'
              : 'Save Failed'
          }
          type={saveNotificationType}
        />

        <Modal
          visible={showAwPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAwPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerModal, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Select AW Value</Text>
                <TouchableOpacity onPress={() => setShowAwPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={isDarkMode ? '#888' : '#999'}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerScroll}>
                {awOptions.map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickerOption,
                      { backgroundColor: aw === value ? theme.primary : 'transparent' },
                    ]}
                    onPress={() => {
                      console.log('AddJobModal: User selected AW value:', value);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setAw(value);
                      setShowAwPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: aw === value ? '#ffffff' : (isDarkMode ? '#fff' : '#000') },
                      ]}
                    >
                      {value} AW ({formatTime(awToMinutes(value))})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        


        {showDatePicker && (
          <DateTimePicker
            value={jobDateTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={jobDateTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            is24Hour={true}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  formGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  pickerScroll: {
    maxHeight: 400,
  },
  pickerOption: {
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vhcTickBoxes: {
    flexDirection: 'row',
    gap: 12,
  },
  vhcTickBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 3,
    gap: 4,
  },
  vhcTickLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
