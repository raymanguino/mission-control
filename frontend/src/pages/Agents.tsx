import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Agent } from '@mission-control/types';

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

const roleLabel: Record<string, string> = {
  chief_of_staff: 'Chief of Staff',
  member: 'Member',
};

export default function Agents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

  async function handleDeleteAgent(agent: Agent) {
    if (
      !window.confirm(
        `Remove agent "${agent.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(agent.id);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      console.error('Failed to delete agent', { agentId: agent.id, err });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Agents</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/agents/${agent.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/agents/${agent.id}`);
              }
            }}
            className="text-left bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${statusColor[agent.status] ?? 'bg-gray-500'}`}
                />
                <span className="font-medium text-white truncate">{agent.name}</span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-indigo-300 bg-indigo-950/70 px-2 py-0.5 rounded-full">
                  {roleLabel[agent.orgRole] ?? agent.orgRole}
                </span>
              </div>
              <button
                type="button"
                disabled={deletingId === agent.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteAgent(agent);
                }}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 shrink-0 pt-0.5"
              >
                {deletingId === agent.id ? 'Removing…' : 'Delete'}
              </button>
            </div>
            <div>
              {agent.device && (
                <p className="text-xs text-gray-400 mb-0.5">{agent.device}</p>
              )}
              {agent.ip && <p className="text-xs text-gray-500">{agent.ip}</p>}
              {agent.specialization && (
                <p className="text-xs text-gray-300 mt-2 line-clamp-2">{agent.specialization}</p>
              )}
              {agent.reportsToAgentId && (
                <p className="text-xs text-gray-500 mt-1">Reports to: {agent.reportsToAgentId}</p>
              )}
              {agent.lastSeen && (
                <p className="text-xs text-gray-600 mt-2">
                  Last seen {new Date(agent.lastSeen).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-500 col-span-3">No agents registered yet.</p>
        )}
      </div>
    </div>
  );
}
