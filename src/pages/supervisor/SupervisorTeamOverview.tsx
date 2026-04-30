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

            let thisProject = projRes.data.find((p: any) => p.teamId === teamId);
            const thisTeam = teamsRes.data.find((t: any) => t.teamId === teamId);

            setProject(thisProject);
            setTeamInfo(thisTeam);

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
                const mems = ids.map((id: string, idx: number) => {
                    const s = stuRes.data.find((stu: any) => stu.studentId === id);
                    return { ...s, role: idx === 0 ? 'Leader' : 'Developer' };
                }).filter((x: any) => x.studentId);
                setMembers(mems);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 20px' }}><Loader size="lg" /></div>;

    if (!project) return <div>Project not found.</div>;

    const referenceFiles = parseReferenceFiles(formConfig?.referenceFilesJson);

    const matchesStage = (file: FormAttachment, stage?: string) => {
        const value = (file.stage || 'GENERAL').toUpperCase();
        if (!stage) return value === 'ALL' || value === 'GENERAL';
        return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
    };

    const stageFiles = referenceFiles.filter((file) => matchesStage(file, project?.stageStatus));

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Top Team Hero Card - Improved */}
            <Card elevation={1} style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ padding: '32px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: '#fdfdfd' }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ width: '72px', height: '72px', backgroundColor: '#0f172a', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.25)', borderRadius: '50%', borderTopColor: 'var(--primary)', transform: 'rotate(45deg)' }}></div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
                                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {project.projectTitle}
                                </h2>
                                <span style={{ fontSize: '12px', fontWeight: 700, backgroundColor: '#e6f4ea', color: '#16a34a', padding: '6px 14px', borderRadius: '9999px' }}>
                                    APPROVED
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={16} /> {members.length} Members
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Main Content Layout */}
            <div style={{ display: 'flex', gap: '40px' }}>

                {/* Left Section - Main Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    <ProjectTimeline project={project} />

                    {/* Form Reference Files */}
                    {stageFiles.length > 0 && (
                        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px' }}>
                            <h3 style={{ margin: '0 0 20px 0', fontSize: '19px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                                <Paperclip size={20} color="var(--primary)" /> Form Reference Files
                            </h3>
                            <div style={{ display: 'grid', gap: '14px' }}>
                                {stageFiles.map((file) => (
                                    <div
                                        key={file.attachmentId}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '16px 18px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-hover)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {file.fileName}
                                                {file.stage && (
                                                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                                                        {file.stage}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
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

                    {/* Official Batch Evaluations */}
                    <Card elevation={1} style={{ border: '1px solid #bae6fd', borderRadius: '16px', backgroundColor: '#f0f9ff', padding: '28px' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '19px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Calendar size={20} /> Official Batch Evaluations
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {meetings.filter(m => m.sessionId).length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#0ea5e9', fontSize: '14.5px' }}>
                                    No official batch evaluations scheduled by Admin yet.
                                </div>
                            )}

                            {meetings.filter(m => m.sessionId).map((meeting) => (
                                <div key={meeting.meetingId} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '20px',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '12px',
                                    backgroundColor: '#ffffff'
                                }}>
                                    {/* ... same meeting content as before ... */}
                                    <div style={{ display: 'flex', gap: '18px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {meeting.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>
                                                {meeting.stage} Review
                                                {meeting.status === 'COMPLETED' && (
                                                    <span style={{ marginLeft: '14px', fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }}>
                                                        <CheckCircle size={12} style={{ marginRight: '4px' }} />COMPLETED
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#0369a1', fontWeight: 500 }}>
                                                <span><Calendar size={15} style={{ marginRight: '6px' }} />{meeting.meetingDate}</span>
                                                <span><Clock size={15} style={{ marginRight: '6px' }} />{meeting.meetingTime}</span>
                                            </div>
                                            {meeting.status === 'COMPLETED' && meeting.conclusionNotes && (
                                                <div style={{ marginTop: '10px', fontSize: '13.5px', color: '#475569', fontStyle: 'italic' }}>
                                                    “{meeting.conclusionNotes}”
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {meeting.status === 'SCHEDULED' && meeting.mode === 'ONLINE' && meeting.locationOrLink && (
                                        <Button size="sm" variant="outline" onClick={() => window.open(meeting.locationOrLink, '_blank')}>
                                            Join Meeting
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Internal / Casual Meetings */}
                    <Card elevation={1} style={{ borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color)' }}>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 600 }}>
                                Internal Meetings
                            </h3>
                            <Button variant="outline" size="sm" onClick={() => setIsScheduling(true)}>
                                + New Meeting
                            </Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                            {meetings.filter(m => !m.sessionId).length === 0 && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    color: 'var(--text-disabled)',
                                    fontSize: '15px'
                                }}>
                                    No internal meetings scheduled yet.
                                </div>
                            )}

                            {meetings.filter(m => !m.sessionId).map((meeting) => (
                                <div
                                    key={meeting.meetingId}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '20px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '14px',
                                        transition: 'all 0.2s ease',
                                        backgroundColor: '#ffffff'

                                    }}
                                >
                                    {/* Left Side - Meeting Info */}
                                    <div style={{ display: 'flex', gap: '18px', flex: 1 }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            backgroundColor: meeting.status === 'COMPLETED' ? '#dcfce7' : 'var(--primary-glow)',
                                            color: meeting.status === 'COMPLETED' ? '#16a34a' : 'var(--primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {meeting.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '16px' }}>
                                                    Stage: {meeting.stage}
                                                </span>
                                                {meeting.status === 'COMPLETED' && (
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: '#16a34a',
                                                        backgroundColor: '#dcfce7',
                                                        padding: '4px 10px',
                                                        borderRadius: '999px',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <CheckCircle size={13} /> COMPLETED
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                gap: '18px',
                                                fontSize: '14.5px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={15} /> {meeting.meetingDate}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={15} /> {meeting.meetingTime}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side - Action Buttons */}
                                    {meeting.status === 'SCHEDULED' && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            flexShrink: 0
                                        }}>
                                            {meeting.mode === 'ONLINE' && meeting.locationOrLink && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => window.open(meeting.locationOrLink, '_blank')}
                                                >
                                                    <Video size={16} style={{ marginRight: '6px' }} />
                                                    Join
                                                </Button>
                                            )}

                                            <Button
                                                size="sm"
                                                onClick={() => setExecutingMeetingId(meeting.meetingId)}
                                            >
                                                Evaluate Now
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                </div>

                {/* Right Sidebar - Improved Spacing */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

                    {/* Quick Actions */}
                    <Card elevation={1} style={{ borderRadius: '16px', padding: '24px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 18px', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                            QUICK ACTIONS
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ padding: '14px 18px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#3730a3', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                <FileText size={18} /> Request Review
                            </div>
                            <div onClick={() => navigate(`/supervisor/submissions/${project.projectId}`)} style={{ padding: '14px 18px', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '14px' }}>
                                <FileCheck size={18} color="var(--primary)" /> View All Submissions
                            </div>
                            <div onClick={() => navigate(`/supervisor/submissions/${project.projectId}?grade=true`)} style={{ padding: '14px 18px', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '14px' }}>
                                <Star size={18} color="#eab308" /> Issue Milestone Grade
                            </div>
                            <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#b91c1c', fontWeight: 500, cursor: 'pointer', marginTop: '6px' }}>
                                <AlertTriangle size={18} /> Flag for Review
                            </div>
                        </div>
                    </Card>

                    {/* Team Composition */}
                    <Card elevation={1} style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fdfdfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                                TEAM COMPOSITION
                            </h4>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>{members.length} Members</span>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {members.map((member, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '50%',
                                            backgroundColor: member.role === 'Leader' ? 'var(--primary-glow)' : 'var(--surface-hover)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            color: member.role === 'Leader' ? 'var(--primary)' : 'var(--text-secondary)'
                                        }}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{member.name}</div>
                                            <div style={{
                                                fontSize: '11.5px',
                                                color: member.role === 'Leader' ? 'var(--primary)' : 'var(--text-disabled)',
                                                fontWeight: 600,
                                                letterSpacing: '0.6px',
                                                textTransform: 'uppercase'
                                            }}>
                                                {member.role === 'Leader' ? 'PROJECT LEADER' : 'TEAM MEMBER'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Group Chat Button */}
                        <div
                            onClick={() => navigate(`/chat?project=${project.projectId}`)}
                            style={{
                                padding: '18px',
                                backgroundColor: '#22c55e',
                                color: 'white',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
                        >
                            <MessageSquare size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            ENTER GROUP CHAT
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modals */}
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

            {/* Preview Modal */}
            {previewFile && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    zIndex: 100
                }} onClick={() => setPreviewFile(null)}>
                    <div style={{
                        width: 'min(1000px, 96vw)',
                        height: 'min(85vh, 760px)',
                        backgroundColor: 'var(--surface)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{previewFile.fileName}</div>
                            <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
                        </div>
                        <iframe
                            title={previewFile.fileName}
                            src={getPreviewUrl(previewFile.fileUrl)}
                            style={{ width: '100%', height: 'calc(100% - 53px)', border: 'none' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupervisorTeamOverview;