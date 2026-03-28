import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader } from '../components';
import { useToastStore } from '../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { Check, X, Bell, LayoutDashboard, Clock, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { DeliverableUploader } from '../components/DeliverableUploader';

export const Dashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const addToast = useToastStore(state => state.addToast);

  const [isLoading, setIsLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [leaderAlerts, setLeaderAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user?.role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'SUPERVISOR') {
      navigate('/supervisor/dashboard');
    } else {
      fetchData();
    }
  }, [isAuthenticated, user?.role, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!user) return;
      
      const [teamsRes, membersRes, projectsRes, studentsRes] = await Promise.all([
        api.get('/teams').catch(() => ({ data: [] })),
        api.get('/team-members').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] }))
      ]);

      const allTeams = teamsRes.data || [];
      const allMembers = membersRes.data || [];
      const allProjects = projectsRes.data || [];
      const allStudents = studentsRes.data || [];
      
      const myInvites: any[] = [];
      const myProjects: any[] = [];
      const myAlerts: any[] = [];

      allMembers.forEach((tm: any) => {
         const joined = JSON.parse(tm.joinMemberArray || '[]');
         const pending = JSON.parse(tm.notJoinMemberArray || '[]');
         const rejected = JSON.parse(tm.rejectedMemberArray || '[]');
         
         const teamInfo = allTeams.find((t: any) => t.teamId === tm.teamId);
         const projInfo = allProjects.find((p: any) => p.teamId === tm.teamId);
         if (!teamInfo || !projInfo) return; 
         
         const leaderInfo = allStudents.find((s:any) => s.studentId === teamInfo.leaderId);

         // 1. Identify Pending Invitations
         if (pending.includes(user.id)) {
            myInvites.push({
               teamId: tm.teamId,
               projectTitle: projInfo.projectTitle,
               leaderName: leaderInfo?.name || 'A Student'
            });
         }

         // 2. Identify Enrolled Projects
         if (joined.includes(user.id)) {
            myProjects.push({
               ...projInfo,
               teamId: tm.teamId,
               leaderName: leaderInfo?.name || 'A Student',
               teamMembersCount: joined.length,
               pendingCount: pending.length
            });
         }

         // 3. Identify Leader Notifications (if I am the leader)
         if (teamInfo.leaderId === user.id) {
            rejected.forEach((rejId: string) => {
               const rejStudent = allStudents.find((s:any) => s.studentId === rejId);
               myAlerts.push({
                  id: Math.random(),
                  type: 'rejected',
                  studentName: rejStudent?.name || rejId,
                  projectTitle: projInfo.projectTitle
               });
            });
         }
      });
      
      setInvitations(myInvites);
      setActiveProjects(myProjects);
      setLeaderAlerts(myAlerts);
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const processSingleInvite = async (teamId: string, action: 'accept' | 'reject') => {
      const { data: tm } = await api.get(`/team-members/${teamId}`);
      let joined = JSON.parse(tm.joinMemberArray || '[]');
      let pending = JSON.parse(tm.notJoinMemberArray || '[]');
      let rejected = JSON.parse(tm.rejectedMemberArray || '[]');

      pending = pending.filter((id: string) => id !== user?.id);

      if (action === 'accept') {
         joined.push(user?.id);
      } else {
         rejected.push(user?.id);
      }

      await api.put(`/team-members/${teamId}`, {
         joinMemberIds: joined,
         notJoinMemberIds: pending,
         rejectedMemberIds: rejected
      });
  };

  const handleInviteAction = async (teamId: string, action: 'accept' | 'reject') => {
    try {
      if (action === 'accept') {
         // 1. Accept the chosen team
         await processSingleInvite(teamId, 'accept');

         // 2. Reject all OTHER pending invitations to avoid multi-team enrollment
         const otherInvites = invitations.filter(inv => inv.teamId !== teamId);
         await Promise.all(
            otherInvites.map(invite => processSingleInvite(invite.teamId, 'reject'))
         );
         
         addToast('Welcome to the Team! All other requests have been automatically declined.', 'success');
      } else {
         await processSingleInvite(teamId, 'reject');
         addToast('Invitation Declined.', 'success');
      }

      fetchData(); 
    } catch(err) {
      addToast('Failed to process invitation', 'error');
    }
  };

  if (!user || isLoading) return <div style={{ display:'flex', justifyContent:'center', marginTop:'100px'}}><Loader size="lg" /></div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LayoutDashboard size={28} color="var(--primary)" /> 
            Student Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '16px' }}>
            Welcome back, <strong>{user.name}</strong> • Track your academic projects here.
          </p>
        </div>
      </div>

      {/* LEADER ALERTS / NOTIFICATIONS */}
      {leaderAlerts.length > 0 && (
        <Card elevation={2} style={{ borderLeft: '4px solid var(--error)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', margin: '0 0 16px' }}>
            <AlertTriangle size={20} /> Action Required: Team Rejections
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leaderAlerts.map(alert => (
              <div key={alert.id} style={{ padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '6px' }}>
                <strong>{alert.studentName}</strong> has declined your invitation to join <strong>{alert.projectTitle}</strong>.
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* PENDING INVITATIONS */}
      {invitations.length > 0 && (
        <Card elevation={3} style={{ border: '1px solid var(--primary)', backgroundColor: 'var(--surface)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 16px' }}>
            <Bell size={20} /> Pending Project Invitations ({invitations.length})
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            You have been invited to join the following academic projects. Approving will officially enroll you as a team member.
          </p>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {invitations.map(invite => (
              <div key={invite.teamId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '18px' }}>{invite.projectTitle}</h4>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Invited by Team Leader: {invite.leaderName}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="outline" size="sm" onClick={() => handleInviteAction(invite.teamId, 'reject')} leftIcon={<X size={16} />}>
                    Decline
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleInviteAction(invite.teamId, 'accept')} leftIcon={<Check size={16} />}>
                    Enroll
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ACTIVE PROJECTS BREAKDOWN */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--text-primary)' }}>My Enrolled Projects</h2>
        
        {activeProjects.length === 0 ? (
          <Card elevation={1} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
            <FileText size={48} color="var(--text-disabled)" style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>You have not been formally enrolled in any projects yet.</p>
            <Button variant="outline" style={{ marginTop: '16px' }} onClick={() => navigate('/enroll')}>Go to Enrollment Flow</Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
            {activeProjects.map(proj => (
              <Card key={proj.projectId} elevation={2} style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '22px' }}>{proj.projectTitle}</h3>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <span>Leader: {proj.leaderName}</span>
                        <span>•</span>
                        <span>Team Size: {proj.teamMembersCount} Enrolled ({proj.pendingCount} Pending)</span>
                      </div>
                    </div>
                    <div style={{ padding: '6px 12px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                      Status: {proj.stageStatus || 'ACTIVE'}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '24px' }}>
                   <h4 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Clock size={16} /> Project Stages & Progress
                   </h4>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      {[
                        { label: 'Synopsis', score: proj.synopsisScore },
                        { label: 'Progress 1', score: proj.progress1Score },
                        { label: 'Progress 2', score: proj.progress2Score },
                        { label: 'Final Submission', score: proj.finalScore }
                      ].map((stage, i) => (
                        <div key={stage.label} style={{ 
                           padding: '16px', 
                           borderRadius: '8px', 
                           border: stage.score != null ? '1px solid var(--primary)' : '1px dashed var(--border-color)',
                           backgroundColor: stage.score != null ? 'var(--primary-glow)' : 'transparent',
                           textAlign: 'center'
                        }}>
                           <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: stage.score != null ? 'var(--primary)' : 'var(--text-disabled)' }}>
                             Stage {i + 1}: {stage.label}
                           </div>
                           <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>
                             {stage.score != null ? `${stage.score}/10` : '-/10'}
                           </div>
                           {stage.score != null && <CheckCircle size={16} color="var(--primary)" style={{ marginTop: '8px' }} />}
                        </div>
                      ))}
                   </div>
                   
                   {/* DELIVERABLE UPLOADER FOR THIS PROJECT */}
                   <DeliverableUploader 
                      projectId={proj.projectId}
                      documentId={proj.documentId}
                      currentStage={proj.stageStatus || 'SYNOPSIS'}
                      isLeader={proj.leaderId === user?.id}
                      onSuccess={fetchData}
                   />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
