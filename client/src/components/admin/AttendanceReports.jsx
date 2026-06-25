import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  FileText, Radio, Send, CheckCircle2, XCircle, Clock3, ChevronRight, ChevronLeft,
  Download, Printer, Calendar, Edit2, TrendingUp, TrendingDown, Users, BarChart3,
  Building2, Brain, Shield, Heart, AlertTriangle, Minus, ArrowUp, ArrowDown,
  Target, Zap, Eye, Award, Activity, PieChart as PieChartIcon, RefreshCw,
  Search, Filter, FileSpreadsheet, Share2, Copy, Printer as PrinterIcon,
  Layers, UserCheck, Stethoscope, Sparkles, Briefcase, CalendarDays,
  Crown, Star, Flame, TrendingUp as TrendingUpIcon, Info,
} from 'lucide-react';
import StatCard from '../ui/StatCard';
import { adminAPI, analyticsAPI } from '../../services/api';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, AreaChart, Area,
  ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const C = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#84cc16'];
const SECTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 text-xs z-50">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{String(p.name).toLowerCase().includes('rate') || String(p.name).toLowerCase().includes('%') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, prev, color, sparkData }) => {
  const diff = prev ? ((value - prev) / (prev || 1) * 100) : 0;
  const isUp = diff > 0;
  const sparkSvg = useMemo(() => {
    if (!sparkData?.length) return null;
    const vals = sparkData.map(d => d.v);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const w = 80, h = 28;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1 || 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ');
    return <polyline points={pts} fill="none" stroke={color || '#6366f1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
  }, [sparkData, color]);

  return (
    <div className="card-stat group">
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{value?.toLocaleString?.() ?? value ?? 0}</p>
          {prev != null && (
            <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${isUp ? 'text-emerald-600' : diff < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {isUp ? <ArrowUp className="w-3 h-3" /> : diff < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(diff).toFixed(1)}% vs prev
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="card-stat-icon" style={{ background: `${color || '#6366f1'}18` }}>
            <Icon className="w-5 h-5" style={{ color: color || '#6366f1' }} />
          </div>
          {sparkSvg && (
            <svg width="80" height="28" viewBox={`0 0 80 28`} className="opacity-40 group-hover:opacity-70 transition-opacity">
              {sparkSvg}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'sections', label: 'Sections', icon: Building2 },
  { key: 'leaders', label: 'Leaders', icon: Users },
  { key: 'departments', label: 'Departments', icon: Briefcase },
  { key: 'members', label: 'Members', icon: UserCheck },
  { key: 'risk', label: 'Risk', icon: Shield },
  { key: 'distribution', label: 'Distribution', icon: PieChartIcon },
  { key: 'actions', label: 'Actions', icon: Zap },
];

const formatSectionLabel = (name) => {
  if (!name) return 'Unassigned';
  const smallWords = new Set(['of', 'and', 'the', 'in', 'for', 'to']);
  return name.toLowerCase().split(/\s+/).filter(Boolean).map((word, index) => {
    if (index > 0 && smallWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
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
    return !isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : filterValue;
  }
  if (filterType === 'yearly') return filterValue;
  if (filterType === 'monthly') {
    const [year, month] = filterValue.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (filterType === 'weekly') {
    const [year, week] = filterValue.split('-W');
    return `Week ${week}, ${year}`;
  }
  return filterValue;
};

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />
);

const SkeletonGrid = ({ count = 6, cols = 3 }) => (
  <div className={`grid grid-cols-2 lg:grid-cols-${cols} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-28" />
    ))}
  </div>
);

const AttendanceReports = ({
  filterType, setFilterType, filterValue, setFilterValue,
  overviewData, overviewLoading, serviceTypes = [], selectedServiceId,
  onServiceChange, loadOverview, onLeaderClick,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [sectionComparison, setSectionComparison] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const currentService = serviceTypes.find(s => s.id === selectedServiceId);
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
    if (selectedServiceId !== 'all') onServiceChange('all');
  }, [onServiceChange, selectedServiceId]);

  useEffect(() => { loadAllAnalytics(); }, []);

  const loadAllAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const r = await Promise.allSettled([
        analyticsAPI.getExecutiveDashboard(),
        analyticsAPI.getSectionRankings(90),
        analyticsAPI.getLeaderRankings(90),
        analyticsAPI.getDepartments(90),
        analyticsAPI.getMemberIntelligence(90),
        analyticsAPI.getHeatmap(6),
        analyticsAPI.getTrendsMA(26),
        analyticsAPI.getAIInsights(),
        analyticsAPI.getChurchGrowthIndex(),
        analyticsAPI.getRiskAnalysis(),
        analyticsAPI.getHeadLeaderAnalytics(90),
        analyticsAPI.getLeaderWorkload(90),
        analyticsAPI.getCorrelations(6),
        analyticsAPI.getSectionComparison(90),
        analyticsAPI.getAttendancePatterns(180),
        analyticsAPI.getYearOverYear(),
        analyticsAPI.getPredictions(),
      ]);
      const ok = i => r[i].status === 'fulfilled' ? r[i].value.data : null;
      setAnalytics({
        executive: ok(0), sections: ok(1) || [], leaders: ok(2) || [],
        departments: ok(3) || [], members: ok(4) || [],
        heatmap: ok(5), trends: ok(6) || [], insights: ok(7) || [],
        growth: ok(8), risk: ok(9),
        headLeaders: ok(10) || [], workload: ok(11) || [],
        correlations: ok(12) || [], sectionComparison: ok(13) || [],
        dayPatterns: ok(14) || [], yearOverYear: ok(15) || [],
        predictions: ok(16),
      });
    } catch (e) { console.error('Analytics load error:', e); }
    finally { setAnalyticsLoading(false); }
  };

  const filteredLeaders = useMemo(() => {
    if (!searchQuery) return leaders;
    const q = searchQuery.toLowerCase();
    return leaders.filter(l => l.leader_name?.toLowerCase().includes(q) || l.section_name?.toLowerCase().includes(q));
  }, [leaders, searchQuery]);

  const generatePdfReport = async () => {
    if (!overviewData) return;
    const leaderRows = leaders.map(l => ({
      leader_name: l.leader_name || 'Unassigned', section_name: formatSectionLabel(l.section_name),
      submissions_count: l.submissions_count ?? 0, stats: l.stats || {},
    }));
    const { generateReportPdf } = await import('../../utils/pdfWorker');
    try {
      await generateReportPdf({ report: 'attendance', overviewData, leaders: leaderRows, serviceLabel, periodLabel, filterValue });
    } catch (err) { alert('Failed to generate PDF: ' + (err.message || err)); }
  };

  const exportCSV = () => {
    if (!leaders.length) return;
    const headers = ['Leader', 'Section', 'Submissions', 'Present', 'Absent', 'Excused', 'Total'];
    const rows = leaders.map(l => [l.leader_name, l.section_name, l.submissions_count, l.stats.present, l.stats.absent, l.stats.excused, l.stats.present + l.stats.absent + l.stats.excused]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance-report-${filterValue || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header Banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 bg-white/5 rounded-full translate-y-24" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Church Intelligence Dashboard</h2>
              <p className="text-white/80 text-sm">Enterprise attendance analytics & insights</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={loadAllAnalytics} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex max-w-full shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <button onClick={() => onServiceChange('all')}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${selectedServiceId === 'all' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
            All
          </button>
          {serviceTypes.map(s => (
            <button key={s.id} onClick={() => onServiceChange(s.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${selectedServiceId === s.id ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
              {s.name === 'Main Service' ? 'Main' : s.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="tab-pills">
            {['daily', 'weekly', 'monthly', 'yearly'].map(type => (
              <button key={type} onClick={() => { setFilterType(type); if (type === 'daily') setFilterValue(formatLocalDate()); else setFilterValue(''); }}
                className={`tab-pill capitalize ${filterType === type ? 'active' : ''}`}>
                {type}
              </button>
            ))}
          </div>
          {filterType === 'daily' ? (
            <button type="button" onClick={() => setIsDatePickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 w-full sm:w-auto">
              <Calendar className="h-4 w-4 text-primary-600" />
              <span>{formatPeriodLabel('daily', filterValue || formatLocalDate())}</span>
            </button>
          ) : (
            <input type={filterType === 'yearly' ? 'number' : filterType === 'monthly' ? 'month' : 'week'}
              value={filterValue} onChange={e => setFilterValue(e.target.value)}
              className="input min-w-[180px] w-full sm:w-auto" />
          )}
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${activeTab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: OVERVIEW - KPIs + AI Insights + Executive Summary
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* AI Intelligence Summary */}
          {analytics.insights?.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Church Intelligence</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">LIVE</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.insights.slice(0, 6).map((insight, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-md ${
                    insight.type === 'success' ? 'bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-900/10 dark:border-emerald-800/30' :
                    insight.type === 'warning' ? 'bg-amber-50/50 border-amber-200/60 dark:bg-amber-900/10 dark:border-amber-800/30' :
                    insight.type === 'danger' ? 'bg-rose-50/50 border-rose-200/60 dark:bg-rose-900/10 dark:border-rose-800/30' :
                    'bg-blue-50/50 border-blue-200/60 dark:bg-blue-900/10 dark:border-blue-800/30'
                  }`}>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      insight.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                      insight.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
                      insight.type === 'danger' ? 'bg-rose-100 dark:bg-rose-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {insight.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> :
                       insight.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> :
                       insight.type === 'danger' ? <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> :
                       <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Executive KPI Cards */}
          {analyticsLoading ? <SkeletonGrid count={8} cols={4} /> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={Users} label="Total Members" value={analytics.executive?.total_members} color="#6366f1" />
              <KpiCard icon={CheckCircle2} label="Present Today" value={analytics.executive?.present_today} color="#10b981"
                prev={analytics.executive?.absent_today} />
              <KpiCard icon={XCircle} label="Absent Today" value={analytics.executive?.absent_today} color="#ef4444" />
              <KpiCard icon={Clock3} label="Excused" value={analytics.executive?.excused_today} color="#f59e0b" />
              <KpiCard icon={Heart} label="Visitors (Week)" value={analytics.executive?.visitors_this_week} color="#ec4899" />
              <KpiCard icon={Heart} label="Visitors (Month)" value={analytics.executive?.visitors_this_month} color="#8b5cf6" />
              <KpiCard icon={Activity} label="Attendance Rate" value={`${analytics.executive?.attendance_rate || 0}%`} color="#06b6d4" />
              <KpiCard icon={TrendingUp} label="Church Health" value={`${analytics.growth?.growth_index || 0}/100`} color="#14b8a6" />
            </div>
          )}

          {/* Growth Cards */}
          {analytics.growth && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Weekly Growth', value: analytics.growth.weekly_growth, color: 'emerald' },
                { label: 'Monthly Growth', value: analytics.growth.monthly_growth, color: 'blue' },
                { label: 'Current Rate', value: analytics.growth.current_rate, color: 'indigo' },
                { label: 'Rate Change', value: analytics.growth.rate_change, color: analytics.growth.rate_change >= 0 ? 'emerald' : 'rose' },
              ].map(g => (
                <div key={g.label} className="card-stat">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${Number(g.value) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {Number(g.value) >= 0 ? '+' : ''}{g.value || 0}%
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Section Overview Chart */}
          {analytics.sectionComparison?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Section Overview</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.sectionComparison} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="attendance_rate" name="Attendance Rate (%)" radius={[4, 4, 0, 0]}>
                    {analytics.sectionComparison.map((_, i) => <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="member_count" name="Members" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Year-over-Year */}
          {analytics.yearOverYear?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Year-over-Year Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={analytics.yearOverYear} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="month_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="current_rate" name="Current Year" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="previous_rate" name="Previous Year" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: TRENDS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-6 animate-fade-in">
          {analytics.trends?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Attendance Trends with Moving Averages
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={analytics.trends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="daily_rate" name="Daily Rate %" fill="url(#gradRate)" stroke="#6366f1" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="ma_4week" name="4-Week MA" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="ma_8week" name="8-Week MA" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day of Week Patterns */}
          {analytics.dayPatterns?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Attendance by Day of Week</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.dayPatterns} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="day_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="avg_rate" name="Avg Attendance %" radius={[4, 4, 0, 0]}>
                    {analytics.dayPatterns.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Heat Map Grid */}
          {analytics.heatmap?.daily?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Attendance Heat Map
              </h3>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-[9px] font-bold text-slate-400 text-center py-1">{d}</div>
                ))}
                {analytics.heatmap.daily.slice(-42).map((day, i) => {
                  const rate = Number(day.rate) || 0;
                  const bg = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-emerald-300' : rate >= 40 ? 'bg-amber-300' : rate >= 20 ? 'bg-orange-400' : 'bg-rose-400';
                  return (
                    <div key={i} title={`${day.date}: ${rate}%`} className={`aspect-square rounded-sm ${bg} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`} />
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-slate-400">
                <span>Less</span>
                {['bg-rose-400', 'bg-orange-400', 'bg-amber-300', 'bg-emerald-300', 'bg-emerald-500'].map((c, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          )}

          {/* Predictions */}
          {analytics.predictions && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Predictive Analytics
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200/60 dark:border-indigo-800/30">
                  <p className="text-[10px] font-bold uppercase text-indigo-500">Predicted Rate</p>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{analytics.predictions.forecast?.predicted_rate || 0}%</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/60 dark:border-emerald-800/30">
                  <p className="text-[10px] font-bold uppercase text-emerald-500">Predicted Present</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{analytics.predictions.forecast?.predicted_present || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-800/30">
                  <p className="text-[10px] font-bold uppercase text-amber-500">Trend Direction</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1 capitalize">{analytics.predictions.forecast?.trend || 'Stable'}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200/60 dark:border-pink-800/30">
                  <p className="text-[10px] font-bold uppercase text-pink-500">Weeks Analyzed</p>
                  <p className="text-2xl font-bold text-pink-700 dark:text-pink-300 mt-1">{analytics.predictions.forecast?.weeks_analyzed || 0}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: SECTIONS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sections' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section Leaderboard */}
          {analytics.sections?.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {analytics.sections.slice(0, 4).map((sec, i) => (
                  <div key={sec.id} className={`card-stat ${i === 0 ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">#{i + 1} {sec.name}</span>
                      {i === 0 && <Award className="w-4 h-4 text-amber-500" />}
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{sec.attendance_rate}%</p>
                    <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, sec.attendance_rate)}%`, backgroundColor: SECTION_COLORS[i] }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                      <span>{sec.member_count} members</span><span>+{sec.new_members} new</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Radar Chart */}
              <div className="card p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Performance Radar</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={analytics.sections.map(x => ({ name: x.name?.slice(0, 10), rate: Number(x.attendance_rate) || 0, members: Math.min(100, (x.member_count || 0) / 2) }))}>
                    <PolarGrid stroke="rgba(0,0,0,0.06)" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Radar name="Rate" dataKey="rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                    <Radar name="Members" dataKey="members" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Tooltip content={<Tip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Rankings Table */}
              <div className="card p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Section Rankings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        {['Rank', 'Section', 'Members', 'Present', 'Absent', 'Rate', 'Consistency', 'Status'].map(h => (
                          <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Rank' || h === 'Section' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.sections.map((sec, i) => (
                        <tr key={sec.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-bold" style={{ color: SECTION_COLORS[i] }}>#{i + 1}</td>
                          <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{sec.name}</td>
                          <td className="py-3 px-3 text-right text-slate-600">{sec.member_count}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-medium">{sec.total_present?.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right text-rose-500">{sec.total_absent?.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right font-bold">{sec.attendance_rate}%</td>
                          <td className="py-3 px-3 text-right text-slate-500">{sec.consistency_score != null ? `${sec.consistency_score}%` : '-'}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(sec.attendance_rate) >= 75 ? 'bg-emerald-100 text-emerald-700' : Number(sec.attendance_rate) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              {Number(sec.attendance_rate) >= 75 ? 'Strong' : Number(sec.attendance_rate) >= 50 ? 'Average' : 'Needs Attention'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: LEADERS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leaders' && (
        <div className="space-y-6 animate-fade-in">
          {/* Head Leaders */}
          {analytics.headLeaders?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Head Leader Analytics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.headLeaders.map(l => (
                  <div key={l.leader_id} className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white">
                        {getLeaderInitials(l.leader_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{l.leader_name}</p>
                        <p className="text-[10px] text-slate-500">{l.section_name}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{l.performance_score || 0}</p>
                        <p className="text-[9px] text-slate-400 uppercase">Score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900/50">
                        <p className="text-[9px] text-slate-400 uppercase">Members</p>
                        <p className="font-bold text-slate-900 dark:text-white">{l.members_managed}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900/50">
                        <p className="text-[9px] text-slate-400 uppercase">Attendance</p>
                        <p className="font-bold text-emerald-600">{l.overall_attendance}%</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900/50">
                        <p className="text-[9px] text-slate-400 uppercase">Supervised</p>
                        <p className="font-bold text-slate-900 dark:text-white">{l.leaders_supervised}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leader Rankings */}
          {analytics.leaders?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Leader Rankings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Rank', 'Leader', 'Section', 'Members', 'Rate', 'Submissions', 'Score'].map(h => (
                        <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Rank' || h === 'Leader' || h === 'Section' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.leaders.map((l, i) => (
                      <tr key={l.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                        onClick={() => onLeaderClick?.(l.leader_id)}>
                        <td className="py-3 px-3 font-bold" style={{ color: C[i % C.length] }}>#{i + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                              {getLeaderInitials(l.leader_name)}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{l.leader_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{l.section_name}</td>
                        <td className="py-3 px-3 text-right">{l.assigned_members}</td>
                        <td className="py-3 px-3 text-right font-bold">{l.attendance_rate}%</td>
                        <td className="py-3 px-3 text-right">{l.submission_count}</td>
                        <td className="py-3 px-3 text-right font-bold text-indigo-600">{l.efficiency_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Original Leader Breakdown from Overview */}
          {hasReportData && leaders.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Leader Submission Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Leader', 'Section', 'Logs', 'Present', 'Absent', 'Excused', 'Total'].map(h => (
                        <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Leader' || h === 'Section' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaders.map(leader => {
                      const total = leader.stats.present + leader.stats.absent + leader.stats.excused;
                      return (
                        <tr key={leader.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                          onClick={() => onLeaderClick(leader.leader_id)}>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                                {getLeaderInitials(leader.leader_name)}
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">{leader.leader_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {formatSectionLabel(leader.section_name)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              {leader.submissions_count}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600">{leader.stats.present}</td>
                          <td className="py-3 px-3 text-right font-semibold text-rose-500">{leader.stats.absent}</td>
                          <td className="py-3 px-3 text-right font-semibold text-amber-600">{leader.stats.excused}</td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: DEPARTMENTS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'departments' && (
        <div className="space-y-6 animate-fade-in">
          {analytics.departments?.length > 0 && (
            <>
              <div className="card p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Department Attendance</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={analytics.departments} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={80} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="attendance_rate" name="Attendance %" radius={[0, 4, 4, 0]}>
                      {analytics.departments.map((d, i) => <Cell key={i} fill={d.growth_indicator === 'strong' ? '#10b981' : d.growth_indicator === 'average' ? '#f59e0b' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Department Rankings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        {['Rank', 'Department', 'Members', 'Rate', 'Status'].map(h => (
                          <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Rank' || h === 'Department' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.departments.map((d, i) => (
                        <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-3 font-bold" style={{ color: C[i % C.length] }}>#{i + 1}</td>
                          <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{d.name}</td>
                          <td className="py-3 px-3 text-right">{d.member_count || d.total_members}</td>
                          <td className="py-3 px-3 text-right font-bold">{d.attendance_rate}%</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.growth_indicator === 'strong' ? 'bg-emerald-100 text-emerald-700' : d.growth_indicator === 'average' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              {d.growth_indicator === 'strong' ? 'Strong' : d.growth_indicator === 'average' ? 'Average' : 'Needs Attention'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: MEMBERS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="space-y-6 animate-fade-in">
          {analytics.risk && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Highly Active', value: analytics.risk.summary?.highly_active, color: '#10b981', bg: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20' },
                { label: 'Active', value: analytics.risk.summary?.active, color: '#6366f1', bg: 'from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20' },
                { label: 'Moderate', value: analytics.risk.summary?.moderately_active, color: '#f59e0b', bg: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20' },
                { label: 'At Risk', value: analytics.risk.summary?.at_risk, color: '#f97316', bg: 'from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20' },
                { label: 'Critical', value: analytics.risk.summary?.critical, color: '#ef4444', bg: 'from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20' },
              ].map(s => (
                <div key={s.label} className={`p-4 rounded-xl bg-gradient-to-br ${s.bg} border border-slate-200/40 dark:border-slate-700/40`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{s.value || 0}</p>
                </div>
              ))}
            </div>
          )}

          {analytics.members?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Member Attendance Intelligence</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Member', 'Section', 'Leader', 'Rate', 'Present', 'Services', 'Risk Level'].map(h => (
                        <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Member' || h === 'Section' || h === 'Leader' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.members.slice(0, 30).map(m => (
                      <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white text-xs">{m.full_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{m.section_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{m.leader_name}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-xs">{m.attendance_rate}%</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 text-xs">{m.total_present}</td>
                        <td className="py-2.5 px-3 text-right text-xs">{m.total_services}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            m.risk_level === 'Highly Active' ? 'bg-emerald-100 text-emerald-700' :
                            m.risk_level === 'Active' ? 'bg-indigo-100 text-indigo-700' :
                            m.risk_level === 'Moderately Active' ? 'bg-amber-100 text-amber-700' :
                            m.risk_level === 'At Risk' ? 'bg-orange-100 text-orange-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>{m.risk_level}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: RISK
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'risk' && (
        <div className="space-y-6 animate-fade-in">
          {analytics.risk?.consecutive_absentees?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Consecutive Absentees (3+ Weeks)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Member', 'Section', 'Leader', 'Consecutive Absences'].map(h => (
                        <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h !== 'Consecutive Absences' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.risk.consecutive_absentees.map(m => (
                      <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-rose-50/30 dark:hover:bg-rose-900/10">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white text-xs">{m.full_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{m.section_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{m.leader_name}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">{m.consecutive_absences} weeks</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analytics.risk?.at_risk_members?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                Pastoral Visitation List
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {analytics.risk.at_risk_members.slice(0, 12).map(m => (
                  <div key={m.id} className="p-3 rounded-xl border border-rose-200/60 dark:border-rose-800/30 bg-rose-50/30 dark:bg-rose-900/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-[10px] font-bold text-rose-600">
                        {getLeaderInitials(m.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-xs truncate">{m.full_name}</p>
                        <p className="text-[10px] text-slate-500">{m.section_name} - {m.leader_name}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">{m.present_count}/{m.total_services} services</span>
                      <span className="font-bold text-rose-600">{m.total_services > 0 ? Math.round(m.present_count / m.total_services * 100) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: DISTRIBUTION
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'distribution' && (
        <div className="space-y-6 animate-fade-in">
          {overviewData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Present vs Absent vs Excused */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Attendance Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Present', value: overviewData.stats.present || 0 },
                      { name: 'Absent', value: overviewData.stats.absent || 0 },
                      { name: 'Excused', value: overviewData.stats.excused || 0 },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {[
                        { name: 'Present', fill: '#10b981' },
                        { name: 'Absent', fill: '#ef4444' },
                        { name: 'Excused', fill: '#f59e0b' },
                      ].map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Section Distribution */}
              {sectionComparison.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Section Distribution</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sectionComparison.map(s => ({ name: s.name, value: s.member_count || 0 })).filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {sectionComparison.map((_, i) => <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Correlation */}
              {analytics.correlations?.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Attendance vs Contributions</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={analytics.correlations} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="attendance_rate" name="Attendance %" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Bar dataKey="total_contributions" name="Contributions" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: ACTIONS + EXPORTS
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'actions' && (
        <div className="space-y-6 animate-fade-in">
          {/* Action Center */}
          <div className="card p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Action Center
            </h3>
            <div className="space-y-3">
              {analytics.risk?.consecutive_absentees?.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-200/60 dark:bg-rose-900/10 dark:border-rose-800/30">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Follow-up Required</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400">{analytics.risk.consecutive_absentees.length} member(s) have missed 3+ consecutive services and require pastoral visitation.</p>
                  </div>
                </div>
              )}
              {analytics.sections?.[0] && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60 dark:bg-emerald-900/10 dark:border-emerald-800/30">
                  <Award className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Top Performer</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{analytics.sections[0].name} section achieved {analytics.sections[0].attendance_rate}% attendance rate - the highest across all sections.</p>
                  </div>
                </div>
              )}
              {analytics.sections?.length >= 2 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 dark:bg-amber-900/10 dark:border-amber-800/30">
                  <TrendingDown className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Section Gap</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">There is a {(analytics.sections[0].attendance_rate - analytics.sections[analytics.sections.length - 1].attendance_rate).toFixed(1)}% gap between the best and lowest performing sections.</p>
                  </div>
                </div>
              )}
              {analytics.growth?.current_rate >= 80 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/60 dark:bg-indigo-900/10 dark:border-indigo-800/30">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Church Health</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Overall attendance is healthy at {analytics.growth.current_rate}%. Keep up the good work!</p>
                  </div>
                </div>
              )}
              {analytics.growth?.souls_won_90d > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 border border-purple-200/60 dark:bg-purple-900/10 dark:border-purple-800/30">
                  <Heart className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Evangelism Impact</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">{analytics.growth.souls_won_90d} souls have been won through evangelism in the last 90 days.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export Center */}
          <div className="card p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              Export Center
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button onClick={generatePdfReport} disabled={!hasReportData}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-40">
                <FileText className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Export PDF</span>
              </button>
              <button onClick={exportCSV} disabled={!leaders.length}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all disabled:opacity-40">
                <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Export CSV</span>
              </button>
              <button onClick={() => window.print()}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-700 transition-all">
                <Printer className="w-6 h-6 text-amber-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Print</span>
              </button>
              <button onClick={loadAllAnalytics}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
                <RefreshCw className="w-6 h-6 text-purple-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Refresh Data</span>
              </button>
            </div>
          </div>
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

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d) });

  const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const today = new Date();

  const handleOk = () => {
    onSelect(`${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[310px] overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 animate-scale-in">
        <div className="bg-indigo-600 dark:bg-indigo-700 p-5 text-white select-none">
          <div className="text-[10px] font-bold tracking-wider opacity-85 uppercase">Select Date</div>
          <div className="mt-2 text-2xl font-semibold">{tempDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
        <div className="p-4 select-none bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 mb-2 text-center text-xs font-bold text-slate-400">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm font-semibold">
            {cells.map((cell, idx) => {
              if (!cell.day) return <div key={`e-${idx}`} />;
              const sel = isSameDay(cell.date, tempDate);
              const tod = isSameDay(cell.date, today);
              return (
                <button key={`d-${cell.day}`} onClick={() => setTempDate(cell.date)}
                  className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                    sel ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/35' :
                    tod ? 'border border-indigo-600 text-indigo-600 font-bold dark:border-indigo-400 dark:text-indigo-400' :
                    'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}>{cell.day}</button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose} className="text-xs font-bold tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl uppercase">Cancel</button>
          <button onClick={handleOk} className="text-xs font-bold tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl uppercase">OK</button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReports;
