import React from 'react';

export const SkeletonLine = ({ className = '', width = 'w-full' }) => (
  <div className={`skeleton h-4 ${width} ${className}`} />
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`card p-6 space-y-4 ${className}`}>
    <div className="flex items-center justify-between">
      <SkeletonLine width="w-24" className="h-3" />
      <div className="skeleton w-10 h-10 rounded-xl" />
    </div>
    <SkeletonLine width="w-20" className="h-9 mt-2" />
    <SkeletonLine width="w-32" className="h-3" />
  </div>
);

export const SkeletonTableRow = ({ cols = 4, className = '' }) => (
  <tr className={className}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <SkeletonLine width={i === 0 ? 'w-16' : i === cols - 1 ? 'w-20' : 'w-28'} />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="card overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
      <div className="skeleton h-10 w-full rounded-xl" />
    </div>
    <table className="min-w-full">
      <thead className="bg-slate-50/80 dark:bg-slate-700/50">
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-6 py-3.5">
              <SkeletonLine width="w-16" className="h-3" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

export const SkeletonChart = ({ className = '' }) => (
  <div className={`card p-6 ${className}`}>
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <SkeletonLine width="w-32" className="h-5" />
        <SkeletonLine width="w-48" className="h-3" />
      </div>
    </div>
    <div className="skeleton h-[350px] rounded-xl" />
  </div>
);

const LoadingSkeleton = ({ type = 'card', count = 1, ...props }) => {
  const Component = {
    card: SkeletonCard,
    table: SkeletonTable,
    chart: SkeletonChart,
  }[type] || SkeletonCard;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} {...props} />
      ))}
    </>
  );
};

export default LoadingSkeleton;
