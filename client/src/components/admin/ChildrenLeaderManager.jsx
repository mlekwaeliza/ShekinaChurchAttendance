import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import {
  Plus, Pencil, Trash2, KeyRound, ShieldCheck, CheckCircle, XCircle
} from 'lucide-react';

export default function ChildrenLeaderManager({ showMessage }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    phone: '',
    email: '',
    is_head: false
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      const res = await adminAPI.childrenLeaders.getLeaders();
      setLeaders(res.data);
    } catch (err) {
      console.error('Failed to load children leaders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLeader) {
        await adminAPI.childrenLeaders.updateLeader(editingLeader.id, formData);
        showMessage('Children leader updated successfully');
      } else {
        await adminAPI.childrenLeaders.createLeader(formData);
        showMessage('Children leader created successfully');
      }
      setShowModal(false);
      setEditingLeader(null);
      setFormData({ username: '', full_name: '', phone: '', email: '', is_head: false });
      loadLeaders();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to save leader', 'error');
    }
  };

  const handleDelete = async (leader) => {
    try {
      await adminAPI.childrenLeaders.deleteLeader(leader.id, { confirm: 'DELETE' });
      showMessage('Children leader deleted successfully');
      setDeleteConfirm(null);
      loadLeaders();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete leader', 'error');
    }
  };

  const handleResetPassword = async (leader) => {
    try {
      const res = await adminAPI.childrenLeaders.resetPassword(leader.id);
      showMessage(`Password reset link generated. Expires: ${new Date(res.data.expires_at).toLocaleString()}`);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to reset password', 'error');
    }
  };

  const openEditModal = (leader) => {
    setEditingLeader(leader);
    setFormData({
      username: leader.username,
      full_name: leader.full_name,
      phone: leader.phone || '',
      email: leader.leader_email || leader.email || '',
      is_head: !!leader.is_head
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingLeader(null);
    setFormData({ username: '', full_name: '', phone: '', email: '', is_head: false });
    setShowModal(true);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="children-leader-manager">
      <div className="section-header">
        <h2><ShieldCheck size={20} /> Children's Ministry Leaders</h2>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Add Leader
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Head</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map(leader => (
              <tr key={leader.id}>
                <td>{leader.full_name}</td>
                <td>{leader.username}</td>
                <td>{leader.email || leader.leader_email || '—'}</td>
                <td>{leader.phone || '—'}</td>
                <td>
                  {leader.is_head ? (
                    <span className="badge badge-success"><CheckCircle size={14} /> Yes</span>
                  ) : (
                    <span className="badge badge-secondary"><XCircle size={14} /> No</span>
                  )}
                </td>
                <td>
                  {leader.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-warning">Inactive</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(leader)} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleResetPassword(leader)} title="Reset Password">
                      <KeyRound size={14} />
                    </button>
                    {deleteConfirm === leader.id ? (
                      <>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(leader)}>Confirm</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(leader.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {leaders.length === 0 && (
              <tr><td colSpan="7" className="text-center">No children's ministry leaders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingLeader ? 'Edit' : 'Add'} Children's Ministry Leader</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              {!editingLeader && (
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_head}
                    onChange={(e) => setFormData({ ...formData, is_head: e.target.checked })}
                  />
                  Head of Children's Ministry
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLeader ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
