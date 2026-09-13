import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaderAPI, newMemberLeaderAPI } from '../services/api';
import { getQueuedSubmissionForDate } from '../services/offlineDB';
import useOffline from './useOffline';
import { formatLocalDate } from '../utils/date';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// Local draft marks (survive refresh/close until submitted). Keyed by
// roster owner + service + date so switching context keeps each draft.
const DRAFT_PREFIX = 'attendance-draft:';
const DRAFT_TTL_DAYS = 7;
const getDraftKey = (leaderId, serviceId, date) =>
  `${DRAFT_PREFIX}${leaderId || 'self'}:${serviceId}:${date}`;
const readDraft = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.attendance === 'object' ? parsed.attendance : null;
  } catch {
    return null;
  }
};
const writeDraft = (key, attendance) => {
  try {
    if (Object.keys(attendance).length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ attendance, savedAt: new Date().toISOString() }));
    // Prune stale drafts so per-date keys don't accumulate forever.
    const cutoff = Date.now() - DRAFT_TTL_DAYS * 86400000;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX) || k === key) continue;
      const parts = k.split(':');
      const stamp = Date.parse(parts[parts.length - 1]);
      if (!Number.isNaN(stamp) && stamp < cutoff) localStorage.removeItem(k);
    }
  } catch {
    /* private mode / quota — marking still works in memory */
  }
};
const removeDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

const normalizeDay = (day) => (day || '').trim().toLowerCase();

const getWeekdayNameForDate = (dateString) => {
  const parsed = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return WEEKDAY_NAMES[new Date().getDay()];
  }
  return WEEKDAY_NAMES[parsed.getDay()];
};

const getFallbackServiceId = (services) =>
  services.find((service) => service.name?.toLowerCase().includes('main'))?.id ||
  services[0]?.id ||
  1;

const getScheduledServiceId = (services, dateString) => {
  if (!services.length) return 1;

  const weekday = normalizeDay(getWeekdayNameForDate(dateString));
  const scheduledService = services.find(
    (service) => normalizeDay(service.default_day) === weekday
  );

  return scheduledService?.id || getFallbackServiceId(services);
};

const LEADER_CORE_CACHE_PREFIX = 'leader-core-cache';

const getLeaderCoreCacheKey = (leaderId) => `${LEADER_CORE_CACHE_PREFIX}:${leaderId || 'default'}`;

const readLeaderCoreCache = (leaderId) => {
  try {
    const cached =
      localStorage.getItem(getLeaderCoreCacheKey(leaderId)) ||
      localStorage.getItem(getLeaderCoreCacheKey('latest'));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn('Failed to read offline leader cache:', error);
    return null;
  }
};

const writeLeaderCoreCache = (leaderId, snapshot) => {
  try {
    const serialized = JSON.stringify({ ...snapshot, cached_at: new Date().toISOString() });
    localStorage.setItem(getLeaderCoreCacheKey(leaderId), serialized);
    localStorage.setItem(getLeaderCoreCacheKey('latest'), serialized);
  } catch (error) {
    console.warn('Failed to save offline leader cache:', error);
  }
};

const useLeaderData = () => {
  const { isOnline, queueSubmission, syncPending, pendingCount, syncing } = useOffline();
  const { user } = useAuth();

  // Section & Members
  const [sectionInfo, setSectionInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [isHead, setIsHead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionLeaders, setSectionLeaders] = useState([]);
  const [attendanceLeaderId, setAttendanceLeaderId] = useState(null);
  const [attendanceLeaderName, setAttendanceLeaderName] = useState('');
  const [actingOnBehalf, setActingOnBehalf] = useState(false);

  const [serviceTypes, setServiceTypes] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(1);
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [leaderAssignments, setLeaderAssignments] = useState([]);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Section Overview (head leaders)
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Reports / Trends
  const [trendsData, setTrendsData] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsRange, setTrendsRange] = useState({ start: '', end: '' });

  // Member management
  const [editingMember, setEditingMember] = useState(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);
  const [autogeneratedId, setAutogeneratedId] = useState('');
  const [saving, setSaving] = useState(false);

  // Toast message
  const [message, setMessage] = useState('');

  // Absent follow-ups
  const [consecutiveAbsences, setConsecutiveAbsences] = useState([]);
  const [followUps, setFollowUps] = useState([]);

  const messageTimerRef = useRef(null);
  const serviceSelectionWasManualRef = useRef(false);
  const previousSelectedDateRef = useRef(selectedDate);
  const membersLoadSeqRef = useRef(0);
  // Draft-restore guard: each roster key restores at most once, so an
  // explicit Clear is never resurrected and server data always wins.
  const draftRestoredRef = useRef('');
  const showMessage = useCallback((msg, duration = 4000) => {
    setMessage(msg);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(''), duration);
  }, []);

  // --- Data Loaders ---
  // Eligibility Filter Helper
  const checkEligibility = useCallback(
    (member, service) => {
      if (user?.is_new_member_leader) return true;
      if (!service) return true;
      const rules = service.eligibility_rules || {};

      // Opt-out check
      if (member.opt_out_services) {
        try {
          const optOuts = JSON.parse(member.opt_out_services);
          if (optOuts.includes(service.id)) return false;
        } catch (e) {
          /* noop */
        }
      }

      // Gender check
      if (rules.gender && member.gender && rules.gender !== 'All' && member.gender !== rules.gender)
        return false;

      // Section check — seed rules list section names ("Youth") while
      // admin-saved rules may hold ids; accept either form.
      if (rules.sections && rules.sections.length > 0) {
        const candidates = new Set(
          [member.section_id, member.section_name, member.sectionName]
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
        );
        if (!rules.sections.some((s) => candidates.has(String(s)))) return false;
      }

      // Role check
      if (rules.role && rules.role !== 'All') {
        const isLeader = member.role === 'Leader' || member.is_leader;
        if (rules.role === 'Leader' && !isLeader) return false;
      }

      // Age check
      if (rules.age_range && member.date_of_birth) {
        const birthDate = new Date(member.date_of_birth);
        let age = new Date().getFullYear() - birthDate.getFullYear();
        const m = new Date().getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age--;

        const { min, max } = rules.age_range;
        if (min && age < min) return false;
        if (max && age > max) return false;
      }

      return true;
    },
    [user]
  );

  const eligibleMembers = members.filter((m) =>
    checkEligibility(
      m,
      serviceTypes.find((s) => s.id === selectedServiceId)
    )
  );

  // --- Data Loaders ---
  const loadMembers = useCallback(async () => {
    const seq = ++membersLoadSeqRef.current;
    setLoading(true);
    try {
      if (user?.is_new_member_leader) {
        const [newMembersRes, servicesRes] = await Promise.all([
          newMemberLeaderAPI.getNewMembers('probation'),
          leaderAPI.getServiceTypes()
        ]);
        if (seq !== membersLoadSeqRef.current) return;

        const mappedMembers = (newMembersRes.data || []).map((m) => ({
          id: m.id,
          membership_id: `NM-${m.id}`,
          full_name: m.full_name,
          phone: m.phone || '',
          email: m.email || ''
        }));

        const snapshot = {
          sectionInfo: {
            section_id: 'new-members',
            name: 'New Members Registration',
            leader_id: user.id,
            leader: user.full_name
          },
          members: mappedMembers,
          isHead: false,
          sectionLeaders: [],
          attendanceLeaderId: user.id,
          attendanceLeaderName: user.full_name,
          actingOnBehalf: false,
          serviceTypes: servicesRes.data
        };

        setSectionInfo(snapshot.sectionInfo);
        setMembers(snapshot.members);
        setIsHead(snapshot.isHead);
        setSectionLeaders(snapshot.sectionLeaders);
        setAttendanceLeaderId(snapshot.attendanceLeaderId);
        setAttendanceLeaderName(snapshot.attendanceLeaderName);
        setActingOnBehalf(snapshot.actingOnBehalf);
        setServiceTypes(snapshot.serviceTypes);
        setAttendance({});
        draftRestoredRef.current = '';

        const weekStart = getWeekStart(new Date(selectedDate));
        const attRes = await newMemberLeaderAPI.getWeekAttendance(weekStart);
        if (seq !== membersLoadSeqRef.current) return;
        const attData = attRes.data || [];
        const attMap = {};
        attData.forEach((r) => {
          attMap[r.new_member_id] = r.attended === 1 ? 'present' : 'absent';
        });
        setAttendance(attMap);

        setLoading(false);
        return;
      }

      const [membersRes, servicesRes] = await Promise.all([
        leaderAPI.getMembers(attendanceLeaderId, selectedDate, selectedServiceId),
        leaderAPI.getServiceTypes()
      ]);
      if (seq !== membersLoadSeqRef.current) return;

      const snapshot = {
        sectionInfo: {
          section_id: membersRes.data.section_id,
          name: membersRes.data.section_name,
          leader_id: membersRes.data.leader_id,
          leader: membersRes.data.leader_name
        },
        members: membersRes.data.members,
        isHead: Boolean(membersRes.data.is_head),
        sectionLeaders: membersRes.data.section_leaders || [],
        attendanceLeaderId: membersRes.data.attendance_leader_id,
        attendanceLeaderName: membersRes.data.attendance_leader_name || membersRes.data.leader_name,
        actingOnBehalf: Boolean(membersRes.data.acting_on_behalf),
        serviceTypes: servicesRes.data
      };

      setSectionInfo(snapshot.sectionInfo);
      setMembers(snapshot.members);
      setIsHead(snapshot.isHead);
      setSectionLeaders(snapshot.sectionLeaders);
      setAttendanceLeaderId((current) => current || snapshot.attendanceLeaderId);
      setAttendanceLeaderName(snapshot.attendanceLeaderName);
      setActingOnBehalf(snapshot.actingOnBehalf);
      setServiceTypes(snapshot.serviceTypes);
      setAttendance({});
      draftRestoredRef.current = '';
      writeLeaderCoreCache(snapshot.attendanceLeaderId || attendanceLeaderId, snapshot);
    } catch (error) {
      if (seq !== membersLoadSeqRef.current) return;
      console.error('Failed to load leader core data:', error);
      const cached = readLeaderCoreCache(attendanceLeaderId);
      if (cached) {
        setSectionInfo(cached.sectionInfo);
        setMembers(cached.members || []);
        setIsHead(Boolean(cached.isHead));
        setSectionLeaders(cached.sectionLeaders || []);
        setAttendanceLeaderId((current) => current || cached.attendanceLeaderId);
        setAttendanceLeaderName(cached.attendanceLeaderName || cached.sectionInfo?.leader || '');
        setActingOnBehalf(Boolean(cached.actingOnBehalf));
        setServiceTypes(cached.serviceTypes || []);
        showMessage('Offline roster loaded. You can mark attendance and sync later.', 6000);
      } else {
        showMessage(
          'No offline roster found. Open this page once while online before using it offline.',
          7000
        );
      }
    } finally {
      if (seq === membersLoadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [attendanceLeaderId, showMessage, user, selectedDate, selectedServiceId]);

  const handleAttendanceLeaderSelection = useCallback((leaderId) => {
    setAttendanceLeaderId(leaderId ? Number(leaderId) : null);
    setAttendance({});
    draftRestoredRef.current = '';
    setSubmitted(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    if (user?.is_new_member_leader) return;
    try {
      const response = await leaderAPI.getAssignments();
      setLeaderAssignments(response.data);
    } catch (error) {
      console.error('Failed to load leader assignments:', error);
    }
  }, [user?.is_new_member_leader]);

  const loadHistory = useCallback(async () => {
    if (user?.is_new_member_leader) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const response = await leaderAPI.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.is_new_member_leader]);

  const loadOverview = useCallback(async () => {
    if (user?.is_new_member_leader) {
      setOverviewLoading(false);
      return;
    }
    setOverviewLoading(true);
    try {
      const response = await leaderAPI.getSectionOverview(selectedDate, selectedServiceId);
      setOverviewData(response.data);
    } catch (error) {
      console.error('Failed to load section overview:', error);
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedDate, selectedServiceId, user?.is_new_member_leader]);

  const loadTrends = useCallback(async () => {
    if (user?.is_new_member_leader) {
      setTrendsLoading(false);
      return;
    }
    setTrendsLoading(true);
    try {
      const response = await leaderAPI.getAttendanceTrends(90);
      setTrendsData(response.data.trends);
      setTrendsRange(response.data.date_range);
    } catch (error) {
      console.error('Failed to load attendance trends:', error);
    } finally {
      setTrendsLoading(false);
    }
  }, [user?.is_new_member_leader]);

  const loadConsecutiveAbsences = useCallback(async () => {
    if (user?.is_new_member_leader) return;
    try {
      const response = await leaderAPI.getConsecutiveAbsences();
      setConsecutiveAbsences(response.data);
    } catch (error) {
      console.error('Failed to load consecutive absences:', error);
    }
  }, [user?.is_new_member_leader]);

  const loadFollowUps = useCallback(async () => {
    if (user?.is_new_member_leader) return;
    try {
      const response = await leaderAPI.getFollowUps();
      setFollowUps(response.data);
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    }
  }, [user?.is_new_member_leader]);

  const handleUpdateFollowUp = useCallback(
    async (memberId, data) => {
      await leaderAPI.updateFollowUp(memberId, data);
      showMessage('Follow-up saved');
      await loadFollowUps();
      await loadConsecutiveAbsences();
    },
    [loadFollowUps, loadConsecutiveAbsences, showMessage]
  );

  const handleDateSelection = useCallback(
    (nextDate) => {
      previousSelectedDateRef.current = nextDate;
      serviceSelectionWasManualRef.current = false;
      setSelectedDate(nextDate);

      if (!serviceTypes.length) return;

      const nextServiceId = getScheduledServiceId(serviceTypes, nextDate);
      setSelectedServiceId((currentId) =>
        currentId === nextServiceId ? currentId : nextServiceId
      );
    },
    [serviceTypes]
  );

  const handleServiceSelection = useCallback((serviceId) => {
    serviceSelectionWasManualRef.current = true;
    setSelectedServiceId(serviceId);
  }, []);

  const checkSubmission = useCallback(async () => {
    try {
      if (user?.is_new_member_leader) {
        setIsUnauthorized(false);
        setSubmitted(false);
        const weekStart = getWeekStart(new Date(selectedDate));
        const response = await newMemberLeaderAPI.getWeekAttendance(weekStart);
        if (response.data && response.data.length > 0) {
          const existing = {};
          response.data.forEach((r) => {
            existing[r.new_member_id] = r.attended === 1 ? 'present' : 'absent';
          });
          setAttendance(existing);
        } else {
          // Never wipe in-progress marks (e.g. a restored draft) on a late
          // empty response — roster switches reset explicitly via loadMembers.
          setAttendance((prev) => (Object.keys(prev).length > 0 ? prev : {}));
        }
        return;
      }

      const response = await leaderAPI.getAttendanceStatus(
        selectedDate,
        selectedServiceId,
        attendanceLeaderId
      );
      if (response.data.unauthorized) {
        setIsUnauthorized(true);
        setSubmitted(false);
        setAttendance({});
        return;
      }
      setIsUnauthorized(false);
      setSubmitted(response.data.submitted);
      if (response.data.submitted) {
        // Server already holds this roster — any stored draft is stale.
        removeDraft(getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate));
      }
      if (response.data.attendance && response.data.attendance.length > 0) {
        const existing = {};
        response.data.attendance.forEach((a) => {
          existing[a.member_id] = a.status;
        });
        setAttendance(existing);
      } else {
        // Never wipe in-progress marks (e.g. a restored draft) on a late
        // empty response — roster switches reset explicitly via loadMembers.
        setAttendance((prev) => (Object.keys(prev).length > 0 ? prev : {}));
      }
    } catch (error) {
      console.error('Failed to check submission:', error);
    }
  }, [selectedDate, selectedServiceId, attendanceLeaderId, user]);

  // --- Attendance Handlers ---
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const handleStatusChange = useCallback(
    (memberId, status) => {
      if (submitted && !editMode) return;
      setAttendance((prev) => ({ ...prev, [memberId]: status }));
    },
    [submitted, editMode]
  );

  // Bulk-mark a set of roster members (e.g. "Mark all present") or clear
  // marks when status is null. Callers pass the currently visible member
  // ids so bulk actions respect search/filter; omitting ids targets the
  // whole eligible roster. Respects the submitted/edit-mode lock. Clearing
  // to empty removes the stored draft explicitly (the persist effect below
  // is write-only and never deletes, so a restore can never race a save).
  const handleBulkMark = useCallback(
    (status, ids) => {
      if (submitted && !editMode) return;
      const key = getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate);
      const targets = Array.isArray(ids) ? ids : eligibleMembers.map((m) => m.id);
      if (status == null) {
        if (!Array.isArray(ids)) {
          setAttendance({});
          removeDraft(key);
          return;
        }
        const next = { ...attendance };
        targets.forEach((id) => {
          delete next[id];
        });
        setAttendance(next);
        if (Object.keys(next).length === 0) removeDraft(key);
        return;
      }
      setAttendance((prev) => {
        const next = { ...prev };
        targets.forEach((id) => {
          next[id] = status;
        });
        return next;
      });
    },
    [
      submitted,
      editMode,
      eligibleMembers,
      attendance,
      attendanceLeaderId,
      selectedServiceId,
      selectedDate
    ]
  );

  const handleToggleEdit = useCallback(() => {
    setEditError('');
    setEditMode((prev) => !prev);
  }, []);

  const handleEditSubmit = useCallback(
    async (reason) => {
      if (!reason) {
        setEditError('Please select a reason for the correction.');
        return false;
      }
      setEditSaving(true);
      setEditError('');
      try {
        const records = Object.entries(attendance).map(([member_id, status]) => ({
          member_id: parseInt(member_id),
          status
        }));
        await leaderAPI.bulkEditAttendance({
          date: selectedDate,
          service_id: selectedServiceId,
          leader_id: attendanceLeaderId,
          reason,
          records
        });
        setEditMode(false);
        showMessage('Attendance edited successfully!');
        return true;
      } catch (error) {
        setEditError(error.response?.data?.error || error.message);
        return false;
      } finally {
        setEditSaving(false);
      }
    },
    [attendance, selectedDate, selectedServiceId, attendanceLeaderId, showMessage]
  );

  const [submitError, setSubmitError] = useState('');
  const [queuedForDate, setQueuedForDate] = useState(null);

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    if (submitted) {
      setSubmitError('Attendance already submitted for this date');
      return false;
    }
    if (eligibleMembers.length === 0) {
      setSubmitError('No eligible members loaded to submit attendance for.');
      return false;
    }
    if (Object.keys(attendance).length !== eligibleMembers.length) {
      setSubmitError(
        `Please mark attendance for all eligible members before submitting. You have marked ${Object.keys(attendance).length} out of ${eligibleMembers.length}.`
      );
      return false;
    }

    setSubmitting(true);
    try {
      if (user?.is_new_member_leader) {
        if (!isOnline) {
          setSubmitError('Please reconnect to submit new member attendance.');
          return false;
        }
        const weekStart = getWeekStart(new Date(selectedDate));
        await Promise.all(
          Object.entries(attendance).map(([memberId, status]) =>
            newMemberLeaderAPI.recordAttendance(
              parseInt(memberId),
              weekStart,
              status === 'present' ? 1 : 0,
              ''
            )
          )
        );
        setSubmitted(true);
        removeDraft(getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate));
        showMessage('Attendance submitted successfully!');
        return true;
      }

      const attendanceArray = Object.entries(attendance).map(([member_id, status]) => ({
        member_id: parseInt(member_id),
        status
      }));
      const draftKey = getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate);

      if (!isOnline) {
        if (actingOnBehalf) {
          setSubmitError(
            'Please reconnect before submitting attendance on behalf of another leader.'
          );
          return false;
        }
        const result = await queueSubmission({
          date: selectedDate,
          service_id: selectedServiceId,
          attendance: attendanceArray,
          leader_id: sectionInfo?.leader_id,
          section_id: sectionInfo?.section_id
        });
        if (result.success) {
          setQueuedForDate(selectedDate);
          setSubmitted(true);
          removeDraft(draftKey);
          showMessage('Attendance saved offline — will sync when you reconnect');
          return true;
        } else if (result.reason === 'already_queued') {
          setSubmitError('Attendance already queued for this date');
          return false;
        }
        return false;
      }

      await leaderAPI.submitAttendance(
        selectedDate,
        attendanceArray,
        selectedServiceId,
        attendanceLeaderId
      );
      setSubmitted(true);
      removeDraft(draftKey);
      loadHistory();
      showMessage('Attendance submitted successfully!');
      return true;
    } catch (error) {
      setSubmitError(error.response?.data?.error || error.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    submitted,
    attendance,
    eligibleMembers.length,
    selectedDate,
    selectedServiceId,
    attendanceLeaderId,
    actingOnBehalf,
    sectionInfo,
    loadHistory,
    showMessage,
    isOnline,
    queueSubmission,
    user
  ]);

  // --- Member CRUD Handlers ---
  const openAddMember = useCallback(() => {
    setEditingMember(null);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newId = 'MEM-';
    for (let i = 0; i < 8; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
    setAutogeneratedId(newId);
    setIsMemberModalOpen(true);
  }, []);

  const openEditMember = useCallback((member) => {
    setEditingMember(member);
    setIsMemberModalOpen(true);
  }, []);

  const handleMemberSave = useCallback(
    async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const memberData = {
        membership_id: formData.get('membership_id'),
        full_name: formData.get('full_name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        gender: formData.get('gender'),
        age_group: formData.get('age_group')
      };

      setSaving(true);
      try {
        if (editingMember) {
          await leaderAPI.updateMember(editingMember.id, memberData);
          showMessage('Member updated successfully');
        } else {
          await leaderAPI.createMember(memberData);
          showMessage('Member added successfully');
        }
        setIsMemberModalOpen(false);
        setEditingMember(null);
        loadMembers();
      } catch (error) {
        showMessage(`Error saving member: ${error.response?.data?.error || error.message}`);
      } finally {
        setSaving(false);
      }
    },
    [editingMember, loadMembers, showMessage]
  );

  const handleMemberDelete = useCallback(async () => {
    if (!deletingMember) return;
    setSaving(true);
    try {
      await leaderAPI.deleteMember(deletingMember.id);
      showMessage('Member deleted successfully');
      setDeletingMember(null);
      loadMembers();
    } catch (error) {
      showMessage(`Error deleting member: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  }, [deletingMember, loadMembers, showMessage]);

  // --- Initial Load ---
  useEffect(() => {
    if (user?.is_new_member_leader) {
      setLoading(false);
      setHistoryLoading(false);
      return;
    }
    loadMembers();
    loadHistory();
    loadConsecutiveAbsences();
    loadFollowUps();
    loadAssignments();
  }, [
    user?.is_new_member_leader,
    loadMembers,
    loadHistory,
    loadConsecutiveAbsences,
    loadFollowUps,
    loadAssignments
  ]);

  // SSE push — refresh history/check-submission instantly when THIS leader's
  // attendance lands (own submission or another session submitting for them).
  useEffect(() => {
    const handleDataChanged = (e) => {
      const detail = e?.detail || {};
      if (!detail.leader_id || Number(detail.leader_id) === Number(user?.id)) {
        loadHistory();
        checkSubmission();
      }
    };
    window.addEventListener('app:data-changed', handleDataChanged);
    return () => window.removeEventListener('app:data-changed', handleDataChanged);
  }, [user?.id, loadHistory, checkSubmission]);

  useEffect(() => {
    if (selectedDate !== previousSelectedDateRef.current) {
      previousSelectedDateRef.current = selectedDate;
      serviceSelectionWasManualRef.current = false;
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!serviceTypes.length || serviceSelectionWasManualRef.current) return;

    const nextServiceId = getScheduledServiceId(serviceTypes, selectedDate);
    setSelectedServiceId((currentId) => (currentId === nextServiceId ? currentId : nextServiceId));
  }, [serviceTypes, selectedDate]);

  useEffect(() => {
    checkSubmission();
  }, [checkSubmission, selectedServiceId]);

  // Restore a stored draft once per roster key, and only when nothing is
  // marked yet — server data (applied by checkSubmission) always wins.
  // Skipped for unauthorized rosters (cards hidden; nothing to restore into).
  // Declared BEFORE the persist effect so a mount reads the draft first.
  useEffect(() => {
    if (loading || submitted || isUnauthorized || members.length === 0) return;
    if (Object.keys(attendance).length > 0) return;
    const key = getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate);
    if (draftRestoredRef.current === key) return;
    draftRestoredRef.current = key;
    const draft = readDraft(key);
    if (!draft) return;
    const validIds = new Set(members.map((m) => String(m.id)));
    const entries = Object.entries(draft).filter(
      ([id, status]) =>
        validIds.has(String(id)) && ['present', 'absent', 'excused'].includes(status)
    );
    if (entries.length === 0) return;
    setAttendance(Object.fromEntries(entries));
    showMessage(
      `Restored ${entries.length} unsent mark${entries.length === 1 ? '' : 's'} from your last session.`
    );
  }, [
    loading,
    submitted,
    isUnauthorized,
    members,
    attendance,
    attendanceLeaderId,
    selectedServiceId,
    selectedDate,
    showMessage
  ]);

  // Persist in-progress marks per roster so a refresh, crash, or closed
  // tab never loses marking progress. Write-only by design: it never
  // deletes, so a same-commit restore can never be erased by a stale
  // empty snapshot. Drafts are removed explicitly on submit, on Clear,
  // or when the server reports the roster submitted — plus 7-day TTL.
  // Skipped for unauthorized rosters (nothing markable is shown).
  useEffect(() => {
    if (submitted || isUnauthorized) return;
    if (Object.keys(attendance).length === 0) return;
    writeDraft(getDraftKey(attendanceLeaderId, selectedServiceId, selectedDate), attendance);
  }, [attendance, submitted, isUnauthorized, attendanceLeaderId, selectedServiceId, selectedDate]);

  useEffect(() => {
    if (!isOnline) {
      getQueuedSubmissionForDate(selectedDate, selectedServiceId).then((record) => {
        if (record) {
          setQueuedForDate(selectedDate);
          setSubmitted(true);
          const existing = {};
          record.attendance.forEach((a) => {
            existing[a.member_id] = a.status;
          });
          setAttendance(existing);
        } else {
          setQueuedForDate(null);
        }
      });
    }
  }, [selectedDate, selectedServiceId, isOnline]);

  useEffect(() => {
    if (isOnline) {
      syncPending(async (record) => {
        const syncedServiceId =
          record.service_id || getScheduledServiceId(serviceTypes, record.date);
        await leaderAPI.submitAttendance(record.date, record.attendance, syncedServiceId);
      }).then((result) => {
        if (result.synced > 0) {
          showMessage(`${result.synced} offline attendance submission(s) synced successfully`);
          loadHistory();
          checkSubmission();
        }
        if (result.conflicts > 0) {
          showMessage(`${result.conflicts} record(s) had conflicts — check sync status`, 6000);
        }
        if (result.failed > 0) {
          showMessage(
            `${result.failed} offline submission(s) could not sync. Keep the app open online and try refresh.`,
            7000
          );
        }
      });
    }
  }, [isOnline, serviceTypes, syncPending, showMessage, loadHistory, checkSubmission]);

  return {
    // Section info
    sectionInfo,
    isHead,
    loading,
    // Members
    members,
    // Attendance
    attendance,
    selectedDate,
    setSelectedDate,
    handleDateSelection,
    submitted,
    submitting,
    isOnline,
    pendingCount,
    syncing,
    isUnauthorized,
    leaderAssignments,
    sectionLeaders,
    attendanceLeaderId,
    attendanceLeaderName,
    actingOnBehalf,
    handleAttendanceLeaderSelection,
    handleStatusChange,
    handleBulkMark,
    handleSubmit,
    queuedForDate,
    submitError,
    // Edit mode (head leaders)
    editMode,
    editSaving,
    editError,
    handleToggleEdit,
    handleEditSubmit,
    // History
    history,
    historyLoading,
    loadHistory,
    // Overview (head)
    overviewData,
    overviewLoading,
    loadOverview,
    // Trends
    trendsData,
    trendsLoading,
    trendsRange,
    loadTrends,
    // Member management
    editingMember,
    isMemberModalOpen,
    setIsMemberModalOpen,
    deletingMember,
    setDeletingMember,
    autogeneratedId,
    saving,
    openAddMember,
    openEditMember,
    handleMemberSave,
    handleMemberDelete,
    // Message
    message,
    showMessage,
    // Refresh
    loadMembers,
    eligibleMembers,
    // Service Types
    serviceTypes,
    selectedServiceId,
    setSelectedServiceId,
    handleServiceSelection,
    // Absent follow-ups
    consecutiveAbsences,
    followUps,
    handleUpdateFollowUp
  };
};

export default useLeaderData;
