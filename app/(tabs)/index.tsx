
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { formatTime, formatDecimalHours } from '@/utils/jobCalculations';
import { api } from '@/utils/api';
import CircularProgress from '@/components/CircularProgress';
import AppBackground from '@/components/AppBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen() {
  const { theme } = useThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [technicianName, setTechnicianName] = useState('Buckston Rugge');
  
  // Monthly stats
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [todayStats, setTodayStats] = useState<any>(null);
  const [weekStats, setWeekStats] = useState<any>(null);
  
  // Calendar data
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dailyHours, setDailyHours] = useState(8.5);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      console.log('DashboardScreen: Fetching stats from API');
      const currentMonth = getCurrentMonth();
      const [monthly, today, week, profile, schedule] = await Promise.all([
        api.getMonthlyStats(currentMonth),
        api.getTodayStats(),
        api.getWeekStats(),
        api.getTechnicianProfile().catch(() => ({ name: 'Buckston Rugge' })),
        api.getSchedule(),
      ]);

      setMonthlyStats(monthly);
      setTodayStats(today);
      setWeekStats(week);
      setTechnicianName(profile.name);
      setWorkingDays(schedule.workingDays || [1, 2, 3, 4, 5]);
      setDailyHours(schedule.dailyWorkingHours || 8.5);
      
      await loadCalendarData(schedule);
      
      console.log('DashboardScreen: Stats loaded successfully');
    } catch (error) {
      console.error('DashboardScreen: Error loading dashboard data:', error);
    }
  }, [selectedMonth]);

  const loadCalendarData = async (schedule: any) => {
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startStr = firstDay.toISOString().split('T')[0];
      const endStr = lastDay.toISOString().split('T')[0];
      
      const jobs = await api.getJobsInRange(startStr, endStr);
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const absences = await api.getAbsences(monthStr);
      
      // Group jobs by day
      const jobsByDay = new Map<string, any[]>();
      jobs.forEach(job => {
        const day = job.createdAt.split('T')[0];
        if (!jobsByDay.has(day)) {
          jobsByDay.set(day, []);
        }
        jobsByDay.get(day)!.push(job);
      });
      
      // Generate calendar days
      const days: any[] = [];
      const currentDay = new Date(firstDay);
      
      while (currentDay <= lastDay) {
        const dateStr = currentDay.toISOString().split('T')[0];
        const dayJobs = jobsByDay.get(dateStr) || [];
        const dayOfWeek = currentDay.getDay();
        const isWorkingDay = schedule.workingDays.includes(dayOfWeek);
        
        // Check for absence
        const absence = absences.find(a => a.absenceDate === dateStr);
        
        // Check for overtime/compensation
        const overtimeAbsence = absences.find(a => 
          a.absenceDate === dateStr && 
          (a.absenceType === 'overtime' || a.absenceType === 'compensation')
        );
        
        const availableHours = isWorkingDay ? schedule.dailyWorkingHours : 0;
        const totalAw = dayJobs.reduce((sum, job) => sum + job.aw, 0);
        const soldHours = (totalAw * 5) / 60;
        const efficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
        
        days.push({
          date: new Date(currentDay),
          dateString: dateStr,
          isWorkingDay,
          jobs: dayJobs,
          efficiency: Math.min(efficiency, 100),
          soldHours,
          availableHours,
          hasAbsence: !!absence,
          absenceType: absence?.absenceType,
          isOvertime: overtimeAbsence?.absenceType === 'overtime',
          isCompensation: overtimeAbsence?.absenceType === 'compensation',
        });
        
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      setCalendarDays(days);
    } catch (error) {
      console.error('DashboardScreen: Error loading calendar data:', error);
    }
  };

  useEffect(() => {
    console.log('DashboardScreen: Loading dashboard data');
    loadDashboardData();
    
    // Update timer every second and reload stats every 30 seconds for live updates
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    const statsRefresh = setInterval(() => {
      console.log('DashboardScreen: Auto-refreshing stats for live updates');
      loadDashboardData();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(timer);
      clearInterval(statsRefresh);
    };
  }, [loadDashboardData]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const onRefresh = async () => {
    console.log('DashboardScreen: User refreshing dashboard');
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 65) return theme.chartGreen;
    if (efficiency >= 31) return theme.chartYellow;
    return theme.chartRed;
  };

  const getEfficiencyLabel = (efficiency: number) => {
    if (efficiency >= 65) return 'Excellent';
    if (efficiency >= 31) return 'Good';
    return 'Poor';
  };

  const formatTimer = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
  };

  const handleDayPress = (dayInfo: any) => {
    console.log('DashboardScreen: User tapped day:', dayInfo.dateString);
    setSelectedDay(dayInfo);
    setShowDayModal(true);
  };

  const handleMarkOvertimeCompensation = async (type: 'overtime' | 'compensation') => {
    if (!selectedDay) return;
    
    try {
      const monthStr = `${selectedDay.date.getFullYear()}-${String(selectedDay.date.getMonth() + 1).padStart(2, '0')}`;
      
      await api.createAbsence({
        month: monthStr,
        absenceDate: selectedDay.dateString,
        daysCount: 1,
        deductionType: 'available',
        absenceType: type,
        note: `${type === 'overtime' ? 'Overtime' : 'Compensation'} day`,
      });
      
      console.log('DashboardScreen: Marked day as', type);
      setShowDayModal(false);
      await loadDashboardData();
    } catch (error) {
      console.error('DashboardScreen: Error marking day:', error);
      Alert.alert('Error', 'Failed to mark day');
    }
  };

  if (!monthlyStats || !todayStats || !weekStats) {
    return (
      <AppBackground>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </AppBackground>
    );
  }

  const targetProgress = (monthlyStats.soldHours / monthlyStats.targetHours) * 100;
  const efficiencyColor = getEfficiencyColor(monthlyStats.efficiency);
  const efficiencyLabel = getEfficiencyLabel(monthlyStats.efficiency);

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 48 }]}>
          <View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Technician Records</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{technicianName}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <IconSymbol
                ios_icon_name="gear.fill"
                android_material_icon_name="settings"
                size={24}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Timer Card */}
        <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.timerText, { color: theme.primary }]}>
            {formatTimer(currentTime)}
          </Text>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {formatDate(currentTime)}
          </Text>
        </View>

        {/* Progress Rings */}
        <View style={styles.ringsContainer}>
          <View style={styles.ringWrapper}>
            <CircularProgress
              size={140}
              strokeWidth={10}
              progress={targetProgress}
              color={theme.primary}
              title="Monthly Target"
              value={`${targetProgress.toFixed(1)}%`}
              subtitle={`${monthlyStats.soldHours.toFixed(1)}h / ${monthlyStats.targetHours.toFixed(1)}h`}
              onPress={() => {
                console.log('DashboardScreen: User tapped Target ring');
                router.push(`/target-details?month=${getCurrentMonth()}`);
              }}
            />
            <Text style={[styles.ringLabel, { color: theme.textSecondary }]}>
              {targetProgress.toFixed(0)}% Complete
            </Text>
          </View>

          <View style={styles.ringWrapper}>
            <CircularProgress
              size={140}
              strokeWidth={10}
              progress={monthlyStats.efficiency}
              color={efficiencyColor}
              title="Efficiency"
              value={`${monthlyStats.efficiency.toFixed(0)}%`}
              subtitle={efficiencyLabel}
              onPress={() => {
                console.log('DashboardScreen: User tapped Efficiency ring');
                router.push(`/efficiency-details?month=${getCurrentMonth()}`);
              }}
            />
            <Text style={[styles.ringLabel, { color: efficiencyColor }]}>
              {efficiencyLabel}
            </Text>
            <Text style={[styles.ringSubLabel, { color: theme.textSecondary }]}>
              {monthlyStats.availableHours.toFixed(1)}h available
            </Text>
          </View>
        </View>

        {/* Calendar Button */}
        <TouchableOpacity
          style={[styles.calendarButton, { backgroundColor: theme.card }]}
          onPress={() => {
            console.log('DashboardScreen: User tapped Calendar button - navigating to Performance Calendar');
            router.push('/calendar');
          }}
        >
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar-today"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.calendarButtonText, { color: theme.text }]}>Performance Calendar</Text>
        </TouchableOpacity>

        {/* Monthly Breakdown */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Monthly Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total AW:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.totalAw}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Sold Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.soldHours.toFixed(2)}h</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Monthly Target Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.targetHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total Available Hours:</Text>
            <Text style={[styles.breakdownValue, { color: theme.text }]}>{monthlyStats.availableHours.toFixed(2)}h</Text>
          </View>
          <View style={[styles.breakdownRow, styles.breakdownHighlight]}>
            <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Efficiency:</Text>
            <Text style={[styles.breakdownValue, { color: efficiencyColor, fontWeight: 'bold' }]}>
              {monthlyStats.efficiency.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Stat Tiles */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Total AWs tile');
              router.push(`/total-aws-details?month=${getCurrentMonth()}`);
            }}
          >
            <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalAw}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total AWs</Text>
            <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Time Logged tile');
              router.push(`/time-logged-details?month=${getCurrentMonth()}`);
            }}
          >
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {formatTime(monthlyStats.totalAw * 5)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time Logged</Text>
            <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Jobs Done tile');
              router.push(`/jobs-done-details?month=${getCurrentMonth()}`);
            }}
          >
            <Text style={[styles.statValue, { color: theme.primary }]}>{monthlyStats.totalJobs}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</Text>
            <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Hours Remaining tile');
              router.push(`/hours-remaining-details?month=${getCurrentMonth()}`);
            }}
          >
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {monthlyStats.remainingHours.toFixed(1)}h
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Hours Remaining</Text>
            <Text style={[styles.statSubLabel, { color: theme.textSecondary }]}>To Target</Text>
          </TouchableOpacity>
        </View>

        {/* Today Card */}
        <TouchableOpacity
          style={[styles.periodCard, { backgroundColor: theme.card }]}
          onPress={() => {
            console.log('DashboardScreen: User tapped Today card');
            router.push('/today-details');
          }}
        >
          <Text style={[styles.periodTitle, { color: theme.text }]}>Today</Text>
          <Text style={[styles.periodSubtitle, { color: theme.textSecondary }]}>
            {todayStats.jobCount} jobs • {todayStats.totalAw} AWs
          </Text>
          <Text style={[styles.periodTime, { color: theme.primary }]}>
            {formatTime(todayStats.totalMinutes)}
          </Text>
        </TouchableOpacity>

        {/* This Week Card */}
        <TouchableOpacity
          style={[styles.periodCard, { backgroundColor: theme.card }]}
          onPress={() => {
            console.log('DashboardScreen: User tapped This Week card');
            router.push('/week-details');
          }}
        >
          <Text style={[styles.periodTitle, { color: theme.text }]}>This Week</Text>
          <Text style={[styles.periodSubtitle, { color: theme.textSecondary }]}>
            {weekStats.jobCount} jobs • {weekStats.totalAw} AWs
          </Text>
          <Text style={[styles.periodTime, { color: theme.primary }]}>
            {formatTime(weekStats.totalMinutes)}
          </Text>
        </TouchableOpacity>

        {/* Add New Job Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            console.log('DashboardScreen: User tapped Add New Job button');
            router.push('/(tabs)/add-job');
          }}
        >
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={24}
            color="#ffffff"
          />
          <Text style={styles.addButtonText}>Add New Job</Text>
        </TouchableOpacity>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Job Records button');
              router.push('/(tabs)/jobs');
            }}
          >
            <Text style={[styles.bottomButtonText, { color: theme.text }]}>Job Records</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: theme.card }]}
            onPress={() => {
              console.log('DashboardScreen: User tapped Statistics button');
              router.push('/(tabs)/stats');
            }}
          >
            <Text style={[styles.bottomButtonText, { color: theme.text }]}>Statistics</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Day Modal */}
      <Modal
        visible={showDayModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            {selectedDay && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {selectedDay.date.toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDayModal(false)}>
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="close"
                      size={28}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                
                {selectedDay.isWorkingDay ? (
                  <View style={styles.modalBody}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Jobs: {selectedDay.jobs.length}</Text>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                      Sold Hours: {selectedDay.soldHours.toFixed(2)}h
                    </Text>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                      Efficiency: {selectedDay.efficiency.toFixed(0)}%
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalBody}>
                    <Text style={[styles.modalInfo, { color: theme.textSecondary }]}>
                      This is not a scheduled working day.
                    </Text>
                    <Text style={[styles.modalInfo, { color: theme.textSecondary }]}>
                      Mark it as overtime or compensation day:
                    </Text>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleMarkOvertimeCompensation('overtime')}
                    >
                      <Text style={styles.modalButtonText}>Mark as Overtime</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.accent }]}
                      onPress={() => handleMarkOvertimeCompensation('compensation')}
                    >
                      <Text style={styles.modalButtonText}>Mark as Compensation Day</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.textSecondary, marginTop: 16 }]}
                  onPress={() => setShowDayModal(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendarModal}
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <AppBackground>
          <View style={[styles.calendarModalContainer, { backgroundColor: 'transparent' }]}>
            <View style={[styles.calendarModalHeader, { backgroundColor: theme.card }]}>
              <Text style={[styles.calendarModalTitle, { color: theme.text }]}>Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={32}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.calendarModalContent}>
              <View style={[styles.calendarSection, { backgroundColor: theme.card }]}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthArrow}>
                    <IconSymbol
                      ios_icon_name="chevron.left"
                      android_material_icon_name="arrow-back"
                      size={24}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                  <View style={styles.monthInfo}>
                    <Text style={[styles.monthText, { color: theme.text }]}>
                      {selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleNextMonth} style={styles.monthArrow}>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={24}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdayHeader}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <Text key={index} style={[styles.weekdayText, { color: theme.textSecondary }]}>
                      {day}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {/* Add empty cells for days before the first of the month */}
                  {Array.from({ length: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() }).map((_, index) => (
                    <View key={`empty-${index}`} style={styles.dayCell} />
                  ))}
                  
                  {calendarDays.map((dayInfo) => {
                    const isToday = dayInfo.dateString === new Date().toISOString().split('T')[0];
                    const efficiencyColor = getEfficiencyColor(dayInfo.efficiency);
                    
                    return (
                      <TouchableOpacity
                        key={dayInfo.dateString}
                        style={[
                          styles.dayCell,
                          !dayInfo.isWorkingDay && !dayInfo.isOvertime && !dayInfo.isCompensation && styles.nonWorkingDay,
                          isToday && { borderWidth: 2, borderColor: theme.primary },
                          (dayInfo.isOvertime || dayInfo.isCompensation) && { backgroundColor: theme.accent },
                        ]}
                        onPress={() => handleDayPress(dayInfo)}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            { color: theme.text },
                            !dayInfo.isWorkingDay && !dayInfo.isOvertime && !dayInfo.isCompensation && { color: theme.textSecondary, opacity: 0.3 },
                          ]}
                        >
                          {dayInfo.date.getDate()}
                        </Text>
                        
                        {(dayInfo.isWorkingDay || dayInfo.isOvertime || dayInfo.isCompensation) && (
                          <View style={styles.dayCircles}>
                            {/* Efficiency circle (outer) */}
                            <View style={[styles.miniCircle, { borderColor: efficiencyColor }]}>
                              <View style={[styles.miniCircleFill, { 
                                backgroundColor: efficiencyColor,
                                height: `${dayInfo.efficiency}%`,
                              }]} />
                            </View>
                            
                            {/* Jobs count */}
                            {dayInfo.jobs.length > 0 && (
                              <Text style={[styles.jobCount, { color: theme.primary }]}>
                                {dayInfo.jobs.length}
                              </Text>
                            )}
                          </View>
                        )}
                        
                        {dayInfo.isOvertime && (
                          <Text style={styles.overtimeLabel}>OT</Text>
                        )}
                        {dayInfo.isCompensation && (
                          <Text style={styles.overtimeLabel}>C</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                <View style={styles.calendarLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: theme.chartGreen }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>≥65% Efficiency</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: theme.chartYellow }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>31-64%</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: theme.chartRed }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>&lt;31%</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </AppBackground>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  dateText: {
    fontSize: 14,
    marginTop: 8,
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  ringWrapper: {
    alignItems: 'center',
  },
  ringLabel: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  ringSubLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarModalContainer: {
    flex: 1,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  calendarModalContent: {
    flex: 1,
    padding: 16,
  },
  calendarSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthArrow: {
    padding: 8,
  },
  monthInfo: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: (SCREEN_WIDTH - 64) / 7,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 8,
  },
  nonWorkingDay: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayCircles: {
    alignItems: 'center',
    gap: 2,
  },
  miniCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  miniCircleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  jobCount: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  overtimeLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 2,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 10,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownHighlight: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    paddingTop: 12,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statSubLabel: {
    fontSize: 10,
  },
  periodCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  periodSubtitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  periodTime: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bottomButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: 14,
  },
  modalInfo: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
