import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Input, Button } from '../components';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';
import { ToastContainer } from '../components/Toast';
import { Lock, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const addToast = useToastStore(state => state.addToast);
  const navigate = useNavigate();



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please fill all fields', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Fetch all user types to determine role dynamically
      const [adminsRes, supervisorsRes, studentsRes] = await Promise.all([
        api.get('/admins').catch(() => ({ data: [] })),
        api.get('/supervisors').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] }))
      ]);

      const admins = adminsRes.data;
      const supervisors = supervisorsRes.data;
      const students = studentsRes.data;

      // 1. Check Admin
      let matchedAdmin = admins?.find((a: any) => a.mail === email && a.password === password);
      
      // Fallback for first-time system setup if no admins exist
      if (!matchedAdmin && email.includes('admin') && (!admins || admins.length === 0)) {
         const { data: newAdmin } = await api.post('/admins', { 
            name: "System Admin", 
            mail: email, 
            password: password, 
            department: "Computer Science" 
         });
         matchedAdmin = newAdmin;
      }

      if (matchedAdmin) {
        login({ id: matchedAdmin.adminId, name: matchedAdmin.name || 'Admin', email, role: 'ADMIN' });
        addToast('Login successful', 'success');
        navigate('/admin/dashboard');
        return;
      }

      // 2. Check Supervisor
      const matchedSupervisor = supervisors?.find((s: any) => s.mail === email && s.password === password);
      if (matchedSupervisor) {
        login({ id: matchedSupervisor.supervisorId, name: matchedSupervisor.name, email, role: 'SUPERVISOR' });
        addToast('Login successful', 'success');
        navigate('/supervisor/dashboard');
        return;
      }

      // 3. Check Student
      const matchedStudent = students?.find((s: any) => s.mail === email && s.password === password);
      if (matchedStudent) {
        login({ id: matchedStudent.studentId, name: matchedStudent.name, email, role: 'STUDENT' });
        addToast('Login successful', 'success');
        navigate('/dashboard');
        return;
      }

      // If no match found
      addToast('Invalid email or password', 'error');

    } catch (error: any) {
       console.error(error);
       addToast(error.response?.data?.message || 'Network error occurred.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: '100%', maxWidth: '400px' }} elevation={2}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Welcome Back
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Sign in to continue to NYT Project Flow
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <Input 
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            leftIcon={<Mail size={18} />}
          />
          
          <Input 
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            leftIcon={<Lock size={18} />}
          />
          
          <Button 
            type="submit" 
            fullWidth 
            size="lg" 
            isLoading={isLoading}
            style={{ marginTop: '16px' }}
          >
            Sign In
          </Button>
        </form>
      </Card>
      <ToastContainer />
    </div>
  );
};

export default Login;
