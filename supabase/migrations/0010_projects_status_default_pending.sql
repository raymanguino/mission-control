-- New projects should require approval; 0008 used DEFAULT 'approved' for backfill only.
ALTER TABLE "projects"
  ALTER COLUMN "status" SET DEFAULT 'pending_approval';
