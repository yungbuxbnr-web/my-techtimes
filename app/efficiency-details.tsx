
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Platform,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { useLocalSearchParams } from 'expo-router';
import { api, EfficiencyDetails } from '@/utils/api';
import { Stack } from 'expo-router';

export default function EfficiencyDetailsScreen() {
  const { theme, overlayStrength } = useThemeContext();
  const { month } = useLocalSearchParams<{ month: string }>();
  const [details, setDetails] = useState<EfficiencyDetails | null>(null);

  const loadDetails = useCallback(async () => {
    try {
      const data = await api.getEfficiencyDetails(month || getCurrentMonth());
      setDetails(data);
      console.log('EfficiencyDetailsScreen: Loaded details:', data);
    } catch (error) {
      console.error('EfficiencyDetailsScreen: Error loading details:', error);
    }
  }, [month]);

  useEffect(() => {
    console.log('EfficiencyDetailsScreen: Loading efficiency details for month:', month);
    loadDetails();
  }, [month, loadDetails]);

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 65) return theme.chartGreen;
    if (efficiency >= 31) return theme.chartYellow;
    return theme.chartRed;
  };

  if (!details) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Efficiency Details',
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

  const efficiencyColor = getEfficiencyColor(details.efficiency);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Efficiency Details',
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
              <Text style={[styles.title, { color: '#ffffff' }]}>Efficiency Breakdown</Text>
              <Text style={[styles.subtitle, { color: '#cccccc' }]}>{monthName}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.efficiencyValue, { color: efficiencyColor }]}>
                {details.efficiency.toFixed(1)}%
              </Text>
              <Text style={[styles.efficiencyLabel, { color: theme.textSecondary }]}>
                Current Efficiency
              </Text>
              <View style={[styles.badge, { backgroundColor: efficiencyColor + '20' }]}>
                <Text style={[styles.badgeText, { color: efficiencyColor }]}>
                  {details.efficiencyColor.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={theme.primary}
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
                    Hours you've worked and sold
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={24}
                    color={theme.secondary}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Available Hours
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {details.availableHours.toFixed(1)} hours
                  </Text>
                  <Text style={[styles.detailSubtext, { color: theme.textSecondary }]}>
                    {details.weekdaysInMonth} weekdays × 8.5h
                    {details.absenceDays > 0 && ` - ${details.absenceDays} absence days`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Calculation Formula</Text>
              <Text style={[styles.formula, { color: theme.textSecondary }]}>
                {details.formula}
              </Text>
              <Text style={[styles.formula, { color: theme.textSecondary }]}>
                = ({details.soldHours.toFixed(1)} ÷ {details.availableHours.toFixed(1)}) × 100
              </Text>
              <Text style={[styles.formula, { color: efficiencyColor }]}>
                = {details.efficiency.toFixed(1)}%
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Efficiency Ranges</Text>
              <View style={styles.rangeRow}>
                <View style={[styles.rangeIndicator, { backgroundColor: theme.chartGreen }]} />
                <Text style={[styles.rangeText, { color: theme.text }]}>
                  65-100% = Green (Excellent)
                </Text>
              </View>
              <View style={styles.rangeRow}>
                <View style={[styles.rangeIndicator, { backgroundColor: theme.chartYellow }]} />
                <Text style={[styles.rangeText, { color: theme.text }]}>
                  31-64% = Yellow (Good)
                </Text>
              </View>
              <View style={styles.rangeRow}>
                <View style={[styles.rangeIndicator, { backgroundColor: theme.chartRed }]} />
                <Text style={[styles.rangeText, { color: theme.text }]}>
                  0-30% = Red (Needs Improvement)
                </Text>
              </View>
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
  efficiencyValue: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  efficiencyLabel: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
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
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rangeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  rangeText: {
    fontSize: 16,
  },
});
