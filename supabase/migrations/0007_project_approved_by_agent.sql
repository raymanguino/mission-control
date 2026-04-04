ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "approved_by_agent_id" uuid;
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_approved_by_agent_id_agents_id_fk";
ALTER TABLE "projects" ADD CONSTRAINT "projects_approved_by_agent_id_agents_id_fk" FOREIGN KEY ("approved_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
