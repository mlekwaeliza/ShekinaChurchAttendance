import React, { useMemo, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, CheckCircle2, Users, XCircle } from 'lucide-react';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';

const LeaderReports = ({ trendsData, trendsLoading, loadTrends }) => {
  const summaryStats = useMemo(() => {
    const total = trendsData.reduce((sum, d) => sum + d.total_members, 0);
    const present = trendsData.reduce((sum, d) => sum + d.present_count, 0);
    const absent = trendsData.reduce((sum, d) => sum + d.absent_count, 0);
    const avgAttendance = trendsData.length > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, avgAttendance };
  }, [trendsData]);

  const { total, present, absent, avgAttendance } = summaryStats;

  const columns = useMemo(() => [
    {
      accessor: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {new Date(row.date).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      accessor: 'present_count',
      header: 'Present',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {row.present_count}
        </span>
      ),
    },
    {
      accessor: 'absent_count',
      header: 'Absent',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
          {row.absent_count}
        </span>
      ),
    },
    {
      accessor: 'excused_count',
      header: 'Excused',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
          {row.excused_count}
        </span>
      ),
    },
    {
      accessor: 'total_members',
      header: 'Total',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {row.total_members}
        </span>
      ),
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'center',
      sortable: false,
      render: (row) => {
        const rate =
          row.total_members > 0
            ? Math.round((row.present_count / row.total_members) * 100)
            : 0;
        const variant =
          rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger';
        const badgeClass = variant === 'success' ? 'badge-success' : variant === 'warning' ? 'badge-warning' : 'badge-danger';
        return <span className={badgeClass}>{rate}%</span>;
      },
    },
  ], []);

  const chartTooltipStyle = useMemo(() => ({
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  }), []);

  const labelFormatter = useCallback((val) =>
    new Date(val).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }), []);

  const tickFormatter = useCallback((val) =>
    new Date(val).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }), []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Banner */}
      <div className="card p-5 bg-gradient-to-r from-primary-50 to-slate-50 dark:from-primary-900/20 dark:to-slate-800/50 border-primary-100 dark:border-primary-800/50">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Attendance Reports & Visualization
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Visual analysis of your section's attendance over the last 90 days
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Total Sessions"
          value={trendsData.length}
          variant="info"
        />
        <StatCard
          icon={CheckCircle2}
          label="Avg Attendance"
          value={`${avgAttendance}%`}
          variant="success"
        />
        <StatCard
          icon={Users}
          label="Total Present"
          value={present}
          variant="success"
        />
        <StatCard
          icon={XCircle}
          label="Total Absent"
          value={absent}
          variant="danger"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <ChartCard
          title="Attendance Trend Over Time"
          loading={trendsLoading}
          empty={trendsData.length === 0}
          height="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} labelFormatter={labelFormatter} />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="present_count" stroke="#10b981" strokeWidth={2.5} name="Present" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="absent_count" stroke="#ef4444" strokeWidth={2.5} name="Absent" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="excused_count" stroke="#f59e0b" strokeWidth={2.5} name="Excused" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Attendance Composition */}
        <ChartCard
          title="Attendance Composition"
          loading={trendsLoading}
          empty={trendsData.length === 0}
          height="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} labelFormatter={labelFormatter} />
              <Legend iconType="circle" />
              <Area type="monotone" dataKey="present_count" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Present" />
              <Area type="monotone" dataKey="absent_count" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Absent" />
              <Area type="monotone" dataKey="excused_count" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Excused" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Pie Chart */}
        <ChartCard
          title="Latest Attendance Distribution"
          loading={trendsLoading}
          empty={trendsData.length === 0}
          height="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Present', value: trendsData[trendsData.length - 1]?.present_count || 0 },
                  { name: 'Absent', value: trendsData[trendsData.length - 1]?.absent_count || 0 },
                  { name: 'Excused', value: trendsData[trendsData.length - 1]?.excused_count || 0 },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar Chart */}
        <ChartCard
          title="Weekly Attendance Rate"
          loading={trendsLoading}
          empty={trendsData.length === 0}
          height="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trendsData.map((d) => ({
                ...d,
                attendance_rate:
                  d.total_members > 0
                    ? Math.round((d.present_count / d.total_members) * 100)
                    : 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={labelFormatter}
                formatter={(value) => [`${value}%`, 'Attendance Rate']}
              />
              <Bar dataKey="attendance_rate" fill="#6366f1" radius={[6, 6, 0, 0]} name="Attendance Rate" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={[...trendsData].reverse()}
        searchable={false}
        emptyTitle="No data available"
        emptyDescription="Start submitting attendance to see reports."
      />
    </div>
  );
};

export default LeaderReports;
