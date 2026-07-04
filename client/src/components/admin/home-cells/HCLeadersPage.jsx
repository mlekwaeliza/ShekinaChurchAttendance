import React, { useMemo, useState } from 'react';
import { Search, User, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HCLeadersPage = ({ cells = [], allLeaders = [] }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const PAGE_SIZE = 15;

  // Map leaders to their assigned cell and member count details
  const leadersData = useMemo(() => {
    const mapped = allLeaders.map(leader => {
      // Find all cells where this leader is assigned
      const assignedCells = cells.filter(cell =>
        (cell.leaders || []).some(l => Number(l.leader_id) === Number(leader.id))
      );

      const cellNames = assignedCells.map(c => c.name).join(', ') || 'Unassigned';
      const totalMembers = assignedCells.reduce((sum, c) => sum + (c.members || []).length, 0);

      return {
        ...leader,
        cellNames,
        totalMembers,
        assignedCellsCount: assignedCells.length
      };
    });
    return mapped.filter(l => l.assignedCellsCount > 0);
  }, [cells, allLeaders]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return leadersData;
    return leadersData.filter(l =>
      l.full_name?.toLowerCase().includes(term) ||
      l.section_name?.toLowerCase().includes(term) ||
      l.cellNames.toLowerCase().includes(term)
    );
  }, [leadersData, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleLeaderClick = (leader) => {
    // Navigate to leaders tab and set filter to this leader's section
    navigate(`/admin/leaders?search=${encodeURIComponent(leader.full_name)}`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search leaders by name, section, or cell..."
            className="input pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                {['Leader Name', 'Church Section', 'Assigned Home Cell(s)', 'Total Members in Cell', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {paged.map(l => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{l.full_name}</p>
                        <p className="text-xs text-slate-400">ID: {l.membership_id || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{l.section_name || '—'}</td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    <span className={l.assignedCellsCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {l.cellNames}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                    {l.assignedCellsCount > 0 ? `${l.totalMembers} members` : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    {l.is_active ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleLeaderClick(l)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      <Shield className="h-3.5 w-3.5" /> View Ministry Profile
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    No cell leaders found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">{filtered.length} leaders · page {page} of {totalPages}</p>
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

export default HCLeadersPage;
