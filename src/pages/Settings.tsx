import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Input } from '../components';
import { useToastStore } from '../utils/toastStore';
import { api } from '../services/api';
import { Mail, Info } from 'lucide-react';

export const Settings: React.FC = () => {
    const { user } = useAuthStore();
    const addToast = useToastStore(state => state.addToast);

    const [name, setName] = useState(user?.name || '');
    const [mail, setMail] = useState(user?.email || '');
    const [department, setDepartment] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);

    const [newPass, setNewPass] = useState('');
    const [confPass, setConfPass] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');

    const [emailAlerts, setEmailAlerts] = useState(true);
    const [savingNotifications, setSavingNotifications] = useState(false);

    useEffect(() => {
        if (!user?.id) {
            setLoadingProfile(false);
            return;
        }

        const fetchProfile = async () => {
            setLoadingProfile(true);
            try {
                if (user.role === 'ADMIN') {
                    const res = await api.get(`/admins/${user.id}`);
                    if (res.data) {
                        setName(res.data.name || '');
                        setMail(res.data.mail || '');
                        setDepartment(res.data.department || '');
                        setEmailAlerts(res.data.emailNotifications !== false);
                    }
                } else if (user.role === 'SUPERVISOR') {
                    const res = await api.get(`/supervisors/${user.id}`);
                    if (res.data) {
                        setName(res.data.name || '');
                        setMail(res.data.mail || '');
                        setDepartment(res.data.branch || '');
                        setEmailAlerts(res.data.emailNotifications !== false);
                    }
                } else if (user.role === 'STUDENT') {
                    const res = await api.get(`/students/${user.id}`);
                    if (res.data) {
                        setName(res.data.name || '');
                        setMail(res.data.mail || '');
                        setDepartment(res.data.branch || '');
                        setRollNo(res.data.rollNo || '');
                        setEmailAlerts(res.data.emailNotifications !== false);
                    }
                }
            } catch (err) {
                console.error(err);
                // Fallback to session values so the page is never blank
                setName(user.name || '');
                setMail(user.email || '');
                addToast('Could not load full profile from server', 'error');
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
    }, [user]);

    const persistEmailNotifications = async (enabled: boolean) => {
        if (!user?.id) return;
        setSavingNotifications(true);
        try {
            if (user.role === 'ADMIN') {
                await api.put(`/admins/${user.id}`, { emailNotifications: enabled });
            } else if (user.role === 'SUPERVISOR') {
                await api.put(`/supervisors/${user.id}`, { emailNotifications: enabled });
            } else if (user.role === 'STUDENT') {
                await api.put(`/students/${user.id}`, { emailNotifications: enabled });
            }
            setEmailAlerts(enabled);
            addToast(enabled ? 'Email notifications enabled' : 'Email notifications disabled', 'success');
        } catch (err) {
            addToast('Failed to update notification preference', 'error');
        } finally {
            setSavingNotifications(false);
        }
    };

    const handleSendOTP = async () => {
        if (!mail) {
            addToast('Email not configured', 'error');
            return;
        }
        try {
            await api.post('/auth/forgot-password/send-otp', { email: mail });
            setOtpSent(true);
            addToast('OTP sent to your registered email.', 'success');
        } catch (err) {
            addToast('Failed to send OTP. Server error.', 'error');
        }
    };

    const handleUpdatePassword = async () => {
        if (!otpSent) return;
        if (!otp || !newPass || !confPass) {
            addToast('Please fill all fields', 'error');
            return;
        }
        if (newPass !== confPass) {
            addToast('Passwords do not match', 'error');
            return;
        }
        try {
            await api.post('/auth/forgot-password/reset', {
                email: mail,
                password: newPass,
                confirmPassword: confPass,
                otp
            });
            addToast('Password updated successfully', 'success');
            setOtpSent(false);
            setOtp('');
            setNewPass('');
            setConfPass('');
        } catch (err) {
            addToast('Invalid OTP or update failed', 'error');
        }
    };

    const roleLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Student';

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Profile Settings</h1>
                <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '15px' }}>
                    View your account details, reset password, and manage email notifications.
                </p>
            </div>

            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Account details</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-disabled)', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    These fields are managed by admin and cannot be edited here.
                </p>

                {loadingProfile ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading profile…</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 240px' }}>
                                <Input label="Full Name" value={name} disabled style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }} />
                            </div>
                            <div style={{ flex: '1 1 240px' }}>
                                <Input label="Email" value={mail} disabled style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 240px' }}>
                                <Input
                                    label={user?.role === 'ADMIN' ? 'Department' : 'Branch'}
                                    value={department}
                                    disabled
                                    style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                                />
                            </div>
                            {user?.role === 'STUDENT' && (
                                <div style={{ flex: '1 1 240px' }}>
                                    <Input label="Roll Number" value={rollNo} disabled style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }} />
                                </div>
                            )}
                            <div style={{ flex: '1 1 240px' }}>
                                <Input label="Role" value={roleLabel} disabled style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Reset password</h3>
                        {!otpSent && (
                            <Button size="sm" onClick={handleSendOTP} disabled={!mail}>
                                Send OTP
                            </Button>
                        )}
                    </div>

                    {otpSent ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                <Input label="OTP from Email" value={otp} onChange={e => setOtp(e.target.value)} style={{ marginBottom: 0 }} />
                                <Input label="New Password" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={{ marginBottom: 0 }} />
                                <Input label="Confirm New Password" type="password" value={confPass} onChange={e => setConfPass(e.target.value)} style={{ marginBottom: 0 }} />
                            </div>
                            <Button variant="primary" onClick={handleUpdatePassword}>Verify & Update Password</Button>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            Click &quot;Send OTP&quot; to receive a verification code on <strong>{mail || 'your registered email'}</strong> and reset your password.
                        </div>
                    )}
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a', fontSize: '12px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>!</div>
                    Password must be at least 8 characters long with numbers and symbols.
                </div>
            </Card>

            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Notifications</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-disabled)', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    Control whether you receive notification emails from the system.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Mail size={20} color="var(--text-secondary)" />
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>Email notifications</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-disabled)' }}>
                                Meeting reminders, assignment updates, and other system emails.
                            </p>
                        </div>
                    </div>
                    <div
                        role="switch"
                        aria-checked={emailAlerts}
                        onClick={() => {
                            if (!savingNotifications) persistEmailNotifications(!emailAlerts);
                        }}
                        style={{
                            width: '44px',
                            height: '24px',
                            backgroundColor: emailAlerts ? 'var(--primary)' : 'var(--border-color)',
                            borderRadius: '12px',
                            padding: '2px',
                            cursor: savingNotifications ? 'wait' : 'pointer',
                            transition: '0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: emailAlerts ? 'flex-end' : 'flex-start',
                            opacity: savingNotifications ? 0.7 : 1
                        }}
                    >
                        <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                </div>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-disabled)', fontSize: '13px' }}>
                <Info size={16} /> Need a name or email change? Contact your admin.
            </div>
        </div>
    );
};

export default Settings;
