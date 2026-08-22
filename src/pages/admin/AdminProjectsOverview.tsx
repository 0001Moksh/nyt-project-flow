import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Loader, Input, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { AlertTriangle, Users, Eye, X, Search } from 'lucide-react';
import { InlineSupervisorAssign } from './InlineSupervisorAssign';
import { cleanProjectDescription } from '../../utils/projectDescription';

const STAGE_LABELS: Record<string, string> = {
  SYNOPSIS: 'Synopsis',
  PROGRESS1: 'Progress 1',
  PROGRESS2: 'Progress 2',
  FINAL: 'Final Solution',
};

const STAGE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Stages' },
  { value: 'SYNOPSIS', label: 'Synopsis' },
  { value: 'PROGRESS1', label: 'Progress 1' },
  { value: 'PROGRESS2', label: 'Progress 2' },
  { value: 'FINAL', label: 'Final Solution' },
];

const filterSelectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  minWidth: '180px',
  outline: 'none',
};

const truncateText = (text?: string, max = 120) => {
  const clean = cleanProjectDescription(text).replace(/\s+/g, ' ').trim();
  if (!clean) return '—';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
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

export const AdminProjectsOverview: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewProject, setViewProject] = useState<any | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ projectId: string; newSupervisorId: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupervisorId, setFilterSupervisorId] = useState('ALL');
  const [filterStage, setFilterStage] = useState('ALL');

  const addToast = useToastStore((state) => state.addToast);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projRes, supRes, teamsRes, teamMembersRes, studentsRes] = await Promise.all([
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/supervisors').catch(() => ({ data: [] })),
        api.get('/teams').catch(() => ({ data: [] })),
        api.get('/team-members').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] })),
      ]);

      const allProjects = projRes.data || [];
      const allSupervisors = supRes.data || [];
      const allTeams = teamsRes.data || [];
      const allTeamMembers = teamMembersRes.data || [];
      const allStudents = studentsRes.data || [];

      const sups = allSupervisors.map((sup: any) => ({
        ...sup,
        assignedCount: allProjects.filter((p: any) => p.supervisorId === sup.supervisorId).length,
      }));

      // Lightweight enrichment only — submissions load on drawer open
      const enriched = allProjects.map((p: any) => {
        const team = allTeams.find((t: any) => t.teamId === p.teamId);
        let memberDetails: any[] = [];
        let leaderName = '—';
        if (team) {
          const memberStatus = allTeamMembers.find((tm: any) => tm.teamId === team.teamId);
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
        return { ...p, team, memberDetails, leaderName };
      });

      setProjects(enriched);
      setSupervisors(sups);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupervisorSelect = (projectId: string, currentSupervisorId: string, newSupervisorId: string) => {
    if (!newSupervisorId) return;
    if (currentSupervisorId && currentSupervisorId !== newSupervisorId) {
      setPendingAssignment({ projectId, newSupervisorId });
      setReasonText('');
      setReasonModalOpen(true);
    } else {
      executeAssignSupervisor(projectId, newSupervisorId, '');
    }
  };

  const executeAssignSupervisor = async (projectId: string, supervisorId: string, reason: string) => {
    try {
      const oldId = projects.find((p) => p.projectId === projectId)?.supervisorId;
      await api.post(`/projects/${projectId}/assign-supervisor`, {
        supervisorId,
        adminId: user?.id,
        reason,
      });
      setProjects((prev) => prev.map((p) => (p.projectId === projectId ? { ...p, supervisorId } : p)));
      setSupervisors((prev) =>
        prev.map((s) => {
          if (s.supervisorId === supervisorId) return { ...s, assignedCount: (s.assignedCount || 0) + 1 };
          if (oldId && s.supervisorId === oldId) return { ...s, assignedCount: Math.max(0, (s.assignedCount || 0) - 1) };
          return s;
        })
      );
      if (viewProject?.projectId === projectId) {
        setViewProject({ ...viewProject, supervisorId });
      }
      addToast('Supervisor Assignment Updated successfully.', 'success');
      setReasonModalOpen(false);
      setPendingAssignment(null);
    } catch (err: any) {
      console.error('Failed to assign supervisor', err);
      addToast(err.response?.data?.message || 'Failed to assign supervisor.', 'error');
    }
  };

  const openProjectDrawer = async (project: any) => {
    setViewProject(project);
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return projects.filter((proj) => {
      if (filterSupervisorId !== 'ALL' && proj.supervisorId !== filterSupervisorId) {
        return false;
      }

      if (filterStage !== 'ALL' && String(proj.stageStatus || '').toUpperCase() !== filterStage) {
        return false;
      }

      if (!q) return true;

      const title = String(proj.projectTitle || '').toLowerCase();
      const description = cleanProjectDescription(proj.projectDescription).toLowerCase();
      const leader = String(proj.leaderName || '').toLowerCase();

      return title.includes(q) || description.includes(q) || leader.includes(q);
    });
  }, [projects, searchQuery, filterSupervisorId, filterStage]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="admin-projects-overview" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>Projects</h1>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)', pointerEvents: 'none' }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, description, or leader…"
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={filterSupervisorId}
          onChange={(e) => setFilterSupervisorId(e.target.value)}
          style={filterSelectStyle}
          aria-label="Filter by supervisor"
        >
          <option value="ALL">All Supervisors</option>
          {[...supervisors]
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .map((sup) => (
              <option key={sup.supervisorId} value={sup.supervisorId}>
                {sup.name}
              </option>
            ))}
        </select>

        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          style={filterSelectStyle}
          aria-label="Filter by stage"
        >
          {STAGE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-projects-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
            <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <tr>
                <th style={{ padding: '16px 24px', fontWeight: 600, width: '16%' }}>Leader Name</th>
                <th style={{ padding: '16px', fontWeight: 600, width: '18%' }}>Project Name</th>
                <th style={{ padding: '16px', fontWeight: 600, width: '28%' }}>Project Description</th>
                <th style={{ padding: '16px', fontWeight: 600, width: '18%' }}>Assigned Supervisor</th>
                <th style={{ padding: '16px', fontWeight: 600, width: '12%' }}>Current Stage</th>
                <th style={{ padding: '16px', fontWeight: 600, width: '8%', textAlign: 'center' }}>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-disabled)' }}>
                    {projects.length === 0
                      ? 'No active projects.'
                      : 'No projects match your search or filters.'}
                  </td>
                </tr>
              )}
              {filteredProjects.map((proj) => {
                const sup = supervisors.find((s) => s.supervisorId === proj.supervisorId);
                return (
                  <tr key={proj.projectId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proj.leaderName}>
                      {proj.leaderName || '—'}
                    </td>
                    <td style={{ padding: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proj.projectTitle}>
                      {proj.projectTitle}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }} title={cleanProjectDescription(proj.projectDescription) || undefined}>
                      <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {truncateText(proj.projectDescription, 120)}
                      </div>
                    </td>
                    <td style={{ padding: '16px', overflow: 'visible' }}>
                      <InlineSupervisorAssign
                        projectId={proj.projectId}
                        currentSupervisorId={proj.supervisorId}
                        supervisorName={sup?.name}
                        supervisors={supervisors}
                        onSelect={handleSupervisorSelect}
                      />
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600 }}>
                        {getStageLabel(proj.stageStatus)}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        title="View project"
                        onClick={() => openProjectDrawer(proj)}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#fff',
                          color: 'var(--primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {viewProject && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 900 }}
          onClick={() => setViewProject(null)}
        >
          <div
            style={{ width: '800px', maxWidth: '94vw', height: '100%', backgroundColor: 'var(--surface)', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10, padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>{viewProject.projectTitle}</h2>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px', flexWrap: 'wrap' }}>
                  <span>Leader: <strong>{viewProject.leaderName || '—'}</strong></span>
                  <span>Stage: <strong>{getStageLabel(viewProject.stageStatus)}</strong></span>
                  <span>
                    Supervisor:{' '}
                    <strong>
                      {supervisors.find((s) => s.supervisorId === viewProject.supervisorId)?.name || 'Unassigned'}
                    </strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewProject(null)}
                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ProjectTimeline project={viewProject} />

              <div>
                <h4 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--primary)" /> Team Members
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewProject.memberDetails?.map((m: any) => (
                    <div key={m.studentId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {m.name}
                          {m.studentId === viewProject.team?.leaderId ? (
                            <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '8px' }}>LEADER</span>
                          ) : m.inviteStatus !== 'APPROVED' ? (
                            <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>PENDING</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.mail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reasonModalOpen && pendingAssignment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle color="#f59e0b" size={20} /> Reassign Supervisor
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              You are replacing an existing supervisor. A reason is required for administrative tracking and notifications.
            </p>

            <div style={{ marginTop: '16px', marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                Reason for Change <span style={{ color: 'red' }}>*</span>
              </label>
              <Input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="E.g., Requested by student, Availability issues..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setReasonModalOpen(false);
                  setPendingAssignment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => executeAssignSupervisor(pendingAssignment.projectId, pendingAssignment.newSupervisorId, reasonText)}
                disabled={!reasonText.trim()}
              >
                Confirm Reassignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjectsOverview;
