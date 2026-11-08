import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useToast } from '../../context/ToastContext';

const BulkDeleteModal = ({
  members,
  initialSelectedIds = [],
  currentUserMemberId,
  onClose,
  onRefresh
}) => {
  const [selectedIds, setSelectedIds] = useState(() => {
    const ownMemberId = Number(currentUserMemberId);
    return initialSelectedIds.filter((id) => !ownMemberId || Number(id) !== ownMemberId);
  });
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [archiveInstead, setArchiveInstead] = useState(false);
  const dialogRef = useRef(null);
  const { showToast } = useToast();
  useModalA11y(dialogRef, true, onClose);

  const deletableMembers = members.filter(
    (member) => !currentUserMemberId || Number(member.id) !== Number(currentUserMemberId)
  );
  const filteredMembers = deletableMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.membership_id?.toLowerCase().includes(search.toLowerCase())
  );
  const allVisibleSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedIds.includes(member.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredMembers.map((member) => member.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredMembers.map((m) => m.id)])]);
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await adminAPI.bulkSoftDelete(selectedIds, archiveInstead);
      await onRefresh();
      showToast({
        type: 'success',
        title: archiveInstead ? 'Members archived' : 'Members moved to Trash',
        message: `${res.data?.deactivated ?? selectedIds.length} member(s) updated successfully.`
      });
      onClose();
    } catch (e) {
      console.error('Bulk soft-delete failed:', e);
      setError(e.response?.data?.error || 'Failed to soft-delete selected members.');
    } finally {
      setSubmitting(false);
    }
  };

  const ready = selectedIds.length > 0 && confirmText === 'DELETE';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        tabIndex={-1}
        className="w-full max-w-3xl rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-modal dark:border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="bulk-delete-title" className="text-headline font-semibold text-label">
                Remove selected members
              </h3>
              <p className="text-caption-1 text-secondary-label">
                Review the selected members and choose whether to archive them or move them to
                Trash.
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

        <div className="max-h-[55vh] overflow-y-auto p-5">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-footnote text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Recoverable removal.</strong> Attendance and follow-up history stay intact.
                Members moved to Trash can be permanently deleted after 6 months; archived members
                are retained until restored.
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by name or member ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-3 py-2 text-footnote shadow-card focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-white/[0.08] dark:text-label"
          />

          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between bg-system-fill px-3 py-2 text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label dark:bg-white/[0.03] dark:text-tertiary-label">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-black/[0.12] text-violet-600 focus:ring-violet-500"
                />
                Select all
              </label>
              <span>
                {selectedIds.length} of {filteredMembers.length} selected
              </span>
            </div>
            <ul className="max-h-72 divide-y divide-separator/50 overflow-y-auto dark:divide-white/[0.06]">
              {filteredMembers.map((m) => (
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
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-system-fill text-xs font-semibold text-secondary-label">
                        {m.profile_picture ? (
                          <img
                            src={m.profile_picture}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (m.full_name || '?')
                            .split(/\s+/)
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-footnote font-medium text-label truncate">
                          {m.full_name}
                        </div>
                        <div className="text-caption-1 text-secondary-label truncate">
                          {m.membership_id} · {m.section_name || '—'}
                        </div>
                        <div className="mt-0.5 text-caption-2 text-tertiary-label">
                          Last attended: {m.last_attendance_date || 'Never'}
                          {m.days_since_last_attendance !== null &&
                          m.days_since_last_attendance !== undefined
                            ? ` · ${m.days_since_last_attendance} days ago`
                            : m.last_attendance_date
                              ? ''
                              : ' · Never attended'}
                          {` · ${Number(m.total_attendance_count) || 0} total`}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {filteredMembers.length === 0 && (
                <li className="px-3 py-6 text-center text-footnote text-secondary-label">
                  No members match your search.
                </li>
              )}
            </ul>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.06] p-3 text-footnote dark:border-white/[0.08]">
            <input
              type="checkbox"
              checked={archiveInstead}
              onChange={(event) => setArchiveInstead(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-black/[0.12] text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="flex items-center gap-1.5 font-semibold text-label">
                <Archive className="h-4 w-4 text-secondary-label" /> Archive instead
              </span>
              <span className="mt-0.5 block text-caption-1 text-secondary-label">
                Keep these members recoverable in Trash and exclude them from permanent deletion.
              </span>
            </span>
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-footnote text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-black/[0.06] bg-system-fill p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <label className="block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label mb-1">
              Type <span className="font-mono text-rose-600 dark:text-rose-300">DELETE</span> to
              confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-3 py-2 text-footnote shadow-card focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-white/[0.08] dark:text-label"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-black/[0.06] bg-secondary-system-grouped-background px-4 text-footnote font-semibold text-secondary-label hover:bg-system-grouped-background/60 dark:border-white/[0.08] dark:text-label"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={handleDelete}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-footnote font-semibold text-white shadow-card transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {submitting
              ? archiveInstead
                ? 'Archiving...'
                : 'Moving to Trash...'
              : archiveInstead
                ? `Archive ${selectedIds.length}`
                : `Move ${selectedIds.length} to Trash`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkDeleteModal;
