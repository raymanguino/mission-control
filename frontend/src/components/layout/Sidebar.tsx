import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../utils/api.js';
import type { Agent, Channel, Project } from '@mission-control/types';
import { useAuth } from '../../contexts/AuthContext.js';
import { PROJECT_STATUS_BADGE_CLASS, PROJECT_STATUS_LABELS } from '../../utils/projectLabels.js';
import AddProjectModal from '../AddProjectModal.js';

const staticNavItems = [
  { to: '/agents', label: 'Agents' },
  { to: '/usage', label: 'Usage' },
];

const statusColor: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-400',
};

function childLinkClass(isActive: boolean) {
  return `block pl-8 pr-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-800/80 hover:text-white'
  }`;
}

type NavSectionId = 'overview' | 'chat' | 'projects' | 'wellness';

function sectionFromPath(pathname: string): NavSectionId | null {
  if (pathname.startsWith('/agents') || pathname.startsWith('/usage')) return 'overview';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/wellness')) return 'wellness';
  return null;
}

interface CollapsibleNavSectionProps {
  title: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  panelId: string;
  children: ReactNode;
  headerRight?: ReactNode;
}

function CollapsibleNavSection({
  title,
  active,
  open,
  onToggle,
  panelId,
  children,
  headerRight,
}: CollapsibleNavSectionProps) {
  return (
    <div>
      <div className="flex items-stretch gap-1 min-w-0">
        <button
          type="button"
          id={`${panelId}-trigger`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={`flex-1 flex items-center gap-1.5 min-w-0 text-left px-3 py-2 rounded-md transition-colors hover:bg-gray-800/80 ${
            active ? 'text-indigo-300' : 'text-gray-500'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
          <span className={`text-xs font-semibold uppercase tracking-wider ${active ? 'text-indigo-300' : 'text-gray-500'}`}>
            {title}
          </span>
        </button>
        {headerRight ? <div className="flex items-center shrink-0 pr-1">{headerRight}</div> : null}
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className={open ? 'space-y-0.5 mt-1' : 'hidden'}
      >
        {children}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [openSection, setOpenSection] = useState<NavSectionId | null>(() =>
    sectionFromPath(window.location.pathname),
  );

  const loadChannels = () =>
    api.get<Channel[]>('/api/channels').then(setChannels).catch(() => {});
  const loadProjects = () =>
    api.get<Project[]>('/api/projects').then(setProjects).catch(() => {});

  useEffect(() => {
    const fetchAgents = () =>
      api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
    fetchAgents();
    const id = setInterval(fetchAgents, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadChannels();
    loadProjects();
  }, [location.pathname]);

  useEffect(() => {
    setOpenSection(sectionFromPath(location.pathname));
  }, [location.pathname]);

  const toggleSection = (id: NavSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const overviewSectionActive =
    location.pathname.startsWith('/agents') || location.pathname.startsWith('/usage');

  const chatSectionActive = location.pathname.startsWith('/chat');
  const projectsSectionActive = location.pathname.startsWith('/projects');
  const wellnessSectionActive = location.pathname.startsWith('/wellness');

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-gray-900 text-gray-100 border-r border-gray-800">
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">Mission Control</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <CollapsibleNavSection
          title="Overview"
          active={overviewSectionActive}
          open={openSection === 'overview'}
          onToggle={() => toggleSection('overview')}
          panelId="sidebar-overview-panel"
        >
          <div className="space-y-0.5">
            {staticNavItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/agents'}
                className={({ isActive }) => childLinkClass(isActive)}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </CollapsibleNavSection>

        <CollapsibleNavSection
          title="Chat"
          active={chatSectionActive}
          open={openSection === 'chat'}
          onToggle={() => toggleSection('chat')}
          panelId="sidebar-chat-panel"
        >
          {channels.map((c) => (
            <NavLink
              key={c.id}
              to={`/chat/${c.id}`}
              title={
                c.source === 'discord' && c.externalId
                  ? `Discord channel id ${c.externalId} — pick the channel that matches where people talk in Discord`
                  : undefined
              }
              className={({ isActive }) => childLinkClass(isActive)}
            >
              <span className="block truncate"># {c.name}</span>
              {c.source === 'discord' && c.externalId ? (
                <span className="block text-[10px] text-gray-600 font-mono mt-0.5 truncate">
                  …{c.externalId.slice(-8)}
                </span>
              ) : null}
            </NavLink>
          ))}
          {channels.length === 0 && (
            <p className="pl-8 pr-2 text-xs text-gray-600 py-1">No channels</p>
          )}
        </CollapsibleNavSection>

        <CollapsibleNavSection
          title="Projects"
          active={projectsSectionActive}
          open={openSection === 'projects'}
          onToggle={() => toggleSection('projects')}
          panelId="sidebar-projects-panel"
          headerRight={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddProject(true);
              }}
              className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
            >
              + Add
            </button>
          }
        >
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={({ isActive }) => childLinkClass(isActive)}
            >
              <span className="block truncate">{p.name}</span>
              <span
                className={`mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${PROJECT_STATUS_BADGE_CLASS[p.status]}`}
              >
                {PROJECT_STATUS_LABELS[p.status]}
              </span>
            </NavLink>
          ))}
          {projects.length === 0 && (
            <p className="pl-8 pr-2 text-xs text-gray-600 py-1">No projects</p>
          )}
        </CollapsibleNavSection>

        <CollapsibleNavSection
          title="Wellness"
          active={wellnessSectionActive}
          open={openSection === 'wellness'}
          onToggle={() => toggleSection('wellness')}
          panelId="sidebar-wellness-panel"
        >
          <NavLink to="/wellness/log" className={({ isActive }) => childLinkClass(isActive)}>
            Daily Log
          </NavLink>
          <NavLink to="/wellness/insights" className={({ isActive }) => childLinkClass(isActive)}>
            AI Insights
          </NavLink>
        </CollapsibleNavSection>
      </nav>

      {showAddProject && (
        <AddProjectModal
          onClose={() => setShowAddProject(false)}
          onCreated={(project) => {
            loadProjects();
            navigate(`/projects/${project.id}`);
          }}
        />
      )}

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
