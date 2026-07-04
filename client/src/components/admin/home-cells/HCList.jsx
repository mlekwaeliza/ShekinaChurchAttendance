import React, { useMemo, useState } from 'react';
import {
  ChevronRight, Search, Filter, Trash2, Edit2, UserPlus, X,
  Users, MapPin, Calendar, CheckCircle, XCircle, ChevronLeft,
  Save, UserCheck,
} from 'lucide-react';
import { adminAPI } from '../../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CapacityBar = ({ count, max }) => {
  if (!max) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.min(100, Math.round((count / max) * 100));
  const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{count}/{max}</span>
    </div>
  );
};

/* ── Cell Profile Slide-over ─────────────────────────────── */
const CellProfile = ({ cell, cells, allLeaders, onClose, onRefresh, onAddMember }) => {
  const [profileTab, setProfileTab] = useState('overview');
  const [saving, setSaving] = useState(null); // 'leaders' | 'remove-{id}' | 'transfer-{id}'
  const [message, setMessage] = useState('');
  const [localLeaders, setLocalLeaders] = useState(() => new Set((cell.leaders || []).map(l => Number(l.leader_id))));
  const [transferTarget, setTransferTarget] = useState({});
  const [leaderSearch, setLeaderSearch] = useState('');

  const toast = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const members = cell.members || [];
  const selectedLeaderObjs = (cell.leaders || []);

  const saveLeaders = async () => {
    setSaving('leaders');
    try {
      await adminAPI.updateHomeCellLeaders(cell.id, [...localLeaders]);
      toast('Leaders updated');
      onRefresh();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to update leaders');
    } finally { setSaving(null); }
  };

  const removeMember = async (member) => {
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
    if (!newCellId || Number(newCellId) === Number(cell.id)) return;
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

  const pct = cell.max_capacity ? Math.min(100, Math.round(((cell.members || []).length / cell.max_capacity) * 100)) : null;
  const capColor = pct === null ? 'text-slate-400' : pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: `Members (${members.length})` },
    { id: 'leaders', label: `Leaders (${selectedLeaderObjs.length})` },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{cell.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cell #{cell.cell_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-5 dark:border-slate-700">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setProfileTab(t.id)}
              className={`px-3 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${profileTab === t.id ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mx-5 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{message}</div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {profileTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Members', value: members.length, icon: Users },
                  { label: 'Capacity', value: cell.max_capacity ? `${pct}%` : 'No limit', icon: Users, cls: capColor },
                  { label: 'Meeting Day', value: cell.meeting_day || 'Not set', icon: Calendar },
                  { label: 'Location', value: cell.location || 'Not set', icon: MapPin },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-xs font-semibold text-slate-400">{label}</p>
                    <p className={`mt-0.5 text-sm font-bold ${cls || 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
                  </div>
                ))}
              </div>
              {cell.max_capacity && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Capacity</span>
                    <span>{members.length}/{cell.max_capacity}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Leaders</p>
                {selectedLeaderObjs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLeaderObjs.map(l => (
                      <div key={l.leader_id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{l.full_name}</p>
                          <p className="text-xs text-slate-500">{l.section_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No leaders assigned yet</p>
                )}
              </div>
              <button onClick={() => onAddMember(cell.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-600 transition-colors">
                <UserPlus className="h-4 w-4" /> Add Member to this Cell
              </button>
            </>
          )}

          {profileTab === 'members' && (
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
                  No members yet. <button onClick={() => onAddMember(cell.id)} className="text-emerald-600 hover:underline">Add one now</button>
                </div>
              ) : members.map(m => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{m.full_name}</p>
                      <p className="text-xs text-slate-500">{m.church_membership_id || 'Cell-only'} · {m.phone || '—'}</p>
                    </div>
                    <button onClick={() => removeMember(m)} disabled={saving === `remove-${m.id}`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={transferTarget[m.id] || ''}
                      onChange={(e) => setTransferTarget(t => ({ ...t, [m.id]: e.target.value }))}
                      className="select flex-1 h-8 text-xs py-0"
                    >
                      <option value="">Transfer to...</option>
                      {cells.filter(c => Number(c.id) !== Number(cell.id)).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => transferMember(m)}
                      disabled={!transferTarget[m.id] || saving === `transfer-${m.id}`}
                      className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-40 hover:bg-emerald-700"
                    >
                      {saving === `transfer-${m.id}` ? '...' : 'Move'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {profileTab === 'leaders' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Search and select members to assign as leaders, then click Save.</p>
              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={leaderSearch}
                  onChange={e => setLeaderSearch(e.target.value)}
                  placeholder="Search members by name or section…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs placeholder-slate-400 focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {(() => {
                  const term = leaderSearch.toLowerCase().trim();
                  const filtered = term
                    ? allLeaders.filter(l =>
                        l.full_name?.toLowerCase().includes(term) ||
                        l.section_name?.toLowerCase().includes(term)
                      )
                    : allLeaders;
                  if (filtered.length === 0)
                    return <p className="py-4 text-center text-xs text-slate-400">No members match your search.</p>;
                  return filtered.map(l => {
                    const checked = localLeaders.has(Number(l.id));
                    return (
                      <label key={l.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20' : 'border-slate-200 bg-slate-50 hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-800'}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setLocalLeaders(s => {
                            const next = new Set(s);
                            checked ? next.delete(Number(l.id)) : next.add(Number(l.id));
                            return next;
                          })}
                          className="h-4 w-4 accent-emerald-600"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{l.full_name}</p>
                          <p className="text-xs text-slate-500">{l.section_name || 'No section'}</p>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
              <button onClick={saveLeaders} disabled={saving === 'leaders'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving === 'leaders' ? 'Saving...' : 'Save Leaders'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main List Component ──────────────────────────────────── */
const HCList = ({ cells = [], allLeaders = [], loading, onRefresh, onCreateCell, onEditCell, onDeleteCell, onAddMember }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('number');
  const [page, setPage] = useState(1);
  const [selectedCell, setSelectedCell] = useState(null);
  const PAGE_SIZE = 10;

  const sorted = useMemo(() => {
    let list = cells.filter(c => {
      if (filter === 'active') return c.is_active;
      if (filter === 'inactive') return !c.is_active;
      const leaderNames = (c.leaders || []).map(l => l.full_name?.toLowerCase()).join(' ');
      const term = search.toLowerCase();
      return !term || c.name.toLowerCase().includes(term) || leaderNames.includes(term);
    });
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(c => {
        const leaderNames = (c.leaders || []).map(l => l.full_name?.toLowerCase()).join(' ');
        return c.name.toLowerCase().includes(term) || leaderNames.includes(term);
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'members') return (b.members?.length || 0) - (a.members?.length || 0);
      return (a.cell_number || 0) - (b.cell_number || 0);
    });
    return list;
  }, [cells, search, filter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openProfile = (cell) => {
    setSelectedCell(cell);
  };

  const handleRefresh = () => {
    onRefresh();
    if (selectedCell) {
      // update selectedCell from fresh data when available — parent will re-render
    }
  };

  // Sync selectedCell with refreshed cells data
  const liveSelectedCell = selectedCell ? cells.find(c => c.id === selectedCell.id) || selectedCell : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search cells or leaders..."
            className="input pl-9"
          />
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="select w-auto">
          <option value="all">All Cells</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select w-auto">
          <option value="number">Sort: Cell #</option>
          <option value="name">Sort: Name</option>
          <option value="members">Sort: Members</option>
        </select>
        <button onClick={onCreateCell}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
          + New Cell
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                    {['#', 'Cell Name', 'Leader(s)', 'Members', 'Capacity', 'Meeting Day', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {paged.map(cell => {
                    const memberCount = (cell.members || []).length;
                    const leaderNames = (cell.leaders || []).map(l => l.full_name).join(', ') || '—';
                    return (
                      <tr key={cell.id}
                        onClick={() => openProfile(cell)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-500">#{cell.cell_number}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{cell.name}</p>
                          {cell.location && <p className="text-xs text-slate-400 flex items-center gap-0.5 mt-0.5"><MapPin className="h-3 w-3" />{cell.location}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300 max-w-[160px] truncate">{leaderNames}</td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            <Users className="h-3.5 w-3.5 text-slate-400" />{memberCount}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <CapacityBar count={memberCount} max={cell.max_capacity} />
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">{cell.meeting_day || '—'}</td>
                        <td className="px-4 py-3.5">
                          {cell.is_active
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle className="h-3 w-3" />Active</span>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700"><XCircle className="h-3 w-3" />Inactive</span>
                          }
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => onEditCell(cell)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 transition-colors" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onDeleteCell(cell)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                        {search ? 'No cells match your search.' : 'No home cells yet. Create one to get started.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">{sorted.length} cells · page {page} of {totalPages}</p>
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
          </>
        )}
      </div>

      {/* Cell Profile Slide-over */}
      {liveSelectedCell && (
        <CellProfile
          cell={liveSelectedCell}
          cells={cells}
          allLeaders={allLeaders}
          onClose={() => setSelectedCell(null)}
          onRefresh={handleRefresh}
          onAddMember={onAddMember}
        />
      )}
    </div>
  );
};

export default HCList;
