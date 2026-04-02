import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Clock, Users, X, AlertTriangle } from 'lucide-react';

interface TimelineConfigModalProps {
    onClose: () => void;
    forms: any[];
}

export const TimelineConfigModal: React.FC<TimelineConfigModalProps> = ({ onClose, forms }) => {
    const [selectedFormId, setSelectedFormId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [dates, setDates] = useState({
        synopsisDate: '',
        progress1Date: '',
        progress2Date: '',
        finalSubmissionDate: ''
    });

    const [configs, setConfigs] = useState({
        synopsisRequired: 1,
        progress1Required: 1,
        progress2Required: 1,
        finalRequired: 1
    });

    const addToast = useToastStore((state: any) => state.addToast);

    useEffect(() => {
        if (selectedFormId) {
            fetchConfig(selectedFormId);
        } else {
            setDates({ synopsisDate: '', progress1Date: '', progress2Date: '', finalSubmissionDate: '' });
            setConfigs({ synopsisRequired: 1, progress1Required: 1, progress2Required: 1, finalRequired: 1 });
        }
    }, [selectedFormId]);

    const fetchConfig = async (formId: string) => {
        try {
            const [timeRes, confRes] = await Promise.all([
                api.get(`/admin/config/timeline/${formId}`).catch(() => ({ data: null })),
                api.get(`/admin/config/meeting-config/${formId}`).catch(() => ({ data: null }))
            ]);

            if (timeRes.data) {
                setDates({
                    synopsisDate: timeRes.data.synopsisDate ? new Date(timeRes.data.synopsisDate).toISOString().split('T')[0] : '',
                    progress1Date: timeRes.data.progress1Date ? new Date(timeRes.data.progress1Date).toISOString().split('T')[0] : '',
                    progress2Date: timeRes.data.progress2Date ? new Date(timeRes.data.progress2Date).toISOString().split('T')[0] : '',
                    finalSubmissionDate: timeRes.data.finalSubmissionDate ? new Date(timeRes.data.finalSubmissionDate).toISOString().split('T')[0] : ''
                });
            }

            if (confRes.data) {
                setConfigs({
                    synopsisRequired: confRes.data.synopsisRequired || 1,
                    progress1Required: confRes.data.progress1Required || 1,
                    progress2Required: confRes.data.progress2Required || 1,
                    finalRequired: confRes.data.finalRequired || 1
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!selectedFormId) return addToast('Please select a batch/form first', 'error');

        setIsLoading(true);
        try {
            // Convert local dates to ISODate strings
            const timelinePayload = {
                formId: selectedFormId,
                synopsisDate: dates.synopsisDate ? new Date(dates.synopsisDate).toISOString() : null,
                progress1Date: dates.progress1Date ? new Date(dates.progress1Date).toISOString() : null,
                progress2Date: dates.progress2Date ? new Date(dates.progress2Date).toISOString() : null,
                finalSubmissionDate: dates.finalSubmissionDate ? new Date(dates.finalSubmissionDate).toISOString() : null
            };

            const configPayload = {
                formId: selectedFormId,
                ...configs
            };

            await Promise.all([
                api.post('/admin/config/timeline', timelinePayload),
                api.post('/admin/config/meeting-config', configPayload)
            ]);

            addToast('Timeline & Meeting Configuration Saved! Users have been notified.', 'success');
            onClose();
        } catch (err: any) {
            addToast('Failed to save configuration', 'error');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock color="var(--primary)" size={24} /> Manage Deadlines & Meetings
                    </h2>
                    <X size={24} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Target Project Batch (Form) <span style={{color: 'red'}}>*</span></label>
                    <select 
                        value={selectedFormId} 
                        onChange={(e) => setSelectedFormId(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
                    >
                        <option value="">-- Select a Form / Batch --</option>
                        {forms.map(f => (
                            <option key={f.formId} value={f.formId}>{f.accessBranch} ({f.accessBatch})</option>
                        ))}
                    </select>
                </div>

                {selectedFormId && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            {/* 1. SYNOPSIS */}
                            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Synopsis Stage</h4>
                                <Input label="Deadline Date" type="date" value={dates.synopsisDate} onChange={(e: any) => setDates({...dates, synopsisDate: e.target.value})} />
                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Req. Meetings</label>
                                    <input type="number" min="0" value={configs.synopsisRequired} onChange={e => setConfigs({...configs, synopsisRequired: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                </div>
                            </div>

                            {/* 2. PROGRESS 1 */}
                            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Progress 1 Stage</h4>
                                <Input label="Deadline Date" type="date" value={dates.progress1Date} onChange={(e: any) => setDates({...dates, progress1Date: e.target.value})} />
                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Req. Meetings</label>
                                    <input type="number" min="0" value={configs.progress1Required} onChange={e => setConfigs({...configs, progress1Required: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                </div>
                            </div>

                            {/* 3. PROGRESS 2 */}
                            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Progress 2 Stage</h4>
                                <Input label="Deadline Date" type="date" value={dates.progress2Date} onChange={(e: any) => setDates({...dates, progress2Date: e.target.value})} />
                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Req. Meetings</label>
                                    <input type="number" min="0" value={configs.progress2Required} onChange={e => setConfigs({...configs, progress2Required: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                </div>
                            </div>

                            {/* 4. FINAL */}
                            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Final Submission</h4>
                                <Input label="Deadline Date" type="date" value={dates.finalSubmissionDate} onChange={(e: any) => setDates({...dates, finalSubmissionDate: e.target.value})} />
                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Req. Meetings</label>
                                    <input type="number" min="0" value={configs.finalRequired} onChange={e => setConfigs({...configs, finalRequired: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={isLoading} disabled={!selectedFormId}>Save Deadlines</Button>
                </div>
            </div>
        </div>
    );
};
