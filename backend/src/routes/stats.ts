import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sql, gte, lte, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface StatsResponse {
  jobCount: number;
  totalAw: number;
  totalMinutes: number;
  averageAw: number;
}

interface WeeklyBreakdown {
  week: number;
  jobCount: number;
  totalAw: number;
  totalMinutes: number;
}

interface MonthStatsResponse extends StatsResponse {
  weeklyBreakdown: WeeklyBreakdown[];
}

function calculateStats(jobs: any[]): StatsResponse {
  const jobCount = jobs.length;
  const totalAw = jobs.reduce((sum, job) => sum + (job.aw || 0), 0);
  const totalMinutes = totalAw * 5;
  const averageAw = jobCount > 0 ? Math.round((totalAw / jobCount) * 100) / 100 : 0;

  return {
    jobCount,
    totalAw,
    totalMinutes,
    averageAw,
  };
}

export function registerStatsRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/stats/today - Returns stats for today
  fastify.get(
    '/api/stats/today',
    {
      schema: {
        description: 'Get stats for today',
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              jobCount: { type: 'number' },
              totalAw: { type: 'number' },
              totalMinutes: { type: 'number' },
              averageAw: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching stats for today');
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, today), lte(schema.jobs.createdAt, tomorrow)));

        const stats = calculateStats(jobs);
        app.logger.info(stats, 'Today stats calculated successfully');
        return stats;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch today stats');
        throw error;
      }
    }
  );

  // GET /api/stats/week - Returns stats for current week
  fastify.get(
    '/api/stats/week',
    {
      schema: {
        description: 'Get stats for current week',
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              jobCount: { type: 'number' },
              totalAw: { type: 'number' },
              totalMinutes: { type: 'number' },
              averageAw: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching stats for current week');
      try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startOfWeek), lte(schema.jobs.createdAt, endOfWeek)));

        const stats = calculateStats(jobs);
        app.logger.info(stats, 'Week stats calculated successfully');
        return stats;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch week stats');
        throw error;
      }
    }
  );

  // GET /api/stats/month - Returns stats for current month
  fastify.get(
    '/api/stats/month',
    {
      schema: {
        description: 'Get stats for current month',
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              jobCount: { type: 'number' },
              totalAw: { type: 'number' },
              totalMinutes: { type: 'number' },
              averageAw: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching stats for current month');
      try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startOfMonth), lte(schema.jobs.createdAt, endOfMonth)));

        const stats = calculateStats(jobs);
        app.logger.info(stats, 'Month stats calculated successfully');
        return stats;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch month stats');
        throw error;
      }
    }
  );

  // GET /api/stats/month/:year/:month - Returns stats for specific month with weekly breakdown
  fastify.get(
    '/api/stats/month/:year/:month',
    {
      schema: {
        description: 'Get stats for specific month with weekly breakdown',
        tags: ['stats'],
        params: {
          type: 'object',
          properties: {
            year: { type: 'string' },
            month: { type: 'string' },
          },
          required: ['year', 'month'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobCount: { type: 'number' },
              totalAw: { type: 'number' },
              totalMinutes: { type: 'number' },
              averageAw: { type: 'number' },
              weeklyBreakdown: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    week: { type: 'number' },
                    jobCount: { type: 'number' },
                    totalAw: { type: 'number' },
                    totalMinutes: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { year, month } = request.params as { year: string; month: string };

      app.logger.info({ year, month }, 'Fetching stats for specific month with weekly breakdown');
      try {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10) - 1; // Convert to 0-indexed

        const startOfMonth = new Date(y, m, 1);
        const endOfMonth = new Date(y, m + 1, 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startOfMonth), lte(schema.jobs.createdAt, endOfMonth)));

        const stats = calculateStats(jobs);

        // Calculate weekly breakdown
        const weeklyBreakdown: WeeklyBreakdown[] = [];
        for (let week = 1; week <= 5; week++) {
          const weekStart = new Date(y, m, (week - 1) * 7 + 1);
          const weekEnd = new Date(y, m, week * 7 + 1);

          const weekJobs = jobs.filter(
            (job) =>
              new Date(job.createdAt) >= weekStart &&
              new Date(job.createdAt) < weekEnd
          );

          const weekStats = calculateStats(weekJobs);
          weeklyBreakdown.push({
            week,
            jobCount: weekStats.jobCount,
            totalAw: weekStats.totalAw,
            totalMinutes: weekStats.totalMinutes,
          });
        }

        const result: MonthStatsResponse = {
          ...stats,
          weeklyBreakdown,
        };

        app.logger.info({ year, month, ...stats }, 'Month stats with breakdown calculated successfully');
        return result;
      } catch (error) {
        app.logger.error({ err: error, year, month }, 'Failed to fetch month stats with breakdown');
        throw error;
      }
    }
  );
}
