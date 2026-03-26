ALTER TABLE "usage_records" ADD COLUMN "source" text DEFAULT 'activity' NOT NULL;
ALTER TABLE "usage_records" ADD COLUMN "provider_request_id" text;
ALTER TABLE "usage_records" ADD COLUMN "request_count" integer;
ALTER TABLE "usage_records" ADD COLUMN "reasoning_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN "cached_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN "cache_write_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN "audio_tokens" integer;
ALTER TABLE "usage_records" ADD COLUMN "upstream_inference_cost_usd" numeric(10, 6);
