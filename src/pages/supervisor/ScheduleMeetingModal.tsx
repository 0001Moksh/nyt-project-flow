import React, { useState } from 'react';
import { Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { X, Calendar, MapPin, Video } from 'lucide-react';

interface ScheduleMeetingModalProps {
    projectId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({ projectId, onClose, onSuccess }) => {
    const { user } = useAuthStore();
    const addToast = useToastStore((state: any) => state.addToast);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        stage: 'SYNOPSIS',
        meetingDate: '',
        meetingTime: '',
        mode: 'ONLINE',
        locationOrLink: ''
    });

    const handleSave = async () => {
        if (!formData.meetingDate || !formData.meetingTime || !formData.locationOrLink) {
            return addToast('Please fill all fields', 'error');
        }

        setIsLoading(true);
        try {
            await api.post('/supervisor/meetings', {
                projectId,
                supervisorId: user?.id,
                ...formData
            });
            addToast('Meeting Scheduled Successfully', 'success');
            onSuccess();
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Failed to schedule meeting', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '500px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar color="var(--primary)" size={24} /> Schedule Meeting
                    </h2>
                    <X size={24} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Project Stage <span style={{color: 'red'}}>*</span></label>
                        <select 
                            value={formData.stage} 
                            onChange={(e) => setFormData({...formData, stage: e.target.value})}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
                        >
                            <option value="SYNOPSIS">Synopsis</option>
                            <option value="PROGRESS1">Progress 1</option>
                            <option value="PROGRESS2">Progress 2</option>
                            <option value="FINAL">Final Submission</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input label="Date *" type="date" value={formData.meetingDate} onChange={(e: any) => setFormData({...formData, meetingDate: e.target.value})} />
                        <Input label="Time *" type="time" value={formData.meetingTime} onChange={(e: any) => setFormData({...formData, meetingTime: e.target.value})} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Mode <span style={{color: 'red'}}>*</span></label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div 
                                onClick={() => setFormData({...formData, mode: 'ONLINE'})}
                                style={{ flex: 1, padding: '12px', border: `2px solid ${formData.mode === 'ONLINE' ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, backgroundColor: formData.mode === 'ONLINE' ? 'var(--primary-glow)' : 'transparent', color: formData.mode === 'ONLINE' ? 'var(--primary)' : 'var(--text-secondary)' }}
                            >
                                <Video size={18} /> Online
                            </div>
                            <div 
                                onClick={() => setFormData({...formData, mode: 'OFFLINE'})}
                                style={{ flex: 1, padding: '12px', border: `2px solid ${formData.mode === 'OFFLINE' ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, backgroundColor: formData.mode === 'OFFLINE' ? 'var(--primary-glow)' : 'transparent', color: formData.mode === 'OFFLINE' ? 'var(--primary)' : 'var(--text-secondary)' }}
                            >
                                <MapPin size={18} /> Offline
                            </div>
                        </div>
                    </div>

                    <Input 
                        label={formData.mode === 'ONLINE' ? "Meeting Link *" : "Room / Location *"} 
                        placeholder={formData.mode === 'ONLINE' ? "https://meet.google.com/..." : "Room 402, CS Block"}
                        value={formData.locationOrLink} 
                        onChange={(e: any) => setFormData({...formData, locationOrLink: e.target.value})} 
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={isLoading}>Schedule</Button>
                </div>
            </div>
        </div>
    );
};
