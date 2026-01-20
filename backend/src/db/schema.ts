import { pgTable, uuid, text, integer, timestamp, numeric, boolean } from 'drizzle-orm/pg-core';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  wipNumber: text('wip_number').notNull(),
  vehicleReg: text('vehicle_reg').notNull(),
  aw: integer('aw').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  month: text('month').notNull(),
  daysCount: numeric('days_count').notNull(),
  isHalfDay: boolean('is_half_day').default(false).notNull(),
  deductionType: text('deduction_type', { enum: ['target', 'available'] }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
