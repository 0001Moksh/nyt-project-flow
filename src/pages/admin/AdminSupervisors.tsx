import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { Download, UserPlus, Zap, TrendingUp, AlertTriangle, ShieldCheck, CheckCircle } from 'lucide-react';

export const AdminSupervisors: React.FC = () => {
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [supRes, projRes] = await Promise.all([
                api.get('/supervisors').catch(() => ({ data: [] })),
                api.get('/projects').catch(() => ({ data: [] }))
            ]);
            setSupervisors(supRes.data || []);
            setProjects(projRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader size="lg" /></div>;

    const getWorkload = (supId: string) => {
        const count = projects.filter(p => p.supervisorId === supId).length;
        const max = 5; // mocked max capacity for AI computation in wireframe
        return { count, max, percentage: Math.min((count / max) * 100, 100) };
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export Report</Button>
                    <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} />}>Invite Supervisor</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

                {/* Active Supervisors Table */}
                <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Supervisor</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Department</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Current Workload</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Performance</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supervisors.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No active supervisors in database.</td></tr>
                            )}
                            {supervisors.map((sup, idx) => {
                                const workload = getWorkload(sup.supervisorId);
                                const isOverloaded = workload.percentage >= 100;
                                const perfScore = sup.performanceScore ?? 100;
                                const isPoorPerf = perfScore < 50;

                                return (
                                    <tr key={sup.supervisorId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                    {sup.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{sup.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{sup.branch} Specialist</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>{sup.branch}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{workload.count}/{workload.max} Projects</div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{workload.percentage}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-hover)', borderRadius: '2px', marginTop: '6px' }}>
                                                <div style={{ width: `${workload.percentage}%`, height: '100%', backgroundColor: isOverloaded ? '#ef4444' : '#3b82f6', borderRadius: '2px' }}></div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: isPoorPerf ? '#ef4444' : '#16a34a' }}>{perfScore}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: sup.enrollStatus === 'ACTIVE' ? '#16a34a' : '#d97706' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sup.enrollStatus === 'ACTIVE' ? '#16a34a' : '#d97706' }}></div> {sup.enrollStatus}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            </div>
        </div>
    );
};

export default AdminSupervisors;
