import React from 'react';
import { MousePointer2, UserPlus, Megaphone, CalendarCheck, Clock, Check } from 'lucide-react';

const QuickActionsBar = ({ serviceTypes, selectedServiceId, onServiceChange, onMarkAttendance, onAddMember, onSendAnnouncement, onViewFollowUps }) => {
  return (
    <div className="flex flex-col xl:flex-row items-center gap-4">
      {/* Service Selector */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm shrink-0 no-scrollbar overflow-x-auto max-w-full">
        <label className="pl-3 pr-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1.5 shrink-0">
          <Clock className="w-3 h-3" />
          Plan
        </label>
        <div className="flex gap-1">
          {serviceTypes.map(service => (
            <button
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 whitespace-nowrap ${
                selectedServiceId === service.id
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
            </button>
          ))}

          <button
            onClick={() => onServiceChange('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 whitespace-nowrap ${
              selectedServiceId === 'all'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        <button
          onClick={onMarkAttendance}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-lg transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-600 transition-colors">
            <MousePointer2 className="w-4 h-4 text-orange-600 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">View Attendance</span>
        </button>

        <button
          onClick={onAddMember}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
            <UserPlus className="w-4 h-4 text-emerald-600 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Add Visitor</span>
        </button>

        <button
          onClick={onSendAnnouncement}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 hover:shadow-lg transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-600 transition-colors">
            <Megaphone className="w-4 h-4 text-violet-600 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Announcement</span>
        </button>

        <button
          onClick={onViewFollowUps}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-600 transition-colors">
            <CalendarCheck className="w-4 h-4 text-amber-600 group-hover:text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Follow-ups</span>
        </button>
      </div>
    </div>
  );
};

export default QuickActionsBar;
