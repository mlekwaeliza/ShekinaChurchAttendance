import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { adminAPI } from '../services/api';
import {
  History,
  User,
  Sparkles,
  ChevronDown,
  RotateCcw,
  Users,
  Camera,
  Upload,
  X
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import { handlePhoneChange, capitalizeName, sanitizePhone } from '../utils/phone';
import PhotoViewer from './PhotoViewer';

const MemberEditModal = ({
  member,
  mode = 'edit',
  sections = [],
  leaders = [],
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    membership_id: '',
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    marital_status: '',
    occupation: '',
    age_group: '',
    section_id: '',
    leader_id: '',
    home_cell_id: '',
    date_of_birth: '',
    address: '',
    profile_picture: '',
    education_level: '',
    secondary_phone: '',
    show_age_to_leaders: false,
    hide_from_birthday_list: false,
    opt_out_services: []
  });

  // ── Auto-assignment state (add mode only) ─────────────────────────────────
  const [autoSuggestion, setAutoSuggestion] = useState(null); // the suggested { section_id, leader_id, ... }
  const [rankedSections, setRankedSections] = useState([]); // sections ordered by member_count asc
  const [rankedLeaders, setRankedLeaders] = useState([]); // leaders ordered by member_count asc
  const [showOverride, setShowOverride] = useState(false); // reveal manual override panel
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const isAutoAssigned = useRef(false); // true when current formData matches auto suggestion

  // ── Other state ───────────────────────────────────────────────────────────
  const [serviceTypes, setServiceTypes] = useState([]);
  const [homeCells, setHomeCells] = useState([]);
  const [saving, setSaving] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  useModalA11y(dialogRef, isOpen, onClose);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be smaller than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, profile_picture: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // ── On open ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && member) {
      let parsedOptOut = [];
      try {
        parsedOptOut = member.opt_out_services
          ? Array.isArray(member.opt_out_services)
            ? member.opt_out_services
            : JSON.parse(member.opt_out_services)
          : [];
      } catch (_) {
        parsedOptOut = [];
      }
      setFormData({
        membership_id: member.membership_id || '',
        full_name: member.full_name || '',
        phone: member.phone || '',
        email: member.email || '',
        gender: member.gender || '',
        marital_status: member.marital_status || '',
        occupation: member.occupation || '',
        age_group: member.age_group || '',
        section_id: member.section_id || '',
        leader_id: member.leader_id || '',
        home_cell_id: member.home_cell_id || '',
        date_of_birth: member.date_of_birth || '',
        address: member.address || '',
        profile_picture: member.profile_picture || '',
        education_level: member.education_level || '',
        secondary_phone: member.secondary_phone || '',
        show_age_to_leaders: !!member.show_age_to_leaders,
        hide_from_birthday_list: !!member.hide_from_birthday_list,
        opt_out_services: parsedOptOut
      });
      loadAuditHistory(member.id);
    } else if (mode === 'add') {
      setSaving(false);
      setShowOverride(false);
      setAutoSuggestion(null);
      isAutoAssigned.current = false;

      (async () => {
        let genId = '';
        try {
          const res = await adminAPI.getNextMembershipId();
          genId = res.data.next_id;
        } catch {
          genId = String(Date.now()).slice(-6);
        }

        setFormData({
          membership_id: genId,
          full_name: '',
          phone: '',
          email: '',
          gender: '',
          marital_status: '',
          occupation: '',
          age_group: '',
          section_id: '',
          leader_id: '',
          home_cell_id: '',
          date_of_birth: '',
          address: '',
          profile_picture: '',
          education_level: '',
          secondary_phone: '',
          show_age_to_leaders: false,
          hide_from_birthday_list: false,
          opt_out_services: []
        });
        setAuditHistory([]);
        setShowHistory(false);

        // Fetch auto-assignment suggestion
        fetchSuggestion(genId);
      })();
    }

    loadServiceTypes();
    loadHomeCells();
  }, [isOpen, member, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSuggestion = async (_currentMembershipId) => {
    setLoadingSuggestion(true);
    try {
      const res = await adminAPI.getSuggestAssignment();
      const { suggestion, sections: ranked, leaders: rankedL } = res.data;
      setRankedSections(ranked || []);
      setRankedLeaders(rankedL || []);
      setAutoSuggestion(suggestion);
      if (suggestion) {
        setFormData((prev) => ({
          ...prev,
          section_id: String(suggestion.section_id),
          leader_id: String(suggestion.leader_id)
        }));
        isAutoAssigned.current = true;
      }
    } catch (e) {
      console.error('Failed to fetch assignment suggestion:', e);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const applyAutoAssign = () => {
    if (!autoSuggestion) return;
    setFormData((prev) => ({
      ...prev,
      section_id: String(autoSuggestion.section_id),
      leader_id: String(autoSuggestion.leader_id)
    }));
    isAutoAssigned.current = true;
    setShowOverride(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const loadServiceTypes = async () => {
    try {
      const res = await adminAPI.getServiceTypes();
      setServiceTypes(res.data);
    } catch (e) {
      console.error('Failed to load service types:', e);
    }
  };

  const loadHomeCells = async () => {
    try {
      const res = await adminAPI.getHomeCells();
      setHomeCells(res.data || []);
    } catch (e) {
      console.error('Failed to load home cells:', e);
    }
  };

  const loadAuditHistory = async (memberId) => {
    setAuditLoading(true);
    try {
      const res = await adminAPI.getMemberAuditHistory(memberId);
      setAuditHistory(res.data);
    } catch (e) {
      console.error('Failed to load audit history:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'full_name') finalValue = capitalizeName(finalValue);
    if (name === 'phone') finalValue = handlePhoneChange(finalValue);
    setFormData((prev) => ({
      ...prev,
      [name]: finalValue
    }));
    // If admin manually changes section/leader, mark as no longer auto
    if (name === 'section_id' || name === 'leader_id') {
      isAutoAssigned.current = false;
    }
    // When section changes in override mode, reset leader to first available
    if (name === 'section_id') {
      const firstLeader = rankedLeaders.find((l) => String(l.section_id) === value);
      setFormData((prev) => ({
        ...prev,
        section_id: value,
        leader_id: firstLeader ? String(firstLeader.leader_id) : ''
      }));
    }
  };

  const handleToggleOptOut = (serviceId) => {
    setFormData((prev) => {
      const current = prev.opt_out_services || [];
      const updated = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, opt_out_services: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const sanitized = {
        ...formData,
        phone: sanitizePhone(formData.phone),
        secondary_phone: sanitizePhone(formData.secondary_phone)
      };
      if (mode === 'edit') {
        await onSave(member.id, sanitized);
      } else {
        await onSave(null, sanitized);
      }
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values for the override panel ─────────────────────────────────
  const leadersInSelectedSection = rankedLeaders.filter(
    (l) => String(l.section_id) === String(formData.section_id)
  );

  // Find display info for current selection (when suggestion loaded)
  const currentSectionInfo = rankedSections.find(
    (s) => String(s.section_id) === String(formData.section_id)
  );
  const currentLeaderInfo = rankedLeaders.find(
    (l) => String(l.leader_id) === String(formData.leader_id)
  );

  if (!isOpen) return null;
  if (mode === 'edit' && !member) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex animate-fade-in items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-edit-title"
        tabIndex={-1}
        className="w-full max-w-5xl rounded-2xl border border-black/[0.08] bg-system-grouped-background p-5 shadow-modal dark:border-white/[0.1] sm:p-8 max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-separator/60 pb-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
              <User className="h-5 w-5 text-primary-700 dark:text-primary-300" />
            </div>
            <div>
              <h2 id="member-edit-title" className="text-title-2 font-semibold text-label">
                {mode === 'edit' ? 'Edit Member' : 'Add Member'}
              </h2>
              <p className="mt-1 text-footnote text-secondary-label">
                {mode === 'edit'
                  ? 'Update member identity, contact information, and preferences.'
                  : 'Fill in the details — section & leader are auto-assigned for you.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon h-9 w-9 rounded-lg text-tertiary-label"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Identity & Assignment */}
          <div className="card p-5">
            <h3 className="section-eyebrow mb-4">Identity &amp; Assignment</h3>

            {/* Profile Photo Uploader */}
            <div className="mb-5 flex items-center gap-4 rounded-xl bg-system-grouped-background/70 p-3.5 dark:bg-white/[0.03]">
              <div className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500 text-title-3 font-semibold text-white">
                {formData.profile_picture ? (
                  <img
                    src={formData.profile_picture}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {(formData.full_name || '')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || <User className="w-7 h-7 opacity-80" />}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  title="Change photo"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-footnote font-semibold text-label">Member Profile Photo</p>
                <p className="mt-0.5 text-caption-1 text-secondary-label">
                  Visible to section leaders when taking attendance
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-sm gap-1.5 bg-primary-500/10 text-primary-700 hover:bg-primary-500/15 dark:text-primary-300"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {formData.profile_picture ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {formData.profile_picture && (
                    <>
                      <button
                        type="button"
                        onClick={() => setViewingPhoto(true)}
                        className="btn-ghost btn-sm gap-1 text-secondary-label"
                      >
                        View Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, profile_picture: '' }))}
                        className="btn-ghost btn-sm gap-1 text-rose-700 dark:text-system-red"
                      >
                        <X className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Membership ID */}
              <div>
                <label className="input-label">
                  Membership ID {mode === 'add' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  name="membership_id"
                  value={formData.membership_id}
                  onChange={handleChange}
                  disabled={mode === 'edit'}
                  required
                  className="input disabled:opacity-60"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="input-label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  onPaste={(e) => {
                    e.preventDefault();
                    const v = capitalizeName(e.clipboardData.getData('text'));
                    setFormData((prev) => ({ ...prev, full_name: v }));
                  }}
                  required
                  className="input"
                />
              </div>
            </div>

            {/* ── AUTO-ASSIGNMENT PANEL (add mode) ─────────────────────────── */}
            {mode === 'add' && (
              <div className="space-y-3">
                {/* Banner */}
                {loadingSuggestion ? (
                  <div className="flex animate-pulse items-center gap-3 rounded-xl bg-system-fill p-4">
                    <div className="h-5 w-5 rounded-full bg-system-gray-4" />
                    <span className="text-footnote text-tertiary-label">
                      Finding best section &amp; leader…
                    </span>
                  </div>
                ) : autoSuggestion && !showOverride ? (
                  <div className="flex flex-col justify-between gap-3 rounded-xl bg-system-green/[0.08] p-4 sm:flex-row sm:items-center dark:bg-system-green/[0.1]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-green/15">
                        <Sparkles className="w-4 h-4 text-emerald-700 dark:text-system-green" />
                      </div>
                      <div>
                        <p className="text-caption-1 font-semibold uppercase tracking-[0.06em] text-emerald-700 dark:text-system-green mb-1">
                          Auto-Assigned
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-footnote font-semibold text-label">
                            {autoSuggestion.section_name}
                          </span>
                          <span className="text-tertiary-label">→</span>
                          <span className="text-footnote font-semibold text-label">
                            {autoSuggestion.leader_name}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-system-green/15 px-2 py-0.5 text-caption-2 font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                            <Users className="w-3 h-3" />
                            {autoSuggestion.leader_member_count} members
                          </span>
                        </div>
                        <p className="mt-1 text-caption-1 text-secondary-label">
                          Least-loaded leader — balanced automatically
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOverride(true)}
                      className="btn-secondary btn-sm shrink-0"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Change
                    </button>
                  </div>
                ) : !autoSuggestion && !loadingSuggestion ? (
                  /* Fallback: no sections/leaders yet — show plain dropdowns */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="input-label">
                        Section <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="section_id"
                        value={formData.section_id}
                        onChange={handleChange}
                        required
                        className="input"
                      >
                        <option value="">Select Section</option>
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">
                        Leader <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="leader_id"
                        value={formData.leader_id}
                        onChange={handleChange}
                        required
                        className="input"
                      >
                        <option value="">Select Leader</option>
                        {leaders
                          .filter(
                            (l) =>
                              !formData.section_id || l.section_id === parseInt(formData.section_id)
                          )
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.full_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {/* Override Panel */}
                {showOverride && (
                  <div className="card space-y-4 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                      <p className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                        Manual Override
                      </p>
                      {autoSuggestion && (
                        <button
                          type="button"
                          onClick={applyAutoAssign}
                          className="flex items-center gap-1.5 text-caption-1 font-semibold text-emerald-700 dark:text-system-green hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore Auto-Assign
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Section dropdown with member counts */}
                      <div>
                        <label className="input-label">
                          Section <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="section_id"
                          value={formData.section_id}
                          onChange={handleChange}
                          required
                          className="input"
                        >
                          <option value="">Select Section</option>
                          {rankedSections.map((s) => (
                            <option key={s.section_id} value={s.section_id}>
                              {s.section_name} ({s.member_count} members)
                            </option>
                          ))}
                        </select>
                        {currentSectionInfo && (
                          <p className="mt-1 ml-1 text-caption-1 text-tertiary-label">
                            This section currently has{' '}
                            <strong>{currentSectionInfo.member_count}</strong> active members
                          </p>
                        )}
                      </div>

                      {/* Leader dropdown filtered to selected section, with member counts */}
                      <div>
                        <label className="input-label">
                          Leader <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="leader_id"
                          value={formData.leader_id}
                          onChange={handleChange}
                          required
                          disabled={!formData.section_id}
                          className="input disabled:opacity-50"
                        >
                          <option value="">
                            {formData.section_id ? 'Select Leader' : 'Select section first'}
                          </option>
                          {leadersInSelectedSection.map((l) => (
                            <option key={l.leader_id} value={l.leader_id}>
                              {l.leader_name} ({l.member_count} members)
                            </option>
                          ))}
                        </select>
                        {currentLeaderInfo && (
                          <p className="mt-1 ml-1 text-caption-1 text-tertiary-label">
                            This leader currently has{' '}
                            <strong>{currentLeaderInfo.member_count}</strong> active members
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EDIT MODE: plain section/leader dropdowns ─────────────────── */}
            {mode === 'edit' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="input-label">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="section_id"
                    value={formData.section_id}
                    onChange={handleChange}
                    required
                    className="input"
                  >
                    <option value="">Select Section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">
                    Leader <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="leader_id"
                    value={formData.leader_id}
                    onChange={handleChange}
                    required
                    className="input"
                  >
                    <option value="">Select Leader</option>
                    {leaders
                      .filter(
                        (l) =>
                          !formData.section_id || l.section_id === parseInt(formData.section_id)
                      )
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.full_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Home Cell</label>
                  <select
                    name="home_cell_id"
                    value={formData.home_cell_id}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="">Not assigned</option>
                    {homeCells.map((cell) => (
                      <option key={cell.id} value={cell.id}>
                        {cell.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Home Cell (add mode) */}
            {mode === 'add' && (
              <div className="mt-4">
                <label className="input-label">Home Cell</label>
                <select
                  name="home_cell_id"
                  value={formData.home_cell_id}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Not assigned</option>
                  {homeCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Contact & Demographics */}
          <div className="card p-5">
            <h3 className="section-eyebrow mb-4">Contact &amp; Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="input-label">Primary Phone</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+255 XXX XXX XXX"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, phone: handlePhoneChange(e.target.value) }))
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="input-label">Secondary Phone</label>
                <input
                  type="tel"
                  name="secondary_phone"
                  placeholder="+255 XXX XXX XXX"
                  value={formData.secondary_phone}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      secondary_phone: handlePhoneChange(e.target.value)
                    }))
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="input-label">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="input-label">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="input-label">Marital Status</label>
                <select
                  name="marital_status"
                  value={formData.marital_status}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="input-label">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  placeholder="e.g. Engineer, Teacher"
                  value={formData.occupation}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="input-label">Age Group</label>
                <select
                  name="age_group"
                  value={formData.age_group}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select...</option>
                  <option value="Children">Children</option>
                  <option value="Youth">Youth</option>
                  <option value="Adult">Adult</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>

              <div>
                <label className="input-label">Education Level</label>
                <select
                  name="education_level"
                  value={formData.education_level}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select Level...</option>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                  <option value="Certificate">Certificate</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Degree">Degree</option>
                  <option value="Masters">Masters</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 3: Birthday & Privacy */}
            <div className="card p-5">
              <h3 className="section-eyebrow mb-4">Privacy &amp; Birthday</h3>
              <div className="space-y-4">
                <div>
                  <label className="input-label">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-system-grouped-background/70 p-3 transition-colors hover:bg-system-grouped-background dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      name="show_age_to_leaders"
                      checked={formData.show_age_to_leaders}
                      onChange={handleChange}
                      className="h-4 w-4 cursor-pointer rounded accent-primary-600"
                    />
                    <span className="text-footnote font-medium text-label">Show age</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-system-grouped-background/70 p-3 transition-colors hover:bg-system-grouped-background dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      name="hide_from_birthday_list"
                      checked={formData.hide_from_birthday_list}
                      onChange={handleChange}
                      className="h-4 w-4 cursor-pointer rounded accent-primary-600"
                    />
                    <span className="text-footnote font-medium text-label">Hide bday</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Address */}
            <div className="flex flex-col card p-5">
              <h3 className="section-eyebrow mb-4">Residential Address</h3>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input min-h-[110px] flex-1 resize-none"
                placeholder="Enter member's residential address..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 5: Opt-outs */}
            <div className="card p-5">
              <h3 className="section-eyebrow mb-3">Service Opt-outs</h3>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.map((service) => {
                  const isOptedOut = formData.opt_out_services?.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleToggleOptOut(service.id)}
                      className={`px-2.5 py-1 rounded-full text-caption-2 font-semibold uppercase tracking-[0.06em] transition-colors ${
                        isOptedOut
                          ? 'bg-system-red/15 text-rose-700 dark:text-system-red'
                          : 'bg-system-green/15 text-emerald-700 opacity-50 hover:opacity-100 dark:text-system-green'
                      }`}
                    >
                      {isOptedOut ? 'Excluded' : 'Included'}: {service.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 6: History Toggle */}
            {mode === 'edit' && auditHistory.length > 0 && (
              <div className="card p-5">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center justify-between text-footnote font-semibold text-secondary-label transition-colors hover:text-label"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Change Audit History ({auditHistory.length})
                  </div>
                  <span>{showHistory ? 'Hide' : 'View'}</span>
                </button>

                {showHistory && (
                  <div className="mt-4 space-y-3 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                    {auditLoading ? (
                      <p className="text-footnote text-tertiary-label">Loading history...</p>
                    ) : (
                      auditHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg bg-system-grouped-background/70 p-2 text-caption-1 dark:bg-white/[0.03]"
                        >
                          <div className="flex justify-between font-semibold mb-1">
                            <span className="uppercase text-primary-700 dark:text-primary-300">
                              {entry.action}
                            </span>
                            <span className="text-tertiary-label">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="truncate text-secondary-label">
                            By {entry.user_full_name || 'System'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-separator/60 pt-5 dark:border-white/[0.08]">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingSuggestion}
              className="btn-primary px-8"
            >
              {saving
                ? 'Saving...'
                : loadingSuggestion
                  ? 'Loading…'
                  : mode === 'edit'
                    ? 'Save Changes'
                    : 'Add Member'}
            </button>
          </div>
        </form>
      </div>

      {viewingPhoto && formData.profile_picture && (
        <PhotoViewer
          src={formData.profile_picture}
          alt={formData.full_name || 'Member Photo'}
          onClose={() => setViewingPhoto(false)}
        />
      )}
    </div>,
    document.body
  );
};

export default MemberEditModal;
