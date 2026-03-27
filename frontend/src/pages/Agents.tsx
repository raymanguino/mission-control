import { useEffect, useState } from 'react';
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
        .get<{ data: AgentActivity[] }>(`/api/agents/${agentId}/activity?limit=20`)
        .then((r) => setActivities(r.data))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  }, [agentId]);

  return (
    <div className="mt-4 space-y-2">
      {activities.length === 0 && (
        <p className="text-sm text-gray-500">No activity yet.</p>
      )}
      {activities.map((a) => (
        <div key={a.id} className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-indigo-400">{a.type}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(a.createdAt).toLocaleTimeString()}
            </span>
          </div>
          {a.description && <p className="text-sm text-gray-300 mt-0.5">{a.description}</p>}
        </div>
      ))}
    </div>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Agents</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelected(selected === agent.id ? null : agent.id)}
            className="text-left bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor[agent.status] ?? 'bg-gray-500'}`}
              />
              <span className="font-medium text-white">{agent.name}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-indigo-300 bg-indigo-950/70 px-2 py-0.5 rounded-full">
                {roleLabel[agent.orgRole] ?? agent.orgRole}
              </span>
            </div>
            {agent.device && (
              <p className="text-xs text-gray-400 mb-0.5">{agent.device}</p>
            )}
            {agent.ip && <p className="text-xs text-gray-500">{agent.ip}</p>}
            {agent.strengths && (
              <p className="text-xs text-gray-300 mt-2 line-clamp-2">{agent.strengths}</p>
            )}
            {agent.reportsToAgentId && (
              <p className="text-xs text-gray-500 mt-1">Reports to: {agent.reportsToAgentId}</p>
            )}
            {agent.lastSeen && (
              <p className="text-xs text-gray-600 mt-2">
                Last seen {new Date(agent.lastSeen).toLocaleString()}
              </p>
            )}
            {selected === agent.id && <ActivityFeed agentId={agent.id} />}
          </button>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-500 col-span-3">No agents registered yet.</p>
        )}
      </div>
    </div>
  );
}
