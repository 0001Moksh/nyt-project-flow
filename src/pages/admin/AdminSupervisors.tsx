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

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

    const getWorkload = (supId: string) => {
        const count = projects.filter(p => p.supervisorId === supId).length;
        const max = 5; // mocked max capacity for AI computation in wireframe
        return { count, max, percentage: Math.min((count / max) * 100, 100) };
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Supervisor Management</h1>
                   <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Monitor workload and AI-driven performance analytics for all mentors.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export Report</Button>
                    <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} />}>Invite Supervisor</Button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Avg Review Time</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px' }}>~12%</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px' }}>4.2h</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#f97316', borderRadius: '2px' }}></div>
                        Target: 3h
                    </div>
                </Card>

                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Completion Rate</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>+2.4%</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px' }}>98.5%</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#16a34a', borderRadius: '2px' }}></div>
                        Target: 95%
                    </div>
                </Card>

                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Avg Feedback Score</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '12px' }}>★ 4.8/5</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px' }}>4.82</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
                        Top 1% Rank
                    </div>
                </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                
                {/* Active Supervisors Table */}
                <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <h3 style={{ margin: 0, fontSize: '16px' }}>Active Supervisors</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Supervisor</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Expertise Tags</th>
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
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b5cf6', backgroundColor: '#f5f3ff', padding: '2px 8px', borderRadius: '4px' }}>AI/ML</span>
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

                {/* Right Side Insights Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Quick Assign AI */}
                    <Card elevation={2} style={{ padding: '24px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <Zap size={20} fill="currentColor" />
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Quick Assign AI</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: '#bfdbfe', margin: '0 0 16px', lineHeight: 1.5 }}>
                            Select a project to see recommended supervisors based on expertise match and available capacity.
                        </p>
                        
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                             <input type="text" placeholder="Search unassigned projects..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                        </div>
                        
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Top Match Suggestions</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}><div style={{width:'16px',height:'16px', borderRadius:'50%', border:'2px solid white'}}></div> Dr. Sarah Chen</div>
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>98% Match</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, color: '#bfdbfe' }}><div style={{width:'16px',height:'16px', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.5)'}}></div> Marcus T.</div>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#bfdbfe' }}>85% Match</span>
                            </div>
                        </div>

                        <Button style={{ width: '100%', backgroundColor: 'white', color: '#1e40af', fontWeight: 'bold' }}>Assign Best Match</Button>
                    </Card>

                    {/* Performance Insights */}
                    <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Performance Insights</h3>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>LIVE FEED <span style={{display:'inline-block', width:'6px',height:'6px',backgroundColor:'#ef4444',borderRadius:'50%',marginLeft:'4px'}}></span></span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                             <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                 <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                     <TrendingUp size={20} />
                                 </div>
                                 <div style={{ flex: 1 }}>
                                     <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Faster than 94%</div>
                                     <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500, marginTop: '4px' }}>+5% increase this week</div>
                                 </div>
                             </div>

                             <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                 <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                     <AlertTriangle size={20} />
                                 </div>
                                 <div style={{ flex: 1 }}>
                                     <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>12 At-Risk</div>
                                     <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Requires supervisor reassignment</div>
                                 </div>
                             </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '24px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-disabled)', marginBottom: '12px', textTransform: 'uppercase' }}>Top Rated Mentor</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>J</div>
                                      <div>
                                          <div style={{ fontSize: '13px', fontWeight: 600 }}>Jane Doe</div>
                                          <div style={{ fontSize: '12px', color: '#eab308' }}>★★★★★</div>
                                      </div>
                                 </div>
                                 <span style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }}>View Profile</span>
                            </div>
                        </div>
                    </Card>

                </div>
            </div>

        </div>
    );
};

export default AdminSupervisors;
