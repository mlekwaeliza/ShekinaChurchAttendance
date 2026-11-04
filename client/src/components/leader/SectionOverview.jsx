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
  loadOverview
}) => {
  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const columns = [
    {
      accessor: 'leader_name',
      header: 'Subleader Name',
      sortable: true,
      render: (row) => <span className="font-semibold text-label">{row.leader_name}</span>
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      render: (row) =>
        row.submitted ? (
          <div className="flex flex-col items-center gap-1">
            <Badge variant={row.submitted_on_behalf ? 'warning' : 'success'}>
              <CheckCircle2 className="w-3 h-3" />
              {row.submitted_on_behalf ? 'Covered' : 'Verified'}
            </Badge>
            {row.submitted_by_name && (
              <span className="text-caption-2 font-medium text-secondary-label">
                by {row.submitted_by_name}
              </span>
            )}
          </div>
        ) : (
          <Badge variant="neutral">Pending</Badge>
        )
    },
    {
      id: 'present',
      header: 'Present',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-emerald-700 dark:text-system-green tabular-nums">
          {row.stats.present}
        </span>
      )
    },
    {
      id: 'absent',
      header: 'Absent',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-rose-700 dark:text-system-red tabular-nums">
          {row.stats.absent}
        </span>
      )
    },
    {
      id: 'excused',
      header: 'Excused',
      align: 'center',
      render: (row) => (
        <span className="font-semibold text-amber-700 dark:text-system-orange tabular-nums">
          {row.stats.excused}
        </span>
      )
    }
  ];

  if (overviewLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="card space-y-4 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h3 className="text-title-3 font-semibold text-label">Section Overview</h3>
            <p className="mt-0.5 text-footnote text-secondary-label">
              Monitoring subleader attendance for '{sectionName}'
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background p-1.5 shadow-card dark:border-white/[0.08]">
              <span className="px-2 text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                Date
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none bg-transparent p-0 pr-2 text-footnote font-semibold text-label focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Service Selector */}
        <div className="flex flex-wrap items-center gap-2 border-t border-separator/60 pt-3 dark:border-white/[0.08]">
          {serviceTypes.map((service) => (
            <button
              key={service.id}
              onClick={() => onServiceChange(service.id)}
              className={`focus-ring rounded-lg px-3.5 py-1.5 text-footnote font-semibold transition-colors ${
                selectedServiceId === service.id
                  ? 'bg-primary-500 text-white shadow-segmented'
                  : 'bg-system-fill text-secondary-label hover:text-label'
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
          <p className="empty-state-desc">Try selecting a different date or refreshing.</p>
        </div>
      )}
    </div>
  );
};

export default SectionOverview;
