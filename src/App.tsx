import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loader } from './components/Loader';
import { useAuthStore } from './utils/authStore';

// Lazy Load Pages for Performance
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const CreateForm = React.lazy(() => import('./pages/admin/CreateForm'));
const FormDetails = React.lazy(() => import('./pages/admin/FormDetails'));
const Enrollment = React.lazy(() => import('./pages/Enrollment'));
const SupervisorDashboard = React.lazy(() => import('./pages/supervisor/SupervisorDashboard'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));

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
          
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="enroll" element={<Enrollment />} />
            
            {/* Admin Routes */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/create-form" element={<CreateForm />} />
            <Route path="admin/form-details/:formId" element={<FormDetails />} />
            
            {/* Supervisor Routes */}
            <Route path="supervisor/dashboard" element={<SupervisorDashboard />} />
            
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
