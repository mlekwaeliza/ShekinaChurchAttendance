import React from 'react';
import { Loader2 } from 'lucide-react';

const ChartCard = ({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  height = 'h-[400px]',
  className = '',
  actions,
  icon: Icon
}) => {
  return (
    <div className={`card p-5 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="relative z-10 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
          <div className="min-w-0">
            {title && <h3 className="truncate text-headline font-semibold text-label">{title}</h3>}
            {subtitle && (
              <p className="mt-0.5 truncate text-footnote text-secondary-label">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Chart area */}
      <div className={`${height} relative z-10`}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin-slow text-primary-600 dark:text-primary-400" />
            <p className="mt-3 text-footnote text-secondary-label">Loading chart…</p>
          </div>
        ) : empty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-system-fill">
              <svg
                className="h-6 w-6 text-tertiary-label"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="text-footnote text-secondary-label">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default ChartCard;
