import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, gte, lte, and, or, ilike } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Validation helpers
function validateWipNumber(wipNumber: string): boolean {
  return /^\d{5}$/.test(wipNumber);
}

function validateAwValue(aw: number): boolean {
  return typeof aw === 'number' && aw >= 0 && aw <= 100;
}

function convertAwToTime(aw: number): { minutes: number; hours: number } {
  const minutes = aw * 5;
  const hours = Math.round((minutes / 60) * 100) / 100;
  return { minutes, hours };
}

interface JobWithTime {
  id: string;
  wipNumber: string;
  vehicleReg: string;
  aw: number;
  notes: string | null;
  createdAt: Date;
  minutes: number;
  hours: number;
}

export function registerJobRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // POST /api/jobs - Create a new job record
  fastify.post(
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
          },
          required: ['wipNumber', 'vehicleReg', 'aw'],
        },
        response: {
          200: { type: 'object' },
          400: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { wipNumber, vehicleReg, aw, notes } = request.body as {
        wipNumber: string;
        vehicleReg: string;
        aw: number;
        notes?: string;
      };

      app.logger.info({ wipNumber, vehicleReg, aw }, 'Creating job');

      // Validation
      if (!validateWipNumber(wipNumber)) {
        app.logger.warn({ wipNumber }, 'Invalid WIP number format');
        return reply.status(400).send({
          error: 'WIP number must be exactly 5 digits',
        });
      }

      if (!vehicleReg || typeof vehicleReg !== 'string') {
        app.logger.warn({ vehicleReg }, 'Invalid vehicle registration');
        return reply.status(400).send({
          error: 'Vehicle registration is required',
        });
      }

      if (!validateAwValue(aw)) {
        app.logger.warn({ aw }, 'Invalid AW value');
        return reply.status(400).send({
          error: 'AW value must be between 0 and 100',
        });
      }

      try {
        const [job] = await app.db
          .insert(schema.jobs)
          .values({
            wipNumber,
            vehicleReg: vehicleReg.toUpperCase(),
            aw,
            notes: notes || null,
          })
          .returning();

        const time = convertAwToTime(job.aw);
        const jobWithTime: JobWithTime = {
          ...job,
          ...time,
        };

        app.logger.info({ jobId: job.id }, 'Job created successfully');
        return jobWithTime;
      } catch (error) {
        app.logger.error({ err: error, wipNumber, vehicleReg }, 'Failed to create job');
        throw error;
      }
    }
  );

  // GET /api/jobs - List all job records with search and filtering
  fastify.get(
    '/api/jobs',
    {
      schema: {
        description: 'Get jobs with search and filtering',
        tags: ['jobs'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            wipNumber: { type: 'string' },
            vehicleReg: { type: 'string' },
            month: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobs: { type: 'array' },
              count: { type: 'number' },
              summary: {
                type: 'object',
                properties: {
                  totalJobs: { type: 'number' },
                  totalAw: { type: 'number' },
                  totalHours: { type: 'number' },
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

      const { search, wipNumber, vehicleReg, month } = request.query as {
        search?: string;
        wipNumber?: string;
        vehicleReg?: string;
        month?: string;
      };

      app.logger.info({ search, wipNumber, vehicleReg, month }, 'Fetching jobs with filters');

      try {
        // Build where conditions
        const conditions: any[] = [];

        if (wipNumber) {
          conditions.push(eq(schema.jobs.wipNumber, wipNumber));
        }

        if (vehicleReg) {
          conditions.push(eq(schema.jobs.vehicleReg, vehicleReg.toUpperCase()));
        }

        if (search) {
          conditions.push(
            or(
              ilike(schema.jobs.wipNumber, `%${search}%`),
              ilike(schema.jobs.vehicleReg, `%${search}%`),
              ilike(schema.jobs.notes, `%${search}%`)
            )
          );
        }

        if (month) {
          // Parse YYYY-MM format
          const [year, monthNum] = month.split('-');
          if (year && monthNum) {
            const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(monthNum), 1);
            conditions.push(
              and(
                gte(schema.jobs.createdAt, startDate),
                lte(schema.jobs.createdAt, endDate)
              )
            );
          }
        }

        // Execute query with or without filters
        const jobs: any[] = conditions.length > 0
          ? await app.db
              .select()
              .from(schema.jobs)
              .where(and(...conditions))
              .orderBy(desc(schema.jobs.createdAt))
          : await app.db
              .select()
              .from(schema.jobs)
              .orderBy(desc(schema.jobs.createdAt));

        // Calculate summary
        const totalAw = jobs.reduce((sum, job) => sum + job.aw, 0);
        const totalMinutes = totalAw * 5;
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

        const jobsWithTime: JobWithTime[] = jobs.map((job) => {
          const time = convertAwToTime(job.aw);
          return {
            ...job,
            ...time,
          };
        });

        const response = {
          jobs: jobsWithTime,
          count: jobs.length,
          summary: {
            totalJobs: jobs.length,
            totalAw,
            totalHours,
          },
        };

        app.logger.info({ count: jobs.length, totalAw }, 'Jobs fetched successfully');
        return response;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/:id - Get single job record
  fastify.get(
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
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };

      app.logger.info({ jobId: id }, 'Fetching single job');

      try {
        const [job] = await app.db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.id, id));

        if (!job) {
          app.logger.warn({ jobId: id }, 'Job not found');
          return reply.status(404).send({
            error: 'Job not found',
          });
        }

        const time = convertAwToTime(job.aw);
        const jobWithTime: JobWithTime = {
          ...job,
          ...time,
        };

        app.logger.info({ jobId: id }, 'Job fetched successfully');
        return jobWithTime;
      } catch (error) {
        app.logger.error({ err: error, jobId: id }, 'Failed to fetch job');
        throw error;
      }
    }
  );

  // DELETE /api/jobs/:id - Delete a job record
  fastify.delete(
    '/api/jobs/:id',
    {
      schema: {
        description: 'Delete a job',
        tags: ['jobs'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          404: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };

      app.logger.info({ jobId: id }, 'Deleting job');

      try {
        const result = await app.db
          .delete(schema.jobs)
          .where(eq(schema.jobs.id, id))
          .returning();

        if (result.length === 0) {
          app.logger.warn({ jobId: id }, 'Job not found for deletion');
          return reply.status(404).send({
            error: 'Job not found',
          });
        }

        app.logger.info({ jobId: id }, 'Job deleted successfully');
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error, jobId: id }, 'Failed to delete job');
        throw error;
      }
    }
  );

  // GET /api/jobs/today - Returns jobs from today only
  fastify.get(
    '/api/jobs/today',
    {
      schema: {
        description: 'Get jobs from today',
        tags: ['jobs'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching jobs for today');
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

        const jobsWithTime = jobs.map((job) => ({
          ...job,
          ...convertAwToTime(job.aw),
        }));

        app.logger.info({ jobCount: jobs.length }, 'Today jobs fetched successfully');
        return jobsWithTime;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch today jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/week - Returns jobs from current week
  fastify.get(
    '/api/jobs/week',
    {
      schema: {
        description: 'Get jobs from current week',
        tags: ['jobs'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching jobs for current week');
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

        const jobsWithTime = jobs.map((job) => ({
          ...job,
          ...convertAwToTime(job.aw),
        }));

        app.logger.info({ jobCount: jobs.length }, 'Week jobs fetched successfully');
        return jobsWithTime;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch week jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/month - Returns jobs from current month
  fastify.get(
    '/api/jobs/month',
    {
      schema: {
        description: 'Get jobs from current month',
        tags: ['jobs'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching jobs for current month');
      try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startOfMonth), lte(schema.jobs.createdAt, endOfMonth)))
          .orderBy(desc(schema.jobs.createdAt));

        const jobsWithTime = jobs.map((job) => ({
          ...job,
          ...convertAwToTime(job.aw),
        }));

        app.logger.info({ jobCount: jobs.length }, 'Month jobs fetched successfully');
        return jobsWithTime;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch month jobs');
        throw error;
      }
    }
  );

  // GET /api/jobs/range?start=YYYY-MM-DD&end=YYYY-MM-DD - Returns jobs in date range
  fastify.get(
    '/api/jobs/range',
    {
      schema: {
        description: 'Get jobs in date range',
        tags: ['jobs'],
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
          required: ['start', 'end'],
        },
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { start, end } = request.query as { start: string; end: string };

      app.logger.info({ start, end }, 'Fetching jobs for date range');
      try {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)))
          .orderBy(desc(schema.jobs.createdAt));

        const jobsWithTime = jobs.map((job) => ({
          ...job,
          ...convertAwToTime(job.aw),
        }));

        app.logger.info({ jobCount: jobs.length }, 'Range jobs fetched successfully');
        return jobsWithTime;
      } catch (error) {
        app.logger.error({ err: error, start, end }, 'Failed to fetch range jobs');
        throw error;
      }
    }
  );

  // PUT /api/jobs/:id - Update a job
  fastify.put(
    '/api/jobs/:id',
    {
      schema: {
        description: 'Update a job',
        tags: ['jobs'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            wipNumber: { type: 'string' },
            vehicleReg: { type: 'string' },
            aw: { type: 'number' },
            notes: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };
      const { wipNumber, vehicleReg, aw, notes } = request.body as {
        wipNumber?: string;
        vehicleReg?: string;
        aw?: number;
        notes?: string;
      };

      app.logger.info({ jobId: id }, 'Updating job');

      // Validate provided fields
      if (wipNumber !== undefined && !validateWipNumber(wipNumber)) {
        app.logger.warn({ wipNumber }, 'Invalid WIP number format');
        return reply.status(400).send({
          error: 'WIP number must be exactly 5 digits',
        });
      }

      if (vehicleReg !== undefined && !vehicleReg) {
        app.logger.warn({}, 'Invalid vehicle registration');
        return reply.status(400).send({
          error: 'Vehicle registration is required',
        });
      }

      if (aw !== undefined && !validateAwValue(aw)) {
        app.logger.warn({ aw }, 'Invalid AW value');
        return reply.status(400).send({
          error: 'AW value must be between 0 and 100',
        });
      }

      try {
        const updateData: Record<string, any> = {};
        if (wipNumber !== undefined) updateData.wipNumber = wipNumber;
        if (vehicleReg !== undefined) updateData.vehicleReg = vehicleReg.toUpperCase();
        if (aw !== undefined) updateData.aw = aw;
        if (notes !== undefined) updateData.notes = notes || null;

        const [job] = await app.db
          .update(schema.jobs)
          .set(updateData)
          .where(eq(schema.jobs.id, id))
          .returning();

        if (!job) {
          app.logger.warn({ jobId: id }, 'Job not found for update');
          return reply.status(404).send({
            error: 'Job not found',
          });
        }

        const time = convertAwToTime(job.aw);
        const jobWithTime: JobWithTime = {
          ...job,
          ...time,
        };

        app.logger.info({ jobId: id }, 'Job updated successfully');
        return jobWithTime;
      } catch (error) {
        app.logger.error({ err: error, jobId: id }, 'Failed to update job');
        throw error;
      }
    }
  );
}
