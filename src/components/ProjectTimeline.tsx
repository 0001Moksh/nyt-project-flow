import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle, Clock, FileText, Square, UploadCloud } from 'lucide-react';
import { Card } from './Card';
import { Loader } from './Loader';
import { api } from '../services/api';
import { extractFirstUrl } from '../utils/filePreview';

const STAGES = [
  { key: 'SYNOPSIS', label: 'Synopsis', dateField: 'synopsisDate', color: '#ef4444', endpoint: 'synopsis' },
  { key: 'PROGRESS1', label: 'Progress 1', dateField: 'progress1Date', color: '#22c55e', endpoint: 'progress1' },
  { key: 'PROGRESS2', label: 'Progress 2', dateField: 'progress2Date', color: '#8b5cf6', endpoint: 'progress2' },
  { key: 'FINAL', label: 'Final Submission', dateField: 'finalSubmissionDate', color: '#2563eb', endpoint: 'final' }
];

const getSubmissionId = (submission: any, endpoint: string) =>
  submission[`${endpoint}Id`] || submission.finalId || submission.synopsisId || submission.progress1Id || submission.progress2Id;

const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysUntil = (value?: string | null) => {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const timeAgo = (value?: string | null) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

interface ProjectTimelineProps {
  project: any;
  compact?: boolean;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ project, compact = false }) => {
  const [timeline, setTimeline] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTimelineData = async () => {
      if (!project?.projectId) return;
      setIsLoading(true);
      try {
        const [timelineRes, tasksRes, meetingsRes] = await Promise.all([
          project.formId ? api.get(`/admin/config/timeline/${project.formId}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
          api.get(`/tasks/project/${project.projectId}`).catch(() => ({ data: [] })),
          api.get(`/supervisor/meetings/project/${project.projectId}`).catch(() => ({ data: [] }))
        ]);

        let allSubmissions: any[] = [];
        if (project.documentId) {
          const submissionResponses = await Promise.all(
            STAGES.map(async (stage) => {
              const response = await api.get(`/submissions/${stage.endpoint}/document/${project.documentId}`).catch(() => ({ data: [] }));
              return (response.data || []).map((submission: any) => ({
                ...submission,
                stage: stage.key,
                submissionId: getSubmissionId(submission, stage.endpoint)
              }));
            })
          );
          allSubmissions = submissionResponses.flat();
        }

        setTimeline(timelineRes.data || null);
        setTasks(tasksRes.data || []);
        setMeetings(meetingsRes.data || []);
        setSubmissions(allSubmissions);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimelineData();
  }, [project?.projectId, project?.documentId, project?.formId]);

  const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.key === project?.stageStatus));
  const stageRows = useMemo(() => STAGES.map((stage, index) => {
    const deadline = timeline?.[stage.dateField];
    const stageTasks = tasks.filter((task) => task.stageStatus === stage.key);
    const doneTasks = stageTasks.filter((task) => ['DONE', 'COMPLETED'].includes((task.status || '').toUpperCase())).length;
    const stageSubmissions = submissions.filter((submission) => submission.stage === stage.key);
    const latestSubmission = stageSubmissions
      .slice()
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
    const completed = index < stageIndex || latestSubmission?.status === 'APPROVED';
    const current = index === stageIndex;

    return { ...stage, deadline, stageTasks, doneTasks, latestSubmission, completed, current };
  }), [timeline, tasks, submissions, stageIndex]);

  const currentStage = stageRows[stageIndex] || stageRows[0];
  const nextDeadline = currentStage?.deadline;
  const remainingDays = daysUntil(nextDeadline);
  const latestSubmission = submissions
    .slice()
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
  const completedStages = stageRows.filter((stage) => stage.completed).length;
  const completion = Math.round((completedStages / STAGES.length) * 100);
  const taskCounts = {
    todo: tasks.filter((task) => ['TODO', 'PENDING'].includes((task.status || '').toUpperCase())).length,
    progress: tasks.filter((task) => ['IN_PROGRESS', 'REVIEW'].includes((task.status || '').toUpperCase())).length,
    done: tasks.filter((task) => ['DONE', 'COMPLETED'].includes((task.status || '').toUpperCase())).length
  };
  const hasTasks = tasks.length > 0;
  const totalTasks = Math.max(tasks.length, 1);
  const stageProgressSegments = stageRows.map((stage, index) => ({
    color: stage.completed ? stage.color : stage.current ? '#dbeafe' : 'var(--surface-hover)',
    width: `${100 / STAGES.length}%`,
    opacity: stage.completed || stage.current ? 1 : 0.7,
    title: `${stage.label}: ${stage.completed ? 'Completed' : stage.current ? 'Current' : 'Pending'}`
  }));
  const taskProgressSegments = [
    { color: '#ef4444', width: `${(taskCounts.todo / totalTasks) * 100}%`, opacity: 1, title: 'To do' },
    { color: '#f59e0b', width: `${(taskCounts.progress / totalTasks) * 100}%`, opacity: 1, title: 'In progress' },
    { color: '#22c55e', width: `${(taskCounts.done / totalTasks) * 100}%`, opacity: 1, title: 'Completed' }
  ];
  const progressSegments = hasTasks ? taskProgressSegments : stageProgressSegments;

  if (isLoading) {
    return <Card elevation={1}><Loader /></Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '16px' : '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Overall Completion</h4>
            <Square size={18} fill="#3b82f6" color="#3b82f6" />
          </div>
          <h2 style={{ margin: '0 0 16px', fontSize: '32px', fontWeight: 700 }}>{completion}%</h2>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${completion}%`, height: '100%', backgroundColor: completion >= 75 ? '#22c55e' : completion >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </Card>

        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>Days Remaining</h4>
          <h2 style={{ margin: '0 0 8px', fontSize: '32px', fontWeight: 700 }}>{remainingDays === null ? '-' : Math.max(remainingDays, 0)}</h2>
          <p style={{ margin: 0, fontSize: '12px', color: remainingDays !== null && remainingDays < 0 ? '#dc2626' : '#2563eb', fontWeight: 600 }}>
            {currentStage?.label}: {formatDate(nextDeadline)}
          </p>
        </Card>

        <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Last Submission</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{timeAgo(latestSubmission?.uploadedAt)}</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, wordBreak: 'break-word' }}>
            {latestSubmission ? (latestSubmission.fileName || extractFirstUrl(latestSubmission.comment) || `${latestSubmission.stage} submission`) : 'No submissions yet'}
          </h2>
        </Card>
      </div>



      <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px' }}>Project Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
          <div style={{ position: 'absolute', left: '6px', top: '8px', bottom: '24px', width: '2px', backgroundColor: '#dbeafe' }} />
          {stageRows.map((stage, index) => (
            <div key={stage.key} style={{ position: 'relative', marginBottom: index === stageRows.length - 1 ? 0 : '28px' }}>
              <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white', border: `2px solid ${stage.color}` }} />
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stage.label}
                    {stage.completed && <CheckCircle size={14} color="#16a34a" />}
                    {stage.current && <span style={{ fontSize: '10px', color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>CURRENT</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span><Calendar size={12} style={{ verticalAlign: 'middle' }} /> Deadline {formatDate(stage.deadline)}</span>
                    <span><FileText size={12} style={{ verticalAlign: 'middle' }} />{stage.doneTasks}/{stage.stageTasks.length || 0} tasks done</span>
                    <span><UploadCloud size={12} style={{ verticalAlign: 'middle' }} /> {stage.latestSubmission ? stage.latestSubmission.status : 'No submission'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {stageRows.every((stage) => !stage.deadline) && (
            <div style={{ fontSize: '13px', color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} /> No admin timeline has been configured for this project form yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ProjectTimeline;
