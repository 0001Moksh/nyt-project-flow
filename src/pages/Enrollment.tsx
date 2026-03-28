import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Button, Input, Loader } from '../components';
import { studentService } from '../services/studentService';
import type { FormResponse } from '../services/adminService';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';
import { Users, Mail, CheckCircle, ArrowRight } from 'lucide-react';

export const Enrollment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  
  const { user, isAuthenticated, login } = useAuthStore();
  const addToast = useToastStore(state => state.addToast);
  const navigate = useNavigate();

  const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form State
  const [teamMembers, setTeamMembers] = useState<string[]>(['']);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Auth Quick State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  useEffect(() => {
    if (!formId) {
      addToast('Invalid enrollment link. Missing form ID.', 'error');
      setIsLoading(false);
      return;
    }

    const fetchForm = async () => {
      try {
        const data = await studentService.getFormDetails(formId);
        setFormConfig(data);
      } catch (err) {
        addToast('Enrollment form not found or inactive.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchForm();
  }, [formId, addToast]);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    
    setIsLoading(true);
    try {
      const { data: students } = await api.get('/students');
      let realStudentId = 'stu_123';
      
      if (students && students.length > 0) {
        realStudentId = students[0].studentId;
      } else {
        const { data: newStudent } = await api.post('/students', { 
          name: "Enrolling Student", 
          mail: authEmail, 
          password: authPassword,
          rollNo: Math.random().toString(36).substr(2, 6).toUpperCase(),
          branch: formConfig?.accessBranch || "General",
          batch: formConfig?.accessBatch || "2026",
          enrollStatus: "PENDING"
        });
        realStudentId = newStudent.studentId;
      }
      
      login({ id: realStudentId, name: 'Student User', email: authEmail, role: 'STUDENT' });
      addToast('Signed in successfully! Please complete enrollment.', 'success');
    } catch(e) {
      console.error(e);
      addToast('Failed to authenticate with backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeamMemberChange = (index: number, value: string) => {
    const newMembers = [...teamMembers];
    newMembers[index] = value;
    setTeamMembers(newMembers);
  };

  const addTeamMember = () => setTeamMembers([...teamMembers, '']);
  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleEnrollmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formId || !formConfig) return;

    setIsSubmitting(true);
    try {
      // 1. Filter out empty team members
      const members = teamMembers.filter(m => m.trim() !== '');

      // Resolve emails to actual Student IDs
      const { data: allStudents } = await api.get('/students');
      const resolvedMemberIds: string[] = [];

      for (const email of members) {
        const found = allStudents.find((s: any) => s.mail.toLowerCase() === email.toLowerCase());
        if (found) {
          resolvedMemberIds.push(found.studentId);
        } else {
          try {
            // Auto-create missing student for seamless mock dev experience
            const { data: newMember } = await api.post('/students', { 
              name: "Team Member", 
              mail: email, 
              password: "password",
              rollNo: Math.random().toString(36).substr(2, 6).toUpperCase(),
              branch: formConfig?.accessBranch || "General",
              batch: formConfig?.accessBatch || "2026",
              enrollStatus: "PENDING"
            });
            resolvedMemberIds.push(newMember.studentId);
          } catch(err) {
            addToast(`Could not resolve or create member: ${email}`, 'error');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 2. Create Team First
      const teamRes = await studentService.createTeam({
        leaderId: user.id,
        teamMemberIds: resolvedMemberIds,
        teamCompleteStatus: true
      });

      // 3. Serialize dynamic answers into the description payload for Project Create
      const fieldsConfig = JSON.parse(formConfig.jsonOfFields || '[]');
      const projTitle = answers[fieldsConfig.find((f: any) => f.label.toLowerCase().includes('title'))?.id || ''] || `${user.name}'s Project`;
      
      let projDescription = '';
      fieldsConfig.forEach((field: any) => {
        if (!field.label.toLowerCase().includes('title')) {
           projDescription += `**${field.label}**: ${answers[field.id] || 'N/A'}\n\n`;
        }
      });

      // 4. Create Project
      await studentService.createProject({
        teamId: teamRes.teamId,
        formId: formId,
        projectTitle: projTitle,
        projectDescription: projDescription || 'No description provided.'
      });

      setIsSuccess(true);
      addToast('Project Enrolled Successfully!', 'success');
    } catch (err) {
      // interceptor handles toast
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '64px' }}><Loader size="lg" /></div>;
  if (!formConfig) return <div style={{ textAlign: 'center', padding: '64px', color: 'var(--danger)' }}><h1>Form Not Found</h1><p>The enrollment link is invalid or expired.</p></div>;

  if (isSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '64px auto', textAlign: 'center' }}>
        <Card elevation={3} style={{ padding: '64px 32px' }}>
          <CheckCircle size={64} color="var(--secondary)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>Enrollment Complete!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Your team and project have been registered for Batch {formConfig.accessBatch} ({formConfig.accessBranch}).
          </p>
          <Button onClick={() => navigate('/dashboard')} size="lg" variant="primary">
            Go to My Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Auth Guard
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '64px auto' }}>
        <Card elevation={3}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Sign in to Enroll</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              You must be logged in to submit an enrollment for {formConfig.accessBranch} {formConfig.accessBatch}.
            </p>
          </div>
          <form onSubmit={handleQuickLogin}>
            <Input 
              label="Email" type="email" required
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthEmail(e.target.value)} 
              leftIcon={<Mail size={18} />} 
              placeholder="student@college.edu"
            />
            <Input 
              label="Password" type="password" required
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword(e.target.value)}
            />
            <Button type="submit" fullWidth style={{ marginTop: '16px' }} rightIcon={<ArrowRight size={18} />}>
              Continue to Form
            </Button>
          </form>
        </Card>
      </div>
    );
  }

// Safe JSON parse for fieldsConfig
  let fieldsConfig: any[] = [];
  try {
    fieldsConfig = JSON.parse(formConfig?.jsonOfFields || '[]');
  } catch (error) {
    console.warn("Could not parse jsonOfFields dynamically. Defaulting to empty array.");
  }


  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>Project Enrollment</h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <span style={{ backgroundColor: 'var(--surface-hover)', padding: '6px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 600 }}>
            {formConfig.accessBranch}
          </span>
          <span style={{ backgroundColor: 'var(--surface-hover)', padding: '6px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 600 }}>
            Batch {formConfig.accessBatch}
          </span>
        </div>
      </div>

      <form onSubmit={handleEnrollmentSubmit}>
        {/* Team Formation Section */}
        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Users size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '20px', margin: 0 }}>Team Configuration</h3>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            You will automatically be registered as the Team Leader. Enter the emails/IDs of your team members below if applicable.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <Input label="Team Leader (You)" value={user?.email || ''} disabled style={{ backgroundColor: 'var(--surface-hover)' }} />
            
            {teamMembers.map((member, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input 
                    label={`Team Member ${i + 1}`} 
                    placeholder="member@college.edu" 
                    value={member}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTeamMemberChange(i, e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                {teamMembers.length > 0 && (
                  <Button type="button" variant="outline" onClick={() => removeTeamMember(i)}>Remove</Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="text" size="sm" onClick={addTeamMember}>+ Add Another Member</Button>
        </Card>

        {/* Dynamic Project Schema Section */}
        <Card elevation={2} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            Project Proposal Details
          </h3>
          
          {fieldsConfig.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No additional details required by Admin.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {fieldsConfig.map(field => (
                <div key={field.id}>
                  {field.type === 'textarea' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>{field.label} {field.required && '*'}</label>
                      <textarea 
                        required={field.required}
                        value={answers[field.id] || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswers({...answers, [field.id]: e.target.value})}
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '100px', fontFamily: 'inherit' }}
                      />
                    </div>
                  ) : (
                    <Input 
                      label={`${field.label} ${field.required ? '*' : ''}`}
                      type={field.type}
                      required={field.required}
                      value={answers[field.id] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswers({...answers, [field.id]: e.target.value})}
                      style={{ marginBottom: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
          <Button type="submit" size="lg" isLoading={isSubmitting}>
            Submit Enrollment
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Enrollment;
