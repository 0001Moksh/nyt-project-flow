import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { FileText, CheckCircle, Search, ExternalLink, Calendar, MessageSquare, AlertCircle, ThumbsUp, ThumbsDown, Paperclip } from 'lucide-react';
import type { FormAttachment } from '../../services/adminService';
import { getPreviewUrl } from '../../utils/filePreview';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const SupervisorReview: React.FC = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isGradingMode = searchParams.get('grade') === 'true';

    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [activeStage, setActiveStage] = useState('SYNOPSIS');
    const [activeSub, setActiveSub] = useState<any>(null);
    const [referenceFiles, setReferenceFiles] = useState<FormAttachment[]>([]);
    const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);
    
    // Grading Form State
    const [score, setScore] = useState('');
    const [feedback, setFeedback] = useState('');
    const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const addToast = useToastStore(state => state.addToast);

    const matchesStage = (file: FormAttachment, stage?: string) => {
        const value = (file.stage || 'GENERAL').toUpperCase();
        if (!stage) return value === 'ALL' || value === 'GENERAL';
        return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
    };

    useEffect(() => {
        if (projectId) fetchData();
    }, [projectId, activeStage]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
           const pRes = await api.get(`/projects`);
           const proj = pRes.data.find((p:any) => p.projectId === projectId);
           setProject(proj);

           if (proj && proj.documentId) {
               const formRes = await api.get(`/forms/${proj.formId}`).catch(() => ({ data: null }));
               setReferenceFiles(parseReferenceFiles(formRes.data?.referenceFilesJson));

               // Fetch submissions for active stage
               const ep = activeStage.toLowerCase(); // synopsis, progress1, progress2, final
               const subRes = await api.get(`/submissions/${ep}/document/${proj.documentId}`);
               const subs = subRes.data || [];
               setSubmissions(subs);
               if (subs.length > 0) setActiveSub(subs[subs.length - 1]); // Set latest as active preview
           }
           
        } catch(err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!score) return addToast("Score is required", "error");
        
        setIsSubmitting(true);
        try {
            // Update the project's score for this stage
            const scoreField = `${activeStage.toLowerCase()}Score`;
            await api.put(`/projects/${projectId}`, {
                [scoreField]: score
            });

            // Update the submission status if there's an active one
            if (activeSub) {
                const ep = activeStage.toLowerCase();
                await api.patch(`/submissions/${ep}/${activeSub[`${ep}Id`] || activeSub.finalId || activeSub.synopsisId}/supervisor-review`, {
                    approved: decision === 'APPROVE',
                    comment: activeSub.comment + "\n\nSUPERVISOR FEEDBACK: " + feedback,
                    supervisorId: project.supervisorId
                });
            }

            addToast('Evaluation saved successfully', 'success');
            setScore('');
            setFeedback('');
            fetchData();
        } catch (err) {
            addToast('Failed to save evaluation', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:'100px'}}><Loader size="lg" /></div>;
    if (!project) return <div>Project not found</div>;

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header / Breadcrumb navigation */}
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '-8px' }}>
                <span style={{ cursor:'pointer' }} onClick={() => navigate('/supervisor/dashboard')}>Teams</span> / 
                <span style={{ cursor:'pointer', margin: '0 4px' }} onClick={() => navigate(`/supervisor/teams/${project.teamId}`)}>{project.projectTitle}</span> / 
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Deliverable Reviews</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                   <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Submission Review Workspace</h1>
                   <div style={{ display: 'flex', gap: '24px' }}>
                      {['SYNOPSIS', 'PROGRESS1', 'PROGRESS2', 'FINAL'].map(stage => (
                          <div 
                             key={stage} 
                             onClick={() => setActiveStage(stage)}
                             style={{ color: activeStage === stage ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeStage === stage ? 600 : 500, cursor: 'pointer', paddingBottom: '4px', borderBottom: activeStage === stage ? '2px solid var(--primary)' : 'none' }}
                          >
                              {stage}
                          </div>
                      ))}
                   </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 200px)' }}>
                
                {/* Left Pane: Reference + Version History */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {referenceFiles.filter((file) => matchesStage(file, activeStage)).length > 0 && (
                        <Card elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                                <Paperclip size={14} /> Reference Files
                            </h3>
                            {referenceFiles.filter((file) => matchesStage(file, activeStage)).map((file) => (
                                <div
                                    key={file.attachmentId}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}
                                >
                                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{file.fileName}</div>
                                    <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>Preview</Button>
                                </div>
                            ))}
                        </Card>
                    )}

                    <Card elevation={1} style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Upload History</h3>
                        
                        {submissions.length === 0 ? (
                            <div style={{ color: 'var(--text-disabled)', fontSize: '13px', textAlign: 'center', marginTop: '32px' }}>
                                <AlertCircle size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                <br/>No submissions found for {activeStage}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {submissions.map((sub, idx) => {
                                    const isCurrent = activeSub === sub;
                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => setActiveSub(sub)}
                                            style={{ 
                                                padding: '12px', borderRadius: '8px', border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border-color)'}`, 
                                                backgroundColor: isCurrent ? 'var(--surface-hover)' : 'transparent', cursor: 'pointer',
                                                transition: '0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Version {idx + 1}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 600, ...getStatusBadge(sub.status) }}>{sub.status}</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={12} /> {new Date(sub.uploadedAt).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Middle Pane: Preview Mocker */}
                <Card elevation={1} style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', overflow: 'hidden', padding: 0 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px' }}>
                             <FileText size={18} color="var(--primary)" /> Document Preview
                         </div>
                         {activeSub?.fileUrl && (
                             <Button variant="outline" size="sm" onClick={() => window.open(activeSub.fileUrl, '_blank')} leftIcon={<ExternalLink size={14} />}>Open Original</Button>
                         )}
                    </div>
                    
                    <div style={{ flex: 1, backgroundColor: '#e2e8f0', padding: '32px', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
                         {activeSub ? (
                             <div style={{ width: '100%', maxWidth: '800px', backgroundColor: 'white', minHeight: '600px', padding: '48px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderRadius: '4px' }}>
                                 <h2 style={{ fontSize: '24px', fontWeight: 700, borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '24px' }}>
                                     {project.projectTitle} - {activeStage}
                                 </h2>
                                 <h3 style={{ fontSize: '18px', color: '#334155' }}>Submission Details</h3>
                                 <p style={{ marginTop: '16px', whiteSpace: 'pre-wrap', color: '#475569', lineHeight: 1.6 }}>
                                     {activeSub.comment || "No explicit comment provided by the student."}
                                 </p>
                                 
                                 {activeSub.fileUrl ? (
                                     <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#f1f5f9', borderLeft: '4px solid #3b82f6' }}>
                                         <strong>Attached File:</strong> {activeSub.fileName || 'document.pdf'}
                                         <br/><br/>
                                         <a href={activeSub.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 500 }}>Click here to view full document in OneDrive</a>
                                     </div>
                                 ) : (
                                     <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#b91c1c' }}>
                                         No physical file was uploaded with this submission. Only link/text provided.
                                     </div>
                                 )}
                             </div>
                         ) : (
                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-disabled)' }}>
                                 Select a submission from the history to preview.
                             </div>
                         )}
                    </div>
                </Card>

                {/* Right Pane: Evaluation / Grading */}
                <Card elevation={1} style={{ width: '380px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', padding: '24px', overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={20} color="var(--primary)" /> Supervisor Evaluation
                    </h3>

                    {project[`${activeStage.toLowerCase()}Score`] && !isGradingMode ? (
                        <div style={{ padding: '24px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                            <div style={{ color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>EVALUATION COMPLETED</div>
                            <div style={{ fontSize: '48px', fontWeight: 800, color: '#15803d' }}>
                                {project[`${activeStage.toLowerCase()}Score`]}<span style={{ fontSize: '20px', color: '#4ade80' }}>/10</span>
                            </div>
                            <Button style={{ marginTop: '24px', width: '100%' }} variant="outline" onClick={() => navigate(`?grade=true`)}>Edit Assessment</Button>
                        </div>
                    ) : (
                        <form onSubmit={handleEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Milestone Grade (Out of 10)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="10" 
                                    required 
                                    value={score} 
                                    onChange={e => setScore(e.target.value)}
                                    placeholder="Enter score 0-10" 
                                    style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 600, borderRadius: '8px', border: '2px solid var(--border-color)' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Overall Feedback to Team</label>
                                <textarea 
                                    rows={8} 
                                    required 
                                    value={feedback} 
                                    onChange={e => setFeedback(e.target.value)}
                                    placeholder="Provide detailed feedback on the submission. What went well? What needs rework?"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button type="button" variant={decision === 'APPROVE' ? 'primary' : 'outline'} onClick={() => setDecision('APPROVE')} leftIcon={<ThumbsUp size={16} />}>
                                    Approve
                                </Button>
                                <Button type="button" variant={decision === 'REJECT' ? 'primary' : 'outline'} onClick={() => setDecision('REJECT')} leftIcon={<ThumbsDown size={16} />}>
                                    Request Changes
                                </Button>
                            </div>
                            <Button type="submit" isLoading={isSubmitting} size="lg" style={{ marginTop: '8px', width: '100%' }}>{decision === 'APPROVE' ? 'Confirm Approval' : 'Send Back for Revision'}</Button>
                        </form>
                    )}

                </Card>

            </div>

            {previewFile && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        zIndex: 50
                    }}
                    onClick={() => setPreviewFile(null)}
                >
                    <div
                        style={{
                            width: 'min(960px, 96vw)',
                            height: 'min(80vh, 720px)',
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600 }}>{previewFile.fileName}</div>
                            <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>
                                Close
                            </Button>
                        </div>
                        <iframe
                            title={previewFile.fileName}
                            src={getPreviewUrl(previewFile.fileUrl)}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper inside file
function getStatusBadge(status: string) {
    if (status === 'APPROVED') return { color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '8px' };
    if (status === 'REJECTED') return { color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '8px' };
    return { color: '#d97706', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '8px' };
}

export default SupervisorReview;
