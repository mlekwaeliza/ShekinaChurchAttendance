import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { pastorAPI } from '../services/api';

const PastorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [leaderMetrics, setLeaderMetrics] = useState([]);
  const [atRiskMembers, setAtRiskMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllData();
  }, [dateRange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, trendsRes, leadersRes, atRiskRes] = await Promise.all([
        pastorAPI.getDashboardStats(dateRange),
        pastorAPI.getTrends(dateRange),
        pastorAPI.getLeaderMetrics(dateRange),
        pastorAPI.getAtRiskMembers()
      ]);
      setStats(statsRes.data);
      setTrends(trendsRes.data);
      setLeaderMetrics(leadersRes.data);
      setAtRiskMembers(atRiskRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    pastorAPI.exportAttendance(dateRange);
  };

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pastor Dashboard</h2>
          <p className="text-gray-600">Overview of attendance and engagement</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label>From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label>To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border rounded px-2 py-1"
            />
          </div>
          <button
            onClick={exportData}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Latest Date</h3>
            <p className="text-2xl font-bold">{stats.latestDate || 'N/A'}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Avg Attendance</h3>
            <p className="text-2xl font-bold">
              {stats.overallAttendance?.length > 0
                ? Math.round(
                    stats.overallAttendance.reduce((sum, d) => sum + (d.present_count / d.total_members) * 100, 0) /
                    stats.overallAttendance.length
                  ) + '%'
                : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Submission Rate</h3>
            <p className={`text-2xl font-bold ${stats.completion?.rate >= 90 ? 'text-green-600' : stats.completion?.rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.completion?.rate}%
            </p>
            <p className="text-sm text-gray-500">{stats.completion?.leadersSubmitted}/{stats.completion?.totalLeaders} leaders</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">At-Risk Members</h3>
            <p className="text-2xl font-bold text-red-600">{atRiskMembers.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Attendance Trends</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attendance_rate" stroke="#3b82f6" name="Attendance %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>

        {/* Latest Section Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Section Performance</h3>
          {stats?.sectionBreakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.sectionBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="section_name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="attendance_rate" fill="#3b82f6" name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>
      </div>

      {/* Leader Metrics Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Leader Performance</h3>
        {leaderMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reporting Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Records</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Present Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaderMetrics.map((leader, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{leader.leader_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.section_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.reporting_days}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.total_records}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{leader.total_present}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-bold ${leader.attendance_rate >= 90 ? 'text-green-600' : leader.attendance_rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {leader.attendance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No metrics available</p>
        )}
      </div>

      {/* At-Risk Members */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-red-600">At-Risk Members (3+ absences in last 30 days)</h3>
        {atRiskMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membership ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absences (30 days)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atRiskMembers.map((member, idx) => (
                  <tr key={idx} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap">{member.membership_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{member.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.section_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{member.leader_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-bold">
                        {member.absence_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No at-risk members in the last 30 days</p>
        )}
      </div>
    </div>
  );
};

export default PastorDashboard;
