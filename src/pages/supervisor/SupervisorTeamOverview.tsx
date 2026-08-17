import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, ProjectTimeline, ReferenceTemplatesCard } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { Calendar, Users, MessageSquare, FileText, Star, AlertTriangle, FileCheck, MapPin, Video, CheckCircle, Clock, Paperclip, Pencil } from 'lucide-react';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { ExecuteMeetingModal } from './ExecuteMeetingModal';
import { RescheduleMeetingModal } from './RescheduleMeetingModal';
import type { FormAttachment, FormResponse } from '../../services/adminService';
import { getPreviewUrl } from '../../utils/filePreview';
import { isValidMeetingLink, openMeetingLink } from '../../utils/meetingLinks';

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
    const [rescheduleMeeting, setRescheduleMeeting] = useState<any | null>(null);

    useEffect(() => {
        fetchData();
    }, [teamId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projRes, teamsRes, teamMembersRes, stuRes] = await Promise.all([
                api.get('/projects'),
                api.get('/teams'),
                api.get('/team-members'),
                api.get('/students')
            ]);

            // Support both teamId and accidental projectId in the route param
            let thisProject = (projRes.data || []).find((p: any) => p.teamId === teamId)
                || (projRes.data || []).find((p: any) => p.projectId === teamId);
            const thisTeam = (teamsRes.data || []).find((t: any) => t.teamId === (thisProject?.teamId || teamId));
            const thisTeamMembers = (teamMembersRes.data || []).find((t: any) => t.teamId === (thisProject?.teamId || teamId));

            setProject(thisProject || null);
            setTeamInfo(thisTeam || thisTeamMembers || null);

            if (thisProject?.projectId) {
                try {
                    const mRes = await api.get(`/supervisor/meetings/project/${thisProject.projectId}`);
                    setMeetings(mRes.data || []);
                } catch (err) {
                    console.error(err);
                    setMeetings([]);
                }

                try {
                    const fRes = await api.get(`/forms/${thisProject.formId}`);
                    setFormConfig(fRes.data || null);
                } catch (err) {
                    console.error(err);
                }
            } else {
                setMeetings([]);
            }

            const memberIds: string[] = [];
            if (thisTeam?.leaderId) memberIds.push(thisTeam.leaderId);
            try {
                const invited = JSON.parse(thisTeam?.teamMemberArray || '[]');
                if (Array.isArray(invited)) memberIds.push(...invited);
            } catch { /* ignore */ }
            try {
                const joined = JSON.parse(thisTeamMembers?.joinMemberArray || '[]');
                if (Array.isArray(joined)) memberIds.push(...joined);
            } catch { /* ignore */ }

            const uniqueIds = Array.from(new Set(memberIds));
            const mems = uniqueIds.map((id: string, idx: number) => {
                const s = (stuRes.data || []).find((stu: any) => stu.studentId === id);
                return { ...s, role: id === thisTeam?.leaderId || idx === 0 ? 'Leader' : 'Developer' };
            }).filter((x: any) => x.studentId);
            setMembers(mems);
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

                    <ReferenceTemplatesCard formId={project?.formId} currentStage={project?.stageStatus} title="Form Reference Templates" />

                    {/* Official / Project Meetings — includes batch slots + per-team reschedules for THIS project only */}
                    <Card elevation={1} style={{ border: '1px solid #bae6fd', borderRadius: '16px', backgroundColor: '#f0f9ff', padding: '28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '19px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Calendar size={20} /> Project Meetings
                            </h3>
                            <Button variant="outline" size="sm" onClick={() => setIsScheduling(true)}>
                                + New Meeting
                            </Button>
                        </div>
                        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#0369a1' }}>
                            Batch schedules from admin appear here. Reschedule applies only to this team — other teams keep their slots.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {meetings.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#0ea5e9', fontSize: '14.5px' }}>
                                    No meetings scheduled for this project yet.
                                </div>
                            )}

                            {meetings.map((meeting) => (
                                <div key={meeting.meetingId} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '20px',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '12px',
                                    backgroundColor: '#ffffff',
                                    gap: '16px',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ display: 'flex', gap: '18px', flex: 1 }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: meeting.status === 'COMPLETED' ? '#dcfce7' : '#e0f2fe', color: meeting.status === 'COMPLETED' ? '#16a34a' : '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {meeting.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                {meeting.stage} Review
                                                {meeting.sessionId && (
                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '999px' }}>BATCH</span>
                                                )}
                                                {meeting.originalMeetingDate && (
                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '999px' }}>
                                                        RESCHEDULED{meeting.rescheduledBy ? ` · ${meeting.rescheduledBy}` : ''}
                                                    </span>
                                                )}
                                                {meeting.status === 'COMPLETED' && (
                                                    <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }}>
                                                        <CheckCircle size={12} style={{ marginRight: '4px' }} />COMPLETED
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#0369a1', fontWeight: 500, flexWrap: 'wrap' }}>
                                                <span><Calendar size={15} style={{ marginRight: '6px' }} />{meeting.meetingDate}</span>
                                                <span><Clock size={15} style={{ marginRight: '6px' }} />{String(meeting.meetingTime || '').substring(0, 5)}{meeting.endTime ? ` - ${String(meeting.endTime).substring(0, 5)}` : ''}</span>
                                            </div>
                                            {meeting.originalMeetingDate && (
                                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                                                    Original batch slot: {meeting.originalMeetingDate} at {String(meeting.originalMeetingTime || '').substring(0, 5)}
                                                </div>
                                            )}
                                            {meeting.status === 'COMPLETED' && meeting.conclusionNotes && (
                                                <div style={{ marginTop: '10px', fontSize: '13.5px', color: '#475569', fontStyle: 'italic' }}>
                                                    “{meeting.conclusionNotes}”
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {meeting.status === 'SCHEDULED' && (
                                        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                                            {meeting.mode === 'ONLINE' && (
                                                isValidMeetingLink(meeting.locationOrLink) ? (
                                                    <Button size="sm" variant="outline" onClick={() => openMeetingLink(meeting.locationOrLink)}>
                                                        Join Meeting
                                                    </Button>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>Invalid meeting link</span>
                                                )
                                            )}
                                            <Button size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => setRescheduleMeeting(meeting)}>
                                                Reschedule
                                            </Button>
                                            <Button size="sm" onClick={() => setExecutingMeetingId(meeting.meetingId)}>
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

            {rescheduleMeeting && (
                <RescheduleMeetingModal
                    meeting={rescheduleMeeting}
                    role="SUPERVISOR"
                    onClose={() => setRescheduleMeeting(null)}
                    onSuccess={() => { setRescheduleMeeting(null); fetchData(); }}
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
