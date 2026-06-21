import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit3, Trash2, Filter, X, DollarSign, ChevronDown, ChevronUp, FileText, PieChart, List } from 'lucide-react';
import { contributionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];

export default function ContributionsView({ showMessage, allMembers = [] }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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
  const [summaryDateRange, setSummaryDateRange] = useState({ from: '', to: '' });

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', description: '', sort_order: 0 });
  const [editingType, setEditingType] = useState(null);
  const [savingType, setSavingType] = useState(false);

  useEffect(() => {
    setMembers(allMembers);
    loadData();
  }, [allMembers.length]);

  async function loadData() {
    setLoading(true);
    try {
      setMembers(allMembers);
      const [typesRes] = await Promise.all([
        contributionAPI.getTypes()
      ]);
      setTypes(typesRes.data);
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
      const res = await contributionAPI.getContributions(params);
      setContributions(res.data);
    } catch (err) {
      console.error('Failed to load contributions:', err);
    }
    setLoading(false);
  }

  async function loadSummary() {
    try {
      const params = {};
      if (summaryDateRange.from) params.date_from = summaryDateRange.from;
      if (summaryDateRange.to) params.date_to = summaryDateRange.to;
      if (filters.contribution_type_id) params.contribution_type_id = filters.contribution_type_id;
      const res = await contributionAPI.getSummary(params);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        showMessage?.('Contribution updated');
      } else {
        await contributionAPI.createContribution(payload);
        showMessage?.('Contribution recorded');
      }
      setIsModalOpen(false);
      setEditing(null);
      resetForm();
      loadContributions();
    } catch (err) {
      showMessage?.(err.message || 'Failed to save contribution');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this contribution record?')) return;
    try {
      await contributionAPI.deleteContribution(id);
      showMessage?.('Contribution deleted');
      loadContributions();
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

  const totalAmount = useMemo(() => filteredContributions.reduce((s, c) => s + c.amount, 0), [filteredContributions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Contributions</h2>
          <p className="text-gray-400 text-sm mt-1">Record and manage member contributions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><List size={16} /></button>
            <button onClick={() => { setViewMode('summary'); loadSummary(); }} className={`px-3 py-1.5 rounded text-sm ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><PieChart size={16} /></button>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setTypeModalOpen(true)} className="btn-secondary text-sm"><FileText size={16} /> Types</button>
              <button onClick={openAdd} className="btn-primary text-sm"><Plus size={16} /> Record Contribution</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, type, ref..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-9 pr-3 py-2 bg-gray-700 rounded w-full text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm"><Filter size={16} /> Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-750 rounded-lg">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date From</label>
              <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} className="input-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date To</label>
              <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} className="input-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select value={filters.contribution_type_id} onChange={e => setFilters(f => ({ ...f, contribution_type_id: e.target.value }))} className="input-sm w-full">
                <option value="">All Types</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Method</label>
              <select value={filters.payment_method} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))} className="input-sm w-full">
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-full flex justify-end gap-2 mt-2">
              <button onClick={() => { setFilters({ date_from: '', date_to: '', contribution_type_id: '', payment_method: '', search: '' }); loadContributions({}); }} className="btn-secondary text-xs">Clear</button>
              <button onClick={() => loadContributions()} className="btn-primary text-xs">Apply</button>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'summary' ? (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Summary Report</h3>
            <div className="flex gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">From</label>
                <input type="date" value={summaryDateRange.from} onChange={e => setSummaryDateRange(d => ({ ...d, from: e.target.value }))} className="input-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">To</label>
                <input type="date" value={summaryDateRange.to} onChange={e => setSummaryDateRange(d => ({ ...d, to: e.target.value }))} className="input-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={loadSummary} className="btn-primary text-sm">Generate</button>
              </div>
            </div>
            {summary && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Count</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">Min</th>
                      <th className="text-right py-2">Max</th>
                      <th className="text-right py-2">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows?.map(row => (
                      <tr key={row.type_id} className="border-b border-gray-700/50">
                        <td className="py-2 font-medium">{row.type_name}</td>
                        <td className="py-2 text-right">{row.count}</td>
                        <td className="py-2 text-right text-green-400 font-medium">GH¢{row.total?.toFixed(2)}</td>
                        <td className="py-2 text-right">GH¢{row.min_amount?.toFixed(2)}</td>
                        <td className="py-2 text-right">GH¢{row.max_amount?.toFixed(2)}</td>
                        <td className="py-2 text-right">GH¢{(row.total / row.count)?.toFixed(2)}</td>
                      </tr>
                    ))}
                    {summary.rows?.length > 0 && (
                      <tr className="font-semibold text-gray-200">
                        <td className="py-3">Grand Total</td>
                        <td className="py-3 text-right">{summary.grandCount}</td>
                        <td className="py-3 text-right text-green-400">GH¢{summary.grandTotal?.toFixed(2)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(!summary.rows || summary.rows.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No data for selected period</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm text-gray-400">{filteredContributions.length} records</span>
            <span className="text-sm font-semibold text-green-400">Total: GH¢{totalAmount.toFixed(2)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Ref</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredContributions.map(c => (
                  <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">{c.payment_date}</td>
                    <td className="py-3 px-4 font-medium">{c.full_name || 'Unknown'}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">{c.contribution_type_name}</span></td>
                    <td className="py-3 px-4 text-green-400 font-medium">GH¢{c.amount?.toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-400">{c.payment_method}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{c.reference_number || '-'}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => openEdit(c)} className="text-blue-400 hover:text-blue-300 mr-2"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredContributions.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-gray-500">No contributions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Contribution' : 'Record Contribution'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Member</label>
                  <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))} required className="input w-full">
                    <option value="">Select member...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Contribution Type</label>
                  <select value={form.contribution_type_id} onChange={e => setForm(f => ({ ...f, contribution_type_id: e.target.value }))} required className="input w-full">
                    <option value="">Select type...</option>
                    {types.filter(t => t.is_active !== 0).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Amount (GH¢)</label>
                  <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} required className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="input w-full">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Reference Number</label>
                  <input type="text" value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. MOMO ref, cheque no." className="input w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input w-full" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {typeModalOpen && (
        <ContributionTypeManager
          types={types}
          onClose={() => setTypeModalOpen(false)}
          onRefresh={async () => { const r = await contributionAPI.getTypes(); setTypes(r.data); }}
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
        showMessage?.('Type updated');
      } else {
        await contributionAPI.createType({ name: form.name.trim(), description: form.description, sort_order: Number(form.sort_order) });
        showMessage?.('Type created');
      }
      setForm({ name: '', description: '', sort_order: 0 });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      showMessage?.(err.message || 'Failed to save type');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this contribution type?')) return;
    try {
      await contributionAPI.deleteType(id);
      showMessage?.('Type deleted');
      await onRefresh();
    } catch (err) {
      showMessage?.(err.message || err.response?.data?.error || 'Failed to delete');
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ name: t.name, description: t.description || '', sort_order: t.sort_order });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Contribution Types</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="input w-full" placeholder="e.g. Building Fund" />
            </div>
            <div className="w-20">
              <label className="block text-xs text-gray-400 mb-1">Order</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className="input w-full" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm whitespace-nowrap">{saving ? '...' : editingId ? 'Update' : 'Add'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', description: '', sort_order: 0 }); }} className="btn-secondary text-sm">Cancel</button>}
          </form>
          <div className="space-y-1">
            {localTypes.map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded hover:bg-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-6">{t.sort_order}</span>
                  <div>
                    <span className="text-sm font-medium">{t.name}</span>
                    {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${t.is_active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(t)} className="text-blue-400 hover:text-blue-300"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
