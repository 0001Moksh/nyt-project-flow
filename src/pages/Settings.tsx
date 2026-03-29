import React, { useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Input } from '../components';
import { useToastStore } from '../utils/toastStore';
import { Mail, Bell, Clock, Info } from 'lucide-react';

export const Settings: React.FC = () => {
    const { user } = useAuthStore();
    const addToast = useToastStore(state => state.addToast);

    // Mock form
    const [name, setName] = useState(user?.name || 'Alex Johnson');
    const [branch, setBranch] = useState('Computer Science & Engineering');
    
    // Passwords
    const [curPass, setCurPass] = useState('********');
    const [newPass, setNewPass] = useState('********');
    const [confPass, setConfPass] = useState('********');

    // Notifications
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [pushAlerts, setPushAlerts] = useState(false);
    const [deadlineAlerts, setDeadlineAlerts] = useState(true);

    const handleSave = () => {
        addToast('Profile updated successfully!', 'success');
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Profile Settings</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                    Manage your academic identity and notification preferences.
                </p>
            </div>

            {/* Personal Information */}
            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>Personal Information</h3>
                
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                    {/* Avatar Upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#fed7aa', border: '4px solid #fff', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {/* Mock avatar silhouette mimicking image */}
                                <div style={{ width: '40px', height: '40px', backgroundColor: '#f97316', borderRadius: '50%', marginBottom: '20px' }}></div>
                                <div style={{ position: 'absolute', bottom: '-10px', width: '80px', height: '50px', backgroundColor: '#f97316', borderRadius: '40px 40px 0 0' }}></div>
                            </div>
                            <div style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--primary)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: '2px solid white', cursor: 'pointer' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-disabled)', textAlign: 'center', lineHeight: 1.4 }}>JPG, GIF or PNG. <br/>Max size of 2MB</span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <Input label="Full Name" value={name} onChange={(e: any) => setName(e.target.value)} style={{ marginBottom: 0 }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <Input label="Roll Number (Read-only)" value="CS2024-042" disabled style={{ marginBottom: 0, backgroundColor: 'var(--surface-hover)' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Branch / Department</label>
                            <select 
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff', fontSize: '15px' }}
                            >
                                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                                <option value="Information Technology">Information Technology</option>
                                <option value="Electronics & Communication">Electronics & Communication</option>
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Security */}
            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>Security</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <Input label="Current Password" type="password" value={curPass} onChange={e=>setCurPass(e.target.value)} style={{ marginBottom: 0 }} />
                        <Input label="New Password" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={{ marginBottom: 0 }} />
                        <Input label="Confirm Password" type="password" value={confPass} onChange={e=>setConfPass(e.target.value)} style={{ marginBottom: 0 }} />
                    </div>
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a', fontSize: '12px' }}>
                   <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>!</div>
                   Password must be at least 8 characters long with numbers and symbols.
                </div>
            </Card>

            {/* Notifications */}
            <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Notifications</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-disabled)', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>Choose how you stay updated on project status and deadlines.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Mail size={20} color="var(--text-secondary)" />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>Email Notifications</h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-disabled)' }}>Daily project summaries and team updates.</p>
                            </div>
                        </div>
                        <div 
                            onClick={() => setEmailAlerts(!emailAlerts)}
                            style={{ width: '44px', height: '24px', backgroundColor: emailAlerts ? 'var(--primary)' : 'var(--border-color)', borderRadius: '12px', padding: '2px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: emailAlerts ? 'flex-end' : 'flex-start' }}
                        >
                            <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Bell size={20} color="var(--text-secondary)" />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>App Push Notifications</h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-disabled)' }}>Real-time alerts for direct mentions and feedback.</p>
                            </div>
                        </div>
                        <div 
                            onClick={() => setPushAlerts(!pushAlerts)}
                            style={{ width: '44px', height: '24px', backgroundColor: pushAlerts ? 'var(--primary)' : 'var(--border-color)', borderRadius: '12px', padding: '2px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: pushAlerts ? 'flex-end' : 'flex-start' }}
                        >
                            <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Clock size={20} color="var(--text-secondary)" />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>Deadline Alerts</h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-disabled)' }}>Priority reminders 24h/48h before project submission.</p>
                            </div>
                        </div>
                        <div 
                            onClick={() => setDeadlineAlerts(!deadlineAlerts)}
                            style={{ width: '44px', height: '24px', backgroundColor: deadlineAlerts ? 'var(--primary)' : 'var(--border-color)', borderRadius: '12px', padding: '2px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: deadlineAlerts ? 'flex-end' : 'flex-start' }}
                        >
                            <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
                        </div>
                    </div>

                </div>
            </Card>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-disabled)', fontSize: '13px', cursor: 'pointer' }}>
                    <Info size={16} /> Incorrect Academic Info? <strong style={{color: 'var(--primary)', textDecoration: 'underline'}}>Contact Registrar</strong>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <Button variant="outline" style={{ border: 'none', backgroundColor: 'transparent' }}>Discard Changes</Button>
                    <Button variant="primary" onClick={handleSave}>Save Profile</Button>
                </div>
            </div>

        </div>
    );
};

export default Settings;
