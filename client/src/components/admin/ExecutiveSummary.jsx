import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, Users, Building2,
  Heart, Brain, UserCheck, Award, ArrowUp, ArrowDown, Minus,
  CheckCircle2, XCircle, Info, Star, UserX, Clock, Target,
  Activity, Shield, Zap, Eye, Download, RefreshCw, AlertCircle,
  Thermometer, Flag, BarChart, PieChart, LineChart, ChevronRight
} from 'lucide-react';
import {
  BarChart as ReBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePie, Pie, Cell, LineChart as ReLine, Line, Area, AreaChart,
  Legend
} from 'recharts';
import { analyticsAPI } from '../../services/api';

const R = v => Math.round(Number(v) || 0);
const C = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#84cc16'];
const STATUS_COLORS = { success: '#10b981', warning: '#f59e0b', danger: '#ef4444', neutral: '#94a3b8' };
const STATUS_BG = { success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', danger: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800', neutral: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
const PRIORITY_BADGE = { high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };

const fmt = (v, suffix = '') => {
  const n = Number(v) || 0;
  if (suffix === '%') return n.toFixed(1) + '%';
  if (suffix === '/100') return n.toFixed(0) + '/100';
  return n >= 1000 ? n.toLocaleString() + suffix : n + suffix;
};

const StatusIcon = ({ status }) => {
  if (status === 'success') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (status === 'danger') return <TrendingDown className="w-4 h-4 text-rose-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
};

const KpiCard = ({ kpi }) => {
  const bg = STATUS_BG[kpi.status] || STATUS_BG.neutral;
  const color = STATUS_COLORS[kpi.status] || STATUS_COLORS.neutral;
  return (
    <div className={`rounded-xl border p-4 ${bg} transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{kpi.label}</span>
        <StatusIcon status={kpi.status} />
      </div>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white" style={{ color }}>{fmt(kpi.current, kpi.label.includes('Rate') || kpi.label.includes('Score') || kpi.label.includes('Health') || kpi.label.includes('Conversion') || kpi.label.includes('Completion') || kpi.label.includes('Performance') || kpi.label.includes('Momentum') || kpi.label.includes('Growth') || kpi.label.includes('Goal') ? '%' : '')}</p>
      <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
        {kpi.diff !== 0 && (
          <span className={`font-semibold ${kpi.diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpi.diff > 0 ? '+' : ''}{fmt(kpi.diff, '%')}
          </span>
        )}
        {kpi.pctChange !== 0 && (
          <span className="text-slate-400">({kpi.pctChange > 0 ? '+' : ''}{kpi.pctChange}%)</span>
        )}
        <span className="text-slate-400 ml-auto">Prev: {fmt(kpi.previous, '%')}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
        {kpi.target > 0 && <span>Target: {fmt(kpi.target, '%')}</span>}
        {kpi.best > 0 && kpi.best !== kpi.target && <span>Best: {fmt(kpi.best, '%')}</span>}
      </div>
      {kpi.priority !== 'low' && (
        <div className={`mt-1.5 text-[8px] font-bold uppercase tracking-wider ${kpi.priority === 'high' ? 'text-rose-500' : 'text-amber-500'}`}>
          {kpi.priority === 'high' ? 'Requires Immediate Attention' : 'Needs Review'}
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, variant = 'default' }) => {
  const v = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    default: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }[variant] || 'bg-slate-100 text-slate-600';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${v}`}>{children}</span>;
};

const AlertCard = ({ alert, index }) => {
  const icons = { danger: AlertCircle, warning: AlertTriangle, success: CheckCircle2 };
  const Icon = icons[alert.type] || Info;
  const colors = { danger: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30', warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' };
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${STATUS_BG[alert.type === 'danger' ? 'danger' : alert.type === 'warning' ? 'warning' : 'success']}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors[alert.type] || colors.warning}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-bold text-slate-900 dark:text-white">{alert.title}</p>
          <Badge variant={alert.priority === 'high' ? 'danger' : alert.priority === 'medium' ? 'warning' : 'default'}>{alert.priority}</Badge>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">{alert.message}</p>
      </div>
    </div>
  );
};

const ExecutiveSummary = ({ days = 90 }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [periodDays, setPeriodDays] = useState(days);

  useEffect(() => { fetchData(); }, [periodDays]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getExecutiveSummary(periodDays);
      setData(res.data);
    } catch (e) {
      console.error('Executive summary fetch error:', e);
      setData(null);
    } finally { setLoading(false); }
  };

  const sections = useMemo(() => [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'kpis', label: 'KPIs', icon: Activity },
    { key: 'alerts', label: 'Alerts', icon: AlertTriangle, count: data?.alerts?.length },
    { key: 'snapshot', label: 'Snapshot', icon: Eye },
    { key: 'sections', label: 'Sections', icon: Building2 },
    { key: 'leaders', label: 'Leaders', icon: Users },
    { key: 'health', label: 'Health', icon: Heart },
    { key: 'benchmarks', label: 'Benchmarks', icon: Target },
    { key: 'actions', label: 'Actions', icon: Zap },
    { key: 'recommendations', label: 'Recommendations', icon: Brain },
  ], [data]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 p-10 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">No executive data available</p>
        <p className="text-xs text-amber-500 mt-1">Attendance records will appear here once submitted</p>
      </div>
    );
  }

  const { kpis, alerts, snapshot, sectionRankings, leaderRankings, healthBreakdown, actions, momentumData, benchmarkComparison, recommendations } = data;
  const kpiList = Object.values(kpis).filter(Boolean);
  const highPriorityAlerts = (alerts || []).filter(a => a.priority === 'high');
  const mediumPriorityAlerts = (alerts || []).filter(a => a.priority === 'medium');

  const churchScore = kpis?.churchHealthScore;
  const scoreColor = churchScore?.current >= 75 ? '#10b981' : churchScore?.current >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Period Selector ── */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last year</option>
        </select>
        <button onClick={fetchData} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* ── Church Health Score Hero ── */}
      {churchScore && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-36 translate-x-36" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-5 h-5 text-pink-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Church Health Score</span>
              </div>
              <p className="text-4xl font-black">{R(churchScore.current)}<span className="text-lg font-normal text-white/60">/100</span></p>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/70">
                <span className="flex items-center gap-1">{churchScore.diff > 0 ? <ArrowUp className="w-3 h-3 text-emerald-300" /> : <ArrowDown className="w-3 h-3 text-rose-300" />} {churchScore.diff > 0 ? '+' : ''}{R(churchScore.diff)}% vs previous</span>
                {churchScore.target > 0 && <span>Target: {R(churchScore.target)}/100</span>}
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center"><p className="text-2xl font-bold">{R(snapshot?.church?.totalMembers || 0)}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">Members</p></div>
              <div className="text-center"><p className="text-2xl font-bold">{R(snapshot?.church?.activeSections || 0)}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">Sections</p></div>
              <div className="text-center"><p className="text-2xl font-bold">{R(snapshot?.church?.activeLeaders || 0)}</p><p className="text-[10px] text-white/60 uppercase tracking-wider">Leaders</p></div>
              <div className="text-center"><p className="text-2xl font-bold">{R(snapshot?.attendance?.attendanceRate || 0)}%</p><p className="text-[10px] text-white/60 uppercase tracking-wider">Attendance Rate</p></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <s.icon className="w-3.5 h-3.5" />{s.label}
            {s.count > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{s.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Overview Dashboard ── */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* High-priority alerts banner */}
          {highPriorityAlerts.length > 0 && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Critical Alerts — {highPriorityAlerts.length} require immediate action</h3>
              </div>
              <div className="grid gap-2">
                {highPriorityAlerts.slice(0, 3).map((a, i) => <AlertCard key={i} alert={a} index={i} />)}
              </div>
            </div>
          )}

          {/* Top KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {['churchHealthScore', 'attendanceRate', 'overallPerfScore', 'retentionRate', 'engagementScore'].filter(k => kpis[k]).map(k => (
              <KpiCard key={k} kpi={kpis[k]} />
            ))}
          </div>

          {/* Growth & Movement cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {['weeklyGrowth', 'monthlyGrowth', 'newMembers', 'returningMembers', 'visitorConversion'].filter(k => kpis[k]).map(k => (
              <KpiCard key={k} kpi={kpis[k]} />
            ))}
          </div>

          {/* Attendance Momentum */}
          {momentumData && momentumData.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />Attendance Momentum
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={momentumData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip formatter={v => [`${v}%`, 'Rate']} />
                  <Area type="monotone" dataKey="rate" stroke="#6366f1" fill="url(#momentumGrad)" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top sections & leaders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sectionRankings?.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />Top Sections
                </h3>
                <div className="space-y-2">
                  {sectionRankings.slice(0, 5).map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{s.present} present</span>
                          <span>{s.members} members</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: s.attendanceRate >= 75 ? '#10b981' : s.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}>{s.attendanceRate}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {leaderRankings?.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />Top Leaders
                </h3>
                <div className="space-y-2">
                  {leaderRankings.slice(0, 5).map((l, i) => (
                    <div key={l.id || i} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{l.name}</p>
                        <p className="text-[10px] text-slate-400">{l.section} · {l.members} members</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: l.attendanceRate >= 75 ? '#10b981' : l.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}>{l.attendanceRate}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Immediate actions */}
          {actions?.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />Immediate Action List
              </h3>
              <div className="grid gap-2">
                {actions.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                      {a.priority === 'high' ? <AlertCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-900 dark:text-white">{a.action}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{a.category} · {a.impact} impact</p>
                    </div>
                    <Badge variant={a.priority === 'high' ? 'danger' : 'warning'}>{a.priority}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── All KPIs ── */}
      {activeSection === 'kpis' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpiList.map((k, i) => <KpiCard key={i} kpi={k} />)}
          </div>
        </div>
      )}

      {/* ── Alerts ── */}
      {activeSection === 'alerts' && (
        <div className="space-y-4">
          {(!alerts || alerts.length === 0) && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700 p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All clear — no alerts at this time</p>
              <p className="text-xs text-emerald-500 mt-1">All key metrics are within acceptable ranges</p>
            </div>
          )}
          {highPriorityAlerts.map((a, i) => <AlertCard key={i} alert={a} index={i} />)}
          {mediumPriorityAlerts.map((a, i) => <AlertCard key={i} alert={a} index={i} />)}
          {(alerts || []).filter(a => a.priority === 'low').map((a, i) => <AlertCard key={i} alert={a} index={i} />)}
        </div>
      )}

      {/* ── Snapshot ── */}
      {activeSection === 'snapshot' && snapshot && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Church</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Total Members</span><span className="font-bold text-slate-900 dark:text-white">{(snapshot.church?.totalMembers || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Active Sections</span><span className="font-bold text-slate-900">{snapshot.church?.activeSections || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Active Leaders</span><span className="font-bold text-slate-900">{snapshot.church?.activeLeaders || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Net Growth</span><span className={`font-bold ${(snapshot.church?.netGrowth || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(snapshot.church?.netGrowth || 0) >= 0 ? '+' : ''}{snapshot.church?.netGrowth || 0}</span></div>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1"><Activity className="w-3 h-3" /> Attendance</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Present</span><span className="font-bold text-emerald-600">{(snapshot.attendance?.present || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Absent</span><span className="font-bold text-rose-600">{(snapshot.attendance?.absent || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Excused</span><span className="font-bold text-amber-600">{(snapshot.attendance?.excused || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Eligible</span><span className="font-bold text-slate-900">{(snapshot.attendance?.totalEligible || 0).toLocaleString()}</span></div>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Services</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Service Days</span><span className="font-bold text-slate-900">{snapshot.attendance?.serviceDays || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Records</span><span className="font-bold text-slate-900">{(snapshot.attendance?.totalRecords || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Avg per Service</span><span className="font-bold text-slate-900">{snapshot.attendance?.avgPerService || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Attendance Rate</span><span className="font-bold text-indigo-600">{snapshot.attendance?.attendanceRate || 0}%</span></div>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Movement</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">New Members</span><span className="font-bold text-emerald-600">+{snapshot.church?.newMembers || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Returning</span><span className="font-bold text-slate-900">{snapshot.church?.visitorsConverted || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lost</span><span className="font-bold text-rose-600">-{snapshot.church?.membersLost || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Visitors</span><span className="font-bold text-slate-900">{snapshot.church?.visitors || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section Rankings ── */}
      {activeSection === 'sections' && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-500" />Section Performance Rankings</h3>
          </div>
          {(!sectionRankings || sectionRankings.length === 0) ? (
            <div className="p-10 text-center text-slate-400 text-xs">No section data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['#', 'Section', 'Members', 'Present', 'Absent', 'Rate', 'New', 'Status'].map(h => (
                      <th key={h} className={`py-2.5 px-3 text-[10px] font-bold uppercase text-slate-400 ${['#', 'Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionRankings.map((s, i) => (
                    <tr key={s.id || i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3"><span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span></td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{s.members}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">{s.present.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-rose-500">{s.absent.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold" style={{ color: s.attendanceRate >= 75 ? '#10b981' : s.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}>{s.attendanceRate}%</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600">+{s.newMembers || 0}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant={s.status === 'strong' ? 'success' : s.status === 'average' ? 'warning' : 'danger'}>{s.status === 'strong' ? 'Strong' : s.status === 'average' ? 'Average' : 'Weak'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Leader Rankings ── */}
      {activeSection === 'leaders' && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" />Leader Performance Rankings</h3>
          </div>
          {(!leaderRankings || leaderRankings.length === 0) ? (
            <div className="p-10 text-center text-slate-400 text-xs">No leader data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['#', 'Leader', 'Section', 'Members', 'Present', 'Rate', 'Submissions', 'Sub. Rate', 'Follow-ups'].map(h => (
                      <th key={h} className={`py-2.5 px-3 text-[10px] font-bold uppercase text-slate-400 ${['#', 'Leader', 'Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderRankings.map((l, i) => (
                    <tr key={l.id || i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3"><span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{i + 1}</span></td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{l.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{l.section}</td>
                      <td className="py-2.5 px-3 text-right">{l.members}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600">{l.present}</td>
                      <td className="py-2.5 px-3 text-right font-bold" style={{ color: l.attendanceRate >= 75 ? '#10b981' : l.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}>{l.attendanceRate}%</td>
                      <td className="py-2.5 px-3 text-right">{l.submissions}</td>
                      <td className="py-2.5 px-3 text-right">{l.submissionRate}%</td>
                      <td className="py-2.5 px-3 text-right">{l.followUps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Member Health Breakdown ── */}
      {activeSection === 'health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-indigo-500" />Member Health Distribution</h3>
              {healthBreakdown && healthBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {healthBreakdown.map(h => {
                    const colors = { Healthy: { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' }, Moderate: { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' }, 'At Risk': { bar: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' }, Critical: { bar: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/10' } };
                    const c = colors[h.label] || colors.Moderate;
                    return (
                      <div key={h.key} className={`rounded-xl p-3 ${c.bg}`}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className={`font-bold ${c.text}`}>{h.label}</span>
                          <span className="text-slate-600 dark:text-slate-400">{h.count} members ({h.pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${h.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs py-8">No member health data available</div>
              )}
            </div>
            {/* KPIs related to health */}
            <div className="grid grid-cols-2 gap-3">
              {['memberHealth', 'ministryHealth', 'engagementScore', 'retentionRate'].filter(k => kpis[k]).map(k => (
                <KpiCard key={k} kpi={kpis[k]} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Benchmarks ── */}
      {activeSection === 'benchmarks' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" />Benchmark Comparison</h3>
            </div>
            {(!benchmarkComparison || benchmarkComparison.length === 0) ? (
              <div className="p-10 text-center text-slate-400 text-xs">No benchmark data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Metric', 'Current', 'Average', 'Best', 'Target', 'Status'].map(h => (
                        <th key={h} className={`py-2.5 px-3 text-[10px] font-bold uppercase text-slate-400 ${h === 'Metric' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkComparison.map((b, i) => {
                      const pctOfTarget = b.target > 0 ? Math.round((b.current / b.target) * 100) : 0;
                      const status = pctOfTarget >= 100 ? 'success' : pctOfTarget >= 75 ? 'warning' : 'danger';
                      return (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{b.metric}</td>
                          <td className="py-2.5 px-3 text-right font-bold">{fmt(b.current, b.unit)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{fmt(b.average, b.unit)}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-600">{fmt(b.best, b.unit)}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-600">{fmt(b.target, b.unit)}</td>
                          <td className="py-2.5 px-3 text-right"><Badge variant={status}>{pctOfTarget >= 100 ? 'Met' : pctOfTarget >= 75 ? 'Near' : 'Below'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Momentum chart in benchmarks */}
          {momentumData && momentumData.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />Attendance Rate by Period
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <ReBar data={momentumData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={v => [`${v}%`, 'Rate']} />
                  <ReBar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {momentumData.map((entry, i) => <Cell key={i} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
                  </ReBar>
                </ReBar>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      {activeSection === 'actions' && (
        <div className="space-y-3">
          {(!actions || actions.length === 0) ? (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700 p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">No actions required</p>
              <p className="text-xs text-emerald-500 mt-1">All metrics are within acceptable ranges</p>
            </div>
          ) : (
            actions.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${a.priority === 'high' ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                  {a.priority === 'high' ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{a.action}</p>
                    <Badge variant={a.priority === 'high' ? 'danger' : 'warning'}>{a.impact === 'critical' ? 'Critical Impact' : 'Significant Impact'}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 capitalize">Category: {a.category}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {activeSection === 'recommendations' && (
        <div className="space-y-3">
          {(!recommendations || recommendations.length === 0) ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-10 text-center">
              <Brain className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No recommendations available</p>
              <p className="text-xs text-slate-400 mt-1">Recommendations will appear as more data is collected</p>
            </div>
          ) : (
            recommendations.map((r, i) => (
              <div key={i} className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                    <Brain className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{r.recommendation}</p>
                      <Badge variant={r.priority === 'high' ? 'danger' : 'warning'}>{r.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="capitalize">Category: {r.category}</span>
                      <span>Expected: {r.expectedImpact}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
