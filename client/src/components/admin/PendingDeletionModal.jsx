import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, RotateCcw, Trash2, Clock } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useModalA11y } from '../../hooks/useModalA11y';

const PendingDeletionModal = ({ onClose, onRefresh }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [action, setAction] = useState(null); // 'confirm' | 'restore' | null
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, true, onClose);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.getPendingDeletion();
      setMembers(res.data?.members || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load pending-deletion list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAll = () => {
    if (selectedIds.length === members.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(members.map((m) => m.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!action || selectedIds.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      if (action === 'confirm') {
        await adminAPI.confirmDeletion(selectedIds);
      } else if (action === 'restore') {
        await adminAPI.restoreMembers(selectedIds);
      }
      setAction(null);
      setConfirmText('');
      setSelectedIds([]);
      await load();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.error || `Failed to ${action} selected members.`);
    } finally {
      setSubmitting(false);
    }
  };

  const ready =
    selectedIds.length > 0 &&
    (action === 'restore' || (action === 'confirm' && confirmText === 'PERMANENTLY DELETE'));

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-deletion-title"
        tabIndex={-1}
        className="w-full max-w-4xl rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-modal dark:border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 id="pending-deletion-title" className="text-headline font-semibold text-label">
                Pending Permanent Deletion
              </h3>
              <p className="text-caption-1 text-secondary-label">
                Members soft-deleted more than 6 months ago. Review and confirm permanent deletion,
                or restore them.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-secondary-label hover:bg-system-fill"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <div className="py-8 text-center text-footnote text-secondary-label">Loading...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-footnote text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-700 dark:bg-emerald-900/20">
              <div className="text-footnote font-semibold text-emerald-800 dark:text-emerald-200">
                Nothing pending
              </div>
              <div className="mt-1 text-caption-1 text-emerald-700 dark:text-emerald-300">
                No members are currently awaiting permanent deletion.
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-footnote text-secondary-label">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === members.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-black/[0.12] text-violet-600 focus:ring-violet-500"
                  />
                  Select all ({members.length})
                </label>
                <span className="text-caption-1 text-secondary-label">
                  {selectedIds.length} selected
                </span>
              </div>
              <ul className="divide-y divide-separator/50 rounded-lg border border-black/[0.06] dark:divide-white/[0.06] dark:border-white/[0.08]">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-system-grouped-background/60 dark:hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleOne(m.id)}
                      className="h-4 w-4 rounded border-black/[0.12] text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-footnote font-medium text-label truncate">
                        {m.full_name}
                      </div>
                      <div className="text-caption-1 text-secondary-label truncate">
                        {m.membership_id} · {m.section_name} · {m.leader_name || '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-caption-1 font-semibold text-rose-600 dark:text-rose-300">
                        {m.days_inactive} days inactive
                      </div>
                      <div className="text-caption-1 text-secondary-label">
                        {m.attendance_count} attendance record{m.attendance_count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {!loading && members.length > 0 && (
          <div className="border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            {action === 'confirm' && (
              <div className="mb-3">
                <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-footnote text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Permanent deletion</strong> removes the member and all their
                      attendance / follow-up history. This cannot be undone. Type{' '}
                      <span className="font-mono">PERMANENTLY DELETE</span> to confirm.
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="PERMANENTLY DELETE"
                  className="w-full rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-3 py-2 text-footnote shadow-card focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-white/[0.08] dark:text-label"
                />
              </div>
            )}

            {action === 'restore' && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-footnote text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                Restore re-activates the selected member(s) and clears the deletion trail. They will
                not appear in this list again unless soft-deleted a second time.
              </div>
            )}

            {error && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-footnote text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-4 text-footnote font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label"
              >
                Close
              </button>
              {action === null && (
                <>
                  <button
                    type="button"
                    disabled={selectedIds.length === 0}
                    onClick={() => {
                      setAction('restore');
                      setConfirmText('');
                      setError('');
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-footnote font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore selected
                  </button>
                  <button
                    type="button"
                    disabled={selectedIds.length === 0}
                    onClick={() => {
                      setAction('confirm');
                      setConfirmText('');
                      setError('');
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-footnote font-semibold text-white shadow-card hover:bg-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirm permanent delete
                  </button>
                </>
              )}
              {action !== null && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAction(null);
                      setConfirmText('');
                      setError('');
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-4 text-footnote font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!ready || submitting}
                    onClick={handleSubmit}
                    className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-footnote font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50 ${action === 'confirm' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {action === 'confirm' ? (
                      <Trash2 className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {submitting
                      ? 'Working...'
                      : `${action === 'confirm' ? 'Permanently delete' : 'Restore'} ${selectedIds.length}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PendingDeletionModal;
