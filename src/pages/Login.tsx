import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Input, Button } from '../components';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';
import { ToastContainer } from '../components/Toast';
import { Lock, Mail } from 'lucide-react';
import dpgitmLogo from '../assets/images/dpgitm-logo.png';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyState, setVerifyState] = useState<'LOGIN' | 'SEND_OTP' | 'VERIFY_OTP' | 'SET_PASSWORD' | 'SUPERVISOR_SET_PASSWORD' | 'FORGOT_PASSWORD_SEND_OTP' | 'FORGOT_PASSWORD_VERIFY_OTP' | 'FORGOT_PASSWORD_SET_PASSWORD'>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [pendingSupervisorLogin, setPendingSupervisorLogin] = useState<{ id: string; name: string; email: string } | null>(null);

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
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // 1. Admin login (dedicated endpoint — avoids wrong student/supervisor error messages)
      try {
        const adminRes = await api.post('/admins/login', { email: normalizedEmail, password }, { validateStatus: () => true });
        if (adminRes.status >= 200 && adminRes.status < 300 && adminRes.data?.adminId) {
          const matchedAdmin = adminRes.data;
          login({ id: matchedAdmin.adminId, name: matchedAdmin.name || 'Admin', email: normalizedEmail, role: 'ADMIN' });
          addToast('Login successful', 'success');
          navigate('/admin/dashboard');
          return;
        }
        if (adminRes.status === 400 && adminRes.data?.message && adminRes.data.message !== 'ADMIN_NOT_FOUND') {
          addToast(adminRes.data.message, 'error');
          return;
        }
      } catch {
        // continue to other roles
      }

      // 2. Supervisor login with status + first-time validation
      try {
        const supervisorRes = await api.post('/supervisor/login', { email: normalizedEmail, password }, { validateStatus: () => true });
        if (supervisorRes.status >= 200 && supervisorRes.status < 300 && supervisorRes.data?.supervisorId) {
          const matchedSupervisor = supervisorRes.data;
          if (matchedSupervisor.requiresPasswordSetup) {
            setPendingSupervisorLogin({
              id: matchedSupervisor.supervisorId,
              name: matchedSupervisor.name,
              email: normalizedEmail,
            });
            setPassword('');
            setConfirmPassword('');
            setVerifyState('SUPERVISOR_SET_PASSWORD');
            addToast('First-time supervisor sign-in: please set a new password.', 'info');
            return;
          }
          login({ id: matchedSupervisor.supervisorId, name: matchedSupervisor.name, email: normalizedEmail, role: 'SUPERVISOR' });
          addToast('Login successful', 'success');
          navigate('/supervisor/dashboard');
          return;
        }
        if (supervisorRes.status === 400 && supervisorRes.data?.message && supervisorRes.data.message !== 'SUPERVISOR_NOT_FOUND') {
          addToast(supervisorRes.data.message, 'error');
          return;
        }
      } catch {
        // continue to student
      }

      // 3. Student login
      try {
        const studentRes = await api.post('/student/login', { email: normalizedEmail, password }, { validateStatus: () => true });
        if (studentRes.status >= 200 && studentRes.status < 300 && studentRes.data?.studentId) {
          const matchedStudent = studentRes.data;
          login({ id: matchedStudent.studentId, name: matchedStudent.name, email: normalizedEmail, role: 'STUDENT' });
          addToast('Login successful', 'success');
          navigate('/dashboard');
          return;
        }
        if (studentRes.status === 400 && studentRes.data?.message && studentRes.data.message !== 'STUDENT_NOT_FOUND') {
          addToast(studentRes.data.message === 'Invalid email or password' ? 'Invalid email or password' : studentRes.data.message, 'error');
          return;
        }
      } catch {
        // fall through
      }

      addToast('Invalid email or password', 'error');
    } catch (error: any) {
      console.error(error);
      addToast(error.response?.data?.message || 'Network error occurred.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupervisorSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return addToast('Password must be at least 6 characters', 'error');
    if (password !== confirmPassword) return addToast('Passwords do not match', 'error');
    setIsLoading(true);
    try {
      await api.post('/supervisor/set-password', {
        email: (pendingSupervisorLogin?.email || email).trim().toLowerCase(),
        password,
        confirmPassword,
      });
      const supervisorEmail = (pendingSupervisorLogin?.email || email).trim().toLowerCase();
      const supervisorName = pendingSupervisorLogin?.name || 'Supervisor';
      const supervisorId = pendingSupervisorLogin?.id;
      if (supervisorId) {
        login({ id: supervisorId, name: supervisorName, email: supervisorEmail, role: 'SUPERVISOR' });
        addToast('Password set successfully. Welcome!', 'success');
        navigate('/supervisor/dashboard');
      } else {
        addToast('Password set successfully. Please log in.', 'success');
        setVerifyState('LOGIN');
      }
      setPendingSupervisorLogin(null);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to set password', 'error');
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

  const handleForgotPasswordSendOtp = async (e?: React.FormEvent, isResend = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!email) return addToast('Please enter your email', 'error');
    setIsLoading(true);
    try {
        await api.post('/auth/forgot-password/send-otp', { email }, { timeout: 30000 });
        addToast(isResend ? 'OTP resent successfully' : 'OTP sent to your email', 'success');
        if (!isResend) {
            setVerifyState('FORGOT_PASSWORD_VERIFY_OTP');
        }
        setResendTimer(30);
    } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to send OTP. Ensure email is registered.', 'error');
    } finally { setIsLoading(false); }
  };

  const handleForgotPasswordVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return addToast('Please enter OTP', 'error');
    setIsLoading(true);
    try {
        await api.post('/auth/forgot-password/verify-otp', { email, otp });
        addToast('OTP Verified!', 'success');
        setVerifyState('FORGOT_PASSWORD_SET_PASSWORD');
    } catch (err: any) {
        addToast(err.response?.data?.message || 'Invalid OTP', 'error');
    } finally { setIsLoading(false); }
  };

  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return addToast('Password must be at least 6 characters', 'error');
    if (password !== confirmPassword) return addToast('Passwords do not match', 'error');
    setIsLoading(true);
    try {
        await api.post('/auth/forgot-password/reset', { email, password, confirmPassword, otp });
        addToast('Password reset successfully! Please log in.', 'success');
        setVerifyState('LOGIN');
        setPassword('');
        setConfirmPassword('');
        setOtp('');
    } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to reset password', 'error');
    } finally { setIsLoading(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '24px' }}>
      <Card style={{ width: '100%', maxWidth: '430px', borderTop: '4px solid var(--primary)' }} elevation={3}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src={dpgitmLogo} alt="DPGITM logo" style={{ width: '72px', height: '72px', objectFit: 'contain', marginBottom: '14px' }} />
          <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 800, marginBottom: '8px' }}>
            DPGITM Project Management System
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {verifyState === 'LOGIN' ? 'Welcome Back' : 'First Time Setup'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {verifyState === 'LOGIN' ? 'Sign in to continue to DPGITM Project Management System' : 
             verifyState.startsWith('FORGOT_PASSWORD') ? 'Reset your password securely' :
             'Verify your account and set up a secure password'}
          </p>
        </div>

        {verifyState === 'LOGIN' && (
            <form onSubmit={handleLogin}>
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" leftIcon={<Mail size={18} />} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" leftIcon={<Lock size={18} />} />
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setVerifyState('FORGOT_PASSWORD_SEND_OTP'); setEmail(''); setPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Forgot Password?</button>
              </div>
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

        {verifyState === 'SUPERVISOR_SET_PASSWORD' && (
            <form onSubmit={handleSupervisorSetPassword}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Welcome{pendingSupervisorLogin?.name ? `, ${pendingSupervisorLogin.name}` : ''}. Set a permanent password to finish first-time supervisor sign-in.
              </p>
              <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" leftIcon={<Lock size={18} />} />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Set Password & Continue</Button>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button type="button" onClick={() => { setVerifyState('LOGIN'); setPendingSupervisorLogin(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Back to Login</button>
              </div>
            </form>
        )}

        {verifyState === 'FORGOT_PASSWORD_SEND_OTP' && (
            <form onSubmit={handleForgotPasswordSendOtp}>
              <Input label="Registered Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your registered email" leftIcon={<Mail size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Send Reset OTP</Button>
              <div style={{ textAlign: 'center', marginTop: '16px' }}><button type="button" onClick={() => setVerifyState('LOGIN')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Back to Login</button></div>
            </form>
        )}

        {verifyState === 'FORGOT_PASSWORD_VERIFY_OTP' && (
            <form onSubmit={handleForgotPasswordVerifyOtp}>
              <Input label="Reset Verification Code" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Verify OTP</Button>
              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                     type="button" 
                     onClick={(e) => {
                         if (resendTimer === 0) handleForgotPasswordSendOtp(undefined, true);
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
                  <button type="button" onClick={() => setVerifyState('FORGOT_PASSWORD_SEND_OTP')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Change Email</button>
              </div>
            </form>
        )}

        {verifyState === 'FORGOT_PASSWORD_SET_PASSWORD' && (
            <form onSubmit={handleForgotPasswordReset}>
              <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" leftIcon={<Lock size={18} />} />
              <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" leftIcon={<Lock size={18} />} />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} style={{ marginTop: '16px' }}>Reset Password</Button>
            </form>
        )}
      </Card>
      <ToastContainer />
    </div>
  );
};

export default Login;
