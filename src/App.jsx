import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Protected Route wrapper — checks authentication
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  return children;
};

// Permission-gated Route — checks if user has the required permission
const PermissionRoute = ({ permission, children }) => {
  const { hasPermission } = useAuth();

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Reports from './pages/Reports';
import Customers from './pages/Customers';
import AITaskCreator from './pages/AITaskCreator';
import SetPassword from './pages/SetPassword';
import Holidays from './pages/Holidays';
import Notifications from './pages/Notifications';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={
              <PermissionRoute permission="manage_projects"><Projects /></PermissionRoute>
            } />
            <Route path="customers" element={
              <PermissionRoute permission="manage_projects"><Customers /></PermissionRoute>
            } />
            <Route path="tasks" element={<Tasks />} />
            <Route path="projects/:projectId" element={
              <PermissionRoute permission="manage_projects"><Tasks /></PermissionRoute>
            } />
            <Route path="team" element={
              <PermissionRoute permission="manage_team"><Team /></PermissionRoute>
            } />
            <Route path="attendance" element={<Attendance />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="reports" element={
              <PermissionRoute permission="view_reports"><Reports /></PermissionRoute>
            } />
            <Route path="settings" element={
              <PermissionRoute permission="manage_roles"><Settings /></PermissionRoute>
            } />
            <Route path="ai-tasks" element={
              <PermissionRoute permission="ai_task_creator"><AITaskCreator /></PermissionRoute>
            } />
            <Route path="holidays" element={<Holidays />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
