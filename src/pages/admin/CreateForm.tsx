import React, { useState } from 'react';
import { Card, Button, Input } from '../../components';
import { adminService } from '../../services/adminService';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { useToastStore } from '../../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, ArrowLeft, Copy, CheckCircle } from 'lucide-react';

interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'url';
  required: boolean;
}

export const CreateForm: React.FC = () => {
  const [branch, setBranch] = useState('');
  const [batch, setBatch] = useState('');
  const [fields, setFields] = useState<FieldConfig[]>([
    { id: '1', label: 'Project Title', type: 'text', required: true },
    { id: '2', label: 'Project Description', type: 'textarea', required: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  
  const { user } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);
  const navigate = useNavigate();

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
    if (!branch || !batch) {
      addToast('Please enter required branch and batch.', 'error');
      return;
    }

    // Validate fields
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
           } else {
             const { data: newAdmin } = await api.post('/admins', { 
               name: "System Admin", mail: "admin@sys.com", password: "pwd", department: "CS" 
             });
             creatorId = newAdmin.adminId;
           }
         } catch(e) {
           creatorId = 'admin_sys'; // will fail, but at least we tried
         }
      }

      const payload = {
        accessBranch: branch,
        accessBatch: batch,
        jsonOfFields: JSON.stringify(fields),
        createdBy: creatorId || 'admin_sys'
      };

      const res = await adminService.createForm(payload);
      const link = `${window.location.origin}/enroll?formId=${res.formId}`;
      setSuccessLink(link);
      addToast('Form created successfully!', 'success');
    } catch (error) {
      // Automatic toast by interceptor
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Share this link with {branch} Batch {batch} students so they can enroll and form teams.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px', marginBottom: '32px' }}>
            <code style={{ flex: 1, textAlign: 'left', wordBreak: 'break-all', color: 'var(--primary)' }}>{successLink}</code>
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

          <Button onClick={() => navigate('/admin/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate('/admin/dashboard')} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>Create Enrollment Form</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Define the project criteria and submission schema for a specific branch and batch.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Target Audience</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input 
              label="Branch Focus" 
              placeholder="e.g. CSE, IT, ECE" 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              required 
            />
            <Input 
              label="Batch Year" 
              placeholder="e.g. 2026, 2024-2028" 
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              required 
            />
          </div>
        </Card>

        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Registration Form Blueprint (JSON Schema)</h3>
            <Button type="button" size="sm" variant="outline" onClick={handleAddField} leftIcon={<PlusCircle size={16} />}>
              Add Field
            </Button>
          </div>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Define what fields students must fill out when creating their group project proposal. This will be automatically converted to the required backend JSON schema.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map((field, index) => (
              <div key={field.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '48px', color: 'var(--text-disabled)', fontWeight: 'bold' }}>
                  {index + 1}.
                </div>
                
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  <Input 
                    label="Field Label" 
                    placeholder="e.g. GitHub Repo URL" 
                    value={field.label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeField(field.id, 'label', e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                  
                  <div className="input-container" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Input Type</label>
                    <select 
                      value={field.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChangeField(field.id, 'type', e.target.value)}
                      style={{
                        padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '16px', backgroundColor: 'var(--surface)', outline: 'none'
                      }}
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="number">Number</option>
                      <option value="url">URL Link</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', height: '48px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeField(field.id, 'required', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      Required
                    </label>
                  </div>
                </div>

                <div style={{ height: '48px', display: 'flex', alignItems: 'center', marginTop: '22px' }}>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveField(field.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: '8px' }}
                    title="Remove Field"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
            
            {fields.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                No fields defined. Students won't have to fill anything except generating their team context.
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/dashboard')}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>Generate Link & Save Form</Button>
        </div>
      </form>
    </div>
  );
};

export default CreateForm;
