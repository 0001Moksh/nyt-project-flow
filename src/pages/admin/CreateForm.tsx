import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { adminService } from '../../services/adminService';
import type { FormResponse } from '../../services/adminService';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { useToastStore } from '../../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, ArrowLeft, Copy, CheckCircle, Link as LinkIcon, Users, Calendar } from 'lucide-react';

interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'url';
  required: boolean;
}

export const CreateForm: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [forms, setForms] = useState<FormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fallbacks if db is empty
  const [uniqueBranches, setUniqueBranches] = useState<string[]>(['AIML', 'DS']);
  const [uniqueBatches, setUniqueBatches] = useState<string[]>(['2024', '2025', '2026']);

  const [branches, setBranches] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldConfig[]>([
    { id: '1', label: 'Project Title', type: 'text', required: true },
    { id: '2', label: 'Project Description', type: 'textarea', required: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const { user } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCreating) {
      fetchForms();
    }
  }, [isCreating]);

  const fetchForms = async () => {
    try {
      setIsLoading(true);

      const [formsRes, studentsRes] = await Promise.all([
        adminService.getAllForms().catch(() => []),
        api.get('/students').catch(() => ({ data: [] }))
      ]);

      setForms(Array.isArray(formsRes) ? formsRes : []);

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
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/enroll?formId=${formId}`;
    navigator.clipboard.writeText(url);
    addToast('Enrollment Link Copied!', 'success');
  };

  const handleAddField = () => {
    setFields([
      ...fields,
      { id: Date.now().toString(), label: '', type: 'text', required: true }
    ]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleChangeField = (id: string, key: keyof FieldConfig, value: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (branches.length === 0 || batches.length === 0) {
      addToast('Please select at least one branch and batch.', 'error');
      return;
    }
    if (fields.some(f => !f.label.trim())) {
      addToast('All form fields must have a label.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let creatorId = user?.id;
      if (!creatorId || creatorId === 'admin_sys' || creatorId.length < 15) {
        try {
          const { data: admins } = await api.get('/admins');
          if (admins && admins.length > 0) {
            creatorId = admins[0].adminId;
          }
        } catch (e) { }
      }

      const payload = {
        accessBranch: branches.join(', '),
        accessBatch: batches.join(', '),
        jsonOfFields: JSON.stringify(fields),
        createdBy: creatorId || 'admin_sys'
      };

      const res = await adminService.createForm(payload);
      const link = `${window.location.origin}/enroll?formId=${res.formId}`;
      setSuccessLink(link);
      addToast('Form created successfully!', 'success');
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successLink) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Card elevation={3} style={{ textAlign: 'center', padding: '64px 32px' }}>
          <CheckCircle size={64} color="var(--secondary)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>Form Generated Successfully!</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px', marginBottom: '32px' }}>
            <code style={{ flex: 1, textAlign: 'left', wordBreak: 'break-all', color: 'var(--primary)' }}>{successLink}</code>
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(successLink); addToast('Copied to clipboard!', 'info'); }} leftIcon={<Copy size={16} />}>Copy</Button>
          </div>
          <Button onClick={() => { setIsCreating(false); setSuccessLink(null); }}>Back to Forms Dashboard</Button>
        </Card>
      </div>
    );
  }

  // --- FORMS LIST VIEW ---
  if (!isCreating) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>Enrollment Forms</h1>
          </div>
          <Button onClick={() => setIsCreating(true)} leftIcon={<PlusCircle size={18} />}>Create New Enroll Form</Button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}><Loader size="lg" /></div>
        ) : forms.length === 0 ? (
          <Card elevation={1} style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>No active enrollment forms found.</p>
            <Button variant="outline" onClick={() => setIsCreating(true)}>Create your first form</Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {forms.map(form => (
              <Card key={form.formId} elevation={2} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ backgroundColor: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Branch: {form.accessBranch}</span>
                    <span style={{ backgroundColor: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Batch: {form.accessBatch}</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
                  <Button variant="outline" fullWidth size="sm" onClick={() => copyLink(form.formId)} leftIcon={<LinkIcon size={14} />}>Copy Link</Button>
                  <Button variant="primary" fullWidth size="sm" onClick={() => navigate(`/admin/form-details/${form.formId}`)}>View Config</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- FORM BUILDER VIEW ---
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => setIsCreating(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}>
        <ArrowLeft size={16} /> Back to Forms
      </button>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>Create Enrollment Form</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Define the project criteria and submission schema for a specific branch and batch.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Target Audience</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Branch Focus</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {uniqueBranches.map(b => (
                  <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={branches.includes(b)} onChange={(e) => {
                      if (e.target.checked) setBranches([...branches, b]);
                      else setBranches(branches.filter(br => br !== b));
                    }} style={{ width: '16px', height: '16px' }} /> {b}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Batch Year</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {uniqueBatches.map(b => (
                  <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={batches.includes(b)} onChange={(e) => {
                      if (e.target.checked) setBatches([...batches, b]);
                      else setBatches(batches.filter(bt => bt !== b));
                    }} style={{ width: '16px', height: '16px' }} /> {b}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Schema Fields</h3>
            <Button type="button" size="sm" variant="outline" onClick={handleAddField} leftIcon={<PlusCircle size={16} />}>Add Field</Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map((field, index) => (
              <div key={field.id} style={{ display: 'flex', gap: '12px', padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', flex: 1, alignItems: 'end' }}>
                  <Input label="Field Label" value={field.label} onChange={(e: any) => handleChangeField(field.id, 'label', e.target.value)} style={{ marginBottom: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500 }}>Type</label>
                    <select value={field.type} onChange={(e: any) => handleChangeField(field.id, 'type', e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <option value="text">Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="number">Number</option>
                      <option value="url">URL</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: '48px', gap: '8px' }}>
                    <input type="checkbox" checked={field.required} onChange={(e: any) => handleChangeField(field.id, 'required', e.target.checked)} /> Req
                  </div>
                </div>
                <button type="button" onClick={() => handleRemoveField(field.id)} style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer' }}><Trash2 size={20} /></button>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>Save Form Build</Button>
        </div>
      </form>
    </div>
  );
};

export default CreateForm;
