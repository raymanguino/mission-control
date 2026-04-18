import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.js';
import { DashboardTitleProvider } from './contexts/DashboardTitleContext.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import Shell from './components/layout/Shell.js';
import Login from './pages/Login.js';
import Agents from './pages/Agents.js';
import AgentDetail from './pages/AgentDetail.js';
import Projects from './pages/Projects.js';
import WellnessLayout from './pages/WellnessLayout.js';
import WellnessSleep from './pages/WellnessSleep.js';
import WellnessFood from './pages/WellnessFood.js';
import WellnessGreens from './pages/WellnessGreens.js';
import WellnessInsights from './pages/WellnessInsights.js';
import Chat from './pages/Chat.js';
import ChatIndex from './pages/ChatIndex.js';
import ProjectsIndex from './pages/ProjectsIndex.js';
import Usage from './pages/Usage.js';
import Logs from './pages/Logs.js';
import Settings from './pages/Settings.js';

export default function App() {
  return (
    <BrowserRouter>
      <DashboardTitleProvider>
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
              <Route path="health" element={<Navigate to="/wellness/sleep" replace />} />
              <Route path="wellness" element={<WellnessLayout />}>
                <Route index element={<Navigate to="sleep" replace />} />
                <Route path="log" element={<Navigate to="/wellness/sleep" replace />} />
                <Route path="sleep" element={<WellnessSleep />} />
                <Route path="food" element={<Navigate to="/wellness/diet" replace />} />
                <Route path="greens" element={<Navigate to="/wellness/meds" replace />} />
                <Route path="diet" element={<WellnessFood />} />
                <Route path="meds" element={<WellnessGreens />} />
                <Route path="insights" element={<WellnessInsights />} />
              </Route>
              <Route path="chat" element={<ChatIndex />} />
              <Route path="chat/:channelId" element={<Chat />} />
              <Route path="usage" element={<Usage />} />
              <Route path="logs" element={<Logs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </AuthProvider>
      </DashboardTitleProvider>
    </BrowserRouter>
  );
}
