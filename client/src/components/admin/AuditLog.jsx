import React, { useState, useEffect, useMemo } from 'react';
import { adminAPI } from '../../services/api';
import { Shield, Filter, Calendar, Search, User, FileText, Users, UserCog, Key, RefreshCw } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { fdatetime } from '../../utils/date';

const AuditLog = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.userId) params.userId = filters.userId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      params.limit = 500;

      const res = await adminAPI.getAuditLog(params);
      setEntries(res.data);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    loadAuditLog();
  };

  const handleClearFilters = () => {
    setFilters({ entityType: '', action: '', userId: '', startDate: '', endDate: '' });
    setTimeout(() => loadAuditLog(), 0);
  };

  const actionColors = {
    create: 'success',
    update: 'info',
    delete: 'danger',
  };

  const entityIcons = {
    member: <Users className="w-3.5 h-3.5" />,
    section: <FileText className="w-3.5 h-3.5" />,
    leader: <UserCog className="w-3.5 h-3.5" />,
    attendance: <Calendar className="w-3.5 h-3.5" />,
    user: <User className="w-3.5 h-3.5" />,
  };

  const formatDateTime = (dateStr) => {
    return fdatetime(dateStr);
  };

  const parseValue = (val) => {
    if (!val) return null;
    try { return JSON.parse(val); } catch { return val; }
  };

  const columns = useMemo(() => [
    {
      accessor: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      accessor: 'user',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
            {(row.user_full_name || row.user_username || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {row.user_full_name || row.user_username || 'System'}
            </p>
            {row.user_role && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{row.user_role}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessor: 'action',
      header: 'Action',
      sortable: true,
      render: (row) => (
        <Badge variant={actionColors[row.action] || 'neutral'}>
          {row.action}
        </Badge>
      ),
    },
    {
      accessor: 'entity',
      header: 'Entity',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 dark:text-slate-500">
            {entityIcons[row.entity_type] || <Shield className="w-3.5 h-3.5" />}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
            {row.entity_type}
          </span>
          {row.entity_id && (
            <span className="text-xs text-slate-400 dark:text-slate-500">#{row.entity_id}</span>
          )}
        </div>
      ),
    },
    {
      accessor: 'details',
      header: 'Details',
      render: (row) => {
        const oldValue = parseValue(row.old_value);
        const newValue = parseValue(row.new_value);
        return (
          <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            {row.action === 'delete' && <span className="text-rose-500 dark:text-rose-400">Record deleted</span>}
            {row.action === 'create' && newValue && (
              <span className="text-emerald-600 dark:text-emerald-400">Created with {Object.keys(newValue).length} fields</span>
            )}
            {row.action === 'update' && oldValue && newValue && (
              <span className="text-primary-600 dark:text-primary-400">
                {Object.keys(newValue).length} field(s) modified
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessor: 'ip_address',
      header: 'IP',
      render: (row) => (
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
          {row.ip_address || '—'}
        </span>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Audit Log</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track all changes made in the system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary btn-sm ${showFilters ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-400' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button onClick={loadAuditLog} className="btn-secondary btn-sm" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-5 animate-fade-in-down">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="input-label">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)}
                className="select"
              >
                <option value="">All</option>
                <option value="member">Members</option>
                <option value="section">Sections</option>
                <option value="leader">Leaders</option>
                <option value="attendance">Attendance</option>
                <option value="user">Users</option>
              </select>
            </div>
            <div>
              <label className="input-label">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="select"
              >
                <option value="">All</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
            </div>
            <div>
              <label className="input-label">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input"
              />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleApplyFilters} className="btn-primary btn-sm flex-1">
                Apply
              </button>
              <button onClick={handleClearFilters} className="btn-secondary btn-sm">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span>{entries.length} entries</span>
        {filters.entityType && <Badge variant="info">{filters.entityType}</Badge>}
        {filters.action && <Badge variant={actionColors[filters.action] || 'neutral'}>{filters.action}</Badge>}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={entries}
        searchable={true}
        searchPlaceholder="Search audit log..."
        searchKeys={['user_full_name', 'user_username', 'entity_type', 'ip_address']}
        emptyIcon={Shield}
        emptyTitle="No audit entries"
        emptyDescription="No changes have been recorded yet."
        loading={loading}
      />
    </div>
  );
};

export default AuditLog;
