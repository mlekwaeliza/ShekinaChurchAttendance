import React, { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Trash2, UserPlus } from 'lucide-react';
import { leaderAPI } from '../../services/api';

const emptyForm = { cell_id: '', membership_id: '', full_name: '', phone: '', email: '', address: '' };

const HomeCellMembers = () => {
  const [cells, setCells] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadHomeCells = async () => {
    setLoading(true);
    try {
      const response = await leaderAPI.getHomeCells();
      const nextCells = response.data?.cells || [];
      setCells(nextCells);
      setMembers(response.data?.members || []);
      setForm((current) => ({ ...current, cell_id: current.cell_id || nextCells[0]?.id || '' }));
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to load home cells.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeCells();
  }, []);

  const groupedMembers = useMemo(() => cells.map((cell) => ({
    ...cell,
    members: members.filter((member) => Number(member.cell_id) === Number(cell.id)),
  })), [cells, members]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await leaderAPI.createHomeCellMember({
        ...form,
        cell_id: Number(form.cell_id),
      });
      setMessage('Home cell member added.');
      setForm((current) => ({ ...emptyForm, cell_id: current.cell_id }));
      await loadHomeCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to add home cell member.');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (id) => {
    setSaving(true);
    setMessage('');
    try {
      await leaderAPI.deleteHomeCellMember(id);
      setMessage('Home cell member removed.');
      await loadHomeCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to remove member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          {message}
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-6 text-white shadow-xl shadow-emerald-500/20">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Home Cell Members</h2>
            <p className="text-sm text-white/80">Manage the members in your assigned Tuesday home cells.</p>
          </div>
        </div>
      </div>

      {cells.length > 0 && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Cell Member</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <select value={form.cell_id} onChange={(event) => updateField('cell_id', event.target.value)} className="select" required>
              {cells.map((cell) => <option key={cell.id} value={cell.id}>{cell.name}</option>)}
            </select>
            <input value={form.membership_id} onChange={(event) => updateField('membership_id', event.target.value)} className="input" placeholder="Church member ID (optional)" />
            <input value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} className="input" placeholder="Full name" required />
            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className="input" placeholder="Phone" />
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="input" placeholder="Email" />
            <input value={form.address} onChange={(event) => updateField('address', event.target.value)} className="input" placeholder="Address" />
          </div>
          <button disabled={saving} type="submit" className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {saving ? 'Saving...' : 'Add Member'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : cells.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          You have not been assigned to a home cell yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {groupedMembers.map((cell) => (
            <section key={cell.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{cell.name}</h3>
              <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">{cell.members.length} members</p>
              <div className="space-y-2">
                {cell.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{member.full_name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {member.church_membership_id ? `Church ID: ${member.church_membership_id}` : member.phone || 'No phone'}
                      </p>
                    </div>
                    <button disabled={saving} onClick={() => removeMember(member.id)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-500 disabled:opacity-60 dark:hover:bg-slate-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {cell.members.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No members added yet.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeCellMembers;
