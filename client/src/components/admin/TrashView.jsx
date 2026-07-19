import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { fdate, fdatetime } from '../../utils/date';
import {
  Trash2, RotateCcw, Search, AlertTriangle, Loader2, X, Users,
  XCircle, CheckCircle2, Clock, Phone, Mail, Award
} from 'lucide-react';

const asArray = (v) => Array.isArray(v) ? v : [];
const R = (v) => Math.round(Number(v) || 0);

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

  useEffect(() => { loadTrash(); }, [loadTrash]);

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

  const filteredMembers = members.filter(m => {
    if (!search) return true;
    const haystack = [m.full_name, m.membership_id, m.phone, m.email, m.section_name, m.leader_name].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const totalAttendance = members.reduce((sum, m) => sum + R(m.attendance_count), 0);
  const oldestDays = members.reduce((max, m) => Math.max(max, R(m.days_inactive) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Message */}
      {message && (
        <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800'}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-slate-500" /> Trash
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Soft-deleted members. Restore them or permanently delete them. Permanently deleted members cannot be recovered.
          </p>
        </div>
        {members.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            disabled={actionLoading === 'empty'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-900/40 transition-colors"
          >
            {actionLoading === 'empty' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Empty Trash
          </button>
        )}
      </div>

      {/* Stats */}
      {members.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="In Trash" value={members.length} icon={Users} color="text-slate-600 bg-slate-50 dark:bg-slate-900/30" />
          <StatCard label="Attendance Records" value={totalAttendance} icon={Clock} color="text-amber-600 bg-amber-50 dark:bg-amber-950/30" />
          <StatCard label="Oldest (days)" value={oldestDays} icon={AlertTriangle} color="text-rose-600 bg-rose-50 dark:bg-rose-950/30" />
        </div>
      )}

      {/* Search */}
      {members.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search deleted members by name, ID, phone, section..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Trash is empty</p>
          <p className="text-xs text-slate-400 mt-1">No deleted members to show. When you delete a member, they'll appear here.</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No members match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map(m => {
            const days = R(m.days_inactive);
            const isOld = days >= 180;
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isOld ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                    {m.full_name?.charAt(0) || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.full_name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">#{m.membership_id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {m.section_name && <span className="text-[10px] text-slate-500">{m.section_name}</span>}
                      {m.leader_name && <span className="text-[10px] text-slate-400">Leader: {m.leader_name}</span>}
                      {m.phone && <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{m.phone}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${isOld ? 'text-rose-600' : 'text-slate-400'}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {days} day{days !== 1 ? 's' : ''} ago
                      </span>
                      <span className="text-[10px] text-slate-400">Deleted: {fdatetime(m.soft_deleted_at)}</span>
                      {R(m.attendance_count) > 0 && (
                        <span className="text-[10px] text-amber-500 inline-flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5" />{m.attendance_count} records
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(m.id, m.full_name)}
                      disabled={actionLoading === m.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800"
                      title="Restore member"
                    >
                      {actionLoading === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmDelete(m)}
                      disabled={actionLoading === `del-${m.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40 transition-colors border border-rose-200 dark:border-rose-800"
                      title="Delete permanently"
                    >
                      {actionLoading === `del-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm single delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Permanently delete member?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    You are about to <strong className="text-rose-600">permanently delete</strong>{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{confirmDelete.full_name}</strong>.
                    This action <strong>cannot be undone</strong>. All attendance records, follow-ups, and history for this member will be lost forever.
                  </p>
                </div>
              </div>
              {R(confirmDelete.attendance_count) > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2.5 mb-4">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                    Warning: This member has {confirmDelete.attendance_count} attendance records that will be permanently lost.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDelete(null)} className="text-xs font-bold px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => handlePermanentDelete(confirmDelete.id)}
                  disabled={actionLoading === `del-${confirmDelete.id}`}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading === `del-${confirmDelete.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm empty trash modal */}
      {confirmEmpty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmEmpty(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Empty trash?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    You are about to <strong className="text-rose-600">permanently delete {members.length} member(s)</strong>.
                    This action <strong>cannot be undone</strong>. All their data will be lost forever.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmEmpty(false)} className="text-xs font-bold px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleEmptyTrash}
                  disabled={actionLoading === 'empty'}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading === 'empty' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${color}`}>
      <Icon className="w-3.5 h-3.5" />
    </div>
    <p className="text-lg font-black text-slate-900 dark:text-white">{value}</p>
    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

export default TrashView;
