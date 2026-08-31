import React, { useEffect, useState } from 'react';
import { Card, Loader } from '../../components';
import { useAuthStore } from '../../utils/authStore';
import { Users, FolderKanban, GraduationCap, ShieldAlert, RotateCw } from 'lucide-react';
import { api } from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ students: 0, projects: 0, supervisors: 0, pendingRequests: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stuRes, projRes, supRes, reqRes] = await Promise.all([
        api.get('/students').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/supervisors').catch(() => ({ data: [] })),
        api.get('/requests').catch(() => ({ data: [] }))
      ]);
      setStats({
        students: (stuRes.data || []).length,
        projects: (projRes.data || []).length,
        supervisors: (supRes.data || []).length,
        pendingRequests: (reqRes.data || []).filter((r: any) => r.status === 'PENDING').length
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshKpi = async (key: 'students' | 'projects' | 'supervisors' | 'pendingRequests') => {
    setRefreshing(prev => ({ ...prev, [key]: true }));
    try {
      if (key === 'students') {
        const res = await api.get('/students');
        setStats(prev => ({ ...prev, students: (res.data || []).length }));
      } else if (key === 'projects') {
        const res = await api.get('/projects');
        setStats(prev => ({ ...prev, projects: (res.data || []).length }));
      } else if (key === 'supervisors') {
        const res = await api.get('/supervisors');
        setStats(prev => ({ ...prev, supervisors: (res.data || []).length }));
      } else if (key === 'pendingRequests') {
        const res = await api.get('/requests');
        setStats(prev => ({ ...prev, pendingRequests: (res.data || []).filter((r: any) => r.status === 'PENDING').length }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(prev => ({ ...prev, [key]: false }));
    }
  };

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader size="lg" /></div>;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>
          Welcome back, {user?.name || 'Administrator'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Here is your institution's overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <Card elevation={1}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={24} /></div>
                 <div><p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Total Students</p><h3 style={{ margin: 0, fontSize: '24px' }}>{stats.students}</h3></div>
              </div>
              <button
                type="button"
                onClick={() => refreshKpi('students')}
                disabled={refreshing.students}
                title="Refresh Total Students metric"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <RotateCw size={14} style={{ transform: refreshing.students ? 'rotate(360deg)' : 'none', transition: refreshing.students ? 'transform 0.8s linear' : 'none' }} />
              </button>
           </div>
        </Card>
        <Card elevation={1}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FolderKanban size={24} /></div>
                 <div><p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Active Projects</p><h3 style={{ margin: 0, fontSize: '24px' }}>{stats.projects}</h3></div>
              </div>
              <button
                type="button"
                onClick={() => refreshKpi('projects')}
                disabled={refreshing.projects}
                title="Refresh Active Projects metric"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <RotateCw size={14} style={{ transform: refreshing.projects ? 'rotate(360deg)' : 'none', transition: refreshing.projects ? 'transform 0.8s linear' : 'none' }} />
              </button>
           </div>
        </Card>
        <Card elevation={1}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fdf4ff', color: '#d946ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={24} /></div>
                 <div><p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Supervisors</p><h3 style={{ margin: 0, fontSize: '24px' }}>{stats.supervisors}</h3></div>
              </div>
              <button
                type="button"
                onClick={() => refreshKpi('supervisors')}
                disabled={refreshing.supervisors}
                title="Refresh Supervisors metric"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <RotateCw size={14} style={{ transform: refreshing.supervisors ? 'rotate(360deg)' : 'none', transition: refreshing.supervisors ? 'transform 0.8s linear' : 'none' }} />
              </button>
           </div>
        </Card>
        <Card elevation={1}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldAlert size={24} /></div>
                 <div><p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Pending Requests</p><h3 style={{ margin: 0, fontSize: '24px' }}>{stats.pendingRequests}</h3></div>
              </div>
              <button
                type="button"
                onClick={() => refreshKpi('pendingRequests')}
                disabled={refreshing.pendingRequests}
                title="Refresh Pending Requests metric"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-secondary)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <RotateCw size={14} style={{ transform: refreshing.pendingRequests ? 'rotate(360deg)' : 'none', transition: refreshing.pendingRequests ? 'transform 0.8s linear' : 'none' }} />
              </button>
           </div>
        </Card>
      </div>
      
      <Card elevation={2} style={{ padding: '32px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '16px' }}>System Operational</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Dashboard charts and live analytic features are currently in development.</p>
      </Card>
    </div>
  );
};

export default AdminDashboard;
