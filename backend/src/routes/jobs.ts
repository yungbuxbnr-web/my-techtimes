import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, gte, lte, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Validation helpers
function validateWipNumber(wipNumber: string): boolean {
  return /^\d{5}$/.test(wipNumber);
}

function validateAwValue(aw: number): boolean {
  return typeof aw === 'number' && aw >= 0 && aw <= 100;
}

export function registerJobRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/jobs - Returns all jobs ordered by createdAt DESC
  fastify.get(
    '/api/jobs',
    {
      schema: {
        description: 'Get all jobs',
        tags: ['jobs'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                wipNumber: { type: 'string' },
                vehicleReg: { type: 'string' },
                aw: { type: 'number' },
                notes: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching all jobs');
      try {
        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .orderBy(desc(schema.jobs.createdAt));
        app.logger.info({ jobCount: jobs.length }, 'Jobs fetched successfully');
        return jobs;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch jobs');
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

        app.logger.info({ jobCount: jobs.length }, 'Today jobs fetched successfully');
        return jobs;
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

        app.logger.info({ jobCount: jobs.length }, 'Week jobs fetched successfully');
        return jobs;
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

        app.logger.info({ jobCount: jobs.length }, 'Month jobs fetched successfully');
        return jobs;
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

        app.logger.info({ jobCount: jobs.length }, 'Range jobs fetched successfully');
        return jobs;
      } catch (error) {
        app.logger.error({ err: error, start, end }, 'Failed to fetch range jobs');
        throw error;
      }
    }
  );

  // POST /api/jobs - Create a new job
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

        app.logger.info({ jobId: job.id }, 'Job created successfully');
        return job;
      } catch (error) {
        app.logger.error({ err: error, wipNumber, vehicleReg }, 'Failed to create job');
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

        app.logger.info({ jobId: id }, 'Job updated successfully');
        return job;
      } catch (error) {
        app.logger.error({ err: error, jobId: id }, 'Failed to update job');
        throw error;
      }
    }
  );

  // DELETE /api/jobs/:id - Delete a job
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
}
