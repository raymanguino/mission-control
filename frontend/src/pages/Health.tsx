import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import type { HealthGoal, HealthEntry } from '@mission-control/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

function GoalCard({
  goal,
  entries,
  onLog,
}: {
  goal: HealthGoal;
  entries: HealthEntry[];
  onLog: (goal: HealthGoal) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
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
          <span>Today: {todayTotal} {goal.unit}</span>
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function submit() {
    if (!value) return;
    await api.post('/api/health/entries', { goalId: goal.id, value, notes, date });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-80 space-y-4 border border-gray-700">
        <h2 className="text-lg font-semibold text-white">Log — {goal.name}</h2>
        <div>
          <label className="text-xs text-gray-400">Value ({goal.unit})</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Health() {
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [logGoal, setLogGoal] = useState<HealthGoal | null>(null);

  const load = () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);
    api.get<HealthGoal[]>('/api/health/goals').then(setGoals).catch(() => {});
    api
      .get<HealthEntry[]>(`/api/health/entries?from=${fromStr}`)
      .then(setEntries)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Health</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} entries={entries} onLog={setLogGoal} />
        ))}
        {goals.length === 0 && <p className="text-gray-500">No health goals yet.</p>}
      </div>
      {logGoal && (
        <LogModal goal={logGoal} onClose={() => setLogGoal(null)} onSaved={load} />
      )}
    </div>
  );
}
