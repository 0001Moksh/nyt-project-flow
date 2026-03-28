import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { Button } from './Button';
import { LogOut, User, LayoutDashboard } from 'lucide-react';
import { ToastContainer } from './Toast';
import { GlobalChatbot } from './GlobalChatbot';

export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getAdminLinkStyle = (path: string) => {
    const isActive = location.pathname.includes(path);
    return {
      padding: '8px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      backgroundColor: isActive ? 'var(--primary)' : 'transparent',
      color: isActive ? 'white' : 'var(--text-secondary)',
      fontWeight: isActive ? 600 : 500,
      transition: 'var(--transition-fast)',
      border: 'none',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    };
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{
              width: '32px', height: '32px',
              backgroundColor: 'var(--primary)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 'bold'
            }}>
              N
            </div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              NYT Flow
            </h1>
          </div>

          {/* Navigation Links based on Role */}
          {user && user.role === 'ADMIN' && (
            <nav style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
              <button style={getAdminLinkStyle('/admin/dashboard')} onClick={() => navigate('/admin/dashboard')}>
                <LayoutDashboard size={18} /> Admin Panel
              </button>
            </nav>
          )}
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <User size={18} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{user.name}</span>
              <span style={{ 
                fontSize: '10px', 
                backgroundColor: 'var(--primary)', color: 'white',
                padding: '2px 6px', borderRadius: '12px',
                marginLeft: '8px'
              }}>
                {user.role}
              </span>
            </div>
            
            <Button variant="outline" size="sm" onClick={handleLogout} leftIcon={<LogOut size={16} />}>
              Logout
            </Button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      {/* Global AI Assistant */}
      <GlobalChatbot />

      <ToastContainer />
    </div>
  );
};
