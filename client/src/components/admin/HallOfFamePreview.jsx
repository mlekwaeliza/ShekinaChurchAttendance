import React from 'react';
import { Trophy, Award, Crown, ArrowUpRight } from 'lucide-react';

const HallOfFamePreview = ({ topMembers = [], onViewAll }) => {
  const getBadgeStyle = (index) => {
    switch (index) {
      case 0: return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400', icon: Crown };
      case 1: return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', icon: Award };
      case 2: return { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400', icon: Award };
      default: return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-500', icon: Award };
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-16 translate-x-16" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-violet-500" />
          Hall of Fame 2026
        </h3>
        <button
          onClick={onViewAll}
          className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-400 hover:text-violet-500 transition-colors"
          title="Points earned from attendance, service, giving. Winners announced Dec 31."
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 relative z-10 flex-1 flex flex-col justify-center">
        {topMembers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm italic">
            Season competition starting soon...
          </div>
        ) : (
          topMembers.slice(0, 3).map((m, idx) => {
            const badge = getBadgeStyle(idx);
            return (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-700/20 border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${badge.bg} flex items-center justify-center relative`}>
                    <badge.icon className={`w-5 h-5 ${badge.text}`} />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-700 text-[10px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.full_name}</p>
                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{m.section_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-violet-600 dark:text-violet-400">{m.points}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Points</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700/50">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-center">
          Points update after every service check-in.
        </p>
      </div>
    </div>
  );
};

export default HallOfFamePreview;
