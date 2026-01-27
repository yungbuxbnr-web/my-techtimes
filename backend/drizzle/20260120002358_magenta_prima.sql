CREATE TABLE "schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_working_hours" numeric DEFAULT '8.5' NOT NULL,
	"saturday_working" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
ALTER TABLE "absences" ALTER COLUMN "days_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "aw" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "absence_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "custom_hours" numeric;--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "vhc_status" text DEFAULT 'N/A' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;