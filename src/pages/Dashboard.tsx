import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader, ProjectTimeline, ReferenceTemplatesCard } from '../components';
import { useToastStore } from '../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { Check, Bell, CheckCircle, Calendar, Video, MapPin, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { DeliverableUploader } from '../components/DeliverableUploader';
import { isValidMeetingLink, openMeetingLink } from '../utils/meetingLinks';

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
    const [meetings, setMeetings] = useState<any[]>([]);
    const [performanceScore, setPerformanceScore] = useState(100);

    const [myStudentInfo, setMyStudentInfo] = useState<any>(null);
    const [applicableForms, setApplicableForms] = useState<any[]>([]);

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

            const [teamsRes, membersRes, projectsRes, studentsRes, formsRes] = await Promise.all([
                api.get('/teams').catch(() => ({ data: [] })),
                api.get('/team-members').catch(() => ({ data: [] })),
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] })),
                api.get('/forms').catch(() => ({ data: [] }))
            ]);

            const allTeams = teamsRes.data || [];
            const allMembers = membersRes.data || [];
            const allProjects = projectsRes.data || [];
            const allStudents = studentsRes.data || [];
            const allForms = formsRes.data || [];

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

                const leaderInfo = allStudents.find((s: any) => s.studentId === teamInfo.leaderId);

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
                    const joinedCards = joined.map((id: string) => ({ ...allStudents.find((s: any) => s.studentId === id), status: 'APPROVED', isLeader: false })).filter((s: any) => s.studentId !== leaderInfo?.studentId);
                    const pendingCards = pending.map((id: string) => ({ ...allStudents.find((s: any) => s.studentId === id), status: 'PENDING APPROVAL', isLeader: false }));

                    myMembersGrid.push(leaderCard, ...joinedCards, ...pendingCards);

                    // If I am the leader, populate my Incoming Requests
                    if (teamInfo.leaderId === user.id) {
                        pending.forEach((pid: string) => {
                            const pstu = allStudents.find((s: any) => s.studentId === pid);
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

            const myScore = allStudents.find((s: any) => s.studentId === user.id)?.performanceScore ?? 100;
            setPerformanceScore(myScore);

            if (myProjects.length > 0) {
                try {
                    const current = myProjects[0];
                    const mRes = await api.get(`/supervisor/meetings/project/${current.projectId}`);
                    setMeetings(mRes.data || []);
                } catch (e) {
                    console.error(e);
                }
            } else {
                setMeetings([]);
            }

            // Deduplicate members list based on ID
            const uniqueMembers = Array.from(new Map(myMembersGrid.filter(m => m.studentId).map(m => [m.studentId, m])).values());
            setTeamMembersList(uniqueMembers);

            const me = allStudents.find((s: any) => s.studentId === user.id);
            setMyStudentInfo(me);

            if (me) {
                const myForms = allForms.filter((f: any) => {
                    const fBranches = (f.accessBranch || '').split(',').map((s: string) => s.trim().toLowerCase());
                    const fBatches = (f.accessBatch || '').split(',').map((s: string) => s.trim().toLowerCase());
                    const myBranch = (me.branch || '').toLowerCase();
                    const myBatch = (me.batch || '').toLowerCase();
                    return fBranches.includes(myBranch) && fBatches.includes(myBatch);
                });
                // Hide enrollment forms for students already enrolled / already on a project
                setApplicableForms(me.enrollStatus === 'ENROLLED' || myProjects.length > 0 ? [] : myForms);
            }

        } catch (err) {
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
        } catch (err) {
            addToast('Failed to process action', 'error');
        }
    };

    const handleCompleteTeam = async () => {
        const currentProject = activeProjects[0];
        if (!currentProject) return;
        try {
            const { data: tm } = await api.get(`/team-members/${currentProject.teamId}`);
            let joined = JSON.parse(tm.joinMemberArray || '[]');
            let pending = JSON.parse(tm.notJoinMemberArray || '[]');
            let rejected = JSON.parse(tm.rejectedMemberArray || '[]');

            // Move all pending to rejected
            rejected = [...rejected, ...pending];
            pending = [];

            await api.put(`/team-members/${currentProject.teamId}`, {
                joinMemberIds: joined,
                notJoinMemberIds: pending,
                rejectedMemberIds: rejected
            });
            
            addToast('Team marked as complete. All pending invitations have been closed.', 'success');
            fetchData();
        } catch (err) {
            addToast('Failed to complete team.', 'error');
        }
    };

    if (!user || isLoading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><Loader size="lg" /></div>;

    const currentProject = activeProjects[0]; // For visual dashboard, focus on primary active project

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Project info + performance badge */}
                    <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '6px 12px',
                                borderRadius: '999px',
                                backgroundColor: performanceScore < 50 ? '#fef2f2' : '#ecfdf5',
                                color: performanceScore < 50 ? '#b91c1c' : '#047857',
                                border: `1px solid ${performanceScore < 50 ? '#fecaca' : '#a7f3d0'}`,
                            }}>
                                <TrendingUp size={14} />
                                Your performance on this project: {performanceScore}
                            </span>
                            {performanceScore < 50 && (
                                <span style={{ fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertTriangle size={14} /> Attend meetings to avoid penalties
                                </span>
                            )}
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {currentProject.projectTitle || 'Untitled Project'}
                        </h2>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {currentProject.projectDescription
                                ? String(currentProject.projectDescription).replace(/\*\*/g, '').trim()
                                : 'No project description provided.'}
                        </p>
                    </Card>

                    {/* Top grid: Timeline (left) | Meetings + Deliverables (right) */}
                    <div
                        className="student-dashboard-grid"
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: '24px', alignItems: 'start' }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <ProjectTimeline project={currentProject} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
                            <Card elevation={1} style={{ border: '1px solid #bae6fd', borderRadius: '12px', backgroundColor: '#f0f9ff', padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Calendar size={20} /> Your Team Meetings
                                    </h3>
                                </div>
                                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#0369a1' }}>
                                    Shows only meetings for your team. If your slot was rescheduled, you see the new time here.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {meetings.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '16px', color: '#0ea5e9', fontSize: '14px', fontStyle: 'italic' }}>
                                            No meetings scheduled for your team yet.
                                        </div>
                                    )}
                                    {meetings.map((meeting) => (
                                        <div key={meeting.meetingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #bae6fd', borderRadius: '8px', backgroundColor: '#ffffff', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: meeting.status === 'COMPLETED' ? '#dcfce7' : '#e0f2fe', color: meeting.status === 'COMPLETED' ? '#16a34a' : '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {meeting.mode === 'ONLINE' ? <Video size={20} /> : <MapPin size={20} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        {meeting.stage} Review
                                                        {meeting.sessionId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '999px' }}>BATCH</span>}
                                                        {meeting.originalMeetingDate && <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '999px' }}>RESCHEDULED</span>}
                                                        {meeting.status === 'COMPLETED' && <span style={{ fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}><CheckCircle size={10} style={{ display: 'inline', marginRight: '4px' }} />COMPLETED</span>}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#0369a1' }}><Calendar size={14} /> {meeting.meetingDate}</span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#0369a1' }}><Clock size={14} /> {String(meeting.meetingTime || '').substring(0, 5)}{meeting.endTime ? ` - ${String(meeting.endTime).substring(0, 5)}` : ''}</span>
                                                    </div>
                                                    {meeting.originalMeetingDate && (
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                                                            Was: {meeting.originalMeetingDate} at {String(meeting.originalMeetingTime || '').substring(0, 5)}
                                                        </div>
                                                    )}
                                                    {meeting.status === 'COMPLETED' && meeting.conclusionNotes && (
                                                        <div style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '8px', fontStyle: 'italic' }}>
                                                            &quot; {meeting.conclusionNotes} &quot;
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {meeting.status === 'SCHEDULED' && meeting.mode === 'ONLINE' && (
                                                isValidMeetingLink(meeting.locationOrLink) ? (
                                                    <Button size="sm" variant="outline" onClick={() => openMeetingLink(meeting.locationOrLink, () => addToast('This meeting has an invalid link. Ask your supervisor/admin to update it.', 'error'))} style={{ borderColor: '#0284c7', color: '#0284c7' }}>Join GMeet</Button>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>Invalid meeting link</span>
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {currentProject?.documentId && (
                                <DeliverableUploader
                                    projectId={currentProject.projectId}
                                    documentId={currentProject.documentId}
                                    currentStage={currentProject.stageStatus}
                                    isLeader={currentProject.leaderId === user.id}
                                    onSuccess={fetchData}
                                />
                            )}
                        </div>
                    </div>

                    <ReferenceTemplatesCard formId={currentProject?.formId} currentStage={currentProject?.stageStatus} />

                    {/* Active Members */}
                    <Card elevation={1} style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Active Members</h3>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {currentProject.leaderId === user.id && (
                                    <Button variant="outline" size="sm" onClick={handleCompleteTeam}>Complete Team</Button>
                                )}
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {teamMembersList.filter((m: any) => m.status === 'APPROVED').length}/{teamMembersList.length || 0} joined
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {teamMembersList.map((tm, idx) => (
                                <div key={idx} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: idx !== teamMembersList.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: tm.status === 'APPROVED' ? 'var(--primary-glow)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: tm.status === 'APPROVED' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                            {tm.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                                                {tm.name} {tm.studentId === user.id ? '(You)' : ''}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-disabled)' }}>
                                                {tm.isLeader ? 'Team Lead' : 'Team Member'} • {tm.rollNo || 'N/A'} • {tm.mail || 'No Email'}
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
            ) : (
                <Card elevation={1} style={{ padding: '32px', color: 'var(--text-secondary)' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Available Project Forms</h2>
                    <p style={{ marginBottom: '24px' }}>You have not been formally enrolled in any projects yet. Select an available group formation form for your branch below:</p>

                    {applicableForms.length === 0 ? (
                        <div style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                            No specific forms are currently open for <strong style={{ color: 'var(--text-primary)' }}>{myStudentInfo?.branch} Batch {myStudentInfo?.batch}</strong>. Please contact your Admin.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {applicableForms.map((form: any) => (
                                <div key={form.formId} onClick={() => navigate(`/enroll?formId=${form.formId}`)} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--primary)' }}>Batch {form.accessBatch} Registration</h3>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <CheckCircle size={16} color="var(--primary)" />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                        Valid Branch Mapping: <strong style={{ color: 'var(--text-primary)' }}>{form.accessBranch}</strong>
                                    </div>
                                    <Button size="sm" variant="primary" style={{ marginTop: 'auto', width: '100%' }}>Select and Go to Form</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

        </div>
    );
};

export default Dashboard;
