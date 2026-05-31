import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Radio,
  Send,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Upload,
  AlertTriangle,
  Calendar,
  Edit2,
} from 'lucide-react';
import StatCard from '../ui/StatCard';
import { adminAPI } from '../../services/api';

const formatSectionLabel = (name) => {
  if (!name) return 'Unassigned';

  const smallWords = new Set(['of', 'and', 'the', 'in', 'for', 'to']);
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const getLeaderInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatPeriodLabel = (filterType, filterValue) => {
  if (!filterValue) return 'Select a period';

  if (filterType === 'daily') {
    const parsed = new Date(filterValue + 'T12:00:00');
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return filterValue;
  }

  if (filterType === 'yearly') {
    return filterValue;
  }

  if (filterType === 'monthly') {
    const [year, month] = filterValue.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  if (filterType === 'weekly') {
    const [year, week] = filterValue.split('-W');
    return `Week ${week}, ${year}`;
  }

  return filterValue;
};

const AttendanceReports = ({
  filterType,
  setFilterType,
  filterValue,
  setFilterValue,
  overviewData,
  overviewLoading,
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  loadOverview,
  onLeaderClick,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (filterValue) loadOverview();
  }, [filterType, filterValue, selectedServiceId]);

  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const serviceLabel = selectedServiceId === 'all' ? 'All services' : (currentService?.name || 'Selected service');
  const periodLabel = formatPeriodLabel(filterType, filterValue);
  const leaders = overviewData?.subleaders || [];
  const hasReportData = Boolean(overviewData && filterValue);
  const [offlinePackage, setOfflinePackage] = useState(null);
  const [offlineFilename, setOfflineFilename] = useState('');
  const [offlinePreview, setOfflinePreview] = useState(null);
  const [offlineStatus, setOfflineStatus] = useState('');
  const [offlineBusy, setOfflineBusy] = useState(false);
  const initializedServiceRef = useRef(false);

  useEffect(() => {
    if (initializedServiceRef.current) return;
    initializedServiceRef.current = true;
    if (selectedServiceId !== 'all') {
      onServiceChange('all');
    }
  }, [onServiceChange, selectedServiceId]);

  const handleOfflineFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOfflineBusy(true);
    setOfflineStatus('');
    setOfflinePreview(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const response = await adminAPI.previewOfflineImport(parsed);
      setOfflinePackage(parsed);
      setOfflineFilename(file.name);
      setOfflinePreview(response.data);
      setOfflineStatus(response.data.already_imported
        ? 'This package is already recorded in the admin dashboard.'
        : 'Package preview ready. Review the counts before importing.');
    } catch (error) {
      setOfflinePackage(null);
      setOfflineFilename('');
      setOfflineStatus(error.response?.data?.error || error.message || 'Unable to read offline package.');
    } finally {
      setOfflineBusy(false);
      event.target.value = '';
    }
  };

  const commitOfflinePackage = async () => {
    if (!offlinePackage) return;
    setOfflineBusy(true);
    setOfflineStatus('');
    try {
      const response = await adminAPI.commitOfflineImport(offlinePackage, offlineFilename);
      setOfflinePreview(response.data.summary);
      setOfflineStatus(`Import complete: ${response.data.summary.imported || 0} new rows saved, ${response.data.summary.duplicates || 0} duplicates ignored.`);
      if (filterValue) loadOverview();
    } catch (error) {
      setOfflineStatus(error.response?.data?.error || error.message || 'Import failed.');
    } finally {
      setOfflineBusy(false);
    }
  };

  const offlineImportPanel = (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Import Offline Attendance</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Upload the JSON package sent by a head leader or sub leader. The server checks the package ID and each member/date/service row, then ignores duplicates.
            </p>
            {offlinePreview && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                {[
                  ['New', offlinePreview.insertable ?? offlinePreview.imported ?? 0, 'text-emerald-600'],
                  ['Duplicates', offlinePreview.duplicates || 0, 'text-slate-700 dark:text-slate-200'],
                  ['Conflicts', offlinePreview.conflicts || 0, 'text-amber-600'],
                  ['Invalid', offlinePreview.invalid || 0, 'text-rose-600'],
                  ['Rows', offlinePreview.total_rows || 0, 'text-slate-900 dark:text-slate-100'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className={`text-lg font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
            {offlineStatus && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{offlineStatus}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Choose Package
            <input type="file" accept=".json,application/json" onChange={handleOfflineFile} className="hidden" />
          </label>
          <button
            type="button"
            onClick={commitOfflinePackage}
            disabled={!offlinePackage || offlineBusy || offlinePreview?.already_imported || offlinePreview?.invalid > 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {offlineBusy ? 'Processing...' : 'Import Package'}
          </button>
        </div>
      </div>
    </div>
  );

  const generatePdfReport = async () => {
    if (!overviewData) return;

    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const autoTable = autoTableModule.default;
    const generatedAt = new Date();
    const stats = overviewData.stats || {};
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 96, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Church Attendance Report', margin, 42);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated ${generatedAt.toLocaleString()}`, margin, 62);
    doc.text(`${serviceLabel} | ${periodLabel}`, margin, 78);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', margin, 126);

    autoTable(doc, {
      startY: 142,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 8 },
      head: [['Metric', 'Value']],
      body: [
        ['Service', serviceLabel],
        ['Period', periodLabel],
        ['Submitted leaders', stats.total_submitted_leaders ?? 0],
        ['Present', stats.present ?? 0],
        ['Absent', stats.absent ?? 0],
        ['Excused', stats.excused ?? 0],
        ['Total records', (stats.present ?? 0) + (stats.absent ?? 0) + (stats.excused ?? 0)],
      ],
    });

    const leaderRows = leaders.map((leader) => {
      const present = leader.stats?.present ?? 0;
      const absent = leader.stats?.absent ?? 0;
      const excused = leader.stats?.excused ?? 0;
      return [
        leader.leader_name || 'Unassigned',
        formatSectionLabel(leader.section_name),
        leader.submissions_count ?? 0,
        present,
        absent,
        excused,
        present + absent + excused,
      ];
    });

    const tableY = (doc.lastAutoTable?.finalY || 260) + 28;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Leader Breakdown', margin, tableY);

    autoTable(doc, {
      startY: tableY + 16,
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 110 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      head: [['Leader', 'Section', 'Logs', 'Present', 'Absent', 'Excused', 'Total']],
      body: leaderRows.length > 0 ? leaderRows : [['No leader rows found', '', '', '', '', '', '']],
      didDrawPage: () => {
        const pageNumber = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${pageNumber}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 22, { align: 'right' });
      },
    });

    const safePeriod = String(filterValue).replace(/[^a-z0-9-]/gi, '_');
    const safeService = String(serviceLabel).replace(/[^a-z0-9-]/gi, '_').toLowerCase();
    doc.save(`attendance-report-${safeService}-${safePeriod}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white shadow-xl shadow-amber-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Attendance Reports</h2>
            <p className="text-sm text-white/80">Analyze attendance data by service and period</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
        <div className="flex max-w-full shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex gap-1">
            <button
              onClick={() => onServiceChange('all')}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all duration-300 ${
                selectedServiceId === 'all'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>

            {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={() => onServiceChange(service.id)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all duration-300 ${
                  selectedServiceId === service.id
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          <div className="tab-pills">
            {['daily', 'weekly', 'monthly', 'yearly'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  if (type === 'daily') {
                    setFilterValue(formatLocalDate());
                  } else {
                    setFilterValue('');
                  }
                }}
                className={`tab-pill capitalize ${filterType === type ? 'active' : ''}`}
              >
                {type}
              </button>
            ))}
          </div>

          {filterType === 'daily' ? (
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 w-full sm:w-auto"
            >
              <Calendar className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span>{formatPeriodLabel('daily', filterValue || formatLocalDate())}</span>
            </button>
          ) : (
            <input
              type={filterType === 'yearly' ? 'number' : filterType === 'monthly' ? 'month' : 'week'}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="input min-w-[180px] w-full sm:w-auto"
            />
          )}
        </div>
      </div>

      {offlineImportPanel}

      {overviewLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : overviewData ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Physical Report</h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                    Generate a printable PDF for {serviceLabel} during {periodLabel}. The file includes summary totals and the leader breakdown shown below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={generatePdfReport}
                disabled={!hasReportData}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Send}
              label="Submitted Leaders"
              value={overviewData.stats.total_submitted_leaders}
              variant="default"
            />
            <StatCard
              icon={CheckCircle2}
              label="Total Present"
              value={overviewData.stats.present}
              variant="success"
            />
            <StatCard
              icon={XCircle}
              label="Total Absent"
              value={overviewData.stats.absent}
              variant="danger"
            />
            <StatCard
              icon={Clock3}
              label="Total Excused"
              value={overviewData.stats.excused}
              variant="warning"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Leader Breakdown</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {leaders.length} leaders in {serviceLabel} - {periodLabel}
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-700/50 dark:text-slate-300">
                  Select a leader to open detailed attendance
                </div>
              </div>
            </div>

            {leaders.length > 0 ? (
              <>
                <div className="space-y-3 p-4 lg:hidden">
                  {leaders.map((leader) => {
                    const totalRecords = leader.stats.present + leader.stats.absent + leader.stats.excused;

                    return (
                      <button
                        key={leader.leader_id}
                        onClick={() => onLeaderClick(leader.leader_id)}
                        className="w-full rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-left transition-all hover:border-primary-300 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-slate-900/20 dark:hover:border-primary-700 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-md shadow-violet-500/20">
                              {getLeaderInitials(leader.leader_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {leader.leader_name}
                              </p>
                              <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {formatSectionLabel(leader.section_name)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Submissions</p>
                            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                              {leader.submissions_count}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Records</p>
                            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                              {totalRecords}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-900/15">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Present</p>
                            <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {leader.stats.present}
                            </p>
                          </div>
                          <div className="rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-900/15">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Absent</p>
                            <p className="mt-1 text-base font-bold text-rose-500 dark:text-rose-400">
                              {leader.stats.absent}
                            </p>
                          </div>
                          <div className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-900/15">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Excused</p>
                            <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400">
                              {leader.stats.excused}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[880px]">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/80">
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Leader
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Section
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Logs
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Present
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Absent
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Excused
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Total
                        </th>
                        <th className="w-12 px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((leader) => {
                        const totalRecords = leader.stats.present + leader.stats.absent + leader.stats.excused;

                        return (
                          <tr
                            key={leader.leader_id}
                            className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-indigo-50/40 dark:border-slate-700/40 dark:hover:bg-indigo-900/10"
                            onClick={() => onLeaderClick(leader.leader_id)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-md shadow-violet-500/20">
                                  {getLeaderInitials(leader.leader_name)}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                                    {leader.leader_name}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Tap for leader drill-down
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {formatSectionLabel(leader.section_name)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {leader.submissions_count}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {leader.stats.present}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-base font-semibold tabular-nums text-rose-500 dark:text-rose-400">
                                {leader.stats.absent}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                                {leader.stats.excused}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {totalRecords}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  No leader report rows found for this selection.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state py-20">
          <Radio className="empty-state-icon" />
          <p className="empty-state-title">Select a date range</p>
          <p className="empty-state-desc">Choose a period above to view attendance reports.</p>
        </div>
      )}
      {/* Material Date Picker Modal */}
      <MaterialDatePicker
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDateString={filterValue}
        onSelect={(val) => setFilterValue(val)}
      />
    </div>
  );
};

const MaterialDatePicker = ({ isOpen, onClose, selectedDateString, onSelect }) => {
  const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const initialDate = selectedDateString ? new Date(selectedDateString + 'T12:00:00') : new Date();
  const [tempDate, setTempDate] = useState(initialDate);
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  useEffect(() => {
    if (selectedDateString) {
      const d = new Date(selectedDateString + 'T12:00:00');
      setTempDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [selectedDateString, isOpen]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const headerDateString = tempDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const cells = [];
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Preceding month offset empty cells
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, date: null });
  }
  // Current month active cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      date: new Date(year, month, d)
    });
  }

  const handleOk = () => {
    const yStr = tempDate.getFullYear();
    const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(tempDate.getDate()).padStart(2, '0');
    onSelect(`${yStr}-${mStr}-${dStr}`);
    onClose();
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const today = new Date();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[310px] overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 animate-scale-in">
        {/* Purple Header */}
        <div className="bg-indigo-600 dark:bg-indigo-700 p-5 text-white flex flex-col justify-between select-none">
          <div className="text-[10px] font-bold tracking-wider opacity-85 uppercase">
            Select Date
          </div>
          <div className="mt-2 text-2xl font-semibold flex items-center justify-between">
            <span>{headerDateString}</span>
            <Edit2 className="h-4 w-4 opacity-75 cursor-pointer" />
          </div>
        </div>

        {/* Body */}
        <div className="p-4 select-none bg-white dark:bg-slate-900">
          {/* Month / Year Selector navigation */}
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {monthName}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-y-1 mb-2 text-center text-xs font-bold text-slate-400">
            {WEEKDAYS.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm font-semibold">
            {cells.map((cell, idx) => {
              if (!cell.day) {
                return <div key={`empty-${idx}`} />;
              }
              const isSelected = isSameDay(cell.date, tempDate);
              const isToday = isSameDay(cell.date, today);

              let dayClasses = "w-8 h-8 mx-auto flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ";
              if (isSelected) {
                dayClasses += "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/35";
              } else if (isToday) {
                dayClasses += "border border-indigo-600 text-indigo-600 font-bold dark:border-indigo-400 dark:text-indigo-400";
              } else {
                dayClasses += "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";
              }

              return (
                <button
                  key={`day-${cell.day}`}
                  type="button"
                  onClick={() => setTempDate(cell.date)}
                  className={dayClasses}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl transition-all uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="text-xs font-bold tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl transition-all uppercase"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReports;
