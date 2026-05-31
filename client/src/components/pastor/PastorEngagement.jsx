import React, { useState, useEffect } from 'react';
import { pastorAPI } from '../../services/api';
import { TrendingUp, MessageSquare, CheckCircle, Users, Calendar, Award } from 'lucide-react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { addDays, formatLocalDate } from '../../utils/date';

const PastorEngagement = () => {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => ({
    start: formatLocalDate(addDays(new Date(), -30)),
    end: formatLocalDate(),
  }));

  useEffect(() => {
    loadEngagement();
  }, [dateRange]);

  const loadEngagement = async () => {
    setLoading(true);
    try {
      const res = await pastorAPI.getEngagementScores(dateRange);
      setScores(res.data);
    } catch (e) {
      console.error('Failed to load engagement scores:', e);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const scoreVariant = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  const scoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Great';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Inactive';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.engagement_score, 0) / scores.length)
    : 0;

  const activeLeaders = scores.filter(s => s.total_outreach > 0 || s.followups_completed > 0).length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Leader Engagement</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track how active your leaders are with outreach and follow-ups</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-700 dark:text-slate-300"
          />
          <span className="text-slate-300 dark:text-slate-600 text-sm">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-700 dark:text-slate-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Award} label="Avg Engagement" value={`${avgScore}%`} variant={scoreVariant(avgScore)} />
        <StatCard icon={Users} label="Active Leaders" value={activeLeaders} variant="info" />
        <StatCard icon={MessageSquare} label="Total Outreach" value={scores.reduce((s, l) => s + l.total_outreach, 0)} variant="success" />
        <StatCard icon={CheckCircle} label="Follow-ups Done" value={scores.reduce((s, l) => s + l.followups_completed, 0)} variant="warning" />
      </div>

      <div className="card">
        <DataTable
          columns={[
            {
              accessor: 'leader_name',
              header: 'Leader',
              sortable: true,
              render: (row) => <span className="font-semibold text-slate-900 dark:text-white">{row.leader_name}</span>
            },
            {
              accessor: 'section_name',
              header: 'Section',
              sortable: true,
              render: (row) => <Badge variant="info">{row.section_name}</Badge>
            },
            {
              accessor: 'engagement_score',
              header: 'Score',
              sortable: true,
              align: 'center',
              render: (row) => (
                <div className="flex flex-col items-center">
                  <span className={`text-lg font-bold ${scoreColor(row.engagement_score)}`}>{row.engagement_score}%</span>
                  <Badge variant={scoreVariant(row.engagement_score)} className="text-xs">{scoreLabel(row.engagement_score)}</Badge>
                </div>
              )
            },
            {
              accessor: 'submissions',
              header: 'Submissions',
              sortable: true,
              align: 'center',
              render: (row) => <span className="text-sm text-slate-600 dark:text-slate-400">{row.submissions}</span>
            },
            {
              accessor: 'members_contacted',
              header: 'Members Contacted',
              sortable: true,
              align: 'center',
              render: (row) => (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {row.members_contacted}
                </span>
              )
            },
            {
              accessor: 'total_outreach',
              header: 'Outreach Logs',
              sortable: true,
              align: 'center',
              render: (row) => (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {row.total_outreach}
                </span>
              )
            },
            {
              accessor: 'followups_completed',
              header: 'Follow-ups',
              sortable: true,
              align: 'center',
              render: (row) => (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {row.followups_completed}/{row.total_followups}
                </span>
              )
            },
            {
              accessor: 'section_attendance_rate',
              header: 'Section Rate',
              sortable: true,
              align: 'center',
              render: (row) => <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.section_attendance_rate}%</span>
            },
          ]}
          data={scores}
          searchable={true}
          searchPlaceholder="Search leaders..."
          searchKeys={['leader_name', 'section_name']}
          emptyTitle="No engagement data"
          emptyDescription="Engagement scores will appear once leaders start logging outreach."
        />
      </div>
    </div>
  );
};

export default PastorEngagement;
