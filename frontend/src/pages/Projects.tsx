import { useEffect, useState } from 'react';
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
import { api, ApiError } from '../utils/api.js';
import type { Project, Task, TaskStatus, Agent, Intent, IntentStatus } from '@mission-control/types';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'Doing' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

const INTENT_STATUS_LABELS: Record<IntentStatus, string> = {
  open: 'Open',
  converted: 'Converted',
  cancelled: 'Cancelled',
};

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
      {assignedAgent && (
        <span className="mt-2 inline-block text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
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
  onClose,
  onSaved,
}: {
  task: Task | null;
  agents: Agent[];
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'backlog');
  const [agentId, setAgentId] = useState(task?.assignedAgentId ?? '');

  async function save() {
    if (task) {
      await api.patch(`/api/tasks/${task.id}`, {
        title,
        description,
        status,
        assignedAgentId: agentId || null,
      });
    } else {
      await api.post('/api/tasks', {
        projectId,
        title,
        description,
        status,
        assignedAgentId: agentId || undefined,
      });
    }
    onSaved();
    onClose();
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.delete(`/api/tasks/${task.id}`);
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [intentTitle, setIntentTitle] = useState('');
  const [intentBody, setIntentBody] = useState('');
  const [slideOver, setSlideOver] = useState<Task | null | 'new'>(null);
  const [intentSaving, setIntentSaving] = useState(false);
  const [convertingIntentId, setConvertingIntentId] = useState<string | null>(null);

  const loadProjects = () =>
    api
      .get<Project[]>('/api/projects')
      .then((projectList) => {
        setProjects(projectList);
        if (projectList.length === 0) {
          setSelectedProject(null);
          return;
        }
        setSelectedProject((current) => {
          if (!current) return projectList[0]!;
          return projectList.find((project) => project.id === current.id) ?? projectList[0]!;
        });
      })
      .catch(() => {});

  const loadTasks = (projectId: string) => {
    api.get<Task[]>(`/api/projects/${projectId}/tasks`).then(setTasks).catch(() => {});
  };

  const loadIntents = () => {
    api.get<Intent[]>('/api/intents').then(setIntents).catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    loadIntents();
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    loadTasks(selectedProject.id);

    const pollId = setInterval(() => {
      loadTasks(selectedProject.id);
    }, 10_000);

    return () => clearInterval(pollId);
  }, [selectedProject]);

  useEffect(() => {
    const pollId = setInterval(loadIntents, 15_000);
    return () => clearInterval(pollId);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
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

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t)),
    );
    await api.patch(`/api/tasks/${task.id}`, { status: targetStatus });
  }

  const reload = () => {
    if (!selectedProject) return;
    loadTasks(selectedProject.id);
  };

  async function createIntent() {
    if (!intentTitle.trim() || !intentBody.trim()) return;
    setIntentSaving(true);
    try {
      await api.post('/api/intents', {
        title: intentTitle.trim(),
        body: intentBody.trim(),
      });
      setIntentTitle('');
      setIntentBody('');
      loadIntents();
    } finally {
      setIntentSaving(false);
    }
  }

  async function convertIntent(intent: Intent) {
    setConvertingIntentId(intent.id);
    try {
      const result = await api.post<{ intent: Intent; project: Project }>(
        `/api/intents/${intent.id}/convert`,
        {
          projectName: intent.title,
          projectDescription: intent.body,
        },
      );
      loadIntents();
      loadProjects();
      setSelectedProject(result.project);
    } finally {
      setConvertingIntentId(null);
    }
  }

  async function deleteIntent(intent: Intent) {
    if (intent.status === 'converted') return;
    if (!window.confirm(`Delete intent "${intent.title}"?`)) return;
    try {
      await api.delete(`/api/intents/${intent.id}`);
      loadIntents();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete intent';
      window.alert(message);
    }
  }

  async function deleteSelectedProject() {
    if (!selectedProject) return;
    if (
      !window.confirm(
        `Delete project "${selectedProject.name}" and all its tasks? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/projects/${selectedProject.id}`);
      await loadProjects();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete project';
      window.alert(message);
    }
  }

  async function deleteTaskFromBoard(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.delete(`/api/tasks/${task.id}`);
      reload();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to delete task';
      window.alert(message);
    }
  }

  return (
    <div className="flex h-full gap-0 -mx-6 overflow-hidden">
      <aside className="w-72 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-300">Intents</span>
        </div>
        <div className="px-4 py-3 border-b border-gray-800 space-y-2">
          <input
            value={intentTitle}
            onChange={(event) => setIntentTitle(event.target.value)}
            placeholder="Intent title"
            className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
          />
          <textarea
            value={intentBody}
            onChange={(event) => setIntentBody(event.target.value)}
            placeholder="Intent details"
            rows={3}
            className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none resize-none"
          />
          <button
            onClick={createIntent}
            disabled={intentSaving || !intentTitle.trim() || !intentBody.trim()}
            className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md"
          >
            Add Intent
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 border-b border-gray-800">
          {intents.map((intent) => (
            <div key={intent.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-sm text-white">{intent.title}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-3">{intent.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {INTENT_STATUS_LABELS[intent.status]}
                </span>
                <div className="flex items-center gap-1.5">
                  {intent.status !== 'converted' && (
                    <button
                      type="button"
                      onClick={() => deleteIntent(intent)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded"
                    >
                      Delete
                    </button>
                  )}
                  {intent.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => convertIntent(intent)}
                      disabled={convertingIntentId === intent.id}
                      className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded"
                    >
                      Convert
                    </button>
                  ) : intent.status === 'converted' ? (
                    <span className="text-[10px] text-gray-500">
                      {intent.createdProjectId ? 'Linked' : 'No link'}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {intents.length === 0 && (
            <p className="text-xs text-gray-500">No intents yet.</p>
          )}
        </div>

        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Projects</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProject(p)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selectedProject?.id === p.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-500">No projects yet.</p>
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-x-auto px-6 py-6">
        {selectedProject && (
          <>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-white">{selectedProject.name}</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={deleteSelectedProject}
                  className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm border border-red-900/60 hover:border-red-800 rounded-md"
                >
                  Delete project
                </button>
                <button
                  type="button"
                  onClick={() => setSlideOver('new')}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
                >
                  + Task
                </button>
              </div>
            </div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 min-w-max">
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
          </>
        )}
        {!selectedProject && projects.length > 0 && (
          <p className="text-gray-500">Select a project to view its board.</p>
        )}
      </div>

      {slideOver !== null && (
        <TaskSlideOver
          task={slideOver === 'new' ? null : slideOver}
          agents={agents}
          projectId={selectedProject?.id ?? ''}
          onClose={() => setSlideOver(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
