import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Search, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Leadership Directory</h1>
            <p className="text-sm text-white/80">View all members with leadership roles across the congregation</p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="input-field pl-9"
                placeholder="Search by name or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-48">
              <select className="input-field" value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)}>
                <option value="">All Titles</option>
                {data.titles.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="emeritus">Emeritus</option>
                <option value="probationary">Probationary</option>
                <option value="retired">Retired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="w-48">
              <select className="input-field" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <option value="">All Sections</option>
                {data.sections?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <input
                type="date"
                className="input-field"
                placeholder="Appointed From"
                value={appointmentFrom}
                onChange={(e) => setAppointmentFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <input
                type="date"
                className="input-field"
                placeholder="Appointed To"
                value={appointmentTo}
                onChange={(e) => setAppointmentTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setTitleFilter(''); setStatusFilter(''); setSectionFilter(''); setAppointmentFrom(''); setAppointmentTo(''); setSearch(''); setPage(1); }} className="btn-ghost text-sm flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>
        </form>
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
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary p-2 rounded-lg disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-secondary p-2 rounded-lg disabled:opacity-50"
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
