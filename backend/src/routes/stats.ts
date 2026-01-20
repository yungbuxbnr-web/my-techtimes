import type { FastifyRequest, FastifyReply } from 'fastify';
import { gte, lte, and, eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Utility functions
function getWeekdaysInMonth(year: number, month: number): number {
  // month is 0-indexed
  let weekdays = 0;
  const date = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays++;
    }
  }
  return weekdays;
}

function parseMonthString(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split('-').map(Number);
  return { year, month: month - 1 }; // month is 0-indexed for Date
}

function getEfficiencyColor(efficiency: number): 'green' | 'yellow' | 'red' {
  if (efficiency >= 65) return 'green';
  if (efficiency >= 31) return 'yellow';
  return 'red';
}

function calculateDeduction(
  daysCount: number,
  isHalfDay: boolean
): number {
  if (isHalfDay) {
    return daysCount * 4.25;
  }
  return daysCount * 8.5;
}

export function registerStatsRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // Helper to get monthly target setting
  async function getMonthlyTargetHours(): Promise<number> {
    const setting = await app.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'monthly-target'));
    return setting.length > 0 ? parseFloat(setting[0].value) : 180;
  }

  // GET /api/stats/monthly/:month - Get monthly stats with target and efficiency
  fastify.get(
    '/api/stats/monthly/:month',
    {
      schema: {
        description: 'Get monthly stats',
        tags: ['stats'],
        params: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
          required: ['month'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              soldHours: { type: 'number' },
              targetHours: { type: 'number' },
              remainingHours: { type: 'number' },
              availableHours: { type: 'number' },
              efficiency: { type: 'number' },
              efficiencyColor: { type: 'string' },
              totalJobs: { type: 'number' },
              totalAw: { type: 'number' },
              weeklyBreakdown: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month: monthStr } = request.params as { month: string };

      app.logger.info({ month: monthStr }, 'Fetching monthly stats');

      try {
        const { year, month } = parseMonthString(monthStr);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        // Get jobs for the month
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)));

        // Get absences for the month
        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(eq(schema.absences.month, monthStr));

        // Calculate metrics
        const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
        const soldMinutes = totalAw * 5;
        const soldHours = Math.round((soldMinutes / 60) * 100) / 100;

        // Get target hours
        const defaultTarget = await getMonthlyTargetHours();

        // Calculate deductions
        let targetDeduction = 0;
        let availableDeduction = 0;

        for (const absence of absences) {
          const deduction = calculateDeduction(parseFloat(absence.daysCount.toString()), absence.isHalfDay);
          if (absence.deductionType === 'target') {
            targetDeduction += deduction;
          } else {
            availableDeduction += deduction;
          }
        }

        const targetHours = defaultTarget - targetDeduction;
        const weekdaysCount = getWeekdaysInMonth(year, month);
        const availableHours = weekdaysCount * 8.5 - availableDeduction;
        const remainingHours = Math.round((targetHours - soldHours) * 100) / 100;

        const efficiency = availableHours > 0 ? Math.round((soldHours / availableHours) * 100) : 0;
        const efficiencyColor = getEfficiencyColor(efficiency);

        // Calculate weekly breakdown
        const weeklyBreakdown: any[] = [];
        for (let week = 1; week <= 5; week++) {
          const weekStartDay = (week - 1) * 7 + 1;
          const weekEndDay = Math.min(week * 7 + 1, new Date(year, month + 1, 0).getDate() + 1);
          const weekStart = new Date(year, month, weekStartDay);
          const weekEnd = new Date(year, month, weekEndDay);

          const weekJobs = jobs.filter(
            (job) =>
              new Date(job.createdAt) >= weekStart && new Date(job.createdAt) < weekEnd
          );

          const weekTotalAw = weekJobs.reduce((sum, job) => sum + job.aw, 0);
          const weekMinutes = weekTotalAw * 5;
          const weekHours = Math.round((weekMinutes / 60) * 100) / 100;

          weeklyBreakdown.push({
            week,
            jobs: weekJobs.length,
            aw: weekTotalAw,
            hours: weekHours,
          });
        }

        const result = {
          month: monthStr,
          soldHours,
          targetHours,
          remainingHours,
          availableHours,
          efficiency,
          efficiencyColor,
          totalJobs: jobs.length,
          totalAw,
          weeklyBreakdown,
        };

        app.logger.info({ month: monthStr, ...result }, 'Monthly stats calculated');
        return result;
      } catch (error) {
        app.logger.error({ err: error, month: monthStr }, 'Failed to fetch monthly stats');
        throw error;
      }
    }
  );

  // GET /api/stats/target-details/:month - Get detailed target breakdown
  fastify.get(
    '/api/stats/target-details/:month',
    {
      schema: {
        description: 'Get target details',
        tags: ['stats'],
        params: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
          required: ['month'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              targetHours: { type: 'number' },
              soldHours: { type: 'number' },
              remainingHours: { type: 'number' },
              totalJobs: { type: 'number' },
              totalAw: { type: 'number' },
              percentComplete: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month: monthStr } = request.params as { month: string };

      app.logger.info({ month: monthStr }, 'Fetching target details');

      try {
        const { year, month } = parseMonthString(monthStr);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        // Get jobs for the month
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)));

        // Get absences for the month
        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(eq(schema.absences.month, monthStr));

        // Calculate metrics
        const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
        const soldMinutes = totalAw * 5;
        const soldHours = Math.round((soldMinutes / 60) * 100) / 100;

        // Get target hours
        const defaultTarget = await getMonthlyTargetHours();

        // Calculate target deductions
        let targetDeduction = 0;
        for (const absence of absences) {
          if (absence.deductionType === 'target') {
            targetDeduction += calculateDeduction(parseFloat(absence.daysCount.toString()), absence.isHalfDay);
          }
        }

        const targetHours = defaultTarget - targetDeduction;
        const remainingHours = Math.round((targetHours - soldHours) * 100) / 100;
        const percentComplete = targetHours > 0 ? Math.round((soldHours / targetHours) * 100) : 0;

        const result = {
          month: monthStr,
          targetHours,
          soldHours,
          remainingHours,
          totalJobs: jobs.length,
          totalAw,
          percentComplete,
        };

        app.logger.info({ month: monthStr, ...result }, 'Target details calculated');
        return result;
      } catch (error) {
        app.logger.error({ err: error, month: monthStr }, 'Failed to fetch target details');
        throw error;
      }
    }
  );

  // GET /api/stats/efficiency-details/:month - Get detailed efficiency breakdown
  fastify.get(
    '/api/stats/efficiency-details/:month',
    {
      schema: {
        description: 'Get efficiency details',
        tags: ['stats'],
        params: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
          required: ['month'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              soldHours: { type: 'number' },
              availableHours: { type: 'number' },
              efficiency: { type: 'number' },
              efficiencyColor: { type: 'string' },
              weekdaysInMonth: { type: 'number' },
              absenceDays: { type: 'number' },
              formula: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month: monthStr } = request.params as { month: string };

      app.logger.info({ month: monthStr }, 'Fetching efficiency details');

      try {
        const { year, month } = parseMonthString(monthStr);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        // Get jobs for the month
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)));

        // Get absences for the month
        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(eq(schema.absences.month, monthStr));

        // Calculate metrics
        const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
        const soldMinutes = totalAw * 5;
        const soldHours = Math.round((soldMinutes / 60) * 100) / 100;

        const weekdaysInMonth = getWeekdaysInMonth(year, month);

        // Calculate available deductions
        let availableDeduction = 0;
        let absenceDays = 0;

        for (const absence of absences) {
          if (absence.deductionType === 'available') {
            const days = parseFloat(absence.daysCount.toString());
            availableDeduction += calculateDeduction(days, absence.isHalfDay);
            absenceDays += days;
          }
        }

        const availableHours = weekdaysInMonth * 8.5 - availableDeduction;
        const efficiency = availableHours > 0 ? Math.round((soldHours / availableHours) * 100) : 0;
        const efficiencyColor = getEfficiencyColor(efficiency);

        const result = {
          month: monthStr,
          soldHours,
          availableHours,
          efficiency,
          efficiencyColor,
          weekdaysInMonth,
          absenceDays,
          formula: `(Sold Hours / Available Hours) × 100 = (${soldHours} / ${availableHours}) × 100 = ${efficiency}%`,
        };

        app.logger.info({ month: monthStr, ...result }, 'Efficiency details calculated');
        return result;
      } catch (error) {
        app.logger.error({ err: error, month: monthStr }, 'Failed to fetch efficiency details');
        throw error;
      }
    }
  );
}
