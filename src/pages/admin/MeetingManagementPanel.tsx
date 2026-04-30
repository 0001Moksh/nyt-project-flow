import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Clock, Video, MapPin, Users, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';
import { MeetingSchedulerModal } from './MeetingSchedulerModal';

interface MeetingManagementPanelProps {
    formId: string;
}

export const MeetingManagementPanel: React.FC<MeetingManagementPanelProps> = ({ formId }) => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [sessionSlots, setSessionSlots] = useState<Record<string, any[]>>({});
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const addToast = useToastStore((state: any) => state.addToast);

    useEffect(() => {
        fetchSessions();
    }, [formId]);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/admin/meetings/sessions/${formId}`);
            setSessions(res.data || []);
        } catch (err) {
            console.error(err);
            addToast('Failed to fetch meeting sessions', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExpandSession = async (sessionId: string) => {
        if (expandedSession === sessionId) {
            setExpandedSession(null);
            return;
        }

        setExpandedSession(sessionId);
        
        if (!sessionSlots[sessionId]) {
            try {
                const res = await api.get(`/admin/meetings/sessions/${sessionId}/slots`);
                setSessionSlots(prev => ({ ...prev, [sessionId]: res.data || [] }));
            } catch (err) {
                console.error(err);
                addToast('Failed to fetch session slots', 'error');
            }
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'50px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Meeting Sessions</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Manage batch evaluations and scheduled meeting slots.</p>
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
                                {/* Session Header */}
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
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {session.sessionStartTime} - {session.sessionEndTime}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {session.durationPerTeam}m / team</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {session.locationOrLink && (
                                            <div style={{ padding: '8px 12px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                                <LinkIcon size={12} />
                                                {session.mode === 'ONLINE' ? 'Global Meet Link Ready' : session.locationOrLink}
                                            </div>
                                        )}
                                        <div style={{ padding: '8px' }}>
                                            {isExpanded ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Slots View */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '24px', backgroundColor: '#f8fafc' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Sequential Time Slots ({slots.length} Teams)
                                        </h4>
                                        
                                        {slots.length === 0 ? (
                                            <Loader size="sm" />
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {slots.map((slot, index) => (
                                                    <div key={slot.meetingId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ minWidth: '40px', fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>#{index + 1}</div>
                                                        <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Clock size={14} color="#3b82f6" />
                                                                {slot.meetingTime.substring(0, 5)} - {slot.endTime ? slot.endTime.substring(0, 5) : '...'}
                                                            </div>
                                                        </div>
                                                        <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>Project ID: {slot.projectId}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Users size={12} /> Supervisor ID: {slot.supervisorId}
                                                            </div>
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

            {isConfigOpen && (
                <MeetingSchedulerModal onClose={() => { setIsConfigOpen(false); fetchSessions(); }} formId={formId} />
            )}
        </div>
    );
};
