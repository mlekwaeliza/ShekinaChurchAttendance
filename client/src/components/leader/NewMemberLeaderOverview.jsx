import React, { useState, useEffect } from 'react';
import { newMemberLeaderAPI } from '../../services/api';
import { 
  Users, CheckCircle2, GraduationCap, ClipboardList, Clock, 
  Loader2, AlertTriangle, WifiOff, CloudOff, UserCheck, UserX, Calendar, Search
} from 'lucide-react';

const NewMemberLeaderOverview = ({
  members = [],
  attendance = {},
  selectedDate,
  setSelectedDate,
  onStatusChange,
  onSubmit,
  submitting,
  submitted,
  submitError,
  isOnline,
  leaderName,
}) => {
  const [stats, setStats] = useState({ probation: 0, graduated: 0, permanent: 0, loading: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('all');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [probRes, gradRes, permRes] = await Promise.all([
          newMemberLeaderAPI.getNewMembers('probation'),
          newMemberLeaderAPI.getNewMembers('graduated'),
          newMemberLeaderAPI.getNewMembers('permanent'),
        ]);
        setStats({
          probation: probRes.data?.length || 0,
          graduated: gradRes.data?.length || 0,
          permanent: permRes.data?.length || 0,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };
    fetchStats();
  }, [members]); // Refresh stats when members change (e.g. after database changes)

  const unmarked = members.filter(m => !attendance[m.id]);
  const completed = members.filter(m => attendance[m.id]);
  const progress = members.length > 0 ? (completed.length / members.length) * 100 : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMembers = members.filter((member) => {
    if (viewMode === 'unmarked' && attendance[member.id]) return false;
    if (viewMode === 'marked' && !attendance[member.id]) return false;
    if (!normalizedSearch) return true;

    return [
      member.full_name,
      member.membership_id,
      member.phone
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  const filteredUnmarked = filteredMembers.filter(m => !attendance[m.id]);
  const filteredCompleted = filteredMembers.filter(m => attendance[m.id]);

  const markAll = (status) => {
    unmarked.forEach((member) => {
      onStatusChange(member.id, status);
    });
  };

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
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {leaderName || 'New Member Leader'}
          </h2>
          <p className="mt-2 max-w-lg text-base text-white/80">
            Track and support our new church members during their integration journey. Submit weekly attendance and monitor their progress.
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl animate-pulse" />
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Probationary</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{stats.probation}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Currently in 4-week track</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Graduated</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{stats.graduated}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Assigned to sections</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Permanent</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{stats.permanent}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Confirmed members</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Attendance Area for Specifically New Added Members */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              Roster: Weekly Attendance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mark attendance for probationary members for the selected week.
            </p>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Week:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={submitted}
              className="input bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500 uppercase tracking-widest">Marking Progress</span>
            <span className="text-indigo-600 dark:text-indigo-400">{completed.length} / {members.length} ({Math.round(progress)}%)</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/60 text-amber-800 dark:text-amber-300">
            <WifiOff className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              You are offline. Submission is only supported while online.
            </p>
          </div>
        )}

        {submitError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
            {submitError}
          </div>
        )}

        {/* Attendance Filters and Bulk actions */}
        {members.length > 0 && (
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or phone"
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
                  className={`h-10 rounded-xl px-4 text-xs font-bold transition-all ${
                    viewMode === mode
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => markAll('present')}
                disabled={submitted || unmarked.length === 0}
                className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Remaining Present
              </button>
              <button
                type="button"
                onClick={() => markAll('absent')}
                disabled={submitted || unmarked.length === 0}
                className="h-10 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Remaining Absent
              </button>
            </div>
          </div>
        )}

        {/* Member cards */}
        {members.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center">
            <Users className="w-12 h-12 text-slate-300 mb-2" />
            <p className="font-bold">No probationary new members</p>
            <p className="text-xs max-w-xs mt-1">Add new members under the "New Members" tab to start taking attendance.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredUnmarked.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unmarked Members</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUnmarked.map(member => (
                    <div key={member.id} className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between gap-3 hover:-translate-y-0.5 transition-transform">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{member.full_name}</h4>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">{member.phone || 'No phone number'}</p>
                      </div>
                      <div className="flex gap-2">
                        {['present', 'absent'].map((status) => {
                          const isActive = attendance[member.id] === status;
                          const config = statusConfig[status];
                          const StatusIcon = config.icon;
                          return (
                            <button
                              key={status}
                              onClick={() => onStatusChange(member.id, status)}
                              disabled={submitted}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${isActive ? config.active : config.inactive}`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Banner / Locked State */}
            {unmarked.length === 0 && members.length > 0 && !submitted && (
              <div className="py-8 px-4 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-800 rounded-3xl border border-indigo-200/60 dark:border-indigo-700/60 border-dashed animate-scale-in">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-3 shadow-inner">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 text-center">Attendance Roster Complete!</h4>
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 max-w-xs text-center mt-1 mb-6">
                  Every new member has been marked. Submit to save the attendance records.
                </p>

                <button
                  onClick={onSubmit}
                  disabled={submitting}
                  className="w-full max-w-xs py-3 text-sm font-bold rounded-xl transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Submit Weekly Attendance'
                  )}
                </button>
              </div>
            )}

            {submitted && (
              <div className="py-8 px-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 text-center">Roster Submitted</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-center mt-1">
                  Attendance records have been successfully saved for this week start.
                </p>
              </div>
            )}

            {filteredCompleted.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Completed</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                  {filteredCompleted.map(member => (
                    <div key={member.id} className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-800 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{member.full_name}</h4>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">{member.phone || 'No phone number'}</p>
                      </div>
                      <div className="flex gap-2">
                        {['present', 'absent'].map((status) => {
                          const isActive = attendance[member.id] === status;
                          const config = statusConfig[status];
                          const StatusIcon = config.icon;
                          return (
                            <button
                              key={status}
                              onClick={() => onStatusChange(member.id, status)}
                              disabled={submitted}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${isActive ? config.active : config.inactive}`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewMemberLeaderOverview;
