CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"state" text DEFAULT 'in_progress' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_scope_key_method_path_idx"
ON "idempotency_keys" USING btree ("scope","idempotency_key","method","path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx"
ON "idempotency_keys" USING btree ("expires_at");
