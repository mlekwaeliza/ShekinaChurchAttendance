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
      style: 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
    },
    {
      label: 'Add visitor',
      icon: UserPlus,
      onClick: onAddMember,
      style: 'bg-system-green/15 text-emerald-700 dark:text-system-green'
    },
    {
      label: 'Announcement',
      icon: Megaphone,
      onClick: onSendAnnouncement,
      style: 'bg-system-blue/15 text-blue-700 dark:text-system-blue'
    },
    {
      label: 'Follow-ups',
      icon: CalendarCheck,
      onClick: onViewFollowUps,
      style: 'bg-system-orange/15 text-amber-700 dark:text-system-orange'
    }
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="product-surface flex min-w-0 max-w-full items-center gap-3 p-2 pl-4">
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary-label">
          <Clock className="h-3.5 w-3.5" />
          Service
        </div>
        <div className="grid min-w-0 flex-1 grid-flow-col auto-cols-fr gap-1 rounded-[10px] bg-system-fill/70 p-1 dark:bg-white/[0.06]">
          {dashboardServiceTypes.map((service) => (
            <button
              type="button"
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              aria-pressed={selectedServiceId === service.id}
              className={`focus-ring min-w-0 truncate rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                selectedServiceId === service.id
                  ? 'bg-secondary-system-grouped-background text-label shadow-segmented dark:bg-white/[0.14]'
                  : 'text-secondary-label hover:text-label'
              }`}
            >
              {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onServiceChange('all')}
            aria-pressed={selectedServiceId === 'all'}
            className={`focus-ring min-w-0 truncate rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
              selectedServiceId === 'all'
                ? 'bg-secondary-system-grouped-background text-label shadow-segmented dark:bg-white/[0.14]'
                : 'text-secondary-label hover:text-label'
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
            className="product-surface focus-ring flex min-h-[4.5rem] min-w-0 items-center gap-3 overflow-hidden px-3 py-2.5 text-left transition-shadow duration-200 hover:shadow-card-hover"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${style}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="block min-w-0 flex-1 whitespace-normal break-words text-subheadline font-semibold leading-4 text-label">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickActionsBar;
