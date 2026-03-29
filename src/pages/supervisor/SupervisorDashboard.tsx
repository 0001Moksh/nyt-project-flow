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
   const [activeTab, setActiveTab] = useState('Pending');
   
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

   // Filtering based on tab
   const filteredProjects = projects.filter(p => {
       if (activeTab === 'All Teams') return true;
       return p.status?.toLowerCase() === activeTab.toLowerCase();
   });

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

         {/* Tabs */}
         <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
             {['All Teams', 'Pending', 'Approved', 'Locked'].map(tab => {
                 let count = tab === 'All Teams' ? projects.length : 
                             tab === 'Pending' ? pendingCount : 
                             tab === 'Approved' ? approvedCount : lockedCount;

                 return (
                     <div 
                         key={tab} 
                         onClick={() => setActiveTab(tab)}
                         style={{ 
                             cursor: 'pointer', 
                             color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)', 
                             fontWeight: activeTab === tab ? 600 : 500,
                             display: 'flex',
                             alignItems: 'center',
                             gap: '8px',
                             position: 'relative'
                         }}
                     >
                         {tab} ({count})
                         {activeTab === tab && (
                             <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--primary)' }}></div>
                         )}
                         {tab === 'Pending' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>}
                     </div>
                 );
             })}
         </div>

         {/* Project Main Area */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
             {filteredProjects.map(proj => {
                 const tm = teamMembers.find(t => t.teamId === proj.teamId);
                 const joinedIds = tm ? JSON.parse(tm.joinMemberArray || '[]') : [];
                 
                 // Reconstruct members list (mocking details based on IDs)
                 const memberDetails = joinedIds.map((id:string, idx:number) => {
                     const student = students.find(s => s.studentId === id);
                     return { 
                         name: student ? student.name : 'Unknown Student', 
                         role: idx === 0 ? 'Lead' : 'Member', 
                         initials: student ? student.name.substring(0, 2).toUpperCase() : 'US'
                     };
                 });

                 // If it's approved, change behavior when clicking
                 const isPending = proj.status === 'pending';

                 return (
                     <Card 
                         key={proj.projectId} 
                         elevation={1} 
                         style={{ 
                             padding: '24px', 
                             border: '1px solid var(--border-color)', 
                             borderRadius: '12px',
                             cursor: isPending ? 'default' : 'pointer',
                             transition: 'transform 0.2s, box-shadow 0.2s',
                             borderTop: `4px solid ${isPending ? '#fef08a' : '#86efac'}`
                         }}
                         onClick={() => {
                             if (!isPending) {
                                 navigate(`/supervisor/teams/${proj.teamId}`);
                             }
                         }}
                     >
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                             <div>
                                 <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>{proj.projectTitle}</h3>
                                 <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Project: {proj.projectTitle}</p>
                             </div>
                             {isPending ? (
                                 <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '12px' }}>PENDING APPROVAL</span>
                             ) : (
                                 <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e6f4ea', color: '#16a34a', padding: '4px 12px', borderRadius: '12px' }}>APPROVED</span>
                             )}
                         </div>

                         <div style={{ marginBottom: '24px' }}>
                             <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-disabled)', textTransform: 'uppercase' }}>
                                 TEAM MEMBERS ({memberDetails.length})
                             </p>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                 {memberDetails.map((m: any, idx: number) => (
                                     <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                         <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{m.initials}</span>
                                         <span style={{ fontSize: '14px', fontWeight: 500, flex: 1 }}>{m.name}</span>
                                         {m.role === 'Lead' && <span style={{ fontSize: '12px', color: '#2563eb' }}>Lead</span>}
                                     </div>
                                 ))}
                             </div>
                         </div>

                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                             <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Submitted 2h ago</span>
                             <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>View Proposal</span>
                         </div>

                         {isPending && (
                             <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                 <Button variant="outline" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); handleApproval(proj.projectId, 'rejected'); }} leftIcon={<X size={16} />}>Reject</Button>
                                 <Button variant="primary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); handleApproval(proj.projectId, 'approved'); }} leftIcon={<CheckCircle size={16} />}>Approve</Button>
                             </div>
                         )}
                     </Card>
                 );
             })}
         </div>

      </div>
   );
};

export default SupervisorDashboard;
