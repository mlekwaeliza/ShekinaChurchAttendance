import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Building2, Heart,
  Shield, Brain, Layers, UserCheck, Award, PieChart as PieChartIcon,
  ArrowUp, ArrowDown, Minus, CheckCircle2, XCircle, TrendingDown,
  Download, Printer, FileText, Eye, Info, Star, UserX, Clock, Target,
  DollarSign, HandCoins, Wallet
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../../services/api';
import { fdate } from '../../utils/date';

const R = v => Math.round(Number(v) || 0);
const C = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#84cc16'];

const KpiCard = ({ label, value, prev, color = 'indigo', suffix = '' }) => {
  const num = Number(value) || 0;
  const prevNum = Number(prev) || 0;
  const diff = prevNum ? num - prevNum : null;
  const pct = prevNum ? ((diff / prevNum) * 100).toFixed(1) : null;
  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{suffix === '%' ? R(num) : num.toLocaleString()}{suffix}</p>
      {diff !== null && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[10px] font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diff >= 0 ? '+' : ''}{suffix === '%' ? R(diff) : diff.toLocaleString()}{suffix} ({pct}%)
          </span>
        </div>
      )}
      {prev !== undefined && (
        <p className="text-[9px] text-slate-400 mt-0.5">Prev: {suffix === '%' ? R(prevNum) : prevNum.toLocaleString()}{suffix}</p>
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

const TABS = [
  { key: 'executive', label: 'Executive', icon: Layers },
  { key: 'finance', label: 'Finance', icon: DollarSign },
  { key: 'sections', label: 'Sections', icon: Building2 },
  { key: 'leaders', label: 'Leaders', icon: Users },
  { key: 'departments', label: 'Departments', icon: PieChartIcon },
  { key: 'members', label: 'Members', icon: UserCheck },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'insights', label: 'AI Insights', icon: Brain },
  { key: 'health', label: 'Church Health', icon: Heart },
  { key: 'risk', label: 'Risk Analysis', icon: Shield },
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
        analyticsAPI.getTrendsMA(26),
        analyticsAPI.getAIInsights(),
        analyticsAPI.getChurchGrowthIndex(),
        analyticsAPI.getRiskAnalysis(),
        analyticsAPI.getHeadLeaderAnalytics(period),
        analyticsAPI.getLeaderWorkload(period),
        analyticsAPI.getSectionComparison(period),
        analyticsAPI.getYearOverYear(),
        analyticsAPI.getAttendancePatterns(period),
        analyticsAPI.getFinanceAnalytics(),
      ]);
      const ok = i => r[i].status === 'fulfilled' ? r[i].value.data : null;
      setData({
        executive: ok(0), sections: ok(1) || [], leaders: ok(2) || [],
        departments: ok(3) || [], members: ok(4) || [],
        trends: ok(5) || [], insights: ok(6) || [],
        growth: ok(7), risk: ok(8),
        headLeaders: ok(9) || [], workload: ok(10) || [],
        sectionComparison: ok(11) || [], yearOverYear: ok(12) || [],
        dayPatterns: ok(13) || [],
        finance: ok(14) || null,
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
              <h2 className="text-xl font-bold">Executive Analytics</h2>
              <p className="text-white/80 text-sm">Church intelligence dashboard with charts</p>
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
      {tab === 'finance' && <FinanceTab data={data} />}
      {tab === 'sections' && <SectionsTab data={data} />}
      {tab === 'leaders' && <LeadersTab data={data} />}
      {tab === 'departments' && <DepartmentsTab data={data} />}
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'trends' && <TrendsTab data={data} />}
      {tab === 'insights' && <InsightsTab data={data} />}
      {tab === 'health' && <HealthTab data={data} />}
      {tab === 'risk' && <RiskTab data={data} />}
    </div>
  );
};

const ExecutiveTab = ({ data }) => {
  const ex = data.executive || {};
  const rate = Number(ex.attendance_rate) || 0;
  const sc = data.sectionComparison || [];
  const yoy = data.yearOverYear || [];
  const chartData = sc.slice(0, 10).map(s => ({ name: s.name?.length > 10 ? s.name.slice(0, 10) + '…' : s.name, rate: R(s.attendance_rate), members: s.member_count || 0 }));
  const yoyData = yoy.map(y => ({ month: y.month_name, current: R(y.current_rate), previous: R(y.previous_rate) }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard label="Total Members" value={ex.total_members || 0} color="indigo" />
        <KpiCard label="Present" value={ex.present_today || 0} prev={ex.present_prev} color="emerald" />
        <KpiCard label="Absent" value={ex.absent_today || 0} prev={ex.absent_prev} color="rose" />
        <KpiCard label="Attendance Rate" value={rate} suffix="%" color="indigo" />
        <KpiCard label="Weekly Growth" value={ex.weekly_growth || 0} suffix="%" color="emerald" />
        <KpiCard label="Monthly Growth" value={ex.monthly_growth || 0} suffix="%" color="blue" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Annual Growth" value={ex.annual_growth || 0} suffix="%" color="violet" />
        <KpiCard label="Visitors (Week)" value={ex.visitors_this_week || 0} color="pink" />
        <KpiCard label="Visitors (Month)" value={ex.visitors_this_month || 0} color="pink" />
        <KpiCard label="Excused" value={ex.excused_today || 0} color="amber" />
      </div>
      {chartData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Section Attendance Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {yoyData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Year-over-Year Attendance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yoyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, '']} />
              <Legend />
              <Bar dataKey="current" name="Current Year" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="previous" name="Previous Year" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const SectionsTab = ({ data }) => {
  const s = data.sections || [];
  const sc = data.sectionComparison || [];
  const items = sc.length > 0 ? sc : s;
  const chartData = items.slice(0, 10).map(sec => ({ name: sec.name?.length > 12 ? sec.name.slice(0, 12) + '…' : sec.name, rate: R(sec.attendance_rate), members: sec.member_count || 0, present: sec.total_present || 0 }));
  return (
    <div className="space-y-6">
      {s.slice(0, 4).map((sec, i) => (
        <div key={sec.id} className={`rounded-2xl border bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm ${i === 0 ? 'border-emerald-300' : 'border-slate-200/70'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">#{i + 1} {sec.name}</span>
              {i === 0 && <Award className="w-4 h-4 text-amber-500 inline ml-1" />}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div><span className="text-slate-400">Rate:</span> <b className="text-slate-900 dark:text-white">{R(sec.attendance_rate)}%</b></div>
            <div><span className="text-slate-400">Members:</span> <b className="text-slate-900">{sec.member_count}</b></div>
            <div><span className="text-slate-400">New:</span> <b className="text-emerald-600">+{sec.new_members || 0}</b></div>
          </div>
        </div>
      ))}
      {chartData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Section Performance Chart</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {items.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Rankings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Rank','Section','Members','Present','Absent','Rate','Status'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['Rank','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((sec, i) => (
                  <tr key={sec.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2 px-3 font-bold text-xs" style={{ color: C[i % C.length] }}>#{i + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{sec.name}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{sec.member_count || 0}</td>
                    <td className="py-2 px-3 text-right text-emerald-600 font-medium">{sec.total_present?.toLocaleString() || 0}</td>
                    <td className="py-2 px-3 text-right text-rose-500">{sec.total_absent?.toLocaleString() || 0}</td>
                    <td className="py-2 px-3 text-right font-bold">{R(sec.attendance_rate)}%</td>
                    <td className="py-2 px-3 text-right">
                      <Badge variant={sec.attendance_rate >= 75 ? 'success' : sec.attendance_rate >= 50 ? 'warning' : 'danger'}>
                        {sec.attendance_rate >= 75 ? 'Strong' : sec.attendance_rate >= 50 ? 'Average' : 'Weak'}
                      </Badge>
                    </td>
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

const LeadersTab = ({ data }) => {
  const leaders = data.leaders || [];
  const headLeaders = data.headLeaders || [];
  const workload = data.workload || [];
  const leaderChart = leaders.slice(0, 10).map(l => ({ name: l.leader_name?.length > 12 ? l.leader_name.slice(0, 12) + '…' : l.leader_name, rate: R(l.attendance_rate), score: l.efficiency_score || 0 }));
  return (
    <div className="space-y-6">
      {headLeaders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {headLeaders.map(hl => (
            <div key={hl.leader_id} className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">{hl.leader_name?.charAt(0)}</div>
                <div><p className="font-semibold text-slate-900 dark:text-white">{hl.leader_name}</p><p className="text-xs text-slate-500">{hl.section_name} Head Leader</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Members', v: hl.members_managed },
                  { l: 'Leaders Supervised', v: hl.leaders_supervised },
                  { l: 'Attendance', v: `${R(hl.overall_attendance)}%` },
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
      {leaderChart.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Leader Performance</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={leaderChart} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                {leaderChart.map((entry, i) => <Cell key={i} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {leaders.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leader Rankings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['#','Leader','Section','Members','Rate','Submissions','Score'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['#','Leader','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaders.slice(0, 15).map((l, i) => (
                  <tr key={l.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{l.leader_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{l.section_name}</td>
                    <td className="py-2.5 px-3 text-right">{l.assigned_members}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{R(l.attendance_rate)}%</td>
                    <td className="py-2.5 px-3 text-right">{l.submission_count}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant={l.efficiency_score >= 75 ? 'success' : l.efficiency_score >= 50 ? 'warning' : 'danger'}>{l.efficiency_score}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {workload.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leader Workload</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Leader','Section','Assigned','Present','Follow-ups','Completed'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['Leader','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workload.slice(0, 15).map(w => (
                  <tr key={w.leader_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{w.leader_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{w.section_name}</td>
                    <td className="py-2.5 px-3 text-right">{w.assigned_members}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{w.members_present}</td>
                    <td className="py-2.5 px-3 text-right text-amber-600">{w.pending_followups}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{w.completed_followups}</td>
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

const DepartmentsTab = ({ data }) => {
  const depts = data.departments || [];
  const chartData = depts.map(d => ({ name: d.name?.length > 12 ? d.name.slice(0, 12) + '…' : d.name, rate: R(d.attendance_rate), members: d.member_count || 0 }));
  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Department Attendance Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.rate >= 75 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {depts.length > 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Department Rankings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['#','Department','Members','Present','Absent','Rate','Status'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['#','Department'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depts.map((d, i) => (
                  <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-bold text-xs" style={{ color: C[i % C.length] }}>#{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{d.name}</td>
                    <td className="py-2.5 px-3 text-right">{d.member_count || 0}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{d.total_present?.toLocaleString() || 0}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500">{d.total_absent?.toLocaleString() || 0}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{R(d.attendance_rate)}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant={d.attendance_rate >= 75 ? 'success' : d.attendance_rate >= 50 ? 'warning' : 'danger'}>
                        {d.attendance_rate >= 75 ? 'Strong' : d.attendance_rate >= 50 ? 'Average' : 'Needs Attention'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-10 text-center text-slate-400">No department data available</div>
      )}
    </div>
  );
};

const MembersTab = ({ data }) => {
  const members = data.members || [];
  const risk = data.risk || {};
  const riskSummary = risk.summary || {};
  const pieData = [
    { name: 'Highly Active', value: riskSummary.highly_active || 0, color: '#10b981' },
    { name: 'Active', value: riskSummary.active || 0, color: '#06b6d4' },
    { name: 'Moderate', value: riskSummary.moderately_active || 0, color: '#f59e0b' },
    { name: 'At Risk', value: riskSummary.at_risk || 0, color: '#f97316' },
    { name: 'Critical', value: riskSummary.critical || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);
  return (
    <div className="space-y-6">
      {riskSummary && Object.keys(riskSummary).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Highly Active" value={riskSummary.highly_active || 0} color="emerald" />
          <KpiCard label="Active" value={riskSummary.active || 0} color="sky" />
          <KpiCard label="Moderate" value={riskSummary.moderately_active || 0} color="amber" />
          <KpiCard label="At Risk" value={riskSummary.at_risk || 0} color="orange" />
          <KpiCard label="Critical" value={riskSummary.critical || 0} color="rose" />
        </div>
      )}
      {pieData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Member Activity Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {members.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Attendance Intelligence</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Member','Section','Registered','Present','Absent','Rate','Last Seen'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['Member','Section','Registered'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 50).map(m => (
                  <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{m.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{m.section_name}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{m.registered_date ? fdate(m.registered_date) : '—'}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{m.present_count ?? m.times_present}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500">{m.absent_count ?? m.times_absent}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{R(m.attendance_rate)}%</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-xs">{m.last_attendance_date ? fdate(m.last_attendance_date) : 'Never'}</td>
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
  const trendChart = trends.slice(-60).map(t => ({ date: t.date?.slice(5) || t.date, rate: R(t.daily_rate), ma4: R(t.ma_4week), ma8: R(t.ma_8week) }));
  const patternChart = patterns.map(p => ({ day: p.day_name?.slice(0, 3), rate: R(p.avg_rate), present: p.total_present || 0 }));
  return (
    <div className="space-y-6">
      {trendChart.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Attendance Trend with Moving Averages</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={trendChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, '']} />
              <Legend />
              <Area type="monotone" dataKey="rate" name="Daily Rate" stroke="#6366f1" fill="#6366f133" strokeWidth={1.5} />
              <Line type="monotone" dataKey="ma4" name="4-Week MA" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ma8" name="8-Week MA" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {patternChart.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Day of Week Attendance Patterns</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={patternChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
              <Bar dataKey="rate" name="Avg Rate" radius={[6, 6, 0, 0]}>
                {patternChart.map((entry, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {trends.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance Trend Data</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Date','Rate','4-Week MA','8-Week MA','Status'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trends.slice(-90).reverse().map((t, i) => {
                  const ma4 = t.ma_4week || 0;
                  const ma8 = t.ma_8week || 0;
                  const trend = ma4 > ma8 ? 'Improving' : ma4 < ma8 ? 'Declining' : 'Stable';
                  return (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-left font-medium text-slate-900 dark:text-white">{fdate(t.date)}</td>
                      <td className="py-2 px-3 text-right font-bold">{R(t.daily_rate)}%</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{R(ma4)}%</td>
                      <td className="py-2 px-3 text-right text-amber-600">{R(ma8)}%</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={trend === 'Improving' ? 'success' : trend === 'Declining' ? 'danger' : 'default'}>{trend}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const InsightsTab = ({ data }) => {
  const insights = data.insights || [];
  const icons = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: TrendingUp };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Executive Insights</h3>
      {insights.length === 0 && <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-10 text-center text-slate-400">No insights available</div>}
      {insights.map((ins, i) => {
        const Icon = icons[ins.type] || Info;
        return (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
  const healthData = [
    { name: 'Index', value: gi },
    { name: 'Remaining', value: Math.max(0, 100 - gi) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Church Growth Index" value={gi} suffix="/100" color={gi >= 75 ? 'emerald' : gi >= 50 ? 'amber' : 'rose'} />
        <KpiCard label="Active Members" value={growth.current_active || 0} prev={growth.previous_active} color="indigo" />
        <KpiCard label="Current Rate" value={growth.current_rate || 0} suffix="%" color="emerald" />
        <KpiCard label="Rate Change" value={(growth.rate_change || 0) >= 0 ? `+${growth.rate_change || 0}` : growth.rate_change || 0} suffix="%" color={growth.rate_change >= 0 ? 'emerald' : 'rose'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Souls Won (90d)" value={growth.souls_won_90d || 0} color="violet" />
        <KpiCard label="Souls Won (Year)" value={growth.souls_won_year || 0} color="pink" />
        <KpiCard label="Status" value={gi >= 75 ? 'Healthy' : gi >= 50 ? 'Needs Improvement' : 'Critical'} color={gi >= 75 ? 'emerald' : gi >= 50 ? 'amber' : 'rose'} />
      </div>
      {gi > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Church Health Index</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={healthData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} startAngle={90} endAngle={-270} paddingAngle={0} dataKey="value">
                <Cell fill={gi >= 75 ? '#10b981' : gi >= 50 ? '#f59e0b' : '#ef4444'} />
                <Cell fill="#e2e8f0" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-2xl font-bold text-slate-900 dark:text-white mt-2">{gi}/100</p>
          <p className="text-center text-xs text-slate-400">Overall Growth Index</p>
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
  const pieData = [
    { name: 'Highly Active', value: summary.highly_active || 0, color: '#10b981' },
    { name: 'Active', value: summary.active || 0, color: '#06b6d4' },
    { name: 'Moderate', value: summary.moderately_active || 0, color: '#f59e0b' },
    { name: 'At Risk', value: summary.at_risk || 0, color: '#f97316' },
    { name: 'Critical', value: summary.critical || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);
  return (
    <div className="space-y-6">
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Highly Active" value={summary.highly_active || 0} color="emerald" />
          <KpiCard label="Active" value={summary.active || 0} color="sky" />
          <KpiCard label="Moderate" value={summary.moderately_active || 0} color="amber" />
          <KpiCard label="At Risk" value={summary.at_risk || 0} color="orange" />
          <KpiCard label="Critical" value={summary.critical || 0} color="rose" />
        </div>
      )}
      {pieData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {consecutive.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />Consecutive Absentees (3+ weeks)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Member','Section','Leader','Absences'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consecutive.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/10">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{c.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{c.section_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{c.leader_name}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600">{c.consecutive_absences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pastoral Visitation List</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-4">
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

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const FinanceTab = ({ data }) => {
  const fd = data.finance || {};
  const summary = fd.summary || {};
  const monthly = (fd.monthly || []).map(m => ({
    name: MONTH_NAMES[Number(m.month) - 1] || m.month,
    Income: R(m.income),
    Tithes: R(m.tithes),
    Usable: R(m.usable),
    Mission: R(m.mission),
    Bishop: R(m.bishop),
  }));
  const expenses = fd.expenses || [];
  const statusBreakdown = fd.statusBreakdown || [];

  const totalIncome = Number(summary.total_income) || 0;
  const totalTithes = Number(summary.total_tithes) || 0;
  const totalUsable = Number(summary.total_usable_funds) || 0;
  const totalExpenses = Number(summary.total_expenses) || 0;
  const totalMission = Number(summary.mission_fund) || 0;
  const totalBishop = Number(summary.bishop_fund) || 0;

  const fmtK = v => {
    const n = Number(v) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  };
  const fmt = v => `TZS ${(Number(v) || 0).toLocaleString()}`;

  const noData = !data.finance;

  return (
    <div className="space-y-6">
      {/* Finance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Income', value: totalIncome, color: 'indigo', icon: DollarSign },
          { label: 'Total Tithes', value: totalTithes, color: 'violet', icon: HandCoins },
          { label: 'Mission Fund', value: totalMission, color: 'emerald', icon: TrendingUp },
          { label: 'Bishop Fund', value: totalBishop, color: 'sky', icon: Wallet },
          { label: 'Total Expenses', value: totalExpenses, color: 'rose', icon: TrendingDown },
          { label: 'Usable Funds', value: totalUsable, color: 'amber', icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 text-${color}-600`} />
              </div>
              <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">TZS {fmtK(value)}</p>
          </div>
        ))}
      </div>

      {noData && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 p-6 text-center">
          <DollarSign className="w-10 h-10 mx-auto mb-2 text-amber-400" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">No finance data available yet</p>
          <p className="text-xs text-amber-500 mt-1">Finance records will appear here once submitted and approved</p>
        </div>
      )}

      {monthly.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Monthly Income Breakdown ({fd.year})
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="fIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fTithes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fUsable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} width={55} />
              <Tooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              <Area type="monotone" dataKey="Income" stroke="#6366f1" fill="url(#fIncome)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Tithes" stroke="#8b5cf6" fill="url(#fTithes)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Usable" stroke="#10b981" fill="url(#fUsable)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {expenses.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              Expense Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenses} dataKey="total" nameKey="category"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {expenses.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-500" />
            Fund Allocation Summary
          </h3>
          {[
            { label: 'Total Income', value: totalIncome, color: 'indigo', pct: 100 },
            { label: 'Tithes Collected', value: totalTithes, color: 'violet', pct: totalIncome ? Math.round((totalTithes / totalIncome) * 100) : 0 },
            { label: 'Mission Fund (10%)', value: totalMission, color: 'emerald', pct: totalIncome ? Math.round((totalMission / totalIncome) * 100) : 0 },
            { label: 'Bishop Fund', value: totalBishop, color: 'sky', pct: totalIncome ? Math.round((totalBishop / totalIncome) * 100) : 0 },
            { label: 'Church Expenses', value: totalExpenses, color: 'rose', pct: totalIncome ? Math.round((totalExpenses / totalIncome) * 100) : 0 },
            { label: 'Net Usable', value: totalUsable, color: 'amber', pct: totalIncome ? Math.round((totalUsable / totalIncome) * 100) : 0 },
          ].map(({ label, value, color, pct }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
                <span className="font-bold text-slate-900 dark:text-white">TZS {fmtK(value)} <span className="text-slate-400 font-normal">({pct}%)</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            Mission & Bishop Fund Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} width={55} />
              <Tooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              <Bar dataKey="Mission" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Bishop" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {statusBreakdown.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Record Status Breakdown ({fd.year})</h3>
          <div className="flex flex-wrap gap-3">
            {statusBreakdown.map(s => {
              const colors = { draft: 'slate', submitted: 'amber', approved: 'emerald', rejected: 'rose' };
              const c = colors[s.status] || 'slate';
              return (
                <div key={s.status} className={`flex-1 min-w-[100px] rounded-xl bg-${c}-50 dark:bg-${c}-900/20 border border-${c}-200 dark:border-${c}-700 p-3 text-center`}>
                  <p className={`text-2xl font-bold text-${c}-700 dark:text-${c}-300`}>{s.count}</p>
                  <p className={`text-[10px] font-semibold capitalize text-${c}-600`}>{s.status}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;
