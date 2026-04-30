import React, { useState, useEffect } from 'react';
import { Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Video, MapPin, X, Clock, RefreshCw, GripVertical, Coffee } from 'lucide-react';

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
    const [formData, setFormData] = useState({
        meetingDate: '',
        startTime: '09:00',
        durationMinutes: 15,
        gapMinutes: 5,
        locationOrLink: ''
    });

    const [sequence, setSequence] = useState<SequenceItem[]>([]);
    const [slots, setSlots] = useState<any[]>([]);
    
    // Drag and drop state
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    useEffect(() => {
        fetchProjects();
        fetchStageDate();
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
            const formProjects = res.data.filter((p: any) => p.formId === formId && p.supervisorId);
            
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

    const handleAddBreak = () => {
        const breakDuration = prompt("Enter break duration (minutes)", "30");
        if (breakDuration) {
            setSequence([...sequence, { 
                id: 'break_' + Date.now(), 
                type: 'BREAK', 
                durationMinutes: parseInt(breakDuration) 
            }]);
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
        if (slots.length === 0) {
            return addToast('No approved projects to schedule.', 'error');
        }

        setIsLoading(true);
        try {
            const sessionStartTime = slots[0].startTime + ':00';
            const sessionEndTime = slots[slots.length - 1].endTime + ':00';

            const payload = {
                formId,
                stage,
                mode,
                meetingDate: formData.meetingDate,
                sessionStartTime,
                sessionEndTime,
                durationMinutes: formData.durationMinutes,
                locationOrLink: mode === 'ONLINE' ? null : formData.locationOrLink,
                slots: slots.filter(s => s.type === 'PROJECT').map(s => ({
                    projectId: s.project.projectId,
                    supervisorId: s.project.supervisorId,
                    meetingTime: s.startTime + ':00',
                    endTime: s.endTime + ':00'
                }))
            };

            await api.post('/admin/meetings/custom-schedule', payload);
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
            <div style={{ background: 'white', borderRadius: '12px', width: '1000px', maxWidth: '95vw', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                
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
                            <button onClick={() => setMode('ONLINE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: mode === 'ONLINE' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', backgroundColor: mode === 'ONLINE' ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}>
                                <Video size={16} style={{ display: 'block', margin: '0 auto 4px' }} /> Online
                            </button>
                            <button onClick={() => setMode('OFFLINE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: mode === 'OFFLINE' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', backgroundColor: mode === 'OFFLINE' ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}>
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

                            {mode === 'OFFLINE' && (
                                <Input label="Room / Location" value={formData.locationOrLink} onChange={(e: any) => setFormData({...formData, locationOrLink: e.target.value})} />
                            )}

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
