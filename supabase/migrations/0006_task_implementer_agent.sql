ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "implementer_agent_id" uuid;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_implementer_agent_id_agents_id_fk";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_implementer_agent_id_agents_id_fk" FOREIGN KEY ("implementer_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
