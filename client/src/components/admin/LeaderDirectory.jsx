import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCog, Phone, AtSign, Eye, Plus, Pencil, Trash2, Search, Shield, Users, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import Badge from '../ui/Badge';

const sectionStyles = [
  { gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700/50', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', shadow: 'shadow-violet-500/10', bar: 'from-violet-500 to-purple-600' },
  { gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700/50', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500', shadow: 'shadow-sky-500/10', bar: 'from-sky-500 to-blue-600' },
  { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700/50', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', shadow: 'shadow-emerald-500/10', bar: 'from-emerald-500 to-teal-600' },
  { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', shadow: 'shadow-amber-500/10', bar: 'from-amber-500 to-orange-600' },
  { gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700/50', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', shadow: 'shadow-rose-500/10', bar: 'from-rose-500 to-pink-600' },
  { gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-700/50', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', shadow: 'shadow-indigo-500/10', bar: 'from-indigo-500 to-blue-600' },
  { gradient: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-700/50', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500', shadow: 'shadow-cyan-500/10', bar: 'from-cyan-500 to-teal-600' },
  { gradient: 'from-fuchsia-500 to-pink-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', border: 'border-fuchsia-200 dark:border-fuchsia-700/50', text: 'text-fuchsia-700 dark:text-fuchsia-300', dot: 'bg-fuchsia-500', shadow: 'shadow-fuchsia-500/10', bar: 'from-fuchsia-500 to-pink-600' },
];

const fallbackStyle = { 
  gradient: 'from-slate-400 to-slate-500', 
  bg: 'bg-slate-50 dark:bg-slate-900/20', 
  border: 'border-slate-200 dark:border-slate-700/50', 
  text: 'text-slate-600 dark:text-slate-400', 
  dot: 'bg-slate-400', 
  shadow: 'shadow-slate-500/10', 
  bar: 'from-slate-400 to-slate-500' 
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
    allMembers.forEach(m => {
      if (!m.leader_id) return;
      if (!grouped[m.leader_id]) grouped[m.leader_id] = [];
      grouped[m.leader_id].push(m);
    });
    return grouped;
  }, [allMembers]);

  const unassignedMembersBySection = useMemo(() => {
    const grouped = {};
    allMembers.forEach(m => {
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-700 via-slate-800 to-zinc-900 p-6 text-white shadow-xl shadow-slate-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <UserCog className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Leaders</h2>
              <p className="text-sm text-white/80">
                {leadersLoading ? 'Loading leaders...' : `${totalLeaders} leaders · ${totalSections} sections`}
              </p>
            </div>
          </div>
          <button
            onClick={onAdd}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/25"
          >
            <Plus className="h-4 w-4" />
            Add Leader
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
              className="flex items-center gap-1 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium whitespace-nowrap"
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
            const style = sectionIdx >= 0 ? sectionStyles[sectionIdx % sectionStyles.length] : fallbackStyle;
            const isCollapsed = collapsedSections.has(sectionName);
            const headLeader = sectionLeaders.find((l) => l.is_head === 1);
            const memberLeaders = sectionLeaders.filter((l) => l.is_head !== 1);

            return (
              <div key={sectionName}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sectionName)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl border ${style.border} ${style.bg} hover:shadow-md transition-all group`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-sm ${style.shadow}`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h3 className={`font-bold text-sm ${style.text}`}>{sectionName}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {sectionLeaders.length} leader{sectionLeaders.length !== 1 ? 's' : ''}
                        {headLeader && <span className="ml-1.5 text-slate-400 dark:text-slate-500">· Head: {headLeader.full_name}</span>}
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
                        className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1 transition-all"
                        title="View Section Profile"
                      >
                        <Layers className="w-3 h-3 text-violet-500" /> View Section
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
                        className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      >
                        {/* Top accent bar */}
                        <div className={`h-1 bg-gradient-to-r ${style.bar}`} />

                        <div className="p-4">
                          {/* Avatar & Name */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${style.shadow}`}>
                              {leader.full_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <button onClick={() => onViewAnalytics(leader.id)} className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left" title="View Profile">
                                  {leader.full_name}
                                </button>
                                {leader.is_head === 1 && (
                                  <span className="flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50">
                                    <Shield className="w-2.5 h-2.5 text-amber-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Head</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                @{leader.username}
                              </p>
                            </div>
                          </div>

                          {/* Stats & Members */}
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <Users className="w-3.5 h-3.5" />
                              <span>{membersByLeader[leader.id]?.length || 0} Members</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onViewMembers(leader)}
                                className={`text-xs font-bold ${style.text} hover:underline decoration-2 underline-offset-4`}
                              >
                                View Members
                              </button>
                              {membersByLeader[leader.id]?.length > 0 && (
                                <button
                                  onClick={() => toggleLeaderRoster(leader.id)}
                                  className={`text-xs font-bold ${style.text} hover:underline decoration-2 underline-offset-4`}
                                >
                                  {expandedLeaderRosters.has(leader.id) ? 'Hide Roster' : 'View Roster'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable Roster */}
                          {expandedLeaderRosters.has(leader.id) && membersByLeader[leader.id] && (
                            <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-700/50 scrollbar-thin">
                              <div className="grid grid-cols-1 gap-1">
                                {membersByLeader[leader.id].map(m => (
                                  <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors group/member">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{m.full_name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono opacity-0 group-hover/member:opacity-100 transition-opacity">#{m.membership_id}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Contact */}
                          <div className="space-y-1.5 mb-3">
                            {leader.phone && (
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span className="truncate">{leader.phone}</span>
                              </div>
                            )}
                            {leader.email && (
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <AtSign className="w-3 h-3 shrink-0" />
                                <span className="truncate">{leader.email}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <button
                              onClick={() => onViewAnalytics(leader.id)}
                              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium ${style.text} ${style.bg} hover:shadow-sm transition-all`}
                            >
                              <Eye className="w-3 h-3" />
                              View Profile
                            </button>
                            <button
                              onClick={() => onViewMembers(leader)}
                              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold ${style.text} ${style.bg} hover:shadow-sm transition-all`}
                            >
                              <Users className="w-3 h-3" />
                              View Members
                            </button>
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEdit(leader)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDelete(leader)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unassigned Section Members */}
                {!isCollapsed && unassignedMembersBySection[sectionName]?.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/50 dark:border-amber-900/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Section Members (Unassigned to Leader)</h4>
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        {unassignedMembersBySection[sectionName].length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {unassignedMembersBySection[sectionName].map(m => (
                        <div key={m.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-amber-900/40 text-center">
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{m.full_name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">#{m.membership_id}</p>
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
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <UserCog className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">No leaders found</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            {searchTerm || sectionFilter ? 'Try adjusting your search.' : 'Add your first leader to get started.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaderDirectory;
