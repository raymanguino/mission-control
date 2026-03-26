import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

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
  const [aiConfig, setAiConfig] = useState<AiConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get<AiConfigResponse>('/api/usage/ai/config')
      .then(setAiConfig)
      .catch(() => setAiConfig(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

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
