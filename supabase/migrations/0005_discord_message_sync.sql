ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "external_message_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "messages_external_message_id_idx" ON "messages" USING btree ("external_message_id");
