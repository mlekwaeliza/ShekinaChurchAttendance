import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, AlertTriangle, Trash2 } from 'lucide-react';
import { adminAPI } from '../../services/api';

const BulkDeleteModal = ({ members, initialSelectedIds = [], onClose, onRefresh }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const filteredMembers = members.filter(m =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.membership_id?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map(m => m.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bulk Soft-Delete Members</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Members will be hidden immediately. They become eligible for permanent deletion after 6 months.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Heads up.</strong> This is a <em>soft delete</em> — members disappear from lists immediately, and any attendance / follow-ups stay intact. After 6 months of inactivity, they appear in the Pending Deletion list for permanent removal.
              </div>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by name or member ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredMembers.length && filteredMembers.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                Select all
              </label>
              <span>{selectedIds.length} of {filteredMembers.length} selected</span>
            </div>
            <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-700">
              {filteredMembers.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleOne(m.id)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{m.full_name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {m.membership_id} · {m.section_name || '—'}
                    </div>
                  </div>
                </li>
              ))}
              {filteredMembers.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No members match your search.</li>
              )}
            </ul>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
              Type <span className="font-mono text-rose-600 dark:text-rose-300">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={handleDelete}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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
