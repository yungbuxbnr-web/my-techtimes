import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function validateMonthFormat(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

function parseMonthString(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split('-').map(Number);
  return { year, month: month - 1 }; // month is 0-indexed for Date
}

export function registerAbsenceRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/absences/:month - Get absences for a month
  fastify.get<{ Params: { month: string } }>(
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
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month } = request.params;

      app.logger.info({ month }, 'Fetching absences for month');

      if (!validateMonthFormat(month)) {
        app.logger.warn({ month }, 'Invalid month format');
        return reply.status(400).send({
          error: 'Month must be in YYYY-MM format',
        });
      }

      try {
        const { year, month: monthNum } = parseMonthString(month);
        const startDateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(monthNum + 2).padStart(2, '0')}-01`;

        const absences = await app.db
          .select()
          .from(schema.absences)
          .where(
            and(
              gte(schema.absences.absenceDate, startDateStr),
              lte(schema.absences.absenceDate, endDateStr)
            )
          )
          .orderBy(desc(schema.absences.absenceDate));

        const response = absences.map((absence) => ({
          ...absence,
          daysCount: absence.daysCount ? parseFloat(absence.daysCount.toString()) : null,
          customHours: absence.customHours ? parseFloat(absence.customHours.toString()) : null,
        }));

        app.logger.info({ month, count: absences.length }, 'Absences fetched');
        return response;
      } catch (error) {
        app.logger.error({ err: error, month }, 'Failed to fetch absences');
        throw error;
      }
    }
  );

  // POST /api/absences - Create absence
  fastify.post<{ Body: any }>(
    '/api/absences',
    {
      schema: {
        description: 'Create absence',
        tags: ['absences'],
        body: {
          type: 'object',
          properties: {
            month: { type: 'string' },
            absenceDate: { type: 'string' },
            daysCount: { type: 'number' },
            isHalfDay: { type: 'boolean' },
            customHours: { type: 'number' },
            deductionType: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['month', 'absenceDate', 'deductionType'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { month, absenceDate, daysCount, isHalfDay, customHours, deductionType: deductionTypeInput, note } = request.body as {
        month: string;
        absenceDate: string;
        daysCount?: number;
        isHalfDay?: boolean;
        customHours?: number;
        deductionType: string;
        note?: string;
      };

      const deductionType = deductionTypeInput as 'MONTHLY_TARGET' | 'AVAILABLE_HOURS';

      app.logger.info({ month, deductionType }, 'Creating absence');

      // Validation
      if (!validateMonthFormat(month)) {
        app.logger.warn({ month }, 'Invalid month format');
        return reply.status(400).send({
          error: 'Month must be in YYYY-MM format',
        });
      }

      if (!['MONTHLY_TARGET', 'AVAILABLE_HOURS'].includes(deductionType)) {
        app.logger.warn({ deductionType }, 'Invalid deduction type');
        return reply.status(400).send({
          error: 'Deduction type must be either "MONTHLY_TARGET" or "AVAILABLE_HOURS"',
        });
      }

      // Validate that either (daysCount + isHalfDay) OR customHours is provided
      const hasDaysCount = daysCount !== undefined && daysCount !== null;
      const hasCustomHours = customHours !== undefined && customHours !== null;

      if (!hasDaysCount && !hasCustomHours) {
        app.logger.warn({}, 'Either daysCount or customHours must be provided');
        return reply.status(400).send({
          error: 'Either daysCount (with optional isHalfDay) or customHours must be provided',
        });
      }

      if (hasDaysCount && hasCustomHours) {
        app.logger.warn({}, 'Cannot provide both daysCount and customHours');
        return reply.status(400).send({
          error: 'Cannot provide both daysCount and customHours - use one or the other',
        });
      }

      try {
        const [absence] = await app.db
          .insert(schema.absences)
          .values({
            month,
            absenceDate: absenceDate,
            daysCount: hasDaysCount ? daysCount!.toString() : null,
            isHalfDay: isHalfDay ?? false,
            customHours: hasCustomHours ? customHours!.toString() : null,
            deductionType,
            note: note || null,
          })
          .returning();

        app.logger.info({ absenceId: absence.id }, 'Absence created');

        return {
          ...absence,
          daysCount: absence.daysCount ? parseFloat(absence.daysCount.toString()) : null,
          customHours: absence.customHours ? parseFloat(absence.customHours.toString()) : null,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to create absence');
        throw error;
      }
    }
  );

  // PUT /api/absences/:id - Update absence
  fastify.put<{ Params: { id: string }; Body: any }>(
    '/api/absences/:id',
    {
      schema: {
        description: 'Update absence',
        tags: ['absences'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            daysCount: { type: 'number' },
            isHalfDay: { type: 'boolean' },
            customHours: { type: 'number' },
            note: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params as { id: string };
      const { daysCount, isHalfDay, customHours, note } = request.body as {
        daysCount?: number;
        isHalfDay?: boolean;
        customHours?: number;
        note?: string;
      };

      app.logger.info({ absenceId: id }, 'Updating absence');

      try {
        const updateData: Record<string, any> = {};

        if (daysCount !== undefined) {
          updateData.daysCount = daysCount ? daysCount.toString() : null;
        }
        if (isHalfDay !== undefined) {
          updateData.isHalfDay = isHalfDay;
        }
        if (customHours !== undefined) {
          updateData.customHours = customHours ? customHours.toString() : null;
        }
        if (note !== undefined) {
          updateData.note = note || null;
        }

        const [absence] = await app.db
          .update(schema.absences)
          .set(updateData)
          .where(eq(schema.absences.id, id))
          .returning();

        if (!absence) {
          app.logger.warn({ absenceId: id }, 'Absence not found for update');
          return reply.status(404).send({ error: 'Absence not found' });
        }

        app.logger.info({ absenceId: id }, 'Absence updated');

        return {
          ...absence,
          daysCount: absence.daysCount ? parseFloat(absence.daysCount.toString()) : null,
          customHours: absence.customHours ? parseFloat(absence.customHours.toString()) : null,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to update absence');
        throw error;
      }
    }
  );

  // DELETE /api/absences/:id - Delete absence
  fastify.delete<{ Params: { id: string } }>(
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
        },
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;

      app.logger.info({ absenceId: id }, 'Deleting absence');

      try {
        const result = await app.db
          .delete(schema.absences)
          .where(eq(schema.absences.id, id))
          .returning();

        if (result.length === 0) {
          app.logger.warn({ absenceId: id }, 'Absence not found for deletion');
          return reply.status(404).send({ error: 'Absence not found' });
        }

        app.logger.info({ absenceId: id }, 'Absence deleted');
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to delete absence');
        throw error;
      }
    }
  );
}
