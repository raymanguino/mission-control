import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import {
  AGENT_PRESENCE_DEFAULTS,
  AGENT_PRESENCE_LEGACY_MCP_STALE_KEY,
  AGENT_PRESENCE_SETTING_KEYS,
} from '@mission-control/types';
import {
  DEFAULT_DASHBOARD_TITLE,
  useDashboardTitle,
} from '../contexts/DashboardTitleContext.js';

interface AiConfigResponse {
  providers: {
    openrouter: {
      configured: boolean;
      modelEnv: {
        OPENROUTER_MODEL: string | null;
        OPENROUTER_CHEAP_MODEL: string | null;
        OPENROUTER_BALANCED_MODEL: string | null;
      };
    };
    anthropic: {
      configured: boolean;
      modelEnv: {
        ANTHROPIC_MODEL: string | null;
      };
    };
  };
  workloadSelections: Array<{
    workload: string;
    status: 'ok' | 'error';
    selected: {
      primary: { provider: string; model: string };
      fallback: { provider: string; model: string } | null;
    } | null;
    error?: string;
  }>;
}

export default function Settings() {
  const { refreshDashboardTitle } = useDashboardTitle();
  const [aiConfig, setAiConfig] = useState<AiConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [cosInstructions, setCosInstructions] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [activityStaleToIdleMin, setActivityStaleToIdleMin] = useState<number>(
    AGENT_PRESENCE_DEFAULTS.activityStaleToIdleMinutes,
  );
  const [idleToOfflineMin, setIdleToOfflineMin] = useState<number>(
    AGENT_PRESENCE_DEFAULTS.idleToOfflineMinutes,
  );
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get<AiConfigResponse>('/api/usage/ai/config')
      .then(setAiConfig)
      .catch(() => setAiConfig(null))
      .finally(() => setLoading(false));
  };

  const loadSettings = () => {
    setSettingsLoading(true);
    api
      .get<Record<string, string>>('/api/settings')
      .then((s) => {
        setDashboardTitle(s['dashboard_title'] ?? '');
        setCosInstructions(s['cos_instructions'] ?? '');
        setAgentInstructions(s['agent_instructions'] ?? '');
        const t1Raw =
          s[AGENT_PRESENCE_SETTING_KEYS.activityStaleToIdleMinutes] ??
          s[AGENT_PRESENCE_LEGACY_MCP_STALE_KEY] ??
          '';
        const t1 = Number.parseInt(t1Raw, 10);
        const t2 = Number.parseInt(
          s[AGENT_PRESENCE_SETTING_KEYS.idleToOfflineMinutes] ?? '',
          10,
        );
        if (Number.isFinite(t1) && t1 >= 1) setActivityStaleToIdleMin(t1);
        else setActivityStaleToIdleMin(AGENT_PRESENCE_DEFAULTS.activityStaleToIdleMinutes);
        if (Number.isFinite(t2) && t2 >= 1) setIdleToOfflineMin(t2);
        else setIdleToOfflineMin(AGENT_PRESENCE_DEFAULTS.idleToOfflineMinutes);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  };

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      // JSON.stringify drops keys whose value is undefined — backend would not see instruction keys.
      await api.patch('/api/settings', { [key]: value ?? '' });
      if (key === 'dashboard_title') {
        await refreshDashboardTitle();
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Dashboard title */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Dashboard title</h2>
        <p className="text-xs text-gray-500">
          Shown in the sidebar, login page, and browser tab. Leave blank to use the default (
          {DEFAULT_DASHBOARD_TITLE}).
        </p>
        {settingsLoading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : (
          <>
            <input
              type="text"
              maxLength={128}
              placeholder={DEFAULT_DASHBOARD_TITLE}
              className="w-full bg-gray-800 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-gray-600"
              value={dashboardTitle}
              onChange={(e) => setDashboardTitle(e.target.value)}
            />
            <button
              onClick={() => saveSetting('dashboard_title', dashboardTitle)}
              disabled={saving === 'dashboard_title'}
              className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving === 'dashboard_title' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      {/* Chief of Staff Instructions */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Chief of Staff Instructions</h2>
        <p className="text-xs text-gray-500">
          Sent to the CoS agent on registration and with every report response. On Save, Mission
          Control POSTs <code className="text-gray-400">instructions.updated</code> to each{' '}
          <span className="text-gray-400">chief_of_staff</span> agent that has a webhook URL and
          bearer token configured (Agent detail).
        </p>
        {settingsLoading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : (
          <>
            <textarea
              className="w-full bg-gray-800 text-gray-200 text-xs rounded-md p-3 border border-gray-700 resize-y min-h-[120px] focus:outline-none focus:border-gray-600"
              value={cosInstructions}
              onChange={(e) => setCosInstructions(e.target.value)}
            />
            <button
              onClick={() => saveSetting('cos_instructions', cosInstructions)}
              disabled={saving === 'cos_instructions'}
              className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving === 'cos_instructions' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      {/* Agent Instructions */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Agent Instructions</h2>
        <p className="text-xs text-gray-500">
          Sent to Engineer and QA agents on registration, task assignment, and with every report
          response. On Save, Mission Control POSTs{' '}
          <code className="text-gray-400">instructions.updated</code> to each{' '}
          <span className="text-gray-400">engineer</span> or <span className="text-gray-400">qa</span>{' '}
          agent with a webhook configured—not to the Chief of Staff.
        </p>
        {settingsLoading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : (
          <>
            <textarea
              className="w-full bg-gray-800 text-gray-200 text-xs rounded-md p-3 border border-gray-700 resize-y min-h-[120px] focus:outline-none focus:border-gray-600"
              value={agentInstructions}
              onChange={(e) => setAgentInstructions(e.target.value)}
            />
            <button
              onClick={() => saveSetting('agent_instructions', agentInstructions)}
              disabled={saving === 'agent_instructions'}
              className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving === 'agent_instructions' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      {/* Agent presence */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Agent presence</h2>
        <p className="text-xs text-gray-500">
          Online / idle / offline come only from Mission Control activity:{' '}
          <span className="text-gray-400">last activity</span> on each agent (updated when the server
          logs work for that agent). Agents do not need to report in for status. Optional{' '}
          <code className="text-gray-400">POST /api/agents/report</code> still updates{' '}
          <span className="text-gray-400">last seen</span> for display but does not drive status. The
          server sweeps about once per minute.
        </p>
        {settingsLoading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Activity quiet → idle (minutes)
              </label>
              <p className="text-xs text-gray-600 mb-1">
                If last activity is older than this, status becomes{' '}
                <span className="text-gray-500">idle</span>. Agents with no recorded activity stay{' '}
                <span className="text-gray-500">offline</span>.
              </p>
              <input
                type="number"
                min={1}
                max={10080}
                className="w-full max-w-xs bg-gray-800 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-gray-600"
                value={activityStaleToIdleMin}
                onChange={(e) => setActivityStaleToIdleMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Idle → offline (extra minutes)
              </label>
              <p className="text-xs text-gray-600 mb-1">
                After last activity is older than &quot;activity quiet → idle&quot; plus this many
                additional minutes, status becomes <span className="text-gray-500">offline</span>.
              </p>
              <input
                type="number"
                min={1}
                max={10080}
                className="w-full max-w-xs bg-gray-800 text-gray-200 text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-gray-600"
                value={idleToOfflineMin}
                onChange={(e) => setIdleToOfflineMin(Number(e.target.value))}
              />
            </div>
            <button
              onClick={async () => {
                setSaving('agent_presence');
                try {
                  await api.patch('/api/settings', {
                    [AGENT_PRESENCE_SETTING_KEYS.activityStaleToIdleMinutes]: String(
                      activityStaleToIdleMin,
                    ),
                    [AGENT_PRESENCE_SETTING_KEYS.idleToOfflineMinutes]: String(idleToOfflineMin),
                  });
                } finally {
                  setSaving(null);
                }
              }}
              disabled={saving === 'agent_presence'}
              className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving === 'agent_presence' ? 'Saving…' : 'Save presence settings'}
            </button>
          </div>
        )}
      </div>

      {/* AI Routing Config */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">AI Routing Config</h2>
          <button
            onClick={load}
            className="px-2.5 py-1 text-xs rounded-md bg-gray-800 text-gray-300 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-xs text-gray-500">Loading…</p>}

        {!loading && !aiConfig && (
          <p className="text-xs text-gray-500">Unable to load AI config diagnostics.</p>
        )}

        {!loading && aiConfig && (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-gray-800 p-3">
                <div className="text-gray-400 mb-1">OpenRouter</div>
                <div className="text-gray-200">
                  {aiConfig.providers.openrouter.configured ? 'Configured' : 'Missing API key'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 p-3">
                <div className="text-gray-400 mb-1">Anthropic</div>
                <div className="text-gray-200">
                  {aiConfig.providers.anthropic.configured ? 'Configured' : 'Missing API key'}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              {aiConfig.workloadSelections.map((row) => (
                <div
                  key={row.workload}
                  className="text-xs text-gray-300 border border-gray-800 rounded px-3 py-2"
                >
                  <span className="text-gray-400">{row.workload}</span>
                  {' — '}
                  {row.status === 'ok' && row.selected
                    ? `${row.selected.primary.provider}/${row.selected.primary.model}${
                        row.selected.fallback
                          ? ` (fallback: ${row.selected.fallback.provider}/${row.selected.fallback.model})`
                          : ''
                      }`
                    : (row.error ?? 'not configured')}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
