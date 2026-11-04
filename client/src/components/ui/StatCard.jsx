import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

// Tinted icon wells, the way iOS tints a symbol against a 15% wash of the
// same color. No accent bars, no background blobs: the number is the hero.
const colorMap = {
  default: {
    icon: 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
  },
  success: {
    icon: 'bg-system-green/15 text-emerald-700 dark:text-system-green'
  },
  warning: {
    icon: 'bg-system-orange/15 text-amber-700 dark:text-system-orange'
  },
  danger: {
    icon: 'bg-system-red/15 text-rose-700 dark:text-system-red'
  },
  info: {
    icon: 'bg-system-blue/15 text-blue-700 dark:text-system-blue'
  },
  rose: {
    icon: 'bg-system-red/15 text-rose-700 dark:text-system-red'
  }
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  variant = 'default',
  className = '',
  onClick
}) => {
  const colors = colorMap[variant] || colorMap.default;
  const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : null;
  const Wrapper = onClick ? 'button' : 'article';

  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`product-surface focus-ring group w-full p-5 text-left transition-shadow duration-200 hover:shadow-card-hover sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 break-words text-footnote font-medium leading-5 text-secondary-label">
          {label}
        </p>
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${colors.icon}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
        )}
      </div>

      <p className="mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-[-0.025em] text-label tabular-nums">
        {value}
      </p>

      {(trendDirection || trendLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium">
          {trendDirection === 'up' && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-system-green" />
          )}
          {trendDirection === 'down' && (
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-system-red" />
          )}
          {trendDirection && (
            <span
              className={
                trendDirection === 'up'
                  ? 'shrink-0 text-emerald-700 dark:text-system-green'
                  : 'shrink-0 text-rose-700 dark:text-system-red'
              }
            >
              {Number(Math.abs(trend).toFixed(1))}%
            </span>
          )}
          {trendLabel && (
            <span className="min-w-0 break-words text-secondary-label">{trendLabel}</span>
          )}
        </div>
      )}
    </Wrapper>
  );
};

export default StatCard;
