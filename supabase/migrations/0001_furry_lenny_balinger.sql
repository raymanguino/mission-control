CREATE TABLE IF NOT EXISTS "food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_type" text NOT NULL,
	"description" text NOT NULL,
	"calories" integer,
	"protein" numeric(6, 1),
	"carbs" numeric(6, 1),
	"fat" numeric(6, 1),
	"logged_at" timestamp NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marijuana_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form" text NOT NULL,
	"strain" text,
	"amount" numeric(6, 2),
	"unit" text,
	"notes" text,
	"session_at" timestamp NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sleep_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_time" timestamp NOT NULL,
	"wake_time" timestamp,
	"quality_score" smallint,
	"notes" text,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
