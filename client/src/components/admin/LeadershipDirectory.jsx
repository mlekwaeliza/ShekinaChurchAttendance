import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Search, Users, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { adminAPI } from '../../services/api';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

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

  return (
    <div>
      <div className="gradient-banner mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-white/5 blur-3xl translate-y-24" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Leadership Directory</h1>
            <p className="text-sm text-white/80">View all members with leadership roles across the congregation</p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-toolbar mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
              <button type="button" onClick={() => { setTitleFilter(''); setStatusFilter(''); setSectionFilter(''); setAppointmentFrom(''); setAppointmentTo(''); setSearch(''); setPage(1); }} className="btn-icon btn-secondary" title="Clear filters">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <span className="text-xs text-slate-400">{data.directory.length} result{data.directory.length !== 1 ? 's' : ''}</span>
          {data.directory.length > 0 && (
            <button onClick={handleExport} className="btn-sm btn-secondary">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data.directory}
        searchable={false}
        emptyIcon={Users}
        emptyTitle="No leadership assignments found"
        emptyDescription="Assign titles to members from the Members page."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-3 py-2 rounded-xl disabled:opacity-40"
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
                  className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
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
            className="btn-secondary px-3 py-2 rounded-xl disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default LeadershipDirectory;
