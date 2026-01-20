import { pgTable, uuid, text, timestamp, numeric, boolean, date } from 'drizzle-orm/pg-core';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  wipNumber: text('wip_number').notNull(),
  vehicleReg: text('vehicle_reg').notNull(),
  aw: numeric('aw').notNull(),
  notes: text('notes'),
  vhcStatus: text('vhc_status', { enum: ['GREEN', 'AMBER', 'RED', 'N/A'] }).default('N/A').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const schedule = pgTable('schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyWorkingHours: numeric('daily_working_hours').notNull().default('8.5'),
  saturdayWorking: boolean('saturday_working').default(false).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const technicianProfile = pgTable('technician_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  month: text('month').notNull(),
  absenceDate: date('absence_date').notNull(),
  daysCount: numeric('days_count'),
  isHalfDay: boolean('is_half_day').default(false).notNull(),
  customHours: numeric('custom_hours'),
  deductionType: text('deduction_type', { enum: ['MONTHLY_TARGET', 'AVAILABLE_HOURS'] }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
