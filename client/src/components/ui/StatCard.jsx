import React from 'react';

const colorMap = {
  default: {
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50',
    bgDark: 'dark:bg-violet-900/20',
    ringColor: 'ring-violet-200 dark:ring-violet-800',
    shadowColor: 'shadow-violet-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
  },
  success: {
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/20',
    ringColor: 'ring-emerald-200 dark:ring-emerald-800',
    shadowColor: 'shadow-emerald-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
  },
  warning: {
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    ringColor: 'ring-amber-200 dark:ring-amber-800',
    shadowColor: 'shadow-amber-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
  },
  danger: {
    gradient: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-900/20',
    ringColor: 'ring-rose-200 dark:ring-rose-800',
    shadowColor: 'shadow-rose-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
  },
  info: {
    gradient: 'from-sky-500 to-blue-600',
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-900/20',
    ringColor: 'ring-sky-200 dark:ring-sky-800',
    shadowColor: 'shadow-sky-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
  },
  rose: {
    gradient: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-900/20',
    ringColor: 'ring-rose-200 dark:ring-rose-800',
    shadowColor: 'shadow-rose-500/20',
    trend: { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400' },
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
  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : null;

  const Card = (
    <div className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm hover:shadow-lg ${colors.shadowColor} transition-all duration-300 hover:-translate-y-1 ${className}`}>
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -translate-y-8 translate-x-8 bg-gradient-to-br ${colors.gradient}`} />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
          {(trendDir || trendLabel) && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendDir ? colors.trend[trendDir] : 'text-slate-400 dark:text-slate-500'}`}>
              {trendDir === 'up' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              )}
              {trendDir === 'down' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
              <span>{trend != null ? `${Math.abs(trend)}%` : ''} {trendLabel || ''}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shrink-0 ring-1 ${colors.ringColor} shadow-md ${colors.shadowColor}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="text-left">
        {Card}
      </button>
    );
  }

  return Card;
};

export default StatCard;
