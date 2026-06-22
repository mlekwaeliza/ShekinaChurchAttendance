import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Target,
  Calendar,
  Download,
  Printer,
  FileText,
  Activity,
  Shield,
  ChevronRight,
  Zap,
  Award,
  Clock,
  Eye,
  Layers,
  CheckCircle2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import Badge from '../ui/Badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';

const SECTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'leaders', label: 'Leaders', icon: Users },
  { id: 'departments', label: 'Departments', icon: BarChart3 },
  { id: 'members', label: 'Members', icon: Award },
  { id: 'risk', label: 'Risk Analysis', icon: Shield },
  { id: 'distribution', label: 'Distribution', icon: Target },
  { id: 'actions', label: 'Actions', icon: Zap },
];

const formatPeriodLabel = (filterType, filterValue) => {
  if (!filterValue) return 'Select a period';
  if (filterType === 'yearly') return filterValue;
  if (filterType === 'monthly') {
    const [year, month] = filterValue.split('-');
    const date = new Date(year, parseInt(month, 10) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return filterValue.replace('-', ' ');
};

const generateAIInsights = (data) => {
  const insights = [];
  const { overview, prediction, anomalies, leaderMetrics } = data;
  if (!overview) return insights;

  const stats = overview.stats || {};
  const total = (stats.present || 0) + (stats.absent || 0) + (stats.excused || 0);
  const rate = total > 0 ? Math.round((stats.present / total) * 100) : 0;

  if (rate >= 80) {
    insights.push({ type: 'success', text: `Strong attendance rate of ${rate}% this period. The congregation is engaged.`, icon: CheckCircle2 });
  } else if (rate < 60) {
    insights.push({ type: 'danger', text: `Attendance rate dropped to ${rate}%. Consider outreach to inactive members.`, icon: AlertTriangle });
  }

  if (prediction?.trend === 'increasing') {
    insights.push({ type: 'success', text: `Attendance is trending upward over the last ${prediction.weeks_analyzed || 0} weeks.`, icon: TrendingUp });
  } else if (prediction?.trend === 'decreasing') {
    insights.push({ type: 'warning', text: 'Attendance trend is declining. Review recent changes in scheduling or engagement.', icon: TrendingDown });
  }

  if (anomalies?.length > 0) {
    const worst = anomalies.reduce((a, b) => (a.drop_amount > b.drop_amount ? a : b));
    insights.push({ type: 'warning', text: `${worst.section_name} saw a ${worst.drop_amount}% drop from their historical average.`, icon: AlertTriangle });
  }

  const unsubmitted = (stats.total_leaders || 0) - (stats.total_submitted_leaders || 0);
  if (unsubmitted > 0) {
    insights.push({ type: 'info', text: `${unsubmitted} leader(s) have not submitted attendance this period.`, icon: Clock });
  }

  if (leaderMetrics?.length > 0) {
    const top = leaderMetrics[0];
    if (top.attendance_rate >= 90) {
      insights.push({ type: 'success', text: `${top.leader_name} leads with ${top.attendance_rate}% section attendance.`, icon: Award });
    }
  }

  return insights.slice(0, 6);
};

const MiniSparkline = ({ data, color = '#6366f1' }) => {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color.replace('#', '')})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
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
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (filterValue) loadOverview();
  }, [filterType, filterValue, selectedServiceId]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

      const results = await Promise.allSettled([
        adminAPI.getAttendanceTrends(90),
        adminAPI.getAttendancePrediction(),
        adminAPI.getSectionAnomalies(),
        adminAPI.getMemberStreaks(20),
        adminAPI.getLeaderPerformance(startDate90, endDate),
        analyticsAPI.getDemographics(),
        analyticsAPI.getYearOverYear(),
        analyticsAPI.getRetention(90),
        analyticsAPI.getEngagementScores(10),
        analyticsAPI.getDashboardMetrics(selectedServiceId),
        analyticsAPI.getSectionComparison(90),
        analyticsAPI.getSectionRankings(90),
      ]);

      const keys = ['trends', 'prediction', 'anomalies', 'streaks', 'leaderMetrics', 'demographics', 'yearOverYear', 'retention', 'engagementScores', 'dashboardMetrics', 'sectionComparison', 'sectionRankings'];
      const data = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const res = r.value?.data;
          data[keys[i]] = keys[i] === 'trends' ? (res?.trends || []) : res;
        }
      });
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const currentService = serviceTypes.find((s) => s.id === selectedServiceId);
  const serviceLabel = selectedServiceId === 'all' ? 'All Services' : (currentService?.name || 'Service');
  const periodLabel = formatPeriodLabel(filterType, filterValue);

  const stats = overviewData?.stats || {};
  const leaders = overviewData?.subleaders || [];
  const hasData = Boolean(overviewData && filterValue);

  const insights = useMemo(() => generateAIInsights({
    overview: overviewData,
    prediction: analytics.prediction,
    anomalies: analytics.anomalies,
    leaderMetrics: analytics.leaderMetrics,
  }), [overviewData, analytics]);

  const trendChartData = useMemo(() => {
    if (!analytics.trends?.length) return [];
    return analytics.trends.map((t) => ({
      date: t.date?.slice(5) || '',
      present: t.present_count || 0,
      absent: t.absent_count || 0,
      excused: t.excused_count || 0,
      rate: t.total_members > 0 ? Math.round(((t.present_count || 0) / t.total_members) * 100) : 0,
    }));
  }, [analytics.trends]);

  const sectionBarData = useMemo(() => {
    if (!leaders.length) return [];
    return leaders.map((l) => ({
      name: l.leader_name?.split(' ')[0] || 'Unknown',
      fullName: l.leader_name,
      present: l.stats?.present || 0,
      absent: l.stats?.absent || 0,
      excused: l.stats?.excused || 0,
      total: (l.stats?.present || 0) + (l.stats?.absent || 0) + (l.stats?.excused || 0),
      rate: (() => {
        const t = (l.stats?.present || 0) + (l.stats?.absent || 0) + (l.stats?.excused || 0);
        return t > 0 ? Math.round(((l.stats?.present || 0) / t) * 100) : 0;
      })(),
    }));
  }, [leaders]);

  const yoyData = useMemo(() => {
    if (!analytics.yearOverYear?.length) return [];
    return analytics.yearOverYear.map((y) => ({
      month: y.month_name || y.month,
      current: y.current_year_rate || 0,
      previous: y.previous_year_rate || 0,
      difference: y.difference || 0,
    }));
  }, [analytics.yearOverYear]);

  const sectionRadarData = useMemo(() => {
    if (!leaders.length) return [];
    return leaders.slice(0, 6).map((l) => {
      const t = (l.stats?.present || 0) + (l.stats?.absent || 0) + (l.stats?.excused || 0);
      return {
        section: l.section_name?.slice(0, 12) || 'N/A',
        rate: t > 0 ? Math.round(((l.stats?.present || 0) / t) * 100) : 0,
        submissions: l.submissions_count || 0,
      };
    });
  }, [leaders]);

  const distributionData = useMemo(() => {
    const total = (stats.present || 0) + (stats.absent || 0) + (stats.excused || 0);
    if (total === 0) return [];
    return [
      { name: 'Present', value: stats.present || 0, color: '#10b981' },
      { name: 'Absent', value: stats.absent || 0, color: '#ef4444' },
      { name: 'Excused', value: stats.excused || 0, color: '#f59e0b' },
    ];
  }, [stats]);

  const heatmapData = useMemo(() => {
    if (!analytics.trends?.length) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid = days.map((d) => ({ day: d, weeks: Array(4).fill(0) }));
    analytics.trends.forEach((t) => {
      const d = new Date(t.date);
      const dayIdx = d.getDay();
      const weekIdx = Math.min(3, Math.floor((Date.now() - d.getTime()) / (7 * 86400000)));
      if (grid[dayIdx]) {
        const rate = t.total_members > 0 ? Math.round(((t.present_count || 0) / t.total_members) * 100) : 0;
        grid[dayIdx].weeks[weekIdx] = Math.max(grid[dayIdx].weeks[weekIdx], rate);
      }
    });
    return grid;
  }, [analytics.trends]);

  const retentionData = analytics.retention || {};

  const leaderRankData = useMemo(() => {
    if (!analytics.leaderMetrics?.length) return [];
    return [...analytics.leaderMetrics]
      .sort((a, b) => (b.attendance_rate || 0) - (a.attendance_rate || 0))
      .slice(0, 10);
  }, [analytics.leaderMetrics]);

  const unsubmitted = (stats.total_leaders || 0) - (stats.total_submitted_leaders || 0);

  const handleExportPDF = async () => {
    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF();
      const autoTable = autoTableModule.default;
      doc.setFontSize(18);
      doc.text('Church Attendance Report', 14, 22);
      doc.setFontSize(11);
      doc.text(`${serviceLabel} — ${periodLabel}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

      autoTable(doc, {
        startY: 44,
        head: [['Metric', 'Value']],
        body: [
          ['Submitted Leaders', String(stats.total_submitted_leaders ?? 0)],
          ['Present', String(stats.present ?? 0)],
          ['Absent', String(stats.absent ?? 0)],
          ['Excused', String(stats.excused ?? 0)],
        ],
      });

      if (leaders.length > 0) {
        const tableY = (doc.lastAutoTable?.finalY || 80) + 12;
        autoTable(doc, {
          startY: tableY,
          head: [['Leader', 'Section', 'Submissions', 'Present', 'Absent', 'Excused']],
          body: leaders.map((l) => [
            l.leader_name || 'Unassigned',
            l.section_name || '',
            String(l.submissions_count ?? 0),
            String(l.stats?.present ?? 0),
            String(l.stats?.absent ?? 0),
            String(l.stats?.excused ?? 0),
          ]),
        });
      }
      doc.save(`attendance-report-${filterValue || 'export'}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  const handlePrint = () => window.print();

  const handleCSVExport = () => {
    const headers = ['Leader', 'Section', 'Submissions', 'Present', 'Absent', 'Excused'];
    const rows = leaders.map((l) => [l.leader_name, l.section_name, l.submissions_count, l.stats?.present, l.stats?.absent, l.stats?.excused]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${filterValue || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab();
      case 'trends': return renderTrendsTab();
      case 'sections': return renderSectionsTab();
      case 'leaders': return renderLeadersTab();
      case 'departments': return renderDepartmentsTab();
      case 'members': return renderMembersTab();
      case 'risk': return renderRiskTab();
      case 'distribution': return renderDistributionTab();
      case 'actions': return renderActionsTab();
      default: return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {insights.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Intelligence Summary</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((insight, i) => {
              const Icon = insight.icon;
              const colors = {
                success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300',
                warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/30 text-amber-700 dark:text-amber-300',
                danger: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200/50 dark:border-rose-800/30 text-rose-700 dark:text-rose-300',
                info: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200/50 dark:border-sky-800/30 text-sky-700 dark:text-sky-300',
              };
              return (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${colors[insight.type]}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Present</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.present ?? 0}</p>
          <MiniSparkline data={trendChartData.slice(-7).map((t) => ({ v: t.present }))} color="#10b981" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Absent</p>
          <p className="text-2xl font-bold text-rose-500 dark:text-rose-400">{stats.absent ?? 0}</p>
          <MiniSparkline data={trendChartData.slice(-7).map((t) => ({ v: t.absent }))} color="#ef4444" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Excused</p>
          <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.excused ?? 0}</p>
          <MiniSparkline data={trendChartData.slice(-7).map((t) => ({ v: t.excused }))} color="#f59e0b" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Submitted</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total_submitted_leaders ?? 0}<span className="text-sm font-normal text-slate-400">/{stats.total_leaders ?? 0}</span></p>
          <MiniSparkline data={trendChartData.slice(-7).map((t) => ({ v: t.rate }))} color="#6366f1" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChartCard title="Attendance Rate Trend" subtitle="Last 90 days" height="h-[250px]" icon={TrendingUp}>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="rate" stroke="#6366f1" fill="url(#rateGrad)" strokeWidth={2} name="Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No trend data available</div>
          )}
        </ChartCard>

        <div className="rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-200/40 dark:border-violet-800/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Predictive Analytics</h3>
          </div>
          {analytics.prediction ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Predicted Rate</span>
                <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{analytics.prediction.avg_rate || 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Predicted Present</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{analytics.prediction.avg_present || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Trend</span>
                <Badge variant={analytics.prediction.trend === 'increasing' ? 'success' : analytics.prediction.trend === 'decreasing' ? 'danger' : 'info'}>
                  {analytics.prediction.trend === 'increasing' ? '↑ Increasing' : analytics.prediction.trend === 'decreasing' ? '↓ Decreasing' : '→ Stable'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Weeks Analyzed</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{analytics.prediction.weeks_analyzed || 0}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Prediction data loading...</p>
          )}
        </div>
      </div>

      {sectionBarData.length > 0 && (
        <ChartCard title="Leader Section Overview" subtitle="Attendance by leader this period" height="h-[300px]" icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectionBarData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="excused" name="Excused" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {yoyData.length > 0 && (
        <ChartCard title="Year-over-Year Comparison" subtitle="Monthly attendance rate comparison" height="h-[280px]" icon={Calendar}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yoyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="current" name="Current Year" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="previous" name="Previous Year" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );

  const renderTrendsTab = () => (
    <div className="space-y-6">
      <ChartCard title="Attendance Trends" subtitle="Daily attendance counts over the last 90 days" height="h-[350px]" icon={TrendingUp}>
        {trendChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="present" fill="#10b98120" stroke="#10b981" strokeWidth={2} name="Present" />
              <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Absent" />
              <Line type="monotone" dataKey="excused" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Excused" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">No trend data available</div>
        )}
      </ChartCard>

      {heatmapData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance Heatmap</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">Last 4 weeks by day</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2 text-slate-400 dark:text-slate-500 font-medium">Day</th>
                  <th className="text-center py-1 px-2 text-slate-400 dark:text-slate-500 font-medium">Wk 4</th>
                  <th className="text-center py-1 px-2 text-slate-400 dark:text-slate-500 font-medium">Wk 3</th>
                  <th className="text-center py-1 px-2 text-slate-400 dark:text-slate-500 font-medium">Wk 2</th>
                  <th className="text-center py-1 px-2 text-slate-400 dark:text-slate-500 font-medium">Wk 1</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr key={row.day}>
                    <td className="py-1 px-2 font-medium text-slate-700 dark:text-slate-300">{row.day}</td>
                    {row.weeks.map((val, wi) => {
                      const intensity = Math.min(1, val / 100);
                      const bg = val === 0
                        ? 'bg-slate-100 dark:bg-slate-700'
                        : intensity >= 0.8 ? 'bg-emerald-500 dark:bg-emerald-600'
                        : intensity >= 0.6 ? 'bg-emerald-300 dark:bg-emerald-700'
                        : intensity >= 0.4 ? 'bg-amber-300 dark:bg-amber-700'
                        : 'bg-rose-300 dark:bg-rose-700';
                      const textColor = intensity >= 0.6 ? 'text-white' : 'text-slate-700 dark:text-slate-300';
                      return (
                        <td key={wi} className={`text-center py-1.5 px-2 rounded-md font-semibold ${bg} ${textColor}`}>
                          {val > 0 ? `${val}%` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analytics.prediction && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={TrendingUp} label="Predicted Rate" value={`${analytics.prediction.avg_rate || 0}%`} variant="default" />
          <StatCard icon={Users} label="Predicted Present" value={analytics.prediction.avg_present || 0} variant="success" />
          <StatCard icon={Activity} label="Trend" value={analytics.prediction.trend || 'Stable'} variant={analytics.prediction.trend === 'increasing' ? 'success' : 'warning'} />
          <StatCard icon={Calendar} label="Weeks Analyzed" value={analytics.prediction.weeks_analyzed || 0} variant="info" />
        </div>
      )}
    </div>
  );

  const sectionComparison = analytics.sectionComparison || [];
  const sectionRankings = analytics.sectionRankings || [];

  const sectionComparisonBarData = useMemo(() => {
    if (!sectionComparison.length) return [];
    return sectionComparison.map((s) => ({
      name: s.name?.length > 10 ? s.name.slice(0, 10) + '…' : s.name,
      fullName: s.name,
      rate: s.attendance_rate || 0,
      members: s.member_count || 0,
      present: s.total_present || 0,
      absent: s.total_absent || 0,
      excused: s.total_excused || 0,
      newMembers: s.new_members || 0,
      activeMembers: s.active_members || 0,
    }));
  }, [sectionComparison]);

  const renderSectionsTab = () => (
    <div className="space-y-6">
      {sectionComparisonBarData.length > 0 ? (
        <>
          {/* Section Comparison Bar Chart */}
          <ChartCard title="Section Attendance Comparison" subtitle="Attendance rate by section (last 90 days)" height="h-[350px]" icon={Target}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionComparisonBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value, name) => [`${value}%`, name]} />
                <Bar dataKey="rate" name="Attendance Rate" radius={[6, 6, 0, 0]}>
                  {sectionComparisonBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Section Radar Chart */}
          {sectionComparisonBarData.length <= 8 && (
            <ChartCard title="Section Performance Radar" subtitle="Attendance rate across sections" height="h-[350px]" icon={BarChart3}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={sectionComparisonBarData}>
                  <PolarGrid stroke="rgba(0,0,0,0.06)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Attendance Rate" dataKey="rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value}%`, 'Rate']} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Section Rankings Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Section Rankings
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rank</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Section</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Members</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Present</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Absent</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">New</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rate</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {(sectionRankings.length ? sectionRankings : sectionComparison).map((s, i) => {
                    const rate = s.attendance_rate || 0;
                    return (
                      <tr key={s.id || i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${
                            i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            i === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                            i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                            'text-slate-400 dark:text-slate-500'
                          }`}>{s.rank || i + 1}</span>
                        </td>
                        <td className="py-2.5 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {s.name}
                          {s.is_best && <Badge variant="success" className="ml-2">Best</Badge>}
                          {s.is_lowest && <Badge variant="danger" className="ml-2">Lowest</Badge>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm text-slate-600 dark:text-slate-400">{s.member_count || s.active_members || 0}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{s.total_present || 0}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-rose-500 dark:text-rose-400">{s.total_absent || 0}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-indigo-500 dark:text-indigo-400">{s.new_members || 0}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'}>{rate}%</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {s.consistency_score != null ? (
                            <Badge variant={s.consistency_score >= 70 ? 'success' : s.consistency_score >= 40 ? 'warning' : 'danger'}>{s.consistency_score}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : sectionRadarData.length > 0 ? (
        <>
          <ChartCard title="Section Performance Radar" subtitle="Attendance rate comparison across sections" height="h-[350px]" icon={Target}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={sectionRadarData}>
                <PolarGrid stroke="rgba(0,0,0,0.06)" />
                <PolarAngleAxis dataKey="section" tick={{ fill: '#64748b', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Radar name="Attendance Rate" dataKey="rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Section Leaderboard
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rank</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Leader</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Section</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Submissions</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.slice(0, 10).map((l, i) => {
                    const total = (l.stats?.present || 0) + (l.stats?.absent || 0) + (l.stats?.excused || 0);
                    const rate = total > 0 ? Math.round(((l.stats?.present || 0) / total) * 100) : 0;
                    return (
                      <tr key={l.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => onLeaderClick(l.leader_id)}>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${
                            i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            i === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                            i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                            'text-slate-400 dark:text-slate-500'
                          }`}>{i + 1}</span>
                        </td>
                        <td className="py-2.5 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">{l.leader_name}</td>
                        <td className="py-2.5 px-3 text-sm text-slate-500 dark:text-slate-400">{l.section_name}</td>
                        <td className="py-2.5 px-3 text-right text-sm text-slate-600 dark:text-slate-400">{l.submissions_count}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'}>{rate}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No section data available</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ensure sections have members and attendance records</p>
        </div>
      )}
    </div>
  );

  const renderLeadersTab = () => (
    <div className="space-y-6">
      {leaderRankData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Leader Performance Rankings
          </h3>
          <div className="space-y-2">
            {leaderRankData.map((l, i) => (
              <div key={l.leader_id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onLeaderClick(l.leader_id)}>
                <span className={`text-sm font-bold w-8 h-8 inline-flex items-center justify-center rounded-full shrink-0 ${
                  i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  i === 1 ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200' :
                  i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{l.leader_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{l.section_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{l.attendance_rate || 0}%</p>
                  <p className="text-xs text-slate-400">{l.reporting_days || 0} days</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sectionBarData.length > 0 && (
        <ChartCard title="Leader Submission Breakdown" subtitle="Present vs Absent vs Excused per leader" height="h-[350px]" icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectionBarData} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="fullName" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="present" name="Present" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
              <Bar dataKey="excused" name="Excused" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );

  const renderDepartmentsTab = () => (
    <div className="space-y-6">
      {analytics.demographics && (analytics.demographics.gender?.length > 0 || analytics.demographics.age_group?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {analytics.demographics.gender?.length > 0 && (
            <ChartCard title="Gender Distribution" subtitle="Attendance by gender" height="h-[300px]" icon={Users}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.demographics.gender} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="total_records" nameKey="category_value">
                    {analytics.demographics.gender.map((_, i) => (
                      <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          {analytics.demographics.age_group?.length > 0 && (
            <ChartCard title="Age Group Distribution" subtitle="Attendance by age group" height="h-[300px]" icon={BarChart3}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.demographics.age_group} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="category_value" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="total_records" name="Records" radius={[4, 4, 0, 0]}>
                    {analytics.demographics.age_group.map((_, i) => (
                      <Cell key={i} fill={SECTION_COLORS[(i + 2) % SECTION_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {retentionData.total_new_members > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="New Members" value={retentionData.total_new_members} variant="info" />
          <StatCard icon={CheckCircle2} label="Still Attending" value={retentionData.still_attending} variant="success" />
          <StatCard icon={Target} label="Retention Rate" value={`${retentionData.retention_rate || 0}%`} variant="success" />
          <StatCard icon={Calendar} label="Avg Services" value={Math.round(retentionData.avg_services_attended || 0)} variant="default" />
        </div>
      )}

      {analytics.engagementScores?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Top Engaged Members
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400">Member</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400">Section</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400">Score</th>
                </tr>
              </thead>
              <tbody>
                {analytics.engagementScores.map((m, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">{m.full_name}</td>
                    <td className="py-2 px-3 text-sm text-slate-500">{m.section_name}</td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={m.engagement_score >= 80 ? 'success' : m.engagement_score >= 60 ? 'warning' : 'danger'}>{m.engagement_score}</Badge>
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

  const renderMembersTab = () => (
    <div className="space-y-6">
      {analytics.streaks?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Attendance Streak Champions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {analytics.streaks.slice(0, 10).map((s) => (
              <div key={s.member_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 text-center hover:shadow-md transition-shadow">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.full_name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{s.section_name}</p>
                <div className="mt-2">
                  <Badge variant="success">{s.current_streak} weeks</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.engagementScores?.length > 0 && (
        <ChartCard title="Member Engagement Scores" subtitle="Composite scores based on consistency, streak, and recency" height="h-[300px]" icon={Zap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.engagementScores} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="full_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="engagement_score" name="Score" radius={[4, 4, 0, 0]}>
                {analytics.engagementScores.map((_, i) => (
                  <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );

  const renderRiskTab = () => (
    <div className="space-y-6">
      {analytics.anomalies?.length > 0 ? (
        <ChartCard title="Section Anomaly Detection" subtitle="Sections with significant attendance drops" height="h-[300px]" icon={AlertTriangle}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.anomalies.map((a) => ({ name: a.section_name, historical: a.historical_avg, current: a.latest_rate, drop: a.drop_amount }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="historical" name="Historical Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name="Current Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">No Anomalies Detected</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">All sections are performing within expected ranges.</p>
          </div>
        </div>
      )}

      {analytics.anomalies?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.anomalies.map((a, i) => (
            <div key={i} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.section_name}</h4>
                <Badge variant="danger">-{a.drop_amount}%</Badge>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Historical: {a.historical_avg}%</span>
                <span>Current: {a.latest_rate}%</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full" style={{ width: `${a.drop_amount}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {analytics.streaks?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            At-Risk & Streak Analysis
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{analytics.streaks.length}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Active Streaks</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{analytics.anomalies?.length || 0}</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80">Anomalies</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{analytics.streaks.filter((s) => s.current_streak >= 5).length}</p>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80">5+ Week Streaks</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDistributionTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {distributionData.length > 0 && (
          <ChartCard title="Attendance Distribution" subtitle="Present / Absent / Excused breakdown" height="h-[300px]" icon={Target}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name">
                  {distributionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {sectionBarData.length > 0 && (
          <ChartCard title="Section Distribution" subtitle="Attendance breakdown by section" height="h-[300px]" icon={Layers}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionBarData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="present" name="Present" fill="#10b981" stackId="s" radius={[0, 0, 0, 0]} />
                <Bar dataKey="excused" name="Excused" fill="#f59e0b" stackId="s" />
                <Bar dataKey="absent" name="Absent" fill="#ef4444" stackId="s" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {trendChartData.length > 0 && (
        <ChartCard title="Attendance Volume Over Time" subtitle="Present count daily" height="h-[250px]" icon={Activity}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="present" stroke="#10b981" fill="url(#presentGrad)" strokeWidth={2} name="Present" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );

  const renderActionsTab = () => (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-200/40 dark:border-amber-800/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Action Center</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analytics.anomalies?.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/50 dark:border-amber-800/30">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Follow up on {analytics.anomalies.length} section anomaly/anomalies</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Some sections have significant attendance drops. Reach out to their leaders.</p>
              </div>
            </div>
          )}
          {unsubmitted > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-rose-200/50 dark:border-rose-800/30">
              <Clock className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{unsubmitted} leader(s) haven't submitted</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Send reminders to leaders who haven't reported this period.</p>
              </div>
            </div>
          )}
          {retentionData.retention_rate < 70 && retentionData.total_new_members > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200/50 dark:border-indigo-800/30">
              <Users className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">New member retention at {retentionData.retention_rate}%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Consider a welcome program for recent members.</p>
              </div>
            </div>
          )}
          {(!analytics.anomalies?.length && unsubmitted === 0) && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All clear!</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">No urgent actions needed at this time.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-500" />
          Export Center
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-800/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors text-sm font-medium">
            <FileText className="w-4 h-4" />
            PDF Report
          </button>
          <button onClick={handleCSVExport} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            CSV Export
          </button>
          <button onClick={handlePrint} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200/50 dark:border-sky-800/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors text-sm font-medium">
            <Printer className="w-4 h-4" />
            Print View
          </button>
          <button onClick={() => { loadOverview(); loadAnalytics(); }} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-sm font-medium">
            <Activity className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white shadow-xl shadow-purple-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/5 rounded-full translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Church Intelligence Dashboard</h2>
            <p className="text-white/80 text-sm">{serviceLabel} — {periodLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {serviceTypes.map((service) => (
            <button
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedServiceId === service.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {service.name}
            </button>
          ))}
          <button
            onClick={() => onServiceChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedServiceId === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            All Services
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['weekly', 'monthly', 'yearly'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              filterType === type
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 hover:text-indigo-600'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        <input
          type={filterType === 'yearly' ? 'number' : filterType === 'monthly' ? 'month' : 'week'}
          value={filterValue || ''}
          onChange={(e) => setFilterValue(e.target.value)}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="border-b border-slate-200/60 dark:border-slate-700">
        <div className="flex overflow-x-auto gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {overviewLoading || analyticsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading analytics...</span>
        </div>
      ) : !hasData ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a service and period to view analytics</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Choose from the filters above to get started</p>
        </div>
      ) : (
        renderTabContent()
      )}
    </div>
  );
};

export default AttendanceReports;
