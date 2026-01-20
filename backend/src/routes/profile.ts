import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import * as schema from '../db/schema.js';

// Add missing types if not already imported
// FastifyRequest and FastifyReply already imported above

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/profile - Returns technician profile
  fastify.get(
    '/api/profile',
    {
      schema: {
        description: 'Get technician profile',
        tags: ['profile'],
      },
    },
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Fetching technician profile');

      try {
        const profiles = await app.db.select().from(schema.technicianProfile).limit(1);

        if (profiles.length === 0) {
          app.logger.warn({}, 'No profile found');
          return reply.status(404).send({ error: 'Profile not found' });
        }

        const profile = profiles[0];
        app.logger.info({ name: profile.name }, 'Profile fetched');

        return {
          id: profile.id,
          name: profile.name,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch profile');
        throw error;
      }
    }
  );

  // PUT /api/profile - Update technician name
  fastify.put<{ Body: any }>(
    '/api/profile',
    {
      schema: {
        description: 'Update technician profile',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { name } = request.body as { name: string };

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        app.logger.warn({ name }, 'Invalid name provided');
        return reply.status(400).send({ error: 'Name is required and must be non-empty' });
      }

      app.logger.info({ name }, 'Updating technician profile');

      try {
        const profiles = await app.db.select().from(schema.technicianProfile).limit(1);

        if (profiles.length === 0) {
          // Create new profile
          const [newProfile] = await app.db
            .insert(schema.technicianProfile)
            .values({
              name: name.trim(),
            })
            .returning();

          app.logger.info({ id: newProfile.id }, 'Profile created');
          return {
            id: newProfile.id,
            name: newProfile.name,
            createdAt: newProfile.createdAt,
            updatedAt: newProfile.updatedAt,
          };
        }

        // Update existing profile
        const [updatedProfile] = await app.db
          .update(schema.technicianProfile)
          .set({
            name: name.trim(),
          })
          .returning();

        app.logger.info({ id: updatedProfile.id }, 'Profile updated');
        return {
          id: updatedProfile.id,
          name: updatedProfile.name,
          createdAt: updatedProfile.createdAt,
          updatedAt: updatedProfile.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to update profile');
        throw error;
      }
    }
  );
}
