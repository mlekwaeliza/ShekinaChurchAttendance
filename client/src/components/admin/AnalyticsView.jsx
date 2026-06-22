import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Zap, Users, Calendar,
  Target, ArrowUp, ArrowDown, Minus, Building2, Church, Heart,
  ChevronDown, Filter
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import ChartCard from '../ui/ChartCard';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ComposedChart
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
const SECTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

const Stat = ({ icon: Icon, label, value, trend, color = 'indigo', sub }) => (
  <div className={`rounded-2xl border border-${color}-200/70 bg-white dark:bg-slate-800 dark:border-${color}-700 p-5 shadow-sm`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={`w-9 h-9 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
      </div>
    </div>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
        {trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {Math.abs(trend)}% vs last period
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3">
      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{p.name?.includes('Rate') || p.name?.includes('rate') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
};

const AnalyticsView = ({ trends = [], trendsLoading, loadTrends }) => {
  const [sectionComparison, setSectionComparison] = useState([]);
  const [serviceTypeBreakdown, setServiceTypeBreakdown] = useState([]);
  const [dayPatterns, setDayPatterns] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState({ attendance: [], contributions: [], sections: [] });
  const [yearOverYear, setYearOverYear] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [leaderPerformance, setLeaderPerformance] = useState([]);
  const [demographics, setDemographics] = useState(null);
  const [engagementScores, setEngagementScores] = useState([]);
  const [evangelismFunnel, setEvangelismFunnel] = useState(null);
  const [newMemberFunnel, setNewMemberFunnel] = useState([]);
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90);

  useEffect(() => {
    if (trends.length === 0 && loadTrends) loadTrends();
    loadAll();
  }, [period]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        analyticsAPI.getSectionComparison(period),
        analyticsAPI.getServiceTypeBreakdown(period),
        analyticsAPI.getAttendancePatterns(180),
        analyticsAPI.getMonthlyTrends(12),
        analyticsAPI.getYearOverYear(),
        analyticsAPI.getRetention(period),
        analyticsAPI.getEvangelismFunnel(),
        analyticsAPI.getNewMemberFunnel(),
        adminAPI.getAttendancePrediction(),
        adminAPI.getSectionAnomalies(),
        adminAPI.getMemberStreaks(20),
        adminAPI.getLeaderPerformance(),
        analyticsAPI.getDemographics(),
        analyticsAPI.getEngagementScores(10),
      ]);
      const ok = (i) => results[i].status === 'fulfilled' ? results[i].value.data : null;
      setSectionComparison(ok(0) || []);
      setServiceTypeBreakdown(ok(1) || []);
      setDayPatterns(ok(2) || []);
      setMonthlyTrends(ok(3) || { attendance: [], contributions: [], sections: [] });
      setYearOverYear(ok(4) || []);
      setRetention(ok(5));
      setEvangelismFunnel(ok(6));
      setNewMemberFunnel(ok(7) || []);
      setPrediction(ok(8));
      setAnomalies(ok(9) || []);
      setStreaks(ok(10) || []);
      setLeaderPerformance(ok(11) || []);
      setDemographics(ok(12));
      setEngagementScores(ok(13) || []);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalMembers = sectionComparison.reduce((s, sec) => s + (sec.member_count || 0), 0);
  const avgRate = sectionComparison.length > 0
    ? (sectionComparison.reduce((s, sec) => s + Number(sec.attendance_rate || 0), 0) / sectionComparison.length).toFixed(1)
    : 0;
  const totalPresent = sectionComparison.reduce((s, sec) => s + (sec.total_present || 0), 0);
  const totalNewMembers = sectionComparison.reduce((s, sec) => s + (sec.new_members || 0), 0);

  const anomalyData = anomalies.map(a => ({
    name: a.section_name,
    historical: a.historical_avg,
    current: a.latest_rate,
    drop: a.drop_amount,
  }));

  const sectionRadar = sectionComparison.map(sec => ({
    name: sec.name?.length > 12 ? sec.name.slice(0, 12) + '...' : sec.name,
    rate: Number(sec.attendance_rate) || 0,
    members: sec.member_count || 0,
    active: sec.active_members || 0,
  }));

  const serviceTypePie = serviceTypeBreakdown.map((st, i) => ({
    name: st.service_type_name,
    value: st.total_present || 0,
    rate: st.attendance_rate,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/5 rounded-full translate-y-24" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Analytics & Insights</h2>
              <p className="text-white/80 text-sm">Comprehensive department comparison and performance metrics</p>
            </div>
          </div>
          <select value={period} onChange={e => setPeriod(Number(e.target.value))}
            className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50">
            <option value={30} className="text-slate-900">Last 30 days</option>
            <option value={90} className="text-slate-900">Last 90 days</option>
            <option value={180} className="text-slate-900">Last 6 months</option>
            <option value={365} className="text-slate-900">Last year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={Users} label="Total Members" value={totalMembers.toLocaleString()} color="indigo" />
        <Stat icon={Target} label="Avg Attendance" value={`${avgRate}%`} color="emerald" sub={`${totalPresent.toLocaleString()} total present`} />
        <Stat icon={ArrowUp} label="New Members" value={totalNewMembers.toLocaleString()} color="violet" sub="Added this period" />
        <Stat icon={AlertTriangle} label="Anomalies" value={anomalies.length} color="amber" sub="Sections with drops" />
        <Stat icon={Zap} label="Retention" value={`${retention?.retention_rate || 0}%`} color="cyan" sub={`${retention?.still_attending || 0} of ${retention?.total_new_members || 0} new`} />
      </div>

      {/* ── SECTION COMPARISON ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Grouped Bar Chart */}
        <ChartCard
          title="Section Attendance Comparison"
          subtitle="Attendance rate and member count by section"
          height="h-[350px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectionComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="attendance_rate" name="Attendance Rate (%)" radius={[4, 4, 0, 0]}>
                {sectionComparison.map((_, i) => (
                  <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
                ))}
              </Bar>
              <Bar dataKey="member_count" name="Members" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar Chart */}
        <ChartCard
          title="Section Performance Radar"
          subtitle="Multi-dimensional section comparison"
          height="h-[350px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={sectionRadar}>
              <PolarGrid stroke="rgba(0,0,0,0.06)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <Radar name="Attendance Rate" dataKey="rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
              <Radar name="Active Members" dataKey="active" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Section Detail Table */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" />
          Section Performance Detail
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-3 text-xs font-semibold uppercase text-slate-500">Section</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Members</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Active</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">New</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Present</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Absent</th>
                <th className="text-right py-3 px-3 text-xs font-semibold uppercase text-slate-500">Rate</th>
                <th className="text-center py-3 px-3 text-xs font-semibold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {sectionComparison.map((sec, i) => (
                <tr key={sec.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SECTION_COLORS[i % SECTION_COLORS.length] }} />
                    {sec.name}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">{sec.member_count}</td>
                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">{sec.active_members}</td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-medium">+{sec.new_members}</td>
                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">{sec.total_present?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">{sec.total_absent?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-semibold">{sec.attendance_rate}%</td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={Number(sec.attendance_rate) >= 75 ? 'success' : Number(sec.attendance_rate) >= 50 ? 'warning' : 'danger'}>
                      {Number(sec.attendance_rate) >= 75 ? 'Strong' : Number(sec.attendance_rate) >= 50 ? 'Average' : 'Needs Attention'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {sectionComparison.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">No section data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── YEAR-OVER-YEAR + SERVICE TYPE ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ChartCard
          title="Year-over-Year Comparison"
          subtitle="Monthly attendance rate: current vs previous year"
          height="h-[320px]"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearOverYear} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="current_rate" name="Current Year" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="previous_rate" name="Previous Year" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#94a3b8', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Service Type Breakdown"
          subtitle="Attendance by service type"
          height="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={serviceTypePie} cx="50%" cy="45%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value">
                {serviceTypePie.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Service Type Detail */}
      {serviceTypeBreakdown.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {serviceTypeBreakdown.map((st, i) => (
            <div key={st.id} className="rounded-xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{st.service_type_name}</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{st.attendance_rate}%</p>
              <p className="text-xs text-slate-500">{st.total_present?.toLocaleString()} present / {st.total_records?.toLocaleString()} total</p>
            </div>
          ))}
        </div>
      )}

      {/* ── MONTHLY TRENDS (Composed Chart) ────────────────────────────────── */}
      {monthlyTrends.attendance.length > 0 && (
        <ChartCard
          title="Monthly Attendance & Contribution Trends"
          subtitle="Tracking attendance rate alongside contribution volume"
          height="h-[380px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyTrends.attendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area yAxisId="left" type="monotone" dataKey="attendance_rate" name="Attendance Rate (%)" fill="#6366f1" fillOpacity={0.1} stroke="#6366f1" strokeWidth={2} />
              <Bar yAxisId="right" dataKey="total_present" name="Members Present" fill="#10b981" radius={[3, 3, 0, 0]} barSize={20} opacity={0.7} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── SECTION TRENDS ─────────────────────────────────────────────────── */}
      {monthlyTrends.sections.length > 0 && (
        <ChartCard
          title="Section Attendance Trends"
          subtitle="Monthly attendance rate by section over time"
          height="h-[380px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrends.sections.reduce((acc, item) => {
              const existing = acc.find(a => a.month === item.month);
              if (existing) { existing[item.section_name] = item.attendance_rate; }
              else {
                const row = { month: item.month, [item.section_name]: item.attendance_rate };
                acc.push(row);
              }
              return acc;
            }, [])} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {[...new Set(monthlyTrends.sections.map(s => s.section_name))].map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} name={name} stroke={SECTION_COLORS[i % SECTION_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── ATTENDANCE PATTERNS + DEMOGRAPHICS ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Attendance by Day of Week"
          subtitle="Average attendance rate pattern across the week"
          height="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayPatterns} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="day_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_rate" name="Avg Rate (%)" radius={[6, 6, 0, 0]}>
                {dayPatterns.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {demographics && (demographics.gender.length > 0 || demographics.age_group.length > 0) && (
          <ChartCard
            title="Demographics"
            subtitle="Attendance by gender and age group"
            height="h-[300px]"
          >
            <div className="grid grid-cols-2 h-full gap-2">
              <div className="h-full flex flex-col justify-center relative">
                <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Gender</h4>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie data={demographics.gender} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={5} dataKey="total_records" nameKey="category_value">
                      {demographics.gender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="h-full flex flex-col justify-center relative">
                <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Age Group</h4>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={demographics.age_group} margin={{ left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="category_value" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_records" name="Count" radius={[4, 4, 0, 0]}>
                      {demographics.age_group.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      {/* ── EVANGELISM + NEW MEMBER FUNNELS ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {evangelismFunnel && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              Evangelism Conversion Funnel
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Total Outreach', value: evangelismFunnel.total_outreach, color: '#6366f1' },
                { label: 'Souls Won', value: evangelismFunnel.souls_won, color: '#8b5cf6' },
                { label: 'Members Joined', value: evangelismFunnel.members_joined, color: '#10b981' },
                { label: 'Baptized', value: evangelismFunnel.baptized, color: '#06b6d4' },
              ].map((step, i, arr) => {
                const maxVal = arr[0].value || 1;
                const pct = Math.round((step.value / maxVal) * 100);
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
                      <span className="text-sm font-bold" style={{ color: step.color }}>{step.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                    </div>
                    {i < arr.length - 1 && (
                      <div className="text-right text-xs text-slate-400 mt-0.5">
                        {arr[i + 1].value > 0 && `${((arr[i + 1].value / step.value) * 100).toFixed(0)}% conversion`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {newMemberFunnel.length > 0 && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />
              New Member Journey
            </h3>
            <div className="space-y-3">
              {newMemberFunnel.map((step, i, arr) => {
                const maxVal = arr[0]?.count || 1;
                const pct = Math.round((step.count / maxVal) * 100);
                const colors = { probation: '#f59e0b', graduated: '#10b981', permanent: '#6366f1' };
                return (
                  <div key={step.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{step.status}</span>
                      <span className="text-sm font-bold" style={{ color: colors[step.status] || '#64748b' }}>{step.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[step.status] || '#64748b' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ANOMALIES + PREDICTIONS ────────────────────────────────────────── */}
      {prediction && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={TrendingUp} label="Predicted Attendance" value={prediction.avg_present || 0} color="indigo" sub={`Based on ${prediction.weeks_analyzed || 0} weeks`} />
          <Stat icon={Target} label="Forecast Rate" value={`${prediction.avg_rate || 0}%`} color="emerald" sub={`Trend: ${prediction.trend || 'stable'}`} />
          <Stat icon={Calendar} label="Streak Champions" value={streaks.length} color="amber" sub="Members 4+ weeks" />
          <Stat icon={Church} label="Last Submission" value={anomalyData.length} color="cyan" sub="Sections with drops" />
        </div>
      )}

      {anomalyData.length > 0 && (
        <ChartCard
          title="Attendance Anomalies"
          subtitle="Sections with significant drops vs historical average"
          height="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={anomalyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="historical" name="Historical Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name="Current Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── STREAKS + LEADERS + ENGAGEMENT ─────────────────────────────────── */}
      {streaks.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Attendance Streak Champions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {streaks.slice(0, 10).map((s) => (
              <div key={s.member_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.full_name}</p>
                <Badge variant="success" className="mt-1">{s.current_streak} weeks</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {leaderPerformance.length > 0 && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Leader Performance Rankings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-500">#</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-500">Leader</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-500">Rate</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-500">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderPerformance.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3">
                        <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${
                          i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          i === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                          i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                          'text-slate-400 dark:text-slate-500'
                        }`}>{i + 1}</span>
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-white">{l.leader_name}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={l.avg_rate >= 80 ? 'success' : l.avg_rate >= 60 ? 'warning' : 'danger'}>{l.avg_rate}%</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {l.trend_direction === 'improving' && <ArrowUp className="w-4 h-4 text-emerald-500 inline" />}
                        {l.trend_direction === 'declining' && <ArrowDown className="w-4 h-4 text-rose-500 inline" />}
                        {l.trend_direction === 'stable' && <Minus className="w-4 h-4 text-slate-400 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {engagementScores.length > 0 && (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Top Engaged Members
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-500">Member</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-500">Section</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-500">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementScores.map((m, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-white">{m.full_name}</td>
                      <td className="py-2 px-3 text-sm text-slate-500">{m.section_name}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={m.engagement_score >= 80 ? 'success' : m.engagement_score >= 60 ? 'warning' : 'danger'}>{m.engagement_score}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;
