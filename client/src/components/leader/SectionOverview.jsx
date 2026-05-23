import React from 'react';
import { Users, CheckCircle2, XCircle, Clock3, Eye } from 'lucide-react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

const SectionOverview = ({
  selectedDate,
  setSelectedDate,
  serviceTypes = [],
  selectedServiceId,
  onServiceChange,
  sectionName,
  overviewData,
  overviewLoading,
  loadOverview,
}) => {
  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const columns = [
    {
      accessor: 'leader_name',
      header: 'Subleader Name',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">{row.leader_name}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      render: (row) =>
        row.submitted ? (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="neutral">Pending</Badge>
        ),
    },
    {
      id: 'present',
      header: 'Present',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {row.stats.present}
        </span>
      ),
    },
    {
      id: 'absent',
      header: 'Absent',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
          {row.stats.absent}
        </span>
      ),
    },
    {
      id: 'excused',
      header: 'Excused',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
          {row.stats.excused}
        </span>
      ),
    },
  ];

  if (overviewLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-slate-50 dark:from-primary-900/10 dark:to-slate-800/50 border-primary-100 dark:border-primary-800/50 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Section Overview
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Monitoring subleader attendance for '{sectionName}'
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
             <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase px-2">Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold focus:ring-0 p-0 pr-2"
                />
             </div>
          </div>
        </div>

        {/* Service Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          {serviceTypes.map((service) => (
            <button
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 ${
                selectedServiceId === service.id
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 ring-2 ring-primary-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary-400'
              }`}
            >
              {service.name}
            </button>
          ))}
        </div>
      </div>

      {overviewData ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Leaders Submitted"
              value={`${overviewData.stats.total_submitted_leaders}/${overviewData.stats.total_leaders}`}
              variant="info"
            />
            <StatCard
              icon={CheckCircle2}
              label="Total Present"
              value={overviewData.stats.present}
              variant="success"
            />
            <StatCard
              icon={XCircle}
              label="Total Absent"
              value={overviewData.stats.absent}
              variant="danger"
            />
            <StatCard
              icon={Clock3}
              label="Total Excused"
              value={overviewData.stats.excused}
              variant="warning"
            />
          </div>

          {/* Subleader Table */}
          <DataTable
            columns={columns}
            data={overviewData.subleaders}
            searchable={false}
            emptyIcon={Eye}
            emptyTitle="No leaders found"
            emptyDescription="No leaders found in this section."
          />
        </>
      ) : (
        <div className="empty-state">
          <p className="empty-state-title">Failed to load data</p>
          <p className="empty-state-desc">
            Try selecting a different date or refreshing.
          </p>
        </div>
      )}
    </div>
  );
};

export default SectionOverview;
