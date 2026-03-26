import cron from 'node-cron';
import { deleteExpiredIdempotencyKeys } from '../db/api/idempotency.js';
import { syncOpenRouterUsage } from './openrouter.js';

export function startCronJobs() {
  // Sync OpenRouter usage every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Syncing OpenRouter usage...');
    try {
      const count = await syncOpenRouterUsage();
      console.log(`[cron] Synced ${count} usage records`);
    } catch (err) {
      console.error('[cron] OpenRouter sync failed:', err);
    }
  });

  // Remove expired idempotency key rows (TTL sweep)
  cron.schedule('15 * * * *', async () => {
    try {
      const removed = await deleteExpiredIdempotencyKeys();
      if (removed > 0) {
        console.log(`[cron] Removed ${removed} expired idempotency key row(s)`);
      }
    } catch (err) {
      console.error('[cron] Idempotency cleanup failed:', err);
    }
  });

  console.log('[cron] Jobs scheduled');
}
