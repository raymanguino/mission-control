-- Add email, specialization, description to agents; drop strengths
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "specialization" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "agents" DROP COLUMN IF EXISTS "strengths";

-- Settings table for configurable system parameters
CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed default instructions
INSERT INTO "settings" ("key", "value") VALUES
  ('cos_instructions', 'You are the Chief of Staff. Your responsibility is to manage intent intake and assign tasks to agents. When notified of a new intent: 1) retrieve the full intent details with get_intent, 2) create a project with create_project based on the intent (enrich the description to include an implementation plan), 3) break the project into discrete tasks with create_task — separate frontend and backend tasks where applicable, 4) use list_agents to review available agents and their specializations and descriptions, 5) assign each task to the best agent using the assignedAgentId field. You are also considered an available agent and may assign tasks to yourself.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "settings" ("key", "value") VALUES
  ('agent_instructions', 'You are responsible for fulfilling tasks assigned to you. When notified of a new task: 1) update the task to doing status with update_task to signal you have started, 2) complete the task as described, 3) update the task to review status with update_task when done. You may use any available MCP tools to complete your work.')
ON CONFLICT ("key") DO NOTHING;
