import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, RefreshCw, Search } from 'lucide-react';
import { adminAPI } from '../../services/api';

const MissingLeaderSubmissions = ({ leaders = [], sections = [], onViewLeader }) => {
  const [rows, setRows] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [section, setSection] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ leaderId: '', date: '', section: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.getLeadersMissingSubmissions();
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load missing submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appliedFilters.leaderId && String(row.leader_id) !== appliedFilters.leaderId)
        return false;
      if (appliedFilters.section && String(row.section_id) !== appliedFilters.section) return false;
      if (appliedFilters.date && String(row.date || '').slice(0, 10) !== appliedFilters.date)
        return false;
      return true;
    });
  }, [rows, appliedFilters]);

  const leaderOptions = useMemo(() => {
    const availableLeaders = leaders.length
      ? leaders.filter((leader) => leader.is_active === undefined || Number(leader.is_active) === 1)
      : rows.map((row) => ({ id: row.leader_id, full_name: row.leader_name }));
    return [...availableLeaders].sort((a, b) =>
      String(a.full_name || '').localeCompare(String(b.full_name || ''))
    );
  }, [leaders, rows]);

  const hasFilters = Boolean(leaderId || dateFilter || section);
  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ leaderId, date: dateFilter, section });
  };
  const clearFilters = () => {
    setLeaderId('');
    setDateFilter('');
    setSection('');
    setAppliedFilters({ leaderId: '', date: '', section: '' });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="space-y-5 border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Missing Sunday Main Service submissions
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Active leaders with no submission for each service date in the last 90 days.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadSubmissions}
            disabled={loading}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <form
          onSubmit={applyFilters}
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.85fr)_minmax(180px,0.85fr)_auto_auto] xl:items-end"
        >
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Leader
            </span>
            <select
              value={leaderId}
              onChange={(event) => setLeaderId(event.target.value)}
              className="input h-10 w-full min-w-0 rounded-xl"
              aria-label="Filter by leader"
            >
              <option value="">All leaders</option>
              {leaderOptions.map((leader) => (
                <option key={leader.id} value={String(leader.id)}>
                  {leader.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Date</span>
              {!dateFilter && <span className="font-normal">All dates</span>}
            </span>
            <span className="relative block min-w-0">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="input h-10 w-full min-w-0 rounded-xl pl-9 dark:[color-scheme:dark]"
                aria-label="Filter by date"
              />
            </span>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Section
            </span>
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
              className="input h-10 w-full min-w-0 rounded-xl"
              aria-label="Filter by section"
            >
              <option value="">All sections</option>
              {sections.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Search className="h-4 w-4" /> Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
            >
              Clear filters
            </button>
          )}
        </form>
      </div>

      {error ? (
        <p className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : loading ? (
        <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
          Loading missing submissions…
        </p>
      ) : filteredRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Leader</th>
                <th className="px-5 py-3">Section</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRows.map((row) => (
                <tr
                  key={`${row.leader_id}-${row.date}-${row.service_id}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onViewLeader(row.leader_id)}
                      className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {row.leader_name}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {row.section_name || 'Unassigned'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {new Date(`${String(row.date || '').slice(0, 10)}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      }
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-slate-400" /> {row.service_name}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                      Not submitted
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No missing Sunday Main Service submissions found for these filters.
        </div>
      )}
    </div>
  );
};

export default MissingLeaderSubmissions;
