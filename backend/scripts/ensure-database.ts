import 'dotenv/config';
import postgres from 'postgres';

function getTargetDbName(databaseUrl: string): string {
  const u = new URL(databaseUrl);
  const name = u.pathname.replace(/^\//, '').split('/')[0];
  if (!name) return 'postgres';
  return decodeURIComponent(name);
}

async function main() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const targetDb = getTargetDbName(databaseUrl);
  if (targetDb === 'postgres') {
    console.log('[db:ensure] DATABASE_URL uses database "postgres"; nothing to create.');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
    console.error(`[db:ensure] Unsupported database name (use only letters, digits, underscore): ${targetDb}`);
    process.exit(1);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const sql = postgres(adminUrl.toString(), { max: 1 });

  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${targetDb}) AS exists
    `;
    if (rows[0]?.exists) {
      console.log(`[db:ensure] Database "${targetDb}" already exists.`);
      return;
    }

    await sql.unsafe(`CREATE DATABASE "${targetDb}"`);
    console.log(`[db:ensure] Created database "${targetDb}".`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
