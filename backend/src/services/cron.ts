import cron from 'node-cron';
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

  console.log('[cron] Jobs scheduled');
}
