import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, Input, ProjectTimeline } from '../../components';
import { adminService, type Template } from '../../services/adminService';
import { useAuthStore } from '../../utils/authStore';
import { useToastStore } from '../../utils/toastStore';
import type { FormResponse } from '../../services/adminService';
import { Search, FileText, Users, AlertTriangle, Upload, Paperclip, ExternalLink, Plus, Link as LinkIcon, Trash2, X, File, Presentation, Eye, MoreVertical, Calendar, Video } from 'lucide-react';
import { TimelineConfigModal } from './TimelineConfigModal';
import { MeetingManagementPanel } from './MeetingManagementPanel';
import { api } from '../../services/api';
import { extractFirstUrl, getPreviewUrl } from '../../utils/filePreview';

const STAGES = [
  { key: 'SYNOPSIS', label: 'Synopsis' },
  { key: 'PROGRESS1', label: 'Progress 1' },
  { key: 'PROGRESS2', label: 'Progress 2' },
  { key: 'FINAL', label: 'Final Submission' },
  { key: 'GENERAL', label: 'General / All' }
];

const submissionStages = [
  { key: 'SYNOPSIS', endpoint: 'synopsis' },
  { key: 'PROGRESS1', endpoint: 'progress1' },
  { key: 'PROGRESS2', endpoint: 'progress2' },
  { key: 'FINAL', endpoint: 'final' }
];

const getSubmissionId = (submission: any, endpoint: string) =>
  submission[`${endpoint}Id`] || submission.finalId || submission.synopsisId || submission.progress1Id || submission.progress2Id;

const fetchProjectSubmissions = async (documentId?: string | null) => {
  if (!documentId) return [];

  const responses = await Promise.all(
    submissionStages.map(async (stage) => {
      const response = await api.get(`/submissions/${stage.endpoint}/document/${documentId}`).catch(() => ({ data: [] }));
      return (response.data || []).map((submission: any) => ({
        ...submission,
        stage: stage.key,
        submissionId: getSubmissionId(submission, stage.endpoint)
      }));
    })
  );

  return responses
    .flat()
    .sort((a: any, b: any) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
};

const getCompletionPercentage = (stageStatus: string) => {
  switch (stageStatus) {
    case 'SYNOPSIS': return 25;
    case 'PROGRESS1': return 50;
    case 'PROGRESS2': return 75;
    case 'FINAL': return 100;
    default: return 0;
  }
};

const getStageLabel = (key: string) => {
  const stage = STAGES.find(s => s.key === key);
  return stage ? stage.label : key;
};

export const FormDetails: React.FC = () => {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Template State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeStageTab, setActiveStageTab] = useState('SYNOPSIS');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateInputMode, setTemplateInputMode] = useState<'upload' | 'link'>('upload');
  const [tName, setTName] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tFile, setTFile] = useState<File | null>(null);
  const [tLinkUrl, setTLinkUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Modals & Preview
  const [previewFileUrl, setPreviewFileUrl] = useState<{ url: string, name: string } | null>(null);
  const [viewCompleteProject, setViewCompleteProject] = useState<any | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ projectId: string, newSupervisorId: string } | null>(null);
  const [reasonText, setReasonText] = useState('');

  // Dropdown & Modal State
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isStageTemplatesOpen, setIsStageTemplatesOpen] = useState(false);
  const [isMeetingPanelOpen, setIsMeetingPanelOpen] = useState(false);

  const { user } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDetails = async () => {
    if (!formId) return;

    try {
      const [formRes, allProjectsRes, templatesRes, oldAttachmentsRes] = await Promise.all([
        adminService.getForm(formId),
        adminService.getAllProjects(),
        adminService.getTemplates(formId).catch(() => []),
        adminService.getFormAttachments(formId).catch(() => [])
      ]);

      const mappedLegacyTemplates: Template[] = (oldAttachmentsRes || []).map((att: any) => {
        let type = 'OTHER';
        if (att.fileName && att.fileName.includes('.')) {
          type = att.fileName.split('.').pop().toUpperCase();
        } else if (att.source === 'LINK') {
          type = 'DRIVE_LINK';
        }

        let stage = att.stage;
        if (!stage || stage === 'ALL') stage = 'GENERAL';

        return {
          id: att.attachmentId,
          formId: formId,
          stageId: stage,
          name: att.fileName,
          description: '',
          type: type,
          sourceType: att.source || 'UPLOAD',
          fileUrl: att.fileUrl,
          createdAt: att.uploadedAt || new Date().toISOString()
        } as Template;
      });

      setFormConfig(formRes);
      setTemplates([...templatesRes, ...mappedLegacyTemplates]);
      const targetedProjects = allProjectsRes.filter((p: any) => p.formId === formId);

      const [teamsRes, studentsRes, supervisorsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/students'),
        api.get('/supervisors')
      ]);

      const sups = supervisorsRes.data.map((sup: any) => ({
        ...sup,
        assignedCount: allProjectsRes.filter((p: any) => p.supervisorId === sup.supervisorId).length
      }));
      setSupervisors(sups);

      const enriched = await Promise.all(targetedProjects.map(async (p: any) => {
        const team = teamsRes.data.find((t: any) => t.teamId === p.teamId);
        let memberDetails: any[] = [];
        if (team) {
          const arr = JSON.parse(team.teamMemberArray || '[]');
          memberDetails = arr.map((sid: string) => {
            const st = studentsRes.data.find((s: any) => s.studentId === sid);
            return st || { studentId: sid, name: 'Unknown', mail: 'N/A' };
          });
        }
        const studentSubmissions = await fetchProjectSubmissions(p.documentId);
        return { ...p, team, memberDetails, studentSubmissions };
      }));

      setProjects(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [formId]);

  const handleSaveTemplate = async () => {
    if (!formId) return;
    if (!tName.trim()) {
      addToast('Template name is required.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      if (templateInputMode === 'upload') {
        if (!tFile) {
          addToast('Please select a file to upload.', 'error');
          setIsUploading(false);
          return;
        }
        await adminService.uploadTemplate(formId, activeStageTab, tName, tDesc, tFile);
      } else {
        if (!tLinkUrl.trim()) {
          addToast('Please provide a drive link.', 'error');
          setIsUploading(false);
          return;
        }
        // Basic drive link validation
        if (!tLinkUrl.includes('drive.google.com') && !tLinkUrl.includes('onedrive.live.com') && !tLinkUrl.includes('sharepoint.com')) {
          addToast('Link must be a Google Drive or OneDrive URL.', 'error');
          setIsUploading(false);
          return;
        }
        await adminService.addTemplateLink(formId, activeStageTab, tName, tDesc, tLinkUrl);
      }

      addToast('Template added successfully.', 'success');
      closeTemplateModal();
      await fetchDetails();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to add template.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const confirmed = window.confirm('Delete this template? This cannot be undone.');
    if (!confirmed) return;
    try {
      if (templateId.startsWith('att_')) {
        await adminService.deleteFormAttachment(formId!, templateId);
      } else {
        await adminService.deleteTemplate(templateId);
      }
      addToast('Template deleted successfully.', 'success');
      await fetchDetails();
    } catch (err) {
      console.error(err);
      addToast('Failed to delete template.', 'error');
    }
  };

  const closeTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setTName('');
    setTDesc('');
    setTFile(null);
    setTLinkUrl('');
    setTemplateInputMode('upload');
  };

  const handleSupervisorSelect = (projectId: string, currentSupervisorId: string, newSupervisorId: string) => {
    if (!newSupervisorId) return;
    if (currentSupervisorId && currentSupervisorId !== newSupervisorId) {
      setPendingAssignment({ projectId, newSupervisorId });
      setReasonText('');
      setReasonModalOpen(true);
    } else {
      executeAssignSupervisor(projectId, newSupervisorId, '');
    }
  };

  const executeAssignSupervisor = async (projectId: string, supervisorId: string, reason: string) => {
    try {
      await api.post(`/projects/${projectId}/assign-supervisor`, {
        supervisorId,
        adminId: user?.id,
        reason
      });
      setProjects(projects.map(p => p.projectId === projectId ? { ...p, supervisorId } : p));
      setSupervisors(supervisors.map(s => {
        if (s.supervisorId === supervisorId) return { ...s, assignedCount: s.assignedCount + 1 };
        return s;
      }));
      if (viewCompleteProject && viewCompleteProject.projectId === projectId) {
        setViewCompleteProject({ ...viewCompleteProject, supervisorId });
      }
      addToast('Supervisor Assignment Updated successfully.', 'success');
      setReasonModalOpen(false);
      setPendingAssignment(null);
    } catch (err: any) {
      console.error("Failed to assign supervisor", err);
      addToast(err.response?.data?.message || 'Failed to assign supervisor.', 'error');
    }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '64px' }}><Loader size="lg" /></div>;
  if (!formConfig) return <div style={{ textAlign: 'center', padding: '64px', color: 'var(--danger)' }}><h1>Form Not Found</h1></div>;

  const currentStageTemplates = templates.filter(t => t.stageId === activeStageTab);

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}> Viewing config for <strong>{formConfig.accessBranch} Batch {formConfig.accessBatch}</strong>.</h1>
        
        <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" onClick={() => setIsTimelineModalOpen(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} /> Stage Calendar
            </Button>
            <Button variant="outline" onClick={() => setIsMeetingPanelOpen(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={16} /> Meeting Sessions
            </Button>
            <Button variant="primary" onClick={() => setIsStageTemplatesOpen(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Stage Templates
            </Button>
        </div>
      </div>

      {/* STAGE TEMPLATES PANEL */}
      {isStageTemplatesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 900 }} onClick={() => setIsStageTemplatesOpen(false)}>
          <div style={{ width: '800px', maxWidth: '90vw', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10, padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>Stage Requirements / Templates</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>Upload reference templates that students should follow.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setIsTemplateModalOpen(true)}>
                    Add Template
                  </Button>
                  <button onClick={() => setIsStageTemplatesOpen(false)} style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <X size={20} />
                  </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
              {STAGES.map((stage, idx) => {
                const count = templates.filter(t => t.stageId === stage.key).length;
                if (stage.key === 'GENERAL' && count === 0) return null; // Only show GENERAL tab if there are legacy/general templates
                const isActive = activeStageTab === stage.key;
                return (
                  <div
                    key={stage.key}
                    onClick={() => setActiveStageTab(stage.key)}
                    style={{
                      flex: 1,
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                      borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: isActive ? 'var(--primary)' : '#e5e7eb', color: isActive ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px' }}>{stage.label}</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>{count} templates</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Templates Grid */}
            <div style={{ padding: '24px', flex: 1, backgroundColor: 'var(--background)' }}>
              <h3 style={{ fontSize: '15px', margin: '0 0 16px' }}>Templates for {getStageLabel(activeStageTab)}</h3>

              {currentStageTemplates.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)' }}>
                  <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <div>No templates added for this stage yet.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {currentStageTemplates.map(template => (
                    <div key={template.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface)' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {template.type === 'PDF' ? <FileText color="#ef4444" size={32} /> :
                          template.type === 'PPTX' || template.type === 'PPT' ? <Presentation color="#f97316" size={32} /> :
                            template.type === 'DRIVE_LINK' ? <LinkIcon color="#10b981" size={32} /> :
                              <File color="#3b82f6" size={32} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>{template.name}</h4>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>{template.type}</span>
                          </div>
                          {template.description && <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{template.description}</p>}
                          <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
                            {template.sourceType === 'LINK' ? 'Added via link' : `Uploaded ${new Date(template.createdAt).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                        <Button variant="outline" size="sm" style={{ flex: 1 }} leftIcon={<Eye size={14} />} onClick={() => setPreviewFileUrl({ url: getPreviewUrl(template.fileUrl), name: template.name })}>Preview</Button>
                        <Button variant="outline" size="sm" style={{ flex: 1 }} leftIcon={template.sourceType === 'LINK' ? <ExternalLink size={14} /> : <Upload size={14} style={{ transform: 'rotate(180deg)' }} />} onClick={() => window.open(template.fileUrl, '_blank')}>
                          {template.sourceType === 'LINK' ? 'Open' : 'Download'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)} style={{ color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROJECT MANAGEMENT TABLE */}
      <Card elevation={1} style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>All Projects ({projects.length})</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>View and manage all projects created from this form.</p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <tr>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>#</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Project Name</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Current Stage</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Assigned Supervisor</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Completion</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No projects found.</td></tr>
              )}
              {projects.map((project, idx) => {
                const completion = getCompletionPercentage(project.stageStatus);
                const sup = supervisors.find(s => s.supervisorId === project.supervisorId);
                return (
                  <tr key={project.projectId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{(idx + 1).toString().padStart(2, '0')}</td>
                    <td style={{ padding: '16px', fontWeight: 600 }}>{project.projectTitle}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600 }}>
                        {getStageLabel(project.stageStatus)}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {sup ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{sup.name.charAt(0)}</div>
                          {sup.name}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: 600 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '13px', width: '35px' }}>{completion}%</div>
                        <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--surface-hover)', borderRadius: '3px' }}>
                          <div style={{ width: `${completion}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => setViewCompleteProject(project)}>
                        View Complete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ADD TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <Card elevation={2} style={{ width: '550px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Add Template for {getStageLabel(activeStageTab)}</h2>
              <button onClick={closeTemplateModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <Input label="Template Name *" value={tName} onChange={e => setTName(e.target.value)} placeholder="e.g. Idea Submission Format" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Description</label>
              <textarea
                value={tDesc}
                onChange={e => setTDesc(e.target.value)}
                placeholder="What should students follow in this template?"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)', minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div
                onClick={() => setTemplateInputMode('upload')}
                style={{ padding: '12px 24px', cursor: 'pointer', borderBottom: templateInputMode === 'upload' ? '2px solid var(--primary)' : '2px solid transparent', color: templateInputMode === 'upload' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: templateInputMode === 'upload' ? 600 : 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> Upload File
              </div>
              <div
                onClick={() => setTemplateInputMode('link')}
                style={{ padding: '12px 24px', cursor: 'pointer', borderBottom: templateInputMode === 'link' ? '2px solid var(--primary)' : '2px solid transparent', color: templateInputMode === 'link' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: templateInputMode === 'link' ? 600 : 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LinkIcon size={16} /> Add Drive Link
              </div>
            </div>

            {templateInputMode === 'upload' ? (
              <div
                style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '32px', textAlign: 'center', marginBottom: '24px', backgroundColor: 'var(--background)', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) setTFile(e.target.files[0]);
                  }}
                />
                <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {tFile ? tFile.name : 'Drag & drop files here or click to browse'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Supported: PDF, PPTX, DOCX, ZIP • Max size: 25MB</div>
              </div>
            ) : (
              <div style={{ marginBottom: '24px' }}>
                <Input label="Google Drive or OneDrive Link *" value={tLinkUrl} onChange={e => setTLinkUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} color="#f59e0b" /> Make sure link is accessible to "Anyone with the link".
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="outline" onClick={closeTemplateModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveTemplate} isLoading={isUploading}>Save Template</Button>
            </div>
          </Card>
        </div>
      )}

      {/* FULL PROJECT VIEW MODAL */}
      {viewCompleteProject && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 900 }}>
          <div style={{ width: '800px', maxWidth: '90vw', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10, padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '24px' }}>{viewCompleteProject.projectTitle}</h2>
                  <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{viewCompleteProject.status.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> ID: {viewCompleteProject.projectId}</span>
                  <span>Stage: <strong>{getStageLabel(viewCompleteProject.stageStatus)}</strong></span>
                </div>
              </div>
              <button onClick={() => setViewCompleteProject(null)} style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ padding: '16px 24px', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Assign Supervisor:</div>
                <select
                  value={viewCompleteProject.supervisorId || ''}
                  onChange={(e) => handleSupervisorSelect(viewCompleteProject.projectId, viewCompleteProject.supervisorId, e.target.value)}
                  style={{ flex: 1, maxWidth: '400px', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
                >
                  <option value="">-- Unassigned --</option>
                  {supervisors.map(sup => (
                    <option key={sup.supervisorId} value={sup.supervisorId}>
                      {sup.name} ({sup.assignedCount} Projects Assigned)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <ProjectTimeline project={viewCompleteProject} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={16} color="var(--primary)" /> Team Members</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewCompleteProject.memberDetails?.map((m: any) => (
                      <div key={m.studentId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>{m.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {m.name}
                            {m.studentId === viewCompleteProject.team?.leaderId && <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '8px' }}>LEADER</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.mail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Paperclip size={16} color="var(--primary)" /> Submissions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewCompleteProject.studentSubmissions?.length ? viewCompleteProject.studentSubmissions.map((submission: any) => {
                      const submissionUrl = submission.fileUrl || extractFirstUrl(submission.comment);
                      return (
                        <div key={submission.submissionId} style={{ padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>{getStageLabel(submission.stage)}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {submission.uploadedAt ? new Date(submission.uploadedAt).toLocaleDateString() : 'Recent'} • {submission.status}
                              </div>
                            </div>
                            {submissionUrl && (
                              <Button size="sm" variant="outline" onClick={() => window.open(getPreviewUrl(submissionUrl), '_blank')} leftIcon={<ExternalLink size={14} />}>Open</Button>
                            )}
                          </div>
                          {submission.comment && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-word', backgroundColor: 'var(--background)', padding: '8px', borderRadius: '4px' }}>{submission.comment}</div>}
                        </div>
                      );
                    }) : (
                      <div style={{ padding: '12px', color: 'var(--text-disabled)', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>No submissions yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} color="var(--primary)" /> Proposal Context</h4>
                <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {viewCompleteProject.projectDescription}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FILE PREVIEW OVERLAY */}
      {previewFileUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1050 }} onClick={() => setPreviewFileUrl(null)}>
          <div style={{ width: 'min(960px, 96vw)', height: 'min(80vh, 720px)', backgroundColor: 'var(--surface)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600 }}>{previewFileUrl.name}</div>
              <Button size="sm" variant="outline" onClick={() => setPreviewFileUrl(null)}>Close</Button>
            </div>
            <iframe title={previewFileUrl.name} src={previewFileUrl.url} style={{ width: '100%', height: '100%', border: 'none' }} />
          </div>
        </div>
      )}

      {/* REASON MODAL */}
      {reasonModalOpen && pendingAssignment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle color="#f59e0b" size={20} /> Reassign Supervisor</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You are replacing an existing supervisor. A reason is required for administrative tracking.</p>
            <div style={{ marginTop: '16px', marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Reason <span style={{ color: 'red' }}>*</span></label>
              <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Requested by student..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="outline" onClick={() => { setReasonModalOpen(false); setPendingAssignment(null); }}>Cancel</Button>
              <Button onClick={() => executeAssignSupervisor(pendingAssignment.projectId, pendingAssignment.newSupervisorId, reasonText)} disabled={!reasonText.trim()}>Confirm Reassignment</Button>
            </div>
          </div>
        </div>
      )}
      {/* TIMELINE CONFIG MODAL */}
      {isTimelineModalOpen && formId && (
        <TimelineConfigModal onClose={() => setIsTimelineModalOpen(false)} formId={formId} />
      )}

      {/* MEETING MANAGEMENT PANEL */}
      {isMeetingPanelOpen && formId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 900 }} onClick={() => setIsMeetingPanelOpen(false)}>
          <div style={{ width: '800px', maxWidth: '90vw', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10, padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>Meeting Management</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>Overview of batch meeting sessions.</p>
                </div>
                <button onClick={() => setIsMeetingPanelOpen(false)} style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={20} />
                </button>
            </div>
            <div style={{ padding: '24px', flex: 1, backgroundColor: 'var(--background)' }}>
                <MeetingManagementPanel formId={formId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormDetails;
