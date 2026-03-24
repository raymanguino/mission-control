import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import type { UsageGroup, UsageRecord } from '@mission-control/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type GroupBy = 'model' | 'apiKey' | 'agent';

export default function Usage() {
  const [groups, setGroups] = useState<UsageGroup[]>([]);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('model');
  const [syncing, setSyncing] = useState(false);

  const load = (gb: GroupBy = groupBy) => {
    api.get<UsageGroup[]>(`/api/usage?groupBy=${gb}`).then(setGroups).catch(() => {});
    api.get<UsageRecord[]>('/api/usage/records?limit=50').then(setRecords).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [groupBy]);

  const totalCost = groups.reduce((s, g) => s + Number(g.costUsd), 0);
  const totalIn = groups.reduce((s, g) => s + Number(g.tokensIn), 0);
  const totalOut = groups.reduce((s, g) => s + Number(g.tokensOut), 0);

  async function syncNow() {
    setSyncing(true);
    try {
      await api.post('/api/usage/sync');
      load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usage & Costs</h1>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total cost', value: `$${totalCost.toFixed(4)}` },
          { label: 'Tokens in', value: totalIn.toLocaleString() },
          { label: 'Tokens out', value: totalOut.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-400">Group by</span>
          {(['model', 'apiKey', 'agent'] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1 text-xs rounded-md ${
                groupBy === g
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={groups} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="key"
              tick={{ fontSize: 10 }}
              stroke="#6b7280"
              tickFormatter={(v: string) => (v ? v.slice(0, 20) : '(none)')}
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 11 }}
              formatter={(v: number) => `$${Number(v).toFixed(6)}`}
            />
            <Bar dataKey="costUsd" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Records table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-800">
            <tr className="text-xs text-gray-500 text-left">
              {['Model', 'API Key', 'Tokens In', 'Tokens Out', 'Cost', 'Recorded At'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2.5 text-gray-300">{r.model ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.apiKeyLabel ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.tokensIn?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.tokensOut?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-300">
                  {r.costUsd ? `$${Number(r.costUsd).toFixed(6)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {new Date(r.recordedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
