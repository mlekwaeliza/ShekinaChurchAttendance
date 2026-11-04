import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCog,
  Phone,
  AtSign,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Search,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  Layers,
  MessageCircle
} from 'lucide-react';
import { openWhatsAppChat, toWhatsAppNumber } from '../../utils/phone';
import MissingLeaderSubmissions from './MissingLeaderSubmissions';

// Opens WhatsApp with a short greeting — the admin edits it before sending.
const buildWhatsAppGreeting = (fullName) => {
  const firstName =
    String(fullName || '')
      .trim()
      .split(/\s+/)[0] || '';
  return `Habari${firstName ? ` ${firstName}` : ''}!`;
};

const sectionStyles = [
  {
    tint: 'bg-violet-500/[0.12]',
    deep: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500'
  },
  {
    tint: 'bg-system-indigo/[0.12]',
    deep: 'bg-system-indigo',
    text: 'text-primary-700 dark:text-primary-300',
    dot: 'bg-system-indigo'
  },
  {
    tint: 'bg-system-green/[0.12]',
    deep: 'bg-system-green',
    text: 'text-emerald-700 dark:text-system-green',
    dot: 'bg-system-green'
  },
  {
    tint: 'bg-system-orange/[0.12]',
    deep: 'bg-system-orange',
    text: 'text-amber-700 dark:text-system-orange',
    dot: 'bg-system-orange'
  },
  {
    tint: 'bg-system-red/[0.12]',
    deep: 'bg-system-red',
    text: 'text-rose-700 dark:text-system-red',
    dot: 'bg-system-red'
  },
  {
    tint: 'bg-system-purple/[0.12]',
    deep: 'bg-system-purple',
    text: 'text-purple-700 dark:text-system-purple',
    dot: 'bg-system-purple'
  },
  {
    tint: 'bg-system-teal/[0.12]',
    deep: 'bg-system-teal',
    text: 'text-teal-700 dark:text-system-teal',
    dot: 'bg-system-teal'
  },
  {
    tint: 'bg-system-pink/[0.12]',
    deep: 'bg-system-pink',
    text: 'text-pink-700 dark:text-system-pink',
    dot: 'bg-system-pink'
  }
];

const fallbackStyle = {
  tint: 'bg-system-fill',
  deep: 'bg-system-gray',
  text: 'text-secondary-label',
  dot: 'bg-system-gray'
};

const LeaderDirectory = ({
  leaders,
  leadersLoading,
  allMembers = [],
  sections,
  sectionFilter,
  setSectionFilter,
  onViewAnalytics,
  onViewMembers,
  onAdd,
  onEdit,
  onDelete
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [expandedLeaderRosters, setExpandedLeaderRosters] = useState(new Set());
  const [activeView, setActiveView] = useState('directory');

  const toggleSection = (name) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleLeaderRoster = (leaderId) => {
    setExpandedLeaderRosters((prev) => {
      const next = new Set(prev);
      if (next.has(leaderId)) next.delete(leaderId);
      else next.add(leaderId);
      return next;
    });
  };

  const membersByLeader = useMemo(() => {
    const grouped = {};
    allMembers.forEach((m) => {
      if (!m.leader_id) return;
      if (!grouped[m.leader_id]) grouped[m.leader_id] = [];
      grouped[m.leader_id].push(m);
    });
    return grouped;
  }, [allMembers]);

  const unassignedMembersBySection = useMemo(() => {
    const grouped = {};
    allMembers.forEach((m) => {
      if (m.leader_id) return;
      const section = m.section_name || 'Unassigned';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(m);
    });
    return grouped;
  }, [allMembers]);

  const leadersBySection = useMemo(() => {
    let filtered = leaders;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.full_name?.toLowerCase().includes(term) ||
          l.username?.toLowerCase().includes(term) ||
          l.section_name?.toLowerCase().includes(term)
      );
    }
    if (sectionFilter) {
      filtered = filtered.filter((l) => l.section_name === sectionFilter);
    }

    const grouped = {};
    filtered.forEach((leader) => {
      const section = leader.section_name || 'Unassigned';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(leader);
    });

    // Sort leaders within each section: heads first, then alphabetically
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        if (a.is_head === 1 && b.is_head !== 1) return -1;
        if (a.is_head !== 1 && b.is_head === 1) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
    });

    return grouped;
  }, [leaders, searchTerm, sectionFilter]);

  const sectionOrder = useMemo(() => {
    return Object.keys(leadersBySection).sort((a, b) => {
      const aIdx = sections?.findIndex((s) => s.name === a) ?? 999;
      const bIdx = sections?.findIndex((s) => s.name === b) ?? 999;
      return aIdx - bIdx;
    });
  }, [leadersBySection, sections]);

  const totalLeaders = leaders.length;
  const totalSections = sections?.length || 0;

  if (leadersLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Banner */}
      <div className="product-surface relative px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-title-2 font-semibold text-label">Leaders</h2>
              <p className="text-footnote text-secondary-label">
                {leadersLoading
                  ? 'Loading leaders...'
                  : `${totalLeaders} leaders · ${totalSections} sections`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onAdd} className="btn-primary btn-sm focus-ring shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Add Leader
          </button>
        </div>
      </div>

      <div className="tab-pills w-fit max-w-full">
        <button
          type="button"
          onClick={() => setActiveView('directory')}
          className={`tab-pill focus-ring ${activeView === 'directory' ? 'active' : ''}`}
        >
          Leader Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveView('missing')}
          className={`tab-pill focus-ring ${activeView === 'missing' ? 'active' : ''}`}
        >
          Missing Submissions
        </button>
      </div>

      {activeView === 'missing' ? (
        <MissingLeaderSubmissions
          leaders={leaders}
          sections={sections}
          onViewLeader={(id) => onViewAnalytics(id)}
        />
      ) : (
        <>
          {/* Search */}
          <div className="card p-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary-label" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, username, or section..."
                  className="input pl-10 h-10 rounded-xl w-full"
                />
              </div>
              {sectionFilter && (
                <button
                  onClick={() => setSectionFilter('')}
                  className="flex items-center gap-1 text-sm font-medium text-rose-700 dark:text-system-red hover:text-rose-800 dark:hover:text-system-red whitespace-nowrap"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* Section Groups */}
          {sectionOrder.length > 0 ? (
            <div className="space-y-6">
              {sectionOrder.map((sectionName) => {
                const sectionLeaders = leadersBySection[sectionName];
                const sectionIdx = sections?.findIndex((s) => s.name === sectionName) ?? -1;
                const style =
                  sectionIdx >= 0
                    ? sectionStyles[sectionIdx % sectionStyles.length]
                    : fallbackStyle;
                const isCollapsed = collapsedSections.has(sectionName);
                const headLeader = sectionLeaders.find((l) => l.is_head === 1);

                return (
                  <div key={sectionName}>
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(sectionName)}
                      className="group flex w-full items-center justify-between rounded-xl bg-system-grouped-background/70 px-5 py-3.5 transition-colors hover:bg-system-grouped-background dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${style.tint} ${style.text}`}
                        >
                          <Layers className="h-[18px] w-[18px]" />
                        </div>
                        <div className="text-left">
                          <h3 className={`text-subheadline font-semibold ${style.text}`}>
                            {sectionName}
                          </h3>
                          <p className="text-caption-1 text-secondary-label">
                            {sectionLeaders.length} leader{sectionLeaders.length !== 1 ? 's' : ''}
                            {headLeader && (
                              <span className="ml-1.5 text-tertiary-label">
                                · Head: {headLeader.full_name}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sectionIdx >= 0 && sections?.[sectionIdx] && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/sections?profile=${sections[sectionIdx].id}`);
                            }}
                            className="focus-ring flex items-center gap-1 rounded-lg border border-separator/60 bg-secondary-system-grouped-background px-2.5 py-1 text-[11px] font-semibold text-label shadow-xs transition-all hover:bg-system-fill dark:border-white/[0.08]"
                            title="View Section Profile"
                          >
                            <Layers className="w-3 h-3 text-primary-500" /> View Section
                          </button>
                        )}
                        {isCollapsed ? (
                          <ChevronDown className={`w-4 h-4 ${style.text} transition-transform`} />
                        ) : (
                          <ChevronUp className={`w-4 h-4 ${style.text} transition-transform`} />
                        )}
                      </div>
                    </button>

                    {/* Leader Cards */}
                    {!isCollapsed && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionLeaders.map((leader) => (
                          <div
                            key={leader.id}
                            className="group relative card overflow-hidden p-4 hover:shadow-card-hover transition-all duration-200"
                          >
                            {/* Avatar & Name */}
                            <div className="flex items-start gap-3 mb-3">
                              <div
                                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-lg font-bold text-white ${style.deep}`}
                              >
                                {leader.profile_picture ? (
                                  <img
                                    src={leader.profile_picture}
                                    alt={leader.full_name || 'Leader'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  leader.full_name?.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onViewAnalytics(leader.id)}
                                    className="font-semibold text-sm text-label truncate hover:text-primary-700 dark:hover:text-primary-300 transition-colors text-left"
                                    title="View Profile"
                                  >
                                    {leader.full_name}
                                  </button>
                                  {leader.is_head === 1 && (
                                    <span className="flex items-center gap-0.5 shrink-0 rounded-full bg-system-orange/15 px-1.5 py-0.5">
                                      <Shield className="w-2.5 h-2.5 text-amber-700 dark:text-system-orange" />
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-system-orange">
                                        Head
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-tertiary-label font-mono mt-0.5">
                                  @{leader.username}
                                </p>
                              </div>
                            </div>

                            {/* Stats & Members */}
                            <div className="flex items-center justify-between mb-3 px-1">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-secondary-label">
                                <Users className="w-3.5 h-3.5" />
                                <span className="tabular-nums">
                                  {membersByLeader[leader.id]?.length || 0} Members
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => onViewMembers(leader)}
                                  className={`text-xs font-semibold ${style.text} hover:underline decoration-2 underline-offset-4`}
                                >
                                  View Members
                                </button>
                                {membersByLeader[leader.id]?.length > 0 && (
                                  <button
                                    onClick={() => toggleLeaderRoster(leader.id)}
                                    className={`text-xs font-semibold ${style.text} hover:underline decoration-2 underline-offset-4`}
                                  >
                                    {expandedLeaderRosters.has(leader.id)
                                      ? 'Hide Roster'
                                      : 'View Roster'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expandable Roster */}
                            {expandedLeaderRosters.has(leader.id) && membersByLeader[leader.id] && (
                              <div className="mb-4 rounded-xl bg-system-grouped-background/70 p-2 max-h-40 overflow-y-auto border border-separator/40 dark:border-white/[0.06] dark:bg-white/[0.03] scrollbar-thin">
                                <div className="grid grid-cols-1 gap-1">
                                  {membersByLeader[leader.id].map((m) => (
                                    <div
                                      key={m.id}
                                      className="flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors hover:bg-secondary-system-grouped-background dark:hover:bg-white/[0.06] group/member"
                                    >
                                      <span className="text-xs font-medium text-label truncate">
                                        {m.full_name}
                                      </span>
                                      <span className="text-[10px] text-tertiary-label font-mono opacity-0 group-hover/member:opacity-100 transition-opacity">
                                        #{m.membership_id}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Contact */}
                            <div className="space-y-1.5 mb-3">
                              {leader.phone && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2 text-xs text-secondary-label">
                                    <Phone className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{leader.phone}</span>
                                  </div>
                                  {toWhatsAppNumber(leader.phone) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openWhatsAppChat(
                                          leader.phone,
                                          buildWhatsAppGreeting(leader.full_name)
                                        )
                                      }
                                      className="flex shrink-0 items-center gap-1 rounded-lg bg-system-green/15 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-system-green/25 dark:text-system-green"
                                      title="Chat on WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      WhatsApp
                                    </button>
                                  )}
                                </div>
                              )}
                              {leader.email && (
                                <div className="flex items-center gap-2 text-xs text-secondary-label">
                                  <AtSign className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{leader.email}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-separator/60 dark:border-white/[0.08]">
                              <button
                                onClick={() => onViewAnalytics(leader.id)}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 ${style.text} ${style.tint}`}
                              >
                                <Eye className="w-3 h-3" />
                                View Profile
                              </button>
                              <button
                                onClick={() => onViewMembers(leader)}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 ${style.text} ${style.tint}`}
                              >
                                <Users className="w-3 h-3" />
                                View Members
                              </button>
                              <div className="col-span-2 flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onEdit(leader)}
                                  className="p-1.5 rounded-lg text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDelete(leader)}
                                  className="p-1.5 rounded-lg text-tertiary-label transition-colors hover:bg-system-red/15 hover:text-rose-700 dark:hover:text-system-red"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unassigned Section Members */}
                    {!isCollapsed && unassignedMembersBySection[sectionName]?.length > 0 && (
                      <div className="mt-4 p-4 rounded-2xl border border-system-orange/20 bg-system-orange/10 dark:bg-system-orange/[0.06]">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-amber-700 dark:text-system-orange" />
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-system-orange">
                            Section Members (Unassigned to Leader)
                          </h4>
                          <span className="px-1.5 py-0.5 rounded-full bg-system-orange/15 text-[10px] font-bold text-amber-700 dark:text-system-orange">
                            {unassignedMembersBySection[sectionName].length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {unassignedMembersBySection[sectionName].map((m) => (
                            <div
                              key={m.id}
                              className="bg-secondary-system-grouped-background dark:bg-white/[0.06] p-2 rounded-lg text-center"
                            >
                              <p className="text-[11px] font-semibold text-label truncate">
                                {m.full_name}
                              </p>
                              <p className="text-[9px] text-tertiary-label font-mono">
                                #{m.membership_id}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-system-fill flex items-center justify-center mb-4">
                <UserCog className="w-8 h-8 text-tertiary-label" />
              </div>
              <h4 className="text-title-3 font-semibold text-label mb-1">No leaders found</h4>
              <p className="text-footnote text-secondary-label max-w-sm text-center">
                {searchTerm || sectionFilter
                  ? 'Try adjusting your search.'
                  : 'Add your first leader to get started.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaderDirectory;
