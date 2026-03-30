import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import Shell from './components/layout/Shell.js';
import Login from './pages/Login.js';
import Agents from './pages/Agents.js';
import AgentDetail from './pages/AgentDetail.js';
import Projects from './pages/Projects.js';
import Wellness from './pages/Health.js';
import Chat from './pages/Chat.js';
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
            <Route path="projects" element={<Projects />} />
            <Route path="health" element={<Navigate to="/wellness" replace />} />
            <Route path="wellness" element={<Wellness />} />
            <Route path="chat" element={<Chat />} />
            <Route path="usage" element={<Usage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
