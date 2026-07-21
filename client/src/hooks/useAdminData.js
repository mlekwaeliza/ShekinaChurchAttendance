import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI, analyticsAPI } from '../services/api';
import { formatLocalDate } from '../utils/date';

const useAdminData = () => {
  // Core data
  const [sections, setSections] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [birthdays, setBirthdays] = useState([]);
  const [todayStats, setTodayStats] = useState({ present: 0, absent: 0, excused: 0 });
  const [serviceTypes, setServiceTypes] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const getSearchValue = useCallback((key, fallback = '') => searchParams.get(key) || fallback, [searchParams]);
  const [selectedServiceId, setSelectedServiceId] = useState(() => {
    const fromUrl = searchParams.get('service');
    if (fromUrl) return fromUrl === 'all' ? 'all' : parseInt(fromUrl);

    const stored = localStorage.getItem('lastServiceFilter');
    if (stored === 'all') return 'all';
    if (stored) return parseInt(stored);
    
    // Auto-select based on day of week
    const day = new Date().getDay();
    const map = { 0: 1, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 1 };
    return map[day] || 1;
  });
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Overview / Reports
  const [filterType, setFilterType] = useState('weekly');
  const getISOWeek = (d) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  };
  const getWeekString = (d) => {
    const year = d.getFullYear();
    const week = getISOWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  };
  const [filterValue, setFilterValue] = useState(() => getSearchValue('period', getWeekString(new Date())));
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Trends
  const [trends, setTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Rewards
  const currentYear = new Date().getFullYear().toString();
  const [rewardsYear, setRewardsYear] = useState(currentYear);
  const [rewardsMode, setRewardsMode] = useState('year');
  const [rewardsWeek, setRewardsWeek] = useState(() => getWeekString(new Date()));
  const [topMembers, setTopMembers] = useState(null);
  const [topLeaders, setTopLeaders] = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  // Drilldown
  const [drilldownData, setDrilldownData] = useState(null);

  // Upload
  const [uploadResult, setUploadResult] = useState(null);

  // Message
  const [message, setMessage] = useState('');

  // Sections Management
  const [editingSection, setEditingSection] = useState(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [deletingSection, setDeletingSection] = useState(null);
  const [sectionSaving, setSectionSaving] = useState(false);

  // Leaders Management
  const [editingLeader, setEditingLeader] = useState(null);
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [deletingLeader, setDeletingLeader] = useState(null);
  const [leaderSaving, setLeaderSaving] = useState(false);
  const [leaderSectionFilter, setLeaderSectionFilter] = useState(() => getSearchValue('section'));
  const [memberSectionFilter, setMemberSectionFilter] = useState(() => getSearchValue('section'));
  const [memberLeaderFilter, setMemberLeaderFilter] = useState(() => getSearchValue('leader'));

  // Service Assignments Modal
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState(() => formatLocalDate());
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignedLeaderIds, setAssignedLeaderIds] = useState([]);

  // Executive Command Center data (fired in parallel with core data)
  const [execSummary, setExecSummary] = useState(null);
  const [execComparison, setExecComparison] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  const [homeCells, setHomeCells] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [hallOfFame, setHallOfFame] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const execDataLoadedRef = useRef(false);

  const messageTimerRef = useRef(null);
  const latestReportInitializedRef = useRef(false);
  const overviewRequestRef = useRef(0);
  const showMessage = useCallback((msg, duration = 3000) => {
    setMessage(msg);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(''), duration);
  }, []);

  const updateSearchParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleMemberSectionFilter = useCallback((sectionName) => {
    setMemberSectionFilter(sectionName);
    updateSearchParam('section', sectionName);
  }, [updateSearchParam]);

  const handleMemberLeaderFilter = useCallback((leaderName) => {
    setMemberLeaderFilter(leaderName);
    updateSearchParam('leader', leaderName);
  }, [updateSearchParam]);

  const handleLeaderSectionFilter = useCallback((sectionName) => {
    setLeaderSectionFilter(sectionName);
    updateSearchParam('section', sectionName);
  }, [updateSearchParam]);

  const handleReportFilterValue = useCallback((value) => {
    setFilterValue(value);
    updateSearchParam('period', value);
  }, [updateSearchParam]);

  const loadServiceTypes = useCallback(async () => {
    try {
      const res = await adminAPI.getServiceTypes();
      setServiceTypes(res.data);
    } catch (error) {
      console.error('Failed to load service types:', error);
    }
  }, []);

  // --- Data Loaders ---
  const loadCoreData = useCallback(async () => {
    setLoading(true);
    try {
      const [sectionsRes, membersRes, birthdaysRes, servicesRes] = await Promise.allSettled([
        adminAPI.getSections(),
        adminAPI.getMembers(),
        adminAPI.getUpcomingBirthdays(30),
        adminAPI.getServiceTypes(),
      ]);
      if (sectionsRes.status === 'fulfilled') setSections(sectionsRes.value.data);
      else console.error('Failed to load sections:', sectionsRes.reason);

      if (membersRes.status === 'fulfilled') {
        setAllMembers(membersRes.value.data);
      } else {
        console.error('Failed to load members:', membersRes.reason);
      }

      if (birthdaysRes.status === 'fulfilled') setBirthdays(birthdaysRes.value.data);
      else {
        console.warn('Failed to load upcoming birthdays:', birthdaysRes.reason);
        setBirthdays([]);
      }

      if (servicesRes.status === 'fulfilled') setServiceTypes(servicesRes.value.data);
      else console.error('Failed to load service types:', servicesRes.reason);
    } catch (error) {
      console.error('Failed to load core data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaders = useCallback(async () => {
    setLeadersLoading(true);
    try {
      const res = await adminAPI.getLeaders();
      setLeaders(res.data);
    } catch (error) {
      console.error('Failed to load leaders:', error);
    } finally {
      setLeadersLoading(false);
    }
  }, []);

  const loadDashboardMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await analyticsAPI.getDashboardMetrics(selectedServiceId);
      setDashboardMetrics(res.data);
      // Update todayStats
      const metricsStats = res.data.todayStats || res.data.comparisons?.todayStats || { present: 0, absent: 0, excused: 0 };
      setTodayStats(metricsStats);
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  }, [selectedServiceId]);

  // Build N periods backward from today for executive comparison
  const buildPeriods = useCallback((periodType, count) => {
    const periods = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      let start, end, label;
      if (periodType === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      } else if (periodType === 'week') {
        const d = new Date(now); d.setDate(d.getDate() - i * 7 - d.getDay());
        start = d.toISOString().split('T')[0];
        const e = new Date(d); e.setDate(e.getDate() + 6);
        end = e.toISOString().split('T')[0];
        label = `W${i + 1}`;
      } else {
        const d = new Date(now.getFullYear() - i, 0, 1);
        start = `${d.getFullYear()}-01-01`;
        end = `${d.getFullYear()}-12-31`;
        label = `${d.getFullYear()}`;
      }
      periods.push({ id: `p${i}`, label, start, end });
    }
    return periods;
  }, []);

  // Fire all executive command center API calls in parallel
  const loadExecutiveData = useCallback(async () => {
    try {
      const asArray = (v) => Array.isArray(v) ? v : [];
      const [sumRes, compRes, aiRes, cellRes, deptRes, auditRes, perfRes, backupRes, healthRes, notifRes] = await Promise.allSettled([
        analyticsAPI.getExecutiveSummary(90),
        analyticsAPI.getExecutiveComparison({ periods: buildPeriods('month', 6), mode: 'overall' }),
        analyticsAPI.getAIInsights(),
        adminAPI.getHomeCells(),
        adminAPI.getDepartments(),
        adminAPI.getAuditLog({ limit: 12 }),
        adminAPI.getPerformanceDashboard('month', selectedServiceId, null),
        adminAPI.getBackupStatus(),
        adminAPI.getHealth(),
        adminAPI.getUnreadNotificationCount(),
      ]);
      if (sumRes.status === 'fulfilled') setExecSummary(sumRes.value.data);
      if (compRes.status === 'fulfilled') setExecComparison(compRes.value.data);
      if (aiRes.status === 'fulfilled') setAiInsights(asArray(aiRes.value.data));
      if (cellRes.status === 'fulfilled') setHomeCells(asArray(cellRes.value.data));
      if (deptRes.status === 'fulfilled') setDepartments(asArray(deptRes.value.data?.departments ?? deptRes.value.data));
      if (auditRes.status === 'fulfilled') setAuditLog(asArray(auditRes.value.data));
      if (perfRes.status === 'fulfilled') setHallOfFame(perfRes.value.data);
      if (backupRes.status === 'fulfilled') setBackupStatus(backupRes.value.data);
      if (healthRes.status === 'fulfilled') setHealthStatus(healthRes.value.data);
      if (notifRes.status === 'fulfilled') setNotifCount(notifRes.value.data?.count || 0);
    } catch (e) {
      console.error('Failed to load executive data:', e);
    }
  }, [selectedServiceId, buildPeriods]);

  const loadOverview = useCallback(async () => {
    if (!filterValue) return;
    const requestId = overviewRequestRef.current + 1;
    overviewRequestRef.current = requestId;
    setOverviewLoading(true);
    try {
      const res = await adminAPI.getAggregatedOverview(filterType, filterValue, selectedServiceId);
      if (requestId !== overviewRequestRef.current) return;

      setOverviewData(res.data);
      if (res.data?.usedFallback && res.data.filterValue && res.data.filterValue !== filterValue) {
        setFilterValue(res.data.filterValue);
        updateSearchParam('period', res.data.filterValue);
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
    } finally {
      if (requestId === overviewRequestRef.current) {
        setOverviewLoading(false);
      }
    }
  }, [filterType, filterValue, selectedServiceId, updateSearchParam]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminAPI.getHistory(selectedServiceId);
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedServiceId]);

  const loadLatestReportWindow = useCallback(async () => {
    if (filterType !== 'weekly') return;

    try {
      const res = await adminAPI.getHistory('all');
      let latestDate = res.data?.[0]?.date;

      if (!latestDate) return;

      const latestDateOnly = String(latestDate).split('T')[0];
      const latestWeek = getWeekString(new Date(`${latestDateOnly}T12:00:00`));
      setSelectedServiceId('all');
      setFilterValue(latestWeek);
      updateSearchParam('period', latestWeek);
      updateSearchParam('service', 'all');
    } catch (error) {
      console.warn('Failed to load latest report window:', error);
    }
  }, [filterType, updateSearchParam]);

  const loadTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const res = await adminAPI.getAttendanceTrends(90);
      setTrends(res.data.trends || []);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  const loadRewards = useCallback(async () => {
    setRewardsLoading(true);
    setTopMembers(null);
    setTopLeaders(null);
    try {
      const week = rewardsMode === 'week' ? rewardsWeek : undefined;
      const results = await Promise.allSettled([
        adminAPI.getTopMembers(rewardsYear, week),
        adminAPI.getTopLeaders(rewardsYear, week),
      ]);
      if (results[0].status === 'fulfilled') setTopMembers(results[0].value.data);
      if (results[1].status === 'fulfilled') setTopLeaders(results[1].value.data);
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`Rewards call ${i} failed:`, r.reason);
      });
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setRewardsLoading(false);
    }
  }, [rewardsYear, rewardsMode, rewardsWeek]);

  const openLeaderDashboard = useCallback(async (leaderId) => {
    setDrilldownData({ loading: true });
    try {
      const res = await adminAPI.getLeaderDashboard(leaderId);
      setDrilldownData({ loading: false, data: res.data });
    } catch (error) {
      showMessage('Failed to launch leader analytics');
      setDrilldownData(null);
    }
  }, []);

  // --- Section Handlers ---
  const handleSectionSave = useCallback(async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');

    if (!name) return;
    setSectionSaving(true);

    try {
      if (editingSection) {
        await adminAPI.updateSection(editingSection.id, name);
        showMessage(`${name} updated successfully`);
      } else {
        await adminAPI.createSection(name);
        showMessage(`${name} created successfully`);
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      loadCoreData();
    } catch (error) {
      showMessage(error.response?.data?.error || 'Failed to save section');
    } finally {
      setSectionSaving(false);
    }
  }, [editingSection, loadCoreData, showMessage]);

  const handleSectionDelete = useCallback(async () => {
    if (!deletingSection) return;
    setSectionSaving(true);
    try {
      await adminAPI.deleteSection(deletingSection.id);
      showMessage(`Section ${deletingSection.name} and all associated data deleted`);
      setDeletingSection(null);
      loadCoreData();
      loadLeaders(); // Since leaders are linked to sections
    } catch (error) {
      showMessage(error.response?.data?.error || 'Failed to delete section');
    } finally {
      setSectionSaving(false);
    }
  }, [deletingSection, loadCoreData, loadLeaders, showMessage]);

  const handleLeaderSave = useCallback(async (data) => {
    setLeaderSaving(true);
    try {
      if (editingLeader) {
        await adminAPI.updateLeader(editingLeader.id, data);
        showMessage(`Leader ${data.full_name} updated successfully`);
      } else {
        await adminAPI.createLeader(data);
        showMessage(`Leader ${data.full_name} created successfully`);
      }
      setIsLeaderModalOpen(false);
      setEditingLeader(null);
      loadLeaders();
    } catch (error) {
      showMessage(error.response?.data?.error || 'Failed to save leader');
      throw error;
    } finally {
      setLeaderSaving(false);
    }
  }, [editingLeader, loadLeaders, showMessage]);

  const handleLeaderDelete = useCallback(async () => {
    if (!deletingLeader) return;
    setLeaderSaving(true);
    try {
      await adminAPI.deleteLeader(deletingLeader.id);
      showMessage(`Leader ${deletingLeader.full_name} and all associated records deleted`);
      setDeletingLeader(null);
      loadLeaders();
      loadCoreData(); // Members might have changed (unassigned)
    } catch (error) {
      showMessage(error.response?.data?.error || 'Failed to delete leader');
    } finally {
      setLeaderSaving(false);
    }
  }, [deletingLeader, loadLeaders, loadCoreData, showMessage]);

  // Sync selectedServiceId to localStorage and URL
  const serviceIdInitialized = useRef(false);
  useEffect(() => {
    localStorage.setItem('lastServiceFilter', selectedServiceId);
    updateSearchParam('service', selectedServiceId);
    // Skip the first run — loadDashboardMetrics is called in the initial load effect
    if (serviceIdInitialized.current) {
      loadDashboardMetrics();
    } else {
      serviceIdInitialized.current = true;
    }
  }, [selectedServiceId, loadDashboardMetrics, updateSearchParam]);

  useEffect(() => {
    if (latestReportInitializedRef.current) return;
    latestReportInitializedRef.current = true;
    // Deferred: only load when reports tab is active (called from AdminDashboard)
  }, []);

  // Service Assignments
  const loadServiceInstance = useCallback(async (date, serviceId) => {
    setAssignmentsLoading(true);
    try {
      const res = await adminAPI.getServiceInstance(date, serviceId);
      setAssignedLeaderIds(res.data.assigned_leader_ids || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      showMessage('Failed to load service assignments', 4000);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [showMessage]);

  const handleSaveServiceAssignments = useCallback(async (leaderIdsArray) => {
    setAssignmentsLoading(true);
    try {
      await adminAPI.saveServiceInstance(selectedInstanceDate, selectedServiceId, leaderIdsArray);
      setAssignedLeaderIds(leaderIdsArray);
      setIsAssignmentModalOpen(false);
      showMessage('Service assignments updated successfully');
    } catch (error) {
      console.error('Failed to save assignments:', error);
      showMessage('Failed to save service assignments. Ensure service exists and date is valid.', 4000);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [selectedInstanceDate, selectedServiceId, showMessage]);

  // Initial load — fire core data calls in parallel immediately.
  // Executive data (heavy analytics) is deferred until the dashboard tab is actually visited.
  useEffect(() => {
    loadCoreData();
    loadLeaders();
    loadDashboardMetrics();
  }, [loadCoreData, loadLeaders, loadDashboardMetrics]);

  // Lazy loader for executive data — only fires when called from the dashboard tab,
  // and only once per session (unless manually refreshed).
  const loadExecutiveDataOnce = useCallback(async () => {
    if (execDataLoadedRef.current) return;
    execDataLoadedRef.current = true;
    await loadExecutiveData();
  }, [loadExecutiveData]);

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Polling logic for real-time updates
  useEffect(() => {
    // Poll every 3 minutes — dashboard-metrics is cached for 2min on the server,
    // so polling faster than that is wasteful.
    const POLL_INTERVAL = 3 * 60 * 1000;
    let interval;

    const startPolling = () => {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          console.log('Polling for fresh dashboard data...');
          loadDashboardMetrics();
          setLastUpdated(new Date());
        }
      }, POLL_INTERVAL);
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh immediately when coming back to tab
        loadDashboardMetrics();
        setLastUpdated(new Date());
        if (!interval) startPolling();
      } else {
        clearInterval(interval);
        interval = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDashboardMetrics]);

  return {
    // Core data
    sections, leaders, allMembers, loading, leadersLoading, todayStats, lastUpdated,
    // Overview
    filterType, setFilterType, filterValue, setFilterValue: handleReportFilterValue,
    overviewData, overviewLoading, loadOverview,
    // History
    history, historyLoading, loadHistory,
    // Trends
    trends, trendsLoading, loadTrends,
    // Rewards
    rewardsYear, setRewardsYear, rewardsMode, setRewardsMode,
    rewardsWeek, setRewardsWeek, topMembers, topLeaders, rewardsLoading, loadRewards,
    // Drilldown
    drilldownData, setDrilldownData, openLeaderDashboard,
    // Upload
    uploadResult, setUploadResult,
    // Message
    message, showMessage,
    loadCoreData, loadLeaders, loadServiceTypes, loadLatestReportWindow, loadExecutiveData, loadExecutiveDataOnce,
    // Dashboard metrics
    dashboardMetrics, metricsLoading, serviceTypes, selectedServiceId, setSelectedServiceId, loadDashboardMetrics,
    // Sections Management
    editingSection, setEditingSection, 
    isSectionModalOpen, setIsSectionModalOpen,
    deletingSection, setDeletingSection,
    sectionSaving,
    handleSectionSave, handleSectionDelete,
    // Leaders Management
    editingLeader, setEditingLeader,
    isLeaderModalOpen, setIsLeaderModalOpen,
    deletingLeader, setDeletingLeader,
    leaderSaving,
    handleLeaderSave, handleLeaderDelete,
    leaderSectionFilter, setLeaderSectionFilter: handleLeaderSectionFilter,
    memberSectionFilter, setMemberSectionFilter: handleMemberSectionFilter,
    memberLeaderFilter, setMemberLeaderFilter: handleMemberLeaderFilter,
    // Service Assignments
    isAssignmentModalOpen, setIsAssignmentModalOpen,
    selectedInstanceDate, setSelectedInstanceDate,
    assignmentsLoading, assignedLeaderIds, setAssignedLeaderIds,
    loadServiceInstance, handleSaveServiceAssignments,
    // Executive Command Center data
    execSummary, execComparison, aiInsights, homeCells, departments,
    auditLog, hallOfFame, backupStatus, healthStatus, notifCount,
  };
};

export default useAdminData;
