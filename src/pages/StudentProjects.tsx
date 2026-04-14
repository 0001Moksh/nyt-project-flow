import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader } from '../components';
import { useNavigate } from 'react-router-dom';
import { Check, X, Bell, Users, CheckCircle, Info, Star, ChevronRight, User, Briefcase, Hash, FolderKanban, History, Paperclip } from 'lucide-react';
import { api } from '../services/api';
import type { FormAttachment, FormResponse } from '../services/adminService';
import { getPreviewUrl } from '../utils/filePreview';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const StudentProjects: React.FC = () => {
    const { user, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [project, setProject] = useState<any>(null);
    const [supervisor, setSupervisor] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [leader, setLeader] = useState<any>(null);
    const [supervisorHistory, setSupervisorHistory] = useState<any[]>([]);
    const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
    const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);

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
                    myProject = projInfo;
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
            setLeader(myLeader);
            setMembers(myMembersGrid.filter(m => m && m.name));
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
            }

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><Loader size="lg" /></div>;

    if (!project) {
        return (
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', paddingTop: '64px' }}>
                <FolderKanban size={64} style={{ color: 'var(--text-disabled)', margin: '0 auto 24px' }} />
                <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '16px' }}>No Active Project</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>You have not been formally enrolled in any projects yet or your team has not been finalized.</p>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>Go to Team Formation</Button>
            </div>
        );
    }

    const referenceFiles = parseReferenceFiles(formConfig?.referenceFilesJson);

    const matchesStage = (file: FormAttachment, stage?: string) => {
        const value = (file.stage || 'GENERAL').toUpperCase();
        if (!stage) return value === 'ALL' || value === 'GENERAL';
        return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
    };

    const stageFiles = referenceFiles.filter((file) => matchesStage(file, project?.stageStatus));

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>My Project</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                        View your current project details, progress, and team assignments.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                
                {/* Main Project Details Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Project Header Card */}
                    <Card elevation={1} style={{ padding: '32px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                FINAL YEAR PROJECT
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#16a34a' }}>
                                <CheckCircle size={18} /> Approved
                            </div>
                        </div>
                        
                        <h2 style={{ fontSize: '28px', margin: '0 0 16px', color: 'var(--text-primary)', fontWeight: 800 }}>{project.projectTitle}</h2>
                        
                        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                            {project.projectDescription || "No detailed description provided for this project yet. Please update the project details to provide a comprehensive overview of the objectives and methodology."}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                            <div style={{ flex: 1 }}>
                                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-disabled)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Current Stage</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600, color: '#d97706' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                                    Synopsis Phase Mode
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-disabled)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Project ID</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
                                    <Hash size={16} color="var(--text-disabled)" />
                                    {project.projectId.substring(0, 8)}...
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Team Members Breakdown */}
                    <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={20} color="var(--primary)" /> Team Members
                            </h3>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{members.length} Members</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {members.map((member, idx) => (
                                <div key={idx} style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: idx !== members.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: member.isLeader ? 'var(--primary-glow)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: member.isLeader ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                                                    {member.name} {member.studentId === user?.id ? '(You)' : ''}
                                                </div>
                                                {member.isLeader && (
                                                    <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px' }}>TEAM LEADER</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                {member.branch || 'Computer Science'} • {member.mail}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Briefcase size={14} color="var(--text-disabled)" /> 
                                                <span style={{ fontStyle: 'italic' }}>{member.isLeader ? 'Project Architecture & Coordination' : 'Development & Research (Assigned)'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Supervisor History Log */}
                    <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <History size={20} color="var(--primary)" /> Supervisor History
                        </h3>
                        {supervisorHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>
                                <p style={{ margin: 0 }}>No past supervisor changes recorded.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', marginLeft: '8px', paddingLeft: '16px' }}>
                                {supervisorHistory.map((history, idx) => (
                                    <div key={history.id || idx} style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '0', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)', border: '2px solid white' }}></div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            {new Date(history.createdAt).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Assignment Changed
                                        </div>
                                        <div style={{ fontSize: '14px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                                            <span style={{ textDecoration: 'line-through', color: 'var(--danger)', marginRight: '8px' }}>{history.oldSupervisorName}</span>
                                            ➔ <span style={{ color: 'var(--success)', marginLeft: '8px', fontWeight: 600 }}>{history.newSupervisorName}</span>
                                        </div>
                                        {history.reason && (
                                            <div style={{ marginTop: '8px', fontSize: '13px', fontStyle: 'italic', backgroundColor: 'var(--surface-hover)', padding: '8px 12px', borderRadius: '4px', borderLeft: '2px solid var(--warning)' }}>
                                                " {history.reason} "
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {stageFiles.length > 0 && (
                        <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Paperclip size={20} color="var(--primary)" /> Reference Files
                            </h3>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {stageFiles.map((file) => (
                                    <div
                                        key={file.attachmentId}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-hover)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {file.fileName}
                                                {file.stage && (
                                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                                                        {file.stage}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'Recently uploaded'}
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                                            Preview
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

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
                </div>
                {/* Right Sidebar Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Supervisor Card */}
                    <Card elevation={2} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
                        <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <User size={18} /> Assigned Supervisor
                        </h3>
                        
                        {supervisor ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', marginBottom: '16px', border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                    {supervisor.name.charAt(0).toUpperCase()}
                                </div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>{supervisor.name}</h4>
                                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{supervisor.department || 'Computer Science'} Department</p>
                                
                                <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '13px' }}>
                                        <span style={{ color: 'var(--text-disabled)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Email Contact</span>
                                        {supervisor.mail}
                                    </div>
                                    <div style={{ fontSize: '13px' }}>
                                        <span style={{ color: 'var(--text-disabled)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Phone</span>
                                        {supervisor.phoneNumber || 'N/A'}
                                    </div>
                                </div>
                                
                                <Button style={{ width: '100%', marginTop: '24px' }} onClick={() => navigate('/chat')}>Message Supervisor</Button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-disabled)' }}>
                                <User size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>No supervisor assigned yet.<br/>Your project is pending review.</p>
                            </div>
                        )}
                    </Card>

                    {/* Upcoming Deadlines / Progress Widget */}
                    <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#0f172a', color: 'white' }}>
                        <h4 style={{ margin: '0 0 24px', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: '#94a3b8' }}>NEXT MILESTONE</h4>
                        
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Synopsis Submission</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>Due in 14 days</p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.5 }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #22c55e', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="white" /></div>
                                <span style={{ fontSize: '13px', textDecoration: 'line-through' }}>Team Formation</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.5 }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #22c55e', backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="white" /></div>
                                <span style={{ fontSize: '13px', textDecoration: 'line-through' }}>Topic Approval</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #3b82f6', backgroundColor: 'transparent' }}></div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>Draft Synopsis</span>
                            </div>
                        </div>
                    </Card>

                </div>
            </div>

        </div>
    );
};

export default StudentProjects;
