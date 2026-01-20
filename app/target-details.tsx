
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router, useLocalSearchParams } from 'expo-router';
import { api, TargetDetails } from '@/utils/api';
import { Stack } from 'expo-router';

export default function TargetDetailsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const { month } = useLocalSearchParams<{ month: string }>();
  const [details, setDetails] = useState<TargetDetails | null>(null);

  useEffect(() => {
    console.log('TargetDetailsScreen: Loading target details for month:', month);
    loadDetails();
  }, [month]);

  const loadDetails = async () => {
    try {
      const data = await api.getTargetDetails(month || getCurrentMonth());
      setDetails(data);
      console.log('TargetDetailsScreen: Loaded details:', data);
    } catch (error) {
      console.error('TargetDetailsScreen: Error loading details:', error);
    }
  };

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  if (!details) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Target Details',
            headerBackTitle: 'Back',
          }}
        />
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
          style={styles.background}
        >
          <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
            </View>
          </View>
        </ImageBackground>
      </>
    );
  }

  const monthName = new Date(details.month + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Target Details',
          headerBackTitle: 'Back',
        }}
      />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200' }}
        style={styles.background}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${overlayStrength})` }]}>
          <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
              <Text style={[styles.title, { color: '#ffffff' }]}>Target Breakdown</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>{monthName}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${Math.min(details.percentComplete, 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentText, { color: theme.primary }]}>
                {details.percentComplete.toFixed(1)}% Complete
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <IconSymbol
                    ios_icon_name="target"
                    android_material_icon_name="flag"
                    size={24}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Monthly Target
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {details.targetHours.toFixed(1)} hours
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={theme.chartGreen}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Sold Hours
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {details.soldHours.toFixed(1)} hours
                  </Text>
                  <Text style={[styles.detailSubtext, { color: theme.textSecondary }]}>
                    From {details.totalAw} AW across {details.totalJobs} jobs
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <IconSymbol
                    ios_icon_name="clock.fill"
                    android_material_icon_name="access-time"
                    size={24}
                    color={details.remainingHours > 0 ? theme.chartYellow : theme.chartGreen}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Remaining Hours
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {details.remainingHours.toFixed(1)} hours
                  </Text>
                  {details.remainingHours > 0 && (
                    <Text style={[styles.detailSubtext, { color: theme.textSecondary }]}>
                      {(details.remainingHours / 5 * 60).toFixed(0)} AW needed
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Calculation</Text>
              <Text style={[styles.formula, { color: theme.textSecondary }]}>
                Sold Hours = (Total AW × 5 minutes) ÷ 60
              </Text>
              <Text style={[styles.formula, { color: theme.textSecondary }]}>
                = ({details.totalAw} × 5) ÷ 60
              </Text>
              <Text style={[styles.formula, { color: theme.primary }]}>
                = {details.soldHours.toFixed(1)} hours
              </Text>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailSubtext: {
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  formula: {
    fontSize: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
