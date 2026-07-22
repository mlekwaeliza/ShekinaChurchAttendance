import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, analyticsAPI } from '../../services/api';
import { fdate, fdatetime } from '../../utils/date';
import {
  ArrowLeft, Phone, Mail, Users, Calendar, TrendingUp, Award, Clock,
  UserCheck, UserX, Activity, Target, ChevronRight, Loader2, AlertTriangle,
  Crown, ClipboardList, Flame, CheckCircle2, Layers
} from 'lucide-react';

import WeeklyAttendanceMatrix from './WeeklyAttendanceMatrix';

const asArray = (v) => Array.isArray(v) ? v : [];
const R = (v) => Math.round(Number(v) || 0);

const SUBTABS = [
  { key: 'overview', label: 'Overview', icon: UserCheck },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'matrix', label: 'Weekly Matrix', icon: Calendar },
  { key: 'roster', label: 'Roster', icon: ClipboardList },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'performance', label: 'Performance', icon: Award },
];

const LeaderProfile = ({ leaderId, onBack, allMembers = [] }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [leaderRankings, setLeaderRankings] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, rankingsRes] = await Promise.all([
        adminAPI.getLeaderDashboard(leaderId),
        analyticsAPI.getLeaderRankings(90).catch(() => ({ data: [] })),
      ]);
      setData(dashRes.data);
      setLeaderRankings(asArray(rankingsRes.data));
      try {
        const perfRes = await adminAPI.getPerformanceProfile('leader', leaderId, 'month');
        setPerformance(perfRes.data);
      } catch (e) { /* performance may not exist yet */ }
    } catch (e) {
      console.error('Leader profile load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [leaderId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || !data.leader) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Leader not found</p>
        <button onClick={onBack} className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700">Back to Leaders</button>
      </div>
    );
  }

  const { leader, roster, trends, history } = data;
  const ranking = leaderRankings.find(l => Number(l.id) === Number(leaderId) || Number(l.leader_id) === Number(leaderId));
  const rank = ranking ? (leaderRankings.indexOf(ranking) + 1) : null;
  const totalTrendRecords = asArray(trends).reduce((sum, t) => sum + (Number(t.present_count || 0) + Number(t.absent_count || 0) + Number(t.excused_count || 0)), 0);
  const totalTrendPresent = asArray(trends).reduce((sum, t) => sum + Number(t.present_count || 0), 0);
  const calculatedAttendanceRate = totalTrendRecords > 0 ? Math.round((totalTrendPresent / totalTrendRecords) * 100) : 0;
  const attendanceRate = ranking?.attendance_rate ?? ranking?.attendanceRate ?? calculatedAttendanceRate;
  const submissionRate = ranking?.submissionRate ?? ranking?.leader_submission_rate ?? (asArray(history).length > 0 ? Math.min(100, Math.round((asArray(history).length / 12) * 100)) : 0);
  const leadershipScore = performance?.score || ranking?.leadership_score || ranking?.efficiency_score || ranking?.performance_score || Math.round(attendanceRate * 0.6 + submissionRate * 0.4);
  const activeMembers = asArray(roster).filter(m => m.is_active === 1 || m.is_active === true).length;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Leaders
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Crown className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{leader.full_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-indigo-100">
                <button
                  type="button"
                  onClick={() => leader.section_id && navigate(`/admin/sections?profile=${leader.section_id}`)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors cursor-pointer text-indigo-100 font-semibold"
                  title="View Section Profile"
                >
                  <Layers className="w-3.5 h-3.5" /> {leader.section_name}
                </button>
                {leader.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {leader.phone}</span>}
                {leader.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {leader.email}</span>}
              </div>
            </div>
          </div>
          {rank && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Rank</p>
              <p className="text-2xl font-black">#{rank}</p>
            </div>
          )}
        </div>
        {/* Quick KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <KpiBox label="Active Members" value={activeMembers} />
          <KpiBox label="Attendance Rate" value={`${R(attendanceRate)}%`} />
          <KpiBox label="Submission Rate" value={`${R(submissionRate)}%`} />
          <KpiBox label="Leadership Score" value={`${R(leadershipScore)}/100`} />
          <KpiBox label="Submission Count" value={asArray(history).length} />
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {SUBTABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab leader={leader} roster={roster} ranking={ranking} performance={performance} activeMembers={activeMembers} attendanceRate={attendanceRate} submissionRate={submissionRate} leadershipScore={leadershipScore} historyCount={asArray(history).length} />}
      {tab === 'members' && <MembersTab roster={roster} />}
      {tab === 'matrix' && <WeeklyAttendanceMatrix leaderId={leaderId} title={`Weekly Attendance Matrix - ${leader.full_name}`} />}
      {tab === 'roster' && <RosterTab roster={roster} trends={trends} />}
      {tab === 'analytics' && <AnalyticsTab trends={trends} history={history} />}
      {tab === 'performance' && <PerformanceTab performance={performance} ranking={ranking} />}
    </div>
  );
};

// ── KPI Box ──────────────────────────────────────────────────────────────
const KpiBox = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 px-3 py-2">
    <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-200">{label}</p>
    <p className="text-lg font-black mt-0.5">{value}</p>
  </div>
);

// ── Overview Tab ─────────────────────────────────────────────────────────
const OverviewTab = ({ leader, ranking, performance, activeMembers, attendanceRate, submissionRate, leadershipScore, historyCount }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Leader Information</h3>
        <div className="space-y-2">
          <InfoRow label="Full Name" value={leader.full_name} />
          <InfoRow label="Username" value={leader.username} />
          <InfoRow label="Section" value={leader.section_name} />
          <InfoRow label="Is Head Leader" value={leader.is_head ? 'Yes' : 'No'} />
          <InfoRow label="Is Active" value={leader.is_active ? 'Active' : 'Inactive'} />
          {leader.phone && <InfoRow label="Phone" value={leader.phone} />}
          {leader.email && <InfoRow label="Email" value={leader.email} />}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Performance Summary</h3>
        <div className="space-y-3">
          <StatBar label="Attendance Rate" value={R(attendanceRate)} max={100} suffix="%" color="emerald" />
          <StatBar label="Submission Rate" value={R(submissionRate)} max={100} suffix="%" color="blue" />
          <StatBar label="Leadership Score" value={R(leadershipScore)} max={100} suffix="/100" color="indigo" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <MiniStat icon={Users} label="Active Members" value={activeMembers} />
            <MiniStat icon={ClipboardList} label="Submissions" value={historyCount} />
          </div>
        </div>
      </div>
    </div>
    {performance?.breakdown && (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Score Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(performance.breakdown).map(([key, val]) => (
            <div key={key} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{key.replace(/_/g, ' ')}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{R(val.score || val)}</p>
              {val.max && <p className="text-[10px] text-slate-400">/ {val.max}</p>}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Members Tab ──────────────────────────────────────────────────────────
const MembersTab = ({ roster }) => {
  const members = asArray(roster);
  if (members.length === 0) {
    return <EmptyState icon={Users} message="No members assigned to this leader." />;
  }
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">#</th>
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Member</th>
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Phone</th>
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Status</th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Hall of Fame</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-2.5 px-3 text-slate-400 font-medium">{i + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{m.full_name}</td>
                <td className="py-2.5 px-3 text-slate-500">{m.phone || '—'}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-amber-600">{R(m.hall_of_fame_points || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Roster Tab ───────────────────────────────────────────────────────────
const RosterTab = ({ roster, trends }) => {
  const members = asArray(roster).filter(m => m.is_active);
  const trendData = asArray(trends);
  const memberAttendance = {};
  trendData.forEach(t => {
    const date = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date).slice(0, 10);
    if (!memberAttendance[date]) memberAttendance[date] = { present: 0, absent: 0, excused: 0 };
    memberAttendance[date].present += Number(t.present_count) || 0;
    memberAttendance[date].absent += Number(t.absent_count) || 0;
    memberAttendance[date].excused += Number(t.excused_count) || 0;
  });
  const dates = Object.keys(memberAttendance).sort().slice(-12);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Active Roster ({members.length} members)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {members.map((m, i) => (
            <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{m.full_name}</p>
                <p className="text-[10px] text-slate-400">{m.phone || 'No phone'}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-600">{R(m.hall_of_fame_points || 0)} pts</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Recent Attendance Summary</h3>
        {dates.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No attendance data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Date</th>
                  <th className="text-right py-2 px-3 font-semibold text-emerald-600">Present</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-600">Absent</th>
                  <th className="text-right py-2 px-3 font-semibold text-amber-600">Excused</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {dates.map(d => {
                  const a = memberAttendance[d];
                  const total = a.present + a.absent + a.excused;
                  const rate = total > 0 ? Math.round((a.present / total) * 100) : 0;
                  return (
                    <tr key={d} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{fdate(d)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">{a.present}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">{a.absent}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-600">{a.excused}</td>
                      <td className="py-2 px-3 text-right font-semibold">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Analytics Tab ────────────────────────────────────────────────────────
const AnalyticsTab = ({ trends, history }) => {
  const trendData = asArray(trends);
  const historyData = asArray(history);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Attendance Trends (90 Days)</h3>
        {trendData.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No trend data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Date</th>
                  <th className="text-right py-2 px-3 font-semibold text-emerald-600">Present</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-600">Absent</th>
                  <th className="text-right py-2 px-3 font-semibold text-amber-600">Excused</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {trendData.slice(-20).map((t, i) => {
                  const date = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date).slice(0, 10);
                  const present = Number(t.present_count) || 0;
                  const absent = Number(t.absent_count) || 0;
                  const excused = Number(t.excused_count) || 0;
                  const total = present + absent + excused;
                  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{fdate(date)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">{present}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">{absent}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-600">{excused}</td>
                      <td className="py-2 px-3 text-right font-semibold">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Submission History</h3>
        {historyData.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {historyData.slice(0, 15).map((h, i) => {
              const date = h.date instanceof Date ? h.date.toISOString().slice(0, 10) : String(h.date).slice(0, 10);
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 p-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fdate(date)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{R(h.records_count) || 0} records</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Performance Tab ──────────────────────────────────────────────────────
const PerformanceTab = ({ performance, ranking }) => {
  if (!performance && !ranking) {
    return <EmptyState icon={Award} message="No performance data available yet." />;
  }

  const score = performance?.entity?.overallScore ?? performance?.overallScore ?? performance?.score ?? ranking?.leadership_score ?? 0;
  const breakdown = performance?.breakdown || [];
  const achievements = performance?.achievements || performance?.entity?.badges || [];

  const breakdownItems = Array.isArray(breakdown)
    ? breakdown.map(item => ({
        key: item.key,
        label: item.label || (item.key ? item.key.replace(/_/g, ' ') : ''),
        score: item.score ?? item.points ?? 0,
        max: item.max || 100,
      }))
    : Object.entries(breakdown).map(([k, v]) => ({
        key: k,
        label: k.replace(/_/g, ' '),
        score: typeof v === 'object' ? (v.score ?? 0) : Number(v) || 0,
        max: typeof v === 'object' ? v.max : 100,
      }));

  return (
    <div className="space-y-4">
      {performance && (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Overall Leadership Score</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{R(score)}<span className="text-base text-slate-400">/100</span></p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center">
                <Award className="w-8 h-8 text-indigo-500" />
              </div>
            </div>
          </div>
          {breakdownItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Score Breakdown</h3>
              <div className="space-y-3">
                {breakdownItems.map((item, idx) => {
                  const itemScore = R(item.score || 0);
                  const max = item.max || 100;
                  return (
                    <div key={item.key || idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">{item.label}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{itemScore}{max ? `/${max}` : ''}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${max ? Math.min(100, (itemScore / max) * 100) : itemScore}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {asArray(achievements).length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-amber-500" /> Achievements</h3>
              <div className="flex flex-wrap gap-2">
                {asArray(achievements).map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                    <Award className="w-3 h-3" />{a.name || a.key || a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {ranking && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Ranking Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="Rank" value={`#${ranking.rank || '—'}`} />
            <InfoRow label="Attendance Rate" value={`${R(ranking.attendance_rate || ranking.attendanceRate)}%`} />
            <InfoRow label="Submission Rate" value={`${R(ranking.submissionRate || ranking.leader_submission_rate)}%`} />
            <InfoRow label="Active Members" value={ranking.members || ranking.assigned_members || 0} />
            <InfoRow label="Retention Rate" value={`${R(ranking.retention_rate)}%`} />
            <InfoRow label="Status" value={ranking.status?.label || '—'} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="text-xs font-semibold text-slate-900 dark:text-white">{value || '—'}</span>
  </div>
);

const StatBar = ({ label, value, max = 100, suffix = '', color = 'indigo' }) => {
  const colors = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500' };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-white">{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
        <div className={`h-full ${colors[color] || colors.indigo} rounded-full transition-all`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
};

const MiniStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-2.5">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="text-[10px] font-semibold text-slate-400">{label}</span>
    </div>
    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{value}</p>
  </div>
);

const EmptyState = ({ icon: Icon, message }) => (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
    <p className="text-sm text-slate-400">{message}</p>
  </div>
);

export default LeaderProfile;
