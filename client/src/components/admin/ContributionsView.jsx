import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit3, Trash2, Filter, X, DollarSign, ChevronDown, ChevronUp, FileText, PieChart, List, Calendar, Download, RotateCw, TrendingUp, Receipt } from 'lucide-react';
import { contributionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fdate } from '../../utils/date';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];
const CURRENCY = 'TZS';
const fmt = (n) => (n || 0).toLocaleString('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ContributionsView({ showMessage, allMembers = [] }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'pastor';

  const [members, setMembers] = useState(allMembers);
  const [contributions, setContributions] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');

  const [filters, setFilters] = useState({ date_from: '', date_to: '', contribution_type_id: '', payment_method: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ member_id: '', contribution_type_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Cash', reference_number: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryDateRange, setSummaryDateRange] = useState({ from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] });

  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // Search & custom dropdown states for contribution form
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Guarantee types load on mount
  useEffect(() => {
    async function fetchTypes() {
      try {
        const { data } = await contributionAPI.getTypes();
        setTypes(data || []);
      } catch (err) {
        console.error('Failed to load types on mount:', err);
      }
    }
    fetchTypes();
  }, []);

  useEffect(() => {
    setMembers(allMembers);
    loadInitial();
  }, [allMembers.length]);

  useEffect(() => {
    if (contributions.length === 0 && !loading) loadContributions();
  }, [types.length]);

  async function loadInitial() {
    setLoading(true);
    try {
      setMembers(allMembers);
      const { data: typesData } = await contributionAPI.getTypes();
      setTypes(typesData);
      const defaultFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const defaultTo = new Date().toISOString().split('T')[0];
      const { data: contribs } = await contributionAPI.getContributions({ date_from: defaultFrom, date_to: defaultTo });
      setContributions(contribs);
      setFilters(f => ({ ...f, date_from: defaultFrom, date_to: defaultTo }));
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
    setLoading(false);
  }

  async function loadContributions(f = filters) {
    setLoading(true);
    try {
      const params = {};
      if (f.date_from) params.date_from = f.date_from;
      if (f.date_to) params.date_to = f.date_to;
      if (f.contribution_type_id) params.contribution_type_id = f.contribution_type_id;
      if (f.payment_method) params.payment_method = f.payment_method;
      const { data } = await contributionAPI.getContributions(params);
      setContributions(data);
    } catch (err) {
      console.error('Failed to load contributions:', err);
    }
    setLoading(false);
  }

  async function loadSummary() {
    if (!summaryDateRange.from || !summaryDateRange.to) return;
    try {
      const params = { date_from: summaryDateRange.from, date_to: summaryDateRange.to };
      if (filters.contribution_type_id) params.contribution_type_id = filters.contribution_type_id;
      const { data } = await contributionAPI.getSummary(params);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.member_id || !form.contribution_type_id || !form.amount || amt <= 0) return;
    if (amt < 500) { showMessage?.('Minimum contribution amount is TZS 500'); return; }
    if (amt > 10_000_000) { showMessage?.('Amount exceeds maximum allowed (TZS 10,000,000). Please verify before saving.'); return; }
    setSaving(true);
    try {
      const payload = {
        member_id: Number(form.member_id),
        contribution_type_id: Number(form.contribution_type_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        notes: form.notes || null,
      };
      if (editing) {
        await contributionAPI.updateContribution(editing.id, payload);
      } else {
        await contributionAPI.createContribution(payload);
      }
      setIsModalOpen(false);
      setEditing(null);
      resetForm();
      await loadContributions();
    } catch (err) {
      showMessage?.(err.message || 'Failed to save');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this contribution record?')) return;
    try {
      await contributionAPI.deleteContribution(id);
      await loadContributions();
    } catch (err) {
      showMessage?.(err.message || 'Failed to delete');
    }
  }

  function resetForm() {
    setForm({ member_id: '', contribution_type_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Cash', reference_number: '', notes: '' });
  }

  function openAdd() {
    setEditing(null);
    resetForm();
    setMemberSearch('');
    setIsMemberDropdownOpen(false);
    setIsTypeDropdownOpen(false);
    setIsModalOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      member_id: c.member_id,
      contribution_type_id: c.contribution_type_id,
      amount: c.amount,
      payment_date: c.payment_date,
      payment_method: c.payment_method,
      reference_number: c.reference_number || '',
      notes: c.notes || '',
    });
    const selectedMember = members.find(m => m.id === c.member_id);
    setMemberSearch(selectedMember ? selectedMember.full_name : '');
    setIsMemberDropdownOpen(false);
    setIsTypeDropdownOpen(false);
    setIsModalOpen(true);
  }

  const filteredContributions = useMemo(() => {
    if (!filters.search) return contributions;
    const q = filters.search.toLowerCase();
    return contributions.filter(c =>
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.contribution_type_name && c.contribution_type_name.toLowerCase().includes(q)) ||
      (c.reference_number && c.reference_number.toLowerCase().includes(q))
    );
  }, [contributions, filters.search]);

  const totalAmount = useMemo(() => filteredContributions.reduce((s, c) => s + Number(c.amount || 0), 0), [filteredContributions]);
  const totalByType = useMemo(() => {
    const map = {};
    filteredContributions.forEach(c => {
      const key = c.contribution_type_name || 'Unknown';
      map[key] = (map[key] || 0) + Number(c.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredContributions]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
            <Receipt className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contributions</h1>
            <p className="text-sm text-gray-400 mt-0.5">Record and manage member contributions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadInitial} className="btn-ghost p-2 text-gray-400 hover:text-white" title="Refresh"><RotateCw size={16} /></button>
          <div className="flex bg-gray-800/80 rounded-xl p-0.5 border border-gray-700/50">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-gray-400 hover:text-white'}`}><List size={15} /> List</button>
            <button onClick={() => { setViewMode('summary'); loadSummary(); }} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${viewMode === 'summary' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-gray-400 hover:text-white'}`}><PieChart size={15} /> Summary</button>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setTypeModalOpen(true)} className="btn-secondary text-sm"><FileText size={15} /> Types</button>
              <button onClick={openAdd} className="btn-primary text-sm"><Plus size={15} /> Record</button>
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 rounded-xl p-5 border border-emerald-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider">Total Contributions</p>
              <p className="text-2xl font-bold text-white mt-1">{CURRENCY} {fmt(totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{filteredContributions.length} records</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20"><DollarSign className="w-6 h-6 text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 rounded-xl p-5 border border-blue-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-400/80 uppercase tracking-wider">Contribution Types</p>
              <p className="text-2xl font-bold text-white mt-1">{types.length}</p>
              <p className="text-xs text-gray-500 mt-1">{totalByType.length} active this period</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/20"><TrendingUp className="w-6 h-6 text-blue-400" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 rounded-xl p-5 border border-purple-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider">Avg Per Record</p>
              <p className="text-2xl font-bold text-white mt-1">{CURRENCY} {fmt(filteredContributions.length ? totalAmount / filteredContributions.length : 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Across all types</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/20"><Receipt className="w-6 h-6 text-purple-400" /></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, type, or ref..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
              <Calendar size={14} />
              <span>{filters.date_from || 'Start'} - {filters.date_to || 'End'}</span>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-ghost px-3 py-2 text-sm rounded-xl flex items-center gap-1.5 transition-all ${showFilters ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white'}`}>
              <Filter size={15} /> Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={() => loadContributions()} className="btn-primary px-4 py-2 text-sm rounded-xl">Search</button>
          </div>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-700/50">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">From Date</label>
              <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">To Date</label>
              <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Type</label>
              <select value={filters.contribution_type_id} onChange={e => setFilters(f => ({ ...f, contribution_type_id: e.target.value }))} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                <option value="">All Types</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Method</label>
              <select value={filters.payment_method} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-full flex justify-end gap-2">
              <button onClick={() => { setFilters(f => ({ ...f, date_from: '', date_to: '', contribution_type_id: '', payment_method: '' })); }} className="btn-ghost text-xs px-3 py-1.5 text-gray-400 hover:text-white">Clear</button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'summary' ? (
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><PieChart size={18} className="text-emerald-400" /> Contribution Summary</h3>
            <div className="flex items-center gap-3">
              <input type="date" value={summaryDateRange.from} onChange={e => setSummaryDateRange(d => ({ ...d, from: e.target.value }))} className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm" />
              <span className="text-gray-500">-</span>
              <input type="date" value={summaryDateRange.to} onChange={e => setSummaryDateRange(d => ({ ...d, to: e.target.value }))} className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm" />
              <button onClick={loadSummary} className="btn-primary px-4 py-1.5 text-sm rounded-lg"><Download size={14} /> Generate</button>
            </div>
          </div>
          {summary ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/60 text-gray-400 text-left">
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium text-right">Count</th>
                      <th className="pb-3 font-medium text-right">Total ({CURRENCY})</th>
                      <th className="pb-3 font-medium text-right">Min</th>
                      <th className="pb-3 font-medium text-right">Max</th>
                      <th className="pb-3 font-medium text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows?.map((row, i) => (
                      <tr key={row.type_id} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                        <td className="py-3 font-medium text-white">{row.type_name}</td>
                        <td className="py-3 text-right text-gray-300">{row.count}</td>
                        <td className="py-3 text-right text-emerald-400 font-semibold">{CURRENCY} {fmt(row.total)}</td>
                        <td className="py-3 text-right text-gray-400">{CURRENCY} {fmt(row.min_amount)}</td>
                        <td className="py-3 text-right text-gray-400">{CURRENCY} {fmt(row.max_amount)}</td>
                        <td className="py-3 text-right text-gray-400">{CURRENCY} {fmt(row.total / row.count)}</td>
                      </tr>
                    ))}
                    {summary.rows?.length > 0 && (
                      <tr className="border-t-2 border-emerald-500/30 bg-emerald-900/10">
                        <td className="py-3 font-semibold text-white">Grand Total</td>
                        <td className="py-3 text-right font-semibold text-white">{summary.grandCount}</td>
                        <td className="py-3 text-right font-bold text-emerald-400">{CURRENCY} {fmt(summary.grandTotal)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(!summary.rows || summary.rows.length === 0) && (
                  <div className="text-center py-12 text-gray-500">No data for selected period</div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">Select date range and click Generate</div>
          )}
        </div>
      ) : (
        <>
          {/* Type Breakdown */}
          {totalByType.length > 0 && (
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-emerald-400" /> Breakdown by Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {totalByType.map(([name, amt]) => (
                  <div key={name} className="flex items-center justify-between px-3 py-2.5 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-300">{name}</span>
                    <span className="text-sm font-semibold text-emerald-400">{CURRENCY} {fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gray-800/40">
                  <span className="text-sm text-gray-400">{filteredContributions.length} record{filteredContributions.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-semibold text-emerald-400">Total: {CURRENCY} {fmt(totalAmount)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50 text-gray-400 text-left">
                        <th className="py-3.5 px-5 font-medium">Date</th>
                        <th className="py-3.5 px-5 font-medium">Member</th>
                        <th className="py-3.5 px-5 font-medium">Type</th>
                        <th className="py-3.5 px-5 font-medium text-right">Amount ({CURRENCY})</th>
                        <th className="py-3.5 px-5 font-medium">Method</th>
                        <th className="py-3.5 px-5 font-medium">Ref</th>
                        {isAdmin && <th className="py-3.5 px-5 font-medium text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContributions.map(c => (
                        <tr key={c.id} className="border-b border-gray-700/20 hover:bg-gray-700/20 transition-colors">
                          <td className="py-3 px-5 text-gray-300 whitespace-nowrap">{fdate(c.payment_date)}</td>
                          <td className="py-3 px-5 font-medium text-white">{c.full_name || 'Unknown'}</td>
                          <td className="py-3 px-5"><span className="inline-flex px-2.5 py-1 bg-emerald-900/40 text-emerald-300 rounded-lg text-xs font-medium">{c.contribution_type_name}</span></td>
                          <td className="py-3 px-5 text-right text-emerald-400 font-semibold whitespace-nowrap">{CURRENCY} {fmt(c.amount)}</td>
                          <td className="py-3 px-5 text-gray-400"><span className="inline-flex px-2 py-1 bg-gray-700/50 rounded-lg text-xs">{c.payment_method}</span></td>
                          <td className="py-3 px-5 text-gray-500 text-xs font-mono">{c.reference_number || '-'}</td>
                          {isAdmin && (
                            <td className="py-3 px-5 text-right whitespace-nowrap">
                              <button onClick={() => openEdit(c)} className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"><Edit3 size={14} /></button>
                              <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all ml-1"><Trash2 size={14} /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredContributions.length === 0 && (
                        <tr><td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-gray-500">No contributions found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-gray-700/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Receipt size={18} className="text-emerald-400" />
                {editing ? 'Edit Contribution' : 'Record Contribution'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 relative">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Member</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => {
                        setMemberSearch(e.target.value);
                        setIsMemberDropdownOpen(true);
                        const match = members.find(m => m.full_name.toLowerCase() === e.target.value.toLowerCase());
                        setForm(f => ({ ...f, member_id: match ? match.id : '' }));
                      }}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      placeholder="Search member by name..."
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-white placeholder-gray-400"
                    />
                    <div className="absolute left-3 top-3 text-gray-400">
                      <Search size={16} />
                    </div>
                    {memberSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberSearch('');
                          setForm(f => ({ ...f, member_id: '' }));
                          setIsMemberDropdownOpen(true);
                        }}
                        className="absolute right-3 top-3 text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {isMemberDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsMemberDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1.5 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-gray-700/40">
                        {members.filter(m => m.full_name.toLowerCase().includes(memberSearch.toLowerCase())).length > 0 ? (
                          members
                            .filter(m => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()))
                            .slice(0, 15)
                            .map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setMemberSearch(m.full_name);
                                  setForm(f => ({ ...f, member_id: m.id }));
                                  setIsMemberDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-750 flex items-center justify-between transition-colors ${
                                  form.member_id === m.id ? 'bg-emerald-600/10 border-l-2 border-emerald-500' : ''
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-medium text-white">{m.full_name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {m.section_name || 'No Section'} {m.leader_name ? `• Leader: ${m.leader_name}` : ''}
                                  </p>
                                </div>
                                <span className="text-xs text-gray-500 font-mono">#{m.id}</span>
                              </button>
                            ))
                        ) : (
                          <p className="p-3 text-xs text-gray-400 text-center italic">No members found</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Contribution Type</label>
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-left text-white flex items-center justify-between"
                  >
                    <span>
                      {types.find(t => t.id === Number(form.contribution_type_id))?.name || 'Select type...'}
                    </span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>

                  {isTypeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsTypeDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1.5 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-gray-700/40">
                        {types.filter(t => t.is_active !== 0).map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, contribution_type_id: t.id }));
                              setIsTypeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-gray-750 flex items-center justify-between transition-colors ${
                              Number(form.contribution_type_id) === t.id ? 'bg-emerald-600/10 border-l-2 border-emerald-500 text-emerald-400' : 'text-gray-200'
                            }`}
                          >
                            <span className="text-sm font-medium">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount ({CURRENCY})</label>
                  <input type="number" step="500" min="500" max="10000000" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="e.g. 10,000" />
                  <p className="text-[10px] text-gray-500 mt-1">Typical range: TZS 500 – 5,000,000</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} required className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Reference Number</label>
                  <input type="text" value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. MOMO ref, cheque no." className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm rounded-xl">{saving ? 'Saving...' : editing ? 'Update' : 'Record Contribution'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type Manager Modal */}
      {typeModalOpen && (
        <ContributionTypeManager
          types={types}
          onClose={() => setTypeModalOpen(false)}
          onRefresh={async () => { const { data } = await contributionAPI.getTypes(); setTypes(data); }}
          showMessage={showMessage}
        />
      )}
    </div>
  );
}

function ContributionTypeManager({ types, onClose, onRefresh, showMessage }) {
  const [localTypes, setLocalTypes] = useState(types);
  const [form, setForm] = useState({ name: '', description: '', sort_order: 0 });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalTypes(types); }, [types]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await contributionAPI.updateType(editingId, { name: form.name.trim(), description: form.description, sort_order: Number(form.sort_order) });
      } else {
        await contributionAPI.createType({ name: form.name.trim(), description: form.description, sort_order: Number(form.sort_order) });
      }
      setForm({ name: '', description: '', sort_order: 0 });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      showMessage?.(err.message || 'Failed to save');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this contribution type?')) return;
    try {
      await contributionAPI.deleteType(id);
      await onRefresh();
    } catch (err) {
      showMessage?.(err.message || 'Failed to delete');
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ name: t.name, description: t.description || '', sort_order: t.sort_order });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-700/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FileText size={18} className="text-emerald-400" /> Contribution Types</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="e.g. Building Fund" />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-400 mb-1">Order</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm whitespace-nowrap rounded-xl">{saving ? '...' : editingId ? 'Update' : 'Add'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', description: '', sort_order: 0 }); }} className="btn-ghost px-3 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>}
          </form>
          <div className="space-y-1.5 mt-4">
            {localTypes.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors border border-gray-700/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-6 font-mono">{t.sort_order}</span>
                  <div>
                    <span className="text-sm font-medium text-white">{t.name}</span>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-medium ${t.is_active ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
