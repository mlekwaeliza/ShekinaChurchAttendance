import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  ClipboardCheck,
  Heart,
  DollarSign,
  CalendarDays,
  Megaphone,
  UserCheck,
  X
} from 'lucide-react';
import MemberEditModal from '../MemberEditModal';
import { adminAPI } from '../../services/api';

const quickActions = [
  {
    label: 'Register Member',
    icon: UserPlus,
    tint: 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300',
    action: 'member'
  },
  {
    label: 'Record Attendance',
    icon: ClipboardCheck,
    tint: 'bg-system-green/15 text-emerald-700 dark:text-system-green',
    path: '/admin/history'
  },
  {
    label: 'Add Visitor',
    icon: UserCheck,
    tint: 'bg-system-blue/15 text-blue-700 dark:text-system-blue',
    action: 'visitor'
  },
  {
    label: 'Register Soul Won',
    icon: Heart,
    tint: 'bg-system-red/15 text-rose-700 dark:text-system-red',
    path: '/admin/evangelism?subtab=souls'
  },
  {
    label: 'Record Contribution',
    icon: DollarSign,
    tint: 'bg-system-orange/15 text-amber-700 dark:text-system-orange',
    path: '/admin/contributions'
  },
  {
    label: 'Schedule Event',
    icon: CalendarDays,
    tint: 'bg-system-yellow/15 text-amber-700 dark:text-system-yellow',
    path: '/admin/calendar'
  },
  {
    label: 'Make Announcement',
    icon: Megaphone,
    tint: 'bg-system-blue/15 text-blue-700 dark:text-system-blue',
    path: '/admin/announcements'
  }
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
    await adminAPI.createMember(data);
    showMessage?.('Member registered successfully');
    setShowMemberModal(false);
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
      <div className="card p-4">
        <h3 className="mb-3 text-headline font-semibold text-label">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleAction(action)}
                className="focus-ring group flex min-w-0 flex-col items-center gap-2 rounded-xl bg-system-grouped-background/70 p-3 text-center transition-colors duration-200 hover:bg-system-fill dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${action.tint}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-caption-1 font-semibold leading-tight text-label">
                  {action.label}
                </span>
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
            <div className="modal-header">
              <h3 className="text-headline font-semibold text-label">Add Visitor</h3>
              <button
                onClick={() => setShowVisitorModal(false)}
                className="btn-icon btn-ghost"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="input-label">Full Name *</label>
                <input
                  type="text"
                  value={visitorForm.full_name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                  className="input"
                  placeholder="Enter visitor name"
                />
              </div>
              <div>
                <label className="input-label">Phone</label>
                <input
                  type="text"
                  value={visitorForm.phone}
                  onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                  className="input"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input
                  type="email"
                  value={visitorForm.email}
                  onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                  className="input"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="modal-footer">
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
      )}
    </>
  );
};

export default QuickActions;
