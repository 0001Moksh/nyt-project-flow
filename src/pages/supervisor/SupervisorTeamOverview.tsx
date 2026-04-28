import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { Calendar, Users, MessageSquare, FileText, Star, AlertTriangle, FileCheck, MapPin, Video, CheckCircle, Clock, Paperclip } from 'lucide-react';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { ExecuteMeetingModal } from './ExecuteMeetingModal';
import type { FormAttachment, FormResponse } from '../../services/adminService';
import { getPreviewUrl } from '../../utils/filePreview';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const SupervisorTeamOverview: React.FC = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    
    // Core data
    const [project, setProject] = useState<any>(null);
    const [teamInfo, setTeamInfo] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
    const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);

    // Modal state
    const [isScheduling, setIsScheduling] = useState(false);
    const [executingMeetingId, setExecutingMeetingId] = useState<string | null>(null);
    
    useEffect(() => {
        fetchData();
    }, [teamId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
           const [projRes, teamsRes, stuRes] = await Promise.all([
               api.get('/projects'),
               api.get('/team-members'),
               api.get('/students')
           ]);

           let thisProject = projRes.data.find((p:any) => p.teamId === teamId);
           const thisTeam = teamsRes.data.find((t:any) => t.teamId === teamId);
           setProject(thisProject);
           setTeamInfo(thisTeam);

           // Fetch meetings if project exists
           if (thisProject) {
               api.get(`/supervisor/meetings/project/${thisProject.projectId}`)
                  .then(mRes => setMeetings(mRes.data || []))
                  .catch(console.error);

                    api.get(`/forms/${thisProject.formId}`)
                        .then(fRes => setFormConfig(fRes.data || null))
                        .catch(console.error);
           }

           if (thisTeam && thisTeam.joinMemberArray) {
               const ids = JSON.parse(thisTeam.joinMemberArray);
               const mems = ids.map((id:string, idx:number) => {
                   const s = stuRes.data.find((stu:any) => stu.studentId === id);
                   return { ...s, role: idx === 0 ? 'Leader' : 'Developer' };
               }).filter((x:any) => x.studentId);
               setMembers(mems);
           }
        } catch(err) {
           console.error(err);
        } finally {
           setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;
    
    if (!project) return <div>Project not found.</div>;

    const referenceFiles = parseReferenceFiles(formConfig?.referenceFilesJson);

    const matchesStage = (file: FormAttachment, stage?: string) => {
        const value = (file.stage || 'GENERAL').toUpperCase();
        if (!stage) return value === 'ALL' || value === 'GENERAL';
        return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
    };

    const stageFiles = referenceFiles.filter((file) => matchesStage(file, project?.stageStatus));

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header / Breadcrumb navigation */}
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '-8px' }}>
                <span style={{ cursor:'pointer' }} onClick={() => navigate('/supervisor/dashboard')}>Teams</span> / <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Team Overview</span>
            </div>

            {/* Top Team Hero Card */}
            <Card elevation={1} style={{ padding: '0', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: '#fdfdfd' }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                            <div style={{ width: '32px', height: '32px', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', borderTopColor: 'var(--primary)', transform: 'rotate(45deg)' }}></div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                <h2 style={{ margin: 0, fontSize: '24px' }}>Team Alpha</h2>
                                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e6f4ea', color: '#16a34a', padding: '4px 12px', borderRadius: '12px' }}>APPROVED</span>
                            </div>
                            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)' }}>{project.projectTitle} - Milestone 3</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-disabled)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Started Jan 10, 2026</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {members.length} Members</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Horizontal Button Strip */}
                <div style={{ padding: '12px 24px', backgroundColor: '#eff6ff', borderTop: '1px solid #dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div onClick={() => setIsScheduling(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        <Calendar size={16} /> Schedule Meeting
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button size="sm" style={{ backgroundColor: '#2563eb' }}>View Team</Button>
                        <Button size="sm" variant="outline" style={{ padding: '0 8px', borderColor: '#bfdbfe' }}>...</Button>
                    </div>
                </div>
            </Card>

            {/* Main Content Layout */}
            <div style={{ display: 'flex', gap: '32px' }}>
                
                {/* Visual Tracker Columns */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <ProjectTimeline project={project} />

                    {stageFiles.length > 0 && (
                        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Paperclip size={18} color="var(--primary)" /> Form Reference Files
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

                    {/* Meetings Tracker */}
                    <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Active Meetings</h3>
                            <Button variant="outline" size="sm" onClick={() => setIsScheduling(true)}>+ New Meeting</Button>
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
                                                {meeting.status === 'COMPLETED' && <span style={{ marginLeft: '12px', fontSize: '11px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}><CheckCircle size={10} style={{ display: 'inline', marginRight: '4px' }}/>COMPLETED</span>}
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

                                    {meeting.status === 'SCHEDULED' && (
                                        <Button size="sm" onClick={() => setExecutingMeetingId(meeting.meetingId)}>Evaluate Now</Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                </div>

                {/* Right Panel Layout */}
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Quick Actions */}
                    <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>QUICK ACTIONS</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ padding: '12px 16px', backgroundColor: '#e0e7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#3730a3', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                                <FileText size={16} /> Request Review
                            </div>
                            <div onClick={() => navigate(`/supervisor/submissions/${project.projectId}`)} style={{ padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                                <FileCheck size={16} color="var(--primary)" /> View All Submissions
                            </div>
                            <div onClick={() => navigate(`/supervisor/submissions/${project.projectId}?grade=true`)} style={{ padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                                <Star size={16} color="#eab308" /> Issue Milestone Grade
                            </div>
                            <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#b91c1c', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
                                <AlertTriangle size={16} /> Flag for Review
                            </div>
                        </div>
                    </Card>

                    {/* Team Composition & Group Chat */}
                    <Card elevation={1} style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>TEAM COMPOSITION</h4>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{members.length} Members</span>
                        </div>

                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {members.map((member, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: member.role === 'Leader' ? 'var(--primary-glow)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: member.role === 'Leader' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{member.name}</div>
                                                <div style={{ fontSize: '11px', color: member.role === 'Leader' ? 'var(--primary)' : 'var(--text-disabled)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                    {member.role === 'Leader' ? 'Project LEADER' : 'Dev / UI'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Interactive annotated Group Chat hook */}
                        <div 
                            onClick={() => navigate(`/chat?project=${project.projectId}`)}
                            style={{ padding: '16px', backgroundColor: '#22c55e', color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: '0.2s' }}
                            onMouseOver={(e:any) => e.target.style.backgroundColor = '#16a34a'}
                            onMouseOut={(e:any) => e.target.style.backgroundColor = '#22c55e'}
                        >
                            <MessageSquare size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                            ENTER GROUP CHAT
                        </div>
                    </Card>

                </div>
            </div>

            {isScheduling && (
                <ScheduleMeetingModal 
                    projectId={project.projectId} 
                    onClose={() => setIsScheduling(false)} 
                    onSuccess={() => { setIsScheduling(false); fetchData(); }} 
                />
            )}

            {executingMeetingId && (
                <ExecuteMeetingModal 
                    meetingId={executingMeetingId} 
                    teamMembers={members}
                    onClose={() => setExecutingMeetingId(null)} 
                    onSuccess={() => { setExecutingMeetingId(null); fetchData(); }} 
                />
            )}
        </div>
    );
};

export default SupervisorTeamOverview;
