import React, { useState, useEffect } from 'react';
import { Card, Button, Loader, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Clock, Video, MapPin, Users, ChevronDown, ChevronUp, Link as LinkIcon, Pencil, X, Trash2 } from 'lucide-react';
import { MeetingSchedulerModal } from './MeetingSchedulerModal';

interface MeetingManagementPanelProps {
    formId: string;
}

const toDateInput = (value?: string) => {
    if (!value) return '';
    return String(value).substring(0, 10);
};

const toTimeInput = (value?: string) => {
    if (!value) return '';
    return String(value).substring(0, 5);
};

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
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : 30;
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

    const addToast = useToastStore((state: any) => state.addToast);

    useEffect(() => {
        fetchSessions();
    }, [formId]);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const projectsRes = await api.get('/projects').catch(() => ({ data: [] }));
            const formProjects = (projectsRes.data || []).filter((project: any) => project.formId === formId);
            const projectById = new Map<string, any>(formProjects.map((project: any) => [project.projectId, project]));

            const meetingResponses = await Promise.all(
                formProjects.map((project: any) => api.get(`/supervisor/meetings/project/${project.projectId}`).catch(() => ({ data: [] })))
            );
            // Show all meetings for this form's projects (batch sessions + older slots without sessionId)
            const meetings = meetingResponses.flatMap((response) => response.data || []);

            const grouped = meetings.reduce((acc: Record<string, any>, meeting: any) => {
                // Keep real batch sessions together; otherwise group by stage + mode
                // so rescheduled team slots stay under the same stage card (not one card each).
                const key = meeting.sessionId || `${meeting.stage}|${meeting.mode}`;

                if (!acc[key]) {
                    acc[key] = {
                        sessionId: key,
                        realSessionId: meeting.sessionId || null,
                        stage: meeting.stage,
                        mode: meeting.mode,
                        meetingDate: meeting.meetingDate,
                        sessionStartTime: meeting.meetingTime,
                        sessionEndTime: meeting.endTime || meeting.meetingTime,
                        locationOrLink: meeting.locationOrLink,
                        slots: []
                    };
                }

                const project = projectById.get(meeting.projectId);
                const end = meeting.endTime || addMinutes(meeting.meetingTime, 30);
                acc[key].slots.push({
                    ...meeting,
                    projectTitle: project?.projectTitle,
                    endTime: end
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
                    sessionEndTime: sortedSlots[sortedSlots.length - 1]?.endTime || sortedSlots[sortedSlots.length - 1]?.meetingTime || session.sessionEndTime,
                    locationOrLink: locations.length === 1 ? locations[0] : (locations.length > 1 ? `${locations.length} locations` : session.locationOrLink),
                    slots: sortedSlots
                };
            }).sort((a: any, b: any) => {
                const stageCmp = String(a.stage || '').localeCompare(String(b.stage || ''));
                if (stageCmp !== 0) return stageCmp;
                return String(b.meetingDate).localeCompare(String(a.meetingDate));
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

    const handleExpandSession = (sessionId: string) => {
        setExpandedSession(prev => (prev === sessionId ? null : sessionId));
    };

    const openReschedule = (slot: any) => {
        const start = toTimeInput(slot.meetingTime);
        const end = toTimeInput(slot.endTime) || toTimeInput(addMinutes(slot.meetingTime, 30));
        setRescheduleSlot(slot);
        setRescheduleForm({
            meetingDate: toDateInput(slot.meetingDate),
            meetingTime: start,
            endTime: end,
        });
    };

    const handleRescheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rescheduleSlot) return;
        if (!rescheduleForm.meetingDate || !rescheduleForm.meetingTime) {
            addToast('Date and start time are required', 'error');
            return;
        }

        setSaving(true);
        try {
            const duration = durationMinutes(rescheduleSlot.meetingTime, rescheduleSlot.endTime);
            const endTime = rescheduleForm.endTime
                ? `${rescheduleForm.endTime}:00`.substring(0, 8)
                : addMinutes(`${rescheduleForm.meetingTime}:00`, duration);

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
            if (!err.response?.data?.message) {
                addToast('Failed to reschedule meeting', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSession = async (session: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const slots = sessionSlots[session.sessionId] || session.slots || [];
        const meetingIds = slots.map((s: any) => s.meetingId).filter(Boolean);
        if (meetingIds.length === 0) {
            addToast('No meetings found in this session', 'error');
            return;
        }
        const ok = window.confirm(
            `Delete this ${session.stage} session and all ${meetingIds.length} team slot(s)? This cannot be undone.`
        );
        if (!ok) return;

        setDeletingId(session.sessionId);
        try {
            await api.post('/admin/meetings/delete-batch', { meetingIds });
            addToast('Meeting session deleted', 'success');
            if (expandedSession === session.sessionId) setExpandedSession(null);
            fetchSessions();
        } catch (err: any) {
            if (!err.response?.data?.message) {
                addToast('Failed to delete meeting session', 'error');
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteSlot = async (slot: any) => {
        const ok = window.confirm(
            `Delete meeting for "${slot.projectTitle || slot.projectId}" on ${slot.meetingDate}?`
        );
        if (!ok) return;

        setDeletingId(slot.meetingId);
        try {
            await api.delete(`/admin/meetings/${slot.meetingId}`);
            addToast('Team meeting deleted', 'success');
            fetchSessions();
        } catch (err: any) {
            if (!err.response?.data?.message) {
                addToast('Failed to delete meeting', 'error');
            }
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'50px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Meeting Sessions</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                        Sessions are grouped by stage. Expand to reschedule or remove a specific team slot.
                    </p>
                </div>
                <Button onClick={() => setIsConfigOpen(true)}>Schedule New Session</Button>
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
                                    onClick={() => handleExpandSession(session.sessionId)}
                                >
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: session.mode === 'ONLINE' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: session.mode === 'ONLINE' ? '#3b82f6' : '#16a34a' }}>
                                            {session.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {session.stage} Evaluation
                                                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {session.mode}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {session.meetingDate}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {String(session.sessionStartTime || '').substring(0, 5)} - {String(session.sessionEndTime || '').substring(0, 5)}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {session.slots.length} team(s)</span>
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
                                        <button
                                            type="button"
                                            title="Delete session"
                                            disabled={deletingId === session.sessionId}
                                            onClick={(e) => handleDeleteSession(session, e)}
                                            style={{
                                                width: '34px',
                                                height: '34px',
                                                borderRadius: '8px',
                                                border: '1px solid #fecaca',
                                                backgroundColor: '#fff',
                                                color: '#dc2626',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: deletingId === session.sessionId ? 'wait' : 'pointer',
                                                opacity: deletingId === session.sessionId ? 0.6 : 1,
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                        <div style={{ padding: '4px' }}>
                                            {isExpanded ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '24px', backgroundColor: '#f8fafc' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Team Time Slots ({slots.length})
                                        </h4>

                                        {slots.length === 0 ? (
                                            <Loader size="sm" />
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {slots.map((slot, index) => {
                                                    const customized = slots.some((other: any) =>
                                                        other.meetingId !== slot.meetingId &&
                                                        (other.meetingDate !== slot.meetingDate || other.meetingTime !== slot.meetingTime)
                                                    ) && slots.filter((s: any) => s.meetingDate === slot.meetingDate && s.meetingTime === slot.meetingTime).length === 1;

                                                    return (
                                                        <div key={slot.meetingId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ minWidth: '40px', fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>#{index + 1}</div>
                                                            <div style={{ minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <Calendar size={13} /> {slot.meetingDate}
                                                                    {slot.originalMeetingDate && (
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '999px' }}>
                                                                            RESCHEDULED{slot.rescheduledBy ? ` · ${slot.rescheduledBy}` : ''}
                                                                        </span>
                                                                    )}
                                                                    {!slot.originalMeetingDate && customized && (
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '999px' }}>
                                                                            CUSTOM
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <Clock size={14} color="#3b82f6" />
                                                                    {String(slot.meetingTime || '').substring(0, 5)} - {String(slot.endTime || '').substring(0, 5) || '...'}
                                                                </div>
                                                            </div>
                                                            <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>{slot.projectTitle || `Project ID: ${slot.projectId}`}</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Users size={12} /> Supervisor: {slot.supervisorId}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                {slot.status !== 'COMPLETED' && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        leftIcon={<Pencil size={14} />}
                                                                        onClick={() => openReschedule(slot)}
                                                                    >
                                                                        Reschedule
                                                                    </Button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    title="Delete this team slot"
                                                                    disabled={deletingId === slot.meetingId}
                                                                    onClick={() => handleDeleteSlot(slot)}
                                                                    style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid var(--border-color)',
                                                                        backgroundColor: '#fff',
                                                                        color: '#94a3b8',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: deletingId === slot.meetingId ? 'wait' : 'pointer',
                                                                    }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {isConfigOpen && (
                <MeetingSchedulerModal onClose={() => { setIsConfigOpen(false); fetchSessions(); }} formId={formId} />
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
                            <Input
                                label="Meeting Date"
                                type="date"
                                required
                                value={rescheduleForm.meetingDate}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingDate: e.target.value })}
                            />
                            <Input
                                label="Start Time"
                                type="time"
                                required
                                value={rescheduleForm.meetingTime}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingTime: e.target.value })}
                            />
                            <Input
                                label="End Time"
                                type="time"
                                value={rescheduleForm.endTime}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                                helperText="Optional — if blank, duration of the current slot is kept"
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <Button type="button" variant="outline" onClick={() => setRescheduleSlot(null)}>Cancel</Button>
                                <Button type="submit" variant="primary" disabled={saving}>
                                    {saving ? 'Saving...' : 'Save for this team'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
