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
  Calendar,
  Edit2,
  TrendingUp,
  Users,
  BarChart3,
  Building2,
} from 'lucide-react';
import StatCard from '../ui/StatCard';
import { adminAPI, analyticsAPI } from '../../services/api';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, AreaChart, Area,
} from 'recharts';

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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

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
  const [sectionTrends, setSectionTrends] = useState([]);
  const [sectionComparison, setSectionComparison] = useState([]);

  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const serviceLabel = selectedServiceId === 'all' ? 'All services' : (currentService?.name || 'Selected service');
  const periodLabel = formatPeriodLabel(filterType, filterValue);
  const leaders = overviewData?.subleaders || [];
  const hasReportData = Boolean(overviewData && filterValue);
  const initializedServiceRef = useRef(false);

  useEffect(() => {
    if (filterValue) loadOverview();
  }, [filterType, filterValue, selectedServiceId]);

  useEffect(() => {
    if (initializedServiceRef.current) return;
    initializedServiceRef.current = true;
    if (selectedServiceId !== 'all') {
      onServiceChange('all');
    }
  }, [onServiceChange, selectedServiceId]);

  useEffect(() => {
    if (hasReportData) loadEnhancedAnalytics();
  }, [filterValue, selectedServiceId, hasReportData]);

  const loadEnhancedAnalytics = async () => {
    try {
      const [trends, comparison] = await Promise.allSettled([
        analyticsAPI.getMonthlyTrends(6),
        analyticsAPI.getSectionComparison(90),
      ]);
      if (trends.status === 'fulfilled') setSectionTrends(trends.value.data?.sections || []);
      if (comparison.status === 'fulfilled') setSectionComparison(comparison.value.data || []);
    } catch (e) { console.error('Enhanced analytics failed:', e); }
  };

  const generatePdfReport = async () => {
    if (!overviewData) return;

    // Build the leader rows here on the main thread (we already have
    // the formatted `formatSectionLabel` available) and hand the
    // worker a fully-prepared payload. The worker does the heavy
    // jspdf work off the main thread.
    const leaderRows = leaders.map((leader) => ({
      leader_name: leader.leader_name || 'Unassigned',
      section_name: formatSectionLabel(leader.section_name),
      submissions_count: leader.submissions_count ?? 0,
      stats: leader.stats || {},
    }));

    const { generateReportPdf } = await import('../../utils/pdfWorker');
    try {
      await generateReportPdf({
        report: 'attendance',
        overviewData,
        leaders: leaderRows,
        serviceLabel,
        periodLabel,
        filterValue,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
      // Surface the failure to the admin so they can retry.
      alert('Failed to generate PDF: ' + (err.message || err));
    }
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

        {/* ── Enhanced Analytics Sections ──────────────────────────────────── */}
        {hasReportData && sectionComparison.length > 0 && (
          <div className="space-y-6 mt-6">
            {/* Section Comparison Bar Chart */}
            <div className="card p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-500" />
                Section Attendance Comparison
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectionComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="attendance_rate" name="Attendance Rate (%)" radius={[4, 4, 0, 0]}>
                    {sectionComparison.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar dataKey="member_count" name="Members" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Section Detail Table */}
            <div className="card p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Section Performance Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-3 text-xs font-semibold uppercase text-slate-500">Section</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Members</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Present</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Absent</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Rate</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold uppercase text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionComparison.map((sec) => (
                      <tr key={sec.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{sec.name}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{sec.member_count}</td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-medium">{sec.total_present?.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-rose-500 font-medium">{sec.total_absent?.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-bold">{sec.attendance_rate}%</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            Number(sec.attendance_rate) >= 75 ? 'bg-emerald-100 text-emerald-700' :
                            Number(sec.attendance_rate) >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {Number(sec.attendance_rate) >= 75 ? 'Strong' : Number(sec.attendance_rate) >= 50 ? 'Average' : 'Needs Attention'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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
