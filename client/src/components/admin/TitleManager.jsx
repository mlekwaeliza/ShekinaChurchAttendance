import React, { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, Award, ChevronUp, ChevronDown, Filter, X, Download, Check, CheckSquare } from 'lucide-react';
import { adminAPI } from '../../services/api';
import Modal from '../ui/Modal';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';

const emptyForm = { name: '', description: '', sort_order: 0, is_active: true };

const TitleManager = ({ showMessage }) => {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState(''); // '', 'active', 'inactive'
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  const loadTitles = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.getTitles(params);
      setTitles(res.data || []);
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to load titles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTitles(); }, [statusFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (title) => {
    setForm({ name: title.name, description: title.description || '', sort_order: title.sort_order || 0, is_active: !!title.is_active });
    setEditingId(title.id);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await adminAPI.updateTitle(editingId, form);
        showMessage?.('Title updated');
      } else {
        await adminAPI.createTitle(form);
        showMessage?.('Title created');
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

  const toggleSelectAll = () => {
    if (selectedIds.size === titles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(titles.map((t) => t.id)));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    try {
      if (action === 'activate' || action === 'deactivate') {
        const updates = Array.from(selectedIds).map((id) =>
          adminAPI.updateTitle(id, { is_active: action === 'activate' })
        );
        await Promise.all(updates);
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

  const handleExport = () => {
    const headers = ['ID', 'Name', 'Description', 'Sort Order', 'Status', 'Created At'];
    const rows = titles.map((t) => [
      t.id,
      t.name,
      t.description || '',
      t.sort_order || 0,
      t.is_active ? 'Active' : 'Inactive',
      t.created_at || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `titles-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const columns = [
    { accessor: 'id', header: '', width: '40px', render: (row) => (
      <input
        type="checkbox"
        checked={selectedIds.has(row.id)}
        onChange={() => toggleSelect(row.id)}
        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      />
    )},
    { accessor: 'name', header: 'Title', sortable: true },
    { accessor: 'description', header: 'Description', sortable: true },
    { accessor: 'sort_order', header: 'Order', sortable: true, width: '80px' },
    {
      accessor: 'is_active',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'} className="text-[11px]">
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessor: 'created_at',
      header: 'Created',
      width: '160px',
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '—',
    },
    {
      accessor: 'actions',
      header: 'Actions',
      width: '90px',
      render: (row) => (
        <div className="flex gap-2 justify-center">
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => setDeletingId(row.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="gradient-banner mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Congregation Titles</h1>
            <p className="text-sm text-white/80">Manage titles and positions (Pastor, Usher, Worship Leader, etc.)</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Title
          </button>
          <button onClick={handleExport} className="btn-secondary inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-auto text-sm h-9 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
            <button onClick={() => setSelectedIds(new Set())} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={titles}
        searchable
        searchKeys={['name', 'description']}
        emptyIcon={Award}
        emptyTitle="No titles yet"
        emptyDescription="Create your first congregation title to get started."
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Title' : 'Add Title'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="input-label">Title Name *</label>
            <input
              type="text"
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Pastor, Usher, Worship Leader"
              required
            />
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea
              className="input-field"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this title"
              rows={3}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="input-label">Sort Order</label>
              <input
                type="number"
                className="input-field"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div className="flex-1">
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
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title="Delete Title" size="sm">
        <p className="text-slate-600 mb-6">Are you sure you want to delete this title? Members assigned this title will lose it.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeletingId(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => handleDelete(deletingId)} className="btn-danger flex-1">Delete</button>
        </div>
      </Modal>
    </div>
  );
};

export default TitleManager;
