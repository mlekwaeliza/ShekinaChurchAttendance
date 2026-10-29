import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, RefreshCw, Search } from 'lucide-react';
import { adminAPI } from '../../services/api';

const MissingLeaderSubmissions = ({ sections = [], onViewLeader }) => {
  const [rows, setRows] = useState([]);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [section, setSection] = useState('');
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
    const term = leaderSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (section && String(row.section_id) !== section) return false;
      if (dateFilter && row.date !== dateFilter) return false;
      return !term || row.leader_name.toLowerCase().includes(term);
    });
  }, [rows, leaderSearch, dateFilter, section]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="grid min-w-0 gap-5 border-b border-slate-200 p-5 dark:border-slate-700 xl:grid-cols-[minmax(0,1fr)_minmax(640px,1.15fr)] xl:items-center">
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
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(170px,1fr)_minmax(160px,0.85fr)_minmax(150px,0.8fr)_auto]">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={leaderSearch}
              onChange={(event) => setLeaderSearch(event.target.value)}
              placeholder="Filter by leader"
              aria-label="Filter by leader"
              className="input h-10 w-full min-w-0 rounded-xl pl-9"
            />
          </div>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Date
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="input h-10 w-full min-w-0 rounded-xl"
              aria-label="Filter by date"
            />
          </label>
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
          <button
            type="button"
            onClick={loadSubmissions}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
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
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
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
