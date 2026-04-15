import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from './index';
import { api } from '../services/api';
import { useToastStore } from '../utils/toastStore';
import { useAuthStore } from '../utils/authStore';
import { UploadCloud, Link as LinkIcon, FileText, CheckCircle, XCircle, Users } from 'lucide-react';
import type { FormAttachment } from '../services/adminService';
import { getPreviewUrl } from '../utils/filePreview';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface DeliverableUploaderProps {
  projectId: string;
  documentId: string;
  currentStage: string;
  isLeader: boolean;
  onSuccess: () => void;
}

export const DeliverableUploader: React.FC<DeliverableUploaderProps> = ({
  projectId, documentId, currentStage, isLeader, onSuccess
}) => {
  const [comment, setComment] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmissions, setExistingSubmissions] = useState<any[]>([]);
  const [team, setTeam] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [referenceFiles, setReferenceFiles] = useState<FormAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore(state => state.addToast);
  const user = useAuthStore(state => state.user);

  // Map Project 'stageStatus' enum to the correct Submission endpoint
  const getEndpoint = () => {
    switch (currentStage) {
      case 'SYNOPSIS': return '/submissions/synopsis';
      case 'PROGRESS1': return '/submissions/progress1';
      case 'PROGRESS2': return '/submissions/progress2';
      case 'FINAL': return '/submissions/final';
      default: return null;
    }
  };

  useEffect(() => {
    const fetchSubmissions = async () => {
      const endpoint = getEndpoint();
      if (!endpoint || !documentId) return;
      try {
        const { data } = await api.get(`${endpoint}/document/${documentId}`);
        setExistingSubmissions(data || []);
      } catch (err) {
        console.error("No submissions found yet.");
      }
    };

    const fetchProjectContext = async () => {
      try {
        const [projectRes, teamRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/teams`).catch(() => ({ data: [] }))
        ]);
        setProject(projectRes.data || null);
        const thisTeam = (teamRes.data || []).find((item: any) => item.teamId === projectRes.data?.teamId);
        setTeam(thisTeam || null);
        if (projectRes.data?.formId) {
          const formRes = await api.get(`/forms/${projectRes.data.formId}`).catch(() => ({ data: null }));
          setReferenceFiles(parseReferenceFiles(formRes.data?.referenceFilesJson));
        }
      } catch {
        setProject(null);
        setTeam(null);
      }
    };

    fetchSubmissions();
    fetchProjectContext();
  }, [documentId, currentStage]);

  const latestSubmission = existingSubmissions[existingSubmissions.length - 1] || null;
  const latestSubmissionId = latestSubmission ? latestSubmission[`${currentStage.toLowerCase()}Id`] : null;
  const teamMemberIds = (() => {
    try {
      return team?.teamMemberArray ? JSON.parse(team.teamMemberArray) : [];
    } catch {
      return [];
    }
  })();
  const isTeamMember = Boolean(user?.id) && (isLeader || teamMemberIds.includes(user?.id));
  const alreadyVoted = latestSubmission?.teamReviewJson
    ? (() => {
      try {
        const votes = JSON.parse(latestSubmission.teamReviewJson || '[]');
        return votes.some((vote: any) => vote.reviewerId === user?.id);
      } catch {
        return false;
      }
    })()
    : false;
  const canUploadRevision = isLeader && (!latestSubmission || ['REJECTED', 'REVISION'].includes((latestSubmission.status || '').toUpperCase()));
  const canTeamReview = Boolean(latestSubmission && isTeamMember && !isLeader && !alreadyVoted && latestSubmission.teamReviewStatus !== 'APPROVED');

  const matchesStage = (file: FormAttachment, stage?: string) => {
    const value = (file.stage || 'GENERAL').toUpperCase();
    if (!stage) return value === 'ALL' || value === 'GENERAL';
    return value === 'ALL' || value === 'GENERAL' || value === stage.toUpperCase();
  };

  const stageFiles = referenceFiles.filter((file) => matchesStage(file, currentStage));

  const renderStageReferences = () => {
    if (stageFiles.length === 0) return null;
    return (
      <Card elevation={1} style={{ marginTop: '16px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--primary)" /> {currentStage} Reference Files
        </h4>
        <div style={{ display: 'grid', gap: '12px' }}>
          {stageFiles.map((file) => (
            <div
              key={file.attachmentId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-hover)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{file.fileName}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'Recently uploaded'}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                Preview
              </Button>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !comment.trim()) {
      addToast('Please attach a file or provide a link/comment', 'error');
      return;
    }

    const endpoint = getEndpoint();
    if (!endpoint) {
      addToast('Invalid project stage for submission', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = '';
      let fileName = '';

      // Step 1: Upload physical file to OneDrive Service if attached
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);
        formData.append('stage', currentStage.toLowerCase());

        addToast('Uploading to OneDrive...', 'info');
        const uploadRes = await api.post('/files/upload', formData);

        fileUrl = uploadRes.data.fileUrl;
        fileName = uploadRes.data.fileName;
      }

      // Step 2: Lock submission into Database
      await api.post(endpoint, {
        documentId: documentId,
        comment: comment,
        fileUrl: fileUrl,
        fileName: fileName
      });

      addToast(`${currentStage} Deliverable submitted successfully!`, 'success');
      setComment('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess();

      // Refresh local list
      const { data } = await api.get(`${endpoint}/document/${documentId}`);
      setExistingSubmissions(data || []);

    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to submit deliverable', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const submitTeamReview = async (approved: boolean) => {
    if (!latestSubmissionId) return;
    try {
      setIsSubmitting(true);
      await api.patch(`/submissions/${currentStage.toLowerCase()}/${latestSubmissionId}/team-review`, {
        reviewerId: user?.id,
        approved,
        comment: reviewComment || ''
      });
      setReviewComment('');
      addToast(approved ? 'Approval recorded.' : 'Rejection recorded.', 'success');
      const endpoint = getEndpoint();
      if (endpoint) {
        const { data } = await api.get(`${endpoint}/document/${documentId}`);
        setExistingSubmissions(data || []);
      }
      onSuccess();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to submit review', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSubmitted = existingSubmissions.length > 0;

  if (!isLeader && !hasSubmitted) {
    return (
      <div>
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
  }

  if (canTeamReview && latestSubmission) {
    return (
      <div>
        {renderStageReferences()}
        <Card elevation={1} style={{ marginTop: '16px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--primary)" /> {currentStage} Team Review
          </h4>
          <div style={{ padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Latest version: {latestSubmission.fileName || 'document'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Team review status: {latestSubmission.teamReviewStatus || 'PENDING'}
            </div>
          </div>
          <Input
            label="Review comment"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Optional feedback for the leader"
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <Button type="button" variant="outline" onClick={() => submitTeamReview(false)} isLoading={isSubmitting} leftIcon={<XCircle size={16} />}>
              Reject
            </Button>
            <Button type="button" onClick={() => submitTeamReview(true)} isLoading={isSubmitting} leftIcon={<CheckCircle size={16} />}>
              Approve
            </Button>
          </div>
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
      </div>
    );
  }

  return (
    <div>
      {renderStageReferences()}
      <Card elevation={1} style={{ marginTop: '16px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={18} color="var(--primary)" />
          {currentStage} Deliverables
        </h4>

        {hasSubmitted && !canUploadRevision ? (
          <div style={{ padding: '12px', backgroundColor: 'var(--success-20)', borderRadius: '6px', borderLeft: '4px solid var(--success)', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{latestSubmission?.teamReviewStatus === 'APPROVED' ? 'Document Approved by Team' : 'Document Submitted for Review'}</strong>
              {existingSubmissions[0]?.fileUrl && (
                <a href={existingSubmissions[0].fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  View Attached File <FileText size={14} />
                </a>
              )}
            </div>
            <br />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {latestSubmission?.status === 'REVISION'
                ? 'Supervisor requested changes. Upload a revised version when ready.'
                : 'The submission is in the review pipeline.'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }} onClick={handleFileClick}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              />
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <FileText size={20} color={file ? 'var(--primary)' : 'var(--text-secondary)'} />
              </div>
              <div>
                <h5 style={{ margin: '0 0 4px', fontSize: '14px', color: file ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {file ? file.name : 'Click to attach project file (PDF, DOCX, ZIP)'}
                </h5>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-disabled)' }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Max size 50MB. Uploads securely to OneDrive.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Additional Links or Comments (Optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="https://github.com/... or specific notes for your supervisor."
                  leftIcon={<LinkIcon size={16} />}
                />
              </div>
              <Button type="submit" isLoading={isSubmitting}>Submit Deliverable</Button>
            </div>
          </form>
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
    </div>
  );
};
