import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { financeAPI, adminAPI } from '../../services/api';
import {
  DollarSign, TrendingUp, Calendar, CheckCircle2, XCircle, Clock,
  Loader2, Search, Eye, ArrowUpCircle, Ban, Receipt, HandCoins,
  Sparkles, AlertCircle, Send, CheckCheck, BarChart3, RefreshCw, X,
  Shield, Download, FileText, TrendingDown, ArrowRight, PiggyBank,
  Banknote, Activity, Plus, Save, Trash2, ChevronRight, Upload,
  File, StickyNote, History, Edit3, Printer, Pencil
} from 'lucide-react';
import { fdate, fdatetime } from '../../utils/date';

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
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_COLORS[status] || ''}`}>
      <Icon className="w-3 h-3" />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const WORKFLOW_STEPS = [
  { key: 'income', label: 'Record Offerings', icon: DollarSign },
  { key: 'tithes', label: 'Record Member Tithes', icon: HandCoins },
  { key: 'expenses', label: 'Record Expenses', icon: Receipt },
  { key: 'review', label: 'Review Summary', icon: BarChart3 },
  { key: 'submit', label: 'Submit for Approval', icon: Send },
];

const WORKSPACE_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'income', label: 'Income', icon: DollarSign },
  { key: 'tithes', label: 'Member Tithes', icon: HandCoins },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'history', label: 'History', icon: History },
];

const MiniStat = ({ label, value, color = 'slate' }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[10px] font-medium text-slate-400">{label}</span>
    <span className={`text-xs font-bold text-${color}-600 dark:text-${color}-400`}>{value}</span>
  </div>
);

const FinanceWorkspace = ({ recordId, onBack, showMessage, userRole }) => {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [allMembers, setAllMembers] = useState([]);

  const [morning, setMorning] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [titheEntries, setTitheEntries] = useState([]);
  const [titheSearch, setTitheSearch] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState([]);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [lastSaved, setLastSaved] = useState(null);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, memRes] = await Promise.all([
        recordId ? financeAPI.getRecord(recordId) : Promise.resolve({ data: null }),
        adminAPI.getMembers({}).catch(() => ({ data: [] })),
      ]);
      setAllMembers(memRes.data || []);
      if (recRes.data) {
        const r = recRes.data;
        setRecord(r);
        setMorning(r.morning_offering ? String(r.morning_offering) : '');
        setAfternoon(r.afternoon_offering ? String(r.afternoon_offering) : '');
        setNotes(r.notes || '');
        setHistory(r.activity_log || []);
        if (r.tithe_entries?.length) {
          setTitheEntries(r.tithe_entries.map(t => ({ member_id: t.member_id, full_name: t.full_name || 'Unknown', amount: t.amount ? String(t.amount) : '' })));
        }
        if (r.expenses?.length) {
          setExpenses(r.expenses.map(e => ({ id: e.id, category: e.category || '', description: e.description || '', amount: e.amount ? String(e.amount) : '' })));
        }
      }
    } catch (e) {
      showMessage?.('Failed to load record');
    } finally {
      setLoading(false);
    }
  }, [recordId, showMessage]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  const totalTitheAmount = useMemo(() => titheEntries.reduce((s, t) => s + (Number(t.amount) || 0), 0), [titheEntries]);
  const hasTithes = useMemo(() => titheEntries.some(t => Number(t.amount) > 0), [titheEntries]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [expenses]);
  const calc = useMemo(() => calcFinance(morning, afternoon, totalTitheAmount), [morning, afternoon, totalTitheAmount]);
  const netBalance = calc.usable - totalExpenses;

  const isReadonly = record?.status === 'approved' || record?.status === 'submitted';
  const isEditable = !isReadonly || userRole === 'admin';

  const workflowStep = useMemo(() => {
    if (record?.status === 'submitted') return 5;
    if (record?.status === 'approved') return 5;
    if (calc.total > 0 && totalTitheAmount > 0 && totalExpenses > 0) return 4;
    if (calc.total > 0 && totalTitheAmount > 0) return 3;
    if (calc.total > 0) return 2;
    if (Number(morning) > 0 || Number(afternoon) > 0) return 1;
    return 0;
  }, [calc, morning, afternoon, totalTitheAmount, totalExpenses, record]);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        record_date: record?.record_date,
        morning_offering: Number(morning) || 0,
        afternoon_offering: Number(afternoon) || 0,
        tithes: totalTitheAmount,
        tithe_entries: titheEntries.filter(t => t.amount).map(t => ({ member_id: t.member_id, amount: Number(t.amount) || 0 })),
        expenses: expenses.filter(e => e.category && e.amount).map(e => ({
          id: e.id, category: e.category, description: e.description, amount: Number(e.amount) || 0,
        })),
        notes,
      };
      if (record?.id) {
        await financeAPI.updateRecord(record.id, payload);
      } else {
        const res = await financeAPI.createRecord(payload);
        setRecord(res.data?.record || res.data);
      }
      setLastSaved(new Date());
      showMessage?.('Draft saved');
    } catch (e) {
      showMessage?.(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!hasTithes) {
      showMessage?.('Please add at least one member tithe before submitting');
      return;
    }
    if (!record?.id) { await handleSaveDraft(); }
    if (!record?.id) return;
    setSaving(true);
    try {
      await financeAPI.submitRecord(record.id);
      showMessage?.('Submitted for approval');
      loadRecord();
    } catch (e) {
      showMessage?.(e.response?.data?.error || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await financeAPI.approveRecord(record.id);
      showMessage?.('Record approved');
      loadRecord();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to approve'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await financeAPI.rejectRecord(record.id, rejectReason);
      showMessage?.('Record rejected');
      setRejectOpen(false);
      setRejectReason('');
      loadRecord();
    } catch (e) { showMessage?.(e.response?.data?.error || 'Failed to reject'); }
  };

  const handleRecalculate = async () => {
    if (!record?.id) return;
    try {
      await financeAPI.recalculateRecord(record.id);
      showMessage?.('Tithes recalculated');
      loadRecord();
    } catch (e) { showMessage?.('Failed to recalculate'); }
  };

  const handleTabClick = (key) => {
    if (key === 'expenses' && !hasTithes) {
      showMessage?.('Please add at least one member tithe before recording expenses');
      return;
    }
    setActiveTab(key);
  };

  const addExpenseRow = () => setExpenses(prev => [...prev, { category: '', description: '', amount: '' }]);
  const updateExpense = (idx, field, value) => setExpenses(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  const removeExpense = (idx) => setExpenses(prev => prev.filter((_, i) => i !== idx));

  const addTitheMember = (member) => {
    if (titheEntries.some(t => Number(t.member_id) === Number(member.id))) return;
    setTitheEntries(prev => [...prev, { member_id: member.id, full_name: member.full_name, amount: '' }]);
    setTitheSearch('');
  };
  const updateTitheAmount = (idx, value) => setTitheEntries(prev => prev.map((t, i) => i === idx ? { ...t, amount: value } : t));
  const removeTitheEntry = (idx) => setTitheEntries(prev => prev.filter((_, i) => i !== idx));

  const filteredTitheMembers = allMembers
    .filter(m => !titheEntries.some(t => Number(t.member_id) === Number(m.id)) && (m.full_name || '').toLowerCase().includes(titheSearch.toLowerCase()))
    .slice(0, 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Workspace Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-5 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <div>
              <h2 className="text-lg font-bold">{record?.record_date ? fdate(record.record_date) : 'New Daily Record'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={record?.status || 'draft'} />
                {record?.submitted_by_name && <span className="text-white/70 text-[10px]">by {record.submitted_by_name}</span>}
                {lastSaved && <span className="text-white/50 text-[10px]">Saved {lastSaved.toLocaleTimeString()}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isReadonly && (
              <>
                <button onClick={handleSaveDraft} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </button>
                {workflowStep >= 4 && (
                  <button onClick={handleSubmitForApproval} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-indigo-600 hover:bg-white/90 transition-colors disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> Submit
                  </button>
                )}
              </>
            )}
            {isReadonly && record?.status === 'submitted' && userRole === 'admin' && (
              <>
                <button onClick={handleApprove} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => setRejectOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 transition-colors">
                  <Ban className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
            <button onClick={handleRecalculate} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors" title="Recalculate tithes">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Indicator */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, i) => {
            const done = i < workflowStep;
            const current = i === workflowStep;
            return (
              <React.Fragment key={step.key}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-indigo-500 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}>
                    {done ? <CheckCheck className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold hidden md:block ${done ? 'text-emerald-600' : current ? 'text-indigo-600' : 'text-slate-400'}`}>{step.label}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded ${done ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left Column - Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
            {WORKSPACE_TABS.map(t => {
              const locked = t.key === 'expenses' && !hasTithes;
              return (
                <button key={t.key} onClick={() => handleTabClick(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === t.key
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                      : locked
                        ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {locked && <Ban className="w-2.5 h-2.5 text-amber-400" />}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-5 min-h-[400px]">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Financial Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Morning Offering', value: fmt(calc.morning), icon: ArrowUpCircle, color: 'emerald' },
                    { label: 'Afternoon Offering', value: fmt(calc.afternoon), icon: ArrowUpCircle, color: 'sky' },
                    { label: 'Total Tithes', value: fmt(calc.tithes), icon: HandCoins, color: 'violet' },
                    { label: 'Total Income', value: fmt(calc.total), icon: DollarSign, color: 'indigo' },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">{card.label}</span>
                        <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Mission Fund (10%)', value: fmt(calc.mission), color: 'amber' },
                    { label: 'Bishop Fund (10%)', value: fmt(calc.bishop), color: 'rose' },
                    { label: 'Total Expenses', value: fmt(totalExpenses), color: 'rose' },
                    { label: 'Net Balance', value: fmt(netBalance), color: netBalance >= 0 ? 'emerald' : 'rose' },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">{card.label}</span>
                      <p className={`text-lg font-bold text-${card.color}-600 dark:text-${card.color}-400 mt-1`}>{card.value}</p>
                    </div>
                  ))}
                </div>
                {/* Workflow Progress */}
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/30 p-4">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-2">Workflow Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(workflowStep / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-indigo-600">{workflowStep}/5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Income Tab */}
            {activeTab === 'income' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Church Offerings</h3>
                {isEditable ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">Morning Offering</p>
                          <p className="text-[10px] text-slate-400">Sunday morning service</p>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">TZS</span>
                        <input type="number" step="0.01" value={morning} onChange={e => setMorning(e.target.value)}
                          className="w-full pl-12 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="0.00" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                          <ArrowUpCircle className="w-4 h-4 text-sky-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">Afternoon Offering</p>
                          <p className="text-[10px] text-slate-400">Sunday afternoon service</p>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">TZS</span>
                        <input type="number" step="0.01" value={afternoon} onChange={e => setAfternoon(e.target.value)}
                          className="w-full pl-12 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                          placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4"><p className="text-[10px] text-slate-400">Morning</p><p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(calc.morning)}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4"><p className="text-[10px] text-slate-400">Afternoon</p><p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(calc.afternoon)}</p></div>
                  </div>
                )}
              </div>
            )}

            {/* Member Tithes Tab */}
            {activeTab === 'tithes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Member Tithes</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Select members and enter their individual tithe amounts</p>
                  </div>
                  <div className="text-sm font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-xl">
                    Total: {fmt(totalTitheAmount)}
                  </div>
                </div>
                {isEditable && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={titheSearch} onChange={e => setTitheSearch(e.target.value)}
                      placeholder="Search member name to add..."
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
                    {titheSearch && filteredTitheMembers.length > 0 && (
                      <div className="absolute z-20 top-full mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                        {filteredTitheMembers.map(m => (
                          <button key={m.id} type="button" onClick={() => addTitheMember(m)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
                              {(m.full_name || '?').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">{m.full_name}</p>
                              <p className="text-[10px] text-slate-400">{m.section_name || 'No section'} · {m.membership_id || ''}</p>
                            </div>
                            <Plus className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {titheEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <HandCoins className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400">No tithes recorded yet</p>
                    <p className="text-[10px] text-slate-300 mt-1">Search and select members above to add tithes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {titheEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
                          {(entry.full_name || '?').charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate flex-1">{entry.full_name}</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">TZS</span>
                          <input type="number" step="0.01" value={entry.amount} onChange={e => updateTitheAmount(idx, e.target.value)}
                            placeholder="0.00" disabled={!isEditable}
                            className="w-36 pl-10 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right font-medium" />
                        </div>
                        {isEditable && (
                          <button onClick={() => removeTitheEntry(idx)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expenses Tab */}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                {!hasTithes && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tithes required first</p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">Add at least one member tithe before recording expenses</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expenses</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Record church expenses for this day</p>
                  </div>
                  {isEditable && (
                    <button onClick={addExpenseRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                      <Plus className="w-3 h-3" /> Add Expense
                    </button>
                  )}
                </div>
                {expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400">No expenses recorded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((exp, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
                        <input type="text" value={exp.category} onChange={e => updateExpense(idx, 'category', e.target.value)}
                          placeholder="Category" disabled={!isEditable}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium" />
                        <input type="text" value={exp.description} onChange={e => updateExpense(idx, 'description', e.target.value)}
                          placeholder="Description" disabled={!isEditable}
                          className="flex-[2] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">TZS</span>
                          <input type="number" step="0.01" value={exp.amount} onChange={e => updateExpense(idx, 'amount', e.target.value)}
                            placeholder="0.00" disabled={!isEditable}
                            className="w-32 pl-10 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-right font-medium" />
                        </div>
                        {isEditable && (
                          <button onClick={() => removeExpense(idx)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">Total Expenses</span>
                      <span className="text-sm font-bold text-rose-600">{fmt(totalExpenses)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notes</h3>
                {isEditable ? (
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Add any notes about this daily record..."
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none" />
                ) : (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{notes || 'No notes'}</p>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activity History</h3>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400">No activity recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-3 h-3 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-900 dark:text-white">{h.action || 'Activity'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{h.user || 'System'} · {h.timestamp ? fdatetime(h.timestamp) : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sticky Summary Panel */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="lg:sticky lg:top-4 space-y-4">
            {/* Live Financial Summary */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" /> Live Summary
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                <MiniStat label="Morning Offering" value={fmt(calc.morning)} color="emerald" />
                <MiniStat label="Afternoon Offering" value={fmt(calc.afternoon)} color="sky" />
                <MiniStat label="Member Tithes ({titheEntries.length})" value={fmt(calc.tithes)} color="violet" />
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Total Income</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(calc.total)}</span>
                  </div>
                </div>
                <MiniStat label="Mission Fund (10%)" value={fmt(calc.mission)} color="amber" />
                <MiniStat label="Bishop Fund (10%)" value={fmt(calc.bishop)} color="rose" />
                <MiniStat label="Total Expenses" value={fmt(totalExpenses)} color="rose" />
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Usable Funds</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(calc.usable)}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Net Balance</span>
                    <span className={`text-sm font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(netBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Status */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Workflow Status
              </h4>
              <div className="space-y-2">
                {WORKFLOW_STEPS.map((step, i) => {
                  const done = i < workflowStep;
                  const current = i === workflowStep;
                  return (
                    <div key={step.key} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                        done ? 'bg-emerald-500 text-white' : current ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}>
                        {done ? <CheckCheck className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-medium ${done ? 'text-emerald-600 line-through' : current ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Record Info */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Record Info
              </h4>
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-400">Status</span><StatusBadge status={record?.status || 'draft'} /></div>
                <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="font-medium text-slate-700 dark:text-slate-300">{fdate(record?.record_date)}</span></div>
                {record?.submitted_by_name && <div className="flex justify-between"><span className="text-slate-400">Submitted by</span><span className="font-medium text-slate-700 dark:text-slate-300">{record.submitted_by_name}</span></div>}
                {record?.submitted_at && <div className="flex justify-between"><span className="text-slate-400">Submitted at</span><span className="font-medium text-slate-700 dark:text-slate-300">{fdatetime(record.submitted_at)}</span></div>}
                {record?.approved_at && <div className="flex justify-between"><span className="text-slate-400">Approved at</span><span className="font-medium text-emerald-600">{fdatetime(record.approved_at)}</span></div>}
                {record?.created_at && <div className="flex justify-between"><span className="text-slate-400">Created</span><span className="font-medium text-slate-700 dark:text-slate-300">{fdatetime(record.created_at)}</span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRejectOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Reject Record</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs mb-3" rows={3}
              placeholder="Reason for rejection..." />
            <div className="flex gap-2">
              <button onClick={() => setRejectOpen(false)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceWorkspace;
