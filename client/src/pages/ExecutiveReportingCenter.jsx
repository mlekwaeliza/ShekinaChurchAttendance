import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PDFReportGenerator } from '../utils/pdfReportGenerator';
import Badge from '../components/ui/Badge';
import { BarChart3, Download, FileText, Users, Calendar, TrendingUp, Heart, Baby, Home, DollarSign, Filter, RefreshCw } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance', icon: Calendar, color: 'blue' },
  { id: 'membership', label: 'Membership', icon: Users, color: 'green' },
  { id: 'leadership', label: 'Leadership', icon: TrendingUp, color: 'purple' },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: 'emerald' },
  { id: 'evangelism', label: 'Evangelism', icon: Heart, color: 'rose' },
  { id: 'newMembers', label: 'New Members', icon: Users, color: 'cyan' },
  { id: 'homeCells', label: 'Home Cells', icon: Home, color: 'amber' },
  { id: 'children', label: 'Children', icon: Baby, color: 'indigo' },
];

export default function ExecutiveReportingCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReport = searchParams.get('report') || 'attendance';
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadReport(); }, [activeReport, startDate, endDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = { start_date: startDate, end_date: endDate };
      let data;
      
      switch (activeReport) {
        case 'attendance': data = await adminAPI.reports.getAttendance(params); break;
        case 'membership': data = await adminAPI.reports.getMembership(params); break;
        case 'leadership': data = await adminAPI.reports.getLeadership(params); break;
        case 'finance': data = await adminAPI.reports.getFinance(params); break;
        case 'evangelism': data = await adminAPI.reports.getEvangelism(params); break;
        case 'newMembers': data = await adminAPI.reports.getNewMembers(params); break;
        case 'homeCells': data = await adminAPI.reports.getHomeCells(params); break;
        case 'children': data = await adminAPI.reports.getChildren(params); break;
        default: data = await adminAPI.reports.getAttendance(params);
      }
      
      setReportData(data);
    } catch (error) {
      console.error('Failed to load report:', error);
      showToast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  const handlePDFExport = () => {
    if (!reportData) {
      showToast('No data to export', 'error');
      return;
    }

    try {
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

  const renderStatCard = (label, value, subtitle, color = 'slate') => (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );

  const renderBarChart = (data, labelKey, valueKey, maxValue) => (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-32 truncate">{item[labelKey]}</span>
          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.min((item[valueKey] / maxValue) * 100, 100)}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-16 text-right">
            {typeof item[valueKey] === 'number' ? item[valueKey].toLocaleString() : item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );

  if (loading && !reportData) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Reporting Center</h1>
          <p className="text-slate-500 dark:text-slate-400">Comprehensive reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadReport} className="btn-secondary flex items-center gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2" disabled={exporting}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={handlePDFExport} className="btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="tab-pills flex-wrap">
        {REPORT_TYPES.map(type => (
          <button key={type.id} onClick={() => setSearchParams({ report: type.id })}
            className={`tab-pill flex items-center gap-2 ${activeReport === type.id ? 'active' : ''}`}>
            <type.icon className="w-4 h-4" />
            {type.label}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-500">Period:</span>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm" />
        <span className="text-slate-400">to</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm" />
        <button onClick={loadReport} className="btn-secondary text-sm px-3 py-1.5">Apply</button>
      </div>

      {/* Report Content */}
      {reportData && (
        <div className="space-y-6">
          {/* Attendance Report */}
          {activeReport === 'attendance' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {renderStatCard('Total Attendees', reportData.overall?.total_attendees || 0, 'Unique members')}
                {renderStatCard('Present', reportData.overall?.present_count || 0, `${reportData.overall?.attendance_rate || 0}% rate`, 'green')}
                {renderStatCard('Absent', reportData.overall?.absent_count || 0, '', 'red')}
                {renderStatCard('Service Days', reportData.overall?.service_days || 0, 'In period', 'blue')}
              </div>

              {reportData.bySection?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Attendance by Section</h3>
                  {renderBarChart(reportData.bySection, 'section_name', 'attendance_rate', 100)}
                </div>
              )}

              {reportData.topPerformers?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Top Performers</h3>
                  <div className="space-y-2">
                    {reportData.topPerformers.slice(0, 10).map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
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
                  <h3 className="font-semibold mb-4 text-red-600">At-Risk Members (Below 30% Attendance)</h3>
                  <div className="space-y-2">
                    {reportData.riskMembers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{m.name}</span>
                          <Badge variant="info">{m.section_name}</Badge>
                        </div>
                        <span className="text-sm font-bold text-red-600">{m.rate}%</span>
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
                {renderStatCard('Total Members', reportData.overview?.total_members || 0, '', 'blue')}
                {renderStatCard('Active', reportData.overview?.active_members || 0, '', 'green')}
                {renderStatCard('New Joins', reportData.overview?.new_joins || 0, 'In period', 'emerald')}
                {renderStatCard('Inactive', reportData.overview?.inactive_members || 0, '', 'red')}
              </div>

              {reportData.byGender?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Gender Distribution</h3>
                  <div className="flex gap-4">
                    {reportData.byGender.map((g, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${g.gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                        <span className="text-sm">{g.gender}: {g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportData.byAgeGroup?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Age Distribution</h3>
                  {renderBarChart(reportData.byAgeGroup, 'age_group', 'count', Math.max(...reportData.byAgeGroup.map(a => a.count)))}
                </div>
              )}

              {reportData.topSections?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Top Sections by Retention</h3>
                  <div className="space-y-2">
                    {reportData.topSections.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
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
                {renderStatCard('Total Leaders', reportData.overview?.total_leaders || 0, '', 'purple')}
                {renderStatCard('Head Leaders', reportData.overview?.head_leaders || 0, '', 'indigo')}
                {renderStatCard('Active Leaders', reportData.overview?.active_leaders || 0, '', 'green')}
              </div>

              {reportData.rankings?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Leader Rankings by Submissions</h3>
                  <div className="space-y-2">
                    {reportData.rankings.slice(0, 15).map((l, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i + 1}.</span>
                          <span className="text-sm">{l.name}</span>
                          <Badge variant="info">{l.section_name}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">{l.submissions} submissions</span>
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
                {renderStatCard('Total Contributions', `₦${(reportData.overview?.total_contributions || 0).toLocaleString()}`, '', 'emerald')}
                {renderStatCard('Unique Contributors', reportData.overview?.unique_contributors || 0, '', 'blue')}
                {renderStatCard('Avg Per Day', `₦${(reportData.overview?.avg_per_day || 0).toLocaleString()}`, '', 'green')}
                {renderStatCard('Contribution Days', reportData.overview?.contribution_days || 0, '', 'purple')}
              </div>

              {reportData.byType?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Contributions by Type</h3>
                  {renderBarChart(reportData.byType, 'type_name', 'total', Math.max(...reportData.byType.map(t => t.total)))}
                </div>
              )}

              {reportData.topContributors?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Top Contributors</h3>
                  <div className="space-y-2">
                    {reportData.topContributors.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{i + 1}.</span>
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">₦{c.total_contributed.toLocaleString()}</span>
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
                {renderStatCard('Souls Won', reportData.overview?.total_souls_won || 0, 'In period', 'rose')}
                {renderStatCard('Follow-ups Completed', reportData.overview?.follow_ups_completed || 0, '', 'green')}
                {renderStatCard('Follow-ups Pending', reportData.overview?.follow_ups_pending || 0, '', 'amber')}
                {renderStatCard('Baptisms', reportData.baptisms?.completed || 0, 'Completed', 'blue')}
              </div>

              {reportData.byMonth?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Souls Won by Month</h3>
                  {renderBarChart(reportData.byMonth, 'month', 'souls_won', Math.max(...reportData.byMonth.map(m => m.souls_won)))}
                </div>
              )}
            </>
          )}

          {/* New Members Report */}
          {activeReport === 'newMembers' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard('Total New Members', reportData.overview?.total_new_members || 0, '', 'cyan')}
                {renderStatCard('Active', reportData.overview?.active || 0, '', 'green')}
                {renderStatCard('Conversion Rate', `${(reportData.conversionRates?.conversion_rate || 0).toFixed(1)}%`, 'To member stage', 'emerald')}
              </div>

              {reportData.byStage?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">By Pipeline Stage</h3>
                  {renderBarChart(reportData.byStage, 'stage', 'count', Math.max(...reportData.byStage.map(s => s.count)))}
                </div>
              )}

              {reportData.recentMembers?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Recent New Members</h3>
                  <div className="space-y-2">
                    {reportData.recentMembers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                        <div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <Badge variant="info" className="ml-2">{m.stage}</Badge>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(m.join_date).toLocaleDateString()}</span>
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
                {renderStatCard('Total Members', reportData.overview?.total_members || 0, 'Across all cells', 'blue')}
                {renderStatCard('Total Leaders', reportData.overview?.total_leaders || 0, '', 'green')}
              </div>

              {reportData.byCell?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Home Cells by Membership</h3>
                  {renderBarChart(reportData.byCell, 'cell_name', 'member_count', Math.max(...reportData.byCell.map(c => c.member_count)))}
                </div>
              )}
            </>
          )}

          {/* Children Report */}
          {activeReport === 'children' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderStatCard('Total Children', reportData.overview?.total_children || 0, '', 'indigo')}
                {renderStatCard('Active Classes', reportData.overview?.total_classes || 0, '', 'green')}
                {renderStatCard('Active Teachers', reportData.overview?.total_teachers || 0, '', 'purple')}
              </div>

              {reportData.byClass?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Enrollment by Class</h3>
                  {renderBarChart(reportData.byClass, 'class_name', 'enrolled', Math.max(...reportData.byClass.map(c => c.enrolled)))}
                </div>
              )}

              {reportData.recentPromotions?.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-4">Recent Promotions</h3>
                  <div className="space-y-2">
                    {reportData.recentPromotions.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm">{p.child_name}</span>
                        <span className="text-xs text-slate-400">from {p.from_class || 'N/A'} to {p.to_class}</span>
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
                      <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
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
          Report generated at {new Date(reportData.generatedAt).toLocaleString()} | Period: {startDate} to {endDate}
        </div>
      )}
    </div>
  );
}
