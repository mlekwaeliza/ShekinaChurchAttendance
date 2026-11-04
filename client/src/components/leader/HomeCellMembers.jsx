import React, { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Trash2, UserPlus } from 'lucide-react';
import { leaderAPI } from '../../services/api';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

const emptyForm = {
  cell_id: '',
  membership_id: '',
  full_name: '',
  phone: '',
  email: '',
  address: ''
};

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

  const groupedMembers = useMemo(
    () =>
      cells.map((cell) => ({
        ...cell,
        members: members.filter((member) => Number(member.cell_id) === Number(cell.id))
      })),
    [cells, members]
  );

  const updateField = (key, value) => {
    if (key === 'full_name') value = capitalizeName(value);
    if (key === 'phone') value = handlePhoneChange(value);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await leaderAPI.createHomeCellMember({
        ...form,
        cell_id: Number(form.cell_id)
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
        <div className="rounded-xl bg-system-green/10 px-4 py-3 text-footnote font-medium text-emerald-700 dark:text-system-green">
          {message}
        </div>
      )}

      <section className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-system-green/15">
            <Home className="h-5 w-5 text-emerald-700 dark:text-system-green" />
          </div>
          <div>
            <h2 className="text-title-2 font-semibold text-label">Home Cell Members</h2>
            <p className="text-footnote text-secondary-label">
              Manage the members in your assigned Tuesday home cells.
            </p>
          </div>
        </div>
      </section>

      {cells.length > 0 && (
        <form onSubmit={handleSubmit} className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-700 dark:text-system-green" />
            <h3 className="text-headline font-semibold text-label">Add Cell Member</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <select
              value={form.cell_id}
              onChange={(event) => updateField('cell_id', event.target.value)}
              className="select"
              required
            >
              {cells.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  {cell.name}
                </option>
              ))}
            </select>
            <input
              value={form.membership_id}
              onChange={(event) => updateField('membership_id', event.target.value)}
              className="input"
              placeholder="Church member ID (optional)"
            />
            <input
              value={form.full_name}
              onChange={(event) => updateField('full_name', event.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                updateField('full_name', capitalizeName(e.clipboardData.getData('text')));
              }}
              className="input"
              placeholder="Full name"
              required
            />
            <input
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              className="input"
              placeholder="Phone"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="input"
              placeholder="Email"
            />
            <input
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              className="input"
              placeholder="Address"
            />
          </div>
          <button
            disabled={saving}
            type="submit"
            className="btn-primary mt-4 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving...' : 'Add Member'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : cells.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator/70 p-10 text-center text-footnote text-secondary-label dark:border-white/[0.12]">
          You have not been assigned to a home cell yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {groupedMembers.map((cell) => (
            <section key={cell.id} className="card p-5">
              <h3 className="text-headline font-semibold text-label">{cell.name}</h3>
              <p className="mb-4 mt-1 text-footnote text-secondary-label">
                {cell.members.length} members
              </p>
              <div className="space-y-2">
                {cell.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-system-grouped-background/70 p-3 dark:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-footnote font-semibold text-label">
                        {member.full_name}
                      </p>
                      <p className="truncate text-caption-1 text-secondary-label">
                        {member.church_membership_id
                          ? `Church ID: ${member.church_membership_id}`
                          : member.phone || 'No phone'}
                      </p>
                    </div>
                    <button
                      disabled={saving}
                      onClick={() => removeMember(member.id)}
                      aria-label={`Remove ${member.full_name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-tertiary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 disabled:opacity-60 dark:hover:text-system-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {cell.members.length === 0 && (
                  <div className="rounded-xl border border-dashed border-separator/70 p-5 text-center text-footnote text-secondary-label dark:border-white/[0.12]">
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
