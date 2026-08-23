import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Input } from '../components';
import { useToastStore } from '../utils/toastStore';
import { api } from '../services/api';
import { Mail, Info } from 'lucide-react';

export const Settings: React.FC = () => {
    const { user } = useAuthStore();
    const addToast = useToastStore((state) => state.addToast);

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
    const [maxSupervisorWorkload, setMaxSupervisorWorkload] = useState(() =>
        Number(localStorage.getItem('maxSupervisorWorkload') || '4')
    );

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

    const saveSupervisorWorkloadCapacity = () => {
        const capacity = Number(maxSupervisorWorkload);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) {
            addToast('Please choose a valid workload capacity between 1 and 99', 'error');
            return;
        }
        localStorage.setItem('maxSupervisorWorkload', String(capacity));
        window.dispatchEvent(
            new CustomEvent('admin-settings-updated', { detail: { maxSupervisorWorkload: capacity } })
        );
        addToast('Supervisor workload capacity updated', 'success');
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
                otp,
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

    const roleLabel =
        user?.role === 'ADMIN' ? 'Admin' : user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Student';

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                minHeight: 0,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingBottom: 8,
            }}
        >
            {/* Page title */}
            <div style={{ flexShrink: 0 }}>
                <h1
                    style={{
                        fontSize: '24px',
                        color: 'var(--text-primary)',
                        margin: 0,
                        fontWeight: 700,
                    }}
                >
                    Profile Settings
                </h1>
                <p
                    style={{
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0',
                        fontSize: '14px',
                    }}
                >
                    View your account details, reset password, and manage email notifications.
                </p>
            </div>

            {/* Main 2-column layout matching the diagram */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    alignItems: 'start',
                }}
            >
                {/* LEFT: Account details (tall card) */}
                <Card
                    elevation={1}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >

                    {loadingProfile ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            Loading profile…
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Input
                                label="Full Name"
                                value={name}
                                disabled
                                style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                            />
                            <Input
                                label="Email"
                                value={mail}
                                disabled
                                style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                            />
                            <Input
                                label={user?.role === 'ADMIN' ? 'Department' : 'Branch'}
                                value={department}
                                disabled
                                style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                            />
                            {user?.role === 'STUDENT' && (
                                <Input
                                    label="Roll Number"
                                    value={rollNo}
                                    disabled
                                    style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                                />
                            )}
                            <Input
                                label="Role"
                                value={roleLabel}
                                disabled
                                style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }}
                            />
                        </div>
                    )}
                </Card>

                {/* RIGHT column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Admin Settings (top right) – ADMIN only */}
                    {user?.role === 'ADMIN' && (
                        <Card
                            elevation={1}
                            style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600 }}>
                                Admin Settings
                            </h3>
                            <p
                                style={{
                                    margin: '0 0 16px',
                                    fontSize: '12px',
                                    color: 'var(--text-disabled)',
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '12px',
                                }}
                            >
                                Controls the denominator used in supervisor workload displays.
                            </p>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            marginBottom: '8px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                        }}
                                    >
                                        Max Supervisor Workload Capacity
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={99}
                                        value={maxSupervisorWorkload}
                                        onChange={(e) =>
                                            setMaxSupervisorWorkload(Number(e.target.value))
                                        }
                                        style={{ marginBottom: 0 }}
                                    />
                                </div>
                                <Button variant="primary" onClick={saveSupervisorWorkloadCapacity}>
                                    Save Capacity
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* Bottom row: Notifications + Reset password */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                        }}
                    >
                        {/* Notifications */}
                        <Card
                            elevation={1}
                            style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600 }}>
                                Notifications
                            </h3>
                            <p
                                style={{
                                    margin: '0 0 16px',
                                    fontSize: '12px',
                                    color: 'var(--text-disabled)',
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '12px',
                                }}
                            >
                                Control whether you receive notification emails from the system.
                            </p>

                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px',
                                }}
                            >
                                <div style={{ display: 'flex', gap: '12px', minWidth: 0 }}>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            backgroundColor: 'var(--surface-hover)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Mail size={20} color="var(--text-secondary)" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>
                                            Email notifications
                                        </h4>
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: '12px',
                                                color: 'var(--text-disabled)',
                                            }}
                                        >
                                            System emails
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
                                        backgroundColor: emailAlerts
                                            ? 'var(--primary)'
                                            : 'var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '2px',
                                        cursor: savingNotifications ? 'wait' : 'pointer',
                                        transition: '0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: emailAlerts ? 'flex-end' : 'flex-start',
                                        opacity: savingNotifications ? 0.7 : 1,
                                        flexShrink: 0,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        }}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Reset password */}
                        <Card
                            elevation={1}
                            style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                padding: 0,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <div style={{ padding: '20px', flex: 1 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        borderBottom: '1px solid var(--border-color)',
                                        paddingBottom: '12px',
                                        marginBottom: '16px',
                                    }}
                                >
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                        Reset password
                                    </h3>
                                    {!otpSent && (
                                        <Button size="sm" onClick={handleSendOTP} disabled={!mail}>
                                            Send OTP
                                        </Button>
                                    )}
                                </div>

                                {otpSent ? (
                                    <div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px',
                                                marginBottom: '14px',
                                            }}
                                        >
                                            <Input
                                                label="OTP from Email"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                style={{ marginBottom: 0 }}
                                            />
                                            <Input
                                                label="New Password"
                                                type="password"
                                                value={newPass}
                                                onChange={(e) => setNewPass(e.target.value)}
                                                style={{ marginBottom: 0 }}
                                            />
                                            <Input
                                                label="Confirm New Password"
                                                type="password"
                                                value={confPass}
                                                onChange={(e) => setConfPass(e.target.value)}
                                                style={{ marginBottom: 0 }}
                                            />
                                        </div>
                                        <Button variant="primary" onClick={handleUpdatePassword}>
                                            Verify & Update Password
                                        </Button>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                       Click “Send OTP” to reset.

                                    </div>
                                )}
                            </div>
                            <div
                                style={{
                                    backgroundColor: '#eff6ff',
                                    padding: '12px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#1e3a8a',
                                    fontSize: '12px',
                                }}
                            >
                                <div
                                    style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        backgroundColor: '#2563eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        flexShrink: 0,
                                    }}
                                >
                                    !
                                </div>
                                Password must be at least 8 characters long with numbers and symbols.
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--text-disabled)',
                    fontSize: '13px',
                    flexShrink: 0,
                }}
            >
                <Info size={16} /> Need a name or email change? Contact your admin.
            </div>
        </div>
    );
};

export default Settings;