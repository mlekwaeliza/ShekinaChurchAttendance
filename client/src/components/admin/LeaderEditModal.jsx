import React, { useState, useEffect } from 'react';
import { UserCog, AtSign, Phone, Mail, Layout, X, Shield } from 'lucide-react';
import Modal from '../ui/Modal';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

const LeaderEditModal = ({ isOpen, onClose, onSave, leader, sections, loading }) => {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    section_id: '',
    phone: '',
    email: '',
    is_head: false,
  });

  useEffect(() => {
    if (leader) {
      setFormData({
        username: leader.username || '',
        full_name: leader.full_name || '',
        section_id: leader.section_id || (sections.find(s => s.name === leader.section_name)?.id || ''),
        phone: leader.phone || '',
        email: leader.email || '',
        is_head: leader.is_head === 1,
      });
    } else {
      setFormData({
        username: '',
        full_name: '',
        section_id: '',
        phone: '',
        email: '',
        is_head: false,
      });
    }
  }, [leader, sections, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave(formData);
    } catch (err) {
      // Error handled in parent hook
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'full_name') finalValue = capitalizeName(finalValue);
    if (name === 'phone') finalValue = handlePhoneChange(finalValue);
    setFormData(prev => ({ 
      ...prev, 
      [name]: finalValue 
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={leader ? 'Edit Leader' : 'Add New Leader'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="input-label">Full Name</label>
            <div className="relative">
              <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                required
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                onPaste={e => { e.preventDefault(); setFormData(prev => ({ ...prev, full_name: capitalizeName(e.clipboardData.getData('text')) })); }}
                placeholder="e.g. John Doe"
                className="input pl-10"
              />
            </div>
          </div>

          {/* Username (Only for Add Mode, or display in Edit Mode) */}
          <div>
            <label className="input-label">Username (Login)</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                required
                disabled={!!leader}
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. jdoe_leader"
                className="input pl-10 disabled:bg-slate-50 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400"
              />
            </div>
            {!leader && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Used for system login. Permanent once set.</p>}
          </div>

          {/* Section */}
          <div>
            <label className="input-label">Section Assignment</label>
            <div className="relative">
              <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <select
                required
                name="section_id"
                value={formData.section_id}
                onChange={handleChange}
                className="input pl-10 appearance-none"
              >
                <option value="">Select Section</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="input-label">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: handlePhoneChange(e.target.value) }))}
                placeholder="+255 XXX XXX XXX"
                className="input pl-10"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="input-label">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. john@example.com"
                className="input pl-10"
              />
            </div>
          </div>

          {/* Section Head Toggle */}
          <div className="md:col-span-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  name="is_head"
                  checked={formData.is_head}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  Designate as Section Head
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Section heads have primary oversight of all sub-leaders in their section.
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary min-w-[100px] justify-center"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              leader ? 'Update Leader' : 'Create Leader'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaderEditModal;
