import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, Input } from '../../components';
import { adminService } from '../../services/adminService';
import { useAuthStore } from '../../utils/authStore';
import { useToastStore } from '../../utils/toastStore';
import type { FormAttachment, FormResponse } from '../../services/adminService';
import type { ProjectResponse } from '../../services/studentService';
import { ArrowLeft, Search, FileText, Users, AlertTriangle, Upload, Paperclip, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
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

export const FormDetails: React.FC = () => {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<FormAttachment[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkStage, setLinkStage] = useState('SYNOPSIS');
  const [uploadStage, setUploadStage] = useState('SYNOPSIS');
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{projectId: string, newSupervisorId: string} | null>(null);
  const [reasonText, setReasonText] = useState('');

  const { user } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);

  const fetchDetails = async () => {
    if (!formId) return;

    try {
      const [formRes, allProjectsRes] = await Promise.all([
        adminService.getForm(formId),
        adminService.getAllProjects()
      ]);

      setFormConfig(formRes);
      setReferenceFiles(parseReferenceFiles(formRes.referenceFilesJson));
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

      const enriched = targetedProjects.map((p: any) => {
           const team = teamsRes.data.find((t: any) => t.teamId === p.teamId);
           let memberDetails: any[] = [];
           if (team) {
                const arr = JSON.parse(team.teamMemberArray || '[]');
                memberDetails = arr.map((sid: string) => {
                    const st = studentsRes.data.find((s:any) => s.studentId === sid);
                    return st || { studentId: sid, name: 'Unknown', mail: 'N/A' };
                });
           }
           return { ...p, team, memberDetails };
      });

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

  const handleUploadAttachments = async () => {
    if (!formId) return;
    if (!selectedFiles.length) {
      addToast('Select one or more files to upload.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        await adminService.uploadFormAttachment(formId, file, uploadStage, user?.id);
      }
      addToast('Reference files uploaded successfully.', 'success');
      setSelectedFiles([]);
      await fetchDetails();
    } catch (err) {
      console.error(err);
      addToast('Failed to upload one or more files.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!formId) return;
    if (!linkName.trim() || !linkUrl.trim()) {
      addToast('Provide a file name and a direct file link.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      await adminService.addFormAttachmentLink(formId, linkName.trim(), linkUrl.trim(), linkStage, user?.id);
      addToast('Reference link added successfully.', 'success');
      setLinkName('');
      setLinkUrl('');
      setLinkStage('SYNOPSIS');
      await fetchDetails();
    } catch (err) {
      console.error(err);
      addToast('Failed to add reference link.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const stageOptions = ['SYNOPSIS', 'PROGRESS1', 'PROGRESS2', 'FINAL', 'ALL'];

  const handleSupervisorSelect = (projectId: string, currentSupervisorId: string, newSupervisorId: string) => {
      if (!newSupervisorId) return; // Prevent empty unassignment
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

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/admin/dashboard')} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>Form Submissions</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Viewing all registered projects for <strong>{formConfig.accessBranch} Batch {formConfig.accessBatch}</strong>.
        </p>
      </div>

      <Card elevation={2} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>Reference Files</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              Upload templates, sample presentations, PDFs, or code references for this form.
            </p>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paperclip size={16} /> {referenceFiles.length} file(s)
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.rar,.java,.js,.ts,.tsx,.py,.c,.cpp,.txt,.md"
            onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
            style={{ padding: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface)' }}
          />
          <select
            value={uploadStage}
            onChange={(e) => setUploadStage(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
          >
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          <Button onClick={handleUploadAttachments} isLoading={isUploading} leftIcon={<Upload size={16} />}>
            Upload Files
          </Button>
        </div>

        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1.6fr 180px auto', gap: '12px', alignItems: 'center' }}>
          <Input
            label="Reference name"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Project_Template.pdf"
          />
          <Input
            label="Google Drive / OneDrive file link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
          />
          <select
            value={linkStage}
            onChange={(e) => setLinkStage(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)', alignSelf: 'end' }}
          >
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          <Button onClick={handleAddLink} isLoading={isUploading} leftIcon={<ExternalLink size={16} />}>
            Add Link
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Selected: {selectedFiles.map((file) => file.name).join(', ')}
          </div>
        )}

        {referenceFiles.length > 0 && (
          <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
            {referenceFiles.map((file) => (
              <div
                key={file.attachmentId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-hover)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="var(--primary)" /> {file.fileName}
                    {file.stage && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                        {file.stage}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Uploaded {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'recently'}
                    {file.uploadedBy ? ` • By ${file.uploadedBy}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                  Preview
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      {projects.length === 0 ? (
        <Card elevation={1} style={{ textAlign: 'center', padding: '64px' }}>
          <Search size={48} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No Submissions Yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Students have not enrolled using this form link yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {projects.map((project: any) => (
            <Card key={project.projectId} elevation={2} style={{ borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '22px', margin: '0 0 8px' }}>{project.projectTitle}</h3>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} /> ID: {project.projectId.slice(0, 8)}
                    </span>
                    <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evaluation Stage</div>
                  <div style={{ fontWeight: 600 }}>{project.stageStatus}</div>
                </div>
              </div>

              <div style={{ padding: '16px 24px', backgroundColor: 'var(--background)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Assign Supervisor:</div>
                   <select 
                      value={project.supervisorId || ''} 
                      onChange={(e) => handleSupervisorSelect(project.projectId, project.supervisorId, e.target.value)}
                      style={{ flex: 1, maxWidth: '400px', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)' }}
                   >
                       <option value="">-- Unassigned --</option>
                       {supervisors.map(sup => (
                           <option key={sup.supervisorId} value={sup.supervisorId}>
                               {sup.name} ({sup.assignedCount} Projects Assigned)
                           </option>
                       ))}
                   </select>
                   {project.supervisorId && <div style={{ fontSize: '12px', color: 'var(--success)' }}>Active Supervisor Notification Sent</div>}
              </div>

              <div style={{ display: 'flex', gap: '24px', padding: '16px 0 0' }}>
                 {/* TEAM MEMBERS PANEL */}
                 <div style={{ flex: 1 }}>
                     <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <Users size={16} color="var(--primary)" /> Enrolled Team Members
                     </h4>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         {project.memberDetails?.map((m: any) => (
                              <div key={m.studentId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                   <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                                        {m.name.charAt(0)}
                                   </div>
                                   <div>
                                       <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {m.name}
                                          {m.studentId === project.team?.leaderId && (
                                              <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '8px' }}>LEADER</span>
                                          )}
                                       </div>
                                       <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.mail}</div>
                                   </div>
                              </div>
                         ))}
                     </div>
                 </div>

                 {/* PROJECT DETAILS PANEL */}
                 <div style={{ flex: 1 }}>
                     <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <FileText size={16} color="var(--primary)" /> Proposal Context
                     </h4>
                     <div style={{ backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap', border: '1px dashed var(--border-color)', height: '100%', maxHeight: '400px', overflowY: 'auto' }}>
                         {project.projectDescription}
                     </div>
                 </div>
              </div>

             </Card>
          ))}
        </div>
      )}

      {/* REASON MODAL */}
      {reasonModalOpen && pendingAssignment && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle color="#f59e0b" size={20} /> Reassign Supervisor
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You are replacing an existing supervisor. A reason is required for administrative tracking and notifications.</p>
                  
                  <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Reason for Change <span style={{color: 'red'}}>*</span></label>
                      <Input 
                          value={reasonText} 
                          onChange={(e) => setReasonText(e.target.value)} 
                          placeholder="E.g., Requested by student, Availability issues..."
                      />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <Button variant="outline" onClick={() => { setReasonModalOpen(false); setPendingAssignment(null); }}>Cancel</Button>
                      <Button 
                          onClick={() => executeAssignSupervisor(pendingAssignment.projectId, pendingAssignment.newSupervisorId, reasonText)}
                          disabled={!reasonText.trim()}
                      >
                          Confirm Reassignment
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default FormDetails;
