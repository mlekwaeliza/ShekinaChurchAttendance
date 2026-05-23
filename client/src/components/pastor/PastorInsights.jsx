import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { analyticsAPI } from '../../services/api';
import { 
  TrendingUp, Sparkles, AlertTriangle, Flame, ShieldAlert,
  CalendarDays, Activity, Users, Target, UserPlus
} from 'lucide-react';

import StatCard from '../ui/StatCard';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import LoadingSkeleton from '../ui/LoadingSkeleton';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const PastorInsights = () => {
  const [data, setData] = useState({
    predictions: null,
    anomalies: [],
    streaks: [],
    leaderTrends: [],
    engagementScores: [],
    demographics: null,
    yoy: [],
    retention: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [
          predRes,
          anomRes,
          streakRes,
          leaderRes,
          engageRes,
          demoRes,
          yoyRes,
          retRes
        ] = await Promise.all([
          analyticsAPI.getPredictions(),
          analyticsAPI.getAnomalies(15), // Threshold e.g. 15%
          analyticsAPI.getStreaks(10),
          analyticsAPI.getLeaderTrends(),
          analyticsAPI.getEngagementScores(20),
          analyticsAPI.getDemographics(),
          analyticsAPI.getYearOverYear(),
          analyticsAPI.getRetention(90)
        ]);

        if (isMounted) {
          setData({
            predictions: predRes.data,
            anomalies: anomRes.data,
            streaks: streakRes.data,
            leaderTrends: leaderRes.data,
            engagementScores: engageRes.data,
            demographics: demoRes.data,
            yoy: yoyRes.data,
            retention: retRes.data
          });
        }
      } catch (err) {
        console.error('Failed to load insights:', err);
        if (isMounted) setError('Failed to load insights data');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <LoadingSkeleton className="h-24 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <LoadingSkeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <LoadingSkeleton className="h-[400px] rounded-3xl" />
          <LoadingSkeleton className="h-[400px] rounded-3xl" />
        </div>
        <LoadingSkeleton className="h-[500px] rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  const { 
    predictions, anomalies, streaks, leaderTrends, 
    engagementScores, demographics, yoy, retention 
  } = data;

  // Formatting configurations DataTables
  const engagementColumns = [
    { accessor: 'member_id', header: 'Rank', render: (_, idx) => <span className="text-slate-400 font-medium">#{idx + 1}</span>, sortable: false, align: 'center' },
    { accessor: 'full_name', header: 'Name', sortable: true, render: (row) => <span className="font-semibold text-slate-900 dark:text-slate-100">{row.full_name}</span> },
    { accessor: 'section_name', header: 'Section', sortable: true },
    { accessor: 'consistency', header: 'Consistency (90d)', sortable: true, align: 'center', render: (row) => `${row.consistency}%` },
    { accessor: 'streak', header: 'Current Streak', sortable: true, align: 'center', render: (row) => (
      <span className="flex items-center justify-center gap-1">
        <Flame className="w-3.5 h-3.5 text-amber-500" />
        <span className="font-medium text-slate-700 dark:text-slate-300">{row.streak}</span>
      </span>
    ) },
    { accessor: 'engagement_score', header: 'Score', sortable: true, align: 'center', render: (row) => {
      const s = row.engagement_score;
      const v = s >= 80 ? 'success' : s >= 60 ? 'warning' : 'danger';
      return <Badge variant={v}>{s}</Badge>
    } }
  ];

  const leaderColumns = [
    { accessor: 'leader_name', header: 'Leader', sortable: true, render: row => <span className="font-semibold text-slate-900 dark:text-slate-100">{row.leader_name}</span> },
    { accessor: 'section_name', header: 'Section', sortable: true },
    { accessor: 'avg_rate', header: 'Avg Rate', sortable: true, align: 'center', render: row => <span className="font-medium">{row.avg_rate}%</span> },
    { accessor: 'trend_direction', header: 'Trend', sortable: true, align: 'center', render: row => {
      if (row.trend_direction === 'improving') return <Badge variant="success" className="gap-1 flex justify-center"><TrendingUp className="w-3 h-3"/> Improving</Badge>;
      if (row.trend_direction === 'declining') return <Badge variant="danger" className="gap-1 flex justify-center">Declining</Badge>;
      return <Badge variant="default" className="gap-1 flex justify-center">Stable</Badge>;
    }}
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-elevated border border-slate-200 dark:border-slate-700 p-3">
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {entry.name}: <span className="text-slate-900 dark:text-slate-100 font-bold">{entry.value}</span>
                {entry.name.includes('%') || entry.name.toLowerCase().includes('rate') ? '%' : ''}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 🚨 Anomalies Alert */}
      {anomalies && anomalies.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-3xl p-6 shadow-md text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
            <ShieldAlert className="w-40 h-40" />
          </div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Attention Required: Attendance Drops Detected</h3>
              <p className="text-white/90 text-sm mb-4">The following sections have dropped significantly below their 90-day average attendance rate.</p>
              <div className="flex flex-wrap gap-3">
                {anomalies.map((anom, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 flex items-center gap-3">
                    <span className="font-semibold">{anom.section_name}</span>
                    <span className="text-white/60">|</span>
                    <span className="text-sm">Avg: {anom.historical_avg}%</span>
                    <TrendingUp className="w-4 h-4 text-rose-200 rotate-[135deg]" />
                    <span className="text-rose-100 font-bold text-sm">Now: {anom.latest_rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Sparkles}
          label="Forecasted Average (Next 4w)"
          value={`${predictions?.forecast?.predicted_rate || 0}%`}
          trend={null}
          trendLabel={`Trend: ${predictions?.forecast?.trend || 'stable'}`}
          variant="info"
        />
        <StatCard
          icon={UserPlus}
          label="New Member Retention"
          value={`${retention?.retention_rate || 0}%`}
          trendLabel={`${retention?.still_attending || 0} retaining out of ${retention?.total_new_members || 0}`}
          variant="success"
        />
        <StatCard
          icon={Activity}
          label="Top Engagement Score"
          value={engagementScores[0] ? `${engagementScores[0].engagement_score}` : 'N/A'}
          trendLabel={engagementScores[0] ? engagementScores[0].full_name : ''}
          variant="default"
        />
        <StatCard
          icon={Flame}
          label="Longest Active Streak"
          value={streaks[0] ? `${streaks[0].current_streak} wks` : 'N/A'}
          trendLabel={streaks[0] ? streaks[0].full_name : ''}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* YoY Chart */}
        <ChartCard
          title="Year-over-Year Comparison"
          subtitle="Monthly attendance rates compared to last year"
          empty={!yoy || yoy.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yoy}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month_name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-10} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="current_year_rate" name="This Year %" stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="previous_year_rate" name="Last Year %" stroke={COLORS[3]} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Demographics Area */}
        <ChartCard
          title="Demographics Breakdown"
          subtitle="Attendance by age group and gender (Last 90d)"
          empty={!demographics || (demographics.gender.length === 0 && demographics.age_group.length === 0)}
        >
          <div className="grid grid-cols-2 h-full gap-4">
            <div className="h-full flex flex-col justify-center relative">
              <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Gender</h4>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={demographics?.gender || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="total_records"
                    nameKey="category_value"
                  >
                    {(demographics?.gender || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="h-full flex flex-col justify-center relative">
              <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Age Groups</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={demographics?.age_group || []} margin={{ left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category_value" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-5} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                  <Bar dataKey="total_records" name="Attendance Count" radius={[4, 4, 0, 0]}>
                    {(demographics?.age_group || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

      </div>

      {/* Bottom Grid for Lists/Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* 🔥 Top Streaks - Visual Cards */}
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top Perfect Streaks</h3>
          </div>
          <div className="space-y-3">
            {streaks && streaks.length > 0 ? streaks.map((streak, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between hover:border-amber-300 dark:hover:border-amber-700 transition-colors shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/50">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{streak.full_name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{streak.section_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end text-amber-600 dark:text-amber-400 font-bold text-lg">
                    {streak.current_streak} <Flame className="w-4 h-4 fill-amber-500/20" />
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Weeks</p>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500 border border-dashed rounded-2xl">
                No active streaks found.
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-8">
          {/* ⭐ Engagement Leaderboard */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Member Engagement Score Tracker</h3>
            </div>
            <DataTable
              data={engagementScores}
              columns={engagementColumns}
              searchable
              searchKeys={['full_name', 'section_name']}
              emptyTitle="No engagement data"
            />
          </div>

          {/* Leader Trends */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Section Leader Dynamics</h3>
            </div>
            <DataTable
              data={leaderTrends}
              columns={leaderColumns}
              searchable
              searchKeys={['leader_name', 'section_name']}
              emptyTitle="No leader trend data"
            />
          </div>
        </div>

      </div>

    </div>
  );
};

export default PastorInsights;
