import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldCheck, Lock, Activity, Brain, Users, ArrowRight, Play, X,
    Menu, CheckCircle2, Kanban, Calendar, BarChart3, Bell, FileText,
    Sparkles, Zap, GitBranch, ChevronDown, MessageSquare, Clock,
    Layers, Award, Building2
} from 'lucide-react';
import { api } from '../services/api';
import '../styles/landing.css';
import heroImg from '../assets/images/hero.png';
import techImg from '../assets/images/tech.png';
import dpgitmLogo from '../assets/images/dpgitm-logo.png';

/* ---------------------------------------------------------------------- */
/* Static content                                                          */
/* ---------------------------------------------------------------------- */

const NAV_LINKS = ['Features', 'AI Tools', 'Workflow', 'Roles', 'FAQ'];

const DEMO_TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'kanban', label: 'Kanban', icon: Kanban },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'ai', label: 'AI Assistant', icon: Sparkles },
    { key: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type DemoTabKey = typeof DEMO_TABS[number]['key'];

const WORKFLOW_STEPS = [
    { title: 'Create Project', desc: 'Define scope, team, and department in a guided setup.' },
    { title: 'Assign & Plan', desc: 'Break work into tasks, set dependencies and milestones.' },
    { title: 'Track Progress', desc: 'Kanban, calendar, and Gantt views stay in sync automatically.' },
    { title: 'Review & Submit', desc: 'Supervisors review milestones and leave structured feedback.' },
    { title: 'Deliver', desc: 'Final submission, sign-off, and archival in one click.' },
];

const FAQ_ITEMS = [
    {
        q: 'Do I need an account to explore the platform?',
        a: 'No. Use "Explore Demo" to try the dashboard, Kanban board, and AI assistant on sample data with no login required.',
    },
    {
        q: 'Who can register as a supervisor?',
        a: 'Any faculty member of a listed department can request supervisor access. Requests are verified by OTP and approved by an admin.',
    },
    {
        q: 'Is student and project data secure?',
        a: 'All data is encrypted in transit and at rest, with role-based access control and full audit logs for every change.',
    },
    {
        q: 'Can I export reports?',
        a: 'Yes — analytics and project reports can be exported as PDF, Excel, or CSV directly from the reports panel.',
    },
];

/* ---------------------------------------------------------------------- */

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [activeDemoTab, setActiveDemoTab] = useState<DemoTabKey>('dashboard');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        setMobileNavOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    /* ---------------- registration modal state (unchanged logic) ---------------- */
    const [departments, setDepartments] = useState<string[]>([]);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [regStep, setRegStep] = useState<1 | 2>(1);
    const [isRegistering, setIsRegistering] = useState(false);
    const [regData, setRegData] = useState({
        supervisorName: '',
        department: '',
        mail: '',
        phoneNumber: '',
        otp: ''
    });

    useEffect(() => {
        if (showRegisterModal) {
            api.get('/supervisors').then(res => {
                const sups = res.data || [];
                const uniqueDepts = Array.from(new Set(sups.map((s: any) => s.branch).filter(Boolean))) as string[];
                setDepartments(uniqueDepts.length > 0 ? uniqueDepts : ['Computer Science', 'Information Technology', 'Electronics']);
            }).catch(err => {
                console.error(err);
                setDepartments(['Computer Science', 'Information Technology', 'Electronics']);
            });
        }
    }, [showRegisterModal]);

    const handleRegChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setRegData({ ...regData, [e.target.name]: e.target.value });
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRegistering(true);
        try {
            await api.post('/otp/resend', { email: regData.mail, accountType: 'SUPERVISOR' });
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
            await api.post('/otp/verify', { email: regData.mail, code: regData.otp, accountType: 'SUPERVISOR' });
            await api.post('/requests', {
                supervisorName: regData.supervisorName,
                department: regData.department,
                mail: regData.mail,
                phoneNumber: regData.phoneNumber
            });
            alert("Registration successful! Your request has been sent to the Admin for approval.");
            setShowRegisterModal(false);
            setRegStep(1);
            setRegData({ supervisorName: '', department: '', mail: '', phoneNumber: '', otp: '' });
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || "OTP Verification failed.");
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="landing-container">

            {/* ============================== NAVBAR ============================== */}
            <nav className={`dpg-navbar ${scrolled ? 'is-scrolled' : ''}`}>
                <div className="dpg-navbar-inner">
                    <button className="dpg-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <img src={dpgitmLogo} alt="DPGITM logo" />
                        <span className="dpg-nav-brand-text">DPGITM&nbsp;PMS</span>
                    </button>

                    <ul className="dpg-nav-links">
                        {NAV_LINKS.map(link => (
                            <li key={link}>
                                <button onClick={() => scrollToSection(link.toLowerCase().replace(' ', '-'))}>{link}</button>
                            </li>
                        ))}
                    </ul>

                    <div className="dpg-nav-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setShowRegisterModal(true)}>
                            Register as Supervisor
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
                            Login <ArrowRight size={16} />
                        </button>
                        <button className="dpg-nav-toggle" onClick={() => setMobileNavOpen(o => !o)} aria-label="Toggle menu">
                            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                <div className={`dpg-nav-mobile ${mobileNavOpen ? 'is-open' : ''}`}>
                    {NAV_LINKS.map(link => (
                        <button key={link} onClick={() => scrollToSection(link.toLowerCase().replace(' ', '-'))}>{link}</button>
                    ))}
                    <button className="btn btn-outline btn-block" onClick={() => setShowRegisterModal(true)}>
                        Register as Supervisor
                    </button>
                    <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
                        Login <ArrowRight size={16} />
                    </button>
                </div>
            </nav>

            {/* ============================== HERO ============================== */}
            <section className="hero-wrapper">
                <div className="hero-content animate-fade-in-up delay-100">
                    <div className="hero-brand-row">
                        <img src={dpgitmLogo} alt="DPGITM logo" />
                        <div>
                            <div className="hero-brand-name">DPGITM</div>
                            <div className="hero-brand-tag">Project Management System</div>
                        </div>
                    </div>

                    <span className="eyebrow"><Brain size={16} /> AI-Powered Academic Environment</span>

                    <h1 className="heading-xl" style={{ marginTop: '16px' }}>
                        Plan Better. Execute Faster. Deliver Smarter.
                    </h1>

                    <p className="subtitle">
                        Manage teams, submissions, supervisor reviews, meetings, and milestone
                        timelines from one structured academic workspace — built for DPGITM.
                    </p>

                    <div className="hero-cta-group">
                        <button className="btn btn-primary" onClick={() => navigate('/login')}>
                            Login via Secure Link <ArrowRight size={20} />
                        </button>
                        <button className="btn btn-outline" onClick={() => scrollToSection('features')}>
                            <Play size={18} /> Explore Demo
                        </button>
                    </div>
                </div>

                <div className="hero-visual animate-fade-in-up delay-200">
                    <div className="hero-blob" />
                    <img src={heroImg} alt="Product preview" className="hero-image animate-float" />
                    <div className="hero-floating-card glass-panel">
                        <div className="hero-floating-icon"><CheckCircle2 size={18} /></div>
                        <div>
                            <div className="hero-floating-label">Milestone completed</div>
                            <div className="hero-floating-value">Phase 2 <span>· 82%</span></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================= TRUST / QUICK FACTS ========================= */}
            <div className="badges-banner">
                <div className="badge-item">
                    <div className="badge-icon"><ShieldCheck size={22} /></div>
                    <div>
                        <div className="badge-title">Secure by design</div>
                        <div className="badge-desc">Encrypted OTP-verified access</div>
                    </div>
                </div>
                <div className="badge-item">
                    <div className="badge-icon"><Activity size={22} /></div>
                    <div>
                        <div className="badge-title">Live tracking</div>
                        <div className="badge-desc">Real-time project health</div>
                    </div>
                </div>
                <div className="badge-item">
                    <div className="badge-icon"><Brain size={22} /></div>
                    <div>
                        <div className="badge-title">AI assisted</div>
                        <div className="badge-desc">Summaries, risk & reports</div>
                    </div>
                </div>
            </div>

            {/* ========================= INTERACTIVE PRODUCT TOUR ========================= */}
            <section id="ai-tools" className="demo-section">
                <div className="demo-header">
                    <span className="eyebrow" style={{ background: 'rgba(255,255,255,0.1)', color: '#dbe2f7' }}>
                        <Sparkles size={16} /> Product Tour
                    </span>
                    <h2 className="heading-lg" style={{ marginTop: '14px' }}>See it in action</h2>
                    <p className="subtitle">
                        A single workspace for dashboards, boards, teams, and an AI assistant that
                        actually knows your projects.
                    </p>
                </div>

                <div className="demo-shell glass-panel" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="demo-tabs">
                        {DEMO_TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    className={`demo-tab ${activeDemoTab === tab.key ? 'is-active' : ''}`}
                                    onClick={() => setActiveDemoTab(tab.key)}
                                >
                                    <Icon size={16} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="demo-panel">
                        {activeDemoTab === 'dashboard' && (
                            <>
                                <div className="demo-stat-row">
                                    <div className="demo-stat-card">
                                        <div className="demo-stat-label">Active Projects</div>
                                        <div className="demo-stat-value">24</div>
                                    </div>
                                    <div className="demo-stat-card">
                                        <div className="demo-stat-label">Tasks Completed</div>
                                        <div className="demo-stat-value">312</div>
                                    </div>
                                    <div className="demo-stat-card">
                                        <div className="demo-stat-label">Teams</div>
                                        <div className="demo-stat-value">18</div>
                                    </div>
                                    <div className="demo-stat-card">
                                        <div className="demo-stat-label">On-Time Rate</div>
                                        <div className="demo-stat-value">91%</div>
                                    </div>
                                </div>
                                <div className="demo-project">
                                    <div className="demo-project-row">
                                        <span>Project Alpha — Final Year Capstone</span>
                                        <span>82%</span>
                                    </div>
                                    <div className="demo-progress-track">
                                        <div className="demo-progress-fill" style={{ width: '82%' }} />
                                    </div>
                                </div>
                                <div className="demo-project">
                                    <div className="demo-project-row">
                                        <span>MCF Integration Tool</span>
                                        <span>64%</span>
                                    </div>
                                    <div className="demo-progress-track">
                                        <div className="demo-progress-fill is-amber" style={{ width: '64%' }} />
                                    </div>
                                </div>
                                <div className="demo-project">
                                    <div className="demo-project-row">
                                        <span>AI Chatbot Research</span>
                                        <span>97%</span>
                                    </div>
                                    <div className="demo-progress-track">
                                        <div className="demo-progress-fill is-green" style={{ width: '97%' }} />
                                    </div>
                                </div>
                                <p className="demo-panel-caption">Sample data shown — no account required.</p>
                            </>
                        )}

                        {activeDemoTab === 'kanban' && (
                            <>
                                <div className="demo-stat-row">
                                    {['To Do', 'In Progress', 'Review', 'Done'].map((col, i) => (
                                        <div className="demo-stat-card" key={col}>
                                            <div className="demo-stat-label">{col}</div>
                                            <div className="demo-stat-value">{[5, 3, 2, 9][i]}</div>
                                        </div>
                                    ))}
                                </div>
                                <p className="demo-panel-caption">Drag-and-drop cards move instantly across every view — Kanban, list, and calendar stay in sync.</p>
                            </>
                        )}

                        {activeDemoTab === 'team' && (
                            <div className="demo-team-card">
                                <div className="demo-team-header">
                                    <div className="demo-avatars">
                                        <div className="demo-avatar">MB</div>
                                        <div className="demo-avatar">RS</div>
                                        <div className="demo-avatar">AK</div>
                                        <div className="demo-avatar">+4</div>
                                    </div>
                                    <span className="demo-tag">Dept: CSE — AIML</span>
                                </div>
                                <div className="demo-tags">
                                    <span className="demo-tag">Supervisor: Dr. Verma</span>
                                    <span className="demo-tag">7 members</span>
                                    <span className="demo-tag">3 active sprints</span>
                                </div>
                            </div>
                        )}

                        {activeDemoTab === 'ai' && (
                            <div className="demo-chat">
                                <div className="demo-chat-bubble is-user">What's the status of Project Alpha?</div>
                                <div className="demo-chat-bubble is-ai">
                                    Project Alpha is 82% complete and on track for its deadline.
                                    <ul>
                                        <li>2 tasks are overdue in the "Testing" phase</li>
                                        <li>Next milestone: Final Review, due in 6 days</li>
                                        <li>Recommended: reassign 1 overdue task to balance workload</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeDemoTab === 'notifications' && (
                            <div className="demo-notif-list">
                                <div className="demo-notif">
                                    <div className="demo-notif-icon"><Bell size={16} /></div>
                                    <div>
                                        <div className="demo-notif-text">Rahul completed "API integration testing"</div>
                                        <div className="demo-notif-time">2 minutes ago</div>
                                    </div>
                                </div>
                                <div className="demo-notif">
                                    <div className="demo-notif-icon"><Clock size={16} /></div>
                                    <div>
                                        <div className="demo-notif-text">Milestone "Phase 2 Review" is due tomorrow</div>
                                        <div className="demo-notif-time">1 hour ago</div>
                                    </div>
                                </div>
                                <div className="demo-notif">
                                    <div className="demo-notif-icon"><MessageSquare size={16} /></div>
                                    <div>
                                        <div className="demo-notif-text">Dr. Verma commented on "MCF Integration Tool"</div>
                                        <div className="demo-notif-time">3 hours ago</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ============================== FEATURES ============================== */}
            <section id="features" className="section-wrapper">
                <span className="eyebrow">Core Platform</span>
                <h2 className="heading-lg" style={{ marginTop: '14px' }}>Everything a project needs, in one place</h2>
                <p className="subtitle" style={{ margin: '0' }}>
                    From task boards to supervisor sign-off, every stage of a project lives inside
                    a single structured workspace.
                </p>

                <div className="feature-grid">
                    <div className="glass-card feature-card-large">
                        <div className="feature-card-text">
                            <div className="feature-icon"><Kanban size={24} /></div>
                            <div className="feature-title">Kanban, List & Gantt views</div>
                            <p className="feature-desc">
                                Switch between drag-and-drop boards, flat task lists, and dependency-aware
                                Gantt charts — all reading from the same live project data.
                            </p>
                        </div>
                        <div className="feature-card-art">
                            <img src={techImg} alt="Board preview" style={{ width: '80%', borderRadius: '12px', boxShadow: 'var(--dpg-shadow-md)' }} />
                        </div>
                    </div>

                    <div className="glass-card feature-card">
                        <div className="feature-icon is-green"><Calendar size={22} /></div>
                        <div className="feature-title">Calendar & Milestones</div>
                        <p className="feature-desc">See deadlines, meetings, and milestone checkpoints at a glance.</p>
                    </div>

                    <div className="glass-card feature-card">
                        <div className="feature-icon is-amber"><Users size={22} /></div>
                        <div className="feature-title">Team Collaboration</div>
                        <p className="feature-desc">Comments, mentions, and file sharing keep every discussion in context.</p>
                    </div>

                    <div className="feature-card-dark">
                        <div className="feature-icon-on-dark"><Bell size={22} /></div>
                        <div className="feature-title">Real-Time Notifications</div>
                        <p className="feature-desc" style={{ color: '#b6c8f2' }}>
                            Task updates, mentions, and deadline alerts land instantly — no refresh needed.
                        </p>
                    </div>

                    <div className="glass-card feature-card">
                        <div className="feature-icon"><GitBranch size={22} /></div>
                        <div className="feature-title">Task Dependencies</div>
                        <p className="feature-desc">Chain tasks together so blocked work is always visible before it becomes a delay.</p>
                        <div className="avatar-stack">
                            <div className="avatar-chip">A</div>
                            <div className="avatar-chip">B</div>
                            <div className="avatar-chip">C</div>
                            <div className="avatar-chip is-more">+5</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============================== AI FEATURES ============================== */}
            <section className="section-wrapper">
                <span className="eyebrow" style={{ background: 'var(--dpg-amber-100)', color: 'var(--dpg-amber-700)' }}>
                    <Sparkles size={16} /> AI Features
                </span>
                <h2 className="heading-lg" style={{ marginTop: '14px' }}>An assistant that already knows your project</h2>
                <p className="subtitle" style={{ margin: 0 }}>
                    Ask questions, generate tasks, and catch risk before it becomes a missed deadline.
                </p>

                <div className="feature-grid">
                    <div className="glass-card feature-card">
                        <div className="feature-icon is-amber"><MessageSquare size={22} /></div>
                        <div className="feature-title">AI Project Assistant</div>
                        <p className="feature-desc">Ask "What's the status of Project Alpha?" and get a grounded, sourced answer.</p>
                    </div>
                    <div className="glass-card feature-card">
                        <div className="feature-icon is-amber"><Zap size={22} /></div>
                        <div className="feature-title">AI Task Generator</div>
                        <p className="feature-desc">Turn a one-line prompt into a structured, assignable task list.</p>
                    </div>
                    <div className="glass-card feature-card">
                        <div className="feature-icon is-amber"><Activity size={22} /></div>
                        <div className="feature-title">Risk Detection</div>
                        <p className="feature-desc">Delayed or at-risk tasks are flagged automatically, before deadlines slip.</p>
                    </div>
                    <div className="glass-card feature-card">
                        <div className="feature-icon is-amber"><FileText size={22} /></div>
                        <div className="feature-title">Auto Reports</div>
                        <p className="feature-desc">Weekly and monthly summaries generate themselves — export in one click.</p>
                    </div>
                </div>
            </section>

            {/* ============================== WORKFLOW ============================== */}
            <section id="workflow" className="section-wrapper workflow-section">
                <span className="eyebrow">How it works</span>
                <h2 className="heading-lg" style={{ marginTop: '14px' }}>From kickoff to sign-off</h2>
                <p className="subtitle" style={{ margin: 0 }}>Five stages, one continuous workspace.</p>

                <div className="workflow-grid">
                    {WORKFLOW_STEPS.map((step, i) => (
                        <div className="workflow-step" key={step.title}>
                            <div className="workflow-dot">{i + 1}</div>
                            <div className="workflow-step-title">{step.title}</div>
                            <div className="workflow-step-desc">{step.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ============================== INSTITUTION ============================== */}
            <section className="section-wrapper">
                <div className="glass-card institution-card">
                    <div className="institution-text">
                        <span className="eyebrow"><Building2 size={16} /> Built for DPGITM</span>
                        <h2 className="heading-lg" style={{ margin: 0 }}>Made for academic project cycles</h2>

                        <div>
                            <div className="institution-item-title">Structured supervisor review</div>
                            <p className="institution-item-desc">Every submission routes to the right supervisor, with OTP-verified registration and admin approval.</p>
                        </div>
                        <div className="institution-divider" />
                        <div>
                            <div className="institution-item-title">Department-aware</div>
                            <p className="institution-item-desc">Departments, branches, and teams are modeled the way the institute actually runs.</p>
                        </div>
                        <div className="institution-divider" />
                        <div>
                            <div className="institution-item-title">Audit-ready</div>
                            <p className="institution-item-desc">Every change is logged — who did what, and when.</p>
                        </div>
                    </div>
                    <div className="institution-image-col">
                        <img src={techImg} alt="Institution preview" />
                    </div>
                </div>
            </section>

            {/* ============================== ROLES ============================== */}
            <section id="roles" className="section-wrapper">
                <span className="eyebrow">Built for every role</span>
                <h2 className="heading-lg" style={{ marginTop: '14px' }}>One platform, three perspectives</h2>
                <p className="subtitle" style={{ margin: 0 }}>Admins, supervisors, and students each get exactly what they need.</p>

                <div className="roles-grid">
                    <div className="glass-card role-card">
                        <div className="role-badge admin"><ShieldCheck size={22} /></div>
                        <div className="role-title">Admin</div>
                        <p className="role-desc">Full oversight of departments, supervisors, and platform-wide analytics.</p>
                        <ul className="role-list">
                            <li><CheckCircle2 size={16} /> Approve supervisor requests</li>
                            <li><CheckCircle2 size={16} /> Manage roles & permissions</li>
                            <li><CheckCircle2 size={16} /> View audit logs</li>
                        </ul>
                    </div>
                    <div className="glass-card role-card">
                        <div className="role-badge supervisor"><Award size={22} /></div>
                        <div className="role-title">Supervisor</div>
                        <p className="role-desc">Review milestones, leave feedback, and track every team under your guidance.</p>
                        <ul className="role-list">
                            <li><CheckCircle2 size={16} /> Review submissions</li>
                            <li><CheckCircle2 size={16} /> Track team progress</li>
                            <li><CheckCircle2 size={16} /> Schedule meetings</li>
                        </ul>
                    </div>
                    <div className="glass-card role-card">
                        <div className="role-badge student"><Layers size={22} /></div>
                        <div className="role-title">Student</div>
                        <p className="role-desc">Manage tasks, submit milestones, and collaborate with your team in real time.</p>
                        <ul className="role-list">
                            <li><CheckCircle2 size={16} /> Kanban & task tracking</li>
                            <li><CheckCircle2 size={16} /> Submit deliverables</li>
                            <li><CheckCircle2 size={16} /> Chat with your team</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ============================== SECURITY ============================== */}
            <section className="section-wrapper">
                <div className="feature-grid">
                    <div className="feature-card-dark">
                        <div className="feature-icon-on-dark"><Lock size={22} /></div>
                        <div className="feature-title">Encrypted Access</div>
                        <p className="feature-desc" style={{ color: '#b6c8f2' }}>OTP verification and encrypted storage protect every account.</p>
                    </div>
                    <div className="feature-card-dark">
                        <div className="feature-icon-on-dark"><ShieldCheck size={22} /></div>
                        <div className="feature-title">Role-Based Access</div>
                        <p className="feature-desc" style={{ color: '#b6c8f2' }}>Admins, supervisors, and students each see exactly what they should.</p>
                    </div>
                    <div className="feature-card-dark">
                        <div className="feature-icon-on-dark"><Activity size={22} /></div>
                        <div className="feature-title">Full Audit Trail</div>
                        <p className="feature-desc" style={{ color: '#b6c8f2' }}>Every change is timestamped and traceable, end to end.</p>
                    </div>
                </div>
            </section>

            {/* ============================== FAQ ============================== */}
            <section id="faq" className="section-wrapper faq-section">
                <span className="eyebrow">FAQ</span>
                <h2 className="heading-lg" style={{ marginTop: '14px' }}>Frequently asked questions</h2>

                <div className="faq-list">
                    {FAQ_ITEMS.map((item, i) => (
                        <div className={`faq-item ${openFaqIndex === i ? 'is-open' : ''}`} key={item.q}>
                            <button className="faq-question" onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}>
                                {item.q}
                                <ChevronDown size={18} />
                            </button>
                            <div className="faq-answer">
                                <p>{item.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ============================== FINAL CTA ============================== */}
            <section className="cta-section">
                <h2 className="cta-heading">Your next project starts here.</h2>
                <p className="cta-sub">
                    Log in with your DPGITM credentials, or register as a supervisor to get started.
                </p>
                <div className="cta-actions">
                    <button className="btn btn-white" onClick={() => navigate('/login')}>
                        Login via Secure Link <ArrowRight size={20} />
                    </button>
                    <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setShowRegisterModal(true)}>
                        Register as Supervisor
                    </button>
                </div>
            </section>

            {/* ============================== FOOTER ============================== */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={dpgitmLogo} alt="DPGITM logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                        <span style={{ fontWeight: 700, color: '#fff' }}>DPGITM PMS</span>
                    </div>
                    <ul className="footer-links">
                        <li><button onClick={() => scrollToSection('features')}>Features</button></li>
                        <li><button onClick={() => scrollToSection('ai-tools')}>AI Tools</button></li>
                        <li><button onClick={() => scrollToSection('roles')}>Roles</button></li>
                        <li><button onClick={() => scrollToSection('faq')}>FAQ</button></li>
                    </ul>
                    <div className="footer-credit">Powered by — Nexyug Tech</div>
                </div>
            </footer>

            {/* ============================== SUPERVISOR REGISTRATION MODAL ============================== */}
            {showRegisterModal && (
                <div className="modal-overlay">
                    <div className="modal-card glass-card">
                        <button
                            className="modal-close"
                            onClick={() => { setShowRegisterModal(false); setRegStep(1); }}
                            aria-label="Close"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="modal-title">Supervisor Registration</h2>
                        <p className="modal-desc">
                            {regStep === 1 ? 'Enter your details to generate an OTP profile.' : 'Enter the OTP sent to your email to confirm registration.'}
                        </p>

                        {regStep === 1 ? (
                            <form onSubmit={handleSendOtp}>
                                <div className="form-field">
                                    <label>Full Name</label>
                                    <input required name="supervisorName" value={regData.supervisorName} onChange={handleRegChange} />
                                </div>
                                <div className="form-field">
                                    <label>Department</label>
                                    <select required name="department" value={regData.department} onChange={handleRegChange}>
                                        <option value="" disabled>Select a department</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Email</label>
                                    <input required type="email" name="mail" value={regData.mail} onChange={handleRegChange} />
                                </div>
                                <div className="form-field">
                                    <label>Phone Number</label>
                                    <input required name="phoneNumber" value={regData.phoneNumber} onChange={handleRegChange} />
                                </div>
                                <button type="submit" disabled={isRegistering} className="btn btn-primary btn-block" style={{ marginTop: '8px' }}>
                                    {isRegistering ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp}>
                                <div className="form-field">
                                    <label>6-Digit OTP</label>
                                    <input required type="text" maxLength={6} name="otp" value={regData.otp} onChange={handleRegChange} className="otp-input" />
                                </div>
                                <button type="submit" disabled={isRegistering} className="btn btn-primary btn-block" style={{ marginTop: '8px', background: 'var(--dpg-green-700)' }}>
                                    {isRegistering ? 'Verifying...' : 'Verify & Submit'}
                                </button>
                                <button type="button" onClick={() => setRegStep(1)} className="btn btn-ghost btn-block">
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