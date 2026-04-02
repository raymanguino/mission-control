-- Per-agent webhook for Mission Control → agent HTTP notifications (task assigned, etc.)
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "hook_url" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "hook_token" text;
