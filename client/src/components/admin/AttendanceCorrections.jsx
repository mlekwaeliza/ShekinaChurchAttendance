import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  useModalA11y(modalRef, true, onClose);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reason, setReason] = useState(CORRECTION_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataInfo, setDataInfo] = useState(null);

  useEffect(() => {
    if (!leader) return;
    setLoading(true);
    adminAPI
      .getLeaderMembers(leader.leader_id, date, serviceId)
      .then((res) => {
        setMembers(res.data.members || []);
        setDataInfo(res.data);
      })
      .catch(() => showMessage?.('Failed to load members.', 4000))
      .finally(() => setLoading(false));
  }, [leader, date, serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) => m.full_name?.toLowerCase().includes(q) || m.membership_id?.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const recordedCount = members.filter((m) => m.status).length;
  const expectedCount = members.length;
  const allHaveStatus = members.every((m) => m.status);
  const summary = useMemo(() => {
    const p = members.filter((m) => m.status === 'present').length;
    const a = members.filter((m) => m.status === 'absent').length;
    const e = members.filter((m) => m.status === 'excused').length;
    return { present: p, absent: a, excused: e, total: p + a + e };
  }, [members]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMembers.map((m) => m.member_id)));
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
      showMessage?.(err.response?.data?.error || 'Failed to save attendance.', 4000);
    } finally {
      setSaving(false);
    }
  };

  if (!leader) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-secondary-system-grouped-background shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/[0.06] bg-secondary-system-grouped-background px-6 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-subheadline font-semibold text-label">
                Mark Attendance — {leader.leader_name}
              </h2>
              <p className="text-caption-1 text-secondary-label">
                {leader.section_name} &middot; {date} &middot;{' '}
                {dataInfo?.leader?.section_name || ''}
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

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-tertiary-label text-footnote">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Loading members...
            </div>
          ) : (
            <>
              {/* Progress + Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl bg-system-grouped-background/30 p-4">
                  <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label mb-2">
                    Attendance Progress
                  </p>
                  <div className="w-full h-3 bg-system-gray-4 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${expectedCount > 0 ? (recordedCount / expectedCount) * 100 : 0}%`
                      }}
                    />
                  </div>
                  <p className="text-caption-1 text-secondary-label mt-1.5 font-semibold">
                    {recordedCount} / {expectedCount} members recorded
                    {recordedCount < expectedCount && (
                      <span className="text-amber-600 ml-1">
                        — {expectedCount - recordedCount} remaining
                      </span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-system-grouped-background/30 p-4">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-lg font-semibold text-emerald-600">{summary.present}</p>
                      <p className="text-caption-2 uppercase text-tertiary-label">Present</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-rose-600">{summary.absent}</p>
                      <p className="text-caption-2 uppercase text-tertiary-label">Absent</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-amber-600">{summary.excused}</p>
                      <p className="text-caption-2 uppercase text-tertiary-label">Excused</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-label">{summary.total}</p>
                      <p className="text-caption-2 uppercase text-tertiary-label">Total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search + Bulk Actions */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary-label" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="input h-9 w-full pl-9 text-caption-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption-2 text-tertiary-label font-semibold">
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-caption-2 font-semibold text-primary-700 dark:text-primary-300 hover:underline"
                  >
                    {selectedIds.size === filteredMembers.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <div className="w-px h-5 bg-system-gray-4" />
                  {[
                    {
                      key: 'present',
                      label: 'Present',
                      icon: CheckCircle2,
                      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
                    },
                    {
                      key: 'absent',
                      label: 'Absent',
                      icon: XCircle,
                      cls: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800'
                    },
                    {
                      key: 'excused',
                      label: 'Excused',
                      icon: HelpCircle,
                      cls: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800'
                    }
                  ].map((act) => {
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.key}
                        type="button"
                        onClick={() => bulkSetStatus(act.key)}
                        disabled={selectedIds.size === 0}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-caption-2 font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${act.cls}`}
                      >
                        <Icon className="w-3 h-3" />
                        {act.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Members Table */}
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
                <div className="max-h-[320px] overflow-x-auto overflow-y-auto">
                  <table className="min-w-[600px] text-caption-1">
                    <thead className="bg-system-grouped-background/40 sticky top-0">
                      <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                        <th className="w-10 px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={
                              filteredMembers.length > 0 &&
                              selectedIds.size === filteredMembers.length
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-black/[0.12]"
                          />
                        </th>
                        <th className="px-3 py-2 text-left text-caption-2 font-semibold uppercase text-secondary-label">
                          Member
                        </th>
                        <th className="px-3 py-2 text-left text-caption-2 font-semibold uppercase text-secondary-label">
                          Membership ID
                        </th>
                        <th className="px-3 py-2 text-center text-caption-2 font-semibold uppercase text-secondary-label">
                          Current Status
                        </th>
                        <th className="px-3 py-2 text-center text-caption-2 font-semibold uppercase text-secondary-label">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator/50 dark:divide-white/[0.06]">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-tertiary-label">
                            No members found.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((m) => (
                          <tr
                            key={m.member_id}
                            className={`hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03] [content-visibility:auto] [contain-intrinsic-size:auto_44px] ${m.status ? 'bg-system-fill/30' : 'bg-amber-50/20 dark:bg-amber-900/5'}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(m.member_id)}
                                onChange={() => toggleSelect(m.member_id)}
                                className="rounded border-black/[0.12]"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-label whitespace-nowrap">
                              {m.full_name}
                            </td>
                            <td className="px-3 py-2 font-mono text-tertiary-label">
                              {m.membership_id || '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {m.status ? (
                                <StatusBadge status={m.status} />
                              ) : (
                                <span className="text-caption-2 text-amber-600 font-semibold">
                                  Not set
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="inline-flex items-center gap-1 rounded-lg bg-system-fill p-0.5">
                                {Object.entries(STATUS_META).map(([key, meta]) => {
                                  const Icon = meta.icon;
                                  const active = m.status === key;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setMemberStatus(m.member_id, key)}
                                      className={`p-1 rounded-md transition-all ${active ? (key === 'present' ? 'bg-emerald-500 text-white' : key === 'absent' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white') : 'text-tertiary-label hover:text-secondary-label dark:hover:text-tertiary-label'}`}
                                      title={meta.label}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Correction Reason */}
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Administrative Correction Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input h-9 w-full max-w-xs text-caption-1"
                >
                  {CORRECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-caption-2 text-tertiary-label mt-1">
                  This reason will be logged in the audit trail for every corrected record.
                </p>
              </div>

              {/* Audit Summary */}
              <div className="rounded-xl bg-primary-500/10 dark:bg-primary-500/[0.07] border border-primary-500/20 dark:border-primary-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-primary-600" />
                  <span className="text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
                    Correction Audit
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-caption-2 text-primary-700 dark:text-primary-300">
                  <div>
                    <span className="text-primary-400">Original Leader:</span>{' '}
                    <span className="font-semibold">{leader.leader_name}</span>
                  </div>
                  <div>
                    <span className="text-primary-400">Correction Reason:</span>{' '}
                    <span className="font-semibold">{reason}</span>
                  </div>
                  <div>
                    <span className="text-primary-400">Records:</span>{' '}
                    <span className="font-semibold">{summary.total} members</span>
                  </div>
                  <div>
                    <span className="text-primary-400">Date:</span>{' '}
                    <span className="font-semibold">{date}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-black/[0.06] bg-secondary-system-grouped-background px-6 py-4 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-4 py-2 text-footnote font-semibold text-secondary-label transition-colors hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label dark:hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !allHaveStatus || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-footnote font-semibold text-white shadow-card transition-all hover:bg-primary-700 disabled:opacity-50"
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
          <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-4 shadow-card dark:border-white/[0.08]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-tertiary-label" />
                <input
                  type="date"
                  value={mlsDate}
                  onChange={(e) => setMlsDate(e.target.value)}
                  className="input h-9 text-caption-1 cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-tertiary-label" />
                <select
                  value={mlsServiceId}
                  onChange={(e) => setMlsServiceId(Number(e.target.value))}
                  className="input h-9 text-caption-1"
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
              </div>
              <button
                type="button"
                onClick={loadMissingSubmissions}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 h-9 text-caption-1 font-semibold text-white shadow-card hover:bg-primary-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${mlsLoading ? 'animate-spin' : ''}`} /> Load
              </button>
            </div>
          </div>

          {mlsLoading ? (
            <div className="flex items-center justify-center py-16 text-tertiary-label text-footnote">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading submissions...
            </div>
          ) : mlsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map((card) => {
                  const variantMap = {
                    danger:
                      'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/10 dark:border-rose-800 dark:text-rose-300',
                    warning:
                      'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-300',
                    success:
                      'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-300'
                  };
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className={`rounded-xl border p-4 ${variantMap[card.variant] || 'bg-system-fill border-black/[0.06] text-secondary-label'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] opacity-70">
                          {card.label}
                        </span>
                        <Icon className="w-4 h-4 opacity-60" />
                      </div>
                      <p className="text-2xl font-semibold">{card.count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Leaders List */}
              <div className="space-y-2">
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
                      <div
                        key={leader.leader_id}
                        className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-secondary-system-grouped-background p-4 shadow-card hover:shadow-card transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/15 dark:bg-primary-500/15 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold shrink-0">
                              {leader.leader_name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-footnote font-semibold text-label truncate">
                                  {leader.leader_name}
                                </h4>
                                <SubmissionStatusBadge status={leader.status} />
                              </div>
                              <p className="text-caption-1 text-secondary-label mt-0.5">
                                {leader.section_name}
                                <span className="mx-1.5">&middot;</span>
                                {leader.service_name}
                                <span className="mx-1.5">&middot;</span>
                                Expected:{' '}
                                <span className="font-semibold text-secondary-label">
                                  {leader.expected_members}
                                </span>
                                <span className="mx-1.5">/</span>
                                Recorded:{' '}
                                <span
                                  className={`font-semibold ${leader.recorded_members > 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                                >
                                  {leader.recorded_members}
                                </span>
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBulkLeader(leader)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3.5 py-2 text-caption-1 font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50 shrink-0"
                          >
                            <ClipboardList className="w-3.5 h-3.5" /> Mark Attendance
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
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
