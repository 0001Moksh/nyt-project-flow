import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader, ProjectTimeline } from '../components';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, User, Briefcase, FolderKanban, History, Video, MapPin, Calendar, Clock, FileText, ShieldCheck, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import type { FormAttachment, FormResponse, Template } from '../services/adminService';
import { getPreviewUrl } from '../utils/filePreview';
import { isValidMeetingLink, openMeetingLink } from '../utils/meetingLinks';
import { cleanProjectDescription } from '../utils/projectDescription';
import { DeliverableUploader } from '../components/DeliverableUploader';

const STAGE_LABELS: Record<string, string> = {
    SYNOPSIS: 'Synopsis',
    PROGRESS1: 'Progress 1',
    PROGRESS2: 'Progress 2',
    FINAL: 'Final Submission',
};

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const templateToAttachment = (template: Template): FormAttachment => ({
    attachmentId: template.id,
    fileName: template.name,
    fileUrl: template.fileUrl,
    uploadedAt: template.createdAt,
    source: template.sourceType,
    stage: template.stageId
});

const getStageLabel = (stage?: string) =>
    STAGE_LABELS[String(stage || '').toUpperCase()] || stage || '?';

const stageEndpoint = (stage?: string) => {
    switch (String(stage || '').toUpperCase()) {
        case 'SYNOPSIS': return 'synopsis';
        case 'PROGRESS1': return 'progress1';
        case 'PROGRESS2': return 'progress2';
        case 'FINAL': return 'final';
        default: return null;
    }
};

const getSubmissionStatusLabel = (sub?: any) => {
    const status = String(sub?.status || sub?.teamReviewStatus || 'PENDING').toUpperCase();
    if (status === 'APPROVED') return 'Approved';
    if (status === 'REJECTED' || status === 'REVISION') return 'Team Revision Needed';
    if (status.includes('SUPERVISOR')) return 'Under Supervisor Review';
    return 'Pending Team Approval';
};

const getReviewerLabel = (sub?: any) => {
    const status = String(sub?.status || sub?.teamReviewStatus || 'PENDING').toUpperCase();
    if (status === 'APPROVED') return 'Admin';
    if (status === 'REJECTED' || status === 'REVISION') return 'Team Members';
    if (status.includes('SUPERVISOR')) return 'Supervisor';
    return 'Team Members';
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const parseTeamVotes = (json?: string | null) => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** Compact info cards — no aspect-ratio (avoids grid overlap in narrow columns). */
const compactCardStyle: React.CSSProperties = {
    minHeight: '200px',
    height: '100%',
    minWidth: 0,
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
};

export const StudentProjects: React.FC = () => {
    const { user, isAuthenticated, isInitialized } = useAuthStore();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [project, setProject] = useState<any>(null);
    const [supervisor, setSupervisor] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [supervisorHistory, setSupervisorHistory] = useState<any[]>([]);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [submissionsByStage, setSubmissionsByStage] = useState<Record<string, any[]>>({});
    const [processingReviewId, setProcessingReviewId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // ✅ All hooks must be called unconditionally before any early returns
    const submissionRows = useMemo(
        () =>
            Object.entries(submissionsByStage)
                .flatMap(([ep, subs]) =>
                    (subs || []).map((sub: any) => ({
                        ...sub,
                        _stageKey: ep,
                        _stageLabel: getStageLabel(ep.toUpperCase()),
                    }))
                )
                .sort(
                    (a, b) =>
                        new Date(b.uploadedAt || 0).getTime() -
                        new Date(a.uploadedAt || 0).getTime()
                ),
        [submissionsByStage]
    );

    useEffect(() => {
        if (!isInitialized) {
            return;
        }
        if (!isAuthenticated) {
            navigate('/login');
        } else if (user?.role === 'ADMIN') {
            navigate('/admin/dashboard');
        } else if (user?.role === 'SUPERVISOR') {
            navigate('/supervisor/dashboard');
        } else if (user?.role === 'STUDENT') {
            fetchData();
        }
    }, [isAuthenticated, isInitialized, user?.role, navigate]);

    const fetchData = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            if (!user) return;

            const [teamsRes, membersRes, projectsRes, studentsRes, supervisorsRes] = await Promise.all([
                api.get('/teams').catch(() => ({ data: [] })),
                api.get('/team-members').catch(() => ({ data: [] })),
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] })),
                api.get('/supervisors').catch(() => ({ data: [] }))
            ]);

            const allTeams = teamsRes.data || [];
            const allMembers = membersRes.data || [];
            const allProjects = projectsRes.data || [];
            const allStudents = studentsRes.data || [];
            const allSupervisors = supervisorsRes.data || [];

            let myProject: any = null;
            let myLeader: any = null;
            let mySupervisor: any = null;
            let myMembersGrid: any[] = [];

            for (const tm of allMembers) {
                const joined = JSON.parse(tm.joinMemberArray || '[]');
                const teamInfo = allTeams.find((t: any) => t.teamId === tm.teamId);
                const projInfo = allProjects.find((p: any) => p.teamId === tm.teamId);

                if (!teamInfo || !projInfo) continue;

                if (joined.includes(user.id) || teamInfo.leaderId === user.id) {
                    myProject = { ...projInfo, leaderId: teamInfo.leaderId };
                    myLeader = allStudents.find((s: any) => s.studentId === teamInfo.leaderId);

                    const joinedCards = joined.map((id: string) => {
                        const s = allStudents.find((stu: any) => stu.studentId === id);
                        return { ...s, isLeader: false };
                    }).filter((s: any) => s.studentId !== myLeader?.studentId);

                    myMembersGrid = [{ ...myLeader, isLeader: true }, ...joinedCards];

                    if (projInfo.supervisorId) {
                        mySupervisor = allSupervisors.find((s: any) => s.supervisorId === projInfo.supervisorId);
                    }
                    break;
                }
            }

            setProject(myProject);
            setMembers(myMembersGrid.filter(m => m && m.name));
            setTeamMembers(myMembersGrid.filter((m: any) => m && m.name));
            setSupervisor(mySupervisor);

            if (myProject) {
                const historyRes = await api.get(`/projects/${myProject.projectId}/supervisor-history`).catch(() => ({ data: [] }));
                const enrichedHistory = (historyRes.data || []).map((h: any) => {
                     const oldSup = allSupervisors.find((s:any) => s.supervisorId === h.oldSupervisorId);
                     const newSup = allSupervisors.find((s:any) => s.supervisorId === h.newSupervisorId);
                     return {
                         ...h,
                         oldSupervisorName: oldSup ? oldSup.name : (h.oldSupervisorId || 'None'),
                         newSupervisorName: newSup ? newSup.name : h.newSupervisorId
                     };
                });
                setSupervisorHistory(enrichedHistory);

                const formRes = await api.get(`/forms/${myProject.formId}`).catch(() => ({ data: null }));
                setFormConfig(formRes.data);

                const templatesRes = await api.get(`/templates?form_id=${myProject.formId}`).catch(() => ({ data: [] }));
                setTemplates(templatesRes.data || []);

                const stages = ['synopsis', 'progress1', 'progress2', 'final'];
                const subMap: Record<string, any[]> = {};
                await Promise.all(stages.map(async (stage) => {
                    const res = await api.get(`/submissions/${stage}/document/${myProject.documentId}`).catch(() => ({ data: [] }));
                    subMap[stage] = res.data || [];
                }));
                setSubmissionsByStage(subMap);

                const meetingsRes = await api.get(`/supervisor/meetings/project/${myProject.projectId}`).catch(() => ({ data: [] }));
                setMeetings(meetingsRes.data || []);
            }

        } catch (err) {
            console.error(err);
            setLoadError('We could not load your project data right now.');
        } finally {
            setIsLoading(false);
        }
    };

    // ---------- Early returns only after all hooks ----------
    if (isLoading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
                <Loader size="lg" />
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                    Loading your project workspace...
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', paddingTop: '64px' }}>
                <FolderKanban size={64} style={{ color: 'var(--text-disabled)', margin: '0 auto 24px' }} />
                <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '16px' }}>No Active Project</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    {loadError || 'You have not been formally enrolled in any projects yet or your team has not been finalized.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>Go to Team Formation</Button>
                    <Button variant="outline" onClick={fetchData}>Retry</Button>
                </div>
            </div>
        );
    }

    const referenceFiles = [
        ...parseReferenceFiles(formConfig?.referenceFilesJson),
        ...templates.map(templateToAttachment)
    ];

    const matchesStage = (file: FormAttachment, stage?: string) => {
        const value = (file.stage || 'GENERAL').toUpperCase();
        if (!stage) return value === 'ALL' || value === 'GENERAL';
        return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
    };

    const stageFiles = referenceFiles.filter((file) => matchesStage(file, project?.stageStatus));

    const activeTeamSubmission = submissionRows[0] || null;
    const activeTeamStageEndpoint = activeTeamSubmission?._stageKey;
    const isTeamRevision = ['REJECTED', 'REVISION'].includes(String(activeTeamSubmission?.status || '').toUpperCase());
    const isUnderSupervisor = String(activeTeamSubmission?.status || '').toUpperCase().includes('APPROVED');
    const showPeerApproval = teamMembers.length > 1 && Boolean(activeTeamSubmission && activeTeamStageEndpoint);
    const activeTeamSubmissionId = activeTeamSubmission ? (activeTeamSubmission[`${activeTeamStageEndpoint}Id`] || activeTeamSubmission.id) : null;
    const activeTeamReviewer = activeTeamSubmission?.leaderId || project?.leaderId || 'Team Leader';
    const activeTeamVotes = parseTeamVotes(activeTeamSubmission?.teamReviewJson);
    const myTeamVote = activeTeamVotes.find((vote: any) => vote.reviewerId === user?.id);
    const peerItemTimestamp = myTeamVote?.reviewedAt ? formatDateTime(myTeamVote.reviewedAt) : null;
    const cleanDescription = cleanProjectDescription(project.projectDescription);
    const officialMeetings = meetings.filter((m) => m.sessionId);
    const casualMeetings = meetings.filter((m) => !m.sessionId);
    const isLeader = Boolean(project?.leaderId && user?.id && project.leaderId === user.id);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
                    gap: '24px',
                    alignItems: 'start',
                }}
            >
                {/* Top-left summary + timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
                    <Card elevation={1} style={{ padding: '28px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: '26px', margin: 0, color: 'var(--text-primary)', fontWeight: 800, lineHeight: 1.25 }}>
                                {project.projectTitle}
                            </h2>
                            
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#b45309', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '999px', flexShrink: 0 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                {getStageLabel(project.stageStatus)}
                            </div>
                        </div>

                        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                            {cleanDescription || 'No detailed description provided for this project yet.'}
                        </p>
                        {isLeader && (
                            <Button style={{ width: '100%', marginTop: '12px' }} variant="outline" onClick={() => setIsUploadOpen(true)}>
                                Upload Documents
                            </Button>
                        )}
                    </Card>

                    <ProjectTimeline project={project} hideWhenUnconfigured />

                    <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={18} color="var(--primary)" /> Deliverables Tracking
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Document Name</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>View Deliverable</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Stage</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Submitted At</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Current Reviewer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissionRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '18px', color: 'var(--text-disabled)' }}>No submissions yet.</td>
                                        </tr>
                                    ) : (
                                        submissionRows.map((sub) => (
                                            <tr key={sub._stageKey + (sub[`${sub._stageKey}Id`] || sub.id)} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '12px', fontWeight: 600 }}>{sub.fileName || 'Submission'}</td>
                                                <td style={{ padding: '12px' }}>{sub.fileUrl ? <a href={sub.fileUrl} target="_blank" rel="noreferrer">Open</a> : '?'}</td>
                                                <td style={{ padding: '12px' }}>{sub._stageLabel}</td>
                                                <td style={{ padding: '12px' }}>{new Date(sub.uploadedAt).toLocaleString()}</td>
                                                <td style={{ padding: '12px' }}>{getSubmissionStatusLabel(sub)}</td>
                                                <td style={{ padding: '12px' }}>{getReviewerLabel(sub)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {showPeerApproval && (
                        <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={18} color="var(--primary)" /> Peer Approval
                            </h3>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                                Deliverable uploaded by {activeTeamReviewer} is waiting for peer approval before supervisor review.
                            </div>
                            <div style={{ display: 'grid', gap: '14px' }}>
                                <div style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--surface-hover)' }}>
                                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>{activeTeamSubmission?.fileName || 'Submission'}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Stage: <strong>{activeTeamSubmission?._stageLabel || getStageLabel(project.stageStatus)}</strong>
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        Submitted at: <strong>{formatDateTime(activeTeamSubmission?.uploadedAt)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => activeTeamSubmission?.fileUrl && setPreviewFile({
                                                attachmentId: activeTeamSubmissionId || activeTeamSubmission.fileName || 'submission',
                                                fileName: activeTeamSubmission.fileName || 'Submission',
                                                fileUrl: activeTeamSubmission.fileUrl,
                                            })}
                                            leftIcon={<FileText size={14} />}
                                            >
                                                View Deliverable
                                            </Button>
                                        {myTeamVote ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '999px', backgroundColor: myTeamVote.approved ? '#dcfce7' : '#fee2e2', color: myTeamVote.approved ? '#166534' : '#b91c1c', fontSize: '12px', fontWeight: 700 }}>
                                                {myTeamVote.approved ? 'You accepted this document' : 'You rejected this document'}
                                                {peerItemTimestamp ? ` on ${peerItemTimestamp}` : ''}
                                            </div>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={async () => {
                                                        if (!activeTeamSubmission || !activeTeamSubmissionId || !activeTeamStageEndpoint) return;
                                                        setProcessingReviewId(user?.id || 'vote');
                                                        try {
                                                            await api.patch(
                                                                `/submissions/${activeTeamStageEndpoint}/${activeTeamSubmissionId}/team-review`,
                                                                { reviewerId: user?.id, approved: true, comment: '' }
                                                            );
                                                            fetchData();
                                                        } finally {
                                                            setProcessingReviewId(null);
                                                        }
                                                    }}
                                                    isLoading={processingReviewId === (user?.id || 'vote')}
                                                    leftIcon={<ThumbsUp size={14} />}
                                                >
                                                    ✔ Accept
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={async () => {
                                                        if (!activeTeamSubmission || !activeTeamSubmissionId || !activeTeamStageEndpoint) return;
                                                        setProcessingReviewId(user?.id || 'vote');
                                                        try {
                                                            await api.patch(
                                                                `/submissions/${activeTeamStageEndpoint}/${activeTeamSubmissionId}/team-review`,
                                                                {
                                                                    reviewerId: user?.id,
                                                                    approved: false,
                                                                    comment: 'Changes requested by the team.',
                                                                }
                                                            );
                                                            fetchData();
                                                        } finally {
                                                            setProcessingReviewId(null);
                                                        }
                                                    }}
                                                    isLoading={processingReviewId === (user?.id || 'vote')}
                                                    leftIcon={<ThumbsDown size={14} />}
                                                >
                                                    ✖ Reject
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {isTeamRevision && (
                                <div style={{ marginTop: '12px', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '10px' }}>
                                    Changes requested: Supervisor requested revisions on this document.
                                </div>
                            )}
                            {isUnderSupervisor && (
                                <div style={{ marginTop: '12px', color: '#075985', backgroundColor: '#ecfeff', padding: '12px', borderRadius: '10px' }}>
                                    This deliverable is under supervisor review.
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                {/* Right column: supervisor + compact square cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                    <Card elevation={2} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <User size={16} /> Assigned Supervisor
                        </h3>

                        {supervisor ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                    {(supervisor.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>{supervisor.name}</h4>
                                <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{supervisor.department || supervisor.branch || 'Department'}</p>
                                <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '12px', textAlign: 'left', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-disabled)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Email</span>
                                    {supervisor.mail}
                                </div>
                                <Button style={{ width: '100%', marginTop: '16px' }} onClick={() => navigate('/chat')}>Message Supervisor</Button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-disabled)' }}>
                                <User size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0, fontSize: '13px' }}>No supervisor assigned yet.</p>
                            </div>
                        )}
                    </Card>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gridAutoRows: 'minmax(200px, auto)',
                            gap: '16px',
                            width: '100%',
                            alignItems: 'stretch',
                        }}
                    >
                        {/* Team Members */}
                        <Card elevation={1} style={compactCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={15} color="var(--primary)" /> Team
                                </h3>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{members.length}</span>
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
                                {members.length === 0 && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>No members listed.</div>
                                )}
                                {members.map((member, idx) => (
                                    <div key={member.studentId || idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, backgroundColor: member.isLeader ? 'var(--primary-glow)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', color: member.isLeader ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                            {(member.name || '?').charAt(0)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                    {member.name}{member.studentId === user?.id ? ' (You)' : ''}
                                                </span>
                                                {member.isLeader && (
                                                    <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '8px' }}>LEAD</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <Briefcase size={11} /> {member.isLeader ? 'Coordination' : 'Member'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Supervisor History */}
                        <Card elevation={1} style={compactCardStyle}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <History size={15} color="var(--primary)" /> Supervisor History
                            </h3>
                            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                                {supervisorHistory.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)', textAlign: 'center', paddingTop: '24px' }}>
                                        No changes recorded.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid var(--border-color)', marginLeft: '4px', paddingLeft: '12px' }}>
                                        {supervisorHistory.map((history, idx) => (
                                            <div key={history.id || idx} style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', left: '-18px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', border: '2px solid white' }} />
                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                                    {new Date(history.createdAt).toLocaleDateString()}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{history.oldSupervisorName}</span>
                                                    {' → '}
                                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{history.newSupervisorName}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Official Batch Evaluation */}
                        <Card elevation={1} style={{ ...compactCardStyle, border: '1px solid #bae6fd', backgroundColor: '#f0f9ff' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1', flexShrink: 0 }}>
                                <Calendar size={15} /> Official Eval
                            </h3>
                            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
                                {officialMeetings.length === 0 && (
                                    <div style={{ fontSize: '12px', color: '#0ea5e9', fontStyle: 'italic', textAlign: 'center', paddingTop: '20px' }}>
                                        None scheduled.
                                    </div>
                                )}
                                {officialMeetings.map((meeting) => (
                                    <div key={meeting.meetingId} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #bae6fd', backgroundColor: '#fff' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {meeting.mode === 'ONLINE' ? <Video size={14} /> : <MapPin size={14} />}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                                                    {meeting.stage}
                                                    {meeting.status === 'COMPLETED' && (
                                                        <CheckCircle size={11} color="#16a34a" style={{ display: 'inline', marginLeft: '4px' }} />
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Calendar size={11} />{meeting.meetingDate}</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={11} />{String(meeting.meetingTime || '').substring(0, 5)}</span>
                                                </div>
                                                {meeting.status === 'SCHEDULED' && meeting.mode === 'ONLINE' && (
                                                    isValidMeetingLink(meeting.locationOrLink) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openMeetingLink(meeting.locationOrLink)}
                                                            style={{ marginTop: '6px', border: 'none', background: 'none', color: '#0284c7', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                                        >
                                                            Join GMeet
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>Invalid link</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Internal Casual Meeting */}
                        <Card elevation={1} style={compactCardStyle}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <Video size={15} color="var(--primary)" /> Casual Meetings
                            </h3>
                            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
                                {casualMeetings.length === 0 && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)', textAlign: 'center', paddingTop: '20px' }}>
                                        None scheduled.
                                    </div>
                                )}
                                {casualMeetings.map((meeting) => (
                                    <div key={meeting.meetingId} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: meeting.status === 'COMPLETED' ? '#dcfce7' : 'var(--primary-glow)', color: meeting.status === 'COMPLETED' ? '#16a34a' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {meeting.mode === 'ONLINE' ? <Video size={14} /> : <MapPin size={14} />}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '12px' }}>
                                                    {meeting.stage}
                                                    {meeting.status === 'COMPLETED' && (
                                                        <CheckCircle size={11} color="#16a34a" style={{ display: 'inline', marginLeft: '4px' }} />
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Calendar size={11} />{meeting.meetingDate}</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={11} />{String(meeting.meetingTime || '').substring(0, 5)}</span>
                                                </div>
                                                {meeting.status === 'SCHEDULED' && meeting.mode === 'ONLINE' && (
                                                    isValidMeetingLink(meeting.locationOrLink) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openMeetingLink(meeting.locationOrLink)}
                                                            style={{ marginTop: '6px', border: 'none', background: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                                        >
                                                            Join GMeet
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>Invalid link</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {previewFile && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        zIndex: 50
                    }}
                    onClick={() => setPreviewFile(null)}
                >
                    <div
                        style={{
                            width: 'min(960px, 96vw)',
                            height: 'min(80vh, 720px)',
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600 }}>{previewFile.fileName}</div>
                            <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>
                                Close
                            </Button>
                        </div>
                        <iframe
                            title={previewFile.fileName}
                            src={getPreviewUrl(previewFile.fileUrl)}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                    </div>
                </div>
            )}

            {isUploadOpen && project && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(15, 23, 42, 0.58)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setIsUploadOpen(false)}>
                    <div style={{ width: 'min(860px, 96vw)', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Submit Stage Documents</h2>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Leader-only submission workspace for {project.projectTitle}</div>
                            </div>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Close</Button>
                        </div>
                        <DeliverableUploader
                            projectId={project.projectId}
                            documentId={project.documentId}
                            currentStage={String(project.stageStatus || 'SYNOPSIS')}
                            isLeader={Boolean(isLeader)}
                            onSuccess={fetchData}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentProjects;
