import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { Button, Sidebar, NotificationBell } from './index';
import { ToastContainer } from './Toast';
import { GlobalChatbot } from './GlobalChatbot';

export const Layout: React.FC = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);

    // 🔥 Keyboard Shortcut (Ctrl + K)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setCommandOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const pathSegments = location.pathname.split('/').filter(Boolean);

    const breadcrumbs = pathSegments.map((seg, i) => (
        <span key={i} style={{ color: 'var(--text-secondary)' }}>
            {seg} {i < pathSegments.length - 1 && ' / '}
        </span>
    ));

    // 🌐 PUBLIC LAYOUT
    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <header style={{
                    backgroundColor: 'var(--surface)',
                    boxShadow: 'var(--shadow-1)',
                    padding: '16px 32px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div
                        onClick={() => navigate('/')}
                        style={{ cursor: 'pointer', fontWeight: 700 }}
                    >
                        NYT Project Flow
                    </div>

                    <Button onClick={() => navigate('/login')}>
                        Login
                    </Button>
                </header>

                <main style={{ flex: 1, padding: '32px' }}>
                    <Outlet />
                </main>

                <ToastContainer />
            </div>
        );
    }

    // 🔐 AUTHENTICATED LAYOUT
    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            backgroundColor: darkMode ? '#0f172a' : 'var(--background)',
            color: darkMode ? '#fff' : 'inherit',
            transition: 'all 0.2s ease'
        }}>

            {/* SIDEBAR */}
            {sidebarOpen && <Sidebar />}

            {/* MAIN CONTENT */}
            <div style={{
                flex: 1,
                marginLeft: sidebarOpen ? '260px' : '0px',
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column'
            }}>

                {/* HEADER */}
                <header style={{
                    height: '64px',
                    backgroundColor: 'var(--surface)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 40
                }}>

                    {/* LEFT SIDE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '18px',
                                cursor: 'pointer'
                            }}
                        >
                            ☰
                        </button>

                        <div style={{ fontWeight: 600 }}>
                            {breadcrumbs.length ? breadcrumbs : 'Dashboard'}
                        </div>
                    </div>

                    {/* RIGHT SIDE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

                        {/* 🔔 Notification Bell */}
                        <NotificationBell
                            userId={user?.id}
                            onNotificationClick={(notif) => {
                                if (notif.link) navigate(notif.link);
                            }}
                        />
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <main style={{
                    flex: 1,
                    padding: '32px',
                    overflowY: 'auto'
                }}>
                    <Outlet />
                </main>
            </div>

            {/* COMMAND PALETTE */}
            {commandOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 100
                }}
                    onClick={() => setCommandOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '500px',
                            background: 'white',
                            borderRadius: '10px',
                            padding: '20px'
                        }}
                    >
                        <input
                            placeholder="Search anything..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #ddd'
                            }}
                        />

                        <div style={{ marginTop: '10px', fontSize: '14px' }}>
                            Quick Actions coming soon...
                        </div>
                    </div>
                </div>
            )}

            <GlobalChatbot />
            <ToastContainer />
        </div>
    );
};