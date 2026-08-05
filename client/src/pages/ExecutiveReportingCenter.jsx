import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import Badge from '../components/ui/Badge';
import {
  Download,
  FileText,
  Users,
  Calendar,
  TrendingUp,
  Heart,
  Baby,
  Home,
  DollarSign,
  Filter,
  RefreshCw,
  Presentation
} from 'lucide-react';

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance', icon: Calendar, color: 'blue' },
  { id: 'membership', label: 'Membership', icon: Users, color: 'green' },
  { id: 'leadership', label: 'Leadership', icon: TrendingUp, color: 'purple' },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: 'emerald' },
  { id: 'evangelism', label: 'Outreach', icon: Heart, color: 'rose' },
  { id: 'newMembers', label: 'New Members', icon: Users, color: 'cyan' },
  { id: 'homeCells', label: 'Home Cells', icon: Home, color: 'amber' },
  { id: 'children', label: 'Children', icon: Baby, color: 'indigo' }
];

export default function ExecutiveReportingCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReport = searchParams.get('report') || 'attendance';
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      setReportData(null);
      const params = { start_date: startDate, end_date: endDate };
      let response;

      switch (activeReport) {
        case 'attendance':
          response = await adminAPI.reports.getAttendance(params);
          break;
        case 'membership':
          response = await adminAPI.reports.getMembership(params);
          break;
        case 'leadership':
          response = await adminAPI.reports.getLeadership(params);
          break;
        case 'finance':
          response = await adminAPI.reports.getFinance(params);
          break;
        case 'evangelism':
          response = await adminAPI.reports.getEvangelism(params);
          break;
        case 'newMembers':
          response = await adminAPI.reports.getNewMembers(params);
          break;
        case 'homeCells':
          response = await adminAPI.reports.getHomeCells(params);
          break;
        case 'children':
          response = await adminAPI.reports.getChildren(params);
          break;
        default:
          response = await adminAPI.reports.getAttendance(params);
      }

      setReportData(response.data);
    } catch (error) {
      console.error('Failed to load report:', error);
      const message = error.message || 'Failed to load report';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeReport, endDate, showToast, startDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      window.open(`/api/admin/reports/export/${activeReport}?${params.toString()}`, '_blank');
      showToast('Export started', 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePDFExport = async () => {
    if (!reportData) {
      showToast('No data to export', 'error');
      return;
    }

    try {
      const { PDFReportGenerator } = await import('../utils/pdfReportGenerator');
      const generator = new PDFReportGenerator();

      switch (activeReport) {
        case 'attendance':
          generator.generateAttendanceReport(reportData);
          break;
        case 'membership':
          generator.generateMembershipReport(reportData);
          break;
        case 'finance':
          generator.generateFinanceReport(reportData);
          break;
        case 'leadership':
          generator.generateLeadershipReport(reportData);
          break;
        case 'evangelism':
          generator.generateEvangelismReport(reportData);
          break;
        case 'newMembers':
          generator.generateNewMembersReport(reportData);
          break;
        case 'children':
          generator.generateChildrenReport(reportData);
          break;
        case 'homeCells':
          generator.generateHomeCellsReport(reportData);
          break;
        default:
          generator.generateAttendanceReport(reportData);
      }

      generator.save(`${activeReport}_report_${startDate}_to_${endDate}.pdf`);
      showToast('PDF exported successfully', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('Failed to export PDF', 'error');
    }
  };

  const handlePresentation = async () => {
    if (!reportData) {
      showToast('No data to export', 'error');
      return;
    }
    try {
      setExporting(true);
      const { PresentationGenerator } = await import('../utils/presentationGenerator');
      const gen = new PresentationGenerator();
      gen.setTitle(`${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report`);
      gen[
        activeReport === 'newMembers'
          ? 'generateNewMembersReport'
          : `generate${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)}Report`
      ](reportData);
      gen.save(`${activeReport}_presentation_${startDate}_to_${endDate}.pptx`);
      showToast('Presentation exported successfully', 'success');
    } catch (error) {
      console.error('Presentation export error:', error);
      showToast('Failed to export presentation', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleFullPresentation = async () => {
    try {
      setExporting(true);
      showToast('Generating full presentation...', 'info');
      const params = { start_date: startDate, end_date: endDate };
      const allData = await Promise.allSettled([
        adminAPI.reports.getAttendance(params),
        adminAPI.reports.getMembership(params),
        adminAPI.reports.getLeadership(params),
        adminAPI.reports.getFinance(params),
        adminAPI.reports.getEvangelism(params),
        adminAPI.reports.getNewMembers(params),
        adminAPI.reports.getHomeCells(params),
        adminAPI.reports.getChildren(params)
      ]);
      const keys = [
        'attendance',
        'membership',
        'leadership',
        'finance',
        'evangelism',
        'newMembers',
        'homeCells',
        'children'
      ];
      const dataObj = {};
      allData.forEach((result, i) => {
        dataObj[keys[i]] = { data: result.status === 'fulfilled' ? result.value.data : null };
      });
      const { PresentationGenerator } = await import('../utils/presentationGenerator');
      const gen = new PresentationGenerator();
      gen.generateFullPresentation(dataObj);
      gen.save(`full_executive_presentation_${startDate}_to_${endDate}.pptx`);
      showToast('Full presentation exported successfully', 'success');
    } catch (error) {
      console.error('Full presentation error:', error);
      showToast('Failed to export full presentation', 'error');
    } finally {
      setExporting(false);
    }
  };

  const statColors = {
    slate: 'text-slate-900 dark:text-white',
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-rose-700 dark:text-rose-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    purple: 'text-violet-700 dark:text-violet-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    cyan: 'text-cyan-700 dark:text-cyan-300',
    amber: 'text-amber-700 dark:text-amber-300',
    rose: 'text-rose-700 dark:text-rose-300'
  };

  const renderStatCard = (label, value, subtitle, color = 'slate') => (
    <div className="product-surface p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${statColors[color] || statColors.slate}`}
      >
        {value}
      </p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );

  const renderBarChart = (data, labelKey, valueKey, maxValue) => (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-32 truncate">{item[labelKey]}</span>
          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.min((item[valueKey] / maxValue) * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-16 text-right">
            {typeof item[valueKey] === 'number' ? item[valueKey].toLocaleString() : item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );

  if (loading && !reportData)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );

  if (loadError && !reportData)
    return (
      <div className="product-surface p-8 text-center">
        <p className="font-semibold text-rose-700 dark:text-rose-300">
          This report could not be loaded.
        </p>
        <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        <button type="button" onClick={loadReport} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="product-surface overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Decision support</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Church Reports
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Turn ministry activity into clear pastoral and operational decisions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadReport}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={exporting}
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              type="button"
              onClick={handlePDFExport}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
            <button
              type="button"
              onClick={handlePresentation}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={exporting}
            >
              <Presentation className="h-4 w-4" /> Slides
            </button>
            <button
              type="button"
              onClick={handleFullPresentation}
              className="btn-primary inline-flex items-center gap-2"
              disabled={exporting}
            >
              <Presentation className="h-4 w-4" /> Full church deck
            </button>
          </div>
        </div>
      </section>

      {/* Report Type Tabs */}
      <div className="tab-pills flex-nowrap overflow-x-auto">
        {REPORT_TYPES.map((type) => (
          <button
            type="button"
            key={type.id}
            onClick={() => setSearchParams({ report: type.id })}
            aria-pressed={activeReport === type.id}
            className={`tab-pill flex items-center gap-2 ${activeReport === type.id ? 'active' : ''}`}
          >
            <type.icon className="w-4 h-4" />
            {type.label}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="product-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2 pb-2 sm:mr-2">
          <Filter className="h-4 w-4 text-primary-600 dark:text-primary-300" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Reporting period
          </span>
        </div>
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          From
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="input h-10 w-full text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          To
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(event) => setEndDate(event.target.value)}
            className="input h-10 w-full text-sm"
          />
        </label>
        <span className="pb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          Updates automatically
        </span>
      </div>

      {/* Report Content */}
      {reportData && (
        <div className="space-y-6">
          {/* Attendance Report */}
          {activeReport === 'attendance' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {renderStatCard(
                  'Members Recorded',
                  reportData.overall?.total_attendees || 0,
                  'Unique members'
                )}
                {renderStatCard(
                  'Present',
                  reportData.overall?.present_count || 0,
                  `${reportData.overall?.attendance_rate || 0}% rate`,
                  'green'
                )}
                {renderStatCard('Absent', reportData.overall?.absent_count || 0, '', 'red')}
                {renderStatCard(
                  'Service Days',
                  reportData.overall?.service_days || 0,
                  'In period',
                  'blue'
                )}
              </div>

              {reportData.bySection?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Attendance by Section</h3>
                  {renderBarChart(reportData.bySection, 'section_name', 'attendance_rate', 100)}
                </div>
              )}

              {reportData.topPerformers?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-1">Consistent Attendance</h3>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    Members with the strongest recorded attendance in this period.
                  </p>
                  <div className="space-y-2">
                    {reportData.topPerformers.slice(0, 10).map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i + 1}.</span>
                          <span className="text-sm">{p.name}</span>
                          <Badge variant="info">{p.section_name}</Badge>
                        </div>
                        <span className="text-sm font-bold text-green-600">{p.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportData.riskMembers?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-300">
                    Members Needing Care
                  </h3>
                  <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Below 30% recorded attendance. Use this as a conversation signal, not a
                    judgment.
                  </p>
                  <div className="space-y-2">
                    {reportData.riskMembers.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-amber-50 p-2 dark:bg-amber-900/20"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{m.name}</span>
                          <Badge variant="info">{m.section_name}</Badge>
                        </div>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                          {m.rate}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Membership Report */}
          {activeReport === 'membership' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {renderStatCard(
                  'Total Members',
                  reportData.overview?.total_members || 0,
                  '',
                  'blue'
                )}
                {renderStatCard('Active', reportData.overview?.active_members || 0, '', 'green')}
                {renderStatCard(
                  'New Joins',
                  reportData.overview?.new_joins || 0,
                  'In period',
                  'emerald'
                )}
                {renderStatCard('Inactive', reportData.overview?.inactive_members || 0, '', 'red')}
              </div>

              {reportData.byGender?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Gender Distribution</h3>
                  <div className="flex gap-4">
                    {reportData.byGender.map((g, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full ${g.gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`}
                        />
                        <span className="text-sm">
                          {g.gender}: {g.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportData.byAgeGroup?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Age Distribution</h3>
                  {renderBarChart(
                    reportData.byAgeGroup,
                    'age_group',
                    'count',
                    Math.max(...reportData.byAgeGroup.map((a) => a.count))
                  )}
                </div>
              )}

              {reportData.topSections?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Top Sections by Retention</h3>
                  <div className="space-y-2">
                    {reportData.topSections.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <span className="text-sm">{s.section_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">{s.active_members} members</span>
                          <Badge variant="success">{s.retention_rate}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Leadership Report */}
          {activeReport === 'leadership' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard(
                  'Total Leaders',
                  reportData.overview?.total_leaders || 0,
                  '',
                  'purple'
                )}
                {renderStatCard(
                  'Head Leaders',
                  reportData.overview?.head_leaders || 0,
                  '',
                  'indigo'
                )}
                {renderStatCard(
                  'Active Leaders',
                  reportData.overview?.active_leaders || 0,
                  '',
                  'green'
                )}
              </div>

              {reportData.rankings?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-1">Leadership Reporting Consistency</h3>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    Attendance submissions recorded by each ministry leader.
                  </p>
                  <div className="space-y-2">
                    {reportData.rankings.slice(0, 15).map((l, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i + 1}.</span>
                          <span className="text-sm">{l.name}</span>
                          <Badge variant="info">{l.section_name}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            {l.submissions} submissions
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Finance Report */}
          {activeReport === 'finance' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {renderStatCard(
                  'Total Contributions',
                  `₦${(reportData.overview?.total_contributions || 0).toLocaleString()}`,
                  '',
                  'emerald'
                )}
                {renderStatCard(
                  'Unique Contributors',
                  reportData.overview?.unique_contributors || 0,
                  '',
                  'blue'
                )}
                {renderStatCard(
                  'Avg Per Day',
                  `₦${(reportData.overview?.avg_per_day || 0).toLocaleString()}`,
                  '',
                  'green'
                )}
                {renderStatCard(
                  'Contribution Days',
                  reportData.overview?.contribution_days || 0,
                  '',
                  'purple'
                )}
              </div>

              {reportData.byType?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Contributions by Type</h3>
                  {renderBarChart(
                    reportData.byType,
                    'type_name',
                    'total',
                    Math.max(...reportData.byType.map((t) => t.total))
                  )}
                </div>
              )}

              {reportData.topContributors?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Top Contributors</h3>
                  <div className="space-y-2">
                    {reportData.topContributors.slice(0, 10).map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i + 1}.</span>
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">
                          ₦{c.total_contributed.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Evangelism Report */}
          {activeReport === 'evangelism' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {renderStatCard(
                  'New Believers',
                  reportData.overview?.total_souls_won || 0,
                  'In period',
                  'rose'
                )}
                {renderStatCard(
                  'Care Follow-Ups Completed',
                  reportData.overview?.follow_ups_completed || 0,
                  '',
                  'green'
                )}
                {renderStatCard(
                  'Care Follow-Ups Open',
                  reportData.overview?.follow_ups_pending || 0,
                  '',
                  'amber'
                )}
                {renderStatCard(
                  'Baptisms',
                  reportData.baptisms?.completed || 0,
                  'Completed',
                  'blue'
                )}
              </div>

              {reportData.byMonth?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">New Believers by Month</h3>
                  {renderBarChart(
                    reportData.byMonth,
                    'month',
                    'souls_won',
                    Math.max(...reportData.byMonth.map((m) => m.souls_won))
                  )}
                </div>
              )}
            </>
          )}

          {/* New Members Report */}
          {activeReport === 'newMembers' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard(
                  'Total New Members',
                  reportData.overview?.total_new_members || 0,
                  '',
                  'cyan'
                )}
                {renderStatCard('Active', reportData.overview?.active || 0, '', 'green')}
                {renderStatCard(
                  'Conversion Rate',
                  `${(reportData.conversionRates?.conversion_rate || 0).toFixed(1)}%`,
                  'To member stage',
                  'emerald'
                )}
              </div>

              {reportData.byStage?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">By Pipeline Stage</h3>
                  {renderBarChart(
                    reportData.byStage,
                    'stage',
                    'count',
                    Math.max(...reportData.byStage.map((s) => s.count))
                  )}
                </div>
              )}

              {reportData.recentMembers?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Recent New Members</h3>
                  <div className="space-y-2">
                    {reportData.recentMembers.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg"
                      >
                        <div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <Badge variant="info" className="ml-2">
                            {m.stage}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(m.join_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Home Cells Report */}
          {activeReport === 'homeCells' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard('Total Cells', reportData.overview?.total_cells || 0, '', 'amber')}
                {renderStatCard(
                  'Total Members',
                  reportData.overview?.total_members || 0,
                  'Across all cells',
                  'blue'
                )}
                {renderStatCard(
                  'Total Leaders',
                  reportData.overview?.total_leaders || 0,
                  '',
                  'green'
                )}
              </div>

              {reportData.byCell?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Home Cells by Membership</h3>
                  {renderBarChart(
                    reportData.byCell,
                    'cell_name',
                    'member_count',
                    Math.max(...reportData.byCell.map((c) => c.member_count))
                  )}
                </div>
              )}
            </>
          )}

          {/* Children Report */}
          {activeReport === 'children' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard(
                  'Total Children',
                  reportData.overview?.total_children || 0,
                  '',
                  'indigo'
                )}
                {renderStatCard(
                  'Active Classes',
                  reportData.overview?.total_classes || 0,
                  '',
                  'green'
                )}
                {renderStatCard(
                  'Active Teachers',
                  reportData.overview?.total_teachers || 0,
                  '',
                  'purple'
                )}
              </div>

              {reportData.byClass?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Enrollment by Class</h3>
                  {renderBarChart(
                    reportData.byClass,
                    'class_name',
                    'enrolled',
                    Math.max(...reportData.byClass.map((c) => c.enrolled))
                  )}
                </div>
              )}

              {reportData.recentPromotions?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Recent Promotions</h3>
                  <div className="space-y-2">
                    {reportData.recentPromotions.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
                      >
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm">{p.child_name}</span>
                        <span className="text-xs text-slate-400">
                          from {p.from_class || 'N/A'} to {p.to_class}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportData.medicalAlerts?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4 text-amber-600">Medical Alerts</h3>
                  <div className="space-y-2">
                    {reportData.medicalAlerts.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"
                      >
                        <span className="text-sm">{c.full_name}</span>
                        {c.allergies && <Badge variant="warning">Allergies: {c.allergies}</Badge>}
                        {c.medical_notes && <Badge variant="info">{c.medical_notes}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Report Footer */}
      {reportData && (
        <div className="text-xs text-slate-400 text-center">
          Report generated at {new Date(reportData.generatedAt).toLocaleString()} | Period:{' '}
          {startDate} to {endDate}
        </div>
      )}
    </div>
  );
}
