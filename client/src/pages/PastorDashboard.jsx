import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Download,
  FileText,
  ShieldAlert,
  TrendingUp,
  Users
} from 'lucide-react';

import { pastorAPI } from '../services/api';
import BirthdayModule from '../components/admin/BirthdayModule';
import ChurchCalendar from '../components/ChurchCalendar';
import PastorEngagement from '../components/pastor/PastorEngagement';
import PastorInsights from '../components/pastor/PastorInsights';
import PastorWeeklySummary from '../components/pastor/PastorWeeklySummary';
import ReportBuilderModal from '../components/pastor/ReportBuilderModal';
import Badge from '../components/ui/Badge';
import ChartCard from '../components/ui/ChartCard';
import DataTable from '../components/ui/DataTable';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import StatCard from '../components/ui/StatCard';
import { addDays, formatDisplayDate, formatLocalDate } from '../utils/date';

const SECTION_COLORS = ['#0d897b', '#5856d6', '#007aff', '#ff9500', '#ff2d55', '#34c759'];

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeFilename(value) {
  return (
    String(value || 'ministry-report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ministry-report'
  );
}

function rateVariant(rate) {
  if (rate >= 90) return 'success';
  if (rate >= 75) return 'warning';
  return 'danger';
}

const PastorDashboard = () => {
  const { t } = useTranslation();
  const { tab } = useParams();
  const { user } = useAuth();
  const activeTab = tab || 'overview';
  const isOverview = activeTab === 'overview' || activeTab === 'dashboard';

  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [leaderMetrics, setLeaderMetrics] = useState([]);
  const [atRiskMembers, setAtRiskMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState(() => ({
    start: formatLocalDate(addDays(new Date(), -30)),
    end: formatLocalDate()
  }));

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const filters = {
        start_date: dateRange.start,
        end_date: dateRange.end
      };

      const [statsRes, trendsRes, leadersRes, atRiskRes] = await Promise.all([
        pastorAPI.getDashboardStats(filters),
        pastorAPI.getTrends(filters),
        pastorAPI.getLeaderMetrics(filters),
        pastorAPI.getAtRiskMembers()
      ]);

      setStats(statsRes.data);
      setTrends(trendsRes.data);
      setLeaderMetrics(leadersRes.data);
      setAtRiskMembers(atRiskRes.data);
    } catch (requestError) {
      console.error('Failed to load pastor dashboard data:', requestError);
      setError('We could not load the latest pastor overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    if (isOverview) {
      loadAllData();
    }
  }, [isOverview, loadAllData]);

  const overviewTrend = useMemo(() => {
    const grouped = new Map();

    trends.forEach((row) => {
      const key = row.date;
      const current = grouped.get(key) || { date: key, present: 0, total: 0 };
      current.present += numberOrZero(row.present);
      current.total += numberOrZero(row.total);
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((row) => ({
        date: row.date,
        attendance_rate: row.total > 0 ? Number(((row.present / row.total) * 100).toFixed(1)) : 0
      }));
  }, [trends]);

  const sectionBreakdown = useMemo(
    () =>
      [...(stats?.sectionBreakdown || [])].sort(
        (left, right) => numberOrZero(right.attendance_rate) - numberOrZero(left.attendance_rate)
      ),
    [stats]
  );

  const rankedLeaders = useMemo(
    () =>
      [...leaderMetrics].sort(
        (left, right) => numberOrZero(right.attendance_rate) - numberOrZero(left.attendance_rate)
      ),
    [leaderMetrics]
  );

  const prioritizedMembers = useMemo(
    () =>
      [...atRiskMembers].sort(
        (left, right) => numberOrZero(right.absence_count) - numberOrZero(left.absence_count)
      ),
    [atRiskMembers]
  );

  const summaryMetrics = useMemo(() => {
    const attendanceRows = stats?.overallAttendance || [];
    const averageAttendance = attendanceRows.length
      ? Math.round(
          attendanceRows.reduce((sum, row) => {
            const present = numberOrZero(row.present_count ?? row.present);
            const total = numberOrZero(row.total_members ?? row.total);
            return total > 0 ? sum + (present / total) * 100 : sum;
          }, 0) / attendanceRows.length
        )
      : 0;

    return {
      latestDateLabel: stats?.latestDate ? formatDisplayDate(stats.latestDate) : 'No records yet',
      averageAttendance,
      submissionRate: numberOrZero(stats?.completion?.rate),
      leadersSubmitted: numberOrZero(stats?.completion?.leadersSubmitted),
      totalLeaders: numberOrZero(stats?.completion?.totalLeaders),
      trackedSections: sectionBreakdown.length
    };
  }, [sectionBreakdown.length, stats]);

  const reportSummary = useMemo(() => {
    const strongestSection = sectionBreakdown[0] || null;
    const weakestSection = sectionBreakdown[sectionBreakdown.length - 1] || null;
    const topLeader = rankedLeaders[0] || null;
    const trendDelta =
      overviewTrend.length >= 2
        ? Number(
            (
              overviewTrend[overviewTrend.length - 1].attendance_rate -
              overviewTrend[0].attendance_rate
            ).toFixed(1)
          )
        : 0;

    const completionGap = Math.max(
      summaryMetrics.totalLeaders - summaryMetrics.leadersSubmitted,
      0
    );
    const actionItems = [];

    if (completionGap > 0) {
      actionItems.push(
        `Follow up with ${completionGap} leader${completionGap === 1 ? '' : 's'} who have not submitted in the selected range.`
      );
    }

    if (trendDelta <= -3) {
      actionItems.push(
        `Review the ${Math.abs(trendDelta)} point attendance slide across the current reporting window.`
      );
    }

    if (weakestSection && numberOrZero(weakestSection.attendance_rate) < 75) {
      actionItems.push(
        `Coach ${weakestSection.section_name} on consistency after its ${weakestSection.attendance_rate}% attendance rate.`
      );
    }

    if (prioritizedMembers.length > 0) {
      actionItems.push(
        `Prioritize pastoral follow-up for ${Math.min(prioritizedMembers.length, 10)} members showing repeated recent absences.`
      );
    }

    if (topLeader && numberOrZero(topLeader.attendance_rate) >= 90) {
      actionItems.push(
        `Recognize ${topLeader.leader_name} and ${topLeader.section_name} for sustained strong reporting discipline.`
      );
    }

    if (actionItems.length === 0) {
      actionItems.push(
        'Maintain the current follow-up rhythm and keep section reporting steady through the next review cycle.'
      );
    }

    return {
      strongestSection,
      weakestSection,
      topLeader,
      topLeaders: rankedLeaders.slice(0, 12),
      atRiskMembers: prioritizedMembers.slice(0, 12),
      trendDelta,
      actionItems,
      windowLabel: `${formatDisplayDate(dateRange.start)} to ${formatDisplayDate(dateRange.end)}`
    };
  }, [
    dateRange.end,
    dateRange.start,
    overviewTrend,
    prioritizedMembers,
    rankedLeaders,
    sectionBreakdown,
    summaryMetrics.leadersSubmitted,
    summaryMetrics.totalLeaders
  ]);

  const exportData = useCallback(() => {
    pastorAPI.exportAttendance({
      start_date: dateRange.start,
      end_date: dateRange.end
    });
  }, [dateRange.end, dateRange.start]);

  const generateReport = useCallback(
    async (form) => {
      setReportLoading(true);

      try {
        const { generateReportPdf } = await import('../utils/pdfWorker');
        await generateReportPdf({
          report: 'pastor',
          form,
          reportSummary,
          summaryMetrics,
          sectionBreakdown,
          prioritizedMembers,
          generatedOn: formatDisplayDate(formatLocalDate()),
          formatDisplayDate,
          formatLocalDate,
          sanitizeFilename,
          numberOrZero
        });
        setIsReportModalOpen(false);
      } catch (err) {
        console.error('Pastor report PDF generation failed:', err);
        alert('Failed to generate PDF: ' + (err.message || err));
      } finally {
        setReportLoading(false);
      }
    },
    [reportSummary, sectionBreakdown, summaryMetrics, prioritizedMembers]
  );

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <LoadingSkeleton type="card" count={1} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <LoadingSkeleton type="card" count={4} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <LoadingSkeleton type="chart" count={2} />
          </div>
          <LoadingSkeleton type="table" count={1} rows={5} cols={5} />
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1 text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>{reportSummary.windowLabel}</span>
            </div>
            <div>
              <h2 className="text-title-1 font-semibold text-label">
                {t('pastor.welcomePst', { name: user?.full_name || 'Jeremiah' })}
              </h2>
              <p className="mt-1 text-subheadline text-secondary-label">{t('pastor.subtitle')}</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
            <div className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-3 py-2 shadow-card dark:border-white/[0.08]">
              <input
                type="date"
                value={dateRange.start}
                max={dateRange.end}
                onChange={(event) =>
                  setDateRange((current) => ({ ...current, start: event.target.value }))
                }
                className="border-none bg-transparent p-0 text-footnote text-label focus:ring-0"
              />
              <span className="text-footnote text-tertiary-label">to</span>
              <input
                type="date"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(event) =>
                  setDateRange((current) => ({ ...current, end: event.target.value }))
                }
                className="border-none bg-transparent p-0 text-footnote text-label focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsReportModalOpen(true)}
                disabled={!stats || reportLoading}
                className="btn-primary btn-sm gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>{reportLoading ? t('pastor.preparing') : t('pastor.report')}</span>
              </button>
              <button onClick={exportData} className="btn-secondary btn-sm gap-2">
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex flex-col gap-4 rounded-2xl bg-system-red/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 text-rose-700 dark:text-system-red">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="break-words text-footnote font-medium">{error}</span>
            </div>
            <button
              onClick={loadAllData}
              className="btn-secondary btn-sm shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            icon={CalendarRange}
            label="Latest Attendance Day"
            value={summaryMetrics.latestDateLabel}
            variant="info"
          />
          <StatCard
            icon={Activity}
            label="Average Attendance"
            value={`${summaryMetrics.averageAttendance}%`}
            variant={rateVariant(summaryMetrics.averageAttendance)}
          />
          <StatCard
            icon={CheckCircle2}
            label="Submission Rate"
            value={`${summaryMetrics.submissionRate}%`}
            trendLabel={`${summaryMetrics.leadersSubmitted}/${summaryMetrics.totalLeaders} leaders`}
            variant={rateVariant(summaryMetrics.submissionRate)}
          />
          <StatCard
            icon={AlertTriangle}
            label="At-Risk Members"
            value={prioritizedMembers.length}
            variant={prioritizedMembers.length > 0 ? 'danger' : 'success'}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="card p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-system-orange/15">
                <ShieldAlert className="h-[18px] w-[18px] text-amber-700 dark:text-system-orange" />
              </span>
              <h3 className="text-title-3 font-semibold text-label">Priority Actions</h3>
            </div>
            <div className="space-y-2">
              {reportSummary.actionItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl bg-system-grouped-background/70 px-4 py-3 dark:bg-white/[0.03]"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                  <p className="text-footnote leading-relaxed text-secondary-label">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-system-green/15">
                <TrendingUp className="h-[18px] w-[18px] text-emerald-700 dark:text-system-green" />
              </span>
              <h3 className="text-title-3 font-semibold text-label">Report Snapshot</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 text-footnote text-secondary-label">Trend delta</span>
                <Badge variant={reportSummary.trendDelta >= 0 ? 'success' : 'danger'}>
                  {reportSummary.trendDelta > 0 ? '+' : ''}
                  {reportSummary.trendDelta}%
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-footnote text-secondary-label">Strongest section</span>
                <div className="min-w-0 text-right">
                  <div className="truncate text-footnote font-semibold text-label">
                    {reportSummary.strongestSection?.section_name || 'No data'}
                  </div>
                  {reportSummary.strongestSection && (
                    <div className="text-caption-1 text-secondary-label tabular-nums">
                      {reportSummary.strongestSection.attendance_rate}%
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-footnote text-secondary-label">Needs support</span>
                <div className="min-w-0 text-right">
                  <div className="truncate text-footnote font-semibold text-label">
                    {reportSummary.weakestSection?.section_name || 'No data'}
                  </div>
                  {reportSummary.weakestSection && (
                    <div className="text-caption-1 text-secondary-label tabular-nums">
                      {reportSummary.weakestSection.attendance_rate}%
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-footnote text-secondary-label">Top leader</span>
                <div className="min-w-0 text-right">
                  <div className="truncate text-footnote font-semibold text-label">
                    {reportSummary.topLeader?.leader_name || 'No data'}
                  </div>
                  {reportSummary.topLeader && (
                    <div className="text-caption-1 text-secondary-label">
                      {reportSummary.topLeader.section_name} ·{' '}
                      {reportSummary.topLeader.attendance_rate}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard
            title="Attendance Trend"
            subtitle="Average attendance rate across the selected reporting window"
            icon={TrendingUp}
            empty={overviewTrend.length === 0}
            emptyMessage="Attendance trend data will appear after submissions are recorded."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overviewTrend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c7c7cc" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8e8e93' }}
                  tickFormatter={(value) =>
                    formatDisplayDate(value, { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8e8e93' }}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Attendance']}
                  labelFormatter={(value) => formatDisplayDate(value)}
                />
                <Line
                  type="monotone"
                  dataKey="attendance_rate"
                  stroke="#14a896"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Section Performance"
            subtitle="Latest section attendance rates ranked from strongest to weakest"
            icon={Users}
            empty={sectionBreakdown.length === 0}
            emptyMessage="Section performance will appear once attendance has been captured."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectionBreakdown}
                margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c7c7cc" />
                <XAxis
                  dataKey="section_name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8e8e93' }}
                  tickFormatter={(value) =>
                    value.length > 11 ? `${value.slice(0, 11)}...` : value
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8e8e93' }}
                  domain={[0, 100]}
                />
                <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                <Bar dataKey="attendance_rate" radius={[8, 8, 0, 0]}>
                  {sectionBreakdown.map((section, index) => (
                    <Cell
                      key={section.section_name}
                      fill={SECTION_COLORS[index % SECTION_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <DataTable
          columns={[
            {
              accessor: 'leader_name',
              header: 'Leader',
              sortable: true,
              render: (row) => <span className="font-semibold text-label">{row.leader_name}</span>
            },
            {
              accessor: 'section_name',
              header: 'Section',
              sortable: true,
              render: (row) => <Badge variant="info">{row.section_name}</Badge>
            },
            {
              accessor: 'reporting_days',
              header: 'Reporting Days',
              sortable: true,
              align: 'center'
            },
            {
              accessor: 'total_records',
              header: 'Records',
              sortable: true,
              align: 'center'
            },
            {
              accessor: 'attendance_rate',
              header: 'Attendance Rate',
              sortable: true,
              align: 'center',
              render: (row) => (
                <Badge variant={rateVariant(numberOrZero(row.attendance_rate))}>
                  {row.attendance_rate}%
                </Badge>
              )
            }
          ]}
          data={rankedLeaders}
          searchable
          searchPlaceholder="Search leaders or sections..."
          searchKeys={['leader_name', 'section_name']}
          emptyTitle="No leader performance data"
          emptyDescription="Leader performance will populate once attendance history is available."
        />

        <DataTable
          columns={[
            {
              accessor: 'membership_id',
              header: 'Membership ID',
              sortable: true
            },
            {
              accessor: 'full_name',
              header: 'Member',
              sortable: true,
              render: (row) => <span className="font-semibold text-label">{row.full_name}</span>
            },
            {
              accessor: 'section_name',
              header: 'Section',
              sortable: true
            },
            {
              accessor: 'leader_name',
              header: 'Leader',
              sortable: true
            },
            {
              accessor: 'absence_count',
              header: 'Absences',
              sortable: true,
              align: 'center',
              render: (row) => <Badge variant="danger">{row.absence_count}</Badge>
            }
          ]}
          data={prioritizedMembers}
          searchable
          searchPlaceholder="Search members, leaders, or sections..."
          searchKeys={['membership_id', 'full_name', 'section_name', 'leader_name']}
          emptyTitle="No members currently flagged"
          emptyDescription="Members with repeated recent absences will appear here."
        />

        <ReportBuilderModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          dateRange={dateRange}
          onGenerate={generateReport}
          loading={reportLoading}
        />
      </div>
    );
  };

  switch (activeTab) {
    case 'calendar':
      return <ChurchCalendar />;
    case 'insights':
      return <PastorInsights />;
    case 'engagement':
      return <PastorEngagement />;
    case 'weekly':
      return <PastorWeeklySummary />;
    case 'birthdays':
      return <BirthdayModule />;
    default:
      return renderOverview();
  }
};

export default PastorDashboard;
