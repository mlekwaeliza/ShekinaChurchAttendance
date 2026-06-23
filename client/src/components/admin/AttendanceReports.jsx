import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle, Target,
  Calendar, Download, Printer, FileText, Activity, Shield, ChevronRight,
  X, Zap, Award, Clock, Eye, Layers, CheckCircle2, Flame, Heart, Brain,
  UserCheck, UserX, Star, Info, ChevronDown, ChevronUp, Search,
  ArrowUp, ArrowDown, Minus, RefreshCw
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import Badge from '../ui/Badge';

const TABS = [
  { id: 'overview', label: 'Executive Summary', icon: Eye },
  { id: 'comparison', label: 'Comparison', icon: ArrowUp },
  { id: 'leaders', label: 'Leader Intelligence', icon: Users },
  { id: 'sections', label: 'Section Intelligence', icon: Layers },
  { id: 'departments', label: 'Department Intel', icon: BarChart3 },
  { id: 'members', label: 'Member Intelligence', icon: UserCheck },
  { id: 'historical', label: 'Historical', icon: Calendar },
  { id: 'insights', label: 'AI Insights', icon: Zap },
  { id: 'actions', label: 'Action Center', icon: Target },
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

const getStatusColor = (label) => {
  switch (label) {
    case 'Excellent': return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' };
    case 'Good': return { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' };
    case 'Warning': return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
    case 'Needs Attention': return { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' };
    default: return { bg: 'bg-slate-50 dark:bg-slate-900/20', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800' };
  }
};

const getStatusLabel = (rate) => {
  if (rate >= 85) return 'Excellent';
  if (rate >= 70) return 'Good';
  if (rate >= 50) return 'Warning';
  return 'Needs Attention';
};

const MetricCard = ({ label, value, previousValue, icon: Icon, color = 'indigo', showDiff = true }) => {
  const diff = showDiff && previousValue != null ? value - previousValue : null;
  const pctDiff = showDiff && previousValue > 0 ? Math.round(((value - previousValue) / previousValue) * 100) : null;
  const status = typeof value === 'number' && !isNaN(value) ? getStatusLabel(value > 100 ? Math.min(value, 100) : value) : 'Good';
  const sc = getStatusColor(status);
  return (
    <div className={`rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
        {Icon && <div className={`w-7 h-7 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center`}><Icon className={`w-3.5 h-3.5 text-${color}-500`} /></div>}
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value ?? '—'}</p>
      {diff != null && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {diff >= 0 ? '+' : ''}{diff}
          </span>
          {pctDiff != null && (
            <span className={`text-[10px] font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ({diff >= 0 ? '+' : ''}{pctDiff}%)
            </span>
          )}
        </div>
      )}
      {previousValue != null && showDiff && (
        <p className="text-[9px] text-slate-400 mt-0.5">Prev: {typeof previousValue === 'number' ? previousValue.toLocaleString() : previousValue}</p>
      )}
      <div className="mt-2">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{status}</span>
      </div>
    </div>
  );
};

const IntelligenceTable = ({ columns, data, onRowClick, emptyMessage = 'No data available' }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortDir]);

  if (!data.length) return <div className="text-center py-12 text-slate-400 text-sm">{emptyMessage}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map(col => (
              <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)}
                className={`py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer hover:text-slate-600' : ''}`}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <React.Fragment key={row.id || i}>
              <tr onClick={() => onRowClick ? onRowClick(row) : setExpandedRow(expandedRow === i ? null : i)}
                className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${onRowClick ? 'cursor-pointer' : ''} ${expandedRow === i ? 'bg-slate-50 dark:bg-slate-700/20' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
              {expandedRow === i && row.expandedContent && (
                <tr><td colSpan={columns.length} className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">{row.expandedContent}</td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InsightCard = ({ insight, index }) => {
  const typeColors = {
    success: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    danger: { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600', iconBg: 'bg-rose-100 dark:bg-rose-900/30' },
    info: { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-800', icon: 'text-sky-600', iconBg: 'bg-sky-100 dark:bg-sky-900/30' },
  };
  const c = typeColors[insight.type] || typeColors.info;
  const Icon = insight.icon || Info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} p-3`}>
      <div className={`w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        </div>
      )}
      {!sectionRankings.length && !sectionComparison.length && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No section attendance data available for the current period. Ensure sections have members with recorded attendance.
        </div>
      )}
    </div>
  );
};

const ActionCard = ({ action }) => {
  const priorityColors = {
    high: 'border-l-rose-500 bg-rose-50/50 dark:bg-rose-900/10',
    medium: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
    low: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10',
  };
  const priorityBadge = {
    high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return (
    <div className={`rounded-xl border-l-4 ${priorityColors[action.priority]} border border-slate-200/60 dark:border-slate-700 p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${priorityBadge[action.priority]}`}>{action.priority}</span>
            {action.category && <span className="text-[9px] text-slate-400">{action.category}</span>}
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-white">{action.title}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{action.description}</p>
        </div>
      </div>
    </div>
  );
};

const AttendanceReports = ({
  filterType, setFilterType, filterValue, setFilterValue,
  overviewData, overviewLoading, serviceTypes = [],
  selectedServiceId, onServiceChange, loadOverview, onLeaderClick,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState({});
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisonMode, setComparisonMode] = useState('week');
  const [historicalPeriod, setHistoricalPeriod] = useState('monthly');
  useEffect(() => { if (filterValue) loadOverview(); }, [filterType, filterValue, selectedServiceId]);
  useEffect(() => { loadAnalytics(); }, [selectedServiceId]);

  const modeToDays = { today: 1, week: 7, month: 30, quarter: 90, year: 365 };

  const toDateStr = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; };

  const getDateRangeForMode = (mode) => {
    const now = new Date();
    switch (mode) {
      case 'today': {
        const yesterday = new Date(now.getTime() - 86400000);
        return { period1Start: toDateStr(now), period1End: toDateStr(now), period2Start: toDateStr(yesterday), period2End: toDateStr(yesterday) };
      }
      case 'week': {
        const dow = now.getDay();
        const monOffset = dow === 0 ? 6 : dow - 1;
        const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - monOffset);
        const sun = new Date(mon.getTime() + 6 * 86400000);
        const prevMon = new Date(mon.getTime() - 7 * 86400000);
        const prevSun = new Date(prevMon.getTime() + 6 * 86400000);
        return { period1Start: toDateStr(mon), period1End: toDateStr(sun), period2Start: toDateStr(prevMon), period2End: toDateStr(prevSun) };
      }
      case 'month': {
        const y = now.getFullYear(), m = now.getMonth();
        return { period1Start: toDateStr(new Date(y, m, 1)), period1End: toDateStr(new Date(y, m + 1, 0)), period2Start: toDateStr(new Date(y, m - 1, 1)), period2End: toDateStr(new Date(y, m, 0)) };
      }
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        return { period1Start: toDateStr(new Date(now.getFullYear(), q * 3, 1)), period1End: toDateStr(new Date(now.getFullYear(), q * 3 + 3, 0)), period2Start: toDateStr(new Date(now.getFullYear(), q * 3 - 3, 1)), period2End: toDateStr(new Date(now.getFullYear(), q * 3, 0)) };
      }
      case 'year':
        return { period1Start: `${now.getFullYear()}-01-01`, period1End: `${now.getFullYear()}-12-31`, period2Start: `${now.getFullYear() - 1}-01-01`, period2End: `${now.getFullYear() - 1}-12-31` };
      default: return null;
    }
  };

  const loadDepartments = async (mode) => {
    setDepartmentsLoading(true);
    try {
      const days = modeToDays[mode] || 30;
      const res = await analyticsAPI.getDepartments(days);
      setDepartmentsData(res.data || []);
    } catch (e) { console.error('Failed to load departments:', e); setDepartmentsData([]); }
    finally { setDepartmentsLoading(false); }
  };

  useEffect(() => { loadDepartments(comparisonMode); }, [comparisonMode]);

  const loadComparisonData = async (mode) => {
    const range = getDateRangeForMode(mode);
    if (!range) return;
    try {
      const res = await analyticsAPI.getComparison(range);
      const d = res.data || {};
      setComparisonData({
        current: { present: d.p1_present || 0, absent: (d.p1_total || 0) - (d.p1_present || 0), excused: 0, rate: d.p1_rate || 0 },
        previous: { present: d.p2_present || 0, absent: (d.p2_total || 0) - (d.p2_present || 0), excused: 0, rate: d.p2_rate || 0 },
      });
    } catch (e) { setComparisonData({}); }
  };

  useEffect(() => { loadComparisonData(comparisonMode); }, [comparisonMode]);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      const startDatePrev90 = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

      const results = await Promise.allSettled([
        adminAPI.getAttendanceTrends(90),
        adminAPI.getAttendancePrediction(),
        adminAPI.getSectionAnomalies(),
        adminAPI.getMemberStreaks(20),
        adminAPI.getLeaderPerformance(startDate90, endDate),
        adminAPI.getLeaderPerformance(startDatePrev90, startDate90),
        analyticsAPI.getDemographics(),
        analyticsAPI.getYearOverYear(),
        analyticsAPI.getRetention(90),
        analyticsAPI.getRetention(180),
        analyticsAPI.getEngagementScores(10),
        analyticsAPI.getDashboardMetrics(selectedServiceId),
        analyticsAPI.getSectionComparison(90),
        analyticsAPI.getSectionRankings(90),
        analyticsAPI.getHistorical({ period: 'monthly' }),
        analyticsAPI.getRiskAnalysis(),
        analyticsAPI.getAIInsights(),
        analyticsAPI.getChurchGrowthIndex(),
        analyticsAPI.getHeadLeaderAnalytics(90),
      ]);

      const ok = i => results[i].status === 'fulfilled' ? results[i].value?.data : null;
      setAnalytics({
        trends: ok(0)?.trends || [], prediction: ok(1), anomalies: ok(2) || [],
        streaks: ok(3) || [], leaderMetrics: ok(4) || [], prevLeaderMetrics: ok(5) || [],
        demographics: ok(6), yearOverYear: ok(7) || [], retention: ok(8) || {},
        prevRetention: ok(9) || {}, engagementScores: ok(10) || [],
        dashboardMetrics: ok(11), sectionComparison: ok(12) || [],
        sectionRankings: ok(13) || [], historical: ok(14),
        risk: ok(15), aiInsights: ok(16) || [], growthIndex: ok(17),
        headLeaders: ok(18) || [],
      });
    } catch (e) { console.error('Failed to load analytics:', e); }
    finally { setAnalyticsLoading(false); }
  };

  const stats = overviewData?.stats || {};
  const leaders = overviewData?.subleaders || [];
  const currentService = serviceTypes.find(s => s.id === selectedServiceId);
  const serviceLabel = selectedServiceId === 'all' ? 'All Services' : (currentService?.name || 'Service');
  const periodLabel = formatPeriodLabel(filterType, filterValue);

  const totalPresent = stats.present || 0;
  const totalAbsent = stats.absent || 0;
  const totalExcused = stats.excused || 0;
  const totalMembers = totalPresent + totalAbsent + totalExcused;
  const attendanceRate = totalMembers > 0 ? Math.round((totalPresent / totalMembers) * 100) : 0;
  const unsubmitted = (stats.total_leaders || 0) - (stats.total_submitted_leaders || 0);
  const leaderSubmissionRate = (stats.total_leaders || 0) > 0 ? Math.round(((stats.total_submitted_leaders || 0) / (stats.total_leaders || 1)) * 100) : 0;

  const sectionComparison = analytics.sectionComparison || [];
  const sectionRankings = analytics.sectionRankings || [];
  const prevLeaderMetrics = analytics.prevLeaderMetrics || [];
  const retention = analytics.retention || {};
  const growthIndex = analytics.growthIndex || {};
  const risk = analytics.risk || {};
  const aiInsights = analytics.aiInsights || [];
  const headLeaders = analytics.headLeaders || [];

  const leaderRankData = useMemo(() => {
    if (!analytics.leaderMetrics?.length) return [];
    return [...analytics.leaderMetrics].sort((a, b) => (b.attendance_rate || 0) - (a.attendance_rate || 0)).slice(0, 20);
  }, [analytics.leaderMetrics]);

  const sectionSummary = useMemo(() => {
    if (!sectionComparison.length) return null;
    const totMembers = totalPresent + totalAbsent + totalExcused;
    return {
      totalSections: sectionComparison.length,
      totalMembers: totMembers,
      totalPresent,
      totalAbsent,
      totalExcused,
      avgRate: totMembers > 0 ? Math.round((totalPresent / totMembers) * 100) : 0,
    };
  }, [sectionComparison, totalPresent, totalAbsent, totalExcused]);

  const insights = useMemo(() => {
    const list = [];
    if (attendanceRate >= 80) list.push({ type: 'success', text: `Strong attendance rate of ${attendanceRate}% this period. The congregation is engaged.`, icon: CheckCircle2 });
    else if (attendanceRate < 60) list.push({ type: 'danger', text: `Attendance rate dropped to ${attendanceRate}%. Consider outreach to inactive members.`, icon: AlertTriangle });

    if (analytics.prediction?.trend === 'increasing') list.push({ type: 'success', text: `Attendance is trending upward over the last ${analytics.prediction.weeks_analyzed || 0} weeks.`, icon: TrendingUp });
    else if (analytics.prediction?.trend === 'decreasing') list.push({ type: 'warning', text: 'Attendance trend is declining. Review recent changes in scheduling or engagement.', icon: TrendingDown });

    if (unsubmitted > 0) list.push({ type: 'info', text: `${unsubmitted} leader(s) have not submitted attendance this period.`, icon: Clock });

    if (leaderRankData.length > 0 && leaderRankData[0].attendance_rate >= 90) {
      list.push({ type: 'success', text: `${leaderRankData[0].leader_name} leads with ${leaderRankData[0].attendance_rate}% section attendance.`, icon: Award });
    }

    if (sectionComparison.length > 0) {
      const best = sectionComparison[0];
      const worst = sectionComparison[sectionComparison.length - 1];
      if (best?.attendance_rate >= 80) list.push({ type: 'success', text: `${best.name} is the top-performing section with ${best.attendance_rate}% attendance.`, icon: Star });
      if (worst?.attendance_rate < 60) list.push({ type: 'danger', text: `${worst.name} needs attention with only ${worst.attendance_rate}% attendance.`, icon: AlertTriangle });
      const lowSections = sectionComparison.filter(s => s.attendance_rate < 60);
      if (lowSections.length > 1) list.push({ type: 'warning', text: `${lowSections.length} sections have attendance below 60%. Consider targeted outreach.`, icon: Heart });
    }

    if (analytics.streaks?.length > 0) {
      const atRisk = analytics.streaks.filter(s => s.consecutive_absences >= 3);
      if (atRisk.length > 0) list.push({ type: 'danger', text: `${atRisk.length} member(s) have missed 3+ consecutive services and require follow-up.`, icon: UserX });
    }

    if (retention.retention_rate != null) {
      const rr = retention.retention_rate;
      if (rr >= 80) list.push({ type: 'success', text: `Member retention rate is strong at ${rr}%.`, icon: Shield });
      else if (rr < 60) list.push({ type: 'warning', text: `Member retention rate is ${rr}%. Consider re-engagement strategies.`, icon: AlertTriangle });
    }

    if (aiInsights.length > 0) {
      aiInsights.slice(0, 3).forEach(ins => list.push({ type: ins.type || 'info', text: ins.text || ins.message, icon: ins.icon || Info }));
    }

    return list.slice(0, 12);
  }, [attendanceRate, analytics.prediction, unsubmitted, leaderRankData, sectionComparison, analytics.streaks, retention, aiInsights]);

  const actions = useMemo(() => {
    const list = [];
    if (unsubmitted > 0) list.push({ priority: 'high', category: 'Submission', title: 'Remind Leaders to Submit', description: `${unsubmitted} leader(s) have not submitted attendance. Send reminders immediately.` });
    const atRiskLeaders = leaderRankData.filter(l => l.attendance_rate < 60);
    atRiskLeaders.forEach(l => list.push({ priority: 'high', category: 'Performance', title: `Follow up with ${l.leader_name}`, description: `Section attendance at ${l.attendance_rate}%. Requires pastoral intervention.` }));
    const lowSections = sectionComparison.filter(s => s.attendance_rate < 60);
    lowSections.forEach(s => list.push({ priority: 'medium', category: 'Section', title: `Address ${s.name}`, description: `Only ${s.attendance_rate}% attendance. Review section engagement strategies.` }));
    const topLeaders = leaderRankData.filter(l => l.attendance_rate >= 90);
    topLeaders.slice(0, 3).forEach(l => list.push({ priority: 'low', category: 'Recognition', title: `Congratulate ${l.leader_name}`, description: `Outstanding ${l.attendance_rate}% attendance rate. Consider for recognition.` }));
    if (analytics.streaks?.length > 0) {
      const inactive = analytics.streaks.filter(s => s.consecutive_absences >= 4);
      if (inactive.length > 0)       list.push({ priority: 'high', category: 'Follow-up', title: `Visit ${inactive.length} Inactive Members`, description: 'Members with 4+ consecutive absences need pastoral visitation.' });
    }
    if (leaderSubmissionRate < 80) list.push({ priority: 'medium', category: 'Process', title: 'Improve Leader Submission Rate', description: `Current rate is ${leaderSubmissionRate}%. Set up automated reminders.` });
    if (attendanceRate < 70) list.push({ priority: 'high', category: 'Engagement', title: 'Develop Attendance Improvement Plan', description: `Current rate is ${attendanceRate}%. Organize outreach and engagement activities.` });
    return list;
  }, [unsubmitted, leaderRankData, sectionComparison, analytics.streaks, leaderSubmissionRate, attendanceRate]);

  const handleExportPDF = async () => {
    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF();
      const autoTable = autoTableModule.default;
      doc.setFontSize(18); doc.text('Church Attendance Intelligence Report', 14, 22);
      doc.setFontSize(11); doc.text(`${serviceLabel} - ${periodLabel}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
      autoTable(doc, { startY: 44, head: [['Metric', 'Value']], body: [
        ['Attendance Rate', `${attendanceRate}%`], ['Present', String(totalPresent)], ['Absent', String(totalAbsent)],
        ['Excused', String(totalExcused)], ['Total Members', String(totalMembers)],
        ['Leader Submission Rate', `${leaderSubmissionRate}%`],
      ]});
      doc.save(`attendance-intelligence-${filterValue || 'export'}.pdf`);
    } catch (e) { console.error('PDF export failed:', e); }
  };

  const handleCSVExport = () => {
    const headers = ['Leader', 'Section', 'Submissions', 'Present', 'Absent', 'Excused', 'Rate'];
    const rows = leaders.map(l => {
      const t = (l.stats?.present || 0) + (l.stats?.absent || 0) + (l.stats?.excused || 0);
      return [l.leader_name, l.section_name, l.submissions_count, l.stats?.present, l.stats?.absent, l.stats?.excused, t > 0 ? Math.round(((l.stats?.present || 0) / t) * 100) : 0];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance-${filterValue || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab();
      case 'comparison': return renderComparisonTab();
      case 'leaders': return renderLeadersTab();
      case 'sections': return renderSectionsTab();
      case 'departments': return renderDepartmentsTab();
      case 'members': return renderMembersTab();
      case 'historical': return renderHistoricalTab();
      case 'insights': return renderInsightsTab();
      case 'actions': return renderActionsTab();
      default: return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => {
    const healthScore = growthIndex.growth_index || 0;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"><Heart className="w-6 h-6 text-white" /></div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Church Health Score</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Overall church performance indicator</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${healthScore >= 75 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{healthScore}</span>
                <span className="text-xs text-slate-400">/100</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${healthScore >= 75 ? 'bg-emerald-50 text-emerald-700' : healthScore >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                {healthScore >= 75 ? 'Healthy' : healthScore >= 50 ? 'Needs Improvement' : 'Critical'}
              </span>
            </div>
          </div>
          <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${healthScore}%`, background: healthScore >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : healthScore >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Members" value={totalMembers} icon={Users} color="indigo" showDiff={false} />
          <MetricCard label="Total Present" value={totalPresent} icon={CheckCircle2} color="emerald" showDiff={false} />
          <MetricCard label="Total Absent" value={totalAbsent} icon={UserX} color="rose" showDiff={false} />
          <MetricCard label="Total Excused" value={totalExcused} icon={AlertTriangle} color="amber" showDiff={false} />
          <MetricCard label="Attendance Rate" value={attendanceRate} icon={Activity} color="indigo" showDiff={false} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Leaders Submitted" value={stats.total_submitted_leaders || 0} icon={Users} color="emerald" showDiff={false} />
          <MetricCard label="Leader Submission Rate" value={leaderSubmissionRate} icon={Target} color="sky" showDiff={false} />
          <MetricCard label="Unsubmitted Leaders" value={unsubmitted} icon={Clock} color={unsubmitted > 0 ? 'rose' : 'emerald'} showDiff={false} />
          <MetricCard label="Retention Rate" value={retention.retention_rate || 0} icon={Shield} color="violet" showDiff={false} />
          <MetricCard label="Health Score" value={healthScore} icon={Heart} color={healthScore >= 75 ? 'emerald' : healthScore >= 50 ? 'amber' : 'rose'} showDiff={false} />
        </div>

        {insights.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-5">
            <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Intelligence Summary</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {insights.map((insight, i) => <InsightCard key={i} insight={insight} index={i} />)}
            </div>
          </div>
        )}

        {sectionSummary && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Section Performance Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Sections', value: sectionSummary.totalSections, color: 'indigo' },
                { label: 'Total Members', value: sectionSummary.totalMembers, color: 'slate' },
                { label: 'Total Present', value: sectionSummary.totalPresent, color: 'emerald' },
                { label: 'Total Absent', value: sectionSummary.totalAbsent, color: 'rose' },
                { label: 'Total Excused', value: sectionSummary.totalExcused, color: 'amber' },
                { label: 'Avg Rate', value: `${sectionSummary.avgRate}%`, color: 'indigo' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">{s.label}</p>
                  <p className={`text-lg font-bold text-${s.color}-600 dark:text-${s.color}-400`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {headLeaders.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Head Leader Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {headLeaders.slice(0, 4).map(hl => (
                <div key={hl.leader_id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs">{hl.leader_name?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{hl.leader_name}</p>
                    <p className="text-[10px] text-slate-400">{hl.section_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{hl.overall_attendance || 0}%</p>
                    <p className="text-[9px] text-slate-400">{hl.leaders_supervised || 0} leaders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderComparisonTab = () => {
    const comp = comparisonData || {};
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {['today', 'week', 'month', 'quarter', 'year'].map(m => (
            <button key={m} onClick={() => setComparisonMode(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${comparisonMode === m ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {comp.current ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Present', current: comp.current.present, previous: comp.previous?.present, color: 'emerald' },
                { label: 'Absent', current: comp.current.absent, previous: comp.previous?.absent, color: 'rose' },
                { label: 'Excused', current: comp.current.excused, previous: comp.previous?.excused, color: 'amber' },
                { label: 'Attendance %', current: comp.current.rate, previous: comp.previous?.rate, color: 'indigo', suffix: '%' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1">{item.label}</p>
                  <p className={`text-2xl font-bold text-${item.color}-600 dark:text-${item.color}-400`}>{item.current ?? '—'}{item.suffix || ''}</p>
                  {item.previous != null && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] font-semibold ${(item.current - item.previous) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(item.current - item.previous) >= 0 ? '+' : ''}{item.current - item.previous}{item.suffix || ''}
                      </span>
                      <span className="text-[9px] text-slate-400">vs prev</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Select a comparison period to view analytics
          </div>
        )}

        {departmentsData.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Department Performance Comparison</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{comparisonMode.charAt(0).toUpperCase() + comparisonMode.slice(1)} period comparison</p>
            </div>
            <IntelligenceTable
              columns={[
                { key: 'rank', label: '#', render: (_, __, i) => <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span> },
                { key: 'name', label: 'Department', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
                { key: 'member_count', label: 'Members', align: 'right' },
                { key: 'total_present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600 font-medium">{v}</span> },
                { key: 'total_absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v}</span> },
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{v}%</Badge> },
              ]}
              data={departmentsData}
            />
          </div>
        )}
      </div>
    );
  };

  const renderLeadersTab = () => (
    <div className="space-y-6">
      {selectedLeader && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">{selectedLeader.leader_name?.charAt(0)}</div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedLeader.leader_name}</h3>
                <p className="text-xs text-slate-500">{selectedLeader.section_name} Section Leader</p>
              </div>
            </div>
            <button onClick={() => setSelectedLeader(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Attendance Rate" value={selectedLeader.attendance_rate || 0} icon={Activity} color="indigo" showDiff={false} />
            <MetricCard label="Members" value={selectedLeader.member_count || 0} icon={Users} color="sky" showDiff={false} />
            <MetricCard label="Submissions" value={selectedLeader.submissions_count || 0} icon={FileText} color="emerald" showDiff={false} />
            <MetricCard label="Performance Score" value={selectedLeader.performance_score || 0} icon={Award} color="amber" showDiff={false} />
          </div>
        </div>
      )}

      {leaderRankData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leader Performance Intelligence</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Ranked by attendance rate with performance scores</p>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'rank', label: '#', render: (_, __, i) => <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span> },
              { key: 'leader_name', label: 'Leader', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'section_name', label: 'Section' },
              { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{v}%</Badge> },
              { key: 'submissions_count', label: 'Submissions', align: 'right' },
              { key: 'member_count', label: 'Members', align: 'right' },
              { key: 'efficiency_score', label: 'Score', align: 'right', render: v => <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v >= 75 ? 'bg-emerald-100 text-emerald-700' : v >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{v}</span> },
            ]}
            data={leaderRankData}
            onRowClick={(row) => setSelectedLeader(row)}
          />
        </div>
      )}

      {analytics.anomalies?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Section Anomalies</h3>
          <div className="space-y-2">
            {analytics.anomalies.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                <span className="text-xs font-medium text-slate-900 dark:text-white">{a.section_name}</span>
                <span className="text-xs font-bold text-rose-600">-{a.drop_amount}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSectionsTab = () => (
    <div className="space-y-6">
      {sectionSummary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Sections" value={sectionSummary.totalSections} icon={Layers} color="indigo" showDiff={false} />
          <MetricCard label="Total Members" value={sectionSummary.totalMembers} icon={Users} color="slate" showDiff={false} />
          <MetricCard label="Total Present" value={sectionSummary.totalPresent} icon={CheckCircle2} color="emerald" showDiff={false} />
          <MetricCard label="Total Absent" value={sectionSummary.totalAbsent} icon={UserX} color="rose" showDiff={false} />
          <MetricCard label="Total Excused" value={sectionSummary.totalExcused} icon={AlertTriangle} color="amber" showDiff={false} />
          <MetricCard label="Avg Rate" value={`${sectionSummary.avgRate}%`} icon={Activity} color="indigo" showDiff={false} />
        </div>
      )}

      {sectionRankings.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Intelligence Report</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Ranked by attendance rate with consistency and growth metrics</p>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'rank', label: 'Rank', render: (v, row, i) => (
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{v || i + 1}</span>
                  {row.rank_change > 0 && <ArrowUp className="w-3 h-3 text-emerald-500" />}
                  {row.rank_change < 0 && <ArrowDown className="w-3 h-3 text-rose-500" />}
                </div>
              )},
              { key: 'name', label: 'Section', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'member_count', label: 'Members', align: 'right' },
              { key: 'total_present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600 font-medium">{v?.toLocaleString()}</span> },
              { key: 'total_absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v?.toLocaleString()}</span> },
              { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{v}%</Badge> },
              { key: 'new_members', label: 'New', align: 'right', render: v => <span className="text-indigo-500">{v}</span> },
              { key: 'consistency_score', label: 'Consistency', align: 'right', render: v => v != null ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v >= 70 ? 'bg-emerald-100 text-emerald-700' : v >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{v}</span> : <span className="text-slate-300">—</span> },
            ]}
            data={sectionRankings}
            onRowClick={(row) => setSelectedSection(row)}
          />
        </div>
      )}
      {!sectionRankings.length && !sectionComparison.length && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No section attendance data available for the current period.
        </div>
      )}
    </div>
  );

  const renderDepartmentsTab = () => {
    const depts = analytics.dashboardMetrics?.departments || [];
    return (
      <div className="space-y-6">
        {depts.length > 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Department Attendance Intelligence</h3>
            </div>
            <IntelligenceTable
              columns={[
                { key: 'rank', label: '#', render: (_, __, i) => <span className="text-xs font-bold text-slate-400">#{i + 1}</span> },
                { key: 'name', label: 'Department', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
                { key: 'member_count', label: 'Members', align: 'right' },
                { key: 'present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600">{v}</span> },
                { key: 'absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v}</span> },
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{v}%</Badge> },
              ]}
              data={depts}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Department data not available for current filter
          </div>
        )}
      </div>
    );
  };

  const renderMembersTab = () => (
    <div className="space-y-6">
      {analytics.demographics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Male', value: analytics.demographics.gender?.male || 0, color: 'sky' },
            { label: 'Female', value: analytics.demographics.gender?.female || 0, color: 'pink' },
            { label: 'Youth', value: analytics.demographics.age_groups?.youth || 0, color: 'violet' },
            { label: 'Adults', value: analytics.demographics.age_groups?.adults || 0, color: 'emerald' },
          ].map(d => <MetricCard key={d.label} label={d.label} value={d.value} icon={Users} color={d.color} showDiff={false} />)}
        </div>
      )}

      {analytics.streaks?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Attendance Streaks</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Members with consecutive attendance or absence patterns</p>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'full_name', label: 'Member', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'section_name', label: 'Section' },
              { key: 'leader_name', label: 'Leader' },
              { key: 'consecutive_present', label: 'Streak', align: 'right', render: v => <span className="font-bold text-emerald-600">{v}</span> },
              { key: 'consecutive_absences', label: 'Absences', align: 'right', render: v => <span className={`font-bold ${v >= 3 ? 'text-rose-600' : 'text-slate-500'}`}>{v}</span> },
              { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{v}%</Badge> },
            ]}
            data={analytics.streaks}
          />
        </div>
      )}

      {analytics.engagementScores?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top Engagement Scores</h3>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'rank', label: '#', render: (_, __, i) => <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i < 3 ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{i + 1}</span> },
              { key: 'full_name', label: 'Member', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'section_name', label: 'Section' },
              { key: 'engagement_score', label: 'Score', align: 'right', render: v => <span className="font-bold text-indigo-600">{v}</span> },
              { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <span className="font-bold">{v}%</span> },
            ]}
            data={analytics.engagementScores}
          />
        </div>
      )}
    </div>
  );

  const renderHistoricalTab = () => {
    const hist = analytics.historical || {};
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(p => (
            <button key={p} onClick={() => setHistoricalPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${historicalPeriod === p ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Highest Attendance" value={hist.highest || 0} icon={TrendingUp} color="emerald" showDiff={false} />
          <MetricCard label="Lowest Attendance" value={hist.lowest || 0} icon={TrendingDown} color="rose" showDiff={false} />
          <MetricCard label="Average Attendance" value={hist.average || 0} icon={Activity} color="indigo" showDiff={false} />
          <MetricCard label="Total Records" value={hist.total_records || 0} icon={FileText} color="slate" showDiff={false} />
          <MetricCard label="Attendance Rate" value={`${hist.avg_rate || 0}%`} icon={Target} color="sky" showDiff={false} />
        </div>

        {analytics.trends?.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historical Attendance Records</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Date', 'Present', 'Absent', 'Excused', 'Total', 'Rate'].map(h => (
                      <th key={h} className={`py-2 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.trends.slice(0, 60).map((t, i) => {
                    const total = (t.present_count || 0) + (t.absent_count || 0) + (t.excused_count || 0);
                    const rate = t.total_members > 0 ? Math.round(((t.present_count || 0) / t.total_members) * 100) : 0;
                    return (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2 px-3 text-left font-medium text-slate-900 dark:text-white">{t.date}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{t.present_count}</td>
                        <td className="py-2 px-3 text-right text-rose-500">{t.absent_count}</td>
                        <td className="py-2 px-3 text-right text-amber-500">{t.excused_count}</td>
                        <td className="py-2 px-3 text-right font-medium">{total}</td>
                        <td className="py-2 px-3 text-right"><Badge variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'}>{rate}%</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {analytics.yearOverYear?.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Year-over-Year Comparison</h3>
            </div>
            <IntelligenceTable
              columns={[
                { key: 'month_name', label: 'Month' },
                { key: 'current_rate', label: 'Current', align: 'right', render: v => <span className="font-bold">{v}%</span> },
                { key: 'previous_rate', label: 'Previous', align: 'right', render: v => <span className="text-slate-500">{v}%</span> },
                { key: 'difference', label: 'Difference', align: 'right', render: v => <span className={`font-bold ${v >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{v >= 0 ? '+' : ''}{v}%</span> },
              ]}
              data={analytics.yearOverYear}
            />
          </div>
        )}
      </div>
    );
  };

  const renderInsightsTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Zap className="w-5 h-5 text-indigo-600" />AI Executive Insights</h3>
      {insights.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Brain className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No insights available for current data
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight, i) => <InsightCard key={i} insight={insight} index={i} />)}
        </div>
      )}

      {analytics.prediction && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Predictive Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Predicted Rate" value={`${analytics.prediction.predicted_rate || 0}%`} icon={TrendingUp} color="indigo" showDiff={false} />
            <MetricCard label="Trend" value={analytics.prediction.trend || 'Stable'} icon={Activity} color={analytics.prediction.trend === 'increasing' ? 'emerald' : 'amber'} showDiff={false} />
            <MetricCard label="Weeks Analyzed" value={analytics.prediction.weeks_analyzed || 0} icon={Calendar} color="sky" showDiff={false} />
            <MetricCard label="Confidence" value={`${analytics.prediction.confidence || 0}%`} icon={Shield} color="violet" showDiff={false} />
          </div>
        </div>
      )}
    </div>
  );

  const renderActionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Executive Action Center</h3>
          <p className="text-xs text-slate-400 mt-0.5">Prioritized tasks based on attendance intelligence</p>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          All actions completed. No pending tasks.
        </div>
      ) : (
        <>
          {actions.filter(a => a.priority === 'high').length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-rose-600 mb-2 flex items-center gap-1"><Flame className="w-3 h-3" /> High Priority ({actions.filter(a => a.priority === 'high').length})</h4>
              <div className="space-y-2">{actions.filter(a => a.priority === 'high').map((a, i) => <ActionCard key={i} action={a} />)}</div>
            </div>
          )}
          {actions.filter(a => a.priority === 'medium').length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-amber-600 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Medium Priority ({actions.filter(a => a.priority === 'medium').length})</h4>
              <div className="space-y-2">{actions.filter(a => a.priority === 'medium').map((a, i) => <ActionCard key={i} action={a} />)}</div>
            </div>
          )}
          {actions.filter(a => a.priority === 'low').length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-emerald-600 mb-2 flex items-center gap-1"><Award className="w-3 h-3" /> Recognition & Low Priority ({actions.filter(a => a.priority === 'low').length})</h4>
              <div className="space-y-2">{actions.filter(a => a.priority === 'low').map((a, i) => <ActionCard key={i} action={a} />)}</div>
            </div>
          )}
        </>
      )}

      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Export Center</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'PDF Report', icon: FileText, action: handleExportPDF, color: 'rose' },
            { label: 'CSV Export', icon: Download, action: handleCSVExport, color: 'emerald' },
            { label: 'Print View', icon: Printer, action: handlePrint, color: 'sky' },
            { label: 'Refresh Data', icon: RefreshCw, action: () => { loadOverview(); loadAnalytics(); }, color: 'indigo' },
          ].map(exp => (
            <button key={exp.label} onClick={exp.action}
              className={`flex items-center gap-2 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-${exp.color}-50 dark:hover:bg-${exp.color}-900/20 transition-all text-left`}>
              <exp.icon className={`w-4 h-4 text-${exp.color}-500`} />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{exp.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-5 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Eye className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold">Executive Attendance Intelligence</h2>
              <p className="text-white/80 text-xs">Numbers-first business intelligence for strategic decisions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
              <input type="text" placeholder="Search members, leaders, sections..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/20 border border-white/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:bg-white/30 w-48" />
            </div>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterValue(''); }}
              className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none">
              <option value="weekly" className="text-slate-900">Weekly</option>
              <option value="monthly" className="text-slate-900">Monthly</option>
              <option value="yearly" className="text-slate-900">Yearly</option>
            </select>
            <input type="date" value={filterValue || ''} onChange={e => setFilterValue(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {(analyticsLoading || overviewLoading) ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        renderTabContent()
      )}
    </div>
  );
};

export default AttendanceReports;
