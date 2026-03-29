import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { Button, Sidebar } from './index';
import { Bell } from 'lucide-react';
import { ToastContainer } from './Toast';
import { GlobalChatbot } from './GlobalChatbot';

export const Layout: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // The new layout uses a Sidebar when authenticated.
  // When unauthenticated (Landing Page), it will render a simple top bar or nothing.
  
  if (!user) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{
                backgroundColor: 'var(--surface)',
                boxShadow: 'var(--shadow-1)',
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <div style={{
                        width: '32px', height: '32px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold'
                    }}>N</div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>NYT Flow</h1>
                </div>
                <Button onClick={() => navigate('/login')}>Login</Button>
            </header>
            <main style={{ flex: 1, padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <Outlet />
            </main>
            <ToastContainer />
        </div>
      );
  }

  // AUTHENTICATED LAYOUT WITH SIDEBAR (MATCHING FLOWCHART)
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* 1. LEFT SIDEBAR */}
      <Sidebar />

      {/* 2. RIGHT CONTENT AREA */}
      <div style={{ 
          flex: 1, 
          marginLeft: '260px', // Leaves room for the fixed 260px sidebar
          display: 'flex', 
          flexDirection: 'column',
          width: 'calc(100% - 260px)'
      }}>
          {/* Top Navbar / Header for contextual info */}
          <header style={{
             height: '64px',
             backgroundColor: 'var(--surface)',
             borderBottom: '1px solid var(--border-color)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'space-between',
             padding: '0 32px',
             position: 'sticky',
             top: 0,
             zIndex: 40
          }}>
              {/* Contextual Title based on route can go here, leaving blank for clean look like wireframe */}
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {location.pathname.split('/').filter(Boolean).pop() || 'Dashboard'}
              </div>

              {/* Header Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={20} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                         <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.name || 'User'}</span>
                         <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Session Active</span>
                     </div>
                     <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--primary)'}}>
                         {(user.name || 'U').charAt(0).toUpperCase()}
                     </div>
                  </div>
              </div>
          </header>

          {/* Dynamic Page Content */}
          <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
            <Outlet />
          </main>
      </div>

      <GlobalChatbot />
      <ToastContainer />
    </div>
  );
};
