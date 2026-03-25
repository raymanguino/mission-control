import Anthropic from '@anthropic-ai/sdk';
import { listFoodLogs, listMarijuanaSessions, listSleepLogs } from '../db/api/wellness.js';

const client = new Anthropic();

function formatTime(ts: string | Date | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function durationHours(start: string | Date | null, end: string | Date | null): string {
  if (!start || !end) return 'N/A';
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60 / 60;
  return `${diff.toFixed(1)}h`;
}

export async function analyzeHealthData(): Promise<{
  insights: string;
  generatedAt: string;
}> {
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  const openAiKeyFromEnv = process.env['OPENAI_API_KEY'];
  const openRouterKey = process.env['OPENROUTER_API_KEY'];
  const openAiCompatibleFallback =
    !openAiKeyFromEnv && openRouterKey?.startsWith('sk-proj-') ? openRouterKey : undefined;
  const effectiveOpenAiKey = openAiKeyFromEnv ?? openAiCompatibleFallback;
  if (!effectiveOpenAiKey && !anthropicApiKey) {
    throw new Error('Analysis unavailable: missing OPENAI_API_KEY and ANTHROPIC_API_KEY');
  }

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = now.toISOString().slice(0, 10);

  const [foodData, marijuanaData, sleepData] = await Promise.all([
    listFoodLogs({ from: fromStr, to: toStr }),
    listMarijuanaSessions({ from: fromStr, to: toStr }),
    listSleepLogs({ from: fromStr, to: toStr }),
  ]);

  if (sleepData.length === 0 && marijuanaData.length === 0 && foodData.length === 0) {
    return {
      insights:
        'Not enough data yet. Log at least a few days of sleep, cannabis sessions, and meals to get personalized insights.',
      generatedAt: new Date().toISOString(),
    };
  }

  // Format sleep data
  const sleepSection =
    sleepData.length === 0
      ? 'No sleep data logged.'
      : sleepData
          .map((s) => {
            const duration = durationHours(s.bedTime, s.wakeTime);
            return `  ${s.date} | Bed: ${formatTime(s.bedTime)} | Wake: ${formatTime(s.wakeTime)} | Duration: ${duration} | Quality: ${s.qualityScore ?? '?'}/5${s.notes ? ` | Notes: ${s.notes}` : ''}`;
          })
          .join('\n');

  // Format marijuana data
  const marijuanaSection =
    marijuanaData.length === 0
      ? 'No cannabis sessions logged.'
      : marijuanaData
          .map((m) => {
            const amount = m.amount ? `${m.amount}${m.unit ?? ''}` : 'unspecified amount';
            return `  ${m.date} | ${formatTime(m.sessionAt)} | Form: ${m.form}${m.strain ? ` | Strain: ${m.strain}` : ''} | Amount: ${amount}${m.notes ? ` | Notes: ${m.notes}` : ''}`;
          })
          .join('\n');

  // Format food data — group by date for readability
  const foodByDate = new Map<string, typeof foodData>();
  for (const f of foodData) {
    if (!foodByDate.has(f.date)) foodByDate.set(f.date, []);
    foodByDate.get(f.date)!.push(f);
  }
  const foodSection =
    foodData.length === 0
      ? 'No food data logged.'
      : Array.from(foodByDate.entries())
          .map(([date, items]) => {
            const meals = items
              .map((f) => {
                const cals = f.calories ? `${f.calories} kcal` : '';
                return `    ${formatTime(f.loggedAt)} [${f.mealType}] ${f.description}${cals ? ` (${cals})` : ''}`;
              })
              .join('\n');
            return `  ${date}:\n${meals}`;
          })
          .join('\n');

  const prompt = `You are analyzing 30 days of personal health and lifestyle data for a single user. Your job is to find meaningful, specific correlations and give actionable, personalized recommendations — not generic health advice.

Data period: ${fromStr} to ${toStr}

--- SLEEP LOGS (most recent first) ---
${sleepSection}

--- CANNABIS SESSIONS ---
${marijuanaSection}

--- FOOD LOGS ---
${foodSection}

Analyze this data and respond with:

1. **Sleep Patterns** — summarize the user's sleep quality and duration trends with specific data points (e.g., "Your average sleep duration is X hours, and quality scores average Y/5").

2. **Cannabis & Sleep Correlation** — this is the most important section. Look for specific patterns between the timing of the last cannabis session each night and the quality/duration of sleep that followed. Be specific: cite actual dates or counts (e.g., "On 4 of the 6 nights you used after 2am, your quality score was 2 or lower vs. averaging 3.8 when you stopped before midnight"). If there's not enough data to find a pattern, say so honestly.

3. **Food & Sleep Correlation** — note any patterns between late eating and sleep quality, or meal patterns that seem to correlate with better/worse nights.

4. **Recommendations** — give 2–4 specific, actionable suggestions based on this person's actual data. Include specific times if the data supports it (e.g., "Try moving your last session to before 11:30pm based on your patterns"). Never recommend stopping use — only timing/moderation adjustments.

5. **What to Track Next** — suggest what additional data would most improve the analysis quality.

Keep the tone direct and data-driven. Use bullet points within each section. If there are fewer than 5 data points for any correlation, note that you need more data to be confident.`;

  let text = '';
  if (effectiveOpenAiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveOpenAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI analysis API returned ${res.status}: ${errorText}`);
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .filter((p) => p.type === 'text' && typeof p.text === 'string')
              .map((p) => p.text)
              .join('\n')
          : '';
  } else {
    let message: Awaited<ReturnType<typeof client.messages.create>>;
    try {
      message = await client.messages.create({
        model: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      throw err;
    }

    text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }

  return {
    insights: text,
    generatedAt: new Date().toISOString(),
  };
}
