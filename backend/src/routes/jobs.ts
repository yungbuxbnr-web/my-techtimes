import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, gte, lte, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function convertAwToHours(aw: string | number): number {
  const awNum = typeof aw === 'string' ? parseFloat(aw) : aw;
  return Math.round((awNum * 5 / 60) * 100) / 100;
}

interface JobResponse {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes: string | null;
  vhcStatus: string;
  createdAt: Date;
  updatedAt: Date;
  hours: number;
}

export function registerJobRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // POST /api/jobs - Create a new job
  fastify.post<{ Body: any }>(
    '/api/jobs',
    {
      schema: {
        description: 'Create a new job',
        tags: ['jobs'],
        body: {
          type: 'object',
          properties: {
            wipNumber: { type: 'string' },
            vehicleReg: { type: 'string' },
            aw: { type: 'number' },
            notes: { type: 'string' },
            vhcStatus: { type: 'string' },
            createdAt: { type: 'string' },
          },
          required: ['wipNumber', 'vehicleReg', 'aw'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { wipNumber, vehicleReg, aw, notes, vhcStatus: vhcStatusInput, createdAt } = request.body as {
        wipNumber: string;
        vehicleReg: string;
        aw: number;
        notes?: string;
        vhcStatus?: string;
        createdAt?: string;
      };

      const vhcStatus = (vhcStatusInput || 'N/A') as 'GREEN' | 'AMBER' | 'RED' | 'N/A';

      app.logger.info({ wipNumber, vehicleReg, aw }, 'Creating job');

      try {
        const jobDate = createdAt ? new Date(createdAt) : new Date();

        const [job] = await app.db
          .insert(schema.jobs)
          .values({
            wipNumber,
            vehicleReg: vehicleReg.toUpperCase(),
            aw: aw.toString(),
            notes: notes || null,
            vhcStatus,
            createdAt: jobDate,
          })
          .returning();

        const response: JobResponse = {
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        };

        app.logger.info({ jobId: job.id }, 'Job created successfully');
        return response;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to create job');
        throw error;
      }
    }
  );

  // GET /api/jobs - List all jobs with optional month filter
  fastify.get<{ Querystring: any }>(
    '/api/jobs',
    {
      schema: {
        description: 'Get jobs with optional month filter',
        tags: ['jobs'],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month } = request.query as { month?: string };
      app.logger.info({ month }, 'Fetching jobs');

      try {
        let jobs: any[];

        if (month) {
          const [year, monthNum] = month.split('-');
          const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(monthNum), 1);

          jobs = await app.db
            .select()
            .from(schema.jobs)
            .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)))
            .orderBy(desc(schema.jobs.createdAt));
        } else {
          jobs = await app.db
            .select()
            .from(schema.jobs)
            .orderBy(desc(schema.jobs.createdAt));
        }

        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const totalHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        const jobsWithHours: JobResponse[] = jobs.map((job) => ({
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        }));

        app.logger.info({ count: jobs.length }, 'Jobs fetched successfully');
        return {
          jobs: jobsWithHours,
          totals: {
            jobCount: jobs.length,
            totalAw,
            totalTime: totalHours,
          },
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/:id - Get single job
  fastify.get<{ Params: { id: string } }>(
    '/api/jobs/:id',
    {
      schema: {
        description: 'Get single job',
        tags: ['jobs'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info({ jobId: id }, 'Fetching single job');

      try {
        const [job] = await app.db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.id, id));

        if (!job) {
          app.logger.warn({ jobId: id }, 'Job not found');
          return reply.status(404).send({ error: 'Job not found' });
        }

        const response: JobResponse = {
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        };

        app.logger.info({ jobId: id }, 'Job fetched successfully');
        return response;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch job');
        throw error;
      }
    }
  );

  // PUT /api/jobs/:id - Update job
  fastify.put<{ Params: { id: string }; Body: any }>(
    '/api/jobs/:id',
    {
      schema: {
        description: 'Update job',
        tags: ['jobs'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            wipNumber: { type: 'string' },
            vehicleReg: { type: 'string' },
            aw: { type: 'number' },
            notes: { type: 'string' },
            vhcStatus: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };
      const { wipNumber, vehicleReg, aw, notes, vhcStatus: vhcStatusInput, createdAt } = request.body as {
        wipNumber?: string;
        vehicleReg?: string;
        aw?: number;
        notes?: string;
        vhcStatus?: string;
        createdAt?: string;
      };

      const vhcStatus = vhcStatusInput as 'GREEN' | 'AMBER' | 'RED' | 'N/A' | undefined;

      app.logger.info({ jobId: id }, 'Updating job');

      try {
        const updateData: Record<string, any> = {};
        if (wipNumber !== undefined) updateData.wipNumber = wipNumber;
        if (vehicleReg !== undefined) updateData.vehicleReg = vehicleReg.toUpperCase();
        if (aw !== undefined) updateData.aw = aw.toString();
        if (notes !== undefined) updateData.notes = notes || null;
        if (vhcStatus !== undefined && vhcStatus) updateData.vhcStatus = vhcStatus;
        if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

        const [job] = await app.db
          .update(schema.jobs)
          .set(updateData)
          .where(eq(schema.jobs.id, id))
          .returning();

        if (!job) {
          app.logger.warn({ jobId: id }, 'Job not found for update');
          return reply.status(404).send({ error: 'Job not found' });
        }

        const response: JobResponse = {
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        };

        app.logger.info({ jobId: id }, 'Job updated successfully');
        return response;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to update job');
        throw error;
      }
    }
  );

  // DELETE /api/jobs/:id - Delete job
  fastify.delete<{ Params: { id: string } }>(
    '/api/jobs/:id',
    {
      schema: {
        description: 'Delete job',
        tags: ['jobs'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      app.logger.info({ jobId: id }, 'Deleting job');

      try {
        const result = await app.db
          .delete(schema.jobs)
          .where(eq(schema.jobs.id, id))
          .returning();

        if (result.length === 0) {
          app.logger.warn({ jobId: id }, 'Job not found for deletion');
          return reply.status(404).send({ error: 'Job not found' });
        }

        app.logger.info({ jobId: id }, 'Job deleted successfully');
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to delete job');
        throw error;
      }
    }
  );

  // GET /api/jobs/today - Jobs for current day
  fastify.get(
    '/api/jobs/today',
    {
      schema: {
        description: 'Get today jobs',
        tags: ['jobs'],
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching today jobs');

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, today), lte(schema.jobs.createdAt, tomorrow)))
          .orderBy(desc(schema.jobs.createdAt));

        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const totalHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        const jobsWithHours = jobs.map((job) => ({
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        }));

        app.logger.info({ count: jobs.length }, 'Today jobs fetched');
        return {
          jobs: jobsWithHours,
          totals: {
            jobCount: jobs.length,
            totalAw,
            totalTime: totalHours,
          },
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch today jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/week - Jobs for current week
  fastify.get(
    '/api/jobs/week',
    {
      schema: {
        description: 'Get week jobs',
        tags: ['jobs'],
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching week jobs');

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
          .where(and(gte(schema.jobs.createdAt, startOfWeek), lte(schema.jobs.createdAt, endOfWeek)))
          .orderBy(desc(schema.jobs.createdAt));

        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const totalHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        const jobsWithHours = jobs.map((job) => ({
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        }));

        app.logger.info({ count: jobs.length }, 'Week jobs fetched');
        return {
          jobs: jobsWithHours,
          totals: {
            jobCount: jobs.length,
            totalAw,
            totalTime: totalHours,
          },
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch week jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/month - Jobs for specified month
  fastify.get<{ Querystring: { month: string } }>(
    '/api/jobs/month',
    {
      schema: {
        description: 'Get month jobs',
        tags: ['jobs'],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
          required: ['month'],
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month } = request.query;
      app.logger.info({ month }, 'Fetching month jobs');

      try {
        const [year, monthNum] = month.split('-');
        const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(monthNum), 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)))
          .orderBy(desc(schema.jobs.createdAt));

        const totalAw = jobs.reduce((sum, job) => sum + parseFloat(job.aw.toString()), 0);
        const totalHours = Math.round((totalAw * 5 / 60) * 100) / 100;

        const jobsWithHours = jobs.map((job) => ({
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        }));

        app.logger.info({ count: jobs.length }, 'Month jobs fetched');
        return {
          jobs: jobsWithHours,
          totals: {
            jobCount: jobs.length,
            totalAw,
            totalTime: totalHours,
          },
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch month jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/recent - Recent jobs list
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/jobs/recent',
    {
      schema: {
        description: 'Get recent jobs',
        tags: ['jobs'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const limit = request.query.limit ? parseInt(request.query.limit) : 10;
      app.logger.info({ limit }, 'Fetching recent jobs');

      try {
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .orderBy(desc(schema.jobs.createdAt))
          .limit(limit);

        const jobsWithHours = jobs.map((job) => ({
          ...job,
          aw: parseFloat(job.aw.toString()),
          hours: convertAwToHours(job.aw),
        }));

        app.logger.info({ count: jobs.length }, 'Recent jobs fetched');
        return jobsWithHours;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch recent jobs');
        throw error;
      }
    }
  );
}
