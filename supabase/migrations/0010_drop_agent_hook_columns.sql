-- Role-based webhooks use MC_WEBHOOK_BASE_URL + MC_WEBHOOK_TOKEN; per-agent hook URL/token removed.
ALTER TABLE "agents" DROP COLUMN IF EXISTS "hook_url";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "hook_token";
