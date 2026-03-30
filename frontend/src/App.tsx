import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import Shell from './components/layout/Shell.js';
import Login from './pages/Login.js';
import Agents from './pages/Agents.js';
import AgentDetail from './pages/AgentDetail.js';
import Projects from './pages/Projects.js';
import WellnessLayout from './pages/WellnessLayout.js';
import WellnessDailyLog from './pages/WellnessDailyLog.js';
import WellnessInsights from './pages/WellnessInsights.js';
import Chat from './pages/Chat.js';
import ChatIndex from './pages/ChatIndex.js';
import ProjectsIndex from './pages/ProjectsIndex.js';
import Usage from './pages/Usage.js';
import Settings from './pages/Settings.js';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/agents" replace />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:agentId" element={<AgentDetail />} />
            <Route path="projects" element={<ProjectsIndex />} />
            <Route path="projects/:projectId" element={<Projects />} />
            <Route path="health" element={<Navigate to="/wellness/log" replace />} />
            <Route path="wellness" element={<WellnessLayout />}>
              <Route index element={<Navigate to="log" replace />} />
              <Route path="log" element={<WellnessDailyLog />} />
              <Route path="insights" element={<WellnessInsights />} />
            </Route>
            <Route path="chat" element={<ChatIndex />} />
            <Route path="chat/:channelId" element={<Chat />} />
            <Route path="usage" element={<Usage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
