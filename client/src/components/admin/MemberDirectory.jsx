import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { Users, Pencil, Trash2, Search, Download, UserPlus, Mail, Phone, Filter, X, ChevronLeft, Check, Clock, Award, Plus, X as XIcon } from 'lucide-react';
import Badge from '../ui/Badge';
import BulkEditModal from './BulkEditModal';
import BulkDeleteModal from './BulkDeleteModal';
import PendingDeletionModal from './PendingDeletionModal';
import { adminAPI } from '../../services/api';

const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-600',
  'from-cyan-500 to-teal-600',
  'from-fuchsia-500 to-pink-600',
];

const MemberDirectory = ({
  allMembers,
  sections,
  leaders,
  onEdit,
  onAdd,
  onDelete,
  onRefresh,
  sectionFilter: externalSectionFilter,
  onSectionFilterChange,
  leaderFilter: externalLeaderFilter,
  onLeaderFilterChange,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSectionFilter, setLocalSectionFilter] = useState('');

  // Use external filter if provided, otherwise fallback to local
  const sectionFilter = externalSectionFilter !== undefined ? externalSectionFilter : localSectionFilter;
  const handleSectionFilterChange = (val) => {
    if (onSectionFilterChange) onSectionFilterChange(val);
    else setLocalSectionFilter(val);
  };
  const [localLeaderFilter, setLocalLeaderFilter] = useState('');
  const leaderFilter = externalLeaderFilter !== undefined ? externalLeaderFilter : localLeaderFilter;
  const handleLeaderFilterChange = (val) => {
    if (onLeaderFilterChange) onLeaderFilterChange(val);
    else setLocalLeaderFilter(val);
  };
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showPendingDeletion, setShowPendingDeletion] = useState(false);
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('full_name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [expandedRow, setExpandedRow] = useState(null);
  const [memberTitles, setMemberTitles] = useState({});
  const [allTitles, setAllTitles] = useState([]);
  const [titleAssignMember, setTitleAssignMember] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const { showToast } = useToast();
  const [titleForm, setTitleForm] = useState({ title_id: '', appointment_date: '', notes: '' });
  const [editingTitleAssignment, setEditingTitleAssignment] = useState(null);
  const [viewHistoryFor, setViewHistoryFor] = useState(null);
  const [titleHistory, setTitleHistory] = useState([]);
  const [removingTitle, setRemovingTitle] = useState(null); // { memberId, titleId, titleName }

  const fetchMemberTitles = useCallback(async (memberId) => {
    try {
      const res = await adminAPI.getMemberTitles(memberId);
      setMemberTitles((prev) => ({ ...prev, [memberId]: res.data || [] }));
    } catch { /* ignore */ }
  }, []);

  const fetchAllTitles = useCallback(async () => {
    try {
      const res = await adminAPI.getTitles();
      setAllTitles(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAllTitles(); }, [fetchAllTitles]);

  useEffect(() => {
    if (!viewHistoryFor) { setTitleHistory([]); return; }
    let cancelled = false;
    adminAPI.getMemberTitleHistory(viewHistoryFor.memberId, viewHistoryFor.titleId)
      .then((res) => { if (!cancelled) setTitleHistory(res.data || []); })
      .catch(() => { if (!cancelled) setTitleHistory([]); });
    return () => { cancelled = true; };
  }, [viewHistoryFor]);

  const handleExpandRow = (memberId) => {
    const next = expandedRow === memberId ? null : memberId;
    setExpandedRow(next);
    if (next && !memberTitles[next]) {
      fetchMemberTitles(next);
    }
  };

  const handleAssignTitle = async (memberId) => {
    if (!titleForm.title_id) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Please select a title' });
      return;
    }
    setAssignSaving(true);
    try {
      await adminAPI.assignMemberTitle(memberId, titleForm.title_id, {
        appointment_date: titleForm.appointment_date || null,
        notes: titleForm.notes || null,
      });
      showToast({ type: 'success', title: 'Title Assigned', message: 'Title has been assigned successfully' });
      setTitleForm({ title_id: '', appointment_date: '', notes: '' });
      setTitleAssignMember(null);
      await fetchMemberTitles(memberId);
    } catch (err) {
      showToast({ type: 'error', title: 'Assignment Failed', message: err.response?.data?.error || 'Failed to assign title' });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleUpdateTitleAssignment = async (memberId, titleId) => {
    setAssignSaving(true);
    try {
      await adminAPI.updateMemberTitle(memberId, titleId, editingTitleAssignment);
      showToast({ type: 'success', title: 'Assignment Updated', message: 'Title assignment has been updated' });
      setEditingTitleAssignment(null);
      await fetchMemberTitles(memberId);
    } catch (err) {
      showToast({ type: 'error', title: 'Update Failed', message: err.response?.data?.error || 'Failed to update assignment' });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRemoveTitle = (memberId, titleId, titleName) => {
    setRemovingTitle({ memberId, titleId, titleName });
  };

  const confirmRemoveTitle = async () => {
    if (!removingTitle) return;
    try {
      await adminAPI.removeMemberTitle(removingTitle.memberId, removingTitle.titleId);
      showToast({ type: 'success', title: 'Title Removed', message: `${removingTitle.titleName} has been removed` });
      await fetchMemberTitles(removingTitle.memberId);
      setRemovingTitle(null);
    } catch (err) {
      showToast({ type: 'error', title: 'Removal Failed', message: err.response?.data?.error || 'Failed to remove title' });
    }
  };

  const refreshPendingDeletionCount = useCallback(async () => {
    try {
      const res = await adminAPI.getPendingDeletion();
      setPendingDeletionCount(res.data?.members?.length || 0);
    } catch {
      setPendingDeletionCount(0);
    }
  }, []);

  useEffect(() => { refreshPendingDeletionCount(); }, [refreshPendingDeletionCount]);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const formatSectionLabel = (name) => {
    if (!name) return 'Unassigned';

    const smallWords = new Set(['of', 'and', 'the', 'in', 'for', 'to']);
    return name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => {
        if (index > 0 && smallWords.has(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const sectionColorMap = useMemo(() => {
    const map = {};
    const gradients = [
      { bg: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/50', dot: 'bg-violet-500' },
      { bg: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/50', dot: 'bg-sky-500' },
      { bg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
      { bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50', dot: 'bg-amber-500' },
      { bg: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/50', dot: 'bg-rose-500' },
      { bg: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/50', dot: 'bg-indigo-500' },
    ];
    sections.forEach((s, i) => {
      map[s.name] = gradients[i % gradients.length];
    });
    return map;
  }, [sections]);

  const uniqueLeaders = useMemo(() => {
    const names = [...new Set(allMembers.map((m) => m.leader_name).filter(Boolean))];
    return names.sort();
  }, [allMembers]);

  const filteredMembers = useMemo(() => {
    let result = [...allMembers];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name?.toLowerCase().includes(term) ||
          m.membership_id?.toLowerCase().includes(term) ||
          m.phone?.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term)
      );
    }
    if (sectionFilter) {
      result = result.filter((m) => m.section_name === sectionFilter);
    }
    if (leaderFilter) {
      result = result.filter((m) => m.leader_name === leaderFilter);
    }
    // Sort
    result.sort((a, b) => {
      const aVal = (a[sortField] || '').toLowerCase();
      const bVal = (b[sortField] || '').toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [allMembers, searchTerm, sectionFilter, leaderFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const hasActiveFilters = sectionFilter || leaderFilter;

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 text-slate-300 dark:text-slate-600">↕</span>;
    return <span className="ml-1 text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 p-6 text-white shadow-xl shadow-pink-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Members</h2>
            <p className="text-sm text-white/80">
              {loading ? 'Loading members...' : `${allMembers.length} members · ${sections.length} sections`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => adminAPI.exportMembers()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowBulkEdit(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Check className="w-4 h-4" />
            Bulk Edit
          </button>
          <button
            type="button"
            onClick={() => setShowBulkDelete(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-100 hover:shadow dark:border-rose-700/60 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
            title="Soft-delete selected members (eligible for permanent deletion after 6 months)"
          >
            <Trash2 className="w-4 h-4" />
            Bulk Delete
          </button>
          <button
            type="button"
            onClick={() => setShowPendingDeletion(true)}
            className="relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 shadow-sm transition-all hover:bg-amber-100 hover:shadow dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
            title="Review members awaiting permanent deletion"
          >
            <Clock className="w-4 h-4" />
            Pending
            {pendingDeletionCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-xs font-bold text-white dark:bg-amber-300 dark:text-amber-900">
                {pendingDeletionCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="group inline-flex h-11 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-500/30 active:translate-y-0"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/18 ring-1 ring-white/20 transition-colors group-hover:bg-white/24">
              <UserPlus className="w-4 h-4" />
            </span>
            <span className="whitespace-nowrap tracking-tight">Add Member</span>
          </button>
        </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, phone, or email..."
              className="input pl-10 h-10 rounded-xl w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 w-full sm:w-auto px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {[sectionFilter, leaderFilter].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <select
              value={sectionFilter}
              onChange={(e) => handleSectionFilterChange(e.target.value)}
              className="select w-auto text-sm h-9 rounded-lg"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>

            <select
              value={leaderFilter}
              onChange={(e) => handleLeaderFilterChange(e.target.value)}
              className="select w-auto text-sm h-9 rounded-lg"
            >
              <option value="">All Leaders</option>
              {uniqueLeaders.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => { handleSectionFilterChange(''); handleLeaderFilterChange(''); }}
                className="flex items-center gap-1 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium"
              >
                <X className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {sectionFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-800/60 dark:bg-primary-900/20 dark:text-primary-300">
          <span className="font-semibold">Filtered by section:</span>
          <span>{formatSectionLabel(sectionFilter)}</span>
          <button
            type="button"
            onClick={() => handleSectionFilterChange('')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-primary-700 shadow-sm hover:bg-primary-100 dark:bg-slate-800 dark:text-primary-300"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {leaderFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-800/60 dark:bg-primary-900/20 dark:text-primary-300">
          <span className="font-semibold">Filtered by leader:</span>
          <span>{leaderFilter}</span>
          <button
            type="button"
            onClick={() => handleLeaderFilterChange('')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-primary-700 shadow-sm hover:bg-primary-100 dark:bg-slate-800 dark:text-primary-300"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* Bulk selection bar */}
      {selectedMembers.size > 0 && (
        <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedMembers.size} member{selectedMembers.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedMembers(new Set())}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 font-medium"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center gap-4">
                <div className="h-4 w-4 animate-pulse rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700" />
                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
                <div className="hidden h-4 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-700 sm:block" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Showing all <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredMembers.length}</span> matching members. Scroll to browse.
          </div>
          <div className="max-h-[68vh] overflow-auto scrollbar-thin">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80">
                  <th className="w-10 px-4 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center transition-colors hover:border-primary-400"
                    >
                      {selectedMembers.size > 0 && selectedMembers.size === filteredMembers.length && (
                        <Check className="w-3 h-3 text-primary-600" />
                      )}
                    </button>
                  </th>
                  <th className="w-10 px-2 py-3"></th>
                  <th className="w-16 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    S/N
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSort('full_name')}>
                    Member<SortIcon field="full_name" />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => handleSort('section_name')}>
                    Section<SortIcon field="section_name" />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort('leader_name')}>
                    Leader<SortIcon field="leader_name" />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    Details
                  </th>
                  <th className="w-20 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => {
                  const sectionStyle = sectionColorMap[member.section_name] || { bg: 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600', dot: 'bg-slate-400' };
                  const avatarColor = getAvatarColor(member.full_name);
                  const isExpanded = expandedRow === member.id;
                  const isSelected = selectedMembers.has(member.id);
                  const serialNumber = index + 1;

                  return (
                    <React.Fragment key={member.id}>
                      <tr
                        className={`border-b border-slate-50 dark:border-slate-700/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-700/30 ${
                          isExpanded ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                        } ${isSelected ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleSelect(member.id)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                        {/* Expand */}
                        <td className="px-2 py-3">
                          <button
                            onClick={() => handleExpandRow(member.id)}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                          >
                            {isExpanded ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 -rotate-90" />}
                          </button>
                        </td>
                        {/* Serial Number */}
                        <td className="px-4 py-3">
                          <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {serialNumber}
                          </span>
                        </td>
                        {/* Member */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                              {getInitials(member.full_name)}
                            </div>
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                              {member.full_name}
                            </span>
                          </div>
                        </td>
                        {/* Section */}
                        <td className="px-4 py-3">
                          <div className={`inline-flex max-w-[12rem] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${sectionStyle.bg}`}>
                            <span className={`h-2 w-2 shrink-0 rounded-full ${sectionStyle.dot}`} />
                            <span className="truncate leading-tight">
                              {formatSectionLabel(member.section_name)}
                            </span>
                          </div>
                        </td>
                        {/* Leader */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[140px]">
                            {member.leader_name || '—'}
                          </span>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {member.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {member.phone}
                              </span>
                            )}
                            {member.email && !member.phone && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{member.email}</span>
                              </span>
                            )}
                            {!member.phone && !member.email && (
                              <span className="text-slate-400 dark:text-slate-500 italic text-xs">—</span>
                            )}
                          </div>
                        </td>
                        {/* Details */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            {member.gender && (
                              <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5">{member.gender}</Badge>
                            )}
                            {member.age_group && (
                              <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5">{member.age_group}</Badge>
                            )}
                            {member.home_cell_name && (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0.5">{member.home_cell_name}</Badge>
                            )}
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => onEdit(member)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(member)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Full Name</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.full_name}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">S/N</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{serialNumber}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Section</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatSectionLabel(member.section_name)}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Leader</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.leader_name || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Home Cell</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.home_cell_name || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Phone</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.phone || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Email</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.email || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Gender</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.gender || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Age Group</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.age_group || '—'}</p>
                              </div>
                              <div className="col-span-full space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Titles</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {(memberTitles[member.id] || []).map((t) => (
                                    <Badge key={t.id} variant={t.status === 'active' ? 'info' : 'neutral'} className="text-[11px] px-2 py-0.5">
                                      {t.name}
                                      <button
                                        onClick={() => setEditingTitleAssignment({ memberId: member.id, titleId: t.id, status: t.status, notes: t.notes || '' })}
                                        className="ml-1 hover:text-white/80"
                                        title="Edit assignment"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => setViewHistoryFor({ memberId: member.id, titleId: t.id, titleName: t.name })}
                                        className="ml-0.5 hover:text-white/80"
                                        title="View history"
                                      >
                                        <Clock className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveTitle(member.id, t.id, t.name)}
                                        className="ml-0.5 hover:text-white/80"
                                        title="Remove title"
                                      >
                                        <XIcon className="w-2.5 h-2.5" />
                                      </button>
                                    </Badge>
                                  ))}
                                  <button
                                    onClick={() => setTitleAssignMember(member.id)}
                                    className="inline-flex items-center gap-0.5 text-[11px] text-primary-600 hover:text-primary-700 font-medium px-1.5 py-0.5 rounded hover:bg-primary-50 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" /> Add
                                  </button>
                                </div>
                              </div>
                              <div className="col-span-full space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Address</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{member.address || '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">No members found</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            {searchTerm || hasActiveFilters ? 'Try adjusting your search or filters.' : 'Add your first member to get started.'}
          </p>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEditModal
          members={allMembers}
          sections={sections}
          leaders={leaders}
          initialSelectedIds={Array.from(selectedMembers)}
          onClose={() => setShowBulkEdit(false)}
          onRefresh={() => {
            setSelectedMembers(new Set());
            onRefresh();
          }}
        />
      )}

      {/* Bulk Soft-Delete Modal */}
      {showBulkDelete && (
        <BulkDeleteModal
          members={allMembers}
          initialSelectedIds={Array.from(selectedMembers)}
          onClose={() => setShowBulkDelete(false)}
          onRefresh={() => {
            setSelectedMembers(new Set());
            refreshPendingDeletionCount();
            onRefresh();
          }}
        />
      )}

      {/* Pending Permanent Deletion Modal */}
      {showPendingDeletion && (
        <PendingDeletionModal
          onClose={() => setShowPendingDeletion(false)}
          onRefresh={() => {
            refreshPendingDeletionCount();
            onRefresh();
          }}
        />
      )}

      {/* Title Assignment Modal (form) */}
      {titleAssignMember && (
        <div className="modal-overlay" onClick={() => setTitleAssignMember(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Assign Title</h3>
                <button onClick={() => setTitleAssignMember(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="input-label">Title *</label>
                  <select
                    className="input-field"
                    value={titleForm.title_id}
                    onChange={(e) => setTitleForm({ ...titleForm, title_id: e.target.value })}
                  >
                    <option value="">Select a title...</option>
                    {allTitles.filter((t) => t.is_active).map((title) => {
                      const hasTitle = (memberTitles[titleAssignMember] || []).some((mt) => mt.id === title.id);
                      return (
                        <option key={title.id} value={title.id} disabled={hasTitle}>
                          {title.name}{hasTitle ? ' (already assigned)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="input-label">Appointment Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={titleForm.appointment_date}
                    onChange={(e) => setTitleForm({ ...titleForm, appointment_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={titleForm.notes}
                    onChange={(e) => setTitleForm({ ...titleForm, notes: e.target.value })}
                    placeholder="Reason for assignment,任期, etc."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setTitleAssignMember(null); setTitleForm({ title_id: '', appointment_date: '', notes: '' }); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => handleAssignTitle(titleAssignMember)} disabled={!titleForm.title_id || assignSaving} className="btn-primary flex-1">
                  {assignSaving ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Assignment Modal */}
      {editingTitleAssignment && (
        <div className="modal-overlay" onClick={() => setEditingTitleAssignment(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Edit Assignment</h3>
                <button onClick={() => setEditingTitleAssignment(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="input-label">Status</label>
                  <select
                    className="input-field"
                    value={editingTitleAssignment.status}
                    onChange={(e) => setEditingTitleAssignment({ ...editingTitleAssignment, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={editingTitleAssignment.notes}
                    onChange={(e) => setEditingTitleAssignment({ ...editingTitleAssignment, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingTitleAssignment(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => handleUpdateTitleAssignment(editingTitleAssignment.memberId, editingTitleAssignment.titleId)} disabled={assignSaving} className="btn-primary flex-1">
                  {assignSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Title History Modal */}
      {viewHistoryFor && (
        <div className="modal-overlay" onClick={() => { setViewHistoryFor(null); }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">History: {viewHistoryFor.titleName}</h3>
                <button onClick={() => setViewHistoryFor(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {titleHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {titleHistory.map((h) => (
                    <div key={h.id} className="p-3 rounded-xl bg-slate-50 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={h.action === 'assigned' ? 'success' : h.action === 'removed' ? 'danger' : h.action === 'status_changed' ? 'warning' : 'neutral'} className="text-[10px] px-1.5 py-0.5 uppercase">
                          {h.action.replace('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      {h.old_status && h.new_status && (
                        <p className="text-xs text-slate-600">Status: {h.old_status} → {h.new_status}</p>
                      )}
                      {h.notes && <p className="text-xs text-slate-500 mt-0.5">{h.notes}</p>}
                      {h.changed_by_name && (
                        <p className="text-[10px] text-slate-400 mt-0.5">by {h.changed_by_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Title Confirmation Modal */}
      {removingTitle && (
        <div className="modal-overlay" onClick={() => setRemovingTitle(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Remove Title</h3>
                <button onClick={() => setRemovingTitle(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to remove <strong className="text-slate-900">{removingTitle.titleName}</strong> from this member?
                This action will be recorded in the title history.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRemovingTitle(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={confirmRemoveTitle} className="btn-danger flex-1">Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDirectory;
