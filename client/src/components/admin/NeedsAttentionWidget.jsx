import React, { useState } from 'react';
import { Cake, UserX, UserPlus, MessageSquare, ChevronRight, HeartHandshake } from 'lucide-react';
import { fdate } from '../../utils/date';

const NeedsAttentionWidget = ({
  birthdays = [],
  absentees = [],
  visitors = [],
  onSendMessage,
  onAssignFollowUp,
  onAddVisitorToFollowUp
}) => {
  const [activeTab, setActiveTab] = useState('birthdays');

  const tabs = [
    {
      id: 'birthdays',
      label: 'Celebrate',
      count: birthdays.length,
      icon: Cake,
      color: 'text-rose-700 dark:text-system-red',
      bg: 'bg-system-red/15'
    },
    {
      id: 'absentees',
      label: 'Reconnect',
      count: absentees.length,
      icon: UserX,
      color: 'text-amber-700 dark:text-system-orange',
      bg: 'bg-system-orange/15'
    },
    {
      id: 'visitors',
      label: 'Welcome',
      count: visitors.length,
      icon: UserPlus,
      color: 'text-emerald-700 dark:text-system-green',
      bg: 'bg-system-green/15'
    }
  ];

  const totalCareItems = birthdays.length + absentees.length + visitors.length;

  return (
    <section className="product-surface flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-separator/60 px-5 py-5 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="section-eyebrow">Pastoral care</p>
            <h3 className="mt-0.5 text-title-3 font-semibold text-label">Care &amp; Connection</h3>
            <p className="mt-1 text-footnote leading-relaxed text-secondary-label">
              Celebrate milestones, reconnect with members, and welcome visitors.
            </p>
          </div>
        </div>
        {totalCareItems > 0 && (
          <span className="shrink-0 rounded-full bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
            {totalCareItems} to connect with
          </span>
        )}
      </div>

      <div className="flex overflow-x-auto border-b border-separator/60 dark:border-white/[0.08]">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`relative flex min-w-[7.5rem] flex-1 items-center justify-center gap-2 px-3 py-3 transition-colors ${
              activeTab === tab.id
                ? 'bg-secondary-system-grouped-background text-label dark:bg-system-fill/60'
                : 'bg-system-grouped-background/60 text-secondary-label hover:text-label dark:bg-transparent dark:text-secondary-label dark:hover:text-white/80'
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ''}`} />
            <span className="text-footnote font-semibold">{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${tab.bg} ${tab.color}`}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary-500" />
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[320px] flex-1 space-y-1 overflow-y-auto p-2">
        {activeTab === 'birthdays' &&
          (birthdays.length === 0 ? (
            <div className="p-8 text-center">
              <Cake className="mx-auto mb-3 h-7 w-7 text-tertiary-label" />
              <p className="text-callout font-semibold text-label">No birthdays today</p>
              <p className="mt-1 text-footnote text-secondary-label">
                Upcoming celebrations will appear here.
              </p>
            </div>
          ) : (
            birthdays.map((birthday) => (
              <div
                key={birthday.id}
                className="flex items-center justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-system-red/15">
                    <Cake className="h-5 w-5 text-rose-700 dark:text-system-red" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-subheadline font-semibold text-label">
                      {birthday.full_name}
                    </p>
                    <p className="truncate text-footnote text-secondary-label">
                      {birthday.section_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSendMessage?.(birthday)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-system-red/10 px-3 py-2 text-footnote font-semibold text-rose-700 transition-colors hover:bg-system-red/15 dark:text-system-red"
                  aria-label={`Send a birthday greeting to ${birthday.full_name}`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Greet</span>
                </button>
              </div>
            ))
          ))}

        {activeTab === 'absentees' &&
          (absentees.length === 0 ? (
            <div className="p-8 text-center">
              <HeartHandshake className="mx-auto mb-3 h-7 w-7 text-tertiary-label" />
              <p className="text-callout font-semibold text-label">
                No attendance check-ins needed
              </p>
              <p className="mt-1 text-footnote text-secondary-label">
                Everyone is currently connected through recent services.
              </p>
            </div>
          ) : (
            absentees.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-system-orange/15">
                    <UserX className="h-5 w-5 text-amber-700 dark:text-system-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-subheadline font-semibold text-label">
                      {member.full_name}
                    </p>
                    {member.missed_dates?.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {member.missed_dates.map((date, index) => (
                          <span
                            key={`${date}-${index}`}
                            className="rounded bg-system-orange/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-system-orange"
                          >
                            {fdate(date)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-footnote text-secondary-label">
                        Last attended:{' '}
                        {member.last_date ? fdate(member.last_date) : 'No attendance recorded'}
                      </p>
                    )}
                    {member.missed_services?.length > 0 && (
                      <p className="mt-0.5 truncate text-caption-1 text-tertiary-label">
                        Services to review: {member.missed_services.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAssignFollowUp?.(member)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-system-orange/10 px-3 py-1.5 text-footnote font-semibold text-amber-700 transition-colors hover:bg-system-orange/15 dark:text-system-orange"
                >
                  Care follow-up <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))
          ))}

        {activeTab === 'visitors' &&
          (visitors.length === 0 ? (
            <div className="p-8 text-center">
              <UserPlus className="mx-auto mb-3 h-7 w-7 text-tertiary-label" />
              <p className="text-callout font-semibold text-label">
                No first-time visitors awaiting welcome
              </p>
              <p className="mt-1 text-footnote text-secondary-label">
                New visitor records will appear here.
              </p>
            </div>
          ) : (
            visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="flex items-center justify-between gap-3 rounded-xl p-3 transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-system-green/15">
                    <UserPlus className="h-5 w-5 text-emerald-700 dark:text-system-green" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-subheadline font-semibold text-label">
                      {visitor.full_name}
                    </p>
                    <p className="text-footnote text-secondary-label">
                      Visited {fdate(visitor.date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddVisitorToFollowUp?.(visitor)}
                  className="shrink-0 rounded-lg bg-system-green/10 px-3 py-1.5 text-footnote font-semibold text-emerald-700 transition-colors hover:bg-system-green/15 dark:text-system-green"
                >
                  Start welcome
                </button>
              </div>
            ))
          ))}
      </div>
    </section>
  );
};

export default NeedsAttentionWidget;
