import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  wipNumber: text('wip_number').notNull(),
  vehicleReg: text('vehicle_reg').notNull(),
  aw: integer('aw').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
