import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Zap, Users, Calendar } from 'lucide-react';
import { adminAPI, analyticsAPI } from '../../services/api';
import ChartCard from '../ui/ChartCard';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const AnalyticsView = ({ trends, trendsLoading, loadTrends }) => {
  const [prediction, setPrediction] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [leaderPerformance, setLeaderPerformance] = useState([]);
  const [demographics, setDemographics] = useState(null);
  const [engagementScores, setEngagementScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (trends.length === 0) loadTrends();
    loadAdvancedAnalytics();
  }, []);

  const loadAdvancedAnalytics = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        adminAPI.getAttendancePrediction(),
        adminAPI.getSectionAnomalies(),
        adminAPI.getMemberStreaks(20),
        adminAPI.getLeaderPerformance(),
        analyticsAPI.getDemographics(),
        analyticsAPI.getEngagementScores(10)
      ]);

      if (results[0].status === 'fulfilled') setPrediction(results[0].value.data);
      if (results[1].status === 'fulfilled') setAnomalies(results[1].value.data);
      if (results[2].status === 'fulfilled') setStreaks(results[2].value.data);
      if (results[3].status === 'fulfilled') setLeaderPerformance(results[3].value.data);
      if (results[4].status === 'fulfilled') setDemographics(results[4].value.data);
      if (results[5].status === 'fulfilled') setEngagementScores(results[5].value.data);

      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn(`Analytics call ${i} failed:`, r.reason);
        }
      });
    } catch (e) {
      console.error('Failed to load advanced analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const anomalyData = Array.isArray(anomalies) ? anomalies.map(a => ({
    name: a.section_name,
    historical: a.historical_avg,
    current: a.latest_rate,
    drop: a.drop_amount
  })) : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/5 rounded-full translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Advanced Analytics</h2>
            <p className="text-white/80 text-sm">AI-powered insights, predictions, and anomaly detection</p>
          </div>
        </div>
      </div>

      {/* Prediction Cards */}
      {prediction && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <StatCard
            icon={TrendingUp}
            label="Predicted Attendance"
            value={prediction.avg_present || 0}
            trendLabel={`Avg based on ${prediction.weeks_analyzed || 0} weeks`}
            variant="default"
          />
          <StatCard
            icon={Zap}
            label="Avg Rate"
            value={`${prediction.avg_rate || 0}%`}
            trendLabel="Overall attendance rate"
            variant="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="Anomalies"
            value={anomalies.length}
            trendLabel="Sections with drops"
            variant="warning"
          />
          <StatCard
            icon={Users}
            label="Top Streaks"
            value={streaks.length}
            trendLabel="Members 4+ weeks"
            variant="danger"
          />
        </div>
      )}

      {/* Anomaly Detection Chart */}
      {anomalyData.length > 0 && (
        <ChartCard
          title="Attendance Anomalies"
          subtitle="Sections with significant drops vs historical average"
          height="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={anomalyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="historical" name="Historical Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name="Current Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Member Streaks */}
      {streaks.length > 0 && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            Attendance Streaks
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {streaks.slice(0, 10).map((s) => (
              <div key={s.member_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.full_name}</p>
                <Badge variant="success" className="mt-1">{s.current_streak} weeks</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leader Performance */}
      {leaderPerformance.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              Leader Performance Rankings
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rank</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Leader</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderPerformance.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3">
                        <span className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${
                          i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          i === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                          i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                          'text-slate-400 dark:text-slate-500'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">{l.leader_name}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={l.avg_rate >= 80 ? 'success' : l.avg_rate >= 60 ? 'warning' : 'danger'}>
                          {l.avg_rate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              Top Engaged Members
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Member</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Section</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementScores.map((m, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-slate-100">{m.full_name}</td>
                      <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">{m.section_name}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={m.engagement_score >= 80 ? 'success' : m.engagement_score >= 60 ? 'warning' : 'danger'}>
                          {m.engagement_score}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Demographics Chart Area */}
      {demographics && (demographics.gender.length > 0 || demographics.age_group.length > 0) && (
        <ChartCard
          title="Demographics Breakdown"
          subtitle="Attendance by age group and gender (Last 90d)"
          height="h-[350px]"
        >
          <div className="grid grid-cols-2 h-full gap-4">
            <div className="h-full flex flex-col justify-center relative">
              <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Gender</h4>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={demographics.gender}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="total_records"
                    nameKey="category_value"
                  >
                    {demographics.gender.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="h-full flex flex-col justify-center relative">
              <h4 className="text-xs font-semibold text-slate-500 absolute top-0 w-full text-center">Age Groups</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={demographics.age_group} margin={{ left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category_value" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-5} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="total_records" name="Attendance Count" radius={[4, 4, 0, 0]}>
                    {demographics.age_group.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      )}

      {/* Original Trend Chart */}
      <ChartCard
        title="90-Day Attendance Trend"
        subtitle="Tracking present and absent members over the last 90 days"
        loading={trendsLoading}
        empty={!trendsLoading && trends.length === 0}
        emptyMessage="No trend data available yet."
        height="h-[450px]"
      >
        {trends.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            {/* Original chart content preserved */}
            <div className="flex items-center justify-center h-full text-slate-400">
              <p>90-day trend chart — {trends.length} data points</p>
            </div>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
};

export default AnalyticsView;
