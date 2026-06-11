import React, { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, Award, ChevronUp, ChevronDown } from 'lucide-react';
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

  const columns = [
    { accessor: 'name', header: 'Title', sortable: true },
    { accessor: 'description', header: 'Description', sortable: true },
    { accessor: 'sort_order', header: 'Order', sortable: true },
    {
      accessor: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessor: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
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

      <div className="mb-4">
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Title
        </button>
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
