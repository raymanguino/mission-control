import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import type { Agent } from '@mission-control/types';
import { useAuth } from '../../contexts/AuthContext.js';

const navItems = [
  { to: '/agents', label: 'Agents' },
  { to: '/projects', label: 'Projects' },
  { to: '/health', label: 'Health' },
  { to: '/chat', label: 'Chat' },
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
        <button
          onClick={logout}
          className="mt-3 w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 rounded"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
