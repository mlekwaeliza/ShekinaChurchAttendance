import React, { useMemo, useState } from 'react';
import {
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Layers,
  UserCheck,
  Zap
} from 'lucide-react';

// Shared primitives for the attendance report tabs. Extracted from
// AttendanceReports.jsx so per-tab modules can stay small.

export const R = (v) => Math.round(Number(v) || 0);
export const asArray = (v) => (Array.isArray(v) ? v : []);
export const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const MONTHS_SHORT = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
export const weekToDate = (weekStr) => {
  const [y, w] = String(weekStr).split('-W').map(Number);
  if (!y || !w) return weekStr;
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const day = simple.getUTCDay();
  const isoStart = new Date(simple);
  if (day <= 4) isoStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else isoStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  // Attendance is reviewed and submitted for Sunday services. ISO weeks begin
  // on Monday, so label each column with its ending Sunday rather than Monday.
  isoStart.setUTCDate(isoStart.getUTCDate() + 6);
  return `${isoStart.getUTCDate()} ${MONTHS_SHORT[isoStart.getUTCMonth() + 1]}`;
};

export const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'compare', label: 'Compare', icon: ArrowUp },
  { id: 'performance', label: 'Performance', icon: Layers },
  { id: 'members', label: 'Members', icon: UserCheck },
  { id: 'history', label: 'History', icon: Calendar },
  { id: 'ai', label: 'AI Insights', icon: Zap }
];

export const MetricCard = ({
  label,
  value,
  previousValue,
  icon: Icon,
  showDiff = true,
  suffix = ''
}) => {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  const prevNum = typeof previousValue === 'number' ? previousValue : Number(previousValue) || 0;
  const diff = showDiff && previousValue != null ? num - prevNum : null;
  const pctDiff = showDiff && prevNum > 0 ? Math.round(((num - prevNum) / prevNum) * 100) : null;
  return (
    <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-card hover:shadow-card transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-system-fill flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-secondary-label" />
          </div>
        )}
      </div>
      <p className="text-title-2 font-semibold text-label">
        {suffix === '%' ? R(num) : num.toLocaleString()}
        {suffix}
      </p>
      {diff != null && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`text-caption-2 font-semibold px-1.5 py-0.5 rounded-full ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
          >
            {diff >= 0 ? '+' : ''}
            {diff.toLocaleString()}
            {suffix}
          </span>
          {pctDiff != null && (
            <span
              className={`text-caption-2 font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              ({diff >= 0 ? '+' : ''}
              {pctDiff}%)
            </span>
          )}
        </div>
      )}
      {previousValue != null && showDiff && (
        <p className="text-caption-2 text-tertiary-label mt-0.5">
          Prev: {prevNum.toLocaleString()}
          {suffix}
        </p>
      )}
    </div>
  );
};

export const IntelligenceTable = ({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available'
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortDir]);

  if (!data.length)
    return (
      <div className="text-center py-12 text-tertiary-label text-footnote">{emptyMessage}</div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-footnote">
        <thead className="sticky top-0 bg-secondary-system-grouped-background z-10">
          <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                className={`py-2.5 px-3 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer hover:text-secondary-label' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === 'asc' ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => (onRowClick ? onRowClick(row) : null)}
              title={onRowClick ? 'Click to view attendance details' : undefined}
              className={`border-b border-separator/50 dark:border-white/[0.08] hover:bg-system-fill/30 ${onRowClick ? 'cursor-pointer hover:ring-1 hover:ring-primary-500/40 dark:hover:ring-primary-500/40' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                >
                  {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const InsightCard = ({ insight }) => {
  const typeColors = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30'
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30'
    },
    danger: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-800',
      icon: 'text-rose-600',
      iconBg: 'bg-rose-100 dark:bg-rose-900/30'
    },
    info: {
      bg: 'bg-sky-50 dark:bg-sky-900/20',
      border: 'border-sky-200 dark:border-sky-800',
      icon: 'text-sky-600',
      iconBg: 'bg-sky-100 dark:bg-sky-900/30'
    }
  };
  const c = typeColors[insight.type] || typeColors.info;
  const Icon = insight.icon || Info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} p-3`}>
      <div className={`w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
      </div>
      <p className="text-caption-1 text-secondary-label">
        {typeof insight.text === 'string' ? insight.text : String(insight.text ?? '')}
      </p>
    </div>
  );
};
