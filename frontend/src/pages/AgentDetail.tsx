import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Agent, AgentActivity } from '@mission-control/types';

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

const roleLabel: Record<string, string> = {
  chief_of_staff: 'Chief of Staff',
  member: 'Member',
};

function ActivityFeed({ agentId }: { agentId: string }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);

  useEffect(() => {
    const fetch = () =>
      api
        .get<{ data: AgentActivity[] }>(`/api/agents/${agentId}/activity?limit=50`)
        .then((r) => setActivities(r.data))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  }, [agentId]);

  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Activity</h2>
      {activities.length === 0 && (
        <p className="text-sm text-gray-500">No activity yet.</p>
      )}
      {activities.map((a) => (
        <div key={a.id} className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-indigo-400">{a.type}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
          {a.description && <p className="text-sm text-gray-300 mt-0.5">{a.description}</p>}
          {a.metadata && Object.keys(a.metadata).length > 0 && (
            <pre className="text-xs text-gray-500 mt-2 overflow-x-auto font-mono bg-gray-900/50 rounded p-2">
              {JSON.stringify(a.metadata, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
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
  const [agent, setAgent] = useState<Agent | null>(null);
  const [reportsToName, setReportsToName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

      <div className="flex flex-wrap items-start gap-3 mb-6">
        <span
          className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${statusColor[agent.status] ?? 'bg-gray-500'}`}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-white">{agent.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {roleLabel[agent.orgRole] ?? agent.orgRole} · {agent.status}
          </p>
        </div>
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

      <ActivityFeed agentId={agent.id} />
    </div>
  );
}
