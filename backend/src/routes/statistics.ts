import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function parseMonthString(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split('-').map(Number);
  return { year, month: month - 1 }; // month is 0-indexed for Date
}

function getWeekdaysInMonth(year: number, month: number, includeSaturday: boolean = false): number {
  let workingDays = 0;
  const date = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    // Exclude Sundays (0), always exclude Saturdays (6) unless includeSaturday
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

export function registerStatsRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/stats/all-time - Returns lifetime totals
  fastify.get(
    '/api/stats/all-time',
    {
      schema: {
        description: 'Get all-time stats',
        tags: ['statistics'],
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching all-time stats');

      try {
        const jobs = await app.db.select().from(schema.jobs);

        const totalJobs = jobs.length;
        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const totalHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        app.logger.info({ totalJobs, totalAw, totalHours }, 'All-time stats calculated');

        return {
          totalJobs,
          totalAw: Math.round(totalAw * 100) / 100,
          totalHours,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch all-time stats');
        throw error;
      }
    }
  );

  // GET /api/stats/month - Monthly statistics with efficiency calculation
  fastify.get<{ Querystring: { month: string; targetHours?: string } }>(
    '/api/stats/month',
    {
      schema: {
        description: 'Get monthly stats',
        tags: ['statistics'],
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

      app.logger.info({ month, targetHours }, 'Fetching monthly stats');

      try {
        const { year, month: monthNum } = parseMonthString(month);
        const startDate = new Date(year, monthNum, 1);
        const endDate = new Date(year, monthNum + 1, 1);

        // Get schedule settings
        const { dailyWorkingHours, saturdayWorking } = await getScheduleSettings(app);

        // Get jobs for the month
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)));

        // Get absences for the month
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(and(gte(schema.absences.absenceDate, startDateStr), lte(schema.absences.absenceDate, endDateStr)));

        // Calculate sold hours
        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const soldHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        // Calculate available hours
        const weekdaysCount = getWeekdaysInMonth(year, monthNum, saturdayWorking);
        const availableHours = Math.round((weekdaysCount * dailyWorkingHours) * 100) / 100;

        // Calculate absence deductions
        let absenceHoursFromAvailable = 0;
        let absenceHoursFromTarget = 0;

        for (const absence of absences) {
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

        // Calculate adjusted metrics
        const effectiveAvailableHours = Math.round((availableHours - absenceHoursFromAvailable) * 100) / 100;
        const efficiency = effectiveAvailableHours > 0
          ? Math.round((soldHours / effectiveAvailableHours) * 100)
          : null;
        const efficiencyLabel = getEfficiencyLabel(efficiency);
        const adjustedTargetHours = Math.round((targetHours - absenceHoursFromTarget) * 100) / 100;
        const remainingHours = Math.round((adjustedTargetHours - soldHours) * 100) / 100;

        const response = {
          soldHours,
          availableHours,
          absenceHoursFromAvailable: Math.round(absenceHoursFromAvailable * 100) / 100,
          absenceHoursFromTarget: Math.round(absenceHoursFromTarget * 100) / 100,
          effectiveAvailableHours,
          efficiency,
          efficiencyLabel,
          targetHours,
          adjustedTargetHours,
          remainingHours,
          totalJobs: jobs.length,
          totalAw: Math.round(totalAw * 100) / 100,
        };

        app.logger.info({ month, ...response }, 'Monthly stats calculated');
        return response;
      } catch (error) {
        app.logger.error({ err: error, month }, 'Failed to fetch monthly stats');
        throw error;
      }
    }
  );
}
