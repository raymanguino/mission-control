-- Rename Member → Engineer; new default for org_role
UPDATE "agents" SET "org_role" = 'engineer' WHERE "org_role" = 'member';
ALTER TABLE "agents" ALTER COLUMN "org_role" SET DEFAULT 'engineer';
