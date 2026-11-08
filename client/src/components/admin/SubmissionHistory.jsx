import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  CalendarDays,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageCircle,
  Check,
  ClipboardList
} from 'lucide-react';
import {
  addDays,
  formatDisplayDate,
  formatLocalDate,
  parseLocalDate,
  fdatetime
} from '../../utils/date';
import { openWhatsAppChat, toWhatsAppNumber } from '../../utils/phone';
import { adminAPI } from '../../services/api';

const reminderKey = (leaderId, serviceId) => `${leaderId}:${serviceId ?? 'all'}`;

const normalizeHistoryDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
};

const buildReminderMessage = ({ leaderName, sectionName, serviceName, date }) => {
  const firstName = String(leaderName || '')
    .trim()
    .split(/\s+/)[0];
  const swahiliDate = parseLocalDate(date).toLocaleDateString('sw', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return `Habari${firstName ? ` ${firstName}` : ''}! Tunakukumbusha kuwasilisha attendance ya ${sectionName} kwa ${serviceName} ya ${swahiliDate}. Tafadhali wasilisha kwenye mfumo. Asante! — Shekina Church`;
};

const openWhatsAppReminder = ({ leader, sectionName, serviceName, date }) => {
  const message = buildReminderMessage({
    leaderName: leader.full_name,
    sectionName,
    serviceName,
    date
  });
  return openWhatsAppChat(leader.phone, message);
};

const serviceBadgeTint = (serviceName) => {
  if (serviceName === 'Main Service') {
    return 'bg-system-orange/15 text-amber-700 dark:text-system-orange';
  }
  if (serviceName === 'Leaders Gathering') {
    return 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300';
  }
  if (serviceName === 'Youth Service') {
    return 'bg-system-green/15 text-emerald-700 dark:text-system-green';
  }
  return 'bg-system-fill text-secondary-label';
};

const SubmittedRow = ({ log }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-primary-500/[0.12] flex items-center justify-center text-primary-700 dark:text-primary-300 text-sm font-bold shrink-0">
          {log.leader_name?.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-label">{log.leader_name}</p>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${serviceBadgeTint(
                log.service_name
              )}`}
            >
              {log.service_name}
            </span>
          </div>
          <p className="text-caption-1 text-secondary-label">{log.section_name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Records count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-system-fill">
          <span className="text-footnote font-semibold text-label tabular-nums">
            {log.records_count} records
          </span>
        </div>

        {/* Time */}
        <div className="text-right">
          <p className="text-caption-1 text-secondary-label tabular-nums">
            {fdatetime(log.submitted_at)}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const PendingRow = ({ leader, reminder, onWhatsApp, onMarkAttendance }) => {
  const whatsappNumber = toWhatsAppNumber(leader.phone);
  const remindedTitle = reminder
    ? reminder.created_at
      ? `Reminded ${fdatetime(reminder.created_at)}`
      : 'Reminded'
    : '';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-lg bg-system-orange/15 flex items-center justify-center text-amber-700 dark:text-system-orange text-sm font-bold shrink-0">
            {leader.full_name?.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-label">{leader.full_name}</p>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-system-orange/15 text-amber-700 dark:text-system-orange">
                Pending
              </span>
            </div>
            <p className="text-caption-1 text-secondary-label">{leader.section_name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onMarkAttendance}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-primary-500/[0.12] px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-500/[0.2] dark:text-primary-300"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Mark Attendance
          </button>
          {/* Reminded badge */}
          {reminder && (
            <span
              title={remindedTitle}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-system-green/15 text-emerald-700 dark:text-system-green text-[10px] font-semibold uppercase tracking-wide"
            >
              <Check className="h-3 w-3" />
              Reminded
            </span>
          )}

          {/* Phone Actions */}
          {leader.phone ? (
            <>
              <a
                href={`tel:${leader.phone}`}
                className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-system-orange/10 hover:bg-system-orange/20 text-amber-700 dark:text-system-orange transition-colors font-semibold text-xs"
              >
                <Phone className="h-3.5 w-3.5" />
                Call: {leader.phone}
              </a>
              {whatsappNumber && (
                <button
                  type="button"
                  onClick={onWhatsApp}
                  className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-system-green/10 hover:bg-system-green/20 text-emerald-700 dark:text-system-green transition-colors font-semibold text-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
              )}
            </>
          ) : (
            <span className="text-caption-1 text-tertiary-label italic">No phone on file</span>
          )}
        </div>
      </div>
    </div>
  );
};

const UNASSIGNED_SECTION = 'Unassigned Section';

const normalizeSectionName = (value) => {
  const name = (value || '').trim();
  if (!name || name === 'Unassigned') return UNASSIGNED_SECTION;
  return name;
};

const DateSubmissionDetails = ({ logs, allLeaders, allSections, onMarkAttendance }) => {
  const [activeTab, setActiveTab] = useState('submitted'); // 'submitted' or 'pending'
  const [reminderMap, setReminderMap] = useState({});
  const date = normalizeHistoryDate(logs[0]?.date);

  // Which pending leaders were already reminded on this date.
  useEffect(() => {
    let cancelled = false;
    if (!date) return undefined;
    adminAPI
      .getHistoryReminders(date)
      .then((res) => {
        if (cancelled) return;
        const map = {};
        (res.data || []).forEach((reminder) => {
          map[reminderKey(reminder.leader_id, reminder.service_id)] = reminder;
        });
        setReminderMap(map);
      })
      .catch(() => {
        // Reminder status is best-effort; the pending list still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleWhatsAppReminder = (sectionName, { leader, service }) => {
    if (!openWhatsAppReminder({ leader, sectionName, serviceName: service.serviceName, date })) {
      return;
    }
    const key = reminderKey(leader.id, service.serviceId);
    setReminderMap((prev) => ({
      ...prev,
      [key]: prev[key] || { leader_id: leader.id, service_id: service.serviceId ?? null }
    }));
    adminAPI
      .logHistoryReminder({ leader_id: leader.id, date, service_id: service.serviceId ?? null })
      .then((res) => {
        setReminderMap((prev) => {
          const next = { ...prev };
          (res.data || []).forEach((reminder) => {
            next[reminderKey(reminder.leader_id, reminder.service_id)] = reminder;
          });
          return next;
        });
      })
      .catch(() => {
        // Keep the optimistic badge; the WhatsApp message was already opened.
      });
  };

  // Every service that received at least one submission on this date.
  const dayServices = useMemo(() => {
    const services = new Map();
    logs.forEach((log) => {
      const name = log.service_name || 'Selected Service';
      if (!services.has(name)) services.set(name, log.service_id ?? null);
    });
    return [...services.entries()]
      .map(([serviceName, serviceId]) => ({ serviceName, serviceId }))
      .sort((a, b) =>
        a.serviceName === 'Main Service'
          ? -1
          : b.serviceName === 'Main Service'
            ? 1
            : a.serviceName.localeCompare(b.serviceName)
      );
  }, [logs]);

  // Always show every section — the ones that submitted, the church's full
  // section list, and any section that only shows up through the leader
  // roster — so pending leaders in silent sections stay visible too.
  const sectionDetails = useMemo(() => {
    const logsBySection = {};
    logs.forEach((log) => {
      const sectionName = normalizeSectionName(log.section_name);
      if (!logsBySection[sectionName]) logsBySection[sectionName] = [];
      logsBySection[sectionName].push(log);
    });

    const knownSections = (allSections || []).map((section) => normalizeSectionName(section.name));
    const rosterSections = (allLeaders || []).map((leader) =>
      normalizeSectionName(leader.section_name)
    );
    const sectionNames = [
      ...new Set([...Object.keys(logsBySection), ...knownSections, ...rosterSections])
    ].sort((a, b) => a.localeCompare(b));

    return sectionNames.map((sectionName) => {
      const sectionLogs = logsBySection[sectionName] || [];
      const sectionLeaders = (allLeaders || []).filter(
        (leader) => normalizeSectionName(leader.section_name) === sectionName
      );
      const headLeaders = sectionLeaders
        .filter((leader) => Number(leader.is_head) === 1)
        .map((leader) => leader.full_name)
        .filter(Boolean);

      const services = dayServices.map(({ serviceName, serviceId }) => {
        const submitted = sectionLogs.filter(
          (log) => (log.service_name || 'Selected Service') === serviceName
        );
        const submittedNames = new Set(submitted.map((log) => log.leader_name));
        return {
          serviceName,
          serviceId,
          submitted,
          pending: sectionLeaders.filter((leader) => !submittedNames.has(leader.full_name))
        };
      });

      return {
        sectionName,
        headLeaders,
        services,
        hasSubmissions: sectionLogs.length > 0,
        leaderCount: sectionLeaders.length
      };
    });
  }, [logs, allLeaders, allSections, dayServices]);

  const totalSubmitted = logs.length;
  const totalPending = sectionDetails.reduce(
    (sum, section) =>
      sum +
      section.services.reduce((serviceSum, service) => serviceSum + service.pending.length, 0),
    0
  );

  return (
    <div className="mt-2 ml-4 pl-6 border-l border-separator/60 dark:border-white/[0.08] space-y-4">
      {/* Inner Tabs Selector */}
      <div className="tab-pills w-fit mb-2">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`tab-pill ${activeTab === 'submitted' ? 'active' : ''}`}
        >
          Submitted ({totalSubmitted})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`tab-pill ${activeTab === 'pending' ? 'active' : ''}`}
        >
          Pending ({totalPending})
        </button>
      </div>

      {/* Render based on selected inner tab */}
      <div className="space-y-5">
        {sectionDetails.map((section) => {
          const unreminded = section.services
            .flatMap((service) =>
              service.pending
                .filter((leader) => toWhatsAppNumber(leader.phone))
                .map((leader) => ({ leader, service }))
            )
            .filter(
              ({ leader, service }) => !reminderMap[reminderKey(leader.id, service.serviceId)]
            );

          return (
            <section key={section.sectionName} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-caption-1 font-semibold uppercase tracking-[0.06em] text-primary-700 dark:text-primary-300">
                  {section.sectionName}
                  {section.headLeaders.length > 0 && ` (${section.headLeaders.join(', ')})`}
                </h4>

                {activeTab === 'pending' && unreminded.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleWhatsAppReminder(section.sectionName, unreminded[0])}
                    className="focus-ring flex items-center gap-1.5 rounded-lg bg-system-green/15 px-3 py-1.5 text-caption-1 font-semibold text-emerald-700 transition-colors hover:bg-system-green/25 dark:text-system-green"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Remind all ({unreminded.length})
                  </button>
                )}
              </div>

              {activeTab === 'submitted' ? (
                section.hasSubmissions ? (
                  section.services
                    .filter((service) => service.submitted.length > 0)
                    .map((service) => (
                      <div key={service.serviceName} className="space-y-2">
                        {dayServices.length > 1 && (
                          <h5 className="text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                            {service.serviceName}
                          </h5>
                        )}
                        {service.submitted.map((log, idx) => (
                          <SubmittedRow key={idx} log={log} />
                        ))}
                      </div>
                    ))
                ) : (
                  <div className="text-caption-1 text-tertiary-label italic py-1">
                    No submissions from this section
                  </div>
                )
              ) : section.leaderCount === 0 ? (
                <div className="text-caption-1 text-tertiary-label italic py-1">
                  No leaders assigned to this section
                </div>
              ) : (
                section.services.map((service) => (
                  <div key={service.serviceName} className="space-y-2">
                    {dayServices.length > 1 && (
                      <h5 className="text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                        {service.serviceName}
                      </h5>
                    )}

                    {service.pending.length > 0 ? (
                      <div className="grid gap-2">
                        {service.pending.map((leader, idx) => (
                          <PendingRow
                            key={idx}
                            leader={leader}
                            reminder={reminderMap[reminderKey(leader.id, service.serviceId)]}
                            onMarkAttendance={() =>
                              onMarkAttendance?.(leader, date, service.serviceId)
                            }
                            onWhatsApp={() =>
                              handleWhatsAppReminder(section.sectionName, { leader, service })
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-caption-1 text-tertiary-label italic py-2">
                        All leaders in this section have submitted for this service!
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const SubmissionHistory = ({
  history,
  historyLoading,
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  loadHistory,
  leaders = [],
  sections = [],
  onMarkAttendance
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
      const date = normalizeHistoryDate(log.date);
      if (!date) return;
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
      day: 'numeric'
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
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const totalSubmissions = groupedByDate.reduce((sum, [, logs]) => sum + logs.length, 0);
  const totalRecords = groupedByDate.reduce(
    (sum, [, logs]) => sum + logs.reduce((s, l) => s + Number(l.records_count || 0), 0),
    0
  );

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
      <section className="product-surface px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-orange/15 text-amber-700 dark:text-system-orange">
              <Clock className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="section-eyebrow">Attendance submissions</p>
              <h2 className="text-title-2 font-semibold text-label">Submission History</h2>
              <p className="mt-0.5 text-subheadline text-secondary-label tabular-nums">
                {totalSubmissions} submissions &middot; {totalRecords} records tracked
              </p>
            </div>
          </div>

          {/* Service Selector */}
          <div className="flex max-w-full shrink-0 items-center overflow-x-auto scrollbar-hide">
            <div className="tab-pills">
              <button
                onClick={() => onServiceChange('all')}
                className={`tab-pill ${selectedServiceId === 'all' ? 'active' : ''}`}
              >
                All
              </button>

              {serviceTypes.map((service) => (
                <button
                  key={service.id}
                  onClick={() => onServiceChange(service.id)}
                  className={`tab-pill ${selectedServiceId === service.id ? 'active' : ''}`}
                >
                  {service.name === 'Main Service' ? 'Main' : service.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary-label" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by leader, section, service, or date..."
          className="input pl-10 h-10 rounded-xl w-full"
        />
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
                  className="card w-full flex items-center justify-between px-5 py-3.5 transition-shadow hover:shadow-card-hover group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-system-fill flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-secondary-label" />
                    </div>
                    <div>
                      <h3 className="text-subheadline font-semibold text-label">
                        {formatDate(date)}
                      </h3>
                      <p className="text-caption-1 text-secondary-label tabular-nums">
                        {logs.length} submission{logs.length !== 1 ? 's' : ''} · {dayTotal} records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption-1 text-secondary-label">
                      {formatRelativeDate(date)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-tertiary-label group-hover:text-label transition-colors" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-tertiary-label group-hover:text-label transition-colors" />
                    )}
                  </div>
                </button>

                {/* Submissions List & Pending Details */}
                {isExpanded && (
                  <DateSubmissionDetails
                    logs={logs}
                    allLeaders={leaders}
                    allSections={sections}
                    onMarkAttendance={onMarkAttendance}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-system-fill">
              <Clock className="h-6 w-6 text-secondary-label" />
            </div>
            <p className="empty-state-title">No submission history</p>
            <p className="empty-state-desc">
              {searchTerm
                ? 'No results match your search.'
                : 'Attendance submissions will appear here once leaders start reporting.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
export default SubmissionHistory;
