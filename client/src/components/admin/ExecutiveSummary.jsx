import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Building2,
  Heart,
  Brain,
  CheckCircle2,
  Info,
  Activity,
  Zap,
  RefreshCw,
  AlertCircle,
  Minus
} from 'lucide-react';
import {
  BarChart as ReBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePie,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { analyticsAPI } from '../../services/api';

const R = (v) => Math.round(Number(v) || 0);
// Apple system palette + brand teal: categorical series that stay legible in both appearances.
const C = [
  '#14a896',
  '#007aff',
  '#ff9500',
  '#ff3b30',
  '#5856d6',
  '#30b0c7',
  '#ff2d55',
  '#34c759',
  '#a2845e',
  '#8e8e93'
];
const asArray = (v) => (Array.isArray(v) ? v : []);
const STATUS_COLORS = {
  success: '#34c759',
  warning: '#ff9500',
  danger: '#ff3b30',
  neutral: '#8e8e93'
};
const STATUS_BG = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  danger: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  neutral: 'bg-system-fill border-black/[0.06] dark:border-white/[0.08]'
};

const fmt = (v, suffix = '') => {
  const n = Number(v) || 0;
  if (suffix === '%') return n.toFixed(1) + '%';
  if (suffix === '/100') return n.toFixed(0) + '/100';
  return n >= 1000 ? n.toLocaleString() + suffix : n + suffix;
};

const StatusIcon = ({ status }) => {
  if (status === 'success') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (status === 'danger') return <TrendingDown className="w-4 h-4 text-rose-500" />;
  return <Minus className="w-4 h-4 text-tertiary-label" />;
};

const KpiCard = ({ kpi }) => {
  const bg = STATUS_BG[kpi.status] || STATUS_BG.neutral;
  const color = STATUS_COLORS[kpi.status] || STATUS_COLORS.neutral;
  return (
    <div className={`rounded-xl border p-4 ${bg} transition-all hover:shadow-card`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
          {kpi.label}
        </span>
        <StatusIcon status={kpi.status} />
      </div>
      <p className="text-2xl font-extrabold text-label" style={{ color }}>
        {fmt(
          kpi.current,
          kpi.label.includes('Rate') ||
            kpi.label.includes('Score') ||
            kpi.label.includes('Health') ||
            kpi.label.includes('Conversion') ||
            kpi.label.includes('Completion') ||
            kpi.label.includes('Performance') ||
            kpi.label.includes('Momentum') ||
            kpi.label.includes('Growth') ||
            kpi.label.includes('Goal')
            ? '%'
            : ''
        )}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5 text-caption-2">
        {kpi.diff !== 0 && (
          <span className={`font-semibold ${kpi.diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpi.diff > 0 ? '+' : ''}
            {fmt(kpi.diff, '%')}
          </span>
        )}
        {kpi.pctChange !== 0 && (
          <span className="text-tertiary-label">
            ({kpi.pctChange > 0 ? '+' : ''}
            {kpi.pctChange}%)
          </span>
        )}
        <span className="text-tertiary-label ml-auto">Prev: {fmt(kpi.previous, '%')}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-caption-2 text-tertiary-label">
        {kpi.target > 0 && <span>Target: {fmt(kpi.target, '%')}</span>}
        {kpi.best > 0 && kpi.best !== kpi.target && <span>Best: {fmt(kpi.best, '%')}</span>}
      </div>
      {kpi.priority !== 'low' && (
        <div
          className={`mt-1.5 text-caption-2 font-semibold uppercase tracking-[0.06em] ${kpi.priority === 'high' ? 'text-rose-500' : 'text-amber-500'}`}
        >
          {kpi.priority === 'high' ? 'Requires Immediate Attention' : 'Needs Review'}
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, variant = 'default' }) => {
  const v =
    {
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      default: 'bg-system-fill text-secondary-label dark:bg-white/[0.06] dark:text-tertiary-label'
    }[variant] || 'bg-system-fill text-secondary-label';
  return (
    <span className={`px-2 py-0.5 rounded-full text-caption-2 font-semibold ${v}`}>{children}</span>
  );
};

const AlertCard = ({ alert }) => {
  const icons = { danger: AlertCircle, warning: AlertTriangle, success: CheckCircle2 };
  const Icon = icons[alert.type] || Info;
  const colors = {
    danger: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${STATUS_BG[alert.type === 'danger' ? 'danger' : alert.type === 'warning' ? 'warning' : 'success']}`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors[alert.type] || colors.warning}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-caption-1 font-semibold text-label">{alert.title}</p>
          <Badge
            variant={
              alert.priority === 'high'
                ? 'danger'
                : alert.priority === 'medium'
                  ? 'warning'
                  : 'default'
            }
          >
            {alert.priority}
          </Badge>
        </div>
        <p className="text-caption-1 text-secondary-label">{alert.message}</p>
      </div>
    </div>
  );
};

const ExecutiveSummary = ({ days = 90, variant = 'analytics' }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [periodDays, setPeriodDays] = useState(days);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getExecutiveSummary(periodDays);
      setData(res.data);
    } catch (e) {
      console.error('Executive summary fetch error:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchData();
  }, [periodDays, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 p-10 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="text-footnote font-medium text-amber-700 dark:text-amber-300">
          No executive data available
        </p>
        <p className="text-caption-1 text-amber-500 mt-1">
          Attendance records will appear here once submitted
        </p>
      </div>
    );
  }

  const {
    kpis,
    alerts,
    snapshot,
    sectionRankings,
    leaderRankings,
    healthBreakdown,
    actions,
    momentumData,
    recommendations
  } = data || {};
  const highPriorityAlerts = asArray(alerts).filter((a) => a.priority === 'high');

  const churchScore = kpis?.churchHealthScore;
  const scoreColor =
    churchScore?.current >= 75 ? '#10b981' : churchScore?.current >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* â”€â”€ Period Selector â”€â”€ */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <select
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
          className="bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] rounded-xl px-3 py-2 text-caption-1 text-secondary-label focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last year</option>
        </select>
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] text-secondary-label hover:text-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {/* â”€â”€ Church Health Score Card (clean, non-purple) â”€â”€ */}
      {churchScore && (
        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-secondary-system-grouped-background p-5 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${scoreColor}15` }}
              >
                <Heart className="w-6 h-6" style={{ color: scoreColor }} />
              </div>
              <div>
                <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                  Church Health Score
                </span>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-label">
                    {R(churchScore.current)}
                    <span className="text-base font-normal text-tertiary-label">/100</span>
                  </p>
                  <span
                    className={`text-caption-1 font-semibold ${churchScore.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {churchScore.diff >= 0 ? '+' : ''}
                    {R(churchScore.diff)}% vs prev
                  </span>
                </div>
                {churchScore.target > 0 && (
                  <p className="text-caption-2 text-tertiary-label mt-0.5">
                    Target: {R(churchScore.target)}/100
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              <div className="text-center">
                <p className="text-title-2 font-semibold text-label">
                  {R(snapshot?.church?.totalMembers || 0)}
                </p>
                <p className="text-caption-2 text-tertiary-label uppercase tracking-[0.06em]">
                  Members
                </p>
              </div>
              <div className="text-center">
                <p className="text-title-2 font-semibold text-label">
                  {R(snapshot?.church?.activeSections || 0)}
                </p>
                <p className="text-caption-2 text-tertiary-label uppercase tracking-[0.06em]">
                  Sections
                </p>
              </div>
              <div className="text-center">
                <p className="text-title-2 font-semibold text-label">
                  {R(snapshot?.church?.activeLeaders || 0)}
                </p>
                <p className="text-caption-2 text-tertiary-label uppercase tracking-[0.06em]">
                  Leaders
                </p>
              </div>
              <div className="text-center">
                <p className="text-title-2 font-semibold text-label">
                  {R(snapshot?.attendance?.attendanceRate || 0)}%
                </p>
                <p className="text-caption-2 text-tertiary-label uppercase tracking-[0.06em]">
                  Attendance
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* â”€â”€ Reports Variant: Graph-heavy overview â”€â”€ */}
      {variant === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Attendance Momentum */}
            {momentumData && asArray(momentumData).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-600" />
                  Attendance Trend
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={asArray(momentumData)}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="rptMomentum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14a896" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14a896" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#14a896"
                      fill="url(#rptMomentum)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14a896' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Section Attendance Bar Chart */}
            {sectionRankings && asArray(sectionRankings).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary-600" />
                  Section Attendance Rates
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ReBar
                    data={asArray(sectionRankings).slice(0, 8)}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                    <Bar dataKey="attendanceRate" radius={[0, 4, 4, 0]}>
                      {asArray(sectionRankings)
                        .slice(0, 8)
                        .map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.attendanceRate >= 75
                                ? '#10b981'
                                : entry.attendanceRate >= 50
                                  ? '#f59e0b'
                                  : '#ef4444'
                            }
                          />
                        ))}
                    </Bar>
                  </ReBar>
                </ResponsiveContainer>
              </div>
            )}

            {/* Leader Performance Bar Chart */}
            {leaderRankings && asArray(leaderRankings).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-600" />
                  Top Leaders by Rate
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ReBar
                    data={asArray(leaderRankings).slice(0, 8)}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                    <Bar dataKey="attendanceRate" radius={[0, 4, 4, 0]}>
                      {asArray(leaderRankings)
                        .slice(0, 8)
                        .map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.attendanceRate >= 75
                                ? '#10b981'
                                : entry.attendanceRate >= 50
                                  ? '#f59e0b'
                                  : '#ef4444'
                            }
                          />
                        ))}
                    </Bar>
                  </ReBar>
                </ResponsiveContainer>
              </div>
            )}

            {/* Member Health Pie Chart */}
            {healthBreakdown && asArray(healthBreakdown).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary-600" />
                  Member Health Distribution
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RePie>
                    <Pie
                      data={asArray(healthBreakdown)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {asArray(healthBreakdown).map((entry, i) => {
                        const pieColors = {
                          Healthy: '#10b981',
                          Moderate: '#f59e0b',
                          'At Risk': '#f97316',
                          Critical: '#ef4444'
                        };
                        return <Cell key={i} fill={pieColors[entry.label] || C[i % C.length]} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </RePie>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Compact Alerts */}
          {highPriorityAlerts.length > 0 && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-caption-1 font-semibold text-rose-700 dark:text-rose-300">
                  {highPriorityAlerts.length} critical alert
                  {highPriorityAlerts.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                {highPriorityAlerts.slice(0, 3).map((a, i) => (
                  <p
                    key={i}
                    className="text-caption-1 text-rose-600 dark:text-rose-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    {a.title}: {a.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* â”€â”€ Analytics Overview (single page, no sub-tabs) â”€â”€ */}
      {variant === 'analytics' && (
        <>
          {/* â”€â”€ Overview Dashboard â”€â”€ */}
          <div className="space-y-4">
            {/* High-priority alerts banner */}
            {highPriorityAlerts.length > 0 && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <h3 className="text-caption-1 font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-[0.06em]">
                    Critical Alerts — {highPriorityAlerts.length} require immediate action
                  </h3>
                </div>
                <div className="grid gap-2">
                  {highPriorityAlerts.slice(0, 3).map((a, i) => (
                    <AlertCard key={i} alert={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {[
                'churchHealthScore',
                'attendanceRate',
                'overallPerfScore',
                'retentionRate',
                'engagementScore'
              ]
                .filter((k) => kpis[k])
                .map((k) => (
                  <KpiCard key={k} kpi={kpis[k]} />
                ))}
            </div>

            {/* Growth & Movement cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                'weeklyGrowth',
                'monthlyGrowth',
                'newMembers',
                'returningMembers',
                'visitorConversion'
              ]
                .filter((k) => kpis[k])
                .map((k) => (
                  <KpiCard key={k} kpi={kpis[k]} />
                ))}
            </div>

            {/* Attendance Momentum */}
            {momentumData && asArray(momentumData).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-600" />
                  Attendance Momentum
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart
                    data={asArray(momentumData)}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14a896" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14a896" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#14a896"
                      fill="url(#momentumGrad)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14a896' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top sections & leaders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {asArray(sectionRankings).length > 0 && (
                <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                  <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-primary-600" />
                    Top Sections
                  </h3>
                  <div className="space-y-2">
                    {asArray(sectionRankings)
                      .slice(0, 5)
                      .map((s, i) => (
                        <div key={s.id || i} className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-lg text-caption-2 font-semibold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-system-fill text-secondary-label dark:bg-white/[0.06]'}`}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-caption-1 font-medium text-label truncate">
                              {s.name}
                            </p>
                            <div className="flex items-center gap-2 text-caption-2 text-tertiary-label">
                              <span>{s.present} present</span>
                              <span>{s.members} members</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-footnote font-semibold"
                              style={{
                                color:
                                  s.attendanceRate >= 75
                                    ? '#10b981'
                                    : s.attendanceRate >= 50
                                      ? '#f59e0b'
                                      : '#ef4444'
                              }}
                            >
                              {s.attendanceRate}%
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {asArray(leaderRankings).length > 0 && (
                <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                  <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-primary-600" />
                    Top Leaders
                  </h3>
                  <div className="space-y-2">
                    {asArray(leaderRankings)
                      .slice(0, 5)
                      .map((l, i) => (
                        <div key={l.id || i} className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-lg text-caption-2 font-semibold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-system-fill text-secondary-label dark:bg-white/[0.06]'}`}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-caption-1 font-medium text-label truncate">
                              {l.name}
                            </p>
                            <p className="text-caption-2 text-tertiary-label">
                              {l.section} · {l.members} members
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-footnote font-semibold"
                              style={{
                                color:
                                  l.attendanceRate >= 75
                                    ? '#10b981'
                                    : l.attendanceRate >= 50
                                      ? '#f59e0b'
                                      : '#ef4444'
                              }}
                            >
                              {l.attendanceRate}%
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Immediate actions */}
            {asArray(actions).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Immediate Action List
                </h3>
                <div className="grid gap-2">
                  {asArray(actions)
                    .slice(0, 5)
                    .map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-system-fill/30 border border-separator/60 dark:border-white/[0.08]"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}
                        >
                          {a.priority === 'high' ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-caption-1 font-medium text-label">{a.action}</p>
                          <p className="text-caption-2 text-tertiary-label capitalize">
                            {a.category} · {a.impact} impact
                          </p>
                        </div>
                        <Badge variant={a.priority === 'high' ? 'danger' : 'warning'}>
                          {a.priority}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {asArray(recommendations).length > 0 && (
              <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card p-4">
                <h3 className="text-caption-1 font-semibold text-label mb-3 flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-500" />
                  AI Recommendations
                </h3>
                <div className="space-y-2">
                  {asArray(recommendations)
                    .slice(0, 5)
                    .map((r, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-2.5 rounded-xl bg-system-fill/30 border border-separator/60 dark:border-white/[0.08]"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${r.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}
                        >
                          <Brain className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-caption-1 font-semibold text-label">
                              {r.recommendation}
                            </p>
                            <Badge variant={r.priority === 'high' ? 'danger' : 'warning'}>
                              {r.priority}
                            </Badge>
                          </div>
                          <p className="text-caption-2 text-tertiary-label">
                            Expected: {r.expectedImpact}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}{' '}
      {/* end variant === 'analytics' */}
    </div>
  );
};

export default ExecutiveSummary;
