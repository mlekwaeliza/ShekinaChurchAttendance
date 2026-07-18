import React from 'react';
import {
  TrendingUp, TrendingDown, Minus, Download, Printer, FileText,
  Bell, CalendarClock, Sparkles, AlertCircle, ChevronDown
} from 'lucide-react';

export const R = v => Math.round(Number(v) || 0);

export const STATUS = {
  excellent: { color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', label: 'Excellent' },
  good:      { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', label: 'Good' },
  watch:     { color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', label: 'Watch' },
  attention: { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400', label: 'Needs Attention' },
  critical:  { color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-600 dark:text-rose-400', label: 'Critical' },
  neutral:   { color: '#64748b', bg: 'bg-slate-50 dark:bg-slate-700/30', border: 'border-slate-200 dark:border-slate-600', text: 'text-slate-500 dark:text-slate-400', label: 'Neutral' },
};

export function statusForScore(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'watch';
  if (score >= 30) return 'attention';
  return 'critical';
}

export function statusForTrend(diff) {
  if (diff > 0) return 'excellent';
  if (diff < 0) return 'critical';
  return 'neutral';
}

export const TrendIcon = ({ diff }) => {
  if (diff > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (diff < 0) return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
};

export const KpiCard = ({ label, value, previousValue, icon: Icon, status = 'neutral', suffix = '' }) => {
  const s = STATUS[status] || STATUS.neutral;
  const num = typeof value === 'number' ? value : (Number(value) || 0);
  const prevNum = typeof previousValue === 'number' ? previousValue : (Number(previousValue) || 0);
  const diff = previousValue != null ? num - prevNum : null;
  const pctDiff = prevNum > 0 ? Math.round(((num - prevNum) / prevNum) * 100) : null;
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {Icon && <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
        </div>}
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">
        {suffix === '%' ? R(num) : num.toLocaleString()}{suffix}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        {diff != null && (
          <>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diff >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
              {diff >= 0 ? '+' : ''}{diff.toLocaleString()}{suffix}
            </span>
            {pctDiff != null && (
              <span className={`text-[10px] font-medium ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                ({diff >= 0 ? '+' : ''}{pctDiff}%)
              </span>
            )}
          </>
        )}
        {diff == null && (
          <span className={`text-[10px] font-semibold ${s.text}`}>{s.label}</span>
        )}
      </div>
      {previousValue != null && (
        <p className="text-[9px] text-slate-400 mt-0.5">Prev: {prevNum.toLocaleString()}{suffix}</p>
      )}
    </div>
  );
};

export const QuickActionsPanel = ({ onExport, onPrint, onNotifyLeaders, onScheduleFollowup, onGenerateReport }) => (
  <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <Sparkles className="w-4 h-4 text-slate-500" />
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
    </div>
    <div className="space-y-2">
      {[
        { label: 'Download PDF', icon: Download, onClick: onExport, color: 'text-blue-600' },
        { label: 'Export Excel', icon: FileText, onClick: onExport, color: 'text-emerald-600' },
        { label: 'Print Report', icon: Printer, onClick: onPrint, color: 'text-slate-600' },
        { label: 'Notify Leaders', icon: Bell, onClick: onNotifyLeaders, color: 'text-amber-600' },
        { label: 'Schedule Follow-up', icon: CalendarClock, onClick: onScheduleFollowup, color: 'text-orange-600' },
        { label: 'Generate AI Report', icon: Sparkles, onClick: onGenerateReport, color: 'text-violet-600' },
      ].map(({ label, icon: I, onClick, color }) => (
        <button key={label} onClick={onClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-200/60 dark:border-slate-700">
          <I className={`w-3.5 h-3.5 ${color}`} />
          {label}
        </button>
      ))}
    </div>
  </div>
);

export const AIExecutiveSummary = ({ insights = [], actions = [] }) => {
  const insightList = Array.isArray(insights) ? insights : [];
  const actionList = Array.isArray(actions) ? actions : [];
  if (!insightList.length && !actionList.length) return null;
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Executive Summary</h3>
      </div>
      <div className="space-y-2">
        {insightList.map((insight, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
              insight.type === 'success' ? 'bg-emerald-500' :
              insight.type === 'warning' ? 'bg-amber-500' :
              insight.type === 'danger' ? 'bg-rose-500' :
              'bg-blue-500'
            }`} />
            <p className="text-xs text-slate-600 dark:text-slate-300">{insight.text}</p>
          </div>
        ))}
      </div>
      {actionList.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recommendations</span>
          </div>
          {actionList.map((action, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                action.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                action.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              }`}>{action.priority}</span>
              <p className="text-xs text-slate-600 dark:text-slate-300">{action.title}{action.description ? ` — ${action.description}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ExpandableRow = ({ title, subtitle, children, defaultOpen = false }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{title}</span>
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};
