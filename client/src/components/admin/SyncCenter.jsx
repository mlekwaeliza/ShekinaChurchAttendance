import React, { useMemo, useState } from 'react';
import { adminAPI } from '../../services/api';
import { AlertTriangle, CheckCircle2, Download, FileJson, RefreshCw, UploadCloud } from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

const Stat = ({ label, value, tone = 'slate' }) => {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-200 dark:border-white/10',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-700/50',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-700/50',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300 dark:border-rose-700/50'
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value ?? 0}</p>
    </div>
  );
};

const SyncCenter = ({ serviceTypes = [], showMessage }) => {
  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    service_id: 'all'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [syncPackage, setSyncPackage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const packageSummary = useMemo(() => syncPackage?.summary || {}, [syncPackage]);

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleExport = () => {
    adminAPI.exportSyncPackage(filters);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setError('');
    setPreview(null);
    setSyncPackage(null);
    setSelectedFile(file || null);
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setSyncPackage(parsed);
    } catch (err) {
      setError('The selected file is not a valid JSON sync package.');
    }
  };

  const handlePreview = async () => {
    if (!syncPackage) return;
    setLoadingPreview(true);
    setError('');
    try {
      const res = await adminAPI.previewSyncPackage(syncPackage);
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to preview sync package.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!syncPackage) return;
    setImporting(true);
    setError('');
    try {
      const res = await adminAPI.importSyncPackage(syncPackage, selectedFile?.name);
      setPreview(res.data.summary);
      showMessage?.('Sync package imported successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import sync package.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            Sync Center
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Move attendance submitted on an offline/local server into your main database using a preview-first sync package.
          </p>
        </div>
        <div className="badge-info w-fit">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Duplicate-safe imports
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/25 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Download className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
                Export Offline Work
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Run this on the computer that was used offline.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="input"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">End Date</label>
              <input
                type="date"
                className="input"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Service</label>
              <select
                className="select"
                value={filters.service_id}
                onChange={(e) => handleFilterChange('service_id', e.target.value)}
              >
                <option value="all">All services</option>
                {serviceTypes.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={handleExport} className="btn-primary w-full mt-6">
            <Download className="w-4 h-4" />
            Download Sync Package
          </button>
        </div>

        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                Import To Main Server
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Upload the package on the main server, preview it, then import.
              </p>
            </div>
          </div>

          <label className="block rounded-2xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/70 dark:bg-white/5 px-5 py-6 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
            <FileJson className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500" />
            <span className="block mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {selectedFile ? selectedFile.name : 'Choose sync JSON package'}
            </span>
            <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
              Only packages exported from this app are supported.
            </span>
            <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
          </label>

          {syncPackage && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Packages" value={packageSummary.submissions || syncPackage.packages?.length || 0} />
              <Stat label="Rows" value={packageSummary.attendance_rows || 0} />
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button onClick={handlePreview} disabled={!syncPackage || loadingPreview} className="btn-secondary flex-1">
              {loadingPreview ? 'Previewing...' : 'Preview'}
            </button>
            <button onClick={handleImport} disabled={!syncPackage || !preview || importing || preview.invalid > 0} className="btn-primary flex-1">
              {importing ? 'Importing...' : 'Import Package'}
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sync Preview</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review what will be inserted and what already exists before committing.
              </p>
            </div>
            {preview.invalid > 0 || preview.conflicts > 0 ? (
              <span className="badge-warning w-fit">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs review
              </span>
            ) : (
              <span className="badge-success w-fit">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready to import
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <Stat label="Packages" value={preview.package_count} />
            <Stat label="Rows" value={preview.total_rows} />
            <Stat label="Insertable" value={preview.insertable} tone="green" />
            <Stat label="Imported" value={preview.imported} tone="green" />
            <Stat label="Duplicates" value={preview.duplicates + preview.already_imported} tone="amber" />
            <Stat label="Conflicts" value={preview.conflicts} tone="rose" />
            <Stat label="Invalid" value={preview.invalid} tone="rose" />
          </div>

          <div className="table-container mt-5 overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Leader</th>
                  <th>Section</th>
                  <th>Rows</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.packages?.slice(0, 12).map((item) => (
                  <tr key={item.package_id}>
                    <td className="font-medium text-slate-900 dark:text-slate-100">{item.date}</td>
                    <td>{item.service_name}</td>
                    <td>{item.leader_name}</td>
                    <td>{item.section_name}</td>
                    <td className="tabular-nums">{item.total_rows}</td>
                    <td>
                      <span className={item.invalid || item.conflicts ? 'badge-warning' : item.already_imported ? 'badge-neutral' : 'badge-success'}>
                        {item.status || (item.already_imported ? 'duplicate' : 'ready')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncCenter;
