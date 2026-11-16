import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Loader, Input, ProjectTimeline } from '../../components';
import { api } from '../../services/api';
import { useToastStore } from '../../utils/toastStore';
import { useAuthStore } from '../../utils/authStore';
import { AlertTriangle, Users, Eye, X, Search, Plus, Filter, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { InlineSupervisorAssign } from './InlineSupervisorAssign';
import { cleanProjectDescription } from '../../utils/projectDescription';
import { useColumnPersistence } from '../../utils/columnPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../utils/useQueryCache';
import { useAdminProjects } from '../../hooks/useAdminData';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ProjectMember {
  studentId: string;
  name?: string;
  mail?: string;
  inviteStatus?: string;
}

interface Project {
  projectId: string;
  projectTitle?: string;
  projectDescription?: string;
  leaderName?: string;
  supervisorId?: string;
  stageStatus?: string;
  meetingMode?: string;
  meetingDate?: string;
  startTime?: string;
  endTime?: string;
  customFieldsJson?: string;
  memberDetails?: ProjectMember[];
  team?: {
    leaderId?: string;
  };
}

interface Supervisor {
  supervisorId: string;
  name?: string;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

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

type ColumnKey =
  | 'leader'
  | 'projectName'
  | 'description'
  | 'supervisor'
  | 'stage'
  | 'meetingMode'
  | 'meetingSlot'
  | 'action'
  | `custom:${string}`;

type ColumnDef = {
  key: ColumnKey;
  label: string;
  section: 'main' | 'other';
  defaultVisible?: boolean;
  filterable?: boolean;
  width?: string;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'leader', label: 'Leader Name', section: 'main', defaultVisible: true, width: '16%' },
  { key: 'projectName', label: 'Project Name', section: 'main', defaultVisible: true, width: '18%' },
  { key: 'description', label: 'Project Description', section: 'main', defaultVisible: true, width: '24%' },
  { key: 'supervisor', label: 'Assigned Supervisor', section: 'main', defaultVisible: true, filterable: true, width: '16%' },
  { key: 'stage', label: 'Current Stage', section: 'main', defaultVisible: true, filterable: true, width: '12%' },
  { key: 'meetingMode', label: 'Meeting Mode', section: 'other', defaultVisible: false, width: '10%' },
  { key: 'meetingSlot', label: 'Meeting Time Slot', section: 'other', defaultVisible: false, width: '14%' },
  { key: 'action', label: 'Action', section: 'main', defaultVisible: true, width: '10%' },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);

const MENU_Z = 5000;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const truncateText = (text?: string, max = 120) => {
  const clean = cleanProjectDescription(text).replace(/\s+/g, ' ').trim();
  if (!clean) return '—';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const getStageLabel = (stage?: string) =>
  STAGE_LABELS[String(stage || '').toUpperCase()] || stage || '—';

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const AdminProjectsOverview: React.FC = () => {
  const navigate = useNavigate();
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    projectId: string;
    newSupervisorId: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupervisorId, setFilterSupervisorId] = useState('ALL');
  const [filterStage, setFilterStage] = useState('ALL');

  const { visibleColumns, setVisibleColumns } = useColumnPersistence(
    'table_cols_admin_projects',
    DEFAULT_VISIBLE
  );
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('table_cols_admin_projects_order') || '[]');
      const valid = Array.isArray(saved) ? saved.filter((key): key is ColumnKey => typeof key === 'string' && (DEFAULT_ORDER.includes(key as ColumnKey) || key.startsWith('custom:'))) : [];
      return [...valid, ...DEFAULT_ORDER.filter((key) => !valid.includes(key))];
    } catch {
      return DEFAULT_ORDER;
    }
  });
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const [openHeaderFilter, setOpenHeaderFilter] = useState<ColumnKey | null>(null);
  const headerFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('table_cols_admin_projects_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const [activeSupervisorRowId, setActiveSupervisorRowId] = useState<string | null>(null);

  // Edit / Delete Modals State
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
  const [editingProjectModal, setEditingProjectModal] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const dragCol = useRef<ColumnKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

  const addToast = useToastStore((state) => state.addToast);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: adminData, isLoading, isFetching, refetch } = useAdminProjects();
  const projects: Project[] = adminData?.projects || [];
  const supervisors: Supervisor[] = adminData?.supervisors || [];
  const dynamicColumns = useMemo<ColumnDef[]>(() => (adminData?.customFieldLabels || []).map((label) => ({
    key: `custom:${label}` as ColumnKey,
    label,
    section: 'other',
    defaultVisible: false,
    width: '16%',
  })), [adminData?.customFieldLabels]);
  const allColumns = useMemo(() => [...ALL_COLUMNS, ...dynamicColumns], [dynamicColumns]);

  useEffect(() => {
    const dynamicKeys = dynamicColumns.map((column) => column.key);
    setColumnOrder((current) => [...current, ...dynamicKeys.filter((key) => !current.includes(key))]);
  }, [dynamicColumns]);

  const isTableRefreshing = isFetching;

  const openEditProjectModal = (proj: Project) => {
    setEditingProjectModal(proj);
    setEditTitle(proj.projectTitle || '');
    setEditDescription(cleanProjectDescription(proj.projectDescription) || '');
  };

  const handleSaveProjectEdit = async () => {
    if (!editingProjectModal) return;
    try {
      await api.put(`/projects/${editingProjectModal.projectId}`, {
        projectTitle: editTitle,
        projectDescription: editDescription,
      });
      addToast('Project updated successfully!', 'success');
      setEditingProjectModal(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    } catch {
      addToast('Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;
    try {
      await api.delete(`/projects/${deleteConfirmProject.projectId}`);
      addToast('Project deleted successfully!', 'success');
      setDeleteConfirmProject(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    } catch {
      addToast('Failed to delete project', 'error');
    }
  };

  const handleRefreshTable = async () => {
    await refetch();
  };

  const handleSupervisorSelect = (
    projectId: string,
    currentSupervisorId: string,
    newSupervisorId: string
  ) => {
    if (!newSupervisorId) return;
    if (currentSupervisorId && currentSupervisorId !== newSupervisorId) {
      setPendingAssignment({ projectId, newSupervisorId });
      setReasonText('');
      setReasonModalOpen(true);
    } else {
      executeAssignSupervisor(projectId, newSupervisorId, '');
    }
    setActiveSupervisorRowId(null);
  };

  const executeAssignSupervisor = async (
    projectId: string,
    supervisorId: string,
    reason: string
  ) => {
    try {
      await api.post(`/projects/${projectId}/assign-supervisor`, {
        supervisorId,
        adminId: user?.id,
        reason,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      addToast('Supervisor Assignment Updated successfully.', 'success');
      setReasonModalOpen(false);
      setPendingAssignment(null);
    } catch (err: unknown) {
      console.error('Failed to assign supervisor', err);
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      addToast(message || 'Failed to assign supervisor.', 'error');
    }
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return projects.filter((proj: Project) => {
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

  const orderedVisible = columnOrder.filter((key) => visibleColumns.includes(key));

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const onDragStart = (key: ColumnKey) => {
    dragCol.current = key;
  };

  const onDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    if (dragCol.current && dragCol.current !== key) {
      setDragOverCol(key);
    }
  };

  const onDrop = (targetKey: ColumnKey) => {
    const fromKey = dragCol.current;
    if (!fromKey || fromKey === targetKey) {
      dragCol.current = null;
      setDragOverCol(null);
      return;
    }
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromKey);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromKey);
      return next;
    });
    dragCol.current = null;
    setDragOverCol(null);
  };

  const onDragEnd = () => {
    dragCol.current = null;
    setDragOverCol(null);
  };

  const isFilterActive = (key: ColumnKey) => {
    if (key === 'supervisor') return filterSupervisorId !== 'ALL';
    if (key === 'stage') return filterStage !== 'ALL';
    return false;
  };

  const applyFilter = (key: ColumnKey, value: string) => {
    if (key === 'supervisor') setFilterSupervisorId(value);
    if (key === 'stage') setFilterStage(value);
    setOpenHeaderFilter(null);
  };

  const getFilterOptions = (key: ColumnKey): { value: string; label: string }[] => {
    if (key === 'supervisor') {
      return [
        { value: 'ALL', label: 'All Supervisors' },
        ...[...supervisors]
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
          .map((sup) => ({ value: sup.supervisorId, label: sup.name || '—' })),
      ];
    }
    if (key === 'stage') return STAGE_FILTER_OPTIONS;
    return [];
  };

  const getCurrentFilterValue = (key: ColumnKey) => {
    if (key === 'supervisor') return filterSupervisorId;
    if (key === 'stage') return filterStage;
    return 'ALL';
  };

  const menuPanelStyle: React.CSSProperties = {
    position: 'absolute',
    minWidth: 180,
    maxHeight: 280,
    overflowY: 'auto',
    background: 'var(--surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
    zIndex: MENU_Z,
    padding: '6px 0',
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: 500,
    pointerEvents: 'auto',
  };

  const renderHeaderCell = (key: ColumnKey) => {
    const col = allColumns.find((c) => c.key === key)!;
    const isDragOver = dragOverCol === key;
    const filterable = !!col.filterable;
    const active = isFilterActive(key);

    return (
      <th
        key={key}
        draggable={!openHeaderFilter && !isColumnPickerOpen}
        onDragStart={() => onDragStart(key)}
        onDragOver={(e) => onDragOver(e, key)}
        onDrop={() => onDrop(key)}
        onDragEnd={onDragEnd}
        style={{
          padding: '12px 16px',
          fontWeight: 600,
          cursor: 'grab',
          userSelect: 'none',
          backgroundColor: 'var(--surface-hover)',
          borderLeft: isDragOver ? '3px solid var(--primary)' : undefined,
          transition: 'border-left 0.15s',
          whiteSpace: 'nowrap',
          position: 'relative',
          width: col.width,
          textAlign: 'left',
          overflow: 'visible',
          verticalAlign: 'middle',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{col.label}</span>
          {filterable && (
            <div
              ref={openHeaderFilter === key ? headerFilterRef : undefined}
              style={{
                position: 'relative',
                display: 'inline-flex',
                zIndex: openHeaderFilter === key ? MENU_Z : 1,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenHeaderFilter((prev) => (prev === key ? null : key));
                  setIsColumnPickerOpen(false);
                }}
                title={`Filter by ${col.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2,
                  border: 'none',
                  background: active ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                <Filter size={12} />
              </button>

              {openHeaderFilter === key && (
                <div
                  style={{
                    ...menuPanelStyle,
                    left: 0,
                    top: '100%',
                    marginTop: 6,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {getFilterOptions(key).map((opt) => {
                    const selected = getCurrentFilterValue(key) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => applyFilter(key, opt.value)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          border: 'none',
                          background: selected ? 'var(--surface-hover)' : 'transparent',
                          color: selected ? 'var(--primary)' : 'var(--text-primary)',
                          fontSize: 13,
                          fontWeight: selected ? 600 : 500,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) e.currentTarget.style.background = 'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </th>
    );
  };

  const renderCell = (proj: Project, key: ColumnKey) => {
    if (key.startsWith('custom:')) {
      const label = key.slice('custom:'.length);
      let value: unknown = null;
      try {
        value = JSON.parse(proj.customFieldsJson || '{}')[label];
      } catch {
        value = null;
      }
      return (
        <td key={key} style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={value == null ? '' : String(value)}>
          {value == null || value === '' ? '—' : String(value)}
        </td>
      );
    }
    const sup = supervisors.find((s) => s.supervisorId === proj.supervisorId);
    const isActiveRow = activeSupervisorRowId === proj.projectId;

    switch (key) {
      case 'leader':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--surface)',
            }}
            title={proj.leaderName}
          >
            {proj.leaderName || '—'}
          </td>
        );
      case 'projectName':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--surface)',
            }}
            title={proj.projectTitle}
          >
            {proj.projectTitle}
          </td>
        );
      case 'description':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              backgroundColor: 'var(--surface)',
            }}
            title={cleanProjectDescription(proj.projectDescription) || undefined}
          >
            <div
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {truncateText(proj.projectDescription, 120)}
            </div>
          </td>
        );
      case 'supervisor':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              overflow: 'visible',
              position: 'relative',
              zIndex: isActiveRow ? 50 : 1,
              backgroundColor: 'var(--surface)',
            }}
            onMouseDown={() => setActiveSupervisorRowId(proj.projectId)}
            onFocusCapture={() => setActiveSupervisorRowId(proj.projectId)}
          >
            <div style={{ position: 'relative', overflow: 'visible' }}>
              <InlineSupervisorAssign
  projectId={proj.projectId}
  currentSupervisorId={proj.supervisorId}
  supervisorName={sup?.name}
  supervisors={supervisors.map((s) => ({
    supervisorId: s.supervisorId,
    name: s.name ?? '—',
  }))}
  onSelect={handleSupervisorSelect}
/>
            </div>
          </td>
        );
      case 'stage':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              position: 'relative',
              zIndex: 0,
              backgroundColor: 'var(--surface)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--primary-glow)',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              {getStageLabel(proj.stageStatus)}
            </span>
          </td>
        );
      case 'meetingMode':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface)',
            }}
          >
            {proj.meetingMode ? (
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: proj.meetingMode === 'ONLINE' ? '#eff6ff' : '#f3f4f6',
                  color: proj.meetingMode === 'ONLINE' ? '#1d4ed8' : '#374151',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                {proj.meetingMode}
              </span>
            ) : (
              '—'
            )}
          </td>
        );
      case 'meetingSlot':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface)',
            }}
          >
            {proj.meetingDate
              ? `${proj.meetingDate} (${proj.startTime || ''}-${proj.endTime || ''})`
              : '—'}
          </td>
        );
      case 'action':
        return (
          <td
            key={key}
            style={{
              padding: '12px 16px',
              textAlign: 'center',
              position: 'relative',
              zIndex: 0,
              backgroundColor: 'var(--surface)',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                title="View project details"
                onClick={() => navigate(`/admin/projects/${proj.projectId}`)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#fff',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Eye size={15} />
              </button>
              <button
                type="button"
                title="Edit project"
                onClick={() => openEditProjectModal(proj)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#fff',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                title="Delete project"
                onClick={() => setDeleteConfirmProject(proj)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#fff',
                  color: 'var(--danger)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  const mainCols = allColumns.filter((c) => c.section === 'main');
  const otherCols = allColumns.filter((c) => c.section === 'other');

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <>
      <div
        className="admin-projects-overview"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {/* Fixed search */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: '1 1 280px',
              minWidth: 220,
              maxWidth: 400,
              marginLeft: 'auto',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-disabled)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name, description, or leader…"
              style={{
                width: '100%',
                padding: '8px 10px 8px 34px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshTable}
            disabled={isTableRefreshing}
            title="Refresh table data"
            style={{ padding: '6px 8px', flexShrink: 0 }}
          >
            <RefreshCw
              size={16}
              style={{ animation: isTableRefreshing ? 'spin 1s linear infinite' : 'none' }}
            />
          </Button>
        </div>

        {/* Table card */}
        <Card
          elevation={1}
          style={{
            padding: 0,
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              position: 'relative',
            }}
          >
            <table
              className="admin-projects-table"
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                textAlign: 'left',
                tableLayout: 'fixed',
              }}
            >
              <thead
                style={{
                  backgroundColor: 'var(--surface-hover)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  position: 'sticky',
                  top: 0,
                  zIndex: MENU_Z,
                }}
              >
                <tr>
                  {orderedVisible.map(renderHeaderCell)}
                  <th
                    style={{
                      padding: '8px 12px',
                      width: 48,
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'visible',
                      backgroundColor: 'var(--surface-hover)',
                    }}
                  >
                    <div
                      ref={columnPickerRef}
                      style={{
                        display: 'inline-flex',
                        gap: '4px',
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsColumnPickerOpen((v) => !v);
                          setOpenHeaderFilter(null);
                        }}
                        title="Show / hide columns"
                        style={{ padding: '5px', minWidth: 0 }}
                      >
                        <Plus size={15} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshTable}
                        disabled={isTableRefreshing}
                        title="Refresh table data"
                        style={{ padding: '5px', minWidth: 0 }}
                      >
                        <RefreshCw
                          size={15}
                          style={{
                            animation: isTableRefreshing ? 'spin 1s linear infinite' : 'none',
                          }}
                        />
                      </Button>

                      {isColumnPickerOpen && (
                        <div
                          style={{
                            ...menuPanelStyle,
                            right: 0,
                            top: '100%',
                            marginTop: 6,
                            width: 260,
                            maxHeight: 'min(320px, 50vh)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              padding: '4px 14px 6px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-disabled)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Main columns
                          </div>
                          {mainCols.map((col) => (
                            <label
                              key={col.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '7px 14px',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--text-primary)',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = 'var(--surface-hover)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = 'transparent')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={visibleColumns.includes(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                              />
                              {col.label}
                            </label>
                          ))}

                          <div
                            style={{
                              height: 1,
                              background: 'var(--border-color)',
                              margin: '8px 0',
                            }}
                          />

                          <div
                            style={{
                              padding: '4px 14px 6px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-disabled)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Other columns
                          </div>
                          {otherCols.map((col) => (
                            <label
                              key={col.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '7px 14px',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--text-primary)',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = 'var(--surface-hover)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = 'transparent')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={visibleColumns.includes(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody style={{ position: 'relative', zIndex: 1 }}>
                {filteredProjects.length === 0 && (
                  <tr>
                    <td
                      colSpan={orderedVisible.length + 1}
                      style={{
                        textAlign: 'center',
                        padding: '48px 32px',
                        color: 'var(--text-disabled)',
                        fontSize: 14,
                        backgroundColor: 'var(--surface)',
                      }}
                    >
                      {projects.length === 0
                        ? 'No active projects.'
                        : 'No projects match your search or filters.'}
                    </td>
                  </tr>
                )}
                {filteredProjects.map((proj: Project) => (
                  <tr
                    key={proj.projectId}
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      fontSize: '14px',
                      position: 'relative',
                      zIndex: activeSupervisorRowId === proj.projectId ? 20 : 1,
                      backgroundColor: 'var(--surface)',
                    }}
                  >
                    {orderedVisible.map((key) => renderCell(proj, key))}
                    <td style={{ padding: '12px', backgroundColor: 'var(--surface)' }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {viewProject && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'flex-end',
              zIndex: 900,
            }}
            onClick={() => setViewProject(null)}
          >
            <div
              style={{
                width: '800px',
                maxWidth: '94vw',
                height: '100%',
                backgroundColor: 'var(--surface)',
                overflowY: 'auto',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--surface)',
                  zIndex: 10,
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>
                    {viewProject.projectTitle}
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Leader: <strong>{viewProject.leaderName || '—'}</strong>
                    </span>
                    <span>
                      Stage: <strong>{getStageLabel(viewProject.stageStatus)}</strong>
                    </span>
                    <span>
                      Supervisor:{' '}
                      <strong>
                        {supervisors.find((s) => s.supervisorId === viewProject.supervisorId)
                          ?.name || 'Unassigned'}
                      </strong>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setViewProject(null)}
                  style={{
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <ProjectTimeline project={viewProject} />

                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      margin: '0 0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Users size={16} color="var(--primary)" /> Team Members
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewProject.memberDetails?.map((m) => (
                      <div
                        key={m.studentId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          backgroundColor: 'var(--surface-hover)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary-glow)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            fontWeight: 'bold',
                          }}
                        >
                          {m.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            {m.name}
                            {m.studentId === viewProject.team?.leaderId ? (
                              <span
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: 'var(--warning)',
                                  color: '#000',
                                  padding: '2px 6px',
                                  borderRadius: '8px',
                                }}
                              >
                                LEADER
                              </span>
                            ) : m.inviteStatus !== 'APPROVED' ? (
                              <span
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  padding: '2px 6px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                }}
                              >
                                PENDING
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {m.mail}
                          </div>
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
          >
            <div
              style={{
                background: 'white',
                padding: '20px 24px',
                borderRadius: '8px',
                width: '400px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle color="#f59e0b" size={20} /> Reassign Supervisor
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                You are replacing an existing supervisor. A reason is required for administrative
                tracking and notifications.
              </p>

              <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  Reason for Change <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="E.g., Requested by student, Availability issues..."
                />
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
                  onClick={() =>
                    executeAssignSupervisor(
                      pendingAssignment.projectId,
                      pendingAssignment.newSupervisorId,
                      reasonText
                    )
                  }
                  disabled={!reasonText.trim()}
                >
                  Confirm Reassignment
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirmProject && (
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
            onClick={() => setDeleteConfirmProject(null)}
          >
            <Card
              style={{ width: '450px', maxWidth: '90vw', padding: '24px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: '0 0 12px',
                  color: 'var(--danger)',
                }}
              >
                Confirm Delete Project
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to delete project{' '}
                <strong>"{deleteConfirmProject.projectTitle}"</strong>? This action is permanent
                and cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button variant="outline" onClick={() => setDeleteConfirmProject(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDeleteProject}>
                  Confirm Delete
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Edit project modal */}
        {editingProjectModal && (
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
            onClick={() => setEditingProjectModal(null)}
          >
            <Card
              style={{ width: '500px', maxWidth: '90vw', padding: '24px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px' }}>
                Edit Project Details
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '6px',
                    }}
                  >
                    Project Title
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter project title"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '6px',
                    }}
                  >
                    Project Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                    }}
                    placeholder="Enter project description"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button variant="outline" onClick={() => setEditingProjectModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveProjectEdit}
                  disabled={!editTitle.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default AdminProjectsOverview;
