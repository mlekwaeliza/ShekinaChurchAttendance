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
  Download,
  Presentation,
} from 'lucide-react';

import QuickActionsBar from './QuickActionsBar';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import { PresentationGenerator } from '../../utils/presentationGenerator';
import HallOfFamePreview from './HallOfFamePreview';
import LeadershipWidget from './LeadershipWidget';
import StatCard from '../ui/StatCard';
import { formatLocalDate, fdate, fdatetime, parseLocalDate } from '../../utils/date';

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

  const lastUpdatedStr = fdatetime(lastUpdated);

  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const attendanceContext = dashboardMetrics?.attendanceContext || { mode: 'today' };
  const isLatestAttendance = attendanceContext.mode === 'latest';
  const attendanceDateLabel = attendanceContext.date
    ? fdate(attendanceContext.date)
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

  const upcomingBirthdays = React.useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return allMembers
      .filter((member) => member.date_of_birth && !member.hide_from_birthday_list)
      .map((member) => {
        const bday = parseLocalDate(member.date_of_birth);
        const birthMonth = bday.getMonth();
        const birthDay = bday.getDate();

        const currentYear = today.getFullYear();
        const bdayThisYear = new Date(currentYear, birthMonth, birthDay);
        const bdayNextYear = new Date(currentYear + 1, birthMonth, birthDay);

        const tThis = bdayThisYear.getTime();
        const tNext = bdayNextYear.getTime();
        const tToday = todayStart.getTime();

        const diffThis = Math.round((tThis - tToday) / (1000 * 60 * 60 * 24));
        const diffNext = Math.round((tNext - tToday) / (1000 * 60 * 60 * 24));

        const daysUntil = diffThis >= 0 ? diffThis : diffNext;

        return { ...member, daysUntil };
      })
      .filter((member) => member.daysUntil >= 0 && member.daysUntil < 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [allMembers]);

  const todayStats = dashboardMetrics?.todayStats || { present: 0, absent: 0, excused: 0 };
  const totalToday = todayStats.present + todayStats.absent + todayStats.excused;
  const attendanceRate = totalToday > 0
    ? Math.round((todayStats.present / totalToday) * 100)
    : 0;

  const handleExportPDF = async () => {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 20;
    let y = 20;

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pw, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Church Dashboard Summary', m, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shekina Church · ${new Date().toLocaleDateString()}`, m, 28);
    y = 45;

    doc.setTextColor(51, 51, 51);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Statistics', m, y);
    y += 8;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 10;

    const stats = [
      ['Total Members', String(totalMembers)],
      ['Present Today', String(todayStats.present)],
      ['Absent Today', String(todayStats.absent)],
      ['Excused Today', String(todayStats.excused)],
      ['Attendance Rate', `${attendanceRate}%`],
      ['Total Leaders', String(leaders.length)],
      ['Total Sections', String(sections.length)],
      ['New Members This Month', String(newMembersMonth)],
    ];
    autoTableModule.default(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: stats,
      margin: { left: m, right: m },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = doc.lastAutoTable.finalY + 12;

    if (sections.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Sections', m, y);
      y += 8;
      doc.line(m, y, pw - m, y);
      y += 5;

      const sectionData = sections.map(s => {
        const sectionMembers = allMembers.filter(m => m.section_id === s.id);
        return [s.name, String(sectionMembers.length)];
      });
      autoTableModule.default(doc, {
        startY: y,
        head: [['Section', 'Members']],
        body: sectionData,
        margin: { left: m, right: m },
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (leaders.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Leaders', m, y);
      y += 8;
      doc.line(m, y, pw - m, y);
      y += 5;

      const leaderData = leaders.map(l => [
        l.full_name || l.leader_name || 'N/A',
        l.section_name || 'N/A',
        l.is_head ? 'Head' : 'Leader',
      ]);
      autoTableModule.default(doc, {
        startY: y,
        head: [['Name', 'Section', 'Role']],
        body: leaderData,
        margin: { left: m, right: m },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }

    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pc} | Shekina Church Management System`, m, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`dashboard_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePresentation = () => {
    try {
      const gen = new PresentationGenerator();
      gen.generateDashboardSummary(dashboardMetrics, sections, leaders);
      gen.save(`church_dashboard_${new Date().toISOString().split('T')[0]}.pptx`);
    } catch (error) {
      console.error('Presentation export error:', error);
    }
  };

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
    <div className="card overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {attendanceTitle}
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Showing: <span className="text-primary-600 dark:text-primary-400">{showingLabel}</span>
              </p>
              {selectedServiceId !== 'all' && (
                <button
                  onClick={() => onAssignDutyRoster(formatLocalDate())}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Duty Roster
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                4-Week Trend
              </span>
              {renderSparkline()}
            </div>
            {totalToday > 0 && (
              <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2 dark:border-primary-800/30 dark:bg-primary-900/20">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {attendanceRate}% Rate
                </span>
              </div>
            )}
          </div>
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
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 shadow-lg shadow-primary-500/10">
              <Zap className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>

            {isScheduledToday ? (
              <>
                <p className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  No attendance records yet
                </p>
                <p className="mb-6 max-w-sm text-center text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Consistency is key. Start documenting today's {serviceLabel} to track progress.
                </p>
                <button
                  onClick={() => navigate('/admin/reports')}
                  className="btn-primary btn-lg"
                >
                  Start Check-in
                </button>
              </>
            ) : (
              <>
                <p className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  No {currentService?.name || 'service'} scheduled today
                </p>
                <p className="mb-6 max-w-sm text-center text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {currentService?.name || 'This service'} runs on{' '}
                  <span className="font-bold text-primary-600 dark:text-primary-400">
                    {currentService?.default_day || 'N/A'}
                  </span>
                  .
                </p>
                {lastSession && (
                  <button
                    onClick={() => navigate('/admin/reports')}
                    className="btn-secondary btn-lg"
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
        <div className="px-8 py-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100/60 bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-6 dark:border-emerald-800/30 dark:from-emerald-900/20 dark:to-emerald-900/10">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Present</span>
              </div>
              <p className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">{todayStats.present}</p>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">Active attendance today</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-rose-100/60 bg-gradient-to-br from-rose-50 to-rose-50/50 p-6 dark:border-rose-800/30 dark:from-rose-900/20 dark:to-rose-900/10">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-rose-500/5 blur-2xl -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">Absent</span>
              </div>
              <p className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">{todayStats.absent}</p>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">Requires follow-up</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-100/60 bg-gradient-to-br from-amber-50 to-amber-50/50 p-6 dark:border-amber-800/30 dark:from-amber-900/20 dark:to-amber-900/10">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-2xl -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Excused</span>
              </div>
              <p className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">{todayStats.excused}</p>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">Planned absence</p>
            </div>
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
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Welcome, <span className="text-slate-900 dark:text-white">{welcomeName}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Church overview · {showingLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button onClick={handlePresentation} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <Presentation className="h-3.5 w-3.5" /> Presentation
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 relative">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </span>
            Live
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            Updated {lastUpdatedStr}
          </span>
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
          onClick={() => navigate('/admin/sections')}
        />
        <StatCard
          label="Active Leaders"
          value={leaders.length}
          icon={UserCog}
          variant="success"
          onClick={() => navigate('/admin/leaders')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-900 dark:text-slate-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/20">
                <Cake className="w-4.5 h-4.5 text-white" />
              </div>
              Next 7 Days
            </h3>
            <button
              onClick={() => navigate('/admin/birthdays')}
              className="btn-sm btn-ghost text-primary-600 dark:text-primary-400"
            >
              View all
            </button>
          </div>

          <div className="p-5 space-y-3">
            {upcomingBirthdays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
                <Cake className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs">No birthdays in the next 7 days 🎉</p>
              </div>
            ) : (
              upcomingBirthdays.slice(0, 5).map((member) => {
                const dob = parseLocalDate(member.date_of_birth);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const monthAbbr = months[dob.getMonth()];
                const day = dob.getDate();

                let proximityLabel = '';
                if (member.daysUntil === 0) proximityLabel = 'Today 🎉';
                else if (member.daysUntil === 1) proximityLabel = 'Tomorrow';
                else proximityLabel = `In ${member.daysUntil} days`;

                const turnAge = new Date().getFullYear() - dob.getFullYear();
                const ageLabel = turnAge > 0 ? ` · Turning ${turnAge}` : '';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm dark:border-rose-950 dark:bg-slate-800">
                        <div className="w-full bg-rose-500 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-wider text-white">
                          {monthAbbr}
                        </div>
                        <div className="flex-1 flex items-center justify-center text-sm font-bold text-slate-800 dark:text-slate-100">
                          {day}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {member.full_name}
                        </p>
                        <p className="text-xs font-medium text-slate-400">
                          <span className="text-rose-500 font-semibold">{proximityLabel}</span>
                          {ageLabel} · {member.section_name}
                        </p>
                      </div>
                    </div>

                    <button className="btn-icon btn-ghost p-2 rounded-lg text-slate-400 hover:text-primary-600">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Sections Overview
            </h3>
            <button
              onClick={() => navigate('/admin/sections')}
              className="btn-sm btn-ghost text-primary-600 dark:text-primary-400"
            >
              Full management
            </button>
          </div>

          <div className="p-5 space-y-4">
            {sections.slice(0, 4).map((section) => {
              const sectionMembers = allMembers.filter((member) => member.section_name === section.name);
              const sectionLeaders = leaders.filter((leader) => leader.section_name === section.name);
              const percentage = allMembers.length > 0
                ? (sectionMembers.length / allMembers.length) * 100
                : 0;

              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{section.name}</h4>
                      <p className="text-xs font-medium text-slate-400">
                        {sectionLeaders.length} leader{sectionLeaders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="tabular-nums text-lg font-bold text-slate-900 dark:text-slate-100">
                      {sectionMembers.length}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {percentage.toFixed(0)}% of total
                    </span>
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
    </div>
  );
};

export default DashboardOverview;
