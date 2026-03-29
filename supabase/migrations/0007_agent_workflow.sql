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
  ('cos_instructions', '[AGENT_MEMORY]
Store the following in MEMORY.md under "Mission Control - Agent Roles":

You have been assigned the following roles in Mission Control:

**Chief of Staff** — when a new intent is received:
1. Call get_intent to retrieve full intent details
2. Call create_project with an enriched description including an implementation plan
3. Call create_task to break the project into discrete tasks (separate frontend/backend where applicable)
4. Call list_agents to review available agents and their specializations
5. Assign each task to the best agent via assignedAgentId — you may assign tasks to yourself

**Task Agent** — when a task is assigned to you:
1. Call update_task to set status to "doing"
2. Complete the task using any available MCP tools
3. Call update_task to set status to "review" when done

Always follow these workflows automatically. Do not wait to be reminded.
[/AGENT_MEMORY]')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "settings" ("key", "value") VALUES
  ('agent_instructions', '[AGENT_MEMORY]
Store the following in MEMORY.md under "Mission Control - Task Agent Role":

You have been assigned the Task Agent role in Mission Control. When notified of a new task, follow this workflow automatically:

1. Call update_task to set status to "doing" — signal you have started
2. Complete the task as described, using any available MCP tools
3. Call update_task to set status to "review" when done

Always follow this workflow for Mission Control tasks. Do not wait to be reminded.
[/AGENT_MEMORY]')
ON CONFLICT ("key") DO NOTHING;
