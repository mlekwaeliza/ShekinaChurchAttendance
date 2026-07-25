import React, { useState } from 'react';
import { Cake, UserX, UserPlus, MessageSquare, ChevronRight, HeartHandshake } from 'lucide-react';
import { fdate } from '../../utils/date';

const NeedsAttentionWidget = ({
  birthdays = [],
  absentees = [],
  visitors = [],
  onSendMessage,
  onAssignFollowUp,
  onAddVisitorToFollowUp,
}) => {
  const [activeTab, setActiveTab] = useState('birthdays');

  const tabs = [
    { id: 'birthdays', label: 'Celebrate', count: birthdays.length, icon: Cake, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    { id: 'absentees', label: 'Reconnect', count: absentees.length, icon: UserX, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'visitors', label: 'Welcome', count: visitors.length, icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  ];

  const totalCareItems = birthdays.length + absentees.length + visitors.length;

  return (
    <section className="product-surface flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="section-eyebrow">Pastoral care</p>
            <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Care &amp; Connection</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Celebrate milestones, reconnect with members, and welcome visitors.
            </p>
          </div>
        </div>
        {totalCareItems > 0 && (
          <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            {totalCareItems} to connect with
          </span>
        )}
      </div>

      <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex min-w-[7.5rem] flex-1 items-center justify-center gap-2 px-3 py-3 transition-all ${
              activeTab === tab.id
                ? 'bg-white text-primary-600 dark:bg-slate-800 dark:text-primary-400'
                : 'bg-slate-50/50 text-slate-400 hover:text-slate-600 dark:bg-slate-900/20 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ''}`} />
            <span className="text-xs font-bold">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${tab.bg} ${tab.color}`}>
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
        {activeTab === 'birthdays' && (
          birthdays.length === 0 ? (
            <div className="p-8 text-center">
              <Cake className="mx-auto mb-3 h-7 w-7 text-rose-300 dark:text-rose-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No birthdays today</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upcoming celebrations will appear here.</p>
            </div>
          ) : (
            birthdays.map((birthday) => (
              <div key={birthday.id} className="flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/30">
                    <Cake className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{birthday.full_name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{birthday.section_name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSendMessage?.(birthday)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-all hover:bg-rose-600 hover:text-white dark:bg-rose-900/20 dark:text-rose-300"
                  aria-label={`Send a birthday greeting to ${birthday.full_name}`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Greet</span>
                </button>
              </div>
            ))
          )
        )}

        {activeTab === 'absentees' && (
          absentees.length === 0 ? (
            <div className="p-8 text-center">
              <HeartHandshake className="mx-auto mb-3 h-7 w-7 text-emerald-300 dark:text-emerald-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No attendance check-ins needed</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Everyone is currently connected through recent services.</p>
            </div>
          ) : (
            absentees.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <UserX className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{member.full_name}</p>
                    {member.missed_dates?.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {member.missed_dates.map((date, index) => (
                          <span key={`${date}-${index}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            {fdate(date)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Last attended: {member.last_date ? fdate(member.last_date) : 'No attendance recorded'}
                      </p>
                    )}
                    {member.missed_services?.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">
                        Services to review: {member.missed_services.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAssignFollowUp?.(member)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-all hover:bg-amber-600 hover:text-white dark:bg-amber-900/20 dark:text-amber-300"
                >
                  Care follow-up <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))
          )
        )}

        {activeTab === 'visitors' && (
          visitors.length === 0 ? (
            <div className="p-8 text-center">
              <UserPlus className="mx-auto mb-3 h-7 w-7 text-emerald-300 dark:text-emerald-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No first-time visitors awaiting welcome</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New visitor records will appear here.</p>
            </div>
          ) : (
            visitors.map((visitor) => (
              <div key={visitor.id} className="flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <UserPlus className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{visitor.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Visited {fdate(visitor.date)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddVisitorToFollowUp?.(visitor)}
                  className="shrink-0 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  Start welcome
                </button>
              </div>
            ))
          )
        )}
      </div>
    </section>
  );
};

export default NeedsAttentionWidget;
