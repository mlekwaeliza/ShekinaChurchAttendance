import React from 'react';
import { Users, FileText, CheckCircle2, XCircle, Clock3, ArrowRight, MapPin, Crown } from 'lucide-react';

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
  onGoToAttendance,
}) => {
  const currentService = serviceTypes.find((service) => service.id === selectedServiceId);
  const serviceName = currentService?.name || (selectedServiceId === 'all' ? 'All Services' : 'Main Service');
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
      accent: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      border: 'border-emerald-200/80 dark:border-emerald-800/70',
    },
    {
      label: 'Absent',
      count: absentMembers.length,
      note: submitted ? 'Recorded absent' : 'Marked absent',
      icon: XCircle,
      accent: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      border: 'border-rose-200/80 dark:border-rose-800/70',
    },
    {
      label: 'Excused',
      count: excusedMembers.length,
      note: submitted ? 'Recorded excused' : 'Marked excused',
      icon: Clock3,
      accent: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      border: 'border-amber-200/80 dark:border-amber-800/70',
    },
    {
      label: submitted ? 'Completed' : 'Pending',
      count: submitted ? rosterMembers.length : unmarkedMembers.length,
      note: submitted ? 'Roster locked in' : 'Still waiting to be marked',
      icon: FileText,
      accent: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      border: 'border-sky-200/80 dark:border-sky-800/70',
    },
  ];

  const summaryCards = [
    {
      label: 'Present',
      count: presentMembers.length,
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-teal-600',
      bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      shadowColor: 'shadow-emerald-500/20',
      listBg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
      members: presentMembers,
    },
    {
      label: 'Absent',
      count: absentMembers.length,
      icon: XCircle,
      gradient: 'from-rose-500 to-pink-600',
      bgGradient: 'from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
      borderColor: 'border-rose-200 dark:border-rose-800',
      shadowColor: 'shadow-rose-500/20',
      listBg: 'bg-rose-50/50 dark:bg-rose-900/10',
      members: absentMembers,
    },
    {
      label: 'Excused',
      count: excusedMembers.length,
      icon: Clock3,
      gradient: 'from-amber-500 to-orange-600',
      bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      shadowColor: 'shadow-amber-500/20',
      listBg: 'bg-amber-50/50 dark:bg-amber-900/10',
      members: excusedMembers,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 p-8 text-white shadow-xl shadow-emerald-500/20">
        <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" />
              {sectionName || 'Unassigned Section'}
            </span>
            {isHead && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-100 backdrop-blur-sm">
                <Crown className="h-3.5 w-3.5" />
                Head Leader
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {leaderName || 'Leader'}
          </h2>
          <p className="mt-2 max-w-lg text-base text-white/80">
            {serviceName} dashboard is ready. Track the attendance roster for the service scheduled on this day and keep your section up to date.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
              <Users className="h-5 w-5 text-emerald-200" />
              <div>
                <p className="text-xs font-medium text-white/70">Total Members</p>
                <p className="text-xl font-bold">{members.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
              <FileText className="h-5 w-5 text-sky-200" />
              <div>
                <p className="text-xs font-medium text-white/70">Submissions</p>
                <p className="text-xl font-bold">{history.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
              <CheckCircle2 className="h-5 w-5 text-cyan-200" />
              <div>
                <p className="text-xs font-medium text-white/70">Roster Size</p>
                <p className="text-xl font-bold">{rosterMembers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {attendanceOverviewCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border ${card.border} bg-white/95 p-5 shadow-sm dark:bg-slate-800/95`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">
                  {card.count}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {card.note}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.accent}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {submitted ? (
        <div>
          <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            {serviceName} Roster Detail
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              Submitted
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`relative overflow-hidden rounded-2xl border ${card.borderColor} bg-gradient-to-br ${card.bgGradient} p-5 shadow-sm`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} shadow-md ${card.shadowColor}`}>
                      <card.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{card.label}</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900 dark:text-white">{card.count}</span>
                </div>
                <ul className={`max-h-40 space-y-1.5 overflow-y-auto rounded-xl p-2 scrollbar-thin ${card.listBg}`}>
                  {card.members.map((member) => (
                    <li
                      key={member.id}
                      className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {member.full_name}
                    </li>
                  ))}
                  {card.members.length === 0 && (
                    <li className="py-2 text-center text-sm italic text-slate-400 dark:text-slate-500">
                      None
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl shadow-indigo-500/20 sm:flex-row">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/5 -translate-y-20 translate-x-20" />
          <div className="relative z-10">
            <h4 className="text-lg font-bold">Ready for {serviceName}?</h4>
            <p className="mt-1 text-sm text-white/80">
              Head to the attendance tab to record attendance for this service.
            </p>
          </div>
          <button
            onClick={onGoToAttendance}
            className="relative z-10 flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-indigo-600 shadow-lg transition-all duration-200 hover:bg-white/90"
          >
            Mark Attendance Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaderOverview;
