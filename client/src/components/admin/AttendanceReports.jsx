import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle, Target,
  Calendar, Download, Printer, FileText, Activity, Shield,
  X, Zap, Award, Clock, Eye, Layers, CheckCircle2, Flame, Heart, Brain,
  UserCheck, UserX, Star, Info, ChevronDown, ChevronUp, Search,
  ArrowUp, ArrowDown, Minus, RefreshCw, Building2, PieChart,
  XCircle, HelpCircle, Sparkles
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import Badge from '../ui/Badge';
import { fdate, fdatetime } from '../../utils/date';
import ExecutiveComparison from './ExecutiveComparison';
import ExecutiveSummary from './ExecutiveSummary';

const R = v => Math.round(Number(v) || 0);
const asArray = v => Array.isArray(v) ? v : [];

const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekToDate = (weekStr) => {
  const [y, w] = String(weekStr).split('-W').map(Number);
  if (!y || !w) return weekStr;
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const day = simple.getUTCDay();
  const isoStart = new Date(simple);
  if (day <= 4) isoStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else isoStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  return `${isoStart.getUTCDate()} ${MONTHS_SHORT[isoStart.getUTCMonth() + 1]}`;
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'compare', label: 'Compare', icon: ArrowUp },
  { id: 'performance', label: 'Performance', icon: Layers },
  { id: 'members', label: 'Members', icon: UserCheck },
  { id: 'history', label: 'History', icon: Calendar },
  { id: 'ai', label: 'AI Insights', icon: Zap },
];

const formatPeriodLabel = (filterType, filterValue) => {
  if (!filterValue) return 'Select a period';
  if (filterType === 'yearly') return filterValue;
  if (filterType === 'monthly') {
    const [year, month] = filterValue.split('-');
    const date = new Date(year, parseInt(month, 10) - 1);
    return fdate(date);
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
              title={onRowClick ? 'Click to view attendance details' : undefined}
              className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${onRowClick ? 'cursor-pointer hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700' : ''}`}>
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState({});
  const [compError, setCompError] = useState(null);
  const [historicalData, setHistoricalData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [compType, setCompType] = useState('overall');
  const [compPeriod, setCompPeriod] = useState('week');
  const [p1Start, setP1Start] = useState('');
  const [p1End, setP1End] = useState('');
  const [p2Start, setP2Start] = useState('');
  const [p2End, setP2End] = useState('');
  const [comparisonMode, setComparisonMode] = useState('week');
  const [historicalPeriod, setHistoricalPeriod] = useState('monthly');
  const [customDate1, setCustomDate1] = useState('');
  const [customDate2, setCustomDate2] = useState('');
  const [selectedWeekDate, setSelectedWeekDate] = useState('');
  const [comparisonWeekDate, setComparisonWeekDate] = useState('');
  const [secPeriod, setSecPeriod] = useState('month');
  const [secP1Start, setSecP1Start] = useState('');
  const [secP1End, setSecP1End] = useState('');
  const [secP2Start, setSecP2Start] = useState('');
  const [secP2End, setSecP2End] = useState('');
  const [secRankings, setSecRankings] = useState([]);
  const [secHeadLeaders, setSecHeadLeaders] = useState([]);
  const [secLeaderRankings, setSecLeaderRankings] = useState([]);
  const [absentStreaks, setAbsentStreaks] = useState([]);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [showExtraKPIs, setShowExtraKPIs] = useState(false);
  const [sectionSubTab, setSectionSubTab] = useState('overview');
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState(null);
  const [secSearch, setSecSearch] = useState('');
  const [secSortField, setSecSortField] = useState('performance_score');
  const [secSortOrder, setSecSortOrder] = useState('desc');
  const [leadSortField, setLeadSortField] = useState('performance_score');
  const [leadSortOrder, setLeadSortOrder] = useState('desc');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberCategory, setMemberCategory] = useState('all');
  const [memberRiskFilter, setMemberRiskFilter] = useState('all');
  const [selectedMemberDetails, setSelectedMemberDetails] = useState(null);
  const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);
  const [memberDetailsError, setMemberDetailsError] = useState(null);
  const [memberWeeklyMatrix, setMemberWeeklyMatrix] = useState(null);
  const [memberWeeklyMatrixWeeks, setMemberWeeklyMatrixWeeks] = useState([]);
  const [memberWeeklyLoading, setMemberWeeklyLoading] = useState(false);
  const [memberWeeksCount, setMemberWeeksCount] = useState(12);
  const [memberView, setMemberView] = useState('matrix');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  useEffect(() => { if (filterValue) loadOverview(); }, [filterType, filterValue, selectedServiceId]);
  useEffect(() => { loadAnalytics(); }, [selectedServiceId, filterType, filterValue, overviewData?.filterValue, overviewData?.requestedFilterValue, overviewData?.service_id]);

  const modeToDays = { today: 1, week: 7, month: 30, quarter: 90, year: 365, custom: 30 };
  const toDateStr = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; };
  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  };

  useEffect(() => {
    const now = new Date();
    setSelectedWeekDate(toDateStr(now));
    setComparisonWeekDate(toDateStr(new Date(now.getTime() - 7 * 86400000)));
  }, []);

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
      setDepartmentsData(asArray(res.data));
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
      case 'churchWeek': {
        if (!selectedWeekDate || !comparisonWeekDate) return null;
        const d1 = new Date(selectedWeekDate + 'T12:00:00');
        const dow1 = d1.getDay();
        const sun1 = new Date(d1); sun1.setDate(d1.getDate() - dow1);
        const fri1 = new Date(sun1); fri1.setDate(sun1.getDate() + 5);

        const d2 = new Date(comparisonWeekDate + 'T12:00:00');
        const dow2 = d2.getDay();
        const sun2 = new Date(d2); sun2.setDate(d2.getDate() - dow2);
        const fri2 = new Date(sun2); fri2.setDate(sun2.getDate() + 5);

        cStart = toDateStr(sun1); cEnd = toDateStr(fri1);
        pStart = toDateStr(sun2); pEnd = toDateStr(fri2);
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
      } else if (compType === 'services') {
        const [curRes, prevRes] = await Promise.all([
          analyticsAPI.getServiceComparison(365, dates.cStart, dates.cEnd),
          analyticsAPI.getServiceComparison(365, dates.pStart, dates.pEnd),
        ]);
        setComparisonData({ type: 'services', currentList: curRes.data || [], previousList: prevRes.data || [], dates });
      } else if (compType === 'daily') {
        const isCW = compPeriod === 'churchWeek';
        if (isCW) {
          const [curRes, prevRes] = await Promise.all([
            analyticsAPI.getHistorical({ startDate: dates.cStart, endDate: dates.cEnd }),
            analyticsAPI.getHistorical({ startDate: dates.pStart, endDate: dates.pEnd }),
          ]);
          const daily = (curRes.data?.daily || []).map(r => ({
            date: r.date, present: r.present || 0, absent: r.absent || 0,
            excused: r.excused || 0, total: r.total || 0, rate: r.rate || 0,
          }));
          const previousDaily = (prevRes.data?.daily || []).map(r => ({
            date: r.date, present: r.present || 0, absent: r.absent || 0,
            excused: r.excused || 0, total: r.total || 0, rate: r.rate || 0,
          }));
          setComparisonData({ type: 'daily', daily, previousDaily, dates });
        } else {
          const res = await analyticsAPI.getHistorical({ startDate: dates.cStart, endDate: dates.cEnd });
          const daily = (res.data?.daily || []).map(r => ({
            date: r.date, present: r.present || 0, absent: r.absent || 0,
            excused: r.excused || 0, total: r.total || 0, rate: r.rate || 0,
          }));
          setComparisonData({ type: 'daily', daily, dates });
        }
      }
    } catch (e) { console.error('Comparison load error:', e.message, e); setCompError(e.message || 'Failed to load comparison data'); setComparisonData({}); }
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => { loadComparisonData(); }, [compType, compPeriod]);

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

  const getSecDates = (period) => {
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
        if (secP1Start && secP1End && secP2Start && secP2End) {
          cStart = secP1Start; cEnd = secP1End; pStart = secP2Start; pEnd = secP2End;
        } else return null;
        break;
      }
      default: return null;
    }
    return { cStart, cEnd, pStart, pEnd };
  };

  const loadSectionIntelligence = async () => {
    const dates = getSecDates(secPeriod);
    if (!dates) return;
    setSecLoading(true);
    setSecError(null);
    try {
      const [rankingsRes, headLeadersRes, leaderRankingsRes, streaksRes] = await Promise.all([
        analyticsAPI.getSectionRankings(90, dates.cStart, dates.cEnd, dates.pStart, dates.pEnd),
        analyticsAPI.getHeadLeaderAnalytics(90, dates.cStart, dates.cEnd),
        analyticsAPI.getLeaderRankings(90, dates.cStart, dates.cEnd, dates.pStart, dates.pEnd),
        analyticsAPI.getAbsentStreaks(100)
      ]);
      setSecRankings(asArray(rankingsRes.data));
      setSecHeadLeaders(asArray(headLeadersRes.data));
      setSecLeaderRankings(asArray(leaderRankingsRes.data));
      setAbsentStreaks(asArray(streaksRes.data));
    } catch (e) {
      console.error('Failed to load section intelligence:', e);
      setSecError(e.message || 'Failed to load Section Intelligence data');
    } finally {
      setSecLoading(false);
    }
  };

  useEffect(() => {
    if (secPeriod !== 'custom' || (secP1Start && secP1End && secP2Start && secP2End)) {
      loadSectionIntelligence();
    }
  }, [secPeriod, secP1Start, secP1End, secP2Start, secP2End]);

  useEffect(() => {
    if (secPeriod === 'custom' && !secP1Start) {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const firstCur = toDateStr(new Date(y, m, 1));
      const lastCur = toDateStr(new Date(y, m + 1, 0));
      const firstPrev = toDateStr(new Date(y, m - 1, 1));
      const lastPrev = toDateStr(new Date(y, m, 0));
      setSecP1Start(firstCur);
      setSecP1End(lastCur);
      setSecP2Start(firstPrev);
      setSecP2End(lastPrev);
    }
  }, [secPeriod, secP1Start]);

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
        analyticsAPI.getLeaderRankings(90),
        analyticsAPI.getMemberIntelligence(180, null, null, selectedServiceId),
      ]);

      const ok = i => results[i].status === 'fulfilled' ? results[i].value?.data : null;
      setAnalytics({
        trends: asArray(ok(0)?.trends), prediction: ok(1), anomalies: asArray(ok(2)),
        streaks: asArray(ok(3)), leaderMetrics: asArray(ok(4)), prevLeaderMetrics: asArray(ok(5)),
        demographics: ok(6), yearOverYear: asArray(ok(7)), retention: ok(8) || {},
        prevRetention: ok(9) || {}, engagementScores: asArray(ok(10)),
        dashboardMetrics: ok(11), sectionComparison: asArray(ok(12)),
        sectionRankings: asArray(ok(13)),
        risk: ok(14), aiInsights: asArray(ok(15)), growthIndex: ok(16),
        headLeaders: asArray(ok(17)),
        leaderRankings: asArray(ok(18)),
        memberIntelligence: asArray(ok(19)),
      });
    } catch (e) { console.error('Failed to load analytics:', e); }
    finally { setAnalyticsLoading(false); }
  };

  const weekRangeFromDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { startDate: mon.toISOString().slice(0, 10), endDate: sun.toISOString().slice(0, 10) };
  };

  const deriveDateRange = () => {
    if (filterType === 'weekly' && filterValue) {
      const isISOWk = filterValue.includes('-W');
      if (isISOWk) {
        const [yearStr, weekPart] = filterValue.split('-W');
        const year = Number(yearStr);
        const week = Number(weekPart);
        if (Number.isInteger(year) && Number.isInteger(week)) {
          const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
          const day = simple.getUTCDay();
          const isoWeekStart = new Date(simple);
          if (day <= 4) isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
          else isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
          const isoWeekEnd = new Date(isoWeekStart);
          isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);
          return { startDate: isoWeekStart.toISOString().slice(0, 10), endDate: isoWeekEnd.toISOString().slice(0, 10) };
        }
      }
      return weekRangeFromDate(filterValue);
    }
    if (filterType === 'monthly' && filterValue) {
      const [year, month] = filterValue.split('-').map(Number);
      if (year && month) {
        const end = new Date(year, month, 0);
        return { startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: end.toISOString().slice(0, 10) };
      }
    }
    if (filterType === 'yearly' && filterValue) {
      return { startDate: `${filterValue}-01-01`, endDate: `${filterValue}-12-31` };
    }
    if (filterType === 'daily' && filterValue) {
      return { startDate: filterValue, endDate: filterValue };
    }
    return null;
  };

  const loadMemberWeeklyMatrix = async (numWeeks = memberWeeksCount) => {
    setMemberWeeklyLoading(true);
    try {
      const params = { serviceId: selectedServiceId, weeks: numWeeks };
      const res = await analyticsAPI.getMemberWeeklyMatrix(params);
      setMemberWeeklyMatrix(res.data.matrix || []);
      setMemberWeeklyMatrixWeeks(res.data.weeks || []);
    } catch (e) { console.error('Failed to load weekly matrix:', e); setMemberWeeklyMatrix([]); }
    finally { setMemberWeeklyLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'members') loadMemberWeeklyMatrix(memberWeeksCount);
  }, [activeTab, selectedServiceId]);

  const stats = overviewData?.stats || {};
  const leaders = overviewData?.subleaders || [];
  const currentService = serviceTypes.find(s => s.id === selectedServiceId);
  const serviceLabel = selectedServiceId === 'all' ? 'All Services' : (currentService?.name || 'Service');
  const overviewServiceMatches = String(overviewData?.service_id ?? selectedServiceId) === String(selectedServiceId);
  const overviewFilterMatches = !overviewData?.requestedFilterValue || overviewData.requestedFilterValue === filterValue;
  const effectiveFilterValue = overviewServiceMatches && overviewFilterMatches && overviewData?.filterValue
    ? overviewData.filterValue
    : filterValue;
  const periodLabel = formatPeriodLabel(filterType, effectiveFilterValue);

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

  const openMemberAttendanceDetails = async (member) => {
    setSelectedMemberDetails({ member, records: [], stats: null, date_range: null });
    setMemberDetailsLoading(true);
    setMemberDetailsError(null);
    try {
      const res = await analyticsAPI.getMemberAttendanceDetails(member.id, 180, selectedServiceId);
      setSelectedMemberDetails(res.data);
    } catch (error) {
      setMemberDetailsError(error.response?.data?.error || 'Failed to load member attendance details');
      setSelectedMemberDetails({ member, records: [], stats: null, date_range: null });
    } finally {
      setMemberDetailsLoading(false);
    }
  };

  const sectionComparison = analytics.sectionComparison || [];
  const sectionRankings = analytics.sectionRankings || [];
  const prevLeaderMetrics = analytics.prevLeaderMetrics || [];
  const retention = analytics.retention || {};
  const growthIndex = analytics.growthIndex || {};
  const risk = analytics.risk || {};
  const aiInsights = analytics.aiInsights || [];
  const headLeaders = analytics.headLeaders || [];

  const leaderRankData = useMemo(() => {
    const source = analytics.leaderRankings?.length ? analytics.leaderRankings : analytics.leaderMetrics;
    if (!source?.length) return [];
    return [...source].map(row => ({
      ...row,
      attendance_rate: row.attendance_rate ?? row.avg_rate ?? 0,
      submissions_count: row.submissions_count ?? row.submission_count ?? row.submissions ?? 0,
    })).sort((a, b) => (b.attendance_rate || 0) - (a.attendance_rate || 0)).slice(0, 20);
  }, [analytics.leaderRankings, analytics.leaderMetrics]);

  const sectionSummary = useMemo(() => {
    const list = sectionRankings.length ? sectionRankings : sectionComparison;
    if (!list.length) return null;
    let totMem = 0, totPres = 0, totAbs = 0, totExc = 0;
    list.forEach(s => {
      totMem += s.member_count || 0;
      totPres += s.total_present || 0;
      totAbs += s.total_absent || 0;
      totExc += s.total_excused || 0;
    });
    return {
      totalSections: list.length,
      totalMembers: totMem,
      totalPresent: totPres,
      totalAbsent: totAbs,
      totalExcused: totExc,
      avgRate: list.length ? Math.round(list.reduce((acc, curr) => acc + (curr.attendance_rate || 0), 0) / list.length) : 0,
    };
  }, [sectionRankings, sectionComparison]);

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
      doc.text(`Generated: ${fdatetime(new Date())}`, 14, 36);
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
      case 'compare': return renderComparisonTab();
      case 'performance': return renderPerformanceTab();
      case 'members': return renderMembersTab();
      case 'history': return renderHistoricalTab();
      case 'ai': return renderInsightsTab();
      default: return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => {
    return <ExecutiveSummary days={90} />;
  };

  const renderComparisonTab = () => {
    return <ExecutiveComparison />;
  };

  const renderPerformanceTab = () => {
    return (
      <div className="space-y-4">
        {renderSectionsTab()}
        {renderDepartmentsTab()}
      </div>
    );
  };

  const renderSectionsTab = () => {
    // Sorting helpers
    const handleSortSec = (field) => {
      if (secSortField === field) {
        setSecSortOrder(secSortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSecSortField(field);
        setSecSortOrder('desc');
      }
    };

    const handleSortLead = (field) => {
      if (leadSortField === field) {
        setLeadSortOrder(leadSortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setLeadSortField(field);
        setLeadSortOrder('desc');
      }
    };

    const renderSortHeader = (label, field, align = 'left') => {
      const isSorted = secSortField === field;
      return (
        <th
          onClick={() => handleSortSec(field)}
          className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors whitespace-nowrap ${
            align === 'right' ? 'text-right' : 'text-left'
          }`}
        >
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
            <span>{label}</span>
            {isSorted ? (
              secSortOrder === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-indigo-500" /> : <ChevronDown className="w-2.5 h-2.5 text-indigo-500" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-100" />
            )}
          </div>
        </th>
      );
    };

    const renderLeadSortHeader = (label, field, align = 'left') => {
      const isSorted = leadSortField === field;
      return (
        <th
          onClick={() => handleSortLead(field)}
          className={`px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors whitespace-nowrap ${
            align === 'right' ? 'text-right' : 'text-left'
          }`}
        >
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
            <span>{label}</span>
            {isSorted ? (
              leadSortOrder === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-indigo-500" /> : <ChevronDown className="w-2.5 h-2.5 text-indigo-500" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-100" />
            )}
          </div>
        </th>
      );
    };

    // 1. Calculations & Filters for Section rankings table
    const sortedRankings = [...secRankings];
    if (secSearch) {
      const sLower = secSearch.toLowerCase();
      sortedRankings.forEach((s, idx) => {
        // filter on search term
      });
    }

    const filteredRankings = sortedRankings.filter(s => 
      !secSearch || s.name?.toLowerCase().includes(secSearch.toLowerCase())
    );

    // Apply sorting to Rankings
    filteredRankings.sort((a, b) => {
      let valA = a[secSortField];
      let valB = b[secSortField];

      // calculate diff field on the fly if needed
      if (secSortField === 'attendance_diff') {
        valA = (a.attendance_rate || 0) - (a.prev_rate || 0);
        valB = (b.attendance_rate || 0) - (b.prev_rate || 0);
      }

      if (valA == null) return secSortOrder === 'asc' ? -1 : 1;
      if (valB == null) return secSortOrder === 'asc' ? 1 : -1;

      if (typeof valA === 'string') {
        return secSortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return secSortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    // Apply sorting to Leadership Table
    const sortedHeadLeaders = [...secHeadLeaders].sort((a, b) => {
      let valA = a[leadSortField];
      let valB = b[leadSortField];

      if (valA == null) return leadSortOrder === 'asc' ? -1 : 1;
      if (valB == null) return leadSortOrder === 'asc' ? 1 : -1;

      if (typeof valA === 'string') {
        return leadSortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return leadSortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    // Highlights & KPI Cards computations
    const avgHealthScore = secRankings.length > 0
      ? Math.round(secRankings.reduce((sum, s) => sum + (s.performance_score || 0), 0) / secRankings.length)
      : 0;

    let healthStatus = 'Critical';
    let healthColor = 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30';
    let healthBadge = 'danger';
    if (avgHealthScore >= 85) {
      healthStatus = 'Elite';
      healthColor = 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/30';
      healthBadge = 'success';
    } else if (avgHealthScore >= 75) {
      healthStatus = 'Excellent';
      healthColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30';
      healthBadge = 'success';
    } else if (avgHealthScore >= 65) {
      healthStatus = 'Good';
      healthColor = 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30';
      healthBadge = 'info';
    } else if (avgHealthScore >= 50) {
      healthStatus = 'Fair';
      healthColor = 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30';
      healthBadge = 'warning';
    }

    const bestSection = secRankings.length > 0
      ? secRankings.reduce((a, b) => (a.performance_score || 0) > (b.performance_score || 0) ? a : b)
      : null;

    const fastestGrowing = secRankings.length > 0
      ? secRankings.reduce((a, b) => (a.new_members || 0) > (b.new_members || 0) ? a : b)
      : null;

    const mostImproved = secRankings.length > 0
      ? secRankings.reduce((a, b) => {
          const diffA = (a.attendance_rate || 0) - (a.prev_rate || 0);
          const diffB = (b.attendance_rate || 0) - (b.prev_rate || 0);
          return diffA > diffB ? a : b;
        })
      : null;

    const highestRetention = secRankings.length > 0
      ? secRankings.reduce((a, b) => (a.retention_rate || 0) > (b.retention_rate || 0) ? a : b)
      : null;

    const mostConsistent = secRankings.length > 0
      ? secRankings.reduce((a, b) => (a.consistency_score || 0) > (b.consistency_score || 0) ? a : b)
      : null;

    const attentionSection = secRankings.length > 0
      ? secRankings.reduce((a, b) => (a.performance_score || 0) < (b.performance_score || 0) ? a : b)
      : null;

    // AI insights generator
    const getAIExecutiveInsights = () => {
      if (!secRankings.length) return [];
      const list = [];

      if (bestSection) {
        list.push({
          type: 'success',
          text: `**${bestSection.name}** stands as the top-performing section with a stellar Overall Performance Score of **${bestSection.performance_score}/100**, driven by a strong **${R(bestSection.attendance_rate)}%** attendance rate and **${R(bestSection.retention_rate)}%** member retention.`,
          icon: Award
        });
      }

      if (fastestGrowing && fastestGrowing.new_members > 0) {
        list.push({
          type: 'info',
          text: `**${fastestGrowing.name}** is leading numerical growth with **${fastestGrowing.new_members}** new members registered during this period. This momentum highlights active local outreach.`,
          icon: Users
        });
      }

      if (mostConsistent) {
        list.push({
          type: 'success',
          text: `**${mostConsistent.name}** demonstrates exceptional stability with a consistency score of **${mostConsistent.consistency_score}%**, indicating highly predictable weekly attendance patterns.`,
          icon: CheckCircle2
        });
      }

      if (mostImproved) {
        const diff = (mostImproved.attendance_rate || 0) - (mostImproved.prev_rate || 0);
        if (diff > 0) {
          list.push({
            type: 'success',
            text: `**${mostImproved.name}** has shown the most significant recovery, improving its attendance rate by **+${R(diff)}%** compared to the previous period.`,
            icon: ArrowUp
          });
        }
      }

      if (attentionSection && attentionSection.performance_score < 60) {
        list.push({
          type: 'danger',
          text: `**${attentionSection.name}** requires urgent pastoral support. Its performance score is low (**${attentionSection.performance_score}/100**) due to an attendance rate of **${R(attentionSection.attendance_rate)}%** and a follow-up completion rate of only **${attentionSection.follow_up_rate || 0}%**.`,
          icon: AlertTriangle
        });
      }

      return list;
    };

    // Action Center Recommendations
    const getActionCenterRecommendations = () => {
      if (!secRankings.length) return [];
      const list = [];

      secRankings.forEach(s => {
        if (s.attendance_rate < 60) {
          list.push({
            priority: 'high',
            category: 'Intervention',
            title: `Pastoral Intervention: ${s.name}`,
            description: `Attendance has fallen to ${R(s.attendance_rate)}%. Schedule a direct meeting with the Head Leader to review barriers.`
          });
        }
        if (s.follow_up_rate < 50 && s.total_absent > 3) {
          list.push({
            priority: 'high',
            category: 'Follow-up',
            title: `Boost Follow-up: ${s.name}`,
            description: `Only ${s.follow_up_rate || 0}% of absentees have been contacted. Mobilize section leaders to reach out to the ${s.total_absent} absent members.`
          });
        }
      });

      if (absentStreaks.length > 0) {
        const criticalStreaks = absentStreaks.filter(st => st.current_streak >= 4);
        if (criticalStreaks.length > 0) {
          list.push({
            priority: 'high',
            category: 'Visitation',
            title: `Critical Home Visitations`,
            description: `${criticalStreaks.length} members have missed 4+ consecutive services. Assign home visitations to Sector Pastors immediately.`
          });
        }
      }

      secHeadLeaders.forEach(lh => {
        if (lh.submission_rate < 80) {
          list.push({
            priority: 'medium',
            category: 'Leadership',
            title: `Submission Reminder: ${lh.leader_name}`,
            description: `Submission rate is currently at ${lh.submission_rate}%. Request submission of outstanding attendance reports.`
          });
        }
      });

      secRankings.forEach(s => {
        if (s.performance_score >= 85) {
          list.push({
            priority: 'low',
            category: 'Recognition',
            title: `Commend Section: ${s.name}`,
            description: `Outstanding overall score of ${s.performance_score}/100. Send a letter of appreciation to the head leader and team.`
          });
        }
      });

      if (list.length === 0) {
        list.push({
          priority: 'low',
          category: 'Engagement',
          title: 'System Healthy',
          description: 'All sections are currently meeting performance benchmarks. Maintain current leader support protocols.'
        });
      }

      return list.slice(0, 5); // display top 5 most critical items
    };

    // Absent streak categorization
    const streaks1W = absentStreaks.filter(s => s.current_streak === 1);
    const streaks2W = absentStreaks.filter(s => s.current_streak === 2);
    const streaks3W = absentStreaks.filter(s => s.current_streak === 3);
    const streaks1M = absentStreaks.filter(s => s.current_streak >= 4 && s.current_streak < 12);
    const streaks3M = absentStreaks.filter(s => s.current_streak >= 12);

    const execInsights = getAIExecutiveInsights();
    const actionRecommendations = getActionCenterRecommendations();
    const activeLeaderRows = secLeaderRankings.length ? secLeaderRankings : leaderRankData;
    const normalizeName = value => String(value || '').trim().toLowerCase();
    const rankMovement = value => {
      if (value > 0) return { label: `Up ${value}`, className: 'text-emerald-600', icon: ArrowUp };
      if (value < 0) return { label: `Down ${Math.abs(value)}`, className: 'text-rose-600', icon: ArrowDown };
      return { label: 'No change', className: 'text-slate-500', icon: Minus };
    };
    const sectionStatus = (score, rate, followUpRate) => {
      if (score >= 80 && rate >= 75) return { label: 'Healthy', variant: 'success' };
      if (score >= 60 || rate >= 60 || followUpRate >= 60) return { label: 'Watch', variant: 'warning' };
      return { label: 'Intervention', variant: 'danger' };
    };
    const sectionIntelligence = filteredRankings.map(section => {
      const sectionKey = normalizeName(section.name);
      const headLeader = secHeadLeaders.find(l => normalizeName(l.section_name) === sectionKey) || null;
      const sectionLeaders = activeLeaderRows
        .filter(l => normalizeName(l.section_name) === sectionKey)
        .map((leader, index) => {
          const assigned = Number(leader.assigned_members ?? leader.member_count ?? 0) || 0;
          const active = Number(leader.active_members ?? leader.unique_attendees ?? 0) || 0;
          const inactive = Number(leader.inactive_members ?? Math.max(0, assigned - active)) || 0;
          const present = Number(leader.total_present ?? leader.present ?? leader.unique_attendees ?? 0) || 0;
          const absent = Number(leader.total_absent ?? leader.absent ?? Math.max(0, assigned - active)) || 0;
          const excused = Number(leader.total_excused ?? leader.excused ?? 0) || 0;
          const rate = Number(leader.attendance_rate ?? leader.avg_rate ?? 0) || 0;
          const previousRate = Number(leader.prev_rate ?? 0) || 0;
          const followUpRequired = Number(leader.follow_up_required ?? absent) || 0;
          const followUpCompleted = Number(leader.follow_up_completed ?? 0) || 0;
          const followUpCompletion = followUpRequired > 0
            ? Math.round((followUpCompleted / followUpRequired) * 100)
            : Number(leader.follow_up_completion ?? 100) || 0;
          const retentionPct = Number(leader.retention_rate ?? (assigned > 0 ? (active / assigned) * 100 : 0)) || 0;
          const consistencyPct = Number(leader.consistency_score ?? Math.max(0, 100 - Math.abs(rate - previousRate))) || 0;
          const leadershipScore = Number(leader.efficiency_score ?? leader.performance_score ?? Math.round(rate * 0.35 + retentionPct * 0.25 + consistencyPct * 0.2 + followUpCompletion * 0.2)) || 0;
          const status = sectionStatus(leadershipScore, rate, followUpCompletion);
          return {
            ...leader,
            rank: leader.rank || index + 1,
            assigned_members: assigned,
            active_members: active,
            inactive_members: inactive,
            total_present: present,
            total_absent: absent,
            total_excused: excused,
            attendance_rate: rate,
            prev_rate: previousRate,
            weekly_growth: Number(leader.weekly_growth ?? 0) || 0,
            monthly_growth: Number(leader.monthly_growth ?? 0) || 0,
            yearly_growth: Number(leader.yearly_growth ?? 0) || 0,
            retention_rate: retentionPct,
            consistency_score: consistencyPct,
            follow_up_required: followUpRequired,
            follow_up_completed: followUpCompleted,
            follow_up_completion: followUpCompletion,
            visits_completed: Number(leader.visits_completed ?? 0) || 0,
            counseling_cases: Number(leader.counseling_cases ?? 0) || 0,
            leadership_score: leadershipScore,
            status,
            rank_change: Number(leader.rank_change ?? 0) || 0,
          };
        })
        .sort((a, b) => (b.leadership_score || 0) - (a.leadership_score || 0));
      const sectionStreaks = absentStreaks.filter(m => normalizeName(m.section_name) === sectionKey);
      const absent1wCount = sectionStreaks.filter(m => m.current_streak === 1).length;
      const absent2wCount = sectionStreaks.filter(m => m.current_streak === 2).length;
      const absent3wCount = sectionStreaks.filter(m => m.current_streak === 3).length;
      const absent1mCount = sectionStreaks.filter(m => m.current_streak >= 4 && m.current_streak < 12).length;
      const absent3mCount = sectionStreaks.filter(m => m.current_streak >= 12).length;
      const totalLeaders = sectionLeaders.length;
      const avgLeaderScore = totalLeaders
        ? Math.round(sectionLeaders.reduce((sum, l) => sum + (l.leadership_score || 0), 0) / totalLeaders)
        : 0;
      const sectionHealthScore = Number(section.performance_score ?? Math.round(
        (Number(section.attendance_rate) || 0) * 0.35 +
        (Number(section.retention_rate) || 0) * 0.25 +
        (Number(section.consistency_score) || 0) * 0.2 +
        (Number(section.follow_up_rate) || 0) * 0.2
      )) || 0;
      const status = sectionStatus(sectionHealthScore, section.attendance_rate || 0, section.follow_up_rate || 0);
      const previousRank = Number(section.rank || 0) + Number(section.rank_change || 0);
      const weakestLeader = sectionLeaders[sectionLeaders.length - 1];
      const strongestLeader = sectionLeaders[0];
      const recommendations = [
        section.attendance_rate < 60 ? `Meet with ${headLeader?.leader_name || `${section.name} head leader`} before the next service to review attendance barriers.` : `Maintain the practices keeping ${section.name} at ${R(section.attendance_rate)}% attendance.`,
        section.follow_up_rate < 70 && section.total_absent > 0 ? `Close follow-up gaps for ${section.total_absent} absent markings; assign calls and visits today.` : 'Keep follow-up completion visible in leader check-ins.',
        weakestLeader ? `Coach ${weakestLeader.leader_name} first; current leadership score is ${weakestLeader.leadership_score}/100.` : 'Assign section leaders so member care is not carried by the head leader alone.',
        absent3wCount + absent1mCount + absent3mCount > 0 ? `Prioritize ${absent3wCount + absent1mCount + absent3mCount} members absent three weeks or longer for pastoral care.` : 'No long-streak absentee pressure detected in this section.'
      ];
      return {
        section,
        headLeader,
        sectionLeaders,
        sectionStreaks,
        sectionHealthScore,
        avgLeaderScore,
        status,
        previousRank,
        strongestLeader,
        weakestLeader,
        absent1wCount,
        absent2wCount,
        absent3wCount,
        absent1mCount,
        absent3mCount,
        recommendations,
      };
    });
    const toggleSection = id => {
      if (expandedSectionId === id) setExpandedSectionId(null);
      else { setExpandedSectionId(id); setSectionSubTab('overview'); }
    };
    const MiniMetric = ({ label, value, suffix = '', tone = 'slate' }) => {
      const toneMap = {
        slate: 'text-slate-900 dark:text-white',
        green: 'text-emerald-600 dark:text-emerald-400',
        red: 'text-rose-600 dark:text-rose-400',
        amber: 'text-amber-600 dark:text-amber-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
      };
      return (
        <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`text-lg font-black mt-1 ${toneMap[tone] || toneMap.slate}`}>{value ?? 0}{suffix}</p>
        </div>
      );
    };
    const renderRankMovement = value => {
      const movement = rankMovement(value);
      const Icon = movement.icon;
      return <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${movement.className}`}><Icon className="w-3 h-3" />{movement.label}</span>;
    };
    const renderSectionLeaderRows = leaders => (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              {['Rank', 'Section Leader', 'Active', 'Att %', 'Retention', 'Score', 'Movement', 'Status', 'AI Recommendation'].map((h, i) => (
                <th key={h} className={`py-2 px-2 text-[9px] font-bold uppercase text-slate-400 ${i === 1 || i === 8 ? 'text-left' : 'text-right'} whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaders.map((leader, i) => {
              const diff = (leader.attendance_rate || 0) - (leader.prev_rate || 0);
              const aiText = leader.leadership_score < 60
                ? 'Immediate coaching, follow-up audit, and member contact list review required.'
                : diff < -5
                  ? 'Attendance is declining; ask for cause and recovery plan before next service.'
                  : leader.follow_up_completion < 70
                    ? 'Improve absentee follow-up completion and confirm visits for long absences.'
                    : 'Stable leadership pattern; document practices and maintain cadence.';
              return (
                <tr key={leader.leader_id || leader.leader_name || i} className="border-b border-slate-50 dark:border-slate-700/50">
                  <td className="py-2 px-2 text-right font-bold text-slate-500">#{leader.rank || i + 1}</td>
                  <td className="py-2 px-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">{leader.leader_name}</td>
                  <td className="py-2 px-2 text-right text-emerald-600">{leader.active_members}</td>
                  <td className="py-2 px-2 text-right"><Badge variant={leader.attendance_rate >= 75 ? 'success' : leader.attendance_rate >= 55 ? 'warning' : 'danger'}>{R(leader.attendance_rate)}%</Badge></td>
                  <td className="py-2 px-2 text-right font-bold">{R(leader.retention_rate)}%</td>
                  <td className="py-2 px-2 text-right"><Badge variant={leader.leadership_score >= 75 ? 'success' : leader.leadership_score >= 55 ? 'warning' : 'danger'}>{leader.leadership_score}/100</Badge></td>
                  <td className="py-2 px-2 text-right">{renderRankMovement(leader.rank_change)}</td>
                  <td className="py-2 px-2 text-right"><Badge variant={leader.status.variant}>{leader.status.label}</Badge></td>
                  <td className="py-2 px-2 text-left min-w-[180px] text-slate-500">{aiText}</td>
                </tr>
              );
            })}
            {leaders.length === 0 && (
              <tr><td colSpan="9" className="py-6 text-center text-slate-400">No section leaders assigned or no leader attendance data found for this section.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Period Selection Controls */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <p className="text-[10px] text-slate-500 font-medium">Period comparison</p>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'week', label: 'This Week vs Last Week' },
                { id: 'month', label: 'This Month vs Last Month' },
                { id: 'quarter', label: 'This Quarter vs Last Quarter' },
                { id: 'year', label: 'This Year vs Last Year' },
                { id: 'custom', label: 'Custom Date Ranges' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setSecPeriod(p.id)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                    secPeriod === p.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {secPeriod === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-750">
              <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Period 1 (Current Period)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400">Start Date</label>
                    <input
                      type="date"
                      value={secP1Start}
                      onChange={e => setSecP1Start(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400">End Date</label>
                    <input
                      type="date"
                      value={secP1End}
                      onChange={e => setSecP1End(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Period 2 (Comparison Period)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400">Start Date</label>
                    <input
                      type="date"
                      value={secP2Start}
                      onChange={e => setSecP2Start(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400">End Date</label>
                    <input
                      type="date"
                      value={secP2End}
                      onChange={e => setSecP2End(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loaders and error states */}
        {secLoading && (
          <div className="flex items-center justify-center p-12 text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin text-indigo-500" />
            Loading Section Intelligence & Performance metrics...
          </div>
        )}

        {secError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 inline mr-2 text-rose-600" />
            {secError}
          </div>
        )}

        {!secLoading && !secError && secRankings.length > 0 && (
          <>
            {/* Key Highlights — 4 primary KPIs, 3 secondary on toggle */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`rounded-2xl border p-4 shadow-sm ${healthColor}`}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500/80">Roster Health</p>
                  <p className="text-2xl font-black mt-1">{avgHealthScore}<span className="text-xs font-semibold">/100</span></p>
                  <div className="mt-2"><Badge variant={healthBadge}>{healthStatus}</Badge></div>
                  <p className="text-[10px] text-slate-400 mt-1">Average section performance across all metrics</p>
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Performance Leader</p>
                  <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">{bestSection?.name || '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: bestSection?.performance_score >= 75 ? '#10b981' : '#f59e0b' }}>{bestSection?.performance_score || 0} / 100 score · {R(bestSection?.attendance_rate)}% attendance</p>
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Growth Leader</p>
                  <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">{fastestGrowing?.name || '—'}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">+{fastestGrowing?.new_members || 0} new members added</p>
                </div>

                <div className="rounded-2xl border border-red-200/60 bg-red-50/50 dark:bg-red-950/15 dark:border-red-900/30 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-red-600/80">Requires Review</p>
                  <p className="text-base font-bold text-red-900 dark:text-red-400 truncate mt-1">{attentionSection?.name || '—'}</p>
                  <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">{attentionSection?.performance_score || 0} / 100 score · {R(attentionSection?.attendance_rate)}% attendance</p>
                </div>
              </div>

              <button onClick={() => setShowExtraKPIs(!showExtraKPIs)}
                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                {showExtraKPIs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showExtraKPIs ? 'Hide detailed metrics' : 'Show detailed metrics (Most Improved, Retention Leader, Consistency Leader)'}
              </button>

              {showExtraKPIs && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Most Improved</p>
                    <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">{mostImproved?.name || '—'}</p>
                    {mostImproved && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        +{R((mostImproved.attendance_rate || 0) - (mostImproved.prev_rate || 0))}% rate improvement
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retention Leader</p>
                    <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">{highestRetention?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{R(highestRetention?.retention_rate)}% active retention</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Consistency Leader</p>
                    <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">{mostConsistent?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{mostConsistent?.consistency_score}% stability index</p>
                  </div>
                </div>
              )}
            </div>

            {/* Decision Support — merged insights + actions */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Decision Support</h3>
                  <span className="text-[10px] text-slate-400 font-medium ml-1">· {execInsights.length} insights · {actionRecommendations.length} actions</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">AI-powered analysis with prioritized recommendations for leadership action</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {execInsights.map((ins, i) => {
                  const Icon = ins.icon || Info;
                  const typeClass = ins.type === 'danger' ? 'border-l-2 border-l-rose-400 bg-rose-50/30 dark:bg-rose-950/10' : ins.type === 'success' ? 'border-l-2 border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-l-2 border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10';
                  return (
                    <div key={i} className={`p-3.5 flex items-start gap-3 ${typeClass}`}>
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ins.type === 'danger' ? '#f43f5e' : ins.type === 'success' ? '#10b981' : '#6366f1' }} />
                      <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: ins.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                  );
                })}
                <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {actionRecommendations.map((act, i) => {
                    const borderColor = act.priority === 'high' ? 'border-l-2 border-l-rose-400' : act.priority === 'medium' ? 'border-l-2 border-l-amber-400' : 'border-l-2 border-l-emerald-400';
                    return (
                      <div key={i} className={`p-3.5 flex items-start gap-3 ${borderColor}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${act.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : act.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                          <span className="text-[8px] font-black">{act.priority === 'high' ? '!' : act.priority === 'medium' ? '→' : '✓'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded ${act.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : act.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{act.priority}</span>
                            <span className="text-[9px] font-semibold text-slate-400 uppercase">{act.category}</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white">{act.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{act.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 360-degree Section Performance Dashboard */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">360-degree Section Performance Dashboard</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Each section contains head leader, section leaders, member intelligence, retention, follow-up, AI insights, and immediate actions.</p>
                </div>
                <Badge variant="info">{sectionIntelligence.length} Sections Analyzed</Badge>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {sectionIntelligence.map((item, idx) => {
                  const { section, headLeader, sectionLeaders, sectionStreaks } = item;
                  const isOpen = expandedSectionId === (section.id || section.name);
                  const diff = (section.attendance_rate || 0) - (section.prev_rate || 0);
                  const longAbsentees = item.absent3wCount + item.absent1mCount + item.absent3mCount;
                  const MovementIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
                  return (
                    <div key={section.id || section.name} id={`section-card-${section.id || section.name}`} className="bg-white dark:bg-slate-800 scroll-mt-4">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id || section.name)}
                        className="w-full p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black shrink-0">
                            {section.rank || idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-slate-950 dark:text-white truncate">{section.name}</h4>
                              <Badge variant={item.status.variant}>{item.status.label}</Badge>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                <MovementIcon className="w-3 h-3" />{diff >= 0 ? '+' : ''}{R(diff)}% attendance movement
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Head Leader: <span className="font-semibold text-slate-700 dark:text-slate-300">{headLeader?.leader_name || 'Not assigned'}</span>
                              {' '}• {sectionLeaders.length} section leaders • {section.member_count || 0} active members • {longAbsentees} high-risk absentees
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 lg:min-w-[560px]">
                          <MiniMetric label="Health" value={item.sectionHealthScore} suffix="/100" tone={item.sectionHealthScore >= 75 ? 'green' : item.sectionHealthScore >= 55 ? 'amber' : 'red'} />
                          <MiniMetric label="Leader Score" value={item.avgLeaderScore} suffix="/100" tone={item.avgLeaderScore >= 75 ? 'green' : item.avgLeaderScore >= 55 ? 'amber' : 'red'} />
                          <MiniMetric label="Attendance" value={R(section.attendance_rate)} suffix="%" tone={section.attendance_rate >= 75 ? 'green' : section.attendance_rate >= 55 ? 'amber' : 'red'} />
                          <MiniMetric label="Retention" value={R(section.retention_rate)} suffix="%" tone={section.retention_rate >= 75 ? 'green' : section.retention_rate >= 55 ? 'amber' : 'red'} />
                          <MiniMetric label="Follow-up" value={R(section.follow_up_rate)} suffix="%" tone={section.follow_up_rate >= 75 ? 'green' : section.follow_up_rate >= 55 ? 'amber' : 'red'} />
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {section.id && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/sections?profile=${section.id}`); }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              title="View full section profile"
                            >
                              <Layers className="w-3 h-3" /> View Profile
                            </button>
                          )}
                          <div className="text-slate-400">
                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-5 space-y-4">
                          {/* Sub-tab navigation */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-0.5 rounded-xl w-fit">
                            {['overview', 'leaders', 'members', 'insights'].map(tab => (
                              <button key={tab} onClick={() => setSectionSubTab(tab)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg capitalize transition-all ${
                                  sectionSubTab === tab
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}>
                                {tab === 'overview' && <><BarChart3 className="w-3 h-3 inline mr-1" />Overview</>}
                                {tab === 'leaders' && <><Award className="w-3 h-3 inline mr-1" />Leaders</>}
                                {tab === 'members' && <><UserX className="w-3 h-3 inline mr-1" />Members</>}
                                {tab === 'insights' && <><Brain className="w-3 h-3 inline mr-1" />Insights</>}
                              </button>
                            ))}
                          </div>

                          {sectionSubTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Section Statistics</h5>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <MiniMetric label="Registered" value={section.registered_members || 0} />
                                  <MiniMetric label="Active" value={section.member_count || 0} tone="green" />
                                  <MiniMetric label="Inactive" value={section.inactive_members || 0} tone="red" />
                                  <MiniMetric label="Visitors" value={section.visitors || 0} tone="amber" />
                                  <MiniMetric label="New Members" value={section.new_members || 0} tone="indigo" />
                                  <MiniMetric label="Excused" value={section.total_excused || 0} tone="amber" />
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Award className="w-4 h-4 text-amber-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Rankings</h5>
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between"><span className="text-slate-500">Current Rank</span><span className="font-black">#{section.rank}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Previous Rank</span><span className="font-black">#{item.previousRank || section.rank}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Movement</span>{renderRankMovement(section.rank_change || 0)}</div>
                                  <div className="flex justify-between"><span className="text-slate-500">Strongest Leader</span><span className="font-semibold text-right">{item.strongestLeader?.leader_name || '—'}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Needs Coaching</span><span className="font-semibold text-right">{item.weakestLeader?.leader_name || '—'}</span></div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Shield className="w-4 h-4 text-emerald-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Head Leader</h5>
                                </div>
                                {headLeader ? (
                                  <div className="space-y-2 text-xs">
                                    <p className="font-black text-slate-900 dark:text-white">{headLeader.leader_name}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <MiniMetric label="Managed" value={headLeader.members_managed || 0} />
                                      <MiniMetric label="Leaders" value={headLeader.leaders_supervised || 0} />
                                      <MiniMetric label="Attendance" value={R(headLeader.overall_attendance)} suffix="%" tone="green" />
                                      <MiniMetric label="Submission" value={R(headLeader.submission_rate)} suffix="%" tone="indigo" />
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">No head leader record</p>
                                )}
                              </div>

                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <UserX className="w-4 h-4 text-rose-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Absence Intelligence</h5>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <MiniMetric label="1 Week" value={item.absent1wCount} tone="indigo" />
                                  <MiniMetric label="2 Weeks" value={item.absent2wCount} tone="amber" />
                                  <MiniMetric label="3 Weeks" value={item.absent3wCount} tone="red" />
                                  <MiniMetric label="1 Month" value={item.absent1mCount} tone="red" />
                                  <MiniMetric label="3 Months" value={item.absent3mCount} tone="red" />
                                  <MiniMetric label="Follow-up Needed" value={sectionStreaks.length} tone="red" />
                                </div>
                              </div>
                            </div>
                          )}

                          {sectionSubTab === 'leaders' && (
                            <div>
                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Section Leader Performance</h5>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Metrics from assigned members, attendance, submissions, and follow-up records</p>
                                </div>
                                {renderSectionLeaderRows(sectionLeaders)}
                              </div>
                            </div>
                          )}

                          {sectionSubTab === 'members' && (
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Heart className="w-4 h-4 text-rose-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">Member Intelligence & Follow-up</h5>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                {sectionStreaks.slice(0, 8).map(member => (
                                  <div key={member.member_id} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{member.full_name}</p>
                                      <Badge variant={member.current_streak >= 3 ? 'danger' : member.current_streak === 2 ? 'warning' : 'info'}>{member.current_streak}w</Badge>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Last absent: {member.last_absent_date || 'Not recorded'}</p>
                                    <p className="text-[10px] text-indigo-600 dark:text-indigo-300 mt-1">{member.current_streak >= 3 ? 'Assign visit or pastoral call immediately.' : 'Leader phone call and prayer request check.'}</p>
                                  </div>
                                ))}
                                {sectionStreaks.length === 0 && (
                                  <p className="text-xs text-slate-400">No active absentee streaks</p>
                                )}
                              </div>
                            </div>
                          )}

                          {sectionSubTab === 'insights' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Brain className="w-4 h-4 text-indigo-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">AI Executive Insights</h5>
                                </div>
                                <div className="space-y-2 text-[10px] text-slate-600 dark:text-slate-300">
                                  <p><span className="font-black text-slate-900 dark:text-white">{section.name}</span> is ranked #{section.rank} with a {item.sectionHealthScore}/100 health score and {R(section.attendance_rate)}% attendance.</p>
                                  <p>{diff >= 0 ? 'Attendance is improving or stable compared with the previous period.' : 'Attendance declined compared with the previous period and requires leadership review.'}</p>
                                  <p>{longAbsentees > 0 ? `${longAbsentees} members have been absent three weeks or longer; pastoral follow-up should be prioritized.` : 'No long-term absentee cluster is currently visible from attendance history.'}</p>
                                  <p>{item.weakestLeader ? `${item.weakestLeader.leader_name} is the first coaching priority based on leadership score and attendance movement.` : 'Leader assignment data is incomplete for this section.'}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Target className="w-4 h-4 text-emerald-500" />
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white">Recommended Actions</h5>
                                </div>
                                <div className="space-y-2">
                                  {item.recommendations.map((rec, recIdx) => (
                                    <div key={recIdx} className="flex gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                      <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0">{recIdx + 1}</span>
                                      <p className="text-[10px] text-slate-600 dark:text-slate-300">{rec}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Roster Rankings Table — core columns by default, toggle for extras */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/10">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Roster Rankings & Comparisons</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click column headers to sort. <span className="text-indigo-600 dark:text-indigo-400 font-medium">Click any row to expand the full section breakdown above</span> (members, leaders, AI insights, follow-up).</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAllColumns(!showAllColumns)}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                    {showAllColumns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showAllColumns ? 'Fewer columns' : 'All columns'}
                  </button>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search sections..."
                      value={secSearch}
                      onChange={e => setSecSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/80">
                      <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500 text-center w-12">Rank</th>
                      {renderSortHeader('Section Name', 'name')}
                      {renderSortHeader('Active', 'member_count', 'right')}
                      {renderSortHeader('Att %', 'attendance_rate', 'right')}
                      {renderSortHeader('Retention %', 'retention_rate', 'right')}
                      {renderSortHeader('Score', 'performance_score', 'right')}
                      {renderSortHeader('Movement', 'rank_change', 'right')}
                      {showAllColumns && (
                        <>
                          {renderSortHeader('Registered', 'registered_members', 'right')}
                          {renderSortHeader('Inactive', 'inactive_members', 'right')}
                          {renderSortHeader('Visitors', 'visitors', 'right')}
                          {renderSortHeader('New', 'new_members', 'right')}
                          {renderSortHeader('Present', 'total_present', 'right')}
                          {renderSortHeader('Absent', 'total_absent', 'right')}
                          {renderSortHeader('Excused', 'total_excused', 'right')}
                          {renderSortHeader('Prev %', 'prev_rate', 'right')}
                          {renderSortHeader('Diff %', 'attendance_diff', 'right')}
                          {renderSortHeader('W.Growth', 'weekly_growth', 'right')}
                          {renderSortHeader('M.Growth', 'monthly_growth', 'right')}
                          {renderSortHeader('Y.Growth', 'yearly_growth', 'right')}
                          {renderSortHeader('Consistency %', 'consistency_score', 'right')}
                          {renderSortHeader('Follow-up %', 'follow_up_rate', 'right')}
                          <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500 text-right">Prev Rank</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((row, i) => {
                      const diff = (row.attendance_rate || 0) - (row.prev_rate || 0);
                      const prevRank = row.rank + row.rank_change;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-50 dark:border-slate-750/30 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors"
                          onClick={() => {
                            const secKey = row.id || row.name;
                            if (expandedSectionId !== secKey) {
                              setExpandedSectionId(secKey);
                              setSectionSubTab('overview');
                              document.getElementById(`section-card-${secKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            } else {
                              setExpandedSectionId(null);
                            }
                          }}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[10px] font-black w-6 h-6 inline-flex items-center justify-center rounded-full ${
                              i === 0 ? 'bg-amber-100 text-amber-800' :
                              i === 1 ? 'bg-slate-200 text-slate-700' :
                              i === 2 ? 'bg-orange-100 text-orange-800' :
                              'text-slate-400'
                            }`}>
                              {row.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">{row.name}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400 text-xs">{row.member_count || 0}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                            <Badge variant={row.attendance_rate >= 80 ? 'success' : row.attendance_rate >= 60 ? 'warning' : 'danger'}>
                              {R(row.attendance_rate)}%
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-xs text-slate-700 dark:text-slate-300">{R(row.retention_rate)}%</td>
                          <td className="px-3 py-2.5 text-right text-xs">
                            <Badge variant={row.performance_score >= 80 ? 'success' : row.performance_score >= 60 ? 'warning' : 'danger'}>
                              {row.performance_score}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                            {row.rank_change > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                <ArrowUp className="w-2.5 h-2.5" /> +{row.rank_change}
                              </span>
                            )}
                            {row.rank_change < 0 && (
                              <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                                <ArrowDown className="w-2.5 h-2.5" /> {row.rank_change}
                              </span>
                            )}
                            {row.rank_change === 0 && (
                              <span className="inline-flex items-center gap-0.5 text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                <Minus className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </td>
                          {showAllColumns && (
                            <>
                              <td className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">{row.registered_members || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-rose-500 text-xs">{row.inactive_members || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-amber-600 text-xs">{row.visitors || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-indigo-500 text-xs">+{row.new_members || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-emerald-600 text-xs">{row.total_present?.toLocaleString() || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-rose-500 text-xs">{row.total_absent?.toLocaleString() || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-amber-500 text-xs">{row.total_excused || 0}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-slate-400 text-xs">{row.prev_rate != null ? `${R(row.prev_rate)}%` : '—'}</td>
                              <td className={`px-3 py-2.5 text-right font-bold text-xs whitespace-nowrap ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff >= 0 ? '+' : ''}{R(diff)}%
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">+{row.weekly_growth || 0}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">+{row.monthly_growth || 0}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">+{row.yearly_growth || 0}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-xs text-slate-700 dark:text-slate-300">{row.consistency_score}%</td>
                              <td className="px-3 py-2.5 text-right font-bold text-xs text-indigo-600 dark:text-indigo-400">{row.follow_up_rate || 0}%</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-slate-400 text-xs">#{prevRank}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Follow-up Intelligence Panel */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-750 pb-2 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-sans">Roster Follow-up Intelligence</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Consecutive absentees grouped by streak duration with specific visitation & counseling actions</p>
                </div>
                <Badge variant="danger">{absentStreaks.length} Total Absentees</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* 1 Week Streak */}
                <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/20 p-3 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">1 Week Absent</span>
                      <Badge variant="info">{streaks1W.length}</Badge>
                    </div>
                    <div className="p-2 rounded bg-blue-50/60 dark:bg-blue-950/10 text-[9px] text-blue-700 dark:text-blue-400 font-medium">
                      Action: Send automated wellness SMS check.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {streaks1W.slice(0, 5).map(m => (
                        <div key={m.member_id} className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-slate-400 ml-1">({m.section_name})</span>
                        </div>
                      ))}
                      {streaks1W.length > 5 && <p className="text-[8px] text-slate-400 text-center font-bold">+{streaks1W.length - 5} more members</p>}
                      {streaks1W.length === 0 && <p className="text-[9px] text-slate-400 text-center py-2">No active streaks</p>}
                    </div>
                  </div>
                </div>

                {/* 2 Weeks Streak */}
                <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/20 p-3 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">2 Weeks Absent</span>
                      <Badge variant="warning">{streaks2W.length}</Badge>
                    </div>
                    <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/10 text-[9px] text-amber-700 dark:text-amber-400 font-medium">
                      Action: Section leader phone call for prayer request intake.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {streaks2W.slice(0, 5).map(m => (
                        <div key={m.member_id} className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-slate-400 ml-1">({m.section_name})</span>
                        </div>
                      ))}
                      {streaks2W.length > 5 && <p className="text-[8px] text-slate-400 text-center font-bold">+{streaks2W.length - 5} more members</p>}
                      {streaks2W.length === 0 && <p className="text-[9px] text-slate-400 text-center py-2">No active streaks</p>}
                    </div>
                  </div>
                </div>

                {/* 3 Weeks Streak */}
                <div className="rounded-xl border border-red-200/40 dark:border-red-900/20 bg-red-50/10 p-3 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-red-700 dark:text-red-300">3 Weeks Absent</span>
                      <Badge variant="danger">{streaks3W.length}</Badge>
                    </div>
                    <div className="p-2 rounded bg-rose-50/60 dark:bg-rose-950/10 text-[9px] text-rose-700 dark:text-rose-400 font-medium">
                      Action: Head Leader visitation assignment; queue pastoral care.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {streaks3W.slice(0, 5).map(m => (
                        <div key={m.member_id} className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-slate-400 ml-1">({m.section_name})</span>
                        </div>
                      ))}
                      {streaks3W.length > 5 && <p className="text-[8px] text-slate-400 text-center font-bold">+{streaks3W.length - 5} more members</p>}
                      {streaks3W.length === 0 && <p className="text-[9px] text-slate-400 text-center py-2">No active streaks</p>}
                    </div>
                  </div>
                </div>

                {/* 1 Month Streak */}
                <div className="rounded-xl border border-red-300/40 dark:border-red-900/35 bg-red-50/15 p-3 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-red-800 dark:text-red-400">1 Month Absent</span>
                      <Badge variant="danger">{streaks1M.length}</Badge>
                    </div>
                    <div className="p-2 rounded bg-red-100/60 dark:bg-red-950/20 text-[9px] text-red-800 dark:text-red-300 font-medium">
                      Action: Home visit by Sector Pastor; counseling requirement.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {streaks1M.slice(0, 5).map(m => (
                        <div key={m.member_id} className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-slate-400 ml-1">({m.section_name})</span>
                        </div>
                      ))}
                      {streaks1M.length > 5 && <p className="text-[8px] text-slate-400 text-center font-bold">+{streaks1M.length - 5} more members</p>}
                      {streaks1M.length === 0 && <p className="text-[9px] text-slate-400 text-center py-2">No active streaks</p>}
                    </div>
                  </div>
                </div>

                {/* 3 Months Streak */}
                <div className="rounded-xl border border-slate-300 dark:border-slate-650 bg-slate-200/20 p-3 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-850 dark:text-slate-200">3 Months+ Inactive</span>
                      <Badge variant="danger">{streaks3M.length}</Badge>
                    </div>
                    <div className="p-2 rounded bg-slate-200 dark:bg-slate-700 text-[9px] text-slate-800 dark:text-slate-200 font-medium">
                      Action: Official inactivity review; wellness check visitation.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {streaks3M.slice(0, 5).map(m => (
                        <div key={m.member_id} className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate">
                          <span className="font-bold text-slate-850 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-slate-400 ml-1">({m.section_name})</span>
                        </div>
                      ))}
                      {streaks3M.length > 5 && <p className="text-[8px] text-slate-400 text-center font-bold">+{streaks3M.length - 5} more members</p>}
                      {streaks3M.length === 0 && <p className="text-[9px] text-slate-400 text-center py-2">No inactive streaks</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Leadership Analytics Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Leadership Performance</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Head leader metrics including members managed, submission records, and overall leadership score</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/80">
                      {renderLeadSortHeader('Head Leader', 'leader_name')}
                      {renderLeadSortHeader('Section Managed', 'section_name')}
                      {renderLeadSortHeader('Members Managed', 'members_managed', 'right')}
                      {renderLeadSortHeader('Supervised Leaders', 'leaders_supervised', 'right')}
                      {renderLeadSortHeader('Attendance Perform.', 'overall_attendance', 'right')}
                      {renderLeadSortHeader('Report Submission Rate', 'submission_rate', 'right')}
                      {renderLeadSortHeader('Leadership Score', 'performance_score', 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHeadLeaders.map((lh) => (
                      <tr
                        key={lh.leader_id}
                        className="border-b border-slate-50 dark:border-slate-750/30 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white text-xs">{lh.leader_name}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-500 text-xs">{lh.section_name}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700 dark:text-slate-350 text-xs">{lh.members_managed}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-500 text-xs">{lh.leaders_supervised}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <Badge variant={lh.overall_attendance >= 80 ? 'success' : lh.overall_attendance >= 60 ? 'warning' : 'danger'}>
                            {R(lh.overall_attendance)}%
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <Badge variant={lh.submission_rate >= 90 ? 'success' : lh.submission_rate >= 70 ? 'warning' : 'danger'}>
                            {lh.submission_rate}%
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <Badge variant={lh.performance_score >= 80 ? 'success' : lh.performance_score >= 60 ? 'warning' : 'danger'}>
                            {lh.performance_score}/100
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {sortedHeadLeaders.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-6 text-slate-400 text-xs">No section leadership data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!secLoading && !secError && secRankings.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No section attendance data available for the current period selection.
          </div>
        )}
      </div>
    );
  };

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
    const rawMembers = asArray(analytics.memberIntelligence);
    const daysBetween = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    };
    const durationLabel = (dateStr) => {
      const days = daysBetween(dateStr);
      if (days == null) return 'Unknown';
      if (days < 30) return `${days} days`;
      if (days < 365) return `${Math.floor(days / 30)} months`;
      return `${Math.floor(days / 365)} years`;
    };
    const riskInfo = (member) => {
      const absences = Number(member.consecutive_absences || 0);
      const rate = Number(member.attendance_rate || 0);
      const daysSince = Number(member.days_since_last_attendance || 9999);
      if (absences >= 12 || daysSince >= 180 || (rate < 20 && member.total_records > 0)) return { label: 'Critical', variant: 'danger', score: 4 };
      if (absences >= 4 || daysSince >= 60 || rate < 40) return { label: 'High', variant: 'danger', score: 3 };
      if (absences >= 2 || daysSince >= 21 || rate < 60) return { label: 'Medium', variant: 'warning', score: 2 };
      return { label: 'Low', variant: 'success', score: 1 };
    };
    const members = rawMembers.map((m, index) => {
      const attendanceRate = Number(m.attendance_rate || 0);
      const previousRate = Number(m.previous_attendance_rate || 0);
      const presentCount = Number(m.present_count || 0);
      const absentCount = Number(m.absent_count || 0);
      const excusedCount = Number(m.excused_count || 0);
      const totalRecords = Number(m.total_records || 0);
      const weeklyGrowthValue = Number(m.weekly_present || 0) - Number(m.previous_weekly_present || 0);
      const monthlyGrowthValue = Number(m.monthly_present || 0) - Number(m.previous_monthly_present || 0);
      const daysSince = daysBetween(m.last_attendance_date);
      const retentionScore = Number(m.retention_score || attendanceRate || 0);
      const engagementScore = Number(m.engagement_score || Math.round(attendanceRate * 0.8 + Math.min(20, presentCount)) || 0);
      const healthScore = Math.max(0, Math.min(100, Math.round(
        attendanceRate * 0.35 +
        retentionScore * 0.25 +
        engagementScore * 0.25 +
        Math.max(0, 15 - Number(m.consecutive_absences || 0) * 3)
      )));
      const enriched = {
        ...m,
        current_rank: index + 1,
        previous_rank: index + 1,
        rank_movement: 0,
        membership_duration: durationLabel(m.registered_date),
        attendance_rate: attendanceRate,
        present_count: presentCount,
        absent_count: absentCount,
        excused_count: excusedCount,
        previous_attendance_rate: previousRate,
        attendance_difference: attendanceRate - previousRate,
        weekly_growth: weeklyGrowthValue,
        monthly_growth: monthlyGrowthValue,
        longest_attendance_streak: Number(m.longest_attendance_streak || m.current_attendance_streak || 0),
        current_attendance_streak: Number(m.current_attendance_streak || 0),
        consecutive_absences: Number(m.consecutive_absences || 0),
        days_since_last_attendance: daysSince == null ? 9999 : daysSince,
        active_status: Number(m.is_active) === 0 ? 'Inactive' : 'Active',
        follow_up_status: m.follow_up_status || (Number(m.consecutive_absences || 0) > 0 ? 'Pending' : 'Not Required'),
        prayer_request_status: m.prayer_requests && m.prayer_requests !== '[]' ? 'Has Prayer Request' : 'None',
        notes: m.follow_up_notes || '',
        retention_score: retentionScore,
        engagement_score: engagementScore,
        overall_member_health_score: healthScore,
        visitor_conversion: Boolean(m.visitor_date),
        no_attendance_history: totalRecords === 0,
      };
      const risk = riskInfo(enriched);
      return { ...enriched, risk_level: risk.label, risk_variant: risk.variant, risk_score: risk.score };
    }).sort((a, b) => {
      const issueDiff = (b.absent_count + b.excused_count + b.risk_score) - (a.absent_count + a.excused_count + a.risk_score);
      if (issueDiff !== 0) return issueDiff;
      return a.attendance_rate - b.attendance_rate;
    });

    members.forEach((member, index) => {
      member.current_rank = index + 1;
      member.previous_rank = index + 1 + (member.attendance_difference < -5 ? -1 : member.attendance_difference > 5 ? 1 : 0);
      member.rank_movement = member.previous_rank - member.current_rank;
    });

    const categoryDefinitions = [
      { id: 'all', label: 'All Members', test: () => true },
      { id: 'most-active', label: 'Most Active Members', test: m => m.attendance_rate >= 80 },
      { id: 'perfect', label: 'Perfect Attendance Members', test: m => m.attendance_rate >= 100 && m.total_records > 0 },
      { id: 'consistent', label: 'Consistent Members', test: m => m.current_attendance_streak >= 3 || m.engagement_score >= 75 },
      { id: 'improving', label: 'Improving Members', test: m => m.attendance_difference >= 10 },
      { id: 'declining', label: 'Declining Members', test: m => m.attendance_difference <= -10 },
      { id: 'new', label: 'New Members', test: m => daysBetween(m.registered_date) != null && daysBetween(m.registered_date) <= 30 },
      { id: 'returning', label: 'Returning Members', test: m => m.previous_attendance_rate < 30 && m.attendance_rate >= 50 },
      { id: 'visitors', label: 'Visitors', test: m => m.visitor_conversion },
      { id: 'recently-baptized', label: 'Recently Baptized Members', test: m => String(m.flags || '').toLowerCase().includes('bapt') },
      { id: 'youth', label: 'Youth Members', test: m => String(m.age_group || '').toLowerCase().includes('youth') },
      { id: 'adult', label: 'Adult Members', test: m => String(m.age_group || '').toLowerCase().includes('adult') },
      { id: 'senior', label: 'Senior Members', test: m => String(m.age_group || '').toLowerCase().includes('senior') },
      { id: 'men', label: 'Men', test: m => String(m.gender || '').toLowerCase().startsWith('m') },
      { id: 'women', label: 'Women', test: m => String(m.gender || '').toLowerCase().startsWith('f') || String(m.gender || '').toLowerCase().startsWith('w') },
      { id: 'missing-1', label: 'Members Missing One Service', test: m => m.consecutive_absences === 1 },
      { id: 'missing-2', label: 'Members Missing Two Consecutive Services', test: m => m.consecutive_absences === 2 },
      { id: 'missing-3', label: 'Members Missing Three Consecutive Services', test: m => m.consecutive_absences === 3 },
      { id: 'missing-1m', label: 'Members Missing One Month', test: m => m.consecutive_absences >= 4 && m.consecutive_absences < 12 },
      { id: 'missing-3m', label: 'Members Missing Three Months', test: m => m.consecutive_absences >= 12 },
      { id: 'visitation', label: 'Members Requiring Visitation', test: m => m.consecutive_absences >= 3 || m.days_since_last_attendance >= 30 },
      { id: 'counseling', label: 'Members Requiring Counseling', test: m => m.consecutive_absences >= 4 || String(m.notes || '').toLowerCase().includes('counsel') },
      { id: 'prayer', label: 'Members Requiring Prayer Support', test: m => m.prayer_request_status !== 'None' || m.risk_level !== 'Low' },
      { id: 'leaving-risk', label: 'Members at Risk of Leaving Church', test: m => ['High', 'Critical'].includes(m.risk_level) },
      { id: 'no-history', label: 'Members with No Attendance History', test: m => m.no_attendance_history },
    ];
    const categories = categoryDefinitions.map(cat => ({ ...cat, members: members.filter(cat.test) }));
    const activeCategory = categories.find(c => c.id === memberCategory) || categories[0];
    const byRisk = memberRiskFilter === 'all' ? activeCategory.members : activeCategory.members.filter(m => m.risk_level === memberRiskFilter);
    const filteredMembers = byRisk.filter(m => {
      if (!memberSearch) return true;
      const haystack = [m.full_name, m.gender, m.age_group, m.section_name, m.head_leader_name, m.leader_name, m.risk_level, m.follow_up_status].join(' ').toLowerCase();
      return haystack.includes(memberSearch.toLowerCase());
    });

    const avg = list => list.length ? Math.round(list.reduce((sum, m) => sum + (Number(m.attendance_rate) || 0), 0) / list.length) : 0;
    const activeMembers = members.filter(m => m.active_status === 'Active');
    const newMembers = categories.find(c => c.id === 'new')?.members || [];
    const returningMembers = categories.find(c => c.id === 'returning')?.members || [];
    const visitorConversions = categories.find(c => c.id === 'visitors')?.members || [];
    const perfectMembers = categories.find(c => c.id === 'perfect')?.members || [];
    const consistentMembers = categories.find(c => c.id === 'consistent')?.members || [];
    const atRiskMembers = categories.find(c => c.id === 'leaving-risk')?.members || [];
    const inactiveMembers = members.filter(m => m.active_status === 'Inactive' || m.days_since_last_attendance >= 90 || m.attendance_rate < 20);
    const immediateFollowUp = members.filter(m => m.risk_level === 'Critical' || m.consecutive_absences >= 3);
    const visitationMembers = categories.find(c => c.id === 'visitation')?.members || [];
    const counselingMembers = categories.find(c => c.id === 'counseling')?.members || [];
    const longestStreak = members.reduce((max, m) => Math.max(max, m.longest_attendance_streak || 0), 0);
    const weeklyRetention = activeMembers.length ? Math.round((activeMembers.filter(m => m.weekly_present > 0).length / activeMembers.length) * 100) : 0;
    const monthlyRetention = activeMembers.length ? Math.round((activeMembers.filter(m => m.monthly_present > 0).length / activeMembers.length) * 100) : 0;
    const overallHealth = members.length ? Math.round(members.reduce((sum, m) => sum + m.overall_member_health_score, 0) / members.length) : 0;
    const memberRecordTotals = {
      present: members.reduce((sum, m) => sum + (Number(m.present_count) || 0), 0),
      absent: members.reduce((sum, m) => sum + (Number(m.absent_count) || 0), 0),
      excused: members.reduce((sum, m) => sum + (Number(m.excused_count) || 0), 0),
    };
    const memberRecordTotal = memberRecordTotals.present + memberRecordTotals.absent + memberRecordTotals.excused;
    const retainedMembers = members.filter(m => m.retention_score >= 60);
    const lostMembers = members.filter(m => m.risk_level === 'Critical');
    const recoveredMembers = returningMembers;
    const recoveryPct = lostMembers.length ? Math.round((recoveredMembers.length / lostMembers.length) * 100) : 0;
    const topRiskSection = sectionRankings.length
      ? sectionRankings.map(s => ({ name: s.name, count: atRiskMembers.filter(m => m.section_name === s.name).length })).sort((a, b) => b.count - a.count)[0]
      : null;
    const topRetentionSection = sectionRankings.length
      ? sectionRankings.map(s => ({ name: s.name, rate: avg(members.filter(m => m.section_name === s.name)) })).sort((a, b) => b.rate - a.rate)[0]
      : null;

    const kpis = [
      { label: 'Total Active Members', value: activeMembers.length, category: 'all', icon: Users },
      { label: 'New Members This Period', value: newMembers.length, category: 'new', icon: UserCheck },
      { label: 'Returning Members', value: returningMembers.length, category: 'returning', icon: RefreshCw },
      { label: 'Visitor Conversions', value: visitorConversions.length, category: 'visitors', icon: Star },
      { label: 'Perfect Attendance', value: perfectMembers.length, category: 'perfect', icon: Award },
      { label: 'Most Consistent Members', value: consistentMembers.length, category: 'consistent', icon: CheckCircle2 },
      { label: 'Members at Risk', value: atRiskMembers.length, category: 'leaving-risk', icon: AlertTriangle },
      { label: 'Inactive Members', value: inactiveMembers.length, category: 'leaving-risk', icon: UserX },
      { label: 'Immediate Follow-up', value: immediateFollowUp.length, category: 'missing-3', icon: Target },
      { label: 'Require Visitation', value: visitationMembers.length, category: 'visitation', icon: Heart },
      { label: 'Require Counseling', value: counselingMembers.length, category: 'counseling', icon: Brain },
      { label: 'Longest Streak', value: longestStreak, category: 'most-active', icon: Flame },
      { label: 'Average Attendance Rate', value: `${avg(members)}%`, category: 'all', icon: Activity },
      { label: 'Weekly Retention Rate', value: `${weeklyRetention}%`, category: 'all', icon: Calendar },
      { label: 'Monthly Retention Rate', value: `${monthlyRetention}%`, category: 'all', icon: Shield },
      { label: 'Member Health Score', value: `${overallHealth}/100`, category: 'all', icon: Heart },
    ];

    const insights = [
      members.length ? `Average member attendance is ${avg(members)}% across ${members.length} tracked member records.` : 'No member attendance history is available for this period.',
      returningMembers.length ? `${returningMembers.length} members have returned after weak previous attendance.` : 'No returning-member recovery pattern detected yet.',
      perfectMembers.length ? `${perfectMembers.length} members maintained perfect attendance in the selected period.` : 'No perfect-attendance members detected for this period.',
      topRiskSection?.count > 0 ? `${topRiskSection.name} has the highest number of at-risk members (${topRiskSection.count}).` : 'No section currently dominates at-risk member pressure.',
      topRetentionSection ? `${topRetentionSection.name} has the strongest member retention profile at ${topRetentionSection.rate}%.` : 'Section retention cannot be ranked until member data is available.',
      immediateFollowUp.length ? `${immediateFollowUp.length} members require immediate pastoral follow-up or visitation.` : 'No immediate critical follow-up queue detected.',
      categories.find(c => c.id === 'women')?.members.length && categories.find(c => c.id === 'youth')?.members.length
        ? `Women's attendance averages ${avg(categories.find(c => c.id === 'women').members)}% while youth attendance averages ${avg(categories.find(c => c.id === 'youth').members)}%.`
        : 'Gender and age-group attendance comparisons need more member profile data.',
    ];
    const actions = [
      { title: 'Visit Members', category: 'visitation', members: visitationMembers, priority: visitationMembers.length ? 'high' : 'low' },
      { title: 'Make Follow-up Calls', category: 'missing-2', members: members.filter(m => m.consecutive_absences >= 2), priority: 'high' },
      { title: 'Assign Prayer Support', category: 'prayer', members: categories.find(c => c.id === 'prayer')?.members || [], priority: 'medium' },
      { title: 'Schedule Counseling', category: 'counseling', members: counselingMembers, priority: 'high' },
      { title: 'Recognize Perfect Attendance Members', category: 'perfect', members: perfectMembers, priority: 'low' },
      { title: 'Welcome New Members', category: 'new', members: newMembers, priority: 'medium' },
      { title: 'Encourage Returning Members', category: 'returning', members: returningMembers, priority: 'medium' },
      { title: 'Review At-Risk Members with Section Leaders', category: 'leaving-risk', members: atRiskMembers, priority: 'high' },
      { title: 'Meet with Sections Showing Declining Engagement', category: 'declining', members: categories.find(c => c.id === 'declining')?.members || [], priority: 'medium' },
    ];
    const openCategory = (id) => setMemberCategory(id);
    const renderPriorityBadge = p => <Badge variant={p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'success'}>{p}</Badge>;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"><UserCheck className="w-6 h-6 text-indigo-600" /></div>
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Member Intelligence & Pastoral Care Center</h3>
              <p className="text-xs text-slate-500">Executive member health, retention, engagement, attendance behavior, and pastoral care priorities.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpis.map(({ label, value, category, icon: Icon }) => (
            <button key={label} type="button" onClick={() => openCategory(category)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${memberCategory === category ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20' : 'border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                <Icon className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-xl font-black text-slate-950 dark:text-white mt-2">{value}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">Member Intelligence Record Window</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Counts below are calculated from member attendance history for the last 180 days - {serviceLabel}.</p>
            </div>
            <Badge variant="info">{memberRecordTotal.toLocaleString()} tracked records</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-400">Historical Present</p>
              <p className="text-xl font-black text-emerald-600">{memberRecordTotals.present}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-400">Historical Absent</p>
              <p className="text-xl font-black text-rose-600">{memberRecordTotals.absent}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-400">Historical Excused</p>
              <p className="text-xl font-black text-amber-600">{memberRecordTotals.excused}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Attendance Behavior Analysis</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Average Attendance</p><p className="text-lg font-black">{avg(members)}%</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Improving</p><p className="text-lg font-black text-emerald-600">{categories.find(c => c.id === 'improving')?.members.length || 0}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Declining</p><p className="text-lg font-black text-rose-600">{categories.find(c => c.id === 'declining')?.members.length || 0}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Consistency</p><p className="text-lg font-black">{consistentMembers.length}</p></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Member Retention Intelligence</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Retained</p><p className="text-lg font-black text-emerald-600">{retainedMembers.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Lost/Critical</p><p className="text-lg font-black text-rose-600">{lostMembers.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Recovered</p><p className="text-lg font-black text-indigo-600">{recoveredMembers.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Recovery %</p><p className="text-lg font-black">{recoveryPct}%</p></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Member Movement Analysis</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">New Registrations</p><p className="text-lg font-black">{newMembers.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Conversions</p><p className="text-lg font-black">{visitorConversions.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Returning</p><p className="text-lg font-black">{returningMembers.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3"><p className="text-slate-400">Removed/Inactive</p><p className="text-lg font-black">{inactiveMembers.length}</p></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Pastoral Care Intelligence</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['missing-1', 'missing-2', 'missing-3', 'missing-1m', 'missing-3m', 'visitation', 'counseling', 'prayer'].map(id => {
                const cat = categories.find(c => c.id === id);
                return <button key={id} onClick={() => openCategory(id)} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3 text-left"><p className="text-[9px] font-bold text-slate-400 uppercase">{cat?.label}</p><p className="text-lg font-black mt-1">{cat?.members.length || 0}</p></button>;
              })}
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Executive Insights</h3>
            <div className="space-y-2">
              {insights.map((text, i) => <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3 text-xs text-slate-600 dark:text-slate-300">{text}</div>)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Action Center</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {actions.map(action => (
              <button key={action.title} type="button" onClick={() => openCategory(action.category)} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3 text-left hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between gap-2">{renderPriorityBadge(action.priority)}<span className="text-xs font-black text-slate-900 dark:text-white">{action.members.length} members</span></div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-2">{action.title}</p>
                <p className="text-[10px] text-slate-500 mt-1">Open drill-down list for affected members.</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Intelligence Drill-down</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{activeCategory.label}: {filteredMembers.length} member(s)</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search member, leader, section..." className="pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white lg:min-w-[280px] w-full focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setMemberCategory(cat.id)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${memberCategory === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                  {cat.label} · {cat.members.length}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Risk:</span>
              {['all', 'Low', 'Medium', 'High', 'Critical'].map(r => (
                <button key={r} onClick={() => setMemberRiskFilter(r)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${memberRiskFilter === r ? r === 'Critical' ? 'bg-rose-600 text-white border-rose-600' : r === 'High' ? 'bg-amber-500 text-white border-amber-500' : r === 'Medium' ? 'bg-blue-600 text-white border-blue-600' : r === 'Low' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {memberView === 'summary' ? 'Member P/A/E Summary' : 'Weekly Attendance Matrix'}
              </h4>
              <button onClick={() => setMemberView(memberView === 'summary' ? 'matrix' : 'summary')}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                {memberView === 'summary' ? <><BarChart3 className="w-3 h-3" /> Show Weekly Matrix</> : <><Users className="w-3 h-3" /> Show Summary</>}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {memberView === 'matrix' && (
                <div className="flex flex-col">
                  <label className="text-[9px] font-medium text-slate-400 mb-0.5">Weeks</label>
                  <select value={memberWeeksCount} onChange={e => { const n = Number(e.target.value); setMemberWeeksCount(n); loadMemberWeeklyMatrix(n); }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value={4}>4 weeks</option>
                    <option value={8}>8 weeks</option>
                    <option value={12}>12 weeks</option>
                    <option value={16}>16 weeks</option>
                    <option value={24}>24 weeks</option>
                    <option value={52}>52 weeks</option>
                  </select>
                </div>
              )}
              {memberView === 'matrix' && (
                <div className="flex items-center gap-2 ml-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Legend:</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300"><span className="w-3 h-3 rounded bg-emerald-500" />P</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 dark:text-rose-300"><span className="w-3 h-3 rounded bg-rose-500" />A</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-300"><span className="w-3 h-3 rounded bg-amber-500" />E</span>
                </div>
              )}
            </div>
          </div>
          {memberView === 'summary' ? (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-right py-2 px-3 font-semibold text-slate-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Member</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-500">Section</th>
                    <th className="text-right py-2 px-3 font-semibold text-emerald-600">Present</th>
                    <th className="text-right py-2 px-3 font-semibold text-rose-600">Absent</th>
                    <th className="text-right py-2 px-3 font-semibold text-amber-600">Excused</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Streak</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Movement</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-500">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 && (
                    <tr><td colSpan="10" className="py-12 text-center text-slate-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      {rawMembers.length === 0 ? 'No member intelligence data available. Try changing the date range or service filter.' : 'No members match the current filters.'}
                    </td></tr>
                  )}
                  {filteredMembers.map(m => {
                    const streak = Number(m.current_attendance_streak || 0);
                    const absences = Number(m.consecutive_absences || 0);
                    return (
                    <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                      onClick={() => openMemberAttendanceDetails(m)}>
                      <td className="py-2 px-3 text-right">
                        <span className={`text-[10px] font-black w-5 h-5 inline-flex items-center justify-center rounded-full ${(m.current_rank || 1) === 1 ? 'bg-amber-100 text-amber-800' : (m.current_rank || 1) === 2 ? 'bg-slate-200 text-slate-700' : (m.current_rank || 1) === 3 ? 'bg-orange-100 text-orange-800' : 'text-slate-400'}`}>
                          {m.current_rank || ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{m.full_name}</td>
                      <td className="py-2 px-3 text-slate-500">{m.section_name || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">{Number(m.present_count) || 0}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">{Number(m.absent_count) || 0}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-600">{Number(m.excused_count) || 0}</td>
                      <td className="py-2 px-3 text-right font-semibold text-indigo-600">{m.attendance_rate || 0}%</td>
                      <td className="py-2 px-3 text-center">
                        {streak > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full" title={`${streak} consecutive present`}>
                            <Flame className="w-3 h-3" />{streak}
                          </span>
                        ) : absences > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300 px-1.5 py-0.5 rounded-full" title={`${absences} consecutive absences`}>
                            <XCircle className="w-3 h-3" />{absences}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {m.rank_movement > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold text-[10px]"><ArrowUp className="w-3 h-3" />{m.rank_movement}</span>
                        )}
                        {m.rank_movement < 0 && (
                          <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold text-[10px]"><ArrowDown className="w-3 h-3" />{Math.abs(m.rank_movement)}</span>
                        )}
                        {(!m.rank_movement || m.rank_movement === 0) && (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          m.risk_level === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                          m.risk_level === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                          m.risk_level === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}>{m.risk_level || 'low'}</span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : memberWeeklyMatrix && memberWeeklyMatrix.length > 0 ? (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <div className="min-w-max">
                {/* Header row */}
                <div className="flex bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase text-slate-500 sticky top-0 z-20">
                  <div className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900/40 w-40 shrink-0 px-3 py-2">Member</div>
                  <div className="w-24 shrink-0 px-3 py-2">Section</div>
                  {memberWeeklyMatrixWeeks.map(w => (
                    <div key={w} className="w-14 shrink-0 px-1 py-2 text-center" title={w}>{weekToDate(w)}</div>
                  ))}
                </div>
                {/* Data rows */}
                {memberWeeklyMatrix.filter(m => {
                  if (!memberSearch) return true;
                  const haystack = [m.full_name, m.section_name, m.membership_id].join(' ').toLowerCase();
                  return haystack.includes(memberSearch.toLowerCase());
                }).map(m => (
                  <div key={m.member_id} className="flex border-b border-slate-100 dark:border-slate-700/50 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <div className="sticky left-0 z-10 bg-white dark:bg-slate-800 w-40 shrink-0 px-3 py-2.5 font-semibold text-slate-900 dark:text-white truncate">{m.full_name}</div>
                    <div className="w-24 shrink-0 px-3 py-2.5 text-slate-500 truncate" title={m.section_name || ''}>{m.section_name || '—'}</div>
                    {asArray(m.weekly).map((status, wi) => (
                      <div key={wi} className="w-14 shrink-0 px-1 py-2 text-center">
                        {status === 'present' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 text-[10px] font-bold" title="Present">P</span>}
                        {status === 'absent' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-700 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-200 text-[10px] font-bold" title="Absent">A</span>}
                        {status === 'excused' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 text-[10px] font-bold" title="Excused">E</span>}
                        {!status && <span className="text-slate-300 dark:text-slate-600">·</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : memberWeeklyLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm"><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Loading member attendance matrix...</div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">No weekly attendance data available. Select a different period or service.</div>
          )}
        </div>

        {selectedMemberDetails && createPortal((
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8 backdrop-blur-sm" onClick={() => setSelectedMemberDetails(null)}>
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">{selectedMemberDetails.member?.full_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedMemberDetails.member?.section_name || 'No section'} · {selectedMemberDetails.member?.leader_name || 'No leader'} · {selectedMemberDetails.member?.membership_id || 'No membership ID'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedMemberDetails(null)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(90vh-90px)] space-y-4">
                {memberDetailsError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300">
                    {memberDetailsError}
                  </div>
                )}

                {memberDetailsLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">Loading member attendance information...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Records</p>
                        <p className="text-xl font-black text-slate-950 dark:text-white">{selectedMemberDetails.stats?.total || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Present</p>
                        <p className="text-xl font-black text-emerald-600">{selectedMemberDetails.stats?.present || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Absent</p>
                        <p className="text-xl font-black text-rose-600">{selectedMemberDetails.stats?.absent || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Excused</p>
                        <p className="text-xl font-black text-amber-600">{selectedMemberDetails.stats?.excused || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Rate</p>
                        <p className="text-xl font-black text-indigo-600">{selectedMemberDetails.stats?.attendance_rate || 0}%</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Attendance Records</h4>
                        <p className="text-[10px] text-slate-400">
                          {fdate(selectedMemberDetails.date_range?.start)} to {fdate(selectedMemberDetails.date_range?.end)} · {serviceLabel}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              {['Date', 'Status', 'Service', 'Submitted By', 'Submitted At'].map(h => (
                                <th key={h} className="py-2.5 px-3 text-left text-[10px] font-bold uppercase text-slate-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedMemberDetails.records || []).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">No attendance records found for this member in the selected window.</td>
                              </tr>
                            ) : selectedMemberDetails.records.map(record => {
                              return (
                                <tr key={record.id} className="border-b border-slate-50 dark:border-slate-800">
                                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{fdate(record.date)}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant={record.status === 'present' ? 'success' : record.status === 'excused' ? 'warning' : 'danger'}>{record.status}</Badge>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{record.service_name}</td>
                                  <td className="py-2.5 px-3 text-slate-500">{record.submitted_by_name || 'Unknown'}</td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                    <div className="font-medium text-slate-700 dark:text-slate-200">{fdatetime(record.submitted_at)}</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ), document.body)}
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
                        <td className="py-2 px-3 text-left font-medium text-slate-900 dark:text-white">{fdate(t.date)}</td>
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

  return (
    <div className="space-y-3 animate-fade-in">
      {/* ── Single Compact Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <Eye className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Executive Attendance Intelligence</h2>
            <p className="text-[11px] text-slate-400">Numbers-first business intelligence for strategic decisions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setQuickActionsOpen(o => !o)} onBlur={() => setTimeout(() => setQuickActionsOpen(false), 150)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Actions <ChevronDown className="w-3 h-3" />
            </button>
            {quickActionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-50 py-1">
                {[
                  { label: 'Download PDF', icon: Download, onClick: () => window.print(), color: 'text-blue-600' },
                  { label: 'Print Report', icon: Printer, onClick: () => window.print(), color: 'text-slate-600' },
                  { label: 'Generate AI Report', icon: Brain, onClick: () => setActiveTab('ai'), color: 'text-violet-600' },
                ].map(({ label, icon: I, onClick, color }) => (
                  <button key={label} onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <I className={`w-3.5 h-3.5 ${color}`} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={loadAnalytics} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Single Filter Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterValue(''); }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="yearly">This Year</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          <option value="last90">Last 90 Days</option>
          <option value="custom">Custom Date</option>
        </select>
        {filterType !== 'custom' ? (
          <input type="date" value={filterValue || ''} onChange={e => setFilterValue(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        ) : (
          <div className="flex items-center gap-1">
            <input type="date" value={customDate1} onChange={e => setCustomDate1(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none w-32" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" value={customDate2} onChange={e => setCustomDate2(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none w-32" />
          </div>
        )}
        <div className="flex-1" />
      </div>

      {/* ── Primary Navigation (6 tabs) ── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {(analyticsLoading || overviewLoading) ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div>{renderTabContent()}</div>
      )}
    </div>
  );
};

export default AttendanceReports;
