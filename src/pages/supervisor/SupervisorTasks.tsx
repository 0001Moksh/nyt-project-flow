import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { CheckCircle, Search, Filter, Plus, Calendar, MoreVertical } from 'lucide-react';

export const SupervisorTasks: React.FC = () => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', projectId: '', stageStatus: 'SYNOPSIS', priority: 'MEDIUM', dueDate: '', status: 'TODO' });

    const addToast = useToastStore(state => state.addToast);
    const user = useAuthStore(state => state.user);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
           const projRes = await api.get('/projects');
           const myProjects = (projRes.data || []).filter((p: any) => p.supervisorId === user?.id);
           setProjects(myProjects);

           // Fetch tasks for each project
           let allTasks: any[] = [];
           for (const p of myProjects) {
               const tr = await api.get(`/tasks/project/${p.projectId}`);
               allTasks = [...allTasks, ...(tr.data || [])];
           }
           setTasks(allTasks);

        } catch (err) {
           console.error("Failed to load tasks", err);
        } finally {
           setIsLoading(false);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/tasks', newTask);
            addToast('Task created successfully', 'success');
            setIsCreateModalOpen(false);
            setNewTask({ title: '', description: '', projectId: '', stageStatus: 'SYNOPSIS', priority: 'MEDIUM', dueDate: '', status: 'TODO' });
            fetchData();
        } catch(err) {
            addToast('Failed to create task', 'error');
        }
    };

    const updateTaskStatus = async (taskId: string, status: string) => {
        try {
            await api.put(`/tasks/${taskId}`, { status });
            addToast(`Task marked as ${status}`, 'success');
            fetchData();
        } catch(err) {
            addToast('Failed to change status', 'error');
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Project Tasks</h1>
                   <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>All active tasks and milestones for your assigned teams.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus size={16} />}>Create Task</Button>
                </div>
            </div>

            {/* Filters Row */}
            <Card elevation={1} style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-disabled)' }} />
                    <input type="text" placeholder="Search tasks..." style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <Filter size={16} /> All Projects
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <Filter size={16} /> All Stages
                </div>
            </Card>

            {/* Task Table */}
            <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <tr>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Task Name</th>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Project</th>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Stage</th>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Priority</th>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '16px', fontWeight: 600 }}>Due Date</th>
                            <th style={{ padding: '16px', fontWeight: 600, textAlign:'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No tasks found. Click "Create Task" to assign one.</td></tr>
                        )}
                        {tasks.map((task) => {
                            const p = projects.find(proj => proj.projectId === task.projectId);
                            return (
                                <tr key={task.taskId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{task.description?.substring(0,40)}...</div>
                                    </td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{p?.projectTitle || 'Unknown'}</td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{task.stageStatus}</td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, 
                                            backgroundColor: task.priority === 'HIGH' ? '#fee2e2' : task.priority === 'MEDIUM' ? '#fef3c7' : '#e0e7ff',
                                            color: task.priority === 'HIGH' ? '#dc2626' : task.priority === 'MEDIUM' ? '#d97706' : '#3730a3' 
                                        }}>
                                            {task.priority}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, 
                                            backgroundColor: task.status === 'DONE' ? '#dcfce7' : task.status === 'IN_PROGRESS' ? '#e0f2fe' : '#f3f4f6',
                                            color: task.status === 'DONE' ? '#16a34a' : task.status === 'IN_PROGRESS' ? '#0284c7' : '#4b5563' 
                                        }}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} /> 
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <select 
                                            value={task.status} 
                                            onChange={(e) => updateTaskStatus(task.taskId, e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', cursor: 'pointer' }}
                                        >
                                            <option value="TODO">To Do</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="REVIEW">Review</option>
                                            <option value="DONE">Done</option>
                                        </select>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            {/* Create Task Modal Overlay */}
            {isCreateModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Card elevation={2} style={{ width: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h2 style={{ margin: 0 }}>Create New Task</h2>
                        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Input label="Task Title" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} required />
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Project</label>
                                <select required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }} value={newTask.projectId} onChange={e => setNewTask({...newTask, projectId: e.target.value})}>
                                    <option value="" disabled>Select a project</option>
                                    {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectTitle}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Stage Status</label>
                                    <select style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }} value={newTask.stageStatus} onChange={e => setNewTask({...newTask, stageStatus: e.target.value})}>
                                        <option value="SYNOPSIS">Synopsis</option>
                                        <option value="PROGRESS1">Progress 1</option>
                                        <option value="PROGRESS2">Progress 2</option>
                                        <option value="FINAL">Final Submission</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Priority</label>
                                    <select style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }} value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
                                <textarea 
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px', fontFamily: 'inherit' }}
                                    value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                                <Button type="submit">Assign Task</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SupervisorTasks;
