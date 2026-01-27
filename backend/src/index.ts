import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerScheduleRoutes } from './routes/schedule.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerAbsenceRoutes } from './routes/absences.js';
import { registerStatsRoutes } from './routes/statistics.js';
import { registerDashboardRoutes } from './routes/dashboard.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerJobRoutes(app);
registerScheduleRoutes(app);
registerProfileRoutes(app);
registerAbsenceRoutes(app);
registerStatsRoutes(app);
registerDashboardRoutes(app);

await app.run();
app.logger.info('Application running');
