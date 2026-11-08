import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../services/api';
import { formatLocalDate, addDays, fdate, fdatetime } from '../../utils/date';
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
  ClipboardList,
  AlertTriangle,
  Save,
  BarChart3,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Badge from '../ui/Badge';
import { useModalA11y } from '../../hooks/useModalA11y';

const STATUS_META = {
  present: { label: 'Present', icon: CheckCircle2, variant: 'success' },
  absent: { label: 'Absent', icon: XCircle, variant: 'danger' },
  excused: { label: 'Excused', icon: HelpCircle, variant: 'warning' }
};

const STATUS_CONTROL_STYLES = {
  present: {
    active: 'border-emerald-600 bg-emerald-600 text-white',
    idle: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30'
  },
  absent: {
    active: 'border-rose-600 bg-rose-600 text-white',
    idle: 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/30'
  },
  excused: {
    active: 'border-amber-500 bg-amber-500 text-white',
    idle: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30'
  }
};

const SUBMISSION_STATUS_META = {
  missing: { label: 'Missing', variant: 'danger', icon: XCircle },
  partial: { label: 'Partial', variant: 'warning', icon: AlertTriangle },
  late: { label: 'Late', variant: 'warning', icon: Clock },
  submitted: { label: 'Completed', variant: 'success', icon: CheckCircle2 }
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

function SubmissionStatusBadge({ status }) {
  const meta = SUBMISSION_STATUS_META[status] || {
    label: status,
    variant: 'neutral',
    icon: HelpCircle
  };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant}>
      <span className="inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    </Badge>
  );
}

// ── Existing single-member edit modal (unchanged) ──
const EditAttendanceModal = ({ record, onClose, onSaved, showMessage }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  useModalA11y(modalRef, true, onClose);
  const [status, setStatus] = useState(record?.status || 'present');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!record?.id) return;
    setLoadingHistory(true);
    adminAPI
      .getAttendanceAudit(record.id)
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
      } catch (_) {
        /* display the original value */
      }
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
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-secondary-system-grouped-background shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/[0.06] bg-secondary-system-grouped-background px-6 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-attendance-title" className="text-subheadline font-semibold text-label">
                {t('attendance.corrections.editTitle')}
              </h2>
              <p className="text-caption-1 text-secondary-label">
                {record.member_name} &middot; {fdate(record.date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-tertiary-label transition-colors hover:bg-system-fill hover:text-secondary-label dark:hover:bg-white/[0.06] dark:hover:text-label"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-system-fill p-4 dark:bg-white/[0.03]">
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Section
              </p>
              <p className="text-footnote font-semibold text-secondary-label">
                {record.section_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Service
              </p>
              <p className="text-footnote font-semibold text-secondary-label">
                {record.service_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Leader
              </p>
              <p className="text-footnote font-semibold text-secondary-label">
                {record.leader_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Submitted by
              </p>
              <p className="text-footnote font-semibold text-secondary-label">
                {record.submitted_by_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Membership ID
              </p>
              <p className="text-footnote font-mono text-secondary-label">
                {record.membership_id || '—'}
              </p>
            </div>
            <div>
              <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Current status
              </p>
              <div className="mt-1">
                <StatusBadge status={record.status} />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
              New Status
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-footnote font-semibold transition-all ${
                      active
                        ? key === 'present'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                          : key === 'absent'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                            : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                        : 'border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label hover:border-black/[0.12] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-tertiary-label'
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
            <label
              htmlFor="edit-reason"
              className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label"
            >
              Reason for correction{' '}
              <span className="font-normal normal-case text-tertiary-label">
                (optional, max 500 chars)
              </span>
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
            <p className="mt-1 text-right text-caption-2 text-tertiary-label">
              {reason.length}/500
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-system-grouped-background/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="mb-3 flex items-center gap-2 text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
              <Clock className="h-3.5 w-3.5" /> Edit History
            </p>
            {loadingHistory ? (
              <p className="text-caption-1 text-tertiary-label">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-caption-1 italic text-tertiary-label">No prior corrections.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((entry) => {
                  const oldVal = formatValue(entry.old_value);
                  const newVal = formatValue(entry.new_value);
                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background p-2.5 text-caption-1 dark:border-white/[0.08]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-secondary-label">
                          {entry.editor_name || `User #${entry.editor_id || 'system'}`}
                        </span>
                        <span className="text-caption-2 text-tertiary-label">
                          {fdatetime(entry.created_at)}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-secondary-label">
                        <div>
                          <span className="text-caption-2 uppercase">From:</span>{' '}
                          {oldVal?.status || '—'}
                        </div>
                        <div>
                          <span className="text-caption-2 uppercase">To:</span>{' '}
                          {newVal?.status || '—'}
                        </div>
                      </div>
                      {newVal?.reason && (
                        <p className="mt-1 text-secondary-label">
                          <span className="text-caption-2 uppercase">Reason:</span> {newVal.reason}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-4 py-2 text-footnote font-semibold text-secondary-label transition-colors hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label dark:hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-footnote font-semibold text-white shadow-card transition-all hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bulk Correction Modal for Missing Leader Submissions ──
const CORRECTION_REASONS = [
  'Leader forgot',
  'Leader absent',
  'Paper attendance',
  'System recovery',
  'Other'
];

const BulkCorrectionModal = ({ leader, date, serviceId, onClose, onSaved, showMessage }) => {
  const modalRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reason, setReason] = useState(CORRECTION_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);
  useModalA11y(modalRef, true, handleClose);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminAPI.getLeaderMembers(leader.leader_id, date, serviceId);
      setMembers(res.data.members || []);
    } catch (error) {
      setLoadError(
        error.data?.details || error.data?.error || error.message || 'Could not load the roster.'
      );
    } finally {
      setLoading(false);
    }
  }, [date, leader.leader_id, serviceId]);

  useEffect(() => {
    if (leader) loadMembers();
  }, [leader, loadMembers]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.full_name?.toLowerCase().includes(q) || m.membership_id?.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const recordedCount = members.filter((m) => m.status).length;
  const expectedCount = members.length;
  const allHaveStatus = expectedCount > 0 && members.every((m) => m.status);
  const completionPercent = expectedCount ? Math.round((recordedCount / expectedCount) * 100) : 0;
  const summary = useMemo(() => {
    const p = members.filter((m) => m.status === 'present').length;
    const a = members.filter((m) => m.status === 'absent').length;
    const e = members.filter((m) => m.status === 'excused').length;
    return { present: p, absent: a, excused: e, total: p + a + e };
  }, [members]);
  const allVisibleSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedIds.has(member.member_id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      filteredMembers.forEach((member) => {
        if (allVisibleSelected) next.delete(member.member_id);
        else next.add(member.member_id);
      });
      return next;
    });
  };

  const bulkSetStatus = (newStatus) => {
    if (selectedIds.size === 0) return;
    setMembers((prev) =>
      prev.map((m) => (selectedIds.has(m.member_id) ? { ...m, status: newStatus } : m))
    );
    showMessage?.(`Marked ${selectedIds.size} member(s) as ${newStatus}.`, 2000);
  };

  const setMemberStatus = (memberId, newStatus) => {
    setMembers((prev) =>
      prev.map((m) => (m.member_id === memberId ? { ...m, status: newStatus } : m))
    );
  };

  const handleSubmit = async () => {
    if (!allHaveStatus) {
      showMessage?.('All members must have an attendance status before saving.', 4000);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const records = members.map((m) => ({ member_id: m.member_id, status: m.status }));
      await adminAPI.bulkCorrectAttendance({
        date,
        service_id: serviceId,
        leader_id: leader.leader_id,
        reason,
        records
      });
      onSaved(summary.total);
    } catch (err) {
      showMessage?.(
        err.data?.details || err.data?.error || err.message || 'Failed to save attendance.',
        4000
      );
    } finally {
      setSaving(false);
    }
  };

  if (!leader) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:p-5"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-correction-title"
        className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-modal dark:border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-black/[0.06] px-4 py-4 dark:border-white/[0.08] sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-caption-2 font-semibold text-primary-700 dark:text-primary-300">
                Attendance correction
              </p>
              <h2
                id="bulk-correction-title"
                className="mt-0.5 text-title-3 font-semibold text-label"
              >
                Mark attendance
              </h2>
              <p className="mt-0.5 truncate text-footnote text-secondary-label">
                For {leader.leader_name} · {leader.section_name}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1 pt-0.5 text-right sm:flex">
              <span className="text-footnote font-semibold text-label">
                {leader.service_name || 'Selected service'}
              </span>
              <span className="text-caption-1 text-secondary-label">{fdate(date)}</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close attendance correction"
              disabled={saving}
              className="rounded-lg p-2 text-tertiary-label transition-colors hover:bg-system-fill hover:text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
            <span className="rounded-lg bg-system-fill px-2.5 py-1 text-caption-2 font-medium text-secondary-label">
              {leader.section_name}
            </span>
            <span className="rounded-lg bg-system-fill px-2.5 py-1 text-caption-2 font-medium text-secondary-label">
              {leader.service_name || 'Selected service'}
            </span>
            <span className="rounded-lg bg-system-fill px-2.5 py-1 text-caption-2 font-medium text-secondary-label">
              {fdate(date)}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-black/[0.06] bg-system-fill/60 dark:border-white/[0.08]"
                  />
                ))}
              </div>
              <div className="rounded-xl border border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary-600" />
                <p className="mt-3 text-footnote font-medium text-secondary-label">
                  Loading {leader.leader_name}&apos;s roster…
                </p>
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
              <AlertTriangle className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-300" />
              <h3 className="mt-3 text-footnote font-semibold text-label">
                Roster couldn&apos;t load
              </h3>
              <p className="mx-auto mt-1 max-w-lg text-caption-1 text-secondary-label">
                {loadError}
              </p>
              <button
                type="button"
                onClick={loadMembers}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary-system-grouped-background px-3 py-2 text-caption-1 font-semibold text-label shadow-sm transition-colors hover:bg-system-fill"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <section
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                aria-label="Attendance summary"
              >
                <div className="rounded-xl border border-black/[0.06] bg-system-grouped-background/30 p-4 dark:border-white/[0.08]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-caption-1 font-semibold text-secondary-label">
                      Roster progress
                    </p>
                    <span className="text-footnote font-semibold tabular-nums text-label">
                      {completionPercent}%
                    </span>
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-system-fill"
                    role="progressbar"
                    aria-label="Attendance roster completion"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={completionPercent}
                  >
                    <div
                      className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-caption-2 tabular-nums text-tertiary-label">
                    {recordedCount} of {expectedCount} members marked
                  </p>
                </div>
                {[
                  { key: 'present', value: summary.present },
                  { key: 'absent', value: summary.absent },
                  { key: 'excused', value: summary.excused }
                ].map(({ key, value }) => {
                  const meta = STATUS_META[key];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-black/[0.06] bg-system-grouped-background/30 p-4 dark:border-white/[0.08]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            key === 'present'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : key === 'absent'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <p className="text-caption-1 font-semibold text-secondary-label">
                          {meta.label}
                        </p>
                      </div>
                      <p className="mt-2 text-title-3 font-semibold tabular-nums text-label">
                        {value}
                      </p>
                    </div>
                  );
                })}
              </section>

              <section className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 dark:border-white/[0.08]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search this roster"
                      aria-label="Search members in this roster"
                      className="input h-10 w-full rounded-lg pl-9 pr-9 text-footnote"
                    />
                    {memberSearch && (
                      <button
                        type="button"
                        onClick={() => setMemberSearch('')}
                        aria-label="Clear member search"
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-caption-1 tabular-nums text-secondary-label">
                      {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={filteredMembers.length === 0}
                      className="rounded-lg border border-black/[0.08] px-3 py-2 text-caption-1 font-semibold text-secondary-label transition-colors hover:bg-system-fill hover:text-label disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1]"
                    >
                      {allVisibleSelected ? 'Clear visible' : 'Select visible'}
                    </button>
                  </div>
                </div>
                {selectedIds.size > 0 && (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg bg-primary-500/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-caption-1 font-semibold text-primary-800 dark:text-primary-200">
                      {selectedIds.size} selected
                      <span className="ml-1 font-normal text-secondary-label">Set status to</span>
                    </p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Set status for selected members"
                    >
                      {Object.entries(STATUS_META).map(([key, meta]) => {
                        const Icon = meta.icon;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => bulkSetStatus(key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-caption-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${STATUS_CONTROL_STYLES[key].idle}`}
                          >
                            <Icon className="h-3.5 w-3.5" /> {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                  <div>
                    <h3 className="text-footnote font-semibold text-label">Member roster</h3>
                    <p className="mt-0.5 text-caption-2 text-tertiary-label">
                      Set one attendance status for each member
                    </p>
                  </div>
                  <span className="rounded-full bg-system-fill px-2.5 py-1 text-caption-2 font-semibold tabular-nums text-secondary-label">
                    {recordedCount}/{expectedCount} complete
                  </span>
                </div>
                {filteredMembers.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Users className="mx-auto h-6 w-6 text-tertiary-label" />
                    <p className="mt-3 text-footnote font-semibold text-label">
                      {memberSearch ? 'No members match that search' : 'No members in this roster'}
                    </p>
                    <p className="mt-1 text-caption-1 text-secondary-label">
                      {memberSearch
                        ? 'Try a different name or membership ID.'
                        : 'There are no active members assigned to this leader.'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[390px] divide-y divide-separator/50 overflow-y-auto dark:divide-white/[0.06]">
                    {filteredMembers.map((member) => {
                      const initials =
                        member.full_name
                          ?.trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join('')
                          .toUpperCase() || '?';
                      return (
                        <div
                          key={member.member_id}
                          className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-system-grouped-background/40 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(member.member_id)}
                              onChange={() => toggleSelect(member.member_id)}
                              aria-label={`Select ${member.full_name} for bulk status changes`}
                              className="h-4 w-4 shrink-0 rounded border-black/[0.16] accent-primary-600"
                            />
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-system-fill text-caption-1 font-semibold text-secondary-label">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-footnote font-semibold text-label">
                                {member.full_name}
                              </p>
                              <p className="mt-0.5 truncate text-caption-1 text-tertiary-label">
                                {member.membership_id || 'No membership ID'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:w-[410px] sm:flex-row sm:items-center sm:justify-end">
                            <div className="sm:w-24 sm:text-right">
                              {member.status ? (
                                <StatusBadge status={member.status} />
                              ) : (
                                <Badge variant="warning" dot>
                                  Not marked
                                </Badge>
                              )}
                            </div>
                            <div
                              className="grid grid-cols-3 gap-1.5"
                              role="group"
                              aria-label={`Attendance status for ${member.full_name}`}
                            >
                              {Object.entries(STATUS_META).map(([key, meta]) => {
                                const Icon = meta.icon;
                                const active = member.status === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setMemberStatus(member.member_id, key)}
                                    aria-label={`${meta.label} for ${member.full_name}`}
                                    aria-pressed={active}
                                    className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-caption-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-2.5 ${
                                      active
                                        ? STATUS_CONTROL_STYLES[key].active
                                        : STATUS_CONTROL_STYLES[key].idle
                                    }`}
                                  >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    {meta.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="grid gap-4 rounded-xl border border-black/[0.06] bg-system-grouped-background/25 p-4 dark:border-white/[0.08] sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/[0.1] text-primary-700 dark:text-primary-300">
                    <Info className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-caption-1 font-semibold text-label">Correction audit</p>
                    <p className="mt-1 text-caption-1 leading-relaxed text-secondary-label">
                      This update will be recorded for {leader.leader_name} on {fdate(date)}.
                    </p>
                    <p className="mt-1 text-caption-2 text-tertiary-label">
                      {summary.total} member records currently have a status.
                    </p>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="attendance-correction-reason"
                    className="mb-1.5 block text-caption-1 font-semibold text-label"
                  >
                    Correction reason
                  </label>
                  <select
                    id="attendance-correction-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input h-10 w-full rounded-lg text-caption-1"
                  >
                    {CORRECTION_REASONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-black/[0.06] bg-secondary-system-grouped-background px-4 py-3 dark:border-white/[0.08] sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption-1 text-secondary-label" aria-live="polite">
              {loading
                ? 'Loading roster…'
                : loadError
                  ? 'Resolve the roster issue before saving.'
                  : expectedCount === 0
                    ? 'No member records to save.'
                    : allHaveStatus
                      ? `All ${expectedCount} members have a status.`
                      : `${expectedCount - recordedCount} ${expectedCount - recordedCount === 1 ? 'member needs' : 'members need'} a status.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="rounded-lg border border-black/[0.08] px-4 py-2.5 text-footnote font-semibold text-secondary-label transition-colors hover:bg-system-fill disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !allHaveStatus || loading || Boolean(loadError)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-footnote font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ── Main Component ──
const AttendanceCorrections = ({ showMessage }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get('tab') === 'missing' || searchParams.has('leader_id') ? 'missing' : 'edit'
  );
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ q: '', start_date: '', end_date: '', status: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const searchRef = useRef(null);

  // Missing submissions state
  const [mlsDate, setMlsDate] = useState(() => {
    const requestedDate = searchParams.get('date');
    return /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '')
      ? requestedDate
      : formatLocalDate(new Date());
  });
  const [mlsServiceId, setMlsServiceId] = useState(() => {
    const requestedServiceId = Number(searchParams.get('service_id'));
    return Number.isInteger(requestedServiceId) && requestedServiceId > 0 ? requestedServiceId : 1;
  });
  const [requestedLeaderId, setRequestedLeaderId] = useState(() => {
    const leaderId = Number(searchParams.get('leader_id'));
    return Number.isInteger(leaderId) && leaderId > 0 ? leaderId : null;
  });
  const [mlsServices, setMlsServices] = useState([]);
  const [mlsData, setMlsData] = useState(null);
  const [mlsLoading, setMlsLoading] = useState(false);
  const [bulkLeader, setBulkLeader] = useState(null);

  // Load real service types so the missing-submissions filter matches the
  // services leaders actually submit against (falls back to Main/Midweek).
  useEffect(() => {
    let cancelled = false;
    adminAPI
      .getServiceTypes()
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setMlsServices(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Tab 1: Edit Attendance (server-driven pagination) ──
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pageRef = useRef(1);
  const pageSizeRef = useRef(50);
  const load = async (
    activeFilters = filtersRef.current,
    targetPage = pageRef.current,
    targetSize = pageSizeRef.current
  ) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        page_size: targetSize,
        ...(activeFilters.q ? { q: activeFilters.q } : {}),
        ...(activeFilters.start_date ? { start_date: activeFilters.start_date } : {}),
        ...(activeFilters.end_date ? { end_date: activeFilters.end_date } : {}),
        ...(activeFilters.status ? { status: activeFilters.status } : {})
      };
      const res = await adminAPI.searchAttendance(params);
      setRecords(res.data.rows || []);
      setTotal(res.data.total || 0);
      const returnedPage = Number(res.data.page) || targetPage;
      pageRef.current = returnedPage;
      setPage(returnedPage);
    } catch (err) {
      console.error('Failed to load attendance corrections:', err);
      showMessage?.('Failed to load attendance records.', 4000);
    } finally {
      setLoading(false);
    }
  };

  // Filter changes always restart from page 1; page/size controls keep filters.
  const loadFirstPage = (nextFilters) => {
    pageRef.current = 1;
    setPage(1);
    load(nextFilters, 1, pageSizeRef.current);
  };
  const handlePageChange = (nextPage) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSizeRef.current));
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    if (clamped === pageRef.current) return;
    pageRef.current = clamped;
    setPage(clamped);
    load(filtersRef.current, clamped, pageSizeRef.current);
  };
  const handlePageSizeChange = (nextSize) => {
    pageSizeRef.current = nextSize;
    setPageSize(nextSize);
    pageRef.current = 1;
    setPage(1);
    load(filtersRef.current, 1, nextSize);
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const pageNumbers = useMemo(() => {
    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const debounceRef = useRef(null);
  const debouncedLoad = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadFirstPage(filtersRef.current), 300);
  };
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );
  const searchMembers = async (q) => {
    if (!q || q.length < 1) {
      setMemberSuggestions([]);
      setShowMemberDropdown(false);
      return;
    }
    try {
      const res = await adminAPI.searchMembers(q);
      setMemberSuggestions(res.data || []);
      setShowMemberDropdown(true);
    } catch {
      setMemberSuggestions([]);
    }
  };

  const selectMember = (member) => {
    const next = { ...filtersRef.current, q: member.full_name };
    setFilters(next);
    filtersRef.current = next;
    setShowMemberDropdown(false);
    setMemberSuggestions([]);
    loadFirstPage(next);
  };

  const handleApplyFilters = () => loadFirstPage(filtersRef.current);
  const handleClearFilters = () => {
    const empty = { q: '', start_date: '', end_date: '', status: '' };
    setFilters(empty);
    filtersRef.current = empty;
    loadFirstPage(empty);
  };

  const buildRange = (kind) => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    if (kind === 'today') return { start_date: todayStr, end_date: todayStr };
    if (kind === 'yesterday')
      return {
        start_date: formatLocalDate(addDays(today, -1)),
        end_date: formatLocalDate(addDays(today, -1))
      };
    if (kind === 'last7')
      return { start_date: formatLocalDate(addDays(today, -6)), end_date: todayStr };
    if (kind === 'last30')
      return { start_date: formatLocalDate(addDays(today, -29)), end_date: todayStr };
    if (kind === 'thisMonth')
      return {
        start_date: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        end_date: todayStr
      };
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
    loadFirstPage(next);
  };

  const handleClearDates = () => {
    const next = { ...filtersRef.current, start_date: '', end_date: '' };
    setFilters(next);
    filtersRef.current = next;
    loadFirstPage(next);
  };

  const hasDateFilter = Boolean(filters.start_date || filters.end_date);
  const activePreset = (() => {
    if (!hasDateFilter) return null;
    const todayStr = formatLocalDate(new Date());
    if (filters.start_date === todayStr && filters.end_date === todayStr) return 'today';
    if (
      filters.start_date === formatLocalDate(addDays(new Date(), -1)) &&
      filters.end_date === formatLocalDate(addDays(new Date(), -1))
    )
      return 'yesterday';
    if (
      filters.start_date === formatLocalDate(addDays(new Date(), -6)) &&
      filters.end_date === todayStr
    )
      return 'last7';
    if (
      filters.start_date === formatLocalDate(addDays(new Date(), -29)) &&
      filters.end_date === todayStr
    )
      return 'last30';
    const t = new Date();
    const monthFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 1));
    if (filters.start_date === monthFirst && filters.end_date === todayStr) return 'thisMonth';
    const prevFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    const prevLast = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 0));
    if (filters.start_date === prevFirst && filters.end_date === prevLast) return 'lastMonth';
    return 'custom';
  })();

  const columns = useMemo(
    () => [
      {
        accessor: 'date',
        header: 'Date',
        sortable: true,
        render: (row) => (
          <span className="text-footnote font-medium text-secondary-label tabular-nums">
            {fdate(row.date)}
          </span>
        )
      },
      {
        accessor: 'member_name',
        header: 'Member',
        render: (row) => (
          <div>
            <p className="text-footnote font-semibold text-label">{row.member_name}</p>
            <p className="text-caption-2 font-mono text-tertiary-label">{row.membership_id}</p>
          </div>
        )
      },
      {
        accessor: 'section_name',
        header: 'Section',
        render: (row) => (
          <span className="text-footnote text-secondary-label">{row.section_name || '—'}</span>
        )
      },
      {
        accessor: 'service_name',
        header: 'Service',
        render: (row) => (
          <span className="text-footnote text-secondary-label">{row.service_name || '—'}</span>
        )
      },
      {
        accessor: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />
      },
      {
        accessor: 'submitted_by_name',
        header: 'Submitted by',
        render: (row) => (
          <span className="text-caption-1 text-secondary-label">
            {row.submitted_by_name || '—'}
          </span>
        )
      },
      {
        accessor: 'submitted_at',
        header: 'When',
        render: (row) => (
          <span className="text-caption-1 text-tertiary-label">
            {row.submitted_at ? fdatetime(row.submitted_at) : '—'}
          </span>
        )
      },
      {
        accessor: 'actions',
        header: '',
        render: (row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(row);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-caption-1 font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50"
          >
            <Edit3 className="h-3 w-3" /> Edit
          </button>
        )
      }
    ],
    []
  );

  // ── Tab 2: Missing Leader Submissions ──
  const loadMissingSubmissions = async () => {
    setMlsLoading(true);
    try {
      const res = await adminAPI.getMissingSubmissions(mlsDate, mlsServiceId);
      setMlsData(res.data);
    } catch (err) {
      console.error('Failed to load missing submissions:', err);
      showMessage?.('Failed to load submissions.', 4000);
    } finally {
      setMlsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'missing') loadMissingSubmissions();
  }, [activeTab, mlsDate, mlsServiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!requestedLeaderId || !mlsData || mlsLoading) return;
    const leader = mlsData.leaders?.find((item) => Number(item.leader_id) === requestedLeaderId);
    if (leader && leader.status !== 'submitted') {
      setBulkLeader(leader);
    } else {
      showMessage?.(
        leader
          ? `${leader.leader_name} has already submitted for this service.`
          : 'The selected leader was not found for this date and service.',
        4000
      );
    }
    setRequestedLeaderId(null);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('leader_id');
        return next;
      },
      { replace: true }
    );
  }, [mlsData, mlsLoading, requestedLeaderId, setSearchParams, showMessage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowMemberDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const summaryCards = mlsData?.summary
    ? [
        {
          label: 'Missing Submissions',
          count: mlsData.summary.missing,
          variant: 'danger',
          icon: XCircle
        },
        {
          label: 'Partial Submissions',
          count: mlsData.summary.partial,
          variant: 'warning',
          icon: AlertTriangle
        },
        { label: 'Late Submissions', count: mlsData.summary.late, variant: 'warning', icon: Clock },
        {
          label: 'Completed Submissions',
          count: mlsData.summary.submitted,
          variant: 'success',
          icon: CheckCircle2
        }
      ]
    : [];

  const TABS = [
    { id: 'edit', label: 'Edit Attendance', icon: Edit3 },
    { id: 'missing', label: 'Missing Leader Submissions', icon: ClipboardList }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="card flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
          <Edit3 className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
        <div>
          <h2 className="text-title-2 font-semibold text-label">Attendance Corrections</h2>
          <p className="mt-0.5 text-footnote text-secondary-label">
            Audit and fix attendance records submitted by leaders
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-pills overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-pill whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Edit Attendance (existing functionality) ── */}
      {activeTab === 'edit' && (
        <>
          <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 shadow-card dark:border-white/[0.08]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary-label" />
                <input
                  value={filters.q}
                  onChange={(e) => {
                    handleFilterChange('q', e.target.value);
                    debouncedLoad();
                    searchMembers(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                  onFocus={() => {
                    if (memberSuggestions.length) setShowMemberDropdown(true);
                  }}
                  placeholder="Search member name or membership ID..."
                  className="input h-10 w-full pl-10 pr-10"
                  autoComplete="off"
                />
                {filters.q && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...filtersRef.current, q: '' };
                      setFilters(next);
                      filtersRef.current = next;
                      setMemberSuggestions([]);
                      setShowMemberDropdown(false);
                      loadFirstPage(next);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-tertiary-label transition-colors hover:bg-system-fill hover:text-secondary-label dark:hover:bg-white/[0.06] dark:hover:text-label"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {showMemberDropdown && memberSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-lg dark:border-white/[0.08] max-h-60 overflow-y-auto">
                    {memberSuggestions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember(m)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-caption-1 hover:bg-system-fill/50 border-b border-separator/60 dark:border-white/[0.08] last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary-500/15 dark:bg-primary-500/15 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold shrink-0 text-caption-2">
                          {m.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-label truncate">{m.full_name}</p>
                          <p className="text-caption-2 text-tertiary-label">
                            {m.membership_id}
                            {m.section_name ? ` · ${m.section_name}` : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {loading && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-caption-1 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Searching…
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-3 text-footnote font-semibold text-secondary-label transition-colors hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label dark:hover:bg-white/[0.06]"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide Filters' : 'More Filters'}
                </button>
                <button
                  type="button"
                  onClick={() => load()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label transition-colors hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-tertiary-label dark:hover:bg-white/[0.06]"
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  From
                </label>
                <input
                  type="date"
                  value={filters.start_date}
                  max={filters.end_date || undefined}
                  onChange={(e) => {
                    handleFilterChange('start_date', e.target.value);
                    debouncedLoad();
                  }}
                  className="input h-9 w-full cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  To
                </label>
                <input
                  type="date"
                  value={filters.end_date}
                  min={filters.start_date || undefined}
                  onChange={(e) => {
                    handleFilterChange('end_date', e.target.value);
                    debouncedLoad();
                  }}
                  className="input h-9 w-full cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary-600 px-3 text-caption-1 font-semibold text-white shadow-card hover:bg-primary-700"
                title="Apply filters"
              >
                <Calendar className="h-3.5 w-3.5" /> Apply
              </button>
              {hasDateFilter && (
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-3 text-caption-1 font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-tertiary-label dark:hover:bg-white/[0.06]"
                  title="Clear date range"
                >
                  <X className="h-3.5 w-3.5" /> Clear dates
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                Quick range
              </span>
              {['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'].map((id) => {
                const labels = {
                  today: 'Today',
                  yesterday: 'Yesterday',
                  last7: 'Last 7 days',
                  last30: 'Last 30 days',
                  thisMonth: 'This month',
                  lastMonth: 'Last month'
                };
                const isActive = activePreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleDatePreset(id)}
                    className={`inline-flex h-7 items-center rounded-full border px-3 text-caption-1 font-semibold transition-colors ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white shadow-card'
                        : 'border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-tertiary-label dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'
                    }`}
                  >
                    {labels[id]}
                  </button>
                );
              })}
              {activePreset === 'custom' && (
                <span className="ml-1 inline-flex h-7 items-center rounded-full bg-amber-50 px-3 text-caption-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  Custom range
                </span>
              )}
            </div>

            {showFilters && (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-black/[0.06] pt-3 sm:grid-cols-4 dark:border-white/[0.08]">
                <div>
                  <label className="mb-1 block text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                    From
                  </label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="input h-9 w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                    To
                  </label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="input h-9 w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="input h-9 w-full"
                  >
                    <option value="">All</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-primary-600 px-3 text-footnote font-semibold text-white hover:bg-primary-700"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-3 text-footnote font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label dark:hover:bg-white/[0.06]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-card dark:border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
              <p className="text-caption-1 text-secondary-label">
                {loading
                  ? 'Loading…'
                  : total === 0
                    ? 'No records'
                    : `Showing ${rangeStart}–${rangeEnd} of ${total} record${total === 1 ? '' : 's'}${filters.q || hasDateFilter || filters.status ? ' (filtered)' : ''}`}
              </p>
              {(filters.q || hasDateFilter || filters.status) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-caption-1 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Clear all filters"
                >
                  <X className="h-3 w-3" /> Reset all filters
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="min-w-full divide-y divide-separator/50 text-footnote dark:divide-white/[0.06]">
                <thead className="bg-system-grouped-background/40">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.header}
                        className="px-4 py-2 text-left text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label"
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-footnote text-tertiary-label"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-tertiary-label">
                          <Users className="h-8 w-8" />
                          <p className="text-footnote font-semibold">No attendance records found</p>
                          <p className="text-caption-1">
                            {filters.q || hasDateFilter || filters.status
                              ? 'No records match the current filters.'
                              : 'Try adjusting your filters or date range.'}
                          </p>
                          {(filters.q || hasDateFilter || filters.status) && (
                            <button
                              type="button"
                              onClick={handleClearFilters}
                              className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-3 text-caption-1 font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label dark:hover:bg-white/[0.06]"
                            >
                              <X className="h-3.5 w-3.5" /> Reset all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03] [content-visibility:auto] [contain-intrinsic-size:auto_44px]"
                      >
                        {columns.map((c) => (
                          <td key={c.header} className="px-4 py-2.5 align-middle">
                            {c.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-caption-1 text-secondary-label">
                <label htmlFor="corrections-page-size" className="font-semibold">
                  Rows
                </label>
                <select
                  id="corrections-page-size"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="input h-8 text-caption-1"
                >
                  {[25, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span aria-live="polite">
                  Page {page} of {totalPages}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={loading || page <= 1}
                  aria-label="Previous page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label transition-colors hover:bg-system-grouped-background/60 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:text-tertiary-label dark:hover:bg-white/[0.06]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((p, i, arr) => (
                  <span key={p} className="inline-flex items-center gap-1">
                    {i > 0 && p - arr[i - 1] > 1 && (
                      <span className="px-1 text-caption-1 text-tertiary-label">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePageChange(p)}
                      disabled={loading}
                      aria-label={`Page ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-caption-1 font-semibold transition-colors ${
                        p === page
                          ? 'bg-primary-600 text-white shadow-card'
                          : 'border border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-tertiary-label dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={loading || page >= totalPages}
                  aria-label="Next page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background text-secondary-label transition-colors hover:bg-system-grouped-background/60 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:text-tertiary-label dark:hover:bg-white/[0.06]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {editing && (
            <EditAttendanceModal
              record={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
              }}
              showMessage={showMessage}
            />
          )}
        </>
      )}

      {/* ── Tab 2: Missing Leader Submissions ── */}
      {activeTab === 'missing' && (
        <div className="space-y-4">
          {/* Date + Service Selector */}
          <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 shadow-card dark:border-white/[0.08] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-footnote font-semibold text-label">Service details</h3>
                <p className="mt-1 text-caption-1 text-secondary-label">
                  Choose the date and service whose attendance you want to review.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] sm:items-end">
                <label className="min-w-0">
                  <span className="mb-1.5 block text-caption-1 font-semibold text-secondary-label">
                    Service date
                  </span>
                  <span className="relative block">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
                    <input
                      type="date"
                      value={mlsDate}
                      onChange={(e) => setMlsDate(e.target.value)}
                      className="input h-10 w-full cursor-pointer rounded-lg pl-9 text-footnote"
                      onClick={(e) => e.currentTarget.showPicker?.()}
                    />
                  </span>
                </label>
                <label className="min-w-0">
                  <span className="mb-1.5 block text-caption-1 font-semibold text-secondary-label">
                    Service
                  </span>
                  <span className="relative block">
                    <BarChart3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
                    <select
                      value={mlsServiceId}
                      onChange={(e) => setMlsServiceId(Number(e.target.value))}
                      className="input h-10 w-full rounded-lg pl-9 text-footnote"
                    >
                      {(mlsServices.length > 0
                        ? mlsServices
                        : [
                            { id: 1, name: 'Main' },
                            { id: 2, name: 'Midweek' }
                          ]
                      ).map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={loadMissingSubmissions}
                  disabled={mlsLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-footnote font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${mlsLoading ? 'animate-spin' : ''}`} />
                  {mlsLoading ? 'Loading…' : 'Load submissions'}
                </button>
              </div>
            </div>
          </section>

          {mlsLoading ? (
            <div className="flex items-center justify-center py-16 text-tertiary-label text-footnote">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading submissions...
            </div>
          ) : mlsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {summaryCards.map((card) => {
                  const variantMap = {
                    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  };
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 dark:border-white/[0.08]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${variantMap[card.variant] || 'bg-system-fill text-secondary-label'}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-caption-1 font-semibold text-secondary-label">
                          {card.label}
                        </span>
                      </div>
                      <p className="mt-3 text-title-2 font-semibold tabular-nums text-label">
                        {card.count}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Leaders List */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                  <div>
                    <h3 className="text-footnote font-semibold text-label">Leaders to review</h3>
                    <p className="mt-0.5 text-caption-1 text-secondary-label">
                      Open a leader&apos;s roster to record or correct attendance.
                    </p>
                  </div>
                  <span className="rounded-full bg-system-fill px-2.5 py-1 text-caption-1 font-semibold tabular-nums text-secondary-label">
                    {mlsData.leaders.filter((leader) => leader.status !== 'submitted').length}{' '}
                    pending
                  </span>
                </div>
                {mlsData.leaders.filter((l) => l.status !== 'submitted').length === 0 ? (
                  <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-10 text-center text-tertiary-label text-footnote">
                    {mlsData.leaders.length === 0
                      ? 'No leaders found for this date.'
                      : 'All leaders have submitted attendance for this date.'}
                  </div>
                ) : (
                  mlsData.leaders
                    .filter((l) => l.status !== 'submitted')
                    .map((leader) => (
                      <article
                        key={leader.leader_id}
                        className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 transition-colors hover:border-primary-500/30 dark:border-white/[0.08] dark:hover:border-primary-400/30"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-system-fill text-footnote font-semibold text-secondary-label">
                              {leader.leader_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate text-footnote font-semibold text-label">
                                  {leader.leader_name}
                                </h4>
                                <SubmissionStatusBadge status={leader.status} />
                              </div>
                              <p className="mt-1 truncate text-caption-1 text-secondary-label">
                                {leader.section_name}
                                <span className="mx-1.5">&middot;</span>
                                {leader.service_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 sm:w-[360px] sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3 text-caption-2">
                                <span className="text-secondary-label">Members recorded</span>
                                <span className="font-semibold tabular-nums text-label">
                                  {leader.recorded_members} / {leader.expected_members}
                                </span>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-system-fill">
                                <div
                                  className="h-full rounded-full bg-primary-600"
                                  style={{
                                    width: `${
                                      leader.expected_members > 0
                                        ? Math.min(
                                            100,
                                            (leader.recorded_members / leader.expected_members) *
                                              100
                                          )
                                        : 0
                                    }%`
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBulkLeader(leader)}
                              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3.5 text-caption-1 font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                            >
                              <ClipboardList className="h-4 w-4" /> Mark attendance
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                )}
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-10 text-center text-tertiary-label text-footnote">
              Select a date and service, then click "Load" to view submission status.
            </div>
          )}

          {/* Bulk Correction Modal */}
          {bulkLeader && (
            <BulkCorrectionModal
              leader={bulkLeader}
              date={mlsDate}
              serviceId={mlsServiceId}
              onClose={() => setBulkLeader(null)}
              onSaved={(count) => {
                const name = bulkLeader?.leader_name;
                setBulkLeader(null);
                showMessage?.(`Attendance saved for ${name} (${count} members).`);
                loadMissingSubmissions();
              }}
              showMessage={showMessage}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceCorrections;
