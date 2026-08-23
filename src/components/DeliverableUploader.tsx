import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Button, Input } from './index';
import { api } from '../services/api';
import { useToastStore } from '../utils/toastStore';
import { useAuthStore } from '../utils/authStore';
import { UploadCloud, Link as LinkIcon, Eye, Copy, Download, ChevronDown, FileText, ExternalLink, BadgeAlert } from 'lucide-react';
import type { FormAttachment, Template } from '../services/adminService';
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

const STAGE_ALIASES: Record<string, string[]> = {
  SYNOPSIS: ['SYNOPSIS', 'SYNOPSIS STAGE', 'SYNOPSIS_DRAFT'],
  PROGRESS1: ['PROGRESS1', 'PROGRESS 1', 'PROGRESS-1', 'P1'],
  PROGRESS2: ['PROGRESS2', 'PROGRESS 2', 'PROGRESS-2', 'P2'],
  FINAL: ['FINAL', 'FINAL SUBMISSION', 'FINAL-STAGE'],
  ALL: ['ALL', 'GENERAL']
};

const normalizeStage = (stage?: string | null) =>
  String(stage || 'GENERAL').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();

const matchesStage = (fileStage?: string | null, activeStage?: string | null) => {
  const fileValue = normalizeStage(fileStage);
  const activeValue = normalizeStage(activeStage);
  if (!activeValue) return fileValue === 'ALL' || fileValue === 'GENERAL';
  const aliases = STAGE_ALIASES[activeValue] || [activeValue];
  return fileValue === 'ALL' || fileValue === 'GENERAL' || aliases.includes(fileValue);
};

const templateToAttachment = (template: Template): FormAttachment => ({
  attachmentId: template.id,
  fileName: template.name,
  fileUrl: template.fileUrl,
  uploadedAt: template.createdAt,
  source: template.sourceType,
  stage: template.stageId,
});

const PENDING_STATUSES = new Set([
  'PENDING',
  'PENDING_TEAM_APPROVAL',
  'PENDING_SUPERVISOR_REVIEW',
  'PENDING_ADMIN_REVIEW',
]);

const normalizeStatus = (value?: string | null) =>
  String(value || '').trim().replace(/[\s-]+/g, '_').toUpperCase();

const isPendingReviewStatus = (value?: string | null) => PENDING_STATUSES.has(normalizeStatus(value));

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const inferAttachmentFormat = (file?: FormAttachment | null) => {
  if (!file) return '-';
  const fileName = String(file.fileName || '').trim();
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return extension ? extension.toUpperCase() : 'See template';
};

interface DeliverableUploaderProps {
  projectId: string;
  documentId: string;
  currentStage: string;
  isLeader: boolean;
  onSuccess: () => void;
}

export const DeliverableUploader: React.FC<DeliverableUploaderProps> = ({
  projectId,
  documentId,
  currentStage,
  isLeader,
  onSuccess,
}) => {
  const [selectedStage, setSelectedStage] = useState(currentStage);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState<FormAttachment[]>([]);
  const [stageTemplates, setStageTemplates] = useState<FormAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormAttachment | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const addToast = useToastStore((state) => state.addToast);
  const user = useAuthStore((state) => state.user);

  const endpoint = useMemo(() => {
    switch (selectedStage) {
      case 'SYNOPSIS': return '/submissions/synopsis';
      case 'PROGRESS1': return '/submissions/progress1';
      case 'PROGRESS2': return '/submissions/progress2';
      case 'FINAL': return '/submissions/final';
      default: return null;
    }
  }, [selectedStage]);

  useEffect(() => setSelectedStage(currentStage), [currentStage]);

  useEffect(() => {
    const load = async () => {
      try {
        const projectRes = await api.get(`/projects/${projectId}`).catch(() => ({ data: null }));
        const formId = projectRes.data?.formId;
        const [formRes, templateRes, subRes] = await Promise.all([
          formId ? api.get(`/forms/${formId}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          formId ? api.get(`/templates?form_id=${formId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          endpoint && documentId ? api.get(`${endpoint}/document/${documentId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);
        setReferenceFiles(parseReferenceFiles(formRes.data?.referenceFilesJson));
        setStageTemplates((templateRes.data || []).map(templateToAttachment));
        setSubmissions(subRes.data || []);
      } catch {
        setReferenceFiles([]);
        setStageTemplates([]);
        setSubmissions([]);
      }
    };
    load();
  }, [projectId, documentId, endpoint]);

  const stageFiles = [...referenceFiles, ...stageTemplates].filter((file) =>
    matchesStage(file.stage, selectedStage)
  );

  useEffect(() => {
    const first = stageFiles[0] || null;
    if (!first) {
      setSelectedTemplateId('');
      setSelectedTemplate(null);
      return;
    }
    if (!stageFiles.some((f) => f.attachmentId === selectedTemplateId)) {
      setSelectedTemplateId(first.attachmentId);
    }
    setSelectedTemplate(stageFiles.find((f) => f.attachmentId === selectedTemplateId) || first);
  }, [stageFiles, selectedTemplateId]);

  // Close custom dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const latestSubmission = submissions[submissions.length - 1] || null;
  const selectedTemplateSubmission = useMemo(() => {
    if (!selectedTemplate) return null;
    const selectedName = String(selectedTemplate.fileName || '').trim().toLowerCase();
    const selectedUrl = String(selectedTemplate.fileUrl || '').trim().toLowerCase();
    return submissions
      .slice()
      .reverse()
      .find((submission) => {
        const submissionName = String(submission?.fileName || '').trim().toLowerCase();
        const submissionComment = String(submission?.comment || '').toLowerCase();
        const submissionUrl = String(submission?.fileUrl || '').trim().toLowerCase();
        return (
          (selectedName && submissionName === selectedName) ||
          (selectedUrl && submissionUrl === selectedUrl) ||
          (selectedName && submissionComment.includes(selectedName))
        );
      }) || null;
  }, [selectedTemplate, submissions]);

  const isSelectedTemplateUnderReview = isPendingReviewStatus(selectedTemplateSubmission?.status) || isPendingReviewStatus(selectedTemplateSubmission?.teamReviewStatus);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLeader) return addToast('Only the team leader can submit documents.', 'error');
    if (!selectedStage || !selectedTemplateId || !driveLink.trim()) {
      addToast('Please choose stage, template, and drive link.', 'error');
      return;
    }
    if (selectedTemplateSubmission && isPendingReviewStatus(selectedTemplateSubmission.status || selectedTemplateSubmission.teamReviewStatus)) {
      addToast('This document has already been submitted and is currently under review.', 'error');
      return;
    }
    if (!endpoint) {
      addToast('Invalid stage selected.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(endpoint, {
        documentId,
        comment: `Template: ${selectedTemplate?.fileName || selectedTemplateId}\nDrive Link: ${driveLink.trim()}`,
        fileUrl: driveLink.trim(),
        fileName: selectedTemplate?.fileName || 'Submission Link',
      });
      setDriveLink('');
      addToast('Deliverable submitted successfully.', 'success');
      const { data } = await api.get(`${endpoint}/document/${documentId}`).catch(() => ({ data: [] }));
      setSubmissions(data || []);
      onSuccess();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to submit deliverable.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card elevation={1} style={{ border: '1px solid var(--border-color)', padding: '16px' }}>
      <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UploadCloud size={18} color="var(--primary)" /> {currentStage} Deliverables
      </h4>

      {latestSubmission && (
        <div
          style={{
            marginBottom: '12px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--surface-hover)',
            border: '1px solid var(--border-color)',
          }}
        >
          Latest submission status: <strong>{latestSubmission.status || 'PENDING'}</strong>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'grid', gap: '12px' }}>
        {/* 1. Stage */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            1. Stage
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            {['SYNOPSIS', 'PROGRESS1', 'PROGRESS2', 'FINAL'].map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Document – custom dropdown (no external View, no document cards) */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            2. Document
          </label>

          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--background)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                color: selectedTemplate ? 'var(--text-primary)' : 'var(--text-disabled)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <FileText size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTemplate ? selectedTemplate.fileName : 'Select a document…'}
                </span>
              </span>
              <ChevronDown
                size={16}
                style={{
                  flexShrink: 0,
                  transition: 'transform 0.15s ease',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {/* Options popover */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  zIndex: 30,
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {stageFiles.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      fontSize: '13px',
                      color: 'var(--text-disabled)',
                      textAlign: 'center',
                    }}
                  >
                    No templates available for this stage
                  </div>
                ) : (
                  stageFiles.map((tpl) => {
                    const matchingSubmission = submissions
                      .slice()
                      .reverse()
                      .find((submission) => {
                        const submissionName = String(submission?.fileName || '').trim().toLowerCase();
                        const submissionComment = String(submission?.comment || '').toLowerCase();
                        const templateName = String(tpl.fileName || '').trim().toLowerCase();
                        const templateUrl = String(tpl.fileUrl || '').trim().toLowerCase();
                        return (
                          (templateName && submissionName === templateName) ||
                          (templateUrl && String(submission?.fileUrl || '').trim().toLowerCase() === templateUrl) ||
                          (templateName && submissionComment.includes(templateName))
                        );
                      }) || null;
                    const isLocked = isPendingReviewStatus(matchingSubmission?.status) || isPendingReviewStatus(matchingSubmission?.teamReviewStatus);

                    return (
                      <div
                        key={tpl.attachmentId}
                        role="option"
                        aria-disabled={isLocked}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '12px 14px',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          backgroundColor:
                            selectedTemplateId === tpl.attachmentId
                              ? 'var(--primary-glow)'
                              : 'transparent',
                          borderBottom: '1px solid var(--border-color)',
                          opacity: isLocked ? 0.72 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isLocked && selectedTemplateId !== tpl.attachmentId) {
                            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            selectedTemplateId === tpl.attachmentId
                              ? 'var(--primary-glow)'
                              : 'transparent';
                        }}
                        onClick={() => {
                          if (isLocked) {
                            addToast('This document has already been submitted and is currently under review.', 'error');
                            return;
                          }
                          setSelectedTemplateId(tpl.attachmentId);
                          setDropdownOpen(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <FileText size={16} style={{ flexShrink: 0, opacity: 0.65 }} />
                          <span style={{ fontSize: '14px', fontWeight: selectedTemplateId === tpl.attachmentId ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tpl.fileName}
                          </span>
                          {isLocked && (
                            <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
                              Under Review
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFile(tpl);
                            setIsPreviewOpen(true);
                            setDropdownOpen(false);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface)', fontSize: '12px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {isSelectedTemplateUnderReview && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #f59e0b',
              backgroundColor: '#fffbeb',
              color: '#92400e',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <BadgeAlert size={16} />
            <span>This document has already been submitted and is currently under review.</span>
          </div>
        )}

        {/* 3. Drive Link */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            3. Drive Link
          </label>
          <Input
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="Paste Google Drive submission link here"
            leftIcon={<LinkIcon size={16} />}
          />
        </div>

        <Button type="submit" isLoading={isSubmitting} disabled={isSelectedTemplateUnderReview}>
          Submit Deliverable
        </Button>
      </form>

      {/* Preview modal */}
      {previewFile && isPreviewOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            backgroundColor: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => {
            setPreviewFile(null);
            setIsPreviewOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(1240px, 98vw)',
              height: 'min(84vh, 820px)',
              backgroundColor: 'var(--surface)',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewFile.fileName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Document preview</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>
                  Close
                </Button>
              </div>
              <iframe
                title={previewFile.fileName}
                src={getPreviewUrl(previewFile.fileUrl)}
                style={{ width: '100%', height: '100%', border: 'none', flex: 1, minHeight: 0, backgroundColor: '#fff' }}
              />
            </div>

            <div style={{ minWidth: 0, minHeight: 0, borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 700 }}>Template Metadata</div>
                    <h3 style={{ margin: '6px 0 4px', fontSize: '20px', lineHeight: 1.25 }}>{previewFile.fileName}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {selectedTemplate?.stage ? `Target stage: ${selectedTemplate.stage}` : 'Target stage: —'}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '6px 10px', borderRadius: '999px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                    {selectedTemplate?.source === 'LINK' ? 'Drive Link' : 'Uploaded File'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '18px', overflowY: 'auto', display: 'grid', gap: '14px' }}>
                <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>Template Name</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{previewFile.fileName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>Target Stage Name</div>
                      <div style={{ fontSize: '14px' }}>{selectedTemplate?.stage || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>Required File Format</div>
                      <div style={{ fontSize: '14px' }}>{inferAttachmentFormat(selectedTemplate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>Creation Date / Created Timestamp</div>
                      <div style={{ fontSize: '14px' }}>{formatDateTime(previewFile.uploadedAt)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>Description & Submission Guidelines</div>
                  <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {selectedTemplate?.fileName
                      ? `Follow the instructions attached to ${selectedTemplate.fileName}. Submit the correct file type, keep naming consistent with the template, and verify the drive link is accessible to reviewers.`
                      : 'No description available.'}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(previewFile.fileUrl, '_blank', 'noopener,noreferrer')}
                    leftIcon={<Download size={14} />}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(previewFile.fileUrl);
                        addToast('Link copied to clipboard.', 'success');
                      } catch {
                        addToast('Unable to copy link.', 'error');
                      }
                    }}
                    leftIcon={<Copy size={14} />}
                  >
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(previewFile.fileUrl, '_blank', 'noopener,noreferrer')}
                    leftIcon={<ExternalLink size={14} />}
                  >
                    Direct Drive Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DeliverableUploader;
