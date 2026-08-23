import React, { useState, useEffect } from 'react';
import { Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Video, MapPin, X, Clock, RefreshCw, GripVertical, Coffee, Users, Plus, Mail } from 'lucide-react';
import { isValidMeetingLink, normalizeMeetingLink } from '../../utils/meetingLinks';

interface SequenceItem {
    id: string;
    type: 'PROJECT' | 'BREAK';
    durationMinutes?: number;
    project?: any;
}

interface MeetingSchedulerModalProps {
    formId: string;
    onClose: () => void;
}

export const MeetingSchedulerModal: React.FC<MeetingSchedulerModalProps> = ({ formId, onClose }) => {
    const addToast = useToastStore((state: any) => state.addToast);
    const [isLoading, setIsLoading] = useState(false);
    
    const [stage, setStage] = useState('SYNOPSIS');
    const [stageDate, setStageDate] = useState('');
    const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
    const [guests, setGuests] = useState<string[]>([]);
    const [guestDraft, setGuestDraft] = useState('');
    const [availableSupervisors, setAvailableSupervisors] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        meetingDate: '',
        startTime: '09:00',
        durationMinutes: 15,
        gapMinutes: 5,
        locationOrLink: ''
    });

    const [sequence, setSequence] = useState<SequenceItem[]>([]);
    const [slots, setSlots] = useState<any[]>([]);
    const [existingSlots, setExistingSlots] = useState<any[]>([]);
    
    // Drag and drop state
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    useEffect(() => {
        fetchProjects();
        fetchStageDate();
        api.get('/supervisors').then((res) => setAvailableSupervisors(res.data || [])).catch(() => setAvailableSupervisors([]));
        api.get('/admin/meetings').then((res) => setExistingSlots((res.data || []).filter((m: any) => m.formId === formId && m.stage === stage))).catch(() => setExistingSlots([]));
    }, [formId, stage]);

    const fetchStageDate = async () => {
        try {
            const res = await api.get(`/admin/config/timeline/${formId}`);
            if (res.data) {
                let dateStr = '';
                if (stage === 'SYNOPSIS' && res.data.synopsisDate) dateStr = res.data.synopsisDate;
                if (stage === 'PROGRESS1' && res.data.progress1Date) dateStr = res.data.progress1Date;
                if (stage === 'PROGRESS2' && res.data.progress2Date) dateStr = res.data.progress2Date;
                if (stage === 'FINAL' && res.data.finalSubmissionDate) dateStr = res.data.finalSubmissionDate;
                
                if (dateStr) {
                    const formattedDate = new Date(dateStr).toISOString().split('T')[0];
                    setStageDate(formattedDate);
                    setFormData(prev => ({...prev, meetingDate: formattedDate}));
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (sequence.length > 0) {
            recalculateSlots();
        }
    }, [sequence, formData.startTime, formData.durationMinutes, formData.gapMinutes]);

    const fetchProjects = async () => {
        try {
            const res = await api.get(`/projects`);
            // Removing status === 'approved' strict check as per feedback
            let formProjects = res.data.filter((p: any) => p.formId === formId && p.supervisorId);
            
            // Filter out projects that already have a meeting for this stage
            const meetingResponses = await Promise.all(
                formProjects.map((project: any) => api.get(`/supervisor/meetings/project/${project.projectId}`).catch(() => ({ data: [] })))
            );
            
            const alreadyScheduledProjectIds = new Set();
            meetingResponses.forEach((response, idx) => {
                const projectMeetings = response.data || [];
                const hasMeetingForStage = projectMeetings.some((m: any) => m.stage === stage);
                if (hasMeetingForStage) {
                    alreadyScheduledProjectIds.add(formProjects[idx].projectId);
                }
            });
            
            formProjects = formProjects.filter((p: any) => !alreadyScheduledProjectIds.has(p.projectId));

            const initialSequence = formProjects.map((p: any) => ({
                id: p.projectId,
                type: 'PROJECT' as const,
                project: p
            }));
            
            setSequence(initialSequence);
        } catch (err) {
            console.error(err);
        }
    };

    const addMinutes = (timeStr: string, mins: number) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m, 0);
        date.setMinutes(date.getMinutes() + mins);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const recalculateSlots = () => {
        let currentTime = formData.startTime;
        const newSlots = [];

        for (let i = 0; i < sequence.length; i++) {
            const item = sequence[i];

            if (item.type === 'BREAK') {
                const endTime = addMinutes(currentTime, item.durationMinutes!);
                newSlots.push({
                    type: 'BREAK',
                    id: item.id,
                    durationMinutes: item.durationMinutes,
                    startTime: currentTime,
                    endTime: endTime
                });
                currentTime = endTime;
            } else {
                const endTime = addMinutes(currentTime, formData.durationMinutes);
                newSlots.push({
                    type: 'PROJECT',
                    id: item.id,
                    project: item.project,
                    startTime: currentTime,
                    endTime: endTime
                });
                currentTime = addMinutes(endTime, formData.gapMinutes);
            }
        }
        setSlots(newSlots);
    };

    const overlaps = (startA: string, endA: string, startB: string, endB: string) => {
        const aStart = startA.localeCompare(endB);
        const aEnd = endA.localeCompare(startB);
        return aStart < 0 && aEnd > 0;
    };

    const handleAddBreak = () => {
        const breakDuration = prompt("Enter break duration (minutes)", "30");
        if (breakDuration) {
            const duration = Math.max(5, parseInt(breakDuration) || 30);
            setSequence([...sequence, { id: 'break_' + Date.now(), type: 'BREAK', durationMinutes: duration }]);
        }
    };

    const handleDragStart = (idx: number) => {
        setDraggedIdx(idx);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (idx: number) => {
        if (draggedIdx === null) return;
        
        const newSequence = [...sequence];
        const draggedItem = newSequence[draggedIdx];
        
        newSequence.splice(draggedIdx, 1);
        newSequence.splice(idx, 0, draggedItem);
        
        setSequence(newSequence);
        setDraggedIdx(null);
    };

    const handleSchedule = async () => {
        if (!formData.meetingDate || !formData.startTime || !formData.durationMinutes) {
            return addToast('Please fill all required fields.', 'error');
        }
        if (mode === 'OFFLINE' && !formData.locationOrLink) {
            return addToast('Room / Location is required for OFFLINE mode.', 'error');
        }
        if (mode === 'ONLINE' && !isValidMeetingLink(formData.locationOrLink)) {
            return addToast('Please paste a valid meeting link. Google Meet links must look like https://meet.google.com/abc-defg-hij.', 'error');
        }
        if (slots.length === 0) {
            return addToast('No projects available to schedule.', 'error');
        }
        const projectSlots = slots.filter(s => s.type === 'PROJECT');
        for (let i = 0; i < projectSlots.length; i += 1) {
            for (let j = i + 1; j < projectSlots.length; j += 1) {
                if (overlaps(projectSlots[i].startTime, projectSlots[i].endTime, projectSlots[j].startTime, projectSlots[j].endTime)) {
                    return addToast('Schedule contains overlapping time slots. Please adjust the duration or gap.', 'error');
                }
            }
        }
        if (guests.some((g) => !g.includes('@'))) {
            return addToast('Guest emails must be valid email addresses.', 'error');
        }

        setIsLoading(true);
        try {
            const meetingSlots = slots.filter(s => s.type === 'PROJECT');
            const lastSlot = meetingSlots[meetingSlots.length - 1];
            if (lastSlot && existingSlots.some((slot: any) => slot.meetingDate === formData.meetingDate && overlaps(`${meetingSlots[0].startTime}:00`, `${lastSlot.endTime}:00`, slot.meetingTime, slot.endTime))) {
                return addToast('This schedule overlaps with an existing session on the same date.', 'error');
            }
            const payload = {
                formId,
                stage,
                mode,
                meetingDate: formData.meetingDate,
                sessionStartTime: `${formData.startTime}:00`,
                sessionEndTime: `${(lastSlot?.endTime || formData.startTime)}:00`,
                durationMinutes: formData.durationMinutes,
                locationOrLink: mode === 'ONLINE' ? normalizeMeetingLink(formData.locationOrLink) : formData.locationOrLink.trim(),
                slots: meetingSlots.map((slot) => ({
                    projectId: slot.project.projectId,
                    supervisorId: slot.project.supervisorId,
                    meetingTime: `${slot.startTime}:00`,
                    endTime: `${slot.endTime}:00`,
                })),
                guests,
            };

            await api.post('/admin/meetings/custom-schedule', payload, { timeout: 60000 });
            addToast(`Successfully scheduled meetings for ${stage}! Notifications sent to guests.`, 'success');
            onClose();
        } catch (err: any) {
            console.error(err);
            addToast(err.response?.data?.message || 'Failed to schedule meetings', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: 'white', borderRadius: '12px', width: '1180px', maxWidth: '98vw', height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar color="var(--primary-color)" />
                        Custom Batch Scheduler - {stage}
                    </h2>
                    <X size={20} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>
                
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Left Panel: Config */}
                    <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', padding: '24px', overflowY: 'auto', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                            <button type="button" onClick={() => setMode('ONLINE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: mode === 'ONLINE' ? '2px solid #2563eb' : '1px solid var(--border-color)', backgroundColor: mode === 'ONLINE' ? '#eff6ff' : 'white', color: mode === 'ONLINE' ? '#1d4ed8' : 'var(--text-primary)', cursor: 'pointer' }}>
                                <Video size={16} style={{ display: 'block', margin: '0 auto 4px' }} /> Online
                            </button>
                            <button type="button" onClick={() => setMode('OFFLINE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: mode === 'OFFLINE' ? '2px solid #2563eb' : '1px solid var(--border-color)', backgroundColor: mode === 'OFFLINE' ? '#eff6ff' : 'white', color: mode === 'OFFLINE' ? '#1d4ed8' : 'var(--text-primary)', cursor: 'pointer' }}>
                                <MapPin size={16} style={{ display: 'block', margin: '0 auto 4px' }} /> Offline
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Select Stage</label>
                                <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <option value="SYNOPSIS">Synopsis</option>
                                    <option value="PROGRESS1">Progress 1</option>
                                    <option value="PROGRESS2">Progress 2</option>
                                    <option value="FINAL">Final Submission</option>
                                </select>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Auto-selected from the current batch timeline when available.</div>
                            </div>

                            <Input label="Meeting Date" type="date" value={formData.meetingDate} onChange={(e: any) => setFormData({...formData, meetingDate: e.target.value})} />
                            <Input label="Start Time" type="time" value={formData.startTime} onChange={(e: any) => setFormData({...formData, startTime: e.target.value})} />
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Duration per Team (mins)</label>
                                <input type="number" value={formData.durationMinutes} onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value) || 15})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Gap between meetings (mins)</label>
                                <input type="number" value={formData.gapMinutes} onChange={e => setFormData({...formData, gapMinutes: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                            </div>

                            <Input
                                label={mode === 'ONLINE' ? 'Google Meet Link' : 'Room / Location'}
                                placeholder={mode === 'ONLINE' ? 'https://meet.google.com/abc-defg-hij' : 'Room 402, CS Block'}
                                value={formData.locationOrLink}
                                onChange={(e: any) => setFormData({...formData, locationOrLink: e.target.value})}
                            />

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Add Guests</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input value={guestDraft} onChange={(e) => setGuestDraft(e.target.value)} placeholder="supervisor@college.edu" style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                                    <Button type="button" variant="outline" onClick={() => {
                                        const value = guestDraft.trim().toLowerCase();
                                        if (!value) return;
                                        setGuests((prev) => Array.from(new Set([...prev, value])));
                                        setGuestDraft('');
                                    }}><Plus size={16} /></Button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                    {availableSupervisors.slice(0, 6).map((sup) => (
                                        <button key={sup.supervisorId} type="button" onClick={() => setGuests((prev) => Array.from(new Set([...prev, sup.mail]))) } style={{ border: '1px solid var(--border-color)', background: 'white', borderRadius: 999, padding: '6px 10px', fontSize: '12px' }}>
                                            {sup.name}
                                        </button>
                                    ))}
                                </div>
                                {guests.length > 0 && (
                                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {guests.map((g) => (
                                            <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#1d4ed8', padding: '6px 10px', borderRadius: 999, fontSize: '12px' }}>
                                                <Mail size={12} /> {g}
                                                <button type="button" onClick={() => setGuests((prev) => prev.filter((x) => x !== g))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Bulk Breaks</label>
                                </div>
                                <Button variant="outline" onClick={handleAddBreak} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', fontSize: '13px' }}>
                                    <Coffee size={14} /> Add Break Block
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Visualization */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>Schedule Visualizer</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Drag and drop project or break capsules to reorder slots.</p>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>Total Projects: {sequence.filter(s => s.type === 'PROJECT').length}</div>
                        </div>

                        {/* Chart Area */}
                        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '100px' }}>
                            {slots.map((slot, idx) => (
                                slot.type === 'PROJECT' ? (
                                    <div key={idx} style={{ padding: '8px 12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '8px', border: '1px solid var(--primary-color)', fontSize: '12px', fontWeight: 600 }}>
                                        {slot.startTime} - {slot.endTime} <br />
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{slot.project.projectTitle.substring(0,15)}...</span>
                                    </div>
                                ) : (
                                    <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#FEF3C7', color: '#B45309', borderRadius: '8px', border: '1px solid #F59E0B', fontSize: '12px', fontWeight: 600 }}>
                                        {slot.startTime} - {slot.endTime} <br />
                                        <span style={{ fontSize: '10px', color: '#92400E' }}>Break ({slot.durationMinutes}m)</span>
                                    </div>
                                )
                            ))}
                        </div>

                        {/* Drag and Drop Sequence Capsules */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                            {sequence.map((item, idx) => (
                                <div 
                                    key={item.id}
                                    draggable
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(idx)}
                                    style={{ 
                                        padding: '12px 16px', 
                                        backgroundColor: item.type === 'BREAK' ? '#FFFBEB' : 'white', 
                                        border: item.type === 'BREAK' ? '1px dashed #F59E0B' : '1px solid var(--border-color)', 
                                        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px',
                                        cursor: 'grab', 
                                        boxShadow: draggedIdx === idx ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                                        opacity: draggedIdx === idx ? 0.5 : 1
                                    }}
                                >
                                    <GripVertical size={16} color="var(--text-disabled)" />
                                        <div style={{ width: '100px', fontSize: '13px', fontWeight: 600, color: item.type === 'BREAK' ? '#D97706' : 'var(--primary-color)' }}>
                                            {slots[idx]?.startTime} - {slots[idx]?.endTime}
                                        </div>
                                    <div style={{ flex: 1 }}>
                                        {item.type === 'PROJECT' ? (
                                            <>
                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.project.projectTitle}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Supervisor: {item.project.supervisorId}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Coffee size={16} /> Bulk Break ({item.durationMinutes} mins)
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setSequence(sequence.filter((_, i) => i !== idx))}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: '8px' }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'white' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSchedule} isLoading={isLoading}>Save & Send Invites</Button>
                </div>
            </div>
        </div>
    );
};
