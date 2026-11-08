import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Pencil,
  Trash2,
  Search,
  Download,
  UserPlus,
  Phone,
  Filter,
  X,
  Check,
  Clock,
  Award,
  CalendarDays,
  Archive,
  Loader2
} from 'lucide-react';
import Badge from '../ui/Badge';
import BulkEditModal from './BulkEditModal';
import { fdatetime } from '../../utils/date';
import BulkDeleteModal from './BulkDeleteModal';
import PendingDeletionModal from './PendingDeletionModal';
import { adminAPI } from '../../services/api';
import MemberDetailsDrawer from '../MemberDetailsDrawer';

const avatarColors = [
  'bg-violet-500',
  'bg-system-blue',
  'bg-system-green',
  'bg-system-orange',
  'bg-system-red',
  'bg-system-indigo',
  'bg-system-teal',
  'bg-system-pink'
];

const attendanceStatusOptions = [
  { value: 'all', label: 'All Members' },
  { value: '30', label: 'Not attended in 30+ days' },
  { value: '60', label: 'Not attended in 60+ days' },
  { value: '90', label: 'Not attended in 90+ days' },
  { value: '6months', label: 'Not attended in 6+ months' },
  { value: 'never', label: 'Never attended' },
  { value: 'risk', label: 'At Risk (attendance declining)' }
];

const dateToUtc = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const daysBetween = (from, to) => {
  const fromUtc = dateToUtc(from);
  const toUtc = dateToUtc(to);
  return fromUtc === null || toUtc === null ? null : Math.floor((toUtc - fromUtc) / 86400000);
};

const sixMonthsBefore = (value) => {
  const utc = dateToUtc(value);
  if (utc === null) return '';
  const date = new Date(utc);
  const targetMonth = date.getUTCMonth() - 6;
  const firstOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return firstOfTargetMonth.toISOString().slice(0, 10);
};

const formatAttendanceDate = (value) => {
  const utc = dateToUtc(value);
  return utc === null
    ? 'Never'
    : new Date(utc).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      });
};

const isNotExpectedToAttend = (member) => {
  const status = String(member.status || 'active')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  return (
    member.is_active === 0 ||
    member.is_active === false ||
    Boolean(member.soft_deleted_at) ||
    /inactive|on leave|transferred|suspended|archived|deceased|retired|resigned|removed|relocated|not expected|non ?attending/.test(
      status
    )
  );
};

// Member search + select component for the assign title modal
function MemberSearchSelect({ members, selectedId, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  const selected = useMemo(
    () => members.find((m) => Number(m.id) === Number(selectedId)),
    [members, selectedId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return members.slice(0, 20);
    const t = search.toLowerCase();
    return members.filter((m) => (m.full_name || '').toLowerCase().includes(t)).slice(0, 20);
  }, [search, members]);

  const displayValue = focused ? search : selected ? selected.full_name : search;

  const isLoading = members.length === 0;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        if (!selectedId) {
          setSearch('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedId]);

  return (
    <div className="relative" ref={ref}>
      <label className="input-label">Member</label>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (selectedId) onChange(null);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            setFocused(false);
            if (!selectedId) setSearch('');
          }, 200);
        }}
        placeholder={isLoading ? 'Loading members...' : 'Search member name...'}
        disabled={isLoading}
        className="input w-full"
      />
      {isLoading && (
        <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl border border-separator/60 bg-secondary-system-grouped-background py-2 shadow-lg shadow-black/5 dark:border-white/[0.1] dark:bg-tertiary-system-background animate-fade-in">
          <div className="px-4 py-2.5 text-sm text-secondary-label flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-primary-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading members...
          </div>
        </div>
      )}
      {open && !isLoading && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-separator/60 bg-secondary-system-grouped-background max-h-48 overflow-y-auto shadow-lg shadow-black/5 dark:border-white/[0.1] dark:bg-tertiary-system-background animate-fade-in">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setSearch('');
                setOpen(false);
                setFocused(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                Number(m.id) === Number(selectedId)
                  ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                  : 'text-label hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.05]'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-primary-500/[0.12] text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                {(m.full_name || '')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="truncate font-medium">{m.full_name}</span>
              {m.section_name && (
                <span className="text-[10px] text-tertiary-label ml-auto shrink-0">
                  {m.section_name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {focused && !selectedId && !open && search.trim() && (
        <p className="text-[11px] text-rose-700 dark:text-system-red mt-1">
          Please select a member from the list
        </p>
      )}
    </div>
  );
}

const MemberDirectory = ({
  allMembers,
  sections,
  leaders,
  onEdit,
  onAdd,
  onRefresh,
  canDelete = false,
  currentUserMemberId = null,
  sectionFilter: externalSectionFilter,
  onSectionFilterChange,
  leaderFilter: externalLeaderFilter,
  onLeaderFilterChange,
  loading = false
}) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [localSectionFilter, setLocalSectionFilter] = useState('');

  // Use external filter if provided, otherwise fallback to local
  const sectionFilter =
    externalSectionFilter !== undefined ? externalSectionFilter : localSectionFilter;
  const handleSectionFilterChange = (val) => {
    // A leader belongs to a section. Avoid retaining a stale leader filter
    // after an administrator switches sections from a shared report link.
    if (
      leaderFilter &&
      val &&
      !allMembers.some((m) => m.section_name === val && m.leader_name === leaderFilter)
    ) {
      if (onLeaderFilterChange) onLeaderFilterChange('');
      else setLocalLeaderFilter('');
    }
    if (onSectionFilterChange) onSectionFilterChange(val);
    else setLocalSectionFilter(val);
  };
  const [localLeaderFilter, setLocalLeaderFilter] = useState('');
  const leaderFilter =
    externalLeaderFilter !== undefined ? externalLeaderFilter : localLeaderFilter;
  const handleLeaderFilterChange = (val) => {
    if (onLeaderFilterChange) onLeaderFilterChange(val);
    else setLocalLeaderFilter(val);
  };
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showPendingDeletion, setShowPendingDeletion] = useState(false);
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [attendanceStats, setAttendanceStats] = useState({});
  const [attendanceAsOfDate, setAttendanceAsOfDate] = useState('');
  const [attendanceStatsLoading, setAttendanceStatsLoading] = useState(true);
  const [attendanceStatsError, setAttendanceStatsError] = useState('');
  const [sortField, setSortField] = useState('full_name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const selectAllCheckboxRef = useRef(null);
  const [memberTitles, setMemberTitles] = useState({});
  const [allTitles, setAllTitles] = useState([]);
  const [titleAssignMember, setTitleAssignMember] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const { showToast } = useToast();
  const [titleForm, setTitleForm] = useState({ title_id: '', appointment_date: '', notes: '' });
  const [editingTitleAssignment, setEditingTitleAssignment] = useState(null);
  const [viewHistoryFor, setViewHistoryFor] = useState(null);
  const [titleHistory, setTitleHistory] = useState([]);
  const [detailsMember, setDetailsMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const [archiveInstead, setArchiveInstead] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const profileMemberId = Number(searchParams.get('profile'));

  const fetchAttendanceInsights = useCallback(async () => {
    setAttendanceStatsLoading(true);
    setAttendanceStatsError('');
    try {
      const response = await adminAPI.getMemberAttendanceInsights();
      setAttendanceStats(response.data?.members || {});
      setAttendanceAsOfDate(response.data?.as_of_date || '');
      return true;
    } catch (error) {
      console.error('Failed to load member attendance insights:', error);
      setAttendanceStatsError('Attendance information is temporarily unavailable.');
      return false;
    } finally {
      setAttendanceStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceInsights();
  }, [fetchAttendanceInsights]);

  // Global search navigates here with ?profile=<member id>. Resolve that ID
  // once the directory data is available and open the profile immediately.
  useEffect(() => {
    if (!Number.isInteger(profileMemberId) || profileMemberId < 1) return;
    const member = allMembers.find((item) => Number(item.id) === profileMemberId);
    if (member) setDetailsMember(member);
  }, [allMembers, profileMemberId]);

  const closeDetails = () => {
    setDetailsMember(null);
    if (!Number.isInteger(profileMemberId) || profileMemberId < 1) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('profile');
    setSearchParams(nextParams, { replace: true });
  };

  const fetchMemberTitles = useCallback(
    async (memberId) => {
      try {
        const res = await adminAPI.getMemberTitles(memberId);
        setMemberTitles((prev) => ({ ...prev, [memberId]: res.data || [] }));
      } catch (err) {
        console.error('Failed to fetch member titles:', err);
        showToast({
          type: 'error',
          title: 'Failed to load titles',
          message: err.message || 'Could not load member titles'
        });
      }
    },
    [showToast]
  );

  const fetchAllTitles = useCallback(async () => {
    try {
      const res = await adminAPI.getTitles();
      setAllTitles(res.data || []);
    } catch (err) {
      console.error('Failed to fetch titles:', err);
      showToast({
        type: 'error',
        title: 'Failed to load titles',
        message: err.message || 'Could not load title list'
      });
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllTitles();
  }, [fetchAllTitles]);

  // Preload all members for the assign modal (in case allMembers prop is empty/stale)
  const [allMembersLoaded, setAllMembersLoaded] = useState(false);
  const [modalMembers, setModalMembers] = useState([]);

  useEffect(() => {
    if (!allMembersLoaded && allMembers.length > 0) {
      setModalMembers(allMembers);
      setAllMembersLoaded(true);
    }
  }, [allMembers, allMembersLoaded]);

  const ensureModalMembersLoaded = useCallback(async () => {
    if (modalMembers.length === 0) {
      try {
        const res = await adminAPI.getMembers({ limit: 5000 });
        setModalMembers(res.data || []);
      } catch (err) {
        console.error('Failed to load members for modal:', err);
        showToast({ type: 'error', title: 'Failed to load members', message: err.message });
      }
    }
  }, [modalMembers.length, showToast]);

  useEffect(() => {
    if (!viewHistoryFor) {
      setTitleHistory([]);
      return;
    }
    let cancelled = false;
    adminAPI
      .getMemberTitleHistory(viewHistoryFor.memberId, viewHistoryFor.titleId)
      .then((res) => {
        if (!cancelled) setTitleHistory(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTitleHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewHistoryFor]);

  const handleAssignTitle = async (memberId) => {
    if (!memberId) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Please select a member' });
      return;
    }
    if (!titleForm.title_id) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Please select a title' });
      return;
    }
    setAssignSaving(true);
    try {
      await adminAPI.assignMemberTitle(memberId, titleForm.title_id, {
        appointment_date: titleForm.appointment_date || null,
        notes: titleForm.notes || null
      });
      showToast({
        type: 'success',
        title: 'Title Assigned',
        message: 'Title has been assigned successfully'
      });
      setTitleForm({ title_id: '', appointment_date: '', notes: '' });
      setTitleAssignMember(null);
      await fetchMemberTitles(memberId);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Assignment Failed',
        message: err.response?.data?.error || 'Failed to assign title'
      });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleUpdateTitleAssignment = async (memberId, titleId) => {
    setAssignSaving(true);
    try {
      await adminAPI.updateMemberTitle(memberId, titleId, editingTitleAssignment);
      showToast({
        type: 'success',
        title: 'Assignment Updated',
        message: 'Title assignment has been updated'
      });
      setEditingTitleAssignment(null);
      await fetchMemberTitles(memberId);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.response?.data?.error || 'Failed to update assignment'
      });
    } finally {
      setAssignSaving(false);
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

  useEffect(() => {
    refreshPendingDeletionCount();
  }, [refreshPendingDeletionCount]);

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
    const tints = [
      {
        bg: 'bg-violet-500/[0.12] text-violet-700 dark:text-violet-300',
        dot: 'bg-violet-500'
      },
      {
        bg: 'bg-system-blue/[0.12] text-blue-700 dark:text-system-blue',
        dot: 'bg-system-blue'
      },
      {
        bg: 'bg-system-green/[0.12] text-emerald-700 dark:text-system-green',
        dot: 'bg-system-green'
      },
      {
        bg: 'bg-system-orange/[0.12] text-amber-700 dark:text-system-orange',
        dot: 'bg-system-orange'
      },
      {
        bg: 'bg-system-red/[0.12] text-rose-700 dark:text-system-red',
        dot: 'bg-system-red'
      },
      {
        bg: 'bg-system-indigo/[0.12] text-primary-700 dark:text-primary-300',
        dot: 'bg-system-indigo'
      }
    ];
    sections.forEach((s, i) => {
      map[s.name] = tints[i % tints.length];
    });
    return map;
  }, [sections]);

  const uniqueLeaders = useMemo(() => {
    const names = [
      ...new Set(
        allMembers
          .filter((m) => !sectionFilter || m.section_name === sectionFilter)
          .map((m) => m.leader_name)
          .filter(Boolean)
      )
    ];
    return names.sort();
  }, [allMembers, sectionFilter]);

  const filteredMembers = useMemo(() => {
    const asOfDate = attendanceAsOfDate || new Date().toISOString().slice(0, 10);
    const sixMonthCutoff = sixMonthsBefore(asOfDate);
    let result = allMembers.map((member) => {
      const stats = attendanceStats[member.id] || {};
      const lastAttendanceDate = stats.last_attendance_date || null;
      const daysSinceLastAttendance = lastAttendanceDate
        ? daysBetween(lastAttendanceDate, asOfDate)
        : null;
      const joinedDate = member.created_at || member.visitor_date;
      const daysSinceJoined = daysBetween(joinedDate, asOfDate);
      return {
        ...member,
        ...stats,
        last_attendance_date: lastAttendanceDate,
        days_since_last_attendance: daysSinceLastAttendance,
        total_attendance_count: Number(stats.total_attendance_count) || 0,
        days_since_joined: daysSinceJoined,
        is_six_month_absence: Boolean(lastAttendanceDate && lastAttendanceDate <= sixMonthCutoff)
      };
    });
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name?.toLowerCase().includes(term) ||
          m.membership_id?.toLowerCase().includes(term) ||
          m.phone?.toLowerCase().includes(term) ||
          m.secondary_phone?.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.education_level?.toLowerCase().includes(term) ||
          m.section_name?.toLowerCase().includes(term) ||
          m.leader_name?.toLowerCase().includes(term)
      );
    }
    if (sectionFilter) {
      result = result.filter((m) => m.section_name === sectionFilter);
    }
    if (leaderFilter) {
      result = result.filter((m) => m.leader_name === leaderFilter);
    }
    if (ageGroupFilter && ageGroupFilter !== 'all') {
      result = result.filter((m) => {
        const ag = String(m.age_group || '').toLowerCase();
        switch (ageGroupFilter) {
          case 'children':
            return /(child|infant|toddler|pre-teen|kid)/.test(ag);
          case 'youth':
            return /(teen|youth)/.test(ag);
          case 'adult':
            return /adult/.test(ag);
          case 'senior':
            return /(senior|elder|grand)/.test(ag);
          default:
            return ag === ageGroupFilter;
        }
      });
    }
    if (genderFilter && genderFilter !== 'all') {
      result = result.filter((m) => {
        const g = String(m.gender || '')
          .trim()
          .toLowerCase();
        if (genderFilter === 'male') return g.startsWith('m') || g === 'man';
        if (genderFilter === 'female')
          return g.startsWith('f') || g.startsWith('w') || g === 'woman';
        return g === genderFilter;
      });
    }

    if (attendanceFilter !== 'all') {
      result = result.filter((member) => {
        if (
          attendanceStatsLoading ||
          attendanceStatsError ||
          isNotExpectedToAttend(member) ||
          member.days_since_joined === null ||
          member.days_since_joined < 14
        ) {
          return false;
        }
        const daysAbsent = member.days_since_last_attendance;
        const neverAttended = !member.last_attendance_date;
        switch (attendanceFilter) {
          case '30':
            return !neverAttended && daysAbsent >= 30;
          case '60':
            return !neverAttended && daysAbsent >= 60;
          case '90':
            return !neverAttended && daysAbsent >= 90;
          case '6months':
            return !neverAttended && member.is_six_month_absence;
          case 'never':
            return neverAttended && member.days_since_joined > 14;
          case 'risk': {
            const currentCount = Number(member.current_90_day_count) || 0;
            const previousCount = Number(member.previous_90_day_count) || 0;
            return (
              (previousCount > 0 && currentCount < previousCount * 0.5) ||
              member.missed_last_three_expected_days
            );
          }
          default:
            return true;
        }
      });
    }

    const absenceFilters = ['30', '60', '90', '6months', 'never'];
    result.sort((a, b) => {
      if (absenceFilters.includes(attendanceFilter)) {
        if (attendanceFilter === 'never') return b.days_since_joined - a.days_since_joined;
        const aDate = a.last_attendance_date || '9999-12-31';
        const bDate = b.last_attendance_date || '9999-12-31';
        return aDate.localeCompare(bDate);
      }
      const aVal = String(a[sortField] || '').toLowerCase();
      const bVal = String(b[sortField] || '').toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [
    allMembers,
    searchTerm,
    sectionFilter,
    leaderFilter,
    ageGroupFilter,
    genderFilter,
    attendanceFilter,
    attendanceStats,
    attendanceAsOfDate,
    attendanceStatsLoading,
    attendanceStatsError,
    sortField,
    sortDir
  ]);

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
    const allFilteredSelected =
      filteredMembers.length > 0 &&
      filteredMembers.every((member) => selectedMembers.has(member.id));
    const visibleIds = new Set(filteredMembers.map((member) => member.id));
    if (allFilteredSelected) {
      setSelectedMembers((prev) => new Set([...prev].filter((id) => !visibleIds.has(id))));
    } else {
      setSelectedMembers((prev) => new Set([...prev, ...visibleIds]));
    }
  };

  const hasActiveFilters =
    sectionFilter ||
    leaderFilter ||
    ageGroupFilter !== 'all' ||
    genderFilter !== 'all' ||
    attendanceFilter !== 'all';

  const selectedDeletableMembers = useMemo(() => {
    const ownMemberId = Number(currentUserMemberId);
    const asOfDate = attendanceAsOfDate || new Date().toISOString().slice(0, 10);
    return allMembers
      .filter(
        (member) =>
          selectedMembers.has(member.id) && (!ownMemberId || Number(member.id) !== ownMemberId)
      )
      .map((member) => {
        const stats = attendanceStats[member.id] || {};
        const lastDate = stats.last_attendance_date || null;
        return {
          ...member,
          ...stats,
          last_attendance_date: lastDate,
          days_since_last_attendance: lastDate ? daysBetween(lastDate, asOfDate) : null,
          total_attendance_count: Number(stats.total_attendance_count) || 0
        };
      });
  }, [allMembers, selectedMembers, currentUserMemberId, attendanceStats, attendanceAsOfDate]);
  const allVisibleMembersSelected =
    filteredMembers.length > 0 && filteredMembers.every((member) => selectedMembers.has(member.id));

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    const hasPartialSelection = filteredMembers.some((member) => selectedMembers.has(member.id));
    selectAllCheckboxRef.current.indeterminate = hasPartialSelection && !allVisibleMembersSelected;
  }, [filteredMembers, selectedMembers, allVisibleMembersSelected]);

  const handleConfirmDelete = async () => {
    if (!deletingMember || Number(deletingMember.id) === Number(currentUserMemberId)) return;
    setDeleteLoading(true);
    try {
      await adminAPI.deleteMember(deletingMember.id, { archive: archiveInstead });
      await onRefresh?.();
      await fetchAttendanceInsights();
      setSelectedMembers((prev) => new Set([...prev].filter((id) => id !== deletingMember.id)));
      refreshPendingDeletionCount();
      showToast({
        type: 'success',
        title: archiveInstead ? 'Member archived' : 'Member moved to Trash',
        message: `${deletingMember.full_name} was ${archiveInstead ? 'archived' : 'moved to Trash'} successfully.`
      });
      setDeletingMember(null);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Could not remove member',
        message: error.data?.details || error.data?.error || error.message || 'Please try again.'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportPDF = async () => {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 20;
    let y = 20;

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pw, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Member Directory', m, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Shekina Church · ${new Date().toLocaleDateString()} · ${filteredMembers.length} members`,
      m,
      28
    );
    y = 45;

    doc.setTextColor(51, 51, 51);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Members', m, y);
    y += 8;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;

    const bodyData = filteredMembers.map((member) => [
      member.full_name || 'N/A',
      member.membership_id || 'N/A',
      member.section_name || 'N/A',
      member.leader_name || 'N/A',
      member.phone || 'N/A',
      member.email || 'N/A'
    ]);
    autoTableModule.default(doc, {
      startY: y,
      head: [['Name', 'ID', 'Section', 'Leader', 'Phone', 'Email']],
      body: bodyData,
      margin: { left: m, right: m },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pc} | Shekina Church Management System`,
        m,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`member_directory_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 text-quaternary-label">↕</span>;
    return <span className="ml-1 text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header Banner */}
      <div className="product-surface relative px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="section-eyebrow">{t('memberDirectory.subtitle')}</p>
            <h2 className="mt-0.5 text-title-2 font-semibold text-label">
              {t('memberDirectory.title')}
            </h2>
            <p className="mt-0.5 text-footnote text-secondary-label">
              {loading
                ? t('common.loading')
                : t('memberDirectory.description', {
                    count: allMembers.length,
                    sections: sections.length
                  })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-end gap-1.5">
        <button type="button" onClick={exportPDF} className="btn-secondary btn-sm focus-ring">
          <Download className="w-3.5 h-3.5" />
          PDF
        </button>
        <button
          type="button"
          onClick={() => adminAPI.exportMembers()}
          className="btn-secondary btn-sm focus-ring"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => setShowBulkEdit(true)}
          disabled={selectedMembers.size === 0}
          className="btn-secondary btn-sm focus-ring"
          title={selectedMembers.size === 0 ? 'Select members to edit' : 'Edit selected members'}
        >
          <Check className="w-3.5 h-3.5" />
          Bulk Edit
        </button>
        <button
          type="button"
          onClick={() => setShowPendingDeletion(true)}
          className="btn btn-sm focus-ring bg-system-orange/15 text-amber-700 dark:text-system-orange hover:bg-system-orange/25"
          title="Review members awaiting permanent deletion"
        >
          <Clock className="w-3.5 h-3.5" />
          Pending
          {pendingDeletionCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-system-orange px-1.5 text-xs font-bold text-white dark:bg-system-orange dark:text-white">
              {pendingDeletionCount}
            </span>
          )}
        </button>
        <button type="button" onClick={onAdd} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          <span className="whitespace-nowrap tracking-tight">Add Member</span>
        </button>
      </div>

      {/* Age Group Filter Pills */}
      <div className="tab-pills w-fit max-w-full">
        {[
          { id: 'all', label: 'All Ages' },
          { id: 'children', label: 'Children' },
          { id: 'youth', label: 'Youth' },
          { id: 'adult', label: 'Adult' },
          { id: 'senior', label: 'Senior' }
        ].map((ag) => {
          const isActive = ageGroupFilter === ag.id;
          return (
            <button
              key={ag.id}
              type="button"
              onClick={() => setAgeGroupFilter(ag.id)}
              className={`tab-pill focus-ring ${isActive ? 'active' : ''}`}
            >
              {ag.label}
            </button>
          );
        })}
        {ageGroupFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setAgeGroupFilter('all')}
            className="flex items-center justify-center px-2 py-1.5 text-tertiary-label transition-colors hover:text-label"
            title="Clear age group filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary-label" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member, leader, section, ID, phone, or email..."
              className="input pl-10 h-10 rounded-xl w-full"
            />
          </div>
          <div className="w-full lg:w-64">
            <label
              htmlFor="member-attendance-filter"
              className="mb-1 block text-[11px] font-semibold text-secondary-label"
            >
              Attendance Status
            </label>
            <div className="relative">
              {attendanceStatsLoading ? (
                <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-tertiary-label" />
              ) : (
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
              )}
              <select
                id="member-attendance-filter"
                value={attendanceFilter}
                onChange={(event) => setAttendanceFilter(event.target.value)}
                disabled={attendanceStatsLoading || Boolean(attendanceStatsError)}
                className="select h-10 w-full rounded-xl pl-10 text-sm disabled:cursor-wait disabled:opacity-60"
              >
                {attendanceStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 w-full lg:w-auto px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-transparent bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                : 'border-separator/70 text-secondary-label hover:bg-system-fill hover:text-label dark:border-white/[0.1]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {
                  [
                    sectionFilter,
                    leaderFilter,
                    ageGroupFilter !== 'all' ? ageGroupFilter : null,
                    genderFilter !== 'all' ? genderFilter : null,
                    attendanceFilter !== 'all' ? attendanceFilter : null
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-separator/60 dark:border-white/[0.08]">
            <select
              value={sectionFilter}
              onChange={(e) => handleSectionFilterChange(e.target.value)}
              className="select min-w-40 flex-1 text-sm h-9 rounded-lg"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={leaderFilter}
              onChange={(e) => handleLeaderFilterChange(e.target.value)}
              className="select min-w-40 flex-1 text-sm h-9 rounded-lg"
            >
              <option value="">All Leaders</option>
              {uniqueLeaders.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="select min-w-40 flex-1 text-sm h-9 rounded-lg font-medium"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            <select
              value={ageGroupFilter}
              onChange={(e) => setAgeGroupFilter(e.target.value)}
              className="select min-w-40 flex-1 text-sm h-9 rounded-lg"
            >
              <option value="all">All Ages</option>
              <option value="children">Children</option>
              <option value="youth">Youth</option>
              <option value="adult">Adult</option>
              <option value="senior">Senior</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  handleSectionFilterChange('');
                  handleLeaderFilterChange('');
                  setAgeGroupFilter('all');
                  setGenderFilter('all');
                  setAttendanceFilter('all');
                }}
                className="flex items-center gap-1 text-sm font-medium text-rose-700 dark:text-system-red hover:text-rose-800 dark:hover:text-system-red"
              >
                <X className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        )}
        {attendanceStatsError && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-caption-1 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
            <span>{attendanceStatsError}</span>
            <button
              type="button"
              onClick={fetchAttendanceInsights}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {sectionFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-500/[0.12] px-4 py-3 text-sm text-primary-700 dark:text-primary-300">
          <span className="font-semibold">Filtered by section:</span>
          <span>{formatSectionLabel(sectionFilter)}</span>
          <button
            type="button"
            onClick={() => handleSectionFilterChange('')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-secondary-system-grouped-background px-2.5 py-1 text-xs font-bold text-primary-700 shadow-sm hover:bg-system-fill dark:bg-white/[0.08] dark:text-primary-300"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {leaderFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-500/[0.12] px-4 py-3 text-sm text-primary-700 dark:text-primary-300">
          <span className="font-semibold">Filtered by leader:</span>
          <span>{leaderFilter}</span>
          <button
            type="button"
            onClick={() => handleLeaderFilterChange('')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-secondary-system-grouped-background px-2.5 py-1 text-xs font-bold text-primary-700 shadow-sm hover:bg-system-fill dark:bg-white/[0.08] dark:text-primary-300"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
      {genderFilter !== 'all' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-system-teal/[0.12] px-4 py-3 text-sm text-teal-700 dark:text-system-teal">
          <span className="font-semibold">Filtered by gender:</span>
          <span className="capitalize">{genderFilter}</span>
          <button
            type="button"
            onClick={() => setGenderFilter('all')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-secondary-system-grouped-background px-2.5 py-1 text-xs font-bold text-teal-700 shadow-sm hover:bg-system-fill dark:bg-white/[0.08] dark:text-system-teal"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
      {attendanceFilter !== 'all' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-system-orange/[0.12] px-4 py-3 text-sm text-amber-800 dark:text-system-orange">
          <span className="font-semibold">Attendance status:</span>
          <span>
            {attendanceStatusOptions.find((option) => option.value === attendanceFilter)?.label}
          </span>
          <button
            type="button"
            onClick={() => setAttendanceFilter('all')}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-secondary-system-grouped-background px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm hover:bg-system-fill dark:bg-white/[0.08] dark:text-system-orange"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* Bulk selection bar */}
      {selectedMembers.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-500/20 bg-primary-500/[0.08] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {selectedMembers.size} member{selectedMembers.size > 1 ? 's' : ''} selected
            </p>
            {canDelete && selectedDeletableMembers.length !== selectedMembers.size && (
              <p className="mt-0.5 text-caption-1 text-secondary-label">
                Your own member profile cannot be deleted.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canDelete && selectedDeletableMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDelete(true)}
                className="btn-danger btn-sm focus-ring"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected ({selectedDeletableMembers.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedMembers(new Set())}
              className="text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card overflow-hidden">
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center gap-4">
                <div className="h-4 w-4 animate-pulse rounded border border-separator/60 bg-system-fill dark:border-white/[0.08]" />
                <div className="h-8 w-8 animate-pulse rounded-lg bg-system-fill" />
                <div className="h-4 flex-1 animate-pulse rounded bg-system-fill" />
                <div className="hidden h-4 w-28 animate-pulse rounded bg-system-fill sm:block" />
                <div className="h-4 w-16 animate-pulse rounded bg-system-fill" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator/60 px-4 py-3 text-sm text-secondary-label dark:border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Showing <span className="font-semibold text-label">{filteredMembers.length}</span>{' '}
                of <span className="font-semibold text-label">{allMembers.length}</span> members
              </span>
              {attendanceFilter !== 'all' && (
                <span className="inline-flex items-center rounded-full bg-system-orange/[0.14] px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-system-orange">
                  Attendance Status:{' '}
                  {
                    attendanceStatusOptions.find((option) => option.value === attendanceFilter)
                      ?.label
                  }
                </span>
              )}
            </div>
            <span className="text-xs text-tertiary-label">
              {attendanceAsOfDate
                ? `Attendance as of ${formatAttendanceDate(attendanceAsOfDate)}`
                : 'Click a row to view the full profile'}
            </span>
          </div>
          <div className="max-h-[68vh] overflow-auto scrollbar-thin">
            <table className="w-full min-w-[1120px]">
              <thead className="sticky top-0 z-10 bg-secondary-system-grouped-background/95 backdrop-blur-sm">
                <tr className="border-b border-separator/60 dark:border-white/[0.08]">
                  <th className="w-10 px-4 py-3">
                    <input
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      aria-label="Select all visible members"
                      checked={allVisibleMembersSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-black/[0.12] text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="w-16 px-4 py-3 text-left text-[11px] font-semibold text-secondary-label">
                    S/N
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label cursor-pointer select-none"
                    onClick={() => handleSort('full_name')}
                  >
                    {t('table.name')}
                    <SortIcon field="full_name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label cursor-pointer select-none"
                    onClick={() => handleSort('section_name')}
                  >
                    {t('table.section')}
                    <SortIcon field="section_name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label hidden lg:table-cell cursor-pointer select-none"
                    onClick={() => handleSort('leader_name')}
                  >
                    {t('table.leader')}
                    <SortIcon field="leader_name" />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label hidden md:table-cell">
                    {t('common.phone')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label">
                    Last attended
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-secondary-label">
                    Attendance
                  </th>
                  <th className="sticky right-0 z-20 min-w-[150px] w-40 bg-secondary-system-grouped-background/95 px-4 py-3 text-right text-[11px] font-semibold text-secondary-label backdrop-blur-sm">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => {
                  const sectionStyle = sectionColorMap[member.section_name] || {
                    bg: 'bg-system-fill text-secondary-label',
                    dot: 'bg-system-gray'
                  };
                  const avatarColor = getAvatarColor(member.full_name);
                  const isSelected = selectedMembers.has(member.id);
                  const isCurrentUserMember = Number(member.id) === Number(currentUserMemberId);
                  const serialNumber = index + 1;
                  const daysAbsent = member.days_since_last_attendance;
                  const badgeIsRed = daysAbsent >= 90 || member.is_six_month_absence;
                  const absenceBadgeClass = !member.last_attendance_date
                    ? 'bg-system-fill text-secondary-label'
                    : badgeIsRed
                      ? 'bg-system-red/[0.12] text-rose-700 dark:text-system-red'
                      : daysAbsent >= 60
                        ? 'bg-system-orange/[0.14] text-amber-800 dark:text-system-orange'
                        : daysAbsent >= 30
                          ? 'bg-system-yellow/[0.18] text-amber-800 dark:text-system-yellow'
                          : 'bg-system-green/[0.12] text-emerald-700 dark:text-system-green';

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setDetailsMember(member)}
                      className={`group border-b border-separator/40 transition-colors hover:bg-system-grouped-background/70 cursor-pointer dark:border-white/[0.06] dark:hover:bg-white/[0.03] ${
                        isSelected ? 'bg-primary-500/[0.08]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Select ${member.full_name}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleSelect(member.id)}
                          className="h-4 w-4 rounded border-black/[0.12] text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      {/* Serial Number */}
                      <td className="px-4 py-3">
                        <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-lg bg-system-fill px-2.5 py-1 text-xs font-semibold tabular-nums text-secondary-label">
                          {serialNumber}
                        </span>
                      </td>
                      {/* Member */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg overflow-hidden ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                          >
                            {member.profile_picture ? (
                              <img
                                src={member.profile_picture}
                                alt={member.full_name}
                                className="h-full w-full object-cover object-[center_20%]"
                              />
                            ) : (
                              getInitials(member.full_name)
                            )}
                          </div>
                          <span className="font-semibold text-sm text-label truncate max-w-[160px]">
                            {member.full_name}
                          </span>
                        </div>
                      </td>
                      {/* Section */}
                      <td className="px-4 py-3">
                        <div
                          className={`inline-flex max-w-[12rem] items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${sectionStyle.bg}`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${sectionStyle.dot}`} />
                          <span className="truncate leading-tight">
                            {formatSectionLabel(member.section_name)}
                          </span>
                        </div>
                        {member.leader_name && (
                          <span className="mt-1 block max-w-[12rem] truncate text-[10px] text-tertiary-label lg:hidden">
                            Leader: {member.leader_name}
                          </span>
                        )}
                      </td>
                      {/* Leader */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-secondary-label truncate block max-w-[140px]">
                          {member.leader_name || '—'}
                        </span>
                      </td>
                      {/* Contact */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2 text-xs text-secondary-label">
                          {member.phone && (
                            <span className="flex items-center gap-1 tabular-nums">
                              <Phone className="w-3 h-3" />
                              {member.phone}
                            </span>
                          )}
                          {!member.phone && (
                            <span className="text-tertiary-label italic text-xs">—</span>
                          )}
                        </div>
                      </td>
                      {/* Attendance summary */}
                      <td className="px-4 py-3">
                        <span className="block text-sm font-medium text-label">
                          {attendanceStatsLoading
                            ? 'Loading…'
                            : attendanceStatsError
                              ? 'Unavailable'
                              : formatAttendanceDate(member.last_attendance_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${absenceBadgeClass}`}
                          >
                            {attendanceStatsLoading
                              ? 'Loading…'
                              : attendanceStatsError
                                ? 'Unavailable'
                                : member.last_attendance_date
                                  ? `${daysAbsent} days ago`
                                  : 'Never attended'}
                          </span>
                          <span className="text-xs text-secondary-label">
                            {attendanceStatsLoading || attendanceStatsError
                              ? '—'
                              : `${member.total_attendance_count} total`}
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              ensureModalMembersLoaded();
                              setTitleAssignMember(member.id);
                              setTitleForm({ title_id: '', appointment_date: '', notes: '' });
                            }}
                            className="p-2 rounded-lg text-tertiary-label transition-colors hover:bg-system-yellow/15 hover:text-amber-700 dark:hover:text-system-orange active:scale-90"
                            title="Assign Title"
                          >
                            <Award className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(member);
                            }}
                            className="p-2 rounded-lg text-tertiary-label transition-colors hover:bg-system-fill hover:text-primary-700 dark:hover:text-primary-300 active:scale-90"
                            title="Edit"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          {canDelete && !isCurrentUserMember && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setArchiveInstead(false);
                                setDeletingMember(member);
                              }}
                              className="rounded-lg p-2 text-tertiary-label opacity-100 transition-colors hover:bg-system-red/15 hover:text-rose-700 focus-visible:opacity-100 active:scale-90 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 dark:hover:text-system-red"
                              title="Delete member"
                              aria-label={`Delete ${member.full_name}`}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-system-fill flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-tertiary-label" />
          </div>
          <h4 className="text-title-3 font-semibold text-label mb-1">
            {attendanceFilter !== 'all' && attendanceStatsError
              ? 'Attendance history unavailable'
              : attendanceFilter !== 'all' && attendanceStatsLoading
                ? 'Loading attendance history'
                : attendanceFilter !== 'all'
                  ? `No members match ${attendanceStatusOptions.find((option) => option.value === attendanceFilter)?.label}`
                  : 'No members found'}
          </h4>
          <p className="text-footnote text-secondary-label max-w-sm text-center">
            {attendanceFilter !== 'all' && attendanceStatsError
              ? attendanceStatsError
              : attendanceFilter !== 'all' && attendanceStatsLoading
                ? 'Calculating attendance status for members…'
                : attendanceFilter !== 'all'
                  ? 'New members and members not expected to attend are excluded from attendance filters.'
                  : searchTerm || hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'Add your first member to get started.'}
          </p>
          {attendanceFilter !== 'all' && attendanceStatsError && (
            <button
              type="button"
              onClick={fetchAttendanceInsights}
              className="mt-4 rounded-lg border border-separator/60 px-3 py-2 text-sm font-semibold text-secondary-label transition-colors hover:bg-system-fill hover:text-label dark:border-white/[0.1]"
            >
              Retry attendance load
            </button>
          )}
          {attendanceFilter !== 'all' && !attendanceStatsLoading && !attendanceStatsError && (
            <button
              type="button"
              onClick={() => setAttendanceFilter('all')}
              className="mt-4 rounded-lg border border-separator/60 px-3 py-2 text-sm font-semibold text-secondary-label transition-colors hover:bg-system-fill hover:text-label dark:border-white/[0.1]"
            >
              Clear attendance filter
            </button>
          )}
        </div>
      )}

      {/* Member Details Drawer */}
      <MemberDetailsDrawer member={detailsMember} isOpen={!!detailsMember} onClose={closeDetails} />

      {deletingMember && canDelete && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !deleteLoading && setDeletingMember(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-member-title"
            className="w-full max-w-lg rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-modal dark:border-white/[0.08]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="delete-member-title" className="text-headline font-semibold text-label">
                    Remove member?
                  </h3>
                  <p className="mt-0.5 text-caption-1 text-secondary-label">
                    This keeps their attendance history and can be restored from Trash.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-system-fill/50 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-system-fill text-sm font-semibold text-secondary-label">
                  {deletingMember.profile_picture ? (
                    <img
                      src={deletingMember.profile_picture}
                      alt={deletingMember.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(deletingMember.full_name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-label">{deletingMember.full_name}</p>
                  <p className="truncate text-caption-1 text-secondary-label">
                    {deletingMember.membership_id || 'No member ID'} ·{' '}
                    {deletingMember.section_name || 'Unassigned'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-system-fill p-3 dark:bg-white/[0.04]">
                  <p className="text-caption-2 font-semibold uppercase tracking-wide text-tertiary-label">
                    Last attended
                  </p>
                  <p className="mt-1 text-sm font-medium text-label">
                    {formatAttendanceDate(deletingMember.last_attendance_date)}
                  </p>
                </div>
                <div className="rounded-lg bg-system-fill p-3 dark:bg-white/[0.04]">
                  <p className="text-caption-2 font-semibold uppercase tracking-wide text-tertiary-label">
                    Time away
                  </p>
                  <p className="mt-1 text-sm font-medium text-label">
                    {deletingMember.days_since_last_attendance === null
                      ? 'Never attended'
                      : `${deletingMember.days_since_last_attendance} days ago`}
                  </p>
                </div>
                <div className="rounded-lg bg-system-fill p-3 dark:bg-white/[0.04]">
                  <p className="text-caption-2 font-semibold uppercase tracking-wide text-tertiary-label">
                    Total attendance
                  </p>
                  <p className="mt-1 text-sm font-medium text-label">
                    {Number(deletingMember.total_attendance_count) || 0}
                  </p>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.06] p-3 text-footnote dark:border-white/[0.08]">
                <input
                  type="checkbox"
                  checked={archiveInstead}
                  onChange={(event) => setArchiveInstead(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/[0.12] text-violet-600 focus:ring-violet-500"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold text-label">
                    <Archive className="h-4 w-4 text-secondary-label" /> Archive instead
                  </span>
                  <span className="mt-0.5 block text-caption-1 text-secondary-label">
                    Retain this member in Trash and exclude them from permanent deletion.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                disabled={deleteLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="btn-danger"
              >
                {deleteLoading
                  ? archiveInstead
                    ? 'Archiving…'
                    : 'Moving to Trash…'
                  : archiveInstead
                    ? 'Archive member'
                    : 'Move to Trash'}
              </button>
            </div>
          </div>
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
          members={allMembers.map((member) => {
            const stats = attendanceStats[member.id] || {};
            const lastDate = stats.last_attendance_date || null;
            const asOfDate = attendanceAsOfDate || new Date().toISOString().slice(0, 10);
            return {
              ...member,
              ...stats,
              last_attendance_date: lastDate,
              days_since_last_attendance: lastDate ? daysBetween(lastDate, asOfDate) : null,
              total_attendance_count: Number(stats.total_attendance_count) || 0
            };
          })}
          initialSelectedIds={selectedDeletableMembers.map((member) => member.id)}
          currentUserMemberId={currentUserMemberId}
          onClose={() => setShowBulkDelete(false)}
          onRefresh={async () => {
            setSelectedMembers(new Set());
            await refreshPendingDeletionCount();
            await onRefresh?.();
            await fetchAttendanceInsights();
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
            <div className="px-6 py-4 border-b border-separator/60 dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-headline font-semibold text-label">Assign Title</h3>
              <button
                onClick={() => setTitleAssignMember(null)}
                className="btn-icon btn-ghost p-1.5 -mr-1.5 rounded-xl active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <MemberSearchSelect
                members={modalMembers.length > 0 ? modalMembers : allMembers}
                selectedId={titleAssignMember}
                onChange={(id) => setTitleAssignMember(id)}
              />
              <div>
                <label className="input-label">Title *</label>
                <select
                  className="select h-10"
                  value={titleForm.title_id}
                  onChange={(e) => setTitleForm({ ...titleForm, title_id: e.target.value })}
                >
                  <option value="">Select a title...</option>
                  {allTitles
                    .filter((t) => t.is_active)
                    .map((title) => {
                      const hasTitle = (memberTitles[titleAssignMember] || []).some(
                        (mt) => mt.id === title.id
                      );
                      return (
                        <option key={title.id} value={title.id} disabled={hasTitle}>
                          {title.name}
                          {hasTitle ? ' (already assigned)' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="input-label">Appointment Date</label>
                <input
                  type="date"
                  className="input h-10"
                  value={titleForm.appointment_date}
                  onChange={(e) => setTitleForm({ ...titleForm, appointment_date: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={titleForm.notes}
                  onChange={(e) => setTitleForm({ ...titleForm, notes: e.target.value })}
                  placeholder="Reason for assignment, term, etc."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-separator/60 dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => {
                  setTitleAssignMember(null);
                  setTitleForm({ title_id: '', appointment_date: '', notes: '' });
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignTitle(titleAssignMember)}
                disabled={!titleForm.title_id || assignSaving}
                className="btn-primary flex-1"
              >
                {assignSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}
                    Assigning...
                  </span>
                ) : (
                  'Assign'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Assignment Modal */}
      {editingTitleAssignment && (
        <div className="modal-overlay" onClick={() => setEditingTitleAssignment(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-separator/60 dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-headline font-semibold text-label">Edit Assignment</h3>
              <button
                onClick={() => setEditingTitleAssignment(null)}
                className="btn-icon btn-ghost p-1.5 -mr-1.5 rounded-xl active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label">Status</label>
                <select
                  className="select h-10"
                  value={editingTitleAssignment.status}
                  onChange={(e) =>
                    setEditingTitleAssignment({ ...editingTitleAssignment, status: e.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="input-label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editingTitleAssignment.notes}
                  onChange={(e) =>
                    setEditingTitleAssignment({ ...editingTitleAssignment, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-separator/60 dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => setEditingTitleAssignment(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateTitleAssignment(
                    editingTitleAssignment.memberId,
                    editingTitleAssignment.titleId
                  )
                }
                disabled={assignSaving}
                className="btn-primary flex-1"
              >
                {assignSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}
                    Saving...
                  </span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title History Modal */}
      {viewHistoryFor && (
        <div
          className="modal-overlay"
          onClick={() => {
            setViewHistoryFor(null);
          }}
        >
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-separator/60 dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-headline font-semibold text-label">
                <span className="text-secondary-label font-normal">History:</span>{' '}
                {viewHistoryFor.titleName}
              </h3>
              <button
                onClick={() => setViewHistoryFor(null)}
                className="btn-icon btn-ghost p-1.5 -mr-1.5 rounded-xl active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {titleHistory.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-tertiary-label">
                  <span className="w-5 h-5 border-2 border-separator border-t-primary-500 rounded-full animate-spin mr-3" />
                  Loading history...
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
                  {titleHistory.map((h) => {
                    const variantMap = {
                      assigned: 'success',
                      removed: 'danger',
                      status_changed: 'warning',
                      notes_updated: 'info'
                    };
                    return (
                      <div
                        key={h.id}
                        className="p-4 rounded-xl bg-system-grouped-background/70 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={variantMap[h.action] || 'neutral'}
                            className="text-[10px] px-2 py-0.5 uppercase tracking-wider"
                          >
                            {h.action.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-tertiary-label font-medium">
                            {fdatetime(h.created_at)}
                          </span>
                        </div>
                        {h.old_status && h.new_status && (
                          <p className="text-xs text-secondary-label">
                            Status:{' '}
                            <span
                              className={
                                h.old_status === 'active'
                                  ? 'text-emerald-700 dark:text-system-green'
                                  : 'text-secondary-label'
                              }
                            >
                              {h.old_status}
                            </span>
                            {' → '}
                            <span
                              className={
                                h.new_status === 'active'
                                  ? 'text-emerald-700 dark:text-system-green font-semibold'
                                  : 'text-secondary-label'
                              }
                            >
                              {h.new_status}
                            </span>
                          </p>
                        )}
                        {h.notes && (
                          <p className="text-xs text-secondary-label mt-1.5 italic">{h.notes}</p>
                        )}
                        {h.changed_by_name && (
                          <p className="text-[10px] text-tertiary-label mt-1.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-system-gray-3 dark:bg-system-gray-4" />
                            by {h.changed_by_name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDirectory;
