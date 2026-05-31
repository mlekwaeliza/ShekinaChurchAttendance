import React, { useEffect } from 'react';
import { useBreadcrumbs } from '../../context/BreadcrumbContext';
import { X, FolderOpen, Phone, Mail, Users, FileText, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const LeaderDrilldown = ({ drilldownData, onClose }) => {
  const { setCrumbs, clearCrumbs } = useBreadcrumbs();

  useEffect(() => {
    if (drilldownData && drilldownData.data) {
      const leaderName = drilldownData.data.leader.full_name;
      setCrumbs([
        { label: leaderName, path: '/admin/leaders', icon: 'UserCog' }
      ]);
    }
  }, [drilldownData, setCrumbs]);

  if (!drilldownData) return null;

  if (drilldownData.loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin-slow" />
          <p className="text-white font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { leader, roster, trends, history } = drilldownData.data;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex justify-center pt-8 pb-8 px-4 overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-2xl shadow-modal overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-8 py-6 flex justify-between items-start text-white shrink-0">
          <div>
            <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-1">
              Leader Analytics
            </p>
            <h2 className="text-2xl font-bold">{leader.full_name}</h2>
            <div className="flex items-center gap-4 mt-2.5 text-primary-100 text-sm">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                {leader.section_name}
              </span>
              {leader.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {leader.phone}
                </span>
              )}
              {leader.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {leader.email}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Stats & Roster */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="card p-5">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-500" />
                  Quick Stats
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Members</p>
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                      {roster.length}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Submissions</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {history.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Roster */}
              <div className="card flex flex-col" style={{ maxHeight: '450px' }}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    Member Roster
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
                  {roster.map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.full_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {m.membership_id}
                      </p>
                    </div>
                  ))}
                  {roster.length === 0 && (
                    <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-500" />
                  90-Day Engagement Trend
                </h4>
                <div className="h-[300px]">
                  {trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="drillPresent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          dy={8}
                          minTickGap={20}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                            padding: '10px 14px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="present_count"
                          name="Present"
                          stroke="#059669"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#drillPresent)"
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="absent_count"
                          name="Absent"
                          stroke="#E11D48"
                          strokeWidth={1.5}
                          fillOpacity={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>

              {/* Submission History */}
              <div className="table-container">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
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
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{log.date}</span>
                          </td>
                          <td className="text-center">
                            <span className="badge-info font-mono">{log.records_count}</span>
                          </td>
                          <td className="text-center text-slate-500 dark:text-slate-400 text-xs tabular-nums">
                            {new Date(log.submitted_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          <p className="text-center text-sm text-slate-400 py-8">
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
