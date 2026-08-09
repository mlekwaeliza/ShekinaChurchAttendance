import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import FinanceView from '../components/admin/FinanceView';
import AnalyticsView from '../components/admin/AnalyticsView';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { contributionAPI, financeAPI, adminAPI } from '../services/api';
import { HandCoins, Building2, Calendar, Users, PiggyBank, Wallet } from 'lucide-react';

// AccountantDashboard is defined after AccountantOverview to avoid TDZ in
// minified bundles (esbuild renames consts to single letters causing
// "Cannot access 'm' before initialization" errors).

const AccountantOverview = () => {
  const [data, setData] = useState({
    contributions: [],
    finance: [],
    members: 0,
    memberContributions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date();
        firstDay.setDate(1);
        const from = firstDay.toISOString().split('T')[0];
        const [conRes, finRes, memRes, memberConRes] = await Promise.all([
          contributionAPI.getSummary({ date_from: from, date_to: today }),
          financeAPI.getRecords({ date_from: from, date_to: today }),
          adminAPI.getMembers({}),
          contributionAPI.getContributions({ date_from: from, date_to: today })
        ]);
        setData({
          contributions: conRes.data?.rows || [],
          finance: finRes.data || [],
          members: memRes.data?.length || 0,
          memberContributions: memberConRes.data || []
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accountant Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingSkeleton key={i} type="card" />
          ))}
        </div>
      </div>
    );

  const financeContributions = data.memberContributions.filter((c) =>
    String(c.reference_number || '').startsWith('finance-')
  );
  const financeTithes = financeContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalContributions = data.memberContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalIncome = data.finance.reduce((s, record) => s + Number(record.total_income || 0), 0);
  const totalExpenses = data.finance.reduce(
    (s, record) => s + Number(record.total_expenses || 0),
    0
  );
  const usableFunds = data.finance.reduce(
    (s, record) => s + Number(record.usable_church_funds || 0),
    0
  );
  const uniqueContributors = new Set(data.memberContributions.map((c) => c.member_id)).size;

  const cards = [
    {
      label: 'Finance Tithes',
      value: `TZS ${financeTithes.toLocaleString()}`,
      icon: HandCoins,
      variant: 'default'
    },
    {
      label: 'All Contributions',
      value: `TZS ${totalContributions.toLocaleString()}`,
      icon: HandCoins,
      variant: 'success'
    },
    {
      label: 'Finance Income',
      value: `TZS ${totalIncome.toLocaleString()}`,
      icon: Building2,
      variant: 'info'
    },
    {
      label: 'Finance Expenses',
      value: `TZS ${totalExpenses.toLocaleString()}`,
      icon: Building2,
      variant: 'danger'
    },
    {
      label: 'Available Funds',
      value: `TZS ${(usableFunds - totalExpenses).toLocaleString()}`,
      icon: Wallet,
      variant: 'success'
    },
    {
      label: 'Finance Entries',
      value: data.finance.length.toString(),
      icon: PiggyBank,
      variant: 'info'
    },
    {
      label: 'Contributors (This Month)',
      value: uniqueContributors.toString(),
      icon: Users,
      variant: 'default'
    },
    {
      label: 'Total Members',
      value: data.members.toLocaleString(),
      icon: Calendar,
      variant: 'warning'
    }
  ];

  const contributionsByType = {};
  data.memberContributions.forEach((c) => {
    const type = c.contribution_type_name || 'Other';
    contributionsByType[type] = (contributionsByType[type] || 0) + Number(c.amount);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accountant Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {cards.map((card, i) => (
          <StatCard
            key={i}
            icon={card.icon}
            label={card.label}
            value={card.value}
            variant={card.variant}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            All Contributions by Type (This Month)
          </h3>
          {Object.keys(contributionsByType).length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No contributions this month"
              description="Contributions received this month will appear here."
            />
          ) : (
            <div className="space-y-3">
              {Object.entries(contributionsByType).map(([type, total]) => (
                <div
                  key={type}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {type}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    TZS {total.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-slate-200 dark:border-slate-600">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                <span className="text-sm font-bold text-emerald-600">
                  TZS {totalContributions.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            Recent Contributions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Member</th>
                  <th className="text-left py-2 px-2 font-semibold text-slate-600">Type</th>
                  <th className="text-right py-2 px-2 font-semibold text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.memberContributions.slice(0, 10).map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2 px-2 text-slate-900 dark:text-white">
                      {c.full_name || 'Unknown'}
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {c.contribution_type_name}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-emerald-600">
                      TZS {Number(c.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {data.memberContributions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      No contributions yet this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountantDashboard = () => {
  const { tab } = useParams();
  const { showToast } = useToast();
  const showMessage = useCallback(
    (msg) => {
      showToast({ type: 'success', message: msg });
    },
    [showToast]
  );

  if (!tab || tab === 'dashboard') {
    return <AccountantOverview />;
  }

  if (tab === 'analytics') {
    return <AnalyticsView />;
  }

  return (
    <div className="space-y-6">
      <FinanceView showMessage={showMessage} userRole="accountant" />
    </div>
  );
};

export default AccountantDashboard;
