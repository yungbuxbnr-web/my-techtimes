import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import type { App } from '../index.js';
import * as schema from '../db/schema.js';

export function registerScheduleRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/schedule - Returns current schedule config
  fastify.get(
    '/api/schedule',
    {
      schema: {
        description: 'Get schedule configuration',
        tags: ['schedule'],
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching schedule');

      try {
        const schedules = await app.db.select().from(schema.schedule).limit(1);

        if (schedules.length === 0) {
          // Return default if no schedule exists
          app.logger.info({}, 'No schedule found, returning defaults');
          return {
            dailyWorkingHours: 8.5,
            saturdayWorking: false,
          };
        }

        const sched = schedules[0];
        app.logger.info({ dailyWorkingHours: sched.dailyWorkingHours, saturdayWorking: sched.saturdayWorking }, 'Schedule fetched');

        return {
          id: sched.id,
          dailyWorkingHours: parseFloat(sched.dailyWorkingHours.toString()),
          saturdayWorking: sched.saturdayWorking,
          createdAt: sched.createdAt,
          updatedAt: sched.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch schedule');
        throw error;
      }
    }
  );

  // PUT /api/schedule - Update schedule config
  fastify.put<{ Body: any }>(
    '/api/schedule',
    {
      schema: {
        description: 'Update schedule configuration',
        tags: ['schedule'],
        body: {
          type: 'object',
          properties: {
            dailyWorkingHours: { type: 'number' },
            saturdayWorking: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { dailyWorkingHours, saturdayWorking } = request.body as {
        dailyWorkingHours?: number;
        saturdayWorking?: boolean;
      };

      app.logger.info({ dailyWorkingHours, saturdayWorking }, 'Updating schedule');

      try {
        const schedules = await app.db.select().from(schema.schedule).limit(1);

        if (schedules.length === 0) {
          // Create new schedule
          const [newSchedule] = await app.db
            .insert(schema.schedule)
            .values({
              dailyWorkingHours: dailyWorkingHours?.toString() || '8.5',
              saturdayWorking: saturdayWorking ?? false,
            })
            .returning();

          app.logger.info({ id: newSchedule.id }, 'Schedule created');
          return {
            id: newSchedule.id,
            dailyWorkingHours: parseFloat(newSchedule.dailyWorkingHours.toString()),
            saturdayWorking: newSchedule.saturdayWorking,
            createdAt: newSchedule.createdAt,
            updatedAt: newSchedule.updatedAt,
          };
        }

        // Update existing schedule
        const updateData: Record<string, any> = {};
        if (dailyWorkingHours !== undefined) {
          updateData.dailyWorkingHours = dailyWorkingHours.toString();
        }
        if (saturdayWorking !== undefined) {
          updateData.saturdayWorking = saturdayWorking;
        }

        const [updatedSchedule] = await app.db
          .update(schema.schedule)
          .set(updateData)
          .where(eq(schema.schedule.id, schedules[0].id))
          .returning();

        app.logger.info({ id: updatedSchedule.id }, 'Schedule updated');
        return {
          id: updatedSchedule.id,
          dailyWorkingHours: parseFloat(updatedSchedule.dailyWorkingHours.toString()),
          saturdayWorking: updatedSchedule.saturdayWorking,
          createdAt: updatedSchedule.createdAt,
          updatedAt: updatedSchedule.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to update schedule');
        throw error;
      }
    }
  );
}
