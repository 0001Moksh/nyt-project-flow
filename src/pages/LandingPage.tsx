import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Loader } from '../components';
import { api } from '../services/api';
import { Trophy, ArrowRight, X, Users, CheckCircle, Clock } from 'lucide-react';

export const LandingPage: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLeaderboard = async () => {
             setIsLoading(true);
             try {
                // Fetch public projects and structure them
                // We'll mock the 'score' by summarizing available scores locally since project doesn't have an aggregated float natively easily.
                const { data: projData } = await api.get('/projects');
                const scoredProjects = (projData || []).map((p: any) => {
                     // Compute a mock total score for the leaderboard layout
                     const s1 = parseInt(p.synopsisScore || '0');
                     const s2 = parseInt(p.progress1Score || '0');
                     const s3 = parseInt(p.progress2Score || '0');
                     const s4 = parseInt(p.finalScore || '0');
                     const total = s1 + s2 + s3 + s4;
                     return { ...p, cumulativeScore: total };
                }).sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);

                setProjects(scoredProjects);
             } catch(err) {
                console.error("Failed to load leaderboard");
             } finally {
                setIsLoading(false);
             }
        };
        fetchLeaderboard();
    }, []);

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px'}}><Loader size="lg" /></div>;

    return (
        <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* HEROBANNER */}
            <div style={{ textAlign: 'center', padding: '64px 0', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundImage: 'linear-gradient(to bottom right, var(--surface), var(--surface-hover))' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', marginBottom: '16px' }}>
                     <Trophy size={48} color="var(--primary)" />
                </div>
                <h1 style={{ fontSize: '48px', margin: '0 0 16px', color: 'var(--text-primary)' }}>College Project Leaderboard</h1>
                <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 32px' }}>
                    Discover top-tier academic projects, review methodologies, and witness real-time progress timelines built by our engineering cohorts.
                </p>
                <Button size="lg" onClick={() => navigate('/login')}>Sign In to Dashboard <ArrowRight size={18} style={{ marginLeft: '8px' }} /></Button>
            </div>

            {/* LEADERBOARD TABLE */}
            <Card elevation={2}>
                 <h2 style={{ fontSize: '24px', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={24} color="var(--warning)" /> Top Ranked Teams
                 </h2>

                 {projects.length === 0 ? (
                     <div style={{ color: 'var(--text-disabled)', textAlign: 'center', padding: '48px' }}>No projects evaluated yet.</div>
                 ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                         {projects.map((proj, index) => (
                             <div key={proj.projectId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', backgroundColor: index < 3 ? 'var(--primary-glow)' : 'var(--surface-hover)', borderRadius: '12px', border: `1px solid ${index < 3 ? 'var(--primary)' : 'var(--border-color)'}`}}>
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                      <div style={{ fontSize: '32px', fontWeight: 800, color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--text-disabled)', width: '40px', textAlign: 'center' }}>
                                          #{index + 1}
                                      </div>
                                      <div>
                                          <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{proj.projectTitle}</h3>
                                          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)'}}>
                                               {proj.projectDescription.substring(0, 80)}...
                                          </p>
                                      </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                      <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</div>
                                          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{proj.cumulativeScore} <span style={{fontSize: '14px', color: 'var(--text-disabled)'}}>/ 40</span></div>
                                      </div>
                                      <Button variant="outline" onClick={() => setSelectedProject(proj)}>View Details</Button>
                                  </div>

                             </div>
                         ))}
                     </div>
                 )}
            </Card>

            {/* PROJECT DETAILS MODAL */}
            {selectedProject && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                     <Card style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', border: '1px solid var(--border-color)' }}>
                         <button onClick={() => setSelectedProject(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                             <X size={24} />
                         </button>
                         
                         <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                             <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                                Score: {selectedProject.cumulativeScore}/40
                             </div>
                             <h2 style={{ fontSize: '28px', margin: '0 0 12px' }}>{selectedProject.projectTitle}</h2>
                             <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{selectedProject.projectDescription}</p>
                         </div>

                         <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                              <div style={{ flex: 1, backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}><Users size={18} /> Team Data</div>
                                   <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)'}}>Leader Authored: {selectedProject.leaderId || 'Student'}</div>
                                   <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)'}}>Supervisor: {selectedProject.supervisorId || 'Unassigned'}</div>
                              </div>
                              <div style={{ flex: 1, backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}><Clock size={18} /> Current Phase</div>
                                   <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)'}}>{selectedProject.stageStatus || 'SYNOPSIS'}</div>
                              </div>
                         </div>

                         <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Evaluation Timeline</h3>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                             {['synopsisScore', 'progress1Score', 'progress2Score', 'finalScore'].map((scoreField, i) => {
                                 const phaseMap = ['Synopsis', 'Progress 1', 'Progress 2', 'Final Submission'];
                                 const phaseName = phaseMap[i];
                                 const score = selectedProject[scoreField];
                                 return (
                                     <div key={phaseName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                             {score ? <CheckCircle size={20} color="var(--success)" /> : <Clock size={20} color="var(--text-disabled)" />}
                                             <span style={{ fontWeight: 500 }}>{phaseName}</span>
                                         </div>
                                         <div style={{ fontWeight: 600, color: score ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                                             {score ? `${score}/10` : 'Pending'}
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                     </Card>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
