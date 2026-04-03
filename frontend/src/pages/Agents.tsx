import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentAvatar } from '../components/agents/AgentAvatar.js';
import { FleetActivityTimeline } from '../components/agents/ActivityTimeline.js';
import { api } from '../utils/api.js';
import type { Agent, AgentOrgRole } from '@mission-control/types';

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

export default function Agents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

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
            className="flex gap-4 text-left bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80"
          >
            <div className="flex shrink-0 flex-col items-center justify-center gap-2 self-stretch border-r border-gray-800 pr-4">
              <span className="text-center text-[10px] uppercase tracking-wide text-indigo-300 bg-indigo-950/70 px-2 py-0.5 rounded-full max-w-[7rem] leading-tight">
                {roleLabel[agent.orgRole]}
              </span>
              <span className="relative inline-block">
                <AgentAvatar avatarId={agent.avatarId} size={52} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${statusColor[agent.status] ?? 'bg-gray-500'}`}
                  title={agent.status}
                />
              </span>
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <span className="font-medium text-white truncate min-w-0">{agent.name}</span>
              {agent.specialization && (
                <p className="text-xs text-gray-300 line-clamp-2">{agent.specialization}</p>
              )}
              <div className="space-y-0.5 mt-0.5">
                {agent.device && (
                  <p className="text-xs text-gray-400">{agent.device}</p>
                )}
                {agent.ip && <p className="text-xs text-gray-500">{agent.ip}</p>}
                {agent.reportsToAgentId && (
                  <p className="text-xs text-gray-500">Reports to: {agent.reportsToAgentId}</p>
                )}
                {agent.lastSeen && (
                  <p className="text-xs text-gray-600 mt-1">
                    Last seen {new Date(agent.lastSeen).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-500 col-span-3">No agents registered yet.</p>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-10">
        <FleetActivityTimeline />
      </div>
    </div>
  );
}
