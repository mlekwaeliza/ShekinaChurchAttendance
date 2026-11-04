import React from 'react';
import { Trophy, Award, Crown, ArrowUpRight } from 'lucide-react';

const HallOfFamePreview = ({ topMembers = [], onViewAll }) => {
  const getBadgeStyle = (index) => {
    switch (index) {
      case 0:
        return {
          bg: 'bg-system-yellow/15 text-amber-700 dark:text-system-yellow',
          icon: Crown
        };
      case 1:
        return { bg: 'bg-system-fill text-secondary-label', icon: Award };
      case 2:
        return {
          bg: 'bg-system-orange/15 text-amber-700 dark:text-system-orange',
          icon: Award
        };
      default:
        return { bg: 'bg-system-fill text-secondary-label', icon: Award };
    }
  };

  return (
    <div className="card relative flex h-full flex-col overflow-hidden p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-yellow/15 text-amber-700 dark:text-system-yellow">
            <Trophy className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-title-3 font-semibold text-label">Recognition 2026</h3>
            <p className="text-footnote text-secondary-label">Season standings</p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
          title="Points earned from attendance, service, giving. Winners announced Dec 31."
          aria-label="Open full recognition standings"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center space-y-3">
        {topMembers.length === 0 ? (
          <div className="py-6 text-center text-footnote text-secondary-label">
            Season competition starting soon…
          </div>
        ) : (
          topMembers.slice(0, 3).map((m, idx) => {
            const badge = getBadgeStyle(idx);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-separator/50 bg-system-grouped-background/60 p-3 dark:border-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-[10px] ${badge.bg}`}
                  >
                    <badge.icon className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-system-grouped-background text-[10px] font-semibold text-label ring-2 ring-system-grouped-background dark:bg-secondary-system-grouped-background">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-subheadline font-semibold text-label">
                      {m.full_name}
                    </p>
                    <p className="truncate text-caption-1 text-secondary-label">{m.section_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-subheadline font-semibold text-label tabular-nums">
                    {m.points}
                  </p>
                  <p className="text-caption-2 text-tertiary-label">Points</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 border-t border-separator/60 pt-4 dark:border-white/[0.06]">
        <p className="text-center text-caption-1 text-tertiary-label">
          Points update after every service check-in.
        </p>
      </div>
    </div>
  );
};

export default HallOfFamePreview;
