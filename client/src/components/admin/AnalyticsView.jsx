import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Building2, Heart,
  Shield, Brain, Layers, UserCheck, Award, PieChart as PieChartIcon,
  ArrowUp, ArrowDown, Minus, CheckCircle2, XCircle, TrendingDown,
  Download, Printer, FileText, Eye, Info
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ComposedChart
} from 'recharts';

const C = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#84cc16'];

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{String(p.name).toLowerCase().includes('rate') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
};

const Card = ({ icon: Icon, label, value, trend, color = 'indigo', sub }) => (
  <div className={`rounded-2xl border border-${color}-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
      </div>
    </div>
    <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
        {trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {Math.abs(trend)}%
      </div>
    )}
  </div>
);

const MiniSparkline = ({ data, color = '#6366f1' }) => {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`aspark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#aspark-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const TABS = [
  { key: 'executive', label: 'Executive', icon: Layers },
  { key: 'sections', label: 'Sections', icon: Building2 },
  { key: 'leaders', label: 'Leaders', icon: Users },
  { key: 'departments', label: 'Departments', icon: PieChartIcon },
  { key: 'members', label: 'Members', icon: UserCheck },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'insights', label: 'AI Insights', icon: Brain },
  { key: 'health', label: 'Church Health', icon: Heart },
  { key: 'risk', label: 'Risk Analysis', icon: Shield },
  { key: 'distribution', label: 'Distribution', icon: Eye },
];

const AnalyticsView = () => {
  const [tab, setTab] = useState('executive');
  const [period, setPeriod] = useState(90);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => { loadAll(); }, [period]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const r = await Promise.allSettled([
        analyticsAPI.getExecutiveDashboard(),
        analyticsAPI.getSectionRankings(period),
        analyticsAPI.getLeaderRankings(period),
        analyticsAPI.getDepartments(period),
        analyticsAPI.getMemberIntelligence(period),
        analyticsAPI.getHeatmap(6),
        analyticsAPI.getTrendsMA(26),
        analyticsAPI.getAIInsights(),
        analyticsAPI.getChurchGrowthIndex(),
        analyticsAPI.getRiskAnalysis(),
        analyticsAPI.getHeadLeaderAnalytics(period),
        analyticsAPI.getLeaderWorkload(period),
        analyticsAPI.getCorrelations(6),
        analyticsAPI.getSectionComparison(period),
        analyticsAPI.getAttendancePatterns(180),
        analyticsAPI.getYearOverYear(),
      ]);
      const ok = i => r[i].status === 'fulfilled' ? r[i].value.data : null;
      setData({
        executive: ok(0), sections: ok(1) || [], leaders: ok(2) || [],
        departments: ok(3) || [], members: ok(4) || [],
        heatmap: ok(5), trends: ok(6) || [], insights: ok(7) || [],
        growth: ok(8), risk: ok(9),
        headLeaders: ok(10) || [], workload: ok(11) || [],
        correlations: ok(12) || [], sectionComparison: ok(13) || [],
        dayPatterns: ok(14) || [], yearOverYear: ok(15) || [],
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Church Analytics</h2>
              <p className="text-white/80 text-sm">Comprehensive attendance intelligence & visual insights</p>
            </div>
          </div>
          <select value={period} onChange={e => setPeriod(Number(e.target.value))}
            className="bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value={30} className="text-slate-900">Last 30 days</option>
            <option value={90} className="text-slate-900">Last 90 days</option>
            <option value={180} className="text-slate-900">Last 6 months</option>
            <option value={365} className="text-slate-900">Last year</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'executive' && <ExecutiveTab data={data} />}
      {tab === 'sections' && <SectionsTab data={data} />}
      {tab === 'leaders' && <LeadersTab data={data} />}
      {tab === 'departments' && <DepartmentsTab data={data} />}
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'trends' && <TrendsTab data={data} />}
      {tab === 'insights' && <InsightsTab data={data} />}
      {tab === 'health' && <HealthTab data={data} />}
      {tab === 'risk' && <RiskTab data={data} />}
      {tab === 'distribution' && <DistributionTab data={data} />}
    </div>
  );
};

const ExecutiveTab = ({ data }) => {
  const ex = data.executive || {};
  const rate = Number(ex.attendance_rate) || 0;
  const weeklyData = (data.trends || []).slice(-12).map((t, i) => ({ v: t.daily_rate || 0 }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-indigo-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Members</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"><Users className="w-4 h-4 text-indigo-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.total_members || 0).toLocaleString()}</p>
          <MiniSparkline data={weeklyData} color="#6366f1" />
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Present Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.present_today || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{rate}% attendance</p>
        </div>
        <div className="rounded-2xl border border-rose-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Absent Today</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"><XCircle className="w-4 h-4 text-rose-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.absent_today || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-violet-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visitors (Week)</span>
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Heart className="w-4 h-4 text-violet-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.visitors_this_week || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-pink-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visitors (Month)</span>
            <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center"><Heart className="w-4 h-4 text-pink-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.visitors_this_month || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Excused</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{(ex.excused_today || 0).toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Weekly Growth', value: ex.weekly_growth, color: 'emerald' },
          { label: 'Monthly Growth', value: ex.monthly_growth, color: 'blue' },
          { label: 'Annual Growth', value: ex.annual_growth, color: 'violet' },
        ].map(g => (
          <div key={g.label} className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{g.label}</p>
            <p className={`text-2xl font-bold ${Number(g.value) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {Number(g.value) >= 0 ? '+' : ''}{g.value || 0}%
            </p>
          </div>
        ))}
        <div className="rounded-2xl border border-amber-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Attendance Rate</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{rate}%</p>
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${Math.min(100, rate)}%` }} />
          </div>
        </div>
      </div>
      {data.sectionComparison.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Section Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.sectionComparison} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="attendance_rate" name="Attendance Rate (%)" radius={[4, 4, 0, 0]}>
                {data.sectionComparison.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Bar>
              <Bar dataKey="member_count" name="Members" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.yearOverYear.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Year-over-Year Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.yearOverYear} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="current_rate" name="Current Year" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="previous_rate" name="Previous Year" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const SectionsTab = ({ data }) => {
  const s = data.sections || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {s.slice(0, 4).map((sec, i) => (
          <div key={sec.id} className={`rounded-2xl border bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm ${i === 0 ? 'border-emerald-300' : 'border-slate-200/70'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">#{i + 1} {sec.name}</span>
              {i === 0 && <Award className="w-4 h-4 text-amber-500" />}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{sec.attendance_rate}%</p>
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, sec.attendance_rate)}%`, backgroundColor: C[i] }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500">
              <span>{sec.member_count} members</span><span>+{sec.new_members} new</span>
            </div>
          </div>
        ))}
      </div>
      {s.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Performance Radar</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={s.map(x => ({ name: x.name?.slice(0, 10), rate: Number(x.attendance_rate) || 0, members: x.member_count || 0 }))}>
              <PolarGrid stroke="rgba(0,0,0,0.06)" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <Radar name="Rate" dataKey="rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
              <Radar name="Members" dataKey="members" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip content={<Tip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.sectionComparison.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Section Attendance Stacked</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.sectionComparison} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="total_present" name="Present" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="total_excused" name="Excused" fill="#f59e0b" stackId="a" />
              <Bar dataKey="total_absent" name="Absent" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Section Rankings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-slate-700">
              {['Rank','Section','Members','Present','Absent','Rate','Status'].map(h => (
                <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${h === 'Rank' || h === 'Section' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {s.map((sec, i) => (
                <tr key={sec.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-3 font-bold" style={{ color: C[i] }}>#{i + 1}</td>
                  <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{sec.name}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{sec.member_count}</td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-medium">{sec.total_present?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-rose-500">{sec.total_absent?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold">{sec.attendance_rate}%</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(sec.attendance_rate) >= 75 ? 'bg-emerald-100 text-emerald-700' : Number(sec.attendance_rate) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {Number(sec.attendance_rate) >= 75 ? 'Strong' : Number(sec.attendance_rate) >= 50 ? 'Average' : 'Weak'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LeadersTab = ({ data }) => {
  const leaders = data.leaders || [];
  const headLeaders = data.headLeaders || [];
  const workload = data.workload || [];
  return (
    <div className="space-y-6">
      {headLeaders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {headLeaders.map(hl => (
            <div key={hl.leader_id} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">{hl.leader_name?.charAt(0)}</div>
                <div><p className="font-semibold text-slate-900 dark:text-white">{hl.leader_name}</p><p className="text-xs text-slate-500">{hl.section_name} Head Leader</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Members', v: hl.members_managed },
                  { l: 'Leaders Supervised', v: hl.leaders_supervised },
                  { l: 'Attendance', v: `${hl.overall_attendance}%` },
                  { l: 'Score', v: `${hl.performance_score}/100` },
                ].map(x => (
                  <div key={x.l} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase">{x.l}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{x.v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {leaders.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Leader Rankings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                {['#','Leader','Section','Members','Rate','Submissions','Score'].map(h => (
                  <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${['#','Leader','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {leaders.slice(0, 15).map((l, i) => (
                  <tr key={l.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-3">
                      <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{l.leader_name}</td>
                    <td className="py-3 px-3 text-slate-500">{l.section_name}</td>
                    <td className="py-3 px-3 text-right">{l.assigned_members}</td>
                    <td className="py-3 px-3 text-right font-bold">{l.attendance_rate}%</td>
                    <td className="py-3 px-3 text-right">{l.submission_count}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.efficiency_score >= 75 ? 'bg-emerald-100 text-emerald-700' : l.efficiency_score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{l.efficiency_score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {workload.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Leader Workload</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {workload.slice(0, 9).map(w => (
              <div key={w.leader_id} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{w.leader_name}</p>
                <p className="text-[10px] text-slate-500 mb-2">{w.section_name}</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span className="text-slate-500">Assigned: <b className="text-slate-700">{w.assigned_members}</b></span>
                  <span className="text-slate-500">Present: <b className="text-emerald-600">{w.members_present}</b></span>
                  <span className="text-slate-500">Follow-ups: <b className="text-amber-600">{w.pending_followups}</b></span>
                  <span className="text-slate-500">Completed: <b className="text-emerald-600">{w.completed_followups}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DepartmentsTab = ({ data }) => {
  const depts = data.departments || [];
  return (
    <div className="space-y-6">
      {depts.length > 0 && (
        <>
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Department Attendance</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={depts} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="attendance_rate" name="Attendance Rate (%)" radius={[4, 4, 0, 0]}>
                  {depts.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Department Rankings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                  {['#','Department','Members','Present','Absent','Rate','Status'].map(h => (
                    <th key={h} className={`py-3 px-3 text-xs font-semibold uppercase text-slate-500 ${['#','Department'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {depts.map((d, i) => (
                    <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-3 font-bold" style={{ color: C[i] }}>#{i + 1}</td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{d.name}</td>
                      <td className="py-3 px-3 text-right">{d.member_count}</td>
                      <td className="py-3 px-3 text-right text-emerald-600">{d.total_present?.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-rose-500">{d.total_absent?.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-bold">{d.attendance_rate}%</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.growth_indicator === 'strong' ? 'bg-emerald-100 text-emerald-700' : d.growth_indicator === 'average' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {d.growth_indicator === 'strong' ? 'Strong' : d.growth_indicator === 'average' ? 'Average' : 'Needs Attention'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {depts.length === 0 && <div className="card p-10 text-center text-slate-400">No department data available</div>}
    </div>
  );
};

const MembersTab = ({ data }) => {
  const members = data.members || [];
  const risk = data.risk || {};
  const riskMembers = risk.members || [];
  const riskSummary = risk.summary || {};
  return (
    <div className="space-y-6">
      {riskSummary && Object.keys(riskSummary).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Highly Active', value: riskSummary.highly_active, color: 'emerald' },
            { label: 'Active', value: riskSummary.active, color: 'blue' },
            { label: 'Moderate', value: riskSummary.moderately_active, color: 'amber' },
            { label: 'At Risk', value: riskSummary.at_risk, color: 'orange' },
            { label: 'Critical', value: riskSummary.critical, color: 'rose' },
          ].map(r => (
            <div key={r.label} className={`rounded-2xl border border-${r.color}-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-3 shadow-sm text-center`}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{r.label}</p>
              <p className={`text-2xl font-bold text-${r.color}-600`}>{r.value || 0}</p>
            </div>
          ))}
        </div>
      )}
      {members.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Member Attendance Intelligence</h3>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800"><tr className="border-b border-slate-200 dark:border-slate-700">
                {['Member','Section','Present','Absent','Rate','Last Seen'].map(h => (
                  <th key={h} className={`py-2 px-3 text-xs font-semibold uppercase text-slate-500 ${['Member','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {members.slice(0, 50).map(m => (
                  <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{m.full_name}</td>
                    <td className="py-2 px-3 text-slate-500">{m.section_name}</td>
                    <td className="py-2 px-3 text-right text-emerald-600">{m.times_present}</td>
                    <td className="py-2 px-3 text-right text-rose-500">{m.times_absent}</td>
                    <td className="py-2 px-3 text-right font-bold">{m.attendance_rate}%</td>
                    <td className="py-2 px-3 text-right text-slate-500 text-xs">{m.last_attendance || 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const TrendsTab = ({ data }) => {
  const trends = data.trends || [];
  const patterns = data.dayPatterns || [];
  return (
    <div className="space-y-6">
      {trends.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Attendance Trends with Moving Averages</h3>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={trends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="daily_rate" name="Daily Rate (%)" fill="#6366f1" fillOpacity={0.08} stroke="#6366f1" strokeWidth={1.5} />
              <Line type="monotone" dataKey="ma_4week" name="4-Week MA" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="ma_8week" name="8-Week MA" stroke="#f59e0b" strokeWidth={2.5} dot={false} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {patterns.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Attendance by Day of Week</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={patterns} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="day_name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="avg_rate" name="Avg Rate (%)" radius={[6, 6, 0, 0]}>
                {patterns.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.heatmap && data.heatmap.daily && data.heatmap.daily.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Attendance Heat Map</h3>
          <div className="grid grid-cols-7 gap-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-500 pb-1">{d}</div>
            ))}
            {data.heatmap.daily.map((day, i) => {
              const rate = day.rate || 0;
              const bg = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-emerald-300' : rate >= 40 ? 'bg-amber-300' : rate >= 20 ? 'bg-orange-400' : 'bg-rose-400';
              return (
                <div key={i} className={`${bg} rounded aspect-square flex items-center justify-center text-[8px] text-white font-bold`} title={`${day.date}: ${rate}%`}>
                  {new Date(day.date).getDate()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const InsightsTab = ({ data }) => {
  const insights = data.insights || [];
  const icons = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: TrendingUp };
  const colors = { success: 'emerald', warning: 'amber', danger: 'rose', info: 'blue' };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Smart Insights</h3>
      {insights.length === 0 && <div className="card p-10 text-center text-slate-400">No insights available</div>}
      {insights.map((ins, i) => {
        const Icon = icons[ins.type] || Info;
        const c = colors[ins.type] || 'slate';
        return (
          <div key={i} className={`flex items-start gap-3 rounded-2xl border border-${c}-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm`}>
            <div className={`w-8 h-8 rounded-lg bg-${c}-100 dark:bg-${c}-900/30 flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 text-${c}-600 dark:text-${c}-400`} />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{ins.text}</p>
          </div>
        );
      })}
    </div>
  );
};

const HealthTab = ({ data }) => {
  const growth = data.growth || {};
  const gi = growth.growth_index || 0;
  const correlations = data.correlations || [];
  const scoreColor = gi >= 75 ? '#10b981' : gi >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-6">
      <div className="card p-6 text-center">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Church Growth Index</h3>
        <div className="relative inline-flex items-center justify-center w-40 h-40">
          <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${gi * 3.14} 314`} />
          </svg>
          <div className="absolute"><p className="text-3xl font-bold text-slate-900 dark:text-white">{gi}</p><p className="text-xs text-slate-500 text-center">/100</p></div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${gi >= 75 ? 'text-emerald-600' : gi >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
          {gi >= 75 ? 'Healthy Church' : gi >= 50 ? 'Needs Improvement' : 'Critical Attention Required'}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Active Members', v: growth.current_active },
          { l: 'Current Rate', v: `${growth.current_rate || 0}%` },
          { l: 'Rate Change', v: `${growth.rate_change > 0 ? '+' : ''}${growth.rate_change || 0}%` },
          { l: 'Souls Won (90d)', v: growth.souls_won_90d },
        ].map(g => (
          <div key={g.l} className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{g.l}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{g.v || 0}</p>
          </div>
        ))}
      </div>
      {correlations.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Attendance vs Contributions Correlation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={correlations} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area yAxisId="left" type="monotone" dataKey="attendance_rate" name="Attendance Rate (%)" fill="#6366f1" fillOpacity={0.08} stroke="#6366f1" strokeWidth={2} />
              <Bar yAxisId="right" dataKey="total_contributions" name="Total Contributions" fill="#10b981" radius={[3, 3, 0, 0]} barSize={20} opacity={0.7} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const RiskTab = ({ data }) => {
  const risk = data.risk || {};
  const atRisk = risk.at_risk_members || [];
  const consecutive = risk.consecutive_absentees || [];
  const summary = risk.summary || {};
  return (
    <div className="space-y-6">
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: 'Highly Active', v: summary.highly_active, c: 'emerald' },
            { l: 'Active', v: summary.active, c: 'blue' },
            { l: 'Moderate', v: summary.moderately_active, c: 'amber' },
            { l: 'At Risk', v: summary.at_risk, c: 'orange' },
            { l: 'Critical', v: summary.critical, c: 'rose' },
          ].map(r => (
            <div key={r.l} className="card p-4 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{r.l}</p>
              <p className="text-2xl font-bold" style={{ color: r.c === 'emerald' ? '#10b981' : r.c === 'blue' ? '#3b82f6' : r.c === 'amber' ? '#f59e0b' : r.c === 'orange' ? '#f97316' : '#ef4444' }}>{r.v || 0}</p>
            </div>
          ))}
        </div>
      )}
      {consecutive.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />Consecutive Absentees (3+ weeks)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                {['Member','Section','Leader','Absences'].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {consecutive.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/10">
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{c.full_name}</td>
                    <td className="py-2 px-3 text-slate-500">{c.section_name}</td>
                    <td className="py-2 px-3 text-slate-500">{c.leader_name}</td>
                    <td className="py-2 px-3 font-bold text-rose-600">{c.consecutive_absences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Pastoral Visitation List</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {atRisk.slice(0, 20).map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/10 rounded-xl p-2">
                <div className="w-8 h-8 rounded-full bg-rose-200 dark:bg-rose-800 flex items-center justify-center text-xs font-bold text-rose-700">{m.full_name?.charAt(0)}</div>
                <div><p className="text-xs font-medium text-slate-900 dark:text-white truncate">{m.full_name}</p><p className="text-[10px] text-slate-500">{m.section_name} | {m.present_count}/{m.total_services} services</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DistributionTab = ({ data }) => {
  const ex = data.executive || {};
  const rate = Number(ex.attendance_rate) || 0;
  const distData = [
    { name: 'Present', value: ex.present_today || 0, color: '#10b981' },
    { name: 'Absent', value: ex.absent_today || 0, color: '#ef4444' },
    { name: 'Excused', value: ex.excused_today || 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);
  const sectionBar = (data.sectionComparison || []).map(s => ({
    name: s.name?.length > 12 ? s.name.slice(0, 12) + '...' : s.name,
    fullName: s.name,
    present: s.total_present || 0,
    absent: s.total_absent || 0,
    excused: s.total_excused || 0,
  }));
  return (
    <div className="space-y-6">
      {distData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Attendance Distribution</h3>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie data={distData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {distData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {distData.map(d => (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">{d.name}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{d.value}</span>
                  <span className="text-xs text-slate-500">{distData.reduce((a, b) => a + b.value, 0) > 0 ? Math.round((d.value / distData.reduce((a, b) => a + b.value, 0)) * 100) : 0}%</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Attendance Rate</span>
                  <span className="text-lg font-bold text-indigo-600">{rate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {sectionBar.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Section Attendance Distribution</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={sectionBar} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="present" name="Present" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="excused" name="Excused" fill="#f59e0b" stackId="a" />
              <Bar dataKey="absent" name="Absent" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;
