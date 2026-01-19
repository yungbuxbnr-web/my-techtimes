import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { gte, lte, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerExportRoutes(app: App) {
  const requireAuth = app.requireAuth();
  const fastify = app.fastify;

  // GET /api/jobs/export/csv?start=YYYY-MM-DD&end=YYYY-MM-DD - Returns CSV file
  fastify.get(
    '/api/jobs/export/csv',
    {
      schema: {
        description: 'Export jobs to CSV',
        tags: ['export'],
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
          required: ['start', 'end'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { start, end } = request.query as { start: string; end: string };

      app.logger.info({ start, end }, 'Exporting jobs to CSV');
      try {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        const jobs = await app.db
          .select()
          .from(schema.jobs)
          .where(and(gte(schema.jobs.createdAt, startDate), lte(schema.jobs.createdAt, endDate)));

        // Generate CSV content
        const headers = ['createdAt', 'wipNumber', 'vehicleReg', 'aw', 'minutes', 'notes'];
        const rows = jobs.map((job) => [
          new Date(job.createdAt).toISOString(),
          job.wipNumber,
          job.vehicleReg,
          job.aw.toString(),
          (job.aw * 5).toString(),
          job.notes || '',
        ]);

        const csv = [
          headers.join(','),
          ...rows.map((row) =>
            row
              .map((cell) => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(cell).replace(/"/g, '""');
                return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
              })
              .join(',')
          ),
        ].join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="jobs_${start}_to_${end}.csv"`);

        app.logger.info({ jobCount: jobs.length, start, end }, 'CSV export generated successfully');
        return csv;
      } catch (error) {
        app.logger.error({ err: error, start, end }, 'Failed to export CSV');
        throw error;
      }
    }
  );

  // GET /api/backup - Returns JSON file containing all jobs data
  fastify.get(
    '/api/backup',
    {
      schema: {
        description: 'Backup all jobs data',
        tags: ['backup'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, 'Creating backup of all jobs');
      try {
        const jobs = await app.db.select().from(schema.jobs);

        const backup = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          jobCount: jobs.length,
          jobs,
        };

        reply.header('Content-Type', 'application/json');
        reply.header(
          'Content-Disposition',
          `attachment; filename="techtimes_backup_${new Date().toISOString().split('T')[0]}.json"`
        );

        app.logger.info({ jobCount: jobs.length }, 'Backup created successfully');
        return backup;
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to create backup');
        throw error;
      }
    }
  );

  // POST /api/restore - Validates and imports jobs
  fastify.post(
    '/api/restore',
    {
      schema: {
        description: 'Restore jobs from backup',
        tags: ['backup'],
        querystring: {
          type: 'object',
          properties: {
            confirm: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            exportedAt: { type: 'string' },
            jobCount: { type: 'number' },
            jobs: {
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
          required: ['jobs'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { confirm } = request.query as { confirm?: string };
      const { jobs: backupJobs } = request.body as {
        version?: string;
        exportedAt?: string;
        jobCount?: number;
        jobs: any[];
      };

      app.logger.info({ jobCount: backupJobs.length, confirmed: confirm === 'true' }, 'Processing restore request');

      if (!backupJobs || !Array.isArray(backupJobs)) {
        app.logger.warn({}, 'Invalid backup format - jobs array missing');
        return reply.status(400).send({
          error: 'Invalid backup format - jobs array required',
        });
      }

      if (confirm !== 'true') {
        app.logger.info({ jobCount: backupJobs.length }, 'Restore not confirmed');
        return reply.status(400).send({
          error: 'Restore must be confirmed with ?confirm=true',
          preview: {
            jobsToRestore: backupJobs.length,
            willOverwrite: true,
          },
        });
      }

      try {
        // Validate all jobs first
        for (const job of backupJobs) {
          if (!job.wipNumber || !job.vehicleReg || job.aw === undefined) {
            app.logger.warn({ job }, 'Invalid job in backup - missing required fields');
            return reply.status(400).send({
              error: `Invalid job in backup - missing required fields: ${JSON.stringify(job)}`,
            });
          }

          if (!/^\d{5}$/.test(job.wipNumber)) {
            app.logger.warn({ wipNumber: job.wipNumber }, 'Invalid WIP number format in backup');
            return reply.status(400).send({
              error: `Invalid WIP number format: ${job.wipNumber}`,
            });
          }

          if (job.aw < 0 || job.aw > 100) {
            app.logger.warn({ aw: job.aw }, 'Invalid AW value in backup');
            return reply.status(400).send({
              error: `Invalid AW value: ${job.aw}`,
            });
          }
        }

        // Delete existing jobs and insert backup jobs
        await app.db.transaction(async (tx) => {
          // Delete all existing jobs
          await tx.delete(schema.jobs);

          // Insert backup jobs with their original IDs and timestamps
          if (backupJobs.length > 0) {
            await tx.insert(schema.jobs).values(
              backupJobs.map((job) => ({
                id: job.id,
                wipNumber: job.wipNumber,
                vehicleReg: job.vehicleReg.toUpperCase(),
                aw: job.aw,
                notes: job.notes || null,
                createdAt: new Date(job.createdAt),
              }))
            );
          }
        });

        app.logger.info({ jobCount: backupJobs.length }, 'Restore completed successfully');
        return {
          success: true,
          jobsRestored: backupJobs.length,
        };
      } catch (error) {
        app.logger.error({ err: error, jobCount: backupJobs.length }, 'Failed to restore backup');
        throw error;
      }
    }
  );
}
