import React, { useEffect, useState, useRef } from 'react';
import { Card, Button, Loader } from '../../components';
import { api } from '../../services/api';
import { Download, Upload, UserPlus, GraduationCap, AlertTriangle, X, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToastStore } from '../../utils/toastStore';

export const AdminStudents: React.FC = () => {
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Pagination & Filters
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterBranch, setFilterBranch] = useState('ALL');
    const [filterBatch, setFilterBatch] = useState('ALL');
    const [metadata, setMetadata] = useState<{ branches: string[], batches: string[] }>({ branches: [], batches: [] });

    // Import Modal State
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importReport, setImportReport] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Invite Modal State
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', roll_number: '', email: '', batch: '', branch: '' });
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await api.get('/students/metadata');
                setMetadata(res.data);
            } catch (err) {
                console.error("Failed to load metadata", err);
            }
        };
        fetchMeta();
    }, []);

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

            const stdRes = await api.get(`/students/paginated?${params.toString()}`);
            
            const fetchedStudents = (stdRes.data.content || []).map((s: any) => ({
                id: s.studentId,
                name: s.name,
                rollNo: s.rollNo,
                branch: s.branch,
                status: s.enrollStatus || 'ACTIVE',
                performance: s.performanceScore ?? 100
            }));

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
                timeout: 120000 
            });
            setImportReport(res.data);
            useToastStore.getState().addToast(`Successfully imported ${res.data.inserted} students.`, 'success');
            fetchData(); 
            // Refresh metadata
            const metaRes = await api.get('/students/metadata');
            setMetadata(metaRes.data);
        } catch (err: any) {
            setImportReport(err.response?.data || { total: 0, inserted: 0, failed: 1, errors: [{ row: '-', message: err.message || 'Import failed due to network or server timeout.' }] });
        } finally {
            setImporting(false);
        }
    };

    const downloadSample = () => {
        const csvContent = "data:text/csv;charset=utf-8,name,roll_number,email\nMoksh Bhardwaj,23AI35,moksh@gmail.com\nRahul Sharma,22CS12,rahul@gmail.com";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_import_sample.csv");
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

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" leftIcon={<Upload size={16} />} onClick={() => setIsImportOpen(true)}>Import CSV</Button>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export Data</Button>
                    <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} />} onClick={() => setIsInviteOpen(true)}>Invite Student</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

                {/* Students Table */}
                <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Directory</h3>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                                value={filterBranch}
                                onChange={(e) => { setFilterBranch(e.target.value); setPage(0); }}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', backgroundColor: 'var(--surface)' }}
                            >
                                <option value="ALL">All Branches</option>
                                {metadata.branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>

                            <select
                                value={filterBatch}
                                onChange={(e) => { setFilterBatch(e.target.value); setPage(0); }}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', backgroundColor: 'var(--surface)' }}
                            >
                                <option value="ALL">All Batches</option>
                                {metadata.batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>

                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', backgroundColor: 'var(--surface)' }}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ENROLLED">Enrolled</option>
                                <option value="PENDING">Pending</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            
                            <input
                                type="text"
                                placeholder="Search roll no, name..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                                style={{ width: '250px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                    
                    <div style={{ position: 'relative', minHeight: '400px' }}>
                        {isLoading && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                                <Loader />
                            </div>
                        )}
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <tr>
                                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Student details</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Branch</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Progress Score</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.length === 0 && !isLoading && (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '64px', color: 'var(--text-disabled)' }}>No students found matching your criteria.</td></tr>
                                )}
                                {students.map((student) => {
                                    const isRisk = student.status === 'AT_RISK';

                                    return (
                                        <tr key={student.id} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontWeight: 'bold' }}>
                                                        {student.name ? student.name.charAt(0) : '?'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{student.name}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{student.rollNo}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                                {student.branch}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{student.performance}%</div>
                                                </div>
                                                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-hover)', borderRadius: '2px', marginTop: '6px' }}>
                                                    <div style={{ width: `${student.performance}%`, height: '100%', backgroundColor: isRisk ? '#ef4444' : '#3b82f6', borderRadius: '2px' }}></div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: student.status === 'ACTIVE' || student.status === 'ENROLLED' ? '#16a34a' : student.status === 'AT_RISK' ? '#ef4444' : '#f59e0b' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: student.status === 'ACTIVE' || student.status === 'ENROLLED' ? '#16a34a' : student.status === 'AT_RISK' ? '#ef4444' : '#f59e0b' }}></div>
                                                    {student.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Showing {totalElements === 0 ? 0 : (page * size) + 1} to {Math.min((page + 1) * size, totalElements)} of {totalElements} results
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <span>Rows per page:</span>
                                <select 
                                    value={size} 
                                    onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
                                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px' }}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setPage(Math.max(0, page - 1))} 
                                    disabled={page === 0}
                                    style={{ padding: '6px' }}
                                >
                                    <ChevronLeft size={16} />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))} 
                                    disabled={page >= totalPages - 1 || totalPages === 0}
                                    style={{ padding: '6px' }}
                                >
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Import CSV Modal */}
            {isImportOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Card elevation={2} style={{ width: '500px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Import Students</h2>
                            <button onClick={() => { setIsImportOpen(false); setImportFile(null); setImportReport(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {!importReport ? (
                            <>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    Upload a CSV or Excel file to batch import students. Ensure you have strictly matching columns: <strong>name, roll_number, email</strong>. String data types only.
                                </p>
                                <button onClick={downloadSample} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 800, padding: 0 }}>
                                    Download Sample CSV
                                </button>
                                <div
                                    style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '32px', textAlign: 'center', marginBottom: '20px', backgroundColor: 'var(--background)' }}
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
                                    <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                        {importFile ? importFile.name : 'Click to select CSV or XLSX file'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>
                                        Maximum file size: 5MB
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <Button variant="primary" onClick={handleImport} disabled={!importFile || importing}>
                                            {importing ? 'Processing...' : 'Upload Data'}
                                        </Button>
                                        <Button variant="outline" onClick={() => { setIsImportOpen(false); setImportFile(null); }}>Cancel</Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '16px', backgroundColor: importReport.failed > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '8px' }}>
                                    {importReport.failed > 0 ? <AlertTriangle style={{ color: '#ef4444' }} /> : <CheckCircle style={{ color: '#16a34a' }} />}
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Import Complete</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {importReport.inserted} inserted, {importReport.failed} failed out of {importReport.total} rows.
                                        </div>
                                    </div>
                                </div>

                                {importReport.errors && importReport.errors.length > 0 && (
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--background)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Error Log:</div>
                                        {importReport.errors.map((err: any, idx: number) => (
                                            <div key={idx} style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px', display: 'flex', gap: '8px' }}>
                                                <XCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <span>Row {err.row}: {err.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                                    <Button variant="primary" onClick={() => { setIsImportOpen(false); setImportReport(null); setImportFile(null); }}>Close</Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Invite Student Modal */}
            {isInviteOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Card elevation={2} style={{ width: '500px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Invite Student</h2>
                            <button onClick={() => { setIsInviteOpen(false); setInviteForm({ name: '', roll_number: '', email: '', batch: '', branch: '' }); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleInviteSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Full Name *</label>
                                <input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Moksh Bhardwaj" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }} required />
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Roll Number *</label>
                                    <input type="text" value={inviteForm.roll_number} onChange={e => setInviteForm({ ...inviteForm, roll_number: e.target.value })} placeholder="23AI35" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }} required />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Email Address *</label>
                                    <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="student@gmail.com" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }} required />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Batch (Optional)</label>
                                    <input type="text" value={inviteForm.batch} onChange={e => setInviteForm({ ...inviteForm, batch: e.target.value })} placeholder="Auto-extract if blank" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Branch (Optional)</label>
                                    <input type="text" value={inviteForm.branch} onChange={e => setInviteForm({ ...inviteForm, branch: e.target.value })} placeholder="Auto-extract if blank" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--background)' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <Button variant="outline" type="button" onClick={() => { setIsInviteOpen(false); setInviteForm({ name: '', roll_number: '', email: '', batch: '', branch: '' }); }}>Cancel</Button>
                                <Button variant="primary" type="submit" disabled={inviting}>
                                    {inviting ? 'Sending...' : 'Send Invitation'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminStudents;
