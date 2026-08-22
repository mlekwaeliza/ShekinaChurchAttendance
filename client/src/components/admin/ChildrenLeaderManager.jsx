import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../services/api';
import StatCard from '../ui/StatCard';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  X,
  Search,
  AtSign,
  Copy
} from 'lucide-react';

// ── Member Search Combobox (same pattern as LeaderEditModal) ───────────────
const MemberSearchInput = ({ members = [], selected, onSelect }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered =
    query.trim().length < 1
      ? []
      : members
          .filter(
            (m) =>
              m.full_name?.toLowerCase().includes(query.toLowerCase()) ||
              m.phone?.includes(query) ||
              m.email?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!selected) setQuery('');
  }, [selected]);

  const pickMember = useCallback(
    (member) => {
      setQuery('');
      setOpen(false);
      onSelect(member);
    },
    [onSelect]
  );

  const clearSelection = useCallback(() => {
    setQuery('');
    setOpen(false);
    onSelect(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onSelect]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (selected) onSelect(null);
    setQuery(val);
    setHighlighted(0);
    setOpen(val.trim().length > 0);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) pickMember(filtered[highlighted]);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const inputValue = selected ? selected.full_name : query;

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 z-10" />
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (!selected && query.trim().length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search by name, phone or email..."
        className={`input pl-10 pr-9 transition-all ${selected ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-200 dark:ring-emerald-900/50' : ''}`}
      />
      {(selected || query) && (
        <button
          type="button"
          onClick={clearSelection}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{selected.full_name}</strong> selected
            {selected.phone ? ` · ${selected.phone}` : ''}
            {selected.email ? ` · ${selected.email}` : ''}
          </span>
        </div>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.map((m, i) => (
            <li
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMember(m);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                {m.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate leading-tight">{m.full_name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {[m.phone, m.email].filter(Boolean).join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
          No members match "
          <span className="font-medium text-slate-600 dark:text-slate-400">{query}</span>"
        </div>
      )}
    </div>
  );
};

export default function ChildrenLeaderManager({ showMessage }) {
  const { t } = useTranslation();
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
  const [allMembers, setAllMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  useEffect(() => {
    loadLeaders();
    loadMembers();
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

  const loadMembers = async () => {
    try {
      const res = await adminAPI.getMembers();
      setAllMembers(res.data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const filteredLeaders = leaders.filter(
    (l) =>
      l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableMembers = useMemo(() => {
    return allMembers;
  }, [allMembers]);

  const handleMemberSelect = useCallback((member) => {
    if (member) {
      setSelectedMember(member);
      const autoUsername = member.full_name
        ? member.full_name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 20)
        : '';
      setFormData((prev) => ({
        ...prev,
        full_name: member.full_name || '',
        phone: member.phone || '',
        email: member.email || '',
        user_id: member.id,
        username: autoUsername
      }));
    } else {
      setSelectedMember(null);
      setFormData((prev) => ({
        ...prev,
        full_name: '',
        phone: '',
        email: '',
        user_id: null,
        username: ''
      }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!editingLeader && !formData.username.trim()) {
      setError('Username is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let res;
      if (editingLeader) {
        res = await adminAPI.childrenLeaders.updateLeader(editingLeader.id, formData);
      } else {
        res = await adminAPI.childrenLeaders.createLeader(formData);
      }
      setShowModal(false);
      setEditingLeader(null);
      setSelectedMember(null);
      setFormData({
        username: '',
        full_name: '',
        phone: '',
        email: '',
        is_head: false,
        user_id: null
      });
      loadLeaders();
      if (!editingLeader && res.data?.password) {
        setCreatedCredentials({
          username: res.data.username || formData.username,
          password: res.data.password,
          full_name: formData.full_name
        });
      } else {
        showMessage(editingLeader ? 'Leader updated successfully' : 'Leader created successfully');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save leader';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leader) => {
    try {
      await adminAPI.childrenLeaders.deleteLeader(leader.id);
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
      setCreatedCredentials({
        username: res.data.username || leader.username,
        password: res.data.password,
        full_name: leader.full_name
      });
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
    setFormData({
      username: '',
      full_name: '',
      phone: '',
      email: '',
      is_head: false,
      user_id: null
    });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            {t('children.leadersTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('children.leadersDesc')}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('children.addLeader')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label={t('children.totalLeaders')} value={leaders.length} variant="default" />
        <StatCard
          icon={CheckCircle}
          label={t('children.active')}
          value={leaders.filter((l) => l.is_active !== false).length}
          variant="success"
        />
        <StatCard
          icon={ShieldCheck}
          label={t('children.headLeaders')}
          value={leaders.filter((l) => l.is_head).length}
          variant="warning"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t('children.searchLeaders')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-9 w-full max-w-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Username
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredLeaders.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {searchTerm
                      ? 'No leaders match your search'
                      : "No children's ministry leaders yet"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredLeaders.map((leader) => (
                <tr
                  key={leader.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                        <span className="text-xs font-bold text-primary-700 dark:text-primary-300">
                          {leader.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {leader.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {leader.username}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {leader.email || leader.leader_email || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {leader.phone || '—'}
                  </td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {createdCredentials && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {createdCredentials.full_name} — Login Credentials
                </h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Share these credentials with the leader so they can access their dashboard.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCreatedCredentials(null)}
              className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Username
              </p>
              <p className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                {createdCredentials.username}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Password
              </p>
              <p className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                {createdCredentials.password}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Username: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`
                );
                showMessage('Credentials copied to clipboard');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy Credentials
            </button>
            <button
              onClick={() => setCreatedCredentials(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setError('');
              setSelectedMember(null);
            }
          }}
        >
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                  <ShieldCheck className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingLeader ? 'Edit Leader' : "Add Children's Ministry Leader"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  setSelectedMember(null);
                }}
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Select Member{' '}
                    <span className="text-slate-400 font-normal">(Optional Auto-fill)</span>
                  </label>
                  <MemberSearchInput
                    members={availableMembers}
                    selected={selectedMember}
                    onSelect={handleMemberSelect}
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  className="input"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>

              {!editingLeader && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. jdoe_leader"
                      className="input pl-10"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Used for system login. Permanent once set.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Head of Children's Ministry
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setSelectedMember(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editingLeader && !selectedMember)}
                  className="btn-primary flex-1"
                >
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
