import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, WifiOff, CloudOff, UserCheck, UserX, Clock, XCircle, Search, Edit3, Save, X } from 'lucide-react';

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
  onSubmit,
  isOnline,
  queuedForDate,
  isUnauthorized,
  leaderAssignments,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [editReason, setEditReason] = useState('');
  const isEditable = !submitted || editMode;
  const currentService = serviceTypes.find(s => s.id === selectedServiceId);
  const serviceName = currentService?.name || 'Main Service';

  const unmarked = members.filter(m => !attendance[m.id]);
  const completed = members.filter(m => attendance[m.id]);
  const progress = members.length > 0 ? (completed.length / members.length) * 100 : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMembers = useMemo(() => members.filter((member) => {
    if (viewMode === 'unmarked' && attendance[member.id]) return false;
    if (viewMode === 'marked' && !attendance[member.id]) return false;
    if (!normalizedSearch) return true;

    return [
      member.full_name,
      member.membership_id,
      member.phone
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  }), [members, attendance, viewMode, normalizedSearch]);
  const filteredUnmarked = filteredMembers.filter(m => !attendance[m.id]);
  const filteredCompleted = filteredMembers.filter(m => attendance[m.id]);

  // Leaders available in the dropdown: hide those who already submitted
  // (for this date+service) unless they are the currently-selected leader.
  const availableLeaders = useMemo(() => {
    return sectionLeaders.filter((leader) =>
      !leader.has_submitted || Number(leader.id) === Number(attendanceLeaderId)
    );
  }, [sectionLeaders, attendanceLeaderId]);

  const statusConfig = {
    present: {
      active: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50',
      inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400',
      icon: UserCheck,
    },
    absent: {
      active: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400/50',
      inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400',
      icon: UserX,
    },
    excused: {
      active: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50',
      inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400',
      icon: Clock,
    },
  };

  const MemberCard = ({ member }) => {
    const currentStatus = attendance[member.id];
    return (
      <div
        className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
          currentStatus === 'present' ? 'border-emerald-300 dark:border-emerald-700' :
          currentStatus === 'absent' ? 'border-rose-300 dark:border-rose-700' :
          currentStatus === 'excused' ? 'border-amber-300 dark:border-amber-700' : ''
        }`}
      >
        {currentStatus && (
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
            currentStatus === 'present' ? 'from-emerald-500 to-teal-500' :
            currentStatus === 'absent' ? 'from-rose-500 to-pink-500' :
            'from-amber-500 to-orange-500'
          }`} />
        )}

        <div className="mb-4 relative z-10 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
            ID: {member.membership_id}
          </p>
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {member.full_name}
          </h4>
          {member.phone && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
              {member.phone}
            </p>
          )}
        </div>

        <div className="flex gap-2 relative z-10">
          {['present', 'absent', 'excused'].map((status) => {
            const isActive = attendance[member.id] === status;
            const config = statusConfig[status];
            const StatusIcon = config.icon;
            return (
              <button
                key={status}
                onClick={() => onStatusChange(member.id, status)}
                disabled={!isEditable}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${isActive ? config.active : config.inactive}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {status}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const isOfflineSubmit = !isOnline && queuedForDate;
  const submittedCount = sectionLeaders.filter(l => l.has_submitted).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress & Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Attendance Roster</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Target: <span className="text-primary-600 font-bold">{serviceName}</span> • {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary-600 dark:text-primary-400 leading-none">
              {completed.length}<span className="text-sm text-slate-400 font-bold ml-1">/ {members.length}</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Marked</p>
          </div>
        </div>

        <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-indigo-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Context & Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {isHead && sectionLeaders.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Roster Owner</label>
            </div>
            <select
              value={attendanceLeaderId || ''}
              onChange={(event) => onAttendanceLeaderChange?.(event.target.value)}
              className="input w-full bg-slate-50 dark:bg-slate-900 shadow-inner"
            >
              {availableLeaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.full_name}{leader.is_head ? ' (Head)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {submittedCount > 0
                ? `${submittedCount} leader(s) already submitted and hidden. Select another to continue.`
                : 'Select a subleader here when they are absent and you need to submit their roster.'}
            </p>
          </div>
        )}

        {/* Date Selector */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary-500" />
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Date</label>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={submitted && !editMode}
            className="input w-full bg-slate-50 dark:bg-slate-900 shadow-inner"
          />
          {submitted && !editMode && (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mt-3 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Roster locked for {serviceName}
            </div>
          )}
        </div>

        {/* Service Selector */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-violet-500" />
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Service Type</label>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceTypes.map(service => (
              <button
                key={service.id}
                onClick={() => onServiceChange(service.id)}
                disabled={submitted && !editMode}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                  selectedServiceId === service.id
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {service.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            The roster auto-selects the scheduled service for the chosen date, and you can still switch it when needed.
          </p>
        </div>
      </div>

      {actingOnBehalf && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          You are marking attendance for {attendanceLeaderName}. The record will show that you submitted it on their behalf.
        </div>
      )}

      {submitError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {submitError}
        </div>
      )}

      {members.length > 0 && !isUnauthorized && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID, or phone"
                className="input w-full pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                ['all', 'All'],
                ['unmarked', 'Unmarked'],
                ['marked', 'Marked'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`h-10 rounded-xl px-3 text-xs font-bold transition-all ${
                    viewMode === mode
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/60 text-amber-800 dark:text-amber-300">
          <WifiOff className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            You are offline. Attendance will be saved locally and synced automatically when you reconnect.
          </p>
        </div>
      )}

      {/* Attendance Cards */}
      {isUnauthorized ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-inner">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">Duty Roster Unassigned</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center mt-2">
            You are not currently assigned to take attendance for <span className="text-primary-600 font-bold">{serviceName}</span> on this date.
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-inner">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">No eligible members found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs text-center mt-2">
            None of your members meet the criteria for <span className="text-primary-600 font-bold">{serviceName}</span>.
            Check your section rules or try another service.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active / Unmarked Members */}
          {filteredUnmarked.length > 0 && !editMode && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-primary-500 rounded-full" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Remaining Members</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUnmarked.map(member => <MemberCard key={member.id} member={member} />)}
              </div>
            </div>
          )}

          {/* All marked message & Submit Action */}
          {unmarked.length === 0 && members.length > 0 && !submitted && (
            <div className="py-12 px-6 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-slate-800 rounded-3xl border border-emerald-200/60 dark:border-emerald-700/60 border-dashed animate-scale-in">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 text-center">Roster Complete!</h3>
              <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70 max-w-xs text-center mt-2 mb-8">
                You've accounted for every member in your section. Ready to finalize the records?
              </p>

              <button
                onClick={onSubmit}
                disabled={submitting}
                className={`w-full max-w-sm py-4 text-base font-bold rounded-2xl transition-all duration-300 ${
                  !isOnline
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Finalizing...
                  </span>
                ) : !isOnline ? (
                  <span className="flex items-center justify-center gap-2">
                    <CloudOff className="w-5 h-5" />
                    Save Offline →
                  </span>
                ) : (
                  'Submit Final Attendance →'
                )}
              </button>
            </div>
          )}

          {/* Edit Mode: show all members for editing */}
          {editMode && submitted && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Editing Attendance — {attendanceLeaderName}</h3>
              </div>

              {/* Edit controls — inline at the top of the edit section */}
              {editError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                  {editError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                    Edit Mode — changes are tracked and audited
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="input bg-white dark:bg-slate-800 text-sm py-2 flex-1 sm:flex-none"
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={onToggleEdit}
                    disabled={editSaving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.map(member => <MemberCard key={member.id} member={member} />)}
              </div>
            </div>
          )}

          {/* Locked / Submitted State */}
          {submitted && !editMode && (
            <div className="py-12 px-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center">Records Locked</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs text-center mt-2">
                Attendance for {attendanceLeaderName} has been {isOfflineSubmit ? 'queued for sync' : 'successfully submitted'}.
              </p>
              {isHead && (
                <button
                  onClick={onToggleEdit}
                  className="mt-6 flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Attendance
                </button>
              )}
            </div>
          )}

          {/* Hint for unmarked members */}
          {unmarked.length > 0 && !submitted && (
            <div className="flex items-center justify-center gap-3 p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wider">
                Mark remaining <span className="text-primary-600 dark:text-primary-400">{unmarked.length}</span> members to unlock submission
              </p>
            </div>
          )}

          {/* Completed Members List */}
          {filteredCompleted.length > 0 && !editMode && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Completed</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                {filteredCompleted.map(member => <MemberCard key={member.id} member={member} />)}
              </div>
            </div>
          )}

          {filteredMembers.length === 0 && !editMode && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No members match the current search or filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TakeAttendance;
