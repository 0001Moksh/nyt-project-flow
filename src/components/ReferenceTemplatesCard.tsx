import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Paperclip } from 'lucide-react';
import { api } from '../services/api';
import type { FormAttachment, Template } from '../services/adminService';
import { getPreviewUrl } from '../utils/filePreview';
import { Button, Card } from './index';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const templateToAttachment = (template: Template): FormAttachment => ({
  attachmentId: template.id,
  fileName: template.name,
  fileUrl: template.fileUrl,
  uploadedAt: template.createdAt,
  source: template.sourceType,
  stage: template.stageId
});

const normalizeStage = (stage?: string | null) => (stage || 'GENERAL').toUpperCase();

interface ReferenceTemplatesCardProps {
  formId?: string | null;
  currentStage?: string | null;
  title?: string;
}

export const ReferenceTemplatesCard: React.FC<ReferenceTemplatesCardProps> = ({
  formId,
  currentStage,
  title = 'Reference Templates'
}) => {
  const [files, setFiles] = useState<FormAttachment[]>([]);
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!formId) {
        setFiles([]);
        return;
      }

      const [formRes, templateRes, attachmentRes] = await Promise.all([
        api.get(`/forms/${formId}`).catch(() => ({ data: null })),
        api.get(`/templates?form_id=${formId}`).catch(() => ({ data: [] })),
        api.get(`/forms/${formId}/attachments`).catch(() => ({ data: [] }))
      ]);

      const legacyFromForm = parseReferenceFiles(formRes.data?.referenceFilesJson);
      const templates = (templateRes.data || []).map(templateToAttachment);
      const legacyAttachments = attachmentRes.data || [];
      const unique = new Map<string, FormAttachment>();

      [...legacyFromForm, ...legacyAttachments, ...templates].forEach((file: FormAttachment) => {
        const key = file.attachmentId || `${file.fileName}-${file.fileUrl}`;
        if (file.fileUrl && !unique.has(key)) {
          unique.set(key, file);
        }
      });

      setFiles(Array.from(unique.values()));
    };

    fetchFiles();
  }, [formId]);

  const visibleFiles = useMemo(() => {
    const stage = normalizeStage(currentStage);
    return [...files].sort((a, b) => {
      const aStage = normalizeStage(a.stage);
      const bStage = normalizeStage(b.stage);
      const aPriority = aStage === stage || aStage === 'GENERAL' || aStage === 'ALL' ? 0 : 1;
      const bPriority = bStage === stage || bStage === 'GENERAL' || bStage === 'ALL' ? 0 : 1;
      return aPriority - bPriority;
    });
  }, [files, currentStage]);

  if (!formId || visibleFiles.length === 0) return null;

  return (
    <>
      <Card elevation={1} style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Paperclip size={20} color="var(--primary)" /> {title}
        </h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          {visibleFiles.map((file) => (
            <div
              key={file.attachmentId || `${file.fileName}-${file.fileUrl}`}
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
                <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {file.fileName}
                  {file.stage && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>
                      {file.stage}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'Recently uploaded'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                  Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(file.fileUrl, '_blank', 'noopener,noreferrer')} leftIcon={<ExternalLink size={14} />}>
                  Open
                </Button>
              </div>
            </div>
          ))}
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
    </>
  );
};

export default ReferenceTemplatesCard;

