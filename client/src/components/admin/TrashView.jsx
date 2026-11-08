import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { fdatetime } from '../../utils/date';
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  Loader2,
  Users,
  XCircle,
  CheckCircle2,
  Clock,
  Phone,
  Award
} from 'lucide-react';

const asArray = (v) => (Array.isArray(v) ? v : []);
const R = (v) => Math.round(Number(v) || 0);

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-secondary-system-grouped-background p-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${color}`}>
      <Icon className="w-3.5 h-3.5" />
    </div>
    <p className="text-lg font-semibold text-label">{value}</p>
    <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
      {label}
    </p>
  </div>
);

const TrashView = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getTrash();
      setMembers(asArray(res.data?.members));
    } catch (e) {
      console.error('Trash load failed:', e);
      showMessage('error', 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (id, name) => {
    setActionLoading(id);
    try {
      await adminAPI.restoreFromTrash(id);
      showMessage('success', `${name} restored successfully`);
      loadTrash();
    } catch (e) {
      showMessage('error', `Failed to restore ${name}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id) => {
    setActionLoading(`del-${id}`);
    try {
      await adminAPI.permanentDelete(id);
      showMessage('success', 'Member permanently deleted');
      setConfirmDelete(null);
      loadTrash();
    } catch (e) {
      showMessage('error', 'Failed to delete member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading('empty');
    try {
      const res = await adminAPI.emptyTrash();
      showMessage('success', res.data?.message || 'Trash emptied');
      setConfirmEmpty(false);
      loadTrash();
    } catch (e) {
      showMessage('error', 'Failed to empty trash');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const haystack = [m.full_name, m.membership_id, m.phone, m.email, m.section_name, m.leader_name]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const totalAttendance = members.reduce((sum, m) => sum + R(m.attendance_count), 0);
  const oldestDays = members.reduce((max, m) => Math.max(max, R(m.days_inactive) || 0), 0);
  const removableMemberCount = members.filter(
    (member) =>
      !String(member.status || '')
        .toLowerCase()
        .startsWith('archived')
  ).length;

  return (
    <div className="space-y-4">
      {/* Message */}
      {message && (
        <div
          className={`rounded-xl px-4 py-2.5 text-caption-1 font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800'}`}
        >
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-headline font-semibold text-label flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-secondary-label" /> Trash
          </h1>
          <p className="text-caption-1 text-secondary-label mt-0.5">
            Deleted members can be restored or permanently removed. Archived members stay here until
            restored and are excluded from permanent deletion.
          </p>
        </div>
        {removableMemberCount > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            disabled={actionLoading === 'empty'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption-1 font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-900/40 transition-colors"
          >
            {actionLoading === 'empty' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Empty Trash
          </button>
        )}
      </div>

      {/* Stats */}
      {members.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="In Trash"
            value={members.length}
            icon={Users}
            color="text-secondary-label bg-system-grouped-background/30"
          />
          <StatCard
            label="Attendance Records"
            value={totalAttendance}
            icon={Clock}
            color="text-amber-600 bg-amber-50 dark:bg-amber-950/30"
          />
          <StatCard
            label="Oldest (days)"
            value={oldestDays}
            icon={AlertTriangle}
            color="text-rose-600 bg-rose-50 dark:bg-rose-950/30"
          />
        </div>
      )}

      {/* Search */}
      {members.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-tertiary-label" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deleted members by name, ID, phone, section..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-caption-1 border border-black/[0.06] dark:border-white/[0.08] bg-secondary-system-grouped-background text-label focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-tertiary-label" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-system-fill flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-footnote font-semibold text-secondary-label">Trash is empty</p>
          <p className="text-caption-1 text-tertiary-label mt-1">
            No deleted members to show. When you delete a member, they'll appear here.
          </p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-footnote text-tertiary-label">No members match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((m) => {
            const days = R(m.days_inactive);
            const isOld = days >= 180;
            return (
              <div
                key={m.id}
                className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-secondary-system-grouped-background p-3 hover:border-black/[0.12] dark:hover:border-white/[0.16] transition-colors"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-footnote font-semibold shrink-0 ${isOld ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-system-fill text-secondary-label dark:bg-white/[0.06]'}`}
                  >
                    {m.full_name?.charAt(0) || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-footnote font-semibold text-label truncate">
                        {m.full_name}
                      </p>
                      {String(m.status || '')
                        .toLowerCase()
                        .startsWith('archived') && (
                        <span className="rounded-full bg-primary-500/[0.12] px-2 py-0.5 text-caption-2 font-semibold text-primary-700 dark:text-primary-300">
                          Archived
                        </span>
                      )}
                      <span className="text-caption-2 text-tertiary-label font-mono">
                        #{m.membership_id}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {m.section_name && (
                        <span className="text-caption-2 text-secondary-label">
                          {m.section_name}
                        </span>
                      )}
                      {m.leader_name && (
                        <span className="text-caption-2 text-tertiary-label">
                          Leader: {m.leader_name}
                        </span>
                      )}
                      {m.phone && (
                        <span className="text-caption-2 text-tertiary-label inline-flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {m.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`text-caption-2 font-semibold inline-flex items-center gap-0.5 ${isOld ? 'text-rose-600' : 'text-tertiary-label'}`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {days} day{days !== 1 ? 's' : ''} ago
                      </span>
                      <span className="text-caption-2 text-tertiary-label">
                        Deleted: {fdatetime(m.soft_deleted_at)}
                      </span>
                      {R(m.attendance_count) > 0 && (
                        <span className="text-caption-2 text-amber-500 inline-flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5" />
                          {m.attendance_count} records
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleRestore(m.id, m.full_name)}
                      disabled={actionLoading === m.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-caption-1 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800"
                      title="Restore member"
                    >
                      {actionLoading === m.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Restore
                    </button>
                    {!String(m.status || '')
                      .toLowerCase()
                      .startsWith('archived') && (
                      <button
                        onClick={() => setConfirmDelete(m)}
                        disabled={actionLoading === `del-${m.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-caption-1 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40 transition-colors border border-rose-200 dark:border-rose-800"
                        title="Delete permanently"
                      >
                        {actionLoading === `del-${m.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm single delete modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-secondary-system-grouped-background rounded-2xl shadow-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-footnote font-semibold text-label">
                    Permanently delete member?
                  </h3>
                  <p className="text-caption-1 text-secondary-label mt-1">
                    You are about to <strong className="text-rose-600">permanently delete</strong>{' '}
                    <strong className="text-secondary-label">{confirmDelete.full_name}</strong>.
                    This action <strong>cannot be undone</strong>. All attendance records,
                    follow-ups, and history for this member will be lost forever.
                  </p>
                </div>
              </div>
              {R(confirmDelete.attendance_count) > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5 mb-4">
                  <p className="text-caption-1 text-amber-700 dark:text-amber-300 font-semibold">
                    Warning: This member has {confirmDelete.attendance_count} attendance records
                    that will be permanently lost.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-caption-1 font-semibold px-4 py-2 rounded-lg text-secondary-label hover:bg-system-fill transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePermanentDelete(confirmDelete.id)}
                  disabled={actionLoading === `del-${confirmDelete.id}`}
                  className="text-caption-1 font-semibold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading === `del-${confirmDelete.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm empty trash modal */}
      {confirmEmpty && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmEmpty(false)}
        >
          <div
            className="bg-secondary-system-grouped-background rounded-2xl shadow-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-footnote font-semibold text-label">Empty trash?</h3>
                  <p className="text-caption-1 text-secondary-label mt-1">
                    You are about to{' '}
                    <strong className="text-rose-600">
                      permanently delete {members.length} member(s)
                    </strong>
                    . This action <strong>cannot be undone</strong>. All their data will be lost
                    forever.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="text-caption-1 font-semibold px-4 py-2 rounded-lg text-secondary-label hover:bg-system-fill transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmptyTrash}
                  disabled={actionLoading === 'empty'}
                  className="text-caption-1 font-semibold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading === 'empty' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Empty Trash ({members.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TrashView;
