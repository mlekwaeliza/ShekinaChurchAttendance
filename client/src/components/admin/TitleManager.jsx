import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit3, Trash2, Award, ChevronDown, Check, X, GitBranch, Layers, Shield, Users2 } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Modal from '../ui/Modal';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

const CATEGORIES = [
  'Pastoral & Spiritual Care',
  'Small Groups & Discipleship',
  'Operations & Administration',
  'Ministry Support',
  'General',
];

const CATEGORY_COLORS = {
  'Pastoral & Spiritual Care': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  'Small Groups & Discipleship': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Operations & Administration': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Ministry Support': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'General': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
};

const CATEGORY_ICONS = {
  'Pastoral & Spiritual Care': Shield,
  'Small Groups & Discipleship': Users2,
  'Operations & Administration': Layers,
  'Ministry Support': Award,
  'General': Award,
};

const emptyForm = {
  name: '',
  description: '',
  category: 'Pastoral & Spiritual Care',
  sort_order: 0,
  reports_to_title_id: '',
  is_active: true,
};

const TitleManager = ({ showMessage }) => {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'

  const loadTitles = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getTitles();
      setTitles(res.data || []);
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to load titles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTitles(); }, []);

  const filteredTitles = useMemo(() => {
    let list = titles;
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter);
    if (statusFilter === 'active') list = list.filter(t => t.is_active);
    if (statusFilter === 'inactive') list = list.filter(t => !t.is_active);
    return list;
  }, [titles, categoryFilter, statusFilter]);

  const groupedTitles = useMemo(() => {
    const groups = {};
    filteredTitles.forEach(t => {
      const cat = t.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [filteredTitles]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (title) => {
    setForm({
      name: title.name,
      description: title.description || '',
      category: title.category || 'General',
      sort_order: title.sort_order || 0,
      reports_to_title_id: title.reports_to_title_id || '',
      is_active: !!title.is_active,
    });
    setEditingId(title.id);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        reports_to_title_id: form.reports_to_title_id || null,
      };
      if (editingId) {
        await adminAPI.updateTitle(editingId, payload);
        showMessage?.('Title updated successfully');
      } else {
        await adminAPI.createTitle(payload);
        showMessage?.('Title created successfully');
      }
      setIsModalOpen(false);
      await loadTitles();
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to save title');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteTitle(id);
      showMessage?.('Title deleted');
      setDeletingId(null);
      await loadTitles();
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to delete title');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    try {
      if (action === 'activate' || action === 'deactivate') {
        await Promise.all(Array.from(selectedIds).map((id) =>
          adminAPI.updateTitle(id, { ...titles.find(t => t.id === id), is_active: action === 'activate' })
        ));
        showMessage?.(`${selectedIds.size} title${selectedIds.size > 1 ? 's' : ''} ${action}d`);
      } else if (action === 'delete') {
        await Promise.all(Array.from(selectedIds).map((id) => adminAPI.deleteTitle(id)));
        showMessage?.(`${selectedIds.size} title${selectedIds.size > 1 ? 's' : ''} deleted`);
      }
      setSelectedIds(new Set());
      setBulkActionOpen(false);
      await loadTitles();
    } catch (err) {
      showMessage?.(err.response?.data?.error || `Failed to ${action} titles`);
    }
  };

  const columns = [
    {
      accessor: 'id',
      header: '',
      width: '40px',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
      ),
    },
    { accessor: 'name', header: 'Title Name', sortable: true },
    {
      accessor: 'category',
      header: 'Category',
      sortable: true,
      render: (row) => {
        const cat = row.category || 'General';
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['General']}`}>
            {cat}
          </span>
        );
      },
    },
    {
      accessor: 'reports_to_title_name',
      header: 'Reports To',
      sortable: true,
      render: (row) => row.reports_to_title_name
        ? <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-sm"><GitBranch className="w-3 h-3 text-slate-400" />{row.reports_to_title_name}</span>
        : <span className="text-slate-400 text-xs italic">Top Level</span>,
    },
    { accessor: 'description', header: 'Description', sortable: true, render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{row.description || '—'}</span> },
    {
      accessor: 'is_active',
      header: 'Status',
      width: '90px',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'} className="text-[11px]">
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessor: 'actions',
      header: '',
      width: '80px',
      render: (row) => (
        <div className="flex gap-1 justify-center">
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => setDeletingId(row.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-rose-600 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Banner */}
      <div className="gradient-banner mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Congregation Titles & Roles</h1>
            <p className="text-sm text-white/80">Manage pastoral titles, ministry roles, and leadership hierarchy</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full">{titles.filter(t => t.is_active).length} Active</span>
          </div>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat];
          const count = titles.filter(t => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(prev => prev === cat ? '' : cat)}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${
                categoryFilter === cat
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300 hover:shadow-sm'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${CATEGORY_COLORS[cat]}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{cat}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Title
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-auto text-sm h-9 rounded-lg"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="select w-auto text-sm h-9 rounded-lg"
          >
            <option value="grouped">Grouped by Category</option>
            <option value="flat">All Titles (Flat)</option>
          </select>
          {(categoryFilter || statusFilter) && (
            <button onClick={() => { setCategoryFilter(''); setStatusFilter(''); }} className="btn-ghost text-sm flex items-center gap-1 text-rose-500">
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50 rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {selectedIds.size} selected
            </span>
            <div className="relative">
              <button
                onClick={() => setBulkActionOpen(!bulkActionOpen)}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                Bulk Actions <ChevronDown className="w-3 h-3" />
              </button>
              {bulkActionOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button onClick={() => handleBulkAction('activate')} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Check className="w-3.5 h-3.5 inline mr-2 text-emerald-500" /> Activate
                  </button>
                  <button onClick={() => handleBulkAction('deactivate')} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Check className="w-3.5 h-3.5 inline mr-2 text-slate-400" /> Deactivate
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  <button onClick={() => handleBulkAction('delete')} className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                    <Trash2 className="w-3.5 h-3.5 inline mr-2" /> Delete
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">Clear</button>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'grouped' ? (
        <div className="space-y-6">
          {Object.keys(groupedTitles).length === 0 && !loading && (
            <div className="text-center py-16 text-slate-400">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No titles found</p>
              <p className="text-sm mt-1">Adjust your filters or create a new title</p>
            </div>
          )}
          {Object.entries(groupedTitles).map(([cat, catTitles]) => {
            const Icon = CATEGORY_ICONS[cat] || Award;
            return (
              <div key={cat} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className={`flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700 ${CATEGORY_COLORS[cat]}`}>
                  <Icon className="w-4 h-4" />
                  <h3 className="font-semibold text-sm">{cat}</h3>
                  <span className="ml-auto text-xs font-medium opacity-70">{catTitles.length} title{catTitles.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {catTitles.map(title => (
                    <div key={title.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(title.id)}
                        onChange={() => toggleSelect(title.id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 dark:text-white">{title.name}</span>
                          {!title.is_active && <Badge variant="neutral" className="text-[10px]">Inactive</Badge>}
                          {title.reports_to_title_name && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <GitBranch className="w-3 h-3" /> {title.reports_to_title_name}
                            </span>
                          )}
                        </div>
                        {title.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{title.description}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(title)} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletingId(title.id)} className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredTitles}
          searchable
          searchKeys={['name', 'description', 'category']}
          emptyIcon={Award}
          emptyTitle="No titles yet"
          emptyDescription="Create your first congregation title to get started."
        />
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Title' : 'Add New Title'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="input-label">Title Name *</label>
              <input
                type="text"
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lead Pastor, Youth Pastor"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">Category</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="input-label">Reports To (Parent Title)</label>
              <select
                className="input-field"
                value={form.reports_to_title_id}
                onChange={(e) => setForm({ ...form, reports_to_title_id: e.target.value })}
              >
                <option value="">— Top Level (no parent) —</option>
                {titles.filter(t => t.id !== editingId).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Defines where this title sits in the reporting hierarchy.</p>
            </div>
            <div className="col-span-2">
              <label className="input-label">Description</label>
              <textarea
                className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this role's responsibilities"
                rows={2}
              />
            </div>
            <div>
              <label className="input-label">Sort Order</label>
              <input
                type="number"
                className="input-field"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div>
              <label className="input-label">Status</label>
              <select
                className="input-field"
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex-1">
              {saving ? 'Saving...' : editingId ? 'Update Title' : 'Create Title'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title="Delete Title" size="sm">
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Are you sure you want to delete this title? Members currently assigned this title will lose it.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeletingId(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => handleDelete(deletingId)} className="btn-danger flex-1">Delete Title</button>
        </div>
      </Modal>
    </div>
  );
};

export default TitleManager;
