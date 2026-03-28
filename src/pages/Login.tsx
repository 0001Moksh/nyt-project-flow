import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Input, Button } from '../components';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';
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
      if (email.includes('admin')) {
        // Fetch real admin from DB to satisfy PostgreSQL foreign keys
        const { data: admins } = await api.get('/admins');
        let realAdminId = 'admin_123';
        
        if (admins && admins.length > 0) {
          realAdminId = admins[0].adminId;
        } else {
          const { data: newAdmin } = await api.post('/admins', { 
            name: "System Admin", 
            mail: email, 
            password: password, 
            department: "Computer Science" 
          });
          realAdminId = newAdmin.adminId;
        }
        login({ id: realAdminId, name: 'Admin User', email, role: 'ADMIN' });
      } else if (email.includes('super')) {
        login({ id: 'sup_123', name: 'Supervisor User', email, role: 'SUPERVISOR' });
      } else {
        // Fetch or create real student from DB
        const { data: students } = await api.get('/students');
        const existingStudent = students?.find((s: any) => s.mail === email);
        
        let realStudentId = 'stu_123';
        let realStudentName = 'Student User';
        
        if (existingStudent) {
          realStudentId = existingStudent.studentId;
          realStudentName = existingStudent.name;
        } else {
          const { data: newStudent } = await api.post('/students', { 
            name: email.split('@')[0].toUpperCase(), 
            mail: email, 
            password: password,
            rollNo: Math.random().toString(36).substr(2, 8).toUpperCase(),
            branch: "Computer Science",
            batch: "2026",
            enrollStatus: "PENDING"
          });
          realStudentId = newStudent.studentId;
          realStudentName = newStudent.name;
        }
        
        login({ id: realStudentId, name: realStudentName, email, role: 'STUDENT' });
      }
      
      addToast('Login successful', 'success');
      if (email.includes('admin')) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
       console.error(error);
       addToast('Failed to sync authentication with backend.', 'error');
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
    </div>
  );
};

export default Login;
