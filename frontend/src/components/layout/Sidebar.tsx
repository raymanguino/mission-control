import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import type { Agent } from '@mission-control/types';
import { useAuth } from '../../contexts/AuthContext.js';

const navItems = [
  { to: '/agents', label: 'Agents' },
  { to: '/chat', label: 'Chat' },
  { to: '/projects', label: 'Projects' },
  { to: '/wellness', label: 'Wellness' },
  { to: '/usage', label: 'Usage' },
];

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-400',
};

export default function Sidebar() {
  const { logout } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const fetch = () =>
      api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-gray-900 text-gray-100 border-r border-gray-800">
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">Mission Control</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-800 space-y-1">
        {agents.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-xs text-gray-400">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${statusColor[a.status] ?? 'bg-gray-400'}`}
            />
            <span className="truncate">{a.name}</span>
          </div>
        ))}
        <div className="mt-3 flex items-center gap-1">
          <button
            onClick={logout}
            className="flex-1 text-left px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 rounded"
          >
            Sign out
          </button>
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              `p-1.5 rounded transition-colors ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .205 1.251l-1.18 2.044a1 1 0 0 1-1.186.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.113a7.047 7.047 0 0 1 0-2.228L1.821 7.773a1 1 0 0 1-.205-1.251l1.18-2.044a1 1 0 0 1 1.186-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                clipRule="evenodd"
              />
            </svg>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
