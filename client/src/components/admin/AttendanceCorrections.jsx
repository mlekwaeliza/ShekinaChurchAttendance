import React, { useEffect, useMemo, useRef, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatLocalDate, addDays } from '../../utils/date';
import {
  Edit3,
  Search,
  Calendar,
  Users,
  Filter,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import Badge from '../ui/Badge';
import { useModalA11y } from '../../hooks/useModalA11y';

const STATUS_META = {
  present: { label: 'Present', icon: CheckCircle2, variant: 'success' },
  absent: { label: 'Absent', icon: XCircle, variant: 'danger' },
  excused: { label: 'Excused', icon: HelpCircle, variant: 'warning' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, variant: 'neutral' };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} dot>
      <span className="inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    </Badge>
  );
}

const EditAttendanceModal = ({ record, onClose, onSaved, showMessage }) => {
  const modalRef = useModalA11y({ isOpen: true, onClose });
  const [status, setStatus] = useState(record?.status || 'present');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!record?.id) return;
    setLoadingHistory(true);
    adminAPI.getAttendanceAudit(record.id)
      .then((res) => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [record?.id]);

  if (!record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await adminAPI.updateAttendance(record.id, status, reason.trim() || undefined);
      showMessage?.(`Attendance updated for ${record.member_name}.`);
      onSaved();
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to update attendance.', 4000);
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (val) => {
    if (!val) return '—';
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (_) { /* fall through */ }
    }
    return val;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-attendance-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-attendance-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Attendance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {record.member_name} &middot; {record.date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Section</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.section_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.service_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leader</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.leader_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted by</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.submitted_by_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Membership ID</p>
              <p className="text-sm font-mono text-slate-700 dark:text-slate-200">{record.membership_id || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current status</p>
              <div className="mt-1"><StatusBadge status={record.status} /></div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">New Status</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? key === 'present' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : key === 'absent' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                        : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="edit-reason" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reason for correction <span className="font-normal normal-case text-slate-400">(optional, max 500 chars)</span>
            </label>
            <textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Member was actually present but leader marked absent in error."
              className="input w-full resize-none"
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">{reason.length}/500</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Edit History
            </p>
            {loadingHistory ? (
              <p className="text-xs text-slate-400">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-xs italic text-slate-400">No prior corrections.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((entry) => {
                  const oldVal = formatValue(entry.old_value);
                  const newVal = formatValue(entry.new_value);
                  return (
                    <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {entry.editor_name || `User #${entry.editor_id || 'system'}`}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
                        <div><span className="text-[10px] uppercase">From:</span> {oldVal?.status || '—'}</div>
                        <div><span className="text-[10px] uppercase">To:</span> {newVal?.status || '—'}</div>
                      </div>
                      {newVal?.reason && (
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          <span className="text-[10px] uppercase">Reason:</span> {newVal.reason}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AttendanceCorrections = ({ showMessage }) => {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({
    q: '',
    start_date: '',
    end_date: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const load = async (activeFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        page_size: 1000,
        ...(activeFilters.q ? { q: activeFilters.q } : {}),
        ...(activeFilters.start_date ? { start_date: activeFilters.start_date } : {}),
        ...(activeFilters.end_date ? { end_date: activeFilters.end_date } : {}),
        ...(activeFilters.status ? { status: activeFilters.status } : {}),
      };
      const res = await adminAPI.searchAttendance(params);
      setRecords(res.data.rows || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load attendance corrections:', err);
      showMessage?.('Failed to load attendance records.', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Read current filters from a ref inside the setTimeout so the debounce
  // never sends stale filter values (the old closure bug).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const debounceRef = useRef(null);
  const debouncedLoad = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(filtersRef.current), 300);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  // Also expose load so button handlers can call it without a stale closure.
  const loadRef = useRef(load);
  loadRef.current = load;

  const handleApplyFilters = () => load(filters);

  const handleClearFilters = () => {
    const empty = { q: '', start_date: '', end_date: '', status: '' };
    setFilters(empty);
    filtersRef.current = empty;
    load(empty);
  };

  // Date-range presets
  const buildRange = (kind) => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    if (kind === 'today') return { start_date: todayStr, end_date: todayStr };
    if (kind === 'yesterday') {
      const y = addDays(today, -1);
      const yStr = formatLocalDate(y);
      return { start_date: yStr, end_date: yStr };
    }
    if (kind === 'last7') {
      return { start_date: formatLocalDate(addDays(today, -6)), end_date: todayStr };
    }
    if (kind === 'last30') {
      return { start_date: formatLocalDate(addDays(today, -29)), end_date: todayStr };
    }
    if (kind === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: formatLocalDate(first), end_date: todayStr };
    }
    if (kind === 'lastMonth') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start_date: formatLocalDate(first), end_date: formatLocalDate(last) };
    }
    return null;
  };

  const handleDatePreset = (kind) => {
    const range = buildRange(kind);
    if (!range) return;
    const next = { ...filtersRef.current, ...range };
    setFilters(next);
    filtersRef.current = next;
    load(next);
  };

  const handleClearDates = () => {
    const next = { ...filtersRef.current, start_date: '', end_date: '' };
    setFilters(next);
    filtersRef.current = next;
    load(next);
  };

  const hasDateFilter = Boolean(filters.start_date || filters.end_date);
  const activePreset = (() => {
    if (!hasDateFilter) return null;
    const todayStr = formatLocalDate(new Date());
    if (filters.start_date === todayStr && filters.end_date === todayStr) return 'today';
    const yest = formatLocalDate(addDays(new Date(), -1));
    if (filters.start_date === yest && filters.end_date === yest) return 'yesterday';
    if (filters.start_date === formatLocalDate(addDays(new Date(), -6)) && filters.end_date === todayStr) return 'last7';
    if (filters.start_date === formatLocalDate(addDays(new Date(), -29)) && filters.end_date === todayStr) return 'last30';
    const t = new Date();
    const monthFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 1));
    if (filters.start_date === monthFirst && filters.end_date === todayStr) return 'thisMonth';
    const prevFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    const prevLast = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 0));
    if (filters.start_date === prevFirst && filters.end_date === prevLast) return 'lastMonth';
    return 'custom';
  })();

  const columns = useMemo(() => [
    {
      accessor: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 tabular-nums">{row.date}</span>
      ),
    },
    {
      accessor: 'member_name',
      header: 'Member',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.member_name}</p>
          <p className="text-[10px] font-mono text-slate-400">{row.membership_id}</p>
        </div>
      ),
    },
    {
      accessor: 'section_name',
      header: 'Section',
      render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{row.section_name || '—'}</span>,
    },
    {
      accessor: 'service_name',
      header: 'Service',
      render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{row.service_name || '—'}</span>,
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      accessor: 'submitted_by_name',
      header: 'Submitted by',
      render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{row.submitted_by_name || '—'}</span>,
    },
    {
      accessor: 'submitted_at',
      header: 'When',
      render: (row) => <span className="text-xs text-slate-400">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}</span>,
    },
    {
      accessor: 'actions',
      header: '',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setEditing(row); }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50"
        >
          <Edit3 className="h-3 w-3" />
          Edit
        </button>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-6 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Edit3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Attendance Corrections</h2>
            <p className="text-sm text-white/80">Audit and fix attendance records submitted by leaders</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => { handleFilterChange('q', e.target.value); debouncedLoad(); }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              placeholder="Search member name or membership ID..."
              className="input h-10 w-full pl-10 pr-10"
            />
            {filters.q && (
              <button
                type="button"
                onClick={() => {
                  const next = { ...filtersRef.current, q: '' };
                  setFilters(next);
                  filtersRef.current = next;
                  load(next);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'More Filters'}
            </button>
            <button
              type="button"
              onClick={() => load(filters)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label>
            <input
              type="date"
              value={filters.start_date}
              max={filters.end_date || undefined}
              onChange={(e) => { handleFilterChange('start_date', e.target.value); debouncedLoad(); }}
              className="input h-9 w-full cursor-pointer"
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label>
            <input
              type="date"
              value={filters.end_date}
              min={filters.start_date || undefined}
              onChange={(e) => { handleFilterChange('end_date', e.target.value); debouncedLoad(); }}
              className="input h-9 w-full cursor-pointer"
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </div>
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-primary-700"
            title="Apply filters"
          >
            <Calendar className="h-3.5 w-3.5" />
            Apply
          </button>
          {hasDateFilter && (
            <button
              type="button"
              onClick={handleClearDates}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Clear date range"
            >
              <X className="h-3.5 w-3.5" />
              Clear dates
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick range</span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7', label: 'Last 7 days' },
            { id: 'last30', label: 'Last 30 days' },
            { id: 'thisMonth', label: 'This month' },
            { id: 'lastMonth', label: 'Last month' },
          ].map((p) => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePreset(p.id)}
                className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {activePreset === 'custom' && (
            <span className="ml-1 inline-flex h-7 items-center rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Custom range
            </span>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4 dark:border-slate-700">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label>
              <input type="date" value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} className="input h-9 w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label>
              <input type="date" value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} className="input h-9 w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
              <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="input h-9 w-full">
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={handleApplyFilters} className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">
                Apply
              </button>
              <button type="button" onClick={handleClearFilters} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? 'Loading…'
              : `${total} record${total === 1 ? '' : 's'} found${(filters.q || hasDateFilter || filters.status) ? ' (filtered)' : ''}`}
          </p>
          {(filters.q || hasDateFilter || filters.status) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              title="Clear all filters"
            >
              <X className="h-3 w-3" />
              Reset all filters
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Users className="h-8 w-8" />
                    <p className="text-sm font-semibold">No attendance records found</p>
                    <p className="text-xs">
                      {(filters.q || hasDateFilter || filters.status)
                        ? 'No records match the current filters.'
                        : 'Try adjusting your filters or date range.'}
                    </p>
                    {(filters.q || hasDateFilter || filters.status) && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reset all filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                records.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    {columns.map((c) => (
                      <td key={c.header} className="px-4 py-2.5 align-middle">{c.render(row)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditAttendanceModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(page); }}
          showMessage={showMessage}
        />
      )}
    </div>
  );
};

export default AttendanceCorrections;
