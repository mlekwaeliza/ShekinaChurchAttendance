import React, { useState } from 'react';
import { Cake, UserX, UserPlus, MessageSquare, ChevronRight, Bell } from 'lucide-react';

const NeedsAttentionWidget = ({ birthdays = [], absentees = [], visitors = [], onSendMessage, onAssignFollowUp, onAddVisitorToFollowUp }) => {
  const [activeTab, setActiveTab] = useState('birthdays');

  const tabs = [
    { id: 'birthdays', label: 'Birthdays Today', count: birthdays.length, icon: Cake, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    { id: 'absentees', label: 'Absent 3+ Weeks', count: absentees.length, icon: UserX, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'visitors', label: 'New Visitors', count: visitors.length, icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
  ];

  const totalAlerts = birthdays.length + absentees.length + visitors.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/30">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <Bell className={`w-4 h-4 ${totalAlerts > 0 ? 'text-rose-500 animate-pulse' : ''}`} />
          Needs Attention
        </h3>
        {totalAlerts > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
            {totalAlerts} ALERTS
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all relative ${
              activeTab === tab.id
                ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50/50 dark:bg-slate-900/20'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
            <span className="text-xs font-bold">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`w-5 h-5 rounded-full ${tab.bg} ${tab.color} text-[10px] flex items-center justify-center font-black`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[320px] p-2 space-y-1">
        {activeTab === 'birthdays' && (
          birthdays.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">No birthdays today</p>
            </div>
          ) : (
            birthdays.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <Cake className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{b.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{b.section_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => onSendMessage(b)}
                  className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 hover:text-white"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            ))
          )
        )}

        {activeTab === 'absentees' && (
          absentees.length === 0 ? (
            <div className="p-8 text-center text-slate-400">All members accounted for ✨</div>
          ) : (
            absentees.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <UserX className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{a.full_name}</p>
                    {a.missed_dates && a.missed_dates.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.missed_dates.map((d, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                            {new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Last seen: {a.last_date || 'Never'}</p>
                    )}
                    {a.missed_services && a.missed_services.length > 0 && (
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                        Missed: {a.missed_services.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onAssignFollowUp(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-xs font-bold hover:bg-amber-600 hover:text-white transition-all shrink-0"
                >
                  Follow-up <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )
        )}

        {activeTab === 'visitors' && (
          visitors.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No new visitors this week.</div>
          ) : (
            visitors.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{v.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Visited: {v.date}</p>
                  </div>
                </div>
                <button
                  onClick={() => onAddVisitorToFollowUp(v)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"
                >
                  Add to List
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default NeedsAttentionWidget;
