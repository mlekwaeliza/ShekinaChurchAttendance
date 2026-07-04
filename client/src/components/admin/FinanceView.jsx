import React, { useState, useEffect, useCallback } from 'react';
import { financeAPI, contributionAPI, adminAPI } from '../../services/api';
import {
  DollarSign, Calendar, CheckCircle2, XCircle, Clock,
  Loader2, Search, Eye, Edit3, Send, PieChart, Plus,
  FileText, ArrowUpCircle, HandCoins, Download, AlertCircle,
  LayoutDashboard, Users, Building2
} from 'lucide-react';
import { fdate, fdatetime } from '../../utils/date';
import FinanceWorkspace from './FinanceWorkspace';

const fmt = (v) => `TZS ${Number(v || 0).toLocaleString()}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};
const STATUS_ICONS = { draft: Clock, submitted: Send, approved: CheckCircle2, rejected: XCircle };

const StatusBadge = ({ status }) => {
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[status] || ''}`}>
      <Icon className="w-3 h-3" />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const FinanceView = ({ showMessage, userRole = 'admin' }) => {
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [rptFrom, setRptFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [rptTo, setRptTo] = useState(today());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbData, setDbData] = useState({ contributions: [], finance: [], members: 0, memberContributions: [] });
  const [dbLoading, setDbLoading] = useState(true);
  const YEAR = new Date().getFullYear();

  const loadDashboard = useCallback(async () => {
    setDbLoading(true);
    try {
      const todayVal = today();
      const firstDay = new Date(); firstDay.setDate(1);
      const from = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
      const [conRes, finRes, memRes, memberConRes] = await Promise.all([
        contributionAPI.getSummary({ date_from: from, date_to: todayVal }),
        financeAPI.getRecords({ date_from: from, date_to: todayVal }),
        adminAPI.getMembers({}),
        contributionAPI.getContributions({ date_from: from, date_to: todayVal }),
      ]);
      setDbData({
        contributions: conRes.data?.rows || [],
        finance: finRes.data || [],
        members: memRes.data?.length || 0,
        memberContributions: memberConRes.data || [],
      });
    } catch (e) {
      console.error('Failed to load finance dashboard metrics:', e);
    } finally {
      setDbLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (searchDate) params.date = searchDate;
      const res = await financeAPI.getRecords(params);
      setRecords(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus, searchDate]);

  const loadReport = useCallback(async () => {
    try {
      const [sumRes, trendRes] = await Promise.all([
        financeAPI.getSummary(rptFrom, rptTo),
        financeAPI.getTrend(YEAR),
      ]);
      setSummary(sumRes.data || null);
      setTrend(trendRes.data || []);
    } catch (e) { console.error(e); }
  }, [rptFrom, rptTo]);

  useEffect(() => { if (activeTab === 'dashboard') loadDashboard(); }, [activeTab, loadDashboard]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { if (activeTab === 'reports') loadReport(); }, [activeTab, loadReport]);

  const openRecord = (id) => { setSelectedId(id); setView('workspace'); };
  const createNew = () => { setSelectedId(null); setView('workspace'); };
  const backToList = () => { setView('list'); setSelectedId(null); loadRecords(); };

  const todayRecord = records.find(r => r.record_date === today());
  const pendingRecords = records.filter(r => r.status === 'submitted');
  const monthRecords = records.filter(r => r.record_date?.startsWith(today().slice(0, 7)));
  const approvedMonth = monthRecords.filter(r => r.status === 'approved');

  const filteredRecords = records.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchDate && r.record_date !== searchDate) return false;
    return true;
  });

  const exportCSV = () => {
    const rows = [['Date', 'Status', 'Morning', 'Afternoon', 'Tithes', 'Income', 'Expenses', 'Usable']];
    filteredRecords.forEach(r => rows.push([
      r.record_date, r.status, r.morning_offering || 0, r.afternoon_offering || 0,
      r.auto_tithes ?? r.total_tithes ?? 0, r.total_income || 0, r.total_expenses || 0, r.usable_church_funds || 0,
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `finance-${today()}.csv`; a.click();
  };

  if (view === 'workspace') {
    return <FinanceWorkspace recordId={selectedId} onBack={backToList} showMessage={showMessage} userRole={userRole} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Finance Module</h2>
            <p className="text-white/80 text-sm">Daily records, tithes, expenses &amp; reports</p>
          </div>
          <button onClick={createNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg">
            <Plus className="w-4 h-4" /> New Daily Record
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { key: 'records', label: 'Daily Records', icon: FileText },
          { key: 'approvals', label: 'Pending Approvals', icon: AlertCircle, badge: pendingRecords.length },
          { key: 'reports', label: 'Reports', icon: PieChart },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === t.key ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {t.badge > 0 && <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      {activeTab === 'records' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'This Month', value: monthRecords.length, icon: Calendar, color: 'slate' },
            { label: 'Approved', value: approvedMonth.length, icon: CheckCircle2, color: 'emerald' },
            { label: 'Pending', value: pendingRecords.length, icon: Send, color: 'amber' },
            { label: 'Today', value: todayRecord ? 'Recorded' : 'None', icon: DollarSign, color: todayRecord ? 'emerald' : 'slate' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase text-slate-400">{card.label}</span>
                <card.icon className={`w-4 h-4 text-${card.color}-500`} />
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily Records Tab */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
            {(filterStatus || searchDate) && (
              <button onClick={() => { setFilterStatus(''); setSearchDate(''); }}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">Clear</button>
            )}
            <div className="flex-1" />
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Date', 'Status', 'Morning', 'Afternoon', 'Tithes', 'Income', 'Expenses', 'Usable', ''].map(h => (
                      <th key={h} className={`py-3 px-4 text-[10px] font-semibold uppercase text-slate-400 ${h === '' ? 'text-right' : h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto" /></td></tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr><td colSpan={9} className="py-16 text-center">
                      <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm text-slate-400">No records found</p>
                      <button onClick={createNew} className="mt-3 text-xs text-indigo-600 hover:underline font-medium">Create your first daily record</button>
                    </td></tr>
                  ) : filteredRecords.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                      onClick={() => openRecord(r.id)}>
                      <td className="py-3 px-4 text-left font-medium text-slate-900 dark:text-white">{fdate(r.record_date)}</td>
                      <td className="py-3 px-4 text-right"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-4 text-right text-emerald-600">{fmt(r.morning_offering)}</td>
                      <td className="py-3 px-4 text-right text-sky-600">{fmt(r.afternoon_offering)}</td>
                      <td className="py-3 px-4 text-right text-violet-600">{fmt(r.auto_tithes ?? r.total_tithes)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">{fmt(r.total_income)}</td>
                      <td className="py-3 px-4 text-right text-rose-500">{fmt(r.total_expenses || 0)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{fmt(r.usable_church_funds)}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={e => { e.stopPropagation(); openRecord(r.id); }}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500" title="Open">
                          {r.status === 'draft' ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          {pendingRecords.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-12 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No records pending approval</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRecords.map(r => (
                <div key={r.id} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openRecord(r.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                        <Send className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{fdate(r.record_date)}</p>
                        <p className="text-[10px] text-slate-400">by {r.submitted_by_name || 'Unknown'} · {r.submitted_at ? fdatetime(r.submitted_at) : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-bold text-emerald-600">{fmt(r.total_income)}</p>
                      <Eye className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
          {summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Days Recorded', value: summary.day_count, icon: Calendar },
                  { label: 'Morning Total', value: fmt(summary.total_morning), icon: ArrowUpCircle },
                  { label: 'Afternoon Total', value: fmt(summary.total_afternoon), icon: ArrowUpCircle },
                  { label: 'Tithes Total', value: fmt(summary.total_tithes), icon: HandCoins },
                ].map(card => (
                  <div key={card.label} className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">{card.label}</span>
                      <card.icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Income', value: fmt(summary.total_income), color: 'indigo' },
                  { label: 'Mission Fund (10%)', value: fmt(summary.total_mission), color: 'amber' },
                  { label: 'Bishop Fund (10%)', value: fmt(summary.total_bishop), color: 'rose' },
                  { label: 'Total Expenses', value: fmt(summary.total_expenses), color: 'rose' },
                ].map(card => (
                  <div key={card.label} className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{card.label}</span>
                    <p className={`text-lg font-bold text-${card.color}-600 dark:text-${card.color}-400 mt-1`}>{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Usable Church Funds</span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{fmt(summary.total_usable)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Net Balance</span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{fmt(summary.total_usable - summary.total_expenses)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
          )}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        dbLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Contributions', value: `TZS ${dbData.memberContributions.reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}`, icon: HandCoins, border: 'border-emerald-200/70', darkBorder: 'dark:border-emerald-700', textColor: 'text-emerald-600', darkText: 'dark:text-emerald-400', iconColor: 'text-emerald-500' },
                { label: 'Finance Entries', value: dbData.finance.length.toString(), icon: Building2, border: 'border-blue-200/70', darkBorder: 'dark:border-blue-700', textColor: 'text-blue-600', darkText: 'dark:text-blue-400', iconColor: 'text-blue-500' },
                { label: 'Contributors (This Month)', value: new Set(dbData.memberContributions.map(c => c.member_id)).size.toString(), icon: Users, border: 'border-violet-200/70', darkBorder: 'dark:border-violet-700', textColor: 'text-violet-600', darkText: 'dark:text-violet-400', iconColor: 'text-violet-500' },
                { label: 'Total Members', value: dbData.members.toLocaleString(), icon: Users, border: 'border-amber-200/70', darkBorder: 'dark:border-amber-700', textColor: 'text-amber-600', darkText: 'dark:text-amber-400', iconColor: 'text-amber-500' },
              ].map((card, i) => (
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
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Contributions by Type (This Month)</h3>
                {(() => {
                  const contributionsByType = {};
                  dbData.memberContributions.forEach(c => {
                    const type = c.contribution_type_name || 'Other';
                    contributionsByType[type] = (contributionsByType[type] || 0) + Number(c.amount);
                  });
                  const totalContributions = dbData.memberContributions.reduce((s, c) => s + Number(c.amount), 0);

                  return Object.keys(contributionsByType).length === 0 ? (
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
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Member Contributions</h3>
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
                      {dbData.memberContributions.slice(0, 10).map(c => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700">
                          <td className="py-2 px-2 text-slate-900 dark:text-white">{c.full_name || 'Unknown'}</td>
                          <td className="py-2 px-2"><span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{c.contribution_type_name}</span></td>
                          <td className="py-2 px-2 text-right font-semibold text-emerald-600">TZS {Number(c.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                      {dbData.memberContributions.length === 0 && (
                        <tr><td colSpan={3} className="text-center py-8 text-slate-400">No contributions yet this month</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default FinanceView;
