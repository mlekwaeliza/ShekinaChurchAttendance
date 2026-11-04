import React, { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Loader2,
  WifiOff,
  CloudOff,
  UserCheck,
  UserX,
  Clock,
  XCircle,
  Search,
  Edit3,
  Save,
  X,
  ListChecks,
  Eraser
} from 'lucide-react';
import PhotoViewer from '../PhotoViewer';
import { formatLocalDate, parseLocalDate } from '../../utils/date';

const STATUS_CONFIG = {
  present: {
    active: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
    inactive:
      'bg-system-fill text-secondary-label hover:bg-system-green/[0.08] hover:text-emerald-700 dark:bg-white/[0.06] dark:hover:text-system-green',
    icon: UserCheck
  },
  absent: {
    active: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
    inactive:
      'bg-system-fill text-secondary-label hover:bg-system-red/[0.08] hover:text-rose-700 dark:bg-white/[0.06] dark:hover:text-system-red',
    icon: UserX
  },
  excused: {
    active: 'bg-amber-600 text-white shadow-sm hover:bg-amber-700 active:bg-amber-800',
    inactive:
      'bg-system-fill text-secondary-label hover:bg-system-orange/[0.08] hover:text-amber-700 dark:bg-white/[0.06] dark:hover:text-system-orange',
    icon: Clock
  }
};

// Memoized member card: marking one member must not re-render every other
// card on large rosters. Receives a per-member status string plus stable
// callbacks, so untouched cards bail out via shallow prop comparison.
const MemberCard = memo(function MemberCard({
  member,
  status,
  isEditable,
  onStatusChange,
  onViewPhoto,
  t
}) {
  return (
    <div
      className={`card relative overflow-hidden p-5 ${
        status === 'present'
          ? 'border-system-green/40 dark:border-system-green/30'
          : status === 'absent'
            ? 'border-system-red/40 dark:border-system-red/30'
            : status === 'excused'
              ? 'border-system-orange/40 dark:border-system-orange/30'
              : ''
      }`}
    >
      <div className="relative z-10 mb-4 pt-1">
        {/* Avatar */}
        <div className="flex justify-center mb-3">
          {member.profile_picture ? (
            <button
              type="button"
              onClick={() => onViewPhoto(member)}
              aria-label={`View photo of ${member.full_name}`}
              title="Click to view full photo"
              className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500 text-3xl font-black text-white cursor-pointer transition-all hover:ring-4 hover:ring-primary-500/25 focus-ring"
            >
              <img
                src={member.profile_picture}
                alt={member.full_name}
                className="h-full w-full object-cover object-[center_20%]"
              />
            </button>
          ) : (
            <div
              aria-hidden="true"
              className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500 text-3xl font-black text-white"
            >
              <span>
                {member.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <p className="mb-0.5 text-center text-caption-1 font-medium text-tertiary-label">
          ID: {member.membership_id}
        </p>
        <h4 className="text-center text-subheadline font-semibold leading-tight text-label">
          {member.full_name}
        </h4>
        {member.phone && (
          <p className="mt-0.5 text-center text-footnote font-medium text-secondary-label">
            {member.phone}
          </p>
        )}
      </div>

      <div className="flex gap-2 relative z-10">
        {['present', 'absent', 'excused'].map((option) => {
          const isActive = status === option;
          const config = STATUS_CONFIG[option];
          const StatusIcon = config.icon;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onStatusChange(member.id, option)}
              disabled={!isEditable}
              aria-pressed={isActive}
              aria-label={`Mark ${member.full_name} as ${option}`}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors duration-200 ${isActive ? config.active : config.inactive}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {t(`attendance.${option}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const TakeAttendance = ({
  members,
  attendance,
  selectedDate,
  setSelectedDate,
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  submitted,
  submitting,
  submitError,
  onStatusChange,
  onBulkMark,
  onSubmit,
  isOnline,
  pendingCount = 0,
  syncing = false,
  queuedForDate,
  isUnauthorized,
  isHead = false,
  sectionLeaders = [],
  attendanceLeaderId,
  attendanceLeaderName,
  actingOnBehalf = false,
  onAttendanceLeaderChange,
  editMode = false,
  editSaving = false,
  editError = '',
  onToggleEdit,
  onEditSubmit
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [editReason, setEditReason] = useState('');
  const [selectedPhotoMember, setSelectedPhotoMember] = useState(null);
  const isEditable = !submitted || editMode;
  const currentService = serviceTypes.find((s) => s.id === selectedServiceId);
  const serviceName = currentService?.name || 'Main Service';

  const unmarked = members.filter((m) => !attendance[m.id]);
  const completed = members.filter((m) => attendance[m.id]);
  const progress = members.length > 0 ? (completed.length / members.length) * 100 : 0;
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const canBulkEdit = isEditable && members.length > 0;

  // Two-tap confirm on large rosters: bulk actions make it easy to submit
  // without noticing a mis-tap, so the first tap arms and shows the
  // present/absent/excused breakdown instead of submitting immediately.
  const needsConfirm = members.length >= 15;
  const [confirmArmed, setConfirmArmed] = useState(false);
  useEffect(() => {
    setConfirmArmed(false);
  }, [attendance]);
  const statusCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, excused: 0 };
    Object.values(attendance).forEach((s) => {
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return counts;
  }, [attendance]);
  const requestSubmit = () => {
    if (needsConfirm && !confirmArmed) {
      setConfirmArmed(true);
      return;
    }
    setConfirmArmed(false);
    onSubmit();
  };
  const confirmLabel = `${t('attendance.confirmSubmit')} (${statusCounts.present} ${t('attendance.present')}, ${statusCounts.absent} ${t('attendance.absent')}, ${statusCounts.excused} ${t('attendance.excused')})`;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (viewMode === 'unmarked' && attendance[member.id]) return false;
        if (viewMode === 'marked' && !attendance[member.id]) return false;
        if (!normalizedSearch) return true;

        return [member.full_name, member.membership_id, member.phone].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedSearch)
        );
      }),
    [members, attendance, viewMode, normalizedSearch]
  );
  const filteredUnmarked = filteredMembers.filter((m) => !attendance[m.id]);
  const filteredCompleted = filteredMembers.filter((m) => attendance[m.id]);

  // Leaders available in the dropdown: hide those who already submitted
  // (for this date+service) unless they are the currently-selected leader.
  const availableLeaders = useMemo(() => {
    return sectionLeaders.filter(
      (leader) => !leader.has_submitted || Number(leader.id) === Number(attendanceLeaderId)
    );
  }, [sectionLeaders, attendanceLeaderId]);

  // Renders one member card. Props are primitives/stable callbacks so memo
  // skips untouched cards when a sibling's status changes.
  const renderMemberCard = (member) => (
    <MemberCard
      key={member.id}
      member={member}
      status={attendance[member.id]}
      isEditable={isEditable}
      onStatusChange={onStatusChange}
      onViewPhoto={setSelectedPhotoMember}
      t={t}
    />
  );

  const isOfflineSubmit = !isOnline && queuedForDate;
  const submittedCount = sectionLeaders.filter((l) => l.has_submitted).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress & Stats */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="truncate text-title-3 font-semibold text-label">
              {t('attendance.takeAttendance')}
            </h3>
            <p className="mt-0.5 truncate text-footnote text-secondary-label">
              {t('attendance.markAttendanceFor')}:{' '}
              <span className="font-semibold text-primary-700 dark:text-primary-300">
                {serviceName}
              </span>{' '}
              •{' '}
              {parseLocalDate(selectedDate).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-title-1 font-semibold leading-none tabular-nums text-primary-700 dark:text-primary-300">
              {completed.length}
              <span className="ml-1 text-subheadline font-medium text-tertiary-label">
                / {members.length}
              </span>
            </p>
            <p className="mt-1 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
              {t('attendance.marked')}
            </p>
          </div>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-system-fill"
          role="progressbar"
          aria-label={t('attendance.progress', {
            completed: completed.length,
            total: members.length
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full bg-primary-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Context & Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {isHead && sectionLeaders.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-emerald-700 dark:text-system-green" />
              <label className="text-footnote font-semibold text-secondary-label">
                Roster Owner
              </label>
            </div>
            <select
              value={attendanceLeaderId || ''}
              onChange={(event) => onAttendanceLeaderChange?.(event.target.value)}
              className="input w-full"
            >
              {availableLeaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.full_name}
                  {leader.is_head ? ' (Head)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-3 text-footnote text-secondary-label">
              {submittedCount > 0
                ? `${submittedCount} leader(s) already submitted and hidden. Select another to continue.`
                : 'Select a subleader here when they are absent and you need to submit their roster.'}
            </p>
          </div>
        )}

        {/* Date Selector */}
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-700 dark:text-primary-300" />
            <label className="text-footnote font-semibold text-secondary-label">Target Date</label>
          </div>
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={submitted && !editMode}
            className="input w-full"
          />
          {submitted && !editMode && (
            <div className="mt-3 flex items-center gap-2 text-footnote font-medium text-emerald-700 dark:text-system-green">
              <CheckCircle2 className="w-4 h-4" />
              Roster locked for {serviceName}
            </div>
          )}
        </div>

        {/* Service Selector */}
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-700 dark:text-system-purple" />
            <label className="text-footnote font-semibold text-secondary-label">
              Select Service Type
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={() => onServiceChange(service.id)}
                disabled={submitted && !editMode}
                className={`rounded-lg px-3 py-2 text-caption-1 font-semibold transition-colors focus-ring ${
                  selectedServiceId === service.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-system-fill text-secondary-label hover:text-label dark:bg-white/[0.06]'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {service.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-footnote text-secondary-label">
            The roster auto-selects the scheduled service for the chosen date, and you can still
            switch it when needed.
          </p>
        </div>
      </div>

      {actingOnBehalf && (
        <div className="rounded-xl bg-system-orange/10 px-4 py-3 text-footnote font-medium text-amber-700 dark:text-system-orange">
          You are marking attendance for {attendanceLeaderName}. The record will show that you
          submitted it on their behalf.
        </div>
      )}

      {submitError && (
        <div className="rounded-xl bg-system-red/10 px-4 py-3 text-footnote font-medium text-rose-700 dark:text-system-red">
          {submitError}
        </div>
      )}

      {members.length > 0 && !isUnauthorized && (
        <div className="card p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('attendance.searchMembers')}
                className="input w-full pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                ['all', t('attendance.filterAll')],
                ['unmarked', t('attendance.filterUnmarked')],
                ['marked', t('attendance.filterMarked')]
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`h-10 rounded-lg px-3 text-caption-1 font-semibold transition-colors focus-ring ${
                    viewMode === mode
                      ? 'bg-primary-500 text-white'
                      : 'bg-system-fill text-secondary-label hover:text-label dark:bg-white/[0.06]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-separator/60 pt-3 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() =>
                onBulkMark?.(
                  'present',
                  filteredMembers.map((m) => m.id)
                )
              }
              disabled={!canBulkEdit || filteredMembers.length === 0}
              title={`${t('attendance.markAllPresent')} (${filteredMembers.length})`}
              className="btn btn-sm h-9 gap-1.5 bg-emerald-700 px-3 text-white hover:bg-emerald-800 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ListChecks className="h-4 w-4" />
              {t('attendance.markAllPresent')}
              {filteredMembers.length !== members.length && (
                <span className="opacity-80">({filteredMembers.length})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                onBulkMark?.(
                  null,
                  filteredMembers.map((m) => m.id)
                )
              }
              disabled={!canBulkEdit || !filteredMembers.some((m) => attendance[m.id])}
              title={t('attendance.clearMarks')}
              className="btn-secondary btn-sm h-9"
            >
              <Eraser className="h-4 w-4" />
              {t('attendance.clearMarks')}
            </button>
            {!isEditable && (
              <span className="text-caption-2 font-medium text-tertiary-label">
                {t('attendance.submitted')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-3 rounded-xl border border-system-orange/30 bg-system-orange/10 px-4 py-3 text-amber-700 dark:text-system-orange">
          <WifiOff className="w-5 h-5 shrink-0" />
          <p className="text-footnote font-medium leading-relaxed">
            You are offline. Attendance will be saved locally and synced automatically when you
            reconnect.
            {pendingCount > 0 && (
              <span className="font-bold">
                {' '}
                {pendingCount} submission{pendingCount === 1 ? '' : 's'} waiting to sync.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Pending sync status — visible while online until the queue drains */}
      {isOnline && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-system-blue/30 bg-system-blue/10 px-4 py-3 text-blue-700 dark:text-system-blue">
          {syncing ? (
            <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
          ) : (
            <CloudOff className="w-5 h-5 shrink-0" />
          )}
          <p className="text-footnote font-medium leading-relaxed" aria-live="polite">
            {syncing
              ? `Syncing ${pendingCount} offline submission${pendingCount === 1 ? '' : 's'}…`
              : `${pendingCount} offline submission${pendingCount === 1 ? '' : 's'} still pending — they will sync automatically. Keep the app open.`}
          </p>
        </div>
      )}

      {/* Attendance Cards */}
      {isUnauthorized ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-system-red/15">
            <XCircle className="w-8 h-8 text-rose-700 dark:text-system-red" />
          </div>
          <p className="text-title-3 font-semibold text-label">Duty Roster Unassigned</p>
          <p className="mt-2 max-w-sm text-center text-subheadline text-secondary-label">
            You are not currently assigned to take attendance for{' '}
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              {serviceName}
            </span>{' '}
            on this date.
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-system-fill">
            <UserX className="w-8 h-8 text-tertiary-label" />
          </div>
          <p className="text-title-3 font-semibold text-label">No eligible members found</p>
          <p className="mt-2 max-w-xs text-center text-subheadline text-secondary-label">
            None of your members meet the criteria for{' '}
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              {serviceName}
            </span>
            . Check your section rules or try another service.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active / Unmarked Members */}
          {filteredUnmarked.length > 0 && !editMode && (
            <div className="space-y-4">
              <h3 className="section-eyebrow">Remaining Members</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUnmarked.map((member) => renderMemberCard(member))}
              </div>
            </div>
          )}

          {/* All marked message & Submit Action */}
          {unmarked.length === 0 && members.length > 0 && !submitted && (
            <div className="flex animate-scale-in flex-col items-center justify-center rounded-2xl border border-dashed border-system-green/30 bg-system-green/[0.06] px-6 py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-system-green/15">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 dark:text-system-green" />
              </div>
              <h3 className="text-center text-title-3 font-semibold text-emerald-800 dark:text-system-green">
                Roster Complete!
              </h3>
              <p className="mb-8 mt-2 max-w-xs text-center text-footnote text-secondary-label">
                You've accounted for every member in your section. Ready to finalize the records?
              </p>

              <button
                onClick={requestSubmit}
                disabled={submitting}
                className={`h-12 w-full max-w-sm rounded-xl text-subheadline font-semibold text-white transition-colors ${
                  confirmArmed || !isOnline ? 'bg-system-orange hover:bg-amber-600' : 'btn-primary'
                } disabled:opacity-50`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('attendance.submitting')}
                  </span>
                ) : confirmArmed ? (
                  confirmLabel
                ) : !isOnline ? (
                  <span className="flex items-center justify-center gap-2">
                    <CloudOff className="w-5 h-5" />
                    {t('attendance.queuedOffline')}
                  </span>
                ) : (
                  t('attendance.submit') + ' →'
                )}
              </button>
            </div>
          )}

          {/* Edit Mode: show all members for editing */}
          {editMode && submitted && (
            <div className="space-y-4">
              <h3 className="section-eyebrow">Editing Attendance — {attendanceLeaderName}</h3>

              {/* Edit controls — inline at the top of the edit section */}
              {editError && (
                <div className="rounded-xl bg-system-red/10 px-4 py-3 text-footnote font-medium text-rose-700 dark:text-system-red">
                  {editError}
                </div>
              )}
              <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-system-indigo/20 bg-system-indigo/[0.07] p-4 sm:flex-row sm:items-center dark:border-system-indigo/30">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-system-indigo/15">
                    <Edit3 className="h-4 w-4 text-primary-700 dark:text-primary-300" />
                  </span>
                  <span className="text-footnote font-semibold text-primary-700 dark:text-primary-300">
                    Edit Mode — changes are tracked and audited
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="select h-9 flex-1 text-footnote sm:w-auto sm:flex-none"
                  >
                    <option value="">Select reason...</option>
                    <option value="Correction">Correction</option>
                    <option value="Member arrived late">Member arrived late</option>
                    <option value="Member notified late">Member notified late</option>
                    <option value="Paper attendance">Paper attendance</option>
                    <option value="Other">Other</option>
                  </select>
                  <button
                    onClick={() => onEditSubmit(editReason)}
                    disabled={editSaving || !editReason}
                    className="btn-sm btn-primary"
                  >
                    {editSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={onToggleEdit}
                    disabled={editSaving}
                    className="btn-sm btn-secondary"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.map((member) => renderMemberCard(member))}
              </div>
            </div>
          )}

          {/* Locked / Submitted State */}
          {submitted && !editMode && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-separator/70 bg-system-grouped-background/60 px-6 py-12 dark:border-white/[0.12] dark:bg-white/[0.02]">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-green/15">
                <CheckCircle2 className="h-7 w-7 text-emerald-700 dark:text-system-green" />
              </div>
              <h3 className="text-center text-title-3 font-semibold text-label">Records Locked</h3>
              <p className="mt-2 max-w-xs text-center text-footnote leading-relaxed text-secondary-label">
                Attendance for {attendanceLeaderName} has been{' '}
                {isOfflineSubmit ? 'queued for sync' : 'successfully submitted'}.
              </p>
              {isHead && (
                <button
                  onClick={onToggleEdit}
                  className="btn-secondary btn-sm mt-6 flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Attendance
                </button>
              )}
            </div>
          )}

          {/* Hint for unmarked members */}
          {unmarked.length > 0 && !submitted && (
            <div className="flex items-center justify-center gap-2.5 rounded-xl bg-system-orange/[0.08] px-4 py-3 text-amber-700 dark:text-system-orange">
              <Clock className="h-4 w-4 shrink-0 animate-pulse" />
              <p className="text-footnote font-medium">
                Mark remaining <strong className="font-semibold">{unmarked.length}</strong> member
                {unmarked.length === 1 ? '' : 's'} to unlock submission
              </p>
            </div>
          )}

          {/* Completed Members List */}
          {filteredCompleted.length > 0 && !editMode && (
            <div className="space-y-4 border-t border-separator/60 pt-5 dark:border-white/[0.08]">
              <h3 className="section-eyebrow">Completed</h3>
              <div className="grid grid-cols-1 gap-4 opacity-75 md:grid-cols-2 lg:grid-cols-3">
                {filteredCompleted.map((member) => renderMemberCard(member))}
              </div>
            </div>
          )}

          {filteredMembers.length === 0 && !editMode && (
            <div className="rounded-2xl border border-dashed border-separator/70 bg-secondary-system-grouped-background p-8 text-center text-footnote font-medium text-secondary-label dark:border-white/[0.12]">
              No members match the current search or filter.
            </div>
          )}
        </div>
      )}

      {/* Sticky action bar — keeps progress + submit reachable on long rosters */}
      {members.length > 0 && !isUnauthorized && !submitted && !editMode && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background/95 p-3.5 shadow-popover backdrop-blur dark:border-white/[0.1] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-baseline gap-1.5 text-footnote" aria-live="polite">
            <span className="text-headline font-semibold tabular-nums text-label">
              {completed.length}
            </span>
            <span className="font-medium tabular-nums text-tertiary-label">/ {members.length}</span>
            <span className="ml-1 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
              {t('attendance.marked')}
            </span>
          </p>
          <button
            type="button"
            onClick={requestSubmit}
            disabled={submitting || unmarked.length > 0}
            title={
              unmarked.length > 0
                ? t('attendance.completeToSubmit')
                : confirmArmed
                  ? confirmLabel
                  : t('attendance.submit')
            }
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-footnote font-semibold text-white transition-colors disabled:cursor-not-allowed ${
              confirmArmed ? 'bg-system-orange hover:bg-amber-600' : 'btn-primary'
            } disabled:bg-system-fill disabled:text-tertiary-label`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('attendance.submitting')}
              </>
            ) : confirmArmed ? (
              confirmLabel
            ) : (
              <>{t('attendance.submit')} →</>
            )}
          </button>
        </div>
      )}

      {selectedPhotoMember && (
        <PhotoViewer
          src={selectedPhotoMember.profile_picture}
          alt={selectedPhotoMember.full_name}
          onClose={() => setSelectedPhotoMember(null)}
        />
      )}
    </div>
  );
};

export default TakeAttendance;
