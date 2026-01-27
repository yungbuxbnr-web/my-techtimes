import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function parseMonthString(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split('-').map(Number);
  return { year, month: month - 1 };
}

function getWeekdaysInMonth(year: number, month: number, includeSaturday: boolean = false): number {
  let workingDays = 0;
  const date = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && (includeSaturday || dayOfWeek !== 6)) {
      workingDays++;
    }
  }
  return workingDays;
}

function getEfficiencyLabel(efficiency: number | null): string {
  if (efficiency === null || efficiency === undefined) return 'N/A';
  if (efficiency >= 65) return 'Excellent';
  if (efficiency >= 31) return 'Good';
  return 'Poor';
}

async function getScheduleSettings(app: App): Promise<{ dailyWorkingHours: number; saturdayWorking: boolean }> {
  const schedules = await app.db.select().from(schema.schedule).limit(1);
  if (schedules.length === 0) {
    return { dailyWorkingHours: 8.5, saturdayWorking: false };
  }
  const sched = schedules[0];
  return {
    dailyWorkingHours: parseFloat(sched.dailyWorkingHours.toString()),
    saturdayWorking: sched.saturdayWorking,
  };
}

export function registerDashboardRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/dashboard - Combined dashboard data
  fastify.get<{ Querystring: { month: string; targetHours?: string } }>(
    '/api/dashboard',
    {
      schema: {
        description: 'Get dashboard data',
        tags: ['dashboard'],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string' },
            targetHours: { type: 'string' },
          },
          required: ['month'],
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month, targetHours: targetHoursStr } = request.query;
      const targetHours = targetHoursStr ? parseFloat(targetHoursStr) : 180;

      app.logger.info({ month, targetHours }, 'Fetching dashboard data');

      try {
        // Get technician profile
        const profiles = await app.db.select().from(schema.technicianProfile).limit(1);
        const profile = profiles.length > 0
          ? { name: profiles[0].name }
          : { name: 'Technician' };

        // Get schedule settings
        const { dailyWorkingHours, saturdayWorking } = await getScheduleSettings(app);

        // Parse month
        const { year, month: monthNum } = parseMonthString(month);
        const monthStartDate = new Date(year, monthNum, 1);
        const monthEndDate = new Date(year, monthNum + 1, 1);

        // Get today's boundaries
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get week boundaries
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        // Get all jobs for month
        const monthJobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, monthStartDate), lte(schema.jobs.createdAt, monthEndDate)));

        // Get jobs for today
        const todayJobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, today), lte(schema.jobs.createdAt, tomorrow)));

        // Get jobs for week
        const weekJobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startOfWeek), lte(schema.jobs.createdAt, endOfWeek)));

        // Get absences for month
        const monthStartStr = monthStartDate.toISOString().split('T')[0];
        const monthEndStr = monthEndDate.toISOString().split('T')[0];
        const monthAbsences = await app.db
          .select()
          .from(schema.absences)
          .where(and(gte(schema.absences.absenceDate, monthStartStr), lte(schema.absences.absenceDate, monthEndStr)));

        // Calculate metrics helper
        function calculateJobMetrics(jobs: any[]): { jobCount: number; totalAw: number; totalTime: number } {
          const jobCount = jobs.length;
          const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
          const totalTime = Math.round((totalAw * 5 / 60) * 100) / 100;
          return { jobCount, totalAw: Math.round(totalAw * 100) / 100, totalTime };
        }

        const todayStats = calculateJobMetrics(todayJobs);
        const weekStats = calculateJobMetrics(weekJobs);
        const monthStats = calculateJobMetrics(monthJobs);

        // Calculate monthly efficiency
        const weekdaysCount = getWeekdaysInMonth(year, monthNum, saturdayWorking);
        const availableHours = Math.round((weekdaysCount * dailyWorkingHours) * 100) / 100;

        let absenceHoursFromAvailable = 0;
        let absenceHoursFromTarget = 0;

        for (const absence of monthAbsences) {
          let hoursDeducted = 0;

          if (absence.customHours) {
            hoursDeducted = parseFloat(absence.customHours.toString());
          } else if (absence.daysCount) {
            const days = parseFloat(absence.daysCount.toString());
            const multiplier = absence.isHalfDay ? 0.5 : 1.0;
            hoursDeducted = days * dailyWorkingHours * multiplier;
          }

          if (absence.deductionType === 'AVAILABLE_HOURS') {
            absenceHoursFromAvailable += hoursDeducted;
          } else {
            absenceHoursFromTarget += hoursDeducted;
          }
        }

        const effectiveAvailableHours = Math.round((availableHours - absenceHoursFromAvailable) * 100) / 100;
        const efficiency = effectiveAvailableHours > 0
          ? Math.round((monthStats.totalTime / effectiveAvailableHours) * 100)
          : null;
        const adjustedTargetHours = Math.round((targetHours - absenceHoursFromTarget) * 100) / 100;
        const remainingHours = Math.round((adjustedTargetHours - monthStats.totalTime) * 100) / 100;

        const dashboard = {
          profile,
          monthlyStats: {
            soldHours: monthStats.totalTime,
            targetHours,
            adjustedTargetHours,
            efficiency,
            efficiencyLabel: getEfficiencyLabel(efficiency),
            availableHours,
            totalAw: monthStats.totalAw,
            remainingHours,
          },
          todayStats,
          weekStats,
          breakdown: {
            totalAw: monthStats.totalAw,
            soldHours: monthStats.totalTime,
            targetHours,
            availableHours,
            efficiency,
          },
        };

        app.logger.info({ month }, 'Dashboard data calculated');
        return dashboard;
      } catch (error) {
        app.logger.error({ err: error, month }, 'Failed to fetch dashboard data');
        throw error;
      }
    }
  );
}
