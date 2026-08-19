import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface SupervisorOption {
  supervisorId: string;
  name: string;
  assignedCount?: number;
}

interface InlineSupervisorAssignProps {
  projectId: string;
  currentSupervisorId?: string | null;
  supervisorName?: string | null;
  supervisors: SupervisorOption[];
  onSelect: (projectId: string, currentSupervisorId: string, newSupervisorId: string) => void;
}

export const InlineSupervisorAssign: React.FC<InlineSupervisorAssignProps> = ({
  projectId,
  currentSupervisorId,
  supervisorName,
  supervisors,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState(currentSupervisorId || '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftId(currentSupervisorId || '');
  }, [currentSupervisorId]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraftId(currentSupervisorId || '');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, currentSupervisorId]);

  const label = supervisorName || 'Unassigned';

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
      <span
        style={{
          fontSize: '13px',
          fontWeight: supervisorName ? 500 : 600,
          color: supervisorName ? 'var(--text-primary)' : '#d97706',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '140px',
        }}
        title={label}
      >
        {label}
      </span>
      <button
        type="button"
        title="Change supervisor"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          backgroundColor: open ? 'var(--primary-soft)' : '#fff',
          color: 'var(--primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Pencil size={13} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 40,
            width: '280px',
            backgroundColor: '#fff',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
            padding: '12px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Assign supervisor
          </div>
          <select
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface)',
              fontSize: '13px',
              marginBottom: '10px',
            }}
          >
            <option value="">Select supervisor…</option>
            {supervisors.map((sup) => (
              <option key={sup.supervisorId} value={sup.supervisorId}>
                {sup.name}
                {typeof sup.assignedCount === 'number' ? ` (${sup.assignedCount})` : ''}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraftId(currentSupervisorId || '');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <X size={12} /> Cancel
            </button>
            <button
              type="button"
              disabled={!draftId || draftId === (currentSupervisorId || '')}
              onClick={() => {
                if (!draftId) return;
                onSelect(projectId, currentSupervisorId || '', draftId);
                setOpen(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: (!draftId || draftId === (currentSupervisorId || '')) ? '#94a3b8' : 'var(--primary)',
                color: '#fff',
                cursor: (!draftId || draftId === (currentSupervisorId || '')) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineSupervisorAssign;
