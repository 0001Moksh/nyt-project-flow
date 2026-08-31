import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import { ArrowLeft, Users, Calendar, Video, MapPin, Link as LinkIcon, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { calculateAcademicProgress } from '../../utils/studentAcademicUtils';
import { cleanProjectDescription } from '../../utils/projectDescription';
import { getPreviewUrl } from '../../utils/filePreview';

const STAGE_LABELS: Record<string, string> = {
  SYNOPSIS: 'Synopsis',
  PROGRESS1: 'Progress 1',
  PROGRESS2: 'Progress 2',
  FINAL: 'Final Submission',
};

const STAGES = ['SYNOPSIS', 'PROGRESS1', 'PROGRESS2', 'FINAL'];

const parseIdArray = (value?: string | null): string[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const AdminProjectDetailView: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<any | null>(null);
  const [supervisorName, setSupervisorName] = useState<string>('Unassigned');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [stageTemplates, setStageTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; fileUrl: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const projRes = await api.get(`/projects/${projectId}`);
        const p = projRes.data;

        const [teamsRes, teamMembersRes, studentsRes, supervisorsRes, submissionsRes, meetingsRes, templatesRes] = await Promise.all([
          api.get('/teams').catch(() => ({ data: [] })),
          api.get('/team-members').catch(() => ({ data: [] })),
          api.get('/students').catch(() => ({ data: [] })),
          api.get('/supervisors').catch(() => ({ data: [] })),
          p.documentId ? api.get(`/submissions/all/document/${p.documentId}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          api.get(`/supervisor/meetings/project/${projectId}`).catch(() => ({ data: [] })),
          p.formId ? api.get(`/forms/${p.formId}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);

        const team = (teamsRes.data || []).find((t: any) => t.teamId === p.teamId);
        const allStudents = studentsRes.data || [];
        let memberDetails: any[] = [];
        let leaderName = '—';

        if (team) {
          const memberStatus = (teamMembersRes.data || []).find((tm: any) => tm.teamId === team.teamId);
          const joinedIds = new Set(parseIdArray(memberStatus?.joinMemberArray));
          const pendingIds = new Set(parseIdArray(memberStatus?.notJoinMemberArray));
          const arr = Array.from(new Set([
            ...parseIdArray(team.teamMemberArray),
            ...Array.from(joinedIds),
            ...Array.from(pendingIds),
            team.leaderId,
          ].filter(Boolean)));

          memberDetails = arr.map((sid: string) => {
            const st = allStudents.find((s: any) => s.studentId === sid);
            return {
              ...(st || { studentId: sid, name: 'Unknown', mail: 'N/A' }),
              inviteStatus: sid === team.leaderId ? 'LEADER' : pendingIds.has(sid) ? 'PENDING' : joinedIds.has(sid) ? 'APPROVED' : 'PENDING',
            };
          });
          const leader = allStudents.find((s: any) => s.studentId === team.leaderId);
          leaderName = leader?.name || '—';
        }

        const supervisor = (supervisorsRes.data || []).find((s: any) => s.supervisorId === p.supervisorId);
        setSupervisorName(supervisor?.name || 'Unassigned');
        setMeetings(meetingsRes.data || []);
        setSubmissions(submissionsRes.data || []);

        if (templatesRes.data?.jsonOfTemplates) {
          try {
            setStageTemplates(JSON.parse(templatesRes.data.jsonOfTemplates));
          } catch {
            setStageTemplates([]);
          }
        }

        setProject({
          ...p,
          team,
          memberDetails,
          leaderName,
        });
      } catch (err) {
        console.error('Error loading project details', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px' }}>
        <Loader size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '64px' }}>
        <h2>Project Not Found</h2>
        <Button onClick={() => navigate('/admin/projects')} style={{ marginTop: '16px' }}>
          Back to Projects
        </Button>
      </div>
    );
  }

  // Calculate scores
  const getStageScores = (stageKey: string) => {
    let supScore = null;
    let admScore = null;
    if (stageKey === 'SYNOPSIS') supScore = project.synopsisScore;
    if (stageKey === 'PROGRESS1') supScore = project.progress1Score;
    if (stageKey === 'PROGRESS2') supScore = project.progress2Score;
    if (stageKey === 'FINAL') supScore = project.finalScore;

    admScore = project.adminFinalScore;

    const supNum = supScore ? parseFloat(supScore) : null;
    const admNum = admScore ? parseFloat(admScore) : null;

    let avg = null;
    if (supNum !== null && admNum !== null) {
      avg = ((supNum + admNum) / 2).toFixed(1);
    } else if (supNum !== null) {
      avg = supNum.toFixed(1);
    } else if (admNum !== null) {
      avg = admNum.toFixed(1);
    }

    return { supScore: supNum, admScore: admNum, avgScore: avg };
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => navigate('/admin/projects')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: 'var(--surface, #ffffff)',
            color: 'var(--text-primary, #1e293b)',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {project.projectTitle}
          </h1>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            ID: {project.projectId} • Form ID: {project.formId}
          </span>
        </div>
      </div>

      {/* Stage Timeline */}
      <Card elevation={1} style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Project Stage Progress
        </h3>
        <ProjectTimeline project={project} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column: Metadata & Deliverables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metadata Section */}
          <Card elevation={1} style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Project Information & Metadata
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Assigned Supervisor</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{supervisorName}</span>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Team Leader</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.leaderName}</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</span>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                {cleanProjectDescription(project.projectDescription)}
              </p>
            </div>

            {/* Team Members List */}
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Team Members ({project.memberDetails?.length || 0})
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {project.memberDetails?.map((m: any, idx: number) => {
                  const progress = calculateAcademicProgress(m.rollNo);
                  return (
                    <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {[m.branch, m.rollNo, progress?.yearName, progress?.semesterName].filter(Boolean).join(' • ')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>{m.mail}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Stage Deliverables & Dual Scoring Cards */}
          <Card elevation={1} style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary)' }}>
              Stage Deliverables & Review Pipeline
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {STAGES.map((stageKey) => {
                const stageSubmissions = submissions.filter((s) => String(s.stage || s.stageStatus || '').toUpperCase() === stageKey);
                const latestSub = stageSubmissions[stageSubmissions.length - 1];
                const template = stageTemplates.find((t) => String(t.stageId || t.stage).toUpperCase() === stageKey);
                const scores = getStageScores(stageKey);

                return (
                  <div key={stageKey} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{STAGE_LABELS[stageKey]}</h4>
                      <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 600, backgroundColor: latestSub?.status === 'APPROVED' ? '#dcfce7' : '#fef3c7', color: latestSub?.status === 'APPROVED' ? '#166534' : '#92400e' }}>
                        {latestSub?.status || 'NOT_SUBMITTED'}
                      </span>
                    </div>

                    {/* Template vs Uploaded Doc */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Stage Template</span>
                        {template ? (
                          <a href={template.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                            {template.fileName || 'Download Template'}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-disabled)' }}>No template attached</span>
                        )}
                      </div>

                      <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>Student Submission</span>
                        {latestSub ? (
                          <button
                            type="button"
                            onClick={() => setPreviewFile({ fileName: latestSub.fileName, fileUrl: latestSub.fileUrl })}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {latestSub.fileName || 'View Submission'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-disabled)' }}>No submission uploaded</span>
                        )}
                      </div>
                    </div>

                    {/* Dual Scoring Breakdown */}
                    <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Supervisor Score: </span>
                        <strong>{scores.supScore !== null ? `${scores.supScore} / 10` : 'Pending'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Admin Score: </span>
                        <strong>{scores.admScore !== null ? `${scores.admScore} / 10` : 'Pending'}</strong>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Calculated Stage Average: </span>
                        <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>
                          {scores.avgScore !== null ? `${scores.avgScore} / 10` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Summary Card & Scheduled Meetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card elevation={1} style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>Project Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Stage</span>
                <strong>{STAGE_LABELS[project.stageStatus] || project.stageStatus}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{project.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assigned Supervisor</span>
                <strong>{supervisorName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Overall Score Average</span>
                <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
                  {project.getCalculatedSupervisorAverage ? project.getCalculatedSupervisorAverage().toFixed(1) : '—'} / 10
                </strong>
              </div>
            </div>
          </Card>

          {/* Scheduled Meetings */}
          <Card elevation={1} style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>Scheduled Meetings</h3>
            {meetings.length === 0 ? (
              <p style={{ color: 'var(--text-disabled)', fontSize: '13px', margin: 0 }}>No meetings scheduled for this project.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {meetings.map((m: any, idx: number) => (
                  <div key={idx} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)', fontSize: '13px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{m.stage} - {m.mode || 'Meeting'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {m.meetingDate} • {m.startTime} - {m.endTime}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setPreviewFile(null)}>
          <Card style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{previewFile.fileName}</h3>
              <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
            </div>
            <iframe src={getPreviewUrl(previewFile.fileUrl)} title={previewFile.fileName} style={{ width: '100%', height: '600px', border: 'none', marginTop: '16px' }} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminProjectDetailView;
