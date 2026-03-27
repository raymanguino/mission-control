ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "from_mission_control" boolean DEFAULT false NOT NULL;
