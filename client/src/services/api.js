import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Helper to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

// Interceptor to add CSRF token to state-changing requests
api.interceptors.request.use(config => {
  const method = config.method.toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrfToken');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('CSRF token not found - cookie may have expired');
    }
  }
  return config;
}, error => Promise.reject(error));

// Global response error handler — convert non-2xx to a plain Error so
// TanStack Query's onError gets a useful message.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Request failed';

    // Session expired / unauthenticated — kick to login unless we're
    // already on the login page (avoid loops).
    if (status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/login')) {
        // Best-effort: clear the user-visible session and reload to /login.
        try { window.dispatchEvent(new CustomEvent('app:session-expired', { detail: { message } })); } catch (_) { /* ignore */ }
        try { window.location.assign('/login?expired=1'); } catch (_) { /* ignore */ }
      }
    }

    const e = new Error(`${status ? `[${status}] ` : ''}${message}`);
    e.status = status;
    e.data = err.response?.data;
    e.original = err;
    console.error(`[API ${status}] ${err.config?.method?.toUpperCase()} ${err.config?.url}`, err.response?.data);
    return Promise.reject(e);
  }
);

// Auth API
export const authAPI = {
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/auth/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateProfile: (data) => api.put('/auth/profile', data),
  setup2FA: () => api.post('/2fa/setup'),
  verify2FA: (token) => api.post('/2fa/verify', { token }),
  disable2FA: (password) => api.post('/2fa/disable', { password }),
  get2FAStatus: () => api.get('/2fa/status'),
  regenerateBackupCodes: () => api.post('/2fa/regenerate-backup-codes'),
};

// Admin API
export const adminAPI = {
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/admin/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getSections: () => api.get('/admin/sections'),
  createSection: (name) => api.post('/admin/sections', { name }),
  updateSection: (id, name) => api.put(`/admin/sections/${id}`, { name }),
  deleteSection: (id) => api.delete(`/admin/sections/${id}`),
  getMembers: (filters = {}) => api.get('/admin/members', { params: filters }),
  updateMember: (id, data) => api.put(`/admin/members/${id}`, data),
  deleteMember: (id) => api.delete(`/admin/members/${id}`, { data: { confirm: 'SOFT-DELETE' } }),
  getAttendance: (filters = {}) => api.get('/admin/attendance', { params: filters }),
  getAttendanceTrends: (days = 90) => api.get('/admin/attendance-trends', { params: { days } }),
  updateAttendance: (id, status, reason) => api.put(`/admin/attendance/${id}`, { status, reason }),
  searchAttendance: (filters = {}) => api.get('/admin/attendance/search', { params: filters }),
  getAttendanceAudit: (id) => api.get(`/admin/attendance/${id}/audit`),
  exportAttendance: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    window.open(`/api/admin/export?${params.toString()}`, '_blank');
  },
  getLeaders: () => api.get('/admin/leaders'),
  createLeader: (data) => api.post('/admin/leaders', data),
  updateLeader: (id, data) => api.put(`/admin/leaders/${id}`, data),
  deleteLeader: (id) => api.delete(`/admin/leaders/${id}`),
  resetLeaderPassword: (leaderId) => api.post(`/admin/leaders/${leaderId}/reset-password`),
  createMember: (data) => api.post('/admin/members', data),
  getSuggestAssignment: () => api.get('/admin/members/suggest-assignment'),
  getNextMembershipId: () => api.get('/admin/members/next-id'),
  renumberMembershipIds: () => api.post('/admin/members/renumber-ids'),
  bulkSoftDelete: (memberIds) => api.post('/admin/members/bulk-soft-delete', { member_ids: memberIds }),
  getPendingDeletion: () => api.get('/admin/members/pending-deletion'),
  confirmDeletion: (memberIds) => api.post('/admin/members/confirm-deletion', { member_ids: memberIds, confirm: true }),
  restoreMembers: (memberIds) => api.post('/admin/members/restore', { member_ids: memberIds }),
  getHistory: (serviceId) => api.get('/admin/history', { params: { service_id: serviceId } }),
  getSettingsConfig: () => api.get('/admin/settings/config'),
  updateSettingsConfig: (config) => api.put('/admin/settings/config', { config }),
  getAggregatedOverview: (filterType, filterValue, serviceId) => api.get('/admin/aggregated-overview', { 
    params: { filterType, filterValue, service_id: serviceId, fallback_latest: true } 
  }),
  getLeaderDashboard: (id) => api.get(`/admin/leader-dashboard/${id}`),
  submitAttendance: (date, attendance, leader_id, section_id) => api.post('/admin/attendance', { date, attendance, leader_id, section_id }),
  getTopMembers: (year, week) => api.get('/admin/rewards/top-members', { params: { year, week } }),
  getTopLeaders: (year, week) => api.get('/admin/rewards/top-leaders', { params: { year, week } }),
  getPerformanceDashboard: (filters = {}) => api.get('/admin/performance/dashboard', { params: filters }),
  updatePerformanceWeights: (weights) => api.put('/admin/performance/weights', { weights }),
  getUnreadNotificationCount: () => api.get('/admin/notifications/unread-count'),
  getNotifications: () => api.get('/admin/notifications'),
  getAllNotifications: () => api.get('/admin/notifications/all'),
  markNotificationRead: (id) => api.put(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/admin/notifications/read-all'),
  getConsecutiveAbsences: (leaderId) => api.get(`/admin/notifications/consecutive-absences`, { params: { leaderId } }),
  getAbsentFollowUps: (leaderId) => api.get('/admin/notifications/follow-ups', { params: { leaderId } }),
  updateFollowUp: (id, data) => api.put(`/admin/notifications/follow-ups/${id}`, data),
  getAnnouncements: () => api.get('/admin/announcements'),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
  getFollowUpTasks: () => api.get('/admin/follow-up-tasks'),
  createFollowUpTask: (data) => api.post('/admin/follow-up-tasks', data),
  updateFollowUpTask: (id, data) => api.put(`/admin/follow-up-tasks/${id}`, data),
  getVisitors: () => api.get('/admin/visitors'),
  createVisitor: (data) => api.post('/admin/visitors', data),
  getAuditLog: (filters = {}) => api.get('/admin/audit-log', { params: filters }),
  getMemberAuditHistory: (memberId) => api.get(`/admin/audit-log/member/${memberId}`),
  bulkUpdateMembers: (memberIds, sectionId, leaderId) => api.put('/admin/members/bulk-update', { member_ids: memberIds, section_id: sectionId, leader_id: leaderId }),
  exportMembers: () => window.open('/api/admin/members/export', '_blank'),
  getAttendancePrediction: () => api.get('/admin/analytics/prediction'),
  getSectionAnomalies: (threshold) => api.get('/admin/analytics/anomalies', { params: { threshold } }),
  getMemberStreaks: (limit) => api.get('/admin/analytics/streaks', { params: { limit } }),
  getLeaderPerformance: (startDate, endDate) => api.get('/admin/analytics/leader-performance', { params: { start_date: startDate, end_date: endDate } }),
  getUpcomingBirthdays: (days) => api.get('/admin/analytics/birthdays', { params: { days } }),
  getServiceTypes: () => api.get('/admin/service-types'),
  updateServiceType: (id, data) => api.put(`/admin/service-types/${id}`, data),
  getServiceInstance: (date, serviceId) => api.get(`/admin/service-instances/${date}`, { params: { service_id: serviceId } }),
  saveServiceInstance: (date, serviceId, assignedLeaderIds) => api.post('/admin/service-instances', { date, service_id: serviceId, assigned_leader_ids: assignedLeaderIds }),
  getHomeCells: () => api.get('/admin/home-cells'),
  createHomeCell: (data) => api.post('/admin/home-cells', data),
  updateHomeCell: (id, data) => api.patch(`/admin/home-cells/${id}`, data),
  updateHomeCellLeaders: (cellId, leaderIds) => api.put(`/admin/home-cells/${cellId}/leaders`, { leader_ids: leaderIds }),
  deleteHomeCell: (id) => api.delete(`/admin/home-cells/${id}`),
  createHomeCellMember: (data) => api.post('/admin/home-cell-members', data),
  deleteHomeCellMember: (id) => api.delete(`/admin/home-cell-members/${id}`),
  transferHomeCellMember: (memberId, newCellId) => api.put(`/admin/home-cell-members/${memberId}/transfer`, { new_cell_id: newCellId }),
  // Leadership roles & assignments
  getTitles: () => api.get('/admin/titles'),
  createTitle: (data) => api.post('/admin/titles', data),
  updateTitle: (id, data) => api.put(`/admin/titles/${id}`, data),
  deleteTitle: (id) => api.delete(`/admin/titles/${id}`),
  getMemberTitles: (memberId) => api.get(`/admin/members/${memberId}/titles`),
  assignMemberTitle: (memberId, titleId, data = {}) => api.post(`/admin/members/${memberId}/titles`, { title_id: titleId, ...data }),
  updateMemberTitle: (memberId, titleId, data) => api.put(`/admin/members/${memberId}/titles/${titleId}`, data),
  removeMemberTitle: (memberId, titleId) => api.delete(`/admin/members/${memberId}/titles/${titleId}`),
  getMemberTitleHistory: (memberId, titleId) => api.get(`/admin/members/${memberId}/titles/${titleId}/history`),
  getLeadershipDirectory: (params = {}) => api.get('/admin/leadership-directory', { params }),
  getLeadershipStats: () => api.get('/admin/leadership-stats'),
  // Departments
  getDepartments: () => api.get('/admin/departments'),
  getDepartment: (id) => api.get(`/admin/departments/${id}`),
  createDepartment: (data) => api.post('/admin/departments', data),
  updateDepartment: (id, data) => api.put(`/admin/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  getDepartmentMembers: (id) => api.get(`/admin/departments/${id}/members`),
  addDepartmentMember: (id, member_id) => api.post(`/admin/departments/${id}/members`, { member_id }),
  removeDepartmentMember: (id, memberId) => api.delete(`/admin/departments/${id}/members/${memberId}`),
  getDepartmentHistory: (id) => api.get(`/admin/departments/${id}/history`),
  getMemberDepartments: (memberId) => api.get(`/admin/members/${memberId}/departments`),
  // User Management
  getUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resetUserPassword: (id) => api.post(`/admin/users/${id}/reset-password`),
};

// Shared church calendar API
export const calendarAPI = {
  getEvents: (year) => api.get('/calendar', { params: { year } }),
  createEvent: (data) => api.post('/calendar', data),
  updateEvent: (id, data) => api.put(`/calendar/${id}`, data),
  deleteEvent: (id) => api.delete(`/calendar/${id}`),
};

// Leader API
export const leaderAPI = {
  getMembers: (targetLeaderId) => api.get('/leader/members', {
    params: targetLeaderId ? { target_leader_id: targetLeaderId } : {}
  }),
  createMember: (data) => api.post('/leader/members', data),
  updateMember: (id, data) => api.put(`/leader/members/${id}`, data),
  deleteMember: (id) => api.delete(`/leader/members/${id}`),
  getHomeCells: () => api.get('/leader/home-cells'),
  createHomeCellMember: (data) => api.post('/leader/home-cell-members', data),
  deleteHomeCellMember: (id) => api.delete(`/leader/home-cell-members/${id}`),
  getAttendanceStatus: (date, serviceId, targetLeaderId) => api.get(`/leader/attendance/${date}`, {
    params: {
      service_id: serviceId,
      ...(targetLeaderId ? { target_leader_id: targetLeaderId } : {})
    }
  }),
  getServiceTypes: () => api.get('/leader/service-types'),
  submitAttendance: (date, attendance, service_id, target_leader_id) => api.post('/leader/attendance', {
    date,
    attendance,
    service_id,
    ...(target_leader_id ? { target_leader_id } : {})
  }),
  getHistory: () => api.get('/leader/history'),
  getSectionOverview: (date) => api.get(`/leader/section-overview/${date}`),
  getAttendanceTrends: (days = 90) => api.get(`/leader/attendance-trends?days=${days}`),
  getConsecutiveAbsences: () => api.get('/leader/consecutive-absences'),
  getFollowUps: () => api.get('/leader/follow-ups'),
  updateFollowUp: (memberId, data) => api.put(`/leader/follow-ups/${memberId}`, data),
  getAssignments: () => api.get('/leader/assignments'),
  // Leadership roles & assignments
  getTitles: () => api.get('/leader/titles'),
  getMemberTitles: (memberId) => api.get(`/leader/members/${memberId}/titles`),
  assignMemberTitle: (memberId, titleId, data = {}) => api.post(`/leader/members/${memberId}/titles`, { title_id: titleId, ...data }),
  updateMemberTitle: (memberId, titleId, data) => api.put(`/leader/members/${memberId}/titles/${titleId}`, data),
  removeMemberTitle: (memberId, titleId) => api.delete(`/leader/members/${memberId}/titles/${titleId}`),
};

// Pastor API
export const pastorAPI = {
  getDashboardStats: (filters = {}) => api.get('/pastor/dashboard/stats', { params: filters }),
  getTrends: (filters = {}) => api.get('/pastor/dashboard/trends', { params: filters }),
  getLeaderMetrics: (filters = {}) => api.get('/pastor/leaders/metrics', { params: filters }),
  getAtRiskMembers: () => api.get('/pastor/members/at-risk'),
  getMemberHistory: (memberId) => api.get(`/pastor/members/${memberId}/history`),
  exportAttendance: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    window.open(`/api/pastor/export?${params.toString()}`, '_blank');
  },
  getEngagementScores: (filters = {}) => api.get('/pastor/engagement', { params: filters }),
  getWeeklySummary: (week) => api.get('/pastor/weekly-summary', { params: { week } }),
  getFollowUpAlerts: () => api.get('/pastor/alerts/follow-up-needed'),
  getBirthdayAlerts: () => api.get('/pastor/alerts/birthdays'),
};

// Analytics API (admin/pastor only)
export const analyticsAPI = {
  getPredictions: () => api.get('/analytics/predictions'),
  getAnomalies: (threshold) => api.get('/analytics/anomalies', { params: { threshold } }),
  getStreaks: (limit) => api.get('/analytics/streaks', { params: { limit } }),
  getLeaderTrends: (filters = {}) => api.get('/analytics/leader-trends', { params: filters }),
  getEngagementScores: (limit) => api.get('/analytics/engagement-scores', { params: { limit } }),
  getDemographics: () => api.get('/analytics/demographics'),
  getYearOverYear: () => api.get('/analytics/year-over-year'),
  getRetention: (days) => api.get('/analytics/retention', { params: { days } }),
  getDashboardMetrics: (serviceId) => api.get('/analytics/dashboard-metrics', { params: { service_id: serviceId } }),
  getSectionComparison: (days, startDate, endDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/analytics/section-comparison', { params });
  },
  getServiceComparison: (days, startDate, endDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/analytics/service-comparison', { params });
  },
  getServiceTypeBreakdown: (days) => api.get('/analytics/service-type-breakdown', { params: { days } }),
  getAttendancePatterns: (days) => api.get('/analytics/attendance-patterns', { params: { days } }),
  getMonthlyTrends: (months) => api.get('/analytics/monthly-trends', { params: { months } }),
  getEvangelismFunnel: () => api.get('/analytics/evangelism-funnel'),
  getNewMemberFunnel: () => api.get('/analytics/new-member-funnel'),
  getExecutiveDashboard: () => api.get('/analytics/executive-dashboard'),
  getComparison: (params) => api.get('/analytics/comparison', { params }),
  getHistorical: (params) => api.get('/analytics/historical', { params }),
  getSectionRankings: (days, startDate, endDate, prevStartDate, prevEndDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (prevStartDate) params.prevStartDate = prevStartDate;
    if (prevEndDate) params.prevEndDate = prevEndDate;
    return api.get('/analytics/section-rankings', { params });
  },
  getHeadLeaderAnalytics: (days, startDate, endDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/analytics/head-leader-analytics', { params });
  },
  getLeaderRankings: (days, startDate, endDate, prevStartDate, prevEndDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (prevStartDate) params.prevStartDate = prevStartDate;
    if (prevEndDate) params.prevEndDate = prevEndDate;
    return api.get('/analytics/leader-rankings', { params });
  },
  getAbsentStreaks: (limit) => api.get('/analytics/absent-streaks', { params: { limit } }),
  getDepartments: (days, startDate, endDate) => {
    const params = { days };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/analytics/departments', { params });
  },
  getMemberIntelligence: (days, filterType, filterValue, serviceId, startDate, endDate) => {
    const params = { days };
    if (filterType) params.filterType = filterType;
    if (filterValue) params.filterValue = filterValue;
    if (serviceId) params.service_id = serviceId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.fallback_latest = 'true';
    return api.get('/analytics/member-intelligence', { params });
  },
  getMemberAttendanceDetails: (memberId, days = 180, serviceId = 'all') => api.get(`/analytics/member-intelligence/${memberId}/attendance`, {
    params: { days, service_id: serviceId }
  }),
  getHeatmap: (months) => api.get('/analytics/heatmap', { params: { months } }),
  getTrendsMA: (weeks) => api.get('/analytics/trends-ma', { params: { weeks } }),
  getRiskAnalysis: () => api.get('/analytics/risk-analysis'),
  getLeaderWorkload: (days) => api.get('/analytics/leader-workload', { params: { days } }),
  getCorrelations: (months) => api.get('/analytics/correlations', { params: { months } }),
  getChurchGrowthIndex: () => api.get('/analytics/church-growth-index'),
  getAIInsights: () => api.get('/analytics/ai-insights'),
  getFinanceAnalytics: (year) => api.get('/analytics/finance-analytics', { params: { year } }),
};

// New Member Leader API
export const newMemberLeaderAPI = {
  getNewMembers: (status) => api.get('/new-member-leader/new-members', { params: { status } }),
  getNewMember: (id) => api.get(`/new-member-leader/new-members/${id}`),
  createNewMember: (data) => api.post('/new-member-leader/new-members', data),
  updateNewMember: (id, data) => api.put(`/new-member-leader/new-members/${id}`, data),
  deleteNewMember: (id) => api.delete(`/new-member-leader/new-members/${id}`),
  graduateNewMember: (id, sectionId) => api.post(`/new-member-leader/new-members/${id}/graduate`, { section_id: sectionId }),
  makePermanent: (id) => api.post(`/new-member-leader/new-members/${id}/permanent`),
  getAttendance: (id) => api.get(`/new-member-leader/new-members/${id}/attendance`),
  recordAttendance: (id, weekStart, attended, notes) =>
    api.post(`/new-member-leader/new-members/${id}/attendance`, { week_start: weekStart, attended, notes }),
  getReport: (params) => api.get('/new-member-leader/reports/new-members', { params }),
  getSections: () => api.get('/new-member-leader/sections'),
  getSectionWithLeastMembers: () => api.get('/new-member-leader/sections/least-members'),
  getWeekAttendance: (weekStart) => api.get(`/new-member-leader/attendance/${weekStart}`),
};

// Birthdays API
export const birthdayAPI = {
  getBirthdays: (params) => api.get('/birthdays', { params }),
  exportBirthdays: (params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/birthdays/export?${query}`, '_blank');
  }
};

// Outreach API
export const outreachAPI = {
  getStats: () => api.get('/outreach/stats'),
  getMembers: (filters = {}) => api.get('/outreach/members', { params: filters }),
  getLeaders: () => api.get('/outreach/leaders'),
  logOutreach: (data) => api.post('/outreach/log', data),
  getHistory: () => api.get('/outreach/history'),
};

// Contributions API
export const contributionAPI = {
  getTypes: () => api.get('/admin/contribution-types'),
  getType: (id) => api.get(`/admin/contribution-types/${id}`),
  createType: (data) => api.post('/admin/contribution-types', data),
  updateType: (id, data) => api.put(`/admin/contribution-types/${id}`, data),
  deleteType: (id) => api.delete(`/admin/contribution-types/${id}`),

  getContributions: (filters = {}) => api.get('/admin/contributions', { params: filters }),
  getContribution: (id) => api.get(`/admin/contributions/${id}`),
  createContribution: (data) => api.post('/admin/contributions', data),
  updateContribution: (id, data) => api.put(`/admin/contributions/${id}`, data),
  deleteContribution: (id) => api.delete(`/admin/contributions/${id}`),

  getSummary: (filters = {}) => api.get('/admin/contributions/summary', { params: filters }),
  getDetail: (from, to) => api.get('/admin/contributions/detail', { params: { from, to } }),
};

// Finance API
export const financeAPI = {
  getRecords: (filters = {}) => api.get('/admin/finance/records', { params: filters }),
  getRecord: (id) => api.get(`/admin/finance/records/${id}`),
  createRecord: (data) => api.post('/admin/finance/records', data),
  updateRecord: (id, data) => api.put(`/admin/finance/records/${id}`, data),
  deleteRecord: (id) => api.delete(`/admin/finance/records/${id}`),
  submitRecord: (id) => api.post(`/admin/finance/records/${id}/submit`),
  approveRecord: (id) => api.put(`/admin/finance/records/${id}/approve`),
  rejectRecord: (id, reason) => api.put(`/admin/finance/records/${id}/reject`, { reason }),
  sendBackRecord: (id) => api.put(`/admin/finance/records/${id}/send-back`),
  recalculateRecord: (id) => api.put(`/admin/finance/records/${id}/recalculate`),

  addExpense: (recordId, data) => api.post(`/admin/finance/records/${recordId}/expenses`, data),
  updateExpense: (id, data) => api.put(`/admin/finance/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/admin/finance/expenses/${id}`),
  uploadReceipt: (expenseId, file) => {
    const fd = new FormData();
    fd.append('receipt', file);
    return api.post(`/admin/finance/expenses/${expenseId}/receipt`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadRecordReceipt: (recordId, type, formData) => {
    return api.post(`/admin/finance/records/${recordId}/receipt/${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getSubmissions: (status) => api.get('/admin/finance/submissions', { params: status ? { status } : {} }),
  getSummary: (dateFrom, dateTo) => api.get('/admin/finance/reports/summary', { params: { date_from: dateFrom, date_to: dateTo } }),
  getTrend: (year) => api.get('/admin/finance/reports/trend', { params: { year } }),
  getExport: (dateFrom, dateTo) => api.get('/admin/finance/reports/export', { params: { date_from: dateFrom, date_to: dateTo } }),
  searchMembers: (q) => api.get('/admin/finance/members/search', { params: { q } }),
};

export const evangelismAPI = {
  getStats: () => api.get('/evangelism/stats'),
  getTrend: () => api.get('/evangelism/trend'),
  getFunnel: () => api.get('/evangelism/funnel'),
  getMonthlyReport: (year) => api.get('/evangelism/report/monthly', { params: { year } }),
  getAnnualReport: (year) => api.get('/evangelism/report/annual', { params: { year } }),

  getOutreachEvents: (filters = {}) => api.get('/evangelism/outreach-events', { params: filters }),
  createOutreachEvent: (data) => api.post('/evangelism/outreach-events', data),
  updateOutreachEvent: (id, data) => api.put(`/evangelism/outreach-events/${id}`, data),
  deleteOutreachEvent: (id) => api.delete(`/evangelism/outreach-events/${id}`),

  getSoulsWon: (filters = {}) => api.get('/evangelism/souls-won', { params: filters }),
  getSoulWon: (id) => api.get(`/evangelism/souls-won/${id}`),
  createSoulWon: (data) => api.post('/evangelism/souls-won', data),
  updateSoulWon: (id, data) => api.put(`/evangelism/souls-won/${id}`, data),
  deleteSoulWon: (id) => api.delete(`/evangelism/souls-won/${id}`),

  getFollowUps: (soulWonId) => api.get(`/evangelism/follow-ups/${soulWonId}`),
  createFollowUp: (data) => api.post('/evangelism/follow-ups', data),
  updateFollowUp: (id, data) => api.put(`/evangelism/follow-ups/${id}`, data),

  getTeam: () => api.get('/evangelism/team'),
  createTeamMember: (data) => api.post('/evangelism/team', data),
  updateTeamMember: (id, data) => api.put(`/evangelism/team/${id}`, data),
  deleteTeamMember: (id) => api.delete(`/evangelism/team/${id}`),

  getBaptismRecords: () => api.get('/evangelism/baptism'),
  createBaptismRecord: (data) => api.post('/evangelism/baptism', data),
  updateBaptismRecord: (id, data) => api.put(`/evangelism/baptism/${id}`, data),
  deleteBaptismRecord: (id) => api.delete(`/evangelism/baptism/${id}`),

  getMemberNames: () => api.get('/evangelism/member-names'),
};

export default api;
