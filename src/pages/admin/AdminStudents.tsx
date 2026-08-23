import React, { useEffect, useState, useRef } from 'react';
import { Card, Button, Loader, Input } from '../../components';
import { api } from '../../services/api';
import {
    Download, Upload, UserPlus, AlertTriangle, X, CheckCircle, XCircle,
    ChevronLeft, ChevronRight, Pencil, Plus, Search, Filter
} from 'lucide-react';
import { useToastStore } from '../../utils/toastStore';
import { AdminProjectDetailDrawer } from './AdminProjectDetailDrawer';

type ColumnKey = 'student' | 'branch' | 'batch' | 'project' | 'email' | 'skills' | 'status';

type ColumnDef = {
    key: ColumnKey;
    label: string;
    section: 'main' | 'other';
    defaultVisible?: boolean;
    filterable?: boolean;
};

const ALL_COLUMNS: ColumnDef[] = [
    { key: 'student', label: 'Student details', section: 'main', defaultVisible: true },
    { key: 'branch', label: 'Branch', section: 'main', defaultVisible: true, filterable: true },
    { key: 'batch', label: 'Batch', section: 'main', defaultVisible: false, filterable: true },
    { key: 'project', label: 'Project Name', section: 'main', defaultVisible: true },
    { key: 'email', label: 'Email (Mail)', section: 'main', defaultVisible: true },
    { key: 'status', label: 'Status', section: 'main', defaultVisible: true, filterable: true },
    { key: 'skills', label: 'Skills', section: 'other', defaultVisible: false },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ENROLLED', label: 'Enrolled' },
    { value: 'AT_RISK', label: 'At Risk' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'INACTIVE', label: 'Inactive' },
];

/** Header menus (filter / + columns) always above scrolling body */
const MENU_Z = 5000;

export const AdminStudents: React.FC = () => {
    const [students, setStudents] = useState<any[]>([]);
    const [projectByStudentId, setProjectByStudentId] = useState<Record<string, { projectId: string; projectTitle: string }>>({});
    const [viewProjectId, setViewProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterBranch, setFilterBranch] = useState('ALL');
    const [filterBatch, setFilterBatch] = useState('ALL');
    const [metadata, setMetadata] = useState<{ branches: string[]; batches: string[] }>({ branches: [], batches: [] });

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importReport, setImportReport] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', roll_number: '', email: '', batch: '', branch: '' });
    const [inviting, setInviting] = useState(false);

    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [studentSkillDraft, setStudentSkillDraft] = useState('');
    const [studentSkills, setStudentSkills] = useState<Record<string, string[]>>({});

    const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
    const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
    const columnPickerRef = useRef<HTMLDivElement>(null);

    const [openHeaderFilter, setOpenHeaderFilter] = useState<ColumnKey | null>(null);
    const headerFilterRef = useRef<HTMLDivElement>(null);

    const dragCol = useRef<ColumnKey | null>(null);
    const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await api.get('/students/metadata');
                setMetadata(res.data);
            } catch (err) {
                console.error('Failed to load metadata', err);
            }
        };
        fetchMeta();
    }, []);

    useEffect(() => {
        if (!isColumnPickerOpen && !openHeaderFilter) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (isColumnPickerOpen && columnPickerRef.current && !columnPickerRef.current.contains(target)) {
                setIsColumnPickerOpen(false);
            }
            if (openHeaderFilter && headerFilterRef.current && !headerFilterRef.current.contains(target)) {
                setOpenHeaderFilter(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isColumnPickerOpen, openHeaderFilter]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timeout);
    }, [page, size, searchQuery, filterStatus, filterBranch, filterBatch]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                size: size.toString(),
                ...(searchQuery && { search: searchQuery }),
                ...(filterBranch !== 'ALL' && { branch: filterBranch }),
                ...(filterBatch !== 'ALL' && { batch: filterBatch }),
                ...(filterStatus !== 'ALL' && { status: filterStatus }),
            });

            const [stdRes, projectsRes, teamsRes] = await Promise.all([
                api.get(`/students/paginated?${params.toString()}`),
                api.get('/projects').catch(() => ({ data: [] })),
                api.get('/teams').catch(() => ({ data: [] })),
            ]);

            const allProjects = projectsRes.data || [];
            const allTeams = teamsRes.data || [];
            const mapping: Record<string, { projectId: string; projectTitle: string }> = {};

            allTeams.forEach((team: any) => {
                const project = allProjects.find((p: any) => p.teamId === team.teamId);
                if (!project) return;
                const info = { projectId: project.projectId, projectTitle: project.projectTitle || 'Untitled Project' };
                if (team.leaderId) mapping[team.leaderId] = info;
                try {
                    const members = JSON.parse(team.teamMemberArray || '[]');
                    if (Array.isArray(members)) {
                        members.forEach((sid: string) => {
                            mapping[sid] = info;
                        });
                    }
                } catch { /* ignore */ }
            });
            setProjectByStudentId(mapping);

            const fetchedStudents = (stdRes.data.content || []).map((s: any) => {
                const enrollStatus = String(s.enrollStatus || 'ACTIVE').toUpperCase();
                return {
                    id: s.studentId,
                    name: s.name,
                    rollNo: s.rollNo,
                    branch: s.branch,
                    batch: s.batch || s.batchYear || '',
                    status: enrollStatus,
                    mail: s.mail,
                    performance: s.performanceScore ?? 100,
                    project: enrollStatus === 'ENROLLED' ? (mapping[s.studentId] || null) : null,
                };
            });

            setStudents(fetchedStudents);
            setTotalPages(stdRes.data.totalPages || 0);
            setTotalElements(stdRes.data.totalElements || 0);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportReport(null);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const res = await api.post('/admin/import-students', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            });
            setImportReport(res.data);
            useToastStore.getState().addToast(`Successfully imported ${res.data.inserted} students.`, 'success');
            fetchData();
            const metaRes = await api.get('/students/metadata');
            setMetadata(metaRes.data);
        } catch (err: any) {
            setImportReport(
                err.response?.data || {
                    total: 0,
                    inserted: 0,
                    failed: 1,
                    errors: [{ row: '-', message: err.message || 'Import failed due to network or server timeout.' }],
                }
            );
        } finally {
            setImporting(false);
        }
    };

    const downloadSample = () => {
        const csvContent =
            'data:text/csv;charset=utf-8,name,roll_number,email\nMoksh Bhardwaj,23AI35,moksh@gmail.com\nRahul Sharma,22CS12,rahul@gmail.com';
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'student_import_sample.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            await api.post('/admin/invite-student', inviteForm);
            useToastStore.getState().addToast('Invitation sent successfully', 'success');
            setIsInviteOpen(false);
            setInviteForm({ name: '', roll_number: '', email: '', batch: '', branch: '' });
            fetchData();
        } catch (err: any) {
            useToastStore.getState().addToast(err.response?.data?.message || 'Failed to send invitation', 'error');
        } finally {
            setInviting(false);
        }
    };

    const exportReport = () => {
        const header = ['Name', 'Roll', 'Branch', 'Batch', 'Status', 'Email', 'Assigned Project', 'Supervisor', 'Skills'];
        const rows = students.map((s) => [
            s.name,
            s.rollNo,
            s.branch,
            s.batch || '',
            s.status,
            s.mail,
            s.project?.projectTitle || '',
            '',
            (studentSkills[s.id] || []).join('; '),
        ]);
        const csv = [header, ...rows]
            .map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'student_report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

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
        if (key === 'branch') return filterBranch !== 'ALL';
        if (key === 'batch') return filterBatch !== 'ALL';
        if (key === 'status') return filterStatus !== 'ALL';
        return false;
    };

    const applyFilter = (key: ColumnKey, value: string) => {
        if (key === 'branch') setFilterBranch(value);
        if (key === 'batch') setFilterBatch(value);
        if (key === 'status') setFilterStatus(value);
        setPage(0);
        setOpenHeaderFilter(null);
    };

    const getFilterOptions = (key: ColumnKey): { value: string; label: string }[] => {
        if (key === 'branch') {
            return [{ value: 'ALL', label: 'All' }, ...(metadata.branches || []).map((b) => ({ value: b, label: b }))];
        }
        if (key === 'batch') {
            return [{ value: 'ALL', label: 'All' }, ...(metadata.batches || []).map((b) => ({ value: b, label: b }))];
        }
        if (key === 'status') return STATUS_OPTIONS;
        return [];
    };

    const getCurrentFilterValue = (key: ColumnKey) => {
        if (key === 'branch') return filterBranch;
        if (key === 'batch') return filterBatch;
        if (key === 'status') return filterStatus;
        return 'ALL';
    };

    const menuPanelStyle: React.CSSProperties = {
        position: 'absolute',
        minWidth: 160,
        maxHeight: 240,
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
        const col = ALL_COLUMNS.find((c) => c.key === key)!;
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
                    overflow: 'visible',
                }}
                title={filterable ? undefined : 'Drag to reorder'}
            >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>{col.label}</span>
                    {filterable && (
                        <div
                            ref={openHeaderFilter === key ? headerFilterRef : undefined}
                            style={{ position: 'relative', display: 'inline-flex', zIndex: openHeaderFilter === key ? MENU_Z : 1 }}
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

    const renderCell = (student: any, key: ColumnKey) => {
        const isEnrolled = String(student.status).toUpperCase() === 'ENROLLED';
        const project = isEnrolled ? student.project || projectByStudentId[student.id] : null;

        switch (key) {
            case 'student':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '16px',
                                    backgroundColor: '#f3f4f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#4b5563',
                                    fontWeight: 'bold',
                                    fontSize: 13,
                                }}
                            >
                                {student.name ? student.name.charAt(0) : '?'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 14 }}>{student.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{student.rollNo}</div>
                            </div>
                        </div>
                    </td>
                );
            case 'branch':
                return (
                    <td key={key} style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13, backgroundColor: 'var(--surface)' }}>
                        {student.branch || '—'}
                    </td>
                );
            case 'batch':
                return (
                    <td key={key} style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13, backgroundColor: 'var(--surface)' }}>
                        {student.batch || '—'}
                    </td>
                );
            case 'project':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        {project ? (
                            <button
                                type="button"
                                onClick={() => setViewProjectId(project.projectId)}
                                title={project.projectTitle}
                                style={{
                                    maxWidth: '200px',
                                    border: '1px solid #bfdbfe',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    borderRadius: '999px',
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {project.projectTitle}
                            </button>
                        ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>—</span>
                        )}
                    </td>
                );
            case 'email':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>{student.mail}</div>
                    </td>
                );
            case 'skills':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {(studentSkills[student.id] || []).map((skill) => (
                                <span
                                    key={skill}
                                    style={{
                                        display: 'inline-flex',
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: '#eff6ff',
                                        fontSize: 12,
                                    }}
                                >
                                    {skill}
                                </span>
                            ))}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setEditingStudent(student);
                                    setStudentSkillDraft('');
                                }}
                                style={{ padding: '4px 6px', minWidth: 0 }}
                                title="Edit skills"
                            >
                                <Pencil size={14} />
                            </Button>
                        </div>
                    </td>
                );
            case 'status':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color:
                                    student.status === 'ACTIVE' || student.status === 'ENROLLED'
                                        ? '#16a34a'
                                        : student.status === 'AT_RISK' || student.status === 'REJECTED'
                                          ? '#ef4444'
                                          : '#f59e0b',
                            }}
                        >
                            <div
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor:
                                        student.status === 'ACTIVE' || student.status === 'ENROLLED'
                                            ? '#16a34a'
                                            : student.status === 'AT_RISK' || student.status === 'REJECTED'
                                              ? '#ef4444'
                                              : '#f59e0b',
                                }}
                            />
                            {String(student.status).replace('_', ' ')}
                        </span>
                    </td>
                );
            default:
                return null;
        }
    };

    const mainCols = ALL_COLUMNS.filter((c) => c.section === 'main');
    const otherCols = ALL_COLUMNS.filter((c) => c.section === 'other');

    const inviteBtnBase: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: 'var(--primary)',
        color: '#fff',
        lineHeight: 1.2,
    };

    return (
        <div
            style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                /* Fit in viewport so browser page does not scroll for table content */
                height: 'calc(100vh - 96px)',
                minHeight: 0,
                overflow: 'hidden',
            }}
        >
            {/* Fixed top: Export / Invite / Search */}
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
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button variant="outline" size="sm" leftIcon={<Download size={15} />} onClick={exportReport}>
                        Export Report
                    </Button>

                    <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                        <button
                            type="button"
                            onClick={() => setIsInviteOpen(true)}
                            style={{
                                ...inviteBtnBase,
                                borderRadius: 0,
                                borderRight: '1px solid rgba(255,255,255,0.25)',
                            }}
                        >
                            <UserPlus size={15} />
                            Invite Student
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsImportOpen(true)}
                            title="Bulk invite via CSV"
                            style={{
                                ...inviteBtnBase,
                                padding: '8px 10px',
                                borderRadius: 0,
                            }}
                        >
                            <ChevronRight size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div style={{ position: 'relative', minWidth: 240, flex: '0 1 280px' }}>
                    <Search
                        size={15}
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }}
                    />
                    <input
                        type="search"
                        placeholder="Search roll no, name..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(0);
                        }}
                        style={{
                            width: '100%',
                            padding: '8px 10px 8px 34px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            fontSize: 13,
                        }}
                    />
                </div>
            </div>

            {/* Table card: header sticky, body scrolls, footer fixed */}
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
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        overflow: 'auto',
                    }}
                >
                    {isLoading && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(255,255,255,0.7)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: MENU_Z + 10,
                            }}
                        >
                            <Loader />
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
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
                                        backgroundColor: 'var(--surface-hover)',
                                        overflow: 'visible',
                                    }}
                                >
                                    <div ref={columnPickerRef} style={{ display: 'inline-block', position: 'relative' }}>
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
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

                                                <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />

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
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                            {students.length === 0 && !isLoading && (
                                <tr>
                                    <td
                                        colSpan={orderedVisible.length + 1}
                                        style={{
                                            textAlign: 'center',
                                            padding: '48px',
                                            color: 'var(--text-disabled)',
                                            fontSize: 14,
                                            backgroundColor: 'var(--surface)',
                                        }}
                                    >
                                        No students found matching your criteria.
                                    </td>
                                </tr>
                            )}
                            {students.map((student) => (
                                <tr key={student.id} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                    {orderedVisible.map((key) => renderCell(student, key))}
                                    <td style={{ padding: '12px', backgroundColor: 'var(--surface)' }} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Fixed pagination footer */}
                <div
                    style={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--surface)',
                        flexWrap: 'wrap',
                        gap: 10,
                        flexShrink: 0,
                    }}
                >
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Showing {totalElements === 0 ? 0 : page * size + 1} to {Math.min((page + 1) * size, totalElements)} of{' '}
                        {totalElements} results
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span>Rows</span>
                            <select
                                value={size}
                                onChange={(e) => {
                                    setSize(Number(e.target.value));
                                    setPage(0);
                                }}
                                style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 12 }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                style={{ padding: '5px' }}
                            >
                                <ChevronLeft size={15} />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page >= totalPages - 1 || totalPages === 0}
                                style={{ padding: '5px' }}
                            >
                                <ChevronRight size={15} />
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Import CSV Modal */}
            {isImportOpen && (
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
                    <Card elevation={2} style={{ width: 480, backgroundColor: 'var(--surface)', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bulk Invite (CSV)</h2>
                            <button
                                onClick={() => {
                                    setIsImportOpen(false);
                                    setImportFile(null);
                                    setImportReport(null);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {!importReport ? (
                            <>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                    Upload a CSV or Excel file. Columns required: <strong>name, roll_number, email</strong>.
                                </p>
                                <button
                                    onClick={downloadSample}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        padding: 0,
                                        marginBottom: 12,
                                    }}
                                >
                                    Download Sample CSV
                                </button>
                                <div
                                    style={{
                                        border: '2px dashed var(--border-color)',
                                        borderRadius: 8,
                                        padding: 24,
                                        textAlign: 'center',
                                        marginBottom: 16,
                                        backgroundColor: 'var(--background)',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                setImportFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <Upload size={28} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, fontSize: 13 }}>
                                        {importFile ? importFile.name : 'Click to select CSV or XLSX'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>Max 5MB</div>
                                </div>

                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsImportOpen(false);
                                            setImportFile(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button variant="primary" onClick={handleImport} disabled={!importFile || importing}>
                                        {importing ? 'Processing...' : 'Upload Data'}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        marginBottom: 14,
                                        padding: 12,
                                        backgroundColor: importReport.failed > 0 ? '#fef2f2' : '#f0fdf4',
                                        borderRadius: 8,
                                    }}
                                >
                                    {importReport.failed > 0 ? (
                                        <AlertTriangle style={{ color: '#ef4444' }} size={18} />
                                    ) : (
                                        <CheckCircle style={{ color: '#16a34a' }} size={18} />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>Import Complete</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {importReport.inserted} inserted, {importReport.failed} failed of {importReport.total} rows.
                                        </div>
                                    </div>
                                </div>

                                {importReport.errors && importReport.errors.length > 0 && (
                                    <div
                                        style={{
                                            maxHeight: 160,
                                            overflowY: 'auto',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: 10,
                                            backgroundColor: 'var(--background)',
                                            marginBottom: 14,
                                        }}
                                    >
                                        {importReport.errors.map((err: any, idx: number) => (
                                            <div key={idx} style={{ fontSize: 12, color: '#ef4444', marginBottom: 4, display: 'flex', gap: 6 }}>
                                                <XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                                <span>
                                                    Row {err.row}: {err.message}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="primary"
                                        onClick={() => {
                                            setIsImportOpen(false);
                                            setImportReport(null);
                                            setImportFile(null);
                                        }}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Invite Student Modal */}
            {isInviteOpen && (
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
                    <Card elevation={2} style={{ width: 480, backgroundColor: 'var(--surface)', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invite Student</h2>
                            <button
                                onClick={() => {
                                    setIsInviteOpen(false);
                                    setInviteForm({ name: '', roll_number: '', email: '', batch: '', branch: '' });
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleInviteSubmit}>
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={inviteForm.name}
                                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                                    placeholder="Moksh Bhardwaj"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--background)',
                                        fontSize: 13,
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        Roll Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteForm.roll_number}
                                        onChange={(e) => setInviteForm({ ...inviteForm, roll_number: e.target.value })}
                                        placeholder="23AI35"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: 13,
                                        }}
                                        required
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={inviteForm.email}
                                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                        placeholder="student@gmail.com"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: 13,
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        Batch (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteForm.batch}
                                        onChange={(e) => setInviteForm({ ...inviteForm, batch: e.target.value })}
                                        placeholder="Auto-extract if blank"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: 13,
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        Branch (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteForm.branch}
                                        onChange={(e) => setInviteForm({ ...inviteForm, branch: e.target.value })}
                                        placeholder="Auto-extract if blank"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--background)',
                                            fontSize: 13,
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => {
                                        setIsInviteOpen(false);
                                        setInviteForm({ name: '', roll_number: '', email: '', batch: '', branch: '' });
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button variant="primary" type="submit" disabled={inviting}>
                                    {inviting ? 'Sending...' : 'Send Invitation'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            <AdminProjectDetailDrawer projectId={viewProjectId} onClose={() => setViewProjectId(null)} />

            {editingStudent && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1100,
                    }}
                >
                    <Card style={{ width: 480, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit Skills</h2>
                        <Input
                            value={studentSkillDraft}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentSkillDraft(e.target.value)}
                            placeholder="Add skill and press Enter"
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const next = studentSkillDraft.trim();
                                    if (!next) return;
                                    setStudentSkills((prev) => ({
                                        ...prev,
                                        [editingStudent.id]: Array.from(new Set([...(prev[editingStudent.id] || []), next])),
                                    }));
                                    setStudentSkillDraft('');
                                }
                            }}
                        />
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(studentSkills[editingStudent.id] || []).map((skill) => (
                                <button
                                    key={skill}
                                    type="button"
                                    onClick={() =>
                                        setStudentSkills((prev) => ({
                                            ...prev,
                                            [editingStudent.id]: (prev[editingStudent.id] || []).filter((s) => s !== skill),
                                        }))
                                    }
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        background: '#fff',
                                        borderRadius: 999,
                                        padding: '4px 10px',
                                        fontSize: 12,
                                    }}
                                >
                                    {skill} ×
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                            <Button variant="outline" onClick={() => setEditingStudent(null)}>
                                Close
                            </Button>
                            <Button variant="primary" onClick={() => setEditingStudent(null)}>
                                Save
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminStudents;