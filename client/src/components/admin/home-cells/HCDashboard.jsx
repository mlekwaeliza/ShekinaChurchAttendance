import React, { useMemo } from 'react';
import {
  Home, Users, UserCheck, UserX, TrendingUp, Plus, UserPlus, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell as PieCell, Legend,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#6366f1'];

const KPI = ({ label, value, sub, icon: Icon, color }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-900/30')}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </div>
  </div>
);

const HCDashboard = ({ cells = [], onNavigate, onCreateCell, onAddMember }) => {
  const allMembers = useMemo(() => cells.flatMap(c => c.members || []), [cells]);
  const churchMembers = allMembers.filter(m => m.church_member_id);
  const cellOnly = allMembers.filter(m => !m.church_member_id);
  const totalLeaders = useMemo(() => {
    const ids = new Set();
    cells.forEach(c => (c.leaders || []).forEach(l => ids.add(l.leader_id)));
    return ids.size;
  }, [cells]);
  const atCapacity = cells.filter(c => c.max_capacity && (c.members || []).length >= c.max_capacity).length;
  const activeCells = cells.filter(c => c.is_active);

  const memberPerCell = cells
    .map(c => ({ name: c.name.replace('Home Cell ', 'HC '), count: (c.members || []).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const splitData = [
    { name: 'Church Members', value: churchMembers.length },
    { name: 'Cell-Only', value: cellOnly.length },
  ];

  const avgMembers = cells.length ? (allMembers.length / cells.length).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-6 text-white shadow-xl shadow-emerald-500/20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Home className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Home Cells Ministry</h2>
              <p className="text-sm text-white/80">{activeCells.length} active cells · {allMembers.length} total members</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCreateCell}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Cell
            </button>
            <button
              onClick={onAddMember}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Add Member
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KPI label="Total Cells" value={cells.length} icon={Home} color="text-emerald-600 dark:text-emerald-400" />
        <KPI label="Active Cells" value={activeCells.length} icon={TrendingUp} color="text-teal-600 dark:text-teal-400" />
        <KPI label="Total Members" value={allMembers.length} sub={`avg ${avgMembers}/cell`} icon={Users} color="text-blue-600 dark:text-blue-400" />
        <KPI label="Cell Leaders" value={totalLeaders} icon={UserCheck} color="text-violet-600 dark:text-violet-400" />
        <KPI label="Church Members" value={churchMembers.length} sub="registered in system" icon={UserCheck} color="text-indigo-600 dark:text-indigo-400" />
        <KPI label="Cell-Only Members" value={cellOnly.length} sub="not in members list" icon={UserX} color="text-amber-600 dark:text-amber-400" />
        <KPI label="At Capacity" value={atCapacity} sub={atCapacity > 0 ? 'cells need splitting' : 'all cells have space'} icon={BarChart2} color={atCapacity > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
        <KPI label="Cells No Leader" value={cells.filter(c => !(c.leaders || []).length).length} sub="need assignment" icon={UserX} color="text-orange-600 dark:text-orange-400" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Members per Cell */}
        <div className="col-span-2 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-slate-100">Members per Cell</h3>
          {memberPerCell.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={memberPerCell} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => [v, 'Members']}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No data yet</div>
          )}
        </div>

        {/* Member Type Split */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-slate-100">Member Breakdown</h3>
          {allMembers.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={splitData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {splitData.map((_, i) => <PieCell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend iconSize={10} />
                <Tooltip formatter={(v) => [v, 'members']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No members yet</div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-slate-100">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Create Home Cell', icon: Home, action: onCreateCell, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300' },
            { label: 'Assign Member', icon: UserPlus, action: onAddMember, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300' },
            { label: 'Manage Cells', icon: Home, action: () => onNavigate('cells'), color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300' },
            { label: 'View All Members', icon: Users, action: () => onNavigate('members'), color: 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300' },
            { label: 'Cell Leaders', icon: UserCheck, action: () => onNavigate('leaders'), color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300' },
          ].map(({ label, icon: Icon, action, color }) => (
            <button key={label} onClick={action}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${color}`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HCDashboard;
