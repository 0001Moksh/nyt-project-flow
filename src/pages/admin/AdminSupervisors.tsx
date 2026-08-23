import React, { useEffect, useState, useRef } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import {
    Download, UserPlus, AlertTriangle, CheckCircle, Upload, X, XCircle,
    Pencil, Eye, Plus, Filter, ChevronRight, Search
} from 'lucide-react';
import { useToastStore } from '../../utils/toastStore';
import { AdminProjectDetailDrawer } from './AdminProjectDetailDrawer';

type ColumnKey =
    | 'supervisor'
    | 'department'
    | 'projects'
    | 'workload'
    | 'email'
    | 'actions'
    | 'status';

type ColumnDef = {
    key: ColumnKey;
    label: string;
    section: 'main' | 'other';
    defaultVisible?: boolean;
    filterable?: boolean;
};

const ALL_COLUMNS: ColumnDef[] = [
    { key: 'supervisor', label: 'Supervisor', section: 'main', defaultVisible: true },
    { key: 'department', label: 'Department', section: 'main', defaultVisible: true, filterable: true },
    { key: 'projects', label: 'Assigned Projects', section: 'main', defaultVisible: true },
    { key: 'workload', label: 'Current Workload', section: 'main', defaultVisible: true },
    { key: 'status', label: 'Status', section: 'main', defaultVisible: true, filterable: true },
    { key: 'email', label: 'Email (Mail)', section: 'other', defaultVisible: false },
    { key: 'actions', label: 'Actions', section: 'other', defaultVisible: true },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All' },
    { value: 'ENROLLED', label: 'Enrolled' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'PENDING', label: 'Pending' },
];

const MENU_Z = 5000;

export const AdminSupervisors: React.FC = () => {
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [viewProjectId, setViewProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [filterDepartment, setFilterDepartment] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importReport, setImportReport] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', branch: '' });
    const [editingSupervisor, setEditingSupervisor] = useState<any | null>(null);
    const [viewSupervisor, setViewSupervisor] = useState<any | null>(null);

    const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
    const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
    const columnPickerRef = useRef<HTMLDivElement>(null);

    const [openHeaderFilter, setOpenHeaderFilter] = useState<ColumnKey | null>(null);
    const headerFilterRef = useRef<HTMLDivElement>(null);

    const dragCol = useRef<ColumnKey | null>(null);
    const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const handler = () => setSupervisors((prev) => [...prev]);
        window.addEventListener('admin-settings-updated', handler as any);
        return () => window.removeEventListener('admin-settings-updated', handler as any);
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

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [supRes, projRes] = await Promise.all([
                api.get('/supervisors').catch(() => ({ data: [] })),
                api.get('/projects').catch(() => ({ data: [] })),
            ]);
            setSupervisors(supRes.data || []);
            setProjects(projRes.data || []);
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
            const res = await api.post('/admin/import-supervisors', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            });
            setImportReport(res.data);
            useToastStore.getState().addToast(`Successfully imported ${res.data.inserted} supervisors.`, 'success');
            fetchData();
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
            'data:text/csv;charset=utf-8,name,email,branch\nAkshat Kumar,akshat@gmail.com,CSE\nRahul Verma,rahul@gmail.com,IT';
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'supervisor_import_sample.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            const payload = {
                name: inviteForm.name.trim(),
                email: inviteForm.email.trim().toLowerCase(),
                branch: inviteForm.branch.trim().toUpperCase(),
            };
            await api.post('/admin/invite-supervisor', payload, { timeout: 30000 });
            useToastStore.getState().addToast('Invitation sent successfully', 'success');
            setIsInviteOpen(false);
            setInviteForm({ name: '', email: '', branch: '' });
            fetchData();
        } catch (err: any) {
            if (!err.response?.data?.message) {
                useToastStore.getState().addToast('Failed to send invitation', 'error');
            }
        } finally {
            setInviting(false);
        }
    };

    const getWorkload = (supId: string) => {
        const count = projects.filter((p) => p.supervisorId === supId).length;
        const max = Math.max(Number(localStorage.getItem('maxSupervisorWorkload') || '4'), 1);
        return { count, max, percentage: Math.min((count / max) * 100, 100) };
    };

    const exportReport = async () => {
        const rows = [
            ['Supervisor Name', 'Department', 'Email', 'Status', 'Current Workload', 'Project Title', 'Leader Name', 'Leader Email', 'Batch/Class'],
        ];
        supervisors.forEach((sup) => {
            const workload = getWorkload(sup.supervisorId);
            const assignedProjects = projects.filter((p) => p.supervisorId === sup.supervisorId);
            if (assignedProjects.length === 0) {
                rows.push([
                    sup.name,
                    sup.branch,
                    sup.mail,
                    String(sup.enrollStatus || ''),
                    `${workload.count}/${workload.max}`,
                    '',
                    '',
                    '',
                    '',
                ]);
                return;
            }
            assignedProjects.forEach((p) =>
                rows.push([
                    sup.name,
                    sup.branch,
                    sup.mail,
                    String(sup.enrollStatus || ''),
                    `${workload.count}/${workload.max}`,
                    p.projectTitle || '',
                    p.leaderName || '',
                    p.leaderMail || '',
                    p.batch || p.className || '',
                ])
            );
        });
        const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'supervisor_report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const departmentOptions = Array.from(
        new Set(supervisors.map((s) => String(s.branch || '').trim()).filter(Boolean))
    ).sort();

    const filteredSupervisors = supervisors.filter((sup) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            !q ||
            (sup.name || '').toLowerCase().includes(q) ||
            (sup.supervisorId && String(sup.supervisorId).toLowerCase().includes(q)) ||
            (sup.mail && String(sup.mail).toLowerCase().includes(q));

        const status = String(sup.enrollStatus || 'PENDING').toUpperCase();
        const matchesDept = filterDepartment === 'ALL' || String(sup.branch || '') === filterDepartment;
        const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

        return matchesSearch && matchesDept && matchesStatus;
    });

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
        if (key === 'department') return filterDepartment !== 'ALL';
        if (key === 'status') return filterStatus !== 'ALL';
        return false;
    };

    const applyFilter = (key: ColumnKey, value: string) => {
        if (key === 'department') setFilterDepartment(value);
        if (key === 'status') setFilterStatus(value);
        setOpenHeaderFilter(null);
    };

    const getFilterOptions = (key: ColumnKey): { value: string; label: string }[] => {
        if (key === 'department') {
            return [{ value: 'ALL', label: 'All' }, ...departmentOptions.map((b) => ({ value: b, label: b }))];
        }
        if (key === 'status') return STATUS_OPTIONS;
        return [];
    };

    const getCurrentFilterValue = (key: ColumnKey) => {
        if (key === 'department') return filterDepartment;
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

    const renderCell = (sup: any, key: ColumnKey) => {
        const workload = getWorkload(sup.supervisorId);
        const isOverloaded = workload.percentage >= 100;
        const assignedProjects = projects.filter((p) => p.supervisorId === sup.supervisorId);

        switch (key) {
            case 'supervisor':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '16px',
                                    backgroundColor: 'var(--primary-glow)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    fontWeight: 'bold',
                                    fontSize: 13,
                                }}
                            >
                                {(sup.name || '?').charAt(0)}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{sup.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>
                                    {sup.branch ? `${sup.branch} Specialist` : '—'}
                                </div>
                            </div>
                        </div>
                    </td>
                );
            case 'department':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        {sup.branch ? (
                            <span
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#3b82f6',
                                    backgroundColor: '#eff6ff',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                }}
                            >
                                {sup.branch}
                            </span>
                        ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>—</span>
                        )}
                    </td>
                );
            case 'projects':
                return (
                    <td key={key} style={{ padding: '12px 16px', maxWidth: 280, backgroundColor: 'var(--surface)' }}>
                        {assignedProjects.length === 0 ? (
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706' }}>Unassigned</span>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {assignedProjects.map((p) => (
                                    <button
                                        key={p.projectId}
                                        type="button"
                                        title={p.projectTitle}
                                        onClick={() => setViewProjectId(p.projectId)}
                                        style={{
                                            maxWidth: '160px',
                                            border: '1px solid #bfdbfe',
                                            backgroundColor: '#eff6ff',
                                            color: '#1d4ed8',
                                            borderRadius: '999px',
                                            padding: '3px 10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {p.projectTitle || 'Untitled'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </td>
                );
            case 'workload':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                {workload.count}/{workload.max} Projects
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{workload.percentage}%</span>
                        </div>
                        <div
                            style={{
                                width: '100%',
                                height: '4px',
                                backgroundColor: 'var(--surface-hover)',
                                borderRadius: '2px',
                                marginTop: '6px',
                            }}
                        >
                            <div
                                style={{
                                    width: `${workload.percentage}%`,
                                    height: '100%',
                                    backgroundColor: isOverloaded ? '#ef4444' : '#3b82f6',
                                    borderRadius: '2px',
                                }}
                            />
                        </div>
                    </td>
                );
            case 'email':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {sup.mail || '—'}
                        </span>
                    </td>
                );
            case 'actions':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setEditingSupervisor(sup)}
                                title="Edit supervisor"
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: '#fff',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewSupervisor(sup)}
                                title="View supervisor"
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: '#fff',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Eye size={14} />
                            </button>
                        </div>
                    </td>
                );
            case 'status':
                return (
                    <td key={key} style={{ padding: '12px 16px', backgroundColor: 'var(--surface)' }}>
                        {(() => {
                            const status = String(sup.enrollStatus || 'PENDING');
                            const color =
                                status === 'ENROLLED'
                                    ? '#2563eb'
                                    : status === 'ACTIVE'
                                      ? '#16a34a'
                                      : status === 'INACTIVE'
                                        ? '#ef4444'
                                        : '#d97706';
                            return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color }} />
                                    {status}
                                </span>
                            );
                        })()}
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

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
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
                            Invite Supervisor
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
                        placeholder="Search name, ID, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 10px 8px 34px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            fontSize: 13,
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            {/* Table: sticky header, body scrolls inside */}
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
                            {filteredSupervisors.length === 0 && (
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
                                        No supervisors found matching your criteria.
                                    </td>
                                </tr>
                            )}
                            {filteredSupervisors.map((sup) => (
                                <tr key={sup.supervisorId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                    {orderedVisible.map((key) => renderCell(sup, key))}
                                    <td style={{ padding: '12px', backgroundColor: 'var(--surface)' }} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                                    Upload a CSV or Excel file. Columns required: <strong>name, email, branch</strong>.
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

            {/* Invite Supervisor Modal */}
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
                    <Card elevation={2} style={{ width: 400, backgroundColor: 'var(--surface)', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invite Supervisor</h2>
                            <button
                                onClick={() => setIsInviteOpen(false)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Full Name</label>
                                <Input
                                    required
                                    value={inviteForm.name}
                                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                                    placeholder="Dr. Jane Smith"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Email Address</label>
                                <Input
                                    required
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    placeholder="jane.smith@college.edu"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                                    Department (Branch)
                                </label>
                                <Input
                                    required
                                    value={inviteForm.branch}
                                    onChange={(e) => setInviteForm({ ...inviteForm, branch: e.target.value })}
                                    placeholder="e.g. CSE, IT, ECE"
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" disabled={inviting}>
                                    {inviting ? 'Sending...' : 'Send Invite'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            <AdminProjectDetailDrawer projectId={viewProjectId} onClose={() => setViewProjectId(null)} />

            {editingSupervisor && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1100,
                    }}
                >
                    <Card style={{ width: 520, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit Supervisor</h2>
                        <p style={{ fontSize: 14 }}>{editingSupervisor.name}</p>
                        <Button onClick={() => setEditingSupervisor(null)}>Close</Button>
                    </Card>
                </div>
            )}

            {viewSupervisor && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1100,
                    }}
                >
                    <Card style={{ width: 560, padding: 20, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>{viewSupervisor.name}</h2>
                        <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>Email: {viewSupervisor.mail}</div>
                            <div>Department: {viewSupervisor.branch}</div>
                            <div>Status: {String(viewSupervisor.enrollStatus || '')}</div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <Button onClick={() => setViewSupervisor(null)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminSupervisors;