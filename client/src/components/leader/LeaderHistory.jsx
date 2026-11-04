import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { parseLocalDate } from '../../utils/date';

const LeaderHistory = ({ history, historyLoading, isHead }) => {
  const columns = [
    {
      accessor: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-label">
          {parseLocalDate(row.date).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </span>
      )
    },
    {
      accessor: 'service_name',
      header: 'Service',
      sortable: true,
      render: (row) => (
        <Badge variant={row.service_id === 1 ? 'info' : 'neutral'}>
          {row.service_name || 'Main Service'}
        </Badge>
      )
    },
    ...(isHead
      ? [
          {
            accessor: 'leader_name',
            header: 'Roster',
            sortable: true,
            render: (row) => (
              <div>
                <span className="font-semibold text-primary-700 dark:text-primary-300">
                  {row.leader_name}
                </span>
                {row.submitted_by_name && row.submitted_by_name !== row.leader_name && (
                  <p className="text-caption-2 font-medium text-secondary-label">
                    submitted by {row.submitted_by_name}
                  </p>
                )}
              </div>
            )
          }
        ]
      : []),
    {
      accessor: 'submitted_at',
      header: 'Time Submitted',
      render: (row) => (
        <span className="text-secondary-label">{new Date(row.submitted_at).toLocaleString()}</span>
      )
    },
    {
      accessor: 'records_count',
      header: 'Records',
      sortable: true,
      render: (row) => (
        <span className="font-semibold tabular-nums text-label">{row.records_count}</span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      render: () => (
        <Badge variant="success">
          <CheckCircle2 className="w-3 h-3" />
          Recorded
        </Badge>
      )
    }
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
