import React from 'react';
import { Activity, FileText, Target, TrendingDown, TrendingUp } from 'lucide-react';
import Badge from '../../ui/Badge';
import { fdate } from '../../../utils/date';
import { IntelligenceTable, MetricCard, R } from './reportShared';

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const HistoryTab = ({
  historicalData = {},
  historicalPeriod,
  onPeriodChange,
  yearOverYear = []
}) => {
  const hist = historicalData;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 rounded-xl text-caption-1 font-medium transition-all ${historicalPeriod === p ? 'bg-primary-600 text-white shadow-card' : 'bg-system-fill text-secondary-label hover:text-secondary-label'}`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Highest Attendance"
          value={hist.highest || 0}
          icon={TrendingUp}
          color="emerald"
          showDiff={false}
        />
        <MetricCard
          label="Lowest Attendance"
          value={hist.lowest || 0}
          icon={TrendingDown}
          color="rose"
          showDiff={false}
        />
        <MetricCard
          label="Average Attendance"
          value={hist.average || 0}
          icon={Activity}
          color="indigo"
          showDiff={false}
        />
        <MetricCard
          label="Total Records"
          value={hist.total_records || 0}
          icon={FileText}
          color="slate"
          showDiff={false}
        />
        <MetricCard
          label="Attendance Rate"
          value={hist.avg_rate || 0}
          suffix="%"
          icon={Target}
          color="sky"
          showDiff={false}
        />
      </div>

      {historicalData.daily?.length > 0 && (
        <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card">
          <div className="p-4 border-b border-separator/60 dark:border-white/[0.08]">
            <h3 className="text-footnote font-semibold text-label">
              Historical Attendance Records
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full text-footnote">
              <thead className="sticky top-0 bg-secondary-system-grouped-background">
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                  {['Date', 'Present', 'Absent', 'Excused', 'Total', 'Rate'].map((h) => (
                    <th
                      key={h}
                      className={`py-2 px-3 text-caption-2 font-semibold uppercase text-tertiary-label ${h === 'Date' ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historicalData.daily.slice(0, 60).map((t, i) => {
                  const rate =
                    t.total_members > 0 ? Math.round((t.present_count / t.total_members) * 100) : 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-separator/50 dark:border-white/[0.08] hover:bg-system-fill/30"
                    >
                      <td className="py-2 px-3 text-left font-medium text-label">
                        {fdate(t.date)}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600">{t.present_count}</td>
                      <td className="py-2 px-3 text-right text-rose-500">{t.absent_count}</td>
                      <td className="py-2 px-3 text-right text-amber-500">{t.excused_count}</td>
                      <td className="py-2 px-3 text-right font-medium">{t.total_members}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'}>
                          {rate}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {yearOverYear?.length > 0 && (
        <div className="rounded-2xl bg-secondary-system-grouped-background border border-black/[0.06] dark:border-white/[0.08] shadow-card">
          <div className="p-4 border-b border-separator/60 dark:border-white/[0.08]">
            <h3 className="text-footnote font-semibold text-label">Year-over-Year Comparison</h3>
          </div>
          <IntelligenceTable
            columns={[
              { key: 'month_name', label: 'Month' },
              {
                key: 'current_rate',
                label: 'Current',
                align: 'right',
                render: (v) => <span className="font-semibold">{R(v)}%</span>
              },
              {
                key: 'previous_rate',
                label: 'Previous',
                align: 'right',
                render: (v) => <span className="text-secondary-label">{R(v)}%</span>
              },
              {
                key: 'difference',
                label: 'Difference',
                align: 'right',
                render: (v) => (
                  <span
                    className={`font-semibold ${v >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {v >= 0 ? '+' : ''}
                    {R(v)}%
                  </span>
                )
              }
            ]}
            data={yearOverYear}
          />
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
