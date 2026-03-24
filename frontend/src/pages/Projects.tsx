import { useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../utils/api.js';
import type { Project, Task, TaskStatus, Agent } from '@mission-control/types';

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
}: {
  task: Task;
  agents: Agent[];
  onEdit: (t: Task) => void;
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
      <p className="text-sm text-white">{task.title}</p>
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
    await api.delete(`/api/tasks/${task.id}`);
    onSaved();
    onClose();
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
  const [slideOver, setSlideOver] = useState<Task | null | 'new'>(null);

  useEffect(() => {
    api.get<Project[]>('/api/projects').then((p) => {
      setProjects(p);
      if (p.length > 0 && !selectedProject) setSelectedProject(p[0]!);
    });
    api.get<Agent[]>('/api/agents').then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    api
      .get<Task[]>(`/api/projects/${selectedProject.id}/tasks`)
      .then(setTasks)
      .catch(() => {});
  }, [selectedProject]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const task = tasks.find((t) => t.id === active.id);
    const target = tasks.find((t) => t.id === over.id);
    if (!task || !target || task.status === target.status) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: target.status } : t)),
    );
    await api.patch(`/api/tasks/${task.id}`, { status: target.status });
  }

  const reload = () => {
    if (!selectedProject) return;
    api
      .get<Task[]>(`/api/projects/${selectedProject.id}/tasks`)
      .then(setTasks)
      .catch(() => {});
  };

  return (
    <div className="flex h-full gap-0 -mx-6 overflow-hidden">
      {/* Project sidebar */}
      <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Projects</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
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
        </div>
      </aside>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 py-6">
        {selectedProject && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-semibold text-white">{selectedProject.name}</h1>
              <button
                onClick={() => setSlideOver('new')}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
              >
                + Task
              </button>
            </div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 min-w-max">
                {COLUMNS.map((col) => {
                  const colTasks = tasks.filter((t) => t.status === col.id);
                  return (
                    <div key={col.id} className="w-64 flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {col.label}
                        </span>
                        <span className="text-xs text-gray-600">{colTasks.length}</span>
                      </div>
                      <SortableContext
                        items={colTasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {colTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            agents={agents}
                            onEdit={(task) => setSlideOver(task)}
                          />
                        ))}
                      </SortableContext>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          </>
        )}
        {projects.length === 0 && (
          <p className="text-gray-500">No projects yet.</p>
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
