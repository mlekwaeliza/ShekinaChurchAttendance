import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

const LeaderHistory = ({ history, historyLoading, isHead }) => {
  const columns = [
    {
      accessor: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {new Date(row.date).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      accessor: 'service_name',
      header: 'Service',
      sortable: true,
      render: (row) => (
        <Badge variant={row.service_id === 1 ? 'info' : 'primary'}>
          {row.service_name || 'Main Service'}
        </Badge>
      ),
    },
    ...(isHead
      ? [
          {
            accessor: 'leader_name',
            header: 'Leader',
            sortable: true,
            render: (row) => (
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {row.leader_name}
              </span>
            ),
          },
        ]
      : []),
    {
      accessor: 'submitted_at',
      header: 'Time Submitted',
      render: (row) => (
        <span className="text-slate-500 dark:text-slate-400">
          {new Date(row.submitted_at).toLocaleString()}
        </span>
      ),
    },
    {
      accessor: 'records_count',
      header: 'Records',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {row.records_count}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: () => (
        <Badge variant="success">
          <CheckCircle2 className="w-3 h-3" />
          Recorded
        </Badge>
      ),
    },
  ];

  if (historyLoading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <DataTable
        columns={columns}
        data={history}
        searchable={false}
        emptyIcon={Clock}
        emptyTitle="No records yet"
        emptyDescription="No attendance records submitted yet."
      />
    </div>
  );
};

export default LeaderHistory;
