import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, analyticsAPI } from '../../services/api';
import { fdate, fdatetime } from '../../utils/date';
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Award,
  Crown,
  Layers,
  Activity,
  Loader2,
  AlertTriangle,
  Flame,
  UserCheck,
  Calendar,
  ClipboardList,
  ChevronRight,
  Search,
  BarChart2,
  Download
} from 'lucide-react';
import WeeklyAttendanceMatrix from './WeeklyAttendanceMatrix';

const asArray = (v) => (Array.isArray(v) ? v : []);
const R = (v) => Math.round(Number(v) || 0);

const SUBTABS = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'matrix', label: 'Weekly Matrix', icon: Calendar },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'submissions', label: 'Submissions', icon: ClipboardList },
  { key: 'performance', label: 'Performance', icon: Award }
];

// ── KPI Box ─────────────────────────────────────────────────────────────────
const KpiBox = ({ label, value }) => (
  <div className="rounded-xl bg-system-grouped-background/70 dark:bg-white/[0.03] px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-label">
      {label}
    </p>
    <p className="text-lg font-semibold text-label tabular-nums mt-0.5">{value}</p>
  </div>
);

// ── Overview Tab ─────────────────────────────────────────────────────────────

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1 border-b border-separator/40 dark:border-white/[0.06] last:border-0">
    <span className="text-caption-1 text-secondary-label">{label}</span>
    <span className="text-caption-1 font-semibold text-label tabular-nums">{value ?? '—'}</span>
  </div>
);

const StatBox = ({ label, value, color = 'slate' }) => {
  const colors = {
    emerald: 'text-emerald-700 dark:text-system-green',
    blue: 'text-blue-700 dark:text-system-blue',
    rose: 'text-rose-700 dark:text-system-red',
    indigo: 'text-primary-700 dark:text-primary-300',
    amber: 'text-amber-700 dark:text-system-orange',
    slate: 'text-secondary-label',
    violet: 'text-violet-700 dark:text-violet-300'
  };
  return (
    <div className="rounded-xl bg-system-grouped-background/70 dark:bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-label">
        {label}
      </p>
      <p
        className={`text-lg font-semibold tabular-nums text-label mt-1 ${colors[color] || colors.slate}`}
      >
        {value}
      </p>
    </div>
  );
};

const SectionOverview = ({
  section,
  ranking,
  performance,
  leaders,
  activeMembers,
  inactiveMembers,
  compData,
  trends,
  attendanceRate,
  navigate
}) => {
  const totalPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const totalAbsent = asArray(trends).reduce((s, t) => s + R(t.absent_count), 0);
  const totalExcused = asArray(trends).reduce((s, t) => s + R(t.excused_count), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section stats */}
        <div className="card p-4">
          <h3 className="text-subheadline font-semibold text-label mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary-500" /> Section Summary
          </h3>
          <div className="space-y-1.5">
            <InfoRow label="Section Name" value={ranking?.name || section.name} />
            <InfoRow label="Active Members" value={activeMembers.length} />
            <InfoRow label="Inactive Members" value={inactiveMembers.length} />
            <InfoRow label="Attendance Rate (90d)" value={`${attendanceRate}%`} />
            <InfoRow label="Present (90d)" value={totalPresent} />
            <InfoRow label="Absent (90d)" value={totalAbsent} />
            <InfoRow label="Excused (90d)" value={totalExcused} />
            {compData && (
              <InfoRow
                label="Trend vs Prev Period"
                value={`${compData.trend >= 0 ? '+' : ''}${R(compData.trend)}%`}
              />
            )}
            {ranking && (
              <InfoRow label="Performance Score" value={`${R(ranking.performance_score)}/100`} />
            )}
            <InfoRow label="Created" value={section.created_at ? fdate(section.created_at) : '—'} />
          </div>
        </div>

        {/* Leaders */}
        <div className="card p-4">
          <h3 className="text-subheadline font-semibold text-label mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-system-indigo" /> Leaders in Section
          </h3>
          {asArray(leaders).length === 0 ? (
            <p className="text-xs text-tertiary-label text-center py-6">No leaders assigned.</p>
          ) : (
            <div className="space-y-2">
              {asArray(leaders).map((l, i) => (
                <button
                  key={l.id || i}
                  type="button"
                  onClick={() => navigate(`/admin/leaders?profile=${l.id}`)}
                  className="group flex min-h-20 w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500/[0.12] text-lg font-bold text-primary-700 dark:text-primary-300">
                    {l.profile_picture ? (
                      <img
                        src={l.profile_picture}
                        alt={l.full_name || 'Leader'}
                        className="h-full w-full object-cover"
                      />
                    ) : l.is_head ? (
                      <Crown className="h-6 w-6" />
                    ) : (
                      l.full_name
                        ?.split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((name) => name[0])
                        .join('')
                        .toUpperCase() || i + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-label truncate transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-300">
                      {l.full_name}
                    </p>
                    {l.is_head && (
                      <p className="text-[10px] text-primary-600 dark:text-primary-400">
                        Head Leader
                      </p>
                    )}
                    {l.phone && <p className="text-[10px] text-tertiary-label">{l.phone}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-tertiary-label group-hover:text-primary-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 90-day attendance trend mini-chart */}
      {asArray(trends).length > 0 && (
        <div className="card p-4">
          <h3 className="text-subheadline font-semibold text-label mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-system-green" /> 90-Day Attendance Trend
          </h3>
          <div className="flex items-end gap-1 h-20 overflow-x-auto pb-1">
            {asArray(trends).map((t, i) => {
              const total = R(t.present_count) + R(t.absent_count) + R(t.excused_count);
              const pct = total > 0 ? Math.round((R(t.present_count) / total) * 100) : 0;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-0.5 min-w-[6px]"
                  title={`${fdate(t.date)}: ${pct}%`}
                >
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
          <div className="flex items-center justify-between mt-2 text-[10px] text-tertiary-label">
            <span>{asArray(trends)[0]?.date ? fdate(asArray(trends)[0].date) : ''}</span>
            <span>Overall: {attendanceRate}%</span>
            <span>
              {asArray(trends)[asArray(trends).length - 1]?.date
                ? fdate(asArray(trends)[asArray(trends).length - 1].date)
                : ''}
            </span>
          </div>
        </div>
      )}

      {/* Performance score breakdown */}
      {performance?.breakdown && (
        <div className="card p-4">
          <h3 className="text-subheadline font-semibold text-label mb-3">Score Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(performance.breakdown).map(([key, val]) => (
              <div
                key={key}
                className="rounded-xl bg-system-grouped-background/70 dark:bg-white/[0.03] p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-label">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-lg font-semibold text-label tabular-nums mt-1">
                  {R(typeof val === 'object' ? val.score : val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Members Tab ───────────────────────────────────────────────────────────────
const SectionMembers = ({ members }) => {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const filtered = asArray(members).filter((m) => {
    const matchSearch =
      !search ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search);
    const matchActive = showInactive || m.is_active;
    return matchSearch && matchActive;
  });

  if (asArray(members).length === 0)
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-3 text-tertiary-label" />
        <p className="text-sm text-secondary-label">No members in this section.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary-label" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="input h-8 w-full pl-9 text-xs rounded-xl"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${showInactive ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300' : 'bg-system-fill text-secondary-label hover:text-label'}`}
        >
          {showInactive ? 'Hide' : 'Show'} Inactive (
          {asArray(members).filter((m) => !m.is_active).length})
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-separator/60 dark:border-white/[0.08] bg-system-grouped-background/60 dark:bg-white/[0.02]">
                <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">#</th>
                <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Member</th>
                <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Phone</th>
                <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Leader</th>
                <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Status</th>
                <th className="text-right py-2.5 px-3 font-semibold text-secondary-label">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.id}
                  className="border-b border-separator/40 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 px-3 text-tertiary-label font-medium tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div>
                      <p className="font-semibold text-label">{m.full_name}</p>
                      {m.membership_id && (
                        <p className="text-[10px] text-tertiary-label">{m.membership_id}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-secondary-label">{m.phone || '—'}</td>
                  <td className="py-2.5 px-3 text-secondary-label">{m.leader_name || '—'}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.is_active ? 'bg-system-green/15 text-emerald-700 dark:text-system-green' : 'bg-system-fill text-secondary-label'}`}
                    >
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-amber-700 dark:text-system-orange tabular-nums">
                    {R(m.hall_of_fame_points || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-xs text-tertiary-label">
            No members match your search.
          </p>
        )}
      </div>
    </div>
  );
};

// ── Analytics Tab ────────────────────────────────────────────────────────────
const SectionAnalytics = ({ ranking, compData, rankings, trends }) => {
  const totalPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const totalAbsent = asArray(trends).reduce((s, t) => s + R(t.absent_count), 0);
  const totalExcused = asArray(trends).reduce((s, t) => s + R(t.excused_count), 0);
  const totalRecords = totalPresent + totalAbsent + totalExcused;
  const attRate =
    totalRecords > 0
      ? Math.round((totalPresent / totalRecords) * 100)
      : R(ranking?.attendance_rate || ranking?.attendanceRate || 0);
  const prevRate = R(
    ranking?.prev_rate ||
      compData?.prev_rate ||
      compData?.prev_attendance_rate ||
      compData?.prevRate ||
      0
  );
  const rateDiff = prevRate > 0 ? attRate - prevRate : 0;

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="Attendance Rate (90d)"
          value={`${attRate}%`}
          color={attRate >= 75 ? 'emerald' : attRate >= 50 ? 'amber' : 'rose'}
        />
        <StatBox label="Present" value={totalPresent} color="blue" />
        <StatBox label="Absent" value={totalAbsent} color="rose" />
        <StatBox
          label="Members"
          value={ranking?.member_count || ranking?.members || 0}
          color="indigo"
        />
        {prevRate > 0 && (
          <StatBox
            label="Trend vs Prev"
            value={`${rateDiff >= 0 ? '+' : ''}${rateDiff}%`}
            color={rateDiff >= 0 ? 'emerald' : 'rose'}
          />
        )}
        {prevRate > 0 && <StatBox label="Prev Rate" value={`${prevRate}%`} color="slate" />}
        <StatBox label="Services Tracked" value={asArray(trends).length} color="violet" />
        <StatBox
          label="Rank Among Sections"
          value={ranking ? `#${rankings.indexOf(ranking) + 1}` : '—'}
          color="amber"
        />
      </div>

      {/* Full trend table */}
      {asArray(trends).length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-separator/60 dark:border-white/[0.08]">
            <h3 className="text-subheadline font-semibold text-label flex items-center gap-2">
              <Activity className="w-4 h-4 text-system-indigo" /> Attendance by Service Date (90
              days)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary-system-grouped-background/95 backdrop-blur-sm">
                <tr className="border-b border-separator/60 dark:border-white/[0.08]">
                  <th className="text-left py-2 px-3 font-semibold text-secondary-label">Date</th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">
                    Present
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">
                    Absent
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">
                    Excused
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">Rate</th>
                </tr>
              </thead>
              <tbody>
                {[...asArray(trends)].reverse().map((t, i) => {
                  const tot = R(t.present_count) + R(t.absent_count) + R(t.excused_count);
                  const pct = tot > 0 ? Math.round((R(t.present_count) / tot) * 100) : 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-separator/40 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-2 px-3 font-medium text-label tabular-nums">
                        {fdate(t.date)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-700 dark:text-system-green tabular-nums">
                        {R(t.present_count)}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-700 dark:text-system-red tabular-nums">
                        {R(t.absent_count)}
                      </td>
                      <td className="py-2 px-3 text-right text-amber-700 dark:text-system-orange tabular-nums">
                        {R(t.excused_count)}
                      </td>
                      <td
                        className="py-2 px-3 text-right font-bold tabular-nums"
                        style={{ color: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}
                      >
                        {pct}%
                      </td>
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
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-separator/60 dark:border-white/[0.08]">
            <h3 className="text-subheadline font-semibold text-label">All Sections Ranking</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-separator/60 dark:border-white/[0.08] bg-system-grouped-background/60 dark:bg-white/[0.02]">
                  <th className="text-left py-2 px-3 font-semibold text-secondary-label">Rank</th>
                  <th className="text-left py-2 px-3 font-semibold text-secondary-label">
                    Section
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">
                    Members
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">Rate</th>
                  <th className="text-right py-2 px-3 font-semibold text-secondary-label">
                    Present
                  </th>
                </tr>
              </thead>
              <tbody>
                {asArray(rankings).map((s, i) => (
                  <tr
                    key={s.id || i}
                    className={`border-b border-separator/40 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03] ${Number(s.id) === Number(ranking?.id) ? 'bg-primary-500/[0.08] font-semibold' : ''}`}
                  >
                    <td className="py-2 px-3 text-tertiary-label tabular-nums">#{i + 1}</td>
                    <td className="py-2 px-3 text-label">{s.name}</td>
                    <td className="py-2 px-3 text-right text-secondary-label tabular-nums">
                      {s.member_count || 0}
                    </td>
                    <td
                      className="py-2 px-3 text-right font-bold tabular-nums"
                      style={{
                        color:
                          (s.attendance_rate || 0) >= 75
                            ? '#10b981'
                            : (s.attendance_rate || 0) >= 50
                              ? '#f59e0b'
                              : '#ef4444'
                      }}
                    >
                      {R(s.attendance_rate)}%
                    </td>
                    <td className="py-2 px-3 text-right text-secondary-label tabular-nums">
                      {s.total_present || 0}
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

// ── Submissions Tab ───────────────────────────────────────────────────────────
const SectionSubmissions = ({ submissions }) => {
  if (asArray(submissions).length === 0)
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 text-tertiary-label" />
        <p className="text-sm text-secondary-label">
          No submission records found for this section.
        </p>
      </div>
    );

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-separator/60 dark:border-white/[0.08]">
        <h3 className="text-subheadline font-semibold text-label flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-system-indigo" /> Submission History (
          {asArray(submissions).length})
        </h3>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary-system-grouped-background/95 backdrop-blur-sm">
            <tr className="border-b border-separator/60 dark:border-white/[0.08]">
              <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Date</th>
              <th className="text-left py-2.5 px-3 font-semibold text-secondary-label">Leader</th>
              <th className="text-right py-2.5 px-3 font-semibold text-secondary-label">Records</th>
              <th className="text-right py-2.5 px-3 font-semibold text-secondary-label">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {asArray(submissions).map((s, i) => (
              <tr
                key={i}
                className="border-b border-separator/40 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
              >
                <td className="py-2.5 px-3 font-medium text-label tabular-nums">{fdate(s.date)}</td>
                <td className="py-2.5 px-3 text-secondary-label">{s.leader_name || '—'}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-primary-700 dark:text-primary-300 tabular-nums">
                  {s.records_count || 0}
                </td>
                <td className="py-2.5 px-3 text-right text-tertiary-label text-[10px]">
                  {s.submitted_at ? fdatetime(s.submitted_at) : '—'}
                </td>
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
  if (!performance && !ranking)
    return (
      <div className="text-center py-12">
        <Award className="w-12 h-12 mx-auto mb-3 text-tertiary-label" />
        <p className="text-sm text-secondary-label">No performance data available.</p>
      </div>
    );

  const score =
    performance?.entity?.overallScore ??
    performance?.overallScore ??
    performance?.score ??
    ranking?.attendance_rate ??
    ranking?.performance_score ??
    0;
  const breakdown = performance?.breakdown || performance?.reliability || [];
  const achievements = performance?.achievements || performance?.entity?.badges || [];

  const breakdownItems = Array.isArray(breakdown)
    ? breakdown.map((item) => ({
        key: item.key,
        label: item.label || item.key?.replace(/_/g, ' '),
        score: item.score ?? item.points ?? 0,
        max: item.max || item.weight ? 100 : 100
      }))
    : breakdown && typeof breakdown === 'object'
      ? Object.entries(breakdown).map(([k, v]) => ({
          key: k,
          label: k.replace(/_/g, ' '),
          score: typeof v === 'object' ? (v.score ?? 0) : Number(v) || 0,
          max: typeof v === 'object' ? v.max || 100 : 100
        }))
      : [];

  return (
    <div className="space-y-4">
      {performance && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-eyebrow">Section Performance Score</p>
                <p className="text-title-1 font-semibold text-label tabular-nums mt-1">
                  {R(score)}
                  <span className="text-base text-tertiary-label">/100</span>
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-primary-500/[0.12] flex items-center justify-center">
                <Award className="w-8 h-8 text-primary-700 dark:text-primary-300" />
              </div>
            </div>
          </div>

          {breakdownItems.length > 0 && (
            <div className="card p-4">
              <h3 className="text-subheadline font-semibold text-label mb-3">Score Breakdown</h3>
              <div className="space-y-3">
                {breakdownItems.map((item, idx) => {
                  const s = R(item.score || 0);
                  const m = item.max || 100;
                  return (
                    <div key={item.key || idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-secondary-label capitalize">
                          {item.label}
                        </span>
                        <span className="text-xs font-semibold text-label tabular-nums">
                          {s}
                          {m ? `/${m}` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-system-fill/60 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${Math.min(100, m ? (s / m) * 100 : s)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {asArray(achievements).length > 0 && (
            <div className="card p-4">
              <h3 className="text-subheadline font-semibold text-label mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-system-orange" /> Achievements
              </h3>
              <div className="flex flex-wrap gap-2">
                {asArray(achievements).map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-system-orange/15 text-amber-700 dark:text-system-orange"
                  >
                    <Award className="w-3 h-3" />
                    {a.name || a.key || a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {ranking && !performance && (
        <div className="card p-4">
          <h3 className="text-subheadline font-semibold text-label mb-3">Ranking Summary</h3>
          <div className="space-y-1.5">
            <InfoRow label="Attendance Rate" value={`${R(ranking.attendance_rate)}%`} />
            <InfoRow label="Members" value={ranking.member_count || 0} />
            <InfoRow label="Present" value={ranking.total_present || 0} />
            <InfoRow label="Absent" value={ranking.total_absent || 0} />
            <InfoRow label="Retention" value={`${R(ranking.retention_rate)}%`} />
            <InfoRow label="Performance Score" value={`${R(ranking.performance_score)}/100`} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SectionProfile = ({ sectionId, sectionName, onBack }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashData, setDashData] = useState(null); // { section, members, leaders, trends, submissions }
  const [rankings, setRankings] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [comparison, setComparison] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, rankRes, compRes] = await Promise.all([
        adminAPI.getSectionDashboard(sectionId),
        analyticsAPI.getSectionRankings(90).catch(() => ({ data: [] })),
        analyticsAPI.getSectionComparison(90).catch(() => ({ data: [] }))
      ]);
      setDashData(dashRes.data);
      setRankings(asArray(rankRes.data));
      setComparison(asArray(compRes.data));
      try {
        const perfRes = await adminAPI.getPerformanceProfile('section', sectionId, 'month');
        setPerformance(perfRes.data);
      } catch (_) {
        /* no performance data yet */
      }
    } catch (e) {
      console.error('Section profile load failed:', e);
      setError('Failed to load section data.');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  if (error || !dashData)
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-700 dark:text-system-orange" />
        <p className="text-sm font-semibold text-secondary-label">{error || 'Section not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200"
        >
          Back to Sections
        </button>
      </div>
    );

  const { section, members, leaders, trends, submissions } = dashData;
  const ranking = rankings.find((s) => Number(s.id) === Number(sectionId));
  const rank = ranking ? rankings.indexOf(ranking) + 1 : null;
  const compData = comparison.find((c) => Number(c.id) === Number(sectionId));
  const headLeader = asArray(leaders).find((l) => l.is_head);
  const activeMembers = asArray(members).filter((m) => m.is_active);
  const inactiveMembers = asArray(members).filter((m) => !m.is_active);

  const totalTrendRecords = asArray(trends).reduce(
    (s, t) => s + R(t.present_count) + R(t.absent_count) + R(t.excused_count),
    0
  );
  const totalTrendPresent = asArray(trends).reduce((s, t) => s + R(t.present_count), 0);
  const totalTrendAbsent = asArray(trends).reduce((s, t) => s + R(t.absent_count), 0);
  const totalTrendExcused = asArray(trends).reduce((s, t) => s + R(t.excused_count), 0);
  const attendanceRate =
    totalTrendRecords > 0
      ? Math.round((totalTrendPresent / totalTrendRecords) * 100)
      : R(ranking?.attendance_rate || ranking?.attendanceRate || 0);
  const performanceScore = performance?.score || ranking?.performance_score || 0;

  const exportSectionPDF = async () => {
    const [{ default: jsPDF }, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    let matrixData = [];
    let weeksList = [];
    try {
      const matrixRes = await analyticsAPI.getMemberWeeklyMatrix({ sectionId, weeks: 12 });
      matrixData = asArray(matrixRes.data?.matrix);
      weeksList = asArray(matrixRes.data?.weeks);
    } catch (_) {
      /* matrix may not load */
    }

    const doc = new jsPDF({ orientation: weeksList.length > 8 ? 'landscape' : 'portrait' });
    const pw = doc.internal.pageSize.getWidth();
    const m = 15;
    let y = 20;

    const sectionTitle = section.name || sectionName || 'Section Report';
    const today = new Date().toLocaleDateString();

    const addSectionHeader = (title) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(124, 58, 237);
      doc.text(title, m, y);
      y += 2;
      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.5);
      doc.line(m, y, pw - m, y);
      y += 6;
      doc.setTextColor(51, 51, 51);
    };

    const tableDefaults = {
      margin: { left: m, right: m },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    };

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pw, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(sectionTitle, m, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shekina Church · ${today} · ${activeMembers.length} active members`, m, 28);
    doc.setFontSize(9);
    doc.text(
      `Attendance: ${attendanceRate}% · Performance: ${R(performanceScore)}/100 · Leaders: ${asArray(leaders).length}`,
      m,
      34
    );
    y = 48;

    addSectionHeader('Section Summary');
    autoTableMod.default(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Active Members', String(activeMembers.length)],
        ['Inactive Members', String(inactiveMembers.length)],
        ['Total Members', String(asArray(members).length)],
        ['Attendance Rate (90d)', `${attendanceRate}%`],
        ['Present (90d)', String(totalTrendPresent)],
        ['Absent (90d)', String(totalTrendAbsent)],
        ['Excused (90d)', String(totalTrendExcused)],
        ['Performance Score', `${R(performanceScore)}/100`],
        ['Leaders', String(asArray(leaders).length)],
        ['Submissions (90d)', String(asArray(submissions).length)],
        ['Rank', rank ? `#${rank}` : 'N/A']
      ],
      ...tableDefaults
    });
    y = doc.lastAutoTable.finalY + 12;

    if (asArray(leaders).length > 0) {
      addSectionHeader('Section Leaders');
      autoTableMod.default(doc, {
        startY: y,
        head: [['Name', 'Role', 'Phone']],
        body: asArray(leaders).map((l) => [
          l.full_name || 'N/A',
          l.is_head ? 'Head Leader' : 'Leader',
          l.phone || 'N/A'
        ]),
        ...tableDefaults
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (asArray(members).length > 0) {
      addSectionHeader('Members');
      autoTableMod.default(doc, {
        startY: y,
        head: [['#', 'Name', 'Member ID', 'Phone', 'Leader', 'Status', 'Points']],
        body: asArray(members).map((mb, i) => [
          String(i + 1),
          mb.full_name || 'N/A',
          mb.membership_id || 'N/A',
          mb.phone || 'N/A',
          mb.leader_name || 'N/A',
          mb.is_active ? 'Active' : 'Inactive',
          String(R(mb.hall_of_fame_points || 0))
        ]),
        ...tableDefaults,
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 8 } }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (asArray(trends).length > 0) {
      addSectionHeader('Attendance Trends (90 Days)');
      const trendsSorted = [...asArray(trends)].reverse();
      autoTableMod.default(doc, {
        startY: y,
        head: [['Date', 'Present', 'Absent', 'Excused', 'Total', 'Rate']],
        body: trendsSorted.map((t) => {
          const tot = R(t.present_count) + R(t.absent_count) + R(t.excused_count);
          const pct = tot > 0 ? Math.round((R(t.present_count) / tot) * 100) : 0;
          return [
            fdate(t.date),
            String(R(t.present_count)),
            String(R(t.absent_count)),
            String(R(t.excused_count)),
            String(tot),
            `${pct}%`
          ];
        }),
        ...tableDefaults,
        styles: { fontSize: 8, cellPadding: 2 }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    const STATUS_SHORT = { present: 'P', absent: 'A', excused: 'E' };
    if (matrixData.length > 0 && weeksList.length > 0) {
      addSectionHeader('Weekly Attendance Matrix (12 Weeks)');
      const weekHeaders = weeksList.map((w) => {
        const [, wk] = String(w).split('-W').map(Number);
        return wk ? `W${wk}` : w;
      });
      const nameW = 30;
      const weekW = Math.floor((pw - m * 2 - nameW) / weeksList.length);
      const rowH = 5.5;
      const headerH = 6;
      const headerY = y;

      doc.setFillColor(124, 58, 237);
      doc.rect(m, headerY, pw - m * 2, headerH, 'F');
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Member', m + 1, headerY + 4.2);
      weekHeaders.forEach((wh, i) => {
        doc.text(wh, m + nameW + i * weekW + weekW / 2, headerY + 4.2, { align: 'center' });
      });
      y = headerY + headerH + 1;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      matrixData.forEach((row, ri) => {
        if (y + rowH > doc.internal.pageSize.getHeight() - 15) {
          doc.addPage();
          y = 20;
          doc.setFillColor(124, 58, 237);
          doc.rect(m, y, pw - m * 2, headerH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(5.5);
          doc.text('Member', m + 1, y + 4.2);
          weekHeaders.forEach((wh, i) => {
            doc.text(wh, m + nameW + i * weekW + weekW / 2, y + 4.2, { align: 'center' });
          });
          y += headerH + 1;
          doc.setFont('helvetica', 'normal');
        }
        if (ri % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(m, y, pw - m * 2, rowH, 'F');
        }
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(5.5);
        const name =
          (row.full_name || 'N/A').length > 20
            ? (row.full_name || 'N/A').slice(0, 18) + '..'
            : row.full_name || 'N/A';
        doc.text(name, m + 1, y + 4);
        const weekly = asArray(row.weekly);
        weeksList.forEach((_, i) => {
          const status = STATUS_SHORT[weekly[i]] || '·';
          if (status === 'P') doc.setTextColor(16, 185, 129);
          else if (status === 'A') doc.setTextColor(239, 68, 68);
          else if (status === 'E') doc.setTextColor(245, 158, 11);
          else doc.setTextColor(148, 163, 184);
          doc.setFont('helvetica', 'bold');
          doc.text(status, m + nameW + i * weekW + weekW / 2, y + 4, { align: 'center' });
        });
        doc.setFont('helvetica', 'normal');
        y += rowH;
      });
      y += 8;
    }

    if (asArray(submissions).length > 0) {
      addSectionHeader('Submission History');
      autoTableMod.default(doc, {
        startY: y,
        head: [['Date', 'Leader', 'Records', 'Submitted At']],
        body: asArray(submissions).map((s) => [
          fdate(s.date),
          s.leader_name || 'N/A',
          String(s.records_count || 0),
          s.submitted_at ? fdatetime(s.submitted_at) : 'N/A'
        ]),
        ...tableDefaults
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    const breakdownItems = performance?.breakdown
      ? Array.isArray(performance.breakdown)
        ? performance.breakdown.map((item) => ({
            label: item.label || item.key?.replace(/_/g, ' '),
            score: item.score ?? item.points ?? 0,
            max: item.max || 100
          }))
        : Object.entries(performance.breakdown).map(([k, v]) => ({
            label: k.replace(/_/g, ' '),
            score: typeof v === 'object' ? (v.score ?? 0) : Number(v) || 0,
            max: typeof v === 'object' ? v.max : 100
          }))
      : [];

    if (performance && (breakdownItems.length > 0 || performanceScore > 0)) {
      addSectionHeader('Performance Breakdown');
      const perfBody = [['Overall Score', `${R(performanceScore)}/100`]];
      breakdownItems.forEach((item) => {
        perfBody.push([`  ${item.label}`, `${R(item.score)}/${item.max}`]);
      });
      const achievements = performance?.achievements || performance?.entity?.badges || [];
      if (asArray(achievements).length > 0) {
        perfBody.push([
          'Badges',
          asArray(achievements)
            .map((a) => a.name || a.key || a)
            .join(', ')
        ]);
      }
      if (compData) {
        perfBody.push([
          'Trend vs Previous',
          `${compData.trend >= 0 ? '+' : ''}${R(compData.trend)}%`
        ]);
        perfBody.push([
          'Previous Rate',
          `${R(compData.prev_attendance_rate || compData.prevRate)}%`
        ]);
      }
      autoTableMod.default(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: perfBody,
        ...tableDefaults
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (asArray(rankings).length > 0) {
      addSectionHeader('All Sections Ranking');
      autoTableMod.default(doc, {
        startY: y,
        head: [['Rank', 'Section', 'Members', 'Rate', 'Present']],
        body: asArray(rankings).map((s, i) => [
          `#${i + 1}`,
          s.name || 'N/A',
          String(s.member_count || 0),
          `${R(s.attendance_rate)}%`,
          String(s.total_present || 0)
        ]),
        ...tableDefaults,
        styles: { fontSize: 8, cellPadding: 2 }
      });
    }

    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pc} · ${sectionTitle} · Shekina Church Management System`,
        m,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(
      `${sectionTitle.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`
    );
  };

  const exportLeadersPDF = async () => {
    const [{ default: jsPDF }, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 20;
    let y = 20;

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pw, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Section Leaders', m, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${section.name || sectionName || ''} · ${new Date().toLocaleDateString()} · ${asArray(leaders).length} leaders`,
      m,
      28
    );
    y = 45;

    doc.setTextColor(51, 51, 51);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Leadership Roster', m, y);
    y += 8;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;

    if (asArray(leaders).length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('No leaders assigned to this section.', m, y);
    } else {
      autoTableMod.default(doc, {
        startY: y,
        head: [['#', 'Name', 'Role', 'Phone']],
        body: asArray(leaders).map((l, i) => [
          String(i + 1),
          l.full_name || 'N/A',
          l.is_head ? 'Head Leader' : 'Leader',
          l.phone || 'N/A'
        ]),
        margin: { left: m, right: m },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    }

    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pc} | Shekina Church Management System`,
        m,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(
      `${(section.name || 'section').replace(/\s+/g, '_')}_leaders_${new Date().toISOString().split('T')[0]}.pdf`
    );
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-label transition-colors hover:text-label focus-ring rounded-md"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sections
      </button>

      {/* ── Header Banner ─────────────────────────────────────── */}
      <div className="product-surface relative px-5 py-5 sm:px-6">
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/[0.12] flex items-center justify-center text-primary-700 dark:text-primary-300">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-title-2 font-semibold text-label">
                {section.name || sectionName || 'Section'}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-footnote text-secondary-label">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />{' '}
                  <span className="tabular-nums">{activeMembers.length}</span> active members
                </span>
                {headLeader && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/leaders?profile=${headLeader.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-500/[0.12] hover:bg-primary-500/20 transition-colors font-semibold text-primary-700 dark:text-primary-300 focus-ring"
                  >
                    <Crown className="w-3.5 h-3.5" /> {headLeader.full_name}
                  </button>
                )}
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />{' '}
                  <span className="tabular-nums">{asArray(leaders).length}</span> leaders
                </span>
              </div>
            </div>
          </div>
          {rank && (
            <div className="text-right shrink-0">
              <p className="section-eyebrow">Rank</p>
              <p className="text-title-1 font-semibold text-label tabular-nums">#{rank}</p>
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="relative flex gap-2 mt-3">
          <button onClick={exportSectionPDF} className="btn-secondary btn-sm focus-ring">
            <Download className="w-3.5 h-3.5" /> Section Report
          </button>
          <button onClick={exportLeadersPDF} className="btn-secondary btn-sm focus-ring">
            <Download className="w-3.5 h-3.5" /> Leaders PDF
          </button>
        </div>

        {/* KPI Row */}
        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-2.5 mt-4">
          <KpiBox label="Active Members" value={activeMembers.length} />
          <KpiBox label="Attendance Rate" value={`${attendanceRate}%`} />
          <KpiBox label="Performance" value={`${R(performanceScore)}/100`} />
          <KpiBox label="Leaders" value={asArray(leaders).length} />
          <KpiBox label="Submissions (90d)" value={asArray(submissions).length} />
        </div>
      </div>

      {/* ── Subtabs ──────────────────────────────────────────── */}
      <div className="tab-pills max-w-full overflow-x-auto scrollbar-hide">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap ${tab === t.key ? 'tab-pill active' : 'tab-pill'}`}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────── */}
      {tab === 'overview' && (
        <SectionOverview
          section={section}
          ranking={ranking}
          performance={performance}
          leaders={leaders}
          activeMembers={activeMembers}
          inactiveMembers={inactiveMembers}
          compData={compData}
          trends={trends}
          attendanceRate={attendanceRate}
          navigate={navigate}
        />
      )}
      {tab === 'members' && <SectionMembers members={members} navigate={navigate} />}
      {tab === 'matrix' && (
        <WeeklyAttendanceMatrix
          sectionId={sectionId}
          title={`Weekly Attendance Matrix - ${section.name || sectionName}`}
        />
      )}
      {tab === 'analytics' && (
        <SectionAnalytics
          ranking={ranking}
          compData={compData}
          rankings={rankings}
          trends={trends}
        />
      )}
      {tab === 'submissions' && <SectionSubmissions submissions={submissions} />}
      {tab === 'performance' && <SectionPerformance performance={performance} ranking={ranking} />}
    </div>
  );
};
export default SectionProfile;
