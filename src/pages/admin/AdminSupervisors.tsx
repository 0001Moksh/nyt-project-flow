import React, { useEffect, useState } from 'react';
import { Card, Button, Input, Loader } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../utils/authStore';
import { Download, UserPlus, Zap, TrendingUp, AlertTriangle, ShieldCheck, CheckCircle, Upload, X, XCircle } from 'lucide-react';
import { useToastStore } from '../../utils/toastStore';

export const AdminSupervisors: React.FC = () => {
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Import Modal State
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importReport, setImportReport] = useState<any>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [supRes, projRes] = await Promise.all([
                api.get('/supervisors').catch(() => ({ data: [] })),
                api.get('/projects').catch(() => ({ data: [] }))
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
                timeout: 120000 // 2 minutes for large file parsing
            });
            setImportReport(res.data);
            useToastStore.getState().addToast(`Successfully imported ${res.data.inserted} supervisors.`, 'success');
            fetchData(); // refresh list
        } catch (err: any) {
            setImportReport(err.response?.data || { total: 0, inserted: 0, failed: 1, errors: [{ row: '-', message: err.message || 'Import failed due to network or server timeout.' }] });
        } finally {
            setImporting(false);
        }
    };

    const downloadSample = () => {
        const csvContent = "data:text/csv;charset=utf-8,name,email,branch\nAkshat Kumar,akshat@gmail.com,CSE\nRahul Verma,rahul@gmail.com,IT";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "supervisor_import_sample.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader size="lg" /></div>;

    const getWorkload = (supId: string) => {
        const count = projects.filter(p => p.supervisorId === supId).length;
        const max = 5; // mocked max capacity for AI computation in wireframe
        return { count, max, percentage: Math.min((count / max) * 100, 100) };
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button variant="outline" size="sm" leftIcon={<Upload size={16} />} onClick={() => setIsImportOpen(true)}>Import CSV</Button>
                    <Button variant="outline" size="sm" leftIcon={<Download size={16} />}>Export Report</Button>
                    <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} />}>Invite Supervisor</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

                {/* Active Supervisors Table */}
                <Card elevation={1} style={{ padding: '0', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'var(--surface-hover)', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Supervisor</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Department</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Current Workload</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Performance</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supervisors.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-disabled)' }}>No active supervisors in database.</td></tr>
                            )}
                            {supervisors.map((sup, idx) => {
                                const workload = getWorkload(sup.supervisorId);
                                const isOverloaded = workload.percentage >= 100;
                                const perfScore = sup.performanceScore ?? 100;
                                const isPoorPerf = perfScore < 50;

                                return (
                                    <tr key={sup.supervisorId} style={{ borderTop: '1px solid var(--border-color)', fontSize: '14px' }}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                    {sup.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{sup.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{sup.branch} Specialist</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>{sup.branch}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{workload.count}/{workload.max} Projects</div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{workload.percentage}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-hover)', borderRadius: '2px', marginTop: '6px' }}>
                                                <div style={{ width: `${workload.percentage}%`, height: '100%', backgroundColor: isOverloaded ? '#ef4444' : '#3b82f6', borderRadius: '2px' }}></div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: isPoorPerf ? '#ef4444' : '#16a34a' }}>{perfScore}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: sup.enrollStatus === 'ACTIVE' ? '#16a34a' : '#d97706' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sup.enrollStatus === 'ACTIVE' ? '#16a34a' : '#d97706' }}></div> {sup.enrollStatus}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            </div>

            {/* Import CSV Modal */}
            {isImportOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Card elevation={2} style={{ width: '500px', backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Import Supervisors</h2>
                            <button onClick={() => { setIsImportOpen(false); setImportFile(null); setImportReport(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {!importReport ? (
                            <>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    Upload a CSV or Excel file to batch import supervisors. Ensure you have strictly matching columns: <strong>name, email, branch</strong>. String data types only.
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
        </div>
    );
};

export default AdminSupervisors;
