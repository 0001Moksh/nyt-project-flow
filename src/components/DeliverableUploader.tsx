import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from './index';
import { api } from '../services/api';
import { useToastStore } from '../utils/toastStore';
import { UploadCloud, Link as LinkIcon, FileText } from 'lucide-react';

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
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmissions, setExistingSubmissions] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore(state => state.addToast);

  // Map Project 'stageStatus' enum to the correct Submission endpoint
  const getEndpoint = () => {
    switch(currentStage) {
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
    fetchSubmissions();
  }, [documentId, currentStage]);

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
        const uploadRes = await api.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

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

  const hasSubmitted = existingSubmissions.length > 0;

  if (!isLeader && !hasSubmitted) {
    return (
      <Card elevation={1} style={{ marginTop: '16px', backgroundColor: 'var(--surface-hover)', border: '1px dashed var(--border-color)' }}>
         <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
            Awaiting Team Leader to upload the <strong>{currentStage}</strong> deliverables.
         </p>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={{ marginTop: '16px', border: '1px solid var(--border-color)' }}>
      <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
         <UploadCloud size={18} color="var(--primary)" /> 
         {currentStage} Deliverables
      </h4>
      
      {hasSubmitted ? (
        <div style={{ padding: '12px', backgroundColor: 'var(--success-20)', borderRadius: '6px', borderLeft: '4px solid var(--success)', color: 'var(--text-primary)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <strong>Document Successfully Submitted for Review!</strong>
               {existingSubmissions[0]?.fileUrl && (
                   <a href={existingSubmissions[0].fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                       View Attached File <FileText size={14} />
                   </a>
               )}
           </div>
           <br />
           <span style={{ fontSize: '13px', color: 'var(--text-secondary)'}}>
             The Supervisor has been notified and is reviewing your submission.
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
  );
};
