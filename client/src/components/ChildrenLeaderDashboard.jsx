import React, { useState, useEffect } from 'react';
import { childrenLeaderAPI } from '../services/api';
import {
  Baby, CalendarCheck, Users, BarChart3,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

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
      await childrenLeaderAPI.recordAttendance({ child_id: childId, date: selectedDate, status });
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
            <StatCard icon={Baby} label="Total Children" value={dashboard.totalChildren} color="blue" />
            <StatCard icon={CheckCircle} label="Present Today" value={dashboard.presentToday} color="green" />
            <StatCard icon={XCircle} label="Absent Today" value={dashboard.absentToday} color="red" />
            <StatCard icon={AlertCircle} label="Excused Today" value={dashboard.excusedToday} color="yellow" />
          </div>
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Weekly Attendance Trend</h3>
              {dashboard.weeklyTrend && (
                <BarChart width={600} height={300} data={dashboard.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#10B981" />
                  <Bar dataKey="absent" fill="#EF4444" />
                  <Bar dataKey="excused" fill="#F59E0B" />
                </BarChart>
              )}
            </div>
            <div className="chart-card">
              <h3>Class Distribution</h3>
              {dashboard.classDistribution && (
                <PieChart width={400} height={300}>
                  <Pie
                    data={dashboard.classDistribution}
                    cx={200}
                    cy={150}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="class_name"
                    label
                  >
                    {dashboard.classDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
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
                    <td>{child.name}</td>
                    <td>{child.age}</td>
                    <td>{child.class_name}</td>
                    <td>{child.parent_name}</td>
                    <td>{child.parent_phone}</td>
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
                        <span className="child-name">{child.name}</span>
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
                  <th>Child</th>
                  <th>Status</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, idx) => (
                  <tr key={idx}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.child_name}</td>
                    <td><span className={`status-badge ${record.status}`}>{record.status}</span></td>
                    <td>{record.recorded_by}</td>
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
