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

  // Service Assignments Modal
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState(() => formatLocalDate());
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignedLeaderIds, setAssignedLeaderIds] = useState([]);

  const messageTimerRef = useRef(null);
  const latestReportInitializedRef = useRef(false);
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
      const today = formatLocalDate();
      const [sectionsRes, membersRes, attendanceRes, birthdaysRes, servicesRes] = await Promise.allSettled([
        adminAPI.getSections(),
        adminAPI.getMembers(),
        adminAPI.getAttendance({ date: today }),
        adminAPI.getUpcomingBirthdays(30),
        adminAPI.getServiceTypes(),
      ]);
      if (sectionsRes.status === 'fulfilled') setSections(sectionsRes.value.data);
      else console.error('Failed to load sections:', sectionsRes.reason);

      if (membersRes.status === 'fulfilled') setAllMembers(membersRes.value.data);
      else console.error('Failed to load members:', membersRes.reason);

      if (birthdaysRes.status === 'fulfilled') setBirthdays(birthdaysRes.value.data);
      else {
        console.warn('Failed to load upcoming birthdays:', birthdaysRes.reason);
        setBirthdays([]);
      }

      if (servicesRes.status === 'fulfilled') setServiceTypes(servicesRes.value.data);
      else console.error('Failed to load service types:', servicesRes.reason);
      
      // Calculate today stats
      const attendance = attendanceRes.status === 'fulfilled' ? attendanceRes.value.data : [];
      if (attendanceRes.status === 'rejected') console.error('Failed to load attendance:', attendanceRes.reason);
      const stats = attendance.reduce((acc, curr) => {
        if (curr.status === 'present') acc.present++;
        if (curr.status === 'absent') acc.absent++;
        if (curr.status === 'excused') acc.excused++;
        return acc;
      }, { present: 0, absent: 0, excused: 0 });
      setTodayStats(stats);
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

  const loadOverview = useCallback(async () => {
    if (!filterValue) return;
    setOverviewLoading(true);
    try {
      const res = await adminAPI.getAggregatedOverview(filterType, filterValue, selectedServiceId);
      setOverviewData(res.data);
    } catch (error) {
      console.error('Failed to load overview:', error);
      setOverviewData(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [filterType, filterValue, selectedServiceId]);

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
      const res = await adminAPI.getHistory(selectedServiceId);
      let latestDate = res.data?.[0]?.date;

      if (!latestDate && selectedServiceId !== 'all') {
        const allServicesRes = await adminAPI.getHistory('all');
        latestDate = allServicesRes.data?.[0]?.date;
      }

      if (!latestDate) return;

      const latestWeek = getWeekString(new Date(`${latestDate}T12:00:00`));
      setFilterValue(latestWeek);
      updateSearchParam('period', latestWeek);
    } catch (error) {
      console.warn('Failed to load latest report window:', error);
    }
  }, [filterType, selectedServiceId, updateSearchParam]);

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
  useEffect(() => {
    localStorage.setItem('lastServiceFilter', selectedServiceId);
    
    updateSearchParam('service', selectedServiceId);
    
    loadDashboardMetrics();
  }, [selectedServiceId, loadDashboardMetrics, updateSearchParam]);

  useEffect(() => {
    if (latestReportInitializedRef.current) return;
    latestReportInitializedRef.current = true;
    loadLatestReportWindow();
  }, [loadLatestReportWindow]);

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

  // Initial load
  useEffect(() => {
    loadCoreData();
    loadLeaders();
    loadDashboardMetrics();
  }, [loadCoreData, loadLeaders, loadDashboardMetrics]);

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Polling logic for real-time updates
  useEffect(() => {
    const POLL_INTERVAL = 30000; // 30 seconds
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
    loadCoreData, loadLeaders, loadServiceTypes,
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
    // Service Assignments
    isAssignmentModalOpen, setIsAssignmentModalOpen,
    selectedInstanceDate, setSelectedInstanceDate,
    assignmentsLoading, assignedLeaderIds, setAssignedLeaderIds,
    loadServiceInstance, handleSaveServiceAssignments,
  };
};

export default useAdminData;
