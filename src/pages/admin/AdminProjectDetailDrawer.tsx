import React, { useEffect, useState } from 'react';
import { Loader, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import { Users, X } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  SYNOPSIS: 'Synopsis',
  PROGRESS1: 'Progress 1',
  PROGRESS2: 'Progress 2',
  FINAL: 'Final Submission',
};

const getStageLabel = (stage?: string) => STAGE_LABELS[String(stage || '').toUpperCase()] || stage || '—';

const parseIdArray = (value?: string | null): string[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface AdminProjectDetailDrawerProps {
  projectId: string | null;
  onClose: () => void;
}

/**
 * Reusable admin project detail side drawer (Form View Config / Students / Supervisors).
 */
export const AdminProjectDetailDrawer: React.FC<AdminProjectDetailDrawerProps> = ({ projectId, onClose }) => {
  const [project, setProject] = useState<any | null>(null);
  const [supervisorName, setSupervisorName] = useState<string>('Unassigned');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [projRes, teamsRes, teamMembersRes, studentsRes, supervisorsRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get('/teams').catch(() => ({ data: [] })),
          api.get('/team-members').catch(() => ({ data: [] })),
          api.get('/students').catch(() => ({ data: [] })),
          api.get('/supervisors').catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;
        const p = projRes.data;
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
        setProject({
          ...p,
          team,
          memberDetails,
          leaderName,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return null;

  const lastUpdated =
    project?.updatedAt ||
    project?.createdAt ||
    null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 950 }}
      onClick={onClose}
    >
      <div
        style={{ width: '800px', maxWidth: '94vw', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10, padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>{project?.projectTitle || 'Project details'}</h2>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px', flexWrap: 'wrap' }}>
              <span>Leader: <strong>{project?.leaderName || '—'}</strong></span>
              <span>Stage: <strong>{getStageLabel(project?.stageStatus)}</strong></span>
              <span>Supervisor: <strong>{supervisorName}</strong></span>
              {lastUpdated && (
                <span>
                  Last updated:{' '}
                  <strong>{new Date(lastUpdated).toLocaleString()}</strong>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {isLoading || !project ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
              <Loader />
            </div>
          ) : (
            <>
              <ProjectTimeline project={project} />

              <div>
                <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--primary)" /> Team Members
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {project.memberDetails?.length ? (
                    project.memberDetails.map((m: any) => (
                      <div key={m.studentId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                          {m.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {m.name}
                            {m.studentId === project.team?.leaderId ? (
                              <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '8px' }}>LEADER</span>
                            ) : m.inviteStatus !== 'APPROVED' ? (
                              <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>PENDING</span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.mail}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', color: 'var(--text-disabled)', fontSize: '13px' }}>No team members found.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProjectDetailDrawer;
