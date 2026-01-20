
import React, { useState } from 'react';
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
  Animated,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours, validateWipNumber, validateAW } from '@/utils/jobCalculations';
import { api, OCRRegResult, OCRJobCardResult } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddJobModal() {
  const { theme, overlayStrength, isDarkMode } = useThemeContext();
  const router = useRouter();
  const [wipNumber, setWipNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [aw, setAw] = useState(0);
  const [notes, setNotes] = useState('');
  const [vhcStatus, setVhcStatus] = useState<'GREEN' | 'AMBER' | 'RED' | 'N/A'>('N/A');
  const [saving, setSaving] = useState(false);
  const [showAwPicker, setShowAwPicker] = useState(false);
  const [showVhcPicker, setShowVhcPicker] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationOpacity] = useState(new Animated.Value(0));
  const [jobDateTime, setJobDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const awOptions = Array.from({ length: 101 }, (_, i) => i);
  const vhcOptions: ('GREEN' | 'AMBER' | 'RED' | 'N/A')[] = ['N/A', 'GREEN', 'AMBER', 'RED'];

  const handleSave = async (saveAnother: boolean = false) => {
    console.log('AddJobModal: User tapped Save button, saveAnother:', saveAnother);
    
    if (!validateWipNumber(wipNumber)) {
      Alert.alert('Invalid WIP', 'WIP number must be exactly 5 digits');
      return;
    }

    if (!vehicleReg.trim()) {
      Alert.alert('Invalid Registration', 'Vehicle registration is required');
      return;
    }

    if (!validateAW(aw)) {
      Alert.alert('Invalid AW', 'AW must be between 0 and 100');
      return;
    }

    setSaving(true);
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
      
      // Show animated confirmation
      setShowConfirmation(true);
      Animated.sequence([
        Animated.timing(confirmationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(confirmationOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowConfirmation(false);
      });

      if (saveAnother) {
        console.log('AddJobModal: Clearing form for next job');
        setWipNumber('');
        setVehicleReg('');
        setAw(0);
        setNotes('');
        setVhcStatus('N/A');
        setJobDateTime(new Date());
      } else {
        // Close modal and go back
        router.back();
      }
    } catch (error) {
      console.error('AddJobModal: Error saving job:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleScanReg = async (source: 'camera' | 'gallery') => {
    console.log('AddJobModal: User scanning registration from', source);

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
        const ocrResult: OCRRegResult = await api.scanRegistration(result.assets[0].uri);
        
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
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobModal: Error scanning registration:', error);
      Alert.alert('Error', 'Failed to scan registration. Please try again.');
    }
  };

  const handleScanJobCard = async (source: 'camera' | 'gallery') => {
    console.log('AddJobModal: User scanning job card from', source);

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
        const ocrResult: OCRJobCardResult = await api.scanJobCard(result.assets[0].uri);
        
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
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobModal: Error scanning job card:', error);
      Alert.alert('Error', 'Failed to scan job card. Please try again.');
    }
  };

  const calculatedMinutes = awToMinutes(aw);
  
  const getVhcColor = (status: string) => {
    switch (status) {
      case 'GREEN': return '#4CAF50';
      case 'AMBER': return '#FF9800';
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
                  onPress={() => setShowAwPicker(true)}
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
                <TouchableOpacity
                  style={[styles.pickerButton, { 
                    backgroundColor: isDarkMode ? '#000' : '#fff',
                    borderColor: getVhcColor(vhcStatus)
                  }]}
                  onPress={() => setShowVhcPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, { color: getVhcColor(vhcStatus) }]}>
                    VHC: {vhcStatus}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-drop-down"
                    size={24}
                    color={isDarkMode ? '#888' : '#999'}
                  />
                </TouchableOpacity>
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
                    onPress={() => setShowDatePicker(true)}
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
                    onPress={() => setShowTimePicker(true)}
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

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.secondary, flex: 1 }]}
                  onPress={() => handleSave(true)}
                  disabled={saving}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle.fill"
                    android_material_icon_name="add-circle"
                    size={24}
                    color="#ffffff"
                  />
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save & Add Another'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => handleSave(false)}
                disabled={saving}
              >
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#ffffff"
                />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save & Close'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Success Confirmation Overlay */}
        {showConfirmation && (
          <Animated.View
            style={[
              styles.confirmationOverlay,
              { opacity: confirmationOpacity },
            ]}
          >
            <View style={[styles.confirmationCard, { backgroundColor: theme.chartGreen }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={48}
                color="#ffffff"
              />
              <Text style={styles.confirmationText}>Record Saved!</Text>
            </View>
          </Animated.View>
        )}

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
        
        <Modal
          visible={showVhcPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVhcPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerModal, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Select VHC Status</Text>
                <TouchableOpacity onPress={() => setShowVhcPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={isDarkMode ? '#888' : '#999'}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerScroll}>
                {vhcOptions.map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickerOption,
                      { backgroundColor: vhcStatus === value ? getVhcColor(value) : 'transparent' },
                    ]}
                    onPress={() => {
                      console.log('AddJobModal: User selected VHC status:', value);
                      setVhcStatus(value);
                      setShowVhcPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: vhcStatus === value ? '#ffffff' : getVhcColor(value) },
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={jobDateTime}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const newDateTime = new Date(jobDateTime);
                newDateTime.setFullYear(selectedDate.getFullYear());
                newDateTime.setMonth(selectedDate.getMonth());
                newDateTime.setDate(selectedDate.getDate());
                setJobDateTime(newDateTime);
              }
            }}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={jobDateTime}
            mode="time"
            display="default"
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                const newDateTime = new Date(jobDateTime);
                newDateTime.setHours(selectedDate.getHours());
                newDateTime.setMinutes(selectedDate.getMinutes());
                setJobDateTime(newDateTime);
              }
            }}
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  confirmationCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
  },
  confirmationText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
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
});
