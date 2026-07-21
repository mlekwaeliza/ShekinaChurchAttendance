import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI, analyticsAPI } from '../../services/api';
import { fdate } from '../../utils/date';
import {
  ArrowLeft, Users, TrendingUp, Award, Crown, Layers,
  Activity, Target, Loader2, AlertTriangle, Flame, CheckCircle2,
  UserCheck, Phone, Mail
} from 'lucide-react';

const asArray = (v) => Array.isArray(v) ? v : [];
const R = (v) => Math.round(Number(v) || 0);

const SUBTABS = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'performance', label: 'Performance', icon: Award },
];

const SectionProfile = ({ sectionId, sectionName, onBack, allMembers = [], leaders = [] }) => {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [comparison, setComparison] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rankRes, compRes] = await Promise.all([
        analyticsAPI.getSectionRankings(90).catch(() => ({ data: [] })),
        analyticsAPI.getSectionComparison(90).catch(() => ({ data: [] })),
      ]);
      setRankings(asArray(rankRes.data));
      setComparison(asArray(compRes.data));
      try {
        const perfRes = await adminAPI.getPerformanceProfile('section', sectionId, 'month');
        setPerformance(perfRes.data);
      } catch (e) { /* performance may not exist */ }
    } catch (e) {
      console.error('Section profile load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const ranking = rankings.find(s => Number(s.id) === Number(sectionId));
  const sectionMembers = allMembers.filter(m => Number(m.section_id) === Number(sectionId));
  const sectionLeaders = leaders.filter(l => Number(l.section_id) === Number(sectionId));
  const headLeader = sectionLeaders.find(l => l.is_head);
  const activeMembers = sectionMembers.filter(m => m.is_active);
  const attendanceRate = ranking?.attendanceRate || ranking?.attendance_rate || 0;
  const performanceScore = performance?.score || ranking?.performance_score || 0;
  const rank = ranking ? (rankings.indexOf(ranking) + 1) : null;
  const compData = comparison.find(c => Number(c.id) === Number(sectionId) || c.name === sectionName);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sections
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{sectionName || ranking?.name || 'Section'}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-violet-100">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {activeMembers.length} members</span>
                {headLeader && <span className="inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> {headLeader.full_name || headLeader.user_name}</span>}
                <span className="inline-flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> {sectionLeaders.length} leaders</span>
              </div>
            </div>
          </div>
          {rank && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">Rank</p>
              <p className="text-2xl font-black">#{rank}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <KpiBox label="Active Members" value={activeMembers.length} />
          <KpiBox label="Attendance Rate" value={`${R(attendanceRate)}%`} />
          <KpiBox label="Performance Score" value={`${R(performanceScore)}/100`} />
          <KpiBox label="Leaders" value={sectionLeaders.length} />
          <KpiBox label="Present Today" value={ranking?.present || 0} />
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

      {tab === 'overview' && <SectionOverview ranking={ranking} performance={performance} sectionLeaders={sectionLeaders} activeMembers={activeMembers.length} compData={compData} />}
      {tab === 'members' && <SectionMembers members={sectionMembers} />}
      {tab === 'analytics' && <SectionAnalytics ranking={ranking} compData={compData} rankings={rankings} />}
      {tab === 'performance' && <SectionPerformance performance={performance} ranking={ranking} />}
    </div>
  );
};

// ── KPI Box ──────────────────────────────────────────────────────────────
const KpiBox = ({ label, value }) => (
  <div className="rounded-xl bg-white/10 px-3 py-2">
    <p className="text-[9px] font-bold uppercase tracking-wider text-violet-200">{label}</p>
    <p className="text-lg font-black mt-0.5">{value}</p>
  </div>
);

// ── Overview Tab ─────────────────────────────────────────────────────────
const SectionOverview = ({ ranking, performance, sectionLeaders, activeMembers, compData }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Section Information</h3>
        <div className="space-y-2">
          <InfoRow label="Section Name" value={ranking?.name || '—'} />
          <InfoRow label="Total Members" value={ranking?.members || activeMembers} />
          <InfoRow label="Present (Last)" value={ranking?.present || 0} />
          <InfoRow label="Absent (Last)" value={ranking?.absent || 0} />
          <InfoRow label="Attendance Rate" value={`${R(ranking?.attendanceRate || ranking?.attendance_rate)}%`} />
          <InfoRow label="Status" value={ranking?.status || '—'} />
          {compData && <InfoRow label="Trend" value={`${compData.trend > 0 ? '+' : ''}${R(compData.trend)}%`} />}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Leaders in Section</h3>
        {sectionLeaders.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No leaders assigned.</p>
        ) : (
          <div className="space-y-2">
            {sectionLeaders.map((l, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                  {l.is_head ? <Crown className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{l.full_name || l.user_name}</p>
                  {l.is_head && <p className="text-[10px] text-violet-500">Head Leader</p>}
                </div>
                {l.phone && <span className="text-[10px] text-slate-400">{l.phone}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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

// ── Members Tab ──────────────────────────────────────────────────────────
const SectionMembers = ({ members }) => {
  if (members.length === 0) {
    return <div className="text-center py-12"><Users className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-400">No members in this section.</p></div>;
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
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Leader</th>
              <th className="text-left py-2.5 px-3 font-semibold text-slate-500">Status</th>
              <th className="text-right py-2.5 px-3 font-semibold text-slate-500">Points</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-2.5 px-3 text-slate-400 font-medium">{i + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{m.full_name}</td>
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
    </div>
  );
};

// ── Analytics Tab ────────────────────────────────────────────────────────
const SectionAnalytics = ({ ranking, compData, rankings }) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Section Performance</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Attendance Rate" value={`${R(ranking?.attendanceRate || ranking?.attendance_rate)}%`} color="emerald" />
        <StatBox label="Present" value={ranking?.present || 0} color="blue" />
        <StatBox label="Absent" value={ranking?.absent || 0} color="rose" />
        <StatBox label="Members" value={ranking?.members || 0} color="indigo" />
        {compData && <StatBox label="Trend" value={`${compData.trend > 0 ? '+' : ''}${R(compData.trend)}%`} color={compData.trend >= 0 ? 'emerald' : 'rose'} />}
        {compData && <StatBox label="Prev Rate" value={`${R(compData.prev_attendance_rate || compData.prevRate)}%`} color="slate" />}
        {compData && <StatBox label="Change" value={`${compData.change > 0 ? '+' : ''}${R(compData.change)}%`} color={compData.change >= 0 ? 'emerald' : 'rose'} />}
        <StatBox label="Rank" value={ranking ? `#${rankings.indexOf(ranking) + 1}` : '—'} color="amber" />
      </div>
    </div>
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">All Sections Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-3 font-semibold text-slate-500">Rank</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-500">Section</th>
              <th className="text-right py-2 px-3 font-semibold text-slate-500">Members</th>
              <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
              <th className="text-right py-2 px-3 font-semibold text-slate-500">Present</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((s, i) => (
              <tr key={s.id || i} className={`border-b border-slate-100 dark:border-slate-700/50 ${Number(s.id) === Number(ranking?.id) ? 'bg-violet-50 dark:bg-violet-950/20 font-semibold' : ''}`}>
                <td className="py-2 px-3 text-slate-400">#{i + 1}</td>
                <td className="py-2 px-3 text-slate-900 dark:text-white">{s.name}</td>
                <td className="py-2 px-3 text-right text-slate-500">{s.members}</td>
                <td className="py-2 px-3 text-right font-bold" style={{ color: (s.attendanceRate || s.attendance_rate) >= 75 ? '#10b981' : (s.attendanceRate || s.attendance_rate) >= 50 ? '#f59e0b' : '#ef4444' }}>{R(s.attendanceRate || s.attendance_rate)}%</td>
                <td className="py-2 px-3 text-right text-slate-500">{s.present || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ── Performance Tab ──────────────────────────────────────────────────────
const SectionPerformance = ({ performance, ranking }) => {
  if (!performance && !ranking) {
    return <div className="text-center py-12"><Award className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-400">No performance data available.</p></div>;
  }

  const score = performance?.entity?.overallScore ?? performance?.overallScore ?? performance?.score ?? ranking?.attendanceRate ?? 0;
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
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Section Performance Score</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{R(score)}<span className="text-base text-slate-400">/100</span></p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center">
                <Award className="w-8 h-8 text-violet-500" />
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
                        <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style={{ width: `${max ? Math.min(100, (itemScore / max) * 100) : itemScore}%` }} />
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="Attendance Rate" value={`${R(ranking.attendanceRate || ranking.attendance_rate)}%`} />
            <InfoRow label="Members" value={ranking.members || 0} />
            <InfoRow label="Present" value={ranking.present || 0} />
            <InfoRow label="Absent" value={ranking.absent || 0} />
            <InfoRow label="Status" value={ranking.status || '—'} />
            <InfoRow label="Performance Score" value={`${R(ranking.performance_score)}%`} />
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

const StatBox = ({ label, value, color = 'slate' }) => {
  const colors = { emerald: 'text-emerald-600', blue: 'text-blue-600', rose: 'text-rose-600', indigo: 'text-indigo-600', amber: 'text-amber-600', slate: 'text-slate-600' };
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-black mt-1 ${colors[color] || colors.slate}`}>{value}</p>
    </div>
  );
};

export default SectionProfile;
