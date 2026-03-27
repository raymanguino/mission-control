ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "org_role" text DEFAULT 'member' NOT NULL;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "strengths" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "reports_to_agent_id" uuid;
DO $$ BEGIN
  ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agent_id_agents_id_fk" FOREIGN KEY ("reports_to_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_project_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "intents" ADD CONSTRAINT "intents_created_project_id_projects_id_fk" FOREIGN KEY ("created_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
