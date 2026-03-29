import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader } from '../components';
import { useToastStore } from '../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { Check, X, Bell, Users, CheckCircle, Info } from 'lucide-react';
import { api } from '../services/api';
import { DeliverableUploader } from '../components/DeliverableUploader';

export const Dashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const addToast = useToastStore(state => state.addToast);

  const [isLoading, setIsLoading] = useState(true);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);

  // Extended Data Tracking
  const [teamMembersList, setTeamMembersList] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

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
      const myIncomingReqs: any[] = [];
      const myMembersGrid: any[] = [];

      allMembers.forEach((tm: any) => {
         const joined = JSON.parse(tm.joinMemberArray || '[]');
         const pending = JSON.parse(tm.notJoinMemberArray || '[]');
         
         const teamInfo = allTeams.find((t: any) => t.teamId === tm.teamId);
         const projInfo = allProjects.find((p: any) => p.teamId === tm.teamId);
         if (!teamInfo || !projInfo) return; 
         
         const leaderInfo = allStudents.find((s:any) => s.studentId === teamInfo.leaderId);

         // 1. Identify Pending Invitations (for ME)
         if (pending.includes(user.id)) {
            myInvites.push({
               teamId: tm.teamId,
               projectTitle: projInfo.projectTitle,
               leaderName: leaderInfo?.name || 'A Student'
            });
         }

         // 2. Identify Enrolled Projects (where I am joined or leader)
         if (joined.includes(user.id) || teamInfo.leaderId === user.id) {
            myProjects.push({
               ...projInfo,
               teamId: tm.teamId,
               leaderId: teamInfo.leaderId,
               teamMembersCount: joined.length,
               pendingCount: pending.length
            });

            // Populate the active members grid for this project
            const leaderCard = { ...leaderInfo, status: 'APPROVED', isLeader: true };
            const joinedCards = joined.map((id:string) => ({ ...allStudents.find((s:any) => s.studentId === id), status: 'APPROVED', isLeader: false})).filter((s:any) => s.studentId !== leaderInfo?.studentId);
            const pendingCards = pending.map((id:string) => ({ ...allStudents.find((s:any) => s.studentId === id), status: 'PENDING APPROVAL', isLeader: false}));
            
            myMembersGrid.push(leaderCard, ...joinedCards, ...pendingCards);

            // If I am the leader, populate my Incoming Requests
            if (teamInfo.leaderId === user.id) {
               pending.forEach((pid: string) => {
                  const pstu = allStudents.find((s:any) => s.studentId === pid);
                  if (pstu) {
                     myIncomingReqs.push({
                         teamId: tm.teamId,
                         studentId: pstu.studentId,
                         name: pstu.name,
                         branch: pstu.branch || 'Computer Science'
                     });
                  }
               });
            }
         }
      });
      
      setInvitations(myInvites);
      setActiveProjects(myProjects);
      setIncomingRequests(myIncomingReqs);
      
      // Deduplicate members list based on ID
      const uniqueMembers = Array.from(new Map(myMembersGrid.filter(m => m.studentId).map(m => [m.studentId, m])).values());
      setTeamMembersList(uniqueMembers);

    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const processSingleInvite = async (teamId: string, action: 'accept' | 'reject', targetStudentId?: string) => {
      const { data: tm } = await api.get(`/team-members/${teamId}`);
      let joined = JSON.parse(tm.joinMemberArray || '[]');
      let pending = JSON.parse(tm.notJoinMemberArray || '[]');
      let rejected = JSON.parse(tm.rejectedMemberArray || '[]');

      const userTarget = targetStudentId || user?.id;

      pending = pending.filter((id: string) => id !== userTarget);

      if (action === 'accept') {
         joined.push(userTarget);
      } else {
         rejected.push(userTarget);
      }

      await api.put(`/team-members/${teamId}`, {
         joinMemberIds: joined,
         notJoinMemberIds: pending,
         rejectedMemberIds: rejected
      });
  };

  const handleInviteAction = async (teamId: string, action: 'accept' | 'reject', targetStudentId?: string) => {
    try {
      if (action === 'accept') {
         await processSingleInvite(teamId, 'accept', targetStudentId);
         if (!targetStudentId) {
            // If I am accepting an invite, reject others
            const otherInvites = invitations.filter(inv => inv.teamId !== teamId);
            await Promise.all(otherInvites.map(invite => processSingleInvite(invite.teamId, 'reject')));
            addToast('Welcome to the Team! All other requests have been automatically declined.', 'success');
         } else {
            addToast('Member request approved!', 'success');
         }
      } else {
         await processSingleInvite(teamId, 'reject', targetStudentId);
         addToast(targetStudentId ? 'Request declined.' : 'Invitation Declined.', 'success');
      }
      fetchData(); 
    } catch(err) {
      addToast('Failed to process action', 'error');
    }
  };

  if (!user || isLoading) return <div style={{ display:'flex', justifyContent:'center', marginTop:'100px'}}><Loader size="lg" /></div>;

  const currentProject = activeProjects[0]; // For visual dashboard, focus on primary active project

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* HEADER SECTION */}
      <div>
        <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Team Formation</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
          Manage your project group and member requests for the upcoming semester.
        </p>
      </div>

      {/* PENDING INVITATIONS FOR ME TO ACCEPT */}
      {invitations.length > 0 && !currentProject && (
        <div style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 16px' }}>
            <Bell size={20} /> Project Invitations ({invitations.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {invitations.map(invite => (
              <div key={invite.teamId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px' }}>{invite.projectTitle}</h4>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Invited by Team Leader: {invite.leaderName}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="outline" size="sm" onClick={() => handleInviteAction(invite.teamId, 'reject')}>Decline</Button>
                  <Button variant="primary" size="sm" onClick={() => handleInviteAction(invite.teamId, 'accept')} leftIcon={<Check size={16} />}>Accept Invite</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentProject ? (
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
              
              {/* LEFT COLUMN: Project Canvas */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Status Banner */}
                  <div style={{ backgroundColor: '#e6f4ea', border: '1px solid #cce8d6', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1e8e3e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Check size={18} />
                      </div>
                      <div>
                          <h4 style={{ margin: 0, color: '#116a2b', fontSize: '15px', fontWeight: 600 }}>You are enrolled</h4>
                          <p style={{ margin: 0, color: '#1e8e3e', fontSize: '13px' }}>Your team has reached the minimum requirement and is officially registered.</p>
                      </div>
                  </div>

                  {/* Project Banner Card */}
                  <div style={{ backgroundColor: 'var(--primary)', borderRadius: '12px', padding: '32px', color: 'white', boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', opacity: 0.8 }}>CS-501: ADVANCED NEURAL NETWORKS</p>
                      <h2 style={{ margin: '0 0 32px', fontSize: '28px', fontWeight: 700 }}>{currentProject.projectTitle}</h2>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}><Users size={16} /> Team Capacity</span>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>75% Complete</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                          <div style={{ width: '75%', height: '100%', backgroundColor: 'white', borderRadius: '4px' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
                          <span>{teamMembersList.length} Members Active</span>
                          <span>1 Spot Remaining</span>
                      </div>
                  </div>

                  {/* Active Members List */}
                  <Card elevation={1} style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Active Members</h3>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>3/4 SLOTS</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {teamMembersList.map((tm, idx) => (
                              <div key={idx} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: idx !== teamMembersList.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: tm.status === 'APPROVED' ? 'var(--primary-glow)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: tm.status === 'APPROVED' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                          {tm.name.charAt(0)}
                                      </div>
                                      <div>
                                          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                                              {tm.name} {tm.studentId === user.id ? '(You)' : ''}
                                          </div>
                                          <div style={{ fontSize: '13px', color: 'var(--text-disabled)' }}>
                                              {tm.isLeader ? 'Team Lead' : 'Team Member'} • Data Scientist
                                          </div>
                                      </div>
                                  </div>
                                  
                                  {tm.status === 'APPROVED' ? (
                                      <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e6f4ea', color: '#1e8e3e', padding: '4px 12px', borderRadius: '12px' }}>APPROVED</span>
                                  ) : (
                                      <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '12px' }}>PENDING APPROVAL</span>
                                  )}
                              </div>
                          ))}
                      </div>
                  </Card>

              </div>

              {/* RIGHT COLUMN: Sidebar Panels */}
              <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Incoming Requests Panel (For Leaders Only) */}
                  {user.id === currentProject.leaderId && (
                      <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                          <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              Incoming Requests 
                              <span style={{ backgroundColor: 'var(--primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                                  {incomingRequests.length}
                              </span>
                          </h3>

                          {incomingRequests.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-disabled)' }}>
                                  <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                  <p style={{ margin: 0, fontSize: '13px' }}>No new requests</p>
                              </div>
                          ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  {incomingRequests.map((req, idx) => (
                                      <div key={idx} style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fdfdfd' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                               <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                   {req.name.charAt(0)}
                                               </div>
                                               <div>
                                                   <div style={{ fontWeight: 600, fontSize: '14px' }}>{req.name}</div>
                                                   <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{req.branch}</div>
                                               </div>
                                          </div>
                                          <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                              "Hi! I would love to contribute to {currentProject.projectTitle}..."
                                          </p>
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                              <Button style={{ flex: 1 }} size="sm" onClick={() => handleInviteAction(req.teamId, 'accept', req.studentId)}>Accept</Button>
                                              <Button style={{ flex: 1 }} size="sm" variant="outline" onClick={() => handleInviteAction(req.teamId, 'reject', req.studentId)}>Decline</Button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </Card>
                  )}

                  {/* Formation Progress Panel */}
                  <Card elevation={2} style={{ padding: '24px', backgroundColor: '#0f172a', color: 'white', borderRadius: '12px' }}>
                      <h4 style={{ margin: '0 0 24px', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8' }}>FORMATION PROGRESS</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" /></div>
                              <span style={{ fontSize: '14px', fontWeight: 500 }}>Topic Selected</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" /></div>
                              <span style={{ fontSize: '14px', fontWeight: 500 }}>Min. Member Threshold met</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8' }}>Final Member Approval</span>
                          </div>
                      </div>

                      <Button style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '12px' }}>Finalize Team</Button>
                      <p style={{ margin: '12px 0 0', fontSize: '10px', textAlign: 'center', color: '#64748b' }}>Cannot undo once finalized</p>
                  </Card>

              </div>
          </div>
      ) : (
        <Card elevation={1} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
            <p>You have not been formally enrolled in any projects yet.</p>
            <Button variant="outline" style={{ marginTop: '16px' }} onClick={() => navigate('/enroll')}>Go to Enrollment Flow</Button>
        </Card>
      )}

    </div>
  );
};

export default Dashboard;
