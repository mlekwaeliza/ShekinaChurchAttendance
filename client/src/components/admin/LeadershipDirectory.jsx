import React, { useEffect, useState } from 'react';
import { Award, Search, Users, Filter, X } from 'lucide-react';
import { adminAPI } from '../../services/api';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

const LeadershipDirectory = () => {
  const [data, setData] = useState({ directory: [], titles: [] });
  const [loading, setLoading] = useState(true);
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (titleFilter) params.title_id = titleFilter;
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await adminAPI.getLeadershipDirectory(params);
      setData(res.data || { directory: [], titles: [] });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDirectory(); }, [titleFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadDirectory();
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
        <Badge variant={row.title_status === 'active' ? 'success' : 'neutral'} className="text-[11px] px-2 py-0.5">
          {row.title_status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { accessor: 'appointment_date', header: 'Appointed', sortable: true },
    { accessor: 'phone', header: 'Phone' },
    { accessor: 'email', header: 'Email' },
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

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="input-field pl-9"
              placeholder="Search by name or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>
        <div className="w-48">
          <select className="input-field" value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)}>
            <option value="">All Titles</option>
            {data.titles.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {(titleFilter || statusFilter || search.trim()) && (
          <button onClick={() => { setTitleFilter(''); setStatusFilter(''); setSearch(''); }} className="btn-ghost text-sm flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data.directory}
        searchable={false}
        emptyIcon={Users}
        emptyTitle="No leadership assignments found"
        emptyDescription="Assign titles to members from the Members page."
      />
    </div>
  );
};

export default LeadershipDirectory;
