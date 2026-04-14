import React, { useState } from 'react';
import { Button } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ExecuteMeetingModalProps {
    meetingId: string;
    teamMembers: any[];
    onClose: () => void;
    onSuccess: () => void;
}

export const ExecuteMeetingModal: React.FC<ExecuteMeetingModalProps> = ({ meetingId, teamMembers, onClose, onSuccess }) => {
    const addToast = useToastStore((state: any) => state.addToast);
    const [isLoading, setIsLoading] = useState(false);

    const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
    const [conclusionNotes, setConclusionNotes] = useState('');

    const toggleStudent = (id: string) => {
        if (presentStudentIds.includes(id)) {
            setPresentStudentIds(presentStudentIds.filter(x => x !== id));
        } else {
            setPresentStudentIds([...presentStudentIds, id]);
        }
    };

    const handleSave = async () => {
        if (!conclusionNotes) {
            return addToast('Conclusion notes are required', 'error');
        }

        setIsLoading(true);
        try {
            await api.post(`/supervisor/meetings/${meetingId}/execute`, {
                conclusionNotes,
                presentStudentIds
            });
            addToast('Meeting Executed Successfully', 'success');
            onSuccess();
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Failed to execute meeting', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '550px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle color="#16a34a" size={24} /> Execute Meeting
                    </h2>
                    <X size={24} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                    Note: Students marked as absent will automatically lose 10 Performance Points.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Mark Attendance <span style={{color: 'red'}}>*</span></label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {teamMembers.map((member) => {
                                const isPresent = presentStudentIds.includes(member.studentId);
                                return (
                                    <div 
                                        key={member.studentId}
                                        onClick={() => toggleStudent(member.studentId)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: `1px solid ${isPresent ? '#16a34a' : 'var(--border-color)'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: isPresent ? '#f0fdf4' : 'transparent', transition: '0.2s' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isPresent ? '#dcfce7' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: isPresent ? '#16a34a' : 'var(--text-secondary)' }}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: isPresent ? '#15803d' : 'var(--text-primary)' }}>{member.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{member.rollNo || member.mail}</div>
                                            </div>
                                        </div>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isPresent ? '#16a34a' : 'var(--border-color)'}`, backgroundColor: isPresent ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isPresent && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }}></div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Conclusion & Notes <span style={{color: 'red'}}>*</span></label>
                        <textarea 
                            value={conclusionNotes}
                            onChange={(e) => setConclusionNotes(e.target.value)}
                            placeholder="Summarize the meeting discussion, decisions made, and next steps..."
                            style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', fontSize: '14px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={isLoading}>Submit Report & Score</Button>
                </div>
            </div>
        </div>
    );
};
