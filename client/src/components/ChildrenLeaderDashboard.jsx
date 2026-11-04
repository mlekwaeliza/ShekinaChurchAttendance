import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { childrenLeaderAPI } from '../services/api';
import StatCard from './ui/StatCard';
import EmptyState from './ui/EmptyState';
import LoadingSkeleton from './ui/LoadingSkeleton';
import {
  Baby,
  CalendarCheck,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const AGE_GROUPS = ['Nursery', 'Toddler', 'Preschool', 'Primary', 'Pre-Teen', 'Youth'];

export default function ChildrenLeaderDashboard() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tab || 'overview');
  const [dashboard, setDashboard] = useState(null);
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [ageGroupFilter, setAgeGroupFilter] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'children') loadChildren(ageGroupFilter);
    if (activeTab === 'attendance') {
      loadClasses();
      loadChildren(ageGroupFilter);
      loadAttendance(selectedDate, ageGroupFilter);
    }
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'trends') loadTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendance(selectedDate, ageGroupFilter);
    if (activeTab === 'children') loadChildren(ageGroupFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, ageGroupFilter]);

  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const setTab = (newTab) => {
    setActiveTab(newTab);
    navigate(`/children-leader/${newTab === 'overview' ? '' : newTab}`);
  };

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

  const loadChildren = async (ageGroup) => {
    setChildrenLoading(true);
    try {
      const params = {};
      if (ageGroup) params.age_group = ageGroup;
      const res = await childrenLeaderAPI.getChildren(params);
      setChildren(res.data);
    } catch (err) {
      console.error('Failed to load children:', err);
    } finally {
      setChildrenLoading(false);
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

  const loadAttendance = async (date, ageGroup) => {
    try {
      const params = {};
      if (ageGroup) params.age_group = ageGroup;
      const res = await childrenLeaderAPI.getAttendance(date, params);
      setAttendance(res.data.attendance || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await childrenLeaderAPI.getHistory();
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTrends = async () => {
    setTrendsLoading(true);
    try {
      const res = await childrenLeaderAPI.getTrends();
      setTrends(res.data);
    } catch (err) {
      console.error('Failed to load trends:', err);
    } finally {
      setTrendsLoading(false);
    }
  };

  const recordAttendance = async (childId, status) => {
    try {
      await childrenLeaderAPI.recordAttendance({
        date: selectedDate,
        records: [{ child_id: childId, status }]
      });
      loadAttendance(selectedDate);
    } catch (err) {
      console.error('Failed to record attendance:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-1 font-semibold text-label">Children's Ministry</h1>
        <p className="mt-1 text-footnote text-secondary-label">
          Manage your children's ministry classes and attendance
        </p>
      </div>

      <div className="tab-pills">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'children', label: 'Children', icon: Baby },
          { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { id: 'history', label: 'History', icon: Clock },
          { id: 'trends', label: 'Trends', icon: BarChart3 }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`tab-pill flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Baby}
              label="Total Children"
              value={dashboard.stats?.totalChildren || 0}
              variant="info"
            />
            <StatCard
              icon={CheckCircle}
              label="Present Today"
              value={dashboard.todayAttendance?.length || 0}
              variant="success"
            />
            <StatCard
              icon={XCircle}
              label="Absent This Week"
              value={dashboard.stats?.totalAbsent || 0}
              variant="danger"
            />
            <StatCard
              icon={AlertCircle}
              label="Excused This Week"
              value={dashboard.stats?.totalExcused || 0}
              variant="warning"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background dark:border-white/[0.08] p-5 shadow-card">
              <h3 className="mb-4 text-footnote font-semibold text-label">
                Weekly Attendance Trend
              </h3>
              {dashboard.weeklyStats?.length > 0 ? (
                <div className="overflow-x-auto">
                  <BarChart width={500} height={280} data={dashboard.weeklyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f1f5f9',
                        fontSize: 12
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="present_count"
                      name="Present"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="absent_count"
                      name="Absent"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="excused_count"
                      name="Excused"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-footnote text-tertiary-label">
                  No attendance data yet
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background dark:border-white/[0.08] p-5 shadow-card">
              <h3 className="mb-4 text-footnote font-semibold text-label">Attendance Summary</h3>
              <div className="flex flex-col items-center justify-center py-6">
                <span className="text-5xl font-semibold text-primary-600">
                  {dashboard.stats?.attendanceRate || 0}%
                </span>
                <span className="mt-1 text-footnote text-secondary-label">
                  Weekly attendance rate
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                  <p className="text-headline font-semibold text-emerald-700 dark:text-emerald-300">
                    {dashboard.stats?.totalPresent || 0}
                  </p>
                  <p className="text-caption-1 text-emerald-600 dark:text-emerald-400">Present</p>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-center">
                  <p className="text-headline font-semibold text-rose-700 dark:text-rose-300">
                    {dashboard.stats?.totalAbsent || 0}
                  </p>
                  <p className="text-caption-1 text-rose-600 dark:text-rose-400">Absent</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                  <p className="text-headline font-semibold text-amber-700 dark:text-amber-300">
                    {dashboard.stats?.totalExcused || 0}
                  </p>
                  <p className="text-caption-1 text-amber-600 dark:text-amber-400">Excused</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'children' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-label">Children in Your Ministry</h2>
            <select
              value={ageGroupFilter}
              onChange={(e) => setAgeGroupFilter(e.target.value)}
              className="input w-auto min-w-[160px] self-start"
            >
              <option value="">All Age Groups</option>
              {AGE_GROUPS.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>
          {childrenLoading ? (
            <LoadingSkeleton type="table" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
              <table className="min-w-full divide-y divide-separator/50 dark:divide-white/[0.06]">
                <thead className="bg-system-fill">
                  <tr>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Age Group
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Parent/Guardian
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                  {children.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8">
                        <EmptyState
                          icon={Users}
                          title="No children assigned yet"
                          description="Children added to your ministry will appear here."
                        />
                      </td>
                    </tr>
                  ) : (
                    children.map((child) => (
                      <tr
                        key={child.id}
                        className="hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-footnote font-medium text-label">
                          {child.full_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {child.age_group || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {child.class_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {child.parent_guardian_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {child.parent_guardian_phone || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-label">Record Attendance</h2>
            <div className="flex items-center gap-3">
              <select
                value={ageGroupFilter}
                onChange={(e) => setAgeGroupFilter(e.target.value)}
                className="input w-auto min-w-[160px]"
              >
                <option value="">All Age Groups</option>
                {AGE_GROUPS.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-footnote font-medium text-secondary-label">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input w-auto"
                />
              </div>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background dark:border-white/[0.08] p-8 text-center shadow-card">
              <CalendarCheck className="mx-auto h-10 w-10 text-tertiary-label dark:text-secondary-label" />
              <p className="mt-2 text-footnote text-secondary-label">No classes available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {classes.map((cls) => {
                const classChildren = children.filter((c) => c.class_id === cls.id);
                return (
                  <div
                    key={cls.id}
                    className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background dark:border-white/[0.08] shadow-card overflow-hidden"
                  >
                    <div className="flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-system-fill px-5 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
                        <Baby className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <h3 className="text-footnote font-semibold text-label">{cls.name}</h3>
                        <p className="text-caption-1 text-secondary-label">
                          {classChildren.length} children
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      {classChildren.length === 0 ? (
                        <p className="text-footnote text-tertiary-label text-center py-4">
                          No children in this class
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {classChildren.map((child) => {
                            const record = attendance.find((a) => a.child_id === child.id);
                            return (
                              <div
                                key={child.id}
                                className="flex items-center justify-between rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-system-grouped-background/60 px-4 py-3"
                              >
                                <span className="text-footnote font-medium text-label">
                                  {child.full_name}
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    className={`rounded-lg px-2.5 py-1 text-caption-1 font-semibold transition-all ${
                                      record?.status === 'present'
                                        ? 'bg-emerald-500 text-white shadow-card'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                                    }`}
                                    onClick={() => recordAttendance(child.id, 'present')}
                                  >
                                    P
                                  </button>
                                  <button
                                    className={`rounded-lg px-2.5 py-1 text-caption-1 font-semibold transition-all ${
                                      record?.status === 'absent'
                                        ? 'bg-rose-500 text-white shadow-card'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50'
                                    }`}
                                    onClick={() => recordAttendance(child.id, 'absent')}
                                  >
                                    A
                                  </button>
                                  <button
                                    className={`rounded-lg px-2.5 py-1 text-caption-1 font-semibold transition-all ${
                                      record?.status === 'excused'
                                        ? 'bg-amber-500 text-white shadow-card'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                                    }`}
                                    onClick={() => recordAttendance(child.id, 'excused')}
                                  >
                                    E
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-label">Submission History</h2>
          {historyLoading ? (
            <LoadingSkeleton type="table" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
              <table className="min-w-full divide-y divide-separator/50 dark:divide-white/[0.06]">
                <thead className="bg-system-fill">
                  <tr>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Records
                    </th>
                    <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                      Submitted At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8">
                        <EmptyState
                          icon={Clock}
                          title="No submission history yet"
                          description="Attendance submissions will appear here once recorded."
                        />
                      </td>
                    </tr>
                  ) : (
                    history.map((record, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-label">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {record.class_name || 'All Classes'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-caption-1 font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                            {record.records_count} records
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-footnote text-secondary-label">
                          {new Date(record.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-label">Attendance Trends</h2>
          {trendsLoading ? (
            <LoadingSkeleton type="chart" />
          ) : (
            <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background dark:border-white/[0.08] p-5 shadow-card">
              {trends.length > 0 ? (
                <div className="overflow-x-auto">
                  <BarChart width={800} height={400} data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f1f5f9',
                        fontSize: 12
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="present_count"
                      name="Present"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="absent_count"
                      name="Absent"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="excused_count"
                      name="Excused"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No trend data available yet"
                  description="Weekly attendance trends will appear here once data is recorded."
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
