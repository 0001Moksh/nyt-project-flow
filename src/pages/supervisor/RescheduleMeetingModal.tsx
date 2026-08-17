import React, { useState } from 'react';
import { Card, Button, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { X } from 'lucide-react';

interface RescheduleMeetingModalProps {
    meeting: any;
    /** ADMIN uses /admin/meetings, SUPERVISOR uses /supervisor/meetings */
    role: 'ADMIN' | 'SUPERVISOR';
    onClose: () => void;
    onSuccess: () => void;
}

const toDateInput = (value?: string) => (value ? String(value).substring(0, 10) : '');
const toTimeInput = (value?: string) => (value ? String(value).substring(0, 5) : '');

const addMinutes = (timeStr: string, mins: number) => {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h || 0, m || 0, 0, 0);
    date.setMinutes(date.getMinutes() + mins);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:00`;
};

const durationMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 30;
    const [sh, sm] = String(start).substring(0, 5).split(':').map(Number);
    const [eh, em] = String(end).substring(0, 5).split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : 30;
};

export const RescheduleMeetingModal: React.FC<RescheduleMeetingModalProps> = ({
    meeting,
    role,
    onClose,
    onSuccess,
}) => {
    const addToast = useToastStore((s: any) => s.addToast);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        meetingDate: toDateInput(meeting.meetingDate),
        meetingTime: toTimeInput(meeting.meetingTime),
        endTime: toTimeInput(meeting.endTime) || toTimeInput(addMinutes(String(meeting.meetingTime || '09:00'), 30)),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingDate || !form.meetingTime) {
            addToast('Date and start time are required', 'error');
            return;
        }

        setSaving(true);
        try {
            const duration = durationMinutes(meeting.meetingTime, meeting.endTime);
            const endTime = form.endTime
                ? `${form.endTime}:00`.substring(0, 8)
                : addMinutes(`${form.meetingTime}:00`, duration);

            const path = role === 'ADMIN'
                ? `/admin/meetings/${meeting.meetingId}/reschedule`
                : `/supervisor/meetings/${meeting.meetingId}/reschedule`;

            await api.put(path, {
                meetingDate: form.meetingDate,
                meetingTime: `${form.meetingTime}:00`.substring(0, 8),
                endTime,
                rescheduledBy: role,
            });

            addToast('Meeting rescheduled for this team only', 'success');
            onSuccess();
        } catch (err: any) {
            if (!err.response?.data?.message) {
                addToast('Failed to reschedule meeting', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px' }}>
            <Card elevation={2} style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Reschedule Team Meeting</h3>
                    <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={20} />
                    </button>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Change date/time for <strong>{meeting.stage}</strong> only for this team.
                    Other teams in the batch keep their original slots. The new time is visible to this team, the supervisor, and admin.
                </p>
                {meeting.originalMeetingDate && (
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#b45309', backgroundColor: '#fef3c7', padding: '8px 12px', borderRadius: '8px' }}>
                        Original batch slot: {meeting.originalMeetingDate} at {String(meeting.originalMeetingTime || '').substring(0, 5)}
                    </p>
                )}
                <form onSubmit={handleSubmit}>
                    <Input
                        label="Meeting Date"
                        type="date"
                        required
                        value={form.meetingDate}
                        onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                    />
                    <Input
                        label="Start Time"
                        type="time"
                        required
                        value={form.meetingTime}
                        onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
                    />
                    <Input
                        label="End Time"
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        helperText="Optional — keeps current duration if blank"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save for this team'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default RescheduleMeetingModal;
