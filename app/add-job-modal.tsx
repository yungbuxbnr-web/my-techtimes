
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  FlatList,
  Image,
  Keyboard,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { awToMinutes, formatTime, formatDecimalHours, validateWipNumber, validateAW } from '@/utils/jobCalculations';
import { api, OCRRegResult, OCRJobCardResult, Job } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toastManager } from '@/utils/toastManager';
import { ProcessNotification } from '@/components/ProcessNotification';
import * as Haptics from 'expo-haptics';
import { updateWidgetData } from '@/utils/widgetManager';
import { AdaptiveKeyboardView } from '@/components/AdaptiveKeyboardView';
import { useKeyboard } from '@/utils/keyboardManager';

interface JobSuggestion {
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  lastUsed: string;
  usageCount: number;
}

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
  const [jobCardImageUri, setJobCardImageUri] = useState<string | undefined>(undefined);
  
  // Suggestions state
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'wip' | 'reg' | null>(null);
  const wipInputRef = useRef<TextInput>(null);
  const regInputRef = useRef<TextInput>(null);

  // Use AI-powered keyboard detection
  const { isKeyboardVisible, keyboardHeight, optimalOffset } = useKeyboard({
    hasTabBar: false,
    hasHeader: true,
    inputPosition: 'bottom',
  });

  const awOptions = Array.from({ length: 101 }, (_, i) => i);

  // Load all jobs for suggestions
  useEffect(() => {
    loadJobsForSuggestions();
  }, []);
  
  const loadJobsForSuggestions = async () => {
    try {
      console.log('AddJobModal: Loading jobs for suggestions');
      const jobs = await api.getAllJobs();
      setAllJobs(jobs);
    } catch (error) {
      console.error('AddJobModal: Error loading jobs for suggestions:', error);
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
            existing.aw = job.aw;
          }
        } else {
          suggestionMap.set(key, {
            wipNumber: job.wipNumber,
            vehicleReg: job.vehicleReg.toUpperCase(),
            aw: job.aw,
            lastUsed: job.createdAt,
            usageCount: 1,
          });
        }
      }
    });
    
    const suggestionsList = Array.from(suggestionMap.values()).sort((a, b) => {
      const aKey = field === 'wip' ? a.wipNumber : a.vehicleReg;
      const bKey = field === 'wip' ? b.wipNumber : b.vehicleReg;
      const aStartsWith = aKey.startsWith(upperInput);
      const bStartsWith = bKey.startsWith(upperInput);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
    
    return suggestionsList.slice(0, 5);
  };
  
  const handleWipChange = (text: string) => {
    setWipNumber(text);
    setActiveField('wip');
    
    if (text.length > 0) {
      const newSuggestions = generateSuggestions(text, 'wip');
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const handleRegChange = (text: string) => {
    const upperText = text.toUpperCase();
    setVehicleReg(upperText);
    setActiveField('reg');
    
    if (upperText.length > 0) {
      const newSuggestions = generateSuggestions(upperText, 'reg');
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const selectSuggestion = (suggestion: JobSuggestion) => {
    console.log('AddJobModal: Selected suggestion:', suggestion);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setWipNumber(suggestion.wipNumber);
    setVehicleReg(suggestion.vehicleReg);
    setAw(suggestion.aw);
    
    setShowSuggestions(false);
    setActiveField(null);
    Keyboard.dismiss();
    
    const awMinutes = awToMinutes(suggestion.aw);
    const awTimeFormatted = formatTime(awMinutes);
    toastManager.success(`Auto-filled: ${suggestion.wipNumber} - ${suggestion.vehicleReg} - ${suggestion.aw} AW (${awTimeFormatted})`);
  };

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
        imageUri: jobCardImageUri,
      };
      
      console.log('AddJobModal: Saving job:', jobData);
      await api.createJob(jobData);
      
      await loadJobsForSuggestions();
      
      console.log('AddJobModal: Updating widget data');
      await updateWidgetData();
      
      setSaveNotificationType('success');
      toastManager.success('Job saved successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('AddJobModal: Closing modal after successful save');
      router.back();
    } catch (error) {
      console.error('AddJobModal: Error saving job:', error);
      setSaveNotificationType('error');
      toastManager.error(error instanceof Error ? error.message : 'Failed to save job');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
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

  const handleTakeJobCardPhoto = async (source: 'camera' | 'gallery') => {
    console.log('AddJobModal: User taking job card photo from', source);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
        console.log('AddJobModal: Job card photo selected:', result.assets[0].uri);
        setJobCardImageUri(result.assets[0].uri);
        toastManager.success('Job card photo attached!');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('AddJobModal: Error taking job card photo:', error);
      toastManager.error('Failed to attach photo');
    }
  };

  const handleRemoveJobCardPhoto = () => {
    console.log('AddJobModal: User removed job card photo');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setJobCardImageUri(undefined);
    toastManager.info('Job card photo removed');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    console.log('AddJobModal: Date picker event:', event.type, selectedDate);
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      const newDateTime = new Date(jobDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setJobDateTime(newDateTime);
      console.log('AddJobModal: Date updated to:', newDateTime.toLocaleDateString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    console.log('AddJobModal: Time picker event:', event.type, selectedDate);
    
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    
    if (selectedDate) {
      const newDateTime = new Date(jobDateTime);
      newDateTime.setHours(selectedDate.getHours());
      newDateTime.setMinutes(selectedDate.getMinutes());
      setJobDateTime(newDateTime);
      console.log('AddJobModal: Time updated to:', newDateTime.toLocaleTimeString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
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
        <AdaptiveKeyboardView
          hasTabBar={false}
          hasHeader={true}
          inputPosition="bottom"
          scrollEnabled={true}
          contentContainerStyle={styles.contentContainer}
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
                ref={wipInputRef}
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? '#000' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                  borderColor: theme.primary
                }]}
                value={wipNumber}
                onChangeText={handleWipChange}
                onFocus={() => {
                  setActiveField('wip');
                  if (wipNumber.length > 0) {
                    const newSuggestions = generateSuggestions(wipNumber, 'wip');
                    setSuggestions(newSuggestions);
                    setShowSuggestions(newSuggestions.length > 0);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSuggestions(false);
                    setActiveField(null);
                  }, 200);
                }}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="12345"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
              />
            </View>

            {showSuggestions && suggestions.length > 0 && (
              <View style={[styles.suggestionsContainer, { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
                borderColor: theme.primary
              }]}>
                <View style={styles.suggestionsHeader}>
                  <Text style={[styles.suggestionsHeaderText, { color: isDarkMode ? '#fff' : '#000' }]}>
                    Memory Suggestions
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSuggestions(false);
                      setActiveField(null);
                      Keyboard.dismiss();
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="close"
                      size={20}
                      color={isDarkMode ? '#888' : '#999'}
                    />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item, index) => `${item.wipNumber}-${item.vehicleReg}-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.suggestionItem, { borderBottomColor: isDarkMode ? '#444' : '#eee' }]}
                      onPress={() => selectSuggestion(item)}
                    >
                      <View style={styles.suggestionContent}>
                        <View style={styles.suggestionRow}>
                          <Text style={[styles.suggestionWip, { color: theme.primary }]}>
                            {item.wipNumber}
                          </Text>
                          <Text style={[styles.suggestionReg, { color: isDarkMode ? '#fff' : '#000' }]}>
                            {item.vehicleReg}
                          </Text>
                        </View>
                        <View style={styles.suggestionRow}>
                          <Text style={[styles.suggestionAw, { color: theme.secondary }]}>
                            {item.aw} AW ({formatTime(awToMinutes(item.aw))})
                          </Text>
                          <Text style={[styles.suggestionDate, { color: isDarkMode ? '#888' : '#666' }]}>
                            {new Date(item.lastUsed).toLocaleDateString('en-GB')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={true}
                  style={styles.suggestionsList}
                />
              </View>
            )}

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
                ref={regInputRef}
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? '#000' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                  borderColor: theme.primary
                }]}
                value={vehicleReg}
                onChangeText={handleRegChange}
                onFocus={() => {
                  setActiveField('reg');
                  if (vehicleReg.length > 0) {
                    const newSuggestions = generateSuggestions(vehicleReg, 'reg');
                    setSuggestions(newSuggestions);
                    setShowSuggestions(newSuggestions.length > 0);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSuggestions(false);
                    setActiveField(null);
                  }, 200);
                }}
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
              <View style={styles.vhcButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.vhcButton,
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
                      size={20}
                      color="#ffffff"
                    />
                  )}
                  <Text style={[styles.vhcButtonText, { color: vhcStatus === 'GREEN' ? '#ffffff' : '#4CAF50' }]}>
                    Green
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.vhcButton,
                    { borderColor: '#FF9800' },
                    vhcStatus === 'ORANGE' && { backgroundColor: '#FF9800' },
                  ]}
                  onPress={() => {
                    console.log('AddJobModal: User selected VHC ORANGE');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setVhcStatus(vhcStatus === 'ORANGE' ? 'NONE' : 'ORANGE');
                  }}
                >
                  {vhcStatus === 'ORANGE' && (
                    <IconSymbol
                      ios_icon_name="checkmark"
                      android_material_icon_name="check"
                      size={20}
                      color="#ffffff"
                    />
                  )}
                  <Text style={[styles.vhcButtonText, { color: vhcStatus === 'ORANGE' ? '#ffffff' : '#FF9800' }]}>
                    Orange
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.vhcButton,
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
                      size={20}
                      color="#ffffff"
                    />
                  )}
                  <Text style={[styles.vhcButtonText, { color: vhcStatus === 'RED' ? '#ffffff' : '#f44336' }]}>
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

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>Job Card Photo (Optional)</Text>
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
                      console.log('AddJobModal: User tapped Take Photo button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                      console.log('AddJobModal: User tapped Choose from Gallery button');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                {saving ? 'Saving...' : 'Save Record'}
              </Text>
            </TouchableOpacity>
          </View>
        </AdaptiveKeyboardView>

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
  vhcButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  vhcButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 3,
    gap: 6,
  },
  vhcButtonText: {
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
  suggestionsContainer: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  suggestionsHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionWip: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionReg: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionAw: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionDate: {
    fontSize: 12,
  },
});
