import React, { useState, useEffect } from 'react';
import { childrenLeaderAPI } from '../services/api';
import {
  Baby, CalendarCheck, Users, BarChart3,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

export default function ChildrenLeaderDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'children') loadChildren();
    if (activeTab === 'attendance') {
      loadClasses();
      loadAttendance(selectedDate);
    }
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'trends') loadTrends();
  }, [activeTab, selectedDate]);

  const loadDashboard = async () => {
    try {
      const res = await childrenLeaderAPI.getDashboard();
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async () => {
    try {
      const res = await childrenLeaderAPI.getChildren();
      setChildren(res.data);
    } catch (err) {
      console.error('Failed to load children:', err);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await childrenLeaderAPI.getClasses();
      setClasses(res.data);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const loadAttendance = async (date) => {
    try {
      const res = await childrenLeaderAPI.getAttendance(date);
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await childrenLeaderAPI.getHistory();
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadTrends = async () => {
    try {
      const res = await childrenLeaderAPI.getTrends();
      setTrends(res.data);
    } catch (err) {
      console.error('Failed to load trends:', err);
    }
  };

  const recordAttendance = async (childId, status) => {
    try {
      await childrenLeaderAPI.recordAttendance({ date: selectedDate, records: [{ child_id: childId, status }] });
      loadAttendance(selectedDate);
    } catch (err) {
      console.error('Failed to record attendance:', err);
    }
  };

  const StatCard = ({ icon, label, value, color }) => (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon && <icon size={16} />}
      </div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="children-leader-dashboard">
      <div className="dashboard-header">
        <h1>Children's Ministry Dashboard</h1>
        <p>Manage your children's ministry classes and attendance</p>
      </div>

      <div className="tabs">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'children', label: 'Children', icon: Baby },
          { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { id: 'history', label: 'History', icon: Users },
          { id: 'trends', label: 'Trends', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon && <tab.icon size={16} />} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && dashboard && (
        <div className="overview">
          <div className="stats-grid">
            <StatCard icon={Baby} label="Total Children" value={dashboard.stats?.totalChildren || 0} color="blue" />
            <StatCard icon={CheckCircle} label="Present Today" value={dashboard.todayAttendance?.length || 0} color="green" />
            <StatCard icon={XCircle} label="Absent This Week" value={dashboard.stats?.totalAbsent || 0} color="red" />
            <StatCard icon={AlertCircle} label="Excused This Week" value={dashboard.stats?.totalExcused || 0} color="yellow" />
          </div>
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Weekly Attendance Trend</h3>
              {dashboard.weeklyStats?.length > 0 ? (
                <BarChart width={600} height={300} data={dashboard.weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present_count" name="Present" fill="#10B981" />
                  <Bar dataKey="absent_count" name="Absent" fill="#EF4444" />
                  <Bar dataKey="excused_count" name="Excused" fill="#F59E0B" />
                </BarChart>
              ) : (
                <p className="empty-state">No attendance data yet</p>
              )}
            </div>
            <div className="chart-card">
              <h3>Attendance Rate</h3>
              <div className="rate-display">
                <span className="rate-value">{dashboard.stats?.attendanceRate || 0}%</span>
                <span className="rate-label">Weekly attendance rate</span>
              </div>
              <div className="stat-row">
                <span className="stat-item green">Present: {dashboard.stats?.totalPresent || 0}</span>
                <span className="stat-item red">Absent: {dashboard.stats?.totalAbsent || 0}</span>
                <span className="stat-item yellow">Excused: {dashboard.stats?.totalExcused || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'children' && (
        <div className="children-list">
          <h2>Children in Your Ministry</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Class</th>
                  <th>Parent/Guardian</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {children.map(child => (
                  <tr key={child.id}>
                    <td>{child.full_name}</td>
                    <td>{child.age_group || child.date_of_birth}</td>
                    <td>{child.class_name}</td>
                    <td>{child.parent_guardian_name}</td>
                    <td>{child.parent_guardian_phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="attendance">
          <h2>Record Attendance</h2>
          <div className="date-picker">
            <label>Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="attendance-form">
            {classes.map(cls => (
              <div key={cls.id} className="class-section">
                <h3>{cls.name}</h3>
                <div className="children-grid">
                  {children.filter(c => c.class_id === cls.id).map(child => {
                    const record = attendance.find(a => a.child_id === child.id);
                    return (
                      <div key={child.id} className="child-card">
                        <span className="child-name">{child.full_name}</span>
                        <div className="status-buttons">
                          <button
                            className={`status-btn present ${record?.status === 'present' ? 'active' : ''}`}
                            onClick={() => recordAttendance(child.id, 'present')}
                          >
                            <CheckCircle size={14} /> P
                          </button>
                          <button
                            className={`status-btn absent ${record?.status === 'absent' ? 'active' : ''}`}
                            onClick={() => recordAttendance(child.id, 'absent')}
                          >
                            <XCircle size={14} /> A
                          </button>
                          <button
                            className={`status-btn excused ${record?.status === 'excused' ? 'active' : ''}`}
                            onClick={() => recordAttendance(child.id, 'excused')}
                          >
                            <AlertCircle size={14} /> E
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history">
          <h2>Attendance History</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Class</th>
                  <th>Records Count</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, idx) => (
                  <tr key={idx}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.class_name || 'All Classes'}</td>
                    <td>{record.records_count}</td>
                    <td>{new Date(record.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="trends">
          <h2>Attendance Trends</h2>
          {trends.length > 0 && (
            <BarChart width={800} height={400} data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#10B981" />
              <Bar dataKey="absent" fill="#EF4444" />
              <Bar dataKey="excused" fill="#F59E0B" />
            </BarChart>
          )}
        </div>
      )}
    </div>
  );
}
