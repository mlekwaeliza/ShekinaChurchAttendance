import React, { useState, useEffect, useMemo } from 'react';
import { Search, DollarSign, PieChart, List } from 'lucide-react';
import { contributionAPI } from '../../services/api';

export default function LeaderContributions() {
  const [contributions, setContributions] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [typesRes] = await Promise.all([
        contributionAPI.getTypes()
      ]);
      setTypes(typesRes.data);
    } catch (err) {
      console.error('Failed to load:', err);
    }
    setLoading(false);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Contributions</h2>
        <p className="text-gray-400 text-sm mt-1">View member contribution records</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg"><DollarSign size={20} className="text-green-400" /></div>
            <div>
              <p className="text-xs text-gray-400">Total Contributions</p>
              <p className="text-xl font-bold text-green-400">GH¢{total.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg"><List size={20} className="text-blue-400" /></div>
            <div>
              <p className="text-xs text-gray-400">Records</p>
              <p className="text-xl font-bold">{filtered.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg"><PieChart size={20} className="text-purple-400" /></div>
            <div>
              <p className="text-xs text-gray-400">Types</p>
              <p className="text-xl font-bold">{summaryByType.length}</p>
            </div>
          </div>
        </div>
      </div>

      {summaryByType.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Breakdown by Type</h3>
          <div className="space-y-2">
            {summaryByType.map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm">{name}</span>
                <span className="text-sm font-medium text-green-400">GH¢{amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-3 py-2 bg-gray-700 rounded w-full text-sm" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-sm">
            <option value="">All Types</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4">{c.payment_date}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">{c.contribution_type_name}</span></td>
                  <td className="py-3 px-4 text-green-400 font-medium">GH¢{c.amount?.toFixed(2)}</td>
                  <td className="py-3 px-4 text-gray-400">{c.payment_method}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-500">No contributions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
