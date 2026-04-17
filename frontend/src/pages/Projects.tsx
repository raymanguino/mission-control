import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AgentAvatar } from '../components/agents/AgentAvatar.js';
import { api, ApiError } from '../utils/api.js';
import type { Project, ProjectStatus, Task, TaskStatus, Agent } from '@mission-control/types';
import { PROJECT_STATUS_LABELS } from '../utils/projectLabels.js';

function ApprovedByRow({
  agents,
  approvedByAgentId,
  compact = false,
}: {
  agents: Agent[];
  approvedByAgentId: string | null;
  compact?: boolean;
}) {
  const approver = approvedByAgentId ? agents.find((a) => a.id === approvedByAgentId) : null;
  const avatarSize = compact ? 18 : 22;
  const textClass = compact ? 'text-xs' : 'text-sm';
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${textClass}`}>
      <span className="text-green-400 shrink-0">Approved by</span>
      {approver ? (
        <span className="inline-flex items-center gap-1.5 text-gray-200 min-w-0">
          <AgentAvatar avatarId={approver.avatarId} size={avatarSize} className="rounded-sm shrink-0" />
          <span className="truncate">{approver.name}</span>
        </span>
      ) : approvedByAgentId ? (
        <span className="text-gray-400 font-mono text-[0.65rem] break-all">{approvedByAgentId}</span>
      ) : (
        <span className="text-gray-500 italic">Not recorded</span>
      )}
    </div>
  );
}

function notifyProjectsUpdated() {
  window.dispatchEvent(new Event('mission-control-projects-updated'));
}

const PROJECT_FIELD_CLASS =
  'w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500';

function OpensInNewTabIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`shrink-0 text-gray-500 ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0 .053 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Same overlay shell as wellness log modals (Health.tsx Modal). */
function ProjectEditModal({
  open,
  project,
  agents,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  project: Project;
  agents: Agent[];
  onClose: () => void;
  onSaved: (p: Project) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [url, setUrl] = useState(project.url ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setDescription(project.description ?? '');
    setUrl(project.url ?? '');
    setStatus(project.status);
  }, [open, project.id, project.name, project.description, project.url, project.status, project.approvedByAgentId]);

  const dirty =
    name !== project.name ||
    (description || '') !== (project.description ?? '') ||
    (url || '') !== (project.url ?? '') ||
    status !== project.status;

  async function save() {
    if (!name.trim()) {
      window.alert('Project name is required.');
      return;
    }
    if (status === 'approved' && project.status !== 'approved' && !url.trim()) {
      window.alert('Project URL is required to approve a project.');
      return;
    }
    setSaving(true);
    try {
      const trimmedUrl = url.trim();
      const updated = await api.patch<Project>(`/api/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim(),
        url: trimmedUrl ? trimmedUrl : null,
        status,
      });
      onSaved(updated);
      notifyProjectsUpdated();
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to save project';
      window.alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    const displayName = name.trim() || project.name;
    if (
      !window.confirm(
        `Delete project "${displayName}" and all its tasks? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${project.id}`);
      notifyProjectsUpdated();
      onClose();
      onDeleted();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete project';
      window.alert(message);
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">Edit project</h2>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${PROJECT_FIELD_CLASS} text-base font-semibold`}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${PROJECT_FIELD_CLASS} resize-none`}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className={PROJECT_FIELD_CLASS}
          >
            {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {status === 'approved' ? (
          <div className="rounded-lg border border-gray-700/80 bg-gray-800/40 px-3 py-2">
            <ApprovedByRow agents={agents} approvedByAgentId={project.approvedByAgentId} />
          </div>
        ) : null}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Project URL
            {status === 'approved' && project.status !== 'approved' ? (
              <span className="text-amber-400/90"> (required to approve)</span>
            ) : (
              <span className="text-gray-500"> (optional)</span>
            )}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className={PROJECT_FIELD_CLASS}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-4">
          <button
            type="button"
            onClick={() => void deleteProject()}
            disabled={deleting || saving}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete project'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || deleting || !dirty}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-md"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'Doing' },
  { id: 'review', label: 'Review' },
  { id: 'not_done', label: 'Not Done' },
  { id: 'done', label: 'Done' },
];

function TaskCard({
  task,
  agents,
  onEdit,
  onDelete,
}: {
  task: Task;
  agents: Agent[];
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const assignedAgent = agents.find((a) => a.id === task.assignedAgentId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-gray-800 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-gray-700 hover:border-gray-600"
      onDoubleClick={() => onEdit(task)}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm text-white min-w-0">{task.title}</p>
        <button
          type="button"
          aria-label="Delete task"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
          className="shrink-0 text-gray-500 hover:text-red-400 text-lg leading-none px-0.5 -mt-0.5"
        >
          ×
        </button>
      </div>
      {task.description && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
      )}
      {task.resolution && (
        <p className="text-xs text-amber-200/90 mt-1 line-clamp-2" title={task.resolution}>
          Resolution: {task.resolution}
        </p>
      )}
      {assignedAgent && (
        <span className="mt-2 inline-flex items-center gap-1.5 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
          <AgentAvatar avatarId={assignedAgent.avatarId} size={18} className="rounded-sm" />
          {assignedAgent.name}
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  agents,
  onEdit,
  onDeleteTask,
}: {
  column: { id: TaskStatus; label: string };
  tasks: Task[];
  agents: Agent[];
  onEdit: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`w-64 flex flex-col gap-2 rounded-lg p-2 transition-colors ${
        isOver ? 'bg-gray-900/80' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {column.label}
        </span>
        <span className="text-xs text-gray-600">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            agents={agents}
            onEdit={onEdit}
            onDelete={onDeleteTask}
          />
        ))}
      </SortableContext>
      {tasks.length === 0 && (
        <div className="h-16 border border-dashed border-gray-800 rounded-lg" />
      )}
    </div>
  );
}

function TaskSlideOver({
  task,
  agents,
  projectId,
  projectUrl,
  onClose,
  onSaved,
}: {
  task: Task | null;
  agents: Agent[];
  projectId: string;
  /** Required when moving a task into Review (server rejects if missing). */
  projectUrl: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [resolution, setResolution] = useState(task?.resolution ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'backlog');
  const [agentId, setAgentId] = useState(task?.assignedAgentId ?? '');

  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setResolution(task?.resolution ?? '');
    setStatus((task?.status ?? 'backlog') as TaskStatus);
    setAgentId(task?.assignedAgentId ?? '');
  }, [task]);

  async function save() {
    const movingToReview = status === 'review' && (!task || task.status !== 'review');
    if (movingToReview && !projectUrl?.trim()) {
      window.alert('Set a project URL in Edit project before moving tasks to Review.');
      return;
    }
    try {
      if (task) {
        await api.patch(`/api/projects/${projectId}/tasks/${task.id}`, {
          title,
          description,
          resolution,
          status,
          assignedAgentId: agentId || null,
        });
      } else {
        await api.post(`/api/projects/${projectId}/tasks`, {
          title,
          description,
          resolution: resolution || undefined,
          status,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to save task';
      window.alert(message);
    }
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.delete(`/api/projects/${projectId}/tasks/${task.id}`);
      onSaved();
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete task';
      window.alert(message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-96 bg-gray-900 h-full flex flex-col border-l border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Resolution</label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              placeholder="How this task was resolved or closed (optional)"
              className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none resize-none placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {task ? (
            <div>
              <label className="text-xs text-gray-400">Assigned Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
              >
                <option value="">None</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              New tasks start unassigned. Assignees are chosen when a task moves into Doing or Review
              (unless you set one explicitly when editing).
            </p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-800 flex justify-between">
          {task ? (
            <button
              onClick={remove}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoadError, setProjectLoadError] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [slideOver, setSlideOver] = useState<Task | null | 'new'>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const loadTasks = (id: string) => {
    api.get<Task[]>(`/api/projects/${id}/tasks`).then(setTasks).catch(() => {});
  };

  useEffect(() => {
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setProject(null);
    setProjectLoadError(false);
    api
      .get<Project>(`/api/projects/${projectId}`)
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch(() => {
        if (!cancelled) setProjectLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    loadTasks(project.id);

    const pollId = setInterval(() => {
      loadTasks(project.id);
    }, 10_000);

    return () => clearInterval(pollId);
  }, [project?.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    if (!project) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    let targetStatus: TaskStatus | null = null;
    if (overId.startsWith('column:')) {
      const columnId = overId.replace('column:', '');
      if (COLUMNS.some((column) => column.id === columnId)) {
        targetStatus = columnId as TaskStatus;
      }
    } else {
      const targetTask = tasks.find((item) => item.id === overId);
      targetStatus = targetTask?.status ?? null;
    }

    if (!targetStatus || task.status === targetStatus) return;

    if (
      targetStatus === 'review' &&
      task.status !== 'review' &&
      !project.url?.trim()
    ) {
      window.alert('Set a project URL in Edit project before moving tasks to Review.');
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t)),
    );
    try {
      await api.patch(`/api/projects/${project.id}/tasks/${task.id}`, { status: targetStatus });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to update task';
      window.alert(message);
      reload();
    }
  }

  const reload = () => {
    if (!project) return;
    loadTasks(project.id);
  };

  async function deleteTaskFromBoard(task: Task) {
    if (!project) return;
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.delete(`/api/projects/${project.id}/tasks/${task.id}`);
      reload();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete task';
      window.alert(message);
    }
  }

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (projectLoadError) {
    return <Navigate to="/projects" replace />;
  }

  if (!project) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  const descTrim = project.description?.trim() ?? '';
  const hasDescription = descTrim.length > 0;
  const urlTrim = project.url?.trim() ?? '';
  const approver =
    project.status === 'approved' && project.approvedByAgentId
      ? agents.find((a) => a.id === project.approvedByAgentId)
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col -mx-6 overflow-hidden">
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-800/70 bg-gray-950 px-6 pt-4 pb-3">
        <div className="w-full space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              <h1 className="text-lg font-semibold text-white tracking-tight truncate">{project.name}</h1>
              {project.status === 'approved' ? (
                <>
                  <span className="text-xs text-green-400 shrink-0">Approved by</span>
                  {project.approvedByAgentId ? (
                    <Link
                      to={`/agents/${project.approvedByAgentId}`}
                      title={approver?.name ?? 'View agent'}
                      aria-label={
                        approver ? `View ${approver.name} profile` : 'View approving agent profile'
                      }
                      className="inline-flex rounded-sm ring-offset-2 ring-offset-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <AgentAvatar
                        avatarId={approver?.avatarId ?? null}
                        size={22}
                        className="rounded-sm"
                      />
                    </Link>
                  ) : (
                    <span
                      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-dashed border-gray-600 bg-gray-900/60 text-[10px] font-medium text-gray-500"
                      title="Approver not recorded"
                      aria-label="Approver not recorded"
                    >
                      ?
                    </span>
                  )}
                </>
              ) : project.status === 'pending_approval' ? (
                <span className="text-xs text-yellow-400 shrink-0">Pending approval</span>
              ) : (
                <span className="text-xs text-red-300/90 shrink-0">{PROJECT_STATUS_LABELS[project.status]}</span>
              )}
              {urlTrim ? (
                <a
                  href={urlTrim}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open project URL in a new tab"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
                >
                  Open
                  <OpensInNewTabIcon />
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="px-2.5 py-1 text-xs text-gray-200 border border-gray-700 hover:border-gray-600 hover:bg-gray-800 rounded-md"
              >
                Edit project
              </button>
              {project.status === 'approved' ? (
                <button
                  type="button"
                  onClick={() => setSlideOver('new')}
                  className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                >
                  + Task
                </button>
              ) : null}
            </div>
          </div>

          <div className="h-36 rounded-lg border border-gray-800/90 bg-gray-900/50 flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-1.5 flex-1 min-h-0 overflow-y-auto">
              {hasDescription ? (
                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{descTrim}</p>
              ) : (
                <p className="text-xs text-gray-600 italic">No description.</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 py-3">
        <ProjectEditModal
          open={editModalOpen}
          project={project}
          agents={agents}
          onClose={() => setEditModalOpen(false)}
          onSaved={setProject}
          onDeleted={() => navigate('/projects')}
        />

        {project.status === 'approved' && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex min-w-max gap-4 pb-2">
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.id);
                return (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    tasks={colTasks}
                    agents={agents}
                    onEdit={(task) => setSlideOver(task)}
                    onDeleteTask={deleteTaskFromBoard}
                  />
                );
              })}
            </div>
          </DndContext>
        )}
        {project.status !== 'approved' && (
          <div className="flex min-h-[12rem] flex-col items-center justify-center text-center rounded-lg border border-dashed border-gray-800 bg-gray-900/30 px-4">
            <p className="max-w-md text-sm text-gray-400">
              The task board opens after this project is approved. Use Edit project to change status
              and other fields.
            </p>
            <p className="mt-2 max-w-md text-xs text-gray-500">
              Task management is only available for approved projects.
            </p>
          </div>
        )}
      </div>

      {slideOver !== null && (
        <TaskSlideOver
          task={slideOver === 'new' ? null : slideOver}
          agents={agents}
          projectId={project.id}
          projectUrl={project.url}
          onClose={() => setSlideOver(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
