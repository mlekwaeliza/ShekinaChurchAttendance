import React from 'react';
import {
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock3,
  ArrowRight,
  MapPin,
  Crown
} from 'lucide-react';
import StatCard from '../ui/StatCard';

const LeaderOverview = ({
  members,
  eligibleMembers,
  history,
  attendance,
  submitted,
  serviceTypes = [],
  selectedServiceId,
  leaderName,
  sectionName,
  isHead = false,
  onGoToAttendance
}) => {
  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const serviceName =
    currentService?.name || (selectedServiceId === 'all' ? 'All Services' : 'Main Service');
  const rosterMembers = Array.isArray(eligibleMembers) ? eligibleMembers : members;

  const presentMembers = rosterMembers.filter((member) => attendance[member.id] === 'present');
  const absentMembers = rosterMembers.filter((member) => attendance[member.id] === 'absent');
  const excusedMembers = rosterMembers.filter((member) => attendance[member.id] === 'excused');
  const unmarkedMembers = rosterMembers.filter((member) => !attendance[member.id]);

  const attendanceOverviewCards = [
    {
      label: 'Present',
      count: presentMembers.length,
      note: submitted ? 'Recorded present' : 'Marked present',
      icon: CheckCircle2,
      variant: 'success'
    },
    {
      label: 'Absent',
      count: absentMembers.length,
      note: submitted ? 'Recorded absent' : 'Marked absent',
      icon: XCircle,
      variant: 'danger'
    },
    {
      label: 'Excused',
      count: excusedMembers.length,
      note: submitted ? 'Recorded excused' : 'Marked excused',
      icon: Clock3,
      variant: 'warning'
    },
    {
      label: submitted ? 'Completed' : 'Pending',
      count: submitted ? rosterMembers.length : unmarkedMembers.length,
      note: submitted ? 'Roster locked in' : 'Still waiting to be marked',
      icon: FileText,
      variant: 'info'
    }
  ];

  const summaryCards = [
    {
      label: 'Present',
      count: presentMembers.length,
      icon: CheckCircle2,
      well: 'bg-system-green/15',
      iconColor: 'text-emerald-700 dark:text-system-green',
      members: presentMembers
    },
    {
      label: 'Absent',
      count: absentMembers.length,
      icon: XCircle,
      well: 'bg-system-red/15',
      iconColor: 'text-rose-700 dark:text-system-red',
      members: absentMembers
    },
    {
      label: 'Excused',
      count: excusedMembers.length,
      icon: Clock3,
      well: 'bg-system-orange/15',
      iconColor: 'text-amber-700 dark:text-system-orange',
      members: excusedMembers
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="card p-6 sm:p-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1 text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
            <MapPin className="h-3.5 w-3.5" />
            {sectionName || 'Unassigned Section'}
          </span>
          {isHead && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-system-yellow/15 px-3 py-1 text-caption-1 font-semibold text-amber-700 dark:text-system-yellow">
              <Crown className="h-3.5 w-3.5" />
              Head Leader
            </span>
          )}
        </div>
        <h2 className="text-title-1 font-semibold text-label">Welcome, {leaderName || 'Leader'}</h2>
        <p className="mt-2 max-w-lg text-subheadline leading-relaxed text-secondary-label">
          {serviceName} dashboard is ready. Track the attendance roster for the service scheduled on
          this day and keep your section up to date.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-system-grouped-background/70 px-4 py-3 dark:bg-white/[0.03]">
            <Users className="h-5 w-5 text-primary-700 dark:text-primary-300" />
            <div>
              <p className="text-caption-2 font-medium text-secondary-label">Total Members</p>
              <p className="text-headline font-semibold text-label tabular-nums">
                {members.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-system-grouped-background/70 px-4 py-3 dark:bg-white/[0.03]">
            <FileText className="h-5 w-5 text-blue-700 dark:text-system-blue" />
            <div>
              <p className="text-caption-2 font-medium text-secondary-label">Submissions</p>
              <p className="text-headline font-semibold text-label tabular-nums">
                {history.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-system-grouped-background/70 px-4 py-3 dark:bg-white/[0.03]">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-system-green" />
            <div>
              <p className="text-caption-2 font-medium text-secondary-label">Roster Size</p>
              <p className="text-headline font-semibold text-label tabular-nums">
                {rosterMembers.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {attendanceOverviewCards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.count}
            trendLabel={card.note}
            variant={card.variant}
          />
        ))}
      </div>

      {submitted ? (
        <div>
          <h3 className="mb-5 flex items-center gap-2 text-title-3 font-semibold text-label">
            {serviceName} Roster Detail
            <span className="badge-success">Submitted</span>
          </h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${card.well}`}
                    >
                      <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <span className="text-footnote font-semibold text-label">{card.label}</span>
                  </div>
                  <span className="text-title-3 font-semibold text-label tabular-nums">
                    {card.count}
                  </span>
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-system-grouped-background/70 p-2 dark:bg-white/[0.03]">
                  {card.members.map((member) => (
                    <li
                      key={member.id}
                      className="rounded-lg px-2 py-1.5 text-footnote font-medium text-secondary-label"
                    >
                      {member.full_name}
                    </li>
                  ))}
                  {card.members.length === 0 && (
                    <li className="py-2 text-center text-caption-1 italic text-tertiary-label">
                      None
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
          <div>
            <h4 className="text-headline font-semibold text-label">Ready for {serviceName}?</h4>
            <p className="mt-1 text-footnote text-secondary-label">
              Head to the attendance tab to record attendance for this service.
            </p>
          </div>
          <button onClick={onGoToAttendance} className="btn-primary flex items-center gap-2">
            Mark Attendance Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaderOverview;
