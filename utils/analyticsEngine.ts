
import { api } from './api';
import { offlineStorage } from './offlineStorage';
import { calcDailyHoursFromSchedule, countWorkingDaysInMonth } from './jobCalculations';

export interface TodayAnalytics {
  date: string;
  soldHours: number;
  targetHours: number;
  availableHours: number;
  jobCount: number;
  totalAw: number;
  efficiency: number;
  shiftProgress: number;
  expectedSoldHoursNow: number;
  paceDifference: number;
  forecastSoldHours: number;
  absenceHours: number;
  absenceType: string | null;
  isWorkingDay: boolean;
  shiftStartTime: string;
  shiftEndTime: string;
  elapsedMinutes: number;
  remainingMinutes: number;
}

export interface WeekAnalytics {
  soldHours: number;
  jobCount: number;
  totalAw: number;
  availableHours: number;
  efficiency: number;
  workingDaysElapsed: number;
  dailyAverage: number;
}

export interface MonthAnalytics {
  month: string;
  soldHours: number;
  targetHours: number;
  availableHours: number;
  efficiency: number;
  jobCount: number;
  totalAw: number;
  remainingHours: number;
  remainingWorkingDays: number;
  requiredDailyAverage: number;
  forecast: number;
  forecastConfidence: 'high' | 'medium' | 'low' | 'insufficient';
  absenceCount: number;
  absenceTotalHours: number;
}

export interface RecentPerformance {
  dailyAverages: number[];
  medianDaily: number;
  bestDay: number;
  worstDay: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface FullAnalytics {
  today: TodayAnalytics;
  week: WeekAnalytics;
  month: MonthAnalytics;
  recent: RecentPerformance;
  generatedAt: string;
}

export interface ScenarioInput {
  extraSoldHoursToday?: number;
  futureAbsenceDays?: number;
  futureAbsenceType?: 'full_day' | 'half_day';
  additionalOvertimeHours?: number;
  targetEfficiency?: number;
}

export interface ScenarioResult {
  projectedMonthSoldHours: number;
  projectedEfficiency: number;
  targetGap: number;
  requiredDailyAverage: number;
  onTrack: boolean;
  description: string;
}

export async function buildFullAnalytics(): Promise<FullAnalytics> {
  console.log('[analyticsEngine] buildFullAnalytics: starting');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const month = todayStr.slice(0, 7);

  const [schedule, todayJobs, weekJobs, monthlyStats, absences] = await Promise.all([
    offlineStorage.getSchedule(),
    api.getTodayJobs(),
    api.getWeekJobs(),
    api.getMonthlyStats(month),
    offlineStorage.getAbsences(month),
  ]);

  console.log('[analyticsEngine] buildFullAnalytics: data loaded', {
    todayJobs: todayJobs.length,
    weekJobs: weekJobs.length,
    absences: absences.length,
  });

  // --- TODAY ---
  const dailyHours = calcDailyHoursFromSchedule(
    schedule.startTime || '07:00',
    schedule.endTime || '18:00',
    schedule.lunchStartTime || '12:00',
    schedule.lunchEndTime || '12:30'
  );

  const todayAbsence = absences.find(a => a.absenceDate === todayStr);
  const todayAbsenceHours = todayAbsence?.absenceHours ?? (todayAbsence?.isHalfDay ? dailyHours / 2 : todayAbsence ? dailyHours : 0);
  const todayAvailableHours = Math.max(0, dailyHours - todayAbsenceHours);

  const todayAw = todayJobs.reduce((s, j) => s + j.aw, 0);
  const todaySoldHours = (todayAw * 5) / 60;
  const todayEfficiency = todayAvailableHours > 0 ? (todaySoldHours / todayAvailableHours) * 100 : 0;

  const [startH, startM] = (schedule.startTime || '07:00').split(':').map(Number);
  const [endH, endM] = (schedule.endTime || '18:00').split(':').map(Number);
  const lunchMins = schedule.lunchBreakMinutes ?? 30;
  const shiftStartMins = startH * 60 + startM;
  const shiftEndMins = endH * 60 + endM;
  const totalShiftMins = shiftEndMins - shiftStartMins - lunchMins;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const elapsedMins = Math.max(0, Math.min(totalShiftMins, nowMins - shiftStartMins));
  const shiftProgress = totalShiftMins > 0 ? elapsedMins / totalShiftMins : 0;
  const expectedSoldHoursNow = todayAvailableHours * shiftProgress;
  const paceDifference = todaySoldHours - expectedSoldHoursNow;
  const forecastSoldHours = shiftProgress > 0.05 ? todaySoldHours / shiftProgress : todaySoldHours;

  const dayOfWeek = now.getDay();
  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const isWorkingDay = workingDays.includes(dayOfWeek);

  const today: TodayAnalytics = {
    date: todayStr,
    soldHours: Math.round(todaySoldHours * 100) / 100,
    targetHours: Math.round(todayAvailableHours * 100) / 100,
    availableHours: Math.round(todayAvailableHours * 100) / 100,
    jobCount: todayJobs.length,
    totalAw: todayAw,
    efficiency: Math.round(todayEfficiency * 10) / 10,
    shiftProgress: Math.round(shiftProgress * 1000) / 1000,
    expectedSoldHoursNow: Math.round(expectedSoldHoursNow * 100) / 100,
    paceDifference: Math.round(paceDifference * 100) / 100,
    forecastSoldHours: Math.round(forecastSoldHours * 100) / 100,
    absenceHours: todayAbsenceHours,
    absenceType: todayAbsence?.absenceType ?? null,
    isWorkingDay,
    shiftStartTime: schedule.startTime || '07:00',
    shiftEndTime: schedule.endTime || '18:00',
    elapsedMinutes: Math.round(elapsedMins),
    remainingMinutes: Math.round(Math.max(0, totalShiftMins - elapsedMins)),
  };

  // --- WEEK ---
  const weekAw = weekJobs.reduce((s, j) => s + j.aw, 0);
  const weekSoldHours = (weekAw * 5) / 60;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  let weekWorkingDaysElapsed = 0;
  for (let d = new Date(weekStart); d <= now; d.setDate(d.getDate() + 1)) {
    if (workingDays.includes(d.getDay())) weekWorkingDaysElapsed++;
  }
  const weekAvailableHours = weekWorkingDaysElapsed * dailyHours;
  const weekEfficiency = weekAvailableHours > 0 ? (weekSoldHours / weekAvailableHours) * 100 : 0;

  const week: WeekAnalytics = {
    soldHours: Math.round(weekSoldHours * 100) / 100,
    jobCount: weekJobs.length,
    totalAw: weekAw,
    availableHours: Math.round(weekAvailableHours * 100) / 100,
    efficiency: Math.round(weekEfficiency * 10) / 10,
    workingDaysElapsed: weekWorkingDaysElapsed,
    dailyAverage: weekWorkingDaysElapsed > 0 ? Math.round((weekSoldHours / weekWorkingDaysElapsed) * 100) / 100 : 0,
  };

  // --- MONTH ---
  const [year, monthNum] = month.split('-').map(Number);
  const totalWorkingDays = countWorkingDaysInMonth(year, monthNum, workingDays, undefined, schedule);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  let remainingWorkingDays = 0;
  const lastDay = new Date(year, monthNum, 0);
  for (let d = new Date(tomorrow); d <= lastDay; d.setDate(d.getDate() + 1)) {
    if (workingDays.includes(d.getDay())) remainingWorkingDays++;
  }

  const remainingHours = Math.max(0, monthlyStats.targetHours - monthlyStats.soldHours);
  const requiredDailyAverage = remainingWorkingDays > 0 ? remainingHours / remainingWorkingDays : 0;

  const allJobs = await offlineStorage.getAllJobs();
  const recentDays: number[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (!workingDays.includes(d.getDay())) continue;
    const dStr = d.toISOString().split('T')[0];
    const dayJobs = allJobs.filter(j => j.createdAt.startsWith(dStr));
    if (dayJobs.length > 0) {
      const dayAw = dayJobs.reduce((s, j) => s + j.aw, 0);
      recentDays.push((dayAw * 5) / 60);
      if (recentDays.length >= 5) break;
    }
  }

  const medianDaily = recentDays.length > 0
    ? [...recentDays].sort((a, b) => a - b)[Math.floor(recentDays.length / 2)]
    : dailyHours * 0.8;

  const forecast = monthlyStats.soldHours + (medianDaily * remainingWorkingDays);
  const forecastConfidence: 'high' | 'medium' | 'low' | 'insufficient' =
    recentDays.length >= 5 ? 'high' :
    recentDays.length >= 3 ? 'medium' :
    recentDays.length >= 1 ? 'low' : 'insufficient';

  const absenceCount = absences.length;
  const absenceTotalHours = absences.reduce((s, a) => s + (a.absenceHours ?? (a.isHalfDay ? dailyHours / 2 : dailyHours)), 0);

  const month_analytics: MonthAnalytics = {
    month,
    soldHours: Math.round(monthlyStats.soldHours * 100) / 100,
    targetHours: Math.round(monthlyStats.targetHours * 100) / 100,
    availableHours: Math.round(monthlyStats.availableHours * 100) / 100,
    efficiency: Math.round(monthlyStats.efficiency * 10) / 10,
    jobCount: monthlyStats.totalJobs,
    totalAw: monthlyStats.totalAw,
    remainingHours: Math.round(remainingHours * 100) / 100,
    remainingWorkingDays,
    requiredDailyAverage: Math.round(requiredDailyAverage * 100) / 100,
    forecast: Math.round(forecast * 100) / 100,
    forecastConfidence,
    absenceCount,
    absenceTotalHours: Math.round(absenceTotalHours * 100) / 100,
  };

  // --- RECENT PERFORMANCE ---
  const sortedRecent = [...recentDays].sort((a, b) => a - b);
  const trend: 'improving' | 'stable' | 'declining' =
    recentDays.length >= 3
      ? recentDays[0] > recentDays[recentDays.length - 1] * 1.1 ? 'improving'
      : recentDays[0] < recentDays[recentDays.length - 1] * 0.9 ? 'declining'
      : 'stable'
    : 'stable';

  const recent: RecentPerformance = {
    dailyAverages: recentDays.map(h => Math.round(h * 100) / 100),
    medianDaily: Math.round(medianDaily * 100) / 100,
    bestDay: sortedRecent.length > 0 ? Math.round(sortedRecent[sortedRecent.length - 1] * 100) / 100 : 0,
    worstDay: sortedRecent.length > 0 ? Math.round(sortedRecent[0] * 100) / 100 : 0,
    trend,
  };

  console.log('[analyticsEngine] buildFullAnalytics: complete', {
    todaySoldHours: today.soldHours,
    monthForecast: month_analytics.forecast,
    forecastConfidence: month_analytics.forecastConfidence,
  });

  return {
    today,
    week,
    month: month_analytics,
    recent,
    generatedAt: now.toISOString(),
  };
}

export function buildAIPayload(
  analytics: FullAnalytics,
  question: string,
  period: string,
  conversationContext?: string
) {
  console.log('[analyticsEngine] buildAIPayload: building payload for question:', question, 'period:', period);
  return {
    question,
    period,
    conversationContext,
    analytics: {
      todaySoldHours: analytics.today.soldHours,
      todayTargetHours: analytics.today.targetHours,
      todayAvailableHours: analytics.today.availableHours,
      todayJobCount: analytics.today.jobCount,
      todayTotalAw: analytics.today.totalAw,
      todayEfficiency: analytics.today.efficiency,
      todayShiftProgress: analytics.today.shiftProgress,
      todayExpectedSoldHours: analytics.today.expectedSoldHoursNow,
      todayPaceDifference: analytics.today.paceDifference,
      todayForecast: analytics.today.forecastSoldHours,
      todayAbsenceHours: analytics.today.absenceHours,
      todayAbsenceType: analytics.today.absenceType,
      weekSoldHours: analytics.week.soldHours,
      weekJobCount: analytics.week.jobCount,
      weekTotalAw: analytics.week.totalAw,
      weekAvailableHours: analytics.week.availableHours,
      weekEfficiency: analytics.week.efficiency,
      monthSoldHours: analytics.month.soldHours,
      monthTargetHours: analytics.month.targetHours,
      monthAvailableHours: analytics.month.availableHours,
      monthEfficiency: analytics.month.efficiency,
      monthJobCount: analytics.month.jobCount,
      monthTotalAw: analytics.month.totalAw,
      monthRemainingHours: analytics.month.remainingHours,
      monthRemainingWorkingDays: analytics.month.remainingWorkingDays,
      monthRequiredDailyAverage: analytics.month.requiredDailyAverage,
      monthForecast: analytics.month.forecast,
      monthForecastConfidence: analytics.month.forecastConfidence,
      scheduleDailyHours: analytics.today.availableHours,
      recentDailyAverages: analytics.recent.dailyAverages,
      recentMedianDaily: analytics.recent.medianDaily,
      absenceCount: analytics.month.absenceCount,
      absenceTotalHours: analytics.month.absenceTotalHours,
    },
  };
}

export function runScenario(analytics: FullAnalytics, scenario: ScenarioInput): ScenarioResult {
  console.log('[analyticsEngine] runScenario:', scenario);
  const { month } = analytics;
  let projectedSold = month.soldHours + (scenario.extraSoldHoursToday ?? 0);
  let remainingDays = month.remainingWorkingDays - (scenario.futureAbsenceDays ?? 0);
  remainingDays = Math.max(0, remainingDays);

  const rate = analytics.recent.medianDaily || (month.soldHours / Math.max(1, month.remainingWorkingDays));
  projectedSold += rate * remainingDays;

  if (scenario.additionalOvertimeHours) {
    projectedSold += scenario.additionalOvertimeHours;
  }

  const totalAvailable = month.availableHours;
  const projectedEfficiency = totalAvailable > 0 ? (projectedSold / totalAvailable) * 100 : 0;
  const targetGap = month.targetHours - projectedSold;
  const requiredDailyAverage = remainingDays > 0 ? Math.max(0, targetGap) / remainingDays : 0;
  const onTrack = targetGap <= 0;

  return {
    projectedMonthSoldHours: Math.round(projectedSold * 100) / 100,
    projectedEfficiency: Math.round(projectedEfficiency * 10) / 10,
    targetGap: Math.round(targetGap * 100) / 100,
    requiredDailyAverage: Math.round(requiredDailyAverage * 100) / 100,
    onTrack,
    description: onTrack
      ? `On track to exceed target by ${Math.abs(targetGap).toFixed(1)}h`
      : `${targetGap.toFixed(1)}h short of target — need ${requiredDailyAverage.toFixed(1)}h/day`,
  };
}
