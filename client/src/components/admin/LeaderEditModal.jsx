import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserCog, AtSign, Phone, Mail, Layout, Search, X, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

const fieldHint = 'mt-1 text-caption-2 text-tertiary-label';

// ── Member Search Combobox ────────────────────────────────────────────────────
const MemberSearchInput = ({ members = [], selected, onSelect }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filtered suggestions (max 10)
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
    // If a member is already selected and user starts typing a new query, clear it
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

  // What shows in the input box
  const inputValue = selected ? selected.full_name : query;

  return (
    <div ref={containerRef} className="relative">
      {/* Search icon */}
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-tertiary-label" />

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
        placeholder="Search by name, phone or email…"
        className={`input pl-10 pr-9 transition-colors ${
          selected ? 'border-system-green/50 ring-1 ring-system-green/25' : ''
        }`}
      />

      {/* Clear × button */}
      {(selected || query) && (
        <button
          type="button"
          onClick={clearSelection}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Confirmation badge */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 text-caption-1 text-emerald-700 dark:text-system-green">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">{selected.full_name}</strong> selected
            {selected.section_name ? ` · ${selected.section_name}` : ''}
            {' · Contact info auto-filled'}
          </span>
        </div>
      )}

      {/* Dropdown results */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-popover dark:border-white/[0.1]">
          {filtered.map((m, i) => (
            <li
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMember(m);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex cursor-pointer items-center gap-3 border-b border-separator/40 px-3 py-2.5 text-footnote transition-colors last:border-0 dark:border-white/[0.06] ${
                i === highlighted
                  ? 'bg-primary-500/[0.08] text-primary-700 dark:text-primary-300'
                  : 'text-label hover:bg-system-grouped-background dark:hover:bg-white/[0.04]'
              }`}
            >
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/[0.12] text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
                {m.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{m.full_name}</p>
                <p className="truncate text-caption-2 text-tertiary-label">
                  {[m.phone, m.section_name].filter(Boolean).join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-black/[0.08] bg-secondary-system-grouped-background px-4 py-3 text-center text-footnote text-tertiary-label shadow-popover dark:border-white/[0.1]">
          No members match{' '}
          <span className="font-medium text-secondary-label">&ldquo;{query}&rdquo;</span>
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
    is_head: false
  });
  const [selectedMember, setSelectedMember] = useState(null);

  // Populate form when opening modal
  useEffect(() => {
    if (isOpen) {
      if (leader) {
        setFormData({
          username: leader.username || '',
          full_name: leader.full_name || '',
          section_id:
            leader.section_id || sections.find((s) => s.name === leader.section_name)?.id || '',
          phone: leader.phone || '',
          email: leader.email || '',
          is_head: leader.is_head === 1
        });
        // Pre-select member if they exist in the members list
        const matched =
          members.find(
            (m) => m.full_name?.toLowerCase().trim() === leader.full_name?.toLowerCase().trim()
          ) || null;
        setSelectedMember(matched);
      } else {
        setFormData({
          username: '',
          full_name: '',
          section_id: '',
          phone: '',
          email: '',
          is_head: false
        });
        setSelectedMember(null);
      }
    }
  }, [leader, sections, members, isOpen]);

  // When a member is chosen from the picker, auto-fill name/phone/email
  const handleMemberSelect = (member) => {
    if (member) {
      setSelectedMember(member);
      setFormData((prev) => ({
        ...prev,
        full_name: member.full_name || '',
        phone: member.phone || prev.phone,
        email: member.email || prev.email
      }));
    } else {
      setSelectedMember(null);
      setFormData((prev) => ({ ...prev, full_name: '', phone: '', email: '' }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'phone') finalValue = handlePhoneChange(finalValue);
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave(formData);
    } catch (_) {
      /* parent displays the save error */
    }
  };

  const canSubmit = !!formData.full_name.trim();
  const fieldIcon = 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={leader ? 'Edit Leader' : 'Add New Leader'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <UserCog className={`${fieldIcon} pointer-events-none`} />
              <input
                required
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={(e) => {
                  const val = capitalizeName(e.target.value);
                  setFormData((p) => ({ ...p, full_name: val }));
                  // If the user manually edits the name, detach from selected member
                  if (selectedMember && val !== selectedMember.full_name) setSelectedMember(null);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const val = capitalizeName(e.clipboardData.getData('text'));
                  setFormData((p) => ({ ...p, full_name: val }));
                  setSelectedMember(null);
                }}
                placeholder="Or type a name manually…"
                className="input pl-10"
              />
            </div>
            <p className={fieldHint}>
              Search above to auto-fill details, or type a name directly below.
            </p>
          </div>

          {/* ── Username ── */}
          <div>
            <label className="input-label">Username (Login)</label>
            <div className="relative">
              <AtSign className={fieldIcon} />
              <input
                required
                disabled={!!leader}
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. jdoe_leader"
                className="input pl-10 disabled:bg-system-fill disabled:text-tertiary-label"
              />
            </div>
            {!leader && <p className={fieldHint}>Used for system login. Permanent once set.</p>}
          </div>

          {/* ── Section ── */}
          <div>
            <label className="input-label">Section Assignment</label>
            <div className="relative">
              <Layout className={fieldIcon} />
              <select
                required
                name="section_id"
                value={formData.section_id}
                onChange={handleChange}
                className="input appearance-none pl-10"
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Phone ── */}
          <div>
            <label className="input-label">Phone Number</label>
            <div className="relative">
              <Phone className={fieldIcon} />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: handlePhoneChange(e.target.value) }))
                }
                placeholder="+255 XXX XXX XXX"
                className="input pl-10 tabular-nums"
              />
            </div>
          </div>

          {/* ── Email ── */}
          <div>
            <label className="input-label">Email Address</label>
            <div className="relative">
              <Mail className={fieldIcon} />
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
          <div className="pt-2 md:col-span-2">
            <label className="group flex cursor-pointer items-center gap-3">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  name="is_head"
                  checked={formData.is_head}
                  onChange={handleChange}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-system-gray-4 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-black/[0.06] after:bg-secondary-system-grouped-background after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-transparent peer-focus-visible:ring-4 peer-focus-visible:ring-primary-500/20 dark:bg-white/[0.16] dark:after:border-transparent" />
              </div>
              <div className="flex flex-col">
                <span className="text-footnote font-semibold text-label transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-300">
                  Designate as Section Head
                </span>
                <span className="text-caption-1 text-secondary-label">
                  Section heads have primary oversight of all sub-leaders in their section.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-4 flex justify-end gap-2 border-t border-separator/60 pt-5 dark:border-white/[0.08]">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="btn-primary min-w-[100px] justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : leader ? (
              'Update Leader'
            ) : (
              'Create Leader'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaderEditModal;
