ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'activity' NOT NULL;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "provider_request_id" text;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "request_count" integer;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "reasoning_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "cached_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "cache_write_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "audio_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "upstream_inference_cost_usd" numeric(10, 6);
