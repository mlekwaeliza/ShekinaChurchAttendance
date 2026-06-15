import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Search, Users, X, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { adminAPI } from '../../services/api';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

const LeadershipDirectory = () => {
  const [data, setData] = useState({ directory: [], titles: [], sections: [] });
  const [loading, setLoading] = useState(true);
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [appointmentFrom, setAppointmentFrom] = useState('');
  const [appointmentTo, setAppointmentTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  const [searchParams, setSearchParams] = useSearchParams();

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (titleFilter) params.title_id = titleFilter;
      if (statusFilter) params.status = statusFilter;
      if (sectionFilter) params.section_id = sectionFilter;
      if (search.trim()) params.search = search.trim();
      if (appointmentFrom) params.appointment_from = appointmentFrom;
      if (appointmentTo) params.appointment_to = appointmentTo;
      const res = await adminAPI.getLeadershipDirectory(params);
      setData(res.data || { directory: [], titles: [], sections: [] });
      setTotalPages(Math.ceil((res.data?.total || res.data?.directory?.length || 0) / limit));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // Initialize filters from URL on mount
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    if (params.title_id) setTitleFilter(params.title_id);
    if (params.status) setStatusFilter(params.status);
    if (params.section_id) setSectionFilter(params.section_id);
    if (params.search) setSearch(params.search);
    if (params.appointment_from) setAppointmentFrom(params.appointment_from);
    if (params.appointment_to) setAppointmentTo(params.appointment_to);
    if (params.page) setPage(parseInt(params.page));
  }, []);

  useEffect(() => {
    loadDirectory();
    // Sync to URL
    const nextParams = new URLSearchParams();
    if (titleFilter) nextParams.set('title_id', titleFilter);
    if (statusFilter) nextParams.set('status', statusFilter);
    if (sectionFilter) nextParams.set('section_id', sectionFilter);
    if (search.trim()) nextParams.set('search', search.trim());
    if (appointmentFrom) nextParams.set('appointment_from', appointmentFrom);
    if (appointmentTo) nextParams.set('appointment_to', appointmentTo);
    if (page > 1) nextParams.set('page', String(page));
    setSearchParams(nextParams, { replace: true });
  }, [titleFilter, statusFilter, sectionFilter, appointmentFrom, appointmentTo, page, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadDirectory();
  };

  const handleExport = () => {
    if (data.directory.length === 0) return;
    const headers = ['Name', 'S/N', 'Section', 'Title', 'Status', 'Appointed', 'Phone', 'Email', 'Assigned By'];
    const rows = data.directory.map((d) => [
      d.full_name,
      d.membership_id,
      d.section_name || '—',
      d.title_name,
      d.title_status || 'active',
      d.appointment_date ? new Date(d.appointment_date).toLocaleDateString() : '—',
      d.phone || '—',
      d.email || '—',
      d.assigned_by_name || '—',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leadership-directory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const STATUS_VARIANTS = {
    active: 'success',
    on_leave: 'warning',
    emeritus: 'info',
    probationary: 'warning',
    retired: 'neutral',
    inactive: 'neutral',
  };
  const STATUS_LABELS = {
    active: 'Active',
    on_leave: 'On Leave',
    emeritus: 'Emeritus',
    probationary: 'Probationary',
    retired: 'Retired',
    inactive: 'Inactive',
  };

  // Assign leader modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignDirty, setAssignDirty] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const assignRef = useRef(null);
  const assignSelectedMember = useMemo(() => allMembers.find((m) => m.id === selectedMemberId), [allMembers, selectedMemberId]);

  // Load all members for the assign modal
  useEffect(() => {
    if (showAssignModal && allMembers.length === 0) {
      adminAPI.getMembers({ limit: 5000 }).then((res) => setAllMembers(res.data?.members || [])).catch(() => {});
    }
  }, [showAssignModal]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assignRef.current && !assignRef.current.contains(e.target)) { setShowMemberDropdown(false); if (assignDirty && !selectedMemberId) { setAssignSearch(''); setAssignDirty(false); } }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assignDirty, selectedMemberId]);

  const assignMemberList = useMemo(() => {
    if (!assignSearch.trim()) return allMembers.slice(0, 20);
    const term = assignSearch.toLowerCase();
    return allMembers.filter((m) => (m.full_name || '').toLowerCase().includes(term)).slice(0, 20);
  }, [assignSearch, allMembers]);

  // Stats derived from current data
  const totalLeaders = data.directory.length;
  const activeLeaders = data.directory.filter((d) => d.title_status === 'active').length;

  const handleAssignLeader = async (e) => {
    e.preventDefault();
    if (!selectedMemberId || !selectedTitleId) return;
    setAssignSaving(true);
    try {
      await adminAPI.assignMemberTitle(selectedMemberId, parseInt(selectedTitleId), {
        appointment_date: appointmentDate || null,
        notes: assignNotes || null,
      });
      setShowAssignModal(false);
      setAssignSearch('');
      setAssignDirty(false);
      setSelectedMemberId(null);
      setSelectedTitleId('');
      setAppointmentDate('');
      setAssignNotes('');
      loadDirectory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign title');
    } finally {
      setAssignSaving(false);
    }
  };

  const columns = [
    { accessor: 'full_name', header: 'Name', sortable: true },
    { accessor: 'membership_id', header: 'S/N', sortable: true },
    { accessor: 'section_name', header: 'Section', sortable: true },
    {
      accessor: 'title_name',
      header: 'Title',
      sortable: true,
      render: (row) => <Badge variant="info" className="text-[11px] px-2 py-0.5">{row.title_name}</Badge>,
    },
    {
      accessor: 'title_status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.title_status] || 'neutral'} className="text-[11px] px-2 py-0.5">
          {STATUS_LABELS[row.title_status] || row.title_status || 'Active'}
        </Badge>
      ),
    },
    { accessor: 'appointment_date', header: 'Appointed', sortable: true, render: (row) => row.appointment_date ? new Date(row.appointment_date).toLocaleDateString() : '—' },
    { accessor: 'phone', header: 'Phone' },
    { accessor: 'email', header: 'Email' },
    { accessor: 'assigned_by_name', header: 'Assigned By', sortable: true },
  ];

  const hasAnyFilters = titleFilter || statusFilter || sectionFilter || search.trim() || appointmentFrom || appointmentTo;

  return (
    <div>
      {/* Gradient Banner */}
      <div className="gradient-banner mb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-white/5 blur-3xl translate-y-24" />
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white/[0.03] blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Leadership Directory</h1>
              <p className="text-sm text-white/80">View all members with leadership roles across the congregation</p>
            </div>
          </div>
          {/* Stat cards */}
          {!loading && (
            <div className="flex gap-4">
              <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/10">
                <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Total Leaders</p>
                <p className="text-2xl font-bold text-white mt-0.5">{totalLeaders}</p>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/10">
                <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Active</p>
                <p className="text-2xl font-bold text-emerald-300 mt-0.5">{activeLeaders}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="card-glass mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="input pl-9 h-10"
                placeholder="Search by name or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <select className="select h-10" value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)}>
                <option value="">All Titles</option>
                {data.titles.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <select className="select h-10" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="emeritus">Emeritus</option>
                <option value="probationary">Probationary</option>
                <option value="retired">Retired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <select className="select h-10" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <option value="">All Sections</option>
                {data.sections?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="date"
                className="input h-10"
                value={appointmentFrom}
                onChange={(e) => setAppointmentFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input h-10 flex-1"
                value={appointmentTo}
                onChange={(e) => setAppointmentTo(e.target.value)}
              />
              {hasAnyFilters && (
                <button type="button" onClick={() => { setTitleFilter(''); setStatusFilter(''); setSectionFilter(''); setAppointmentFrom(''); setAppointmentTo(''); setSearch(''); setPage(1); }} className="btn-icon btn-secondary shrink-0 active:scale-90" title="Clear filters">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Toolbar Footer with count & actions */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            {loading ? 'Loading...' : `${totalLeaders} leader${totalLeaders !== 1 ? 's' : ''} found`}
          </div>
          <button onClick={() => setShowAssignModal(true)} className="btn-sm btn-primary ml-auto active:scale-[0.97]">
            <Plus className="w-3.5 h-3.5" /> Assign Leader
          </button>
          {totalLeaders > 0 && (
            <button onClick={handleExport} className="btn-sm btn-secondary active:scale-[0.97]">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table or Loading/Empty States */}
      {loading ? (
        <div className="card-glass divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      ) : totalLeaders > 0 ? (
        <DataTable
          columns={columns}
          data={data.directory}
          searchable={false}
          emptyIcon={Users}
          emptyTitle="No leadership assignments found"
          emptyDescription="Assign titles to members from the Members page."
        />
      ) : (
        <div className="card-glass flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 ring-1 ring-slate-200 dark:ring-slate-700">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No leaders assigned yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
            Create titles in the <strong>Titles</strong> section, then assign them to members here.
          </p>
          <button onClick={() => setShowAssignModal(true)} className="btn-primary active:scale-[0.97]">
            <Plus className="w-4 h-4" /> Assign Your First Leader
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-3 py-2 rounded-xl disabled:opacity-40 active:scale-[0.97]"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all active:scale-[0.92] ${
                    p === page
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-secondary px-3 py-2 rounded-xl disabled:opacity-40 active:scale-[0.97]"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Assign Leader Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Leadership Title" subtitle="Search and select a member to assign a leadership role">
        <form onSubmit={handleAssignLeader}>
          <div className="space-y-4">
            <div className="relative" ref={assignRef}>
              <label className="input-label">Member</label>
              <input
                required
                type="text"
                value={assignDirty ? assignSearch : (assignSelectedMember ? assignSelectedMember.full_name : assignSearch)}
                onChange={(e) => { setAssignSearch(e.target.value); setShowMemberDropdown(true); setAssignDirty(true); if (selectedMemberId) setSelectedMemberId(null); }}
                onFocus={() => setShowMemberDropdown(true)}
                onBlur={() => { if (assignDirty && !selectedMemberId) { setTimeout(() => { setAssignSearch(''); setAssignDirty(false); }, 200); } }}
                placeholder="Search member name..."
                className="input w-full"
              />
              {showMemberDropdown && assignMemberList.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/10 max-h-48 overflow-y-auto animate-fade-in">
                  {assignMemberList.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMemberId(m.id);
                        setAssignSearch('');
                        setAssignDirty(false);
                        setShowMemberDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                        m.id === selectedMemberId
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {(m.full_name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate font-medium">{m.full_name}</span>
                      {m.section_name && <span className="text-[10px] text-slate-400 ml-auto shrink-0">{m.section_name}</span>}
                    </button>
                  ))}
                </div>
              )}
              {assignDirty && !selectedMemberId && !showMemberDropdown && (
                <p className="text-[11px] text-rose-500 mt-1">Please select a member from the list</p>
              )}
            </div>
            <div>
              <label className="input-label">Title</label>
              <select required className="select h-10 w-full" value={selectedTitleId} onChange={(e) => setSelectedTitleId(e.target.value)}>
                <option value="">Select a title...</option>
                {data.titles.filter((t) => t.is_active).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Appointment Date</label>
              <input type="date" className="input h-10 w-full" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Notes</label>
              <textarea className="input w-full" rows={3} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} placeholder="Reason, term, etc." />
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
            <button type="button" onClick={() => { setShowAssignModal(false); setAssignSearch(''); setSelectedMemberId(null); setSelectedTitleId(''); setAppointmentDate(''); setAssignNotes(''); }} className="btn-secondary flex-1 active:scale-[0.97]">Cancel</button>
            <button type="submit" disabled={!selectedMemberId || !selectedTitleId || assignSaving} className="btn-primary flex-1 active:scale-[0.97]">
              {assignSaving ? (
                <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning...</span>
              ) : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeadershipDirectory;
