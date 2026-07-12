import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, DollarSign, PieChart, List, TrendingUp, Receipt, Calendar, RotateCw, Wallet, ChevronDown } from 'lucide-react';
import { contributionAPI } from '../../services/api';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];
const CURRENCY = 'TZS';
const fmt = (n) => (n || 0).toLocaleString('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function LeaderContributions({ members: propMembers = [], showMessage }) {
  const [contributions, setContributions] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const members = propMembers;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ member_id: '', contribution_type_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Cash', reference_number: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Search & custom dropdown states for contribution form
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [typesLoading, setTypesLoading] = useState(true);

  // Fetch contribution types independently on mount so they
  // are always available when the modal opens, regardless of
  // whether the contributions list has finished loading.
  useEffect(() => {
    async function fetchTypes() {
      try {
        const { data } = await contributionAPI.getTypes();
        setTypes(data || []);
      } catch (err) {
        console.error('Failed to load contribution types:', err);
      } finally {
        setTypesLoading(false);
      }
    }
    fetchTypes();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Use allSettled so a contributions failure doesn't block types
      const [typesRes, contribsRes] = await Promise.allSettled([
        contributionAPI.getTypes(),
        contributionAPI.getContributions(),
      ]);
      if (typesRes.status === 'fulfilled') {
        setTypes(typesRes.value.data || []);
        setTypesLoading(false);
      }
      if (contribsRes.status === 'fulfilled') setContributions(contribsRes.value.data || []);
      if (contribsRes.status === 'rejected') {
        console.error('Failed to load contributions:', contribsRes.reason);
        showMessage?.(contribsRes.reason?.response?.data?.error || 'Failed to load contributions');
      }
    } catch (err) {
      console.error('Failed to load:', err);
      showMessage?.(err?.response?.data?.error || 'Failed to load contributions data');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.member_id || !form.contribution_type_id || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      await contributionAPI.createContribution({
        member_id: Number(form.member_id),
        contribution_type_id: Number(form.contribution_type_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        notes: form.notes || null,
      });
      setIsModalOpen(false);
      setForm({ member_id: '', contribution_type_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Cash', reference_number: '', notes: '' });
      await loadData();
      showMessage?.('Contribution recorded successfully');
    } catch (err) {
      showMessage?.(err.message || 'Failed to record contribution');
    }
    setSaving(false);
  }

  const filtered = useMemo(() => {
    if (!search && !typeFilter) return contributions;
    return contributions.filter(c => {
      const matchSearch = !search ||
        (c.full_name && c.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (c.contribution_type_name && c.contribution_type_name.toLowerCase().includes(search.toLowerCase()));
      const matchType = !typeFilter || String(c.contribution_type_id) === typeFilter;
      return matchSearch && matchType;
    });
  }, [contributions, search, typeFilter]);

  const total = useMemo(() => filtered.reduce((s, c) => s + c.amount, 0), [filtered]);

  const summaryByType = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      const key = c.contribution_type_name || 'Unknown';
      map[key] = (map[key] || 0) + c.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

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
            <p className="text-sm text-gray-400 mt-0.5">Record and manage your members' contributions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-ghost p-2 text-gray-400 hover:text-white" title="Refresh"><RotateCw size={16} /></button>
          <button onClick={() => { setMemberSearch(''); setIsMemberDropdownOpen(false); setIsTypeDropdownOpen(false); setIsModalOpen(true); }} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={15} /> Record Contribution</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 rounded-xl p-5 border border-emerald-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold text-white mt-1">{CURRENCY} {fmt(total)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20"><DollarSign className="w-5 h-5 text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 rounded-xl p-5 border border-blue-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-400/80 uppercase tracking-wider">Records</p>
              <p className="text-xl font-bold text-white mt-1">{filtered.length}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/20"><List className="w-5 h-5 text-blue-400" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 rounded-xl p-5 border border-purple-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider">Types</p>
              <p className="text-xl font-bold text-white mt-1">{summaryByType.length}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/20"><PieChart className="w-5 h-5 text-purple-400" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 rounded-xl p-5 border border-amber-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-400/80 uppercase tracking-wider">Avg / Record</p>
              <p className="text-xl font-bold text-white mt-1">{CURRENCY} {fmt(filtered.length ? total / filtered.length : 0)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/20"><TrendingUp className="w-5 h-5 text-amber-400" /></div>
          </div>
        </div>
      </div>

      {/* Breakdown by Type */}
      {summaryByType.length > 0 && (
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><PieChart size={15} className="text-emerald-400" /> Breakdown by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryByType.map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between px-3 py-2.5 bg-gray-700/30 rounded-lg">
                <span className="text-sm text-gray-300">{name}</span>
                <span className="text-sm font-semibold text-emerald-400">{CURRENCY} {fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
            <option value="">All Types</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gray-800/40">
              <span className="text-sm text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
              <span className="text-sm font-semibold text-emerald-400">Total: {CURRENCY} {fmt(total)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50 text-gray-400 text-left">
                    <th className="py-3.5 px-5 font-medium">Date</th>
                    <th className="py-3.5 px-5 font-medium">Type</th>
                    <th className="py-3.5 px-5 font-medium text-right">Amount ({CURRENCY})</th>
                    <th className="py-3.5 px-5 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-gray-700/20 hover:bg-gray-700/20 transition-colors">
                      <td className="py-3 px-5 text-gray-300 whitespace-nowrap">{c.payment_date}</td>
                      <td className="py-3 px-5"><span className="inline-flex px-2.5 py-1 bg-emerald-900/40 text-emerald-300 rounded-lg text-xs font-medium">{c.contribution_type_name}</span></td>
                      <td className="py-3 px-5 text-right text-emerald-400 font-semibold whitespace-nowrap">{CURRENCY} {fmt(c.amount)}</td>
                      <td className="py-3 px-5"><span className="inline-flex px-2 py-1 bg-gray-700/50 rounded-lg text-xs text-gray-400">{c.payment_method}</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-gray-500">No contributions yet. Click "Record Contribution" to add one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Record Contribution Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-gray-700/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wallet size={18} className="text-emerald-400" />
                Record Contribution
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
                        {typesLoading ? (
                          <p className="p-3 text-xs text-gray-400 text-center italic">Loading types...</p>
                        ) : types.filter(t => t.is_active !== 0).length === 0 ? (
                          <p className="p-3 text-xs text-gray-400 text-center italic">No contribution types found</p>
                        ) : (
                          types.filter(t => t.is_active !== 0).map(t => (
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
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Amount ({CURRENCY})</label>
                  <input type="number" step="1" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="0" />
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
                  <input type="text" value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. MOMO ref" className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm rounded-xl">{saving ? 'Recording...' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
