import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { CheckCircle, Clock, Link as LinkIcon } from 'lucide-react';

export const SupervisorDashboard: React.FC = () => {
   const [projects, setProjects] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const addToast = useToastStore(state => state.addToast);
   const user = useAuthStore(state => state.user);

   useEffect(() => {
      fetchData();
   }, []);

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const [projectsRes, synopsisRes, prog1Res, prog2Res, finalRes] = await Promise.all([
            api.get('/projects'),
            api.get('/submissions/synopsis'),
            api.get('/submissions/progress1'),
            api.get('/submissions/progress2'),
            api.get('/submissions/final')
         ]);

         const myProjects = (projectsRes.data || []).filter((p: any) => p.supervisorId === user?.id);
         
         // Attach submissions
         const enriched = myProjects.map((p: any) => {
             return {
                 ...p,
                 synopsisSubmissions: (synopsisRes.data || []).filter((s:any) => s.documentId === p.documentId),
                 progress1Submissions: (prog1Res.data || []).filter((s:any) => s.documentId === p.documentId),
                 progress2Submissions: (prog2Res.data || []).filter((s:any) => s.documentId === p.documentId),
                 finalSubmissions: (finalRes.data || []).filter((s:any) => s.documentId === p.documentId),
             }
         });
         
         setProjects(enriched);
      } catch (err) {
         console.error("Failed to load supervisor data", err);
      } finally {
         setIsLoading(false);
      }
   };

   const scoreDeliverable = async (projectId: string, field: string, score: string) => {
       try {
           await api.put(`/projects/${projectId}`, {
               [field]: score
           });
           addToast('Score updated successfully!', 'success');
           fetchData();
       } catch(err) {
           addToast('Failed to apply score', 'error');
       }
   };

   if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;

   return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
         <div>
            <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
               <CheckCircle size={28} color="var(--primary)" /> Supervisor Review Portal
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review team submissions and input scores.</p>
         </div>

         {projects.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                 <p>No projects have been assigned to you yet.</p>
            </Card>
         ) : (
             <div style={{ display: 'grid', gap: '24px' }}>
                 {projects.map(proj => (
                     <Card key={proj.projectId} elevation={2} style={{ borderLeft: '4px solid var(--primary)' }}>
                         <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                             <h3 style={{ fontSize: '20px', margin: '0 0 8px' }}>{proj.projectTitle}</h3>
                             <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>{proj.projectDescription}</p>
                         </div>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                             {/* SYNOPSIS TILE */}
                             <SubmissionReviewTile 
                                title="Synopsis" 
                                subs={proj.synopsisSubmissions} 
                                currentScore={proj.synopsisScore}
                                onScore={(val) => scoreDeliverable(proj.projectId, 'synopsisScore', val)}
                             />
                             {/* PROGRESS 1 */}
                             <SubmissionReviewTile 
                                title="Progress 1" 
                                subs={proj.progress1Submissions} 
                                currentScore={proj.progress1Score}
                                onScore={(val) => scoreDeliverable(proj.projectId, 'progress1Score', val)}
                             />
                             {/* PROGRESS 2 */}
                             <SubmissionReviewTile 
                                title="Progress 2" 
                                subs={proj.progress2Submissions} 
                                currentScore={proj.progress2Score}
                                onScore={(val) => scoreDeliverable(proj.projectId, 'progress2Score', val)}
                             />
                             {/* FINAL */}
                             <SubmissionReviewTile 
                                title="Final Submission" 
                                subs={proj.finalSubmissions} 
                                currentScore={proj.finalScore}
                                onScore={(val) => scoreDeliverable(proj.projectId, 'finalScore', val)}
                             />
                         </div>
                     </Card>
                 ))}
             </div>
         )}
      </div>
   );
};

// Sub-component for individual review blocks
const SubmissionReviewTile = ({ title, subs, currentScore, onScore }: { title: string, subs: any[], currentScore: string, onScore: (val: string) => void }) => {
    const hasSubmission = subs && subs.length > 0;
    const latest = hasSubmission ? subs[subs.length - 1] : null;

    return (
        <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: hasSubmission ? 'var(--surface)' : 'var(--surface-hover)'}}>
            <h4 style={{ margin: '0 0 12px', color: hasSubmission ? 'var(--text-primary)' : 'var(--text-disabled)' }}>{title}</h4>
            
            {hasSubmission ? (
                <>
                   <a href={latest.comment} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '4px', textDecoration: 'none', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
                      <LinkIcon size={14} /> View Document
                   </a>

                   {currentScore ? (
                       <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                           Score: {currentScore}/10
                       </div>
                   ) : (
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="number" min="0" max="10" placeholder="/10" id={`score-${title}`} style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                          <Button size="sm" onClick={() => {
                              const input = document.getElementById(`score-${title}`) as HTMLInputElement;
                              if (input.value) onScore(input.value);
                          }}>Grade</Button>
                       </div>
                   )}
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-disabled)', gap: '8px', padding: '16px 0' }}>
                   <Clock size={20} />
                   <span style={{ fontSize: '12px' }}>Awaiting Upload</span>
                </div>
            )}
        </div>
    );
};

export default SupervisorDashboard;
