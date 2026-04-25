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
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleNameChange = useCallback(async () => {
    if (!agentId || !nameInput.trim()) return;
    if (
      !window.confirm(
        `Rename agent "${agent?.name}" to "${nameInput.trim()}"? Supporting backend changes may be needed.`,
      )
    ) {
      return;
    }
    setNameSaving(true);
    try {
      const updated = await api.patch<Agent>(`/api/agents/${agentId}`, {
        name: nameInput.trim(),
      });
      setAgent(updated);
      setNameInput('');
    } catch (err) {
      console.error('Failed to update name', { agentId, err });
    } finally {
      setNameSaving(false);
    }
  }, [agentId, nameInput]);

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
          <DetailRow label="Model" value={agent.model} />
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
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Webhooks</h2>
        <p className="text-xs text-gray-500">
          Outbound events are configured on the Mission Control server with{' '}
          <code className="text-gray-400">MC_WEBHOOK_BASE_URL</code> and{' '}
          <code className="text-gray-400">MC_WEBHOOK_TOKEN</code>. POSTs go to{' '}
          <code className="text-gray-400">/hooks/mc</code> with payloads that include{' '}
          <code className="text-gray-400">projectId</code>, <code className="text-gray-400">project</code>,{' '}
          <code className="text-gray-400">event</code> (e.g. <code className="text-gray-400">project.pending_approval</code>,{' '}
          <code className="text-gray-400">project.backlog_updated</code>, <code className="text-gray-400">project.all_tasks_completed</code>,{' '}
          <code className="text-gray-400">project.review_completed</code>), and <code className="text-gray-400">agentInstructions</code>.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-5">
        <h2 className="text-sm font-medium text-red-400/90 uppercase tracking-wide mb-2">Danger zone</h2>
        <div className="space-y-4">
          <div>
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
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Change the name of this agent. Supporting backend changes may be needed.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={agent.name}
                disabled={nameSaving}
                className="text-sm bg-gray-800 border border-red-800/60 text-white rounded px-2 py-1.5 focus:outline-none focus:border-red-600 disabled:opacity-50 w-48"
              />
              <button
                type="button"
                disabled={nameSaving || !nameInput.trim() || nameInput.trim() === agent.name}
                onClick={() => void handleNameChange()}
                className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-300 hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {nameSaving ? 'Renaming…' : 'Rename agent'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-6">
        <ActivityTimeline agentId={agent.id} />
      </div>
    </div>
  );
}
