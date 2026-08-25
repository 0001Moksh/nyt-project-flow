import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loader, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import {
  Calendar,
  Users,
  MessageSquare,
  MapPin,
  Video,
  CheckCircle,
  Clock,
  Pencil,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { ExecuteMeetingModal } from './ExecuteMeetingModal';
import { RescheduleMeetingModal } from './RescheduleMeetingModal';
import type { FormAttachment, FormResponse } from '../../services/adminService';
import { getPreviewUrl } from '../../utils/filePreview';
import { isValidMeetingLink, openMeetingLink } from '../../utils/meetingLinks';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';

const parseReferenceFiles = (json?: string | null): FormAttachment[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const SupervisorTeamOverview: React.FC = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);

  // Core data
  const [project, setProject] = useState<any>(null);
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [formConfig, setFormConfig] = useState<FormResponse | null>(null);
  const [previewFile, setPreviewFile] = useState<FormAttachment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Modal state
  const [isScheduling, setIsScheduling] = useState(false);
  const [executingMeetingId, setExecutingMeetingId] = useState<string | null>(null);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<any | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<any>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const addToast = useToastStore(state => state.addToast);

  // Filter submissions for "Last Submission" (100% peer approved, pending supervisor review)
  // Helper to check if submission is pending supervisor review
  const isPendingSupervisorReview = (submission: any) => {
    const status = String(submission?.status || '').toUpperCase();
    const teamReviewStatus = String(submission?.teamReviewStatus || '').toUpperCase();
    return status === 'PENDING_SUPERVISOR_REVIEW' || teamReviewStatus === 'PENDING_SUPERVISOR_REVIEW' || teamReviewStatus === 'PENDING_SRVR';
  };

  // Helper to check if team has fully approved a submission
  // Returns true if all team members have approved (based on teamReviewJson)
  const isTeamFullyApproved = (submission: any, teamSize: number) => {
    if (!teamSize || teamSize <= 1) return false; // No team review needed for single member
    try {
      const teamReviewJson = submission?.teamReviewJson;
      if (!teamReviewJson) return false;
      const votes = JSON.parse(teamReviewJson);
      if (!Array.isArray(votes)) return false;
      const approvedVotes = votes.filter((v: any) => v.approved === true).length;
      return approvedVotes === teamSize;
    } catch {
      return false;
    }
  };

  const lastSubmission = useMemo(() => {
    // Find submissions that are pending supervisor review
    // This includes both the 'status' and 'teamReviewStatus' fields
    return submissions.find((s: any) => {
      const status = String(s.status || '').toUpperCase();
      const teamReviewStatus = String(s.teamReviewStatus || '').toUpperCase();
      const isSupervisorPending = status === 'PENDING_SUPERVISOR_REVIEW' || teamReviewStatus === 'PENDING_SUPERVISOR_REVIEW' || teamReviewStatus === 'PENDING_SRVR';

      // Also check if team fully approved but status not updated yet
      const isTeamFullyApproved = s?.teamReviewJson ? (() => {
        try {
          const votes = JSON.parse(s.teamReviewJson);
          if (!Array.isArray(votes)) return false;
          const approvedVotes = votes.filter((v: any) => v.approved === true).length;
          // Assume team size of 3 if not available (typical team size)
          return approvedVotes >= 3;
        } catch {
          return false;
        }
      })() : false;

      return isSupervisorPending || isTeamFullyApproved;
    });
  }, [submissions]);

  // Get team size for approval tracking
  const teamSize = members.length;

  // Filter submissions for "Deliverables Tracking" (supervisor approved)
  const approvedDeliverables = useMemo(() => {
    return submissions
      .filter((s: any) => s.status === 'APPROVED')
      .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [submissions]);

  const [activeStage, setActiveStage] = useState('SYNOPSIS');

  const handleRequestChanges = (submission: any) => {
    setPendingSubmission(submission);
    setFeedbackText('');
    setFeedbackModalOpen(true);
  };

  const handleApprove = async (submission: any) => {
    try {
      const stage = submission.stage?.toLowerCase() || 'synopsis';
      await api.patch(`/submissions/${stage}/${submission[`${stage}Id`] || submission.finalId || submission.synopsisId || submission.progress1Id || submission.progress2Id}/supervisor-review`, {
        supervisorId: useAuthStore.getState().user?.id,
        approved: true,
        marks: 0 // Will be updated in backend if needed
      });
      addToast('Deliverable approved successfully', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to approve deliverable', 'error');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !pendingSubmission) return;
    try {
      const stage = pendingSubmission.stage?.toLowerCase() || 'synopsis';
      await api.patch(`/submissions/${stage}/${pendingSubmission[`${stage}Id`] || pendingSubmission.finalId || pendingSubmission.synopsisId || pendingSubmission.progress1Id || pendingSubmission.progress2Id}/supervisor-review`, {
        supervisorId: useAuthStore.getState().user?.id,
        approved: false,
        comment: feedbackText
      });
      addToast('Feedback submitted successfully', 'success');
      setFeedbackModalOpen(false);
      setPendingSubmission(null);
      setFeedbackText('');
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to submit feedback', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projRes, teamsRes, teamMembersRes, stuRes] = await Promise.all([
        api.get('/projects'),
        api.get('/teams'),
        api.get('/team-members'),
        api.get('/students'),
      ]);

      // Support both teamId and accidental projectId in the route param
      let thisProject =
        (projRes.data || []).find((p: any) => p.teamId === teamId) ||
        (projRes.data || []).find((p: any) => p.projectId === teamId);

      const thisTeam = (teamsRes.data || []).find(
        (t: any) => t.teamId === (thisProject?.teamId || teamId)
      );
      const thisTeamMembers = (teamMembersRes.data || []).find(
        (t: any) => t.teamId === (thisProject?.teamId || teamId)
      );

      setProject(thisProject || null);
      setTeamInfo(thisTeam || thisTeamMembers || null);

      // Fetch submissions from all stages
      let allSubmissions: any[] = [];
      if (thisProject?.documentId) {
        try {
          const stages = ['synopsis', 'progress1', 'progress2', 'final'];
          const submissionPromises = stages.map((stage) =>
            api.get(`/submissions/${stage}/document/${thisProject.documentId}`).catch(() => ({ data: [] }))
          );
          const results = await Promise.all(submissionPromises);
          allSubmissions = results.flatMap((res) => res.data || []);
        } catch (err) {
          console.error("Failed to fetch submissions:", err);
        }
      }
      setSubmissions(allSubmissions);

      if (thisProject?.projectId) {
        try {
          const mRes = await api.get(`/supervisor/meetings/project/${thisProject.projectId}`);
          setMeetings(mRes.data || []);
        } catch (err) {
          console.error(err);
          setMeetings([]);
        }

        try {
          const fRes = await api.get(`/forms/${thisProject.formId}`);
          setFormConfig(fRes.data || null);
        } catch (err) {
          console.error(err);
        }
      } else {
        setMeetings([]);
      }

      const memberIds: string[] = [];
      if (thisTeam?.leaderId) memberIds.push(thisTeam.leaderId);

      try {
        const invited = JSON.parse(thisTeam?.teamMemberArray || '[]');
        if (Array.isArray(invited)) memberIds.push(...invited);
      } catch {
        /* ignore */
      }

      try {
        const joined = JSON.parse(thisTeamMembers?.joinMemberArray || '[]');
        if (Array.isArray(joined)) memberIds.push(...joined);
      } catch {
        /* ignore */
      }

      const uniqueIds = Array.from(new Set(memberIds));

      const mems = uniqueIds
        .map((id: string, idx: number) => {
          const s = (stuRes.data || []).find((stu: any) => stu.studentId === id);
          if (!s) return null;
          return {
            ...s,
            role: id === thisTeam?.leaderId || idx === 0 ? 'Leader' : 'Developer',
          };
        })
        .filter((x: any) => x && x.studentId);

      setMembers(mems);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 20px' }}>
        <Loader size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Project not found.
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}
    >
      {/* Top Team Hero Card */}
      <Card
        elevation={1}
        style={{
          padding: '0',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            padding: '32px 40px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#fdfdfd',
          }}
        >
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: '#0f172a',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid rgba(255,255,255,0.25)',
                  borderRadius: '50%',
                  borderTopColor: 'var(--primary)',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {project.projectTitle || 'Untitled Project'}
                </h2>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: '#e6f4ea',
                    color: '#16a34a',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                  }}
                >
                  APPROVED
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} /> {members.length} Members
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '40px' }}>
        {/* Left Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <ProjectTimeline project={project} />

          {/* Project Meetings */}
          <Card
            elevation={1}
            style={{
              border: '1px solid #bae6fd',
              borderRadius: '16px',
              backgroundColor: '#f0f9ff',
              padding: '28px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '19px',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Calendar size={20} /> Project Meetings
              </h3>
              <Button variant="outline" size="sm" onClick={() => setIsScheduling(true)}>
                + New Meeting
              </Button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#0369a1' }}>
              Batch schedules from admin appear here. Reschedule applies only to this team — other teams
              keep their slots.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {meetings.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#0ea5e9',
                    fontSize: '14.5px',
                  }}
                >
                  No meetings scheduled for this project yet.
                </div>
              )}

              {meetings.map((meeting) => (
                <div
                  key={meeting.meetingId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px',
                    border: '1px solid #bae6fd',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', gap: '18px', flex: 1 }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor:
                          meeting.status === 'COMPLETED' ? '#dcfce7' : '#e0f2fe',
                        color: meeting.status === 'COMPLETED' ? '#16a34a' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {meeting.mode === 'ONLINE' ? <Video size={24} /> : <MapPin size={24} />}
                    </div>

                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '16px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {meeting.stage} Review
                        {meeting.sessionId && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#0369a1',
                              backgroundColor: '#e0f2fe',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            BATCH
                          </span>
                        )}
                        {meeting.originalMeetingDate && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#b45309',
                              backgroundColor: '#fef3c7',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            RESCHEDULED
                            {meeting.rescheduledBy ? ` · ${meeting.rescheduledBy}` : ''}
                          </span>
                        )}
                        {meeting.status === 'COMPLETED' && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#16a34a',
                              backgroundColor: '#dcfce7',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle size={12} style={{ marginRight: '4px' }} />
                            COMPLETED
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '20px',
                          fontSize: '14px',
                          color: '#0369a1',
                          fontWeight: 500,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          <Calendar size={15} style={{ marginRight: '6px' }} />
                          {meeting.meetingDate}
                        </span>
                        <span>
                          <Clock size={15} style={{ marginRight: '6px' }} />
                          {String(meeting.meetingTime || '').substring(0, 5)}
                          {meeting.endTime
                            ? ` - ${String(meeting.endTime).substring(0, 5)}`
                            : ''}
                        </span>
                      </div>

                      {meeting.originalMeetingDate && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                          Original batch slot: {meeting.originalMeetingDate} at{' '}
                          {String(meeting.originalMeetingTime || '').substring(0, 5)}
                        </div>
                      )}

                      {meeting.status === 'COMPLETED' && meeting.conclusionNotes && (
                        <div
                          style={{
                            marginTop: '10px',
                            fontSize: '13.5px',
                            color: '#475569',
                            fontStyle: 'italic',
                          }}
                        >
                          “{meeting.conclusionNotes}”
                        </div>
                      )}
                    </div>
                  </div>

                  {meeting.status === 'SCHEDULED' && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                      }}
                    >
                      {meeting.mode === 'ONLINE' &&
                        (isValidMeetingLink(meeting.locationOrLink) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMeetingLink(meeting.locationOrLink)}
                          >
                            Join Meeting
                          </Button>
                        ) : (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#dc2626',
                              fontWeight: 600,
                              alignSelf: 'center',
                            }}
                          >
                            Invalid meeting link
                          </span>
                        ))}

                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Pencil size={14} />}
                        onClick={() => setRescheduleMeeting(meeting)}
                      >
                        Reschedule
                      </Button>

                      <Button size="sm" onClick={() => setExecutingMeetingId(meeting.meetingId)}>
                        Evaluate Now
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Team Composition */}
          <Card
            elevation={1}
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#fdfdfd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                TEAM COMPOSITION
              </h4>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                {members.length} Members
              </span>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {members.map((member, i) => {
                  const displayName = member.name || member.studentName || 'Unknown';
                  const initial = displayName.charAt(0).toUpperCase();

                  return (
                    <div key={member.studentId || i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor:
                            member.role === 'Leader'
                              ? 'var(--primary-glow)'
                              : 'var(--surface-hover)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color:
                            member.role === 'Leader'
                              ? 'var(--primary)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {initial}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{displayName}</div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color:
                              member.role === 'Leader'
                                ? 'var(--primary)'
                                : 'var(--text-disabled)',
                            fontWeight: 600,
                            letterSpacing: '0.6px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {member.role === 'Leader' ? 'PROJECT LEADER' : 'TEAM MEMBER'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group Chat Button */}
            <div
              onClick={() => navigate(`/chat?project=${project.projectId}`)}
              style={{
                padding: '18px',
                backgroundColor: '#22c55e',
                color: 'white',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
            >
              <MessageSquare size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              ENTER GROUP CHAT
            </div>
          </Card>

          {/* Last Submission Card */}
          <Card
            elevation={1}
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#fffbeb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#92400e',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                Last Submission
              </h4>
              {lastSubmission && (
                <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px' }}>
                  For Review
                </span>
              )}
            </div>
            <div style={{ padding: '24px' }}>
              {lastSubmission ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--surface-hover)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '10px',
                      }}
                    >
                      <FileText size={18} color="var(--primary)" />
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{lastSubmission.fileName}</span>
                      <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '8px' }}>
                        {lastSubmission.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                      Uploaded: {new Date(lastSubmission.uploadedAt).toLocaleDateString()}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewFile({ fileName: lastSubmission.fileName, fileUrl: lastSubmission.fileUrl || '' })}
                        style={{ flex: 1 }}
                      >
                        View Deliverable
                      </Button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApprove(lastSubmission)}
                      style={{ width: '100%' }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestChanges(lastSubmission)}
                      style={{ width: '100%', borderColor: '#dc2626', color: '#dc2626' }}
                    >
                      Request to Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 16px',
                    color: 'var(--text-disabled)',
                  }}
                >
                  <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: '14px' }}>No pending submissions for review</p>
                </div>
              )}
            </div>
          </Card>

          {/* Deliverables Tracking Card */}
          <Card
            elevation={1}
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f0fdf4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#166534',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                Deliverables Tracking
              </h4>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                {approvedDeliverables.length} Approved
              </span>
            </div>
            <div style={{ padding: '24px' }}>
              {approvedDeliverables.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 16px',
                    color: 'var(--text-disabled)',
                  }}
                >
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ fontSize: '14px' }}>No approved deliverables yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {approvedDeliverables.map((del: any) => (
                    <div
                      key={del.submissionId}
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--surface-hover)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{del.fileName}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '2px 8px',
                            borderRadius: '8px',
                          }}
                        >
                          APPROVED
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)',
                          marginBottom: '10px',
                        }}
                      >
                        <span>{del.stage}</span>
                        <span>{new Date(del.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPreviewFile({
                            fileName: del.fileName,
                            fileUrl: del.fileUrl || '',
                          })
                        }
                        style={{ width: '100%' }}
                      >
                        <Download size={12} style={{ marginRight: '6px' }} />
                        View Deliverable
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {isScheduling && (
        <ScheduleMeetingModal
          projectId={project.projectId}
          onClose={() => setIsScheduling(false)}
          onSuccess={() => {
            setIsScheduling(false);
            fetchData();
          }}
        />
      )}

      {executingMeetingId && (
        <ExecuteMeetingModal
          meetingId={executingMeetingId}
          teamMembers={members}
          onClose={() => setExecutingMeetingId(null)}
          onSuccess={() => {
            setExecutingMeetingId(null);
            fetchData();
          }}
        />
      )}

      {rescheduleMeeting && (
        <RescheduleMeetingModal
          meeting={rescheduleMeeting}
          role="SUPERVISOR"
          onClose={() => setRescheduleMeeting(null)}
          onSuccess={() => {
            setRescheduleMeeting(null);
            fetchData();
          }}
        />
      )}

      {/* Feedback Modal for "Request to Change" */}
      {feedbackModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setFeedbackModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '440px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '16px',
                fontSize: '18px',
                fontWeight: 700,
                color: '#dc2626',
              }}
            >
              Request Changes
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Enter feedback for the team. They will need to make the requested changes and resubmit.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Required Changes / Comments
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Specify what changes are required..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmitFeedback} disabled={!feedbackText.trim()}>
                Submit Feedback
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100,
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{
              width: 'min(1000px, 96vw)',
              height: 'min(85vh, 760px)',
              backgroundColor: 'var(--surface)',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '15px' }}>{previewFile.fileName}</div>
              <Button size="sm" variant="outline" onClick={() => setPreviewFile(null)}>
                Close
              </Button>
            </div>
            <iframe
              title={previewFile.fileName}
              src={getPreviewUrl(previewFile.fileUrl)}
              style={{ width: '100%', height: 'calc(100% - 53px)', border: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorTeamOverview;