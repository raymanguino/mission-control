import { useState } from 'react';
import { api, ApiError } from '../utils/api.js';
import type { Project } from '@mission-control/types';

interface AddProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export default function AddProjectModal({ onClose, onCreated }: AddProjectModalProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);

  async function createProject() {
    if (!newProjectName.trim()) return;
    setProjectSaving(true);
    try {
      const project = await api.post<Project>('/api/projects', {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      });
      onCreated(project);
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to create project';
      window.alert(message);
    } finally {
      setProjectSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-96 bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl"
          >
            ×
          </button>
        </div>
        <div>
          <label className="text-xs text-gray-400">Project Name</label>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && createProject()}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Description</label>
          <textarea
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={createProject}
            disabled={projectSaving || !newProjectName.trim()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md"
          >
            {projectSaving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
