import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Building2, Heart,
  Shield, Brain, Layers, UserCheck, Award, PieChart as PieChartIcon,
  ArrowUp, ArrowDown, Minus, CheckCircle2, XCircle, TrendingDown,
  Download, Printer, FileText, Eye, Info, Star, UserX, Clock, Target
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';

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
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }[variant] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v}`}>{children}</span>;
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
      ]);
      const ok = i => r[i].status === 'fulfilled' ? r[i].value.data : null;
      setData({
        executive: ok(0), sections: ok(1) || [], leaders: ok(2) || [],
        departments: ok(3) || [], members: ok(4) || [],
        trends: ok(5) || [], insights: ok(6) || [],
        growth: ok(7), risk: ok(8),
        headLeaders: ok(9) || [], workload: ok(10) || [],
        sectionComparison: ok(11) || [], yearOverYear: ok(12) || [],
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
              <p className="text-white/80 text-sm">Numerical church intelligence dashboard</p>
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
    </div>
  );
};

const ExecutiveTab = ({ data }) => {
  const ex = data.executive || {};
  const rate = Number(ex.attendance_rate) || 0;
  const sc = data.sectionComparison || [];
  const yoy = data.yearOverYear || [];
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
      {sc.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Section','Members','Present','Absent','Rate','Status'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sc.slice(0, 10).map((s, i) => (
                  <tr key={s.id || i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                    <td className="py-2 px-3 text-right">{s.member_count || 0}</td>
                    <td className="py-2 px-3 text-right text-emerald-600">{s.total_present || 0}</td>
                    <td className="py-2 px-3 text-right text-rose-500">{s.total_absent || 0}</td>
                    <td className="py-2 px-3 text-right font-bold">{R(s.attendance_rate)}%</td>
                    <td className="py-2 px-3 text-right"><Badge variant={s.attendance_rate >= 75 ? 'success' : s.attendance_rate >= 50 ? 'warning' : 'danger'}>{s.attendance_rate >= 75 ? 'Strong' : s.attendance_rate >= 50 ? 'Average' : 'Weak'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {yoy.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Year-over-Year Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Month','Current Rate','Previous Rate','Difference'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yoy.map((y, i) => {
                  const diff = (y.current_rate || 0) - (y.previous_rate || 0);
                  return (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">{y.month_name}</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-600">{R(y.current_rate)}%</td>
                      <td className="py-2 px-3 text-right text-slate-500">{R(y.previous_rate)}%</td>
                      <td className={`py-2 px-3 text-right font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff >= 0 ? '+' : ''}{R(diff)}%</td>
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

const SectionsTab = ({ data }) => {
  const s = data.sections || [];
  const sc = data.sectionComparison || [];
  const items = sc.length > sc; sc : s;
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
  return (
    <div className="space-y-6">
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
      {members.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Attendance Intelligence</h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Member','Section','Present','Absent','Rate','Last Seen'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${['Member','Section'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 50).map(m => (
                  <tr key={m.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{m.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{m.section_name}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{m.times_present}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500">{m.times_absent}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{R(m.attendance_rate)}%</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-xs">{m.last_attendance || 'Never'}</td>
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
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance Trends</h3>
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
                      <td className="py-2 px-3 text-left font-medium text-slate-900 dark:text-white">{t.date}</td>
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
      {patterns.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Day of Week Patterns</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Day','Avg Rate','Total Present','Total Absent','Services'].map(h => (
                    <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Day' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patterns.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{p.day_name}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{R(p.avg_rate)}%</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{p.total_present || 0}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500">{p.total_absent || 0}</td>
                    <td className="py-2.5 px-3 text-right">{p.service_count || 0}</td>
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

const InsightsTab = ({ data }) => {
  const insights = data.insights || [];
  const icons = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: TrendingUp };
  const colors = { success: 'emerald', warning: 'amber', danger: 'rose', info: 'indigo' };
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Executive Insights</h3>
      {insights.length === 0 && <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-10 text-center text-slate-400">No insights available</div>}
      {insights.map((ins, i) => {
        const Icon = icons[ins.type] || Info;
        const c = colors[ins.type] || 'slate';
        return (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
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
          <KpiCard label="Highly Active" value={summary.highly_active || 0} color="emerald" />
          <KpiCard label="Active" value={summary.active || 0} color="sky" />
          <KpiCard label="Moderate" value={summary.moderately_active || 0} color="amber" />
          <KpiCard label="At Risk" value={summary.at_risk || 0} color="orange" />
          <KpiCard label="Critical" value={summary.critical || 0} color="rose" />
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

export default AnalyticsView;
