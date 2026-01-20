import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import * as schema from '../db/schema.js';

// Add missing types if not already imported
// FastifyRequest and FastifyReply already imported above

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/profile - Returns technician profile
  // Accessible without authentication to support setup flow
  fastify.get(
    '/api/profile',
    {
      schema: {
        description: 'Get technician profile (accessible during setup)',
        tags: ['profile'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      app.logger.info({}, 'Fetching technician profile');

      try {
        const profiles = await app.db.select().from(schema.technicianProfile).limit(1);

        if (profiles.length === 0) {
          app.logger.info({}, 'No profile found - returning default for setup');
          return {
            id: null,
            name: null,
            exists: false,
          };
        }

        const profile = profiles[0];
        app.logger.info({ name: profile.name }, 'Profile fetched');

        return {
          id: profile.id,
          name: profile.name,
          exists: true,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to fetch profile');
        throw error;
      }
    }
  );

  // PUT /api/profile - Update/Create technician name
  // Accessible without authentication for initial setup, requires auth for updates
  fastify.put<{ Body: any }>(
    '/api/profile',
    {
      schema: {
        description: 'Update/Create technician profile (first creation does not require auth)',
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
      const { name } = request.body as { name: string };

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        app.logger.warn({ name }, 'Invalid name provided');
        return reply.status(400).send({ error: 'Name is required and must be non-empty' });
      }

      app.logger.info({ name }, 'Processing profile update/creation');

      try {
        const profiles = await app.db.select().from(schema.technicianProfile).limit(1);

        if (profiles.length === 0) {
          // Initial profile creation - allow without authentication
          app.logger.info({ name }, 'Creating initial profile (setup flow)');
          const [newProfile] = await app.db
            .insert(schema.technicianProfile)
            .values({
              name: name.trim(),
            })
            .returning();

          app.logger.info({ id: newProfile.id }, 'Initial profile created successfully');
          return {
            id: newProfile.id,
            name: newProfile.name,
            isInitialSetup: true,
            createdAt: newProfile.createdAt,
            updatedAt: newProfile.updatedAt,
          };
        }

        // Updating existing profile - require authentication
        const session = await requireAuth(request, reply);
        if (!session) {
          app.logger.warn({}, 'Attempt to update profile without authentication');
          return;
        }

        app.logger.info({ profileId: profiles[0].id }, 'Updating existing profile (authenticated)');
        const [updatedProfile] = await app.db
          .update(schema.technicianProfile)
          .set({
            name: name.trim(),
          })
          .returning();

        app.logger.info({ id: updatedProfile.id }, 'Profile updated successfully');
        return {
          id: updatedProfile.id,
          name: updatedProfile.name,
          isInitialSetup: false,
          createdAt: updatedProfile.createdAt,
          updatedAt: updatedProfile.updatedAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to update/create profile');
        throw error;
      }
    }
  );
}
