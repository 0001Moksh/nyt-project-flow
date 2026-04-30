import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { CheckCircle, Clock, Users, X, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SupervisorDashboard: React.FC = () => {
   const [projects, setProjects] = useState<any[]>([]);
   const [teamMembers, setTeamMembers] = useState<any[]>([]);
   const [students, setStudents] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   
   const addToast = useToastStore(state => state.addToast);
   const user = useAuthStore(state => state.user);
   const navigate = useNavigate();

   useEffect(() => {
      fetchData();
   }, []);

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [projectsRes, teamsRes, studentsRes] = await Promise.all([
            api.get('/projects').catch(() => ({ data: [] })),
            api.get('/team-members').catch(() => ({ data: [] })),
            api.get('/students').catch(() => ({ data: [] }))
         ]);

         const myProjects = (projectsRes.data || []).filter((p: any) => p.supervisorId === user?.id);
         
         setProjects(myProjects);
         setTeamMembers(teamsRes.data || []);
         setStudents(studentsRes.data || []);

      } catch (err) {
         console.error("Failed to load supervisor data", err);
      } finally {
         setIsLoading(false);
      }
   };

   const handleApproval = async (projectId: string, action: 'approved' | 'rejected') => {
       try {
           await api.put(`/projects/${projectId}`, {
               status: action
           });
           addToast(`Project ${action} successfully.`, 'success');
           fetchData();
       } catch(err) {
           addToast('Failed to update project status', 'error');
       }
   };

   if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

   // Deriving stats
   const pendingCount = projects.filter(p => p.status === 'pending').length;
   const approvedCount = projects.filter(p => p.status === 'approved').length;
   const lockedCount = projects.filter(p => p.status === 'locked').length; // Assuming 'locked' is a phase or status

   return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
         
         {/* Title area */}
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
             <div>
                <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Team Approvals & Monitoring</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Manage and oversee team formation workflows across your departments.</p>
             </div>
             <div style={{ display: 'flex', gap: '12px' }}>
                 <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export CSV</Button>
                 <Button variant="primary" size="sm">Batch Approve</Button>
             </div>
         </div>

         {/* 4 Stat Cards */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
             <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                 <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Pending Approvals</p>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                     <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700 }}>{pendingCount < 10 ? `0${pendingCount}` : pendingCount}</h2>
                     <span style={{ color: '#d97706', fontSize: '13px', fontWeight: 600, backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px' }}>+2 today</span>
                 </div>
             </Card>

             <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                 <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Total Approved</p>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                     <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700 }}>{approvedCount < 10 ? `0${approvedCount}` : approvedCount}</h2>
                     <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>+12%</span>
                 </div>
             </Card>

             <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                 <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Locked Teams</p>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                     <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700 }}>{lockedCount < 10 ? `0${lockedCount}` : lockedCount}</h2>
                     <span style={{ color: 'var(--text-disabled)', fontSize: '13px', fontWeight: 500 }}>Static</span>
                 </div>
             </Card>

             <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                 <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Avg. Response Time</p>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                     <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700 }}>2.4h</h2>
                     <span style={{ color: '#2563eb', fontSize: '13px', fontWeight: 600 }}>-15m</span>
                 </div>
             </Card>
         </div>

         {/* This area left empty or for future charts */}
         <div style={{ marginTop: '24px', padding: '32px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-disabled)', border: '1px dashed var(--border-color)' }}>
            <p>Select "Projects" from the sidebar to view and manage your assigned teams.</p>
         </div>

      </div>
   );
};

export default SupervisorDashboard;
