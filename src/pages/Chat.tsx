import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Loader } from '../components';
import { useToastStore } from '../utils/toastStore';
import { api } from '../services/api';
import { MessageSquare, Send, Paperclip, Mail, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const isEnrolledStudent = (student: any) =>
    String(student?.enrollStatus || '').toUpperCase() === 'ENROLLED';

export const Chat: React.FC = () => {
    const { user, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectQueryId = searchParams.get('project');
    const addToast = useToastStore(state => state.addToast);

    const [isLoading, setIsLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentProject, setCurrentProject] = useState<any>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [supervisor, setSupervisor] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [isAuthenticated, projectQueryId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // WebSocket STOMP Connection Setup
    useEffect(() => {
        if (!currentProject || !user) return;

        let client: any = null;
        let cancelled = false;

        import('@stomp/stompjs').then(({ Client }) => {
            if (cancelled) return;

            const WS_BASE_URL = import.meta.env.PROD
              ? 'wss://college-project-backend-r7f9.onrender.com/ws-chat'
              : 'ws://localhost:8080/ws-chat';

            client = new Client({
                brokerURL: WS_BASE_URL,
                connectHeaders: {
                    userId: user.id || '',
                    userRole: user.role || 'STUDENT'
                },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                debug: (msg) => console.log('STOMP: ' + msg),
                onConnect: () => {
                    console.log('STOMP Handshake completed securely.');
                    client.subscribe(`/topic/project/${currentProject.projectId}`, (message: any) => {
                        if (message.body) {
                            const receivedMsg = JSON.parse(message.body);
                            setMessages(prev => {
                                const exists = prev.find(m => m.messageId === receivedMsg.messageId);
                                if (exists) return prev;

                                const newArr = [...prev, receivedMsg];
                                return newArr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                            });
                        }
                    });
                },
                onStompError: (frame) => {
                    console.error('STOMP Error:', frame);
                    addToast('Connection blocked by security layer.', 'error');
                }
            });

            client.activate();
        });

        return () => {
            cancelled = true;
            if (client) {
                client.deactivate();
            }
        };
    }, [currentProject?.projectId, user?.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projectsRes, teamsRes, studentsRes, supervisorsRes, membersRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/teams').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] })),
                api.get('/supervisors').catch(() => ({ data: [] })),
                api.get('/team-members').catch(() => ({ data: [] })),
            ]);

            let activeProj = null;
            let activeTeam = null;
            const allProjects = projectsRes.data || [];
            const allTeams = teamsRes.data || [];
            const allStudents = studentsRes.data || [];
            const allSupervisors = supervisorsRes.data || [];
            const allTeamMembers = membersRes.data || [];

            if (projectQueryId) {
                activeProj = allProjects.find((p: any) => p.projectId === projectQueryId) || null;
                if (user?.role === 'SUPERVISOR' && activeProj && activeProj.supervisorId !== user.id) {
                    activeProj = null;
                }
            }

            if (!activeProj) {
                if (user?.role === 'SUPERVISOR') {
                    activeProj = allProjects.find((p: any) => p.supervisorId === user.id) || null;
                } else if (user?.role === 'ADMIN') {
                    activeProj = allProjects[0] || null;
                } else {
                    const myMembership = allTeamMembers.find((tm: any) => {
                        const joined = JSON.parse(tm.joinMemberArray || '[]');
                        const teamInfo = allTeams.find((t: any) => t.teamId === tm.teamId);
                        return joined.includes(user?.id) || teamInfo?.leaderId === user?.id;
                    });

                    if (myMembership) {
                        activeProj = allProjects.find((p: any) => p.teamId === myMembership.teamId) || null;
                        activeTeam = allTeams.find((t: any) => t.teamId === myMembership.teamId) || null;
                    }
                }
            }

            if (!activeTeam && activeProj) {
                activeTeam = allTeams.find((t: any) => t.teamId === activeProj.teamId) || null;
            }

            setCurrentProject(activeProj);

            if (activeProj?.supervisorId) {
                setSupervisor(allSupervisors.find((s: any) => s.supervisorId === activeProj.supervisorId) || null);
            } else {
                setSupervisor(null);
            }

            if (activeProj) {
                fetchMessages(activeProj.projectId);

                if (activeTeam) {
                    const statusRow = allTeamMembers.find((tm: any) => tm.teamId === activeTeam.teamId);
                    let acceptedIds: string[] = [];
                    try {
                        acceptedIds = JSON.parse(statusRow?.joinMemberArray || '[]');
                        if (!Array.isArray(acceptedIds)) acceptedIds = [];
                    } catch {
                        acceptedIds = [];
                    }

                    // Leader + students who accepted invite; then require enroll_status ENROLLED
                    const candidateIds = Array.from(new Set([
                        activeTeam.leaderId,
                        ...acceptedIds,
                    ].filter(Boolean)));

                    const populated = candidateIds
                        .map((id) => {
                            const s = allStudents.find((stu: any) => stu.studentId === id);
                            if (!s || !isEnrolledStudent(s)) return null;
                            return {
                                ...s,
                                isLeader: id === activeTeam.leaderId,
                            };
                        })
                        .filter(Boolean);

                    setTeamMembers(populated);
                } else {
                    setTeamMembers([]);
                }
            } else {
                setTeamMembers([]);
                setMessages([]);
            }
        } catch (err) {
            console.error('Failed to fetch chat data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (projectId: string) => {
        try {
            const { data } = await api.get(`/chat/project/${projectId}`);
            setMessages(
                (data || []).sort(
                    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                )
            );
        } catch (err) {
            setMessages([]);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentProject || !user) return;

        const text = newMessage.trim();
        const payload = {
            projectId: currentProject.projectId,
            senderId: user.id,
            senderRole: user.role,
            senderName: user.name,
            messageText: text,
        };

        setNewMessage('');

        try {
            const { data } = await api.post('/chat', payload);
            if (data) {
                setMessages((prev) => {
                    if (prev.some((m) => m.messageId === data.messageId)) return prev;
                    return [...prev, data].sort(
                        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                });
            }
        } catch (err) {
            setNewMessage(text);
            addToast('Failed to send message. Please try again.', 'error');
        }
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><Loader size="lg" /></div>;

    if (!currentProject) {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', paddingTop: '64px' }}>
                <Card elevation={1} style={{ padding: '64px' }}>
                    <MessageSquare size={48} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
                    <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>No Active Communications</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>You must be enrolled in a project to access the Communication Hub.</p>
                </Card>
            </div>
        );
    }

    const memberCount = teamMembers.length + (supervisor ? 1 : 0);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>

            {/* MAIN CHAT WINDOW */}
            <Card elevation={1} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>

                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <MessageSquare size={24} color="var(--primary)" /> Communication Hub
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
                        {memberCount} members active
                    </div>
                </div>

                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)', gap: '12px', minHeight: '240px' }}>
                            <MessageSquare size={40} color="var(--border-color)" />
                            <p style={{ margin: 0, fontSize: '15px', maxWidth: '280px', lineHeight: 1.5 }}>
                                Start your conversation with your team and supervisor
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.senderId === user?.id;
                            return (
                                <div key={msg.messageId || `${msg.senderId}-${msg.createdAt}`} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                                    {!isMe && (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '12px', alignSelf: 'flex-start' }}>
                                            {(msg.senderName || '?').charAt(0)}
                                        </div>
                                    )}
                                    <div style={{
                                        backgroundColor: isMe ? '#2563eb' : '#f1f5f9',
                                        color: isMe ? 'white' : '#334155',
                                        padding: '16px 20px',
                                        borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                                        maxWidth: '70%',
                                        border: isMe ? 'none' : '1px solid var(--border-color)',
                                        boxShadow: isMe ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: isMe ? '#e0e7ff' : '#0f172a' }}>
                                            {msg.senderName} {isMe ? '(You)' : ''}
                                        </div>
                                        <div style={{ fontSize: '15px', lineHeight: 1.5 }}>{msg.messageText}</div>
                                        <div style={{ fontSize: '11px', textAlign: isMe ? 'right' : 'left', marginTop: '8px', opacity: isMe ? 0.8 : 1, color: isMe ? 'white' : '#94a3b8' }}>
                                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ padding: '20px 24px', backgroundColor: '#fdfdfd', borderTop: '1px solid var(--border-color)' }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                        <Paperclip size={20} color="var(--text-disabled)" style={{ position: 'absolute', left: '16px', cursor: 'pointer' }} />
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Write instructions or feedback..."
                            style={{ flex: 1, padding: '16px 16px 16px 52px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '15px', backgroundColor: 'var(--surface-hover)', outline: 'none' }}
                        />
                        <Button type="submit" style={{ padding: '14px 24px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            Send <Send size={16} />
                        </Button>
                    </form>
                </div>
            </Card>

            {/* RIGHT SIDEBAR: TEAM COMPOSITION */}
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column' }}>
                <Card elevation={1} style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: '#fdfdfd' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>TEAM COMPOSITION</h4>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{memberCount}</span>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {supervisor && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#1d4ed8', flexShrink: 0 }}>
                                        {supervisor.name?.charAt(0) || 'S'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {supervisor.name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                            {supervisor.department || supervisor.branch || 'Department'}
                                        </div>
                                        <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', backgroundColor: '#1d4ed8', color: '#fff', padding: '2px 8px', borderRadius: '999px' }}>
                                            Supervisor
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {teamMembers.length === 0 && !supervisor && (
                            <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-disabled)', fontSize: '13px' }}>
                                <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                No enrolled team members yet.
                            </div>
                        )}

                        {teamMembers.map((member) => (
                            <div key={member.studentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', flexShrink: 0 }}>
                                        {member.name?.charAt(0) || '?'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                            {member.isLeader ? 'Project Leader' : 'Team Member'}
                                        </div>
                                    </div>
                                </div>
                                {member.mail && (
                                    <a href={`mailto:${member.mail}`} title={member.mail} style={{ display: 'flex', color: 'var(--text-disabled)' }}>
                                        <Mail size={18} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Chat;
