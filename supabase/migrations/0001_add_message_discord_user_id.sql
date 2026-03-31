ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "discord_user_id" text;
