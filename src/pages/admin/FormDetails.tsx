import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader } from '../../components';
import { adminService } from '../../services/adminService';
import type { FormResponse } from '../../services/adminService';
import type { ProjectResponse } from '../../services/studentService';
import { ArrowLeft, Search, FileText } from 'lucide-react';

export const FormDetails: React.FC = () => {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;

    const fetchDetails = async () => {
      try {
        const [formRes, allProjectsRes] = await Promise.all([
          adminService.getForm(formId),
          adminService.getAllProjects()
        ]);
        
        setFormConfig(formRes);
        // Filter projects by this specific formId
        setProjects(allProjectsRes.filter(p => p.formId === formId));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [formId]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: '64px' }}><Loader size="lg" /></div>;
  if (!formConfig) return <div style={{ textAlign: 'center', padding: '64px', color: 'var(--danger)' }}><h1>Form Not Found</h1></div>;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/admin/dashboard')} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>Form Submissions</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Viewing all registered projects for <strong>{formConfig.accessBranch} Batch {formConfig.accessBatch}</strong>.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card elevation={1} style={{ textAlign: 'center', padding: '64px' }}>
          <Search size={48} color="var(--border-color)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No Submissions Yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Students have not enrolled using this form link yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map((project) => (
            <Card key={project.projectId} elevation={2}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', margin: 0 }}>{project.projectTitle}</h3>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={14} /> ID: {project.projectId.slice(0, 8)}
                    </span>
                    <span style={{ fontSize: '12px', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline">Review Proposal</Button>
              </div>

              <div style={{ backgroundColor: 'var(--surface-hover)', padding: '16px', borderRadius: '8px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                <strong>Project Description & Form Data:</strong><br /><br />
                {project.projectDescription}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormDetails;
