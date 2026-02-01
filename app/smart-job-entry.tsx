
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { SmartInput } from '@/components/SmartInput';
import AppBackground from '@/components/AppBackground';
import { api, Job } from '@/utils/api';
import { ProcessedInput, analyzeInputPattern } from '@/utils/inputBrain';
import { toastManager } from '@/utils/toastManager';
import { formatTime, awToMinutes } from '@/utils/jobCalculations';
import * as Haptics from 'expo-haptics';
import { updateWidgetData } from '@/utils/widgetManager';

export default function SmartJobEntryScreen() {
  const { theme, isDarkMode, overlayStrength } = useThemeContext();
  const router = useRouter();
  const [naturalInput, setNaturalInput] = useState('');
  const [processedData, setProcessedData] = useState<ProcessedInput | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    try {
      console.log('SmartJobEntry: Loading recent jobs for AI context');
      const jobs = await api.getRecentJobs(50);
      setRecentJobs(jobs);
    } catch (error) {
      console.error('SmartJobEntry: Error loading recent jobs:', error);
    }
  };

  const handleProcessedInput = (processed: ProcessedInput) => {
    console.log('SmartJobEntry: Received processed input:', processed);
    setProcessedData(processed);
    
    if (processed.confidence > 0.7) {
      toastManager.success(`Understood! Confidence: ${Math.round(processed.confidence * 100)}%`);
    } else if (processed.needsClarification) {
      toastManager.warning(processed.clarificationQuestion || 'Please provide more details');
    } else {
      toastManager.info(`Partially understood. Confidence: ${Math.round(processed.confidence * 100)}%`);
    }
    
    if (processed.suggestions && processed.suggestions.length > 0) {
      processed.suggestions.forEach(suggestion => {
        toastManager.info(suggestion);
      });
    }
  };

  const handleSaveJob = async () => {
    if (!processedData) {
      toastManager.error('Please process your input first');
      return;
    }

    if (!processedData.wipNumber || !processedData.vehicleReg || processedData.aw === undefined) {
      toastManager.error('Missing required fields. Please provide WIP, Registration, and AW value.');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('SmartJobEntry: Saving job from processed input');
      await api.createJob({
        wipNumber: processedData.wipNumber,
        vehicleReg: processedData.vehicleReg,
        aw: processedData.aw,
        notes: processedData.notes,
        vhcStatus: processedData.vhcStatus || 'NONE',
      });

      await updateWidgetData();
      
      toastManager.success('Job saved successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Reset form
      setNaturalInput('');
      setProcessedData(null);
      
      // Reload recent jobs
      await loadRecentJobs();
    } catch (error) {
      console.error('SmartJobEntry: Error saving job:', error);
      toastManager.error('Failed to save job');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleShowAnalysis = () => {
    if (recentJobs.length < 5) {
      toastManager.info('Need at least 5 jobs for pattern analysis');
      return;
    }

    const recentInputs = recentJobs.slice(0, 20).map(job => ({
      wipNumber: job.wipNumber,
      vehicleReg: job.vehicleReg,
      aw: job.aw,
      timestamp: job.createdAt,
    }));

    const analysis = analyzeInputPattern(recentInputs);
    
    const analysisMessage = `
📊 Input Pattern Analysis:

Average AW: ${analysis.averageAW.toFixed(1)}
Input Speed: ${analysis.inputSpeed.toUpperCase()}

${analysis.commonRegistrations.length > 0 ? `Frequent Vehicles:\n${analysis.commonRegistrations.join('\n')}` : ''}

${analysis.suggestions.join('\n\n')}
    `.trim();

    Alert.alert('AI Analysis', analysisMessage, [{ text: 'OK' }]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confidenceColor = processedData
    ? processedData.confidence > 0.7
      ? '#4CAF50'
      : processedData.confidence > 0.4
      ? '#FF9800'
      : '#f44336'
    : '#999';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Smart Job Entry',
          headerShown: true,
          headerStyle: {
            backgroundColor: isDarkMode ? '#000' : '#fff',
          },
          headerTintColor: isDarkMode ? '#fff' : '#000',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleShowAnalysis}
              style={{ marginRight: 16 }}
            >
              <IconSymbol
                ios_icon_name="chart.bar.fill"
                android_material_icon_name="analytics"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <AppBackground overlayStrength={overlayStrength}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
              <View style={styles.header}>
                <IconSymbol
                  ios_icon_name="brain"
                  android_material_icon_name="psychology"
                  size={32}
                  color={theme.primary}
                />
                <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
                  AI-Powered Job Entry
                </Text>
              </View>

              <Text style={[styles.description, { color: isDarkMode ? '#aaa' : '#666' }]}>
                Describe the job in natural language. The AI will extract WIP number, registration, AW value, and notes.
              </Text>

              <View style={styles.examplesContainer}>
                <Text style={[styles.examplesTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Examples:
                </Text>
                <Text style={[styles.exampleText, { color: isDarkMode ? '#888' : '#666' }]}>
                  • "12345 ABC123 20 AW green vhc"
                </Text>
                <Text style={[styles.exampleText, { color: isDarkMode ? '#888' : '#666' }]}>
                  • "WIP 54321 reg XYZ789 15 hours"
                </Text>
                <Text style={[styles.exampleText, { color: isDarkMode ? '#888' : '#666' }]}>
                  • "Job 11111 for ABC456 took 25 AW, orange VHC, brake service"
                </Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Describe the Job
                </Text>
                <SmartInput
                  value={naturalInput}
                  onChangeText={setNaturalInput}
                  placeholder="e.g., 12345 ABC123 20 AW green vhc"
                  field="natural"
                  recentJobs={recentJobs}
                  onProcessedInput={handleProcessedInput}
                  showBrainIcon={true}
                  multiline={true}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
              </View>

              {processedData && (
                <View style={[styles.resultsCard, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
                  <View style={styles.resultsHeader}>
                    <Text style={[styles.resultsTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Extracted Data
                    </Text>
                    <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
                      <Text style={styles.confidenceText}>
                        {Math.round(processedData.confidence * 100)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: isDarkMode ? '#888' : '#666' }]}>
                      WIP Number:
                    </Text>
                    <Text style={[styles.resultValue, { color: processedData.wipNumber ? theme.primary : '#f44336' }]}>
                      {processedData.wipNumber || 'Not found'}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: isDarkMode ? '#888' : '#666' }]}>
                      Registration:
                    </Text>
                    <Text style={[styles.resultValue, { color: processedData.vehicleReg ? theme.primary : '#f44336' }]}>
                      {processedData.vehicleReg || 'Not found'}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: isDarkMode ? '#888' : '#666' }]}>
                      AW Value:
                    </Text>
                    <Text style={[styles.resultValue, { color: processedData.aw !== undefined ? theme.primary : '#f44336' }]}>
                      {processedData.aw !== undefined ? `${processedData.aw} AW (${formatTime(awToMinutes(processedData.aw))})` : 'Not found'}
                    </Text>
                  </View>

                  {processedData.vhcStatus && processedData.vhcStatus !== 'NONE' && (
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { color: isDarkMode ? '#888' : '#666' }]}>
                        VHC Status:
                      </Text>
                      <Text style={[styles.resultValue, { color: theme.secondary }]}>
                        {processedData.vhcStatus}
                      </Text>
                    </View>
                  )}

                  {processedData.notes && (
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { color: isDarkMode ? '#888' : '#666' }]}>
                        Notes:
                      </Text>
                      <Text style={[styles.resultValue, { color: isDarkMode ? '#fff' : '#000' }]}>
                        {processedData.notes}
                      </Text>
                    </View>
                  )}

                  {processedData.needsClarification && (
                    <View style={[styles.warningBox, { backgroundColor: '#FF9800' }]}>
                      <IconSymbol
                        ios_icon_name="exclamationmark.triangle.fill"
                        android_material_icon_name="warning"
                        size={20}
                        color="#ffffff"
                      />
                      <Text style={styles.warningText}>
                        {processedData.clarificationQuestion}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor: theme.primary,
                        opacity: processedData.wipNumber && processedData.vehicleReg && processedData.aw !== undefined ? 1 : 0.5,
                      },
                    ]}
                    onPress={handleSaveJob}
                    disabled={saving || !processedData.wipNumber || !processedData.vehicleReg || processedData.aw === undefined}
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
              )}

              <View style={styles.tipsContainer}>
                <IconSymbol
                  ios_icon_name="lightbulb.fill"
                  android_material_icon_name="lightbulb"
                  size={20}
                  color={theme.secondary}
                />
                <Text style={[styles.tipsText, { color: isDarkMode ? '#aaa' : '#666' }]}>
                  The AI learns from your previous jobs to provide better suggestions and corrections.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
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
  card: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  examplesContainer: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  tipsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
