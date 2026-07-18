import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Users, ShieldCheck, Layers, Heart, UserCheck, UserPlus,
  MessageSquare, Send, Smartphone, CalendarDays, Bell, Printer, Trophy,
  AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles, Church,
  Home, Building2, Star, Award, Zap, Clock, Database, RefreshCw,
  ArrowUpRight, ChevronDown, ChevronRight, Calendar, Gift, Crown, Target,
  UserX,
} from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import { STATUS, statusForScore, TrendIcon, R as Rn } from './ReportShared';

const R = (v) => Math.round(Number(v) || 0);
const pct = (v) => `${R(Number(v || 0) * 10) / 10}%`;
const num = (v) => Number(v || 0).toLocaleString();
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return '—'; } };
const asArray = (v) => Array.isArray(v) ? v : [];

const INSUFFICIENT = 'Insufficient Data';

// Small pill that shows a status color
const StatusPill = ({ status, label }) => {
  const s = STATUS[status] || STATUS.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {label || s.label}
    </span>
  );
};

// Compact Church Pulse indicator
const PulseItem = ({ icon: Icon, label, value, status, to, navigate }) => {
  const s = STATUS[status] || STATUS.neutral;
  const inner = (
    <>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1" style={{ background: `${s.color}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
      </div>
      <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">{value}</span>
      <span className="text-[9px] text-slate-400 mt-1 text-center leading-tight">{label}</span>
    </>
  );
  if (to && navigate) {
    return (
      <button type="button" onClick={() => navigate(to)}
        className="relative flex flex-col items-center justify-center px-2 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 min-w-[88px] hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all cursor-pointer group">
        {inner}
        <ArrowUpRight className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1" />
      </button>
    );
  }
  return (
    <div className="relative flex flex-col items-center justify-center px-2 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 min-w-[88px]">
      {inner}
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children, action, to, navigate }) => {
  const viewBtn = to && navigate ? (
    <button type="button" onClick={() => navigate(to)}
      className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
      View <ArrowUpRight className="w-3 h-3" />
    </button>
  ) : null;
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Icon className="w-4 h-4 text-slate-400" /> {title}
        </h3>
        <div className="flex items-center gap-3">{action}{viewBtn}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

// Clickable list row wrapper. Renders children inside a button when `to` is set.
const Row = ({ to, navigate, children, className = '', ...rest }) => {
  if (to && navigate) {
    return (
      <button type="button" onClick={() => navigate(to)}
        className={`group w-full text-left flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer ${className}`}
        {...rest}>
        {children}
      </button>
    );
  }
  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/30 ${className}`} {...rest}>
      {children}
    </div>
  );
};

const Metric = ({ label, value, sub, status, trend }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
    <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</span>
    {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
    {status && <div className="mt-1"><StatusPill status={status} /></div>}
    {trend != null && trend !== 0 && (
      <span className={`text-[10px] font-semibold mt-0.5 ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}
      </span>
    )}
  </div>
);

const InsufficientData = () => (
  <span className="text-xs italic text-slate-400">{INSUFFICIENT}</span>
);

const ExecutiveCommandCenter = (props) => {
  const navigate = useNavigate();
  const {
    allMembers = [], sections = [], leaders = [], serviceTypes = [],
    selectedServiceId, onServiceChange, pastorName = 'Pastor',
  } = props;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  const [homeCells, setHomeCells] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [hallOfFame, setHallOfFame] = useState(null);
  const [backup, setBackup] = useState(null);
  const [health, setHealth] = useState(null);
  const [notifCount, setNotifCount] = useState(0);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [sumRes, compRes, aiRes, cellRes, deptRes, bdayRes, alertRes, auditRes, perfRes, backupRes, healthRes, notifRes] = await Promise.allSettled([
        analyticsAPI.getExecutiveSummary(90),
        analyticsAPI.getExecutiveComparison({ periods: buildPeriods('month', 6), mode: 'overall' }),
        analyticsAPI.getAIInsights(),
        adminAPI.getHomeCells(),
        adminAPI.getDepartments(),
        adminAPI.getUpcomingBirthdays(30),
        adminAPI.getConsecutiveAbsences(),
        adminAPI.getAuditLog({ limit: 12 }),
        adminAPI.getPerformanceDashboard('month', selectedServiceId, null),
        adminAPI.getBackupStatus(),
        adminAPI.getHealth(),
        adminAPI.getUnreadNotificationCount(),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (compRes.status === 'fulfilled') setComparison(compRes.value.data);
      if (aiRes.status === 'fulfilled') setAiInsights(asArray(aiRes.value.data));
      if (cellRes.status === 'fulfilled') setHomeCells(asArray(cellRes.value.data));
      if (deptRes.status === 'fulfilled') setDepartments(asArray(deptRes.value.data?.departments ?? deptRes.value.data));
      if (bdayRes.status === 'fulfilled') setBirthdays(asArray(bdayRes.value.data));
      if (alertRes.status === 'fulfilled') setAlerts(asArray(alertRes.value.data));
      if (auditRes.status === 'fulfilled') setAudit(asArray(auditRes.value.data));
      if (perfRes.status === 'fulfilled') setHallOfFame(perfRes.value.data);
      if (backupRes.status === 'fulfilled') setBackup(backupRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (notifRes.status === 'fulfilled') setNotifCount(notifRes.value.data?.count || 0);
    } catch (e) {
      setErr(e.message || 'Failed to load command center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kpis = summary?.kpis || {};
  const snap = summary?.snapshot || {};
  const churchScore = kpis.churchHealthScore;
  const scoreStatus = churchScore?.current >= 85 ? 'excellent'
    : churchScore?.current >= 70 ? 'good'
    : churchScore?.current >= 50 ? 'watch'
    : churchScore?.current >= 30 ? 'attention' : 'critical';

  const scoreColor = (STATUS[scoreStatus] || STATUS.neutral).color;

  // Best/worst attendance rate across comparison periods
  const compRates = asArray(comparison?.periods).map(p => Number(p?.overall?.attendance_rate) || 0).filter(r => r > 0);
  const compBest = compRates.length ? Math.max(...compRates) : null;
  const compWorst = compRates.length ? Math.min(...compRates) : null;

  // Total members across all departments (proxy for "serving")
  const deptMemberTotal = asArray(departments).reduce((sum, d) => sum + (Number(d.member_count) || Number(d.memberCount) || 0), 0);

  // Pending submissions = total leaders - leaders who submitted this period
  const totalLeaders = Number(snap.attendance?.totalLeaders) || 0;
  const leadersSubmitted = Number(snap.attendance?.leadersSubmitted) || 0;
  const pendingSubs = totalLeaders > 0 ? totalLeaders - leadersSubmitted : null;

  // Church Pulse derived indicators
  const pulse = [
    { icon: Activity, label: 'Attendance', value: pct(kpis.attendanceRate?.current), status: statusForScore(kpis.attendanceRate?.current || 0), to: '/admin/reports' },
    { icon: ShieldCheck, label: 'Leadership', value: pct(kpis.leaderPerfIndex?.current), status: statusForScore(kpis.leaderPerfIndex?.current || 0), to: '/admin/leaders' },
    { icon: Layers, label: 'Sections', value: pct(kpis.sectionPerfIndex?.current), status: statusForScore(kpis.sectionPerfIndex?.current || 0), to: '/admin/sections' },
    { icon: UserCheck, label: 'Retention', value: pct(kpis.retentionRate?.current), status: statusForScore(kpis.retentionRate?.current || 0), to: '/admin/analytics' },
    { icon: Send, label: 'Visitor FU', value: pct(kpis.visitorConversion?.current), status: statusForScore(kpis.visitorConversion?.current || 0), to: '/admin/follow-ups' },
    { icon: Sparkles, label: 'Engagement', value: pct(kpis.engagementScore?.current), status: statusForScore(kpis.engagementScore?.current || 0), to: '/admin/analytics' },
    { icon: Home, label: 'Home Cells', value: homeCells.length ? `${homeCells.length}` : '—', status: homeCells.length ? 'good' : 'neutral', to: '/admin/home-cells' },
    { icon: Building2, label: 'Ministry', value: departments.length ? `${departments.length}` : '—', status: departments.length ? 'good' : 'neutral', to: '/admin/departments' },
    { icon: Gift, label: 'Contrib.', value: kpis.contributionsIndex?.current != null ? pct(kpis.contributionsIndex.current) : '—', status: kpis.contributionsIndex?.current != null ? statusForScore(kpis.contributionsIndex.current) : 'neutral', to: '/admin/contributions' },
  ];

  const actionButtons = [
    { label: 'Record Attendance', icon: Activity, to: '/admin/reports' },
    { label: 'Register Visitor', icon: UserPlus, to: '/admin/new-members' },
    { label: 'Add Member', icon: Users, to: '/admin/members' },
    { label: 'Schedule Follow-up', icon: CalendarDays, to: '/admin/follow-ups' },
    { label: 'Create Announcement', icon: Bell, to: '/admin/announcements' },
    { label: 'Print Reports', icon: Printer, to: '/admin/reports' },
    { label: 'Send SMS', icon: Send, to: '/admin/announcements' },
    { label: 'Send WhatsApp', icon: Smartphone, to: '/admin/announcements' },
    { label: 'Manage Events', icon: Calendar, to: '/admin/calendar' },
    { label: 'View Hall of Fame', icon: Trophy, to: '/admin/rewards' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 p-6 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{err}</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-medium">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* ── Church Health Score Hero ── */}
      <button type="button" onClick={() => navigate('/admin/reports')}
        className="w-full text-left rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer group">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${scoreColor}15` }}>
              <Heart className="w-7 h-7" style={{ color: scoreColor }} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Church Health Score</span>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-slate-900 dark:text-white">{churchScore ? R(churchScore.current) : '—'}<span className="text-lg font-normal text-slate-400">/100</span></p>
                {churchScore?.diff != null && (
                  <span className={`text-sm font-semibold ${churchScore.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {churchScore.diff >= 0 ? '+' : ''}{R(churchScore.diff)} vs prev
                  </span>
                )}
              </div>
              <div className="mt-1"><StatusPill status={scoreStatus} /></div>
            </div>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <div className="text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{num(snap.church?.totalMembers || allMembers.length)}</p><p className="text-[9px] text-slate-400 uppercase">Members</p></div>
            <div className="text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{num(snap.church?.activeSections || sections.length)}</p><p className="text-[9px] text-slate-400 uppercase">Sections</p></div>
            <div className="text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{num(snap.church?.activeLeaders || leaders.length)}</p><p className="text-[9px] text-slate-400 uppercase">Leaders</p></div>
            <div className="text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{pct(kpis.attendanceRate?.current)}</p><p className="text-[9px] text-slate-400 uppercase">Attendance</p></div>
            {churchScore?.target != null && (
              <div className="text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{R(churchScore.target)}</p><p className="text-[9px] text-slate-400 uppercase">Target</p></div>
            )}
            <ArrowUpRight className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </button>

      {/* ── Church Pulse Row ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {pulse.map((p, i) => <PulseItem key={i} {...p} navigate={navigate} />)}
        </div>
      </div>

      {/* ── Action Center ── */}
      <SectionCard title="Action Center" icon={Target}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {actionButtons.map((a) => (
            <button key={a.label} onClick={() => navigate(a.to)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
              <a.icon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{a.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Critical Alerts & Needs Attention ── */}
      <SectionCard title="Critical Alerts & Needs Attention" icon={AlertTriangle} to="/admin/follow-ups" navigate={navigate}
        action={<span className="text-[10px] font-bold text-rose-600">{asArray(summary?.alerts).length + alerts.length} items</span>}>
        <div className="space-y-2">
          {asArray(summary?.alerts).filter(a => a.priority === 'high' || a.priority === 'medium').slice(0, 6).map((a, i) => (
            <button key={i} type="button" onClick={() => navigate('/admin/follow-ups')}
              className="group w-full text-left flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 hover:ring-1 hover:ring-rose-300 dark:hover:ring-rose-700 transition-all cursor-pointer">
              <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{a.title || a.category}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.message || a.text}</p>
              </div>
              <StatusPill status={a.priority === 'high' ? 'critical' : 'attention'} />
            </button>
          ))}
          {alerts.slice(0, 4).map((a, i) => (
            <button key={`c${i}`} type="button" onClick={() => navigate('/admin/follow-ups')}
              className="group w-full text-left flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 hover:ring-1 hover:ring-amber-300 dark:hover:ring-amber-700 transition-all cursor-pointer">
              <UserX className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{a.full_name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Absent {a.consecutive_absences} consecutive services · {a.section_name}</p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
            </button>
          ))}
          {asArray(summary?.alerts).length === 0 && alerts.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">No critical alerts at this time.</p>
          )}
        </div>
      </SectionCard>

      {/* ── Attendance Intelligence ── */}
      <SectionCard title="Attendance Intelligence" icon={Activity} to="/admin/reports" navigate={navigate}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Metric label="Total Members" value={num(snap.attendance?.totalEligible || allMembers.length)} />
          <Metric label="Present" value={num(snap.attendance?.present)} status="excellent" />
          <Metric label="Absent" value={num(snap.attendance?.absent)} status="critical" />
          <Metric label="Excused" value={num(snap.attendance?.excused)} status="watch" />
          <Metric label="Attendance Rate" value={pct(kpis.attendanceRate?.current)} status={statusForScore(kpis.attendanceRate?.current || 0)} />
          <Metric label="Previous Period" value={pct(kpis.attendanceRate?.previous)} />
          <Metric label="Difference" value={kpis.attendanceRate?.diff != null ? `${kpis.attendanceRate.diff >= 0 ? '+' : ''}${R(kpis.attendanceRate.diff)}%` : INSUFFICIENT} />
          <Metric label="Target" value={churchScore?.target != null ? R(churchScore.target) : INSUFFICIENT} />
          <Metric label="Best Period" value={compBest != null ? pct(compBest) : INSUFFICIENT} status="excellent" />
          <Metric label="Worst Period" value={compWorst != null ? pct(compWorst) : INSUFFICIENT} status="attention" />
          <Metric label="Weekly Avg" value={kpis.weeklyGrowth?.current != null ? pct(kpis.weeklyGrowth.current) : INSUFFICIENT} />
          <Metric label="Monthly Avg" value={kpis.monthlyGrowth?.current != null ? pct(kpis.monthlyGrowth.current) : INSUFFICIENT} />
          <Metric label="Quarterly Avg" value={kpis.quarterlyGrowth?.current != null ? pct(kpis.quarterlyGrowth.current) : INSUFFICIENT} />
          <Metric label="Yearly Avg" value={kpis.yearlyGrowth?.current != null ? pct(kpis.yearlyGrowth.current) : INSUFFICIENT} />
          <Metric label="Historical Avg" value={kpis.attendanceRate?.historicalAvg != null ? pct(kpis.attendanceRate.historicalAvg) : INSUFFICIENT} />
          <Metric label="Best Ever" value={kpis.attendanceRate?.best != null ? pct(kpis.attendanceRate.best) : INSUFFICIENT} status="excellent" />
          <Metric label="Trend" value={comparison?.trends?.trend ? comparison.trends.trend : INSUFFICIENT} />
          <Metric label="Momentum" value={kpis.attendanceMomentum?.current != null ? pct(kpis.attendanceMomentum.current) : INSUFFICIENT} />
          <Metric label="Service Coverage" value={snap.attendance?.serviceDays ? `${snap.attendance.serviceDays} days` : INSUFFICIENT} />
          <Metric label="Avg per Service" value={snap.attendance?.avgPerService != null ? num(snap.attendance.avgPerService) : INSUFFICIENT} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Leadership Intelligence ── */}
        <SectionCard title="Leadership Intelligence" icon={Crown}
          action={<button onClick={() => navigate('/admin/leaders')} className="text-[10px] text-blue-600 font-semibold">View all</button>}>
          <div className="space-y-2">
            {asArray(summary?.leaderRankings).slice(0, 6).map((l, i) => (
              <Row key={l.id || i} to={`/admin/leaders?profile=${l.id || l.leader_id}`} navigate={navigate}>
                <span className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{l.name || l.leader_name}</p>
                  <p className="text-[10px] text-slate-400">{l.section || l.section_name} · {l.members || l.assigned_members} members</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: (l.attendance_rate || l.attendanceRate) >= 75 ? '#10b981' : (l.attendance_rate || l.attendanceRate) >= 50 ? '#f59e0b' : '#ef4444' }}>{R(l.attendance_rate || l.attendanceRate)}%</p>
                  <p className="text-[9px] text-slate-400">sub {R(l.submissionRate ?? l.leader_submission_rate ?? 0)}%</p>
                </div>
              </Row>
            ))}
            {asArray(summary?.leaderRankings).length === 0 && <InsufficientData />}
          </div>
        </SectionCard>

        {/* ── Section Intelligence ── */}
        <SectionCard title="Section Intelligence" icon={Layers}
          action={<button onClick={() => navigate('/admin/sections')} className="text-[10px] text-blue-600 font-semibold">View all</button>}>
          <div className="space-y-2">
            {asArray(summary?.sectionRankings).slice(0, 6).map((s, i) => {
              const st = s.status === 'strong' ? 'excellent' : s.status === 'average' ? 'good' : 'attention';
              return (
                <Row key={s.id || i} to={`/admin/sections?profile=${s.id}`} navigate={navigate}>
                  <span className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.members} members · {s.present} present</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: s.attendanceRate >= 75 ? '#10b981' : s.attendanceRate >= 50 ? '#f59e0b' : '#ef4444' }}>{R(s.attendanceRate)}%</p>
                    <StatusPill status={st} />
                  </div>
                </Row>
              );
            })}
            {asArray(summary?.sectionRankings).length === 0 && <InsufficientData />}
          </div>
        </SectionCard>
      </div>

      {/* ── Member Intelligence ── */}
      <SectionCard title="Member Intelligence" icon={Users} to="/admin/members" navigate={navigate}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Metric label="Active Members" value={num(snap.church?.activeMembers || allMembers.filter(m => m.is_active !== 0).length)} status="good" />
          <Metric label="Inactive Members" value={num(allMembers.filter(m => m.is_active === 0).length)} status="attention" />
          <Metric label="Visitors" value={num(snap.church?.visitors)} />
          <Metric label="Visitors Converted" value={num(snap.church?.visitorsConverted)} status="good" />
          <Metric label="In Departments" value={num(deptMemberTotal)} status={deptMemberTotal > 0 ? 'good' : 'neutral'} />
          <Metric label="Not Serving" value={num(Math.max(0, (snap.church?.activeMembers || allMembers.filter(m => m.is_active !== 0).length) - deptMemberTotal))} status="attention" />
          <Metric label="Need Visitation" value={num(alerts.length)} />
          <Metric label="Missing 2 Weeks" value={num(alerts.filter(a => a.consecutive_absences >= 2).length)} status="attention" />
          <Metric label="Missing 1 Month" value={num(alerts.filter(a => a.consecutive_absences >= 4).length)} status="critical" />
          {(() => {
            const male = allMembers.filter(m => (m.gender || '').toLowerCase().startsWith('m')).length;
            const female = allMembers.filter(m => (m.gender || '').toLowerCase().startsWith('f')).length;
            return <>
              <Metric label="Male" value={num(male)} />
              <Metric label="Female" value={num(female)} />
            </>;
          })()}
          <Metric label="Youth" value={num(allMembers.filter(m => (m.age_group || '').toLowerCase().includes('youth')).length)} />
          <Metric label="Adults" value={num(allMembers.filter(m => (m.age_group || '').toLowerCase().includes('adult')).length)} />
          <Metric label="Children" value={num(allMembers.filter(m => (m.age_group || '').toLowerCase().includes('child')).length)} />
          <Metric label="Attendance Freq" value={pct(kpis.attendanceRate?.current)} sub="proxy: att rate" status={statusForScore(kpis.attendanceRate?.current || 0)} />
          <Metric label="Retention Rate" value={pct(kpis.retentionRate?.current)} status={statusForScore(kpis.retentionRate?.current || 0)} />
        </div>
      </SectionCard>

      {/* ── Growth & Retention Center ── */}
      <SectionCard title="Growth & Retention Center" icon={TrendingUp} to="/admin/analytics" navigate={navigate}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Metric label="Weekly Growth" value={kpis.weeklyGrowth?.current != null ? `${kpis.weeklyGrowth.current >= 0 ? '+' : ''}${R(kpis.weeklyGrowth.current)}%` : INSUFFICIENT} status={kpis.weeklyGrowth?.current >= 0 ? 'good' : 'attention'} />
          <Metric label="New This Month" value={num(snap.church?.newMembers)} status="good" />
          <Metric label="Yearly Growth" value={kpis.yearlyGrowth?.current != null ? `${kpis.yearlyGrowth.current >= 0 ? '+' : ''}${R(kpis.yearlyGrowth.current)}%` : INSUFFICIENT} status={kpis.yearlyGrowth?.current >= 0 ? 'good' : 'attention'} />
          <Metric label="Returning Members" value={num(kpis.returningMembers?.current)} status="good" />
          <Metric label="Members Contacted" value={num(snap.church?.membersContacted)} />
          <Metric label="Members Lost" value={num(snap.church?.membersLost)} status="critical" />
          <Metric label="Net Growth" value={num(snap.church?.netGrowth)} status={snap.church?.netGrowth >= 0 ? 'good' : 'critical'} />
          <Metric label="Retention %" value={pct(kpis.retentionRate?.current)} status={statusForScore(kpis.retentionRate?.current || 0)} />
          <Metric label="Visitor Conv." value={pct(kpis.visitorConversion?.current)} status={statusForScore(kpis.visitorConversion?.current || 0)} />
          <Metric label="Follow-up Done" value={pct(kpis.followUpCompletion?.current)} status={statusForScore(kpis.followUpCompletion?.current || 0)} />
          <Metric label="Ministry Health" value={kpis.ministryHealth?.current != null ? R(kpis.ministryHealth.current) : INSUFFICIENT} status={statusForScore(kpis.ministryHealth?.current || 0)} />
          <Metric label="Goal Achiev." value={pct(kpis.goalAchievement?.current)} status={statusForScore(kpis.goalAchievement?.current || 0)} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Home Cell Intelligence ── */}
        <SectionCard title="Home Cell Intelligence" icon={Home}
          action={<button onClick={() => navigate('/admin/home-cells')} className="text-[10px] text-blue-600 font-semibold">View all</button>}>
          <div className="space-y-2">
            {homeCells.slice(0, 5).map((c, i) => {
              const members = c.member_count || (c.members ? c.members.length : 0);
              return (
                <Row key={c.id || i} to="/admin/home-cells" navigate={navigate}>
                  <Home className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{members} members</p>
                  </div>
                  <StatusPill status={members > 10 ? 'good' : members > 5 ? 'watch' : 'attention'} />
                </Row>
              );
            })}
            {homeCells.length === 0 && <InsufficientData />}
          </div>
        </SectionCard>

        {/* ── Department Performance ── */}
        <SectionCard title="Department Performance" icon={Building2}
          action={<button onClick={() => navigate('/admin/departments')} className="text-[10px] text-blue-600 font-semibold">View all</button>}>
          <div className="space-y-2">
            {departments.slice(0, 5).map((d, i) => (
              <Row key={d.id || i} to="/admin/departments" navigate={navigate}>
                <Building2 className="w-4 h-4 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{d.name}</p>
                  <p className="text-[10px] text-slate-400">{d.member_count || 0} members</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: (d.attendance_rate || 0) >= 75 ? '#10b981' : (d.attendance_rate || 0) >= 50 ? '#f59e0b' : '#ef4444' }}>{R(d.attendance_rate || 0)}%</p>
                </div>
              </Row>
            ))}
            {departments.length === 0 && <InsufficientData />}
          </div>
        </SectionCard>
      </div>

      {/* ── Upcoming Activities & Calendar ── */}
      <SectionCard title="Upcoming Activities & Calendar" icon={CalendarDays} to="/admin/calendar" navigate={navigate}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Next 30 Days Birthdays</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {birthdays.slice(0, 8).map((b) => (
                <button key={b.id} type="button" onClick={() => navigate('/admin/birthdays')}
                  className="group w-full text-left flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                  <Gift className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs text-slate-700 dark:text-slate-200 flex-1">{b.full_name}</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(b.date_of_birth)}</span>
                </button>
              ))}
              {birthdays.length === 0 && <InsufficientData />}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Anniversaries</p>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-center">
              <InsufficientData />
              <p className="text-[10px] text-slate-400 mt-1">Marriage anniversaries are not tracked in the current database.</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Recent Activity Feed ── */}
      <SectionCard title="Recent Activity" icon={Clock} to="/admin/audit" navigate={navigate}>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {audit.slice(0, 12).map((a, i) => (
            <button key={a.id || i} type="button" onClick={() => navigate('/admin/audit')}
              className="group w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{a.action || a.description || a.entity || 'System activity'}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(a.created_at || a.timestamp)}</span>
            </button>
          ))}
          {audit.length === 0 && <InsufficientData />}
        </div>
      </SectionCard>

      {/* ── Hall of Fame Preview ── */}
      {hallOfFame && (
        <SectionCard title="Hall of Fame" icon={Trophy}
          action={<button onClick={() => navigate('/admin/rewards')} className="text-[10px] text-blue-600 font-semibold">View all</button>}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {hallOfFame.kpis?.topMember && (
              <button type="button" onClick={() => navigate('/admin/members')}
                className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                <Crown className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[9px] uppercase text-slate-400">Top Member</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hallOfFame.kpis.topMember.name}</p>
                <p className="text-[10px] text-slate-400">{R(hallOfFame.kpis.topMember.score)}</p>
              </button>
            )}
            {hallOfFame.kpis?.topLeader && (
              <button type="button" onClick={() => navigate('/admin/leaders')}
                className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                <Award className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[9px] uppercase text-slate-400">Top Leader</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hallOfFame.kpis.topLeader.name}</p>
                <p className="text-[10px] text-slate-400">{R(hallOfFame.kpis.topLeader.score)}</p>
              </button>
            )}
            {hallOfFame.kpis?.bestCell && (
              <button type="button" onClick={() => navigate('/admin/home-cells')}
                className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                <Home className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[9px] uppercase text-slate-400">Top Cell</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hallOfFame.kpis.bestCell.name}</p>
              </button>
            )}
            {hallOfFame.kpis?.bestAttendanceSection && (
              <button type="button" onClick={() => navigate(`/admin/sections?profile=${hallOfFame.kpis.bestAttendanceSection.id || ''}`)}
                className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                <Layers className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[9px] uppercase text-slate-400">Top Section</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hallOfFame.kpis.bestAttendanceSection.name}</p>
              </button>
            )}
            {hallOfFame.kpis?.bestEvangelist && (
              <button type="button" onClick={() => navigate('/admin/evangelism')}
                className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all cursor-pointer">
                <Send className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-[9px] uppercase text-slate-400">Top Evangelist</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hallOfFame.kpis.bestEvangelist.full_name}</p>
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── AI Executive Summary ── */}
      <SectionCard title="AI Executive Summary" icon={Sparkles}>
        <div className="space-y-2">
          {aiInsights.slice(0, 5).map((ins, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                ins.type === 'success' ? 'bg-emerald-500' : ins.type === 'warning' ? 'bg-amber-500' : ins.type === 'danger' ? 'bg-rose-500' : 'bg-blue-500'
              }`} />
              <p className="text-xs text-slate-600 dark:text-slate-300">{ins.text}</p>
            </div>
          ))}
          {asArray(summary?.recommendations).slice(0, 3).map((r, i) => (
            <div key={`r${i}`} className="flex items-start gap-2">
              <Zap className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold">Recommend:</span> {r.recommendation}</p>
            </div>
          ))}
          {aiInsights.length === 0 && asArray(summary?.recommendations).length === 0 && <InsufficientData />}
        </div>
      </SectionCard>

      {/* ── System Health ── */}
      <SectionCard title="System Health" icon={Database} to="/admin/settings" navigate={navigate}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Database" value={health?.database?.status === 'connected' ? 'Online' : (health?.database?.status || INSUFFICIENT)} status={health?.database?.status === 'connected' ? 'excellent' : 'critical'} />
          <Metric label="Last Backup" value={backup?.last_backup_at ? fmtDate(backup.last_backup_at) : INSUFFICIENT} status={backup?.warning ? 'attention' : 'good'} />
          <Metric label="Sync Status" value={health?.status === 'ok' ? 'Synced' : (health?.status || INSUFFICIENT)} status={health?.status === 'ok' ? 'excellent' : 'watch'} />
          <Metric label="Pending Subs" value={pendingSubs != null ? num(pendingSubs) : INSUFFICIENT} status={pendingSubs > 0 ? 'attention' : 'good'} />
          <Metric label="Notifications" value={num(notifCount)} status={notifCount > 0 ? 'watch' : 'good'} />
          <Metric label="Server" value={health?.status === 'ok' ? 'Healthy' : (health?.status || INSUFFICIENT)} status={health?.status === 'ok' ? 'excellent' : 'watch'} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Uptime: {health?.uptime || INSUFFICIENT} · Active sections: {num(snap.church?.activeSections)} · Active leaders: {num(snap.church?.activeLeaders)}</p>
      </SectionCard>
    </div>
  );
};

// Build N periods backward from today for the executive comparison
function buildPeriods(periodType, count) {
  const periods = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    let start, end, label;
    if (periodType === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    } else if (periodType === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - i * 7 - d.getDay());
      start = d.toISOString().split('T')[0];
      const e = new Date(d); e.setDate(e.getDate() + 6);
      end = e.toISOString().split('T')[0];
      label = `W${i + 1}`;
    } else {
      const d = new Date(now.getFullYear() - i, 0, 1);
      start = `${d.getFullYear()}-01-01`;
      end = `${d.getFullYear()}-12-31`;
      label = `${d.getFullYear()}`;
    }
    periods.push({ id: `p${i}`, label, start, end });
  }
  return periods;
}

export default ExecutiveCommandCenter;
