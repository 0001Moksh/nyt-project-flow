import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, Settings } from 'lucide-react';

export const SupervisorProjects: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const user = useAuthStore(state => state.user);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const projectsRes = await api.get('/projects');
            const myProjects = (projectsRes.data || []).filter((p: any) => p.supervisorId === user?.id);
            setProjects(myProjects);
        } catch (err) {
            console.error("Failed to load supervisor projects", err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader size="lg" /></div>;

    const filteredProjects = projects.filter(p =>
        p.projectTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectDescription?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>My Assigned Projects</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>View and manage all projects currently assigned to you.</p>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                    />
                </div>
            </div>

            <Card elevation={1} style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Project Title</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Stage</th>
                            <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProjects.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No projects found.
                                </td>
                            </tr>
                        ) : (
                            filteredProjects.map((proj) => (
                                <tr key={proj.projectId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                                    <td style={{ padding: '16px', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <FolderKanban size={20} color="var(--primary)" />
                                            {proj.projectTitle}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {proj.projectDescription}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {proj.status === 'pending' ? (
                                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '12px' }}>PENDING</span>
                                        ) : (
                                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e6f4ea', color: '#16a34a', padding: '4px 12px', borderRadius: '12px' }}>APPROVED</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px' }}>
                                            {proj.stageStatus || 'SYNOPSIS'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/supervisor/teams/${proj.teamId}`)}
                                            leftIcon={<Settings size={16} />}
                                        >
                                            View Config
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

export default SupervisorProjects;
