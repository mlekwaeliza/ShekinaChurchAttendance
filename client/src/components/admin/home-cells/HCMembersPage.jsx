import React, { useMemo, useState } from 'react';
import { Search, Trash2, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminAPI } from '../../../services/api';

const BADGE = {
  church: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  cell: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
};

const HCMembersPage = ({ cells = [], onRefresh }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cellFilter, setCellFilter] = useState('all');
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState('');
  const [transferTarget, setTransferTarget] = useState({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const toast = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const allMembers = useMemo(() =>
    cells.flatMap(c => (c.members || []).map(m => ({ ...m, cellName: c.name }))),
    [cells]
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return allMembers.filter(m => {
      if (typeFilter === 'church' && !m.church_member_id) return false;
      if (typeFilter === 'cell' && m.church_member_id) return false;
      if (cellFilter !== 'all' && String(m.cell_id) !== cellFilter) return false;
      if (!term) return true;
      return (
        m.full_name?.toLowerCase().includes(term) ||
        m.phone?.includes(term) ||
        m.church_membership_id?.toLowerCase().includes(term) ||
        m.cellName?.toLowerCase().includes(term) ||
        m.church_section_name?.toLowerCase().includes(term)
      );
    });
  }, [allMembers, search, typeFilter, cellFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.full_name} from their home cell?`)) return;
    setSaving(`remove-${member.id}`);
    try {
      await adminAPI.deleteHomeCellMember(member.id);
      toast(`${member.full_name} removed`);
      onRefresh();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to remove');
    } finally { setSaving(null); }
  };

  const transferMember = async (member) => {
    const newCellId = transferTarget[member.id];
    if (!newCellId || Number(newCellId) === Number(member.cell_id)) return;
    setSaving(`transfer-${member.id}`);
    try {
      await adminAPI.transferHomeCellMember(member.id, Number(newCellId));
      toast(`${member.full_name} transferred`);
      setTransferTarget(t => ({ ...t, [member.id]: '' }));
      onRefresh();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to transfer');
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, phone, ID, section..."
            className="input pl-9"
          />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="select w-auto">
          <option value="all">All Types</option>
          <option value="church">Church Members</option>
          <option value="cell">Cell-Only</option>
        </select>
        <select value={cellFilter} onChange={(e) => { setCellFilter(e.target.value); setPage(1); }} className="select w-auto">
          <option value="all">All Cells</option>
          {cells.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                {['Name', 'Home Cell', 'Church ID', 'Phone', 'Section', 'Type', 'Transfer To', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {paged.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{m.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{m.cellName}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.church_membership_id || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.church_section_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.church_member_id ? BADGE.church : BADGE.cell}`}>
                      {m.church_member_id ? 'Church' : 'Cell-Only'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={transferTarget[m.id] || ''}
                        onChange={(e) => setTransferTarget(t => ({ ...t, [m.id]: e.target.value }))}
                        className="select h-7 py-0 text-xs w-32"
                      >
                        <option value="">Move to...</option>
                        {cells.filter(c => Number(c.id) !== Number(m.cell_id)).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => transferMember(m)}
                        disabled={!transferTarget[m.id] || saving === `transfer-${m.id}`}
                        title="Transfer"
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-30"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeMember(m)} disabled={saving === `remove-${m.id}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    {search || typeFilter !== 'all' || cellFilter !== 'all' ? 'No members match your filters.' : 'No members assigned to any cell yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">{filtered.length} members · page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HCMembersPage;
