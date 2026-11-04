import React, { useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, CheckCircle2, Users, XCircle } from 'lucide-react';
import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';

const LeaderReports = ({ trendsData, trendsLoading, _loadTrends }) => {
  const summaryStats = useMemo(() => {
    const total = trendsData.reduce((sum, d) => sum + Number(d.total_members), 0);
    const present = trendsData.reduce((sum, d) => sum + Number(d.present_count), 0);
    const absent = trendsData.reduce((sum, d) => sum + Number(d.absent_count), 0);
    const avgAttendance = trendsData.length > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, avgAttendance };
  }, [trendsData]);

  const { present, absent, avgAttendance } = summaryStats;

  const columns = useMemo(
    () => [
      {
        accessor: 'date',
        header: 'Date',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-label">
            {new Date(row.date).toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        )
      },
      {
        accessor: 'present_count',
        header: 'Present',
        sortable: true,
        align: 'center',
        render: (row) => (
          <span className="font-semibold text-emerald-700 dark:text-system-green tabular-nums">
            {row.present_count}
          </span>
        )
      },
      {
        accessor: 'absent_count',
        header: 'Absent',
        sortable: true,
        align: 'center',
        render: (row) => (
          <span className="font-semibold text-rose-700 dark:text-system-red tabular-nums">
            {row.absent_count}
          </span>
        )
      },
      {
        accessor: 'excused_count',
        header: 'Excused',
        sortable: true,
        align: 'center',
        render: (row) => (
          <span className="font-semibold text-amber-700 dark:text-system-orange tabular-nums">
            {row.excused_count}
          </span>
        )
      },
      {
        accessor: 'total_members',
        header: 'Total',
        sortable: true,
        align: 'center',
        render: (row) => (
          <span className="font-semibold text-label tabular-nums">{row.total_members}</span>
        )
      },
      {
        id: 'rate',
        header: 'Rate',
        align: 'center',
        sortable: false,
        render: (row) => {
          const rate =
            row.total_members > 0 ? Math.round((row.present_count / row.total_members) * 100) : 0;
          const variant = rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger';
          const badgeClass =
            variant === 'success'
              ? 'badge-success'
              : variant === 'warning'
                ? 'badge-warning'
                : 'badge-danger';
          return <span className={badgeClass}>{rate}%</span>;
        }
      }
    ],
    []
  );

  const chartTooltipStyle = useMemo(
    () => ({
      borderRadius: '12px',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 8px 28px rgba(16,24,40,0.12)',
      fontSize: 12
    }),
    []
  );

  const labelFormatter = useCallback(
    (val) =>
      new Date(val).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    []
  );

  const tickFormatter = useCallback(
    (val) =>
      new Date(val).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      }),
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Banner */}
      <div className="card p-5">
        <h3 className="text-headline font-semibold text-label">
          Attendance Reports & Visualization
        </h3>
        <p className="mt-1 text-footnote text-secondary-label">
          Visual analysis of your section's attendance over the last 90 days
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Total Sessions" value={trendsData.length} variant="info" />
        <StatCard
          icon={CheckCircle2}
          label="Avg Attendance"
          value={`${avgAttendance}%`}
          variant="success"
        />
        <StatCard icon={Users} label="Total Present" value={present} variant="success" />
        <StatCard icon={XCircle} label="Total Absent" value={absent} variant="danger" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#c7c7cc" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#8e8e93' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <YAxis tick={{ fontSize: 11, fill: '#8e8e93' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} labelFormatter={labelFormatter} />
              <Legend iconType="circle" />
              <Line
                type="monotone"
                dataKey="present_count"
                stroke="#34c759"
                strokeWidth={2.5}
                name="Present"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="absent_count"
                stroke="#ff3b30"
                strokeWidth={2.5}
                name="Absent"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="excused_count"
                stroke="#ff9500"
                strokeWidth={2.5}
                name="Excused"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#c7c7cc" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#8e8e93' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <YAxis tick={{ fontSize: 11, fill: '#8e8e93' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} labelFormatter={labelFormatter} />
              <Legend iconType="circle" />
              <Area
                type="monotone"
                dataKey="present_count"
                stackId="1"
                stroke="#34c759"
                fill="#34c759"
                fillOpacity={0.6}
                name="Present"
              />
              <Area
                type="monotone"
                dataKey="absent_count"
                stackId="1"
                stroke="#ff3b30"
                fill="#ff3b30"
                fillOpacity={0.6}
                name="Absent"
              />
              <Area
                type="monotone"
                dataKey="excused_count"
                stackId="1"
                stroke="#ff9500"
                fill="#ff9500"
                fillOpacity={0.6}
                name="Excused"
              />
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
                  { name: 'Excused', value: trendsData[trendsData.length - 1]?.excused_count || 0 }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                dataKey="value"
              >
                <Cell fill="#34c759" />
                <Cell fill="#ff3b30" />
                <Cell fill="#ff9500" />
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
                  d.total_members > 0 ? Math.round((d.present_count / d.total_members) * 100) : 0
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#c7c7cc" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#8e8e93' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#8e8e93' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={labelFormatter}
                formatter={(value) => [`${value}%`, 'Attendance Rate']}
              />
              <Bar
                dataKey="attendance_rate"
                fill="#0d897b"
                radius={[6, 6, 0, 0]}
                name="Attendance Rate"
              />
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
