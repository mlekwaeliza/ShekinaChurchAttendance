import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Home, Users, UserCheck, Settings,
  Plus, UserPlus, HelpCircle
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import HCDashboard from './home-cells/HCDashboard';
import HCList from './home-cells/HCList';
import HCMembersPage from './home-cells/HCMembersPage';
import HCLeadersPage from './home-cells/HCLeadersPage';
import HCSettings from './home-cells/HCSettings';
import HCCreateModal from './home-cells/HCCreateModal';
import HCAddMemberModal from './home-cells/HCAddMemberModal';

const HomeCellModule = ({ leaders = [], allMembers: propAllMembers = [] }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [fetchedMembers, setFetchedMembers] = useState([]);

  // Fetch the full members list directly so the leaders assignment panel
  // is always populated regardless of parent prop timing or empty arrays.
  useEffect(() => {
    adminAPI.getMembers()
      .then(res => setFetchedMembers(res.data || []))
      .catch(() => {});
  }, []);

  // Prefer freshly-fetched list; fall back to prop if fetch hasn't resolved yet
  const allMembers = useMemo(
    () => (fetchedMembers.length > 0 ? fetchedMembers : propAllMembers),
    [fetchedMembers, propAllMembers]
  );

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [defaultCellId, setDefaultCellId] = useState(null);

  const toast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadCells = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getHomeCells();
      setCells(res.data || []);
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to load home cells data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCells();
  }, [loadCells]);

  const handleCreateCell = () => {
    setEditingCell(null);
    setIsCreateOpen(true);
  };

  const handleEditCell = (cell) => {
    setEditingCell(cell);
    setIsCreateOpen(true);
  };

  const handleDeleteCell = async (cell) => {
    if (!window.confirm(`Are you sure you want to delete ${cell.name}? This will permanently remove all leader and member assignments for this cell.`)) {
      return;
    }
    try {
      await adminAPI.deleteHomeCell(cell.id);
      toast(`Deleted home cell ${cell.name}`);
      loadCells();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to delete home cell');
    }
  };

  const handleAddMember = (cellId = null) => {
    setDefaultCellId(cellId);
    setIsAddMemberOpen(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <HCDashboard
            cells={cells}
            onNavigate={setActiveTab}
            onCreateCell={handleCreateCell}
            onAddMember={() => handleAddMember(null)}
          />
        );
      case 'cells':
        return (
          <HCList
            cells={cells}
            allLeaders={allMembers}
            loading={loading}
            onRefresh={loadCells}
            onCreateCell={handleCreateCell}
            onEditCell={handleEditCell}
            onDeleteCell={handleDeleteCell}
            onAddMember={handleAddMember}
          />
        );
      case 'members':
        return (
          <HCMembersPage
            cells={cells}
            onRefresh={loadCells}
          />
        );
      case 'leaders':
        return (
          <HCLeadersPage
            cells={cells}
            allLeaders={allMembers}
          />
        );
      case 'settings':
        return (
          <HCSettings
            cells={cells}
            onRefresh={loadCells}
          />
        );
      default:
        return null;
    }
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'cells', label: 'Home Cells', icon: Home },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'leaders', label: 'Cell Leaders', icon: UserCheck },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className="toast-success mb-2">
          <span>{message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === t.key
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div>
        {renderContent()}
      </div>

      {/* Create/Edit Cell Modal */}
      <HCCreateModal
        isOpen={isCreateOpen}
        cell={editingCell}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          toast(editingCell ? 'Home cell updated' : 'Home cell created');
          loadCells();
        }}
      />

      {/* Add Member Modal */}
      <HCAddMemberModal
        isOpen={isAddMemberOpen}
        cells={cells}
        allMembers={allMembers}
        defaultCellId={defaultCellId}
        onClose={() => setIsAddMemberOpen(false)}
        onSaved={() => {
          toast('Member assigned successfully');
          loadCells();
        }}
      />
    </div>
  );
};

export default HomeCellModule;
