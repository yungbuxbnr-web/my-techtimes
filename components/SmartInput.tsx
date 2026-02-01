
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from './IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  processNaturalLanguageInput,
  validateAndCorrect,
  generateSmartSuggestions,
  ProcessedInput,
  InputCorrection,
  SmartSuggestion,
} from '@/utils/inputBrain';
import { Job } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface SmartInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  field: 'wip' | 'reg' | 'notes' | 'natural';
  recentJobs?: Job[];
  onProcessedInput?: (processed: ProcessedInput) => void;
  onCorrectionSuggested?: (corrections: InputCorrection[]) => void;
  autoCorrect?: boolean;
  showBrainIcon?: boolean;
  style?: any;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'numeric';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function SmartInput({
  value,
  onChangeText,
  placeholder,
  field,
  recentJobs = [],
  onProcessedInput,
  onCorrectionSuggested,
  autoCorrect = true,
  showBrainIcon = true,
  style,
  multiline = false,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'none',
}: SmartInputProps) {
  const { theme, isDarkMode } = useThemeContext();
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [corrections, setCorrections] = useState<InputCorrection[]>([]);
  const [showCorrections, setShowCorrections] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Generate suggestions as user types
  useEffect(() => {
    if (value.length > 0 && field !== 'natural') {
      const smartSuggestions = generateSmartSuggestions(value, field, recentJobs);
      setSuggestions(smartSuggestions);
      setShowSuggestions(smartSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [value, field, recentJobs]);

  // Validate and suggest corrections on blur
  const handleBlur = () => {
    if (autoCorrect && value.length > 0) {
      let wipNumber: string | undefined;
      let vehicleReg: string | undefined;
      let aw: number | undefined;

      if (field === 'wip') {
        wipNumber = value;
      } else if (field === 'reg') {
        vehicleReg = value;
      }

      const foundCorrections = validateAndCorrect(wipNumber, vehicleReg, aw, recentJobs);
      
      if (foundCorrections.length > 0) {
        setCorrections(foundCorrections);
        setShowCorrections(true);
        onCorrectionSuggested?.(foundCorrections);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };

  // Process natural language input
  const handleProcessNaturalLanguage = () => {
    if (field === 'natural' && value.length > 0) {
      setProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      setTimeout(() => {
        const processed = processNaturalLanguageInput(value, recentJobs);
        onProcessedInput?.(processed);
        setProcessing(false);
        
        if (processed.confidence > 0.7) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }, 500); // Simulate processing time
    }
  };

  const applySuggestion = (suggestion: SmartSuggestion) => {
    console.log('SmartInput: Applying suggestion:', suggestion.value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeText(suggestion.value);
    setShowSuggestions(false);
  };

  const applyCorrection = (correction: InputCorrection) => {
    console.log('SmartInput: Applying correction:', correction.suggestion);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeText(correction.suggestion);
    setShowCorrections(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDarkMode ? '#000' : '#fff',
              color: isDarkMode ? '#fff' : '#000',
              borderColor: theme.primary,
            },
            style,
          ]}
          value={value}
          onChangeText={onChangeText}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
        />
        
        {showBrainIcon && field === 'natural' && (
          <TouchableOpacity
            style={[styles.brainButton, { backgroundColor: theme.primary }]}
            onPress={handleProcessNaturalLanguage}
            disabled={processing || value.length === 0}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <IconSymbol
                ios_icon_name="brain"
                android_material_icon_name="psychology"
                size={24}
                color="#ffffff"
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
              borderColor: theme.primary,
            },
          ]}
        >
          <View style={styles.suggestionsHeader}>
            <IconSymbol
              ios_icon_name="lightbulb.fill"
              android_material_icon_name="lightbulb"
              size={16}
              color={theme.secondary}
            />
            <Text style={[styles.suggestionsHeaderText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Smart Suggestions
            </Text>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={18}
                color={isDarkMode ? '#888' : '#999'}
              />
            </TouchableOpacity>
          </View>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.value}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: isDarkMode ? '#444' : '#eee' }]}
                onPress={() => applySuggestion(item)}
              >
                <View style={styles.suggestionContent}>
                  <Text style={[styles.suggestionValue, { color: theme.primary }]}>
                    {item.value}
                  </Text>
                  {item.context && (
                    <Text style={[styles.suggestionContext, { color: isDarkMode ? '#888' : '#666' }]}>
                      {item.context}
                    </Text>
                  )}
                </View>
                <View style={styles.suggestionMeta}>
                  <Text style={[styles.suggestionConfidence, { color: theme.secondary }]}>
                    {Math.round(item.confidence * 100)}%
                  </Text>
                  {item.usageCount > 1 && (
                    <Text style={[styles.suggestionUsage, { color: isDarkMode ? '#888' : '#666' }]}>
                      Used {item.usageCount}x
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Corrections Modal */}
      <Modal
        visible={showCorrections}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCorrections(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.correctionsModal, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
            <View style={styles.correctionsHeader}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={24}
                color="#FF9800"
              />
              <Text style={[styles.correctionsTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                Suggested Corrections
              </Text>
            </View>
            
            <FlatList
              data={corrections}
              keyExtractor={(item, index) => `${item.field}-${index}`}
              renderItem={({ item }) => (
                <View style={[styles.correctionItem, { borderBottomColor: isDarkMode ? '#444' : '#eee' }]}>
                  <View style={styles.correctionContent}>
                    <Text style={[styles.correctionField, { color: theme.primary }]}>
                      {item.field.toUpperCase()}
                    </Text>
                    <Text style={[styles.correctionOriginal, { color: isDarkMode ? '#888' : '#666' }]}>
                      Original: {item.original}
                    </Text>
                    <Text style={[styles.correctionSuggestion, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Suggested: {item.suggestion}
                    </Text>
                    <Text style={[styles.correctionReason, { color: isDarkMode ? '#aaa' : '#777' }]}>
                      {item.reason}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: theme.primary }]}
                    onPress={() => applyCorrection(item)}
                  >
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            
            <TouchableOpacity
              style={[styles.dismissButton, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}
              onPress={() => setShowCorrections(false)}
            >
              <Text style={[styles.dismissButtonText, { color: isDarkMode ? '#fff' : '#000' }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  brainButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 2,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  suggestionsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionContext: {
    fontSize: 12,
  },
  suggestionMeta: {
    alignItems: 'flex-end',
  },
  suggestionConfidence: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionUsage: {
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  correctionsModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  correctionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  correctionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  correctionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  correctionContent: {
    flex: 1,
    marginRight: 12,
  },
  correctionField: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  correctionOriginal: {
    fontSize: 14,
    marginBottom: 2,
  },
  correctionSuggestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  correctionReason: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
