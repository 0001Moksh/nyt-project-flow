import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, FileText, UploadCloud } from 'lucide-react';
import { Card } from './Card';
import { Loader } from './Loader';
import { api } from '../services/api';

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
  // Prefer date-only parsing to avoid timezone shifting YYYY-MM-DD
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  return String(value).substring(0, 5);
};

/** Pick the best meeting for a stage: prefer upcoming/scheduled, then most recent. */
const pickStageMeeting = (meetings: any[], stageKey: string) => {
  const stageMeetings = (meetings || []).filter((m) => String(m.stage || '').toUpperCase() === stageKey);
  if (stageMeetings.length === 0) return null;

  const rank = (m: any) => {
    const status = String(m.status || '').toUpperCase();
    if (status === 'SCHEDULED') return 0;
    if (status === 'COMPLETED') return 2;
    return 1;
  };

  return stageMeetings.slice().sort((a, b) => {
    const byStatus = rank(a) - rank(b);
    if (byStatus !== 0) return byStatus;
    const aKey = `${a.meetingDate || ''} ${a.meetingTime || ''}`;
    const bKey = `${b.meetingDate || ''} ${b.meetingTime || ''}`;
    return bKey.localeCompare(aKey); // newest first among same status
  })[0];
};

interface ProjectTimelineProps {
  project: any;
  compact?: boolean;
  /** When true, render nothing until admin has configured at least one stage deadline. */
  hideWhenUnconfigured?: boolean;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ project, compact = false, hideWhenUnconfigured = false }) => {
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
    const formDeadline = timeline?.[stage.dateField];
    const stageMeeting = pickStageMeeting(meetings, stage.key);
    // Team-specific meeting date/time wins over batch form timeline (covers reschedules)
    const deadline = stageMeeting?.meetingDate || formDeadline || null;
    const meetingTimeLabel = stageMeeting
      ? `${formatTime(stageMeeting.meetingTime)}${stageMeeting.endTime ? ` - ${formatTime(stageMeeting.endTime)}` : ''}`
      : null;
    const isRescheduled = Boolean(stageMeeting?.originalMeetingDate);
    const originalLabel = isRescheduled
      ? `${formatDate(stageMeeting.originalMeetingDate)}${stageMeeting.originalMeetingTime ? ` at ${formatTime(stageMeeting.originalMeetingTime)}` : ''}`
      : null;

    const stageTasks = tasks.filter((task) => task.stageStatus === stage.key);
    const doneTasks = stageTasks.filter((task) => ['DONE', 'COMPLETED'].includes((task.status || '').toUpperCase())).length;
    const stageSubmissions = submissions.filter((submission) => submission.stage === stage.key);
    const latestSubmission = stageSubmissions
      .slice()
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())[0];
    const completed = index < stageIndex || latestSubmission?.status === 'APPROVED';
    const current = index === stageIndex;

    return {
      ...stage,
      deadline,
      formDeadline,
      meetingTimeLabel,
      isRescheduled,
      originalLabel,
      stageTasks,
      doneTasks,
      latestSubmission,
      completed,
      current,
    };
  }), [timeline, tasks, submissions, meetings, stageIndex]);

  const hasConfiguredTimeline = STAGES.some((stage) => Boolean(timeline?.[stage.dateField]));

  if (isLoading) {
    return <Card elevation={1}><Loader /></Card>;
  }

  if (hideWhenUnconfigured && !hasConfiguredTimeline) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '16px' : '24px' }}>
      <Card elevation={1} style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600 }}>Project Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
          <div style={{ position: 'absolute', left: '6px', top: '8px', bottom: '24px', width: '2px', backgroundColor: '#dbeafe' }} />
          {stageRows.map((stage, index) => (
            <div key={stage.key} style={{ position: 'relative', marginBottom: index === stageRows.length - 1 ? 0 : '28px' }}>
              <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white', border: `2px solid ${stage.color}` }} />
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>
                      <Calendar size={12} style={{ verticalAlign: 'middle' }} /> Deadline {formatDate(stage.deadline)}
                      {stage.meetingTimeLabel ? ` · ${stage.meetingTimeLabel}` : ''}
                    </span>
                    <span><FileText size={12} style={{ verticalAlign: 'middle' }} />{stage.doneTasks}/{stage.stageTasks.length || 0} tasks done</span>
                    <span><UploadCloud size={12} style={{ verticalAlign: 'middle' }} /> {stage.latestSubmission ? stage.latestSubmission.status : 'No submission'}</span>
                  </div>
                  {stage.isRescheduled && stage.originalLabel && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Was: {stage.originalLabel}
                    </div>
                  )}
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
