import React, { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import FinanceView from '../components/admin/FinanceView';
import { contributionAPI, financeAPI, adminAPI } from '../services/api';
import { Loader2, HandCoins, Building2, Calendar, Users } from 'lucide-react';

const AccountantDashboard = () => {
  const { tab } = useParams();
  const { showToast } = useToast();
  const showMessage = useCallback((msg) => {
    showToast({ type: 'success', message: msg });
  }, [showToast]);

  if (!tab || tab === 'dashboard') {
    return <AccountantOverview showMessage={showMessage} />;
  }

  return (
    <div className="space-y-6">
      <FinanceView showMessage={showMessage} userRole="accountant" />
    </div>
  );
};

const AccountantOverview = ({ showMessage }) => {
  const [data, setData] = useState({ contributions: [], finance: [], members: 0, memberContributions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date(); firstDay.setDate(1);
        const from = firstDay.toISOString().split('T')[0];
        const [conRes, finRes, memRes, memberConRes] = await Promise.all([
          contributionAPI.getSummary({ date_from: from, date_to: today }),
          financeAPI.getRecords({ date_from: from, date_to: today }),
          adminAPI.getMembers({}),
          contributionAPI.getContributions({ date_from: from, date_to: today }),
        ]);
        setData({
          contributions: conRes.data?.rows || [],
          finance: finRes.data || [],
          members: memRes.data?.length || 0,
          memberContributions: memberConRes.data || [],
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const financeContributions = data.memberContributions.filter(c => String(c.reference_number || '').startsWith('finance-'));
  const totalContributions = financeContributions.reduce((s, c) => s + Number(c.amount), 0);
  const uniqueContributors = new Set(financeContributions.map(c => c.member_id)).size;

  const cards = [
    { label: 'Finance Tithes', value: `TZS ${totalContributions.toLocaleString()}`, icon: HandCoins, border: 'border-emerald-200/70', darkBorder: 'dark:border-emerald-700', textColor: 'text-emerald-600', darkText: 'dark:text-emerald-400', iconColor: 'text-emerald-500' },
    { label: 'Finance Entries', value: data.finance.length.toString(), icon: Building2, border: 'border-blue-200/70', darkBorder: 'dark:border-blue-700', textColor: 'text-blue-600', darkText: 'dark:text-blue-400', iconColor: 'text-blue-500' },
    { label: 'Contributors (This Month)', value: uniqueContributors.toString(), icon: Users, border: 'border-violet-200/70', darkBorder: 'dark:border-violet-700', textColor: 'text-violet-600', darkText: 'dark:text-violet-400', iconColor: 'text-violet-500' },
    { label: 'Total Members', value: data.members.toLocaleString(), icon: Calendar, border: 'border-amber-200/70', darkBorder: 'dark:border-amber-700', textColor: 'text-amber-600', darkText: 'dark:text-amber-400', iconColor: 'text-amber-500' },
  ];

  const contributionsByType = {};
  financeContributions.forEach(c => {
    const type = c.contribution_type_name || 'Other';
    contributionsByType[type] = (contributionsByType[type] || 0) + Number(c.amount);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accountant Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className={`rounded-2xl border ${card.border} bg-white dark:bg-slate-800 ${card.darkBorder} p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <p className={`text-2xl font-bold ${card.textColor} ${card.darkText}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Finance-recorded Contributions (This Month)</h3>
          {Object.keys(contributionsByType).length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No contributions this month</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(contributionsByType).map(([type, total]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{type}</span>
                  <span className="text-sm font-bold text-emerald-600">TZS {total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-slate-200 dark:border-slate-600">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                <span className="text-sm font-bold text-emerald-600">TZS {totalContributions.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Finance-recorded Contributions</h3>
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
                {financeContributions.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2 px-2 text-slate-900 dark:text-white">{c.full_name || 'Unknown'}</td>
                    <td className="py-2 px-2"><span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{c.contribution_type_name}</span></td>
                    <td className="py-2 px-2 text-right font-semibold text-emerald-600">TZS {Number(c.amount).toLocaleString()}</td>
                  </tr>
                ))}
                {financeContributions.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No contributions yet this month</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;
