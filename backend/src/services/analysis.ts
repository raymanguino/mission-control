import { listFoodLogs, listMarijuanaSessions, listSleepLogs } from '../db/api/wellness.js';
import { generateText } from './ai/generate.js';

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

export async function analyzeHealthData(params: {
  goal: string;
  goals?: string[];
}): Promise<{
  insights: string;
  generatedAt: string;
  goal: string;
  provider: 'openrouter' | 'anthropic' | 'system';
  model: string;
  workload: 'balanced_analysis';
  fallbackUsed?: boolean;
}> {
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
        `Not enough data yet to evaluate this goal: "${params.goal}". Log at least a few days of sleep, cannabis sessions, and meals to get personalized insights.`,
      generatedAt: new Date().toISOString(),
      goal: params.goal,
      provider: 'system',
      model: 'rule-based',
      workload: 'balanced_analysis',
      fallbackUsed: false,
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

  const allGoals = [params.goal, ...(params.goals ?? []).filter((g) => g.trim() && g !== params.goal)];
  const goalContext = allGoals.map((g, idx) => `${idx + 1}. ${g}`).join('\n');
  const prompt = `You are analyzing 30 days of personal health and lifestyle data for a single user. Your job is to find meaningful, specific correlations and give actionable, personalized recommendations — not generic health advice.

Data period: ${fromStr} to ${toStr}
Primary goal: ${params.goal}
All active goals:
${goalContext}

--- SLEEP LOGS (most recent first) ---
${sleepSection}

--- CANNABIS SESSIONS ---
${marijuanaSection}

--- FOOD LOGS ---
${foodSection}

Analyze this data and respond with:

1. **Goal Answer** — directly answer the primary goal using specific evidence from this data.

2. **Sleep Patterns** — summarize sleep quality and duration trends with specific data points (e.g., "Average sleep duration is X hours, quality scores average Y/5").

3. **Cannabis & Sleep Correlation** — focus on patterns between timing of the last cannabis session each night and the quality/duration of sleep that followed. Cite dates or counts when possible.

4. **Food & Sleep Correlation** — note patterns between late eating and sleep quality, or meal patterns that correlate with better/worse nights.

5. **Recommendations For This Goal** — give 2-4 specific, actionable suggestions based on this person's actual data and the primary goal. Include specific times if the data supports it.

6. **What to Track Next** — suggest what additional data would most improve confidence for this goal.

Keep the tone direct and data-driven. Use bullet points within each section. If there are fewer than 5 data points for any correlation, note that you need more data to be confident.`;

  const generated = await generateText({
    feature: 'wellness.analysis',
    workload: 'balanced_analysis',
    prompt,
    maxTokens: 1500,
    temperature: 0.2,
  });

  return {
    insights: generated.text,
    generatedAt: new Date().toISOString(),
    goal: params.goal,
    provider: generated.provider,
    model: generated.model,
    workload: 'balanced_analysis',
    fallbackUsed: generated.fallbackUsed,
  };
}
