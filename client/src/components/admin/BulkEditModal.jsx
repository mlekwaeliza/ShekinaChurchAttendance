import React, { useState } from 'react';
import { X, Users, Check } from 'lucide-react';
import { adminAPI } from '../../services/api';

const BulkEditModal = ({ members, sections, leaders, onClose, onRefresh }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetSection, setTargetSection] = useState('');
  const [targetLeader, setTargetLeader] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.membership_id.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map(m => m.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (selectedIds.length === 0 || !targetSection || !targetLeader) return;
    setSaving(true);
    try {
      await adminAPI.bulkUpdateMembers(selectedIds, targetSection, targetLeader);
      onRefresh();
      onClose();
    } catch (e) {
      console.error('Bulk update failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bulk Edit Members</h3>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="modal-body space-y-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Search members..."
          />

          {/* Member Selection */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={selectedIds.length === filteredMembers.length && filteredMembers.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedIds.length} selected
              </span>
            </div>
            {filteredMembers.map(m => (
              <label
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b border-slate-50 dark:border-slate-700/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggleOne(m.id)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-900 dark:text-slate-100">{m.full_name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{m.membership_id}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{m.section_name}</span>
              </label>
            ))}
          </div>

          {/* Target Section & Leader */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Move to Section</label>
              <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)} className="select">
                <option value="">Select section...</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Assign to Leader</label>
              <select
                value={targetLeader}
                onChange={(e) => setTargetLeader(e.target.value)}
                className="select"
                disabled={!targetSection}
              >
                <option value="">Select leader...</option>
                {leaders.filter(l => !targetSection || l.section_id === parseInt(targetSection)).map(l => (
                  <option key={l.id} value={l.id}>{l.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0 || !targetSection || !targetLeader}
            className="btn-primary"
          >
            {saving ? 'Saving...' : <><Check className="w-4 h-4" /> Update {selectedIds.length} Members</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;
