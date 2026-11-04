import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Filter,
  X,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileText,
  PieChart,
  List,
  Calendar,
  Download,
  RotateCw,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { contributionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fdate } from '../../utils/date';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];
const CURRENCY = 'TZS';
const fmt = (n) =>
  (n || 0).toLocaleString('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ContributionsView({ showMessage, allMembers = [] }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'pastor';

  const [members, setMembers] = useState(allMembers);
  const [contributions, setContributions] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    contribution_type_id: '',
    payment_method: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    member_id: '',
    contribution_type_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    reference_number: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryDateRange, setSummaryDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // Search & custom dropdown states for contribution form
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [, setTypesLoading] = useState(true);

  // Guarantee types load on mount independently of contributions list
  useEffect(() => {
    async function fetchTypes() {
      try {
        const { data } = await contributionAPI.getTypes();
        setTypes(data || []);
      } catch (err) {
        console.error('Failed to load types on mount:', err);
      } finally {
        setTypesLoading(false);
      }
    }
    fetchTypes();
  }, []);

  useEffect(() => {
    setMembers(allMembers);
    loadInitial();
  }, [allMembers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInitial() {
    setLoading(true);
    try {
      const defaultFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const defaultTo = new Date().toISOString().split('T')[0];
      setFilters((f) => ({ ...f, date_from: defaultFrom, date_to: defaultTo }));

      // Fetch both concurrently. If contributions fail, types will still load
      const [typesRes, contribsRes] = await Promise.allSettled([
        contributionAPI.getTypes(),
        contributionAPI.getContributions({ date_from: defaultFrom, date_to: defaultTo })
      ]);

      if (typesRes.status === 'fulfilled') {
        setTypes(typesRes.value.data || []);
      } else {
        console.error('Failed to load initial types:', typesRes.reason);
      }

      if (contribsRes.status === 'fulfilled') {
        setContributions(contribsRes.value.data || []);
      } else {
        console.error('Failed to load initial contributions:', contribsRes.reason);
        showMessage?.(contribsRes.reason?.message || 'Failed to load contributions list');
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      showMessage?.(err.message || 'Failed to load initial contributions data');
    } finally {
      setLoading(false);
    }
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
      setContributions(data || []);
    } catch (err) {
      console.error('Failed to load contributions:', err);
      showMessage?.(err.message || 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
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
    if (amt < 500) {
      showMessage?.('Minimum contribution amount is TZS 500');
      return;
    }
    if (amt > 10_000_000) {
      showMessage?.(
        'Amount exceeds maximum allowed (TZS 10,000,000). Please verify before saving.'
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        member_id: Number(form.member_id),
        contribution_type_id: Number(form.contribution_type_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        notes: form.notes || null
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
    setForm({
      member_id: '',
      contribution_type_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      reference_number: '',
      notes: ''
    });
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
      notes: c.notes || ''
    });
    const selectedMember = members.find((m) => m.id === c.member_id);
    setMemberSearch(selectedMember ? selectedMember.full_name : '');
    setIsMemberDropdownOpen(false);
    setIsTypeDropdownOpen(false);
    setIsModalOpen(true);
  }

  const filteredContributions = useMemo(() => {
    if (!filters.search) return contributions;
    const q = filters.search.toLowerCase();
    return contributions.filter(
      (c) =>
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.contribution_type_name && c.contribution_type_name.toLowerCase().includes(q)) ||
        (c.reference_number && c.reference_number.toLowerCase().includes(q))
    );
  }, [contributions, filters.search]);

  const totalAmount = useMemo(
    () => filteredContributions.reduce((s, c) => s + Number(c.amount || 0), 0),
    [filteredContributions]
  );
  const totalByType = useMemo(() => {
    const map = {};
    filteredContributions.forEach((c) => {
      const key = c.contribution_type_name || 'Unknown';
      map[key] = (map[key] || 0) + Number(c.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredContributions]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-system-green/15 text-emerald-700 dark:text-system-green">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-title-2 font-semibold text-label">Contributions</h1>
            <p className="mt-0.5 text-subheadline text-secondary-label">
              Record and manage member contributions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadInitial} className="btn-icon btn-ghost" title="Refresh">
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="tab-pills shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className="tab-pill inline-flex items-center gap-1.5"
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => {
                setViewMode('summary');
                loadSummary();
              }}
              className="tab-pill inline-flex items-center gap-1.5"
            >
              <PieChart className="h-4 w-4" /> Summary
            </button>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setTypeModalOpen(true)} className="btn-secondary shrink-0">
                <FileText className="h-4 w-4" /> Types
              </button>
              <button onClick={openAdd} className="btn-primary shrink-0">
                <Plus className="h-4 w-4" /> Record
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card-stat">
          <div className="flex items-center gap-3">
            <div className="card-stat-icon bg-system-green/15 text-emerald-700 dark:text-system-green">
              <DollarSign className="h-[18px] w-[18px]" />
            </div>
            <p className="card-stat-label">Total Contributions</p>
          </div>
          <p className="mt-3 text-title-3 font-semibold tabular-nums text-label">
            {CURRENCY} {fmt(totalAmount)}
          </p>
          <p className="mt-1 text-footnote text-secondary-label">
            {filteredContributions.length} records
          </p>
        </div>
        <div className="card-stat">
          <div className="flex items-center gap-3">
            <div className="card-stat-icon bg-system-blue/15 text-blue-700 dark:text-system-blue">
              <TrendingUp className="h-[18px] w-[18px]" />
            </div>
            <p className="card-stat-label">Contribution Types</p>
          </div>
          <p className="mt-3 text-title-3 font-semibold tabular-nums text-label">{types.length}</p>
          <p className="mt-1 text-footnote text-secondary-label">
            {totalByType.length} active this period
          </p>
        </div>
        <div className="card-stat">
          <div className="flex items-center gap-3">
            <div className="card-stat-icon bg-system-orange/15 text-amber-700 dark:text-system-orange">
              <Receipt className="h-[18px] w-[18px]" />
            </div>
            <p className="card-stat-label">Avg Per Record</p>
          </div>
          <p className="mt-3 text-title-3 font-semibold tabular-nums text-label">
            {CURRENCY}{' '}
            {fmt(filteredContributions.length ? totalAmount / filteredContributions.length : 0)}
          </p>
          <p className="mt-1 text-footnote text-secondary-label">Across all types</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary-label"
            />
            <input
              type="text"
              placeholder="Search by name, type, or ref..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-footnote text-secondary-label md:flex">
              <Calendar size={14} />
              <span>
                {filters.date_from || 'Start'} - {filters.date_to || 'End'}
              </span>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 ${
                showFilters ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300' : ''
              }`}
            >
              <Filter size={15} /> Filters{' '}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={() => loadContributions()} className="btn-primary px-4 py-2">
              Search
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-separator/60 pt-4 md:grid-cols-4 dark:border-white/[0.08]">
            <div>
              <label className="input-label">From Date</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">To Date</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Type</label>
              <select
                value={filters.contribution_type_id}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, contribution_type_id: e.target.value }))
                }
                className="select"
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Method</label>
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
                className="select"
              >
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-full flex justify-end gap-2">
              <button
                onClick={() => {
                  setFilters((f) => ({
                    ...f,
                    date_from: '',
                    date_to: '',
                    contribution_type_id: '',
                    payment_method: ''
                  }));
                }}
                className="btn-sm btn-ghost"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'summary' ? (
        <div className="card p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h3 className="flex items-center gap-2.5 text-title-3 font-semibold text-label">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-system-green/15 text-emerald-700 dark:text-system-green">
                <PieChart className="h-[18px] w-[18px]" />
              </span>
              Contribution Summary
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={summaryDateRange.from}
                onChange={(e) => setSummaryDateRange((d) => ({ ...d, from: e.target.value }))}
                className="input"
              />
              <span className="text-tertiary-label">-</span>
              <input
                type="date"
                value={summaryDateRange.to}
                onChange={(e) => setSummaryDateRange((d) => ({ ...d, to: e.target.value }))}
                className="input"
              />
              <button onClick={loadSummary} className="btn-primary btn-sm whitespace-nowrap">
                <Download className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </div>
          {summary ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[720px]">
                  <thead>
                    <tr className="border-b border-separator/60 text-left dark:border-white/[0.08]">
                      <th className="pb-3 text-left text-caption-1 font-semibold text-secondary-label">
                        Type
                      </th>
                      <th className="pb-3 text-right text-caption-1 font-semibold text-secondary-label">
                        Count
                      </th>
                      <th className="pb-3 text-right text-caption-1 font-semibold text-secondary-label">
                        Total ({CURRENCY})
                      </th>
                      <th className="pb-3 text-right text-caption-1 font-semibold text-secondary-label">
                        Min
                      </th>
                      <th className="pb-3 text-right text-caption-1 font-semibold text-secondary-label">
                        Max
                      </th>
                      <th className="pb-3 text-right text-caption-1 font-semibold text-secondary-label">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows?.map((row, _i) => (
                      <tr
                        key={row.type_id}
                        className="border-b border-separator/50 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.08] dark:hover:bg-white/[0.03]"
                      >
                        <td className="py-3 text-footnote font-medium text-label">
                          {row.type_name}
                        </td>
                        <td className="py-3 text-right text-footnote tabular-nums text-label">
                          {row.count}
                        </td>
                        <td className="py-3 text-right text-footnote font-semibold tabular-nums text-label">
                          {CURRENCY} {fmt(row.total)}
                        </td>
                        <td className="py-3 text-right text-footnote tabular-nums text-secondary-label">
                          {CURRENCY} {fmt(row.min_amount)}
                        </td>
                        <td className="py-3 text-right text-footnote tabular-nums text-secondary-label">
                          {CURRENCY} {fmt(row.max_amount)}
                        </td>
                        <td className="py-3 text-right text-footnote tabular-nums text-secondary-label">
                          {CURRENCY} {fmt(row.total / row.count)}
                        </td>
                      </tr>
                    ))}
                    {summary.rows?.length > 0 && (
                      <tr className="border-t border-separator bg-system-grouped-background/70 dark:bg-white/[0.03]">
                        <td className="py-3 text-footnote font-semibold text-label">Grand Total</td>
                        <td className="py-3 text-right text-footnote font-semibold tabular-nums text-label">
                          {summary.grandCount}
                        </td>
                        <td className="py-3 text-right text-subheadline font-semibold tabular-nums text-label">
                          {CURRENCY} {fmt(summary.grandTotal)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {(!summary.rows || summary.rows.length === 0) && (
                  <div className="py-12 text-center text-footnote text-secondary-label">
                    No data for selected period
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-footnote text-secondary-label">
              Select date range and click Generate
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Type Breakdown */}
          {totalByType.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-footnote font-semibold text-secondary-label">
                <TrendingUp className="h-[15px] w-[15px] text-primary-700 dark:text-primary-300" />{' '}
                Breakdown by Type
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {totalByType.map(([name, amt]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-xl bg-system-grouped-background/70 px-3 py-2.5 dark:bg-white/[0.03]"
                  >
                    <span className="truncate text-footnote text-label">{name}</span>
                    <span className="whitespace-nowrap text-subheadline font-semibold tabular-nums text-label">
                      {CURRENCY} {fmt(amt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="space-y-3 p-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-10 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-separator/60 bg-system-grouped-background/50 px-5 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
                  <span className="text-footnote text-secondary-label">
                    {filteredContributions.length} record
                    {filteredContributions.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-footnote font-semibold tabular-nums text-label">
                    Total: {CURRENCY} {fmt(totalAmount)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[800px]">
                    <thead>
                      <tr className="border-b border-separator/60 dark:border-white/[0.08]">
                        <th className="px-5 py-3.5 text-left text-caption-1 font-semibold text-secondary-label">
                          Date
                        </th>
                        <th className="px-5 py-3.5 text-left text-caption-1 font-semibold text-secondary-label">
                          Member
                        </th>
                        <th className="px-5 py-3.5 text-left text-caption-1 font-semibold text-secondary-label">
                          Type
                        </th>
                        <th className="px-5 py-3.5 text-right text-caption-1 font-semibold text-secondary-label">
                          Amount ({CURRENCY})
                        </th>
                        <th className="px-5 py-3.5 text-left text-caption-1 font-semibold text-secondary-label">
                          Method
                        </th>
                        <th className="px-5 py-3.5 text-left text-caption-1 font-semibold text-secondary-label">
                          Ref
                        </th>
                        {isAdmin && (
                          <th className="px-5 py-3.5 text-right text-caption-1 font-semibold text-secondary-label">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContributions.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-separator/50 transition-colors hover:bg-system-grouped-background/70 dark:border-white/[0.08] dark:hover:bg-white/[0.03]"
                        >
                          <td className="whitespace-nowrap px-5 py-3 text-footnote text-label">
                            {fdate(c.payment_date)}
                          </td>
                          <td className="px-5 py-3 text-footnote font-medium text-label">
                            {c.full_name || 'Unknown'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="badge badge-neutral">{c.contribution_type_name}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-subheadline font-semibold tabular-nums text-label">
                            {CURRENCY} {fmt(c.amount)}
                          </td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-system-fill px-2.5 py-0.5 text-caption-2 text-secondary-label">
                              {c.payment_method}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-caption-1 tabular-nums text-tertiary-label">
                            {c.reference_number || '-'}
                          </td>
                          {isAdmin && (
                            <td className="whitespace-nowrap px-5 py-3 text-right">
                              <button
                                onClick={() => openEdit(c)}
                                className="focus-ring rounded-lg p-1.5 text-secondary-label transition-colors hover:bg-system-blue/10 hover:text-blue-700 dark:hover:text-system-blue"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                className="focus-ring ml-1 rounded-lg p-1.5 text-secondary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 dark:hover:text-system-red"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredContributions.length === 0 && (
                        <tr>
                          <td
                            colSpan={isAdmin ? 7 : 6}
                            className="py-12 text-center text-footnote text-secondary-label"
                          >
                            No contributions found
                          </td>
                        </tr>
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
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2.5 text-headline font-semibold text-label">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-system-green/15 text-emerald-700 dark:text-system-green">
                  <Receipt className="h-[18px] w-[18px]" />
                </span>
                {editing ? 'Edit Contribution' : 'Record Contribution'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="relative col-span-2">
                  <label className="input-label">Member</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setIsMemberDropdownOpen(true);
                        const match = members.find(
                          (m) => m.full_name.toLowerCase() === e.target.value.toLowerCase()
                        );
                        setForm((f) => ({ ...f, member_id: match ? match.id : '' }));
                      }}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      placeholder="Search member by name..."
                      className="input pl-10 pr-9"
                    />
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary-label">
                      <Search className="h-4 w-4" />
                    </div>
                    {memberSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberSearch('');
                          setForm((f) => ({ ...f, member_id: '' }));
                          setIsMemberDropdownOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {isMemberDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMemberDropdownOpen(false)}
                      />
                      <div className="absolute inset-x-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-card animate-fade-in dark:border-white/[0.1] dark:bg-tertiary-system-background">
                        {members.filter((m) =>
                          m.full_name.toLowerCase().includes(memberSearch.toLowerCase())
                        ).length > 0 ? (
                          members
                            .filter((m) =>
                              m.full_name.toLowerCase().includes(memberSearch.toLowerCase())
                            )
                            .slice(0, 15)
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setMemberSearch(m.full_name);
                                  setForm((f) => ({ ...f, member_id: m.id }));
                                  setIsMemberDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left transition-colors ${
                                  form.member_id === m.id
                                    ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                                    : 'text-label hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-footnote font-medium text-label">
                                      {m.full_name}
                                    </p>
                                    <p className="mt-0.5 truncate text-caption-1 text-secondary-label">
                                      {m.section_name || 'No Section'}{' '}
                                      {m.leader_name ? `• Leader: ${m.leader_name}` : ''}
                                    </p>
                                  </div>
                                  <span className="text-caption-2 tabular-nums text-tertiary-label">
                                    #{m.id}
                                  </span>
                                </div>
                              </button>
                            ))
                        ) : (
                          <p className="p-3 text-center text-caption-1 italic text-secondary-label">
                            No members found
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <label className="input-label">Contribution Type</label>
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className="input flex items-center justify-between gap-2 text-left"
                  >
                    <span className="truncate">
                      {types.find((t) => t.id === Number(form.contribution_type_id))?.name ||
                        'Select type...'}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-tertiary-label" />
                  </button>

                  {isTypeDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsTypeDropdownOpen(false)}
                      />
                      <div className="absolute inset-x-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-card animate-fade-in dark:border-white/[0.1] dark:bg-tertiary-system-background">
                        {types.filter((t) => t.is_active !== 0).length === 0 ? (
                          <p className="p-3 text-center text-caption-1 italic text-secondary-label">
                            No contribution types loaded
                          </p>
                        ) : (
                          types
                            .filter((t) => t.is_active !== 0)
                            .map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setForm((f) => ({ ...f, contribution_type_id: t.id }));
                                  setIsTypeDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left transition-colors ${
                                  Number(form.contribution_type_id) === t.id
                                    ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                                    : 'text-label hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]'
                                }`}
                              >
                                <span className="text-footnote font-medium">{t.name}</span>
                              </button>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="input-label">Amount ({CURRENCY})</label>
                  <input
                    type="number"
                    step="500"
                    min="500"
                    max="10000000"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    className="input"
                    placeholder="e.g. 10,000"
                  />
                  <p className="mt-1 text-caption-2 text-secondary-label">
                    Typical range: TZS 500 – 5,000,000
                  </p>
                </div>
                <div>
                  <label className="input-label">Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                    className="select"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="input-label">Reference Number</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                    placeholder="e.g. MOMO ref, cheque no."
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="input"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost px-4"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary px-5">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Record Contribution'}
                </button>
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
          onRefresh={async () => {
            const { data } = await contributionAPI.getTypes();
            setTypes(data);
          }}
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

  useEffect(() => {
    setLocalTypes(types);
  }, [types]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await contributionAPI.updateType(editingId, {
          name: form.name.trim(),
          description: form.description,
          sort_order: Number(form.sort_order)
        });
      } else {
        await contributionAPI.createType({
          name: form.name.trim(),
          description: form.description,
          sort_order: Number(form.sort_order)
        });
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="flex items-center gap-2.5 text-headline font-semibold text-label">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
              <FileText className="h-[18px] w-[18px]" />
            </span>
            Contribution Types
          </h3>
          <button onClick={onClose} className="btn-icon btn-ghost" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="input-label">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="input"
                placeholder="e.g. Building Fund"
              />
            </div>
            <div className="w-20 shrink-0">
              <label className="input-label">Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary btn-sm whitespace-nowrap"
            >
              {saving ? '...' : editingId ? 'Update' : 'Add'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', description: '', sort_order: 0 });
                }}
                className="btn-sm btn-ghost whitespace-nowrap"
              >
                Cancel
              </button>
            )}
          </form>
          <div className="mt-4 space-y-1.5">
            {localTypes.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-system-grouped-background/70 px-4 py-3 transition-colors hover:bg-system-fill dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-caption-2 tabular-nums text-tertiary-label">
                    {t.sort_order}
                  </span>
                  <div className="min-w-0">
                    <span className="truncate text-subheadline font-medium text-label">
                      {t.name}
                    </span>
                    {t.description && (
                      <p className="mt-0.5 truncate text-caption-1 text-secondary-label">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      t.is_active ? 'badge badge-success shrink-0' : 'badge badge-danger shrink-0'
                    }
                  >
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(t)}
                    className="focus-ring rounded-lg p-1.5 text-secondary-label transition-colors hover:bg-system-blue/10 hover:text-blue-700 dark:hover:text-system-blue"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="focus-ring rounded-lg p-1.5 text-secondary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 dark:hover:text-system-red"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
