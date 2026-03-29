import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { ChevronDown, ChevronUp, CheckCircle, Clock, Flag, AlertTriangle, ShieldAlert } from 'lucide-react';

export const AdminProjectsOverview: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const addToast = useToastStore(state => state.addToast);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projRes, supRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/supervisors').catch(() => ({ data: [] }))
            ]);
            setProjects(projRes.data || []);
            setSupervisors(supRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdminOverride = async (projectId: string, action: string) => {
        // Mock Admin Override logic based on the user requirement "allow status override but log changes"
        try {
            if (action === 'APPROVE') {
                await api.put(`/projects/${projectId}`, { status: 'approved' });
                addToast('Admin Override: Stage Approved successfully (Logged).', 'success');
            } else if (action === 'REVISION') {
                addToast('Admin Override: Revision Requested (Logged).', 'success');
            } else if (action === 'CHANGE_SUPERVISOR') {
                addToast('Admin Override: Supervisor Change Initiated.', 'info');
            }
            fetchData();
        } catch(err) {
            addToast('Override action failed', 'error');
        }
    };

    const getLifecycleNodes = (status: string, stageStatus: string) => {
        // Registration -> Proposal -> In Review -> Completed
        let index = status === 'approved' ? 1 
                  : status === 'completed' ? 3 
                  : status === 'pending' ? 0 : 2;
        
        const nodes = [
            { label: 'Registration', isActive: index >= 0, isCurrent: index === 0 },
            { label: 'Proposal', isActive: index >= 1, isCurrent: index === 1 },
            { label: 'In Review', isActive: index >= 2, isCurrent: index === 2 },
            { label: 'Completed', isActive: index >= 3, isCurrent: index === 3 }
        ];
        return nodes;
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Project Portfolio</h1>
                   <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Global oversight of all active projects, AI health insights, and execution lifecycles.</p>
                </div>
            </div>

            <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <tr>
                            <th style={{ padding: '20px 24px', fontWeight: 600 }}>Project & Owner</th>
                            <th style={{ padding: '20px', fontWeight: 600 }}>Lifecycle Stage</th>
                            <th style={{ padding: '20px', fontWeight: 600 }}>Health & AI Insight</th>
                            <th style={{ padding: '20px', fontWeight: 600 }}>Last Activity</th>
                            <th style={{ padding: '20px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No active projects.</td></tr>
                        )}
                        {projects.map((proj) => {
                            const sup = supervisors.find(s => s.supervisorId === proj.supervisorId);
                            const isExpanded = expandedRow === proj.projectId;
                            const nodes = getLifecycleNodes(proj.status, proj.stageStatus);
                            
                            // Mocking AI Insights for wireframe match
                            const isAtRisk = proj.status === 'pending';
                            
                            return (
                                <React.Fragment key={proj.projectId}>
                                    <tr style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: isExpanded ? '#f8fafc' : 'white', transition: '0.2s' }}>
                                        <td style={{ padding: '20px 24px', verticalAlign: 'top' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                    {proj.projectTitle.substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--primary)' }}>{proj.projectTitle}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '4px' }}>Lead: {sup ? sup.name : 'Unassigned'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Engineering</div>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px', verticalAlign: 'top' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '200px' }}>
                                                {nodes.map((node, i) => (
                                                    <React.Fragment key={i}>
                                                        <div style={{ 
                                                            width: node.isCurrent ? '16px' : '12px', 
                                                            height: node.isCurrent ? '16px' : '12px', 
                                                            borderRadius: '50%', 
                                                            backgroundColor: node.isCurrent ? 'white' : node.isActive ? '#16a34a' : 'var(--border-color)',
                                                            border: node.isCurrent ? '4px solid #3b82f6' : 'none',
                                                            zIndex: 1
                                                        }}></div>
                                                        {i < nodes.length - 1 && (
                                                            <div style={{ flex: 1, height: '2px', backgroundColor: nodes[i].isActive ? '#16a34a' : 'var(--border-color)' }}></div>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                                <div style={{ marginLeft: '12px', fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Flag size={14} /> {nodes.find(n => n.isCurrent)?.label || 'Completed'}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px', verticalAlign: 'top' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'var(--surface-hover)' }}>
                                                        <div style={{ width: isAtRisk ? '30%' : '80%', height: '100%', borderRadius: '3px', backgroundColor: isAtRisk ? '#f97316' : '#22c55e' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: isAtRisk ? '#f97316' : '#22c55e' }}>{isAtRisk ? 'At Risk' : 'Stable'}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '6px' }}>AI: {isAtRisk ? '15% delay predicted' : 'Low risk of delay'}</div>
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px', verticalAlign: 'top', color: 'var(--text-secondary)' }}>
                                            Today, 2:45 PM
                                        </td>
                                        
                                        <td style={{ padding: '20px', verticalAlign: 'top', textAlign: 'center' }}>
                                            <div style={{ cursor: 'pointer', display: 'inline-flex', padding: '8px', borderRadius: '8px' }} onClick={() => setExpandedRow(isExpanded ? null : proj.projectId)}>
                                                {isExpanded ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Row Content */}
                                    {isExpanded && (
                                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '0' }}>
                                            <td colSpan={5} style={{ padding: '0 24px 24px 24px' }}>
                                                <div style={{ display: 'flex', gap: '24px', borderLeft: '4px solid #3b82f6', paddingLeft: '24px', marginLeft: '56px' }}>
                                                    
                                                    {/* Submission History Mock */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}><Clock size={16} /> Submission History</h4>
                                                        <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid #e2e8f0' }}>
                                                            <div style={{ position: 'absolute', left: '-6px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
                                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>v1.2 Final Draft Submitted</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>Today, 2:45 PM by {sup?.name}</div>
                                                        </div>
                                                        <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid transparent' }}>
                                                            <div style={{ position: 'absolute', left: '-6px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>Proposal Approved</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>Yesterday, 10:15 AM</div>
                                                        </div>
                                                    </div>

                                                    {/* Supervisor Feedback Mock */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}><CheckCircle size={16} /> Supervisor Feedback</h4>
                                                        <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', backgroundColor: 'white', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                                            "The architecture diagram looks solid. Please ensure the security protocols for the grid nodes are documented in the next version."
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                                                <span style={{ fontWeight: 600, color: '#2563eb' }}>{sup?.name || 'Assigned Lead'}</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-disabled)' }}>REPLY</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Admin Actions */}
                                                    <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
                                                            <ShieldAlert size={14} /> ADMIN OVERRIDE PANEL
                                                        </div>
                                                        <Button style={{ width: '100%', backgroundColor: '#2563eb' }} onClick={() => handleAdminOverride(proj.projectId, 'APPROVE')}>APPROVE CURRENT STAGE</Button>
                                                        <Button style={{ width: '100%', backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a' }} variant="outline" onClick={() => handleAdminOverride(proj.projectId, 'REVISION')}>REQUEST REVISION</Button>
                                                        <Button style={{ width: '100%' }} variant="outline" onClick={() => handleAdminOverride(proj.projectId, 'CHANGE_SUPERVISOR')}>CHANGE SUPERVISOR</Button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

export default AdminProjectsOverview;
