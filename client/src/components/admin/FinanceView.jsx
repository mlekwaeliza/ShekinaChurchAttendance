import React, { useState, useEffect, useCallback } from 'react';
import { financeAPI } from '../../services/api';
import {
  DollarSign, TrendingUp, Calendar, CheckCircle2, XCircle, Clock,
  Loader2, Plus, Search, Filter, ChevronDown, ChevronUp, Edit3, Trash2,
  Upload, FileText, Download, Eye, ArrowUpCircle, Ban, Receipt,
  Building2, Users, PiggyBank, ArrowRight, Banknote, HandCoins,
  Sparkles, Activity, AlertCircle, Send, CheckCheck
} from 'lucide-react';

const YEAR = new Date().getFullYear();
const EXPENSE_CATEGORIES = ['Food', 'Water', 'Fruits', 'Sugar', 'Media', 'Visitors', 'Transport', 'Other'];
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

function today() { return new Date().toISOString().split('T')[0]; }

const FinanceView = ({ showMessage, userRole = 'admin' }) => {
  const [tab, setTab] = useState('entry');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ record_date: today(), morning_offering: '', afternoon_offering: '', total_tithes: '', notes: '' });
  const [editing, setEditing] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ category: 'Food', amount: '', description: '' });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await financeAPI.getRecords(params);
      setRecords(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const calcFinance = (morning, afternoon, tithes) => {
    const m = Number(morning) || 0;
    const a = Number(afternoon) || 0;
    const t = Number(tithes) || 0;
    const total = m + a + t;
    const mission = Math.round(total * 0.1 * 100) / 100;
    const remaining = Math.round((total - mission) * 100) / 100;
    const bishop = Math.round(remaining * 0.1 * 100) / 100;
    const usable = Math.round((remaining - bishop) * 100) / 100;
    return { total, mission, remaining, bishop, usable };
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    try {
      const data = {
        record_date: form.record_date,
        morning_offering: Number(form.morning_offering) || 0,
        afternoon_offering: Number(form.afternoon_offering) || 0,
        total_tithes: Number(form.total_tithes) || 0,
        notes: form.notes,
      };
      if (editing) {
        await financeAPI.updateRecord(editing.id, data);
        showMessage('Record updated');
      } else {
        await financeAPI.createRecord(data);
        showMessage('Record created');
      }
      setFormOpen(false); setEditing(null);
      setForm({ record_date: today(), morning_offering: '', afternoon_offering: '', total_tithes: '', notes: '' });
      loadRecords();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save record';
      alert(msg);
    }
  };

  const handleEdit = (r) => {
    setEditing(r);
    setForm({ record_date: r.record_date, morning_offering: String(r.morning_offering), afternoon_offering: String(r.afternoon_offering), total_tithes: String(r.total_tithes), notes: r.notes || '' });
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await financeAPI.deleteRecord(id); showMessage('Record deleted'); loadRecords(); }
    catch (err) { alert('Failed to delete'); }
  };

  const handleSubmit = async (id) => {
    try { await financeAPI.submitRecord(id); showMessage('Submitted for approval'); loadRecords(); }
    catch (err) { alert('Failed to submit'); }
  };

  const handleApprove = async (id) => {
    try { await financeAPI.approveRecord(id); showMessage('Record approved'); loadRecords(); setSelectedRecord(null); }
    catch (err) { alert('Failed to approve'); }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) return;
    try { await financeAPI.rejectRecord(id, rejectReason); showMessage('Record rejected'); setRejectOpen(null); setRejectReason(''); loadRecords(); setSelectedRecord(null); }
    catch (err) { alert('Failed to reject'); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      await financeAPI.addExpense(selectedRecord.id, expenseForm);
      setExpenseOpen(false);
      setExpenseForm({ category: 'Food', amount: '', description: '' });
      const res = await financeAPI.getRecord(selectedRecord.id);
      setSelectedRecord(res.data);
      showMessage('Expense added');
    } catch (err) { alert('Failed to add expense'); }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await financeAPI.deleteExpense(expenseId);
      const res = await financeAPI.getRecord(selectedRecord.id);
      setSelectedRecord(res.data);
      showMessage('Expense deleted');
    } catch (err) { alert('Failed to delete expense'); }
  };

  const handleUploadReceipt = async (expenseId, file) => {
    try {
      await financeAPI.uploadReceipt(expenseId, file);
      const res = await financeAPI.getRecord(selectedRecord.id);
      setSelectedRecord(res.data);
      showMessage('Receipt uploaded');
    } catch (err) { alert('Failed to upload receipt'); }
  };

  const openRecord = async (id) => {
    try {
      const res = await financeAPI.getRecord(id);
      setSelectedRecord(res.data);
    } catch (err) { alert('Failed to load record'); }
  };

  const totalExpenses = selectedRecord?.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
  const netBalance = selectedRecord ? Number(selectedRecord.usable_church_funds) - totalExpenses : 0;

  const tabs = [
    { key: 'entry', label: '📝 Entry', icon: DollarSign },
    ...(userRole === 'admin' ? [
      { key: 'review', label: '✅ Review', icon: CheckCircle2 },
      { key: 'reports', label: '📊 Reports', icon: TrendingUp },
    ] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'entry' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daily Finance Entry</h2>
            <button onClick={() => { setEditing(null); setForm({ record_date: today(), morning_offering: '', afternoon_offering: '', total_tithes: '', notes: '' }); setFormOpen(true); }}
              className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Record</button>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input max-w-xs">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Entry Form Modal */}
          {formOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold">{editing ? 'Edit Record' : 'New Finance Record'}</h3>
                <form onSubmit={handleSaveRecord} className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                    <input type="date" value={form.record_date} onChange={e => setForm({...form, record_date: e.target.value})} className="input w-full" required /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Morning Offering</label>
                      <input type="number" step="0.01" value={form.morning_offering} onChange={e => setForm({...form, morning_offering: e.target.value})} className="input w-full" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Afternoon Offering</label>
                      <input type="number" step="0.01" value={form.afternoon_offering} onChange={e => setForm({...form, afternoon_offering: e.target.value})} className="input w-full" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Total Tithes</label>
                      <input type="number" step="0.01" value={form.total_tithes} onChange={e => setForm({...form, total_tithes: e.target.value})} className="input w-full" /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input w-full" rows={2} /></div>

                  {/* Live preview */}
                  {(() => {
                    const c = calcFinance(form.morning_offering, form.afternoon_offering, form.total_tithes);
                    return (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Total Income</span><span className="font-bold text-slate-900 dark:text-white">TZS {c.total.toLocaleString()}</span></div>
                        <div className="flex justify-between text-amber-600"><span>Mission Fund (10%)</span><span className="font-bold">- TZS {c.mission.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Remaining</span><span className="font-medium">{c.remaining.toLocaleString()}</span></div>
                        <div className="flex justify-between text-rose-500"><span>Bishop Fund (10%)</span><span className="font-bold">- TZS {c.bishop.toLocaleString()}</span></div>
                        <div className="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between text-emerald-600 font-bold">
                          <span>Usable Church Funds</span><span>TZS {c.usable.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'} Record</button>
                    <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Records List */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : records.length === 0 ? (
            <p className="text-center py-12 text-slate-400">No records found</p>
          ) : (
            <div className="space-y-3">
              {records.map(r => (
                <div key={r.id} className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{r.record_date}</h3>
                        <p className="text-xs text-slate-500">By {r.created_by_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                      <button onClick={() => openRecord(r.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600" title="View details"><Eye className="w-4 h-4" /></button>
                      {['draft', 'rejected'].includes(r.status) && (
                        <>
                          <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleSubmit(r.id)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Submit for approval"><Send className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-slate-500">Morning</span><p className="font-semibold">TZS {Number(r.morning_offering).toLocaleString()}</p></div>
                    <div><span className="text-slate-500">Afternoon</span><p className="font-semibold">TZS {Number(r.afternoon_offering).toLocaleString()}</p></div>
                    <div><span className="text-slate-500">Tithes</span><p className="font-semibold">TZS {Number(r.total_tithes).toLocaleString()}</p></div>
                    <div><span className="text-slate-500">Total</span><p className="font-bold text-emerald-600">TZS {Number(r.total_income).toLocaleString()}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Record Detail Modal */}
          {selectedRecord && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={() => setSelectedRecord(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Record: {selectedRecord.record_date}</h3>
                  <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p className="text-slate-500 text-xs mb-1">Income Breakdown</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span>Morning Offering</span><span className="font-semibold">TZS {Number(selectedRecord.morning_offering).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Afternoon Offering</span><span className="font-semibold">TZS {Number(selectedRecord.afternoon_offering).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Total Tithes</span><span className="font-semibold">TZS {Number(selectedRecord.total_tithes).toLocaleString()}</span></div>
                      <div className="border-t pt-1.5 flex justify-between font-bold text-emerald-600"><span>Total Income</span><span>TZS {Number(selectedRecord.total_income).toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p className="text-slate-500 text-xs mb-1">Auto Calculations</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span>Mission Fund (10%)</span><span className="font-semibold text-amber-600">TZS {Number(selectedRecord.mission_fund).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Remaining</span><span className="font-semibold">TZS {Number(selectedRecord.remaining_after_mission).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Bishop Fund (10%)</span><span className="font-semibold text-rose-500">TZS {Number(selectedRecord.bishop_fund).toLocaleString()}</span></div>
                      <div className="border-t pt-1.5 flex justify-between font-bold text-emerald-600">
                        <span>Usable Church Funds</span><span>TZS {Number(selectedRecord.usable_church_funds).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="text-sm"><span className="text-slate-500">Notes:</span><p className="mt-1">{selectedRecord.notes}</p></div>
                )}

                {/* Expenses */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Expenses</h4>
                    {selectedRecord.status === 'draft' && (
                      <button onClick={() => setExpenseOpen(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Expense</button>
                    )}
                  </div>
                  {(!selectedRecord.expenses || selectedRecord.expenses.length === 0) ? (
                    <p className="text-sm text-slate-400 py-3 text-center">No expenses recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRecord.expenses.map(ex => (
                        <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">{ex.category}</span>
                            <span className="text-slate-600">{ex.description || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-rose-600">TZS {Number(ex.amount).toLocaleString()}</span>
                            <label className="cursor-pointer p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-primary-600">
                              <Upload className="w-3.5 h-3.5" />
                              <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => { if (e.target.files[0]) handleUploadReceipt(ex.id, e.target.files[0]); }} />
                            </label>
                            {ex.receipt_path && (
                              <a href={ex.receipt_path} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg hover:bg-slate-200 text-emerald-500"><FileText className="w-3.5 h-3.5" /></a>
                            )}
                            {selectedRecord.status === 'draft' && (
                              <button onClick={() => handleDeleteExpense(ex.id)} className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Usable Church Funds</span><span className="font-semibold">TZS {Number(selectedRecord.usable_church_funds).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Total Expenses</span><span className="font-semibold text-rose-600">- TZS {totalExpenses.toLocaleString()}</span></div>
                  <div className="border-t pt-1.5 flex justify-between font-bold text-lg">
                    <span>Net Balance</span>
                    <span className={netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      TZS {netBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedRecord.status === 'submitted' && (
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(selectedRecord.id)} className="btn-primary flex items-center gap-2"><CheckCheck className="w-4 h-4" /> Approve</button>
                    <button onClick={() => setRejectOpen(selectedRecord.id)} className="btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-2"><Ban className="w-4 h-4" /> Reject</button>
                  </div>
                )}

                {rejectOpen === selectedRecord.id && (
                  <div className="space-y-3 p-4 rounded-xl bg-rose-50">
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="input w-full" placeholder="Reason for rejection..." rows={2} />
                    <div className="flex gap-2">
                      <button onClick={() => handleReject(selectedRecord.id)} className="btn-primary bg-rose-600 hover:bg-rose-700">Confirm Reject</button>
                      <button onClick={() => { setRejectOpen(null); setRejectReason(''); }} className="btn-secondary">Cancel</button>
                    </div>
                  </div>
                )}

                {selectedRecord.rejection_reason && (
                  <div className="p-4 rounded-xl bg-rose-50 text-sm">
                    <span className="font-semibold text-rose-700">Rejection Reason:</span>
                    <p className="mt-1 text-rose-600">{selectedRecord.rejection_reason}</p>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="text-xs text-slate-400 space-y-1">
                  {selectedRecord.created_by_name && <p>Created by: {selectedRecord.created_by_name}</p>}
                  {selectedRecord.submitted_by_name && <p>Submitted by: {selectedRecord.submitted_by_name} {selectedRecord.submitted_at ? `at ${new Date(selectedRecord.submitted_at).toLocaleString()}` : ''}</p>}
                  {selectedRecord.approved_by_name && <p>Approved/Rejected by: {selectedRecord.approved_by_name} {selectedRecord.approved_at ? `at ${new Date(selectedRecord.approved_at).toLocaleString()}` : ''}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Add Expense Modal */}
          {expenseOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setExpenseOpen(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold">Add Expense</h3>
                <form onSubmit={handleAddExpense} className="space-y-3">
                  <div><label className="block text-sm font-medium mb-1">Category</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="input w-full">
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium mb-1">Amount *</label>
                    <input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="input w-full" required /></div>
                  <div><label className="block text-sm font-medium mb-1">Description</label>
                    <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="input w-full" /></div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary">Add Expense</button>
                    <button type="button" onClick={() => setExpenseOpen(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'review' && (
        <ReviewView showMessage={showMessage} />
      )}

      {tab === 'reports' && (
        <ReportsView />
      )}
    </div>
  );
};

// ── Review View ──────────────────────────────────────────────────────
const ReviewView = ({ showMessage }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [selected, setSelected] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await financeAPI.getSubmissions(statusFilter || null); setSubmissions(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try { await financeAPI.approveRecord(id); showMessage('Record approved'); load(); setSelected(null); }
    catch (err) { alert('Failed to approve'); }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) return;
    try { await financeAPI.rejectRecord(id, rejectReason); showMessage('Record rejected'); setRejectOpen(false); setRejectReason(''); load(); setSelected(null); }
    catch (err) { alert('Failed to reject'); }
  };

  const openDetail = async (id) => {
    try { const res = await financeAPI.getRecord(id); setSelected(res.data); }
    catch (err) { alert('Failed to load'); }
  };

  const STATUS_OPTIONS = [
    { value: '', label: 'All', color: 'bg-slate-100 text-slate-600' },
    { value: 'submitted', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
    { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'rejected', label: 'Rejected', color: 'bg-rose-100 text-rose-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review Submissions</h2>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input max-w-xs">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : submissions.length === 0 ? (
        <p className="text-center py-12 text-slate-400">No submissions found</p>
      ) : (
        <div className="space-y-3">
          {submissions.map(r => (
            <div key={r.id} className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : r.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    {r.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : r.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{r.record_date}</h3>
                    <p className="text-xs text-slate-500">By {r.created_by_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_OPTIONS.find(o => o.value === r.status)?.color || ''}`}>
                    {STATUS_OPTIONS.find(o => o.value === r.status)?.label || r.status}
                  </span>
                  <button onClick={() => openDetail(r.id)} className="btn-primary text-xs py-1.5 px-3">Review</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-slate-500">Total Income</span><p className="font-semibold text-emerald-600">TZS {Number(r.total_income).toLocaleString()}</p></div>
                <div><span className="text-slate-500">Expenses</span><p className="font-semibold text-rose-600">TZS {Number(r.total_expenses || 0).toLocaleString()}</p></div>
                <div><span className="text-slate-500">Usable Funds</span><p className="font-semibold">TZS {Number(r.usable_church_funds).toLocaleString()}</p></div>
                <div><span className="text-slate-500">Expenses ({r.expense_count || 0})</span><p className="font-semibold">{r.expense_count || 0} items</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Record: {selected.record_date}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                <p className="text-slate-500 text-xs mb-1">Income</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span>Morning</span><span className="font-semibold">TZS {Number(selected.morning_offering).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Afternoon</span><span className="font-semibold">TZS {Number(selected.afternoon_offering).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Tithes</span><span className="font-semibold">TZS {Number(selected.total_tithes).toLocaleString()}</span></div>
                  <div className="border-t pt-1.5 flex justify-between font-bold text-emerald-600"><span>Total Income</span><span>TZS {Number(selected.total_income).toLocaleString()}</span></div>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                <p className="text-slate-500 text-xs mb-1">Deductions</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span>Mission (10%)</span><span className="font-semibold text-amber-600">TZS {Number(selected.mission_fund).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Bishop (10%)</span><span className="font-semibold text-rose-500">TZS {Number(selected.bishop_fund).toLocaleString()}</span></div>
                  <div className="border-t pt-1.5 flex justify-between font-bold"><span>Usable</span><span className="text-emerald-600">TZS {Number(selected.usable_church_funds).toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Expenses ({selected.expenses?.length || 0})</h4>
              {(!selected.expenses || selected.expenses.length === 0) ? (
                <p className="text-sm text-slate-400 py-2">No expenses</p>
              ) : (
                <div className="space-y-2">
                  {selected.expenses.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">{ex.category}</span>
                        <span className="text-slate-600">{ex.description || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-rose-600">TZS {Number(ex.amount).toLocaleString()}</span>
                        {ex.receipt_path && (
                          <a href={ex.receipt_path} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg hover:bg-slate-200 text-emerald-500"><FileText className="w-4 h-4" /></a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Usable Funds</span><span className="font-semibold">TZS {Number(selected.usable_church_funds).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Total Expenses</span><span className="font-semibold text-rose-600">- TZS {Number(selected.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0).toLocaleString()}</span></div>
              <div className="border-t pt-1.5 flex justify-between font-bold text-lg">
                <span>Net Balance</span>
                <span className={(Number(selected.usable_church_funds) - Number(selected.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  TZS {(Number(selected.usable_church_funds) - Number(selected.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            {selected.status === 'submitted' && (
              <div className="flex gap-3">
                <button onClick={() => handleApprove(selected.id)} className="btn-primary flex items-center gap-2"><CheckCheck className="w-4 h-4" /> Approve</button>
                <button onClick={() => setRejectOpen(true)} className="btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-2"><Ban className="w-4 h-4" /> Reject</button>
              </div>
            )}

            {selected.status === 'rejected' && selected.rejection_reason && (
              <div className="p-4 rounded-xl bg-rose-50 text-sm">
                <span className="font-semibold text-rose-700">Rejection Reason:</span>
                <p className="mt-1 text-rose-600">{selected.rejection_reason}</p>
              </div>
            )}

            {rejectOpen && (
              <div className="space-y-3 p-4 rounded-xl bg-rose-50">
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="input w-full" placeholder="Reason for rejection..." rows={2} />
                <div className="flex gap-2">
                  <button onClick={() => handleReject(selected.id)} className="btn-primary bg-rose-600 hover:bg-rose-700">Confirm Reject</button>
                  <button onClick={() => { setRejectOpen(false); setRejectReason(''); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-400 space-y-1">
              {selected.created_by_name && <p>Created by: {selected.created_by_name}</p>}
              {selected.submitted_by_name && <p>Submitted by: {selected.submitted_by_name} {selected.submitted_at ? `at ${new Date(selected.submitted_at).toLocaleString()}` : ''}</p>}
              {selected.approved_by_name && <p>Reviewed by: {selected.approved_by_name} {selected.approved_at ? `at ${new Date(selected.approved_at).toLocaleString()}` : ''}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Reports View ─────────────────────────────────────────────────────
const ReportsView = () => {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo] = useState(today);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [year, setYear] = useState(YEAR);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, trendRes] = await Promise.all([
        financeAPI.getSummary(dateFrom, dateTo),
        financeAPI.getTrend(year)
      ]);
      setSummary(sumRes.data);
      setTrend(trendRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, year]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const res = await financeAPI.getExport(dateFrom, dateTo);
      const data = res.data;
      const csv = [
        ['Date', 'Morning', 'Afternoon', 'Tithes', 'Total Income', 'Mission 10%', 'Bishop 10%', 'Usable Funds', 'Status'].join(','),
        ...data.map(r => [r.record_date, r.morning_offering, r.afternoon_offering, r.total_tithes, r.total_income, r.mission_fund, r.bishop_fund, r.usable_church_funds, r.status].join(','))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `finance-report-${dateFrom}-to-${dateTo}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to export'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Finance Reports</h2>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2"><Download className="w-4 h-4" /> Export CSV</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div><label className="block text-xs font-medium text-slate-500 mb-1">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" /></div>
        <div><label className="block text-xs font-medium text-slate-500 mb-1">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" /></div>
        <div><label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input">
            {[YEAR, YEAR - 1, YEAR - 2, YEAR - 3].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Days', value: summary.day_count, color: 'text-slate-600 bg-slate-100' },
                { label: 'Morning', value: summary.total_morning, color: 'text-blue-600 bg-blue-100' },
                { label: 'Afternoon', value: summary.total_afternoon, color: 'text-indigo-600 bg-indigo-100' },
                { label: 'Tithes', value: summary.total_tithes, color: 'text-violet-600 bg-violet-100' },
                { label: 'Total Income', value: summary.total_income, color: 'text-emerald-600 bg-emerald-100' },
                { label: 'Mission 10%', value: summary.total_mission, color: 'text-amber-600 bg-amber-100' },
                { label: 'Bishop 10%', value: summary.total_bishop, color: 'text-rose-600 bg-rose-100' },
                { label: 'Usable Funds', value: summary.total_usable, color: 'text-emerald-600 bg-emerald-100' },
                { label: 'Expenses', value: summary.total_expenses, color: 'text-rose-600 bg-rose-100' },
              ].map((card, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                  <p className={`text-lg font-bold mt-1 ${card.color.split(' ')[0]}`}>TZS {Number(card.value).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trend */}
          {trend.length > 0 && (
            <div className="rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" /> Monthly Trend ({year})
              </h3>
              <div className="space-y-2">
                {trend.map(t => (
                  <div key={t.month} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-8">{t.month}</span>
                    <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                        style={{ width: `${Math.min((t.total_income / Math.max(...trend.map(x => x.total_income))) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-24 text-right">TZS {Number(t.total_income).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FinanceView;
