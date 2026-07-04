import React, { useEffect, useState } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { adminAPI } from '../../../services/api';
import { handlePhoneChange, capitalizeName } from '../../../utils/phone';

const empty = { cell_id: '', membership_id: '', full_name: '', phone: '', email: '', address: '' };

const HCAddMemberModal = ({ isOpen, cells = [], allMembers = [], defaultCellId, onClose, onSaved }) => {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({ ...empty, cell_id: defaultCellId || cells[0]?.id || '' });
      setError('');
    }
  }, [isOpen, defaultCellId, cells]);

  if (!isOpen) return null;

  const update = (key, value) => {
    if (key === 'full_name') value = capitalizeName(value);
    if (key === 'phone') value = handlePhoneChange(value);
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === 'membership_id') {
        const m = allMembers.find(x => x.membership_id === value);
        if (m) {
          next.full_name = m.full_name || '';
          next.phone = m.phone || '';
          next.email = m.email || '';
          next.address = m.address || '';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    if (!form.cell_id) { setError('Please select a home cell'); return; }
    setSaving(true); setError('');
    try {
      await adminAPI.createHomeCellMember({ ...form, cell_id: Number(form.cell_id) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign member');
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
              <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Assign Cell Member</h2>
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
              Home Cell <span className="text-rose-500">*</span>
            </label>
            <select
              className="select"
              value={form.cell_id}
              onChange={(e) => update('cell_id', e.target.value)}
              required
            >
              <option value="">Select a cell...</option>
              {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Church Member ID <span className="text-slate-400">(optional — auto-fills details)</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                list="hc-church-members"
                className="input pl-9"
                placeholder="e.g. SHK-001"
                value={form.membership_id}
                onChange={(e) => update('membership_id', e.target.value)}
              />
              <datalist id="hc-church-members">
                {allMembers.map(m => <option key={m.id} value={m.membership_id}>{m.full_name}</option>)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                className="input"
                placeholder="Full Name"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                onPaste={(e) => { e.preventDefault(); update('full_name', capitalizeName(e.clipboardData.getData('text'))); }}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phone</label>
              <input className="input" placeholder="+254 7..." value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</label>
              <input type="email" className="input" placeholder="email@example.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Address</label>
              <input className="input" placeholder="Physical address" value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Assigning...' : 'Assign Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HCAddMemberModal;
