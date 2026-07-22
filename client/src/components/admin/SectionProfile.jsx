import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, analyticsAPI } from '../../services/api';
import { fdate, fdatetime } from '../../utils/date';
import {
  ArrowLeft, Users, TrendingUp, Award, Crown, Layers,
  Activity, Target, Loader2, AlertTriangle, Flame,
  CheckCircle2, UserCheck, Phone, Mail, Calendar,
  ClipboardList, ChevronRight, Shield, Search, BarChart2
} from 'lucide-react';
import WeeklyAttendanceMatrix from './WeeklyAttendanceMatrix';

const asArray = (v) => Array.isArray(v) ? v : [];
const R = (v) => Math.round(Number(v) || 0);

const SUBTABS = [
  { key: 'overview',     label: 'Overview',     icon: Layers },
  { key: 'members',      label: 'Members',       icon: Users },
  { key: 'matrix',       label: 'Weekly Matrix', icon: Calendar },
  { key: 'analytics',   label: 'Analytics',     icon: TrendingUp },
  { key: 'submissions', label: 'Submissions',   icon: ClipboardList },
  { key: 'performance', label: 'Performance',   icon: Award },
];

const SectionProfile = ({ sectionId, sectionName, onBack }) => {
  const navigate = useNavigate();
  const [tab, setTab]           = useState('overview');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [dashData, setDashData] = useState(null);   // { section, members, leaders, trends, submissions }
  const [rankings, setRankings] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [comparison, setComparison]   = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, rankRes, compRes] = await Promise.all([
        adminAPI.getSectionDashboard(sectionId),
        analyticsAPI.getSectionRankings(90).catch(() => ({ data: [] })),
        analyticsAPI.getSectionComparison(90).catch(() => ({ data: [] })),
      ]);
      setDashData(dashRes.data);
      setRankings(asArray(rankRes.data));
      setComparison(asArray(compRes.data));
      try {
        const perfRes = await adminAPI.getPerformanceProfile('section', sectionId, 'month');
        setPerformance(perfRes.data);
      } catch (_) { /* no performance data yet */ }
    } catch (e) {
      console.error('Section profile load failed:', e);
      setError('Failed to load section data.');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
    </div>
  );

  if (error || !dashData) return (
    <div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{error || 'Section not found'}</p>
      <button onClick={onBack} className="mt-4 text-xs font-semibold text-violet-600 hover:text-violet-700">Back to Sections</button>
    </div>
  );

  const { section, members, leaders, trends, submissions } = dashData;
  const ranking   = rankings.find(s => Number(s.id) === Number(sectionId));
  const rank      = ranking ? (rankings.indexOf(ranking) + 1) : null;
  const compData  = comparison.find(c => Number(c.id) === Number(sectionId));
  const headLeader = asArray(leaders).find(l => l.is_head);
  const activeMembers  = asArray(members).filter(m => m.is_active);
  const inactiveMembers = asArray(members).filter(m => !m.is_active);

  const totalTrendRecords = asArray(trends).reduce((s, t) => s + R(t.present_count) + R(t.absent_count) + R(t.excused_count), 0);
  const totalTrendPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const attendanceRate    = totalTrendRecords > 0 ? Math.round((totalTrendPresent / totalTrendRecords) * 100) : R(ranking?.attendance_rate || ranking?.attendanceRate || 0);
  const performanceScore  = performance?.score || ranking?.performance_score || 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sections
      </button>

      {/* ── Header Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 p-5 text-white shadow-lg shadow-violet-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black">{section.name || sectionName || 'Section'}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-violet-100">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {activeMembers.length} active members</span>
                {headLeader && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/leaders?profile=${headLeader.id}`)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors font-semibold"
                  >
                    <Crown className="w-3.5 h-3.5" /> {headLeader.full_name}
                  </button>
                )}
                <span className="inline-flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> {asArray(leaders).length} leaders</span>
              </div>
            </div>
          </div>
          {rank && (
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">Rank</p>
              <p className="text-2xl font-black">#{rank}</p>
            </div>
          )}
        </div>

        {/* KPI Row */}
        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-2.5 mt-4">
          <KpiBox label="Active Members"  value={activeMembers.length} />
          <KpiBox label="Attendance Rate" value={`${attendanceRate}%`} />
          <KpiBox label="Performance"     value={`${R(performanceScore)}/100`} />
          <KpiBox label="Leaders"         value={asArray(leaders).length} />
          <KpiBox label="Submissions (90d)" value={asArray(submissions).length} />
        </div>
      </div>

      {/* ── Subtabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {SUBTABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────── */}
      {tab === 'overview' && (
        <SectionOverview
          section={section} ranking={ranking} performance={performance}
          leaders={leaders} activeMembers={activeMembers} inactiveMembers={inactiveMembers}
          compData={compData} trends={trends} attendanceRate={attendanceRate}
          navigate={navigate}
        />
      )}
      {tab === 'members'  && <SectionMembers members={members} navigate={navigate} />}
      {tab === 'matrix'   && <WeeklyAttendanceMatrix sectionId={sectionId} title={`Weekly Attendance Matrix - ${section.name || sectionName}`} />}
      {tab === 'analytics' && <SectionAnalytics ranking={ranking} compData={compData} rankings={rankings} trends={trends} />}
      {tab === 'submissions' && <SectionSubmissions submissions={submissions} />}
      {tab === 'performance' && <SectionPerformance performance={performance} ranking={ranking} />}
    </div>
  );
};

// ── KPI Box ─────────────────────────────────────────────────────────────────
const KpiBox = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2.5">
    <p className="text-[9px] font-bold uppercase tracking-wider text-violet-200">{label}</p>
    <p className="text-lg font-black mt-0.5">{value}</p>
  </div>
);

// ── Overview Tab ─────────────────────────────────────────────────────────────
const SectionOverview = ({ section, ranking, performance, leaders, activeMembers, inactiveMembers, compData, trends, attendanceRate, navigate }) => {
  const totalPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const totalAbsent  = asArray(trends).reduce((s, t) => s + R(t.absent_count), 0);
  const totalExcused = asArray(trends).reduce((s, t) => s + R(t.excused_count), 0);
  const totalRecords = totalPresent + totalAbsent + totalExcused;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section stats */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-500" /> Section Summary
          </h3>
          <div className="space-y-1.5">
            <InfoRow label="Section Name"   value={ranking?.name || section.name} />
            <InfoRow label="Active Members" value={activeMembers.length} />
            <InfoRow label="Inactive Members" value={inactiveMembers.length} />
            <InfoRow label="Attendance Rate (90d)" value={`${attendanceRate}%`} />
            <InfoRow label="Present (90d)"  value={totalPresent} />
            <InfoRow label="Absent (90d)"   value={totalAbsent} />
            <InfoRow label="Excused (90d)"  value={totalExcused} />
            {compData && <InfoRow label="Trend vs Prev Period" value={`${compData.trend >= 0 ? '+' : ''}${R(compData.trend)}%`} />}
            {ranking && <InfoRow label="Performance Score" value={`${R(ranking.performance_score)}/100`} />}
            <InfoRow label="Created" value={section.created_at ? fdate(section.created_at) : '—'} />
          </div>
        </div>

        {/* Leaders */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-500" /> Leaders in Section
          </h3>
          {asArray(leaders).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No leaders assigned.</p>
          ) : (
            <div className="space-y-2">
              {asArray(leaders).map((l, i) => (
                <button
                  key={l.id || i}
                  type="button"
                  onClick={() => navigate(`/admin/leaders?profile=${l.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-2.5 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {l.is_head ? <Crown className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{l.full_name}</p>
                    {l.is_head && <p className="text-[10px] text-violet-500">Head Leader</p>}
                    {l.phone && <p className="text-[10px] text-slate-400">{l.phone}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 90-day attendance trend mini-chart */}
      {asArray(trends).length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> 90-Day Attendance Trend
          </h3>
          <div className="flex items-end gap-1 h-20 overflow-x-auto pb-1">
            {asArray(trends).map((t, i) => {
              const total = R(t.present_count) + R(t.absent_count) + R(t.excused_count);
              const pct   = total > 0 ? Math.round((R(t.present_count) / total) * 100) : 0;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 min-w-[6px]" title={`${fdate(t.date)}: ${pct}%`}>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${Math.max(4, pct * 0.7)}px`,
                      background: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                      minWidth: '6px'
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
            <span>{asArray(trends)[0]?.date ? fdate(asArray(trends)[0].date) : ''}</span>
            <span>Overall: {attendanceRate}%</span>
            <span>{asArray(trends)[asArray(trends).length - 1]?.date ? fdate(asArray(trends)[asArray(trends).length - 1].date) : ''}</span>
          </div>
        </div>
      )}

      {/* Performance score breakdown */}
      {performance?.breakdown && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Score Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(performance.breakdown).map(([key, val]) => (
              <div key={key} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{key.replace(/_/g, ' ')}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{R(typeof val === 'object' ? val.score : val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Members Tab ───────────────────────────────────────────────────────────────
const SectionMembers = ({ members, navigate }) => {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const filtered = asArray(members).filter(m => {
    const matchSearch = !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search);
    const matchActive = showInactive || m.is_active;
    return matchSearch && matchActive;
  });

  if (asArray(members).length === 0) return (
    <div className="text-center py-12">
      <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
      <p className="text-sm text-slate-400">No members in this section.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            className="input h-8 w-full pl-9 text-xs rounded-xl"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowInactive(v => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${showInactive ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {showInactive ? 'Hide' : 'Show'} Inactive ({asArray(members).filter(m => !m.is_active).length})
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">#</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Member</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Phone</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Leader</th>
                <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Status</th>
                <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-violet-50/30 dark:hover:bg-violet-950/10 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{m.full_name}</p>
                      {m.membership_id && <p className="text-[10px] text-slate-400">{m.membership_id}</p>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{m.phone || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500">{m.leader_name || '—'}</td>
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
        {filtered.length === 0 && (
          <p className="text-center py-8 text-xs text-slate-400">No members match your search.</p>
        )}
      </div>
    </div>
  );
};

// ── Analytics Tab ────────────────────────────────────────────────────────────
const SectionAnalytics = ({ ranking, compData, rankings, trends }) => {
  const totalPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const totalAbsent  = asArray(trends).reduce((s, t) => s + R(t.absent_count), 0);
  const totalExcused = asArray(trends).reduce((s, t) => s + R(t.excused_count), 0);
  const totalRecords = totalPresent + totalAbsent + totalExcused;
  const attRate      = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : R(ranking?.attendance_rate || ranking?.attendanceRate || 0);

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Attendance Rate (90d)" value={`${attRate}%`}    color={attRate >= 75 ? 'emerald' : attRate >= 50 ? 'amber' : 'rose'} />
        <StatBox label="Present"               value={totalPresent}      color="blue" />
        <StatBox label="Absent"                value={totalAbsent}       color="rose" />
        <StatBox label="Members"               value={ranking?.members || 0} color="indigo" />
        {compData && <StatBox label="Trend vs Prev" value={`${compData.trend >= 0 ? '+' : ''}${R(compData.trend)}%`} color={compData.trend >= 0 ? 'emerald' : 'rose'} />}
        {compData && <StatBox label="Prev Rate" value={`${R(compData.prev_attendance_rate || compData.prevRate)}%`} color="slate" />}
        <StatBox label="Services Tracked" value={asArray(trends).length} color="violet" />
        <StatBox label="Rank Among Sections" value={ranking ? `#${rankings.indexOf(ranking) + 1}` : '—'} color="amber" />
      </div>

      {/* Full trend table */}
      {asArray(trends).length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Attendance by Service Date (90 days)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/60">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Date</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Present</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Absent</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Excused</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {[...asArray(trends)].reverse().map((t, i) => {
                  const tot = R(t.present_count) + R(t.absent_count) + R(t.excused_count);
                  const pct = tot > 0 ? Math.round((R(t.present_count) / tot) * 100) : 0;
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{fdate(t.date)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-600">{R(t.present_count)}</td>
                      <td className="py-2 px-3 text-right text-rose-500">{R(t.absent_count)}</td>
                      <td className="py-2 px-3 text-right text-amber-500">{R(t.excused_count)}</td>
                      <td className="py-2 px-3 text-right font-bold" style={{ color: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cross-section comparison */}
      {asArray(rankings).length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Sections Ranking</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Rank</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Section</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Members</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Present</th>
                </tr>
              </thead>
              <tbody>
                {asArray(rankings).map((s, i) => (
                  <tr key={s.id || i} className={`border-b border-slate-100 dark:border-slate-700/50 ${Number(s.id) === Number(ranking?.id) ? 'bg-violet-50 dark:bg-violet-950/20 font-semibold' : ''}`}>
                    <td className="py-2 px-3 text-slate-400">#{i + 1}</td>
                    <td className="py-2 px-3 text-slate-900 dark:text-white">{s.name}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{s.members}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: (s.attendanceRate || s.attendance_rate) >= 75 ? '#10b981' : (s.attendanceRate || s.attendance_rate) >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {R(s.attendanceRate || s.attendance_rate)}%
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{s.present || 0}</td>
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

// ── Submissions Tab ───────────────────────────────────────────────────────────
const SectionSubmissions = ({ submissions }) => {
  if (asArray(submissions).length === 0) return (
    <div className="text-center py-12">
      <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
      <p className="text-sm text-slate-400">No submission records found for this section.</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" /> Submission History ({asArray(submissions).length})
        </h3>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/60">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Date</th>
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Leader</th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Records</th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {asArray(submissions).map((s, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{fdate(s.date)}</td>
                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{s.leader_name || '—'}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">{s.records_count || 0}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-[10px]">{s.submitted_at ? fdatetime(s.submitted_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Performance Tab ───────────────────────────────────────────────────────────
const SectionPerformance = ({ performance, ranking }) => {
  if (!performance && !ranking) return (
    <div className="text-center py-12">
      <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
      <p className="text-sm text-slate-400">No performance data available.</p>
    </div>
  );

  const score      = performance?.entity?.overallScore ?? performance?.overallScore ?? performance?.score ?? ranking?.attendance_rate ?? 0;
  const breakdown  = performance?.breakdown || [];
  const achievements = performance?.achievements || performance?.entity?.badges || [];

  const breakdownItems = Array.isArray(breakdown)
    ? breakdown.map(item => ({ key: item.key, label: item.label || item.key?.replace(/_/g, ' '), score: item.score ?? item.points ?? 0, max: item.max || 100 }))
    : Object.entries(breakdown).map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' '), score: typeof v === 'object' ? (v.score ?? 0) : Number(v) || 0, max: typeof v === 'object' ? v.max : 100 }));

  return (
    <div className="space-y-4">
      {performance && (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Section Performance Score</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{R(score)}<span className="text-base text-slate-400">/100</span></p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                <Award className="w-8 h-8 text-violet-500" />
              </div>
            </div>
          </div>

          {breakdownItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Score Breakdown</h3>
              <div className="space-y-3">
                {breakdownItems.map((item, idx) => {
                  const s = R(item.score || 0);
                  const m = item.max || 100;
                  return (
                    <div key={item.key || idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">{item.label}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{s}{m ? `/${m}` : ''}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(100, m ? (s / m) * 100 : s)}%` }} />
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

      {ranking && !performance && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Ranking Summary</h3>
          <div className="space-y-1.5">
            <InfoRow label="Attendance Rate" value={`${R(ranking.attendanceRate || ranking.attendance_rate)}%`} />
            <InfoRow label="Members"        value={ranking.members || 0} />
            <InfoRow label="Present"        value={ranking.present || 0} />
            <InfoRow label="Absent"         value={ranking.absent || 0} />
            <InfoRow label="Status"         value={ranking.status || '—'} />
            <InfoRow label="Performance Score" value={`${R(ranking.performance_score)}/100`} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="text-xs font-semibold text-slate-900 dark:text-white">{value ?? '—'}</span>
  </div>
);

const StatBox = ({ label, value, color = 'slate' }) => {
  const colors = { emerald: 'text-emerald-600 dark:text-emerald-400', blue: 'text-blue-600 dark:text-blue-400', rose: 'text-rose-600 dark:text-rose-400', indigo: 'text-indigo-600 dark:text-indigo-400', amber: 'text-amber-600 dark:text-amber-400', slate: 'text-slate-600 dark:text-slate-300', violet: 'text-violet-600 dark:text-violet-400' };
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-black mt-1 ${colors[color] || colors.slate}`}>{value}</p>
    </div>
  );
};

export default SectionProfile;
