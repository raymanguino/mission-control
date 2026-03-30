import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
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
import type { Project, Task, TaskStatus, Agent } from '@mission-control/types';
import { PROJECT_STATUS_LABELS } from '../utils/projectLabels.js';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing', label: 'Doing' },
  { id: 'review', label: 'Review' },
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
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [slideOver, setSlideOver] = useState<Task | null | 'new'>(null);

  const loadProjectList = () =>
    api
      .get<Project[]>('/api/projects')
      .then(setProjects)
      .catch(() => {
        setProjects([]);
      });

  const loadTasks = (id: string) => {
    api.get<Task[]>(`/api/projects/${id}/tasks`).then(setTasks).catch(() => {});
  };

  const selectedProject =
    projectId && projects ? projects.find((p) => p.id === projectId) : undefined;

  useEffect(() => {
    loadProjectList();
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
      navigate('/projects');
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

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (projects === null) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  if (!selectedProject) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="flex h-full gap-0 -mx-6 overflow-hidden">
      <div className="flex-1 overflow-x-auto px-6 py-6">
        {selectedProject && selectedProject.status === 'approved' && (
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
        {selectedProject && selectedProject.status !== 'approved' && (
          <>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-white">{selectedProject.name}</h1>
              <button
                type="button"
                onClick={deleteSelectedProject}
                className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm border border-red-900/60 hover:border-red-800 rounded-md"
              >
                Delete project
              </button>
            </div>
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-gray-400 text-sm">
                This project is{' '}
                <span className="font-medium">{PROJECT_STATUS_LABELS[selectedProject.status]}</span>.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Task management is only available for approved projects.
              </p>
            </div>
          </>
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
