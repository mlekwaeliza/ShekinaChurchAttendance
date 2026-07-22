import React, { useState, useEffect, useCallback } from 'react';
import { analyticsAPI, adminAPI } from '../../services/api';
import { Search, Loader2, RefreshCw, Filter, Calendar } from 'lucide-react';

const MONTHS_SHORT = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const weekToDate = (weekStr) => {
  const [y, w] = String(weekStr).split('-W').map(Number);
  if (!y || !w) return weekStr;
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const day = simple.getUTCDay();
  const isoStart = new Date(simple);
  if (day <= 4) isoStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else isoStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  return `${isoStart.getUTCDate()} ${MONTHS_SHORT[isoStart.getUTCMonth() + 1]}`;
};

const asArray = (v) => Array.isArray(v) ? v : [];

const WeeklyAttendanceMatrix = ({ sectionId, leaderId, title = 'Weekly Attendance Matrix' }) => {
  const [weeksCount, setWeeksCount] = useState(12);
  const [serviceId, setServiceId]   = useState('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [matrixData, setMatrixData] = useState([]);
  const [weeksList, setWeeksList]   = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);

  // Load service types once
  useEffect(() => {
    adminAPI.getServiceTypes()
      .then(res => setServiceTypes(asArray(res.data)))
      .catch(() => setServiceTypes([]));
  }, []);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getMemberWeeklyMatrix({
        weeks: weeksCount,
        serviceId: serviceId === 'all' ? undefined : serviceId,
        sectionId: sectionId || undefined,
        leaderId: leaderId || undefined,
      });
      setMatrixData(asArray(res.data?.matrix));
      setWeeksList(asArray(res.data?.weeks));
    } catch (err) {
      console.error('Failed to load weekly attendance matrix:', err);
      setMatrixData([]);
      setWeeksList([]);
    } finally {
      setLoading(false);
    }
  }, [weeksCount, serviceId, sectionId, leaderId]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const filteredMatrix = matrixData.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.membership_id?.toLowerCase().includes(q) ||
      m.section_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      {/* ── Controls Header ─────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" /> {title}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Showing member attendance records per week (Green P = Present, Red A = Absent, Amber E = Excused)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search member..."
              className="h-8 w-full pl-8 pr-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Service Selector */}
          {serviceTypes.length > 0 && (
            <select
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="all">All Services</option>
              {serviceTypes.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          )}

          {/* Weeks Count Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Weeks:</span>
            <select
              value={weeksCount}
              onChange={e => setWeeksCount(Number(e.target.value))}
              className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value={4}>4 weeks</option>
              <option value={8}>8 weeks</option>
              <option value={12}>12 weeks</option>
              <option value={16}>16 weeks</option>
              <option value={24}>24 weeks</option>
              <option value={52}>52 weeks</option>
            </select>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Legend:</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> P
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 dark:text-rose-300">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" /> A
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300">
              <span className="w-2.5 h-2.5 rounded bg-amber-500" /> E
            </span>
          </div>
        </div>
      </div>

      {/* ── Table Grid ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-indigo-500" />
          Loading weekly attendance matrix...
        </div>
      ) : filteredMatrix.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          No weekly attendance records found for the selected period/filters.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
          <div className="min-w-max">
            {/* Header row */}
            <div className="flex bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-20">
              <div className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900/90 w-44 shrink-0 px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 shadow-sm">
                Member
              </div>
              <div className="w-28 shrink-0 px-3 py-2.5">Section</div>
              {weeksList.map(w => (
                <div key={w} className="w-14 shrink-0 px-1 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300" title={w}>
                  {weekToDate(w)}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {filteredMatrix.map((m, idx) => (
              <div
                key={m.member_id || idx}
                className="flex border-b border-slate-100 dark:border-slate-700/50 text-xs hover:bg-violet-50/30 dark:hover:bg-violet-950/20 transition-colors"
              >
                <div className="sticky left-0 z-10 bg-white dark:bg-slate-800 w-44 shrink-0 px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 truncate">
                  <span className="font-semibold text-slate-900 dark:text-white block truncate">{m.full_name}</span>
                  {m.membership_id && <span className="text-[10px] text-slate-400 block">{m.membership_id}</span>}
                </div>
                <div className="w-28 shrink-0 px-3 py-2.5 text-slate-500 truncate" title={m.section_name || ''}>
                  {m.section_name || '—'}
                </div>
                {asArray(m.weekly).map((status, wi) => (
                  <div key={wi} className="w-14 shrink-0 px-1 py-2 text-center flex items-center justify-center">
                    {status === 'present' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-black shadow-sm" title="Present">
                        P
                      </span>
                    )}
                    {status === 'absent' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-700 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300 text-[10px] font-black shadow-sm" title="Absent">
                        A
                      </span>
                    )}
                    {status === 'excused' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black shadow-sm" title="Excused">
                        E
                      </span>
                    )}
                    {!status && <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyAttendanceMatrix;
