import React, { useEffect, useMemo, useState } from 'react';
import { Home, Save, Search, Users } from 'lucide-react';
import { adminAPI } from '../../services/api';

const HomeCellsView = ({ leaders = [] }) => {
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCellId, setSavingCellId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const loadCells = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getHomeCells();
      setCells(response.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to load home cells.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCells();
  }, []);

  const filteredLeaders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leaders
      .filter((leader) => !term
        || leader.full_name?.toLowerCase().includes(term)
        || leader.section_name?.toLowerCase().includes(term))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [leaders, search]);

  const selectedIdsFor = (cell) => new Set((cell.leaders || []).map((leader) => Number(leader.leader_id)));

  const toggleLeader = (cellId, leaderId) => {
    setCells((current) => current.map((cell) => {
      if (Number(cell.id) !== Number(cellId)) return cell;
      const selected = selectedIdsFor(cell);
      if (selected.has(Number(leaderId))) {
        return { ...cell, leaders: cell.leaders.filter((leader) => Number(leader.leader_id) !== Number(leaderId)) };
      }
      const leader = leaders.find((item) => Number(item.id) === Number(leaderId));
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
            <p className="text-sm text-white/80">Assign leaders to Tuesday Home Cell groups.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leaders by name or section..."
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
                      {cell.member_count || 0} members &middot; {selected.size} leaders assigned
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

                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
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
    </div>
  );
};

export default HomeCellsView;
