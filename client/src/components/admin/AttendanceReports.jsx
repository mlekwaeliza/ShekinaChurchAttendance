import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle, Target,
  Calendar, Download, Printer, FileText, Activity, Shield,
  X, Zap, Award, Clock, Eye, Layers, CheckCircle2, Flame, Heart, Brain,
  UserCheck, UserX, Star, Info, ChevronDown, ChevronUp, Search,
  ArrowUp, ArrowDown, Minus, RefreshCw, Building2, PieChart
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import Badge from '../ui/Badge';

const R = v => Math.round(Number(v) || 0);

const TABS = [
  { id: 'overview', label: 'Executive Summary', icon: Eye },
  { id: 'comparison', label: 'Comparison Center', icon: ArrowUp },
  { id: 'sections', label: 'Section Performance', icon: Layers },
  { id: 'head-leaders', label: 'Head Leaders', icon: Award },
  { id: 'leaders', label: 'Section Leaders', icon: Users },
  { id: 'departments', label: 'Department Report', icon: Building2 },
  { id: 'members', label: 'Member Intelligence', icon: UserCheck },
  { id: 'historical', label: 'Historical Reports', icon: Calendar },
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

const MetricCard = ({ label, value, previousValue, icon: Icon, color = 'indigo', showDiff = true, suffix = '' }) => {
  const num = typeof value === 'number' ? value : (Number(value) || 0);
  const prevNum = typeof previousValue === 'number' ? previousValue : (Number(previousValue) || 0);
  const diff = showDiff && previousValue != null ? num - prevNum : null;
  const pctDiff = showDiff && prevNum > 0 ? Math.round(((num - prevNum) / prevNum) * 100) : null;
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {Icon && <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-slate-500" /></div>}
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{suffix === '%' ? R(num) : num.toLocaleString()}{suffix}</p>
      {diff != null && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {diff >= 0 ? '+' : ''}{diff.toLocaleString()}{suffix}
          </span>
          {pctDiff != null && (
            <span className={`text-[10px] font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>({diff >= 0 ? '+' : ''}{pctDiff}%)</span>
          )}
        </div>
      )}
      {previousValue != null && showDiff && (
        <p className="text-[9px] text-slate-400 mt-0.5">Prev: {prevNum.toLocaleString()}{suffix}</p>
      )}
    </div>
  );
};

const IntelligenceTable = ({ columns, data, onRowClick, emptyMessage = 'No data available' }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

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
                className={`py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer hover:text-slate-600' : ''}`}>
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
            <tr key={row.id || i} onClick={() => onRowClick ? onRowClick(row) : null}
              className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${onRowClick ? 'cursor-pointer' : ''}`}>
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}>
                  {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
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
      <p className="text-xs text-slate-700 dark:text-slate-300">{typeof insight.text === 'string' ? insight.text : String(insight.text ?? '')}</p>
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
  const [compError, setCompError] = useState(null);
  const [historicalData, setHistoricalData] = useState({});
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisonMode, setComparisonMode] = useState('week');
  const [compType, setCompType] = useState('sections');
  const [compPeriod, setCompPeriod] = useState('month');
  const [historicalPeriod, setHistoricalPeriod] = useState('monthly');
  const [customDate1, setCustomDate1] = useState('');
  const [customDate2, setCustomDate2] = useState('');
  const [p1Start, setP1Start] = useState('');
  const [p1End, setP1End] = useState('');
  const [p2Start, setP2Start] = useState('');
  const [p2End, setP2End] = useState('');

  useEffect(() => { if (filterValue) loadOverview(); }, [filterType, filterValue, selectedServiceId]);
  useEffect(() => { loadAnalytics(); }, [selectedServiceId]);

  const modeToDays = { today: 1, week: 7, month: 30, quarter: 90, year: 365, custom: 30 };
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
      case 'custom':
        return p1Start && p1End && p2Start && p2End ? { period1Start: p1Start, period1End: p1End, period2Start: p2Start, period2End: p2End } : null;
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

  const getCompDates = (period) => {
    const now = new Date();
    let cStart, cEnd, pStart, pEnd;
    switch (period) {
      case 'week': {
        const dow = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const pMon = new Date(mon); pMon.setDate(mon.getDate() - 7);
        const pSun = new Date(sun); pSun.setDate(sun.getDate() - 7);
        cStart = toDateStr(mon); cEnd = toDateStr(sun); pStart = toDateStr(pMon); pEnd = toDateStr(pSun);
        break;
      }
      case 'month': {
        const y = now.getFullYear(), m = now.getMonth();
        cStart = toDateStr(new Date(y, m, 1)); cEnd = toDateStr(new Date(y, m + 1, 0));
        pStart = toDateStr(new Date(y, m - 1, 1)); pEnd = toDateStr(new Date(y, m, 0));
        break;
      }
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        cStart = toDateStr(new Date(now.getFullYear(), q * 3, 1));
        cEnd = toDateStr(new Date(now.getFullYear(), q * 3 + 3, 0));
        pStart = toDateStr(new Date(now.getFullYear(), q * 3 - 3, 1));
        pEnd = toDateStr(new Date(now.getFullYear(), q * 3, 0));
        break;
      }
      case 'year': {
        cStart = `${now.getFullYear()}-01-01`; cEnd = `${now.getFullYear()}-12-31`;
        pStart = `${now.getFullYear() - 1}-01-01`; pEnd = `${now.getFullYear() - 1}-12-31`;
        break;
      }
      case 'custom': {
        if (p1Start && p1End && p2Start && p2End) {
          cStart = p1Start; cEnd = p1End; pStart = p2Start; pEnd = p2End;
        } else return null;
        break;
      }
      default: return null;
    }
    return { cStart, cEnd, pStart, pEnd };
  };

  const loadComparisonData = async () => {
    const dates = getCompDates(compPeriod);
    if (!dates) return;
    setAnalyticsLoading(true);
    setCompError(null);
    try {
      if (compType === 'overall') {
        const res = await analyticsAPI.getComparison({
          period1Start: dates.cStart, period1End: dates.cEnd,
          period2Start: dates.pStart, period2End: dates.pEnd,
        });
        const d = res.data || {};
        setComparisonData({
          type: 'overall',
          current: {
            present: d.p1_present || 0, absent: d.p1_absent || 0, excused: d.p1_excused || 0,
            total: d.p1_total || 0, records: d.p1_records || 0, rate: d.p1_rate || 0,
            serviceDays: d.p1_service_days || 0, leadersSubmitted: d.p1_leaders_submitted || 0,
            activeSections: d.p1_active_sections || 0,
          },
          previous: {
            present: d.p2_present || 0, absent: d.p2_absent || 0, excused: d.p2_excused || 0,
            total: d.p2_total || 0, records: d.p2_records || 0, rate: d.p2_rate || 0,
            serviceDays: d.p2_service_days || 0, leadersSubmitted: d.p2_leaders_submitted || 0,
            activeSections: d.p2_active_sections || 0,
          },
          totalLeaders: d.total_leaders || 0, dates,
        });
      } else if (compType === 'sections') {
        const [curRes, prevRes] = await Promise.all([
          analyticsAPI.getSectionComparison(365, dates.cStart, dates.cEnd),
          analyticsAPI.getSectionComparison(365, dates.pStart, dates.pEnd),
        ]);
        setComparisonData({ type: 'sections', currentList: curRes.data || [], previousList: prevRes.data || [], dates });
      } else if (compType === 'leaders') {
        const [curRes, prevRes] = await Promise.all([
          analyticsAPI.getLeaderTrends({ start_date: dates.cStart, end_date: dates.cEnd }),
          analyticsAPI.getLeaderTrends({ start_date: dates.pStart, end_date: dates.pEnd }),
        ]);
        setComparisonData({ type: 'leaders', currentList: curRes.data || [], previousList: prevRes.data || [], dates });
      } else if (compType === 'departments') {
        const [curRes, prevRes] = await Promise.all([
          analyticsAPI.getDepartments(365, dates.cStart, dates.cEnd),
          analyticsAPI.getDepartments(365, dates.pStart, dates.pEnd),
        ]);
        setComparisonData({ type: 'departments', currentList: curRes.data || [], previousList: prevRes.data || [], dates });
      } else if (compType === 'daily') {
        const res = await analyticsAPI.getHistorical({ startDate: dates.cStart, endDate: dates.cEnd });
        const daily = (res.data?.daily || []).map(r => ({
          date: r.date, present: r.present || 0, absent: r.absent || 0,
          excused: r.excused || 0, total: r.total || 0, rate: r.rate || 0,
        }));
        setComparisonData({ type: 'daily', daily, dates });
      }
    } catch (e) { console.error('Comparison load error:', e.message, e); setCompError(e.message || 'Failed to load comparison data'); setComparisonData({}); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { loadComparisonData(); }, [compType, compPeriod, p1Start, p1End, p2Start, p2End]);

  const modeToMonths = { daily: 1, weekly: 3, monthly: 12, quarterly: 24, yearly: 60 };

  const loadHistoricalData = async (period) => {
    const months = modeToMonths[period] || 12;
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - months, 1);
    try {
      const res = await analyticsAPI.getHistorical({ startDate: toDateStr(start), endDate: toDateStr(end) });
      const d = res.data || {};
      const s = d.stats || {};
      const daily = (d.daily || []).map(r => ({
        date: r.date, present_count: r.present || 0,
        absent_count: r.absent || 0, excused_count: r.excused || 0,
        total_members: r.total || 0, rate: r.rate || 0,
      }));
      setHistoricalData({
        highest: s.highest_attendance || 0, lowest: s.lowest_attendance || 0,
        average: s.total_records > 0 ? Math.round((s.highest_attendance + s.lowest_attendance) / 2) : 0,
        total_records: s.total_records || 0, avg_rate: s.avg_rate || 0,
        daily,
      });
    } catch (e) { setHistoricalData({}); }
  };

  useEffect(() => { loadHistoricalData(historicalPeriod); }, [historicalPeriod]);

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
        sectionRankings: ok(13) || [],
        risk: ok(14), aiInsights: ok(15) || [], growthIndex: ok(16),
        headLeaders: ok(17) || [],
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
  const prevAttendanceRate = stats.prev_rate || 0;
  const weeklyGrowth = stats.weekly_growth != null ? stats.weekly_growth : 0;
  const monthlyGrowth = stats.monthly_growth != null ? stats.monthly_growth : 0;
  const yearlyGrowth = stats.yearly_growth != null ? stats.yearly_growth : 0;

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
    const totMem = totalPresent + totalAbsent + totalExcused;
    return {
      totalSections: sectionComparison.length,
      totalMembers: totMem,
      totalPresent, totalAbsent, totalExcused,
      avgRate: totMem > 0 ? Math.round((totalPresent / totMem) * 100) : 0,
    };
  }, [sectionComparison, totalPresent, totalAbsent, totalExcused]);

  const insights = useMemo(() => {
    const list = [];
    if (attendanceRate >= 80) list.push({ type: 'success', text: `Attendance rate is ${attendanceRate}% — strong congregation engagement this period.`, icon: CheckCircle2 });
    else if (attendanceRate < 60) list.push({ type: 'danger', text: `Attendance rate dropped to ${attendanceRate}%. Consider outreach to inactive members.`, icon: AlertTriangle });

    if (analytics.prediction?.trend === 'increasing') list.push({ type: 'success', text: `Attendance trending upward over ${analytics.prediction.weeks_analyzed || 0} weeks.`, icon: TrendingUp });
    else if (analytics.prediction?.trend === 'decreasing') list.push({ type: 'warning', text: 'Attendance trend is declining. Review recent changes in scheduling or engagement.', icon: TrendingDown });

    if (unsubmitted > 0) list.push({ type: 'info', text: `${unsubmitted} leader(s) have not submitted attendance this period.`, icon: Clock });
    if (leaderRankData.length > 0 && leaderRankData[0].attendance_rate >= 90) list.push({ type: 'success', text: `${leaderRankData[0].leader_name} leads with ${R(leaderRankData[0].attendance_rate)}% section attendance.`, icon: Award });

    if (sectionComparison.length > 0) {
      const best = sectionComparison[0];
      const worst = sectionComparison[sectionComparison.length - 1];
      if (best?.attendance_rate >= 80) list.push({ type: 'success', text: `${best.name} is top-performing section at ${R(best.attendance_rate)}% attendance.`, icon: Star });
      if (worst?.attendance_rate < 60) list.push({ type: 'danger', text: `${worst.name} needs attention at ${R(worst.attendance_rate)}% attendance.`, icon: AlertTriangle });
      const lowSections = sectionComparison.filter(s => s.attendance_rate < 60);
      if (lowSections.length > 1) list.push({ type: 'warning', text: `${lowSections.length} sections below 60% attendance. Targeted outreach recommended.`, icon: Heart });
    }

    if (analytics.streaks?.length > 0) {
      const atRisk = analytics.streaks.filter(s => s.consecutive_absences >= 3);
      if (atRisk.length > 0) list.push({ type: 'danger', text: `${atRisk.length} member(s) missed 3+ consecutive services — follow-up required.`, icon: UserX });
    }

    if (retention.retention_rate != null) {
      const rr = R(retention.retention_rate);
      if (rr >= 80) list.push({ type: 'success', text: `Member retention at ${rr}% — strong.`, icon: Shield });
      else if (rr < 60) list.push({ type: 'warning', text: `Member retention at ${rr}% — re-engagement strategies needed.`, icon: AlertTriangle });
    }

    if (aiInsights.length > 0) aiInsights.slice(0, 3).forEach(ins => list.push({ type: ins.type || 'info', text: ins.text || ins.message, icon: ins.icon || Info }));

    return list.slice(0, 12);
  }, [attendanceRate, analytics.prediction, unsubmitted, leaderRankData, sectionComparison, analytics.streaks, retention, aiInsights]);

  const actions = useMemo(() => {
    const list = [];
    if (unsubmitted > 0) list.push({ priority: 'high', category: 'Submission', title: 'Remind Leaders to Submit', description: `${unsubmitted} leader(s) have not submitted attendance. Send reminders immediately.` });
    const atRiskLeaders = leaderRankData.filter(l => l.attendance_rate < 60);
    atRiskLeaders.forEach(l => list.push({ priority: 'high', category: 'Performance', title: `Follow up with ${l.leader_name}`, description: `Section attendance at ${R(l.attendance_rate)}%. Requires pastoral intervention.` }));
    const lowSections = sectionComparison.filter(s => s.attendance_rate < 60);
    lowSections.forEach(s => list.push({ priority: 'medium', category: 'Section', title: `Address ${s.name}`, description: `Only ${R(s.attendance_rate)}% attendance. Review section engagement strategies.` }));
    const topLeaders = leaderRankData.filter(l => l.attendance_rate >= 90);
    topLeaders.slice(0, 3).forEach(l => list.push({ priority: 'low', category: 'Recognition', title: `Congratulate ${l.leader_name}`, description: `Outstanding ${R(l.attendance_rate)}% attendance rate. Consider for recognition.` }));
    if (analytics.streaks?.length > 0) {
      const inactive = analytics.streaks.filter(s => s.consecutive_absences >= 4);
      if (inactive.length > 0) list.push({ priority: 'high', category: 'Follow-up', title: `Visit ${inactive.length} Inactive Members`, description: 'Members with 4+ consecutive absences need pastoral visitation.' });
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
      case 'sections': return renderSectionsTab();
      case 'head-leaders': return renderHeadLeadersTab();
      case 'leaders': return renderLeadersTab();
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
    const retentionRate = retention.retention_rate || 0;
    const rateDiff = attendanceRate - prevAttendanceRate;
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total Members" value={totalMembers} icon={Users} color="indigo" showDiff={false} />
          <MetricCard label="Present" value={totalPresent} icon={CheckCircle2} color="emerald" showDiff={false} />
          <MetricCard label="Absent" value={totalAbsent} icon={UserX} color="rose" showDiff={false} />
          <MetricCard label="Excused" value={totalExcused} icon={AlertTriangle} color="amber" showDiff={false} />
          <MetricCard label="Attendance %" value={attendanceRate} previousValue={prevAttendanceRate} suffix="%" icon={Activity} />
          <MetricCard label="Leader Submission %" value={leaderSubmissionRate} suffix="%" icon={Target} color="sky" showDiff={false} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Weekly Growth" value={weeklyGrowth >= 0 ? `+${R(weeklyGrowth)}%` : `${R(weeklyGrowth)}%`} icon={TrendingUp} color={weeklyGrowth >= 0 ? 'emerald' : 'rose'} showDiff={false} />
          <MetricCard label="Monthly Growth" value={monthlyGrowth >= 0 ? `+${R(monthlyGrowth)}%` : `${R(monthlyGrowth)}%`} icon={TrendingUp} color={monthlyGrowth >= 0 ? 'emerald' : 'rose'} showDiff={false} />
          <MetricCard label="Yearly Growth" value={yearlyGrowth >= 0 ? `+${R(yearlyGrowth)}%` : `${R(yearlyGrowth)}%`} icon={TrendingUp} color={yearlyGrowth >= 0 ? 'emerald' : 'rose'} showDiff={false} />
          <MetricCard label="Retention %" value={retentionRate} suffix="%" icon={Shield} color={retentionRate >= 80 ? 'emerald' : retentionRate >= 60 ? 'amber' : 'rose'} showDiff={false} />
          <MetricCard label="Rate Change" value={rateDiff >= 0 ? `+${R(rateDiff)}%` : `${R(rateDiff)}%`} icon={Activity} color={rateDiff >= 0 ? 'emerald' : 'rose'} showDiff={false} />
          <MetricCard label="Health Score" value={healthScore} suffix="/100" icon={Heart} color={healthScore >= 75 ? 'emerald' : healthScore >= 50 ? 'amber' : 'rose'} showDiff={false} />
        </div>

        {insights.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-5">
            <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Intelligence Summary</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {insights.slice(0, 4).map((insight, i) => <InsightCard key={i} insight={insight} index={i} />)}
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
                { label: 'Avg Rate', value: `${R(sectionSummary.avgRate)}%`, color: 'indigo' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">{s.label}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</p>
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
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{R(hl.overall_attendance)}%</p>
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
    const dates = comp.dates;
    const isCustom = compPeriod === 'custom';
    const typeTabs = [
      { key: 'sections', label: 'Sections', icon: Layers },
      { key: 'leaders', label: 'Section Leaders', icon: Users },
      { key: 'departments', label: 'Departments', icon: Building2 },
      { key: 'overall', label: 'Overall', icon: BarChart3 },
      { key: 'daily', label: 'Daily Attendance', icon: Calendar },
    ];
    const periodTabs = [
      { key: 'week', label: 'Weekly' },
      { key: 'month', label: 'Monthly' },
      { key: 'quarter', label: 'Quarterly' },
      { key: 'year', label: 'Yearly' },
      { key: 'custom', label: 'Custom' },
    ];

    const renderEntityTable = (currentList, previousList, nameKey, metrics) => {
      const prevMap = {};
      previousList.forEach(item => { prevMap[item[nameKey]] = item; });
      const rows = currentList.map(curr => {
        const prev = prevMap[curr[nameKey]] || {};
        const enriched = { name: curr[nameKey] || curr.name || 'Unknown' };
        metrics.forEach(m => {
          const currVal = Number(curr[m.key]) || 0;
          const prevVal = Number(prev[m.key]) || 0;
          const diff = m.invert ? prevVal - currVal : currVal - prevVal;
          const pct = prevVal > 0 ? ((diff / prevVal) * 100).toFixed(1) : currVal > 0 ? 100 : 0;
          enriched[`${m.key}_curr`] = currVal;
          enriched[`${m.key}_prev`] = prevVal;
          enriched[`${m.key}_diff`] = diff;
          enriched[`${m.key}_pct`] = pct;
        });
        return enriched;
      });
      const prevOnly = previousList.filter(prev => !currentList.find(c => c[nameKey] === prev[nameKey])).map(prev => {
        const enriched = { name: prev[nameKey] || prev.name || 'Unknown', _removed: true };
        metrics.forEach(m => {
          enriched[`${m.key}_curr`] = 0;
          enriched[`${m.key}_prev`] = Number(prev[m.key]) || 0;
          enriched[`${m.key}_diff`] = m.invert ? enriched[`${m.key}_prev`] : -enriched[`${m.key}_prev`];
          enriched[`${m.key}_pct`] = '-100';
        });
        return enriched;
      });
      const allRows = [...rows, ...prevOnly].sort((a, b) => {
        const aRate = a[`${metrics[0].key}_curr`] || 0;
        const bRate = b[`${metrics[0].key}_curr`] || 0;
        return bRate - aRate;
      });

      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-left">#</th>
                  <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-left">Name</th>
                  {metrics.map(m => (
                    <React.Fragment key={m.key}>
                      <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-right">{m.label} (Prev)</th>
                      <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-right">{m.label} (Curr)</th>
                      <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-right">{m.label} (Diff)</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => (
                  <tr key={`${row.name}-${i}`} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${row._removed ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{row.name}</td>
                    {metrics.map(m => {
                      const curr = row[`${m.key}_curr`];
                      const prev = row[`${m.key}_prev`];
                      const diff = row[`${m.key}_diff`];
                      const pct = row[`${m.key}_pct`];
                      return (
                        <React.Fragment key={m.key}>
                          <td className="py-2 px-3 text-right text-slate-500">{m.suffix === '%' ? R(prev) : prev}{m.suffix || ''}</td>
                          <td className="py-2 px-3 text-right font-bold">{m.suffix === '%' ? R(curr) : curr}{m.suffix || ''}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{m.suffix === '%' ? R(diff) : diff}{m.suffix || ''}</span>
                            <span className={`ml-1 text-[10px] ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>({pct}%)</span>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
                {allRows.length === 0 && (
                  <tr><td colSpan={2 + metrics.length * 3} className="py-8 text-center text-slate-400 text-sm">No data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase text-slate-400 mr-1">Compare:</span>
          {typeTabs.map(t => (
            <button key={t.key} onClick={() => setCompType(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${compType === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}>
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase text-slate-400 mr-1">Period:</span>
          {periodTabs.map(pt => (
            <button key={pt.key} onClick={() => setCompPeriod(pt.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${compPeriod === pt.key ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}>
              {pt.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">Current Period</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:border-indigo-300" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={p1End} onChange={e => setP1End(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:border-indigo-300" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">Previous Period</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:border-indigo-300" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={p2End} onChange={e => setP2End(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:border-indigo-300" />
                </div>
              </div>
            </div>
          </div>
        )}

        {dates && (
          <div className="rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-200/40 dark:border-indigo-800/30 p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {typeTabs.find(t => t.key === compType)?.label || compType} — {periodTabs.find(p => p.key === compPeriod)?.label || compPeriod}
                </p>
                <p className="text-[10px] text-slate-400">
                  Current: <span className="font-medium text-slate-600 dark:text-slate-300">{dates.cStart} to {dates.cEnd}</span>
                  {' '}&mdash; Previous: <span className="font-medium text-slate-600 dark:text-slate-300">{dates.pStart} to {dates.pEnd}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : compError ? (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{compError}</p>
            <button onClick={loadComparisonData} className="mt-2 px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-xs font-medium text-rose-600 hover:bg-rose-200 transition-colors">Retry</button>
          </div>
        ) : comp.type === 'overall' && comp.current ? (
          <div className="space-y-5">
            {(() => {
              const c = comp.current, p = comp.previous;
              const diffRate = (c.rate || 0) - (p.rate || 0);
              const submissionRate = comp.totalLeaders > 0 ? Math.round(((c.leadersSubmitted || 0) / comp.totalLeaders) * 100) : 0;
              const prevSubmissionRate = comp.totalLeaders > 0 ? Math.round(((p.leadersSubmitted || 0) / comp.totalLeaders) * 100) : 0;
              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Present', curr: c.present, prev: p.present, color: 'emerald' },
                      { label: 'Absent', curr: c.absent, prev: p.absent, color: 'rose', inv: true },
                      { label: 'Excused', curr: c.excused, prev: p.excused, color: 'amber', inv: true },
                      { label: 'Attendance %', curr: c.rate, prev: p.rate, color: 'indigo', suffix: '%' },
                    ].map(kpi => {
                      const diff = kpi.inv ? (kpi.prev || 0) - (kpi.curr || 0) : (kpi.curr || 0) - (kpi.prev || 0);
                      return (
                        <div key={kpi.label} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-3 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase text-slate-400">{kpi.label}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{kpi.suffix === '%' ? R(kpi.curr || 0) : (kpi.curr || 0)}{kpi.suffix || ''}</p>
                          <span className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{kpi.suffix === '%' ? R(diff) : diff}{kpi.suffix || ''} vs prev</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Detailed Comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            {['Metric', 'Previous', 'Current', 'Difference', 'Change %', 'Status'].map(h => (
                              <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Metric' ? 'text-left' : 'text-right'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'Present', prev: p.present, curr: c.present },
                            { label: 'Absent', prev: p.absent, curr: c.absent, inv: true },
                            { label: 'Excused', prev: p.excused, curr: c.excused, inv: true },
                            { label: 'Total Members', prev: p.total, curr: c.total },
                            { label: 'Attendance %', prev: p.rate, curr: c.rate, suffix: '%' },
                            { label: 'Service Days', prev: p.serviceDays, curr: c.serviceDays },
                            { label: 'Leaders Submitted', prev: p.leadersSubmitted, curr: c.leadersSubmitted },
                            { label: 'Leader Submission %', prev: prevSubmissionRate, curr: submissionRate, suffix: '%' },
                            { label: 'Active Sections', prev: p.activeSections, curr: c.activeSections },
                          ].map(row => {
                            const rawCurr = row.curr || 0, rawPrev = row.prev || 0;
                            const curr = row.suffix === '%' ? R(rawCurr) : rawCurr;
                            const prev = row.suffix === '%' ? R(rawPrev) : rawPrev;
                            const diff = row.inv ? prev - curr : curr - prev;
                            const pct = rawPrev > 0 ? ((diff / rawPrev) * 100).toFixed(1) : 0;
                            return (
                              <tr key={row.label} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{row.label}</td>
                                <td className="py-2.5 px-3 text-right text-slate-500">{prev}{row.suffix || ''}</td>
                                <td className="py-2.5 px-3 text-right font-bold">{curr}{row.suffix || ''}</td>
                                <td className={`py-2.5 px-3 text-right font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{diff}{row.suffix || ''}</td>
                                <td className={`py-2.5 px-3 text-right ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct}%</td>
                                <td className="py-2.5 px-3 text-right"><Badge variant={diff >= 0 ? 'success' : 'danger'}>{diff >= 0 ? 'Increase' : 'Decrease'}</Badge></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : comp.type === 'sections' && comp.currentList ? (
          renderEntityTable(comp.currentList, comp.previousList, 'name', [
            { key: 'attendance_rate', label: 'Rate', suffix: '%' },
            { key: 'total_present', label: 'Present' },
            { key: 'total_absent', label: 'Absent' },
            { key: 'member_count', label: 'Members' },
            { key: 'new_members', label: 'New' },
          ])
        ) : comp.type === 'leaders' && comp.currentList ? (
          renderEntityTable(comp.currentList, comp.previousList, 'leader_name', [
            { key: 'avg_rate', label: 'Rate', suffix: '%' },
            { key: 'submissions', label: 'Submissions' },
          ])
        ) : comp.type === 'departments' && comp.currentList ? (
          renderEntityTable(comp.currentList, comp.previousList, 'name', [
            { key: 'attendance_rate', label: 'Rate', suffix: '%' },
            { key: 'total_present', label: 'Present' },
            { key: 'total_absent', label: 'Absent' },
            { key: 'member_count', label: 'Members' },
          ])
        ) : comp.type === 'daily' && comp.daily ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daily Attendance Records</h3>
              {dates && <p className="text-[10px] text-slate-400 mt-0.5">{dates.cStart} to {dates.cEnd}</p>}
            </div>
            {comp.daily.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Date', 'Present', 'Absent', 'Excused', 'Total', 'Rate %', 'Change'].map((h, i) => (
                        <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comp.daily.map((row, i) => {
                      const prev = i < comp.daily.length - 1 ? comp.daily[i + 1] : null;
                      const diff = prev ? row.rate - prev.rate : 0;
                      return (
                        <tr key={row.date} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{row.date}</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{row.present}</td>
                          <td className="py-2 px-3 text-right text-rose-500">{row.absent}</td>
                          <td className="py-2 px-3 text-right text-amber-500">{row.excused}</td>
                          <td className="py-2 px-3 text-right font-medium">{row.total}</td>
                          <td className="py-2 px-3 text-right font-bold">{R(row.rate)}%</td>
                          <td className={`py-2 px-3 text-right font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {diff > 0 ? '+' : ''}{R(diff)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">No attendance data for this period</div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Select a comparison type and period to view analytics
          </div>
        )}
      </div>
    );
  };

  const renderSectionsTab = () => {
    const best = sectionRankings.length > 0 ? sectionRankings.reduce((a, b) => (a.attendance_rate || 0) > (b.attendance_rate || 0) ? a : b) : null;
    const worst = sectionRankings.length > 0 ? sectionRankings.reduce((a, b) => (a.attendance_rate || 0) < (b.attendance_rate || 0) ? a : b) : null;
    return (
      <div className="space-y-6">
        {sectionSummary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Sections" value={sectionSummary.totalSections} icon={Layers} color="indigo" showDiff={false} />
            <MetricCard label="Total Members" value={sectionSummary.totalMembers} icon={Users} color="slate" showDiff={false} />
            <MetricCard label="Total Present" value={sectionSummary.totalPresent} icon={CheckCircle2} color="emerald" showDiff={false} />
            <MetricCard label="Total Absent" value={sectionSummary.totalAbsent} icon={UserX} color="rose" showDiff={false} />
            <MetricCard label="Total Excused" value={sectionSummary.totalExcused} icon={AlertTriangle} color="amber" showDiff={false} />
            <MetricCard label="Avg Rate" value={sectionSummary.avgRate} suffix="%" icon={Activity} color="indigo" showDiff={false} />
          </div>
        )}

        {best && worst && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase text-emerald-700">Best Section</span>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{best.name}</p>
              <p className="text-xs text-slate-500">{R(best.attendance_rate)}% rate | {best.member_count} members</p>
            </div>
            <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-bold uppercase text-rose-700">Needs Follow-up</span>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{worst.name}</p>
              <p className="text-xs text-slate-500">{R(worst.attendance_rate)}% rate | {worst.member_count} members</p>
            </div>
          </div>
        )}

        {sectionRankings.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Performance Report</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">All sections ranked by performance metrics</p>
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
                { key: 'total_present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600 font-medium">{v?.toLocaleString() || 0}</span> },
                { key: 'total_absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v?.toLocaleString() || 0}</span> },
                { key: 'total_excused', label: 'Excused', align: 'right', render: v => <span className="text-amber-500">{v || 0}</span> },
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{R(v)}%</Badge> },
                { key: 'prev_rate', label: 'Prev %', align: 'right', render: v => <span className="text-slate-400">{v != null ? R(v) : '—'}%</span> },
                { key: 'rate_change', label: 'Diff', align: 'right', render: (v, row) => {
                  const diff = (row.attendance_rate || 0) - (row.prev_rate || 0);
                  return <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{R(diff)}%</span>;
                }},
                { key: 'new_members', label: 'Growth', align: 'right', render: v => <span className="text-indigo-500">+{v || 0}</span> },
                { key: 'consistency_score', label: 'Consistency', align: 'right', render: v => v != null ? <span className={`text-xs font-bold ${v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{v}</span> : <span className="text-slate-300">—</span> },
                { key: 'retention_rate', label: 'Retention', align: 'right', render: v => v != null ? <span className="font-bold">{R(v)}%</span> : <span className="text-slate-300">—</span> },
                { key: 'performance_score', label: 'Score', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{v || 0}</Badge> },
              ]}
              data={sectionRankings.map((s, i) => ({ ...s, rank: i + 1 }))}
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
  };

  const renderHeadLeadersTab = () => {
    if (!headLeaders.length) return <div className="text-center py-12 text-slate-400 text-sm"><Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />No head leader data available</div>;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Head Leader Performance Report</h3>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'rank', label: '#', render: (_, __, i) => <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span> },
              { key: 'leader_name', label: 'Head Leader', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'section_name', label: 'Section' },
              { key: 'leaders_supervised', label: 'Leaders', align: 'right' },
              { key: 'members_managed', label: 'Members', align: 'right' },
              { key: 'overall_attendance', label: 'Attendance %', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{R(v)}%</Badge> },
              { key: 'retention_rate', label: 'Retention', align: 'right', render: v => <span className="font-bold">{R(v)}%</span> },
              { key: 'growth_rate', label: 'Growth %', align: 'right', render: v => <span className={v >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{v >= 0 ? '+' : ''}{R(v)}%</span> },
              { key: 'submission_rate', label: 'Submission %', align: 'right', render: v => <span className="font-bold">{R(v)}%</span> },
              { key: 'performance_score', label: 'Score', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{v || 0}</Badge> },
              { key: 'current_rank', label: 'Rank', align: 'right', render: (v, row) => <span className="font-bold">#{v || 0}</span> },
              { key: 'prev_rank', label: 'Prev Rank', align: 'right', render: v => <span className="text-slate-400">#{v || '—'}</span> },
              { key: 'rank_change', label: 'Change', align: 'right', render: (v) => {
                if (v > 0) return <span className="text-emerald-600 font-bold flex items-center justify-end gap-0.5"><ArrowUp className="w-3 h-3" />{v}</span>;
                if (v < 0) return <span className="text-rose-600 font-bold flex items-center justify-end gap-0.5"><ArrowDown className="w-3 h-3" />{Math.abs(v)}</span>;
                return <span className="text-slate-400">—</span>;
              }},
            ]}
            data={headLeaders}
          />
        </div>
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
            <MetricCard label="Attendance Rate" value={selectedLeader.attendance_rate || 0} suffix="%" icon={Activity} color="indigo" showDiff={false} />
            <MetricCard label="Members" value={selectedLeader.member_count || 0} icon={Users} color="sky" showDiff={false} />
            <MetricCard label="Submissions" value={selectedLeader.submissions_count || 0} icon={FileText} color="emerald" showDiff={false} />
            <MetricCard label="Performance Score" value={selectedLeader.performance_score || 0} icon={Award} color="amber" showDiff={false} />
          </div>
        </div>
      )}

      {leaderRankData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Leader Performance Report</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Detailed performance metrics for all section leaders</p>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'rank', label: '#', render: (_, __, i) => <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span> },
              { key: 'leader_name', label: 'Leader', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
              { key: 'section_name', label: 'Section' },
              { key: 'member_count', label: 'Members', align: 'right' },
              { key: 'total_present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600">{v || 0}</span> },
              { key: 'total_absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v || 0}</span> },
              { key: 'total_excused', label: 'Excused', align: 'right', render: v => <span className="text-amber-500">{v || 0}</span> },
              { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{R(v)}%</Badge> },
              { key: 'prev_rate', label: 'Prev %', align: 'right', render: v => <span className="text-slate-400">{v != null ? R(v) : '—'}%</span> },
              { key: 'rate_diff', label: 'Diff', align: 'right', render: (_, row) => {
                const diff = (row.attendance_rate || 0) - (row.prev_rate || 0);
                return <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{R(diff)}%</span>;
              }},
              { key: 'retention_rate', label: 'Retention', align: 'right', render: v => <span className="font-bold">{R(v)}%</span> },
              { key: 'consistency_score', label: 'Consistency', align: 'right', render: v => <span className={`font-bold ${v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{v || 0}</span> },
              { key: 'submissions_count', label: 'Submissions', align: 'right' },
              { key: 'efficiency_score', label: 'Score', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{v || 0}</Badge> },
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
                <span className="text-xs font-bold text-rose-600">-{R(a.drop_amount)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDepartmentsTab = () => {
    const depts = departmentsData;
    return (
      <div className="space-y-6">
        {depts.length > 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Department Report</h3>
            </div>
            <IntelligenceTable
              columns={[
                { key: 'rank', label: '#', render: (_, __, i) => <span className="text-xs font-bold text-slate-400">#{i + 1}</span> },
                { key: 'name', label: 'Department', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
                { key: 'member_count', label: 'Members', align: 'right' },
                { key: 'present', label: 'Present', align: 'right', render: v => <span className="text-emerald-600">{v || 0}</span> },
                { key: 'absent', label: 'Absent', align: 'right', render: v => <span className="text-rose-500">{v || 0}</span> },
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{R(v)}%</Badge> },
                { key: 'rate_change', label: 'Diff', align: 'right', render: v => {
                  const d = Number(v) || 0;
                  return <span className={`font-bold ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{d >= 0 ? '+' : ''}{R(d)}%</span>;
                }},
                { key: 'growth_rate', label: 'Growth', align: 'right', render: v => <span className={v >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{v >= 0 ? '+' : ''}{R(v)}%</span> },
                { key: 'consistency_score', label: 'Consistency', align: 'right', render: v => <span className={`font-bold ${v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{v || 0}</span> },
                { key: 'performance_score', label: 'Score', align: 'right', render: v => <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>{v || 0}</Badge> },
              ]}
              data={depts.map((d, i) => ({ ...d, rank: i + 1 }))}
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

  const renderMembersTab = () => {
    const streaks = analytics.streaks || [];
    const membersWithStreaks = streaks.filter(s => s.consecutive_present >= 3);
    const perfectAttendance = streaks.filter(s => s.attendance_rate >= 100);
    const inactive = streaks.filter(s => s.consecutive_absences >= 4);
    const absent1w = streaks.filter(s => s.consecutive_absences === 1);
    const absent2w = streaks.filter(s => s.consecutive_absences === 2);
    const absent3w = streaks.filter(s => s.consecutive_absences === 3);
    const absent1m = streaks.filter(s => s.consecutive_absences >= 4 && s.consecutive_absences < 12);
    const absent3m = streaks.filter(s => s.consecutive_absences >= 12);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard label="Most Active" value={membersWithStreaks.length} icon={Flame} color="emerald" showDiff={false} />
          <MetricCard label="Perfect Attendance" value={perfectAttendance.length} icon={Star} color="amber" showDiff={false} />
          <MetricCard label="Inactive (4+)" value={inactive.length} icon={UserX} color="rose" showDiff={false} />
          <MetricCard label="Absent 1 Week" value={absent1w.length} icon={Clock} color="sky" showDiff={false} />
          <MetricCard label="Absent 2 Weeks" value={absent2w.length} icon={Clock} color="amber" showDiff={false} />
          <MetricCard label="Absent 3+ Weeks" value={absent3w.length} icon={AlertTriangle} color="orange" showDiff={false} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label="Absent 1 Month" value={absent1m.length} icon={AlertTriangle} color="orange" showDiff={false} />
          <MetricCard label="Absent 3 Months" value={absent3m.length} icon={AlertTriangle} color="rose" showDiff={false} />
          <MetricCard label="Need Visitation" value={inactive.length} icon={Heart} color="rose" showDiff={false} />
        </div>

        {analytics.demographics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Male', value: analytics.demographics.gender?.find(g => g.category_value === 'Male')?.member_count || 0, color: 'sky' },
              { label: 'Female', value: analytics.demographics.gender?.find(g => g.category_value === 'Female')?.member_count || 0, color: 'pink' },
              { label: 'Youth', value: analytics.demographics.age_group?.find(a => a.category_value === 'Youth')?.member_count || 0, color: 'violet' },
              { label: 'Adults', value: analytics.demographics.age_group?.find(a => a.category_value === 'Adults')?.member_count || 0, color: 'emerald' },
            ].map(d => <MetricCard key={d.label} label={d.label} value={d.value} icon={Users} color={d.color} showDiff={false} />)}
          </div>
        )}

        {streaks.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Attendance Streaks</h3>
            </div>
            <IntelligenceTable
              columns={[
                { key: 'full_name', label: 'Member', render: v => <span className="font-medium text-slate-900 dark:text-white">{v}</span> },
                { key: 'section_name', label: 'Section' },
                { key: 'leader_name', label: 'Leader' },
                { key: 'consecutive_present', label: 'Streak', align: 'right', render: v => <span className="font-bold text-emerald-600">{v}</span> },
                { key: 'consecutive_absences', label: 'Absences', align: 'right', render: v => <span className={`font-bold ${v >= 3 ? 'text-rose-600' : 'text-slate-500'}`}>{v}</span> },
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <Badge variant={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'}>{R(v)}%</Badge> },
              ]}
              data={streaks}
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
                { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => <span className="font-bold">{R(v)}%</span> },
              ]}
              data={analytics.engagementScores}
            />
          </div>
        )}
      </div>
    );
  };

  const renderHistoricalTab = () => {
    const hist = historicalData;
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
          <MetricCard label="Attendance Rate" value={hist.avg_rate || 0} suffix="%" icon={Target} color="sky" showDiff={false} />
        </div>

        {historicalData.daily?.length > 0 && (
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
                  {historicalData.daily.slice(0, 60).map((t, i) => {
                    const rate = t.total_members > 0 ? Math.round((t.present_count / t.total_members) * 100) : 0;
                    return (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2 px-3 text-left font-medium text-slate-900 dark:text-white">{t.date}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{t.present_count}</td>
                        <td className="py-2 px-3 text-right text-rose-500">{t.absent_count}</td>
                        <td className="py-2 px-3 text-right text-amber-500">{t.excused_count}</td>
                        <td className="py-2 px-3 text-right font-medium">{t.total_members}</td>
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
                { key: 'current_rate', label: 'Current', align: 'right', render: v => <span className="font-bold">{R(v)}%</span> },
                { key: 'previous_rate', label: 'Previous', align: 'right', render: v => <span className="text-slate-500">{R(v)}%</span> },
                { key: 'difference', label: 'Difference', align: 'right', render: v => <span className={`font-bold ${v >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{v >= 0 ? '+' : ''}{R(v)}%</span> },
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

      {analytics.prediction?.weeks_analyzed > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Predictive Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Predicted Rate" value={analytics.prediction.predicted_rate || 0} suffix="%" icon={TrendingUp} color="indigo" showDiff={false} />
            <MetricCard label="Trend" value={analytics.prediction.trend || 'Stable'} icon={Activity} color={analytics.prediction.trend === 'increasing' ? 'emerald' : 'amber'} showDiff={false} />
            <MetricCard label="Weeks Analyzed" value={analytics.prediction.weeks_analyzed || 0} icon={Calendar} color="sky" showDiff={false} />
            <MetricCard label="Confidence" value={analytics.prediction.confidence || 0} suffix="%" icon={Shield} color="violet" showDiff={false} />
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Executive Report', icon: Eye, action: () => { setActiveTab('overview'); }, color: 'indigo' },
            { label: 'Section Report', icon: Layers, action: () => { setActiveTab('sections'); }, color: 'sky' },
            { label: 'Leader Report', icon: Users, action: () => { setActiveTab('leaders'); }, color: 'emerald' },
            { label: 'Department Report', icon: Building2, action: () => { setActiveTab('departments'); }, color: 'violet' },
            { label: 'PDF Export', icon: FileText, action: handleExportPDF, color: 'rose' },
            { label: 'CSV Export', icon: Download, action: handleCSVExport, color: 'emerald' },
            { label: 'Print View', icon: Printer, action: handlePrint, color: 'sky' },
            { label: 'Weekly Report', icon: Calendar, action: () => { setCompPeriod('week'); setActiveTab('comparison'); }, color: 'amber' },
            { label: 'Monthly Report', icon: Calendar, action: () => { setCompPeriod('month'); setActiveTab('comparison'); }, color: 'indigo' },
            { label: 'Refresh Data', icon: RefreshCw, action: () => { loadOverview(); loadAnalytics(); loadDepartments(); loadComparisonData(); loadHistoricalData(historicalPeriod); }, color: 'indigo' },
          ].map(exp => (
            <button key={exp.label} onClick={exp.action}
              className="flex items-center gap-2 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-left">
              <exp.icon className="w-4 h-4 text-slate-500" />
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
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterValue(''); }}
              className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none">
              <option value="weekly" className="text-slate-900">This Week</option>
              <option value="monthly" className="text-slate-900">This Month</option>
              <option value="yearly" className="text-slate-900">This Year</option>
              <option value="last7" className="text-slate-900">Last 7 Days</option>
              <option value="last30" className="text-slate-900">Last 30 Days</option>
              <option value="last90" className="text-slate-900">Last 90 Days</option>
              <option value="custom" className="text-slate-900">Custom Date</option>
            </select>
            {filterType !== 'custom' ? (
              <input type="date" value={filterValue || ''} onChange={e => setFilterValue(e.target.value)}
                className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none" />
            ) : (
              <div className="flex items-center gap-1">
                <input type="date" value={customDate1} onChange={e => setCustomDate1(e.target.value)}
                  className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none w-32" />
                <span className="text-white/60 text-xs">to</span>
                <input type="date" value={customDate2} onChange={e => setCustomDate2(e.target.value)}
                  className="bg-white/20 border border-white/30 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none w-32" />
              </div>
            )}
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
