import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { CalendarDays, ChevronRight } from 'lucide-react';

interface TimelineConfigModalProps {
    onClose: () => void;
    formId: string;
}

const STAGES = [
    { key: 'SYNOPSIS', label: 'Synopsis', dateKey: 'synopsisDate', reqKey: 'synopsisRequired', modeKey: 'synopsisMode' },
    { key: 'PROGRESS1', label: 'Progress 1', dateKey: 'progress1Date', reqKey: 'progress1Required', modeKey: 'progress1Mode' },
    { key: 'PROGRESS2', label: 'Progress 2', dateKey: 'progress2Date', reqKey: 'progress2Required', modeKey: 'progress2Mode' },
    { key: 'FINAL', label: 'Final Submission', dateKey: 'finalSubmissionDate', reqKey: 'finalRequired', modeKey: 'finalMode' }
];

const todayLocalISO = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const isSunday = (dateStr: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
};

const isPastDate = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr < todayLocalISO();
};

const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const TimelineConfigModal: React.FC<TimelineConfigModalProps> = ({ onClose, formId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedStageKey, setSelectedStageKey] = useState('SYNOPSIS');
    const minDate = useMemo(() => todayLocalISO(), []);

    const [dates, setDates] = useState<any>({
        synopsisDate: '',
        progress1Date: '',
        progress2Date: '',
        finalSubmissionDate: ''
    });

    const [configs, setConfigs] = useState<any>({
        synopsisRequired: 1,
        progress1Required: 1,
        progress2Required: 1,
        finalRequired: 1,
        synopsisMode: '',
        progress1Mode: '',
        progress2Mode: '',
        finalMode: ''
    });

    const addToast = useToastStore((state: any) => state.addToast);

    useEffect(() => {
        if (formId) {
            fetchConfig(formId);
        }
    }, [formId]);

    const fetchConfig = async (id: string) => {
        try {
            const [timeRes, confRes] = await Promise.all([
                api.get(`/admin/config/timeline/${id}`).catch(() => ({ data: null })),
                api.get(`/admin/config/meeting-config/${id}`).catch(() => ({ data: null }))
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
                    finalRequired: confRes.data.finalRequired || 1,
                    synopsisMode: confRes.data.synopsisMode || '',
                    progress1Mode: confRes.data.progress1Mode || '',
                    progress2Mode: confRes.data.progress2Mode || '',
                    finalMode: confRes.data.finalMode || ''
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDateChange = (dateKey: string, value: string) => {
        if (!value) {
            setDates((prev: any) => ({ ...prev, [dateKey]: '' }));
            return;
        }
        if (isPastDate(value)) {
            addToast('Past dates cannot be selected.', 'error');
            return;
        }
        if (isSunday(value)) {
            addToast('Sundays cannot be selected as deadline dates.', 'error');
            return;
        }
        setDates((prev: any) => ({ ...prev, [dateKey]: value }));
    };

    const handleSave = async () => {
        if (!formId) return addToast('Missing form context', 'error');

        for (const stage of STAGES) {
            const value = dates[stage.dateKey];
            if (!value) continue;
            if (isPastDate(value)) {
                addToast(`${stage.label}: past dates are not allowed.`, 'error');
                return;
            }
            if (isSunday(value)) {
                addToast(`${stage.label}: Sundays are not allowed.`, 'error');
                return;
            }
        }

        setIsLoading(true);
        try {
            const timelinePayload = {
                formId,
                synopsisDate: dates.synopsisDate ? new Date(dates.synopsisDate).toISOString() : null,
                progress1Date: dates.progress1Date ? new Date(dates.progress1Date).toISOString() : null,
                progress2Date: dates.progress2Date ? new Date(dates.progress2Date).toISOString() : null,
                finalSubmissionDate: dates.finalSubmissionDate ? new Date(dates.finalSubmissionDate).toISOString() : null
            };

            const configPayload = {
                formId,
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

    const selectedStage = STAGES.find(s => s.key === selectedStageKey)!;
    const stageDate = dates[selectedStage.dateKey];

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#F9FAFB', borderRadius: '16px', width: '1200px', maxWidth: '95vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #E5E7EB' }}>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#111827' }}>Stage Calendar</h2>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Configure stage deadlines and batch-wide meeting parameters.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Button variant="outline" onClick={onClose} style={{ color: '#4B5563' }}>Close</Button>
                        <Button variant="primary" onClick={handleSave} isLoading={isLoading}>Save Changes</Button>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <div style={{ width: '280px', borderRight: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', padding: '24px 16px', overflowY: 'auto' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Stages</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {STAGES.map((stage) => {
                                const isSelected = stage.key === selectedStageKey;
                                const dateLabel = formatDisplayDate(dates[stage.dateKey]);
                                return (
                                    <div
                                        key={stage.key}
                                        onClick={() => setSelectedStageKey(stage.key)}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                                            border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '10px',
                                            backgroundColor: isSelected ? '#3B82F6' : '#F3F4F6',
                                            color: isSelected ? 'white' : '#6B7280',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            <CalendarDays size={18} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#1E3A8A' : '#374151' }}>{stage.label}</div>
                                            <div style={{ fontSize: '12px', marginTop: '4px', color: dateLabel ? '#6B7280' : 'transparent', minHeight: '16px' }}>
                                                {dateLabel || '\u00A0'}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} color={isSelected ? '#3B82F6' : '#9CA3AF'} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', backgroundColor: '#F9FAFB' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, color: '#111827' }}>{selectedStage.label}</h1>
                            <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px', minHeight: '20px' }}>
                                {formatDisplayDate(stageDate) || ''}
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB', marginBottom: '32px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                            <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500, marginBottom: '8px' }}>End Date (Deadline)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                                    <CalendarDays size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Input
                                        type="date"
                                        value={stageDate}
                                        min={minDate}
                                        onChange={(e: any) => handleDateChange(selectedStage.dateKey, e.target.value)}
                                        style={{ width: '100%', maxWidth: '300px' }}
                                    />
                                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
                                        Past dates and Sundays are disabled.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineConfigModal;
