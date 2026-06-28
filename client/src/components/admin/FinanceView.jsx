import React, { useState, useEffect, useCallback } from 'react';
import { financeAPI, contributionAPI, adminAPI } from '../../services/api';
import {
  DollarSign, TrendingUp, Calendar, CheckCircle2, XCircle, Clock,
  Loader2, Plus, Search, Filter, ChevronDown, ChevronUp, Edit3, Trash2,
  Upload, FileText, Download, Eye, ArrowUpCircle, Ban, Receipt,
  Building2, Users, PiggyBank, ArrowRight, Banknote, HandCoins,
  Sparkles, Activity, AlertCircle, Send, CheckCheck, BarChart3,
  ClipboardList, History, PieChart, RefreshCw, X
} from 'lucide-react';
import { fdate, fdatetime } from '../../utils/date';

const YEAR = new Date().getFullYear();
const EXPENSE_CATEGORIES = ['Food', 'Water', 'Fruits', 'Sugar', 'Media', 'Visitors', 'Transport', 'Other'];
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
};
const STATUS_ICONS = { draft: Edit3, submitted: Send, approved: CheckCircle2, rejected: XCircle };
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'daily', label: 'Daily Records', icon: ClipboardList },
  { key: 'tithes', label: 'Member Tithes', icon: HandCoins },
  { key: 'reports', label: 'Reports', icon: PieChart },
  { key: 'history', label: 'History', icon: History },
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

const Card = ({ label, value, icon: Icon, color = 'slate', suffix = '', className = '' }) => (
  <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 ${className}`}>
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon className={`w-3.5 h-3.5 text-${color}-500`} />}
      <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
    </div>
    <p className="text-lg font-bold text-slate-900 dark:text-white">{value}{suffix}</p>
  </div>
);

const FinanceView = ({ showMessage, userRole = 'admin' }) => {
  const [section, setSection] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ record_date: today(), morning_offering: '', afternoon_offering: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Food', amount: '', description: '' });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [members, setMembers] = useState([]);
  const [types, setTypes] = useState([]);
  const [tithes, setTithes] = useState([]);
  const [titheForm, setTitheForm] = useState({ member_id: '', contribution_type_id: '', amount: '', payment_date: today(), payment_method: 'Cash', notes: '' });
  const [titheSaving, setTitheSaving] = useState(false);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [rptFrom, setRptFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [rptTo, setRptTo] = useState(today());
  const [rejectOpen, setRejectOpen] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      const res = await financeAPI.getRecords(filterStatus ? { status: filterStatus } : {});
      setRecords(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await adminAPI.getMembers();
      setMembers(res.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadTypes = useCallback(async () => {
    try {
      const res = await contributionAPI.getTypes();
      setTypes((res.data || []).filter(t => t.is_active));
    } catch (e) { console.error(e); }
  }, []);

  const loadTithes = useCallback(async (date) => {
    if (!date) { setTithes([]); return; }
    try {
      const res = await contributionAPI.getContributions({ date_from: date, date_to: date });
      setTithes((res.data || []).filter(c => {
        const type = types.find(t => t.id === c.contribution_type_id);
        return type?.name === 'Tithes';
      }));
    } catch (e) { console.error(e); setTithes([]); }
  }, [types]);

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
  useEffect(() => { loadMembers(); loadTypes(); }, [loadMembers, loadTypes]);
  useEffect(() => { if (section === 'tithes') loadTithes(selected?.record_date || today()); }, [section, selected, loadTithes]);
  useEffect(() => { if (section === 'reports') loadReport(); }, [section, loadReport]);

  const openRecord = async (id) => {
    try {
      const res = await financeAPI.getRecord(id);
      setSelected(res.data);
      setSection('daily');
    } catch (e) { showMessage?.('Failed to load record'); }
  };

  const handleSaveRecord = async () => {
    try {
      if (editing) {
        await financeAPI.updateRecord(editing.id, form);
        showMessage?.('Record updated');
      } else {
        await financeAPI.createRecord(form);
        showMessage?.('Record created');
      }
      setFormOpen(false);
      setEditing(null);
      setForm({ record_date: today(), morning_offering: '', afternoon_offering: '', notes: '' });
      loadRecords();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to save record'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await financeAPI.deleteRecord(id);
      showMessage?.('Record deleted');
      if (selected?.id === id) setSelected(null);
      loadRecords();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to delete'); }
  };

  const handleSubmit = async (id) => {
    try {
      await financeAPI.submitRecord(id);
      showMessage?.('Submitted for approval');
      loadRecords();
      if (selected?.id === id) openRecord(id);
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to submit'); }
  };

  const handleApprove = async (id) => {
    try {
      await financeAPI.approveRecord(id);
      showMessage?.('Record approved');
      loadRecords();
      if (selected?.id === id) openRecord(id);
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
      if (selected?.id === rejectOpen) openRecord(rejectOpen);
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to reject'); }
  };

  const handleRecalculate = async (id) => {
    try {
      const res = await financeAPI.recalculateRecord(id);
      showMessage?.(`Tithes recalculated: ${fmt(res.data.total_tithes)}`);
      loadRecords();
      if (selected?.id === id) openRecord(id);
    } catch (e) { showMessage?.('Failed to recalculate'); }
  };

  const handleAddExpense = async () => {
    if (!selected || !expenseForm.amount) return;
    try {
      await financeAPI.addExpense(selected.id, expenseForm);
      showMessage?.('Expense added');
      setExpenseForm({ category: 'Food', amount: '', description: '' });
      setExpenseOpen(false);
      openRecord(selected.id);
      loadRecords();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to add expense'); }
  };

  const handleDeleteExpense = async (expId) => {
    try {
      await financeAPI.deleteExpense(expId);
      showMessage?.('Expense removed');
      if (selected) openRecord(selected.id);
      loadRecords();
    } catch (e) { showMessage?.('Failed to delete expense'); }
  };

  const handleUploadReceipt = async (expId, file) => {
    try {
      await financeAPI.uploadReceipt(expId, file);
      showMessage?.('Receipt uploaded');
      if (selected) openRecord(selected.id);
    } catch (e) { showMessage?.('Failed to upload receipt'); }
  };

  const handleSaveTithe = async () => {
    if (!titheForm.member_id || !titheForm.amount) return;
    setTitheSaving(true);
    try {
      await contributionAPI.createContribution({ ...titheForm, amount: Number(titheForm.amount) });
      showMessage?.('Tithe recorded');
      setTitheForm({ member_id: '', contribution_type_id: titheForm.contribution_type_id, amount: '', payment_date: titheForm.payment_date, payment_method: 'Cash', notes: '' });
      loadTithes(selected?.record_date || today());
      loadRecords();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to record tithe'); }
    finally { setTitheSaving(false); }
  };

  const editRecord = (r) => {
    setEditing(r);
    setForm({ record_date: r.record_date, morning_offering: r.morning_offering, afternoon_offering: r.afternoon_offering, notes: r.notes || '' });
    setFormOpen(true);
  };

  const newRecord = () => {
    setEditing(null);
    setForm({ record_date: today(), morning_offering: '', afternoon_offering: '', notes: '' });
    setFormOpen(true);
  };

  const c = selected ? calcFinance(selected.morning_offering, selected.afternoon_offering, selected.auto_tithes || selected.total_tithes) : null;
  const pendingCount = records.filter(r => r.status === 'submitted').length;
  const todayRecord = records.find(r => r.record_date === today());

  const exportCSV = () => {
    if (!summary) return;
    const rows = [['Metric', 'Value'], ['Days', summary.day_count], ['Morning', summary.total_morning], ['Afternoon', summary.total_afternoon], ['Tithes', summary.total_tithes], ['Total Income', summary.total_income], ['Mission 10%', summary.total_mission], ['Bishop 10%', summary.total_bishop], ['Usable Funds', summary.total_usable], ['Expenses', summary.total_expenses]];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `finance-summary-${rptFrom}-to-${rptTo}.csv`; a.click();
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700">
      {/* Sidebar */}
      <div className="w-56 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200/60 dark:border-slate-700 p-3 flex flex-col">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-500" /> Finance
        </h2>
        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map(n => (
            <button key={n.key} onClick={() => setSection(n.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${section === n.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <n.icon className="w-3.5 h-3.5" />
              {n.label}
              {n.key === 'daily' && pendingCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <button onClick={newRecord}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Record
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Dashboard */}
        {section === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Finance Dashboard</h3>
                <p className="text-xs text-slate-400">{fdate(today())}</p>
              </div>
              {pendingCount > 0 && (
                <button onClick={() => { setFilterStatus('submitted'); setSection('history'); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors">
                  <AlertCircle className="w-3.5 h-3.5" /> {pendingCount} pending approval
                </button>
              )}
            </div>

            {todayRecord ? (
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/5 to-indigo-500/5 border border-emerald-200/40 dark:border-emerald-800/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Today's Record</h4>
                  <StatusBadge status={todayRecord.status} />
                </div>
                {(() => {
                  const tc = calcFinance(todayRecord.morning_offering, todayRecord.afternoon_offering, todayRecord.auto_tithes || todayRecord.total_tithes);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card label="Morning" value={fmt(tc.morning)} icon={ArrowUpCircle} color="emerald" />
                      <Card label="Afternoon" value={fmt(tc.afternoon)} icon={ArrowUpCircle} color="sky" />
                      <Card label="Tithes (Auto)" value={fmt(tc.tithes)} icon={HandCoins} color="violet" />
                      <Card label="Total Income" value={fmt(tc.total)} icon={DollarSign} color="indigo" />
                    </div>
                  );
                })()}
                <button onClick={() => openRecord(todayRecord.id)}
                  className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Open workspace →</button>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500 mb-3">No record for today yet</p>
                <button onClick={newRecord}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                  Create Today's Record
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="This Month Records" value={records.filter(r => r.record_date?.startsWith(today().slice(0,7))).length} icon={ClipboardList} color="slate" />
              <Card label="Approved" value={records.filter(r => r.status === 'approved' && r.record_date?.startsWith(today().slice(0,7))).length} icon={CheckCircle2} color="emerald" />
              <Card label="Pending Review" value={pendingCount} icon={Send} color="amber" />
              <Card label="Rejected" value={records.filter(r => r.status === 'rejected').length} icon={XCircle} color="rose" />
            </div>

            {records.filter(r => r.status === 'submitted').length > 0 && (
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Pending Approvals</h4>
                <div className="space-y-2">
                  {records.filter(r => r.status === 'submitted').slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors" onClick={() => openRecord(r.id)}>
                      <div className="flex items-center gap-3">
                        <Send className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-xs font-medium text-slate-900 dark:text-white">{fdate(r.record_date)}</p>
                          <p className="text-[10px] text-slate-400">Submitted by {r.submitted_by_name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{fmt(r.total_income)}</p>
                        <p className="text-[10px] text-slate-400">Total Income</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily Records */}
        {section === 'daily' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daily Records</h3>
                <p className="text-xs text-slate-400">Manage daily finance entries</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button onClick={newRecord}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Records List */}
              <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No records found</div>
                ) : records.map(r => (
                  <div key={r.id} onClick={() => openRecord(r.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${selected?.id === r.id ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-700' : 'border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{fdate(r.record_date)}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div><span className="text-slate-400">Income</span><p className="font-bold text-emerald-600">{fmt(r.total_income)}</p></div>
                      <div><span className="text-slate-400">Expenses</span><p className="font-bold text-rose-500">{fmt(r.total_expenses || 0)}</p></div>
                      <div><span className="text-slate-400">Usable</span><p className="font-bold text-slate-900 dark:text-white">{fmt(r.usable_church_funds)}</p></div>
                    </div>
                    {r.auto_tithes !== undefined && r.auto_tithes !== r.total_tithes && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
                        <RefreshCw className="w-3 h-3" /> Tithes mismatch — click to recalculate
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Workspace */}
              <div className="lg:col-span-2">
                {selected ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{fdate(selected.record_date)}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={selected.status} />
                          {selected.submitted_by_name && <span className="text-[10px] text-slate-400">by {selected.submitted_by_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {['draft', 'rejected'].includes(selected.status) && (
                          <>
                            <button onClick={() => editRecord(selected)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleSubmit(selected.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                              <Send className="w-3 h-3 inline mr-1" />Submit
                            </button>
                          </>
                        )}
                        {selected.status === 'submitted' && userRole === 'admin' && (
                          <>
                            <button onClick={() => handleApprove(selected.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                              <CheckCheck className="w-3 h-3 inline mr-1" />Approve
                            </button>
                            <button onClick={() => setRejectOpen(selected.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors">
                              <Ban className="w-3 h-3 inline mr-1" />Reject
                            </button>
                          </>
                        )}
                        <button onClick={() => handleRecalculate(selected.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Recalculate tithes">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {selected.status === 'rejected' && selected.rejection_reason && (
                      <div className="rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 p-3">
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-0.5">Rejection Reason</p>
                        <p className="text-xs text-rose-600 dark:text-rose-300">{selected.rejection_reason}</p>
                      </div>
                    )}

                    {/* Financial Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card label="Morning Offering" value={fmt(c.morning)} icon={ArrowUpCircle} color="emerald" />
                      <Card label="Afternoon Offering" value={fmt(c.afternoon)} icon={ArrowUpCircle} color="sky" />
                      <Card label="Tithes (Auto)" value={fmt(c.tithes)} icon={HandCoins} color="violet" />
                      <Card label="Total Income" value={fmt(c.total)} icon={DollarSign} color="indigo" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card label="Mission Fund (10%)" value={fmt(c.mission)} icon={Sparkles} color="amber" />
                      <Card label="Bishop Fund (10%)" value={fmt(c.bishop)} icon={Shield} color="rose" />
                      <Card label="Total Expenses" value={fmt(selected.total_expenses || 0)} icon={Receipt} color="rose" />
                      <Card label="Usable Church Funds" value={fmt(c.usable)} icon={PiggyBank} color="emerald" className="border-emerald-200 dark:border-emerald-800/30" />
                    </div>

                    {/* Notes */}
                    {selected.notes && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 p-3">
                        <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1">Notes</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{selected.notes}</p>
                      </div>
                    )}

                    {/* Expenses */}
                    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                      <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700">
                        <h5 className="text-xs font-semibold text-slate-900 dark:text-white">Expenses</h5>
                        {['draft', 'rejected'].includes(selected.status) && (
                          <button onClick={() => setExpenseOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            <Plus className="w-3 h-3" /> Add Expense
                          </button>
                        )}
                      </div>
                      {selected.expenses?.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                          {selected.expenses.map(ex => (
                            <div key={ex.id} className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{ex.category}</span>
                                <span className="text-xs text-slate-600 dark:text-slate-300">{ex.description || '—'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-rose-600">{fmt(ex.amount)}</span>
                                {ex.receipt_path ? (
                                  <a href={ex.receipt_path} target="_blank" rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-500" title="View receipt">
                                    <Receipt className="w-3 h-3" />
                                  </a>
                                ) : ['draft', 'rejected'].includes(selected.status) && (
                                  <label className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 cursor-pointer" title="Upload receipt">
                                    <Upload className="w-3 h-3" />
                                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUploadReceipt(ex.id, e.target.files[0])} />
                                  </label>
                                )}
                                {['draft', 'rejected'].includes(selected.status) && (
                                  <button onClick={() => handleDeleteExpense(ex.id)}
                                    className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400">No expenses recorded</div>
                      )}
                    </div>

                    {/* Net Balance */}
                    <div className="rounded-xl bg-gradient-to-r from-emerald-500/5 to-indigo-500/5 border border-emerald-200/40 dark:border-emerald-800/30 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-slate-400">Net Balance (Usable − Expenses)</p>
                          <p className="text-2xl font-bold text-emerald-600">{fmt(c.usable - (selected.total_expenses || 0))}</p>
                        </div>
                        <PiggyBank className="w-8 h-8 text-emerald-500/20" />
                      </div>
                    </div>

                    {/* Activity Log */}
                    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-3">
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Activity</h5>
                      <div className="space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2 text-slate-500"><Clock className="w-3 h-3" /> Created {fdatetime(selected.created_at)}</div>
                        {selected.submitted_at && <div className="flex items-center gap-2 text-amber-600"><Send className="w-3 h-3" /> Submitted {fdatetime(selected.submitted_at)}</div>}
                        {selected.approved_at && <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Approved {fdatetime(selected.approved_at)}</div>}
                        {selected.status === 'rejected' && selected.rejection_reason && <div className="flex items-center gap-2 text-rose-600"><XCircle className="w-3 h-3" /> Rejected</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <ClipboardList className="w-10 h-10 mb-3 text-slate-300" />
                    <p className="text-sm text-slate-500">Select a record to view details</p>
                    <p className="text-xs text-slate-400 mt-1">Or create a new daily record</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Member Tithes */}
        {section === 'tithes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Member Tithes</h3>
                <p className="text-xs text-slate-400">
                  {selected ? `Linked to ${fdate(selected.record_date)}` : 'Recording tithes for today'}
                </p>
              </div>
              {selected && (
                <button onClick={() => setSection('daily')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  ← Back to Record
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Tithe Entry Form */}
              <div className="lg:col-span-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-3">Record Tithe</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Member</label>
                    <select value={titheForm.member_id} onChange={e => setTitheForm(p => ({ ...p, member_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                      <option value="">Select member...</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Type</label>
                    <select value={titheForm.contribution_type_id} onChange={e => setTitheForm(p => ({ ...p, contribution_type_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                      <option value="">Select type...</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Amount (TZS)</label>
                    <input type="number" value={titheForm.amount} onChange={e => setTitheForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Date</label>
                    <input type="date" value={titheForm.payment_date} onChange={e => setTitheForm(p => ({ ...p, payment_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Method</label>
                    <select value={titheForm.payment_method} onChange={e => setTitheForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                      <option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Other</option>
                    </select>
                  </div>
                  <button onClick={handleSaveTithe} disabled={titheSaving || !titheForm.member_id || !titheForm.amount}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {titheSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Record Tithe'}
                  </button>
                </div>
              </div>

              {/* Tithes List */}
              <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                    Tithes for {fdate(selected?.record_date || today())}
                    <span className="ml-2 text-slate-400">({tithes.length} records, {fmt(tithes.reduce((s, t) => s + Number(t.amount), 0))})</span>
                  </h4>
                </div>
                {tithes.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                    {tithes.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-slate-900 dark:text-white">{t.member_name || `Member #${t.member_id}`}</p>
                          <p className="text-[10px] text-slate-400">{t.payment_method} · {fdate(t.payment_date)}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600">{fmt(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">No tithes recorded for this date</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports */}
        {section === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Financial Reports</h3>
                <p className="text-xs text-slate-400">Summary and trend analysis</p>
              </div>
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
            </div>

            {summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card label="Days" value={summary.day_count} icon={Calendar} color="slate" />
                  <Card label="Morning Total" value={fmt(summary.total_morning)} icon={ArrowUpCircle} color="emerald" />
                  <Card label="Afternoon Total" value={fmt(summary.total_afternoon)} icon={ArrowUpCircle} color="sky" />
                  <Card label="Tithes Total" value={fmt(summary.total_tithes)} icon={HandCoins} color="violet" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card label="Total Income" value={fmt(summary.total_income)} icon={DollarSign} color="indigo" />
                  <Card label="Mission Fund" value={fmt(summary.total_mission)} icon={Sparkles} color="amber" />
                  <Card label="Bishop Fund" value={fmt(summary.total_bishop)} icon={Shield} color="rose" />
                  <Card label="Total Expenses" value={fmt(summary.total_expenses)} icon={Receipt} color="rose" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card label="Usable Church Funds" value={fmt(summary.total_usable)} icon={PiggyBank} color="emerald" />
                  <Card label="Net (Usable − Expenses)" value={fmt(summary.total_usable - summary.total_expenses)} icon={Banknote} color="emerald" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            )}

            {trend.length > 0 && (
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Monthly Trend — {YEAR}</h4>
                <div className="space-y-2">
                  {trend.map(t => {
                    const max = Math.max(...trend.map(x => Number(x.total_income) || 1));
                    return (
                      <div key={t.month} className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-slate-500 w-8">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.month - 1]}</span>
                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${(Number(t.total_income) / max) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-20 text-right">{fmt(t.total_income)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {section === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Finance History</h3>
                <p className="text-xs text-slate-400">{records.length} total records</p>
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {['Date', 'Status', 'Morning', 'Afternoon', 'Tithes', 'Income', 'Expenses', 'Usable', 'Actions'].map(h => (
                        <th key={h} className={`py-2.5 px-3 text-[10px] font-semibold uppercase text-slate-400 ${h === 'Actions' ? 'text-right' : h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto" /></td></tr>
                    ) : records.length === 0 ? (
                      <tr><td colSpan={9} className="py-12 text-center text-slate-400 text-sm">No records found</td></tr>
                    ) : records.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => openRecord(r.id)}>
                        <td className="py-2.5 px-3 text-left font-medium text-slate-900 dark:text-white">{fdate(r.record_date)}</td>
                        <td className="py-2.5 px-3 text-right"><StatusBadge status={r.status} /></td>
                        <td className="py-2.5 px-3 text-right text-emerald-600">{fmt(r.morning_offering)}</td>
                        <td className="py-2.5 px-3 text-right text-sky-600">{fmt(r.afternoon_offering)}</td>
                        <td className="py-2.5 px-3 text-right text-violet-600">{fmt(r.auto_tithes ?? r.total_tithes)}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{fmt(r.total_income)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-500">{fmt(r.total_expenses || 0)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{fmt(r.usable_church_funds)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {['draft', 'rejected'].includes(r.status) && (
                              <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400" title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </button>
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
      </div>

      {/* New/Edit Record Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{editing ? 'Edit Record' : 'New Daily Record'}</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Service Date</label>
                <input type="date" value={form.record_date} onChange={e => setForm(p => ({ ...p, record_date: e.target.value }))}
                  disabled={!!editing}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-50" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Morning Offering (TZS)</label>
                <input type="number" value={form.morning_offering} onChange={e => setForm(p => ({ ...p, morning_offering: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Afternoon Offering (TZS)</label>
                <input type="number" value={form.afternoon_offering} onChange={e => setForm(p => ({ ...p, afternoon_offering: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" rows={2} placeholder="Any notes..." />
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 text-[10px] text-slate-500">
                <p>Tithes will be <strong>automatically calculated</strong> from Member Tithes recorded for this date.</p>
              </div>
              <button onClick={handleSaveRecord}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                {editing ? 'Update Record' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {expenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setExpenseOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Expense</h3>
              <button onClick={() => setExpenseOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Category</label>
                <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Amount (TZS)</label>
                <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 mb-1 block">Description</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" placeholder="What was this expense for?" />
              </div>
              <button onClick={handleAddExpense} disabled={!expenseForm.amount}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40">
                Add Expense
              </button>
            </div>
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
