import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserCog, AtSign, Phone, Mail, Layout, Search, X, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

// ── Member Search Combobox ────────────────────────────────────────────────────
const MemberSearchInput = ({ members = [], selected, onSelect }) => {
  const [query, setQuery]           = useState('');
  const [open, setOpen]             = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  // Filtered suggestions (max 10)
  const filtered = query.trim().length < 1
    ? []
    : members.filter(m =>
        m.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        m.phone?.includes(query) ||
        m.email?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset local query when modal opens fresh (selected changes to null)
  useEffect(() => {
    if (!selected) setQuery('');
  }, [selected]);

  const pickMember = useCallback((member) => {
    setQuery('');
    setOpen(false);
    onSelect(member);
  }, [onSelect]);

  const clearSelection = useCallback(() => {
    setQuery('');
    setOpen(false);
    onSelect(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onSelect]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    // If a member is already selected and user starts typing a new query, clear it
    if (selected) onSelect(null);
    setQuery(val);
    setHighlighted(0);
    setOpen(val.trim().length > 0);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlighted]) pickMember(filtered[highlighted]); }
    if (e.key === 'Escape')    { setOpen(false); }
  };

  // What shows in the input box
  const inputValue = selected ? selected.full_name : query;

  return (
    <div ref={containerRef} className="relative">
      {/* Search icon */}
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 z-10" />

      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if (!selected && query.trim().length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Search by name, phone or email…"
        className={`input pl-10 pr-9 transition-all ${selected ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-200 dark:ring-emerald-900/50' : ''}`}
      />

      {/* Clear × button */}
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

      {/* Confirmation badge */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{selected.full_name}</strong> selected
            {selected.section_name ? ` · ${selected.section_name}` : ''}
            {' · Contact info auto-filled'}
          </span>
        </div>
      )}

      {/* Dropdown results */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.map((m, i) => (
            <li
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); pickMember(m); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                {m.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate leading-tight">{m.full_name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {[m.phone, m.section_name].filter(Boolean).join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
          No members match "<span className="font-medium text-slate-600 dark:text-slate-400">{query}</span>"
        </div>
      )}
    </div>
  );
};

// ── Leader Edit Modal ─────────────────────────────────────────────────────────
const LeaderEditModal = ({ isOpen, onClose, onSave, leader, sections, members = [], loading }) => {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    section_id: '',
    phone: '',
    email: '',
    is_head: false,
  });
  const [selectedMember, setSelectedMember] = useState(null);

  // Populate form when opening modal
  useEffect(() => {
    if (isOpen) {
      if (leader) {
        setFormData({
          username:   leader.username   || '',
          full_name:  leader.full_name  || '',
          section_id: leader.section_id || (sections.find(s => s.name === leader.section_name)?.id || ''),
          phone:      leader.phone      || '',
          email:      leader.email      || '',
          is_head:    leader.is_head === 1,
        });
        // Pre-select member if they exist in the members list
        const matched = members.find(m =>
          m.full_name?.toLowerCase().trim() === leader.full_name?.toLowerCase().trim()
        ) || null;
        setSelectedMember(matched);
      } else {
        setFormData({ username: '', full_name: '', section_id: '', phone: '', email: '', is_head: false });
        setSelectedMember(null);
      }
    }
  }, [leader, sections, members, isOpen]);

  // When a member is chosen from the picker, auto-fill name/phone/email
  const handleMemberSelect = (member) => {
    if (member) {
      setSelectedMember(member);
      setFormData(prev => ({
        ...prev,
        full_name: member.full_name || '',
        phone:     member.phone     || prev.phone,
        email:     member.email     || prev.email,
      }));
    } else {
      setSelectedMember(null);
      setFormData(prev => ({ ...prev, full_name: '', phone: '', email: '' }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'phone') finalValue = handlePhoneChange(finalValue);
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await onSave(formData); } catch (_) {}
  };

  const canSubmit = !!formData.full_name.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={leader ? 'Edit Leader' : 'Add New Leader'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Full Name — Member Search Picker ── */}
          <div className="md:col-span-2">
            <label className="input-label">Full Name</label>
            <MemberSearchInput
              members={members}
              selected={selectedMember}
              onSelect={handleMemberSelect}
            />
            {/* Editable text fallback — always visible so user can type freely */}
            <div className="relative mt-2">
              <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                required
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={e => {
                  const val = capitalizeName(e.target.value);
                  setFormData(p => ({ ...p, full_name: val }));
                  // If the user manually edits the name, detach from selected member
                  if (selectedMember && val !== selectedMember.full_name) setSelectedMember(null);
                }}
                onPaste={e => {
                  e.preventDefault();
                  const val = capitalizeName(e.clipboardData.getData('text'));
                  setFormData(p => ({ ...p, full_name: val }));
                  setSelectedMember(null);
                }}
                placeholder="Or type a name manually…"
                className="input pl-10"
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Search above to auto-fill details, or type a name directly below.
            </p>
          </div>

          {/* ── Username ── */}
          <div>
            <label className="input-label">Username (Login)</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                required
                disabled={!!leader}
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. jdoe_leader"
                className="input pl-10 disabled:bg-slate-50 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            {!leader && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Used for system login. Permanent once set.
              </p>
            )}
          </div>

          {/* ── Section ── */}
          <div>
            <label className="input-label">Section Assignment</label>
            <div className="relative">
              <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <select
                required
                name="section_id"
                value={formData.section_id}
                onChange={handleChange}
                className="input pl-10 appearance-none"
              >
                <option value="">Select Section</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Phone ── */}
          <div>
            <label className="input-label">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: handlePhoneChange(e.target.value) }))}
                placeholder="+255 XXX XXX XXX"
                className="input pl-10"
              />
            </div>
          </div>

          {/* ── Email ── */}
          <div>
            <label className="input-label">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. john@example.com"
                className="input pl-10"
              />
            </div>
          </div>

          {/* ── Section Head Toggle ── */}
          <div className="md:col-span-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  name="is_head"
                  checked={formData.is_head}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  Designate as Section Head
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Section heads have primary oversight of all sub-leaders in their section.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 mt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="btn-primary min-w-[100px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              leader ? 'Update Leader' : 'Create Leader'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaderEditModal;
