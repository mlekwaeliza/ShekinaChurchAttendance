import React, { useEffect } from 'react';
import { useBreadcrumbs } from '../../context/BreadcrumbContext';
import { X, FolderOpen, Phone, Mail, Users, FileText, TrendingUp } from 'lucide-react';
import { fdate, fdatetime } from '../../utils/date';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const LeaderDrilldown = ({ drilldownData, onClose }) => {
  const { setCrumbs } = useBreadcrumbs();

  useEffect(() => {
    if (drilldownData && drilldownData.data) {
      const leaderName = drilldownData.data.leader.full_name;
      setCrumbs([{ label: leaderName, path: '/admin/leaders', icon: 'UserCog' }]);
    }
  }, [drilldownData, setCrumbs]);

  if (!drilldownData) return null;

  if (drilldownData.loading) {
    return (
      <div className="animate-fade-in bg-black/30 dark:bg-black/60 backdrop-blur-sm fixed inset-0 z-[150] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin-slow" />
          <p className="text-white font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { leader, roster, trends, history } = drilldownData.data;

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-[150] flex justify-center pt-8 pb-8 px-4 overflow-hidden animate-fade-in">
      <div className="bg-secondary-system-grouped-background w-full max-w-6xl rounded-[1.25rem] shadow-modal border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-separator/60 px-6 py-5 sm:px-8 dark:border-white/[0.08] shrink-0">
          <div className="min-w-0">
            <p className="section-eyebrow">Leader Analytics</p>
            <h2 className="mt-0.5 truncate text-title-2 font-semibold text-label">
              {leader.full_name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-footnote text-secondary-label">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                {leader.section_name}
              </span>
              {leader.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {leader.phone}
                </span>
              )}
              {leader.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {leader.email}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost text-secondary-label focus-ring">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Stats & Roster */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="card p-5">
                <h4 className="mb-4 flex items-center gap-2 text-subheadline font-semibold text-label">
                  <TrendingUp className="h-4 w-4 text-primary-700 dark:text-primary-300" />
                  Quick Stats
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-system-grouped-background/60 dark:bg-white/[0.03] p-4 rounded-xl border border-separator/50 dark:border-white/[0.06]">
                    <p className="mb-1 text-caption-1 font-medium text-secondary-label">Members</p>
                    <p className="text-title-3 font-semibold text-primary-700 dark:text-primary-300 tabular-nums">
                      {roster.length}
                    </p>
                  </div>
                  <div className="bg-system-grouped-background/60 dark:bg-white/[0.03] p-4 rounded-xl border border-separator/50 dark:border-white/[0.06]">
                    <p className="mb-1 text-caption-1 font-medium text-secondary-label">
                      Submissions
                    </p>
                    <p className="text-title-3 font-semibold text-label tabular-nums">
                      {history.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Roster */}
              <div className="card flex flex-col" style={{ maxHeight: '450px' }}>
                <div className="px-5 py-4 border-b border-separator/60 dark:border-white/[0.08] shrink-0">
                  <h4 className="flex items-center gap-2 text-subheadline font-semibold text-label">
                    <Users className="h-4 w-4 text-emerald-700 dark:text-system-green" />
                    Member Roster
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
                  {roster.map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-2.5 rounded-lg transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
                    >
                      <p className="text-subheadline font-medium text-label">{m.full_name}</p>
                      <p className="text-caption-1 text-tertiary-label font-mono mt-0.5">
                        {m.membership_id}
                      </p>
                    </div>
                  ))}
                  {roster.length === 0 && (
                    <p className="text-footnote text-secondary-label py-8 text-center">
                      No members assigned
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Charts & History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trend Chart */}
              <div className="card p-5">
                <h4 className="mb-4 flex items-center gap-2 text-subheadline font-semibold text-label">
                  <TrendingUp className="h-4 w-4 text-blue-700 dark:text-system-blue" />
                  90-Day Engagement Trend
                </h4>
                <div className="h-[300px]">
                  {trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="drillPresent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14a896" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#14a896" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c7c7cc" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8e8e93', fontSize: 11 }}
                          dy={8}
                          minTickGap={20}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8e8e93', fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid rgba(0,0,0,0.06)',
                            boxShadow: '0 8px 28px rgba(16,24,40,0.12)',
                            padding: '10px 14px',
                            fontSize: 12
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="present_count"
                          name="Present"
                          stroke="#14a896"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#drillPresent)"
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="absent_count"
                          name="Absent"
                          stroke="#ff3b30"
                          strokeWidth={1.5}
                          fillOpacity={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-footnote text-secondary-label">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>

              {/* Submission History */}
              <div className="table-container">
                <div className="px-6 py-4 border-b border-separator/60 dark:border-white/[0.08]">
                  <h4 className="flex items-center gap-2 text-subheadline font-semibold text-label">
                    <FileText className="h-4 w-4 text-amber-700 dark:text-system-orange" />
                    Past Submissions
                  </h4>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Service Date</th>
                      <th className="text-center">Records</th>
                      <th className="text-center">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length > 0 ? (
                      history.map((log, i) => (
                        <tr key={i}>
                          <td>
                            <span className="font-semibold text-label">{fdate(log.date)}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge-info font-mono">{log.records_count}</span>
                          </td>
                          <td className="text-center text-caption-1 text-secondary-label tabular-nums">
                            {fdatetime(log.submitted_at)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          <p className="text-footnote text-secondary-label py-8 text-center">
                            No submissions logged yet.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderDrilldown;
