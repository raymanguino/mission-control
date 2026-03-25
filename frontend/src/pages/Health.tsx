import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api.js';
import type {
  HealthGoal,
  HealthEntry,
  FoodLog,
  MarijuanaSession,
  SleepLog,
  HealthAnalysis,
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
  return d.toISOString().slice(0, 16); // datetime-local format
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

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'goals' | 'log' | 'analysis';

function Tabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'goals', label: 'Goals' },
    { id: 'log', label: 'Daily Log' },
    { id: 'analysis', label: 'AI Analysis' },
  ];
  return (
    <div className="flex gap-1 border-b border-gray-800 mb-6">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.id
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Goals tab ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  entries,
  onLog,
}: {
  goal: HealthGoal;
  entries: HealthEntry[];
  onLog: (goal: HealthGoal) => void;
}) {
  const today = todayStr();
  const todayTotal = entries
    .filter((e) => e.date === today && e.goalId === goal.id)
    .reduce((s, e) => s + Number(e.value), 0);
  const pct = Math.min((todayTotal / Number(goal.target)) * 100, 100);

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const date = d.toISOString().slice(0, 10);
    const val = entries
      .filter((e) => e.date === date && e.goalId === goal.id)
      .reduce((s, e) => s + Number(e.value), 0);
    return { date: date.slice(5), value: val };
  });

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-white">{goal.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {goal.frequency} · target {goal.target} {goal.unit}
          </p>
        </div>
        <button
          onClick={() => onLog(goal)}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md text-white"
        >
          Log
        </button>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>
            Today: {todayTotal} {goal.unit}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={last30}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#6b7280" />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 11 }}
          />
          <Line type="monotone" dataKey="value" stroke="#6366f1" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LogModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: HealthGoal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayStr);

  async function submit() {
    if (!value) return;
    await api.post('/api/health/entries', { goalId: goal.id, value, notes, date });
    onSaved();
    onClose();
  }

  return (
    <Modal title={`Log — ${goal.name}`} onClose={onClose}>
      <Field label={`Value (${goal.unit})`}>
        <Input type="number" value={value} onChange={setValue} autoFocus />
      </Field>
      <Field label="Date">
        <Input type="date" value={date} onChange={setDate} />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={setNotes} />
      </Field>
      <ModalFooter onCancel={onClose} onSave={submit} />
    </Modal>
  );
}

// ─── Daily Log tab ────────────────────────────────────────────────────────────

function SleepSection({
  date,
  sleepLogs,
  onRefresh,
}: {
  date: string;
  sleepLogs: SleepLog[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editLog, setEditLog] = useState<SleepLog | null>(null);
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
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {editLog && (
        <SleepModal
          date={date}
          existing={editLog}
          onClose={() => setEditLog(null)}
          onSaved={() => { setEditLog(null); onRefresh(); }}
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
  onSaved: () => void;
}) {
  const defaultBed = existing
    ? new Date(existing.bedTime).toISOString().slice(0, 16)
    : `${date}T22:00`;
  const [bedTime, setBedTime] = useState(defaultBed);
  const [wakeTime, setWakeTime] = useState(
    existing?.wakeTime ? new Date(existing.wakeTime).toISOString().slice(0, 16) : '',
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
    if (existing) {
      await api.patch(`/api/health/sleep/${existing.id}`, payload);
    } else {
      await api.post('/api/health/sleep', payload);
    }
    onSaved();
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

function FoodSection({
  date,
  foodLogs,
  onRefresh,
}: {
  date: string;
  foodLogs: FoodLog[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
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
              {f.protein && <span className="ml-2">P {f.protein}g</span>}
              {f.carbs && <span className="ml-2">C {f.carbs}g</span>}
              {f.fat && <span className="ml-2">F {f.fat}g</span>}
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
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
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
  type NutritionEstimate = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source: 'llm';
  };

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
  const [estimateSource, setEstimateSource] = useState<'llm' | null>(null);

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
      setEstimateSource(result.source);
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
      if (backendReason.includes('missing OPENAI_API_KEY')) {
        setEstimateError(
          'Nutrition estimation is not configured. Add OPENAI_API_KEY to backend/.env and restart the backend.',
        );
      } else if (backendReason.includes('credit balance is too low')) {
        setEstimateError(
          'Nutrition estimation is temporarily unavailable because the AI provider account has no credits. Add billing credits or configure OPENAI_API_KEY in backend/.env, then restart backend.',
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
      protein: protein || null,
      carbs: carbs || null,
      fat: fat || null,
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
            Source: OpenAI estimation
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

function CannabisSection({
  date,
  sessions,
  onRefresh,
}: {
  date: string;
  sessions: MarijuanaSession[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const todaySessions = sessions.filter((s) => s.date === date);

  async function handleDelete(id: string) {
    await api.delete(`/api/health/marijuana/${id}`);
    onRefresh();
  }

  return (
    <Section title="Cannabis" icon="🌿" onAdd={() => setShowAdd(true)} bodyClassName="max-h-80 overflow-y-auto">
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
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
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

// ─── Analysis tab ─────────────────────────────────────────────────────────────

function AnalysisTab() {
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<HealthAnalysis>('/api/health/analysis');
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">AI Health Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Analyzes your last 30 days of sleep, cannabis sessions, and food logs for patterns.
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
          Click "Run Analysis" to get AI-powered insights about your sleep, cannabis, and food
          patterns. Requires at least a few days of logged data.
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
          Analyzing your data with Claude… this takes a few seconds.
        </div>
      )}

      {analysis && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500">
              Generated {new Date(analysis.generatedAt).toLocaleString()}
            </span>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-gray-600 text-center">{children}</p>;
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function Health() {
  const [tab, setTab] = useState<Tab>('goals');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Goals tab state
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [logGoal, setLogGoal] = useState<HealthGoal | null>(null);

  // Daily log state
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [marijuanaSessions, setMarijuanaSessions] = useState<MarijuanaSession[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);

  const loadGoals = useCallback(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);
    api.get<HealthGoal[]>('/api/health/goals').then(setGoals).catch(() => {});
    api.get<HealthEntry[]>(`/api/health/entries?from=${fromStr}`).then(setEntries).catch(() => {});
  }, []);

  const loadWellness = useCallback(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);
    api.get<FoodLog[]>(`/api/health/food?from=${fromStr}`).then(setFoodLogs).catch(() => {});
    api
      .get<MarijuanaSession[]>(`/api/health/marijuana?from=${fromStr}`)
      .then(setMarijuanaSessions)
      .catch(() => {});
    api.get<SleepLog[]>(`/api/health/sleep?from=${fromStr}`).then(setSleepLogs).catch(() => {});
  }, []);

  useEffect(() => {
    loadGoals();
    loadWellness();
  }, [loadGoals, loadWellness]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Health</h1>
      <Tabs active={tab} onChange={setTab} />

      {tab === 'goals' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} entries={entries} onLog={setLogGoal} />
            ))}
            {goals.length === 0 && <p className="text-gray-500">No health goals yet.</p>}
          </div>
          {logGoal && (
            <LogModal goal={logGoal} onClose={() => setLogGoal(null)} onSaved={loadGoals} />
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 rounded-md px-3 py-1.5 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setSelectedDate(todayStr())}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Today
            </button>
          </div>

          <SleepSection date={selectedDate} sleepLogs={sleepLogs} onRefresh={loadWellness} />
          <FoodSection date={selectedDate} foodLogs={foodLogs} onRefresh={loadWellness} />
          <CannabisSection
            date={selectedDate}
            sessions={marijuanaSessions}
            onRefresh={loadWellness}
          />
        </div>
      )}

      {tab === 'analysis' && <AnalysisTab />}
    </div>
  );
}
