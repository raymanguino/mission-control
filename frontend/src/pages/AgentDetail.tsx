import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AgentAvatar } from '../components/agents/AgentAvatar.js';
import { ActivityTimeline } from '../components/agents/ActivityTimeline.js';
import { api } from '../utils/api.js';
import { AGENT_AVATAR_IDS, type Agent, type AgentAvatarId, type AgentOrgRole } from '@mission-control/types';

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

const roleLabel: Record<AgentOrgRole, string> = {
  chief_of_staff: 'Chief of Staff',
  engineer: 'Engineer',
  qa: 'QA',
};

function avatarChoiceLabel(id: AgentAvatarId): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,auto)_1fr] gap-1 sm:gap-4 py-2 border-b border-gray-800/80 last:border-0">
      <dt className="text-xs text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-200 break-words">{value ?? '—'}</dd>
    </div>
  );
}

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [reportsToName, setReportsToName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hookUrlEdit, setHookUrlEdit] = useState('');
  const [hookTokenEdit, setHookTokenEdit] = useState('');
  const [hookSaving, setHookSaving] = useState(false);

  const handleAvatarChange = useCallback(async (next: AgentAvatarId | null) => {
    if (!agentId) return;
    setAvatarSaving(true);
    try {
      const updated = await api.patch<Agent>(`/api/agents/${agentId}`, {
        avatarId: next,
      });
      setAgent(updated);
    } catch (err) {
      console.error('Failed to update avatar', { agentId, err });
    } finally {
      setAvatarSaving(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    setLoadError(null);
    setAgent(null);
    setReportsToName(null);

    (async () => {
      try {
        const data = await api.get<Agent>(`/api/agents/${agentId}`);
        if (cancelled) return;
        setAgent(data);
        setHookUrlEdit(data.hookUrl ?? '');
        setHookTokenEdit('');
        if (data.reportsToAgentId) {
          try {
            const manager = await api.get<Agent>(`/api/agents/${data.reportsToAgentId}`);
            if (!cancelled) setReportsToName(manager.name);
          } catch {
            if (!cancelled) setReportsToName(null);
          }
        }
      } catch (err) {
        console.error('Failed to load agent', { agentId, err });
        if (!cancelled) setLoadError('Could not load this agent.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function handleSaveWebhook() {
    if (!agentId || !agent) return;
    const url = hookUrlEdit.trim();
    const token = hookTokenEdit.trim();
    if (!url) {
      console.error('Hook URL is required');
      return;
    }
    if (!token && !agent.hookTokenSet) {
      console.error('Bearer token is required (or leave blank only when a token is already stored)');
      return;
    }
    setHookSaving(true);
    try {
      const body: { hookUrl: string; hookToken?: string } = { hookUrl: url };
      if (token) body.hookToken = token;
      const updated = await api.patch<Agent>(`/api/agents/${agentId}`, body);
      setAgent(updated);
      setHookUrlEdit(updated.hookUrl ?? '');
      setHookTokenEdit('');
    } catch (err) {
      console.error('Failed to save webhook settings', { agentId, err });
    } finally {
      setHookSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!agent) return;
    if (
      !window.confirm(
        `Remove agent "${agent.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      navigate('/agents');
    } catch (err) {
      console.error('Failed to delete agent', { agentId: agent.id, err });
    } finally {
      setDeleting(false);
    }
  }

  if (!agentId) {
    return (
      <div>
        <p className="text-gray-400">Invalid link.</p>
        <Link to="/agents" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
          ← Back to agents
        </Link>
      </div>
    );
  }

  if (loadError || (!agent && !loadError)) {
    return (
      <div>
        <Link to="/agents" className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-block">
          ← Back to agents
        </Link>
        <p className="text-gray-400">{loadError ?? 'Loading…'}</p>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="max-w-3xl">
      <Link to="/agents" className="text-indigo-400 hover:text-indigo-300 text-sm mb-6 inline-block">
        ← Back to agents
      </Link>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="relative shrink-0">
          <AgentAvatar avatarId={agent.avatarId} size={64} className="rounded-lg" />
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${statusColor[agent.status] ?? 'bg-gray-500'}`}
            title={agent.status}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-white">{agent.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {roleLabel[agent.orgRole]} · {agent.status}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Avatar</h2>
        <p className="text-xs text-gray-500 mb-3">
          Block-style preset. Choose one or use the default (stored as unset).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={avatarSaving}
            onClick={() => void handleAvatarChange(null)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors disabled:opacity-50 ${
              agent.avatarId === null
                ? 'border-indigo-500 bg-indigo-950/40'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
            }`}
          >
            <AgentAvatar avatarId={null} size={40} />
            <span className="text-[10px] text-gray-400 max-w-[4.5rem] text-center leading-tight">
              Default
            </span>
          </button>
          {AGENT_AVATAR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              disabled={avatarSaving}
              onClick={() => void handleAvatarChange(id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                agent.avatarId === id
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              }`}
            >
              <AgentAvatar avatarId={id} size={40} />
              <span className="text-[10px] text-gray-400 max-w-[4.5rem] text-center leading-tight">
                {avatarChoiceLabel(id)}
              </span>
            </button>
          ))}
        </div>
        {avatarSaving && <p className="text-xs text-gray-500 mt-2">Saving…</p>}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Details</h2>
        <dl>
          <DetailRow label="Email" value={agent.email} />
          <DetailRow
            label="Description"
            value={agent.description ? <span className="whitespace-pre-wrap">{agent.description}</span> : null}
          />
          <DetailRow
            label="Specialization"
            value={agent.specialization ? <span className="whitespace-pre-wrap">{agent.specialization}</span> : null}
          />
          <DetailRow label="Device" value={agent.device} />
          <DetailRow label="IP" value={agent.ip} />
          <DetailRow
            label="Reports to"
            value={
              agent.reportsToAgentId ? (
                reportsToName ? (
                  <Link
                    to={`/agents/${agent.reportsToAgentId}`}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    {reportsToName}
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{agent.reportsToAgentId}</span>
                )
              ) : null
            }
          />
          <DetailRow
            label="Last seen"
            value={agent.lastSeen ? new Date(agent.lastSeen).toLocaleString() : null}
          />
          <DetailRow label="Registered" value={new Date(agent.createdAt).toLocaleString()} />
        </dl>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4 mt-4">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Webhook</h2>
        <p className="text-xs text-gray-500 mb-3">
          Required. Mission Control POSTs JSON events to this URL with{' '}
          <code className="text-gray-400">Authorization: Bearer &lt;token&gt;</code>.           Task assignments
          go to the assigned agent (<code className="text-gray-400">task.assigned</code> or{' '}
          <code className="text-gray-400">task.review_assigned</code> when the task is already in Review); new projects, tasks moved to Review (
          <code className="text-gray-400">task.completed</code>), and Chief of Staff instruction
          saves go to the CoS agent. Saving Agent playbook instructions in Settings notifies Engineer and QA agents (
          <code className="text-gray-400">instructions.updated</code>).
        </p>
        <div className="space-y-3 max-w-xl">
          <div>
            <label htmlFor="hook-url" className="block text-xs text-gray-500 mb-1">
              Hook URL
            </label>
            <input
              id="hook-url"
              type="url"
              value={hookUrlEdit}
              onChange={(e) => setHookUrlEdit(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600"
            />
          </div>
          <div>
            <label htmlFor="hook-token" className="block text-xs text-gray-500 mb-1">
              Bearer token
            </label>
            <input
              id="hook-token"
              type="password"
              autoComplete="new-password"
              value={hookTokenEdit}
              onChange={(e) => setHookTokenEdit(e.target.value)}
              placeholder={agent.hookTokenSet ? 'Leave blank to keep current token' : 'Set token'}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600"
            />
          </div>
          <button
            type="button"
            disabled={hookSaving}
            onClick={() => void handleSaveWebhook()}
            className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {hookSaving ? 'Saving…' : 'Save webhook'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-5">
        <h2 className="text-sm font-medium text-red-400/90 uppercase tracking-wide mb-2">Danger zone</h2>
        <p className="text-xs text-gray-500 mb-3">
          Permanently remove this agent registration. This cannot be undone.
        </p>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDeleteAgent()}
          className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-300 hover:bg-red-950/50 disabled:opacity-50"
        >
          {deleting ? 'Removing…' : 'Remove agent'}
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-6">
        <ActivityTimeline agentId={agent.id} />
      </div>
    </div>
  );
}
