import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import {
  ShieldCheck, Plus, Pencil, Trash2, KeyRound,
  CheckCircle, XCircle, Loader2, Users, X, Search, User
} from 'lucide-react';

const STAT_STYLE = 'rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm';

export default function ChildrenLeaderManager({ showMessage }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    phone: '',
    email: '',
    is_head: false,
    user_id: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const memberSearchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      const res = await adminAPI.childrenLeaders.getLeaders();
      setLeaders(res.data);
    } catch (err) {
      console.error('Failed to load children leaders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaders = leaders.filter(l =>
    l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMembers = memberSearch.trim()
    ? availableMembers.filter(m =>
        m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.username?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone?.includes(memberSearch)
      )
    : availableMembers;

  const fetchAvailableMembers = useCallback(async (q) => {
    setLoadingMembers(true);
    try {
      const res = await adminAPI.childrenLeaders.getAvailableMembers(q);
      setAvailableMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (!showModal || editingLeader) return;
    fetchAvailableMembers(memberSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearch, showModal, editingLeader]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          memberSearchRef.current && !memberSearchRef.current.contains(e.target)) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectMember = (member) => {
    setSelectedMember(member);
    setFormData({
      username: member.username,
      full_name: member.full_name,
      phone: member.phone || '',
      email: member.email || '',
      is_head: false,
      user_id: member.id
    });
    setShowMemberDropdown(false);
    setMemberSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) { setError('Full name is required'); return; }
    if (!editingLeader && !formData.username.trim()) { setError('Please select a member from the list'); return; }
    setSaving(true); setError('');
    try {
      if (editingLeader) {
        await adminAPI.childrenLeaders.updateLeader(editingLeader.id, formData);
      } else {
        await adminAPI.childrenLeaders.createLeader(formData);
      }
      setShowModal(false);
      setEditingLeader(null);
      setSelectedMember(null);
      setFormData({ username: '', full_name: '', phone: '', email: '', is_head: false, user_id: null });
      loadLeaders();
      showMessage(editingLeader ? 'Leader updated successfully' : 'Leader created successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save leader');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leader) => {
    try {
      await adminAPI.childrenLeaders.deleteLeader(leader.id, { confirm: 'DELETE' });
      showMessage('Leader deleted successfully');
      setDeleteConfirm(null);
      loadLeaders();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete leader', 'error');
    }
  };

  const handleResetPassword = async (leader) => {
    try {
      const res = await adminAPI.childrenLeaders.resetPassword(leader.id);
      showMessage(`Password reset link generated. Expires: ${new Date(res.data.expires_at).toLocaleString()}`);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to reset password', 'error');
    }
  };

  const openEditModal = (leader) => {
    setEditingLeader(leader);
    setSelectedMember(null);
    setFormData({
      username: leader.username,
      full_name: leader.full_name,
      phone: leader.phone || '',
      email: leader.leader_email || leader.email || '',
      is_head: !!leader.is_head,
      user_id: leader.user_id
    });
    setError('');
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingLeader(null);
    setSelectedMember(null);
    setMemberSearch('');
    setAvailableMembers([]);
    setFormData({ username: '', full_name: '', phone: '', email: '', is_head: false, user_id: null });
    setError('');
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            Children's Ministry Leaders
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage leaders assigned to the children's ministry</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Leader
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={STAT_STYLE}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{leaders.length}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Leaders</p>
            </div>
          </div>
        </div>
        <div className={STAT_STYLE}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{leaders.filter(l => l.is_active !== false).length}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active</p>
            </div>
          </div>
        </div>
        <div className={STAT_STYLE}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{leaders.filter(l => l.is_head).length}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Head Leaders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search leaders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-9 w-full max-w-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Username</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredLeaders.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {searchTerm ? 'No leaders match your search' : "No children's ministry leaders yet"}
                  </p>
                </td>
              </tr>
            ) : filteredLeaders.map(leader => (
              <tr key={leader.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                      <span className="text-xs font-bold text-primary-700 dark:text-primary-300">
                        {leader.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{leader.full_name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{leader.username}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{leader.email || leader.leader_email || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{leader.phone || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {leader.is_head ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <ShieldCheck className="h-3 w-3" /> Head
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      Leader
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {leader.is_active !== false ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditModal(leader)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleResetPassword(leader)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {deleteConfirm === leader.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(leader)}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(leader.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setError(''); setSelectedMember(null); } }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                  <ShieldCheck className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingLeader ? 'Edit Leader' : 'Add Children\'s Ministry Leader'}
                </h2>
              </div>
              <button
                onClick={() => { setShowModal(false); setError(''); setSelectedMember(null); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                  {error}
                </div>
              )}

              {!editingLeader && (
                <div className="relative" ref={dropdownRef}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Select Member <span className="text-rose-500">*</span>
                  </label>
                  {selectedMember ? (
                    <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-800 dark:bg-primary-900/20">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
                        <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
                          {selectedMember.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{selectedMember.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{selectedMember.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedMember(null); setFormData(f => ({ ...f, username: '', full_name: '', phone: '', email: '', user_id: null })); }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={memberSearchRef}
                          className="input pl-9"
                          placeholder="Type a name, username, or email..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          onFocus={() => { setShowMemberDropdown(true); if (availableMembers.length === 0) fetchAvailableMembers(''); }}
                          autoFocus
                        />
                        {loadingMembers && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                        )}
                      </div>
                      {showMemberDropdown && (
                        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          {loadingMembers && filteredMembers.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                              <p className="mt-2 text-sm text-slate-400">Loading members...</p>
                            </div>
                          ) : filteredMembers.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <User className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                {memberSearch ? 'No members match your search' : 'No available members'}
                              </p>
                            </div>
                          ) : (
                            filteredMembers.map(member => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => selectMember(member)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {member.full_name?.charAt(0)?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{member.full_name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{member.username}{member.email ? ` · ${member.email}` : ''}{member.phone ? ` · ${member.phone}` : ''}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {editingLeader && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="input"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="jane@church.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Phone
                  </label>
                  <input
                    className="input"
                    placeholder="+254 700 000 000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_head}
                  onChange={(e) => setFormData({ ...formData, is_head: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Head of Children's Ministry</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setError(''); setSelectedMember(null); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving || (!editingLeader && !selectedMember)} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editingLeader ? 'Save Changes' : 'Create Leader'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
