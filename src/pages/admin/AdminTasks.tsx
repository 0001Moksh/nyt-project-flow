import React, { useEffect, useState } from 'react';
import { Card, Loader, Button } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { Search, Filter, MoreVertical, PlayCircle, Flag } from 'lucide-react';

export const AdminTasks: React.FC = () => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const addToast = useToastStore(state => state.addToast);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] }))
            ]);
            const allProjects = projRes.data || [];
            setProjects(allProjects);

            let allTasks: any[] = [];
            for (const p of allProjects) {
                const tr = await api.get(`/tasks/project/${p.projectId}`).catch(() => ({ data: [] }));
                allTasks = [...allTasks, ...(tr.data || [])];
            }
            // Sort by priority or date mocked logic
            setTasks(allTasks);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdminOverrideStatus = async (taskId: string, status: string) => {
        try {
            await api.put(`/tasks/${taskId}`, { status });
            addToast(`Admin Override: Task ${taskId.substring(0,8)} marked as ${status}`, 'success');
            fetchData();
        } catch(err) {
            addToast('Failed to override task status', 'error');
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '-8px' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Universal Task Directory</h1>
                   <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Global read-only tracking of all active project tasks across departments.</p>
                </div>
            </div>

            {/* Filter Bar mimicking wireframe top */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative', maxWidth: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-disabled)' }} />
                    <input type="text" placeholder="Find a task" style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white' }} />
                </div>
                <Button variant="outline" size="sm" leftIcon={<Filter size={16} />}>Filter</Button>
                <Button variant="outline" size="sm" leftIcon={<Filter size={16} />}>Sort</Button>
            </div>

            <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <tr>
                            <th style={{ padding: '16px 24px', width: '40px' }}><input type="checkbox" /></th>
                            <th style={{ padding: '16px' }}>Task</th>
                            <th style={{ padding: '16px' }}>Project</th>
                            <th style={{ padding: '16px' }}>Assignee</th>
                            <th style={{ padding: '16px' }}>Dates</th>
                            <th style={{ padding: '16px' }}>Time Track</th>
                            <th style={{ padding: '16px' }}>Priority</th>
                            <th style={{ padding: '16px' }}>Status</th>
                            <th style={{ padding: '16px', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length === 0 && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No system tasks logged.</td></tr>
                        )}
                        {tasks.map((task) => {
                            const p = projects.find(proj => proj.projectId === task.projectId);
                            
                            // Deterministic mock generation for wireframe fields like "Time Track"
                            const hash = task.title.length;
                            const timeTrack = hash % 2 === 0 ? <PlayCircle size={20} color="var(--text-disabled)" /> : <span style={{fontSize:'13px', fontWeight:600}}>{hash} hr 30 min</span>;
                            const mockedAssigneeImages = [
                                "https://i.pravatar.cc/150?1",
                                "https://i.pravatar.cc/150?2"
                            ];

                            return (
                                <tr key={task.taskId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '13px', color: '#334155' }}>
                                    <td style={{ padding: '16px 24px' }}><input type="checkbox" /></td>
                                    <td style={{ padding: '16px', fontWeight: 500, color: '#0f172a' }}>{task.title}</td>
                                    
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: 'bold', fontSize: '10px' }}>
                                                {p?.projectTitle?.charAt(0) || 'P'}
                                            </div>
                                            {p?.projectTitle || 'Unknown'}
                                        </div>
                                    </td>
                                    
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <img src={mockedAssigneeImages[hash % 2]} alt="User" style={{ width: '24px', height: '24px', borderRadius: '12px' }} />
                                            {hash % 3 === 0 && <img src={mockedAssigneeImages[(hash+1) % 2]} alt="User" style={{ width: '24px', height: '24px', borderRadius: '12px', marginLeft: '-12px', border: '2px solid white' }} />}
                                        </div>
                                    </td>

                                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                                    </td>
                                    
                                    <td style={{ padding: '16px' }}>{timeTrack}</td>

                                    <td style={{ padding: '16px' }}>
                                         <span style={{ 
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            color: task.priority === 'HIGH' ? '#dc2626' : task.priority === 'MEDIUM' ? '#d97706' : '#475569' 
                                        }}>
                                            <Flag size={14} fill="currentColor" /> {task.priority === 'HIGH' ? 'Urgent' : task.priority === 'MEDIUM' ? 'High' : 'Low'}
                                        </span>
                                    </td>

                                    <td style={{ padding: '16px' }}>
                                        <select 
                                            value={task.status} 
                                            onChange={(e) => handleAdminOverrideStatus(task.taskId, e.target.value)}
                                            style={{ 
                                                padding: '4px 12px', borderRadius: '16px', border: '1px solid transparent', 
                                                fontSize: '12px', fontWeight: 600, cursor: 'pointer', appearance: 'none',
                                                backgroundColor: task.status === 'DONE' ? '#dcfce7' : task.status === 'IN_PROGRESS' ? '#e0e7ff' : '#f1f5f9',
                                                color: task.status === 'DONE' ? '#16a34a' : task.status === 'IN_PROGRESS' ? '#4f46e5' : '#475569' 
                                            }}
                                        >
                                            <option value="TODO">To-Do</option>
                                            <option value="IN_PROGRESS">In-progress</option>
                                            <option value="REVIEW">Review</option>
                                            <option value="DONE">Done</option>
                                        </select>
                                    </td>

                                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-disabled)', cursor: 'pointer' }}>
                                        <MoreVertical size={16} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

        </div>
    );
};

export default AdminTasks;
