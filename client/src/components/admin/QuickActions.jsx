import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ClipboardCheck, Heart, DollarSign, CalendarDays, Megaphone, UserCheck, X } from 'lucide-react';
import MemberEditModal from '../MemberEditModal';
import { adminAPI } from '../../services/api';

const quickActions = [
  { label: 'Register Member', icon: UserPlus, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20', action: 'member' },
  { label: 'Record Attendance', icon: ClipboardCheck, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20', path: '/admin/history' },
  { label: 'Add Visitor', icon: UserCheck, color: 'from-blue-500 to-cyan-600', shadow: 'shadow-blue-500/20', action: 'visitor' },
  { label: 'Register Soul Won', icon: Heart, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20', path: '/admin/evangelism?subtab=souls' },
  { label: 'Record Contribution', icon: DollarSign, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20', path: '/admin/contributions' },
  { label: 'Schedule Event', icon: CalendarDays, color: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20', path: '/admin/calendar' },
  { label: 'Make Announcement', icon: Megaphone, color: 'from-pink-500 to-rose-600', shadow: 'shadow-pink-500/20', path: '/admin/announcements' },
];

const QuickActions = ({ sections = [], leaders = [], showMessage }) => {
  const navigate = useNavigate();
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState({ full_name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const handleAction = (action) => {
    if (action.action === 'member') {
      setShowMemberModal(true);
    } else if (action.action === 'visitor') {
      setShowVisitorModal(true);
    } else if (action.path) {
      navigate(action.path);
    }
  };

  const handleSaveMember = async (memberId, data) => {
    try {
      await adminAPI.createMember(data);
      showMessage?.('Member registered successfully');
      setShowMemberModal(false);
    } catch (error) {
      throw error;
    }
  };

  const handleSaveVisitor = async () => {
    if (!visitorForm.full_name.trim()) return;
    setSaving(true);
    try {
      await adminAPI.createVisitor(visitorForm);
      showMessage?.('Visitor added successfully');
      setShowVisitorModal(false);
      setVisitorForm({ full_name: '', phone: '', email: '' });
    } catch (error) {
      showMessage?.('Failed to add visitor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleAction(action)}
                className={`group flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br ${action.color} ${action.shadow} text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0`}
              >
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Member Registration Modal */}
      <MemberEditModal
        isOpen={showMemberModal}
        member={null}
        mode="add"
        sections={sections}
        leaders={leaders}
        onClose={() => setShowMemberModal(false)}
        onSave={handleSaveMember}
      />

      {/* Visitor Modal */}
      {showVisitorModal && (
        <div className="modal-overlay" onClick={() => setShowVisitorModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add Visitor</h3>
                <button onClick={() => setShowVisitorModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="input-label">Full Name *</label>
                  <input
                    type="text"
                    value={visitorForm.full_name}
                    onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                    className="input w-full"
                    placeholder="Enter visitor name"
                  />
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input
                    type="text"
                    value={visitorForm.phone}
                    onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                    className="input w-full"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    value={visitorForm.email}
                    onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                    className="input w-full"
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowVisitorModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSaveVisitor}
                  disabled={!visitorForm.full_name.trim() || saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Saving...' : 'Add Visitor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickActions;