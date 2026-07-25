import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

const colorMap = {
  default: {
    accent: 'bg-primary-500',
    icon: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    wash: 'bg-primary-500/5',
  },
  success: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    wash: 'bg-emerald-500/5',
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    wash: 'bg-amber-500/5',
  },
  danger: {
    accent: 'bg-rose-500',
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    wash: 'bg-rose-500/5',
  },
  info: {
    accent: 'bg-sky-500',
    icon: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    wash: 'bg-sky-500/5',
  },
  rose: {
    accent: 'bg-rose-500',
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    wash: 'bg-rose-500/5',
  },
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  variant = 'default',
  className = '',
  onClick,
}) => {
  const colors = colorMap[variant] || colorMap.default;
  const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : null;
  const Wrapper = onClick ? 'button' : 'article';

  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`product-surface focus-ring group relative w-full overflow-hidden p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover dark:hover:border-white/20 sm:p-6 ${className}`}
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] ${colors.accent}`} />
      <span className={`absolute -right-9 -top-9 h-28 w-28 rounded-full ${colors.wash} transition-transform duration-300 group-hover:scale-110`} />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-slate-950 dark:text-white tabular-nums">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${colors.icon}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
      </div>

      {(trendDirection || trendLabel) && (
        <div className="relative mt-4 flex items-center gap-1.5 text-xs font-semibold">
          {trendDirection === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          {trendDirection === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
          {trendDirection && (
            <span className={trendDirection === 'up' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
              {Number(Math.abs(trend).toFixed(1))}%
            </span>
          )}
          {trendLabel && <span className="font-medium text-slate-400 dark:text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </Wrapper>
  );
};

export default StatCard;
