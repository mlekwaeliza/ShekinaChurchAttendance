import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLeaderData from '../hooks/useLeaderData';
import { AlertTriangle, CheckCircle2, CalendarDays } from 'lucide-react';
import useOffline from '../hooks/useOffline';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { fdate } from '../utils/date';

import LeaderOverview from '../components/leader/LeaderOverview';
import TakeAttendance from '../components/leader/TakeAttendance';
import LeaderMembers from '../components/leader/LeaderMembers';
import LeaderHistory from '../components/leader/LeaderHistory';
import LeaderReports from '../components/leader/LeaderReports';
import LeaderOutreach from '../components/leader/LeaderOutreach';
import SectionOverview from '../components/leader/SectionOverview';
import ConflictResolutionModal from '../components/leader/ConflictResolutionModal';
import ChurchCalendar from '../components/ChurchCalendar';
import HomeCellMembers from '../components/leader/HomeCellMembers';
import NewMemberPipeline from '../components/admin/NewMemberPipeline';
import LeaderContributions from '../components/leader/LeaderContributions';

const LeaderDashboard = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeTab = tab || 'dashboard';
  const data = useLeaderData();
  const { conflicts, resolveConflict } = useOffline();
  const [showConflicts, setShowConflicts] = useState(false);
  const dashboardRoster = Array.isArray(data.eligibleMembers)
    ? data.eligibleMembers
    : data.members || [];
  const unmarkedDashboardMembers = dashboardRoster.filter(
    (member) => !(data.attendance || {})[member.id]
  );
  const selectedService = data.serviceTypes.find(
    (service) => Number(service.id) === Number(data.selectedServiceId)
  );
  const {
    isHead,
    selectedDate,
    selectedServiceId,
    loadOverview,
    loadSectionPendingSubmissions
  } = data;

  // Load trends when reports tab is active
  useEffect(() => {
    if (activeTab === 'reports') {
      data.loadTrends();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load section submission status on the head leader's dashboard and overview tab.
  useEffect(() => {
    if ((activeTab === 'dashboard' || activeTab === 'overview') && isHead) {
      loadOverview();
      if (activeTab === 'dashboard') loadSectionPendingSubmissions();
    }
  }, [
    activeTab,
    isHead,
    selectedDate,
    selectedServiceId,
    loadOverview,
    loadSectionPendingSubmissions
  ]);

  if (data.loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <LoadingSkeleton type="card" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
        </div>
      </div>
    );
  }

  const handleSubmitAndRedirect = async () => {
    const success = await data.handleSubmit();
    if (success) {
      data.showMessage('Attendance submitted successfully!');
      navigate('/leader');
    }
  };

  // Tab-to-component mapping
  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <LeaderOverview
            members={data.members}
            eligibleMembers={data.eligibleMembers}
            history={data.history}
            attendance={data.attendance}
            submitted={data.submitted}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            leaderName={data.sectionInfo?.leader || user?.full_name}
            sectionName={data.sectionInfo?.name}
            isHead={data.isHead}
            onGoToAttendance={() => navigate('/leader/attendance')}
          />
        );

      case 'attendance':
        return (
          <TakeAttendance
            members={data.eligibleMembers}
            attendance={data.attendance}
            selectedDate={data.selectedDate}
            setSelectedDate={data.handleDateSelection}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.handleServiceSelection}
            submitted={data.submitted}
            submitting={data.submitting}
            submitError={data.submitError}
            isUnauthorized={data.isUnauthorized}
            leaderAssignments={data.leaderAssignments}
            isHead={data.isHead}
            sectionLeaders={data.sectionLeaders}
            attendanceLeaderId={data.attendanceLeaderId}
            attendanceLeaderName={data.attendanceLeaderName}
            actingOnBehalf={data.actingOnBehalf}
            onAttendanceLeaderChange={data.handleAttendanceLeaderSelection}
            onStatusChange={data.handleStatusChange}
            onBulkMark={data.handleBulkMark}
            onSubmit={handleSubmitAndRedirect}
            isOnline={data.isOnline}
            pendingCount={data.pendingCount}
            syncing={data.syncing}
            queuedForDate={data.queuedForDate}
            editMode={data.editMode}
            editSaving={data.editSaving}
            editError={data.editError}
            onToggleEdit={data.handleToggleEdit}
            onEditSubmit={data.handleEditSubmit}
          />
        );

      case 'calendar':
        return <ChurchCalendar />;

      case 'members':
        return (
          <LeaderMembers
            members={data.members}
            isHead={data.isHead}
            editingMember={data.editingMember}
            isMemberModalOpen={data.isMemberModalOpen}
            setIsMemberModalOpen={data.setIsMemberModalOpen}
            deletingMember={data.deletingMember}
            setDeletingMember={data.setDeletingMember}
            autogeneratedId={data.autogeneratedId}
            saving={data.saving}
            onAdd={data.openAddMember}
            onEdit={data.openEditMember}
            onSave={data.handleMemberSave}
            onDelete={data.handleMemberDelete}
            consecutiveAbsences={data.consecutiveAbsences}
            followUps={data.followUps}
            onUpdateFollowUp={data.handleUpdateFollowUp}
          />
        );

      case 'home-cells':
        return <HomeCellMembers />;

      case 'history':
        return (
          <LeaderHistory
            history={data.history}
            historyLoading={data.historyLoading}
            isHead={data.isHead}
          />
        );

      case 'reports':
        return (
          <LeaderReports
            trendsData={data.trendsData}
            trendsLoading={data.trendsLoading}
            loadTrends={data.loadTrends}
          />
        );

      case 'outreach':
        return (
          <LeaderOutreach
            members={data.members}
            serviceTypes={data.serviceTypes}
            currentServiceId={data.selectedServiceId}
          />
        );

      case 'new-members':
        return <NewMemberPipeline />;

      case 'contributions':
        return <LeaderContributions members={data.members} showMessage={data.showMessage} />;

      case 'overview':
        if (!data.isHead) {
          return (
            <LeaderOverview
              members={data.members}
              eligibleMembers={data.eligibleMembers}
              history={data.history}
              attendance={data.attendance}
              submitted={data.submitted}
              serviceTypes={data.serviceTypes}
              selectedServiceId={data.selectedServiceId}
              leaderName={data.sectionInfo?.leader || user?.full_name}
              onGoToAttendance={() => navigate('/leader/attendance')}
            />
          );
        }
        return (
          <SectionOverview
            selectedDate={data.selectedDate}
            setSelectedDate={data.handleDateSelection}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.handleServiceSelection}
            sectionName={data.sectionInfo?.name}
            overviewData={data.overviewData}
            overviewLoading={data.overviewLoading}
            loadOverview={data.loadOverview}
          />
        );

      default:
        return (
          <LeaderOverview
            members={data.members}
            eligibleMembers={data.eligibleMembers}
            history={data.history}
            attendance={data.attendance}
            submitted={data.submitted}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            leaderName={data.sectionInfo?.leader || user?.full_name}
            onGoToAttendance={() => navigate('/leader/attendance')}
          />
        );
    }
  };

  return (
    <>
      {/* Toast Message */}
      {data.message && (
        <div className="toast-success mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{data.message}</span>
        </div>
      )}

      {/* Active Tab Content */}
      {activeTab === 'dashboard' && !data.submitted && (
        <section
          className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm dark:border-rose-800 dark:bg-rose-950/30"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Attendance not submitted
                  </h2>
                  <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                    {selectedService?.name || 'Main Service'} on {fdate(data.selectedDate)} ·{' '}
                    {unmarkedDashboardMembers.length > 0
                      ? `${unmarkedDashboardMembers.length} member${unmarkedDashboardMembers.length === 1 ? '' : 's'} still need to be marked.`
                      : 'Roster is marked but the attendance has not been submitted.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/leader/attendance')}
                  className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
                >
                  Complete attendance
                </button>
              </div>
              {unmarkedDashboardMembers.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unmarkedDashboardMembers.slice(0, 9).map((member) => (
                    <li
                      key={member.id}
                      className="rounded-xl border border-rose-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-rose-900 dark:bg-slate-900/40 dark:text-slate-200"
                    >
                      {member.full_name}
                    </li>
                  ))}
                </ul>
              )}
              {unmarkedDashboardMembers.length > 9 && (
                <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                  And {unmarkedDashboardMembers.length - 9} more member
                  {unmarkedDashboardMembers.length - 9 === 1 ? '' : 's'}.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      {activeTab === 'dashboard' && data.isHead && (
        <section className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm dark:border-rose-800 dark:bg-rose-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Leaders yet to submit
                  </h2>
                  <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                    {data.sectionPendingLoading
                      ? 'Checking Sunday Main Service history…'
                      : `${data.sectionPendingSubmissions.length} pending leader submission${data.sectionPendingSubmissions.length === 1 ? '' : 's'} across the last 90 days.`}
                  </p>
                </div>
                {!data.sectionPendingLoading && data.sectionPendingSubmissions.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                    {data.sectionPendingSubmissions.length} pending
                  </span>
                )}
              </div>
              {!data.sectionPendingLoading && data.sectionPendingSubmissions.length === 0 ? (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  All leaders in your section have submitted for recorded Main Service dates.
                </p>
              ) : (
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                  {data.sectionPendingSubmissions.slice(0, 20).map((entry) => (
                    <li
                      key={`${entry.leader_id}-${entry.date}-${entry.service_id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-white/70 px-3 py-2 dark:border-rose-900 dark:bg-slate-900/40"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {entry.leader_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          {fdate(entry.date)} · {entry.service_name || 'Main Service'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          data.handleDateSelection(String(entry.date).slice(0, 10));
                          data.handleServiceSelection(entry.service_id);
                          data.handleAttendanceLeaderSelection(entry.leader_id);
                          navigate('/leader/attendance');
                        }}
                        className="text-xs font-bold text-rose-800 underline underline-offset-2 hover:text-rose-950 dark:text-rose-300 dark:hover:text-rose-100"
                      >
                        Review attendance
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {data.sectionPendingSubmissions.length > 20 && (
                <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                  Showing 20 of {data.sectionPendingSubmissions.length} pending submissions.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      {activeTab === 'dashboard' && (
        <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Unsubmitted Main Service Attendance
              </h2>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                {data.missedSubmissions.length > 0
                  ? `${data.missedSubmissions.length} Sunday Main Service date${data.missedSubmissions.length === 1 ? '' : 's'} in the last 90 days have no submission from you.`
                  : 'No unsubmitted Sunday Main Service dates in the last 90 days.'}
              </p>
              {data.missedSubmissions.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {data.missedSubmissions.slice(0, 5).map((entry) => (
                    <li
                      key={`${entry.date}-${entry.service_id || 'service'}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 dark:border-amber-900 dark:bg-slate-900/40"
                    >
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <CalendarDays className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        {fdate(entry.date)} · {entry.service_name || 'Service'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          data.handleDateSelection(String(entry.date).slice(0, 10));
                          if (entry.service_id) data.handleServiceSelection(entry.service_id);
                          navigate('/leader/attendance');
                        }}
                        className="text-xs font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
                      >
                        Review attendance
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {data.missedSubmissions.length > 5 && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                  Showing the 5 most recent missed dates.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      {renderTab()}

      {/* Conflict Resolution Modal */}
      {showConflicts && (
        <ConflictResolutionModal
          conflicts={conflicts}
          onResolve={(id, action) => {
            resolveConflict(id, action);
            setShowConflicts((_prev) => {
              const remaining = conflicts.filter((c) => c.id !== id);
              return remaining.length > 0;
            });
          }}
          onClose={() => setShowConflicts(false)}
        />
      )}
    </>
  );
};

export default LeaderDashboard;
