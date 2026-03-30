-- Add project approval status; default existing rows to 'approved' so they remain visible
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'approved';

-- Remove intents table (no backward compat needed)
ALTER TABLE "intents" DROP CONSTRAINT IF EXISTS "intents_created_project_id_projects_id_fk";
DROP TABLE IF EXISTS "intents";
