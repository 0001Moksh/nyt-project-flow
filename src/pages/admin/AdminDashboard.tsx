import React, { useEffect, useState } from 'react';
import { Card, Button, Loader } from '../../components';
import { adminService } from '../../services/adminService';
import type { FormResponse } from '../../services/adminService';
import { useToastStore } from '../../utils/toastStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Link as LinkIcon, Users, Calendar } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [forms, setForms] = useState<FormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addToast = useToastStore(state => state.addToast);
  const navigate = useNavigate();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getAllForms();
      setForms(data);
    } catch {
      // Error handled by global interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/enroll?formId=${formId}`;
    navigator.clipboard.writeText(url);
    addToast('Enrollment Link Copied!', 'success');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>
            Admin Control Panel
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage active batches, generate forms, and monitor projects.
          </p>
        </div>
        <Button onClick={() => navigate('/admin/create-form')} leftIcon={<PlusCircle size={18} />}>
          New Course Enrollment
        </Button>
      </div>

      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Active Enrollments (Forms)</h2>
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <Loader size="lg" />
        </div>
      ) : forms.length === 0 ? (
        <Card elevation={1} style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            No active enrollment forms found. 
          </p>
          <Button variant="outline" onClick={() => navigate('/admin/create-form')}>
            Create your first form
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {forms.map(form => (
            <Card key={form.formId} elevation={2} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ backgroundColor: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                    {form.accessBranch}
                  </span>
                  <span style={{ backgroundColor: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                    Batch {form.accessBatch}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  ID: {form.formId.slice(0, 8)}...
                </span>
              </div>
              
              <div style={{ flex: 1, marginBottom: '24px' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <Calendar size={16} /> Created: {new Date(form.createAt).toLocaleDateString()}
                </p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <Users size={16} /> Enrolled Teams: 0
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
                <Button 
                  variant="outline" 
                  fullWidth 
                  size="sm" 
                  onClick={() => copyLink(form.formId)}
                  leftIcon={<LinkIcon size={14} />}
                >
                  Copy Link
                </Button>
                <Button 
                  variant="primary" 
                  fullWidth 
                  size="sm"
                  onClick={() => navigate(`/admin/form-details/${form.formId}`)}
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
