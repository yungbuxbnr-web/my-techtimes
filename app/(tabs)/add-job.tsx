
import { api, OCRRegResult, OCRJobCardResult, Job } from '@/utils/api';
import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useThemeContext } from '@/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours, validateWipNumber, validateAW } from '@/utils/jobCalculations';

interface JobSuggestion {
  wipNumber: string;
  vehicleReg: string;
  lastUsed: string;
  usageCount: number;
}

export default function AddJobScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const [wipNumber, setWipNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [aw, setAw] = useState(0);
  const [notes, setNotes] = useState('');
  const [vhcStatus, setVhcStatus] = useState<'NONE' | 'GREEN' | 'ORANGE' | 'RED'>('NONE');
  const [saving, setSaving] = useState(false);
  const [showAwPicker, setShowAwPicker] = useState(false);
  const [showVhcPicker, setShowVhcPicker] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationOpacity] = useState(new Animated.Value(0));
  const [jobDateTime, setJobDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [jobCardImageUri, setJobCardImageUri] = useState<string | undefined>(undefined);
  
  // Suggestions state
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [wipSuggestions, setWipSuggestions] = useState<JobSuggestion[]>([]);
  const [regSuggestions, setRegSuggestions] = useState<JobSuggestion[]>([]);
  const [showWipSuggestions, setShowWipSuggestions] = useState(false);
  const [showRegSuggestions, setShowRegSuggestions] = useState(false);
  const wipInputRef = useRef<TextInput>(null);
  const regInputRef = useRef<TextInput>(null);
  
  // Load all jobs for suggestions
  useEffect(() => {
    loadJobsForSuggestions();
  }, []);
  
  const loadJobsForSuggestions = async () => {
    try {
      console.log('AddJobScreen: Loading jobs for suggestions');
      const jobs = await api.getAllJobs();
      setAllJobs(jobs);
    } catch (error) {
      console.error('AddJobScreen: Error loading jobs for suggestions:', error);
    }
  };
  
  // Generate suggestions based on input
  const generateSuggestions = (input: string, field: 'wip' | 'reg'): JobSuggestion[] => {
    if (!input || input.length === 0) {
      return [];
    }
    
    const upperInput = input.toUpperCase();
    const suggestionMap = new Map<string, JobSuggestion>();
    
    // Group jobs by WIP or Reg and track usage
    allJobs.forEach(job => {
      const key = field === 'wip' ? job.wipNumber : job.vehicleReg.toUpperCase();
      const matchValue = field === 'wip' ? job.wipNumber : job.vehicleReg.toUpperCase();
      
      // Check if it matches (starts with or contains)
      const startsWithMatch = matchValue.startsWith(upperInput);
      const containsMatch = matchValue.includes(upperInput);
      
      if (startsWithMatch || containsMatch) {
        const existing = suggestionMap.get(key);
        if (existing) {
          existing.usageCount++;
          if (new Date(job.createdAt) > new Date(existing.lastUsed)) {
            existing.lastUsed = job.createdAt;
          }
        } else {
          suggestionMap.set(key, {
            wipNumber: job.wipNumber,
            vehicleReg: job.vehicleReg.toUpperCase(),
            lastUsed: job.createdAt,
            usageCount: 1,
          });
        }
      }
    });
    
    // Convert to array and sort: starts-with first, then by most recent
    const suggestions = Array.from(suggestionMap.values()).sort((a, b) => {
      const aKey = field === 'wip' ? a.wipNumber : a.vehicleReg;
      const bKey = field === 'wip' ? b.wipNumber : b.vehicleReg;
      const aStartsWith = aKey.startsWith(upperInput);
      const bStartsWith = bKey.startsWith(upperInput);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // Both start with or both contain - sort by most recent
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
    
    // Limit to 10 suggestions
    return suggestions.slice(0, 10);
  };
  
  // Handle WIP input change
  const handleWipChange = (text: string) => {
    setWipNumber(text);
    
    if (text.length > 0) {
      const suggestions = generateSuggestions(text, 'wip');
      setWipSuggestions(suggestions);
      setShowWipSuggestions(suggestions.length > 0);
    } else {
      setShowWipSuggestions(false);
    }
  };
  
  // Handle Reg input change
  const handleRegChange = (text: string) => {
    const upperText = text.toUpperCase();
    setVehicleReg(upperText);
    
    if (upperText.length > 0) {
      const suggestions = generateSuggestions(upperText, 'reg');
      setRegSuggestions(suggestions);
      setShowRegSuggestions(suggestions.length > 0);
    } else {
      setShowRegSuggestions(false);
    }
  };
  
  // Select WIP suggestion
  const selectWipSuggestion = (suggestion: JobSuggestion) => {
    console.log('AddJobScreen: Selected WIP suggestion:', suggestion.wipNumber);
    setWipNumber(suggestion.wipNumber);
    setVehicleReg(suggestion.vehicleReg);
    setShowWipSuggestions(false);
  };
  
  // Select Reg suggestion
  const selectRegSuggestion = (suggestion: JobSuggestion) => {
    console.log('AddJobScreen: Selected Reg suggestion:', suggestion.vehicleReg);
    setVehicleReg(suggestion.vehicleReg);
    setWipNumber(suggestion.wipNumber);
    setShowRegSuggestions(false);
  };

  const awOptions = Array.from({ length: 101 }, (_, i) => i);
  const vhcOptions: ('NONE' | 'GREEN' | 'ORANGE' | 'RED')[] = ['NONE', 'GREEN', 'ORANGE', 'RED'];
  
  const getVhcColor = (status: string) => {
    switch (status) {
      case 'GREEN': return '#4CAF50';
      case 'ORANGE': return '#FF9800';
      case 'RED': return '#f44336';
      default: return '#999';
    }
  };

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
        vhcStatus,
        createdAt: jobDateTime.toISOString(),
        imageUri: jobCardImageUri,
      };
      
      console.log('AddJobScreen: Saving job:', jobData);
      await api.createJob(jobData);
      
      // Reload jobs for suggestions
      await loadJobsForSuggestions();
      
      // Trigger refresh of dashboard and stats
      console.log('AddJobScreen: Job saved, triggering live update');
      
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
      setVhcStatus('NONE');
      setJobDateTime(new Date());
      setJobCardImageUri(undefined);
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

  const handleTakeJobCardPhoto = async (source: 'camera' | 'gallery') => {
    console.log('AddJobScreen: User taking job card photo from', source);

    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        console.log('AddJobScreen: Job card photo selected:', result.assets[0].uri);
        setJobCardImageUri(result.assets[0].uri);
        Alert.alert('Success', 'Job card photo attached!');
      }
    } catch (error) {
      console.error('AddJobScreen: Error taking job card photo:', error);
      Alert.alert('Error', 'Failed to attach photo');
    }
  };

  const handleRemoveJobCardPhoto = () => {
    console.log('AddJobScreen: User removed job card photo');
    setJobCardImageUri(undefined);
    Alert.alert('Info', 'Job card photo removed');
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
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={wipInputRef}
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={wipNumber}
                    onChangeText={handleWipChange}
                    onFocus={() => {
                      if (wipNumber.length > 0) {
                        const suggestions = generateSuggestions(wipNumber, 'wip');
                        setWipSuggestions(suggestions);
                        setShowWipSuggestions(suggestions.length > 0);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding to allow tap on suggestion
                      setTimeout(() => setShowWipSuggestions(false), 200);
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="12345"
                    placeholderTextColor={theme.textSecondary}
                  />
                  {showWipSuggestions && wipSuggestions.length > 0 && (
                    <View style={[styles.suggestionsDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <FlatList
                        data={wipSuggestions}
                        keyExtractor={(item, index) => `${item.wipNumber}-${index}`}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                            onPress={() => selectWipSuggestion(item)}
                          >
                            <View style={styles.suggestionContent}>
                              <Text style={[styles.suggestionWip, { color: theme.primary }]}>
                                {item.wipNumber}
                              </Text>
                              <Text style={[styles.suggestionReg, { color: theme.text }]}>
                                {item.vehicleReg}
                              </Text>
                            </View>
                            <Text style={[styles.suggestionDate, { color: theme.textSecondary }]}>
                              {new Date(item.lastUsed).toLocaleDateString('en-GB')}
                            </Text>
                          </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                        nestedScrollEnabled={true}
                      />
                    </View>
                  )}
                </View>
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
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={regInputRef}
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={vehicleReg}
                    onChangeText={handleRegChange}
                    onFocus={() => {
                      if (vehicleReg.length > 0) {
                        const suggestions = generateSuggestions(vehicleReg, 'reg');
                        setRegSuggestions(suggestions);
                        setShowRegSuggestions(suggestions.length > 0);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding to allow tap on suggestion
                      setTimeout(() => setShowRegSuggestions(false), 200);
                    }}
                    autoCapitalize="characters"
                    placeholder="ABC123"
                    placeholderTextColor={theme.textSecondary}
                  />
                  {showRegSuggestions && regSuggestions.length > 0 && (
                    <View style={[styles.suggestionsDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <FlatList
                        data={regSuggestions}
                        keyExtractor={(item, index) => `${item.vehicleReg}-${index}`}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                            onPress={() => selectRegSuggestion(item)}
                          >
                            <View style={styles.suggestionContent}>
                              <Text style={[styles.suggestionReg, { color: theme.primary }]}>
                                {item.vehicleReg}
                              </Text>
                              <Text style={[styles.suggestionWip, { color: theme.text }]}>
                                WIP: {item.wipNumber}
                              </Text>
                            </View>
                            <Text style={[styles.suggestionDate, { color: theme.textSecondary }]}>
                              {new Date(item.lastUsed).toLocaleDateString('en-GB')}
                            </Text>
                          </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                        nestedScrollEnabled={true}
                      />
                    </View>
                  )}
                </View>
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
              
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>VHC Status</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { 
                    backgroundColor: theme.background,
                    borderColor: getVhcColor(vhcStatus),
                    borderWidth: 2
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
                <Text style={[styles.label, { color: theme.text }]}>Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: theme.text }]}>
                      {jobDateTime.toLocaleDateString('en-GB')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <IconSymbol
                      ios_icon_name="clock"
                      android_material_icon_name="access-time"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: theme.text }]}>
                      {jobDateTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
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

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Job Card Photo (Optional)</Text>
                {jobCardImageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: jobCardImageUri }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={[styles.removeImageButton, { backgroundColor: '#f44336' }]}
                      onPress={handleRemoveJobCardPhoto}
                    >
                      <IconSymbol
                        ios_icon_name="trash.fill"
                        android_material_icon_name="delete"
                        size={20}
                        color="#ffffff"
                      />
                      <Text style={styles.removeImageText}>Remove Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imageButtonsRow}>
                    <TouchableOpacity
                      style={[styles.imageButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => {
                        console.log('AddJobScreen: User tapped Take Photo button');
                        handleTakeJobCardPhoto('camera');
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="camera.fill"
                        android_material_icon_name="camera"
                        size={24}
                        color="#ffffff"
                      />
                      <Text style={styles.imageButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageButton, { backgroundColor: theme.secondary, borderColor: theme.secondary }]}
                      onPress={() => {
                        console.log('AddJobScreen: User tapped Choose from Gallery button');
                        handleTakeJobCardPhoto('gallery');
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="photo.fill"
                        android_material_icon_name="image"
                        size={24}
                        color="#ffffff"
                      />
                      <Text style={styles.imageButtonText}>Choose Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
        
        <Modal
          visible={showVhcPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVhcPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerModal, { backgroundColor: theme.card }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Select VHC Status</Text>
                <TouchableOpacity onPress={() => setShowVhcPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={theme.textSecondary}
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
                      console.log('AddJobScreen: User selected VHC status:', value);
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
  inputContainer: {
    position: 'relative',
    zIndex: 1,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionWip: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionReg: {
    fontSize: 14,
    marginTop: 2,
  },
  suggestionDate: {
    fontSize: 12,
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
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  imageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    gap: 12,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
