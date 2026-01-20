
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ImageBackground,
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

export default function AddJobScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [wipNumber, setWipNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [aw, setAw] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAwPicker, setShowAwPicker] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationOpacity] = useState(new Animated.Value(0));

  const awOptions = Array.from({ length: 101 }, (_, i) => i);

  const handleSave = async (saveAnother: boolean = false) => {
    console.log('AddJobScreen: User tapped Save button, saveAnother:', saveAnother);
    
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
      };
      
      console.log('AddJobScreen: Saving job:', jobData);
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

      console.log('AddJobScreen: Clearing form for next job');
      setWipNumber('');
      setVehicleReg('');
      setAw(0);
      setNotes('');
    } catch (error) {
      console.error('AddJobScreen: Error saving job:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleScanReg = async (source: 'camera' | 'gallery') => {
    console.log('AddJobScreen: User scanning registration from', source);
    setShowScanMenu(false);

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
        console.log('AddJobScreen: Image selected, scanning...');
        const ocrResult: OCRRegResult = await api.scanRegistration(result.assets[0].uri);
        
        // Show confirmation with alternatives
        Alert.alert(
          'Confirm Registration',
          `Detected: ${ocrResult.registration}\n\nAlternatives:\n${ocrResult.alternatives.join('\n')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Detected',
              onPress: () => {
                console.log('AddJobScreen: User confirmed registration:', ocrResult.registration);
                setVehicleReg(ocrResult.registration);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobScreen: Error scanning registration:', error);
      Alert.alert('Error', 'Failed to scan registration. Please try again.');
    }
  };

  const handleScanJobCard = async (source: 'camera' | 'gallery') => {
    console.log('AddJobScreen: User scanning job card from', source);
    setShowScanMenu(false);

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
        console.log('AddJobScreen: Image selected, scanning job card...');
        const ocrResult: OCRJobCardResult = await api.scanJobCard(result.assets[0].uri);
        
        // Show confirmation with alternatives
        Alert.alert(
          'Confirm Job Card Details',
          `WIP: ${ocrResult.wipNumber}\nReg: ${ocrResult.registration}\n\nAlternatives:\nWIP: ${ocrResult.wipAlternatives.join(', ')}\nReg: ${ocrResult.regAlternatives.join(', ')}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Detected',
              onPress: () => {
                console.log('AddJobScreen: User confirmed job card data');
                setWipNumber(ocrResult.wipNumber);
                setVehicleReg(ocrResult.registration);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('AddJobScreen: Error scanning job card:', error);
      Alert.alert('Error', 'Failed to scan job card. Please try again.');
    }
  };

  const calculatedMinutes = awToMinutes(aw);

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200' }}
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
              <View>
                <Text style={[styles.title, { color: '#ffffff' }]}>Add Job</Text>
                <Text style={[styles.subtitle, { color: '#cccccc' }]}>Record new work</Text>
              </View>
              <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={32}
                  color="#ffffff"
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.text }]}>WIP Number *</Text>
                  <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.secondary }]}
                    onPress={() => {
                      console.log('AddJobScreen: User tapped Scan Job Card button');
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
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={wipNumber}
                  onChangeText={setWipNumber}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="12345"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.text }]}>Vehicle Registration *</Text>
                  <TouchableOpacity
                    style={[styles.scanButton, { backgroundColor: theme.secondary }]}
                    onPress={() => {
                      console.log('AddJobScreen: User tapped Scan Reg button');
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
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={vehicleReg}
                  onChangeText={(text) => setVehicleReg(text.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="ABC123"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>AW Value *</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setShowAwPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, { color: theme.text }]}>
                    {aw} AW
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-drop-down"
                    size={24}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.timeDisplay, { backgroundColor: theme.background }]}>
                <View style={styles.timeItem}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Time</Text>
                  <Text style={[styles.timeValue, { color: theme.primary }]}>
                    {formatTime(calculatedMinutes)}
                  </Text>
                </View>
                <View style={styles.timeItem}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Decimal Hours</Text>
                  <Text style={[styles.timeValue, { color: theme.primary }]}>
                    {formatDecimalHours(calculatedMinutes)}h
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  placeholder="Add any additional notes..."
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={() => handleSave(true)}
                  disabled={saving}
                >
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color="#ffffff"
                  />
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save Another'}
                  </Text>
                </TouchableOpacity>
              </View>
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
            <View style={[styles.pickerModal, { backgroundColor: theme.card }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Select AW Value</Text>
                <TouchableOpacity onPress={() => setShowAwPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
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
                      console.log('AddJobScreen: User selected AW value:', value);
                      setAw(value);
                      setShowAwPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: aw === value ? '#ffffff' : theme.text },
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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  pickerButtonText: {
    fontSize: 16,
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
});
