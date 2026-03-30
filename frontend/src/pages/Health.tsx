import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import type {
  FoodLog,
  MarijuanaSession,
  SleepLog,
  HealthAnalysis,
  NutritionEstimate,
} from '@mission-control/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowLocalISO() {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16); // datetime-local format
}

function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt12(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function sleepDuration(bedTime: string, wakeTime: string | null): string {
  if (!wakeTime) return '—';
  const h = (new Date(wakeTime).getTime() - new Date(bedTime).getTime()) / 3_600_000;
  return `${h.toFixed(1)}h`;
}

// ─── Daily Log sections ───────────────────────────────────────────────────────

export function SleepSection({
  date,
  sleepLogs,
  onUpsert,
  onRefresh,
  openAddFromUrl,
  onConsumeOpenAddFromUrl,
}: {
  date: string;
  sleepLogs: SleepLog[];
  onUpsert: (log: SleepLog) => void;
  onRefresh: () => void;
  openAddFromUrl?: boolean;
  onConsumeOpenAddFromUrl?: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editLog, setEditLog] = useState<SleepLog | null>(null);

  useEffect(() => {
    if (openAddFromUrl) {
      setShowAdd(true);
    }
  }, [openAddFromUrl]);
  const todayLogs = sleepLogs.filter((s) => s.date === date);

  async function handleDelete(id: string) {
    await api.delete(`/api/health/sleep/${id}`);
    onRefresh();
  }

  return (
    <Section
      title="Sleep"
      icon="🌙"
      onAdd={() => setShowAdd(true)}
      bodyClassName="max-h-80 overflow-y-auto"
    >
      {todayLogs.length === 0 && <Empty>No sleep logged for this date.</Empty>}
      {todayLogs.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
        >
          <div>
            <span className="text-sm text-white">
              {fmt12(s.bedTime)} → {s.wakeTime ? fmt12(s.wakeTime) : 'ongoing'}
            </span>
            <span className="ml-2 text-xs text-gray-500">{sleepDuration(s.bedTime, s.wakeTime)}</span>
            {s.qualityScore && (
              <span className="ml-2 text-xs text-yellow-400">
                {'★'.repeat(s.qualityScore)}{'☆'.repeat(5 - s.qualityScore)}
              </span>
            )}
            {s.notes && <p className="text-xs text-gray-500 mt-0.5">{s.notes}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditLog(s)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="text-xs text-red-600 hover:text-red-400"
            >
              Del
            </button>
          </div>
        </div>
      ))}
      {showAdd && (
        <SleepModal
          date={date}
          onClose={() => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
          }}
          onSaved={(saved) => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
            onUpsert(saved);
            onRefresh();
          }}
        />
      )}
      {editLog && (
        <SleepModal
          date={date}
          existing={editLog}
          onClose={() => setEditLog(null)}
          onSaved={(saved) => {
            setEditLog(null);
            onUpsert(saved);
            onRefresh();
          }}
        />
      )}
    </Section>
  );
}

function SleepModal({
  date,
  existing,
  onClose,
  onSaved,
}: {
  date: string;
  existing?: SleepLog;
  onClose: () => void;
  onSaved: (saved: SleepLog) => void;
}) {
  const defaultBed = existing
    ? toLocalDateTimeInput(existing.bedTime)
    : nowLocalISO();
  const [bedTime, setBedTime] = useState(defaultBed);
  const [wakeTime, setWakeTime] = useState(
    existing ? (existing.wakeTime ? toLocalDateTimeInput(existing.wakeTime) : nowLocalISO()) : '',
  );
  const [quality, setQuality] = useState(existing?.qualityScore?.toString() ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  async function submit() {
    const payload = {
      bedTime: new Date(bedTime).toISOString(),
      wakeTime: wakeTime ? new Date(wakeTime).toISOString() : null,
      qualityScore: quality ? Number(quality) : null,
      notes: notes || null,
      date,
    };
    const saved = existing
      ? await api.patch<SleepLog>(`/api/health/sleep/${existing.id}`, payload)
      : await api.post<SleepLog>('/api/health/sleep', payload);
    onSaved(saved);
  }

  return (
    <Modal title={existing ? 'Edit Sleep' : 'Log Sleep'} onClose={onClose}>
      <Field label="Bed time">
        <Input type="datetime-local" value={bedTime} onChange={setBedTime} />
      </Field>
      <Field label="Wake time (leave blank if ongoing)">
        <Input type="datetime-local" value={wakeTime} onChange={setWakeTime} />
      </Field>
      <Field label="Quality (1–5)">
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
        >
          <option value="">— not rated —</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} — {['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'][n - 1]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={setNotes} />
      </Field>
      <ModalFooter onCancel={onClose} onSave={submit} />
    </Modal>
  );
}

export function FoodSection({
  date,
  foodLogs,
  onRefresh,
  openAddFromUrl,
  onConsumeOpenAddFromUrl,
}: {
  date: string;
  foodLogs: FoodLog[];
  onRefresh: () => void;
  openAddFromUrl?: boolean;
  onConsumeOpenAddFromUrl?: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (openAddFromUrl) {
      setShowAdd(true);
    }
  }, [openAddFromUrl]);
  const todayLogs = foodLogs.filter((f) => f.date === date);
  const totalCals = todayLogs.reduce((s, f) => s + (f.calories ?? 0), 0);

  async function handleDelete(id: string) {
    await api.delete(`/api/health/food/${id}`);
    onRefresh();
  }

  return (
    <Section
      title="Food"
      icon="🍽️"
      onAdd={() => setShowAdd(true)}
      badge={totalCals ? `${totalCals} kcal` : undefined}
      bodyClassName="max-h-80 overflow-y-auto"
    >
      {todayLogs.length === 0 && <Empty>No meals logged for this date.</Empty>}
      {todayLogs.map((f) => (
        <div
          key={f.id}
          className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0"
        >
          <div>
            <span className="text-xs text-indigo-400 uppercase tracking-wide mr-2">
              {f.mealType}
            </span>
            <span className="text-sm text-white">{f.description}</span>
            <div className="text-xs text-gray-500 mt-0.5">
              {fmt12(f.loggedAt)}
              {f.calories && <span className="ml-2">{f.calories} kcal</span>}
              {f.protein != null && <span className="ml-2">P {f.protein}g</span>}
              {f.carbs != null && <span className="ml-2">C {f.carbs}g</span>}
              {f.fat != null && <span className="ml-2">F {f.fat}g</span>}
            </div>
            {f.notes && (
              <p className="text-xs text-gray-400 mt-0.5 italic">
                <span className="not-italic text-gray-500">Note:</span> {f.notes}
              </p>
            )}
          </div>
          <button
            onClick={() => handleDelete(f.id)}
            className="text-xs text-red-600 hover:text-red-400 shrink-0"
          >
            Del
          </button>
        </div>
      ))}
      {showAdd && (
        <FoodModal
          date={date}
          onClose={() => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
          }}
          onSaved={() => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
            onRefresh();
          }}
        />
      )}
    </Section>
  );
}

function FoodModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<string>('snack');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [loggedAt, setLoggedAt] = useState(nowLocalISO);
  const [notes, setNotes] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimateSource, setEstimateSource] = useState<NutritionEstimate | null>(null);

  async function estimate() {
    if (!description.trim()) return;
    setEstimating(true);
    setEstimateError('');

    try {
      const result = await api.post<NutritionEstimate>('/api/health/food/estimate', {
        description: description.trim(),
      });
      setCalories(String(result.calories));
      setProtein(String(result.protein));
      setCarbs(String(result.carbs));
      setFat(String(result.fat));
      setEstimateSource(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      const apiJsonMatch = errorMessage.match(/API error \d+:\s*(\{[\s\S]*\})/);
      let backendReason = '';
      if (apiJsonMatch?.[1]) {
        try {
          const parsed = JSON.parse(apiJsonMatch[1]) as { error?: unknown };
          if (typeof parsed.error === 'string') backendReason = parsed.error;
        } catch {
          // no-op: fallback to generic parse below
        }
      }
      if (
        backendReason.includes('missing OPENROUTER_API_KEY') ||
        backendReason.includes('missing ANTHROPIC_API_KEY')
      ) {
        setEstimateError(
          'Nutrition estimation is not configured. Add OPENROUTER_API_KEY and/or ANTHROPIC_API_KEY to backend/.env and restart the backend.',
        );
      } else if (backendReason.includes('credit balance is too low')) {
        setEstimateError(
          'Nutrition estimation is temporarily unavailable because the AI provider account has no credits. Add billing credits or configure a fallback provider in backend/.env, then restart backend.',
        );
      } else if (backendReason) {
        setEstimateError(backendReason);
      } else if (errorMessage) {
        setEstimateError(errorMessage);
      } else {
        setEstimateError('Unable to estimate nutrition right now.');
      }
      setEstimateSource(null);
    } finally {
      setEstimating(false);
    }
  }

  async function submit() {
    if (!description.trim()) return;
    await api.post('/api/health/food', {
      mealType,
      description: description.trim(),
      calories: calories ? Number(calories) : null,
      protein: protein !== '' ? Number(protein) : null,
      carbs: carbs !== '' ? Number(carbs) : null,
      fat: fat !== '' ? Number(fat) : null,
      loggedAt: new Date(loggedAt).toISOString(),
      date,
      notes: notes || null,
    });
    onSaved();
  }

  return (
    <Modal title="Log Meal" onClose={onClose}>
      <Field label="Meal type">
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
        >
          {['breakfast', 'lunch', 'dinner', 'snack'].map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <Input value={description} onChange={setDescription} autoFocus placeholder="e.g. Chicken salad with avocado" />
      </Field>
      <div className="flex items-center justify-between -mt-1">
        <button
          onClick={estimate}
          disabled={!description.trim() || estimating}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs rounded-md border border-gray-700"
        >
          {estimating ? 'Estimating…' : 'Estimate Nutrition'}
        </button>
        {estimateSource && (
          <span className="text-xs text-gray-400">
            Source: {estimateSource.provider}/{estimateSource.model}
          </span>
        )}
      </div>
      {estimateError && <p className="text-xs text-red-400">{estimateError}</p>}
      <Field label="Time">
        <Input type="datetime-local" value={loggedAt} onChange={setLoggedAt} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories">
          <Input type="number" value={calories} onChange={setCalories} placeholder="kcal" />
        </Field>
        <Field label="Protein (g)">
          <Input type="number" value={protein} onChange={setProtein} />
        </Field>
        <Field label="Carbs (g)">
          <Input type="number" value={carbs} onChange={setCarbs} />
        </Field>
        <Field label="Fat (g)">
          <Input type="number" value={fat} onChange={setFat} />
        </Field>
      </div>
      <Field label="Notes">
        <Input value={notes} onChange={setNotes} />
      </Field>
      <ModalFooter onCancel={onClose} onSave={submit} />
    </Modal>
  );
}

export function CannabisSection({
  date,
  sessions,
  onRefresh,
  openAddFromUrl,
  onConsumeOpenAddFromUrl,
}: {
  date: string;
  sessions: MarijuanaSession[];
  onRefresh: () => void;
  openAddFromUrl?: boolean;
  onConsumeOpenAddFromUrl?: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (openAddFromUrl) {
      setShowAdd(true);
    }
  }, [openAddFromUrl]);
  const todaySessions = sessions.filter((s) => s.date === date);

  async function handleDelete(id: string) {
    await api.delete(`/api/health/marijuana/${id}`);
    onRefresh();
  }

  return (
    <Section
      title="Greens"
      icon="🌿"
      onAdd={() => setShowAdd(true)}
      bodyClassName="max-h-80 overflow-y-auto"
    >
      {todaySessions.length === 0 && <Empty>No sessions logged for this date.</Empty>}
      {todaySessions.map((s) => (
        <div
          key={s.id}
          className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0"
        >
          <div>
            <span className="text-sm text-white">
              {fmt12(s.sessionAt)}{' '}
              <span className="text-gray-400 text-xs">{s.form}</span>
            </span>
            <div className="text-xs text-gray-500 mt-0.5">
              {s.strain && <span className="mr-2">{s.strain}</span>}
              {s.amount && (
                <span>
                  {s.amount}
                  {s.unit ?? ''}
                </span>
              )}
              {s.notes && <span className="ml-2 italic">{s.notes}</span>}
            </div>
          </div>
          <button
            onClick={() => handleDelete(s.id)}
            className="text-xs text-red-600 hover:text-red-400 shrink-0"
          >
            Del
          </button>
        </div>
      ))}
      {showAdd && (
        <CannabisModal
          date={date}
          onClose={() => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
          }}
          onSaved={() => {
            setShowAdd(false);
            onConsumeOpenAddFromUrl?.();
            onRefresh();
          }}
        />
      )}
    </Section>
  );
}

function CannabisModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<string>('flower');
  const [strain, setStrain] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('hits');
  const [sessionAt, setSessionAt] = useState(nowLocalISO);
  const [notes, setNotes] = useState('');

  async function submit() {
    await api.post('/api/health/marijuana', {
      form,
      strain: strain || null,
      amount: amount || null,
      unit: unit || null,
      notes: notes || null,
      sessionAt: new Date(sessionAt).toISOString(),
      date,
    });
    onSaved();
  }

  return (
    <Modal title="Log Session" onClose={onClose}>
      <Field label="Form">
        <select
          value={form}
          onChange={(e) => setForm(e.target.value)}
          className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
        >
          {['flower', 'vape', 'edible', 'tincture', 'other'].map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Time">
        <Input type="datetime-local" value={sessionAt} onChange={setSessionAt} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <Input type="number" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Unit">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
          >
            {['hits', 'g', 'mg', 'ml'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Strain (optional)">
        <Input value={strain} onChange={setStrain} placeholder="e.g. Blue Dream" />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={setNotes} />
      </Field>
      <ModalFooter onCancel={onClose} onSave={submit} />
    </Modal>
  );
}

// ─── AI Insights tab ───────────────────────────────────────────────────────────

const presetInsightGoals = [
  'Understand what sleep and cannabis timing patterns are reducing my sleep quality.',
  'Find whether meal timing is affecting sleep duration and quality.',
  'Identify practical timing changes I can make this week to improve recovery.',
];

type InsightTrendPoint = {
  date: string;
  sleepDuration: number | null;
  sleepQuality: number | null;
  meals: number;
  cannabis: number;
};

function buildInsightTrendData(
  sleepLogs: SleepLog[],
  foodLogs: FoodLog[],
  marijuanaSessions: MarijuanaSession[],
): InsightTrendPoint[] {
  const points: InsightTrendPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const daySleep = sleepLogs.filter((s) => s.date === date);
    const dayFood = foodLogs.filter((f) => f.date === date);
    const dayCannabis = marijuanaSessions.filter((m) => m.date === date);

    const sleepDurations = daySleep
      .filter((s) => Boolean(s.wakeTime))
      .map((s) => (new Date(s.wakeTime as string).getTime() - new Date(s.bedTime).getTime()) / 3_600_000)
      .filter((hours) => Number.isFinite(hours) && hours > 0);
    const qualityScores = daySleep
      .map((s) => s.qualityScore)
      .filter((score): score is number => score != null);

    points.push({
      date: date.slice(5),
      sleepDuration:
        sleepDurations.length > 0
          ? Number(
              (sleepDurations.reduce((sum, hours) => sum + hours, 0) / sleepDurations.length).toFixed(2),
            )
          : null,
      sleepQuality:
        qualityScores.length > 0
          ? Number((qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length).toFixed(2))
          : null,
      meals: dayFood.length,
      cannabis: dayCannabis.length,
    });
  }
  return points;
}

export function AnalysisTab({
  sleepLogs,
  foodLogs,
  marijuanaSessions,
}: {
  sleepLogs: SleepLog[];
  foodLogs: FoodLog[];
  marijuanaSessions: MarijuanaSession[];
}) {
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customGoalText, setCustomGoalText] = useState('');
  const [customGoals, setCustomGoals] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState(presetInsightGoals[0] ?? '');
  const availableGoals = [...presetInsightGoals, ...customGoals];
  const trendData = buildInsightTrendData(sleepLogs, foodLogs, marijuanaSessions);

  function addCustomGoal() {
    const goal = customGoalText.trim();
    if (!goal) return;
    if (availableGoals.includes(goal)) {
      setSelectedGoal(goal);
      setCustomGoalText('');
      return;
    }
    setCustomGoals((prev) => [...prev, goal]);
    setSelectedGoal(goal);
    setCustomGoalText('');
  }

  async function runAnalysis() {
    const activeGoal = selectedGoal.trim();
    if (!activeGoal) {
      setError('Select or add a goal before running analysis.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<HealthAnalysis>('/api/health/analysis', {
        goal: activeGoal,
        goals: availableGoals,
      });
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Insights</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Overlayed Daily Log trends for sleep, quality, meals, and greens across 30 days.
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" />
            <YAxis yAxisId="sleep" stroke="#6b7280" />
            <YAxis yAxisId="events" orientation="right" stroke="#6b7280" />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151' }}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Line
              yAxisId="sleep"
              type="monotone"
              dataKey="sleepDuration"
              name="Sleep Duration (hours)"
              stroke="#6366f1"
              dot={false}
              connectNulls
              strokeWidth={2}
            />
            <Line
              yAxisId="sleep"
              type="monotone"
              dataKey="sleepQuality"
              name="Sleep Quality (1-5)"
              stroke="#f59e0b"
              dot={false}
              connectNulls
              strokeWidth={2}
            />
            <Line
              yAxisId="events"
              type="monotone"
              dataKey="meals"
              name="Meals"
              stroke="#10b981"
              dot={false}
              strokeWidth={2}
            />
            <Line
              yAxisId="events"
              type="monotone"
              dataKey="cannabis"
              name="Greens sessions"
              stroke="#ef4444"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white">Analysis Goal</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Add a free-form goal or select an existing goal, then run analysis for one active goal.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={customGoalText}
            onChange={setCustomGoalText}
            placeholder="e.g. I want to improve deep sleep by adjusting meal and cannabis timing"
          />
          <button
            onClick={addCustomGoal}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg border border-gray-700"
          >
            Add Goal
          </button>
        </div>
        <div className="space-y-2">
          {availableGoals.map((goal) => (
            <label
              key={goal}
              className="flex items-center gap-2 p-2 rounded-md border border-gray-800 hover:border-gray-700"
            >
              <input
                type="radio"
                name="insight-goal"
                checked={selectedGoal === goal}
                onChange={() => setSelectedGoal(goal)}
              />
              <span className="text-sm text-gray-200">{goal}</span>
            </label>
          ))}
          {availableGoals.length === 0 && <p className="text-sm text-gray-500">Add a goal to begin.</p>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Get AI Insights</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Generates analysis using your selected goal and Daily Log trends.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg"
        >
          {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Choose or add a goal, then click "Run Analysis". Insights are generated from your Daily Log
          data and focused on the selected goal.
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
          Analyzing your data... this takes a few seconds.
        </div>
      )}

      {analysis && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-gray-500 space-y-1">
              <div>Generated {new Date(analysis.generatedAt).toLocaleString()}</div>
              {'goal' in analysis && typeof analysis.goal === 'string' && (
                <div className="text-gray-400">Goal: {analysis.goal}</div>
              )}
              {analysis.provider && analysis.model && (
                <div className="text-gray-400">
                  Model: {analysis.provider}/{analysis.model}
                  {analysis.fallbackUsed ? ' (fallback)' : ''}
                </div>
              )}
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Refresh
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownText text={analysis.insights} />
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  // Simple markdown-to-JSX renderer for the analysis output
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-gray-300 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="text-base font-semibold text-white mt-4 mb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold text-white">
              {line.slice(2, -2)}
            </p>
          );
        }
        if (/^\*\*.*\*\*/.test(line)) {
          // Bold prefix in a line
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i}>
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="text-white">
                    {part}
                  </strong>
                ) : (
                  part
                ),
              )}
            </p>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-indigo-400 shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.startsWith('1. ') || /^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.*)/);
          if (match) {
            return (
              <div key={i} className="flex gap-2">
                <span className="text-indigo-400 shrink-0 font-mono">{match[1]}.</span>
                <span>{match[2]}</span>
              </div>
            );
          }
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({
  type = 'text',
  value,
  onChange,
  autoFocus,
  placeholder,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      placeholder={placeholder}
      className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
    />
  );
}

function ModalFooter({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">
        Cancel
      </button>
      <button
        onClick={onSave}
        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
      >
        Save
      </button>
    </div>
  );
}

function Section({
  title,
  icon,
  onAdd,
  badge,
  bodyClassName,
  children,
}: {
  title: string;
  icon: string;
  onAdd: () => void;
  badge?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-medium text-white text-sm">{title}</span>
          {badge && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded"
        >
          + Add
        </button>
      </div>
      <div className={`px-5 py-2 divide-y divide-gray-800/50 ${bodyClassName ?? ''}`}>{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-gray-600 text-center">{children}</p>;
}

export { todayStr };
