import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  DollarSign,
  PieChart,
  List,
  TrendingUp,
  Receipt,
  RotateCw,
  Wallet,
  ChevronDown
} from 'lucide-react';
import { contributionAPI } from '../../services/api';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'];
const CURRENCY = 'TZS';
const fmt = (n) =>
  (n || 0).toLocaleString('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function LeaderContributions({ members: propMembers = [], showMessage }) {
  const [contributions, setContributions] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const members = propMembers;

  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Search & custom dropdown states for contribution form
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [typesLoading, setTypesLoading] = useState(true);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [typesRes, contribsRes] = await Promise.allSettled([
        contributionAPI.getTypes(),
        contributionAPI.getContributions()
      ]);
      if (typesRes.status === 'fulfilled') {
        setTypes(typesRes.value.data || []);
        setTypesLoading(false);
      }
      if (contribsRes.status === 'fulfilled') {
        setContributions(contribsRes.value.data || []);
      }
      if (contribsRes.status === 'rejected') {
        console.error('Failed to load contributions:', contribsRes.reason);
        // Extract message from standard Axios custom Error wrapper
        const msg = contribsRes.reason?.message || 'Failed to load contributions';
        showMessage?.(msg);
      }
    } catch (err) {
      console.error('Failed to load:', err);
      showMessage?.(err?.message || 'Failed to load contributions data');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.member_id || !form.contribution_type_id || !form.amount || Number(form.amount) <= 0)
      return;
    setSaving(true);
    try {
      await contributionAPI.createContribution({
        member_id: Number(form.member_id),
        contribution_type_id: Number(form.contribution_type_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        notes: form.notes || null
      });
      setIsModalOpen(false);
      setForm({
        member_id: '',
        contribution_type_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        reference_number: '',
        notes: ''
      });
      await loadData();
      showMessage?.('Contribution recorded successfully');
    } catch (err) {
      showMessage?.(err.message || 'Failed to record contribution');
    }
    setSaving(false);
  }

  const filtered = useMemo(() => {
    if (!search && !typeFilter) return contributions;
    return contributions.filter((c) => {
      const matchSearch =
        !search ||
        (c.full_name && c.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (c.contribution_type_name &&
          c.contribution_type_name.toLowerCase().includes(search.toLowerCase()));
      const matchType = !typeFilter || String(c.contribution_type_id) === typeFilter;
      return matchSearch && matchType;
    });
  }, [contributions, search, typeFilter]);

  const total = useMemo(() => filtered.reduce((s, c) => s + c.amount, 0), [filtered]);

  const summaryByType = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const key = c.contribution_type_name || 'Unknown';
      map[key] = (map[key] || 0) + c.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const statCards = [
    {
      label: 'Total contributions',
      value: `${CURRENCY} ${fmt(total)}`,
      icon: DollarSign,
      well: 'bg-system-green/15',
      iconColor: 'text-emerald-700 dark:text-system-green'
    },
    {
      label: 'Records',
      value: filtered.length,
      icon: List,
      well: 'bg-system-blue/15',
      iconColor: 'text-blue-700 dark:text-system-blue'
    },
    {
      label: 'Types',
      value: summaryByType.length,
      icon: PieChart,
      well: 'bg-system-purple/15',
      iconColor: 'text-purple-700 dark:text-system-purple'
    },
    {
      label: 'Avg / record',
      value: `${CURRENCY} ${fmt(filtered.length ? total / filtered.length : 0)}`,
      icon: TrendingUp,
      well: 'bg-system-orange/15',
      iconColor: 'text-amber-700 dark:text-system-orange'
    }
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-system-green/15">
            <Receipt className="h-5 w-5 text-emerald-700 dark:text-system-green" />
          </span>
          <div>
            <h1 className="text-title-1 font-semibold text-label">Contributions</h1>
            <p className="mt-0.5 text-footnote text-secondary-label">
              Record and manage your members&apos; contributions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="btn-icon btn-ghost h-10 w-10 rounded-lg"
            title="Refresh"
            aria-label="Refresh contributions"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={() => {
              setMemberSearch('');
              setIsMemberDropdownOpen(false);
              setIsTypeDropdownOpen(false);
              setIsModalOpen(true);
            }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={15} /> Record Contribution
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.label} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-footnote font-medium text-secondary-label">{card.label}</p>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${card.well}`}
              >
                <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
              </span>
            </div>
            <p className="mt-2.5 text-title-2 font-semibold leading-tight tabular-nums text-label">
              {card.value}
            </p>
          </article>
        ))}
      </div>

      {/* Breakdown by type */}
      {summaryByType.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChart size={15} className="text-emerald-700 dark:text-system-green" />
            <h3 className="text-headline font-semibold text-label">Breakdown by Type</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {summaryByType.map(([name, amt]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 rounded-xl bg-system-grouped-background/70 px-3 py-2.5 dark:bg-white/[0.03]"
              >
                <span className="min-w-0 truncate text-footnote text-secondary-label">{name}</span>
                <span className="shrink-0 text-footnote font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                  {CURRENCY} {fmt(amt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & filter */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary-label"
            />
            <input
              type="text"
              placeholder="Search by name or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select sm:w-48"
            aria-label="Filter by contribution type"
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator/60 px-5 py-3 dark:border-white/[0.08]">
              <span className="text-footnote text-secondary-label">
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              </span>
              <span className="text-footnote font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                Total: {CURRENCY} {fmt(total)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-separator/60 text-left dark:border-white/[0.08]">
                    <th className="px-5 py-3 text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                      Date
                    </th>
                    <th className="px-5 py-3 text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                      Type
                    </th>
                    <th className="px-5 py-3 text-right text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                      Amount ({CURRENCY})
                    </th>
                    <th className="px-5 py-3 text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                      Method
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-separator/40 transition-colors last:border-0 hover:bg-system-grouped-background/60 dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-footnote tabular-nums text-secondary-label">
                        {c.payment_date}
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge-success">{c.contribution_type_name}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-footnote font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                        {CURRENCY} {fmt(c.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge-neutral">{c.payment_method}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-footnote text-secondary-label"
                      >
                        No contributions yet. Click &ldquo;Record Contribution&rdquo; to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Record Contribution Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-modal animate-scale-in dark:border-white/[0.1]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Record contribution"
          >
            <div className="flex items-center justify-between border-b border-separator/60 px-5 py-4 dark:border-white/[0.08]">
              <h3 className="flex items-center gap-2 text-headline font-semibold text-label">
                <Wallet size={18} className="text-emerald-700 dark:text-system-green" />
                Record Contribution
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
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
                      className="input pl-10 pr-10"
                    />
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary-label">
                      <Search size={16} />
                    </div>
                    {memberSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberSearch('');
                          setForm((f) => ({ ...f, member_id: '' }));
                          setIsMemberDropdownOpen(true);
                        }}
                        className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-tertiary-label hover:bg-system-fill hover:text-label"
                        aria-label="Clear member"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {isMemberDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMemberDropdownOpen(false)}
                      />
                      <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-popover dark:border-white/[0.1]">
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
                                className={`flex w-full items-center justify-between border-b border-separator/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-system-grouped-background dark:border-white/[0.06] dark:hover:bg-white/[0.04] ${
                                  form.member_id === m.id ? 'bg-primary-500/[0.06]' : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-footnote font-semibold text-label">
                                    {m.full_name}
                                  </p>
                                  <p className="mt-0.5 truncate text-caption-1 text-secondary-label">
                                    {m.section_name || 'No Section'}{' '}
                                    {m.leader_name ? `• Leader: ${m.leader_name}` : ''}
                                  </p>
                                </div>
                                <span className="ml-3 shrink-0 font-mono text-caption-1 text-tertiary-label">
                                  #{m.id}
                                </span>
                              </button>
                            ))
                        ) : (
                          <p className="p-3 text-center text-caption-1 italic text-tertiary-label">
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
                    className="input flex items-center justify-between text-left"
                  >
                    <span
                      className={form.contribution_type_id ? 'text-label' : 'text-tertiary-label'}
                    >
                      {types.find((t) => t.id === Number(form.contribution_type_id))?.name ||
                        'Select type...'}
                    </span>
                    <ChevronDown size={16} className="text-tertiary-label" />
                  </button>

                  {isTypeDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsTypeDropdownOpen(false)}
                      />
                      <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-black/[0.08] bg-secondary-system-grouped-background shadow-popover dark:border-white/[0.1]">
                        {typesLoading ? (
                          <p className="p-3 text-center text-caption-1 italic text-tertiary-label">
                            Loading types...
                          </p>
                        ) : types.filter((t) => t.is_active !== 0).length === 0 ? (
                          <p className="p-3 text-center text-caption-1 italic text-tertiary-label">
                            No contribution types found
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
                                className={`flex w-full items-center justify-between border-b border-separator/40 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-system-grouped-background dark:border-white/[0.06] dark:hover:bg-white/[0.04] ${
                                  Number(form.contribution_type_id) === t.id
                                    ? 'bg-primary-500/[0.06] text-primary-700 dark:text-primary-300'
                                    : 'text-label'
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
                    step="1"
                    min="1"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    className="input tabular-nums"
                    placeholder="0"
                  />
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
                    className="select w-full"
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
                    placeholder="e.g. MOMO ref"
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="input resize-none"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Recording...' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
