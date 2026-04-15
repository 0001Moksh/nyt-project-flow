import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader } from '../components';
import { useToastStore } from '../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { Check, X, Bell, Users, CheckCircle, Info, Calendar, Video, MapPin, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
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
                    const mRes = await api.get(`/supervisor/meetings/project/${myProjects[0].projectId}`);
                    setMeetings(mRes.data || []);
                } catch (e) {
                    console.error(e);
                }
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
                setApplicableForms(myForms);
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
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

                    {/* LEFT COLUMN: Project Canvas */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

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

                        {currentProject?.documentId && (
                            <DeliverableUploader
                                projectId={currentProject.projectId}
                                documentId={currentProject.documentId}
                                currentStage={currentProject.stageStatus}
                                isLeader={currentProject.leaderId === user.id}
                                onSuccess={fetchData}
                            />
                        )}

                        {/* Meetings Tracker */}
                        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Upcoming Meetings</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {meetings.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-disabled)', fontSize: '14px' }}>
                                        No meetings scheduled yet.
                                    </div>
                                )}
                                {meetings.map((meeting) => (
                                    <div key={meeting.meetingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)' }}>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: meeting.status === 'COMPLETED' ? '#dcfce7' : 'var(--primary-glow)', color: meeting.status === 'COMPLETED' ? '#16a34a' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {meeting.mode === 'ONLINE' ? <Video size={20} /> : <MapPin size={20} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    Stage: {meeting.stage}
                                                    {meeting.status === 'COMPLETED' && <span style={{ marginLeft: '12px', fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}><CheckCircle size={10} style={{ display: 'inline', marginRight: '4px' }} />COMPLETED</span>}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {meeting.meetingDate}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {meeting.meetingTime}</span>
                                                </div>
                                                {meeting.status === 'COMPLETED' && (
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '8px', fontStyle: 'italic' }}>
                                                        " {meeting.conclusionNotes} "
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                    </div>

                    {/* RIGHT COLUMN: Sidebar Panels */}
                    <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Performance Panel */}
                        <Card elevation={1} style={{ padding: '24px', border: `1px solid ${performanceScore < 50 ? '#fecaca' : 'var(--border-color)'}`, borderRadius: '12px', backgroundColor: performanceScore < 50 ? '#fef2f2' : 'var(--surface)' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: performanceScore < 50 ? '#dc2626' : 'var(--text-primary)' }}>
                                <TrendingUp size={20} /> My Performance
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '48px', margin: 0, fontWeight: 800, color: performanceScore < 50 ? '#ef4444' : '#16a34a', lineHeight: '48px' }}>{performanceScore}</h2>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Points</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{ width: `${Math.max(0, performanceScore)}%`, height: '100%', backgroundColor: performanceScore < 50 ? '#ef4444' : '#16a34a' }}></div>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {performanceScore < 50 ? (
                                    <span style={{ display: 'flex', gap: '6px', color: '#b91c1c' }}><AlertTriangle size={16} /> Warning: Missing mandatory meetings incurs a 10pt penalty.</span>
                                ) : 'Maintain your score above 50 by completing milestones and attending all scheduled meetings.'}
                            </p>
                        </Card>
                    </div>
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
