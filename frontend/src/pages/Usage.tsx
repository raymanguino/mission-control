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
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const load = (gb: GroupBy = groupBy) => {
    api.get<UsageGroup[]>(`/api/usage?groupBy=${gb}`).then(setGroups).catch(() => {});
    api.get<UsageRecord[]>('/api/usage/records?limit=50').then(setRecords).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [groupBy]);

  const totalCost = groups.reduce((sum, group) => sum + Number(group.costUsd), 0);
  const totalUpstreamCost = groups.reduce(
    (sum, group) => sum + Number(group.upstreamInferenceCostUsd),
    0,
  );
  const totalRequests = groups.reduce((sum, group) => sum + Number(group.requestCount), 0);
  const totalIn = groups.reduce((sum, group) => sum + Number(group.tokensIn), 0);
  const totalOut = groups.reduce((sum, group) => sum + Number(group.tokensOut), 0);
  const totalReasoning = groups.reduce((sum, group) => sum + Number(group.reasoningTokens), 0);
  const totalCached = groups.reduce((sum, group) => sum + Number(group.cachedTokens), 0);
  const totalCacheWrite = groups.reduce((sum, group) => sum + Number(group.cacheWriteTokens), 0);
  const totalAudio = groups.reduce((sum, group) => sum + Number(group.audioTokens), 0);

  const primaryCards = [
    { label: 'Total cost', value: `$${totalCost.toFixed(6)}` },
    { label: 'Upstream cost', value: `$${totalUpstreamCost.toFixed(6)}` },
    { label: 'Requests', value: totalRequests.toLocaleString() },
  ];

  const secondaryMetrics = [
    { label: 'Tokens in', value: totalIn.toLocaleString() },
    { label: 'Tokens out', value: totalOut.toLocaleString() },
    { label: 'Reasoning', value: totalReasoning.toLocaleString() },
    { label: 'Cached', value: totalCached.toLocaleString() },
    { label: 'Cache writes', value: totalCacheWrite.toLocaleString() },
    { label: 'Audio', value: totalAudio.toLocaleString() },
  ];

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.post<{ synced: number }>('/api/usage/sync');
      setSyncResult(`Synced ${result.synced} record${result.synced === 1 ? '' : 's'}`);
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSyncing(false);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usage & Costs</h1>
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className={`text-xs ${syncResult.startsWith('Sync failed') ? 'text-red-400' : 'text-gray-400'}`}>
              {syncResult}
            </span>
          )}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {primaryCards.map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-3">
        {secondaryMetrics.map(({ label, value }) => (
          <div key={label} className="bg-gray-900/60 rounded-lg px-3 py-2.5 border border-gray-800/70">
            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-gray-400">{value}</p>
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
              tickFormatter={(value: string | null) => (value ? value.slice(0, 20) : '(none)')}
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
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="border-b border-gray-800">
            <tr className="text-xs text-gray-500 text-left">
              {[
                'Model',
                'Source',
                'API Key',
                'Requests',
                'Tokens In',
                'Tokens Out',
                'Reasoning',
                'Cached',
                'Cache Write',
                'Audio',
                'Cost',
                'Upstream Cost',
                'Recorded At',
              ].map((h) => (
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
                <td className="px-4 py-2.5 text-gray-400">{r.source}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.apiKeyLabel ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.requestCount?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.tokensIn?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{r.tokensOut?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">
                  {r.reasoningTokens?.toLocaleString() ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-400">{r.cachedTokens?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">
                  {r.cacheWriteTokens?.toLocaleString() ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-400">{r.audioTokens?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-300">
                  {r.costUsd ? `$${Number(r.costUsd).toFixed(6)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-300">
                  {r.upstreamInferenceCostUsd
                    ? `$${Number(r.upstreamInferenceCostUsd).toFixed(6)}`
                    : '—'}
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
