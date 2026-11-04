import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCog,
  Search,
  ChevronRight,
  ShieldCheck,
  Clock,
  X,
  GitBranch,
  Award
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import StatCard from '../ui/StatCard';
import { fdatetime } from '../../utils/date';

const emptyForm = {
  name: '',
  description: '',
  reports_to_title_id: '',
  leader_id: '',
  assistant_leader_id: '',
  secretary_id: '',
  is_active: true
};

const DepartmentsView = ({ allMembers = [], showMessage }) => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'chart'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deletingDept, setDeletingDept] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Detail Drawer state
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDept, setDetailDept] = useState(null);
  const [deptMembers, setDeptMembers] = useState([]);
  const [deptHistory, setDeptHistory] = useState([]);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'members' | 'history'

  // Member additions
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFocused, setMemberFocused] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const memberSearchRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getDepartments();
      setDepartments(res.data.departments || []);
      setTitles(res.data.titles || []);
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDepartmentDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await adminAPI.getDepartment(id);
      setDetailDept(res.data.department);
      setDeptMembers(res.data.members || []);
      setDeptHistory(res.data.history || []);
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to load department details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeptId && detailModalOpen) {
      loadDepartmentDetail(selectedDeptId);
    }
  }, [selectedDeptId, detailModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alphabetically sorted members list for dropdowns
  const sortedMembers = useMemo(() => {
    return [...allMembers].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allMembers]);

  // Filtered members for search autocomplete
  const filteredMembers = useMemo(() => {
    const addedIds = new Set(deptMembers.map((m) => m.member_id));
    if (!memberSearch.trim()) return sortedMembers.filter((m) => !addedIds.has(m.id)).slice(0, 20);
    const term = memberSearch.toLowerCase();
    return sortedMembers
      .filter((m) => !addedIds.has(m.id) && (m.full_name || '').toLowerCase().includes(term))
      .slice(0, 20);
  }, [memberSearch, sortedMembers, deptMembers]);

  // Filtered departments list
  const filteredDepartments = useMemo(() => {
    let list = departments;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (d) =>
          (d.name || '').toLowerCase().includes(term) ||
          (d.description || '').toLowerCase().includes(term) ||
          (d.reports_to_title_name || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [departments, searchTerm]);

  // selectedAddMember placed after sortedMembers to avoid TDZ
  const selectedAddMember = useMemo(
    () => sortedMembers.find((m) => Number(m.id) === Number(selectedMemberToAdd)),
    [sortedMembers, selectedMemberToAdd]
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target)) {
        setShowMemberDropdown(false);
        setMemberFocused(false);
        if (!selectedMemberToAdd) setMemberSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedMemberToAdd]);

  // Stats calculation
  const totalMembersInDepts = useMemo(() => {
    return departments.reduce((acc, curr) => acc + Number(curr.member_count || 0), 0);
  }, [departments]);

  const activeDeptCount = useMemo(() => {
    return departments.filter((d) => d.is_active).length;
  }, [departments]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setForm({
      name: dept.name,
      description: dept.description || '',
      reports_to_title_id: dept.reports_to_title_id || '',
      leader_id: dept.leader_id || '',
      assistant_leader_id: dept.assistant_leader_id || '',
      secretary_id: dept.secretary_id || '',
      is_active: dept.is_active === 1 || dept.is_active === true
    });
    setEditingId(dept.id);
    setIsFormModalOpen(true);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        reports_to_title_id: form.reports_to_title_id ? parseInt(form.reports_to_title_id) : null,
        leader_id: form.leader_id ? parseInt(form.leader_id) : null,
        assistant_leader_id: form.assistant_leader_id ? parseInt(form.assistant_leader_id) : null,
        secretary_id: form.secretary_id ? parseInt(form.secretary_id) : null,
        is_active: form.is_active
      };

      if (editingId) {
        await adminAPI.updateDepartment(editingId, payload);
        showMessage?.('Department updated successfully');
      } else {
        await adminAPI.createDepartment(payload);
        showMessage?.('Department created successfully');
      }
      setIsFormModalOpen(false);
      await loadData();
      if (selectedDeptId && selectedDeptId === editingId) {
        await loadDepartmentDetail(selectedDeptId);
      }
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (dept) => {
    setDeletingDept(dept);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    try {
      await adminAPI.deleteDepartment(deletingDept.id);
      showMessage?.('Department deleted successfully');
      setDeletingDept(null);
      if (selectedDeptId === deletingDept.id) {
        setDetailModalOpen(false);
        setSelectedDeptId(null);
      }
      await loadData();
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMemberToAdd || !selectedDeptId) return;

    // Check if already a member
    if (deptMembers.some((m) => m.member_id === parseInt(selectedMemberToAdd))) {
      showMessage?.('Member is already in this department');
      return;
    }

    setAddingMember(true);
    try {
      await adminAPI.addDepartmentMember(selectedDeptId, parseInt(selectedMemberToAdd));
      showMessage?.('Member added to department');
      setSelectedMemberToAdd('');
      await loadDepartmentDetail(selectedDeptId);
      await loadData(); // Reload for member counts
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedDeptId) return;
    try {
      await adminAPI.removeDepartmentMember(selectedDeptId, memberId);
      showMessage?.('Member removed from department');
      await loadDepartmentDetail(selectedDeptId);
      await loadData(); // Reload for member counts
    } catch (err) {
      showMessage?.(err.response?.data?.error || 'Failed to remove member');
    }
  };

  // Build Hierarchical Org Chart Data
  const orgChartHierarchy = useMemo(() => {
    // 1. Filter out pastoral titles (usually under category 'Pastoral & Spiritual Care' or matching common pastor names)
    // 2. Map departments under their reporting pastor titles.

    // Build reporting lines
    const titleMap = {};
    titles.forEach((t) => {
      titleMap[t.id] = { ...t, children: [], departments: [] };
    });

    departments.forEach((d) => {
      if (d.reports_to_title_id && titleMap[d.reports_to_title_id]) {
        titleMap[d.reports_to_title_id].departments.push(d);
      }
    });

    const roots = [];
    titles.forEach((t) => {
      const node = titleMap[t.id];
      if (t.reports_to_title_id && titleMap[t.reports_to_title_id]) {
        titleMap[t.reports_to_title_id].children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort roots and child nodes to put Head Pastor at the top
    const sortNodes = (nodes) => {
      return nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    };

    return sortNodes(roots);
  }, [titles, departments]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <section className="product-surface relative overflow-hidden px-5 py-6 sm:px-7">
        <div className="relative flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-title-2 font-semibold text-label">
                {t('departments.title')} &amp; {t('nav.items.departments')} Teams
              </h1>
              <p className="mt-1 text-subheadline text-secondary-label">
                {loading
                  ? t('common.loading')
                  : `${departments.length} ${t('departments.totalDepartments').toLowerCase()} · ${totalMembersInDepts} ${t('common.active').toLowerCase()}`}
              </p>
            </div>
          </div>

          <div className="tab-pills shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('grid')}
              aria-pressed={activeTab === 'grid'}
              className="tab-pill focus-ring shrink-0"
            >
              Directory
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              aria-pressed={activeTab === 'chart'}
              className="tab-pill focus-ring shrink-0"
            >
              Org Chart
            </button>
          </div>
        </div>
      </section>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Departments"
          value={departments.length}
          variant="default"
        />
        <StatCard
          icon={ShieldCheck}
          label="Active Departments"
          value={activeDeptCount}
          variant="success"
        />
        <StatCard icon={Users} label="Total Listings" value={totalMembersInDepts} variant="info" />
        <StatCard
          icon={UserCog}
          label="Leaders Appointed"
          value={departments.filter((d) => d.leader_id).length}
          variant="warning"
        />
      </div>

      {activeTab === 'grid' ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="card flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-tertiary-label" />
              <input
                type="text"
                placeholder="Search department, description or pastor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 pr-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-tertiary-label transition-colors hover:bg-system-fill hover:text-label"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button onClick={handleOpenCreate} className="btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          {/* Department Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card flex h-64 animate-pulse flex-col p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-[10px] bg-system-fill" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-system-fill" />
                      <div className="h-3 w-20 rounded bg-system-fill" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-full rounded bg-system-fill" />
                    <div className="h-3 w-5/6 rounded bg-system-fill" />
                  </div>
                  <div className="h-9 w-full rounded-xl bg-system-fill" />
                </div>
              ))}
            </div>
          ) : filteredDepartments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((dept) => {
                return (
                  <div
                    key={dept.id}
                    onClick={() => {
                      setSelectedDeptId(dept.id);
                      setDetailTab('overview');
                      setDetailModalOpen(true);
                    }}
                    className="group card flex cursor-pointer flex-col transition-shadow duration-200 hover:shadow-card-hover"
                  >
                    {/* Card Content */}
                    <div className="flex flex-1 flex-col space-y-4 p-5">
                      {/* Name & Reports to */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1.5">
                          <h3 className="truncate text-headline font-semibold text-label transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-300">
                            {dept.name}
                          </h3>
                          {dept.reports_to_title_name ? (
                            <Badge variant="info" className="text-caption-2">
                              Reports to: {dept.reports_to_title_name}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-caption-2">
                              Independent
                            </Badge>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {dept.is_active === 0 || dept.is_active === false ? (
                            <Badge variant="neutral">Inactive</Badge>
                          ) : null}
                          <Badge variant="success" icon={Users}>
                            {dept.member_count || 0}
                          </Badge>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="line-clamp-2 flex-1 text-footnote leading-relaxed text-secondary-label">
                        {dept.description || 'No description provided.'}
                      </p>

                      {/* Leadership roles brief */}
                      <div className="space-y-2 rounded-xl bg-system-grouped-background/70 p-3 dark:bg-white/[0.03]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption-1 font-medium text-secondary-label">
                            Leader
                          </span>
                          <span className="max-w-[150px] truncate text-footnote font-semibold text-label">
                            {dept.leader_name || (
                              <span className="font-medium text-secondary-label">Unassigned</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption-1 font-medium text-secondary-label">
                            Assistant Leader
                          </span>
                          <span className="max-w-[150px] truncate text-footnote font-semibold text-label">
                            {dept.assistant_leader_name || (
                              <span className="font-medium text-secondary-label">Unassigned</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption-1 font-medium text-secondary-label">
                            Secretary
                          </span>
                          <span className="max-w-[150px] truncate text-footnote font-semibold text-label">
                            {dept.secretary_name || (
                              <span className="font-medium text-secondary-label">Unassigned</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between border-t border-separator/60 bg-system-grouped-background/70 px-5 py-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                    >
                      <button
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          setDetailTab('overview');
                          setDetailModalOpen(true);
                        }}
                        className="focus-ring inline-flex items-center gap-1 rounded-md text-caption-1 font-semibold text-primary-700 transition-colors hover:text-primary-800 group/more dark:text-primary-300"
                      >
                        <span>Manage &amp; Members</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/more:translate-x-0.5" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(dept)}
                          className="btn-icon focus-ring rounded-lg text-secondary-label transition-colors hover:bg-system-fill hover:text-primary-700 dark:hover:text-primary-300"
                          title="Edit department settings"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(dept)}
                          className="btn-icon focus-ring rounded-lg text-secondary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 dark:hover:text-system-red"
                          title="Delete Department"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card mx-auto mt-6 flex max-w-lg flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-fill text-secondary-label">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="empty-state-title mb-1">No Departments Found</h3>
              <p className="empty-state-desc mb-6">
                {searchTerm
                  ? 'No departments match your search filter.'
                  : 'Create a department or ministry team to get started.'}
              </p>
              <button onClick={handleOpenCreate} className="btn-primary px-5">
                Create Department
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Org Chart Tab */
        <div className="card overflow-x-auto p-6">
          <div className="min-w-[900px] space-y-12 py-4">
            <h2 className="mb-8 flex items-center justify-center gap-2 text-center text-title-3 font-semibold text-label">
              <GitBranch className="w-5 h-5 text-primary-700 dark:text-primary-300" />
              <span>Leadership &amp; Reporting Hierarchy Structure</span>
            </h2>

            {/* Tree Root */}
            {orgChartHierarchy.length > 0 ? (
              <div className="space-y-12">
                {orgChartHierarchy.map((rootNode) => (
                  <div key={rootNode.id} className="flex flex-col items-center">
                    {/* Pastor Node */}
                    <div className="relative z-10 w-72 max-w-sm rounded-2xl bg-primary-600 p-4 text-center text-white shadow-card">
                      <Award className="mx-auto mb-1 w-6 h-6 text-white/80" />
                      <h4 className="text-headline font-semibold leading-tight">{rootNode.name}</h4>
                      <p className="mt-1 text-footnote font-medium text-white/70">
                        {rootNode.description || 'Spiritual oversight'}
                      </p>
                    </div>

                    {/* Root level departments directly under head pastor */}
                    {rootNode.departments.length > 0 && (
                      <div className="relative mt-8 flex w-full flex-col items-center">
                        <div className="h-8 w-0.5 bg-separator dark:bg-white/[0.12]" />
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 justify-center">
                          {rootNode.departments.map((dept) => (
                            <div
                              key={dept.id}
                              onClick={() => {
                                setSelectedDeptId(dept.id);
                                setDetailTab('overview');
                                setDetailModalOpen(true);
                              }}
                              className="focus-ring flex w-48 cursor-pointer flex-col justify-between rounded-xl border border-separator/60 bg-system-grouped-background/70 p-3 text-center shadow-sm transition-colors hover:bg-system-fill dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary-label">
                                Department
                              </span>
                              <h5 className="mt-1 truncate text-subheadline font-semibold text-label">
                                {dept.name}
                              </h5>
                              <p className="mt-1 truncate text-caption-2 text-secondary-label">
                                Leader: {dept.leader_name || 'Unassigned'}
                              </p>
                              <div className="mt-2 text-caption-1 font-semibold tabular-nums text-primary-700 dark:text-primary-300">
                                {dept.member_count || 0} members
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Children nodes (Subordinate Pastors) */}
                    {rootNode.children.length > 0 && (
                      <div className="relative mt-8 flex w-full flex-col items-center">
                        {/* Connector line down */}
                        <div className="h-8 w-0.5 bg-separator dark:bg-white/[0.12]" />

                        <div className="mt-4 flex items-start gap-12">
                          {rootNode.children.map((child) => (
                            <div key={child.id} className="flex flex-col items-center">
                              {/* Sub-Pastor Node */}
                              <div className="relative z-10 w-64 max-w-sm rounded-2xl border border-separator/60 bg-secondary-system-grouped-background p-4 text-center shadow-card dark:border-white/[0.1] dark:bg-tertiary-system-background">
                                <Award className="mx-auto mb-1 w-5 h-5 text-primary-700 dark:text-primary-300" />
                                <h4 className="text-headline font-semibold leading-tight text-label">
                                  {child.name}
                                </h4>
                                <span className="mt-1 inline-block rounded-full bg-system-fill px-2.5 py-0.5 text-caption-2 font-semibold text-secondary-label">
                                  {child.category}
                                </span>
                              </div>

                              {/* Departments reporting to this child pastor */}
                              {child.departments.length > 0 ? (
                                <div className="relative mt-6 flex w-full flex-col items-center">
                                  <div className="h-6 w-0.5 bg-separator dark:bg-white/[0.12]" />
                                  <div className="mt-2 flex w-full flex-col items-center gap-2">
                                    {child.departments.map((dept) => (
                                      <div
                                        key={dept.id}
                                        onClick={() => {
                                          setSelectedDeptId(dept.id);
                                          setDetailTab('overview');
                                          setDetailModalOpen(true);
                                        }}
                                        className="focus-ring w-48 cursor-pointer rounded-xl border border-separator/60 bg-system-grouped-background/70 p-3 text-center shadow-sm transition-colors hover:bg-system-fill dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                                      >
                                        <h5 className="truncate text-footnote font-semibold text-label">
                                          {dept.name}
                                        </h5>
                                        <p className="mt-0.5 truncate text-caption-2 text-secondary-label">
                                          Leader: {dept.leader_name || 'Unassigned'}
                                        </p>
                                        <div className="mt-1.5 inline-block rounded-full bg-primary-500/[0.12] px-2.5 py-0.5 text-caption-2 font-semibold tabular-nums text-primary-700 dark:text-primary-300">
                                          {dept.member_count || 0} Members
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-6 text-[10px] italic text-tertiary-label">
                                  No departments report here
                                </div>
                              )}

                              {/* Recursion for grandchildren pastors if they exist */}
                              {child.children.length > 0 && (
                                <div className="relative mt-6 flex flex-col items-center">
                                  <div className="h-6 w-0.5 bg-separator dark:bg-white/[0.12]" />
                                  <div className="mt-2 flex gap-4">
                                    {child.children.map((grand) => (
                                      <div
                                        key={grand.id}
                                        className="w-48 rounded-xl border border-separator/60 bg-system-grouped-background/70 p-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
                                      >
                                        <h6 className="text-caption-1 font-semibold text-label">
                                          {grand.name}
                                        </h6>
                                        <p className="mt-1 text-[10px] text-tertiary-label">
                                          {grand.departments.length} departments report
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-footnote italic text-secondary-label">
                No reporting pastor titles available. Define them under Titles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Department' : 'Create New Department'}
        subtitle={
          editingId
            ? 'Update department metadata and direct reporting lines.'
            : 'Register a new department or ministry team.'
        }
        size="md"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="input-label">Department Name</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 w-[18px] h-[18px] -translate-y-1/2 text-tertiary-label" />
                <input
                  required
                  type="text"
                  placeholder="e.g. Youth Department, Prayer Ministry"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input pl-11"
                  autoFocus
                />
              </div>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="input-label">Description / Vision</label>
              <textarea
                rows={3}
                placeholder="Brief summary of department responsibilities or vision statement..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
              />
            </div>

            {/* Reports to title */}
            <div className="md:col-span-2">
              <label className="input-label">Reports to Pastor / Title</label>
              <div className="relative">
                <Award className="pointer-events-none absolute left-3.5 top-1/2 w-[18px] h-[18px] -translate-y-1/2 text-tertiary-label" />
                <select
                  value={form.reports_to_title_id}
                  onChange={(e) => setForm({ ...form, reports_to_title_id: e.target.value })}
                  className="select pl-11"
                >
                  <option value="">-- No Direct Pastoral Report (Independent) --</option>
                  {titles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Leader assignment */}
            <div>
              <label className="input-label">Department Leader</label>
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-3.5 top-1/2 w-[18px] h-[18px] -translate-y-1/2 text-tertiary-label" />
                <select
                  value={form.leader_id}
                  onChange={(e) => setForm({ ...form, leader_id: e.target.value })}
                  className="select pl-11"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assistant Leader assignment */}
            <div>
              <label className="input-label">Assistant Leader</label>
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-3.5 top-1/2 w-[18px] h-[18px] -translate-y-1/2 text-tertiary-label" />
                <select
                  value={form.assistant_leader_id}
                  onChange={(e) => setForm({ ...form, assistant_leader_id: e.target.value })}
                  className="select pl-11"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secretary assignment */}
            <div className="md:col-span-2">
              <label className="input-label">Department Secretary</label>
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-3.5 top-1/2 w-[18px] h-[18px] -translate-y-1/2 text-tertiary-label" />
                <select
                  value={form.secretary_id}
                  onChange={(e) => setForm({ ...form, secretary_id: e.target.value })}
                  className="select pl-11"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status toggle */}
            <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-separator/60 bg-system-grouped-background/70 px-4 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <input
                id="dept-active-toggle"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 accent-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
              />
              <label
                htmlFor="dept-active-toggle"
                className="cursor-pointer text-subheadline font-semibold text-label"
              >
                Department is active and operating
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-separator/60 pt-4">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary min-w-[120px] justify-center"
            >
              {saving ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : editingId ? (
                'Save Changes'
              ) : (
                'Create Department'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL MODAL DRAWER */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedDeptId(null);
          setDetailDept(null);
          setDeptMembers([]);
          setDeptHistory([]);
          setMemberSearch('');
          setSelectedMemberToAdd('');
          setShowMemberDropdown(false);
        }}
        title={detailDept ? detailDept.name : 'Loading...'}
        subtitle={
          detailDept &&
          (detailDept.reports_to_title_name
            ? `Reports to: ${detailDept.reports_to_title_name}`
            : 'Independent ministry team')
        }
        size="lg"
      >
        {detailLoading || !detailDept ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <p className="text-footnote font-medium text-secondary-label">
              Retrieving members and audit logs...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="tab-pills overflow-x-auto">
              <button
                onClick={() => setDetailTab('overview')}
                aria-pressed={detailTab === 'overview'}
                className="tab-pill focus-ring shrink-0"
              >
                Overview &amp; Leadership
              </button>
              <button
                onClick={() => setDetailTab('members')}
                aria-pressed={detailTab === 'members'}
                className="tab-pill focus-ring inline-flex shrink-0 items-center gap-1.5"
              >
                <span>Members List</span>
                <Badge variant="neutral" className="text-caption-2">
                  {deptMembers.length}
                </Badge>
              </button>
              <button
                onClick={() => setDetailTab('history')}
                aria-pressed={detailTab === 'history'}
                className="tab-pill focus-ring inline-flex shrink-0 items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
              </button>
            </div>

            {/* Overview Tab Content */}
            {detailTab === 'overview' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="section-eyebrow">Vision Statement / Description</h4>
                  <p className="rounded-xl bg-system-grouped-background/70 p-4 text-subheadline leading-relaxed text-label dark:bg-white/[0.03]">
                    {detailDept.description ||
                      'No vision statement registered for this department.'}
                  </p>
                </div>

                {/* Main Leadership Officers */}
                <div className="space-y-3">
                  <h4 className="section-eyebrow">Assigned Officers</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Leader Card */}
                    <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-separator/50 bg-system-grouped-background/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
                          <UserCog className="w-4 h-4" />
                        </span>
                        <span className="text-caption-1 font-medium text-secondary-label">
                          Department Leader
                        </span>
                      </div>
                      <p className="mt-3 truncate text-headline font-semibold text-label">
                        {detailDept.leader_name || 'Unassigned'}
                      </p>
                    </div>

                    {/* Assistant Leader Card */}
                    <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-separator/50 bg-system-grouped-background/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-system-blue/15 text-blue-700 dark:text-system-blue">
                          <Users className="w-4 h-4" />
                        </span>
                        <span className="text-caption-1 font-medium text-secondary-label">
                          Assistant Leader
                        </span>
                      </div>
                      <p className="mt-3 truncate text-headline font-semibold text-label">
                        {detailDept.assistant_leader_name || 'Unassigned'}
                      </p>
                    </div>

                    {/* Secretary Card */}
                    <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-separator/50 bg-system-grouped-background/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-system-orange/15 text-amber-700 dark:text-system-orange">
                          <Award className="w-4 h-4" />
                        </span>
                        <span className="text-caption-1 font-medium text-secondary-label">
                          Secretary
                        </span>
                      </div>
                      <p className="mt-3 truncate text-headline font-semibold text-label">
                        {detailDept.secretary_name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-separator/60 pt-4">
                  <button
                    onClick={() => handleOpenEdit(detailDept)}
                    className="btn-secondary inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Department Info</span>
                  </button>
                </div>
              </div>
            )}

            {/* Members Tab Content */}
            {detailTab === 'members' && (
              <div className="space-y-6">
                {/* Add Member Form */}
                <form
                  onSubmit={handleAddMemberSubmit}
                  className="flex flex-col items-end gap-3 rounded-2xl border border-separator/60 bg-system-grouped-background/70 p-4 sm:flex-row dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="relative w-full flex-1" ref={memberSearchRef}>
                    <label className="input-label">Add Member to Department</label>
                    <input
                      required
                      type="text"
                      value={
                        memberFocused
                          ? memberSearch
                          : selectedAddMember
                            ? selectedAddMember.full_name
                            : memberSearch
                      }
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setShowMemberDropdown(true);
                        if (selectedMemberToAdd) setSelectedMemberToAdd('');
                      }}
                      onFocus={() => {
                        setMemberFocused(true);
                        setShowMemberDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setMemberFocused(false);
                          if (!selectedMemberToAdd) setMemberSearch('');
                        }, 200);
                      }}
                      placeholder="Search member name..."
                      className="input"
                    />
                    {showMemberDropdown && filteredMembers.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background shadow-card animate-fade-in dark:border-white/[0.08]">
                        {filteredMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberToAdd(String(m.id));
                              setMemberSearch('');
                              setMemberFocused(false);
                              setShowMemberDropdown(false);
                            }}
                            className={`focus-ring flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                              Number(m.id) === Number(selectedMemberToAdd)
                                ? 'bg-primary-500/[0.12] text-primary-700 dark:text-primary-300'
                                : 'text-label hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/[0.12] text-caption-1 font-semibold text-primary-700 dark:text-primary-300">
                              {(m.full_name || '')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <span className="truncate font-medium">{m.full_name}</span>
                            {m.section_name && (
                              <span className="ml-auto shrink-0 text-caption-2 text-tertiary-label">
                                {m.section_name}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {memberFocused &&
                      !selectedMemberToAdd &&
                      !showMemberDropdown &&
                      memberSearch.trim() && (
                        <p className="mt-1 text-caption-1 text-rose-700 dark:text-system-red">
                          Please select a member from the list
                        </p>
                      )}
                  </div>
                  <button
                    type="submit"
                    disabled={addingMember || !selectedMemberToAdd}
                    className="btn-primary flex w-full items-center justify-center gap-1.5 px-5 sm:w-auto"
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </form>

                {/* Members List */}
                <div className="space-y-3">
                  <h4 className="section-eyebrow">
                    Registered Department Members ({deptMembers.length})
                  </h4>
                  {deptMembers.length > 0 ? (
                    <div className="max-h-80 divide-y divide-separator/50 overflow-hidden overflow-y-auto rounded-2xl border border-separator/60 bg-secondary-system-grouped-background dark:divide-white/[0.08] dark:border-white/[0.08]">
                      {deptMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3.5 transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/[0.12] text-footnote font-semibold text-primary-700 dark:text-primary-300">
                              {member.member_name
                                ? member.member_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()
                                : '?'}
                            </div>
                            <div>
                              <h5 className="text-subheadline font-semibold text-label">
                                {member.member_name}
                              </h5>
                              <p className="text-caption-1 text-secondary-label">
                                {member.member_section || 'No Section'} · Joined{' '}
                                {fdatetime(member.joined_at)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.member_id)}
                            className="focus-ring flex items-center gap-1 rounded-lg p-1.5 text-caption-1 font-medium text-secondary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 dark:hover:text-system-red"
                            title="Remove member from department"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-separator bg-system-grouped-background/50 py-10 text-center dark:bg-white/[0.02]">
                      <Users className="mx-auto mb-2 w-8 h-8 text-tertiary-label" />
                      <p className="text-footnote text-secondary-label">
                        No general members in this department yet.
                      </p>
                      <p className="mt-1 text-caption-1 text-tertiary-label">
                        Use the search box above to add members.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* History / Audit Log Tab */}
            {detailTab === 'history' && (
              <div className="space-y-4">
                <h4 className="section-eyebrow">Department Operations &amp; Leadership History</h4>
                {deptHistory.length > 0 ? (
                  <div className="relative ml-3.5 max-h-80 space-y-6 overflow-y-auto border-l border-separator py-2 pl-6 dark:border-white/[0.1]">
                    {deptHistory.map((log) => (
                      <div key={log.id} className="relative">
                        {/* Dot indicator */}
                        <span className="absolute top-1 -left-[31px] flex h-4 w-4 items-center justify-center rounded-full border border-separator bg-system-fill ring-4 ring-secondary-system-grouped-background">
                          <Clock className="w-2.5 h-2.5 text-tertiary-label" />
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-caption-1 font-semibold text-label capitalize">
                              {log.entity_type.replace('_', ' ')} {log.action}
                            </span>
                            <span className="text-caption-2 text-secondary-label">
                              {fdatetime(log.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-footnote text-secondary-label">{log.details}</p>
                          {log.operator_name && (
                            <p className="mt-0.5 text-caption-1 text-secondary-label">
                              Action by: <span className="font-semibold">{log.operator_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-separator bg-system-grouped-background/50 py-10 text-center dark:bg-white/[0.02]">
                    <Clock className="mx-auto mb-2 w-8 h-8 text-tertiary-label" />
                    <p className="text-footnote text-secondary-label">
                      No actions recorded for this department yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={!!deletingDept} onClose={() => setDeletingDept(null)} size="sm">
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-red/15 text-rose-700 dark:text-system-red">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="mb-2 text-title-3 font-semibold text-label">Delete Department?</h3>
          <p className="mb-6 px-2 text-subheadline text-secondary-label">
            Are you sure you want to permanently delete the{' '}
            <strong className="font-semibold text-label">{deletingDept?.name}</strong> department?
            This will remove all department memberships and history record logs.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeletingDept(null)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleConfirmDelete} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting...' : 'Delete Department'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DepartmentsView;
