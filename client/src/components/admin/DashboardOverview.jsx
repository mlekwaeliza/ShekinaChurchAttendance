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
  Zap,
  Download,
  Presentation,
  TrendingUp
} from 'lucide-react';

import QuickActionsBar from './QuickActionsBar';
import NeedsAttentionWidget from './NeedsAttentionWidget';
import HallOfFamePreview from './HallOfFamePreview';
import { useTranslation } from 'react-i18next';
import StatCard from '../ui/StatCard';
import { formatLocalDate, fdate, fdatetime, parseLocalDate } from '../../utils/date';

const TrendAreaChart = React.lazy(() => import('./TrendAreaChart'));

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
  lastUpdated = new Date()
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lastUpdatedStr = fdatetime(lastUpdated);

  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const attendanceContext = dashboardMetrics?.attendanceContext || { mode: 'today' };
  const isLatestAttendance = attendanceContext.mode === 'latest';
  const attendanceDateLabel = attendanceContext.date ? fdate(attendanceContext.date) : '';
  const serviceLabel =
    selectedServiceId === 'all'
      ? isLatestAttendance
        ? 'All Services'
        : 'All Services Today'
      : currentService?.name || 'Loading...';
  const attendanceTitle = isLatestAttendance ? 'Latest Attendance Session' : "Today's Attendance";
  const showingLabel =
    isLatestAttendance && attendanceDateLabel
      ? `${serviceLabel} - ${attendanceDateLabel}`
      : serviceLabel;

  const { comparisons, needsAttention, sparkline, hallOfFame } = dashboardMetrics || {};
  const welcomeName = pastorName?.trim() || 'Pastor';
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

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
  const attendanceRate = totalToday > 0 ? Math.round((todayStats.present / totalToday) * 100) : 0;

  const handleExportPDF = async () => {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
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
      ['New Members This Month', String(newMembersMonth)]
    ];
    autoTableModule.default(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: stats,
      margin: { left: m, right: m },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    y = doc.lastAutoTable.finalY + 12;

    if (sections.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Sections', m, y);
      y += 8;
      doc.line(m, y, pw - m, y);
      y += 5;

      const sectionData = sections.map((s) => {
        const sectionMembers = allMembers.filter((m) => m.section_id === s.id);
        return [s.name, String(sectionMembers.length)];
      });
      autoTableModule.default(doc, {
        startY: y,
        head: [['Section', 'Members']],
        body: sectionData,
        margin: { left: m, right: m },
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    if (leaders.length > 0) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Leaders', m, y);
      y += 8;
      doc.line(m, y, pw - m, y);
      y += 5;

      const leaderData = leaders.map((l) => [
        l.full_name || l.leader_name || 'N/A',
        l.section_name || 'N/A',
        l.is_head ? 'Head' : 'Leader'
      ]);
      autoTableModule.default(doc, {
        startY: y,
        head: [['Name', 'Section', 'Role']],
        body: leaderData,
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

    doc.save(`dashboard_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePresentation = async () => {
    try {
      const { PresentationGenerator } = await import('../../utils/presentationGenerator');
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
      <svg width="60" height="20" viewBox="0 0 100 30" className="shrink-0">
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

  const trendChartData = React.useMemo(() => {
    if (!sparkline || sparkline.length < 2) {
      return [];
    }
    return sparkline.slice(-14).map((item) => ({
      label: item.date ? String(item.date).slice(5, 10) : '',
      present: Number(item.present_count) || 0
    }));
  }, [sparkline]);

  const todaysAttendanceSection = (
    <div className="card overflow-hidden">
      <div className="border-b border-separator/60 px-5 py-5 sm:px-6 dark:border-white/[0.08]">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-title-3 font-semibold text-label">
              {attendanceTitle}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="text-footnote text-secondary-label">
                Showing <span className="font-medium text-label">{showingLabel}</span>
              </p>
              {selectedServiceId !== 'all' && (
                <button
                  onClick={() => onAssignDutyRoster(formatLocalDate())}
                  className="flex items-center gap-1.5 rounded-full bg-system-orange/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-system-orange/15 dark:text-system-orange"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Service team
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary-label">
                4-week trend
              </span>
              {renderSparkline()}
            </div>
            {totalToday > 0 && (
              <span className="shrink-0 rounded-full bg-primary-500/10 px-3 py-1 text-footnote font-semibold text-primary-700 dark:text-primary-300">
                {attendanceRate}% rate
              </span>
            )}
          </div>
        </div>
      </div>

      {totalToday === 0 ? (
        (() => {
          const dayNames = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
          ];
          const todayName = dayNames[new Date().getDay()];
          const isScheduledToday =
            selectedServiceId === 'all' ||
            !currentService?.default_day ||
            currentService.default_day === todayName;
          const lastSession = dashboardMetrics?.lastSession;

          return (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-system-fill">
                <Zap className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>

              {isScheduledToday ? (
                <>
                  <p className="mb-2 text-title-3 font-semibold text-label">
                    No attendance records yet
                  </p>
                  <p className="mb-6 max-w-sm text-center text-subheadline leading-6 text-secondary-label">
                    When leaders submit attendance for today&apos;s {serviceLabel}, this overview
                    will update automatically.
                  </p>
                  <button onClick={() => navigate('/admin/reports')} className="btn-primary btn-lg">
                    Open attendance workspace
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-2 text-title-3 font-semibold text-label">
                    No {currentService?.name || 'service'} scheduled today
                  </p>
                  <p className="mb-6 max-w-sm text-center text-subheadline leading-6 text-secondary-label">
                    {currentService?.name || 'This service'} runs on{' '}
                    <span className="font-medium text-primary-700 dark:text-primary-300">
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
                      Review last service · {lastSession.date}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })()
      ) : (
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
          <div className="rounded-xl border border-black/[0.06] bg-system-grouped-background/60 p-5 dark:border-white/[0.06]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-system-green/15">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-system-green" />
              </div>
              <span className="text-footnote font-medium text-secondary-label">Present</span>
            </div>
            <p className="text-[2rem] font-semibold leading-none text-label tabular-nums">
              {todayStats.present}
            </p>
            <p className="mt-2 text-[11px] text-secondary-label">Active attendance today</p>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-system-grouped-background/60 p-5 dark:border-white/[0.06]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-system-red/15">
                <XCircle className="h-4 w-4 text-rose-700 dark:text-system-red" />
              </div>
              <span className="text-footnote font-medium text-secondary-label">Absent</span>
            </div>
            <p className="text-[2rem] font-semibold leading-none text-label tabular-nums">
              {todayStats.absent}
            </p>
            <p className="mt-2 text-[11px] text-secondary-label">
              Review before creating a care follow-up
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-system-grouped-background/60 p-5 dark:border-white/[0.06]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-system-orange/15">
                <Clock3 className="h-4 w-4 text-amber-700 dark:text-system-orange" />
              </div>
              <span className="text-footnote font-medium text-secondary-label">Excused</span>
            </div>
            <p className="text-[2rem] font-semibold leading-none text-label tabular-nums">
              {todayStats.excused}
            </p>
            <p className="mt-2 text-[11px] text-secondary-label">Known in advance</p>
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
      <section className="product-surface relative overflow-hidden px-5 py-6 sm:px-7">
        <div className="relative flex min-w-0 flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="section-eyebrow">Church command center</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-system-green/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-system-green">
                <span className="h-1.5 w-1.5 rounded-full bg-system-green" />
                Live
              </span>
            </div>
            <h2 className="break-words font-display text-title-1 font-semibold text-label">
              {greeting}, {welcomeName}
            </h2>
            <p className="mt-2 max-w-2xl text-subheadline leading-6 text-secondary-label">
              Here is the health of your church for{' '}
              <span className="font-medium text-label">{showingLabel}</span>. Focus first on the
              people and ministry areas that need attention.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button onClick={handleExportPDF} className="btn-secondary btn-sm focus-ring">
              <Download className="h-3.5 w-3.5" /> PDF summary
            </button>
            <button onClick={handlePresentation} className="btn-secondary btn-sm focus-ring">
              <Presentation className="h-3.5 w-3.5" /> Presentation
            </button>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-system-fill/70 px-2.5 text-[11px] font-medium text-secondary-label dark:bg-white/[0.06]">
              <Clock3 className="h-3.5 w-3.5" />
              Updated {lastUpdatedStr}
            </span>
          </div>
        </div>
      </section>

      <QuickActionsBar
        serviceTypes={serviceTypes}
        selectedServiceId={selectedServiceId}
        onServiceChange={onServiceChange}
        onMarkAttendance={() => navigate('/admin/reports')}
        onAddMember={() => navigate('/admin/new-members')}
        onSendAnnouncement={() => navigate('/admin/announcements')}
        onViewFollowUps={() => navigate('/admin/follow-ups')}
      />

      {todaysAttendanceSection}

      {trendChartData.length >= 2 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-separator/60 px-5 py-4 sm:px-6 dark:border-white/[0.08]">
            <h3 className="flex items-center gap-3 text-title-3 font-semibold text-label">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
                <TrendingUp className="h-[18px] w-[18px]" />
              </div>
              Attendance Trend
            </h3>
            <button
              onClick={() => navigate('/admin/attendance-analytics')}
              className="btn-sm btn-ghost text-primary-700 dark:text-primary-300"
            >
              Full analytics
            </button>
          </div>
          <div className="p-5">
            <React.Suspense
              fallback={<div className="h-[260px] animate-pulse rounded-xl bg-system-fill" />}
            >
              <TrendAreaChart data={trendChartData} />
            </React.Suspense>
          </div>
        </section>
      )}

      <NeedsAttentionWidget
        birthdays={needsAttention?.birthdays || []}
        absentees={needsAttention?.absentees || []}
        visitors={needsAttention?.visitors || []}
        onSendMessage={(member) => window.open(`mailto:${member.email}`)}
        onAssignFollowUp={() => navigate('/admin/follow-ups')}
        onAddVisitorToFollowUp={() => navigate('/admin/follow-ups')}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t('dashboard.totalMembers')}
          value={totalMembers}
          icon={Users}
          trend={newMembersMonth > 0 ? (newMembersMonth / totalMembers) * 100 : 0}
          trendLabel={`+${newMembersMonth} vs last month`}
          onClick={() => navigate('/admin/members')}
        />
        <StatCard
          label={t('dashboard.totalSections')}
          value={sections.length}
          icon={Layers}
          variant="info"
          onClick={() => navigate('/admin/sections')}
        />
        <StatCard
          label={t('dashboard.totalLeaders')}
          value={leaders.length}
          icon={UserCog}
          variant="success"
          onClick={() => navigate('/admin/leaders')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-separator/60 px-5 py-4 sm:px-6 dark:border-white/[0.08]">
            <h3 className="flex items-center gap-3 text-title-3 font-semibold text-label">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-system-red/15 text-rose-700 dark:text-system-red">
                <Cake className="h-[18px] w-[18px]" />
              </div>
              Next 7 Days
            </h3>
            <button
              onClick={() => navigate('/admin/birthdays')}
              className="btn-sm btn-ghost text-primary-700 dark:text-primary-300"
            >
              View all
            </button>
          </div>

          <div className="p-5 space-y-3">
            {upcomingBirthdays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-secondary-label">
                <Cake className="w-8 h-8 text-tertiary-label mb-2" />
                <p className="text-footnote">No birthdays in the next 7 days</p>
              </div>
            ) : (
              upcomingBirthdays.slice(0, 5).map((member) => {
                const dob = parseLocalDate(member.date_of_birth);
                const months = [
                  'Jan',
                  'Feb',
                  'Mar',
                  'Apr',
                  'May',
                  'Jun',
                  'Jul',
                  'Aug',
                  'Sep',
                  'Oct',
                  'Nov',
                  'Dec'
                ];
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
                    className="flex items-center justify-between rounded-xl border border-separator/50 bg-system-grouped-background/60 p-3 dark:border-white/[0.06]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-separator/50 bg-secondary-system-grouped-background shadow-sm dark:border-white/[0.08] dark:bg-[#2c2c2e]">
                        <div className="w-full bg-system-red/15 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-rose-700 dark:text-system-red">
                          {monthAbbr}
                        </div>
                        <div className="flex flex-1 items-center justify-center text-subheadline font-semibold text-label tabular-nums">
                          {day}
                        </div>
                      </div>
                      <div>
                        <p className="text-subheadline font-semibold text-label">
                          {member.full_name}
                        </p>
                        <p className="text-caption-1 font-medium text-secondary-label">
                          <span className="font-semibold text-rose-700 dark:text-system-red">
                            {proximityLabel}
                          </span>
                          {ageLabel} · {member.section_name}
                        </p>
                      </div>
                    </div>

                    <button
                      className="btn-icon btn-ghost rounded-lg text-secondary-label hover:text-primary-700 dark:hover:text-primary-300"
                      aria-label={`Message ${member.full_name}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-separator/60 px-5 py-4 sm:px-6 dark:border-white/[0.08]">
            <h3 className="text-title-3 font-semibold text-label">Sections Overview</h3>
            <button
              onClick={() => navigate('/admin/sections')}
              className="btn-sm btn-ghost text-primary-700 dark:text-primary-300"
            >
              Full management
            </button>
          </div>

          <div className="p-5 space-y-4">
            {sections.slice(0, 4).map((section) => {
              const sectionMembers = allMembers.filter(
                (member) => member.section_name === section.name
              );
              const sectionLeaders = leaders.filter(
                (leader) => leader.section_name === section.name
              );
              const percentage =
                allMembers.length > 0 ? (sectionMembers.length / allMembers.length) * 100 : 0;

              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-footnote font-medium text-label">{section.name}</h4>
                      <p className="text-caption-1 text-secondary-label">
                        {sectionLeaders.length} leader{sectionLeaders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="tabular-nums text-lg font-semibold text-label">
                      {sectionMembers.length}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-system-fill/60 dark:bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-caption-2 text-tertiary-label">
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
