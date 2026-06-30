import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { adminAPI } from '../services/api';
import { History, User, Calendar, Sparkles, ChevronDown, RotateCcw, Users } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

const MemberEditModal = ({ member, mode = 'edit', sections = [], leaders = [], isOpen, onClose, onSave }) => {
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
    show_age_to_leaders: false,
    hide_from_birthday_list: false,
    opt_out_services: []
  });

  // ── Auto-assignment state (add mode only) ─────────────────────────────────
  const [autoSuggestion, setAutoSuggestion]   = useState(null);   // the suggested { section_id, leader_id, ... }
  const [rankedSections, setRankedSections]   = useState([]);     // sections ordered by member_count asc
  const [rankedLeaders, setRankedLeaders]     = useState([]);     // leaders ordered by member_count asc
  const [showOverride, setShowOverride]       = useState(false);  // reveal manual override panel
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const isAutoAssigned = useRef(false); // true when current formData matches auto suggestion

  // ── Other state ───────────────────────────────────────────────────────────
  const [serviceTypes, setServiceTypes] = useState([]);
  const [homeCells, setHomeCells]       = useState([]);
  const [saving, setSaving]             = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, isOpen, onClose);

  // ── On open ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && member) {
      setFormData({
        membership_id: member.membership_id || '',
        full_name:     member.full_name || '',
        phone:         member.phone || '',
        email:         member.email || '',
        gender:        member.gender || '',
        marital_status: member.marital_status || '',
        occupation:    member.occupation || '',
        age_group:     member.age_group || '',
        section_id:    member.section_id || '',
        leader_id:     member.leader_id || '',
        home_cell_id:  member.home_cell_id || '',
        date_of_birth: member.date_of_birth || '',
        address:       member.address || '',
        show_age_to_leaders:    !!member.show_age_to_leaders,
        hide_from_birthday_list: !!member.hide_from_birthday_list,
        opt_out_services: member.opt_out_services ? JSON.parse(member.opt_out_services) : []
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
          full_name: '', phone: '', email: '', gender: '', marital_status: '',
          occupation: '', age_group: '', section_id: '', leader_id: '',
          home_cell_id: '', date_of_birth: '', address: '',
          show_age_to_leaders: false, hide_from_birthday_list: false,
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

  const fetchSuggestion = async (currentMembershipId) => {
    setLoadingSuggestion(true);
    try {
      const res = await adminAPI.getSuggestAssignment();
      const { suggestion, sections: ranked, leaders: rankedL } = res.data;
      setRankedSections(ranked || []);
      setRankedLeaders(rankedL || []);
      setAutoSuggestion(suggestion);
      if (suggestion) {
        setFormData(prev => ({
          ...prev,
          section_id: String(suggestion.section_id),
          leader_id:  String(suggestion.leader_id),
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
    setFormData(prev => ({
      ...prev,
      section_id: String(autoSuggestion.section_id),
      leader_id:  String(autoSuggestion.leader_id),
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // If admin manually changes section/leader, mark as no longer auto
    if (name === 'section_id' || name === 'leader_id') {
      isAutoAssigned.current = false;
    }
    // When section changes in override mode, reset leader to first available
    if (name === 'section_id') {
      const firstLeader = rankedLeaders.find(l => String(l.section_id) === value);
      setFormData(prev => ({
        ...prev,
        section_id: value,
        leader_id: firstLeader ? String(firstLeader.leader_id) : '',
      }));
    }
  };

  const handleToggleOptOut = (serviceId) => {
    setFormData(prev => {
      const current = prev.opt_out_services || [];
      const updated = current.includes(serviceId)
        ? current.filter(id => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, opt_out_services: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'edit') {
        await onSave(member.id, formData);
      } else {
        await onSave(null, formData);
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
    l => String(l.section_id) === String(formData.section_id)
  );

  // Find display info for current selection (when suggestion loaded)
  const currentSectionInfo = rankedSections.find(s => String(s.section_id) === String(formData.section_id));
  const currentLeaderInfo  = rankedLeaders.find(l => String(l.leader_id) === String(formData.leader_id));

  if (!isOpen) return null;
  if (mode === 'edit' && !member) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center overflow-y-auto z-[9999] p-3 sm:p-5 animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-edit-title"
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full p-5 sm:p-8 border border-gray-100 dark:border-slate-700 max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 id="member-edit-title" className="text-2xl font-black text-gray-900 dark:text-slate-100">
                {mode === 'edit' ? 'Edit Member' : 'Add Member'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {mode === 'edit'
                  ? 'Update member identity, contact information, and preferences.'
                  : 'Fill in the details — section & leader are auto-assigned for you.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-200 text-3xl transition-colors outline-none focus:outline-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Identity & Assignment */}
          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
              Identity &amp; Assignment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Membership ID */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Membership ID {mode === 'add' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  name="membership_id"
                  value={formData.membership_id}
                  onChange={handleChange}
                  disabled={mode === 'edit'}
                  required
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all disabled:opacity-70"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* ── AUTO-ASSIGNMENT PANEL (add mode) ─────────────────────────── */}
            {mode === 'add' && (
              <div className="space-y-3">
                {/* Banner */}
                {loadingSuggestion ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse">
                    <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span className="text-sm text-slate-400">Finding best section &amp; leader…</span>
                  </div>
                ) : autoSuggestion && !showOverride ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                          Auto-Assigned
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {autoSuggestion.section_name}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {autoSuggestion.leader_name}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                            <Users className="w-3 h-3" />
                            {autoSuggestion.leader_member_count} members
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Least-loaded leader — balanced automatically
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOverride(true)}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Change
                    </button>
                  </div>
                ) : !autoSuggestion && !loadingSuggestion ? (
                  /* Fallback: no sections/leaders yet — show plain dropdowns */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                        Section <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="section_id"
                        value={formData.section_id}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                        Leader <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="leader_id"
                        value={formData.leader_id}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">Select Leader</option>
                        {leaders.filter(l => !formData.section_id || l.section_id === parseInt(formData.section_id)).map(l => (
                          <option key={l.id} value={l.id}>{l.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {/* Override Panel */}
                {showOverride && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Manual Override</p>
                      {autoSuggestion && (
                        <button
                          type="button"
                          onClick={applyAutoAssign}
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore Auto-Assign
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Section dropdown with member counts */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                          Section <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="section_id"
                          value={formData.section_id}
                          onChange={handleChange}
                          required
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">Select Section</option>
                          {rankedSections.map(s => (
                            <option key={s.section_id} value={s.section_id}>
                              {s.section_name} ({s.member_count} members)
                            </option>
                          ))}
                        </select>
                        {currentSectionInfo && (
                          <p className="text-[11px] text-slate-400 mt-1 ml-1">
                            This section currently has <strong>{currentSectionInfo.member_count}</strong> active members
                          </p>
                        )}
                      </div>

                      {/* Leader dropdown filtered to selected section, with member counts */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                          Leader <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="leader_id"
                          value={formData.leader_id}
                          onChange={handleChange}
                          required
                          disabled={!formData.section_id}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
                        >
                          <option value="">
                            {formData.section_id ? 'Select Leader' : 'Select section first'}
                          </option>
                          {leadersInSelectedSection.map(l => (
                            <option key={l.leader_id} value={l.leader_id}>
                              {l.leader_name} ({l.member_count} members)
                            </option>
                          ))}
                        </select>
                        {currentLeaderInfo && (
                          <p className="text-[11px] text-slate-400 mt-1 ml-1">
                            This leader currently has <strong>{currentLeaderInfo.member_count}</strong> active members
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="section_id"
                    value={formData.section_id}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select Section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Leader <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="leader_id"
                    value={formData.leader_id}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select Leader</option>
                    {leaders.filter(l => !formData.section_id || l.section_id === parseInt(formData.section_id)).map(l => (
                      <option key={l.id} value={l.id}>{l.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Home Cell</label>
                  <select
                    name="home_cell_id"
                    value={formData.home_cell_id}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Not assigned</option>
                    {homeCells.map(cell => (
                      <option key={cell.id} value={cell.id}>{cell.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Home Cell (add mode) */}
            {mode === 'add' && (
              <div className="mt-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Home Cell</label>
                <select
                  name="home_cell_id"
                  value={formData.home_cell_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Not assigned</option>
                  {homeCells.map(cell => (
                    <option key={cell.id} value={cell.id}>{cell.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Contact & Demographics */}
          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
              Contact &amp; Demographics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+255..."
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Marital Status</label>
                <select
                  name="marital_status"
                  value={formData.marital_status}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  placeholder="e.g. Engineer, Teacher"
                  value={formData.occupation}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Age Group</label>
                <select
                  name="age_group"
                  value={formData.age_group}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select...</option>
                  <option value="Children">Children</option>
                  <option value="Youth">Youth</option>
                  <option value="Adult">Adult</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 3: Birthday & Privacy */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                Privacy &amp; Birthday
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 cursor-pointer hover:bg-white dark:hover:bg-slate-700 transition-all">
                    <input
                      type="checkbox"
                      name="show_age_to_leaders"
                      checked={formData.show_age_to_leaders}
                      onChange={handleChange}
                      className="w-5 h-5 rounded-md border-gray-300 dark:border-slate-600 focus:ring-primary-500 text-primary-600"
                    />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Show age</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 cursor-pointer hover:bg-white dark:hover:bg-slate-700 transition-all">
                    <input
                      type="checkbox"
                      name="hide_from_birthday_list"
                      checked={formData.hide_from_birthday_list}
                      onChange={handleChange}
                      className="w-5 h-5 rounded-md border-gray-300 dark:border-slate-600 focus:ring-primary-500 text-primary-600"
                    />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Hide bday</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Address */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div>
                Residential Address
              </h3>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-full"
                placeholder="Enter member's residential address..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 5: Opt-outs */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                Service Opt-outs
              </h3>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.map(service => {
                  const isOptedOut = formData.opt_out_services?.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleToggleOptOut(service.id)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${
                        isOptedOut
                          ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 opacity-40 hover:opacity-100'
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
              <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
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
                      <p className="text-xs text-slate-400">Loading history...</p>
                    ) : (
                      auditHistory.map((entry) => (
                        <div key={entry.id} className="text-[11px] p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between font-bold mb-1">
                            <span className="uppercase text-primary-600">{entry.action}</span>
                            <span className="text-slate-400">{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-500 truncate">By {entry.user_full_name || 'System'}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingSuggestion}
              className="px-8 py-2.5 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-glow transition-all disabled:opacity-70"
            >
              {saving ? 'Saving...' : loadingSuggestion ? 'Loading…' : (mode === 'edit' ? 'Save Changes' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default MemberEditModal;
