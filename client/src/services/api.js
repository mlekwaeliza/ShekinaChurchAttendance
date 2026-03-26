import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

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
  getMembers: (filters = {}) => api.get('/admin/members', { params: filters }),
  updateMember: (id, data) => api.put(`/admin/members/${id}`, data),
  deleteMember: (id) => api.delete(`/admin/members/${id}`),
  getAttendance: (filters = {}) => api.get('/admin/attendance', { params: filters }),
  updateAttendance: (id, status) => api.put(`/admin/attendance/${id}`, { status }),
  exportAttendance: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    window.open(`/api/admin/export?${params}`, '_blank');
  },
  getLeaders: () => api.get('/admin/leaders')
};

// Leader API
export const leaderAPI = {
  getMembers: () => api.get('/leader/members'),
  getAttendanceStatus: (date) => api.get(`/leader/attendance/${date}`),
  submitAttendance: (date, attendance) => api.post('/leader/attendance', { date, attendance }),
  getHistory: () => api.get('/leader/history')
};

// Pastor API
export const pastorAPI = {
  getDashboardStats: (filters = {}) => api.get('/pastor/dashboard/stats', { params: filters }),
  getTrends: (filters = {}) => api.get('/pastor/dashboard/trends', { params: filters }),
  getLeaderMetrics: (filters = {}) => api.get('/pastor/leaders/metrics', { params: filters }),
  getAtRiskMembers: () => api.get('/pastor/members/at-risk'),
  getMemberHistory: (memberId) => api.get(`/pastor/members/${memberId}/history`)
};

export default api;
