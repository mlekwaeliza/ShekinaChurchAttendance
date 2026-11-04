import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  GraduationCap,
  ClipboardList,
  Loader2,
  WifiOff,
  UserCheck,
  UserX,
  Search
} from 'lucide-react';
import { newMemberLeaderAPI } from '../../services/api';

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
  leaderName
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
          newMemberLeaderAPI.getNewMembers('permanent')
        ]);
        setStats({
          probation: probRes.data?.length || 0,
          graduated: gradRes.data?.length || 0,
          permanent: permRes.data?.length || 0,
          loading: false
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };
    fetchStats();
  }, [members]); // Refresh stats when members change (e.g. after database changes)

  const unmarked = members.filter((m) => !attendance[m.id]);
  const completed = members.filter((m) => attendance[m.id]);
  const progress = members.length > 0 ? (completed.length / members.length) * 100 : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMembers = members.filter((member) => {
    if (viewMode === 'unmarked' && attendance[member.id]) return false;
    if (viewMode === 'marked' && !attendance[member.id]) return false;
    if (!normalizedSearch) return true;

    return [member.full_name, member.membership_id, member.phone].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

  const filteredUnmarked = filteredMembers.filter((m) => !attendance[m.id]);
  const filteredCompleted = filteredMembers.filter((m) => attendance[m.id]);

  const markAll = (status) => {
    unmarked.forEach((member) => {
      onStatusChange(member.id, status);
    });
  };

  const statusConfig = {
    present: {
      active: 'bg-emerald-600 text-white',
      inactive:
        'bg-system-fill text-secondary-label hover:bg-system-green/[0.08] hover:text-emerald-700 dark:bg-white/[0.06] dark:hover:text-system-green',
      icon: UserCheck
    },
    absent: {
      active: 'bg-rose-600 text-white',
      inactive:
        'bg-system-fill text-secondary-label hover:bg-system-red/[0.08] hover:text-rose-700 dark:bg-white/[0.06] dark:hover:text-system-red',
      icon: UserX
    }
  };

  const summaryCards = [
    {
      label: 'Probationary',
      value: stats.probation,
      note: 'Currently in 4-week track',
      icon: Users,
      well: 'bg-system-indigo/15',
      iconColor: 'text-primary-700 dark:text-primary-300'
    },
    {
      label: 'Graduated',
      value: stats.graduated,
      note: 'Assigned to sections',
      icon: GraduationCap,
      well: 'bg-system-green/15',
      iconColor: 'text-emerald-700 dark:text-system-green'
    },
    {
      label: 'Permanent',
      value: stats.permanent,
      note: 'Confirmed members',
      icon: CheckCircle2,
      well: 'bg-system-purple/15',
      iconColor: 'text-purple-700 dark:text-system-purple'
    }
  ];

  const renderMemberCard = (member) => {
    const isComplete = Boolean(attendance[member.id]);
    return (
      <div
        key={member.id}
        className={`card flex flex-col justify-between gap-3 p-4 ${isComplete ? 'border-system-green/30 dark:border-system-green/25' : ''}`}
      >
        <div className="min-w-0">
          <h4 className="truncate text-footnote font-semibold text-label">{member.full_name}</h4>
          <p className="mt-0.5 truncate text-caption-1 text-secondary-label">
            {member.phone || 'No phone number'}
          </p>
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
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-caption-1 font-semibold capitalize transition-colors disabled:cursor-not-allowed ${isActive ? config.active : config.inactive}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome */}
      <section className="card p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1 text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
          <Users className="h-3.5 w-3.5" />
          New Members
        </span>
        <h2 className="mt-4 text-title-1 font-semibold text-label">
          Welcome, {leaderName || 'New Member Leader'}
        </h2>
        <p className="mt-2 max-w-xl text-subheadline leading-relaxed text-secondary-label">
          Track and support our new church members during their integration journey. Submit weekly
          attendance and monitor their progress.
        </p>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))
          : summaryCards.map((card) => (
              <article key={card.label} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-footnote font-medium text-secondary-label">{card.label}</p>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${card.well}`}
                  >
                    <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                  </span>
                </div>
                <p className="mt-2.5 text-title-1 font-semibold leading-none tabular-nums text-label">
                  {card.value}
                </p>
                <p className="mt-2 text-caption-1 text-secondary-label">{card.note}</p>
              </article>
            ))}
      </div>

      {/* Attendance */}
      <section className="card space-y-6 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-system-indigo/15">
                <ClipboardList className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              </span>
              <h3 className="text-title-3 font-semibold text-label">Roster: Weekly Attendance</h3>
            </div>
            <p className="mt-2 text-footnote text-secondary-label">
              Mark attendance for probationary members for the selected week.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="new-member-week"
              className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label"
            >
              Target week
            </label>
            <input
              id="new-member-week"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={submitted}
              className="input h-9 w-40 text-footnote"
            />
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
              Marking progress
            </span>
            <span className="text-footnote font-semibold tabular-nums text-label">
              {completed.length} / {members.length} ({Math.round(progress)}%)
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-system-fill"
            role="progressbar"
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

        {!isOnline && (
          <div className="flex items-center gap-3 rounded-xl bg-system-orange/10 px-4 py-3 text-amber-700 dark:text-system-orange">
            <WifiOff className="h-4 w-4 shrink-0" />
            <p className="text-footnote font-medium">
              You are offline. Submission is only supported while online.
            </p>
          </div>
        )}

        {submitError && (
          <div className="rounded-xl bg-system-red/10 px-4 py-3 text-footnote font-medium text-rose-700 dark:text-system-red">
            {submitError}
          </div>
        )}

        {/* Filters & bulk actions */}
        {members.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-separator/60 pt-4 dark:border-white/[0.08] xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or phone"
                className="input w-full pl-10"
              />
            </div>

            <div className="tab-pills">
              {[
                ['all', 'All'],
                ['unmarked', 'Unmarked'],
                ['marked', 'Marked']
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`tab-pill justify-center ${viewMode === mode ? 'active' : ''}`}
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
                className="btn btn-sm bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Mark remaining present
              </button>
              <button
                type="button"
                onClick={() => markAll('absent')}
                disabled={submitted || unmarked.length === 0}
                className="btn btn-sm bg-rose-600 text-white hover:bg-rose-700"
              >
                Mark remaining absent
              </button>
            </div>
          </div>
        )}

        {/* Cards */}
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-separator/70 px-6 py-14 text-center dark:border-white/[0.12]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-fill">
              <Users className="h-7 w-7 text-tertiary-label" />
            </div>
            <p className="text-headline font-semibold text-label">No probationary new members</p>
            <p className="mt-1 max-w-xs text-footnote text-secondary-label">
              Add new members under the &ldquo;New Members&rdquo; tab to start taking attendance.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredUnmarked.length > 0 && (
              <div className="space-y-3">
                <h4 className="section-eyebrow">Unmarked members</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUnmarked.map(renderMemberCard)}
                </div>
              </div>
            )}

            {/* Complete / submit */}
            {unmarked.length === 0 && members.length > 0 && !submitted && (
              <div className="flex animate-scale-in flex-col items-center justify-center rounded-2xl border border-dashed border-system-green/30 bg-system-green/[0.06] px-6 py-10">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-green/15">
                  <CheckCircle2 className="h-7 w-7 text-emerald-700 dark:text-system-green" />
                </div>
                <h4 className="text-center text-title-3 font-semibold text-label">
                  Attendance roster complete
                </h4>
                <p className="mb-6 mt-1 max-w-xs text-center text-footnote text-secondary-label">
                  Every new member has been marked. Submit to save the attendance records.
                </p>

                <button
                  onClick={onSubmit}
                  disabled={submitting}
                  className="btn-primary h-11 w-full max-w-xs"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Submit Weekly Attendance'
                  )}
                </button>
              </div>
            )}

            {submitted && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-separator/70 bg-system-grouped-background/60 px-6 py-10 dark:border-white/[0.12] dark:bg-white/[0.02]">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-green/15">
                  <CheckCircle2 className="h-7 w-7 text-emerald-700 dark:text-system-green" />
                </div>
                <h4 className="text-center text-title-3 font-semibold text-label">
                  Roster Submitted
                </h4>
                <p className="mt-1 max-w-xs text-center text-footnote leading-relaxed text-secondary-label">
                  Attendance records have been successfully saved for this week start.
                </p>
              </div>
            )}

            {filteredCompleted.length > 0 && (
              <div className="space-y-3 border-t border-separator/60 pt-5 dark:border-white/[0.08]">
                <h4 className="section-eyebrow">Completed</h4>
                <div className="grid grid-cols-1 gap-4 opacity-75 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCompleted.map(renderMemberCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default NewMemberLeaderOverview;
