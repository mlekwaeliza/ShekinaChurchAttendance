import React, { Suspense, lazy, useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  Printer,
  Shield,
  Award,
  Clock,
  Eye,
  CheckCircle2,
  Heart,
  Brain,
  UserX,
  Star,
  Info,
  ChevronDown,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import { R, asArray, TABS } from './reports/reportShared';

// Tab modules split into separate chunks — each tab's code (and its
// data, fetched lazily in batch-4 work) loads only when first visited.
const ExecutiveComparison = lazy(() => import('./ExecutiveComparison'));
const ExecutiveSummary = lazy(() => import('./ExecutiveSummary'));
const DepartmentsTab = lazy(() => import('./reports/DepartmentsTab'));
const HistoryTab = lazy(() => import('./reports/HistoryTab'));
const InsightsTab = lazy(() => import('./reports/InsightsTab'));
const MembersTab = lazy(() => import('./reports/MembersTab'));
const SectionsTab = lazy(() => import('./reports/SectionsTab'));

const TabFallback = () => (
  <div className="flex items-center justify-center py-16" aria-label="Loading tab">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/* MetricCard, IntelligenceTable, InsightCard and shared helpers live in
   ./reports/reportShared.jsx — imported above. */

const AttendanceReports = ({
  filterType,
  setFilterType,
  filterValue,
  setFilterValue,
  overviewData,
  overviewLoading,
  serviceTypes = [],
  selectedServiceId,
  loadOverview
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [, setDepartmentsLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState({});
  const [comparisonMode] = useState('week');
  const [historicalPeriod, setHistoricalPeriod] = useState('monthly');
  const [customDate1, setCustomDate1] = useState('');
  const [customDate2, setCustomDate2] = useState('');
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

  useEffect(() => {
    if (filterValue) loadOverview();
  }, [filterType, filterValue, selectedServiceId, loadOverview]);
  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedServiceId,
    filterType,
    filterValue,
    overviewData?.filterValue,
    overviewData?.requestedFilterValue,
    overviewData?.service_id
  ]);

  const modeToDays = { today: 1, week: 7, month: 30, quarter: 90, year: 365, custom: 30 };
  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const loadDepartments = async (mode) => {
    setDepartmentsLoading(true);
    try {
      const days = modeToDays[mode] || 30;
      const res = await analyticsAPI.getDepartments(days);
      setDepartmentsData(asArray(res.data));
    } catch (e) {
      console.error('Failed to load departments:', e);
      setDepartmentsData([]);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // Departments feed the performance tab only — load on first visit, retry
  // on revisit while empty (e.g. after a failed load).
  useEffect(() => {
    if (activeTab === 'performance' && departmentsData.length === 0) {
      loadDepartments(comparisonMode);
    }
  }, [activeTab, comparisonMode, departmentsData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: a legacy loadComparisonData fan-out (getComparison, leader
  // trends, service comparison ×2 each) was removed — it wrote only to
  // write-only state no tab reads, while toggling the page loading flag.
  // The compare tab renders ExecutiveComparison, which fetches its own data.

  const modeToMonths = { daily: 1, weekly: 3, monthly: 12, quarterly: 24, yearly: 60 };

  const loadHistoricalData = async (period) => {
    const months = modeToMonths[period] || 12;
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - months, 1);
    try {
      const res = await analyticsAPI.getHistorical({
        startDate: toDateStr(start),
        endDate: toDateStr(end)
      });
      const d = res.data || {};
      const s = d.stats || {};
      const daily = (d.daily || []).map((r) => ({
        date: r.date,
        present_count: r.present || 0,
        absent_count: r.absent || 0,
        excused_count: r.excused || 0,
        total_members: r.total || 0,
        rate: r.rate || 0
      }));
      setHistoricalData({
        highest: s.highest_attendance || 0,
        lowest: s.lowest_attendance || 0,
        average:
          s.total_records > 0 ? Math.round((s.highest_attendance + s.lowest_attendance) / 2) : 0,
        total_records: s.total_records || 0,
        avg_rate: s.avg_rate || 0,
        daily
      });
    } catch (e) {
      setHistoricalData({});
    }
  };

  useEffect(() => {
    loadHistoricalData(historicalPeriod);
  }, [historicalPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSecDates = (period) => {
    const now = new Date();
    let cStart, cEnd, pStart, pEnd;
    switch (period) {
      case 'week': {
        const dow = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const pMon = new Date(mon);
        pMon.setDate(mon.getDate() - 7);
        const pSun = new Date(sun);
        pSun.setDate(sun.getDate() - 7);
        cStart = toDateStr(mon);
        cEnd = toDateStr(sun);
        pStart = toDateStr(pMon);
        pEnd = toDateStr(pSun);
        break;
      }
      case 'month': {
        const y = now.getFullYear(),
          m = now.getMonth();
        cStart = toDateStr(new Date(y, m, 1));
        cEnd = toDateStr(new Date(y, m + 1, 0));
        pStart = toDateStr(new Date(y, m - 1, 1));
        pEnd = toDateStr(new Date(y, m, 0));
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
        cStart = `${now.getFullYear()}-01-01`;
        cEnd = `${now.getFullYear()}-12-31`;
        pStart = `${now.getFullYear() - 1}-01-01`;
        pEnd = `${now.getFullYear() - 1}-12-31`;
        break;
      }
      case 'custom': {
        if (secP1Start && secP1End && secP2Start && secP2End) {
          cStart = secP1Start;
          cEnd = secP1End;
          pStart = secP2Start;
          pEnd = secP2End;
        } else return null;
        break;
      }
      default:
        return null;
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

  // Section intelligence feeds the performance tab only — fetch on first
  // visit and whenever its period inputs change while visiting.
  const secLoadedSigRef = useRef('');
  const secSig = [secPeriod, secP1Start, secP1End, secP2Start, secP2End].join('|');
  useEffect(() => {
    if (activeTab !== 'performance') return;
    if (secPeriod === 'custom' && !(secP1Start && secP1End && secP2Start && secP2End)) return;
    if (secLoadedSigRef.current === secSig) return;
    secLoadedSigRef.current = secSig;
    loadSectionIntelligence();
  }, [activeTab, secSig, secPeriod, secP1Start, secP1End, secP2Start, secP2End]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (secPeriod === 'custom' && !secP1Start) {
      const now = new Date();
      const y = now.getFullYear(),
        m = now.getMonth();
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

  // Lazy extras (members/history tabs) load once per filter signature.
  // The signature mirrors the core reload triggers so a filter change
  // invalidates visited tabs and the next visit refetches.
  const lazySigRef = useRef('');
  const lazyLoadedRef = useRef({});
  const lazySignature = [filterType, filterValue, selectedServiceId].join('|');
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

      // Core set only — every key here is rendered (performance tab +
      // shared insights used by members/ai tabs). Dropped from the old
      // 20-request fan-out: 10 payloads no tab reads (trends, anomalies,
      // demographics, engagement scores, dashboard metrics, growth index,
      // head-leader analytics, risk, prev-period leader metrics/retention).
      // memberIntelligence + yearOverYear load lazily per tab below.
      const results = await Promise.allSettled([
        adminAPI.getAttendancePrediction(),
        adminAPI.getMemberStreaks(20),
        adminAPI.getLeaderPerformance(startDate90, endDate),
        analyticsAPI.getRetention(90),
        analyticsAPI.getSectionComparison(90),
        analyticsAPI.getSectionRankings(90),
        analyticsAPI.getAIInsights(),
        analyticsAPI.getLeaderRankings(90)
      ]);

      const ok = (i) => (results[i].status === 'fulfilled' ? results[i].value?.data : null);
      const core = {
        prediction: ok(0),
        streaks: asArray(ok(1)),
        leaderMetrics: asArray(ok(2)),
        retention: ok(3) || {},
        sectionComparison: asArray(ok(4)),
        sectionRankings: asArray(ok(5)),
        aiInsights: asArray(ok(6)),
        leaderRankings: asArray(ok(7))
      };
      const sigChanged = lazySigRef.current !== lazySignature;
      setAnalytics((prev) => ({
        ...core,
        // Keep visited-tab extras across identical-signature reloads so the
        // current tab doesn't blank while core refreshes.
        ...(prev && !sigChanged
          ? { memberIntelligence: prev.memberIntelligence, yearOverYear: prev.yearOverYear }
          : {})
      }));
      lazySigRef.current = lazySignature;
      // A filter change landing while visiting a lazy tab refreshes its extras.
      if (sigChanged) {
        if (activeTabRef.current === 'members') await loadMembersIntelligence();
        if (activeTabRef.current === 'history') await loadHistoryExtras();
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadMembersIntelligence = async () => {
    try {
      const res = await analyticsAPI.getMemberIntelligence(180, null, null, selectedServiceId);
      setAnalytics((prev) => ({ ...prev, memberIntelligence: asArray(res.data) }));
    } catch (e) {
      console.error('Failed to load member intelligence:', e);
    }
  };

  const loadHistoryExtras = async () => {
    try {
      const res = await analyticsAPI.getYearOverYear();
      setAnalytics((prev) => ({ ...prev, yearOverYear: asArray(res.data) }));
    } catch (e) {
      console.error('Failed to load year-over-year:', e);
    }
  };

  const ensureLazyExtras = (tab) => {
    const key = `${tab}|${lazySignature}`;
    if (lazyLoadedRef.current[key]) return;
    lazyLoadedRef.current[key] = true;
    if (tab === 'members') loadMembersIntelligence();
    if (tab === 'history') loadHistoryExtras();
  };

  const loadMemberWeeklyMatrix = async (numWeeks = memberWeeksCount) => {
    setMemberWeeklyLoading(true);
    try {
      const params = { serviceId: selectedServiceId, weeks: numWeeks };
      const res = await analyticsAPI.getMemberWeeklyMatrix(params);
      setMemberWeeklyMatrix(res.data.matrix || []);
      setMemberWeeklyMatrixWeeks(res.data.weeks || []);
    } catch (e) {
      console.error('Failed to load weekly matrix:', e);
      setMemberWeeklyMatrix([]);
    } finally {
      setMemberWeeklyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      loadMemberWeeklyMatrix(memberWeeksCount);
      ensureLazyExtras('members');
    }
    if (activeTab === 'history') ensureLazyExtras('history');
  }, [activeTab, selectedServiceId, filterType, filterValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = overviewData?.stats || {};
  const currentService = serviceTypes.find((s) => s.id === selectedServiceId);
  const serviceLabel =
    selectedServiceId === 'all' ? 'All Services' : currentService?.name || 'Service';
  const totalPresent = stats.present || 0;
  const totalAbsent = stats.absent || 0;
  const totalExcused = stats.excused || 0;
  const totalMembers = totalPresent + totalAbsent + totalExcused;
  const attendanceRate = totalMembers > 0 ? Math.round((totalPresent / totalMembers) * 100) : 0;
  const unsubmitted = (stats.total_leaders || 0) - (stats.total_submitted_leaders || 0);
  const openMemberAttendanceDetails = async (member) => {
    setSelectedMemberDetails({ member, records: [], stats: null, date_range: null });
    setMemberDetailsLoading(true);
    setMemberDetailsError(null);
    try {
      const res = await analyticsAPI.getMemberAttendanceDetails(member.id, 180, selectedServiceId);
      setSelectedMemberDetails(res.data);
    } catch (error) {
      setMemberDetailsError(
        error.response?.data?.error || 'Failed to load member attendance details'
      );
      setSelectedMemberDetails({ member, records: [], stats: null, date_range: null });
    } finally {
      setMemberDetailsLoading(false);
    }
  };

  const sectionComparison = useMemo(
    () => analytics.sectionComparison || [],
    [analytics.sectionComparison]
  );
  const sectionRankings = useMemo(
    () => analytics.sectionRankings || [],
    [analytics.sectionRankings]
  );
  const retention = useMemo(() => analytics.retention || {}, [analytics.retention]);
  const aiInsights = useMemo(() => analytics.aiInsights || [], [analytics.aiInsights]);

  const leaderRankData = useMemo(() => {
    const source = analytics.leaderRankings?.length
      ? analytics.leaderRankings
      : analytics.leaderMetrics;
    if (!source?.length) return [];
    return [...source]
      .map((row) => ({
        ...row,
        attendance_rate: row.attendance_rate ?? row.avg_rate ?? 0,
        submissions_count: row.submissions_count ?? row.submission_count ?? row.submissions ?? 0
      }))
      .sort((a, b) => (b.attendance_rate || 0) - (a.attendance_rate || 0))
      .slice(0, 20);
  }, [analytics.leaderRankings, analytics.leaderMetrics]);

  const insights = useMemo(() => {
    const list = [];
    if (attendanceRate >= 80)
      list.push({
        type: 'success',
        text: `Attendance rate is ${attendanceRate}% — strong congregation engagement this period.`,
        icon: CheckCircle2
      });
    else if (attendanceRate < 60)
      list.push({
        type: 'danger',
        text: `Attendance rate dropped to ${attendanceRate}%. Consider outreach to inactive members.`,
        icon: AlertTriangle
      });

    if (analytics.prediction?.trend === 'increasing')
      list.push({
        type: 'success',
        text: `Attendance trending upward over ${analytics.prediction.weeks_analyzed || 0} weeks.`,
        icon: TrendingUp
      });
    else if (analytics.prediction?.trend === 'decreasing')
      list.push({
        type: 'warning',
        text: 'Attendance trend is declining. Review recent changes in scheduling or engagement.',
        icon: TrendingDown
      });

    if (unsubmitted > 0)
      list.push({
        type: 'info',
        text: `${unsubmitted} leader(s) have not submitted attendance this period.`,
        icon: Clock
      });
    if (leaderRankData.length > 0 && leaderRankData[0].attendance_rate >= 90)
      list.push({
        type: 'success',
        text: `${leaderRankData[0].leader_name} leads with ${R(leaderRankData[0].attendance_rate)}% section attendance.`,
        icon: Award
      });

    if (sectionComparison.length > 0) {
      const best = sectionComparison[0];
      const worst = sectionComparison[sectionComparison.length - 1];
      if (best?.attendance_rate >= 80)
        list.push({
          type: 'success',
          text: `${best.name} is top-performing section at ${R(best.attendance_rate)}% attendance.`,
          icon: Star
        });
      if (worst?.attendance_rate < 60)
        list.push({
          type: 'danger',
          text: `${worst.name} needs attention at ${R(worst.attendance_rate)}% attendance.`,
          icon: AlertTriangle
        });
      const lowSections = sectionComparison.filter((s) => s.attendance_rate < 60);
      if (lowSections.length > 1)
        list.push({
          type: 'warning',
          text: `${lowSections.length} sections below 60% attendance. Targeted outreach recommended.`,
          icon: Heart
        });
    }

    if (analytics.streaks?.length > 0) {
      const atRisk = analytics.streaks.filter((s) => s.consecutive_absences >= 3);
      if (atRisk.length > 0)
        list.push({
          type: 'danger',
          text: `${atRisk.length} member(s) missed 3+ consecutive services — follow-up required.`,
          icon: UserX
        });
    }

    if (retention.retention_rate != null) {
      const rr = R(retention.retention_rate);
      if (rr >= 80)
        list.push({ type: 'success', text: `Member retention at ${rr}% — strong.`, icon: Shield });
      else if (rr < 60)
        list.push({
          type: 'warning',
          text: `Member retention at ${rr}% — re-engagement strategies needed.`,
          icon: AlertTriangle
        });
    }

    if (aiInsights.length > 0)
      aiInsights.slice(0, 3).forEach((ins) =>
        list.push({
          type: ins.type || 'info',
          text: ins.text || ins.message,
          icon: ins.icon || Info
        })
      );

    return list.slice(0, 12);
  }, [
    attendanceRate,
    analytics.prediction,
    unsubmitted,
    leaderRankData,
    sectionComparison,
    analytics.streaks,
    retention,
    aiInsights
  ]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'compare':
        return renderComparisonTab();
      case 'performance':
        return renderPerformanceTab();
      case 'members':
        return renderMembersTab();
      case 'history':
        return renderHistoricalTab();
      case 'ai':
        return renderInsightsTab();
      default:
        return renderOverviewTab();
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

  const renderSectionsTab = () => (
    <SectionsTab
      data={{
        secRankings,
        secHeadLeaders,
        secLeaderRankings,
        absentStreaks,
        secPeriod,
        secP1Start,
        secP1End,
        secP2Start,
        secP2End,
        secLoading,
        secError,
        secSearch,
        secSortField,
        secSortOrder,
        leadSortField,
        leadSortOrder,
        expandedSectionId,
        showExtraKPIs,
        sectionSubTab,
        showAllColumns,
        leaderRankData
      }}
      actions={{
        setSecPeriod,
        setSecP1Start,
        setSecP1End,
        setSecP2Start,
        setSecP2End,
        setSecSearch,
        setShowExtraKPIs,
        setSectionSubTab,
        setShowAllColumns,
        setExpandedSectionId,
        setSecSortField,
        setSecSortOrder,
        setLeadSortField,
        setLeadSortOrder
      }}
    />
  );

  const renderDepartmentsTab = () => <DepartmentsTab departmentsData={departmentsData} />;

  const renderMembersTab = () => (
    <MembersTab
      data={{
        memberIntelligence: asArray(analytics.memberIntelligence),
        sectionRankings,
        memberCategory,
        memberRiskFilter,
        memberSearch,
        memberView,
        memberWeeksCount,
        memberWeeklyMatrix,
        memberWeeklyMatrixWeeks,
        memberWeeklyLoading,
        selectedMemberDetails,
        memberDetailsLoading,
        memberDetailsError,
        serviceLabel
      }}
      actions={{
        setMemberCategory,
        setMemberSearch,
        setMemberRiskFilter,
        setMemberView,
        setMemberWeeksCount,
        loadMemberWeeklyMatrix,
        openMemberAttendanceDetails,
        setSelectedMemberDetails
      }}
    />
  );

  const renderHistoricalTab = () => (
    <HistoryTab
      historicalData={historicalData}
      historicalPeriod={historicalPeriod}
      onPeriodChange={setHistoricalPeriod}
      yearOverYear={analytics.yearOverYear}
    />
  );

  const renderInsightsTab = () => (
    <InsightsTab insights={insights} prediction={analytics.prediction} />
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
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Executive Attendance Intelligence
            </h2>
            <p className="text-[11px] text-slate-400">
              Numbers-first business intelligence for strategic decisions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setQuickActionsOpen((o) => !o)}
              onBlur={() => setTimeout(() => setQuickActionsOpen(false), 150)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Actions <ChevronDown className="w-3 h-3" />
            </button>
            {quickActionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-50 py-1">
                {[
                  {
                    label: 'Download PDF',
                    icon: Download,
                    onClick: () => window.print(),
                    color: 'text-blue-600'
                  },
                  {
                    label: 'Print Report',
                    icon: Printer,
                    onClick: () => window.print(),
                    color: 'text-slate-600'
                  },
                  {
                    label: 'Generate AI Report',
                    icon: Brain,
                    onClick: () => setActiveTab('ai'),
                    color: 'text-violet-600'
                  }
                ].map(({ label, icon: I, onClick, color }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <I className={`w-3.5 h-3.5 ${color}`} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Single Filter Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setFilterValue('');
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="yearly">This Year</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          <option value="last90">Last 90 Days</option>
          <option value="custom">Custom Date</option>
        </select>
        {filterType !== 'custom' ? (
          <input
            type="date"
            value={filterValue || ''}
            onChange={(e) => setFilterValue(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customDate1}
              onChange={(e) => setCustomDate1(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none w-32"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customDate2}
              onChange={(e) => setCustomDate2(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none w-32"
            />
          </div>
        )}
        <div className="flex-1" />
      </div>

      {/* ── Primary Navigation (6 tabs) ── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <tab.icon className="w-3 h-3" />
            {t(`attendance.tabs.${tab.id}`, tab.label)}
          </button>
        ))}
      </div>

      {analyticsLoading || overviewLoading ? (
        <TabFallback />
      ) : (
        <div>
          <Suspense fallback={<TabFallback />}>{renderTabContent()}</Suspense>
        </div>
      )}
    </div>
  );
};

export default AttendanceReports;
