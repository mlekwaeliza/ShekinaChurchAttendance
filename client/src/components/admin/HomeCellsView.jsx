import React, { useEffect, useMemo, useState } from 'react';
import { Home, Plus, Save, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

const emptyCellMember = { cell_id: '', membership_id: '', full_name: '', phone: '', email: '', address: '' };

const HomeCellsView = ({ leaders = [], allMembers = [] }) => {
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCellId, setSavingCellId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [newCellName, setNewCellName] = useState('');
  const [cellMemberForm, setCellMemberForm] = useState(emptyCellMember);

  const loadCells = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getHomeCells();
      const nextCells = response.data || [];
      setCells(nextCells);
      setCellMemberForm((current) => ({ ...current, cell_id: current.cell_id || nextCells[0]?.id || '' }));
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to load home cells.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCells();
  }, []);

  const allCellMembers = useMemo(() => cells.flatMap((cell) => cell.members || []), [cells]);
  const churchCellMembers = allCellMembers.filter((member) => member.church_member_id);
  const cellOnlyMembers = allCellMembers.filter((member) => !member.church_member_id);

  const filteredLeaders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allMembers
      .filter((member) => !term
        || member.full_name?.toLowerCase().includes(term)
        || member.section_name?.toLowerCase().includes(term))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allMembers, search]);

  const selectedIdsFor = (cell) => new Set((cell.leaders || []).map((leader) => Number(leader.leader_id)));

  const toggleLeader = (cellId, leaderId) => {
    setCells((current) => current.map((cell) => {
      if (Number(cell.id) !== Number(cellId)) return cell;
      const selected = selectedIdsFor(cell);
      if (selected.has(Number(leaderId))) {
        return { ...cell, leaders: cell.leaders.filter((leader) => Number(leader.leader_id) !== Number(leaderId)) };
      }
      const leader = allMembers.find((item) => Number(item.id) === Number(leaderId));
      return {
        ...cell,
        leaders: [
          ...(cell.leaders || []),
          {
            cell_id: cell.id,
            leader_id: leader.id,
            full_name: leader.full_name,
            section_name: leader.section_name,
          },
        ],
      };
    }));
  };

  const saveCell = async (cell) => {
    setSavingCellId(cell.id);
    setMessage('');
    try {
      await adminAPI.updateHomeCellLeaders(cell.id, (cell.leaders || []).map((leader) => leader.leader_id));
      setMessage(`${cell.name} leaders updated.`);
      await loadCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save home cell leaders.');
    } finally {
      setSavingCellId(null);
    }
  };

  const createCell = async (event) => {
    event.preventDefault();
    const name = newCellName.trim();
    if (!name) return;
    setMessage('');
    try {
      await adminAPI.createHomeCell({ name });
      setNewCellName('');
      setMessage(`${name} created.`);
      await loadCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to create home cell.');
    }
  };

  const updateCellMemberForm = (key, value) => {
    if (key === 'full_name') value = capitalizeName(value);
    if (key === 'phone') value = handlePhoneChange(value);
    setCellMemberForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'membership_id') {
        const member = allMembers.find((item) => item.membership_id === value);
        if (member) {
          next.full_name = member.full_name || '';
          next.phone = member.phone || '';
          next.email = member.email || '';
          next.address = member.address || '';
        }
      }
      return next;
    });
  };

  const addCellMember = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      await adminAPI.createHomeCellMember({
        ...cellMemberForm,
        cell_id: Number(cellMemberForm.cell_id),
      });
      setMessage('Home cell member assigned.');
      setCellMemberForm((current) => ({ ...emptyCellMember, cell_id: current.cell_id }));
      await loadCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to assign home cell member.');
    }
  };

  const removeCellMember = async (member) => {
    setMessage('');
    try {
      await adminAPI.deleteHomeCellMember(member.id);
      setMessage(`${member.full_name} removed from home cells.`);
      await loadCells();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to remove home cell member.');
    }
  };

  const MemberSheet = ({ title, members, description }) => (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Cell</th>
              <th className="py-2 pr-4">Church ID</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Church Section</th>
              <th className="w-12 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-slate-50 text-sm dark:border-slate-700/50">
                <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{member.full_name}</td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{member.cell_name}</td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{member.church_membership_id || '-'}</td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{member.phone || '-'}</td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{member.church_section_name || '-'}</td>
                <td className="py-3 text-right">
                  <button onClick={() => removeCellMember(member)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No members in this sheet yet.
          </div>
        )}
      </div>
    </section>
  );

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
            <h2 className="text-xl font-bold">Home Cells</h2>
            <p className="text-sm text-white/80">Create cells, assign leaders, and organize church members separately from cell-only members.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form onSubmit={createCell} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Home Cell</h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={newCellName} onChange={(event) => setNewCellName(event.target.value)} className="input" placeholder="Home Cell 6" />
            <button className="btn-primary" type="submit">Create</button>
          </div>
        </form>

        <form onSubmit={addCellMember} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Assign Cell Member</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select required value={cellMemberForm.cell_id} onChange={(event) => updateCellMemberForm('cell_id', event.target.value)} className="select">
              {cells.map((cell) => <option key={cell.id} value={cell.id}>{cell.name}</option>)}
            </select>
            <input
              list="church-members"
              value={cellMemberForm.membership_id}
              onChange={(event) => updateCellMemberForm('membership_id', event.target.value)}
              className="input"
              placeholder="Church member ID (optional)"
            />
            <datalist id="church-members">
              {allMembers.map((member) => (
                <option key={member.id} value={member.membership_id}>{member.full_name}</option>
              ))}
            </datalist>
            <input required value={cellMemberForm.full_name} onChange={(event) => updateCellMemberForm('full_name', event.target.value)}
              onPaste={e => { e.preventDefault(); updateCellMemberForm('full_name', capitalizeName(e.clipboardData.getData('text'))); }}
              className="input" placeholder="Full name" />
            <input value={cellMemberForm.phone} onChange={(event) => updateCellMemberForm('phone', event.target.value)} className="input" placeholder="Phone" />
            <input type="email" value={cellMemberForm.email} onChange={(event) => updateCellMemberForm('email', event.target.value)} className="input" placeholder="Email" />
            <input value={cellMemberForm.address} onChange={(event) => updateCellMemberForm('address', event.target.value)} className="input md:col-span-2" placeholder="Address" />
          </div>
          <button className="mt-4 btn-primary" type="submit">Assign Member</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members by name or section..."
            className="input pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {cells.map((cell) => {
            const selected = selectedIdsFor(cell);
            return (
              <section key={cell.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{cell.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {(cell.members || []).length} members &middot; {selected.size} assigned
                    </p>
                  </div>
                  <button
                    onClick={() => saveCell(cell)}
                    disabled={savingCellId === cell.id}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingCellId === cell.id ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredLeaders.map((leader) => (
                    <label
                      key={leader.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900/30"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(Number(leader.id))}
                        onChange={() => toggleLeader(cell.id, leader.id)}
                        className="h-4 w-4"
                      />
                      <Users className="h-4 w-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{leader.full_name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{leader.section_name}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <MemberSheet
          title="Church Members In Cells"
          description="These people already exist in the church members list and are also assigned to a home cell."
          members={churchCellMembers}
        />
        <MemberSheet
          title="Cell-Only Members"
          description="These people belong to a home cell but are not registered as church members yet."
          members={cellOnlyMembers}
        />
      </div>
    </div>
  );
};

export default HomeCellsView;
