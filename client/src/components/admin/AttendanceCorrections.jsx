import React, { useEffect, useMemo, useRef, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatLocalDate, addDays, fdate, fdatetime } from '../../utils/date';
import {
  Edit3, Search, Calendar, Users, Filter, X, Clock,
  CheckCircle2, XCircle, HelpCircle, RefreshCw,
  ClipboardList, AlertTriangle, UserCheck, UserX,
  ChevronDown, ChevronUp, Save, BarChart3, Info,
} from 'lucide-react';
import Badge from '../ui/Badge';
import { useModalA11y } from '../../hooks/useModalA11y';

const STATUS_META = {
  present: { label: 'Present', icon: CheckCircle2, variant: 'success' },
  absent:  { label: 'Absent',  icon: XCircle,      variant: 'danger' },
  excused: { label: 'Excused', icon: HelpCircle,    variant: 'warning' },
};

const SUBMISSION_STATUS_META = {
  missing:   { label: 'Missing',   variant: 'danger',  icon: XCircle },
  partial:   { label: 'Partial',   variant: 'warning', icon: AlertTriangle },
  late:      { label: 'Late',      variant: 'warning', icon: Clock },
  submitted: { label: 'Completed', variant: 'success', icon: CheckCircle2 },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, variant: 'neutral' };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} dot>
      <span className="inline-flex items-center gap-1"><Icon className="w-3 h-3" />{meta.label}</span>
    </Badge>
  );
}

function SubmissionStatusBadge({ status }) {
  const meta = SUBMISSION_STATUS_META[status] || { label: status, variant: 'neutral', icon: HelpCircle };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant}>
      <span className="inline-flex items-center gap-1"><Icon className="w-3 h-3" />{meta.label}</span>
    </Badge>
  );
}

// ── Existing single-member edit modal (unchanged) ──
const EditAttendanceModal = ({ record, onClose, onSaved, showMessage }) => {
  const modalRef = useModalA11y({ isOpen: true, onClose });
  const [status, setStatus] = useState(record?.status || 'present');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!record?.id) return;
    setLoadingHistory(true);
    adminAPI.getAttendanceAudit(record.id)
      .then((res) => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [record?.id]);

  if (!record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await adminAPI.updateAttendance(record.id, status, reason.trim() || undefined);
      showMessage?.(`Attendance updated for ${record.member_name}.`);
      onSaved();
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to update attendance.', 4000);
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (val) => {
    if (!val) return '—';
    if (typeof val === 'string') {
      try { const parsed = JSON.parse(val); if (parsed && typeof parsed === 'object') return parsed; } catch (_) {}
    }
    return val;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="edit-attendance-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"><Edit3 className="h-5 w-5" /></div>
            <div>
              <h2 id="edit-attendance-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Attendance</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{record.member_name} &middot; {fdate(record.date)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/30">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Section</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.section_name || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.service_name || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leader</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.leader_name || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted by</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{record.submitted_by_name || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Membership ID</p><p className="text-sm font-mono text-slate-700 dark:text-slate-200">{record.membership_id || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current status</p><div className="mt-1"><StatusBadge status={record.status} /></div></div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">New Status</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = status === key;
                return (
                  <button key={key} type="button" onClick={() => setStatus(key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? key === 'present' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : key === 'absent' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                        : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="edit-reason" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reason for correction <span className="font-normal normal-case text-slate-400">(optional, max 500 chars)</span>
            </label>
            <textarea id="edit-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              maxLength={500} rows={3}
              placeholder="e.g. Member was actually present but leader marked absent in error."
              className="input w-full resize-none" />
            <p className="mt-1 text-right text-[10px] text-slate-400">{reason.length}/500</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" /> Edit History
            </p>
            {loadingHistory ? (
              <p className="text-xs text-slate-400">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-xs italic text-slate-400">No prior corrections.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((entry) => {
                  const oldVal = formatValue(entry.old_value);
                  const newVal = formatValue(entry.new_value);
                  return (
                    <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.editor_name || `User #${entry.editor_id || 'system'}`}</span>
                        <span className="text-[10px] text-slate-400">{fdatetime(entry.created_at)}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
                        <div><span className="text-[10px] uppercase">From:</span> {oldVal?.status || '—'}</div>
                        <div><span className="text-[10px] uppercase">To:</span> {newVal?.status || '—'}</div>
                      </div>
                      {newVal?.reason && <p className="mt-1 text-slate-500 dark:text-slate-400"><span className="text-[10px] uppercase">Reason:</span> {newVal.reason}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bulk Correction Modal for Missing Leader Submissions ──
const CORRECTION_REASONS = ['Leader forgot', 'Leader absent', 'Paper attendance', 'System recovery', 'Other'];

const BulkCorrectionModal = ({ leader, date, serviceId, onClose, onSaved, showMessage }) => {
  const modalRef = useModalA11y({ isOpen: true, onClose });
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reason, setReason] = useState(CORRECTION_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataInfo, setDataInfo] = useState(null);

  useEffect(() => {
    if (!leader) return;
    setLoading(true);
    adminAPI.getLeaderMembers(leader.leader_id, date, serviceId)
      .then(res => {
        setMembers(res.data.members || []);
        setDataInfo(res.data);
      })
      .catch(() => showMessage?.('Failed to load members.', 4000))
      .finally(() => setLoading(false));
  }, [leader, date, serviceId]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(m => m.full_name?.toLowerCase().includes(q) || m.membership_id?.toLowerCase().includes(q));
  }, [members, memberSearch]);

  const recordedCount = members.filter(m => m.status).length;
  const expectedCount = members.length;
  const allHaveStatus = members.every(m => m.status);
  const summary = useMemo(() => {
    const p = members.filter(m => m.status === 'present').length;
    const a = members.filter(m => m.status === 'absent').length;
    const e = members.filter(m => m.status === 'excused').length;
    return { present: p, absent: a, excused: e, total: p + a + e };
  }, [members]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMembers.map(m => m.member_id)));
  };

  const bulkSetStatus = (newStatus) => {
    if (selectedIds.size === 0) return;
    setMembers(prev => prev.map(m => selectedIds.has(m.member_id) ? { ...m, status: newStatus } : m));
    showMessage?.(`Marked ${selectedIds.size} member(s) as ${newStatus}.`, 2000);
  };

  const setMemberStatus = (memberId, newStatus) => {
    setMembers(prev => prev.map(m => m.member_id === memberId ? { ...m, status: newStatus } : m));
  };

  const handleSubmit = async () => {
    if (!allHaveStatus) { showMessage?.('All members must have an attendance status before saving.', 4000); return; }
    if (saving) return;
    setSaving(true);
    try {
      const records = members.map(m => ({ member_id: m.member_id, status: m.status }));
      await adminAPI.bulkCorrectAttendance({ date, service_id: serviceId, leader_id: leader.leader_id, reason, records });
      onSaved(summary.total);
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to save attendance.', 4000);
    } finally {
      setSaving(false);
    }
  };

  if (!leader) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Mark Attendance — {leader.leader_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{leader.section_name} &middot; {date} &middot; {dataInfo?.leader?.section_name || ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm"><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Loading members...</div>
          ) : (
            <>
              {/* Progress + Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Attendance Progress</p>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${expectedCount > 0 ? (recordedCount / expectedCount) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                    {recordedCount} / {expectedCount} members recorded
                    {recordedCount < expectedCount && <span className="text-amber-600 ml-1">— {expectedCount - recordedCount} remaining</span>}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-4">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div><p className="text-lg font-black text-emerald-600">{summary.present}</p><p className="text-[9px] uppercase text-slate-400">Present</p></div>
                    <div><p className="text-lg font-black text-rose-600">{summary.absent}</p><p className="text-[9px] uppercase text-slate-400">Absent</p></div>
                    <div><p className="text-lg font-black text-amber-600">{summary.excused}</p><p className="text-[9px] uppercase text-slate-400">Excused</p></div>
                    <div><p className="text-lg font-black text-slate-900 dark:text-white">{summary.total}</p><p className="text-[9px] uppercase text-slate-400">Total</p></div>
                  </div>
                </div>
              </div>

              {/* Search + Bulk Actions */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="input h-9 w-full pl-9 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">{selectedIds.size} selected</span>
                  <button type="button" onClick={toggleSelectAll}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                    {selectedIds.size === filteredMembers.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                  {[
                    { key: 'present', label: 'Present', icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800' },
                    { key: 'absent', label: 'Absent', icon: XCircle, cls: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800' },
                    { key: 'excused', label: 'Excused', icon: HelpCircle, cls: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800' },
                  ].map(act => {
                    const Icon = act.icon;
                    return (
                      <button key={act.key} type="button" onClick={() => bulkSetStatus(act.key)}
                        disabled={selectedIds.size === 0}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${act.cls}`}>
                        <Icon className="w-3 h-3" />{act.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Members Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/40 sticky top-0">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="w-10 px-3 py-2 text-left">
                          <input type="checkbox" checked={filteredMembers.length > 0 && selectedIds.size === filteredMembers.length}
                            onChange={toggleSelectAll} className="rounded border-slate-300" />
                        </th>
                        <th className="px-3 py-2 text-left text-[9px] font-bold uppercase text-slate-500">Member</th>
                        <th className="px-3 py-2 text-left text-[9px] font-bold uppercase text-slate-500">Membership ID</th>
                        <th className="px-3 py-2 text-center text-[9px] font-bold uppercase text-slate-500">Current Status</th>
                        <th className="px-3 py-2 text-center text-[9px] font-bold uppercase text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredMembers.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No members found.</td></tr>
                      ) : (
                        filteredMembers.map(m => (
                          <tr key={m.member_id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${m.status ? 'bg-slate-50/30' : 'bg-amber-50/20 dark:bg-amber-900/5'}`}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={selectedIds.has(m.member_id)}
                                onChange={() => toggleSelect(m.member_id)} className="rounded border-slate-300" />
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-white whitespace-nowrap">{m.full_name}</td>
                            <td className="px-3 py-2 font-mono text-slate-400">{m.membership_id || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {m.status ? <StatusBadge status={m.status} /> : <span className="text-[10px] text-amber-600 font-semibold">Not set</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
                                {Object.entries(STATUS_META).map(([key, meta]) => {
                                  const Icon = meta.icon;
                                  const active = m.status === key;
                                  return (
                                    <button key={key} type="button" onClick={() => setMemberStatus(m.member_id, key)}
                                      className={`p-1 rounded-md transition-all ${active ? key === 'present' ? 'bg-emerald-500 text-white' : key === 'absent' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                      title={meta.label}>
                                      <Icon className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Correction Reason */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Administrative Correction Reason
                </label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="input h-9 w-full max-w-xs text-xs">
                  {CORRECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  This reason will be logged in the audit trail for every corrected record.
                </p>
              </div>

              {/* Audit Summary */}
              <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Correction Audit</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10px] text-indigo-600 dark:text-indigo-400">
                  <div><span className="text-indigo-400">Original Leader:</span> <span className="font-semibold">{leader.leader_name}</span></div>
                  <div><span className="text-indigo-400">Correction Reason:</span> <span className="font-semibold">{reason}</span></div>
                  <div><span className="text-indigo-400">Records:</span> <span className="font-semibold">{summary.total} members</span></div>
                  <div><span className="text-indigo-400">Date:</span> <span className="font-semibold">{date}</span></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !allHaveStatus || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 disabled:opacity-50">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Attendance</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ──
const AttendanceCorrections = ({ showMessage }) => {
  const [activeTab, setActiveTab] = useState('edit');
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ q: '', start_date: '', end_date: '', status: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const searchRef = useRef(null);

  // Missing submissions state
  const [mlsDate, setMlsDate] = useState(formatLocalDate(new Date()));
  const [mlsServiceId, setMlsServiceId] = useState(1);
  const [mlsData, setMlsData] = useState(null);
  const [mlsLoading, setMlsLoading] = useState(false);
  const [bulkLeader, setBulkLeader] = useState(null);

  // ── Tab 1: Edit Attendance (unchanged) ──
  const load = async (activeFilters = filters) => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 1000, ...(activeFilters.q ? { q: activeFilters.q } : {}), ...(activeFilters.start_date ? { start_date: activeFilters.start_date } : {}), ...(activeFilters.end_date ? { end_date: activeFilters.end_date } : {}), ...(activeFilters.status ? { status: activeFilters.status } : {}) };
      const res = await adminAPI.searchAttendance(params);
      setRecords(res.data.rows || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load attendance corrections:', err);
      showMessage?.('Failed to load attendance records.', 4000);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const debounceRef = useRef(null);
  const debouncedLoad = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(filtersRef.current), 300);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  const loadRef = useRef(load);
  loadRef.current = load;

  const searchMembers = async (q) => {
    if (!q || q.length < 1) { setMemberSuggestions([]); setShowMemberDropdown(false); return; }
    try {
      const res = await adminAPI.searchMembers(q);
      setMemberSuggestions(res.data || []);
      setShowMemberDropdown(true);
    } catch { setMemberSuggestions([]); }
  };

  const selectMember = (member) => {
    const next = { ...filtersRef.current, q: member.full_name };
    setFilters(next);
    filtersRef.current = next;
    setShowMemberDropdown(false);
    setMemberSuggestions([]);
    load(next);
  };

  const handleApplyFilters = () => load(filters);
  const handleClearFilters = () => {
    const empty = { q: '', start_date: '', end_date: '', status: '' };
    setFilters(empty);
    filtersRef.current = empty;
    load(empty);
  };

  const buildRange = (kind) => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    if (kind === 'today') return { start_date: todayStr, end_date: todayStr };
    if (kind === 'yesterday') return { start_date: formatLocalDate(addDays(today, -1)), end_date: formatLocalDate(addDays(today, -1)) };
    if (kind === 'last7') return { start_date: formatLocalDate(addDays(today, -6)), end_date: todayStr };
    if (kind === 'last30') return { start_date: formatLocalDate(addDays(today, -29)), end_date: todayStr };
    if (kind === 'thisMonth') return { start_date: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), end_date: todayStr };
    if (kind === 'lastMonth') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start_date: formatLocalDate(first), end_date: formatLocalDate(last) };
    }
    return null;
  };

  const handleDatePreset = (kind) => {
    const range = buildRange(kind);
    if (!range) return;
    const next = { ...filtersRef.current, ...range };
    setFilters(next);
    filtersRef.current = next;
    load(next);
  };

  const handleClearDates = () => {
    const next = { ...filtersRef.current, start_date: '', end_date: '' };
    setFilters(next);
    filtersRef.current = next;
    load(next);
  };

  const hasDateFilter = Boolean(filters.start_date || filters.end_date);
  const activePreset = (() => {
    if (!hasDateFilter) return null;
    const todayStr = formatLocalDate(new Date());
    if (filters.start_date === todayStr && filters.end_date === todayStr) return 'today';
    if (filters.start_date === formatLocalDate(addDays(new Date(), -1)) && filters.end_date === formatLocalDate(addDays(new Date(), -1))) return 'yesterday';
    if (filters.start_date === formatLocalDate(addDays(new Date(), -6)) && filters.end_date === todayStr) return 'last7';
    if (filters.start_date === formatLocalDate(addDays(new Date(), -29)) && filters.end_date === todayStr) return 'last30';
    const t = new Date();
    const monthFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 1));
    if (filters.start_date === monthFirst && filters.end_date === todayStr) return 'thisMonth';
    const prevFirst = formatLocalDate(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    const prevLast = formatLocalDate(new Date(t.getFullYear(), t.getMonth(), 0));
    if (filters.start_date === prevFirst && filters.end_date === prevLast) return 'lastMonth';
    return 'custom';
  })();

  const columns = useMemo(() => [
    { accessor: 'date', header: 'Date', sortable: true, render: (row) => <span className="text-sm font-medium text-slate-700 dark:text-slate-200 tabular-nums">{fdate(row.date)}</span> },
    { accessor: 'member_name', header: 'Member', render: (row) => <div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.member_name}</p><p className="text-[10px] font-mono text-slate-400">{row.membership_id}</p></div> },
    { accessor: 'section_name', header: 'Section', render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{row.section_name || '—'}</span> },
    { accessor: 'service_name', header: 'Service', render: (row) => <span className="text-sm text-slate-600 dark:text-slate-300">{row.service_name || '—'}</span> },
    { accessor: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { accessor: 'submitted_by_name', header: 'Submitted by', render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{row.submitted_by_name || '—'}</span> },
    { accessor: 'submitted_at', header: 'When', render: (row) => <span className="text-xs text-slate-400">{row.submitted_at ? fdatetime(row.submitted_at) : '—'}</span> },
    { accessor: 'actions', header: '', render: (row) => (
      <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(row); }}
        className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50">
        <Edit3 className="h-3 w-3" /> Edit
      </button>
    )},
  ], []);

  // ── Tab 2: Missing Leader Submissions ──
  const loadMissingSubmissions = async () => {
    setMlsLoading(true);
    try {
      const res = await adminAPI.getMissingSubmissions(mlsDate, mlsServiceId);
      setMlsData(res.data);
    } catch (err) {
      console.error('Failed to load missing submissions:', err);
      showMessage?.('Failed to load submissions.', 4000);
    } finally { setMlsLoading(false); }
  };

  useEffect(() => { if (activeTab === 'missing') loadMissingSubmissions(); }, [activeTab, mlsDate, mlsServiceId]);

  useEffect(() => {
    const handleClickOutside = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowMemberDropdown(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const summaryCards = mlsData?.summary ? [
    { label: 'Missing Submissions', count: mlsData.summary.missing, variant: 'danger', icon: XCircle },
    { label: 'Partial Submissions', count: mlsData.summary.partial, variant: 'warning', icon: AlertTriangle },
    { label: 'Late Submissions', count: mlsData.summary.late, variant: 'warning', icon: Clock },
    { label: 'Completed Submissions', count: mlsData.summary.submitted, variant: 'success', icon: CheckCircle2 },
  ] : [];

  const TABS = [
    { id: 'edit', label: 'Edit Attendance', icon: Edit3 },
    { id: 'missing', label: 'Missing Leader Submissions', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-6 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm"><Edit3 className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-xl font-bold">Attendance Corrections</h2>
              <p className="text-sm text-white/80">Audit and fix attendance records submitted by leaders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Edit Attendance (existing functionality) ── */}
      {activeTab === 'edit' && (
        <>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={filters.q} onChange={(e) => { handleFilterChange('q', e.target.value); debouncedLoad(); searchMembers(e.target.value); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                  onFocus={() => { if (memberSuggestions.length) setShowMemberDropdown(true); }}
                  placeholder="Search member name or membership ID..." className="input h-10 w-full pl-10 pr-10" autoComplete="off" />
                {filters.q && (
                  <button type="button" onClick={() => { const next = { ...filtersRef.current, q: '' }; setFilters(next); filtersRef.current = next; setMemberSuggestions([]); setShowMemberDropdown(false); load(next); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Clear search" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {showMemberDropdown && memberSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 max-h-60 overflow-y-auto">
                    {memberSuggestions.map(m => (
                      <button key={m.id} type="button" onClick={() => selectMember(m)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold shrink-0 text-[10px]">{m.full_name?.charAt(0) || '?'}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{m.full_name}</p>
                          <p className="text-[10px] text-slate-400">{m.membership_id}{m.section_name ? ` · ${m.section_name}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {loading && <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Searching…</span>}
                <button type="button" onClick={() => setShowFilters(s => !s)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Filter className="h-4 w-4" />{showFilters ? 'Hide Filters' : 'More Filters'}
                </button>
                <button type="button" onClick={() => load(filters)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Refresh" title="Refresh">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label>
                <input type="date" value={filters.start_date} max={filters.end_date || undefined}
                  onChange={(e) => { handleFilterChange('start_date', e.target.value); debouncedLoad(); }}
                  className="input h-9 w-full cursor-pointer" onClick={(e) => e.currentTarget.showPicker?.()} />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label>
                <input type="date" value={filters.end_date} min={filters.start_date || undefined}
                  onChange={(e) => { handleFilterChange('end_date', e.target.value); debouncedLoad(); }}
                  className="input h-9 w-full cursor-pointer" onClick={(e) => e.currentTarget.showPicker?.()} />
              </div>
              <button type="button" onClick={handleApplyFilters}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-primary-700" title="Apply filters">
                <Calendar className="h-3.5 w-3.5" /> Apply
              </button>
              {hasDateFilter && (
                <button type="button" onClick={handleClearDates}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" title="Clear date range">
                  <X className="h-3.5 w-3.5" /> Clear dates
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick range</span>
              {['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'].map((id) => {
                const labels = { today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 days', last30: 'Last 30 days', thisMonth: 'This month', lastMonth: 'Last month' };
                const isActive = activePreset === id;
                return (
                  <button key={id} type="button" onClick={() => handleDatePreset(id)}
                    className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
                      isActive ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'
                    }`}>{labels[id]}</button>
                );
              })}
              {activePreset === 'custom' && <span className="ml-1 inline-flex h-7 items-center rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">Custom range</span>}
            </div>

            {showFilters && (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4 dark:border-slate-700">
                <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label><input type="date" value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} className="input h-9 w-full" /></div>
                <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label><input type="date" value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} className="input h-9 w-full" /></div>
                <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
                  <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="input h-9 w-full">
                    <option value="">All</option><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={handleApplyFilters} className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700">Apply</button>
                  <button type="button" onClick={handleClearFilters} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Clear</button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'} found${(filters.q || hasDateFilter || filters.status) ? ' (filtered)' : ''}`}
              </p>
              {(filters.q || hasDateFilter || filters.status) && (
                <button type="button" onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" title="Clear all filters">
                  <X className="h-3 w-3" /> Reset all filters
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>{columns.map(c => <th key={c.header} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {loading ? (
                    <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">Loading...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={columns.length} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Users className="h-8 w-8" />
                        <p className="text-sm font-semibold">No attendance records found</p>
                        <p className="text-xs">{(filters.q || hasDateFilter || filters.status) ? 'No records match the current filters.' : 'Try adjusting your filters or date range.'}</p>
                        {(filters.q || hasDateFilter || filters.status) && (
                          <button type="button" onClick={handleClearFilters}
                            className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                            <X className="h-3.5 w-3.5" /> Reset all filters
                          </button>
                        )}
                      </div>
                    </td></tr>
                  ) : (
                    records.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        {columns.map(c => <td key={c.header} className="px-4 py-2.5 align-middle">{c.render(row)}</td>)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {editing && <EditAttendanceModal record={editing} onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(filters); }} showMessage={showMessage} />}
        </>
      )}

      {/* ── Tab 2: Missing Leader Submissions ── */}
      {activeTab === 'missing' && (
        <div className="space-y-4">
          {/* Date + Service Selector */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input type="date" value={mlsDate} onChange={e => setMlsDate(e.target.value)}
                  className="input h-9 text-xs cursor-pointer" onClick={e => e.currentTarget.showPicker?.()} />
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <select value={mlsServiceId} onChange={e => setMlsServiceId(Number(e.target.value))} className="input h-9 text-xs">
                  <option value={1}>Main</option>
                  <option value={2}>Midweek</option>
                </select>
              </div>
              <button type="button" onClick={loadMissingSubmissions}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 h-9 text-xs font-semibold text-white shadow-sm hover:bg-primary-700">
                <RefreshCw className={`w-3.5 h-3.5 ${mlsLoading ? 'animate-spin' : ''}`} /> Load
              </button>
            </div>
          </div>

          {mlsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm"><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading submissions...</div>
          ) : mlsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map(card => {
                  const variantMap = { danger: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/10 dark:border-rose-800 dark:text-rose-300', warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-300', success: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-300' };
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className={`rounded-xl border p-4 ${variantMap[card.variant] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{card.label}</span>
                        <Icon className="w-4 h-4 opacity-60" />
                      </div>
                      <p className="text-2xl font-black">{card.count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Leaders List */}
              <div className="space-y-2">
                {mlsData.leaders.filter(l => l.status !== 'submitted').length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">
                    {mlsData.leaders.length === 0 ? 'No leaders found for this date.' : 'All leaders have submitted attendance for this date.'}
                  </div>
                ) : (
                  mlsData.leaders.filter(l => l.status !== 'submitted').map(leader => (
                    <div key={leader.leader_id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold shrink-0">
                            {leader.leader_name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{leader.leader_name}</h4>
                              <SubmissionStatusBadge status={leader.status} />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {leader.section_name}
                              <span className="mx-1.5">&middot;</span>
                              {leader.service_name}
                              <span className="mx-1.5">&middot;</span>
                              Expected: <span className="font-semibold text-slate-700 dark:text-slate-300">{leader.expected_members}</span>
                              <span className="mx-1.5">/</span>
                              Recorded: <span className={`font-semibold ${leader.recorded_members > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{leader.recorded_members}</span>
                            </p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setBulkLeader(leader)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50 shrink-0">
                          <ClipboardList className="w-3.5 h-3.5" /> Mark Attendance
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">
              Select a date and service, then click "Load" to view submission status.
            </div>
          )}

          {/* Bulk Correction Modal */}
          {bulkLeader && (
            <BulkCorrectionModal
              leader={bulkLeader}
              date={mlsDate}
              serviceId={mlsServiceId}
              onClose={() => setBulkLeader(null)}
              onSaved={(count) => { const name = bulkLeader?.leader_name; setBulkLeader(null); showMessage?.(`Attendance saved for ${name} (${count} members).`); loadMissingSubmissions(); }}
              showMessage={showMessage}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceCorrections;
