import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../utils/api.js';
import type { Agent, Channel, Project } from '@mission-control/types';
import { useAuth } from '../../contexts/AuthContext.js';
import { PROJECT_STATUS_BADGE_CLASS, PROJECT_STATUS_LABELS } from '../../utils/projectLabels.js';
import AddProjectModal from '../AddProjectModal.js';

const OVERVIEW_NAV_ITEMS: readonly {
  to: string;
  label: string;
  end: boolean;
  paths: readonly { d: string; fillRule?: 'evenodd' }[];
}[] = [
  {
    to: '/agents',
    label: 'Agents',
    end: true,
    paths: [
      { d: 'M14 6H6v8h8V6Z' },
      {
        fillRule: 'evenodd',
        d: 'M9.25 3V1.75a.75.75 0 0 1 1.5 0V3h1.5V1.75a.75.75 0 0 1 1.5 0V3h.5A2.75 2.75 0 0 1 17 5.75v.5h1.25a.75.75 0 0 1 0 1.5H17v1.5h1.25a.75.75 0 0 1 0 1.5H17v1.5h1.25a.75.75 0 0 1 0 1.5H17v.5A2.75 2.75 0 0 1 14.25 17h-.5v1.25a.75.75 0 0 1-1.5 0V17h-1.5v1.25a.75.75 0 0 1-1.5 0V17h-1.5v1.25a.75.75 0 0 1-1.5 0V17h-.5A2.75 2.75 0 0 1 3 14.25v-.5H1.75a.75.75 0 0 1 0-1.5H3v-1.5H1.75a.75.75 0 0 1 0-1.5H3v-1.5H1.75a.75.75 0 0 1 0-1.5H3v-.5A2.75 2.75 0 0 1 5.75 3h.5V1.75a.75.75 0 0 1 1.5 0V3h1.5ZM4.5 5.75c0-.69.56-1.25 1.25-1.25h8.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5Z',
      },
    ],
  },
  {
    to: '/usage',
    label: 'Usage',
    end: false,
    paths: [
      {
        d: 'M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z',
      },
    ],
  },
];

const PROJECT_FOLDER_PATHS: readonly { d: string; fillRule?: 'evenodd' }[] = [
  {
    d: 'M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z',
  },
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

function childRowLinkClass(isActive: boolean) {
  return `flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-800/80 hover:text-white'
  }`;
}

function projectRowLinkClass(isActive: boolean) {
  return `flex items-start gap-2 pl-8 pr-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-800/80 hover:text-white'
  }`;
}

interface SidebarNavIconProps {
  isActive: boolean;
  paths: readonly { d: string; fillRule?: 'evenodd' }[];
  viewBox?: string;
}

function SidebarNavIcon({ isActive, paths, viewBox = '0 0 20 20' }: SidebarNavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="currentColor"
      className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-gray-500'}`}
      aria-hidden
    >
      {paths.map((p, i) =>
        p.fillRule ? (
          <path key={i} fillRule={p.fillRule} clipRule={p.fillRule} d={p.d} />
        ) : (
          <path key={i} d={p.d} />
        ),
      )}
    </svg>
  );
}

const WELLNESS_NAV_ITEMS: readonly {
  to: string;
  label: string;
  paths: readonly { d: string; fillRule?: 'evenodd' }[];
  sidebarAdd?: boolean;
  /** When set (e.g. Font Awesome 512×512 glyph), passed to the nav icon SVG */
  iconViewBox?: string;
}[] = [
  {
    to: '/wellness/sleep',
    label: 'Sleep',
    sidebarAdd: true,
    paths: [
      {
        d: 'M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z',
      },
    ],
  },
  {
    to: '/wellness/food',
    label: 'Food',
    sidebarAdd: true,
    paths: [
      {
        d:
          'm6.75.98-.884.883a1.25 1.25 0 1 0 1.768 0L6.75.98ZM13.25.98l-.884.883a1.25 1.25 0 1 0 1.768 0L13.25.98ZM10 .98l.884.883a1.25 1.25 0 1 1-1.768 0L10 .98ZM7.5 5.75a.75.75 0 0 0-1.5 0v.464c-1.179.304-2 1.39-2 2.622v.094c.1-.02.202-.038.306-.052A42.867 42.867 0 0 1 10 8.5c1.93 0 3.83.129 5.694.378.104.014.206.032.306.052v-.094c0-1.232-.821-2.317-2-2.622V5.75a.75.75 0 0 0-1.5 0v.318a45.645 45.645 0 0 0-1.75-.062V5.75a.75.75 0 0 0-1.5 0v.256c-.586.01-1.17.03-1.75.062V5.75ZM4.505 10.365A41.36 41.36 0 0 1 10 10c1.863 0 3.697.124 5.495.365C16.967 10.562 18 11.838 18 13.28v.693a3.72 3.72 0 0 1-1.665-.393 5.222 5.222 0 0 0-4.67 0 3.722 3.722 0 0 1-3.33 0 5.222 5.222 0 0 0-4.67 0A3.72 3.72 0 0 1 2 13.972v-.693c0-1.441 1.033-2.717 2.505-2.914ZM15.665 14.92a5.22 5.22 0 0 0 2.335.552V16.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 16.5v-1.028c.8 0 1.6-.184 2.335-.551a3.722 3.722 0 0 1 3.33 0c1.47.735 3.2.735 4.67 0a3.722 3.722 0 0 1 3.33 0Z',
      },
    ],
  },
  {
    to: '/wellness/greens',
    label: 'Greens',
    sidebarAdd: true,
    iconViewBox: '0 0 512 512',
    paths: [
      {
        // Font Awesome Free 6.7.2 "cannabis" solid (CC BY 4.0)
        d: 'M256 0c5.3 0 10.3 2.7 13.3 7.1c15.8 23.5 36.7 63.7 49.2 109c7.2 26.4 11.8 55.2 10.4 84c11.5-8.8 23.7-16.7 35.8-23.6c41-23.3 84.4-36.9 112.2-42.5c5.2-1 10.7 .6 14.4 4.4s5.4 9.2 4.4 14.5c-5.6 27.7-19.3 70.9-42.7 111.7c-9.1 15.9-19.9 31.7-32.4 46.3c27.8 6.6 52.4 17.3 67.2 25.5c5.1 2.8 8.2 8.2 8.2 14s-3.2 11.2-8.2 14c-15.2 8.4-40.9 19.5-69.8 26.1c-20.2 4.6-42.9 7.2-65.2 4.6l8.3 33.1c1.5 6.1-.6 12.4-5.5 16.4s-11.6 4.6-17.2 1.9L280 417.2l0 70.8c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-70.8-58.5 29.1c-5.6 2.8-12.3 2.1-17.2-1.9s-7-10.3-5.5-16.4l8.3-33.1c-22.2 2.6-45 0-65.2-4.6c-28.9-6.6-54.6-17.6-69.8-26.1c-5.1-2.8-8.2-8.2-8.2-14s3.2-11.2 8.2-14c14.8-8.2 39.4-18.8 67.2-25.5C78.9 296.3 68.1 280.5 59 264.6c-23.4-40.8-37.1-84-42.7-111.7c-1.1-5.2 .6-10.7 4.4-14.5s9.2-5.4 14.4-4.4c27.9 5.5 71.2 19.2 112.2 42.5c12.1 6.9 24.3 14.7 35.8 23.6c-1.4-28.7 3.1-57.6 10.4-84c12.5-45.3 33.4-85.5 49.2-109c3-4.4 8-7.1 13.3-7.1z',
      },
    ],
  },
  {
    to: '/wellness/insights',
    label: 'AI Insights',
    paths: [
      {
        d: 'M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z',
      },
    ],
  },
];

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
  // When the section is expanded, child NavLinks show the active state; avoid duplicating
  // that with the same "selected" accent on the section header. When collapsed, the header
  // still reflects the current route so wayfinding works without visible children.
  const headerAccent = active && !open;

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
            headerAccent ? 'text-indigo-300' : 'text-gray-500'
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
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${headerAccent ? 'text-indigo-300' : 'text-gray-500'}`}
          >
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
  const [searchParams, setSearchParams] = useSearchParams();
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

  useEffect(() => {
    if (!location.pathname.startsWith('/projects')) return;
    if (searchParams.get('add') !== '1') return;
    setShowAddProject(true);
    setSearchParams(
      (prev) => {
        if (!prev.get('add')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('add');
        return next;
      },
      { replace: true },
    );
  }, [location.pathname, searchParams, setSearchParams]);

  const projectAddHref = /^\/projects\/[^/]+$/.test(location.pathname)
    ? `${location.pathname}?add=1`
    : '/projects?add=1';

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
            {OVERVIEW_NAV_ITEMS.map(({ to, label, end, paths }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => childRowLinkClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <SidebarNavIcon isActive={isActive} paths={paths} />
                    <span className="truncate">{label}</span>
                  </>
                )}
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
            <Link
              to={projectAddHref}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded"
              title="Add project"
            >
              + Add
            </Link>
          }
        >
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={({ isActive }) => projectRowLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <SidebarNavIcon isActive={isActive} paths={PROJECT_FOLDER_PATHS} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span
                      className={`mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${PROJECT_STATUS_BADGE_CLASS[p.status]}`}
                    >
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </span>
                </>
              )}
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
          {WELLNESS_NAV_ITEMS.map(({ to, label, paths, sidebarAdd, iconViewBox }) =>
            sidebarAdd ? (
              <div key={to} className="flex items-center gap-1 pl-8 pr-2 py-1.5 rounded-md min-w-0">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex-1 flex items-center gap-2 min-w-0 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-500 hover:bg-gray-800/80 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <SidebarNavIcon isActive={isActive} paths={paths} viewBox={iconViewBox} />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
                <Link
                  to={`${to}?add=1`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded shrink-0"
                  title={`Add ${label}`}
                >
                  + Add
                </Link>
              </div>
            ) : (
              <NavLink key={to} to={to} className={({ isActive }) => childRowLinkClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <SidebarNavIcon isActive={isActive} paths={paths} viewBox={iconViewBox} />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ),
          )}
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
