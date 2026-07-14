import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { analyticsAPI } from '../../services/api';
import { fdate, fdatetime } from '../../utils/date';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Building2, Heart,
  Shield, Brain, Layers, UserCheck, Award, CheckCircle2, XCircle,
  Download, Printer, FileText, Eye, Info, Star, UserX, Clock, Target,
  DollarSign, HandCoins, Wallet, AlertTriangle, Calendar, Filter,
  ChevronDown, ChevronUp, Search, AlertCircle, Activity, ArrowUp,
  ArrowDown, Minus, Plus, Save
} from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = v => `TZS ${Number(v||0).toLocaleString()}`;
const pct = v => `${Math.round(Number(v||0)*10)/10}%`;
const num = v => Number(v||0).toLocaleString();
const R = v => Math.round(Number(v||0)*10)/10;

const CHIP = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const Badge = ({ children, variant = 'neutral' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CHIP[variant]||CHIP.neutral}`}>{children}</span>
);

const KpiCard = ({ label, value, prev, diff, pctChg, status, target, icon: Icon }) => {
  const statusColor = status === 'above_target' ? 'emerald' : status === 'on_target' ? 'blue' : status === 'below_target' ? 'amber' : 'rose';
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">{label}</span>
        {Icon && <Icon className={`w-4 h-4 text-${statusColor}-500`} />}
      </div>
      <p className={`text-xl font-bold text-${statusColor}-600 dark:text-${statusColor}-400`}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
        {diff !== undefined && (
          <span className={`flex items-center gap-0.5 font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diff >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {R(diff)} ({pctChg || '0%'})
          </span>
        )}
        {prev !== undefined && <span className="text-slate-400">prev: {prev}</span>}
        {status && <Badge variant={statusColor}>{status.replace('_',' ')}</Badge>}
      </div>
    </div>
  );
};

const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
};

const getMonthRange = (year, month) => {
  const start = `${year}-${String(month+1).padStart(2,'0')}-01`;
  const end = new Date(year, month+1, 0).toISOString().split('T')[0];
  return { start, end };
};

const MODES = [
  { key: 'overall', label: 'Overall', icon: Building2 },
  { key: 'sections', label: 'Sections', icon: Layers },
  { key: 'leaders', label: 'Leaders', icon: Users },
  { key: 'departments', label: 'Departments', icon: Heart },
  { key: 'members', label: 'Members', icon: UserCheck },
];

const VIEWS = [
  { key: 'summary', label: 'Summary' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'actions', label: 'Actions' },
];

const ExecutiveComparison = () => {
  const [mode, setMode] = useState('overall');
  const [view, setView] = useState('summary');
  const [periodType, setPeriodType] = useState('month');
  const [periodCount, setPeriodCount] = useState(6);
  const [customPeriods, setCustomPeriods] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedLeader, setExpandedLeader] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const buildPeriods = useCallback(() => {
    if (customPeriods.length > 0) return customPeriods;
    const periods = [];
    const now = new Date();
    if (periodType === 'week') {
      for (let i = periodCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const range = getWeekRange(d);
        const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
        periods.push({ id: `w${i}`, label, start: range.start, end: range.end });
      }
    } else if (periodType === 'month') {
      for (let i = periodCount - 1; i >= 0; i--) {
        const m = (now.getMonth() - i + 12) % 12;
        const y = now.getFullYear() - (now.getMonth() - i < 0 ? 1 : 0);
        const range = getMonthRange(y, m);
        periods.push({ id: `m${i}`, label: `${MONTHS[m]} ${y}`, start: range.start, end: range.end });
      }
    } else if (periodType === 'quarter') {
      for (let i = periodCount - 1; i >= 0; i--) {
        const q = Math.floor((now.getMonth() - i * 3 + 12) % 12 / 3);
        const y = now.getFullYear() - Math.floor((now.getMonth() - i * 3) / 12);
        const startM = q * 3;
        const start = `${y}-${String(startM+1).padStart(2,'0')}-01`;
        const end = new Date(y, startM+3, 0).toISOString().split('T')[0];
        periods.push({ id: `q${i}`, label: `Q${q+1} ${y}`, start, end });
      }
    } else if (periodType === 'year') {
      for (let i = periodCount - 1; i >= 0; i--) {
        const y = now.getFullYear() - i;
        const start = `${y}-01-01`;
        const end = `${y}-12-31`;
        periods.push({ id: `y${i}`, label: `${y}`, start, end });
      }
    }
    return periods;
  }, [periodType, periodCount, customPeriods]);

  const periods = useMemo(buildPeriods, [buildPeriods]);

  useEffect(() => {
    if (periods.length === 0) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await analyticsAPI.getExecutiveComparison({ periods, mode });
        setData(res.data);
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periods, mode]);

  const activeSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortFn = (arr, key) => {
    if (!sortKey || !arr) return arr || [];
    return [...arr].sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  };

  const latestPeriod = data?.periods?.[data.periods.length - 1];
  const prevPeriod = data?.periods?.[data.periods.length - 2];
  const kpis = data?.kpis;
  const trends = data?.trends;
  const rootCauses = data?.rootCauses;
  const actions = data?.actions;

  const latestOverall = latestPeriod?.overall || {};
  const prevOverall = prevPeriod?.overall || {};

  const rateDiff = R(latestOverall.attendance_rate - prevOverall.attendance_rate);
  const ratePct = prevOverall.attendance_rate ? R(rateDiff / prevOverall.attendance_rate * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold">Executive Attendance Intelligence</h2>
              <p className="text-white/80 text-sm">Multi-period comparison & decision support system</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => {/* export */}}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>

          {/* ── Controls ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex gap-1 bg-white/10 rounded-xl p-1">
              {MODES.map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    mode === m.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  <m.icon className="w-3 h-3" /> {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-white/10 rounded-xl p-1">
              {['week','month','quarter','year'].map(pt => (
                <button key={pt} onClick={() => setPeriodType(pt)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    periodType === pt ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  {pt === 'week' ? 'Weekly' : pt === 'month' ? 'Monthly' : pt === 'quarter' ? 'Quarterly' : 'Yearly'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-semibold text-white/70">Periods:</span>
              <button onClick={() => setPeriodCount(Math.max(2, periodCount - 1))}
                className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white text-xs hover:bg-white/30">-</button>
              <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">{periodCount}</span>
              <button onClick={() => setPeriodCount(Math.min(24, periodCount + 1))}
                className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white text-xs hover:bg-white/30">+</button>
            </div>
          </div>

          {/* ── View tabs ────────────────────────────────────────────────── */}
          <div className="flex gap-1 mt-3">
            {VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  view === v.key ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                }`}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-700 p-6 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── SUMMARY VIEW ────────────────────────────────────────────── */}
          {view === 'summary' && (
            <div className="space-y-6">
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard label="Church Health Score" value={`${kpis?.church_health_score || 0}%`}
                  diff={kpis?.rate_change} status="above_target" icon={Heart} />
                <KpiCard label="Attendance Rate" value={pct(latestOverall.attendance_rate)}
                  prev={pct(prevOverall.attendance_rate)} diff={rateDiff} pctChg={pct(ratePct)}
                  status={rateDiff >= 0 ? 'above_target' : 'below_target'} icon={Activity} />
                <KpiCard label="Growth Index" value={kpis?.attendance_growth_index || 0}
                  status={kpis?.attendance_growth_index >= 0 ? 'above_target' : 'below_target'} icon={TrendingUp} />
                <KpiCard label="Stability" value={`${kpis?.stability_index || 0}%`}
                  status={kpis?.stability_index >= 70 ? 'above_target' : kpis?.stability_index >= 50 ? 'on_target' : 'below_target'} icon={Shield} />
                <KpiCard label="Retention" value={pct(kpis?.retention_index)}
                  status={kpis?.retention_index >= 70 ? 'above_target' : kpis?.retention_index >= 50 ? 'on_target' : 'below_target'} icon={UserCheck} />
                <KpiCard label="Engagement" value={`${kpis?.engagement_score || 0}%`}
                  status={kpis?.engagement_score >= 60 ? 'above_target' : kpis?.engagement_score >= 40 ? 'on_target' : 'below_target'} icon={Star} />
                <KpiCard label="Leader Performance" value={`${kpis?.leader_performance_index || 0}%`}
                  status={kpis?.leader_performance_index >= 70 ? 'above_target' : 'on_target'} icon={Award} />
                <KpiCard label="Forecast" value={pct(kpis?.attendance_forecast)}
                  status={kpis?.attendance_forecast >= (kpis?.current_rate || 0) ? 'above_target' : 'below_target'} icon={Brain} />
              </div>

              {/* Period Comparison Matrix */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Multi-Period Overall Comparison
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 font-semibold text-slate-500 sticky left-0 bg-white dark:bg-slate-800">Metric</th>
                        {data.periods.map(p => (
                          <th key={p.id} className="text-right py-2 px-2 font-semibold text-slate-500 min-w-[80px]">{p.label}</th>
                        ))}
                        {data.periods.length > 1 && <th className="text-right py-2 px-2 font-semibold text-slate-500 min-w-[60px]">Trend</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'present', label: 'Present Members', fmt: num },
                        { key: 'absent', label: 'Absent Members', fmt: num },
                        { key: 'excused', label: 'Excused Members', fmt: num },
                        { key: 'attendance_rate', label: 'Attendance Rate', fmt: pct },
                        { key: 'service_days', label: 'Service Days', fmt: num },
                        { key: 'active_sections', label: 'Active Sections', fmt: num },
                        { key: 'leaders_submitted', label: 'Leaders Submitted', fmt: num },
                        { key: 'total_records', label: 'Total Records', fmt: num },
                        { key: 'new_members', label: 'New Members', fmt: num },
                        { key: 'retention_rate', label: 'Retention Rate', fmt: pct },
                        { key: 'engagement_score', label: 'Engagement Score', fmt: pct },
                        { key: 'net_growth', label: 'Net Growth', fmt: num },
                      ].map(row => {
                        const vals = data.periods.map(p => p.overall?.[row.key]);
                        const nums = vals.map(v => Number(v) || 0);
                        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                        const positive = ['absent','excused'].includes(row.key) ? 'down' : 'up';
                        return (
                          <tr key={row.key} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">{row.label}</td>
                            {vals.map((v, i) => (
                              <td key={i} className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-white">{row.fmt(v)}</td>
                            ))}
                            {data.periods.length > 1 && (
                              <td className="py-2 px-2 text-right">
                                {avg > 0 ? (
                                  nums[nums.length - 1] > nums[0]
                                    ? <Badge variant={positive === 'up' ? 'success' : 'danger'}>{nums[nums.length-1] > nums[0] ? '↑' : '↓'}</Badge>
                                    : <Badge variant={positive === 'up' ? 'danger' : 'success'}>{nums[nums.length-1] > nums[0] ? '↑' : '↓'}</Badge>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section / Leader / Department / Member Tables */}
              {mode !== 'overall' && (
                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    {mode === 'sections' ? 'Section' : mode === 'leaders' ? 'Leader' : mode === 'departments' ? 'Department' : 'Member'} Rankings
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-800">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-2 px-2 font-semibold text-slate-500">#</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('name')}>Name</th>
                          {data.periods.map(p => (
                            <th key={p.id} className="text-right py-2 px-2 font-semibold text-slate-500">{p.label}</th>
                          ))}
                          <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('attendance_rate')}>Avg Rate</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mode === 'sections' ? sortFn(data.periods[data.periods.length-1]?.sections, 'attendance_rate') :
                          mode === 'leaders' ? sortFn(data.periods[data.periods.length-1]?.leaders, 'attendance_rate') :
                          mode === 'departments' ? sortFn(data.periods[data.periods.length-1]?.departments, 'attendance_rate') :
                          sortFn(data.periods[data.periods.length-1]?.memberEngagement, 'attendance_rate')
                        ).filter(e => !search || (e.name||e.leader_name||e.full_name||'').toLowerCase().includes(search.toLowerCase()))
                        .slice(0, 50).map((entity, i) => {
                          const rates = data.periods.map(p => {
                            const list = mode === 'sections' ? p.sections : mode === 'leaders' ? p.leaders : mode === 'departments' ? p.departments : p.memberEngagement;
                            const found = list?.find(e2 => e2.id === entity.id || e2.name === entity.name || e2.leader_name === entity.leader_name);
                            return found ? Number(found.attendance_rate) || 0 : 0;
                          });
                          const avgRate = rates.length > 0 ? rates.reduce((a,b) => a+b, 0) / rates.length : 0;
                          const trend = rates.length > 1 ? (rates[rates.length-1] > rates[0] ? 'up' : rates[rates.length-1] < rates[0] ? 'down' : 'stable') : 'stable';
                          const name = entity.name || entity.leader_name || entity.full_name || 'Unknown';
                          return (
                            <tr key={entity.id || i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="py-2 px-2 text-slate-400">{i + 1}</td>
                              <td className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300">{name}</td>
                              {rates.map((r, j) => (
                                <td key={j} className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-white">{pct(r)}</td>
                              ))}
                              <td className="py-2 px-2 text-right font-bold text-indigo-600">{pct(avgRate)}</td>
                              <td className="py-2 px-2 text-right">
                                {trend === 'up' ? <Badge variant="success">↑ Growing</Badge> :
                                 trend === 'down' ? <Badge variant="danger">↓ Declining</Badge> :
                                 <Badge variant="neutral">→ Stable</Badge>}
                              </td>
                            </tr>
                          );
                        })}
                        {data.periods[data.periods.length-1]?.[mode === 'sections' ? 'sections' : mode === 'leaders' ? 'leaders' : mode === 'departments' ? 'departments' : 'memberEngagement']?.length === 0 && (
                          <tr><td colSpan={10} className="py-8 text-center text-slate-400">No data available for this period</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MATRIX VIEW ──────────────────────────────────────────────── */}
          {view === 'matrix' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Full Comparison Matrix — {data.periods.length} Periods
                </h3>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 font-semibold text-slate-500 sticky left-0 bg-white dark:bg-slate-800 z-20">Metric</th>
                        {data.periods.map(p => (
                          <th key={p.id} className="text-right py-2 px-3 font-semibold text-slate-500 min-w-[90px]">{p.label}</th>
                        ))}
                        <th className="text-right py-2 px-3 font-semibold text-slate-500 min-w-[70px]">Avg</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-500 min-w-[70px]">Best</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-500 min-w-[70px]">Worst</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'total_members', label: 'Total Members', fmt: num },
                        { key: 'present', label: 'Present', fmt: num },
                        { key: 'absent', label: 'Absent', fmt: num },
                        { key: 'excused', label: 'Excused', fmt: num },
                        { key: 'attendance_rate', label: 'Attendance %', fmt: pct },
                        { key: 'service_days', label: 'Service Days', fmt: num },
                        { key: 'total_records', label: 'Records', fmt: num },
                        { key: 'active_sections', label: 'Active Sections', fmt: num },
                        { key: 'leaders_submitted', label: 'Leaders Submitting', fmt: num },
                        { key: 'new_members', label: 'New Members', fmt: num },
                        { key: 'new_registrations', label: 'New Registrations', fmt: num },
                        { key: 'retention_rate', label: 'Retention %', fmt: pct },
                        { key: 'engagement_score', label: 'Engagement %', fmt: pct },
                        { key: 'visitors', label: 'Visitors', fmt: num },
                        { key: 'followups_completed', label: 'Follow-ups Done', fmt: num },
                        { key: 'total_followups_needed', label: 'Follow-ups Needed', fmt: num },
                        { key: 'net_growth', label: 'Net Growth', fmt: num },
                        { key: 'members_contacted', label: 'Members Contacted', fmt: num },
                      ].map(row => {
                        const vals = data.periods.map(p => p.overall?.[row.key]);
                        const nums = vals.map(v => Number(v) || 0);
                        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                        const best = Math.max(...nums);
                        const worst = Math.min(...nums);
                        return (
                          <tr key={row.key} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-1.5 px-2 font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">{row.label}</td>
                            {vals.map((v, i) => (
                              <td key={i} className={`py-1.5 px-3 text-right font-semibold ${
                                Number(v) === best && nums.some(n => n !== best) ? 'text-emerald-600' :
                                Number(v) === worst && nums.some(n => n !== worst) ? 'text-rose-600' :
                                'text-slate-900 dark:text-white'
                              }`}>{row.fmt(v)}</td>
                            ))}
                            <td className="py-1.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{row.fmt(avg)}</td>
                            <td className="py-1.5 px-3 text-right font-bold text-emerald-600">{row.fmt(best)}</td>
                            <td className="py-1.5 px-3 text-right font-bold text-rose-600">{row.fmt(worst)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RANKINGS VIEW ────────────────────────────────────────────── */}
          {view === 'rankings' && (
            <div className="space-y-6">
              {/* Best/Worst/Improving/Declining summaries */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {['best','worst','improving','declining'].map(type => {
                  const lastEntities = data.periods[data.periods.length-1]?.[mode === 'sections' ? 'sections' : 'leaders'];
                  if (!lastEntities?.length) return null;
                  const sorted = [...lastEntities].sort((a, b) => {
                    const rateA = type === 'declining' || type === 'worst' ? Number(a.attendance_rate) || 0 : -(Number(a.attendance_rate) || 0);
                    const rateB = type === 'declining' || type === 'worst' ? Number(b.attendance_rate) || 0 : -(Number(b.attendance_rate) || 0);
                    return rateA - rateB;
                  });
                  const top = sorted.slice(0, 3);
                  const colors = {
                    best: { bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700', icon: 'text-emerald-500', label: 'Best Performing' },
                    worst: { bg: 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-700', icon: 'text-rose-500', label: 'Needs Attention' },
                    improving: { bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700', icon: 'text-blue-500', label: 'Most Improved' },
                    declining: { bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700', icon: 'text-amber-500', label: 'Declining' },
                  };
                  const c = colors[type];
                  return (
                    <div key={type} className={`rounded-2xl border ${c.bg} p-4 shadow-sm`}>
                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-3 flex items-center gap-1.5">
                        {type === 'best' ? <Award className={`w-3.5 h-3.5 ${c.icon}`} /> :
                         type === 'worst' ? <AlertTriangle className={`w-3.5 h-3.5 ${c.icon}`} /> :
                         type === 'improving' ? <TrendingUp className={`w-3.5 h-3.5 ${c.icon}`} /> :
                         <TrendingDown className={`w-3.5 h-3.5 ${c.icon}`} />}
                        {c.label}
                      </h4>
                      <ol className="space-y-1.5">
                        {top.map((e, i) => (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{e.name || e.leader_name}</span>
                            <span className="font-bold text-slate-900 dark:text-white ml-2">{pct(e.attendance_rate)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>

              {/* Full Entity Rankings Table */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  {mode === 'sections' ? 'Section' : mode === 'leaders' ? 'Leader' : mode === 'departments' ? 'Department' : 'Member'} Rankings
                </h3>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-slate-800">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 font-semibold text-slate-500">Rank</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-500">Name</th>
                        {mode === 'members' ? (
                          <th className="text-right py-2 px-2 font-semibold text-slate-500">P / A / E</th>
                        ) : (
                          <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('attendance_rate')}>Rate</th>
                        )}
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('members')}>Members</th>
                        {mode !== 'members' && <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('present')}>Present</th>}
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('submission_rate')}>Submit %</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 cursor-pointer" onClick={() => activeSort('follow_up_completion')}>Follow-up</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortFn(latestPeriod?.[mode === 'sections' ? 'sections' : mode === 'leaders' ? 'leaders' : mode === 'departments' ? 'departments' : 'memberEngagement'] || [], 'attendance_rate')
                        .filter(e => !search || (e.name||e.leader_name||e.full_name||'').toLowerCase().includes(search.toLowerCase()))
                        .map((entity, i) => {
                          const name = entity.name || entity.leader_name || entity.full_name || 'Unknown';
                          const isSection = mode === 'sections';
                          const isLeader = mode === 'leaders';
                          return (
                            <tr key={entity.id || i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                              onClick={() => { isSection && setExpandedSection(expandedSection === entity.id ? null : entity.id); }}>
                              <td className="py-2 px-2">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                                  i === 0 ? 'bg-amber-100 text-amber-700' :
                                  i === 1 ? 'bg-slate-100 text-slate-600' :
                                  i === 2 ? 'bg-orange-100 text-orange-700' :
                                  'bg-slate-50 text-slate-400'
                                }`}>{i + 1}</span>
                              </td>
                              <td className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300">
                                {name}
                                {isSection && <span className="text-[10px] text-slate-400 ml-1">({entity.members || 0} members)</span>}
                                {isLeader && <span className="text-[10px] text-slate-400 ml-1">({entity.section_name})</span>}
                              </td>
                              {mode === 'members' ? (
                                <td className="py-2 px-2 text-right whitespace-nowrap">
                                  <span className="text-emerald-600 font-bold">{entity.present_count || 0}</span>
                                  <span className="text-slate-400 mx-0.5">/</span>
                                  <span className="text-rose-600 font-bold">{entity.absent_count || 0}</span>
                                  <span className="text-slate-400 mx-0.5">/</span>
                                  <span className="text-amber-600 font-bold">{entity.excused_count || 0}</span>
                                </td>
                              ) : (
                                <td className="py-2 px-2 text-right font-bold text-indigo-600">{pct(entity.attendance_rate)}</td>
                              )}
                              <td className="py-2 px-2 text-right text-slate-900 dark:text-white">{entity.members || entity.assigned_members || '-'}</td>
                              {mode !== 'members' && <td className="py-2 px-2 text-right text-slate-900 dark:text-white">{entity.present || '-'}</td>}
                              <td className="py-2 px-2 text-right">
                                {entity.submission_rate !== undefined ? (
                                  <span className={`font-semibold ${entity.submission_rate >= 80 ? 'text-emerald-600' : entity.submission_rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {pct(entity.submission_rate)}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {entity.follow_up_completion !== undefined ? (
                                  <span className={`font-semibold ${entity.follow_up_completion >= 70 ? 'text-emerald-600' : entity.follow_up_completion >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {pct(entity.follow_up_completion)}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {(() => {
                                  const prevEntity = data.periods.length > 1
                                    ? data.periods[data.periods.length - 2]?.[mode === 'sections' ? 'sections' : 'leaders']?.find(e2 => e2.id === entity.id)
                                    : null;
                                  const diff = prevEntity ? (entity.attendance_rate || 0) - (prevEntity.attendance_rate || 0) : 0;
                                  return diff > 2 ? <Badge variant="success">↑{R(diff)}</Badge> :
                                         diff < -2 ? <Badge variant="danger">↓{Math.abs(R(diff))}</Badge> :
                                         <Badge variant="neutral">→</Badge>;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── INTELLIGENCE VIEW ────────────────────────────────────────── */}
          {view === 'intelligence' && (
            <div className="space-y-6">
              {/* Trend Analysis */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Attendance Trend Intelligence
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Classification</span>
                    <p className="text-lg font-bold mt-1 flex items-center gap-2">
                      {trends?.classification === 'growing' ? <><TrendingUp className="w-5 h-5 text-emerald-500" /><span className="text-emerald-600">Growing</span></> :
                       trends?.classification === 'declining' ? <><TrendingDown className="w-5 h-5 text-rose-500" /><span className="text-rose-600">Declining</span></> :
                       trends?.classification === 'stable' ? <><Minus className="w-5 h-5 text-blue-500" /><span className="text-blue-600">Stable</span></> :
                       <span className="text-slate-600">{trends?.classification || 'Analyzing...'}</span>}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Direction</span>
                    <p className="text-lg font-bold mt-1 text-slate-900 dark:text-white">{R(trends?.direction || 0)}%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Avg Rate</span>
                    <p className="text-lg font-bold mt-1 text-indigo-600">{pct(trends?.average_rate)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Momentum</span>
                    <p className={`text-lg font-bold mt-1 ${(trends?.recent_momentum||0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {trends?.recent_momentum > 0 ? '+' : ''}{R(trends?.recent_momentum || 0)}%
                    </p>
                  </div>
                </div>

                {trends?.anomalies?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Anomalies Detected
                    </h4>
                    <div className="space-y-1.5">
                      {trends.anomalies.map((a, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2">
                          <Badge variant={a.type === 'positive' ? 'success' : 'danger'}>{a.deviation > 0 ? '+' : ''}{a.deviation}%</Badge>
                          <span className="text-slate-600 dark:text-slate-400">{a.period}: {pct(a.rate)}</span>
                          <span className="text-slate-400 ml-auto">{a.type === 'positive' ? 'Above average' : 'Below average'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Root Cause Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-500" />
                    Root Cause Analysis
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{rootCauses?.summary}</p>
                  {rootCauses?.factors?.length > 0 && (
                    <div className="space-y-2">
                      {rootCauses.factors.slice(0, 10).map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={f.type === 'section' ? 'info' : 'violet'}>{f.type}</Badge>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{f.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${f.direction === 'positive' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {f.impact > 0 ? '+' : ''}{f.impact}%
                            </span>
                            <span className="text-slate-400">({Math.abs(f.contribution)}% contrib.)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attendance Movement */}
                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Attendance Movement Analysis
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <span className="text-slate-600 dark:text-slate-400">New Members</span>
                      <span className="font-bold text-emerald-600">{latestOverall.new_members || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <span className="text-slate-600 dark:text-slate-400">Returning Members</span>
                      <span className="font-bold text-blue-600">{latestOverall.returning_members || latestPeriod?.movement?.returning_members || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <span className="text-slate-600 dark:text-slate-400">Visitors Converted</span>
                      <span className="font-bold text-indigo-600">{latestPeriod?.movement?.visitors_converted || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                      <span className="text-slate-600 dark:text-slate-400">Members Lost</span>
                      <span className="font-bold text-rose-600">{latestOverall.members_lost || latestPeriod?.movement?.members_lost || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2 border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Net Growth</span>
                      <span className={`font-bold text-lg ${(latestOverall.net_growth || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(latestOverall.net_growth || 0) >= 0 ? '+' : ''}{latestOverall.net_growth || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Period-over-Period Performance Table */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Period Performance History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 font-semibold text-slate-500">Period</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Present</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Rate</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">New Members</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Retention</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Engagement</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Growth</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods.map((p, i) => {
                        const o = p.overall || {};
                        const prev = i > 0 ? data.periods[i-1].overall : null;
                        const rateChange = prev ? (o.attendance_rate || 0) - (prev.attendance_rate || 0) : 0;
                        const isBest = i === 0 || (o.attendance_rate || 0) >= Math.max(...data.periods.slice(0, i+1).map(x => x.overall?.attendance_rate || 0));
                        const isWorst = i === 0 || (o.attendance_rate || 0) <= Math.min(...data.periods.slice(0, i+1).map(x => x.overall?.attendance_rate || 0));
                        return (
                          <tr key={p.id} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                            isBest && i === data.periods.length - 1 ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : ''
                          }`}>
                            <td className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300">{p.label}</td>
                            <td className="py-2 px-2 text-right text-slate-900 dark:text-white">{num(o.present)}</td>
                            <td className="py-2 px-2 text-right font-bold text-indigo-600">{pct(o.attendance_rate)}</td>
                            <td className="py-2 px-2 text-right text-slate-900 dark:text-white">{num(o.new_members)}</td>
                            <td className="py-2 px-2 text-right">{pct(o.retention_rate)}</td>
                            <td className="py-2 px-2 text-right">{pct(o.engagement_score)}</td>
                            <td className="py-2 px-2 text-right">
                              <span className={`font-bold ${rateChange > 0 ? 'text-emerald-600' : rateChange < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {rateChange > 0 ? '+' : ''}{R(rateChange)}%
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              {isBest && i === data.periods.length - 1 ? <Badge variant="success">Best</Badge> :
                               isWorst ? <Badge variant="danger">Low</Badge> :
                               rateChange > 2 ? <Badge variant="success">↑</Badge> :
                               rateChange < -2 ? <Badge variant="danger">↓</Badge> :
                               <Badge variant="neutral">→</Badge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIONS VIEW ─────────────────────────────────────────────── */}
          {view === 'actions' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-500" />
                  Priority Action Center
                </h3>
                {actions?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm text-slate-500">No critical actions required at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actions.sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.priority] - order[b.priority];
                    }).map((action, i) => {
                      const priorityColors = {
                        high: { border: 'border-rose-200 dark:border-rose-700', bg: 'bg-rose-50 dark:bg-rose-900/10', badge: 'danger', icon: AlertTriangle },
                        medium: { border: 'border-amber-200 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/10', badge: 'warning', icon: AlertCircle },
                        low: { border: 'border-blue-200 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/10', badge: 'info', icon: Info },
                      };
                      const pc = priorityColors[action.priority] || priorityColors.low;
                      const Icon = pc.icon;
                      return (
                        <div key={i} className={`rounded-xl border ${pc.border} ${pc.bg} p-4`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${
                              action.priority === 'high' ? 'bg-rose-100 text-rose-600' :
                              action.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{action.title}</span>
                                <Badge variant={pc.badge}>{action.priority}</Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-2">{action.description}</p>
                              <div className="flex items-center gap-3 text-[10px]">
                                {action.affected?.length > 0 && (
                                  <span className="text-slate-400">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    {action.affected.join(', ')}
                                  </span>
                                )}
                                <span className="text-emerald-600 font-medium">
                                  <Target className="w-3 h-3 inline mr-1" />
                                  {action.expected_impact}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Member At-Risk Quick List */}
              {latestPeriod?.memberEngagement?.filter(m => m.risk_level === 'high' || m.risk_level === 'critical').length > 0 && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-500" />
                    Members at Risk — Immediate Attention
                  </h3>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-800">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-2 px-2 font-semibold text-slate-500">Member</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-500">Section</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-500">Rate</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-500">Last Attendance</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-500">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestPeriod.memberEngagement
                          .filter(m => m.risk_level === 'high' || m.risk_level === 'critical')
                          .sort((a, b) => {
                            const order = { critical: 0, high: 1, medium: 2, low: 3 };
                            return (order[a.risk_level] || 99) - (order[b.risk_level] || 99);
                          })
                          .slice(0, 20)
                          .map(m => (
                            <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300">{m.full_name}</td>
                              <td className="py-2 px-2 text-slate-500">{m.section_name}</td>
                              <td className="py-2 px-2 text-right font-semibold">{pct(m.attendance_rate)}</td>
                              <td className="py-2 px-2 text-right text-slate-500">{m.last_attendance === 'never' ? 'Never' : fdate(m.last_attendance)}</td>
                              <td className="py-2 px-2 text-right">
                                <Badge variant={m.risk_level === 'critical' ? 'danger' : 'warning'}>{m.risk_level}</Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExecutiveComparison;