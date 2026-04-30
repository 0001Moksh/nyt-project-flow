import React, { useState } from 'react';
import { Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Calendar, Video, MapPin, X } from 'lucide-react';

interface BulkScheduleModalProps {
    formId: string;
    stage: string;
    mode: 'ONLINE' | 'OFFLINE';
    onClose: () => void;
}

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({ formId, stage, mode, onClose }) => {
    const addToast = useToastStore((state: any) => state.addToast);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        meetingDate: '',
        startTime: '09:00',
        durationMinutes: 15,
        locationOrLink: mode === 'OFFLINE' ? '' : 'https://meet.google.com/auto-generated'
    });

    const handleSchedule = async () => {
        if (!formData.meetingDate || !formData.startTime || !formData.durationMinutes) {
            return addToast('Please fill all required fields.', 'error');
        }
        if (mode === 'OFFLINE' && !formData.locationOrLink) {
            return addToast('Room / Location is required for OFFLINE mode.', 'error');
        }

        setIsLoading(true);
        try {
            const payload = {
                formId,
                stage,
                mode,
                meetingDate: formData.meetingDate,
                startTime: formData.startTime + ':00', // appending seconds for LocalTime
                durationMinutes: formData.durationMinutes,
                locationOrLink: mode === 'ONLINE' ? null : formData.locationOrLink // Backend generates Google Meet link if ONLINE
            };
            await api.post('/admin/meetings/bulk-schedule', payload);
            addToast(`Successfully bulk scheduled meetings for ${stage}!`, 'success');
            onClose();
        } catch (err: any) {
            console.error(err);
            addToast(err.response?.data?.message || 'Failed to bulk schedule meetings', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {mode === 'ONLINE' ? <Video color="#3b82f6" /> : <MapPin color="#f59e0b" />}
                        Bulk Schedule {stage}
                    </h2>
                    <X size={20} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    This will automatically create a sequential meeting schedule for all approved teams in this batch.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input 
                        label="Start Date *" 
                        type="date" 
                        value={formData.meetingDate} 
                        onChange={(e: any) => setFormData({...formData, meetingDate: e.target.value})} 
                    />
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input 
                            label="Start Time *" 
                            type="time" 
                            value={formData.startTime} 
                            onChange={(e: any) => setFormData({...formData, startTime: e.target.value})} 
                        />
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Duration per Team (mins) *</label>
                            <input 
                                type="number" 
                                min="5" 
                                value={formData.durationMinutes} 
                                onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value) || 15})} 
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} 
                            />
                        </div>
                    </div>

                    {mode === 'OFFLINE' ? (
                        <Input 
                            label="Room / Location *" 
                            placeholder="e.g., Room 101, CS Block"
                            value={formData.locationOrLink} 
                            onChange={(e: any) => setFormData({...formData, locationOrLink: e.target.value})} 
                        />
                    ) : (
                        <div style={{ padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Video size={16} /> Google Meet links will be automatically generated.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSchedule} isLoading={isLoading}>Generate Schedule</Button>
                </div>
            </div>
        </div>
    );
};
