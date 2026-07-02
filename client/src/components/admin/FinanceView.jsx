import React, { useState, useEffect, useCallback } from 'react';
import { financeAPI, contributionAPI, adminAPI } from '../../services/api';
import {
  DollarSign, TrendingUp, Calendar, CheckCircle2, XCircle, Clock,
  Loader2, Search, ChevronDown, Eye, ArrowUpCircle, Ban, Receipt,
  HandCoins, Sparkles, AlertCircle, Send, CheckCheck, BarChart3,
  PieChart, RefreshCw, X, Shield, Download, FileText, TrendingDown,
  ArrowRight, PiggyBank, Banknote, Activity, Plus, Save, Trash2
} from 'lucide-react';
import { fdate, fdatetime } from '../../utils/date';

const YEAR = new Date().getFullYear();
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
};
const STATUS_ICONS = { draft: Clock, submitted: Send, approved: CheckCircle2, rejected: XCircle };

const TABS = [
  { key: 'new', label: 'New Record', icon: Plus },
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'approvals', label: 'Pending Approvals', icon: AlertCircle },
  { key: 'records', label: 'All Records', icon: FileText },
  { key: 'reports', label: 'Reports', icon: PieChart },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
];

const fmt = (v) => `TZS ${Number(v || 0).toLocaleString()}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const calcFinance = (morning, afternoon, tithes) => {
  const m = Number(morning) || 0, a = Number(afternoon) || 0, t = Number(tithes) || 0;
  const total = m + a + t;
  const mission = Math.round(total * 0.1 * 100) / 100;
  const remaining = Math.round((total - mission) * 100) / 100;
  const bishop = Math.round(remaining * 0.1 * 100) / 100;
  const usable = Math.round((remaining - bishop) * 100) / 100;
  return { morning: m, afternoon: a, tithes: t, total, mission, remaining, bishop, usable };
};

const StatusBadge = ({ status }) => {
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[status] || ''}`}>
      <Icon className="w-3 h-3" />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const MetricCard = ({ label, value, icon: Icon, color = 'slate', trend, className = '' }) => (
  <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
      {Icon && <Icon className={`w-4 h-4 text-${color}-500`} />}
    </div>
    <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
        {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(trend)}% vs last month
      </div>
    )}
  </div>
);

const FinanceView = ({ showMessage, userRole = 'admin' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [rptFrom, setRptFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [rptTo, setRptTo] = useState(today());
  const [rejectOpen, setRejectOpen] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailOpen, setDetailOpen] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Record form state
  const [newRecord, setNewRecord] = useState({ date: today(), morning: '', afternoon: '', expenses: [] });
  const [savingNewRecord, setSavingNewRecord] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [titheEntries, setTitheEntries] = useState([]);
  const [titheSearch, setTitheSearch] = useState('');

  useEffect(() => {
    adminAPI.getMembers({}).then(res => setAllMembers(res.data || [])).catch(() => {});
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const res = await financeAPI.getRecords(filterStatus ? { status: filterStatus } : {});
      setRecords(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const loadReport = useCallback(async () => {
    try {
      const [sumRes, trendRes] = await Promise.all([
        financeAPI.getSummary(rptFrom, rptTo),
        financeAPI.getTrend(YEAR)
      ]);
      setSummary(sumRes.data || null);
      setTrend(trendRes.data || []);
    } catch (e) { console.error(e); }
  }, [rptFrom, rptTo]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { if (activeTab === 'reports' || activeTab === 'overview' || activeTab === 'trends') loadReport(); }, [activeTab, loadReport]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailOpen(id);
    try {
      const res = await financeAPI.getRecord(id);
      setDetailData(res.data);
    } catch (e) { showMessage?.('Failed to load record'); }
    finally { setDetailLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      await financeAPI.approveRecord(id);
      showMessage?.('Record approved');
      loadRecords();
      if (detailOpen === id) openDetail(id);
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to approve'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await financeAPI.rejectRecord(rejectOpen, rejectReason);
      showMessage?.('Record rejected');
      setRejectOpen(null);
      setRejectReason('');
      loadRecords();
      if (detailOpen === rejectOpen) openDetail(rejectOpen);
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to reject'); }
  };

  const handleRecalculate = async (id) => {
    try {
      const res = await financeAPI.recalculateRecord(id);
      showMessage?.(`Tithes recalculated: ${fmt(res.data.total_tithes)}`);
      loadRecords();
      if (detailOpen === id) openDetail(id);
    } catch (e) { showMessage?.('Failed to recalculate'); }
  };

  // New Record handlers
  const totalTitheAmount = titheEntries.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const newRecordCalc = calcFinance(newRecord.morning, newRecord.afternoon, totalTitheAmount);

  const handleAddExpense = () => setNewRecord(prev => ({ ...prev, expenses: [...prev.expenses, { category: '', description: '', amount: '' }] }));
  const handleUpdateExpense = (idx, field, value) => setNewRecord(prev => ({ ...prev, expenses: prev.expenses.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));
  const handleRemoveExpense = (idx) => setNewRecord(prev => ({ ...prev, expenses: prev.expenses.filter((_, i) => i !== idx) }));

  const handleAddTitheMember = (member) => {
    if (titheEntries.some(t => Number(t.member_id) === Number(member.id))) return;
    setTitheEntries(prev => [...prev, { member_id: member.id, full_name: member.full_name, amount: '' }]);
    setTitheSearch('');
  };
  const handleUpdateTitheAmount = (idx, value) => setTitheEntries(prev => prev.map((t, i) => i === idx ? { ...t, amount: value } : t));
  const handleRemoveTitheEntry = (idx) => setTitheEntries(prev => prev.filter((_, i) => i !== idx));

  const filteredTitheMembers = allMembers.filter(m =>
    !titheEntries.some(t => Number(t.member_id) === Number(m.id))
    && (m.full_name || '').toLowerCase().includes(titheSearch.toLowerCase())
  ).slice(0, 20);

  const handleResetNewRecord = () => {
    setNewRecord({ date: today(), morning: '', afternoon: '', expenses: [] });
    setTitheEntries([]);
  };

  const handleSubmitNewRecord = async (e) => {
    e.preventDefault();
    if (!newRecord.date) { showMessage?.('Please select a date'); return; }
    if (!newRecord.morning && !newRecord.afternoon && totalTitheAmount === 0) { showMessage?.('Enter at least one offering amount or add tithe entries'); return; }
    setSavingNewRecord(true);
    try {
      const payload = {
        record_date: newRecord.date,
        morning_offering: Number(newRecord.morning) || 0,
        afternoon_offering: Number(newRecord.afternoon) || 0,
        tithes: totalTitheAmount,
        tithe_entries: titheEntries.filter(t => t.amount).map(t => ({ member_id: t.member_id, amount: Number(t.amount) || 0 })),
        expenses: newRecord.expenses.filter(e => e.category && e.amount).map(e => ({ category: e.category, description: e.description, amount: Number(e.amount) || 0 })),
      };
      const res = await financeAPI.createRecord(payload);
      const recordId = res.data?.id || res.data?.record?.id;
      if (recordId) {
        await financeAPI.submitRecord(recordId);
        showMessage?.('Record submitted for approval');
      } else {
        showMessage?.('Record saved as draft');
      }
      handleResetNewRecord();
      loadRecords();
      setActiveTab('records');
    } catch (e) {
      showMessage?.(e.response?.data?.error || 'Failed to save record');
    } finally {
      setSavingNewRecord(false);
    }
  };

  const pendingRecords = records.filter(r => r.status === 'submitted');
  const todayRecord = records.find(r => r.record_date === today());
  const monthRecords = records.filter(r => r.record_date?.startsWith(today().slice(0, 7)));
  const approvedMonth = monthRecords.filter(r => r.status === 'approved');
  const rejectedCount = records.filter(r => r.status === 'rejected').length;

  const exportCSV = () => {
    if (!summary) return;
    const rows = [['Metric', 'Value'], ['Days', summary.day_count], ['Morning', summary.total_morning], ['Afternoon', summary.total_afternoon], ['Tithes', summary.total_tithes], ['Total Income', summary.total_income], ['Mission 10%', summary.total_mission], ['Bishop 10%', summary.total_bishop], ['Usable Funds', summary.total_usable], ['Expenses', summary.total_expenses]];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `finance-report-${rptFrom}-to-${rptTo}.csv`; a.click();
  };

  const filteredRecords = records.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchDate && r.record_date !== searchDate) return false;
    return true;
  });

  const c = detailData ? calcFinance(detailData.morning_offering, detailData.afternoon_offering, detailData.auto_tithes || detailData.total_tithes) : null;

  return (
    <div className="space-y-4">
      {/* Header with Tabs */}
      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" /> Finance Overview
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Admin reporting and oversight</p>
          </div>
          {pendingRecords.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{pendingRecords.length} pending</span>
            </div>
          )}
        </div>
        
        {/* Horizontal Tabs */}
        <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === t.key 
                  ? 'bg-slate-50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-b-0 border-slate-200/60 dark:border-slate-700' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.key === 'approvals' && pendingRecords.length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingRecords.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="This Month" value={monthRecords.length} icon={Calendar} color="slate" />
            <MetricCard label="Approved" value={approvedMonth.length} icon={CheckCircle2} color="emerald" />
            <MetricCard label="Pending Review" value={pendingRecords.length} icon={Send} color="amber" />
            <MetricCard label="Rejected" value={rejectedCount} icon={XCircle} color="rose" />
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Total Income" value={fmt(summary.total_income)} icon={DollarSign} color="indigo" />
              <MetricCard label="Mission Fund" value={fmt(summary.total_mission)} icon={Sparkles} color="amber" />
              <MetricCard label="Bishop Fund" value={fmt(summary.total_bishop)} icon={Shield} color="rose" />
              <MetricCard label="Net Balance" value={fmt(summary.total_usable - summary.total_expenses)} icon={PiggyBank} color="emerald" />
            </div>
          )}

          {/* Today's Record */}
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Today's Record</h3>
            {todayRecord ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusBadge status={todayRecord.status} />
                  <div className="text-xs text-slate-500">
                    Submitted by <span className="font-medium text-slate-700 dark:text-slate-300">{todayRecord.submitted_by_name || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total Income</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(todayRecord.total_income)}</p>
                  </div>
                  <button onClick={() => openDetail(todayRecord.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    <Eye className="w-3 h-3" /> View
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400">No record for today yet</div>
            )}
          </div>

          {/* Pending Approvals Quick View */}
          {pendingRecords.length > 0 && (
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pending Approvals</h3>
                <button onClick={() => setActiveTab('approvals')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {pendingRecords.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <div className="flex items-center gap-3">
                      <Send className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white">{fdate(r.record_date)}</p>
                        <p className="text-[10px] text-slate-400">by {r.submitted_by_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{fmt(r.total_income)}</p>
                      <button onClick={() => openDetail(r.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : pendingRecords.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-12 text-center">
              <CheckCheck className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No records pending approval</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRecords.map(r => {
                const tc = calcFinance(r.morning_offering, r.afternoon_offering, r.auto_tithes || r.total_tithes);
                return (
                  <div key={r.id} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                          <Send className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{fdate(r.record_date)}</p>
                          <p className="text-[10px] text-slate-400">Submitted by {r.submitted_by_name || 'Unknown'} · {r.submitted_at ? fdatetime(r.submitted_at) : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Income</p>
                          <p className="text-sm font-bold text-emerald-600">{fmt(r.total_income)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Expenses</p>
                          <p className="text-sm font-bold text-rose-500">{fmt(r.total_expenses || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Usable</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(tc.usable)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openDetail(r.id)}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleApprove(r.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                            <CheckCheck className="w-3 h-3 inline mr-1" />Approve
                          </button>
                          <button onClick={() => setRejectOpen(r.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">
                            <Ban className="w-3 h-3 inline mr-1" />Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All Records Tab */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
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
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Date', 'Status', 'Morning', 'Afternoon', 'Tithes', 'Income', 'Expenses', 'Usable', ''].map(h => (
                      <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === '' ? 'text-right' : h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto" /></td></tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr><td colSpan={9} className="py-12 text-center text-slate-400 text-sm">No records found</td></tr>
                  ) : filteredRecords.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 text-left font-medium text-slate-900 dark:text-white">{fdate(r.record_date)}</td>
                      <td className="py-2.5 px-3 text-right"><StatusBadge status={r.status} /></td>
                      <td className="py-2.5 px-3 text-right text-emerald-600">{fmt(r.morning_offering)}</td>
                      <td className="py-2.5 px-3 text-right text-sky-600">{fmt(r.afternoon_offering)}</td>
                      <td className="py-2.5 px-3 text-right text-violet-600">{fmt(r.auto_tithes ?? r.total_tithes)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{fmt(r.total_income)}</td>
                      <td className="py-2.5 px-3 text-right text-rose-500">{fmt(r.total_expenses || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{fmt(r.usable_church_funds)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(r.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {r.status === 'submitted' && (
                            <>
                              <button onClick={() => handleApprove(r.id)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500" title="Approve">
                                <CheckCheck className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setRejectOpen(r.id)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400" title="Reject">
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>

          {summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Days Recorded" value={summary.day_count} icon={Calendar} color="slate" />
                <MetricCard label="Morning Total" value={fmt(summary.total_morning)} icon={ArrowUpCircle} color="emerald" />
                <MetricCard label="Afternoon Total" value={fmt(summary.total_afternoon)} icon={ArrowUpCircle} color="sky" />
                <MetricCard label="Tithes Total" value={fmt(summary.total_tithes)} icon={HandCoins} color="violet" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Total Income" value={fmt(summary.total_income)} icon={DollarSign} color="indigo" />
                <MetricCard label="Mission Fund (10%)" value={fmt(summary.total_mission)} icon={Sparkles} color="amber" />
                <MetricCard label="Bishop Fund (10%)" value={fmt(summary.total_bishop)} icon={Shield} color="rose" />
                <MetricCard label="Total Expenses" value={fmt(summary.total_expenses)} icon={Receipt} color="rose" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MetricCard label="Usable Church Funds" value={fmt(summary.total_usable)} icon={PiggyBank} color="emerald" />
                <MetricCard label="Net Balance" value={fmt(summary.total_usable - summary.total_expenses)} icon={Banknote} color="emerald" />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {trend.length > 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Monthly Trend — {YEAR}</h3>
              <div className="space-y-3">
                {trend.map(t => {
                  const max = Math.max(...trend.map(x => Number(x.total_income) || 1));
                  return (
                    <div key={t.month} className="flex items-center gap-4">
                      <span className="text-xs font-medium text-slate-500 w-10">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.month - 1]}</span>
                      <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${(Number(t.total_income) / max) * 100}%` }} />
                      </div>
                      <div className="w-28 text-right">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{fmt(t.total_income)}</span>
                      </div>
                      <div className="w-20 text-right">
                        <span className="text-[10px] text-slate-400">{t.day_count || 0} days</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
          )}
        </div>
      )}

      {/* New Record Tab */}
      {activeTab === 'new' && (
        <div className="space-y-4">
          <form onSubmit={handleSubmitNewRecord} className="space-y-4">
            {/* Date Input */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Record Date *</label>
              <input
                type="date"
                value={newRecord.date}
                onChange={e => setNewRecord({ ...newRecord, date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            {/* Income Inputs */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Income</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Morning Offering (TZS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.morning}
                    onChange={e => setNewRecord({ ...newRecord, morning: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Afternoon Offering (TZS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.afternoon}
                    onChange={e => setNewRecord({ ...newRecord, afternoon: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Tithes - Member-based */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tithes</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select members and enter their tithe amounts</p>
                </div>
                <div className="text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-lg">
                  Total: {fmt(totalTitheAmount)}
                </div>
              </div>
              {/* Member Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={titheSearch}
                  onChange={e => setTitheSearch(e.target.value)}
                  placeholder="Search member name to add..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                {titheSearch && filteredTitheMembers.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
                    {filteredTitheMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => handleAddTitheMember(m)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-bold text-violet-600">
                          {(m.full_name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{m.full_name}</p>
                          <p className="text-[10px] text-slate-400">{m.section_name || 'No section'} · {m.membership_id || ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Tithe Entries */}
              {titheEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No members added yet. Search above to add.</p>
              ) : (
                <div className="space-y-2">
                  {titheEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
                      <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-bold text-violet-600 shrink-0">
                        {(entry.full_name || '?').charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate flex-1">{entry.full_name}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.amount}
                        onChange={e => handleUpdateTitheAmount(idx, e.target.value)}
                        placeholder="Amount"
                        className="w-32 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-right"
                      />
                      <button type="button" onClick={() => handleRemoveTitheEntry(idx)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400 shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-Calculated Breakdown */}
            {newRecordCalc.total > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Total Income" value={fmt(newRecordCalc.total)} icon={DollarSign} color="indigo" />
                  <MetricCard label="Mission Fund (10%)" value={fmt(newRecordCalc.mission)} icon={Sparkles} color="amber" />
                  <MetricCard label="Bishop Fund (10%)" value={fmt(newRecordCalc.bishop)} icon={Shield} color="rose" />
                  <MetricCard label="Remaining" value={fmt(newRecordCalc.remaining)} icon={Activity} color="sky" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MetricCard label="Usable Church Funds" value={fmt(newRecordCalc.usable)} icon={PiggyBank} color="emerald" />
                  <MetricCard label="Net Balance" value={fmt(newRecordCalc.usable - newRecord.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))} icon={Banknote} color="emerald" />
                </div>
              </div>
            )}

            {/* Expenses */}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Expenses</h3>
                <button type="button" onClick={handleAddExpense}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  <Plus className="w-3 h-3" /> Add Expense
                </button>
              </div>
              {newRecord.expenses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No expenses added yet</p>
              ) : (
                <div className="space-y-2">
                  {newRecord.expenses.map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        value={exp.category}
                        onChange={e => handleUpdateExpense(idx, 'category', e.target.value)}
                        placeholder="Category"
                        className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                      <input
                        type="text"
                        value={exp.description}
                        onChange={e => handleUpdateExpense(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-[2] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={exp.amount}
                        onChange={e => handleUpdateExpense(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="w-32 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                      <button type="button" onClick={() => handleRemoveExpense(idx)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">Total Expenses</span>
                    <span className="text-xs font-bold text-rose-600">{fmt(newRecord.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingNewRecord || !newRecord.date}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                {savingNewRecord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {savingNewRecord ? 'Saving...' : 'Submit for Approval'}
              </button>
              <button type="button" onClick={handleResetNewRecord}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Detail Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setDetailOpen(null); setDetailData(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Record Details</h3>
              <button onClick={() => { setDetailOpen(null); setDetailData(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {detailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : detailData && c ? (
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{fdate(detailData.record_date)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={detailData.status} />
                      {detailData.submitted_by_name && <span className="text-[10px] text-slate-400">by {detailData.submitted_by_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {detailData.status === 'submitted' && (
                      <>
                        <button onClick={() => handleApprove(detailData.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                          <CheckCheck className="w-3 h-3 inline mr-1" />Approve
                        </button>
                        <button onClick={() => setRejectOpen(detailData.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">
                          <Ban className="w-3 h-3 inline mr-1" />Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => handleRecalculate(detailData.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Recalculate tithes">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {detailData.status === 'rejected' && detailData.rejection_reason && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 p-3">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-0.5">Rejection Reason</p>
                    <p className="text-xs text-rose-600 dark:text-rose-300">{detailData.rejection_reason}</p>
                  </div>
                )}

                {/* Income Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Morning Offering" value={fmt(c.morning)} icon={ArrowUpCircle} color="emerald" />
                  <MetricCard label="Afternoon Offering" value={fmt(c.afternoon)} icon={ArrowUpCircle} color="sky" />
                  <MetricCard label="Tithes" value={fmt(c.tithes)} icon={HandCoins} color="violet" />
                  <MetricCard label="Total Income" value={fmt(c.total)} icon={DollarSign} color="indigo" />
                </div>

                {/* Fund Allocation */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Mission (10%)" value={fmt(c.mission)} icon={Sparkles} color="amber" />
                  <MetricCard label="Bishop (10%)" value={fmt(c.bishop)} icon={Shield} color="rose" />
                  <MetricCard label="Expenses" value={fmt(detailData.total_expenses || 0)} icon={Receipt} color="rose" />
                  <MetricCard label="Usable Funds" value={fmt(c.usable)} icon={PiggyBank} color="emerald" />
                </div>

                {/* Expenses */}
                {detailData.expenses?.length > 0 && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-700 p-3">
                    <h5 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Expenses</h5>
                    <div className="space-y-1.5">
                      {detailData.expenses.map(ex => (
                        <div key={ex.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-[10px] font-medium">{ex.category}</span>
                            <span className="text-slate-600 dark:text-slate-300">{ex.description || '—'}</span>
                          </div>
                          <span className="font-bold text-rose-600">{fmt(ex.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Log */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-700 p-3">
                  <h5 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Activity</h5>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-2 text-slate-500"><Clock className="w-3 h-3" /> Created {fdatetime(detailData.created_at)}</div>
                    {detailData.submitted_at && <div className="flex items-center gap-2 text-amber-600"><Send className="w-3 h-3" /> Submitted {fdatetime(detailData.submitted_at)}</div>}
                    {detailData.approved_at && <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Approved {fdatetime(detailData.approved_at)}</div>}
                    {detailData.status === 'rejected' && <div className="flex items-center gap-2 text-rose-600"><XCircle className="w-3 h-3" /> Rejected</div>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRejectOpen(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Reject Record</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs mb-3" rows={3} placeholder="Reason for rejection..." />
            <div className="flex gap-2">
              <button onClick={() => setRejectOpen(null)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceView;
