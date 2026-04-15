import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export const AdminRequests: React.FC = () => {
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const addToast = useToastStore(state => state.addToast);
    const user = useAuthStore(state => state.user);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/requests');
            // We want all requests to demonstrate the keep-record logic
            setRequests(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await api.post(`/requests/${id}/approve`, { adminId: user?.id });
            addToast('Request Approved! Supervisor created with temporary credentials.', 'success');
            fetchData();
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Approval failed (Possible duplicate email)', 'error');
        }
    };

    const handleReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectingId || !rejectReason) return;

        try {
            await api.post(`/requests/${rejectingId}/reject`, { reason: rejectReason });
            addToast('Request Rejected.', 'success');
            setRejectingId(null);
            setRejectReason('');
            fetchData();
        } catch (err) {
            addToast('Failed to reject request', 'error');
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader size="lg" /></div>;

    const pendingRequests = requests.filter(r => r.status === 'PENDING');
    const pastRequests = requests.filter(r => r.status !== 'PENDING').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendingRequests.length === 0 ? (
                    <Card style={{ padding: '48px', textAlign: 'center', color: 'var(--text-disabled)' }}>
                        <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p>No pending registration requests at this time.</p>
                    </Card>
                ) : (
                    pendingRequests.map(req => (
                        <Card key={req.requestId} elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid #fef08a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{req.supervisorName}</h3>
                                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px' }}>Pending</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        <div><strong>Department:</strong> {req.department}</div>
                                        <div><strong>Email:</strong> {req.mail}</div>
                                        <div><strong>Phone:</strong> {req.phoneNumber}</div>
                                        <div><strong>Requested:</strong> {new Date(req.createdAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <Button variant="outline" style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }} leftIcon={<XCircle size={16} />} onClick={() => setRejectingId(req.requestId)}>Reject</Button>
                                    <Button style={{ backgroundColor: '#16a34a' }} leftIcon={<CheckCircle size={16} />} onClick={() => handleApprove(req.requestId)}>Approve & Create</Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>


            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pastRequests.map(req => (
                    <Card key={req.requestId} style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', opacity: 0.8 }}>
                        <h2 style={{ fontSize: '20px', margin: '16px 0 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>Audit Log: Past Actions</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: req.status === 'APPROVED' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: req.status === 'APPROVED' ? '#16a34a' : '#dc2626' }}>
                                    {req.status === 'APPROVED' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{req.supervisorName} <span style={{ color: 'var(--text-disabled)', fontWeight: 400, marginLeft: '8px' }}>({req.mail})</span></div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                        {req.status === 'APPROVED' ? `Approved by Admins on ${new Date(req.approvedAt || req.createdAt).toLocaleString()}` : 'Request Rejected'}
                                    </div>
                                </div>
                            </div>
                            {req.status === 'REJECTED' && req.rejectionReason && (
                                <div style={{ fontSize: '13px', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '6px', maxWidth: '300px' }}>
                                    <strong>Reason:</strong> {req.rejectionReason}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Rejection Modal */}
            {rejectingId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Card elevation={2} style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={20} /> Reject Request</h2>
                        <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Please provide a reason for rejecting this supervisor registration.</p>
                            <textarea
                                required
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. Invalid department provided."
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <Button type="button" variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
                                <Button type="submit" style={{ backgroundColor: '#dc2626' }}>Submit Rejection</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminRequests;
