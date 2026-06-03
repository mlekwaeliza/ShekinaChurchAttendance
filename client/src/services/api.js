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
    const e = new Error(`${status ? `[${status}] ` : ''}${message}`);
    e.status = status;
    e.original = err;
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
  deleteMember: (id) => api.delete(`/admin/members/${id}`),
  getAttendance: (filters = {}) => api.get('/admin/attendance', { params: filters }),
  getAttendanceTrends: (days = 90) => api.get('/admin/attendance-trends', { params: { days } }),
  updateAttendance: (id, status) => api.put(`/admin/attendance/${id}`, { status }),
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
  updateHomeCellLeaders: (cellId, leaderIds) => api.put(`/admin/home-cells/${cellId}/leaders`, { leader_ids: leaderIds }),
  createHomeCellMember: (data) => api.post('/admin/home-cell-members', data),
  deleteHomeCellMember: (id) => api.delete(`/admin/home-cell-members/${id}`),
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
  getAssignments: () => api.get('/leader/assignments')
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

export default api;
