import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import useAdminData from '../hooks/useAdminData';
import { useBreadcrumbs } from '../context/BreadcrumbContext';
import MemberEditModal from '../components/MemberEditModal';

// Admin sub-views
import DashboardOverview from '../components/admin/DashboardOverview';
import MemberDirectory from '../components/admin/MemberDirectory';
import LeaderDirectory from '../components/admin/LeaderDirectory';
import AttendanceReports from '../components/admin/AttendanceReports';
import SubmissionHistory from '../components/admin/SubmissionHistory';
import AnalyticsView from '../components/admin/AnalyticsView';
import RewardsView from '../components/admin/RewardsView';
import SettingsView from '../components/admin/SettingsView';
import LeaderDrilldown from '../components/admin/LeaderDrilldown';
import SectionManagement from '../components/admin/SectionManagement';
import LeaderEditModal from '../components/admin/LeaderEditModal';
import AuditLog from '../components/admin/AuditLog';
import BirthdayModule from '../components/admin/BirthdayModule';
import ServiceAssignmentsModal from '../components/admin/ServiceAssignmentsModal';
import AnnouncementCenter from '../components/admin/AnnouncementCenter';
import FollowUpsView from '../components/admin/FollowUpsView';
import VisitorIntake from '../components/admin/VisitorIntake';
import AttendanceCorrections from '../components/admin/AttendanceCorrections';
import ChurchCalendar from '../components/ChurchCalendar';
import HomeCellsView from '../components/admin/HomeCellsView';
import TitleManager from '../components/admin/TitleManager';
import LeadershipDirectory from '../components/admin/LeadershipDirectory';
import DepartmentsView from '../components/admin/DepartmentsView';
import NewMemberLeaderView from '../components/admin/NewMemberLeaderView';

import { CheckCircle2, AlertTriangle, X, ShieldAlert } from 'lucide-react';

const AdminDashboard = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'dashboard';
  const { user } = useAuth();
  const data = useAdminData();
  const { setCrumbs, clearCrumbs } = useBreadcrumbs();

  // Handle Dynamic Breadcrumbs for Sections
  React.useEffect(() => {
    if (activeTab === 'leaders' && data.leaderSectionFilter) {
      setCrumbs([
        { label: data.leaderSectionFilter, path: `/admin/leaders`, icon: 'Layers' }
      ]);
    } else {
      clearCrumbs();
    }
    
    return () => clearCrumbs();
  }, [activeTab, data.leaderSectionFilter, setCrumbs, clearCrumbs]);

  // Member modal state
  const [editingMember, setEditingMember] = useState(null);
  const [memberMode, setMemberMode] = useState('edit');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Member CRUD handlers
  const handleEditClick = (member) => {
    setEditingMember(member);
    setMemberMode('edit');
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingMember(null);
    setMemberMode('add');
    setIsModalOpen(true);
  };

  const handleSaveMember = async (memberId, updatedData) => {
    try {
      if (memberMode === 'edit') {
        await adminAPI.updateMember(memberId, updatedData);
        data.showMessage('Member updated successfully');
      } else {
        await adminAPI.createMember(updatedData);
        data.showMessage('Member added successfully');
      }
      data.loadCoreData();
    } catch (error) {
      alert(`Failed to save: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  };

  const handleDeleteClick = (member) => {
    setDeletingMember(member);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    setDeleteLoading(true);
    try {
      await adminAPI.deleteMember(deletingMember.id);
      data.loadCoreData();
      data.showMessage('Member deleted successfully');
      setShowDeleteConfirm(false);
    } catch (error) {
      alert(`Failed to delete: ${error.response?.data?.error || error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewLeaders = (sectionName) => {
    data.setLeaderSectionFilter(sectionName);
    navigate('/admin/leaders');
  };

  const handleViewMembers = (sectionName) => {
    data.setMemberSectionFilter(sectionName);
    navigate('/admin/members');
  };

  const handleViewMembersOfLeader = (leader) => {
    data.setMemberSectionFilter(leader.section_name);
    data.setMemberLeaderFilter(leader.full_name);
    navigate('/admin/members');
  };

  // Tab-to-component mapping
  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardOverview
            allMembers={data.allMembers}
            sections={data.sections}
            leaders={data.leaders}
            pastorName={user?.full_name}
            dashboardMetrics={data.dashboardMetrics}
            metricsLoading={data.metricsLoading}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.setSelectedServiceId}
            onRefresh={data.loadDashboardMetrics}
            onAssignDutyRoster={(date) => {
              data.setSelectedInstanceDate(date);
              data.loadServiceInstance(date, data.selectedServiceId);
              data.setIsAssignmentModalOpen(true);
            }}
            lastUpdated={data.lastUpdated}
          />
        );

      case 'sections':
        return (
          <SectionManagement
            sections={data.sections}
            allMembers={data.allMembers}
            leaders={data.leaders}
            editingSection={data.editingSection}
            setEditingSection={data.setEditingSection}
            isSectionModalOpen={data.isSectionModalOpen}
            setIsSectionModalOpen={data.setIsSectionModalOpen}
            deletingSection={data.deletingSection}
            setDeletingSection={data.setDeletingSection}
            sectionSaving={data.sectionSaving}
            onSave={data.handleSectionSave}
            onDelete={data.handleSectionDelete}
            onViewLeaders={handleViewLeaders}
            onViewMembers={handleViewMembers}
            loading={data.loading}
          />
        );

      case 'members':
        return (
          <MemberDirectory
            allMembers={data.allMembers}
            sections={data.sections}
            leaders={data.leaders}
            sectionFilter={data.memberSectionFilter}
            onSectionFilterChange={data.setMemberSectionFilter}
            leaderFilter={data.memberLeaderFilter}
            onLeaderFilterChange={data.setMemberLeaderFilter}
            onEdit={handleEditClick}
            onAdd={handleAddClick}
            onDelete={handleDeleteClick}
            onRefresh={data.loadCoreData}
            loading={data.loading}
          />
        );

      case 'leaders':
        return (
          <LeaderDirectory
            leaders={data.leaders}
            leadersLoading={data.leadersLoading}
            allMembers={data.allMembers}
            sections={data.sections}
            sectionFilter={data.leaderSectionFilter}
            setSectionFilter={data.setLeaderSectionFilter}
            onViewAnalytics={data.openLeaderDashboard}
            onViewMembers={handleViewMembersOfLeader}
            onAdd={() => { data.setEditingLeader(null); data.setIsLeaderModalOpen(true); }}
            onEdit={(leader) => { data.setEditingLeader(leader); data.setIsLeaderModalOpen(true); }}
            onDelete={(leader) => data.setDeletingLeader(leader)}
          />
        );

      case 'home-cells':
        return <HomeCellsView leaders={data.leaders} allMembers={data.allMembers} />;

      case 'titles':
        return <TitleManager showMessage={data.showMessage} />;

      case 'leadership':
        return <LeadershipDirectory />;

      case 'departments':
        return <DepartmentsView allMembers={data.allMembers} showMessage={data.showMessage} />;

      case 'new-members':
        return <NewMemberLeaderView />;

      case 'reports':
        return (
          <AttendanceReports
            filterType={data.filterType}
            setFilterType={data.setFilterType}
            filterValue={data.filterValue}
            setFilterValue={data.setFilterValue}
            overviewData={data.overviewData}
            overviewLoading={data.overviewLoading}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.setSelectedServiceId}
            loadOverview={data.loadOverview}
            onLeaderClick={data.openLeaderDashboard}
          />
        );

      case 'calendar':
        return <ChurchCalendar />;

      case 'history':
        return (
          <SubmissionHistory
            history={data.history}
            historyLoading={data.historyLoading}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.setSelectedServiceId}
            loadHistory={data.loadHistory}
          />
        );

      case 'analytics':
        return (
          <AnalyticsView
            trends={data.trends}
            trendsLoading={data.trendsLoading}
            loadTrends={data.loadTrends}
          />
        );

      case 'rewards':
        return (
          <RewardsView
            rewardsYear={data.rewardsYear}
            setRewardsYear={data.setRewardsYear}
            rewardsMode={data.rewardsMode}
            setRewardsMode={data.setRewardsMode}
            rewardsWeek={data.rewardsWeek}
            setRewardsWeek={data.setRewardsWeek}
            topMembers={data.topMembers}
            topLeaders={data.topLeaders}
            rewardsLoading={data.rewardsLoading}
            loadRewards={data.loadRewards}
          />
        );

      case 'settings':
        return (
          <SettingsView
            leaders={data.leaders}
            loadCoreData={data.loadCoreData}
            loadLeaders={data.loadLeaders}
            showMessage={data.showMessage}
          />
        );

      case 'audit':
        return <AuditLog />;

      case 'attendance-corrections':
        return <AttendanceCorrections showMessage={data.showMessage} />;

      case 'birthdays':
        return <BirthdayModule />;

      case 'announcements':
        return (
          <AnnouncementCenter
            sections={data.sections}
            leaders={data.leaders}
            showMessage={data.showMessage}
          />
        );

      case 'follow-ups':
        return (
          <FollowUpsView
            dashboardMetrics={data.dashboardMetrics}
            leaders={data.leaders}
            allMembers={data.allMembers}
            showMessage={data.showMessage}
          />
        );

      case 'visitors':
        return (
          <VisitorIntake
            sections={data.sections}
            showMessage={data.showMessage}
          />
        );

      default:
        return (
          <DashboardOverview
            allMembers={data.allMembers}
            sections={data.sections}
            leaders={data.leaders}
            dashboardMetrics={data.dashboardMetrics}
            metricsLoading={data.metricsLoading}
            serviceTypes={data.serviceTypes}
            selectedServiceId={data.selectedServiceId}
            onServiceChange={data.setSelectedServiceId}
            onRefresh={data.loadDashboardMetrics}
          />
        );
    }
  };

  return (
    <>
      {/* Toast Message */}
      {data.message && (
        <div className="toast-success mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{data.message}</span>
        </div>
      )}

      {/* Active Tab Content */}
      {renderTab()}

      {/* Leader Drilldown */}
      <LeaderDrilldown
        drilldownData={data.drilldownData}
        onClose={() => data.setDrilldownData(null)}
      />

      {/* Member Edit Modal */}
      <MemberEditModal
        isOpen={isModalOpen}
        member={editingMember}
        mode={memberMode}
        sections={data.sections}
        leaders={data.leaders}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
      />

      {/* Leader Edit Modal */}
      <LeaderEditModal
        isOpen={data.isLeaderModalOpen}
        leader={data.editingLeader}
        sections={data.sections}
        loading={data.leaderSaving}
        onClose={() => data.setIsLeaderModalOpen(false)}
        onSave={data.handleLeaderSave}
      />

      {/* Delete Leader Confirmation */}
      {data.deletingLeader && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm text-center">
            <div className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
                <ShieldAlert className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Remove Leader?</h3>
              <p className="text-sm text-slate-500 mb-8">
                Are you sure you want to remove <strong className="text-slate-800">{data.deletingLeader.full_name}</strong>?
                <br /><small className="text-rose-600 font-medium mt-1 inline-block">This will also deactivate their login account.</small>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => data.setDeletingLeader(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={data.handleLeaderDelete}
                  disabled={data.leaderSaving}
                  className="btn-danger flex-1"
                >
                  {data.leaderSaving ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && deletingMember && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm text-center">
            <div className="p-8">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Member?</h3>
              <p className="text-sm text-slate-500 mb-8">
                This action cannot be undone. Are you sure you want to remove{' '}
                <strong className="text-slate-800">{deletingMember.full_name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  className="btn-danger flex-1"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Assignments Modal */}
      <ServiceAssignmentsModal
        isOpen={data.isAssignmentModalOpen}
        onClose={() => data.setIsAssignmentModalOpen(false)}
        selectedDate={data.selectedInstanceDate}
        selectedServiceId={data.selectedServiceId}
        serviceTypes={data.serviceTypes}
        leaders={data.leaders}
        sections={data.sections}
        assignedLeaderIds={data.assignedLeaderIds}
        onSave={data.handleSaveServiceAssignments}
        loading={data.assignmentsLoading}
      />
    </>
  );
};

export default AdminDashboard;
