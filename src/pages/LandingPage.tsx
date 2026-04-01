import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Activity, Brain, Users, Trophy, ArrowRight, Play, X, CheckCircle, Clock } from 'lucide-react';
import { Loader } from '../components';
import { api } from '../services/api';
import '../styles/landing.css';
import heroImg from '../assets/images/hero.png';
import techImg from '../assets/images/tech.png';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const { data: projData } = await api.get('/projects');
                const scoredProjects = (projData || []).map((p: any) => {
                    const s1 = parseInt(p.synopsisScore || '0');
                    const s2 = parseInt(p.progress1Score || '0');
                    const s3 = parseInt(p.progress2Score || '0');
                    const s4 = parseInt(p.finalScore || '0');
                    const total = s1 + s2 + s3 + s4;
                    return { ...p, cumulativeScore: total };
                }).sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);

                setProjects(scoredProjects);
            } catch (err) {
                console.error("Failed to load leaderboard");
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    // Registration Modal States
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [regStep, setRegStep] = useState<1 | 2>(1);
    const [isRegistering, setIsRegistering] = useState(false);
    const [regData, setRegData] = useState({
        supervisorName: '',
        department: '',
        mail: '',
        phoneNumber: '',
        password: '',
        otp: ''
    });

    const handleRegChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setRegData({ ...regData, [e.target.name]: e.target.value });
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRegistering(true);
        try {
            await api.post('/otp/resend', { email: regData.mail, accountType: 'SUPERVISOR' });
            // Move to OTP step on success
            setRegStep(2);
            alert("OTP sent to your email!");
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || "Failed to send OTP.");
        } finally {
            setIsRegistering(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRegistering(true);
        try {
            // 1. Verify OTP
            await api.post('/otp/verify', { email: regData.mail, code: regData.otp, accountType: 'SUPERVISOR' });
            
            // 2. Submit the registration request
            await api.post('/requests', {
                supervisorName: regData.supervisorName,
                department: regData.department,
                mail: regData.mail,
                phoneNumber: regData.phoneNumber,
                password: regData.password
            });
            
            alert("Registration successful! Your request has been sent to the Admin for approval.");
            setShowRegisterModal(false);
            setRegStep(1);
            setRegData({ supervisorName: '', department: '', mail: '', phoneNumber: '', password: '', otp: '' });
        } catch (err: any) {
             alert(err.response?.data?.message || err.message || "OTP Verification failed.");
        } finally {
             setIsRegistering(false);
        }
    };

    return (
        <div className="landing-container">

            {/* Hero Section */}
            <section className="hero-wrapper">
                <div className="hero-content animate-fade-in-up delay-100">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#F0F4FF', color: '#0A2B73', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                        <Brain size={16} /> AI-Powered Academic Environment
                    </div>
                    <h1 className="heading-xl">
                        Streamlining Academic Projects with <span className="text-gradient">AI-Powered Intelligence</span>
                    </h1>
                    <p className="subtitle delay-200">
                        Seamless collaboration, automated team formations, and real-time tracking from synopsis to final submission. Experience the future of research management.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }} className="animate-fade-in-up delay-300">
                        <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
                            Login via Secure Link <ArrowRight size={20} style={{ marginLeft: '8px' }} />
                        </button>
                        <button className="btn btn-outline" onClick={() => setShowRegisterModal(true)} style={{ padding: '16px 32px', fontSize: '1.1rem', borderColor: '#CCC' }}>
                            Register as Supervisor
                        </button>
                    </div>
                </div>
                <div className="hero-visual animate-fade-in-up delay-400">
                    {/* Decorative elements */}
                    <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(10,43,115,0.1) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, borderRadius: '50%' }} className="animate-float" />
                    <img src={heroImg} alt="AI Dashboard Mockup" className="hero-image" />
                    <div className="glass-panel animate-float delay-200" style={{ position: 'absolute', bottom: '-20px', left: '-40px', padding: '16px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: '#E6F4EA', color: '#137333', padding: '8px', borderRadius: '50%' }}><Play size={16} fill="currentColor" /></div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#555' }}>Active AI Agent</div>
                            <div style={{ fontWeight: 600, color: '#1A1A1A' }}>Data processed in <span style={{ color: '#0A2B73' }}>1.2s</span></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Badges */}
            <section className="badges-banner">
                <div className="badge-item">
                    <div className="badge-icon"><ShieldCheck size={24} /></div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Strict Role Access</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 400, color: '#888' }}>RBAC for Admin, Supervisor, Student</div>
                    </div>
                </div>
                <div style={{ width: '1px', background: '#E0E0E0', height: '40px' }} className="nav-links" />
                <div className="badge-item">
                    <div className="badge-icon"><Lock size={24} /></div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OTP-Secure Login</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 400, color: '#888' }}>MFA layer via email verification</div>
                    </div>
                </div>
                <div style={{ width: '1px', background: '#E0E0E0', height: '40px' }} className="nav-links" />
                <div className="badge-item">
                    <div className="badge-icon"><Activity size={24} /></div>
                    <div>
                        <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Real-Time Tracking</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 400, color: '#888' }}>Live STOMP sockets for updates</div>
                    </div>
                </div>
            </section>

            {/* Features Base */}
            <section id="features" className="section-wrapper" style={{ background: '#FFF' }}>
                <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 className="heading-lg">Intelligent Academic Infrastructure</h2>
                    <p className="subtitle">Leveraging predictive analytics and structured workflows to drive academic excellence.</p>
                </div>

                <div className="feature-grid">
                    {/* Card 1 */}
                    <div className="glass-card feature-card" style={{ gridColumn: 'span 2', flexDirection: 'row', alignItems: 'center', padding: '0' }}>
                        <div style={{ flex: 1, padding: '48px' }}>
                            <div style={{ width: '48px', height: '48px', background: '#F0F4FF', color: '#0A2B73', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                <Activity size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '16px', color: '#1A1A1A' }}>AI & Predictive Analytics</h3>
                            <p style={{ color: '#555', lineHeight: '1.6', fontSize: '1.1rem' }}>
                                Our RAG-based AI identities project risks before they occur, analyzing synopsis drafts and progress consistency to ensure timely success.
                            </p>
                        </div>
                        <div style={{ flex: 1, height: '100%', minHeight: '300px', background: 'linear-gradient(135deg, #ECF2FF 0%, #FFFFFF 100%)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(10,43,115,0.05) 0%, rgba(255,255,255,0) 70%)' }}></div>
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%230a2b73\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                <Brain size={80} color="#0A2B73" style={{ opacity: 0.1 }} />
                            </div>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="glass-card feature-card" id="workflow">
                        <div style={{ background: '#0A2B73', color: '#FFF', padding: '32px', borderRadius: '16px', height: '100%' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>4-Stage Academic Workflow</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {['Synopsis Approval', 'Progress Review 1', 'Progress Review 2', 'Final Submission'].map((stage, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFF', color: '#0A2B73', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>0{i + 1}</div>
                                        <div style={{ fontWeight: 500 }}>{stage}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="glass-card feature-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ width: '48px', height: '48px', background: '#F0F4FF', color: '#0A2B73', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                <Users size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '16px', color: '#1A1A1A' }}>Smart Team Formation</h3>
                            <p style={{ color: '#555', lineHeight: '1.6', marginBottom: '24px' }}>
                                Automated matching based on student skills, interest clusters, and supervisor expertise.
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E0E7FF', border: '2px solid #FFF', marginLeft: i > 1 ? '-12px' : 0, zIndex: 4 - i, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2B73' }}>
                                    <Users size={16} />
                                </div>
                            ))}
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0A2B73', border: '2px solid #FFF', marginLeft: '-12px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.8rem', fontWeight: 'bold' }}>+5</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Leaderboard */}
            <section id="leaderboard" className="section-wrapper" style={{ background: 'linear-gradient(to bottom, #FFF, #F8F9FA)' }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: '#F0F4FF', color: '#0A2B73', marginBottom: '16px' }}>
                        <Trophy size={32} />
                    </div>
                    <h2 className="heading-lg">Top Ranked Teams</h2>
                    <p className="subtitle">Discover top-tier academic projects with our live scoring system.</p>
                </div>

                <div className="glass-card" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', background: '#FFF' }}>
                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><Loader size="lg" /></div>
                    ) : projects.length === 0 ? (
                        <div style={{ color: '#888', textAlign: 'center', padding: '48px' }}>No projects evaluated yet.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {projects.slice(0, 5).map((proj, index) => (
                                <div key={proj.projectId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', backgroundColor: index < 3 ? '#F0F4FF' : '#FAFAFA', borderRadius: '12px', border: `1px solid ${index < 3 ? '#D2E0FF' : '#EEE'}`, transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => setSelectedProject(proj)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <div style={{ fontSize: '28px', fontWeight: 800, color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#AAA', width: '40px', textAlign: 'center' }}>
                                            #{index + 1}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#1A1A1A' }}>{proj.projectTitle}</h3>
                                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#666' }}>
                                                {proj.projectDescription?.substring(0, 80) || 'No description available'}...
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Score</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0A2B73' }}>{proj.cumulativeScore} <span style={{ fontSize: '1rem', color: '#AAA', fontWeight: 500 }}>/ 40</span></div>
                                        </div>
                                        <ArrowRight size={20} color="#0A2B73" style={{ opacity: 0.5 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Institution Breakdown */}
            <section id="institution" className="section-wrapper" style={{ background: '#F8F9FA' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <h2 className="heading-lg">Tailored for the Institution</h2>
                    <p className="subtitle">Specific interfaces designed for each academic pillar.</p>
                </div>

                <div className="glass-card" style={{ display: 'flex', background: '#FFF' }}>
                    <div style={{ flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0A2B73', marginBottom: '8px' }}>Centralized Governance</h4>
                            <p style={{ color: '#666', lineHeight: '1.5' }}>Manage department-wide deadlines, faculty workloads, and batch-wise progress from a single authoritative dashboard.</p>
                        </div>
                        <div style={{ height: '1px', background: '#EEE' }} />
                        <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '8px' }}>Security & Compliance</h4>
                            <p style={{ color: '#666', lineHeight: '1.5' }}>Role-based access control ensures student data privacy while maintaining complete audit trails for accreditation.</p>
                        </div>
                        <div style={{ height: '1px', background: '#EEE' }} />
                        <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '8px' }}>Resource Optimization</h4>
                            <p style={{ color: '#666', lineHeight: '1.5' }}>AI-driven insights highlight underperforming batches and resource bottlenecks before they impact graduation rates.</p>
                        </div>
                    </div>
                    <div style={{ flex: 1, background: '#E0E7FF' }}>
                        <img src={techImg} alt="Modern University Tech" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section style={{ padding: '100px 5%', background: '#0A2B73', color: '#FFF', textAlign: 'center' }}>
                <h2 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>Ready to elevate your department?</h2>
                <p style={{ fontSize: '1.2rem', color: '#B6C8F2', maxWidth: '600px', margin: '0 auto 48px', lineHeight: '1.6' }}>
                    Join 40+ premier institutions using Chancellor Academia to manage the next generation of breakthroughs.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <button className="btn btn-white" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>Request Institution Demo</button>
                    <button className="btn btn-outline" style={{ padding: '16px 32px', fontSize: '1.1rem', color: '#FFF', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>Institutional Contact</button>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: '64px 5%', background: '#051A49', color: '#889BCE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#FFF' }}>
                        <Brain size={24} />
                        <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>NexYug Tech</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', maxWidth: '300px' }}>Setting the global standard for academic project management through innovation and integrity.</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                    <p>© 2026 NexYug Tech. ALL RIGHTS RESERVED.</p>
                </div>
            </footer>

            {/* PROJECT DETAILS MODAL */}
            {selectedProject && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-card" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', background: '#FFF', padding: '32px' }}>
                        <button onClick={() => setSelectedProject(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                            <X size={24} />
                        </button>

                        <div style={{ marginBottom: '24px', borderBottom: '1px solid #EEE', paddingBottom: '24px' }}>
                            <div style={{ display: 'inline-block', backgroundColor: '#F0F4FF', color: '#0A2B73', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '16px' }}>
                                Total Score: {selectedProject.cumulativeScore}/40
                            </div>
                            <h2 style={{ fontSize: '2rem', margin: '0 0 16px', fontWeight: 800, color: '#1A1A1A' }}>{selectedProject.projectTitle}</h2>
                            <p style={{ color: '#555', lineHeight: '1.6', fontSize: '1.05rem' }}>{selectedProject.projectDescription}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
                            <div style={{ flex: 1, backgroundColor: '#F8F9FA', padding: '24px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', marginBottom: '12px', fontWeight: 600 }}><Users size={18} /> Team Data</div>
                                <div style={{ fontSize: '0.95rem', color: '#1A1A1A', marginBottom: '8px' }}><strong>Leader:</strong> {selectedProject.leaderId || 'Student'}</div>
                                <div style={{ fontSize: '0.95rem', color: '#1A1A1A' }}><strong>Supervisor:</strong> {selectedProject.supervisorId || 'Unassigned'}</div>
                            </div>
                            <div style={{ flex: 1, backgroundColor: '#F8F9FA', padding: '24px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', marginBottom: '12px', fontWeight: 600 }}><Clock size={18} /> Current Phase</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0A2B73' }}>{selectedProject.stageStatus || 'SYNOPSIS'}</div>
                            </div>
                        </div>

                        <h3 style={{ margin: '0 0 20px', fontSize: '1.25rem', fontWeight: 700, color: '#1A1A1A' }}>Evaluation Timeline</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {['synopsisScore', 'progress1Score', 'progress2Score', 'finalScore'].map((scoreField, i) => {
                                const phaseMap = ['Synopsis', 'Progress 1', 'Progress 2', 'Final Submission'];
                                const phaseName = phaseMap[i];
                                const score = selectedProject[scoreField];
                                return (
                                    <div key={phaseName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '1px solid #EEE', borderRadius: '12px', background: score ? '#F0F4FF' : '#FFF' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {score ? <CheckCircle size={20} color="#137333" /> : <Clock size={20} color="#AAA" />}
                                            <span style={{ fontWeight: 600, color: score ? '#0A2B73' : '#666' }}>{phaseName}</span>
                                        </div>
                                        <div style={{ fontWeight: 700, color: score ? '#1A1A1A' : '#AAA' }}>
                                            {score ? `${score}/10` : 'Pending'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* SUPERVISOR REGISTRATION MODAL */}
            {showRegisterModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-card" style={{ width: '90%', maxWidth: '500px', background: '#FFF', padding: '32px', position: 'relative', borderRadius: '16px' }}>
                        <button onClick={() => { setShowRegisterModal(false); setRegStep(1); }} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                            <X size={24} />
                        </button>
                        
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 8px', color: '#1A1A1A' }}>Supervisor Registration</h2>
                        <p style={{ color: '#666', marginBottom: '24px' }}>
                            {regStep === 1 ? 'Enter your details to generate an OTP profile.' : 'Enter the OTP sent to your email to confirm registration.'}
                        </p>

                        {regStep === 1 ? (
                            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>Full Name</label>
                                    <input required name="supervisorName" value={regData.supervisorName} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>Department</label>
                                    <input required name="department" value={regData.department} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>Email</label>
                                    <input required type="email" name="mail" value={regData.mail} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>Phone Number</label>
                                    <input required name="phoneNumber" value={regData.phoneNumber} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>Password</label>
                                    <input required type="password" name="password" value={regData.password} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1rem' }} />
                                </div>
                                <button type="submit" disabled={isRegistering} className="btn btn-primary" style={{ marginTop: '16px', padding: '14px', fontSize: '1.1rem', background: '#0A2B73', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                    {isRegistering ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: '4px' }}>6-Digit OTP</label>
                                    <input required type="text" maxLength={6} name="otp" value={regData.otp} onChange={handleRegChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '1.5rem', letterSpacing: '8px', textAlign: 'center' }} />
                                </div>
                                <button type="submit" disabled={isRegistering} className="btn btn-primary" style={{ marginTop: '16px', padding: '14px', fontSize: '1.1rem', background: '#137333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                    {isRegistering ? 'Verifying...' : 'Verify & Submit'}
                                </button>
                                <button type="button" onClick={() => setRegStep(1)} style={{ background: 'none', border: 'none', color: '#0A2B73', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
                                    Go Back
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
