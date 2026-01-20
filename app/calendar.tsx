
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';
import AppBackground from '@/components/AppBackground';
import { api, Job } from '@/utils/api';
import CircularProgress from '@/components/CircularProgress';
import { formatTime } from '@/utils/jobCalculations';

type ViewMode = 'day' | 'week' | 'month' | 'year';

interface DayData {
  date: string;
  jobs: Job[];
  efficiency: number;
  soldHours: number;
  availableHours: number;
  progress: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarScreen() {
  console.log('CalendarScreen: Rendering calendar view');
  const { theme } = useThemeContext();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState(180);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadCalendarData();
  }, [currentDate, viewMode]);

  const loadCalendarData = async () => {
    console.log('CalendarScreen: Loading calendar data for', viewMode, currentDate);
    setLoading(true);
    try {
      const schedule = await api.getSchedule();
      const settings = await api.getSettings();
      setMonthlyTarget(settings.monthlyTarget);
      
      const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
      
      let startDate: Date;
      let endDate: Date;
      
      if (viewMode === 'day') {
        startDate = new Date(currentDate);
        endDate = new Date(currentDate);
      } else if (viewMode === 'week') {
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(currentDate);
        startDate.setDate(diff);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (viewMode === 'month') {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      } else {
        // Year view
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
      }
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      const jobs = await api.getJobsInRange(startStr, endStr);
      
      // Group jobs by day
      const dayMap = new Map<string, DayData>();
      const jobsByDay = new Map<string, Job[]>();
      
      jobs.forEach(job => {
        const day = job.createdAt.split('T')[0];
        if (!jobsByDay.has(day)) {
          jobsByDay.set(day, []);
        }
        jobsByDay.get(day)!.push(job);
      });
      
      // Calculate data for each day
      const currentDay = new Date(startDate);
      while (currentDay <= endDate) {
        const dateStr = currentDay.toISOString().split('T')[0];
        const dayJobs = jobsByDay.get(dateStr) || [];
        
        const dayOfWeek = currentDay.getDay();
        const isWorkingDay = workingDays.includes(dayOfWeek);
        
        const availableHours = isWorkingDay ? schedule.dailyWorkingHours : 0;
        const totalAw = dayJobs.reduce((sum, job) => sum + job.aw, 0);
        const soldHours = (totalAw * 5) / 60; // 1 AW = 5 minutes = 0.0833 hours
        const efficiency = availableHours > 0 ? (soldHours / availableHours) * 100 : 0;
        
        // Progress is sold hours vs daily target (proportional to monthly target)
        const workingDaysPerMonth = workingDays.length * 4.33; // Approximate
        const dailyTarget = settings.monthlyTarget / workingDaysPerMonth;
        const progress = dailyTarget > 0 ? (soldHours / dailyTarget) * 100 : 0;
        
        dayMap.set(dateStr, {
          date: dateStr,
          jobs: dayJobs,
          efficiency: Math.min(efficiency, 100),
          soldHours,
          availableHours,
          progress: Math.min(progress, 100),
        });
        
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      setCalendarData(dayMap);
      console.log('CalendarScreen: Loaded data for', dayMap.size, 'days');
    } catch (error) {
      console.error('CalendarScreen: Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigatePrevious = () => {
    console.log('CalendarScreen: Navigating to previous', viewMode);
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    console.log('CalendarScreen: Navigating to next', viewMode);
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 90) return '#4CAF50';
    if (efficiency >= 75) return '#FFC107';
    return '#F44336';
  };

  const getProgressColor = (): string => {
    return theme.primary;
  };

  const renderDayView = () => {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayData = calendarData.get(dateStr);
    
    if (!dayData) return null;
    
    return (
      <View style={styles.dayViewContainer}>
        <Text style={[styles.dayViewTitle, { color: theme.text }]}>
          {currentDate.toLocaleDateString('en-GB', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}
        </Text>
        
        <View style={styles.circlesRow}>
          <View style={styles.circleContainer}>
            <CircularProgress
              percentage={dayData.efficiency}
              size={140}
              strokeWidth={14}
              color={getEfficiencyColor(dayData.efficiency)}
              backgroundColor={theme.border}
            />
            <Text style={[styles.circleLabel, { color: theme.text }]}>Efficiency</Text>
            <Text style={[styles.circleSubtext, { color: theme.textSecondary }]}>
              {dayData.availableHours.toFixed(1)}h available
            </Text>
          </View>
          
          <View style={styles.circleContainer}>
            <CircularProgress
              percentage={dayData.progress}
              size={140}
              strokeWidth={14}
              color={getProgressColor()}
              backgroundColor={theme.border}
            />
            <Text style={[styles.circleLabel, { color: theme.text }]}>Progress</Text>
            <Text style={[styles.circleSubtext, { color: theme.textSecondary }]}>
              {dayData.soldHours.toFixed(2)}h sold
            </Text>
          </View>
        </View>
        
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>Day Summary</Text>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{dayData.jobs.length}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total AW:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dayData.jobs.reduce((sum, job) => sum + job.aw, 0)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sold Hours:</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {dayData.soldHours.toFixed(2)}h
            </Text>
          </View>
        </View>
        
        {dayData.jobs.length > 0 && (
          <View style={[styles.jobsList, { backgroundColor: theme.card }]}>
            <Text style={[styles.jobsListTitle, { color: theme.text }]}>Jobs</Text>
            {dayData.jobs.map((job, index) => (
              <View key={index} style={[styles.jobItem, { borderBottomColor: theme.border }]}>
                <Text style={[styles.jobWip, { color: theme.text }]}>{job.wipNumber}</Text>
                <Text style={[styles.jobReg, { color: theme.textSecondary }]}>{job.vehicleReg}</Text>
                <Text style={[styles.jobAw, { color: theme.primary }]}>{job.aw} AW</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderWeekView = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(currentDate);
    monday.setDate(diff);
    
    const weekDays: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = calendarData.get(dateStr);
      if (dayData) {
        weekDays.push(dayData);
      }
    }
    
    return (
      <View style={styles.weekViewContainer}>
        <Text style={[styles.weekViewTitle, { color: theme.text }]}>
          Week of {monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
          {weekDays.map((dayData, index) => {
            const date = new Date(dayData.date);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.weekDayCard, { backgroundColor: theme.card }]}
                onPress={() => {
                  setCurrentDate(date);
                  setViewMode('day');
                }}
              >
                <Text style={[styles.weekDayName, { color: theme.textSecondary }]}>
                  {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </Text>
                <Text style={[styles.weekDayDate, { color: theme.text }]}>
                  {date.getDate()}
                </Text>
                
                <View style={styles.weekDayCircles}>
                  <View style={styles.miniCircleContainer}>
                    <CircularProgress
                      percentage={dayData.efficiency}
                      size={50}
                      strokeWidth={5}
                      color={getEfficiencyColor(dayData.efficiency)}
                      backgroundColor={theme.border}
                    />
                  </View>
                  <View style={styles.miniCircleContainer}>
                    <CircularProgress
                      percentage={dayData.progress}
                      size={40}
                      strokeWidth={4}
                      color={getProgressColor()}
                      backgroundColor={theme.border}
                    />
                  </View>
                </View>
                
                <Text style={[styles.weekDayJobs, { color: theme.textSecondary }]}>
                  {dayData.jobs.length} jobs
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // Calculate month totals
    let monthEfficiency = 0;
    let monthProgress = 0;
    let monthSoldHours = 0;
    let monthAvailableHours = 0;
    let workingDays = 0;
    
    Array.from(calendarData.values()).forEach(dayData => {
      if (dayData.availableHours > 0) {
        monthSoldHours += dayData.soldHours;
        monthAvailableHours += dayData.availableHours;
        workingDays++;
      }
    });
    
    monthEfficiency = monthAvailableHours > 0 ? (monthSoldHours / monthAvailableHours) * 100 : 0;
    monthProgress = monthlyTarget > 0 ? (monthSoldHours / monthlyTarget) * 100 : 0;
    
    const days: (DayData | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      days.push(calendarData.get(dateStr) || null);
    }
    
    return (
      <View style={styles.monthViewContainer}>
        <Text style={[styles.monthViewTitle, { color: theme.text }]}>
          {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </Text>
        
        <View style={styles.monthCirclesRow}>
          <View style={styles.monthCircleContainer}>
            <CircularProgress
              percentage={monthEfficiency}
              size={100}
              strokeWidth={10}
              color={getEfficiencyColor(monthEfficiency)}
              backgroundColor={theme.border}
            />
            <Text style={[styles.monthCircleLabel, { color: theme.text }]}>Efficiency</Text>
          </View>
          
          <View style={styles.monthCircleContainer}>
            <CircularProgress
              percentage={monthProgress}
              size={80}
              strokeWidth={8}
              color={getProgressColor()}
              backgroundColor={theme.border}
            />
            <Text style={[styles.monthCircleLabel, { color: theme.text }]}>Progress</Text>
          </View>
        </View>
        
        <View style={styles.weekdayHeader}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
            <Text key={index} style={[styles.weekdayText, { color: theme.textSecondary }]}>
              {day}
            </Text>
          ))}
        </View>
        
        <View style={styles.monthGrid}>
          {days.map((dayData, index) => {
            if (!dayData) {
              return <View key={index} style={styles.emptyDay} />;
            }
            
            const date = new Date(dayData.date);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.monthDay, { backgroundColor: theme.card }]}
                onPress={() => {
                  setCurrentDate(date);
                  setViewMode('day');
                }}
              >
                <Text style={[styles.monthDayNumber, { color: theme.text }]}>
                  {date.getDate()}
                </Text>
                
                <View style={styles.monthDayCircles}>
                  <View style={styles.tinyCircleOuter}>
                    <CircularProgress
                      percentage={dayData.efficiency}
                      size={24}
                      strokeWidth={3}
                      color={getEfficiencyColor(dayData.efficiency)}
                      backgroundColor={theme.border}
                    />
                  </View>
                  <View style={styles.tinyCircleInner}>
                    <CircularProgress
                      percentage={dayData.progress}
                      size={18}
                      strokeWidth={2.5}
                      color={getProgressColor()}
                      backgroundColor={theme.border}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [];
    
    for (let m = 0; m < 12; m++) {
      months.push(m);
    }
    
    return (
      <View style={styles.yearViewContainer}>
        <Text style={[styles.yearViewTitle, { color: theme.text }]}>{year}</Text>
        
        <View style={styles.yearGrid}>
          {months.map((monthIndex) => {
            const monthDate = new Date(year, monthIndex, 1);
            const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            
            return (
              <TouchableOpacity
                key={monthIndex}
                style={[styles.yearMonthCard, { backgroundColor: theme.card }]}
                onPress={() => {
                  setCurrentDate(monthDate);
                  setViewMode('month');
                }}
              >
                <Text style={[styles.yearMonthName, { color: theme.text }]}>
                  {monthDate.toLocaleDateString('en-GB', { month: 'short' })}
                </Text>
                
                <View style={styles.yearMonthCircle}>
                  <CircularProgress
                    percentage={50}
                    size={60}
                    strokeWidth={6}
                    color={theme.primary}
                    backgroundColor={theme.border}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Calendar',
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <AppBackground>
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <View style={styles.viewModeButtons}>
              {(['day', 'week', 'month', 'year'] as ViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.viewModeButton,
                    viewMode === mode && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    console.log('CalendarScreen: Switching to', mode, 'view');
                    setViewMode(mode);
                  }}
                >
                  <Text
                    style={[
                      styles.viewModeText,
                      { color: viewMode === mode ? '#fff' : theme.textSecondary },
                    ]}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.navigation}>
              <TouchableOpacity style={styles.navButton} onPress={navigatePrevious}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="chevron-left"
                  size={28}
                  color={theme.text}
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  console.log('CalendarScreen: Jumping to today');
                  setCurrentDate(new Date());
                }}
              >
                <Text style={[styles.todayText, { color: theme.primary }]}>Today</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.navButton} onPress={navigateNext}>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron-right"
                  size={28}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Loading calendar data...
                </Text>
              </View>
            ) : (
              <>
                {viewMode === 'day' && renderDayView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'year' && renderYearView()}
              </>
            )}
          </ScrollView>
        </View>
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  viewModeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
  },
  todayButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  todayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
  },
  
  // Day View
  dayViewContainer: {
    gap: 20,
  },
  dayViewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  circlesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  circleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  circleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  circleSubtext: {
    fontSize: 12,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobsList: {
    padding: 16,
    borderRadius: 12,
  },
  jobsListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  jobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  jobWip: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  jobReg: {
    fontSize: 14,
    flex: 1,
  },
  jobAw: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Week View
  weekViewContainer: {
    gap: 16,
  },
  weekViewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  weekScroll: {
    marginVertical: 10,
  },
  weekDayCard: {
    width: 120,
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekDayDate: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  weekDayCircles: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  miniCircleContainer: {
    position: 'relative',
  },
  weekDayJobs: {
    fontSize: 12,
  },
  
  // Month View
  monthViewContainer: {
    gap: 16,
  },
  monthViewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  monthCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginVertical: 20,
  },
  monthCircleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  monthCircleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    width: (SCREEN_WIDTH - 48) / 7,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDay: {
    width: (SCREEN_WIDTH - 48) / 7,
    height: 70,
  },
  monthDay: {
    width: (SCREEN_WIDTH - 48) / 7,
    height: 70,
    padding: 4,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthDayNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthDayCircles: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyCircleOuter: {
    position: 'absolute',
  },
  tinyCircleInner: {
    position: 'absolute',
  },
  
  // Year View
  yearViewContainer: {
    gap: 16,
  },
  yearViewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  yearMonthCard: {
    width: (SCREEN_WIDTH - 48) / 3 - 8,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  yearMonthName: {
    fontSize: 14,
    fontWeight: '600',
  },
  yearMonthCircle: {
    marginVertical: 8,
  },
});
