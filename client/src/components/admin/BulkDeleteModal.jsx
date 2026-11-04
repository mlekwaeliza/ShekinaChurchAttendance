import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useModalA11y } from '../../hooks/useModalA11y';

const BulkDeleteModal = ({ members, initialSelectedIds = [], onClose, onRefresh }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, true, onClose);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const filteredMembers = members.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.membership_id?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
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
      const res = await adminAPI.bulkSoftDelete(selectedIds);
      onRefresh();
      onClose(res.data);
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
                Bulk Soft-Delete Members
              </h3>
              <p className="text-caption-1 text-secondary-label">
                Members will be hidden immediately. They become eligible for permanent deletion
                after 6 months.
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
                <strong>Heads up.</strong> This is a <em>soft delete</em> — members disappear from
                lists immediately, and any attendance / follow-ups stay intact. After 6 months of
                inactivity, they appear in the Pending Deletion list for permanent removal.
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
                  checked={
                    selectedIds.length === filteredMembers.length && filteredMembers.length > 0
                  }
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
                    <div className="text-footnote font-medium text-label truncate">
                      {m.full_name}
                    </div>
                    <div className="text-caption-1 text-secondary-label truncate">
                      {m.membership_id} · {m.section_name || '—'}
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
            {submitting ? 'Deactivating...' : `Soft-delete ${selectedIds.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkDeleteModal;
