import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Settings,
  Users,
  FileText,
  LogOut
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getLinks = () => {
    switch (user.role) {
      case 'ADMIN':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { path: '/admin/projects', label: 'Projects', icon: <FolderKanban size={20} /> },
          { path: '/admin/students', label: 'Students', icon: <Users size={20} /> },
          { path: '/admin/supervisors', label: 'Supervisors', icon: <Users size={20} /> },
          { path: '/admin/requests', label: 'Request', icon: <FileText size={20} /> },
          { path: '/admin/create-form', label: 'Forms', icon: <FileText size={20} /> },
          { path: '/admin/settings', label: 'Settings', icon: <Settings size={20} /> }
        ];
      case 'SUPERVISOR':
        return [
          { path: '/supervisor/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { path: '/supervisor/projects', label: 'Projects', icon: <FolderKanban size={20} /> },
          { path: '/supervisor/settings', label: 'Settings', icon: <Settings size={20} /> }
        ];
      default: // STUDENT
        return [
          { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { path: '/projects', label: 'My Projects', icon: <FolderKanban size={20} /> },
          { path: '/chat', label: 'Chat', icon: <MessageSquare size={20} /> },
          { path: '/settings', label: 'Settings', icon: <Settings size={20} /> }
        ];
    }
  };

  const links = getLinks();

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100
    }}>
      {/* BRANDING HEADER */}
      <div
        style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
        onClick={() => navigate('/')}
      >
        <div style={{
          width: '36px', height: '36px',
          backgroundColor: 'var(--primary)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '18px'
        }}>
          N
        </div>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          NYT Project Flow
        </h1>
      </div>

      {/* NAVIGATION LINKS */}
      <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map((link) => {
          const isActive = location.pathname.includes(link.path);
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px',
                width: '100%',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary-glow)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
            >
              <div style={{ color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {link.icon}
              </div>
              <span style={{ fontSize: '14px' }}>{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* USER PROFILE & LOGOUT */}
      <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--primary)' }}>
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user.name || 'User'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {user.role}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            width: '100%', padding: '10px',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>

    </aside>
  );
};
