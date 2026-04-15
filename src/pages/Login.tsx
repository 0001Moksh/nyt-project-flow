import React, { useState, useEffect } from 'react';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyState, setVerifyState] = useState<'LOGIN' | 'SEND_OTP' | 'VERIFY_OTP' | 'SET_PASSWORD'>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

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

      // 3. Check Student (Using secure backend `/api/student/login` endpoint)
      try {
        const studentRes = await api.post('/student/login', { email, password });
        if (studentRes.data) {
          const matchedStudent = studentRes.data;
          login({ id: matchedStudent.studentId, name: matchedStudent.name, email, role: 'STUDENT' });
          addToast('Login successful', 'success');
          navigate('/dashboard');
          return;
        }
      } catch (err: any) {
         // Silently catch to allow fallback to invalid credentials message below if it's purely an auth error
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

  const handleSendOtp = async (e?: React.FormEvent, isResend = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!email) return addToast('Please enter your email', 'error');
    setIsLoading(true);
    try {
        await api.post('/student/send-otp', { email }, { timeout: 30000 });
        addToast(isResend ? 'OTP resent successfully' : 'OTP sent to your email', 'success');
        if (!isResend) {
            setVerifyState('VERIFY_OTP');
        }
        setResendTimer(30);
    } catch (err) {} finally { setIsLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return addToast('Please enter OTP', 'error');
    setIsLoading(true);
    try {
        await api.post('/student/verify-otp', { email, otp });
        addToast('OTP Verified!', 'success');
        setVerifyState('SET_PASSWORD');
    } catch (err) {} finally { setIsLoading(false); }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return addToast('Password must be at least 6 characters', 'error');
    if (password !== confirmPassword) return addToast('Passwords do not match', 'error');
    setIsLoading(true);
    try {
        await api.post('/student/set-password', { email, password, confirmPassword });
        addToast('Account setup complete! Please log in.', 'success');
        setVerifyState('LOGIN');
        setPassword('');
        setConfirmPassword('');
    } catch (err) {} finally { setIsLoading(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: '100%', maxWidth: '400px' }} elevation={2}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {verifyState === 'LOGIN' ? 'Welcome Back' : 'First Time Setup'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {verifyState === 'LOGIN' ? 'Sign in to continue to NYT Project Flow' : 'Verify your account and set up a secure password'}
          </p>
        </div>

        {verifyState === 'LOGIN' && (
            <form onSubmit={handleLogin}>
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" leftIcon={<Mail size={18} />} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Sign In</Button>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button type="button" onClick={() => { setVerifyState('SEND_OTP'); setEmail(''); setPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>First Time Student? Verify Account</button>
              </div>
            </form>
        )}

        {verifyState === 'SEND_OTP' && (
            <form onSubmit={handleSendOtp}>
              <Input label="Student Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your registered email" leftIcon={<Mail size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Send Verification OTP</Button>
              <div style={{ textAlign: 'center', marginTop: '16px' }}><button type="button" onClick={() => setVerifyState('LOGIN')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Back to Login</button></div>
            </form>
        )}

        {verifyState === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOtp}>
              <Input label="Verification Code" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Verify OTP</Button>
              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                     type="button" 
                     onClick={(e) => {
                         if (resendTimer === 0) handleSendOtp(undefined, true);
                     }} 
                     disabled={resendTimer > 0}
                     style={{ 
                         background: 'none', 
                         border: 'none', 
                         color: resendTimer > 0 ? 'var(--text-disabled)' : 'var(--primary)', 
                         cursor: resendTimer > 0 ? 'default' : 'pointer', 
                         fontSize: '14px',
                         fontWeight: resendTimer > 0 ? 400 : 600
                     }}
                  >
                     {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                  <button type="button" onClick={() => setVerifyState('SEND_OTP')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Change Email</button>
              </div>
            </form>
        )}

        {verifyState === 'SET_PASSWORD' && (
            <form onSubmit={handleSetPassword}>
              <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" leftIcon={<Lock size={18} />} />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Complete Setup</Button>
            </form>
        )}
      </Card>
      <ToastContainer />
    </div>
  );
};

export default Login;
