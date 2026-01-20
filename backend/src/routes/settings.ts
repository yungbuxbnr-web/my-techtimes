import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerSettingsRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/settings/monthly-target - Get monthly target hours
  fastify.get(
    '/api/settings/monthly-target',
    {
      schema: {
        description: 'Get monthly target hours',
        tags: ['settings'],
        response: {
          200: {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching monthly target setting');

      try {
        const setting = await app.db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, 'monthly-target'));

        const value = setting.length > 0 ? parseFloat(setting[0].value) : 180;

        app.logger.info({ value }, 'Monthly target setting fetched successfully');
        return { value };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch monthly target setting');
        throw error;
      }
    }
  );

  // PUT /api/settings/monthly-target - Update monthly target hours
  fastify.put(
    '/api/settings/monthly-target',
    {
      schema: {
        description: 'Update monthly target hours',
        tags: ['settings'],
        body: {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
          required: ['value'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
          },
          400: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { value } = request.body as { value: number };

      app.logger.info({ value }, 'Updating monthly target setting');

      // Validation
      if (typeof value !== 'number' || value <= 0) {
        app.logger.warn({ value }, 'Invalid target value');
        return reply.status(400).send({
          error: 'Monthly target must be a positive number',
        });
      }

      try {
        // Check if setting exists
        const existing = await app.db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, 'monthly-target'));

        if (existing.length > 0) {
          // Update existing
          const [updated] = await app.db
            .update(schema.settings)
            .set({
              value: value.toString(),
              updatedAt: new Date(),
            })
            .where(eq(schema.settings.key, 'monthly-target'))
            .returning();

          app.logger.info({ value }, 'Monthly target setting updated successfully');
          return { value: parseFloat(updated.value) };
        } else {
          // Create new
          const [created] = await app.db
            .insert(schema.settings)
            .values({
              key: 'monthly-target',
              value: value.toString(),
            })
            .returning();

          app.logger.info({ value }, 'Monthly target setting created successfully');
          return { value: parseFloat(created.value) };
        }
      } catch (error) {
        app.logger.error({ err: error, value }, 'Failed to update monthly target setting');
        throw error;
      }
    }
  );
}
