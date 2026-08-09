import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loader } from './components/Loader';
import { useAuthStore } from './utils/authStore';

// Lazy Load Pages for Performance
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const CreateForm = React.lazy(() => import('./pages/admin/CreateForm'));
const FormDetails = React.lazy(() => import('./pages/admin/FormDetails'));
const AdminRequests = React.lazy(() => import('./pages/admin/AdminRequests'));
const AdminSupervisors = React.lazy(() => import('./pages/admin/AdminSupervisors'));
const AdminStudents = React.lazy(() => import('./pages/admin/AdminStudents'));
const AdminProjectsOverview = React.lazy(() => import('./pages/admin/AdminProjectsOverview'));
const AdminTasks = React.lazy(() => import('./pages/admin/AdminTasks'));
const Enrollment = React.lazy(() => import('./pages/Enrollment'));
const SupervisorDashboard = React.lazy(() => import('./pages/supervisor/SupervisorDashboard'));
const SupervisorProjects = React.lazy(() => import('./pages/supervisor/SupervisorProjects'));
const SupervisorTeamOverview = React.lazy(() => import('./pages/supervisor/SupervisorTeamOverview'));
const SupervisorTasks = React.lazy(() => import('./pages/supervisor/SupervisorTasks'));
const SupervisorReview = React.lazy(() => import('./pages/supervisor/SupervisorReview'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const Chat = React.lazy(() => import('./pages/Chat'));
const Settings = React.lazy(() => import('./pages/Settings'));
const StudentProjects = React.lazy(() => import('./pages/StudentProjects'));

const App: React.FC = () => {
  const initializeAuth = useAuthStore(state => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <Suspense fallback={<Loader fullScreen size="lg" />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<LandingPage />} />
          
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="enroll" element={<Enrollment />} />
            
            {/* Student/Shared Routes */}
            <Route path="projects" element={<StudentProjects />} />
            <Route path="chat" element={<Chat />} />
            <Route path="settings" element={<Settings />} />

            {/* Admin Routes */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/projects" element={<AdminProjectsOverview />} />
            <Route path="admin/tasks" element={<AdminTasks />} />
            <Route path="admin/requests" element={<AdminRequests />} />
            <Route path="admin/supervisors" element={<AdminSupervisors />} />
            <Route path="admin/students" element={<AdminStudents />} />
            <Route path="admin/create-form" element={<CreateForm />} />
            <Route path="admin/form-details/:formId" element={<FormDetails />} />
            
            {/* Supervisor Routes */}
            <Route path="/supervisor">
              <Route path="dashboard" element={<SupervisorDashboard />} />
              <Route path="projects" element={<SupervisorProjects />} />
              <Route path="teams/:teamId" element={<SupervisorTeamOverview />} />
              <Route path="tasks" element={<SupervisorTasks />} />
              <Route path="submissions/:projectId" element={<SupervisorReview />} />
            </Route>
            
            {/* Catch all - 404 fallback */}
            <Route path="*" element={
              <div style={{ textAlign: 'center', padding: '64px' }}>
                <h2>404 - Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
              </div>
            } />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
