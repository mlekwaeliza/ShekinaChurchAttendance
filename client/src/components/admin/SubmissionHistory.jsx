import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, CalendarDays, FileText, Users, Search, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { addDays, formatDisplayDate, formatLocalDate, parseLocalDate, fdate, fdatetime } from '../../utils/date';

const SubmissionHistory = ({ 
  history, 
  historyLoading, 
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  loadHistory,
  leaders = []
}) => {
  const initializedServiceRef = useRef(false);

  useEffect(() => {
    if (initializedServiceRef.current) return;
    initializedServiceRef.current = true;
    if (selectedServiceId !== 'all') {
      onServiceChange('all');
    }
  }, [onServiceChange, selectedServiceId]);

  useEffect(() => {
    loadHistory();
  }, [selectedServiceId, loadHistory]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState({});

  const groupedByDate = useMemo(() => {
    let filtered = history;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.leader_name?.toLowerCase().includes(term) ||
          h.section_name?.toLowerCase().includes(term) ||
          h.service_name?.toLowerCase().includes(term) ||
          h.date?.includes(term)
      );
    }

    const groups = {};
    filtered.forEach((log) => {
      const date = log.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });

    // Sort dates descending
    const sorted = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

    // Auto-expand most recent date
    if (sorted.length > 0 && Object.keys(expandedDates).length === 0) {
      setExpandedDates({ [sorted[0][0]]: true });
    }

    return sorted;
  }, [history, searchTerm, expandedDates]);

  const toggleDate = (date) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDate = (dateStr) => {
    const today = formatLocalDate();
    const yesterday = formatLocalDate(addDays(new Date(), -1));

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    return formatDisplayDate(dateStr, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatRelativeDate = (dateStr) => {
    const date = parseLocalDate(dateStr);
    const today = parseLocalDate();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const totalSubmissions = groupedByDate.reduce((sum, [, logs]) => sum + logs.length, 0);
  const totalRecords = groupedByDate.reduce((sum, [, logs]) => sum + logs.reduce((s, l) => s + Number(l.records_count || 0), 0), 0);

  if (historyLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white shadow-xl shadow-amber-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Submission History</h2>
              <p className="text-sm text-white/80">
                {totalSubmissions} submissions &middot; {totalRecords} records tracked
              </p>
            </div>
          </div>

          {/* Service Selector */}
          <div className="flex max-w-full shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-sm backdrop-blur-sm">
            <div className="flex gap-1">
              <button
                onClick={() => onServiceChange('all')}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all duration-300 ${
                  selectedServiceId === 'all'
                    ? 'bg-white text-orange-600 shadow-md shadow-orange-900/10'
                    : 'text-white/80 hover:bg-white/15 hover:text-white'
                }`}
              >
                All
              </button>

              {serviceTypes.map(service => (
                <button
                  key={service.id}
                  onClick={() => onServiceChange(service.id)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all duration-300 ${
                    selectedServiceId === service.id
                      ? 'bg-white text-orange-600 shadow-md shadow-orange-900/10'
                      : 'text-white/80 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by leader, section, service, or date..."
            className="input pl-10 h-10 rounded-xl w-full"
          />
        </div>
      </div>

      {/* Timeline */}
      {groupedByDate.length > 0 ? (
        <div className="space-y-4">
          {groupedByDate.map(([date, logs]) => {
            const isExpanded = expandedDates[date];
            const dayTotal = logs.reduce((sum, l) => sum + Number(l.records_count || 0), 0);

            return (
              <div key={date}>
                {/* Date Header */}
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatDate(date)}
                      </h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {logs.length} submission{logs.length !== 1 ? 's' : ''} · {dayTotal} records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeDate(date)}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                    )}
                  </div>
                </button>

                {/* Submissions List & Pending Details */}
                {isExpanded && (
                  <DateSubmissionDetails 
                    date={date} 
                    logs={logs} 
                    allLeaders={leaders} 
                    serviceTypes={serviceTypes} 
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">No submission history</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            {searchTerm ? 'No results match your search.' : 'Attendance submissions will appear here once leaders start reporting.'}
          </p>
        </div>
      )}
    </div>
  );
};

const DateSubmissionDetails = ({ date, logs, allLeaders, serviceTypes }) => {
  const [activeTab, setActiveTab] = useState('submitted'); // 'submitted' or 'pending'
  
  // Group logs by service
  const servicesMap = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const svc = log.service_name || 'Selected Service';
      if (!map[svc]) map[svc] = [];
      map[svc].push(log);
    });
    return map;
  }, [logs]);

  // For each service, find pending leaders
  const serviceDetails = useMemo(() => {
    return Object.entries(servicesMap).map(([serviceName, svcLogs]) => {
      const submittedNames = new Set(svcLogs.map(l => l.leader_name));
      const pending = (allLeaders || []).filter(leader => !submittedNames.has(leader.full_name));
      return {
        serviceName,
        submitted: svcLogs,
        pending
      };
    });
  }, [servicesMap, allLeaders]);

  const totalSubmitted = logs.length;
  const totalPending = serviceDetails.reduce((sum, s) => sum + s.pending.length, 0);

  return (
    <div className="mt-2 ml-4 pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-4">
      {/* Inner Tabs Selector */}
      <div className="flex items-center gap-2 mb-2 bg-slate-50 dark:bg-slate-900/40 p-1 rounded-xl w-fit border border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'submitted'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Submitted ({totalSubmitted})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Pending ({totalPending})
        </button>
      </div>

      {/* Render based on selected inner tab */}
      {activeTab === 'submitted' ? (
        <div className="space-y-3">
          {serviceDetails.map((svc, sIdx) => (
            <div key={sIdx} className="space-y-2">
              {serviceDetails.length > 1 && (
                <h4 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">{svc.serviceName}</h4>
              )}
              {svc.submitted.map((log, idx) => (
                <SubmittedRow key={idx} log={log} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {serviceDetails.map((svc, sIdx) => (
            <div key={sIdx} className="space-y-2">
              {serviceDetails.length > 1 && (
                <h4 className="text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">{svc.serviceName}</h4>
              )}
              {svc.pending.length > 0 ? (
                <div className="grid gap-2">
                  {svc.pending.map((leader, idx) => (
                    <PendingRow key={idx} leader={leader} serviceName={svc.serviceName} />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-2">
                  All leaders have submitted for this service!
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SubmittedRow = ({ log }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 p-4 hover:shadow-sm transition-all">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {log.leader_name?.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              {log.leader_name}
            </p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              log.service_name === 'Main Service' ? 'bg-amber-100 text-amber-700' :
              log.service_name === 'Leaders Gathering' ? 'bg-indigo-100 text-indigo-700' :
              log.service_name === 'Youth Service' ? 'bg-emerald-100 text-emerald-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {log.service_name}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {log.section_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Records count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
            {log.records_count} records
          </span>
        </div>

        {/* Time */}
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 tabular-nums">
            {fdatetime(log.submitted_at)}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const PendingRow = ({ leader, serviceName }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 p-4 hover:shadow-sm transition-all">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-550 to-amber-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {leader.full_name?.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              {leader.full_name}
            </p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              Pending
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {leader.section_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Phone Action */}
        {leader.phone ? (
          <a
            href={`tel:${leader.phone}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-amber-750 dark:text-amber-400 transition-all font-semibold text-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            Call: {leader.phone}
          </a>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">No phone on file</span>
        )}
      </div>
    </div>
  </div>
);

export default SubmissionHistory;
