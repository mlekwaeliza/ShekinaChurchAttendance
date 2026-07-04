import React, { useEffect, useState } from 'react';
import { X, Home, MapPin, Users, Calendar } from 'lucide-react';
import { adminAPI } from '../../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HCCreateModal = ({ isOpen, cell, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', meeting_day: '', location: '', max_capacity: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(cell
        ? { name: cell.name || '', meeting_day: cell.meeting_day || '', location: cell.location || '', max_capacity: cell.max_capacity || '' }
        : { name: '', meeting_day: '', location: '', max_capacity: '' }
      );
      setError('');
    }
  }, [isOpen, cell]);

  if (!isOpen) return null;

  const isEdit = Boolean(cell);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('Cell name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name,
        meeting_day: form.meeting_day || null,
        location: form.location.trim() || null,
        max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
      };
      if (isEdit) {
        await adminAPI.updateHomeCell(cell.id, payload);
      } else {
        await adminAPI.createHomeCell(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save home cell');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isEdit ? 'Edit Home Cell' : 'Create Home Cell'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Cell Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="e.g. Home Cell 7"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Meeting Day
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  className="select pl-9"
                  value={form.meeting_day}
                  onChange={(e) => setForm(f => ({ ...f, meeting_day: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Max Capacity
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="input pl-9"
                  placeholder="e.g. 20"
                  value={form.max_capacity}
                  onChange={(e) => setForm(f => ({ ...f, max_capacity: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Location / Venue
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="e.g. 12 Olive Street, Westlands"
                value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Cell'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HCCreateModal;
