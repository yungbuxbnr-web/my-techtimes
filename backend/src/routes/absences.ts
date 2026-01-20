import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function validateMonthFormat(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

export function registerAbsenceRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/absences/:month - Get all absences for a month
  fastify.get(
    '/api/absences/:month',
    {
      schema: {
        description: 'Get absences for a month',
        tags: ['absences'],
        params: {
          type: 'object',
          properties: {
            month: { type: 'string' },
          },
          required: ['month'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                month: { type: 'string' },
                daysCount: { type: 'string' },
                isHalfDay: { type: 'boolean' },
                deductionType: { type: 'string' },
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

      const { month } = request.params as { month: string };

      app.logger.info({ month }, 'Fetching absences for month');

      if (!validateMonthFormat(month)) {
        app.logger.warn({ month }, 'Invalid month format');
        return reply.status(400).send({
          error: 'Month must be in YYYY-MM format',
        });
      }

      try {
        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(eq(schema.absences.month, month))
          .orderBy(desc(schema.absences.createdAt));

        app.logger.info({ month, count: absences.length }, 'Absences fetched successfully');
        return absences;
      } catch (error) {
        app.logger.error({ err: error, month }, 'Failed to fetch absences');
        throw error;
      }
    }
  );

  // POST /api/absences - Create absence
  fastify.post(
    '/api/absences',
    {
      schema: {
        description: 'Create absence',
        tags: ['absences'],
        body: {
          type: 'object',
          properties: {
            month: { type: 'string' },
            daysCount: { type: 'number' },
            isHalfDay: { type: 'boolean' },
            deductionType: { type: 'string' },
          },
          required: ['month', 'daysCount', 'deductionType'],
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

      const { month, daysCount, isHalfDay, deductionType } = request.body as {
        month: string;
        daysCount: number;
        isHalfDay?: boolean;
        deductionType: 'target' | 'available';
      };

      app.logger.info({ month, daysCount, deductionType }, 'Creating absence');

      // Validation
      if (!validateMonthFormat(month)) {
        app.logger.warn({ month }, 'Invalid month format');
        return reply.status(400).send({
          error: 'Month must be in YYYY-MM format',
        });
      }

      if (!daysCount || daysCount <= 0) {
        app.logger.warn({ daysCount }, 'Invalid days count');
        return reply.status(400).send({
          error: 'Days count must be greater than 0',
        });
      }

      if (!['target', 'available'].includes(deductionType)) {
        app.logger.warn({ deductionType }, 'Invalid deduction type');
        return reply.status(400).send({
          error: 'Deduction type must be either "target" or "available"',
        });
      }

      try {
        const [absence] = await app.db
          .insert(schema.absences)
          .values({
            month,
            daysCount: daysCount.toString(),
            isHalfDay: isHalfDay ?? false,
            deductionType,
          })
          .returning();

        app.logger.info({ absenceId: absence.id }, 'Absence created successfully');
        return absence;
      } catch (error) {
        app.logger.error({ err: error, month, daysCount }, 'Failed to create absence');
        throw error;
      }
    }
  );

  // DELETE /api/absences/:id - Delete absence
  fastify.delete(
    '/api/absences/:id',
    {
      schema: {
        description: 'Delete absence',
        tags: ['absences'],
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

      app.logger.info({ absenceId: id }, 'Deleting absence');

      try {
        const result = await app.db
          .delete(schema.absences)
          .where(eq(schema.absences.id, id))
          .returning();

        if (result.length === 0) {
          app.logger.warn({ absenceId: id }, 'Absence not found for deletion');
          return reply.status(404).send({
            error: 'Absence not found',
          });
        }

        app.logger.info({ absenceId: id }, 'Absence deleted successfully');
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error, absenceId: id }, 'Failed to delete absence');
        throw error;
      }
    }
  );
}
