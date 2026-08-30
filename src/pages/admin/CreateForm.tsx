import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { adminService } from '../../services/adminService';
import type { FormResponse } from '../../services/adminService';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { useToastStore } from '../../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle, Trash2, ArrowLeft, Copy, CheckCircle, Link as LinkIcon,
  FolderKanban, Calendar, HelpCircle, Plus, X, GripVertical
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'email' | 'dropdown' | 'date' | 'checkbox';

interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // only for dropdown
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
];

const formatCreatedOn = (raw?: string | null) => {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* -------------------------------------------------------------------------- */
/* Help Tooltip                                                               */
/* -------------------------------------------------------------------------- */

const HelpTip: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Help"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: 'none',
          background: open ? 'var(--primary)' : 'var(--surface-hover)',
          color: open ? '#fff' : 'var(--text-secondary)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s',
        }}
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 280,
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
            padding: '14px 16px',
            zIndex: 50,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontSize: 13 }}>
            {title}
          </div>
          {children}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export const CreateForm: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [forms, setForms] = useState<FormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [uniqueBranches, setUniqueBranches] = useState<string[]>(['AIML', 'DS']);
  const [uniqueBatches, setUniqueBatches] = useState<string[]>(['2024', '2025', '2026']);

  const [branches, setBranches] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldConfig[]>([
    { id: '1', label: 'Project Title', type: 'text', required: true, placeholder: 'Enter project title' },
    { id: '2', label: 'Project Description', type: 'textarea', required: true, placeholder: 'Describe your project...' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const { user } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCreating) fetchForms();
  }, [isCreating]);

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const [formsRes, studentsRes, projectsRes] = await Promise.all([
        adminService.getAllForms().catch(() => []),
        api.get('/students').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
      ]);

      const countByForm: Record<string, number> = {};
      (projectsRes.data || []).forEach((p: any) => {
        if (!p?.formId) return;
        countByForm[p.formId] = (countByForm[p.formId] || 0) + 1;
      });

      const formsList = Array.isArray(formsRes) ? formsRes : [];
      setForms(
        formsList.map((f) => ({
          ...f,
          projectCount: countByForm[f.formId] ?? Number(f.projectCount) ?? 0,
        }))
      );

      if (studentsRes.data && studentsRes.data.length > 0) {
        const branchSet = new Set<string>();
        const batchSet = new Set<string>();
        studentsRes.data.forEach((s: any) => {
          if (s.branch) branchSet.add(s.branch);
          if (s.batch) batchSet.add(s.batch);
        });
        if (branchSet.size > 0) setUniqueBranches(Array.from(branchSet).sort());
        if (batchSet.size > 0) setUniqueBatches(Array.from(batchSet).sort());
      }
    } catch {
      // handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/enroll?formId=${formId}`;
    navigator.clipboard.writeText(url);
    addToast('Enrollment Link Copied!', 'success');
  };

  /* -------------------- Field helpers -------------------- */

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        id: Date.now().toString(),
        label: '',
        type: 'text',
        required: false,
        placeholder: '',
        options: [],
      },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleChangeField = (id: string, key: keyof FieldConfig, value: any) => {
    setFields(
      fields.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, [key]: value };
        // when switching to dropdown, ensure options array exists
        if (key === 'type' && value === 'dropdown' && !next.options) {
          next.options = ['Option 1', 'Option 2'];
        }
        return next;
      })
    );
  };

  const handleOptionChange = (fieldId: string, optIdx: number, value: string) => {
    setFields(
      fields.map((f) => {
        if (f.id !== fieldId || !f.options) return f;
        const opts = [...f.options];
        opts[optIdx] = value;
        return { ...f, options: opts };
      })
    );
  };

  const handleAddOption = (fieldId: string) => {
    setFields(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        return { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] };
      })
    );
  };

  const handleRemoveOption = (fieldId: string, optIdx: number) => {
    setFields(
      fields.map((f) => {
        if (f.id !== fieldId || !f.options) return f;
        return { ...f, options: f.options.filter((_, i) => i !== optIdx) };
      })
    );
  };

  /* -------------------- Submit -------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (branches.length === 0 || batches.length === 0) {
      addToast('Please select at least one branch and batch.', 'error');
      return;
    }
    if (fields.some((f) => !f.label.trim())) {
      addToast('All form fields must have a label.', 'error');
      return;
    }
    if (fields.some((f) => f.type === 'dropdown' && (!f.options || f.options.filter((o) => o.trim()).length < 1))) {
      addToast('Dropdown fields need at least one option.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let creatorId = user?.id;
      if (!creatorId || creatorId === 'admin_sys' || creatorId.length < 15) {
        try {
          const { data: admins } = await api.get('/admins');
          if (admins && admins.length > 0) creatorId = admins[0].adminId;
        } catch {}
      }

      const payload = {
        accessBranch: branches.join(', '),
        accessBatch: batches.join(', '),
        jsonOfFields: JSON.stringify(fields),
        createdBy: creatorId || 'admin_sys',
      };

      const res = await adminService.createForm(payload);
      const link = `${window.location.origin}/enroll?formId=${res.formId}`;
      setSuccessLink(link);
      addToast('Form created successfully!', 'success');
    } catch {
      // handled
    } finally {
      setIsSubmitting(false);
    }
  };

  /* -------------------- Success View -------------------- */

  if (successLink) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <Card elevation={3} style={{ textAlign: 'center', padding: '64px 32px' }}>
          <CheckCircle size={64} color="var(--secondary)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>Form Generated Successfully!</h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--surface-hover)',
              padding: 16,
              borderRadius: 8,
              marginBottom: 32,
            }}
          >
            <code style={{ flex: 1, textAlign: 'left', wordBreak: 'break-all', color: 'var(--primary)' }}>
              {successLink}
            </code>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(successLink);
                addToast('Copied to clipboard!', 'info');
              }}
              leftIcon={<Copy size={16} />}
            >
              Copy
            </Button>
          </div>
          <Button
            onClick={() => {
              setIsCreating(false);
              setSuccessLink(null);
            }}
          >
            Back to Forms Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  /* -------------------- Forms List View -------------------- */

  if (!isCreating) {
    return (
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, color: 'var(--text-primary)', margin: 0 }}>Enrollment Forms</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
              Manage and share project enrollment forms
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)} leftIcon={<PlusCircle size={18} />}>
            Create New Enroll Form
          </Button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader size="lg" />
          </div>
        ) : forms.length === 0 ? (
          <Card elevation={1} style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>No active enrollment forms found.</p>
            <Button variant="outline" onClick={() => setIsCreating(true)}>
              Create your first form
            </Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {forms.map((form) => {
              const createdLabel = formatCreatedOn(form.createdAt || form.createAt);
              const projectCount = form.projectCount ?? 0;
              return (
                <Card key={form.formId} elevation={2} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span
                        style={{
                          backgroundColor: 'var(--surface-hover)',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Branch: {form.accessBranch}
                      </span>
                      <span
                        style={{
                          backgroundColor: 'var(--surface-hover)',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Batch: {form.accessBatch}
                      </span>
                    </div>
                    <span
                      title="Projects submitted under this form"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <FolderKanban size={13} />
                      {projectCount} {projectCount === 1 ? 'Project' : 'Projects'}
                    </span>
                  </div>

                  {createdLabel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <Calendar size={14} />
                      Created on {createdLabel}
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: 14,
                      display: 'flex',
                      gap: 10,
                      marginTop: 'auto',
                    }}
                  >
                    <Button variant="outline" fullWidth size="sm" onClick={() => copyLink(form.formId)} leftIcon={<LinkIcon size={14} />}>
                      Copy Link
                    </Button>
                    <Button variant="primary" fullWidth size="sm" onClick={() => navigate(`/admin/form-details/${form.formId}`)}>
                      View Config
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* -------------------- FORM BUILDER + PREVIEW -------------------- */

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 96px)',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '6px 0',
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>Create Enrollment Form</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0', fontSize: 13 }}>
              Define audience & schema — preview updates live
            </p>
          </div>
        </div>
      </div>

      {/* Two-column workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 420px)',
          gap: 20,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ========== LEFT: Builder (scrollable) ========== */}
        <div
          style={{
            overflowY: 'auto',
            paddingRight: 6,
            minHeight: 0,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 24 }}>
            {/* Target Audience */}
            <Card elevation={2} style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 16px', fontWeight: 700 }}>Target Audience</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Branch Focus */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Branch Focus</label>
                    <HelpTip title="Branch Focus">
                      {branches.length === 0 ? (
                        <p style={{ margin: 0 }}>
                          Select one or more branches. Only students belonging to the chosen branches will be able to open and submit this enrollment form.
                        </p>
                      ) : (
                        <p style={{ margin: 0 }}>
                          This form will be available to students in:{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>{branches.join(', ')}</strong>.
                          <br />
                          <br />
                          Students from other branches will not see or be able to access this form.
                        </p>
                      )}
                    </HelpTip>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: 12,
                      backgroundColor: 'var(--surface-hover)',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      minHeight: 48,
                    }}
                  >
                    {uniqueBranches.map((b) => (
                      <label
                        key={b}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          cursor: 'pointer',
                          background: branches.includes(b) ? 'rgba(37,99,235,0.1)' : 'transparent',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: branches.includes(b) ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={branches.includes(b)}
                          onChange={(e) => {
                            if (e.target.checked) setBranches([...branches, b]);
                            else setBranches(branches.filter((br) => br !== b));
                          }}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Batch Year */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Batch Year</label>
                    <HelpTip title="Batch Year">
                      {batches.length === 0 ? (
                        <p style={{ margin: 0 }}>
                          Select the batch years that should receive this form. Only students of the selected batches will be able to enroll.
                        </p>
                      ) : (
                        <p style={{ margin: 0 }}>
                          This form is restricted to batch(es):{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>{batches.join(', ')}</strong>.
                          <br />
                          <br />
                          Students from other batches will not be able to open the form link.
                        </p>
                      )}
                    </HelpTip>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: 12,
                      backgroundColor: 'var(--surface-hover)',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      minHeight: 48,
                    }}
                  >
                    {uniqueBatches.map((b) => (
                      <label
                        key={b}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          cursor: 'pointer',
                          background: batches.includes(b) ? 'rgba(37,99,235,0.1)' : 'transparent',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: batches.includes(b) ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={batches.includes(b)}
                          onChange={(e) => {
                            if (e.target.checked) setBatches([...batches, b]);
                            else setBatches(batches.filter((bt) => bt !== b));
                          }}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Schema Fields */}
            <Card elevation={2} style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>Schema Fields</h3>
                <Button type="button" size="sm" variant="outline" onClick={handleAddField} leftIcon={<PlusCircle size={15} />}>
                  Add Field
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    style={{
                      padding: 14,
                      backgroundColor: 'var(--surface-hover)',
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: 'var(--text-disabled)',
                          paddingTop: 28,
                          flexShrink: 0,
                        }}
                      >
                        <GripVertical size={16} />
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: 10, alignItems: 'end' }}>
                          <Input
                            label="Field Label"
                            value={field.label}
                            onChange={(e: any) => handleChangeField(field.id, 'label', e.target.value)}
                            placeholder="e.g. Project Title"
                            style={{ marginBottom: 0 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 13, fontWeight: 500 }}>Type</label>
                            <select
                              value={field.type}
                              onChange={(e: any) => handleChangeField(field.id, 'type', e.target.value as FieldType)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                background: 'var(--background)',
                                fontSize: 13,
                              }}
                            >
                              {FIELD_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', height: 42, gap: 6, paddingBottom: 2 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleChangeField(field.id, 'required', e.target.checked)}
                                style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                              />
                              Required
                            </label>
                          </div>
                        </div>

                        {/* Placeholder (not for checkbox) */}
                        {field.type !== 'checkbox' && field.type !== 'dropdown' && (
                          <Input
                            label="Placeholder (optional)"
                            value={field.placeholder || ''}
                            onChange={(e: any) => handleChangeField(field.id, 'placeholder', e.target.value)}
                            placeholder="Hint text shown inside the field"
                            style={{ marginBottom: 0 }}
                          />
                        )}

                        {/* Dropdown options editor */}
                        {field.type === 'dropdown' && (
                          <div
                            style={{
                              marginTop: 4,
                              padding: 12,
                              background: 'var(--background)',
                              borderRadius: 8,
                              border: '1px dashed var(--border-color)',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                              Dropdown Options
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(field.options || []).map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleOptionChange(field.id, oi, e.target.value)}
                                    placeholder={`Option ${oi + 1}`}
                                    style={{
                                      flex: 1,
                                      padding: '7px 10px',
                                      borderRadius: 6,
                                      border: '1px solid var(--border-color)',
                                      fontSize: 13,
                                      background: 'var(--surface)',
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(field.id, oi)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-disabled)',
                                      cursor: 'pointer',
                                      padding: 4,
                                    }}
                                    title="Remove option"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddOption(field.id)}
                              style={{
                                marginTop: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <Plus size={14} /> Add option
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-disabled)',
                          cursor: 'pointer',
                          padding: '4px',
                          marginTop: 24,
                          flexShrink: 0,
                        }}
                        title="Remove field"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {fields.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 28,
                      color: 'var(--text-disabled)',
                      fontSize: 14,
                      border: '1px dashed var(--border-color)',
                      borderRadius: 10,
                    }}
                  >
                    No fields yet. Click “Add Field” to start building the form.
                  </div>
                )}
              </div>
            </Card>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Save Form Build
              </Button>
            </div>
          </form>
        </div>

        {/* ========== RIGHT: Live Preview ========== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-disabled)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            Live Preview · Student View
          </div>

          <Card
            elevation={2}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Preview header */}
            <div
              style={{
                padding: '18px 20px 14px',
                borderBottom: '1px solid var(--border-color)',
                background: 'linear-gradient(180deg, var(--surface-hover) 0%, var(--surface) 100%)',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Project Enrollment</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {branches.length || batches.length ? (
                  <>
                    Open for{' '}
                    {branches.length > 0 && <strong>{branches.join(', ')}</strong>}
                    {branches.length > 0 && batches.length > 0 && ' · '}
                    {batches.length > 0 && <strong>Batch {batches.join(', ')}</strong>}
                  </>
                ) : (
                  <span style={{ fontStyle: 'italic' }}>Select branch & batch to see audience</span>
                )}
              </div>
            </div>

            {/* Preview body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {fields.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13, padding: 32 }}>
                  Add fields on the left to see the form preview
                </div>
              ) : (
                fields.map((f) => (
                  <div key={f.id}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 6,
                      }}
                    >
                      {f.label || <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>Untitled field</span>}
                      {f.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                    </label>

                    {f.type === 'textarea' ? (
                      <textarea
                        disabled
                        placeholder={f.placeholder || ''}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--background)',
                          fontSize: 13,
                          resize: 'none',
                          color: 'var(--text-secondary)',
                        }}
                      />
                    ) : f.type === 'dropdown' ? (
                      <select
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--background)',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <option value="">Select…</option>
                        {(f.options || []).filter((o) => o.trim()).map((o, i) => (
                          <option key={i} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          cursor: 'default',
                        }}
                      >
                        <input type="checkbox" disabled style={{ width: 15, height: 15 }} />
                        {f.label || 'Checkbox'}
                      </label>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
                        disabled
                        placeholder={f.placeholder || ''}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--background)',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}
                      />
                    )}
                  </div>
                ))
              )}

              {fields.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    disabled
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      opacity: 0.85,
                      cursor: 'not-allowed',
                    }}
                  >
                    Submit Enrollment
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateForm;