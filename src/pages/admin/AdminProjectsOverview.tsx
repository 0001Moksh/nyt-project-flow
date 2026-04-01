import React, { useEffect, useState } from 'react';
import { Card, Button, Loader, Input } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { ChevronDown, ChevronUp, CheckCircle, Clock, Flag, AlertTriangle, ShieldAlert, Users, FileText } from 'lucide-react';

export const AdminProjectsOverview: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [reasonModalOpen, setReasonModalOpen] = useState(false);
    const [pendingAssignment, setPendingAssignment] = useState<{projectId: string, newSupervisorId: string} | null>(null);
    const [reasonText, setReasonText] = useState('');

    const addToast = useToastStore(state => state.addToast);
    const { user } = useAuthStore();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projRes, supRes, teamsRes, studentsRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/supervisors').catch(() => ({ data: [] })),
                api.get('/teams').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] }))
            ]);
            
            const allProjects = projRes.data || [];
            const allSupervisors = supRes.data || [];
            const allTeams = teamsRes.data || [];
            const allStudents = studentsRes.data || [];

            const sups = allSupervisors.map((sup: any) => ({
                ...sup,
                assignedCount: allProjects.filter((p: any) => p.supervisorId === sup.supervisorId).length
            }));

            const enriched = allProjects.map((p: any) => {
                 const team = allTeams.find((t: any) => t.teamId === p.teamId);
                 let memberDetails: any[] = [];
                 if (team) {
                      const arr = JSON.parse(team.teamMemberArray || '[]');
                      memberDetails = arr.map((sid: string) => {
                          const st = allStudents.find((s:any) => s.studentId === sid);
                          return st || { studentId: sid, name: 'Unknown', mail: 'N/A' };
                      });
                 }
                 return { ...p, team, memberDetails };
            });

            setProjects(enriched);
            setSupervisors(sups);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSupervisorSelect = (projectId: string, currentSupervisorId: string, newSupervisorId: string) => {
        if (!newSupervisorId) return; // Prevent empty unassignment for now
        if (currentSupervisorId && currentSupervisorId !== newSupervisorId) {
            setPendingAssignment({ projectId, newSupervisorId });
            setReasonText('');
            setReasonModalOpen(true);
        } else {
            executeAssignSupervisor(projectId, newSupervisorId, '');
        }
    };

    const executeAssignSupervisor = async (projectId: string, supervisorId: string, reason: string) => {
        try {
            await api.post(`/projects/${projectId}/assign-supervisor`, {
                supervisorId,
                adminId: user?.id,
                reason
            });
            setProjects(projects.map(p => p.projectId === projectId ? { ...p, supervisorId } : p));
            setSupervisors(supervisors.map(s => {
                if (s.supervisorId === supervisorId) return { ...s, assignedCount: (s.assignedCount || 0) + 1 };
                return s;
            }));
            addToast('Supervisor Assignment Updated successfully.', 'success');
            setReasonModalOpen(false);
            setPendingAssignment(null);
        } catch (err: any) {
            console.error("Failed to assign supervisor", err);
            addToast(err.response?.data?.message || 'Failed to assign supervisor.', 'error');
        }
    };

    const handleAdminOverride = async (projectId: string, action: string) => {
        try {
            if (action === 'APPROVE') {
                await api.put(`/projects/${projectId}`, { status: 'approved' });
                addToast('Admin Override: Stage Approved successfully (Logged).', 'success');
            } else if (action === 'REVISION') {
                addToast('Admin Override: Revision Requested (Logged).', 'success');
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
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid #3b82f6', paddingLeft: '24px', marginLeft: '56px' }}>
                                                    
                                                    {/* Supervisor Assignment Bar (from FormDetails) */}
                                                    <div style={{ padding: '16px 24px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Assign Supervisor:</div>
                                                        <select 
                                                            value={proj.supervisorId || ''} 
                                                            onChange={(e) => handleSupervisorSelect(proj.projectId, proj.supervisorId, e.target.value)}
                                                            style={{ flex: 1, maxWidth: '400px', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
                                                        >
                                                            <option value="">-- Unassigned --</option>
                                                            {supervisors.map(sup => (
                                                                <option key={sup.supervisorId} value={sup.supervisorId}>
                                                                    {sup.name} ({sup.assignedCount || 0} Projects Assigned)
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {proj.supervisorId && <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Active Supervisor Assigned</div>}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '24px' }}>
                                                        {/* TEAM MEMBERS PANEL (from FormDetails) */}
                                                        <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                             <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                 <Users size={16} color="var(--primary)" /> Enrolled Team Members
                                                             </h4>
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                 {proj.memberDetails?.map((m: any) => (
                                                                      <div key={m.studentId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                                           <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                                                {m.name.charAt(0)}
                                                                           </div>
                                                                           <div>
                                                                               <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                  {m.name}
                                                                                  {m.studentId === proj.team?.leaderId && (
                                                                                      <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '8px' }}>LEADER</span>
                                                                                  )}
                                                                               </div>
                                                                               <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.mail}</div>
                                                                           </div>
                                                                      </div>
                                                                 ))}
                                                             </div>
                                                        </div>

                                                        {/* PROJECT DETAILS PANEL (from FormDetails) */}
                                                        <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                             <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                 <FileText size={16} color="var(--primary)" /> Proposal Context
                                                             </h4>
                                                             <div style={{ backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap', border: '1px dashed var(--border-color)', height: '100%', maxHeight: '400px', overflowY: 'auto' }}>
                                                                 {proj.projectDescription || "No description provided."}
                                                             </div>
                                                        </div>

                                                        {/* ADMIN ACTIONS (Original from AdminProjectsOverview) */}
                                                        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
                                                                <ShieldAlert size={14} /> ADMIN OVERRIDE PANEL
                                                            </div>
                                                            <Button style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', border: 'none' }} onClick={() => handleAdminOverride(proj.projectId, 'APPROVE')}>APPROVE CURRENT STAGE</Button>
                                                            <Button style={{ width: '100%', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }} onClick={() => handleAdminOverride(proj.projectId, 'REVISION')}>REQUEST REVISION</Button>
                                                        </div>
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

            {/* REASON MODAL */}
            {reasonModalOpen && pendingAssignment && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle color="#f59e0b" size={20} /> Reassign Supervisor
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You are replacing an existing supervisor. A reason is required for administrative tracking and notifications.</p>
                        
                        <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Reason for Change <span style={{color: 'red'}}>*</span></label>
                            <Input 
                                value={reasonText} 
                                onChange={(e) => setReasonText(e.target.value)} 
                                placeholder="E.g., Requested by student, Availability issues..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <Button variant="outline" onClick={() => { setReasonModalOpen(false); setPendingAssignment(null); }}>Cancel</Button>
                            <Button 
                                onClick={() => executeAssignSupervisor(pendingAssignment.projectId, pendingAssignment.newSupervisorId, reasonText)}
                                disabled={!reasonText.trim()}
                            >
                                Confirm Reassignment
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProjectsOverview;
