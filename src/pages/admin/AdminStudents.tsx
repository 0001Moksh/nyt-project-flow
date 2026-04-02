import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { Download, Upload, UserPlus, GraduationCap, AlertTriangle, TrendingUp } from 'lucide-react';

export const AdminStudents: React.FC = () => {
    const [students, setStudents] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projRes, stdRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] }))
            ]);
            setProjects(projRes.data || []);
            
            const fetchedStudents = (stdRes.data || []).map((s: any) => ({
                id: s.studentId,
                name: s.name,
                rollNo: s.rollNo,
                branch: s.branch,
                status: s.enrollStatus || 'ACTIVE',
                performance: s.performanceScore ?? 100
            }));
            
            // If backend is empty, fall back to mock data for demonstration
            if (fetchedStudents.length === 0) {
                const mockStudents = [
                    { id: 'S1', name: 'Alice Smith', rollNo: 'CS2024-001', branch: 'Computer Science', status: 'ACTIVE', performance: 85 },
                    { id: 'S2', name: 'Bob Johnson', rollNo: 'CS2024-002', branch: 'Computer Science', status: 'ACTIVE', performance: 92 },
                    { id: 'S3', name: 'Charlie Williams', rollNo: 'IT2024-045', branch: 'Information Tech', status: 'AT_RISK', performance: 45 },
                    { id: 'S4', name: 'Diana Prince', rollNo: 'EC2024-012', branch: 'Electronics', status: 'ACTIVE', performance: 78 },
                    { id: 'S5', name: 'Evan Davis', rollNo: 'CS2024-088', branch: 'Computer Science', status: 'PENDING', performance: 0 },
                ];
                setStudents(mockStudents);
            } else {
                setStudents(fetchedStudents);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              s.rollNo.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const activeCount = students.filter(s => s.status === 'ACTIVE' || s.status === 'ENROLLED').length;
    const atRiskCount = students.filter(s => s.status === 'AT_RISK').length;
    const avgPerf = students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.performance, 0) / students.length) : 0;

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Student Management</h1>
                   <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Monitor student enrollment, phase progress, and AI-predicted risks.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" leftIcon={<Upload size={16} />}>Import CSV</Button>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export Data</Button>
                    <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} />}>Invite Student</Button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Enrolled</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>+12%</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px' }}>{students.length}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#16a34a', borderRadius: '2px' }}></div>
                        {activeCount} Active
                    </div>
                </Card>

                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Avg Batch Performance</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '12px' }}>Stable</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px' }}>{avgPerf}%</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
                        Target: 80%
                    </div>
                </Card>

                <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Students At Risk</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '12px' }}>Urgent</span>
                    </div>
                    <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 16px', color: '#dc2626' }}>{atRiskCount}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-disabled)' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#ef4444', borderRadius: '2px' }}></div>
                        Needs Intervention
                    </div>
                </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                
                {/* Students Table */}
                <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <h3 style={{ margin: 0, fontSize: '16px' }}>Directory</h3>
                         <div style={{ display: 'flex', gap: '12px' }}>
                             <select 
                                 value={filterStatus}
                                 onChange={(e) => setFilterStatus(e.target.value)}
                                 style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', backgroundColor: 'var(--surface)' }}
                             >
                                 <option value="ALL">All Statuses</option>
                                 <option value="ACTIVE">Active</option>
                                 <option value="PENDING">Pending</option>
                                 <option value="AT_RISK">At Risk</option>
                             </select>
                             <input 
                                 type="text" 
                                 placeholder="Search roll no, name..." 
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 style={{ width: '250px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px' }} 
                             />
                         </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Student details</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Branch</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Progress Score</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No students found matching your criteria.</td></tr>
                            )}
                            {filteredStudents.map((student) => {
                                const isRisk = student.status === 'AT_RISK';

                                return (
                                    <tr key={student.id} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontWeight: 'bold' }}>
                                                    {student.name ? student.name.charAt(0) : '?'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{student.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{student.rollNo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                            {student.branch}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{student.performance}%</div>
                                            </div>
                                            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-hover)', borderRadius: '2px', marginTop: '6px' }}>
                                                <div style={{ width: `${student.performance}%`, height: '100%', backgroundColor: isRisk ? '#ef4444' : '#3b82f6', borderRadius: '2px' }}></div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: student.status === 'ACTIVE' || student.status === 'ENROLLED' ? '#16a34a' : student.status === 'AT_RISK' ? '#ef4444' : '#f59e0b' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: student.status === 'ACTIVE' || student.status === 'ENROLLED' ? '#16a34a' : student.status === 'AT_RISK' ? '#ef4444' : '#f59e0b' }}></div> 
                                                {student.status.replace('_', ' ')}
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
                    <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Batch Insights</h3>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>AI SYNC <span style={{display:'inline-block', width:'6px',height:'6px',backgroundColor:'#22c55e',borderRadius:'50%',marginLeft:'4px'}}></span></span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                             <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                 <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                     <GraduationCap size={20} />
                                 </div>
                                 <div style={{ flex: 1 }}>
                                     <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Top Quartile Performing Well</div>
                                     <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>24% of students are ahead of milestones.</div>
                                 </div>
                             </div>

                             <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                 <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                     <AlertTriangle size={20} />
                                 </div>
                                 <div style={{ flex: 1 }}>
                                     <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Participation Drop</div>
                                     <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Login rates dropped by 5% this week.</div>
                                 </div>
                             </div>
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    );
};

export default AdminStudents;
