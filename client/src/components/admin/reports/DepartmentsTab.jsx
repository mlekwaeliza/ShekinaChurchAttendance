import React from 'react';
import { BarChart3 } from 'lucide-react';
import Badge from '../../ui/Badge';
import { IntelligenceTable, R } from './reportShared';

const DepartmentsTab = ({ departmentsData = [] }) => {
  const depts = departmentsData;
  return (
    <div className="space-y-6">
      {depts.length > 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Department Report
            </h3>
          </div>
          <IntelligenceTable
            columns={[
              {
                key: 'rank',
                label: '#',
                render: (_, __, i) => (
                  <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                )
              },
              {
                key: 'name',
                label: 'Department',
                render: (v) => (
                  <span className="font-medium text-slate-900 dark:text-white">{v}</span>
                )
              },
              { key: 'member_count', label: 'Members', align: 'right' },
              {
                key: 'present',
                label: 'Present',
                align: 'right',
                render: (v) => <span className="text-emerald-600">{v || 0}</span>
              },
              {
                key: 'absent',
                label: 'Absent',
                align: 'right',
                render: (v) => <span className="text-rose-500">{v || 0}</span>
              },
              {
                key: 'attendance_rate',
                label: 'Rate',
                align: 'right',
                render: (v) => (
                  <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>
                    {R(v)}%
                  </Badge>
                )
              },
              {
                key: 'rate_change',
                label: 'Diff',
                align: 'right',
                render: (v) => {
                  const d = Number(v) || 0;
                  return (
                    <span className={`font-bold ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {d >= 0 ? '+' : ''}
                      {R(d)}%
                    </span>
                  );
                }
              },
              {
                key: 'growth_rate',
                label: 'Growth',
                align: 'right',
                render: (v) => (
                  <span className={v >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {v >= 0 ? '+' : ''}
                    {R(v)}%
                  </span>
                )
              },
              {
                key: 'consistency_score',
                label: 'Consistency',
                align: 'right',
                render: (v) => (
                  <span
                    className={`font-bold ${v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : 'text-rose-600'}`}
                  >
                    {v || 0}
                  </span>
                )
              },
              {
                key: 'performance_score',
                label: 'Score',
                align: 'right',
                render: (v) => (
                  <Badge variant={v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'}>
                    {v || 0}
                  </Badge>
                )
              }
            ]}
            data={depts.map((d, i) => ({ ...d, rank: i + 1 }))}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 text-sm">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          Department data not available for current filter
        </div>
      )}
    </div>
  );
};

export default DepartmentsTab;
