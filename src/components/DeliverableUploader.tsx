import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from './index';
import { api } from '../services/api';
import { useToastStore } from '../utils/toastStore';
import { UploadCloud, Link as LinkIcon } from 'lucide-react';

interface DeliverableUploaderProps {
  projectId: string;
  documentId: string;
  currentStage: string;
  isLeader: boolean;
  onSuccess: () => void;
}

export const DeliverableUploader: React.FC<DeliverableUploaderProps> = ({ 
  documentId, currentStage, isLeader, onSuccess 
}) => {
  const [link, setLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmissions, setExistingSubmissions] = useState<any[]>([]);
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
         // Fetch submissions for this document to see if they already submitted
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
    if (!link.trim()) {
      addToast('Please provide a valid document link', 'error');
      return;
    }

    const endpoint = getEndpoint();
    if (!endpoint) {
      addToast('Invalid project stage for submission', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(endpoint, {
        documentId: documentId,
        comment: link
      });
      addToast(`${currentStage} Deliverable submitted successfully!`, 'success');
      setLink('');
      onSuccess();
      
      // Refresh local list
      const { data } = await api.get(`${endpoint}/document/${documentId}`);
      setExistingSubmissions(data || []);
      
    } catch (err) {
      addToast('Failed to submit deliverable', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
           <strong>Document Successfully Submitted for Review!</strong>
           <br />
           <span style={{ fontSize: '13px', color: 'var(--text-secondary)'}}>
             The Supervisor has been notified and is reviewing your submission.
           </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input 
              label="Deliverable Link (Google Drive / GitHub)" 
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/..."
              leftIcon={<LinkIcon size={16} />}
            />
          </div>
          <Button type="submit" isLoading={isSubmitting}>Submit Deliverable</Button>
        </form>
      )}
    </Card>
  );
};
