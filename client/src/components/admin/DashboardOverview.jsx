import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Layers,
  UserCog,
  CheckCircle2,
  XCircle,
  Clock3,
  Cake,
  ShieldAlert,
  Calendar,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';

import QuickActionsBar from './QuickActionsBar';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import HallOfFamePreview from './HallOfFamePreview';
import LeadershipWidget from './LeadershipWidget';
import StatCard from '../ui/StatCard';
import { formatLocalDate } from '../../utils/date';

const DashboardOverview = ({
  allMembers = [],
  sections = [],
  leaders = [],
  pastorName = 'Pastor',
  dashboardMetrics,
  metricsLoading,
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  onAssignDutyRoster,
  lastUpdated = new Date(),
}) => {
  const navigate = useNavigate();

  const lastUpdatedStr = lastUpdated.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const attendanceContext = dashboardMetrics?.attendanceContext || { mode: 'today' };
  const isLatestAttendance = attendanceContext.mode === 'latest';
  const attendanceDateLabel = attendanceContext.date
    ? new Date(attendanceContext.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const serviceLabel = selectedServiceId === 'all'
    ? (isLatestAttendance ? 'All Services' : 'All Services Today')
    : (currentService?.name || 'Loading...');
  const attendanceTitle = isLatestAttendance ? 'Latest Attendance Session' : "Today's Attendance";
  const showingLabel = isLatestAttendance && attendanceDateLabel
    ? `${serviceLabel} - ${attendanceDateLabel}`
    : serviceLabel;

  const { comparisons, needsAttention, sparkline, hallOfFame } = dashboardMetrics || {};
  const welcomeName = pastorName?.trim() || 'Pastor';

  const totalMembers = comparisons?.total_members || allMembers.length;
  const newMembersMonth = comparisons?.new_members_month || 0;

  const todayStats = dashboardMetrics?.todayStats || { present: 0, absent: 0, excused: 0 };
  const totalToday = todayStats.present + todayStats.absent + todayStats.excused;
  const attendanceRate = totalToday > 0
    ? Math.round((todayStats.present / totalToday) * 100)
    : 0;

  const renderSparkline = () => {
    if (!sparkline || sparkline.length < 2) {
      return null;
    }

    const max = Math.max(...sparkline.map((item) => item.present_count), 5);
    const width = 100;
    const height = 30;
    const points = sparkline
      .map((item, index) => {
        const x = (index / (sparkline.length - 1)) * width;
        const y = height - (item.present_count / max) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width="60" height="20" className="overflow-visible">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="text-primary-500/50"
        />
      </svg>
    );
  };

  const todaysAttendanceSection = (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 p-8 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {attendanceTitle}
            <Sparkles className="w-5 h-5 text-amber-500" />
          </h3>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Showing: <span className="text-primary-600 dark:text-primary-400">{showingLabel}</span>
            </p>
            {selectedServiceId !== 'all' && (
              <button
                onClick={() => onAssignDutyRoster(formatLocalDate())}
                className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40"
              >
                <ShieldAlert className="w-3 h-3" />
                Duty Roster
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
              4-Week Trend
            </span>
            {renderSparkline()}
          </div>
          {totalToday > 0 && (
            <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2 dark:border-primary-800/30 dark:bg-primary-900/20">
              <span className="text-sm font-black text-primary-600 dark:text-primary-400">
                {attendanceRate}% Rate
              </span>
            </div>
          )}
        </div>
      </div>

      {totalToday === 0 ? (() => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = dayNames[new Date().getDay()];
        const isScheduledToday = selectedServiceId === 'all'
          || !currentService?.default_day
          || currentService.default_day === todayName;
        const lastSession = dashboardMetrics?.lastSession;

        return (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/30 py-12 dark:border-slate-700/50 dark:bg-slate-900/10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/30">
              <Zap className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>

            {isScheduledToday ? (
              <>
                <p className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  No attendance records yet
                </p>
                <p className="mb-6 max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">
                  Consistency is key. Start documenting today's {serviceLabel} to track progress.
                </p>
                <button
                  onClick={() => navigate('/admin/reports')}
                  className="rounded-2xl bg-primary-600 px-8 py-3 font-black text-white shadow-xl shadow-primary-500/20 transition-all hover:bg-primary-700 active:scale-95"
                >
                  Start Check-in
                </button>
              </>
            ) : (
              <>
                <p className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  No {currentService?.name || 'service'} scheduled today
                </p>
                <p className="mb-2 max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">
                  {currentService?.name || 'This service'} runs on{' '}
                  <span className="font-bold text-primary-600 dark:text-primary-400">
                    {currentService?.default_day || 'N/A'}
                  </span>
                  .
                </p>
                {lastSession && (
                  <button
                    onClick={() => navigate('/admin/reports')}
                    className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <Calendar className="w-4 h-4" />
                    View last session - {lastSession.date}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })() : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100/50 bg-emerald-50/50 p-6 dark:border-emerald-800/30 dark:bg-emerald-900/10">
            <div className="mb-2 flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Present</span>
            </div>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{todayStats.present}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">Vs 38 last Thursday</p>
          </div>

          <div className="rounded-2xl border border-rose-100/50 bg-rose-50/50 p-6 dark:border-rose-800/30 dark:bg-rose-900/10">
            <div className="mb-2 flex items-center gap-3 text-rose-600">
              <XCircle className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Absent</span>
            </div>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{todayStats.absent}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">Requires follow-up</p>
          </div>

          <div className="rounded-2xl border border-amber-100/50 bg-amber-50/50 p-6 dark:border-amber-800/30 dark:bg-amber-900/10">
            <div className="mb-2 flex items-center gap-3 text-amber-600">
              <Clock3 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">Excused</span>
            </div>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{todayStats.excused}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">Planned absence</p>
          </div>
        </div>
      )}
    </div>
  );

  if (metricsLoading && !dashboardMetrics) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white shadow-2xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-60 w-60 rounded-full bg-pink-400/10 blur-3xl translate-y-24" />

        <div className="relative z-10">
          <h2 className="text-4xl font-black tracking-tight">
            Welcome, <span className="text-amber-200">{welcomeName}</span>
          </h2>
          <p className="mt-2 max-w-lg text-lg font-medium text-white/80">
            Here's what's happening with your church{' '}
            <span className="font-black text-white underline decoration-pink-400 underline-offset-4">
              today
            </span>
            .
          </p>
        </div>
      </div>

      <QuickActionsBar
        serviceTypes={serviceTypes}
        selectedServiceId={selectedServiceId}
        onServiceChange={onServiceChange}
        onMarkAttendance={() => navigate('/admin/reports')}
        onAddMember={() => navigate('/admin/visitors')}
        onSendAnnouncement={() => navigate('/admin/announcements')}
        onViewFollowUps={() => navigate('/admin/follow-ups')}
      />

      {todaysAttendanceSection}

      <LeadershipWidget onNavigate={() => navigate('/admin/leadership')} />

      <NeedsAttentionWidget
        birthdays={needsAttention?.birthdays || []}
        absentees={needsAttention?.absentees || []}
        visitors={needsAttention?.visitors || []}
        onSendMessage={(member) => window.open(`mailto:${member.email}`)}
        onAssignFollowUp={() => navigate('/admin/follow-ups')}
        onAddVisitorToFollowUp={() => navigate('/admin/follow-ups')}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          label="Total Members"
          value={totalMembers}
          icon={Users}
          trend={newMembersMonth > 0 ? (newMembersMonth / totalMembers) * 100 : 0}
          trendLabel={`+${newMembersMonth} vs last month`}
          onClick={() => navigate('/admin/members')}
        />
        <StatCard
          label="Sections"
          value={sections.length}
          icon={Layers}
          variant="info"
          trend={0}
          trendLabel="No change"
          onClick={() => navigate('/admin/sections')}
        />
        <StatCard
          label="Active Leaders"
          value={leaders.length}
          icon={UserCog}
          variant="success"
          trend={0}
          trendLabel="No change"
          onClick={() => navigate('/admin/leaders')}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="flex items-center gap-3 text-xl font-black text-slate-900 dark:text-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/20">
                <Cake className="w-5 h-5 text-white" />
              </div>
              Next 7 Days
            </h3>
            <button
              onClick={() => navigate('/admin/birthdays')}
              className="text-sm font-black text-primary-600 hover:underline dark:text-primary-400"
            >
              View all
            </button>
          </div>

          <div className="space-y-6">
            {allMembers
              .filter((member) => member.date_of_birth && !member.hide_from_birthday_list)
              .slice(0, 5)
              .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-700/50 dark:bg-slate-900/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {new Date(member.date_of_birth).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {member.full_name}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-tighter text-slate-400">
                        {member.section_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="rounded-xl border border-slate-100 bg-white p-2.5 text-slate-400 transition-all hover:text-primary-600 dark:border-slate-600 dark:bg-slate-700">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Sections Overview
            </h3>
            <button
              onClick={() => navigate('/admin/sections')}
              className="text-sm font-black text-primary-600 hover:underline dark:text-primary-400"
            >
              Full management
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {sections.slice(0, 4).map((section) => {
              const sectionMembers = allMembers.filter((member) => member.section_name === section.name);
              const sectionLeaders = leaders.filter((leader) => leader.section_name === section.name);
              const percentage = allMembers.length > 0
                ? (sectionMembers.length / allMembers.length) * 100
                : 0;

              return (
                <div
                  key={section.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-700/50 dark:bg-slate-900/30"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-slate-100">{section.name}</h4>
                      <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Leaders: {sectionLeaders.length} | Avg: 72%
                      </p>
                    </div>
                    <span className="tabular-nums text-lg font-black text-slate-900 dark:text-slate-100">
                      {sectionMembers.length}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                      {percentage.toFixed(0)}% of total
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600">
                      <Zap className="w-2.5 h-2.5" />
                      Live 88%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <HallOfFamePreview
        topMembers={hallOfFame || []}
        onViewAll={() => navigate('/admin/rewards')}
      />

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/70">
          <Clock3 className="h-3.5 w-3.5" />
          <span>Standard Time</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">GMT+3 (EAT)</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/70">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Live</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">Attendance synced</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/70">
          <Calendar className="h-3.5 w-3.5" />
          <span>Updated</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">{lastUpdatedStr}</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
