import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Project } from '@mission-control/types';

export default function ProjectsIndex() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api
      .get<Project[]>('/api/projects')
      .then((list) => {
        setProjects(list);
        if (list.length > 0) {
          const openAdd = new URLSearchParams(window.location.search).get('add') === '1';
          const suffix = openAdd ? '?add=1' : '';
          navigate(`/projects/${list[0]!.id}${suffix}`, { replace: true });
        }
      })
      .catch(() => {
        setProjects([]);
      });
  }, [navigate]);

  if (projects === null) {
    return <p className="text-gray-500 text-sm">Loading projects…</p>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-gray-500 text-sm max-w-md">
        <p>No projects yet. Use + Add in the sidebar to create one.</p>
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">Redirecting…</p>;
}
