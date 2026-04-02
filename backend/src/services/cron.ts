import cron from 'node-cron';
import { deleteExpiredIdempotencyKeys } from '../db/api/idempotency.js';
import { sweepAgentPresence } from './agentPresence.js';
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

  // Agent presence: heartbeat vs MCP work (intervals from settings; defaults in agentPresenceConfig)
  cron.schedule('*/1 * * * *', async () => {
    try {
      const result = await sweepAgentPresence();
      if (result.updated > 0) {
        console.log(
          `[cron] Agent presence: updated ${result.updated} agent(s) (activity→idle≤${result.activityStaleToIdleMinutes}m, idle→offline +${result.idleToOfflineMinutes}m)`,
        );
      }
    } catch (err) {
      console.error('[cron] Agent presence sweep failed:', err);
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
