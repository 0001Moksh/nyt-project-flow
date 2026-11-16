import React, { useMemo, useRef } from 'react';
import { Card, Loader } from '../../components';
import { useAuthStore } from '../../utils/authStore';
import { Users, FolderKanban, GraduationCap, ShieldAlert, RotateCw, Activity, Clock3 } from 'lucide-react';
import { api } from '../../services/api';
import { useQuery } from '@tanstack/react-query';

const useKpiQuery = (key: string) => {
  const forceRefresh = useRef(false);
  const query = useQuery({
  queryKey: ['dashboard-kpi', key],
  queryFn: async () => {
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    const response = await api.get(`/dashboard/metrics/${key}`, { params: { refresh } });
    return response.data.count as number;
  },
  });
  return { ...query, refresh: () => {
    if (query.isFetching) return;
    forceRefresh.current = true;
    return query.refetch();
  } };
};

const STAGE_META: Record<string, { label: string; color: string }> = {
  SYNOPSIS: { label: 'Synopsis', color: '#2563eb' },
  PROGRESS1: { label: 'Progress 1', color: '#22c55e' },
  PROGRESS2: { label: 'Progress 2', color: '#8b5cf6' },
  FINAL: { label: 'Final', color: '#f59e0b' },
};

const AnalyticsHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div style={{ marginBottom: 20 }}>
    <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</p>
  </div>
);

const DonutChart = ({ data, total }: { data: Array<{ label: string; value: number; color: string }>; total: number }) => {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <div style={{ width: 170, height: 170, position: 'relative', flex: '0 0 auto' }}>
        <svg viewBox="0 0 160 160" width="170" height="170" role="img" aria-label="Project stage distribution">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="17" />
          {data.map((item) => {
            const length = total ? (item.value / total) * circumference : 0;
            const segment = (
              <circle key={item.label} cx="80" cy="80" r={radius} fill="none" stroke={item.color} strokeWidth="17"
                strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset}
                strokeLinecap="butt" transform="rotate(-90 80 80)" />
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
          <strong style={{ fontSize: 28 }}>{total}</strong>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>projects</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 150, display: 'grid', gap: 10 }}>
        {data.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <i style={{ width: 9, height: 9, borderRadius: 999, background: item.color }} />{item.label}
            </span>
            <strong style={{ fontSize: 13 }}>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const HorizontalBars = ({ data, color = '#2563eb', suffix = '' }: { data: Array<{ label: string; value: number }>; color?: string; suffix?: string }) => {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {data.length === 0 ? <div style={{ color: 'var(--text-disabled)', fontSize: 13 }}>No data available yet.</div> : data.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            <strong>{item.value}{suffix}</strong>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(item.value / max) * 100}%`, minWidth: item.value ? 5 : 0, borderRadius: 999, background: color, transition: 'width .4s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const studentsQuery = useKpiQuery('students');
  const projectsQuery = useKpiQuery('projects');
  const supervisorsQuery = useKpiQuery('supervisors');
  const requestsQuery = useKpiQuery('pending-requests');
  const analyticsQuery = useQuery({
    queryKey: ['dashboard-live-analytics'],
    queryFn: async () => {
      const [projects, students, supervisors] = await Promise.all([
        api.get('/projects'),
        api.get('/students'),
        api.get('/supervisors'),
      ]);
      return {
        projects: projects.data || [],
        students: students.data || [],
        supervisors: supervisors.data || [],
        receivedAt: Date.now(),
      };
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const stats = {
    students: studentsQuery.data ?? 0,
    projects: projectsQuery.data ?? 0,
    supervisors: supervisorsQuery.data ?? 0,
    pendingRequests: requestsQuery.data ?? 0,
  };
  const isLoading = [studentsQuery, projectsQuery, supervisorsQuery, requestsQuery].some((query) => query.isLoading);
  const refreshing: Record<string, boolean> = {
    students: studentsQuery.isFetching,
    projects: projectsQuery.isFetching,
    supervisors: supervisorsQuery.isFetching,
    pendingRequests: requestsQuery.isFetching,
  };
  const refreshKpi = (key: 'students' | 'projects' | 'supervisors' | 'pendingRequests') => ({
    students: studentsQuery,
    projects: projectsQuery,
    supervisors: supervisorsQuery,
    pendingRequests: requestsQuery,
  })[key].refresh();

  const analytics = useMemo(() => {
    const projects: any[] = analyticsQuery.data?.projects || [];
    const students: any[] = analyticsQuery.data?.students || [];
    const supervisors: any[] = analyticsQuery.data?.supervisors || [];
    const stageCounts = Object.keys(STAGE_META).map((key) => ({
      ...STAGE_META[key],
      value: projects.filter((project) => String(project.stageStatus || 'SYNOPSIS').toUpperCase() === key).length,
    }));
    const branches = new Map<string, number>();
    students.forEach((student) => {
      const branch = String(student.branch || 'Unspecified').trim() || 'Unspecified';
      branches.set(branch, (branches.get(branch) || 0) + 1);
    });
    const assignments = new Map<string, number>();
    projects.forEach((project) => {
      const ids = Array.isArray(project.supervisorIds) && project.supervisorIds.length
        ? project.supervisorIds
        : project.supervisorId ? [project.supervisorId] : [];
      ids.forEach((id: string) => assignments.set(id, (assignments.get(id) || 0) + 1));
    });
    const workloads = supervisors.map((supervisor) => ({
      label: supervisor.name || supervisor.supervisorId || 'Unknown',
      value: assignments.get(supervisor.supervisorId) || 0,
    })).sort((a, b) => b.value - a.value).slice(0, 7);
    const active = projects.filter((project) => !['COMPLETED', 'ARCHIVED', 'INACTIVE'].includes(String(project.status || '').toUpperCase())).length;
    const assigned = projects.filter((project) => project.supervisorId || project.supervisorIds?.length).length;
    const finalStage = stageCounts.find((stage) => stage.label === 'Final')?.value || 0;
    return {
      stageCounts,
      branches: Array.from(branches, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7),
      workloads,
      active,
      assigned,
      finalStage,
      assignmentRate: projects.length ? Math.round((assigned / projects.length) * 100) : 0,
      finalRate: projects.length ? Math.round((finalStage / projects.length) * 100) : 0,
    };
  }, [analyticsQuery.data]);

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
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Live Analytics</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
            <Activity size={13} color="#16a34a" /> Auto-refreshes every 30 seconds
            {analyticsQuery.data?.receivedAt && <><span>•</span><Clock3 size={12} /> Updated {new Date(analyticsQuery.data.receivedAt).toLocaleTimeString()}</>}
          </div>
        </div>
        <button type="button" onClick={() => analyticsQuery.refetch()} disabled={analyticsQuery.isFetching}
          style={{ border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: 9, padding: '9px 12px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: analyticsQuery.isFetching ? 'wait' : 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>
          <RotateCw size={14} className={analyticsQuery.isFetching ? 'dashboard-spin' : ''} /> Refresh analytics
        </button>
      </div>

      {analyticsQuery.isLoading ? (
        <Card elevation={1} style={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><Loader /></Card>
      ) : analyticsQuery.isError ? (
        <Card elevation={1} style={{ padding: 28, color: '#b91c1c' }}>Analytics could not be loaded. Use “Refresh analytics” to retry.</Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 20, marginBottom: 20 }}>
            <Card elevation={1} style={{ padding: 24 }}>
              <AnalyticsHeader title="Projects by stage" subtitle="Current academic-stage distribution" />
              <DonutChart data={analytics.stageCounts} total={analyticsQuery.data?.projects.length || 0} />
            </Card>
            <Card elevation={1} style={{ padding: 24 }}>
              <AnalyticsHeader title="Students by branch" subtitle="Top branches based on enrolled student records" />
              <HorizontalBars data={analytics.branches} color="#0ea5e9" />
            </Card>
            <Card elevation={1} style={{ padding: 24 }}>
              <AnalyticsHeader title="Supervisor workload" subtitle="Projects assigned per supervisor (top seven)" />
              <HorizontalBars data={analytics.workloads} color="#8b5cf6" />
            </Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { label: 'Active projects', value: analytics.active, hint: 'Currently open', color: '#2563eb' },
              { label: 'Supervisor coverage', value: `${analytics.assignmentRate}%`, hint: `${analytics.assigned} projects assigned`, color: '#16a34a' },
              { label: 'Reached final stage', value: `${analytics.finalRate}%`, hint: `${analytics.finalStage} projects`, color: '#f59e0b' },
            ].map((item) => (
              <Card key={item.label} elevation={1} style={{ padding: 20, borderLeft: `4px solid ${item.color}` }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{item.label}</div>
                <div style={{ fontSize: 27, fontWeight: 750, margin: '5px 0 2px' }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{item.hint}</div>
              </Card>
            ))}
          </div>
        </>
      )}
      <style>{`@keyframes dashboardSpin { to { transform: rotate(360deg); } } .dashboard-spin { animation: dashboardSpin .8s linear infinite; }`}</style>
    </div>
  );
};

export default AdminDashboard;
