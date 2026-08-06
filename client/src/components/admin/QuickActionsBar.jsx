import React from 'react';
import { CalendarCheck, Clock, Megaphone, MousePointer2, UserPlus } from 'lucide-react';

const QuickActionsBar = ({
  serviceTypes,
  selectedServiceId,
  onServiceChange,
  onMarkAttendance,
  onAddMember,
  onSendAnnouncement,
  onViewFollowUps
}) => {
  // Leadership is managed from its dedicated admin area, not as an attendance service.
  const dashboardServiceTypes = serviceTypes.filter(
    (service) => !/\bleader(?:s|ship)?\b/i.test(String(service.name || '').trim())
  );

  const actions = [
    {
      label: 'View attendance',
      icon: MousePointer2,
      onClick: onMarkAttendance,
      style: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
    },
    {
      label: 'Add visitor',
      icon: UserPlus,
      onClick: onAddMember,
      style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    },
    {
      label: 'Announcement',
      icon: Megaphone,
      onClick: onSendAnnouncement,
      style: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
    },
    {
      label: 'Follow-ups',
      icon: CalendarCheck,
      onClick: onViewFollowUps,
      style: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    }
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="product-surface flex min-w-0 max-w-full items-center gap-2 p-2">
        <div className="flex shrink-0 items-center gap-1.5 px-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          Service
        </div>
        <div className="grid min-w-0 flex-1 grid-flow-col auto-cols-fr gap-1">
          {dashboardServiceTypes.map((service) => (
            <button
              type="button"
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              className={`focus-ring min-w-0 truncate rounded-lg px-2 py-2 text-center text-[11px] font-bold transition-colors ${
                selectedServiceId === service.id
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onServiceChange('all')}
            className={`focus-ring min-w-0 truncate rounded-lg px-2 py-2 text-center text-[11px] font-bold transition-colors ${
              selectedServiceId === 'all'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {actions.map(({ label, icon: Icon, onClick, style }) => (
          <button
            type="button"
            key={label}
            onClick={onClick}
            className="product-surface focus-ring group flex min-h-[4.5rem] min-w-0 items-center gap-3 overflow-hidden px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover dark:hover:border-white/20"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="block min-w-0 flex-1 whitespace-normal break-words text-xs font-bold leading-4 text-slate-700 dark:text-slate-200 sm:text-[13px]">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickActionsBar;
