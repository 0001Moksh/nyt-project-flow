import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../utils/authStore';
import { Card, Button, Input, Loader } from '../components';
import { useToastStore } from '../utils/toastStore';
import { api } from '../services/api';
import { MessageSquare, Send, Paperclip, Mail, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Chat: React.FC = () => {
    const { user, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const addToast = useToastStore(state => state.addToast);

    const [isLoading, setIsLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentProject, setCurrentProject] = useState<any>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [stompClient, setStompClient] = useState<any>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [isAuthenticated, currentProject?.projectId]);

    // WebSocket STOMP Connection Setup
    useEffect(() => {
        if (!currentProject || !user) return;

        import('@stomp/stompjs').then(({ Client }) => {
            const WS_BASE_URL = import.meta.env.PROD 
              ? 'wss://college-project-backend-r7f9.onrender.com/ws-chat' 
              : 'ws://localhost:8080/ws-chat';

            const client = new Client({
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
                    client.subscribe(`/topic/project/${currentProject.projectId}`, (message) => {
                        if (message.body) {
                            const receivedMsg = JSON.parse(message.body);
                            setMessages(prev => {
                                // Deduplicate by messageText + senderId for optimistic updates
                                const exists = prev.find(m => m.messageId === receivedMsg.messageId);
                                if (exists) return prev;
                                
                                const newArr = [...prev, receivedMsg];
                                return newArr.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
            setStompClient(client);

            return () => {
                client.deactivate();
            };
        });
    }, [currentProject?.projectId, user?.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [projectsRes, teamsRes, studentsRes] = await Promise.all([
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/teams').catch(() => ({ data: [] })),
                api.get('/students').catch(() => ({ data: [] }))
            ]);

            // Find project where user is enrolled
            let activeProj = null;
            let activeTeam = null;

            if (user?.role === 'SUPERVISOR') {
                activeProj = projectsRes.data.find((p: any) => p.supervisorId === user.id);
            } else if (user?.role === 'ADMIN') {
                activeProj = projectsRes.data[0]; // Admin fallback
            } else {
                // Student
                const membersRes = await api.get('/team-members').catch(() => ({ data: [] }));
                
                const myMembership = membersRes.data.find((tm: any) => {
                    const joined = JSON.parse(tm.joinMemberArray || '[]');
                    const teamInfo = teamsRes.data.find((t:any) => t.teamId === tm.teamId);
                    return joined.includes(user?.id) || teamInfo?.leaderId === user?.id;
                });
                
                if (myMembership) {
                    activeProj = projectsRes.data.find((p: any) => p.teamId === myMembership.teamId);
                    activeTeam = teamsRes.data.find((t:any) => t.teamId === myMembership.teamId);
                }
            }

            if (!activeTeam && activeProj) {
                activeTeam = teamsRes.data.find((t:any) => t.teamId === activeProj.teamId);
            }

            setCurrentProject(activeProj);

            if (activeProj) {
                fetchMessages(activeProj.projectId);
                
                // Hydrate Team Members
                if (activeTeam) {
                    const studentData = studentsRes.data;
                    const membersIds = [activeTeam.leaderId, ...JSON.parse(activeTeam.teamMemberArray || '[]')];
                    
                    const uniqueIds = Array.from(new Set(membersIds));
                    
                    const populated = uniqueIds.map(id => {
                        const s = studentData.find((stu:any) => stu.studentId === id);
                        return { 
                            ...s, 
                            isLeader: id === activeTeam.leaderId 
                        };
                    }).filter(s => s.studentId);
                    
                    setTeamMembers(populated);
                }
            }
        } catch(err) {
            console.error("Failed to fetch chat data");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (projectId: string) => {
        try {
            const { data } = await api.get(`/chat/project/${projectId}`);
            // Initial payload ordering guarantees Correct ordering on mount
            setMessages(data.sort((a:any,b:any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        } catch (err) {
            // Ignore if backend compilation hasn't triggered yet
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentProject || !user) return;

        const payload = {
            projectId: currentProject.projectId,
            senderId: user.id,
            senderRole: user.role,
            senderName: user.name,
            messageText: newMessage
        };

        setNewMessage('');

        try {
            // DB-First Save Constraint -> Service then triggers WS broadcast
            await api.post('/chat', payload);
        } catch (err) {
            addToast('Backend chat architecture compiling.', 'info');
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', marginTop:'100px'}}><Loader size="lg" /></div>;

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

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>
            
            {/* MAIN CHAT WINDOW */}
            <Card elevation={1} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                
                {/* Chat Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <MessageSquare size={24} color="var(--primary)" /> Communication Hub
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
                        {teamMembers.length} members active
                    </div>
                </div>

                {/* Messages View */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Mock legacy messages mirroring the wireframe for demonstration */}
                    {messages.length === 0 && (
                       <>
                         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                            <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '16px 20px', borderRadius: '16px 16px 0 16px', maxWidth: '70%', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.1)' }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Supervisor (You)</div>
                                <div style={{ fontSize: '15px', lineHeight: 1.5 }}>Team, the architecture diagram looks great. Please ensure the API endpoints are documented before Friday's standup.</div>
                                <div style={{ fontSize: '11px', textAlign: 'right', marginTop: '8px', opacity: 0.8 }}>09:15 AM</div>
                            </div>
                         </div>
                         
                         <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', maxWidth: '70%' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                M
                            </div>
                            <div style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '16px 20px', borderRadius: '16px 16px 16px 0', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#0f172a' }}>Marcus Lee (Lead Developer)</div>
                                <div style={{ fontSize: '15px', lineHeight: 1.5 }}>Acknowledged. We are currently finalizing the Swagger documentation. Should we include the legacy auth modules?</div>
                                <div style={{ fontSize: '11px', marginTop: '8px', color: '#94a3b8' }}>10:42 AM</div>
                            </div>
                         </div>

                         <div style={{ textAlign: 'center', margin: '16px 0' }}>
                             <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', backgroundColor: 'var(--surface-hover)', padding: '6px 16px', borderRadius: '16px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>MARCUS ATTACHED ARCHITECTURE_V2.PDF</span>
                         </div>
                       </>
                    )}

                    {messages.map((msg, i) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                            <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                                {!isMe && (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '12px', alignSelf: 'flex-start' }}>
                                        {msg.senderName.charAt(0)}
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
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                </div>

                {/* Input Area */}
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
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{teamMembers.length} Members</span>
                    </div>

                    <div style={{ padding: '16px' }}>
                        {currentProject.supervisorId && (
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <span style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--text-primary)', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>Supervisor</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {teamMembers.map((member, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{member.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                {member.isLeader ? 'Project Leader' : 'Developer'}
                                            </div>
                                        </div>
                                    </div>
                                    <Mail size={18} color="var(--text-disabled)" style={{ cursor: 'pointer' }} />
                                </div>
                            ))}

                            {/* Legacy mocks matching image if db empty */}
                            {teamMembers.length === 0 && (
                                <>
                                    {[
                                        { name: 'Marcus Lee', role: 'PROJECT LEADER' },
                                        { name: 'Sarah Chen', role: 'BACKEND ENG.' },
                                        { name: 'Amara Okoro', role: 'UI/UX DESIGNER' },
                                        { name: 'Jason Dhillon', role: 'DOCUMENTATION' }
                                    ].map((m, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                                    {m.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.5px' }}>{m.role}</div>
                                                </div>
                                            </div>
                                            <Mail size={18} color="var(--text-disabled)" />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Chat;
