
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
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { api, Job } from '@/utils/api';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { useResponsiveLayout, getPadding, getFontSize, getSpacing } from '@/utils/responsive';
import DateTimePicker from '@react-native-community/datetimepicker';

type DateRange = 'today' | '7days' | '30days' | 'thisMonth' | 'custom';
type SubTab = 'overview' | 'jobMix' | 'efficiency' | 'repeats' | 'trends' | 'goals';
type DrilldownSort = 'newest' | 'highestAw' | 'regRepeats' | 'mostNotes';

interface JobTypeStats {
  type: string;
  count: number;
  percentage: number;
  totalAw: number;
  avgAw: number;
  totalHours: number;
}

interface RegFrequency {
  reg: string;
  count: number;
  totalAw: number;
  lastSeen: string;
  jobs: Job[];
}

interface DayStats {
  date: string;
  jobCount: number;
  totalAw: number;
}

interface ComebackStats {
  total: number;
  byTag: Map<string, number>;
  avgDaysBetween: number;
}

export default function InsightsScreen() {
  const { theme } = useThemeContext();
  const layout = useResponsiveLayout();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  
  // Shift filter state
  const [shiftFilter, setShiftFilter] = useState<'all' | 'myShift'>('all');
  
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
  const [topJobType, setTopJobType] = useState('N/A');
  
  // Drilldown state
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownJobs, setDrilldownJobs] = useState<Job[]>([]);
  const [drilldownSort, setDrilldownSort] = useState<DrilldownSort>('newest');
  
  // Goals state
  const [monthlyTarget, setMonthlyTarget] = useState(180);
  const [weeklyTarget, setWeeklyTarget] = useState(40);
  const [dailyTarget, setDailyTarget] = useState(8);

  useEffect(() => {
    loadInsightsData();
  }, [dateRange, customStartDate, customEndDate, shiftFilter]);

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
      let filteredJobs = allJobs.filter(job => {
        const jobDate = job.createdAt.split('T')[0];
        return jobDate >= startDateStr && jobDate <= endDateStr;
      });
      
      // Apply shift filter if needed
      if (shiftFilter === 'myShift') {
        const schedule = await api.getSchedule();
        filteredJobs = filteredJobs.filter(job => {
          const jobTime = new Date(job.createdAt);
          const hours = jobTime.getHours();
          const minutes = jobTime.getMinutes();
          const timeInMinutes = hours * 60 + minutes;
          
          const startParts = schedule.startTime.split(':');
          const endParts = schedule.endTime.split(':');
          const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
          
          return timeInMinutes >= startMinutes && timeInMinutes <= endMinutes;
        });
      }
      
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
      const typeStats = calculateJobTypeStats(filteredJobs);
      setJobTypeStats(typeStats);
      setTopJobType(typeStats.length > 0 ? typeStats[0].type : 'N/A');
      
      // Calculate reg frequencies
      calculateRegFrequencies(filteredJobs);
      
      // Calculate day stats
      calculateDayStats(filteredJobs);
      
      // Load goals
      const settings = await api.getSettings();
      setMonthlyTarget(settings.monthlyTarget || 180);
      
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

  const calculateJobTypeStats = (jobList: Job[]): JobTypeStats[] => {
    console.log('InsightsScreen: Calculating job type stats');
    
    // Use VHC status as job type proxy
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
        avgAw: data.count > 0 ? data.totalAw / data.count : 0,
        totalHours: (data.totalAw * 5) / 60,
      }))
      .sort((a, b) => b.count - a.count);
    
    return stats;
  };

  const calculateRegFrequencies = (jobList: Job[]) => {
    console.log('InsightsScreen: Calculating reg frequencies');
    
    const regMap = new Map<string, { count: number; totalAw: number; lastSeen: string; jobs: Job[] }>();
    
    jobList.forEach(job => {
      const reg = job.vehicleReg.toUpperCase();
      const existing = regMap.get(reg) || { count: 0, totalAw: 0, lastSeen: job.createdAt, jobs: [] };
      existing.count++;
      existing.totalAw += job.aw;
      existing.jobs.push(job);
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
        jobs: data.jobs,
      }))
      .filter(item => item.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
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
  }, [dateRange, customStartDate, customEndDate, shiftFilter]);

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

  const handleDrilldown = (title: string, filterFn: (job: Job) => boolean) => {
    console.log('InsightsScreen: Opening drilldown:', title);
    const filtered = jobs.filter(filterFn);
    setDrilldownTitle(title);
    setDrilldownJobs(filtered);
    setDrilldownSort('newest');
    setShowDrilldown(true);
  };

  const getSortedDrilldownJobs = (): Job[] => {
    let sorted = [...drilldownJobs];
    
    switch (drilldownSort) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'highestAw':
        sorted.sort((a, b) => b.aw - a.aw);
        break;
      case 'regRepeats':
        const regCounts = new Map<string, number>();
        drilldownJobs.forEach(job => {
          const count = regCounts.get(job.vehicleReg) || 0;
          regCounts.set(job.vehicleReg, count + 1);
        });
        sorted.sort((a, b) => (regCounts.get(b.vehicleReg) || 0) - (regCounts.get(a.vehicleReg) || 0));
        break;
      case 'mostNotes':
        sorted.sort((a, b) => (b.notes?.length || 0) - (a.notes?.length || 0));
        break;
    }
    
    return sorted;
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

  const shouldUseColumns = layout.isLandscape || layout.isTablet;
  const kpiCardWidth = shouldUseColumns ? '48%' : '100%';

  const renderOverview = () => (
    <View>
      {/* Controls Row */}
      <View style={[styles.controlsRow, { marginBottom: spacing }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Date Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {['today', '7days', '30days', 'thisMonth', 'custom'].map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.chip,
                  { 
                    backgroundColor: dateRange === range ? theme.primary : theme.card, 
                    borderColor: theme.border 
                  },
                ]}
                onPress={() => handleDateRangeChange(range as DateRange)}
              >
                <Text style={[styles.chipText, { color: dateRange === range ? '#ffffff' : theme.text }]}>
                  {range === 'today' ? 'Today' : range === '7days' ? '7d' : range === '30days' ? '30d' : range === 'thisMonth' ? 'This Month' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={[styles.controlsRow, { marginBottom: spacing }]}>
        <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>Shift Filter</Text>
        <View style={styles.shiftFilterRow}>
          <TouchableOpacity
            style={[
              styles.shiftFilterButton,
              { 
                backgroundColor: shiftFilter === 'all' ? theme.primary : theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => setShiftFilter('all')}
          >
            <Text style={[styles.shiftFilterText, { color: shiftFilter === 'all' ? '#ffffff' : theme.text }]}>
              All Day
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.shiftFilterButton,
              { 
                backgroundColor: shiftFilter === 'myShift' ? theme.primary : theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => setShiftFilter('myShift')}
          >
            <Text style={[styles.shiftFilterText, { color: shiftFilter === 'myShift' ? '#ffffff' : theme.text }]}>
              My Shift
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={[styles.kpiContainer, shouldUseColumns && styles.kpiContainerColumns, { gap: spacing }]}>
        <TouchableOpacity 
          style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}
          onPress={() => handleDrilldown('All Jobs', () => true)}
        >
          <IconSymbol
            ios_icon_name="list.bullet"
            android_material_icon_name="list"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.kpiValue, { color: theme.text }]}>{totalJobs}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Jobs Logged</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}
          onPress={() => handleDrilldown('High AW Jobs', (job) => job.aw >= averageAw)}
        >
          <IconSymbol
            ios_icon_name="bolt.fill"
            android_material_icon_name="flash-on"
            size={24}
            color={theme.chartOrange}
          />
          <Text style={[styles.kpiValue, { color: theme.text }]}>{totalAw}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total AW</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}
          onPress={() => handleDrilldown('All Jobs', () => true)}
        >
          <IconSymbol
            ios_icon_name="clock.fill"
            android_material_icon_name="access-time"
            size={24}
            color={theme.chartGreen}
          />
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {formatDecimalHours(totalAw * 5)}h
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>AW Hours</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}
          onPress={() => handleDrilldown('Average AW Jobs', (job) => Math.abs(job.aw - averageAw) < 2)}
        >
          <IconSymbol
            ios_icon_name="chart.line.uptrend.xyaxis"
            android_material_icon_name="trending-up"
            size={24}
            color={theme.chartBlue}
          />
          <Text style={[styles.kpiValue, { color: theme.text }]}>
            {averageAw.toFixed(1)}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Avg AW/Job</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, { backgroundColor: theme.card, width: kpiCardWidth }]}
          onPress={() => {
            if (jobTypeStats.length > 0) {
              handleDrilldown(`${jobTypeStats[0].type} Jobs`, (job) => {
                const type = job.vhcStatus === 'NONE' ? 'Standard' : `VHC ${job.vhcStatus}`;
                return type === jobTypeStats[0].type;
              });
            }
          }}
        >
          <IconSymbol
            ios_icon_name="star.fill"
            android_material_icon_name="star"
            size={24}
            color={theme.chartYellow}
          />
          <Text style={[styles.kpiValue, { color: theme.text, fontSize: 20 }]}>{topJobType}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Top Job Type</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Drill Buttons */}
      <View style={[styles.section, { marginTop: spacing }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Drilldowns</Text>
        <View style={styles.drillButtonsGrid}>
          <TouchableOpacity
            style={[styles.drillButton, { backgroundColor: theme.card }]}
            onPress={() => handleDrilldown('Biggest AW Jobs', () => true)}
          >
            <IconSymbol
              ios_icon_name="arrow.up.circle.fill"
              android_material_icon_name="arrow-upward"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.drillButtonText, { color: theme.text }]}>Biggest AW</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.drillButton, { backgroundColor: theme.card }]}
            onPress={() => handleDrilldown('Jobs with No Tags', (job) => job.vhcStatus === 'NONE')}
          >
            <IconSymbol
              ios_icon_name="tag.slash"
              android_material_icon_name="label-off"
              size={20}
              color={theme.chartOrange}
            />
            <Text style={[styles.drillButtonText, { color: theme.text }]}>No Tags</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.drillButton, { backgroundColor: theme.card }]}
            onPress={() => handleDrilldown('Jobs with Notes', (job) => !!job.notes && job.notes.length > 0)}
          >
            <IconSymbol
              ios_icon_name="note.text"
              android_material_icon_name="description"
              size={20}
              color={theme.chartGreen}
            />
            <Text style={[styles.drillButtonText, { color: theme.text }]}>Has Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.drillButton, { backgroundColor: theme.card }]}
            onPress={() => handleDrilldown('Comeback Jobs', (job) => 
              job.notes?.toLowerCase().includes('come back') || 
              job.notes?.toLowerCase().includes('comeback') ||
              job.notes?.toLowerCase().includes('recheck')
            )}
          >
            <IconSymbol
              ios_icon_name="arrow.uturn.backward"
              android_material_icon_name="replay"
              size={20}
              color={theme.chartRed}
            />
            <Text style={[styles.drillButtonText, { color: theme.text }]}>Comebacks</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderJobMix = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing }]}>Job Type Ranking</Text>
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
            const avgAwText = `Avg: ${stat.avgAw.toFixed(1)}`;
            
            return (
              <React.Fragment key={stat.type}>
                <TouchableOpacity
                  style={styles.jobTypeRow}
                  onPress={() => {
                    handleDrilldown(`${stat.type} Jobs`, (job) => {
                      const type = job.vhcStatus === 'NONE' ? 'Standard' : `VHC ${job.vhcStatus}`;
                      return type === stat.type;
                    });
                  }}
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
                    <Text style={[styles.jobTypeHours, { color: theme.textSecondary }]}>{avgAwText}</Text>
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
  );

  const renderEfficiency = () => {
    const awPerDay = dayStats.length > 0 ? totalAw / dayStats.length : 0;
    const awPerDayText = awPerDay.toFixed(1);
    
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing }]}>AW Productivity</Text>
        
        <View style={[styles.card, { backgroundColor: theme.card, marginBottom: spacing }]}>
          <View style={styles.efficiencyRow}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={32}
              color={theme.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.efficiencyValue, { color: theme.text }]}>{awPerDayText} AW</Text>
              <Text style={[styles.efficiencyLabel, { color: theme.textSecondary }]}>Average AW per Day</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.efficiencyRow}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={32}
              color={theme.chartGreen}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.efficiencyValue, { color: theme.text }]}>
                {formatDecimalHours(totalAw * 5)}h
              </Text>
              <Text style={[styles.efficiencyLabel, { color: theme.textSecondary }]}>
                Total Time Logged
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderRepeats = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing }]}>
        Most Repeated Regs
      </Text>
      {regFrequencies.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="car"
            android_material_icon_name="directions-car"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No repeat registrations found
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {regFrequencies.map((freq, index) => {
            const countText = `${freq.count} visits`;
            const awText = `Total: ${freq.totalAw} AW`;
            const dateText = new Date(freq.lastSeen).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            
            return (
              <React.Fragment key={freq.reg}>
                <TouchableOpacity
                  style={styles.regRow}
                  onPress={() => handleDrilldown(`${freq.reg} History`, (job) => 
                    job.vehicleReg.toUpperCase() === freq.reg
                  )}
                >
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
                </TouchableOpacity>
                {index < regFrequencies.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderTrends = () => (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing }]}>
        Jobs Per Day Trend
      </Text>
      {dayStats.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <IconSymbol
            ios_icon_name="chart.line.uptrend.xyaxis"
            android_material_icon_name="trending-up"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No trend data available
          </Text>
        </View>
      ) : (
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
      )}
    </View>
  );

  const renderGoals = () => {
    const monthlyProgress = monthlyTarget > 0 ? (totalHours / monthlyTarget) * 100 : 0;
    const monthlyProgressText = `${monthlyProgress.toFixed(0)}%`;
    const remainingHours = Math.max(0, monthlyTarget - totalHours);
    const remainingHoursText = remainingHours.toFixed(1);
    
    const daysInPeriod = dayStats.length || 1;
    const requiredPace = remainingHours / Math.max(1, 30 - daysInPeriod);
    const requiredPaceText = requiredPace.toFixed(1);
    
    const bestDay = dayStats.reduce((best, day) => 
      day.totalAw > (best?.totalAw || 0) ? day : best
    , dayStats[0]);
    
    const bestDayText = bestDay 
      ? `${new Date(bestDay.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${bestDay.totalAw} AW`
      : 'N/A';
    
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing }]}>
          Monthly Goals
        </Text>
        
        <View style={[styles.card, { backgroundColor: theme.card, marginBottom: spacing }]}>
          <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>Target Progress</Text>
          <View style={[styles.progressBar, { backgroundColor: theme.background }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(100, monthlyProgress)}%`,
                  backgroundColor: monthlyProgress >= 100 ? theme.chartGreen : theme.primary,
                }
              ]} 
            />
          </View>
          <View style={styles.progressStats}>
            <Text style={[styles.progressText, { color: theme.text }]}>
              {totalHours.toFixed(1)}h / {monthlyTarget}h
            </Text>
            <Text style={[styles.progressPercent, { color: theme.primary }]}>
              {monthlyProgressText}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, marginBottom: spacing }]}>
          <View style={styles.goalRow}>
            <IconSymbol
              ios_icon_name="target"
              android_material_icon_name="track-changes"
              size={24}
              color={theme.chartOrange}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalValue, { color: theme.text }]}>
                {remainingHoursText}h
              </Text>
              <Text style={[styles.goalSubtext, { color: theme.textSecondary }]}>
                Remaining to Target
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, marginBottom: spacing }]}>
          <View style={styles.goalRow}>
            <IconSymbol
              ios_icon_name="speedometer"
              android_material_icon_name="speed"
              size={24}
              color={theme.chartBlue}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalValue, { color: theme.text }]}>
                {requiredPaceText}h/day
              </Text>
              <Text style={[styles.goalSubtext, { color: theme.textSecondary }]}>
                Required Pace
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.goalRow}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={24}
              color={theme.chartYellow}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalValue, { color: theme.text, fontSize: 16 }]}>
                {bestDayText}
              </Text>
              <Text style={[styles.goalSubtext, { color: theme.textSecondary }]}>
                Best Day This Period
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return renderOverview();
      case 'jobMix':
        return renderJobMix();
      case 'efficiency':
        return renderEfficiency();
      case 'repeats':
        return renderRepeats();
      case 'trends':
        return renderTrends();
      case 'goals':
        return renderGoals();
      default:
        return renderOverview();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
        <View>
          <Text style={[styles.title, { color: theme.text, fontSize: titleFontSize }]}>Insights</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary, fontSize: subtitleFontSize }]}>
            {getDateRangeLabel()}
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

      {/* Sub-tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.subTabsScroll}
        contentContainerStyle={{ paddingHorizontal: padding }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: 'dashboard' },
          { id: 'jobMix', label: 'Job Mix', icon: 'pie-chart' },
          { id: 'efficiency', label: 'Efficiency', icon: 'speed' },
          { id: 'repeats', label: 'Repeats', icon: 'replay' },
          { id: 'trends', label: 'Trends', icon: 'trending-up' },
          { id: 'goals', label: 'Goals', icon: 'flag' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.subTab,
              { 
                backgroundColor: activeSubTab === tab.id ? theme.primary : theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => setActiveSubTab(tab.id as SubTab)}
          >
            <IconSymbol
              ios_icon_name="chart.bar"
              android_material_icon_name={tab.icon}
              size={18}
              color={activeSubTab === tab.id ? '#ffffff' : theme.text}
            />
            <Text 
              style={[
                styles.subTabText, 
                { color: activeSubTab === tab.id ? '#ffffff' : theme.text }
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { padding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {renderSubTabContent()}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Drilldown Modal */}
      <Modal
        visible={showDrilldown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDrilldown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.drilldownModal, { backgroundColor: theme.card }]}>
            <View style={styles.drilldownHeader}>
              <Text style={[styles.drilldownTitle, { color: theme.text }]}>{drilldownTitle}</Text>
              <TouchableOpacity onPress={() => setShowDrilldown(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.sortRow}>
              <Text style={[styles.sortLabel, { color: theme.textSecondary }]}>Sort by:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  { id: 'newest', label: 'Newest' },
                  { id: 'highestAw', label: 'Highest AW' },
                  { id: 'regRepeats', label: 'Reg Repeats' },
                  { id: 'mostNotes', label: 'Most Notes' },
                ].map((sort) => (
                  <TouchableOpacity
                    key={sort.id}
                    style={[
                      styles.sortChip,
                      { 
                        backgroundColor: drilldownSort === sort.id ? theme.primary : theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setDrilldownSort(sort.id as DrilldownSort)}
                  >
                    <Text 
                      style={[
                        styles.sortChipText, 
                        { color: drilldownSort === sort.id ? '#ffffff' : theme.text }
                      ]}
                    >
                      {sort.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <FlatList
              data={getSortedDrilldownJobs()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const awText = `${item.aw} AW`;
                const timeText = formatTime(item.aw * 5);
                const dateText = new Date(item.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                
                return (
                  <View style={[styles.drilldownJobCard, { backgroundColor: theme.background }]}>
                    <View style={styles.drilldownJobHeader}>
                      <Text style={[styles.drilldownJobWip, { color: theme.primary }]}>
                        WIP: {item.wipNumber}
                      </Text>
                      <Text style={[styles.drilldownJobReg, { color: theme.text }]}>
                        {item.vehicleReg}
                      </Text>
                    </View>
                    <View style={styles.drilldownJobStats}>
                      <Text style={[styles.drilldownJobAw, { color: theme.text }]}>
                        {awText}
                      </Text>
                      <Text style={[styles.drilldownJobTime, { color: theme.textSecondary }]}>
                        {timeText}
                      </Text>
                      <Text style={[styles.drilldownJobDate, { color: theme.textSecondary }]}>
                        {dateText}
                      </Text>
                    </View>
                    {item.notes && (
                      <Text 
                        style={[styles.drilldownJobNotes, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {item.notes}
                      </Text>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyDrilldown}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No jobs found
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
  subTabsScroll: {
    maxHeight: 60,
    marginBottom: 8,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    gap: 6,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  controlsRow: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsScroll: {
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  shiftFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftFilterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  shiftFilterText: {
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  drillButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  drillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    minWidth: '48%',
  },
  drillButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
    textAlign: 'center',
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
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  efficiencyValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  efficiencyLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  goalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  goalSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  drilldownModal: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  drilldownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  drilldownTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  drilldownJobCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  drilldownJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  drilldownJobWip: {
    fontSize: 14,
    fontWeight: '600',
  },
  drilldownJobReg: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  drilldownJobStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  drilldownJobAw: {
    fontSize: 13,
    fontWeight: '600',
  },
  drilldownJobTime: {
    fontSize: 13,
  },
  drilldownJobDate: {
    fontSize: 13,
  },
  drilldownJobNotes: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyDrilldown: {
    padding: 32,
    alignItems: 'center',
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
