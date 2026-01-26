
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { useResponsiveLayout, getPadding, getFontSize, getSpacing } from '@/utils/responsive';
import DateTimePicker from '@react-native-community/datetimepicker';

type DateRange = 'today' | '7days' | '30days' | 'thisMonth' | 'custom';
type FilterType = 'all' | 'jobType' | 'tag' | 'awRange';

interface JobTypeStats {
  type: string;
  count: number;
  percentage: number;
  totalAw: number;
  totalHours: number;
}

interface RegFrequency {
  reg: string;
  count: number;
  totalAw: number;
  lastSeen: string;
}

interface DayStats {
  date: string;
  jobCount: number;
  totalAw: number;
}

export default function InsightsScreen() {
  const { theme } = useThemeContext();
  const layout = useResponsiveLayout();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  
  // Filter state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobTypeStats, setJobTypeStats] = useState<JobTypeStats[]>([]);
  const [regFrequencies, setRegFrequencies] = useState<RegFrequency[]>([]);
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  
  // KPI state
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalAw, setTotalAw] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [averageAw, setAverageAw] = useState(0);

  useEffect(() => {
    loadInsightsData();
  }, [dateRange, customStartDate, customEndDate, filterType]);

  const loadInsightsData = async () => {
    try {
      console.log('InsightsScreen: Loading insights data for range:', dateRange);
      setLoading(true);
      
      // Get date range
      const dateRangeResult = getDateRangeForFilter(dateRange);
      const startDateStr = dateRangeResult.start;
      const endDateStr = dateRangeResult.end;
      
      // Fetch jobs in range
      const allJobs = await api.getAllJobs();
      const filteredJobs = allJobs.filter(job => {
        const jobDate = job.createdAt.split('T')[0];
        return jobDate >= startDateStr && jobDate <= endDateStr;
      });
      
      setJobs(filteredJobs);
      
      // Calculate KPIs
      const jobCount = filteredJobs.length;
      const awSum = filteredJobs.reduce((sum, job) => sum + job.aw, 0);
      const hoursSum = (awSum * 5) / 60;
      const avgAw = jobCount > 0 ? awSum / jobCount : 0;
      
      setTotalJobs(jobCount);
      setTotalAw(awSum);
      setTotalHours(hoursSum);
      setAverageAw(avgAw);
      
      // Calculate job type stats
      calculateJobTypeStats(filteredJobs);
      
      // Calculate reg frequencies
      calculateRegFrequencies(filteredJobs);
      
      // Calculate day stats
      calculateDayStats(filteredJobs);
      
      console.log('InsightsScreen: Data loaded successfully');
    } catch (error) {
      console.error('InsightsScreen: Error loading insights data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeForFilter = (range: DateRange): { start: string; end: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    let startDate = new Date(today);
    
    switch (range) {
      case 'today':
        break;
      case '7days':
        startDate.setDate(today.getDate() - 6);
        break;
      case '30days':
        startDate.setDate(today.getDate() - 29);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate.setTime(customEndDate.getTime());
        break;
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    return { start: startStr, end: endStr };
  };

  const calculateJobTypeStats = (jobList: Job[]) => {
    console.log('InsightsScreen: Calculating job type stats');
    
    // For now, we'll use VHC status as a proxy for job types
    // In a real implementation, jobs would have a jobType field
    const typeMap = new Map<string, { count: number; totalAw: number }>();
    
    jobList.forEach(job => {
      const type = job.vhcStatus === 'NONE' ? 'Standard' : `VHC ${job.vhcStatus}`;
      const existing = typeMap.get(type) || { count: 0, totalAw: 0 };
      existing.count++;
      existing.totalAw += job.aw;
      typeMap.set(type, existing);
    });
    
    const totalCount = jobList.length;
    const stats: JobTypeStats[] = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        totalAw: data.totalAw,
        totalHours: (data.totalAw * 5) / 60,
      }))
      .sort((a, b) => b.count - a.count);
    
    setJobTypeStats(stats);
  };

  const calculateRegFrequencies = (jobList: Job[]) => {
    console.log('InsightsScreen: Calculating reg frequencies');
    
    const regMap = new Map<string, { count: number; totalAw: number; lastSeen: string }>();
    
    jobList.forEach(job => {
      const reg = job.vehicleReg.toUpperCase();
      const existing = regMap.get(reg) || { count: 0, totalAw: 0, lastSeen: job.createdAt };
      existing.count++;
      existing.totalAw += job.aw;
      if (new Date(job.createdAt) > new Date(existing.lastSeen)) {
        existing.lastSeen = job.createdAt;
      }
      regMap.set(reg, existing);
    });
    
    const frequencies: RegFrequency[] = Array.from(regMap.entries())
      .map(([reg, data]) => ({
        reg,
        count: data.count,
        totalAw: data.totalAw,
        lastSeen: data.lastSeen,
      }))
      .filter(item => item.count > 1) // Only show repeating regs
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
    
    setRegFrequencies(frequencies);
  };

  const calculateDayStats = (jobList: Job[]) => {
    console.log('InsightsScreen: Calculating day stats');
    
    const dayMap = new Map<string, { jobCount: number; totalAw: number }>();
    
    jobList.forEach(job => {
      const day = job.createdAt.split('T')[0];
      const existing = dayMap.get(day) || { jobCount: 0, totalAw: 0 };
      existing.jobCount++;
      existing.totalAw += job.aw;
      dayMap.set(day, existing);
    });
    
    const stats: DayStats[] = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        jobCount: data.jobCount,
        totalAw: data.totalAw,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    setDayStats(stats);
  };

  const onRefresh = useCallback(async () => {
    console.log('InsightsScreen: User refreshing data');
    setRefreshing(true);
    await loadInsightsData();
    setRefreshing(false);
  }, [dateRange, customStartDate, customEndDate, filterType]);

  const handleDateRangeChange = (range: DateRange) => {
    console.log('InsightsScreen: User changed date range to:', range);
    if (range === 'custom') {
      setShowCustomDateModal(true);
    } else {
      setDateRange(range);
    }
  };

  const handleApplyCustomRange = () => {
    console.log('InsightsScreen: User applied custom date range');
    setDateRange('custom');
    setShowCustomDateModal(false);
  };

  const handleJobTypeTap = (type: string) => {
    console.log('InsightsScreen: User tapped job type:', type);
    // Navigate to filtered job list
    router.push('/job-stats');
  };

  const getDateRangeLabel = (): string => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case '7days':
        return '7 Days';
      case '30days':
        return '30 Days';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        const startStr = customStartDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const endStr = customEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return `${startStr} - ${endStr}`;
      default:
        return '30 Days';
    }
  };

  const padding = getPadding(layout);
  const spacing = getSpacing(layout);
  const titleFontSize = getFontSize(28, layout);
  const subtitleFontSize = getFontSize(14, layout);

  // Responsive layout: 2 columns on landscape/tablet
  const shouldUseColumns = layout.isLandscape || layout.isTablet;
  const kpiCardWidth = shouldUseColumns ? '48%' : '100%';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { padding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
          <View>
            <Text style={[styles.title, { color: theme.text, fontSize: titleFontSize }]}>Job Insights</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary, fontSize: subtitleFontSize }]}>
              Patterns & Analytics
            </Text>
          </View>
          <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
            <IconSymbol
              ios_icon_name="chart.bar.fill"
              android_material_icon_name="bar-chart"
              size={32}
              color="#ffffff"
            />
          </View>
        </View>

        {/* Date Range Selector */}
        <View style={[styles.dateRangeContainer, { marginBottom: spacing }]}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Date Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: dateRange === 'today' ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleDateRangeChange('today')}
            >
              <Text style={[styles.chipText, { color: dateRange === 'today' ? '#ffffff' : theme.text }]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: dateRange === '7days' ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleDateRangeChange('7days')}
            >
              <Text style={[styles.chipText, { color: dateRange === '7days' ? '#ffffff' : theme.text }]}>
                7 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: dateRange === '30days' ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleDateRangeChange('30days')}
            >
              <Text style={[styles.chipText, { color: dateRange === '30days' ? '#ffffff' : theme.text }]}>
                30 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: dateRange === 'thisMonth' ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleDateRangeChange('thisMonth')}
            >
              <Text style={[styles.chipText, { color: dateRange === 'thisMonth' ? '#ffffff' : theme.text }]}>
                This Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: dateRange === 'custom' ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => handleDateRangeChange('custom')}
            >
              <Text style={[styles.chipText, { color: dateRange === 'custom' ? '#ffffff' : theme.text }]}>
                Custom
              </Text>
            </TouchableOpacity>
          </ScrollView>
          <Text style={[styles.dateRangeLabel, { color: theme.textSecondary }]}>
            Showing: {getDateRangeLabel()}
          </Text>
        </View>

        {/* KPI Cards */}
        <View style={[styles.kpiContainer, shouldUseColumns && styles.kpiContainerColumns, { gap: spacing }]}>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}>
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totalJobs}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Jobs Logged</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}>
            <IconSymbol
              ios_icon_name="bolt.fill"
              android_material_icon_name="flash-on"
              size={24}
              color={theme.chartOrange}
            />
            <Text style={[styles.kpiValue, { color: theme.text }]}>{totalAw}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total AW</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="access-time"
              size={24}
              color={theme.chartGreen}
            />
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {formatDecimalHours(totalAw * 5)}h
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total Time</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}>
            <IconSymbol
              ios_icon_name="chart.line.uptrend.xyaxis"
              android_material_icon_name="trending-up"
              size={24}
              color={theme.chartBlue}
            />
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {averageAw.toFixed(1)}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Average AW/Job</Text>
          </View>
        </View>

        {/* Job Type Frequency */}
        <View style={[styles.section, { marginTop: spacing }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Job Type Frequency</Text>
          {jobTypeStats.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <IconSymbol
                ios_icon_name="chart.bar"
                android_material_icon_name="bar-chart"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No job data for this period
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {jobTypeStats.map((stat, index) => {
                const percentageText = `${stat.percentage.toFixed(0)}%`;
                const countText = `${stat.count}`;
                const awText = `${stat.totalAw} AW`;
                const hoursText = `${stat.totalHours.toFixed(1)}h`;
                
                return (
                  <React.Fragment key={stat.type}>
                    <TouchableOpacity
                      style={styles.jobTypeRow}
                      onPress={() => handleJobTypeTap(stat.type)}
                    >
                      <View style={styles.jobTypeLeft}>
                        <Text style={[styles.jobTypeName, { color: theme.text }]}>{stat.type}</Text>
                        <View style={styles.jobTypeStats}>
                          <Text style={[styles.jobTypeCount, { color: theme.primary }]}>
                            {countText}
                          </Text>
                          <Text style={[styles.jobTypeSeparator, { color: theme.textSecondary }]}>•</Text>
                          <Text style={[styles.jobTypePercentage, { color: theme.textSecondary }]}>
                            {percentageText}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.jobTypeRight}>
                        <Text style={[styles.jobTypeAw, { color: theme.text }]}>{awText}</Text>
                        <Text style={[styles.jobTypeHours, { color: theme.textSecondary }]}>{hoursText}</Text>
                      </View>
                    </TouchableOpacity>
                    {index < jobTypeStats.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* Top Repeating Regs */}
        {regFrequencies.length > 0 && (
          <View style={[styles.section, { marginTop: spacing }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Repeating Regs</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {regFrequencies.map((freq, index) => {
                const countText = `${freq.count}x`;
                const awText = `${freq.totalAw} AW`;
                const dateText = new Date(freq.lastSeen).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                });
                
                return (
                  <React.Fragment key={freq.reg}>
                    <View style={styles.regRow}>
                      <View style={styles.regLeft}>
                        <Text style={[styles.regNumber, { color: theme.primary }]}>{freq.reg}</Text>
                        <Text style={[styles.regDate, { color: theme.textSecondary }]}>
                          Last: {dateText}
                        </Text>
                      </View>
                      <View style={styles.regRight}>
                        <Text style={[styles.regCount, { color: theme.text }]}>{countText}</Text>
                        <Text style={[styles.regAw, { color: theme.textSecondary }]}>{awText}</Text>
                      </View>
                    </View>
                    {index < regFrequencies.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Jobs Per Day Trend */}
        {dayStats.length > 0 && (
          <View style={[styles.section, { marginTop: spacing, marginBottom: 32 }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Jobs Per Day</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartContainer}>
                  {dayStats.map((dayStat) => {
                    const maxJobs = Math.max(...dayStats.map(d => d.jobCount));
                    const barHeight = maxJobs > 0 ? (dayStat.jobCount / maxJobs) * 120 : 0;
                    const dateLabel = new Date(dayStat.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    });
                    const jobCountText = `${dayStat.jobCount}`;
                    
                    return (
                      <View key={dayStat.date} style={styles.barContainer}>
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              { height: barHeight, backgroundColor: theme.primary },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, { color: theme.text }]}>{jobCountText}</Text>
                        <Text style={[styles.barDate, { color: theme.textSecondary }]}>{dateLabel}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerRow}>
              <View style={styles.datePickerItem}>
                <Text style={[styles.datePickerLabel, { color: theme.text }]}>Start Date</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, { color: theme.text }]}>
                    {customStartDate.toLocaleDateString('en-GB')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerItem}>
                <Text style={[styles.datePickerLabel, { color: theme.text }]}>End Date</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, { color: theme.text }]}>
                    {customEndDate.toLocaleDateString('en-GB')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={handleApplyCustomRange}
            >
              <Text style={styles.applyButtonText}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
              setCustomStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              setCustomEndDate(selectedDate);
            }
          }}
        />
      )}
    </View>
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
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRangeContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsScroll: {
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiContainerColumns: {
    justifyContent: 'flex-start',
  },
  kpiCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: '48%',
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  kpiLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  jobTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  jobTypeLeft: {
    flex: 1,
  },
  jobTypeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  jobTypeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobTypeCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobTypeSeparator: {
    fontSize: 14,
  },
  jobTypePercentage: {
    fontSize: 14,
  },
  jobTypeRight: {
    alignItems: 'flex-end',
  },
  jobTypeAw: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobTypeHours: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  regRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  regLeft: {
    flex: 1,
  },
  regNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  regDate: {
    fontSize: 12,
  },
  regRight: {
    alignItems: 'flex-end',
  },
  regCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  regAw: {
    fontSize: 12,
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 16,
    gap: 12,
  },
  barContainer: {
    alignItems: 'center',
    width: 50,
  },
  barWrapper: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: 32,
  },
  bar: {
    width: 32,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  barDate: {
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  datePickerItem: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  datePickerButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 14,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
