import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Button, Input, Loader } from '../components';
import { studentService } from '../services/studentService';
import type { FormAttachment, FormResponse } from '../services/adminService';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';
import { CheckCircle, Check, X, Search, ArrowLeft, Mail, ArrowRight, Paperclip, Users } from 'lucide-react';
import { getPreviewUrl } from '../utils/filePreview';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);

  // Form State
  const [teamSize, setTeamSize] = useState('3-4 Members');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [invitedMembers, setInvitedMembers] = useState<{ mail: string, name: string }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auth Quick State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Available students to search
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

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
        const [stdRes] = await Promise.all([
          api.get('/students?excludeEnrolled=true'),
        ]);
        // Available = non-ENROLLED from API (pending/active/declined all included).
        const available = stdRes.data || [];
        setAllStudents(available);

        if (user?.id) {
          // Leader/joined students are ENROLLED and won't appear in excludeEnrolled list — fetch self.
          let me = available.find((s: any) => s.studentId === user.id);
          if (!me) {
            try {
              const meRes = await api.get(`/students/${user.id}`);
              me = meRes.data;
            } catch { /* ignore */ }
          }
          setAlreadyEnrolled(me?.enrollStatus === 'ENROLLED');
        }
      } catch (err) {
        addToast('Enrollment form not found or inactive.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchForm();
  }, [formId, addToast, user?.id]);

  // Only ENROLLED students are excluded (API already filters). Keep branch/batch + self rules.
  const selectableStudents = allStudents.filter((s: any) => {
    if (s.studentId === user?.id) return false;
    if (String(s.enrollStatus || '').toUpperCase() === 'ENROLLED') return false;
    const sBranch = (s.branch || '').toLowerCase();
    const sBatch = (s.batch || '').toLowerCase();
    const validBranches = (formConfig?.accessBranch || '').split(',').map((b: string) => b.trim().toLowerCase()).filter(Boolean);
    const validBatches = (formConfig?.accessBatch || '').split(',').map((b: string) => b.trim().toLowerCase()).filter(Boolean);
    return (validBranches.length === 0 || validBranches.includes(sBranch)) &&
      (validBatches.length === 0 || validBatches.includes(sBatch));
  });

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;

    setIsLoading(true);
    try {
      const existingStudent = allStudents?.find((s: any) => s.mail.toLowerCase() === authEmail.toLowerCase());

      let realStudentId = 'stu_123';
      let realStudentName = 'Student User';

      if (existingStudent) {
        realStudentId = existingStudent.studentId;
        realStudentName = existingStudent.name;
      } else {
        const { data: newStudent } = await api.post('/students', {
          name: authEmail.split('@')[0].toUpperCase(),
          mail: authEmail,
          password: authPassword,
          rollNo: Math.random().toString(36).substr(2, 6).toUpperCase(),
          branch: formConfig?.accessBranch || "General",
          batch: formConfig?.accessBatch || "2026",
          enrollStatus: "PENDING"
        });
        realStudentId = newStudent.studentId;
        realStudentName = newStudent.name;
      }

      login({ id: realStudentId, name: realStudentName, email: authEmail, role: 'STUDENT' });
      addToast('Signed in successfully! Please complete enrollment.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to authenticate with backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const existing = selectableStudents.find(s =>
        s.mail.toLowerCase() === searchQuery.toLowerCase() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!existing) {
        addToast('Only non-enrolled eligible students can be added.', 'error');
        return;
      }
      if (invitedMembers.some(m => m.mail === existing.mail)) {
        addToast('Student is already in your invite list.', 'error');
        return;
      }
      setInvitedMembers([...invitedMembers, { mail: existing.mail, name: existing.name }]);
      setSearchQuery('');
    }
  };

  const removeInvitedMember = (index: number) => {
    setInvitedMembers(invitedMembers.filter((_, i) => i !== index));
  };


  const handleEnrollmentSubmit = async () => {
    if (!user || !formId || !formConfig) return;

    const fieldsConfig = JSON.parse(formConfig.jsonOfFields || '[]');
    for (const field of fieldsConfig) {
      if (field.required && !(answers[field.id] || '').trim()) {
        addToast(`Please fill required field: ${field.label}`, 'error');
        return;
      }
    }

    const totalMembers = invitedMembers.length + 1;
    if (teamSize === 'Individual' && totalMembers !== 1) {
      addToast('You selected Individual team size. Please remove other members.', 'error');
      return;
    } else if (teamSize === '2 Members' && totalMembers !== 2) {
      addToast(`You selected 2 Members, but have ${totalMembers} in the list. Please add exactly 1 more member.`, 'error');
      return;
    } else if (teamSize === '3-4 Members' && (totalMembers < 3 || totalMembers > 4)) {
      addToast(`You selected 3-4 Members, but have ${totalMembers} in the list. Please ensure team has 3 or 4 members total.`, 'error');
      return;
    }

    for (const member of invitedMembers) {
      const found = selectableStudents.find((s: any) => s.mail.toLowerCase() === member.mail.toLowerCase())
        || allStudents.find((s: any) => s.mail.toLowerCase() === member.mail.toLowerCase() && String(s.enrollStatus || '').toUpperCase() !== 'ENROLLED');
      if (!found) {
        addToast(`Cannot invite enrolled or ineligible student: ${member.mail}`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const resolvedMemberIds: string[] = [];

      for (const member of invitedMembers) {
        const found = allStudents.find((s: any) => s.mail.toLowerCase() === member.mail.toLowerCase());
        if (found) {
          if (String(found.enrollStatus || '').toUpperCase() === 'ENROLLED') {
            addToast(`Student already enrolled: ${member.mail}`, 'error');
            setIsSubmitting(false);
            return;
          }
          resolvedMemberIds.push(found.studentId);
        } else {
          addToast(`Could not resolve member: ${member.mail}. Only registered students can be invited.`, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      const teamRes = await studentService.createTeam({
        leaderId: user.id,
        teamMemberIds: resolvedMemberIds,
        teamCompleteStatus: true
      });

      const projTitle = answers[fieldsConfig.find((f: any) => f.label.toLowerCase().includes('title'))?.id || ''] || `${user.name}'s Project`;

      let projDescription = '';
      fieldsConfig.forEach((field: any) => {
        if (!field.label.toLowerCase().includes('title')) {
          projDescription += `**${field.label}**: ${answers[field.id] || 'N/A'}\n\n`;
        }
      });

      await studentService.createProject({
        teamId: teamRes.teamId,
        formId: formId,
        projectTitle: projTitle,
        projectDescription: projDescription || 'No description provided.'
      });

      setIsSuccess(true);
      addToast('Project Enrolled Successfully!', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoading) return <div style={{ textAlign: 'center', padding: '64px' }}><Loader size="lg" /></div>;
  if (!formConfig) return <div style={{ textAlign: 'center', padding: '64px', color: 'var(--danger)' }}><h1>Form Not Found</h1></div>;

  if (isSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '64px auto', textAlign: 'center' }}>
        <Card elevation={3} style={{ padding: '64px 32px' }}>
          <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>Enrollment Complete!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Your team and project have been registered for Batch {formConfig.accessBatch}.
          </p>
          <Button onClick={() => navigate('/dashboard')} size="lg" variant="primary">
            Go to My Dashboard
          </Button>
        </Card>
      </div>
    );
  }

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

  if (alreadyEnrolled) {
    return (
      <div style={{ maxWidth: '600px', margin: '64px auto', textAlign: 'center' }}>
        <Card elevation={3} style={{ padding: '64px 32px' }}>
          <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Already Enrolled</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            You are already enrolled in a project. The enrollment form is hidden for enrolled students.
          </p>
          <Button onClick={() => navigate('/dashboard')} size="lg" variant="primary">
            Go to My Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Multi-select Form Access Validation
  const validBranches = (formConfig.accessBranch || '').split(',').map(s => s.trim().toLowerCase());
  const validBatches = (formConfig.accessBatch || '').split(',').map(s => s.trim().toLowerCase());

  const myStudentInfo = allStudents.find((s: any) => s.studentId === user?.id);
  const myBranch = (myStudentInfo?.branch || '').toLowerCase();
  const myBatch = (myStudentInfo?.batch || '').toLowerCase();

  const isEligible = validBranches.includes(myBranch) && validBatches.includes(myBatch);

  if (!isEligible && myStudentInfo) {
    return (
      <div style={{ maxWidth: '600px', margin: '64px auto', textAlign: 'center' }}>
        <Card elevation={3} style={{ padding: '64px 32px' }}>
          <X size={64} color="var(--danger)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            This enrollment form is strictly restricted to students from <strong style={{ color: 'var(--text-primary)' }}>{formConfig.accessBranch}</strong> branch (Batch {formConfig.accessBatch}).
            Your profile indicates you are listed under <strong>{myStudentInfo.branch || 'Unknown'} (Batch {myStudentInfo.batch || 'Unknown'})</strong>.
          </p>
          <Button onClick={() => navigate('/dashboard')} size="lg" variant="outline">
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  let fieldsConfig: any[] = [];
  try {
    fieldsConfig = JSON.parse(formConfig?.jsonOfFields || '[]');
  } catch (error) {
    console.warn("Could not parse jsonOfFields");
  }

  const referenceFiles = parseReferenceFiles(formConfig?.referenceFilesJson);

  return (
    <div style={{ padding: '0', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700 }}>Available Project Forms</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
            Browse and enroll in research projects for the Fall 2024 semester
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')} leftIcon={<ArrowLeft size={16} />}>
          Back to Dashboard
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
          {referenceFiles.length > 0 && (
            <Card elevation={1} style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={18} color="var(--primary)" /> Reference Files
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Download the form templates or sample files shared by the admin.
              </p>
              <div style={{ display: 'grid', gap: '12px' }}>
                {referenceFiles.map((file) => (
                  <div
                    key={file.attachmentId}
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
                      <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                      Preview
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

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

          {/* Step 1: Define Your Team */}
          <Card elevation={1} style={{ padding: '32px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Step 1: Define Your Team</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>Select team size and invite qualified members from your branch.</p>

            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '12px' }}>Team Size</span>
              <div style={{ display: 'flex', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', padding: '4px' }}>
                {['Individual', '2 Members', '3-4 Members'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setTeamSize(size)}
                    style={{
                      flex: 1, padding: '10px', border: 'none', borderRadius: '6px',
                      backgroundColor: teamSize === size ? 'white' : 'transparent',
                      color: teamSize === size ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: teamSize === size ? 600 : 500,
                      boxShadow: teamSize === size ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '12px' }}>Search Team Members</span>
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 12px 12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', backgroundColor: 'var(--surface)', cursor: 'pointer' }}
                >
                  <span style={{ flex: 1, color: invitedMembers.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {invitedMembers.length > 0 ? `${invitedMembers.length} member(s) selected` : '-- Select Team Members --'}
                  </span>
                  <div style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--surface-hover)', marginRight: '8px' }}>
                    Valid Branches
                  </div>
                </div>

                {isDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 11 }}>
                      <input 
                        type="text" 
                        placeholder="Search by name, roll no or email..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px' }}
                        autoFocus
                      />
                    </div>
                    <div style={{ padding: '4px', overflowY: 'auto', flex: 1 }}>
                      {selectableStudents
                        .filter(s => {
                          return !searchQuery || (
                            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.mail.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                        })
                        .map(s => {
                          const isSelected = invitedMembers.some(m => m.mail === s.mail);
                          return (
                            <div 
                              key={s.studentId} 
                              onClick={() => {
                                if (isSelected) {
                                  setInvitedMembers(invitedMembers.filter(m => m.mail !== s.mail));
                                } else {
                                  setInvitedMembers([...invitedMembers, { mail: s.mail, name: s.name }]);
                                }
                              }}
                              style={{ 
                                padding: '10px 12px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                cursor: 'pointer', 
                                borderRadius: '6px',
                                backgroundColor: isSelected ? 'var(--primary-glow)' : 'transparent',
                                marginBottom: '2px',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{s.name} <span style={{color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500}}>({s.rollNo})</span></div>
                                <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>{s.mail}</div>
                              </div>
                              {isSelected && <Check size={18} color="var(--primary)" />}
                            </div>
                          );
                        })}
                        {selectableStudents.filter(s => {
                          return !searchQuery || (
                            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.mail.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                        }).length === 0 && (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px' }}>
                            No matching students found
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '8px' }}>
                Showing only non-enrolled students from <strong style={{ color: 'var(--text-secondary)' }}>{formConfig.accessBranch}</strong> {formConfig.accessBatch}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '12px' }}>Invited Students</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* YOU Card */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#fdfdfd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{user?.name} (You)</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Team Lead</div>
                    </div>
                  </div>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color="white" />
                  </div>
                </div>

                {/* INVITED Cards */}
                {invitedMembers.map((member, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#fdfdfd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{formConfig.accessBranch} Year 3</div>
                      </div>
                    </div>
                    <button onClick={() => removeInvitedMember(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', display: 'flex', alignItems: 'center' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Project Schema Section Embedded */}
            {fieldsConfig.length > 0 && (
              <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>Project Specific Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {fieldsConfig.map(field => (
                    <div key={field.id}>
                      {field.type === 'textarea' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{field.label} {field.required && '*'}</label>
                          <textarea
                            required={field.required}
                            value={answers[field.id] || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswers({ ...answers, [field.id]: e.target.value })}
                            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px', fontFamily: 'inherit', fontSize: '14px', outline: 'none' }}
                          />
                        </div>
                      ) : (
                        <Input
                          label={`${field.label} ${field.required ? '*' : ''}`}
                          type={field.type}
                          required={field.required}
                          value={answers[field.id] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswers({ ...answers, [field.id]: e.target.value })}
                          style={{ marginBottom: 0 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
              <Button onClick={handleEnrollmentSubmit} isLoading={isSubmitting} size="lg" style={{ flex: 1 }}>Submit Enrollment Form</Button>
            </div>
          </Card>
      </div>
    </div>
  );
};

export default Enrollment;
