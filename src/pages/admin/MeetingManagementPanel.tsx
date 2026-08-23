import React, { useEffect, useState } from 'react';
import { Card, Button, Loader, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Clock, Video, MapPin, Users, ChevronDown, ChevronUp, Link as LinkIcon, Pencil, X, Trash2, Copy } from 'lucide-react';
import { MeetingSchedulerModal } from './MeetingSchedulerModal';

interface MeetingManagementPanelProps {
    formId: string;
}

const toDateInput = (value?: string) => (value ? String(value).substring(0, 10) : '');
const toTimeInput = (value?: string) => (value ? String(value).substring(0, 5) : '');

const addMinutes = (timeStr: string, mins: number) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h || 0, m || 0, 0, 0);
    date.setMinutes(date.getMinutes() + mins);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:00`;
};

const durationMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 30;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max((eh * 60 + em) - (sh * 60 + sm), 30);
};

export const MeetingManagementPanel: React.FC<MeetingManagementPanelProps> = ({ formId }) => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [sessionSlots, setSessionSlots] = useState<Record<string, any[]>>({});
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [rescheduleSlot, setRescheduleSlot] = useState<any | null>(null);
    const [rescheduleForm, setRescheduleForm] = useState({ meetingDate: '', meetingTime: '', endTime: '' });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reportOpen, setReportOpen] = useState(false);

    const addToast = useToastStore((state: any) => state.addToast);

    useEffect(() => {
        fetchSessions();
    }, [formId]);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const projectsRes = await api.get('/projects').catch(() => ({ data: [] }));
            const studentsRes = await api.get('/students').catch(() => ({ data: [] }));
            const supervisorsRes = await api.get('/supervisors').catch(() => ({ data: [] }));
            const allStudents = studentsRes.data || [];
            const allSupervisors = supervisorsRes.data || [];
            const formProjects = (projectsRes.data || []).filter((project: any) => project.formId === formId);
            const projectById = new Map<string, any>(formProjects.map((project: any) => [project.projectId, project]));
            const supervisorById = new Map<string, any>(allSupervisors.map((sup: any) => [sup.supervisorId, sup]));

            const meetingResponses = await Promise.all(
                formProjects.map((project: any) => api.get(`/supervisor/meetings/project/${project.projectId}`).catch(() => ({ data: [] })))
            );
            const meetings = meetingResponses.flatMap((response) => response.data || []);

            const grouped = meetings.reduce((acc: Record<string, any>, meeting: any) => {
                const key = meeting.sessionId || `${meeting.stage}|${meeting.mode}`;
                if (!acc[key]) {
                    acc[key] = {
                        sessionId: key,
                        stage: meeting.stage,
                        mode: meeting.mode,
                        meetingDate: meeting.meetingDate,
                        sessionStartTime: meeting.meetingTime,
                        sessionEndTime: meeting.endTime || meeting.meetingTime,
                        locationOrLink: meeting.locationOrLink,
                        slots: [],
                    };
                }
                const project = projectById.get(meeting.projectId);
                const leader = project?.teamId ? allStudents.find((s: any) => s.studentId === project?.leaderId) : null;
                const supervisor = supervisorById.get(project?.supervisorId);
                const end = meeting.endTime || addMinutes(meeting.meetingTime, 30);
                acc[key].slots.push({
                    ...meeting,
                    projectTitle: project?.projectTitle,
                    supervisorName: supervisor?.name || project?.supervisorId || '—',
                    teamLeaderName: leader?.name || '—',
                    endTime: end,
                });
                return acc;
            }, {});

            const nextSessions = Object.values(grouped).map((session: any) => {
                const sortedSlots = session.slots.sort((a: any, b: any) =>
                    `${a.meetingDate || ''} ${a.meetingTime || ''}`.localeCompare(`${b.meetingDate || ''} ${b.meetingTime || ''}`)
                );
                const dates = Array.from(new Set(sortedSlots.map((s: any) => s.meetingDate).filter(Boolean)));
                const locations = Array.from(new Set(sortedSlots.map((s: any) => s.locationOrLink).filter(Boolean)));
                return {
                    ...session,
                    meetingDate: dates.length === 1 ? dates[0] : `${dates.length} dates`,
                    sessionStartTime: sortedSlots[0]?.meetingTime || session.sessionStartTime,
                    sessionEndTime: sortedSlots[sortedSlots.length - 1]?.endTime || session.sessionEndTime,
                    locationOrLink: locations.length === 1 ? locations[0] : (locations.length > 1 ? `${locations.length} locations` : session.locationOrLink),
                    slots: sortedSlots,
                };
            });

            setSessions(nextSessions);
            setSessionSlots(Object.fromEntries(nextSessions.map((session: any) => [session.sessionId, session.slots])));
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch meeting sessions', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const openReschedule = (slot: any) => {
        setRescheduleSlot(slot);
        setRescheduleForm({
            meetingDate: toDateInput(slot.meetingDate),
            meetingTime: toTimeInput(slot.meetingTime),
            endTime: toTimeInput(slot.endTime) || toTimeInput(addMinutes(slot.meetingTime, 30)),
        });
    };

    const handleRescheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rescheduleSlot) return;
        if (!rescheduleForm.meetingDate || !rescheduleForm.meetingTime) {
            addToast('Date and start time are required', 'error');
            return;
        }

        const newStart = `${rescheduleForm.meetingTime}:00`;
        const newEnd = rescheduleForm.endTime ? `${rescheduleForm.endTime}:00` : addMinutes(newStart, durationMinutes(rescheduleSlot.meetingTime, rescheduleSlot.endTime));
        if (newStart >= newEnd) {
            addToast('End time must be after start time.', 'error');
            return;
        }

        const otherSlots = (sessionSlots[rescheduleSlot.sessionId] || []).filter((slot: any) => slot.meetingId !== rescheduleSlot.meetingId && slot.meetingDate === rescheduleForm.meetingDate);
        const hasConflict = otherSlots.some((slot: any) => newStart < slot.endTime && newEnd > slot.meetingTime);
        if (hasConflict) {
            addToast('This reschedule overlaps another team slot.', 'error');
            return;
        }

        setSaving(true);
        try {
            const duration = durationMinutes(rescheduleSlot.meetingTime, rescheduleSlot.endTime);
            const endTime = rescheduleForm.endTime ? `${rescheduleForm.endTime}:00`.substring(0, 8) : addMinutes(`${rescheduleForm.meetingTime}:00`, duration);
            await api.put(`/admin/meetings/${rescheduleSlot.meetingId}/reschedule`, {
                meetingDate: rescheduleForm.meetingDate,
                meetingTime: `${rescheduleForm.meetingTime}:00`.substring(0, 8),
                endTime,
                rescheduledBy: 'ADMIN',
            });
            addToast('Team meeting rescheduled successfully', 'success');
            setRescheduleSlot(null);
            fetchSessions();
        } catch (err: any) {
            if (!err.response?.data?.message) addToast('Failed to reschedule meeting', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSlot = async (slot: any) => {
        const ok = window.confirm(`Delete meeting for "${slot.projectTitle || slot.projectId}" on ${slot.meetingDate}?`);
        if (!ok) return;
        setDeletingId(slot.meetingId);
        try {
            await api.delete(`/admin/meetings/${slot.meetingId}`);
            addToast('Team meeting deleted', 'success');
            fetchSessions();
        } catch (err: any) {
            if (!err.response?.data?.message) addToast('Failed to delete meeting', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const copyMeetingLink = async (value?: string) => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        addToast('Meeting link copied', 'success');
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader size="lg" /></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Meeting Sessions</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="outline" onClick={() => setReportOpen(true)}>Send Meeting Report</Button>
                    <Button onClick={() => setIsConfigOpen(true)}>Schedule New Session</Button>
                </div>
            </div>

            {sessions.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Calendar size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
                    <p>No meeting sessions scheduled yet.</p>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sessions.map(session => {
                        const isExpanded = expandedSession === session.sessionId;
                        const slots = sessionSlots[session.sessionId] || [];
                        return (
                            <Card key={session.sessionId} style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <div
                                    style={{ padding: '20px 24px', backgroundColor: isExpanded ? '#f8fafc' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.2s' }}
                                    onClick={() => setExpandedSession(prev => (prev === session.sessionId ? null : session.sessionId))}
                                >
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: session.mode === 'ONLINE' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: session.mode === 'ONLINE' ? '#3b82f6' : '#16a34a' }}>
                                            {session.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {session.stage} - {session.mode}
                                                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {session.mode}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {session.meetingDate}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {String(session.sessionStartTime || '').substring(0, 5)} - {String(session.sessionEndTime || '').substring(0, 5)}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '15px' }}><Users size={14} /> {session.slots.length} team(s)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {session.locationOrLink && (
                                            <div style={{ padding: '6px 10px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()} title={session.locationOrLink}>
                                                <LinkIcon size={12} />
                                                {session.mode === 'ONLINE' ? 'Meet link' : session.locationOrLink}
                                            </div>
                                        )}
                                        {session.mode === 'ONLINE' && session.locationOrLink && (
                                            <button type="button" title="Copy meeting link" onClick={(e) => { e.stopPropagation(); copyMeetingLink(session.locationOrLink); }} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', cursor: 'pointer' }}>
                                                <Copy size={14} />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            title="Delete session"
                                            disabled={deletingId === session.sessionId}
                                            onClick={(e) => { e.stopPropagation(); const ids = (sessionSlots[session.sessionId] || []).map((s: any) => s.meetingId).filter(Boolean); if (window.confirm(`Delete this ${session.stage} session and all ${ids.length} team slot(s)?`)) { api.post('/admin/meetings/delete-batch', { meetingIds: ids }).then(() => { addToast('Meeting session deleted', 'success'); fetchSessions(); }).catch(() => addToast('Failed to delete meeting session', 'error')); } }}
                                            style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fff', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: deletingId === session.sessionId ? 'wait' : 'pointer', opacity: deletingId === session.sessionId ? 0.6 : 1 }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                        <div style={{ padding: '4px' }}>{isExpanded ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}</div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '24px', backgroundColor: '#f8fafc' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Team Time Slots ({slots.length})
                                        </h4>
                                        {slots.length === 0 ? <Loader size="sm" /> : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '180px 1.2fr 1fr 180px auto', gap: '12px', padding: '0 16px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                    <div>Scheduled Time Slot</div>
                                                    <div>Project Name</div>
                                                    <div>Supervisor Name</div>
                                                    <div>Team Leader Name</div>
                                                    <div />
                                                </div>
                                                {slots.map((slot) => (
                                                    <div key={slot.meetingId} style={{ display: 'grid', gridTemplateColumns: '180px 1.2fr 1fr 180px auto', gap: '12px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
                                                            {slot.meetingDate}<br />
                                                            {String(slot.meetingTime || '').substring(0, 5)} - {String(slot.endTime || '').substring(0, 5) || '...'}
                                                        </div>
                                                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{slot.projectTitle || `Project ID: ${slot.projectId}`}</div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{slot.supervisorName || slot.supervisorId || '—'}</div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{slot.teamLeaderName || '—'}</div>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                            {slot.status !== 'COMPLETED' && <Button size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => openReschedule(slot)}>Reschedule</Button>}
                                                            <button
                                                                type="button"
                                                                title="Delete this team slot"
                                                                disabled={deletingId === slot.meetingId}
                                                                onClick={() => handleDeleteSlot(slot)}
                                                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: deletingId === slot.meetingId ? 'wait' : 'pointer' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {isConfigOpen && <MeetingSchedulerModal onClose={() => { setIsConfigOpen(false); fetchSessions(); }} formId={formId} />}

            {reportOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                    <Card elevation={2} style={{ width: '560px', padding: '24px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Send Meeting Report</h3>
                            <button onClick={() => setReportOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Download the formatted Excel report for this form.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                            <Button variant="outline" onClick={() => setReportOpen(false)}>Close</Button>
                            <Button onClick={async () => {
                                try {
                                    const res = await api.get(`/admin/meetings/report/${formId}`, { responseType: 'blob' });
                                    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `meeting-report-${formId}.xlsx`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    addToast('Meeting report downloaded', 'success');
                                    setReportOpen(false);
                                } catch {
                                    addToast('Failed to download meeting report', 'error');
                                }
                            }}>Download</Button>
                        </div>
                    </Card>
                </div>
            )}

            {rescheduleSlot && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
                    <Card elevation={2} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Reschedule Team Slot</h3>
                            <button onClick={() => setRescheduleSlot(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Change date/time for <strong>{rescheduleSlot.projectTitle || rescheduleSlot.projectId}</strong> only. Other teams in this batch stay unchanged.
                        </p>
                        <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Input label="Meeting Date" type="date" required value={rescheduleForm.meetingDate} onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingDate: e.target.value })} />
                            <Input label="Start Time" type="time" required value={rescheduleForm.meetingTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingTime: e.target.value })} />
                            <Input label="End Time" type="time" value={rescheduleForm.endTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })} helperText="Optional - if blank, duration of the current slot is kept" />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <Button type="button" variant="outline" onClick={() => setRescheduleSlot(null)}>Cancel</Button>
                                <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save for this team'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default MeetingManagementPanel;
