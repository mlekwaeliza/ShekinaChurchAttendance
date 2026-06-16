import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, Plus, Pencil, Trash2, Users, UserCog, Search, ChevronRight, 
  ArrowRight, ShieldCheck, Clock, Check, X, Info, GitBranch, Shield, 
  MapPin, Phone, Mail, Award
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';

const cardGradients = [
  { bg: 'from-blue-500 to-indigo-600', light: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700/50', text: 'text-blue-600 dark:text-blue-400', shadow: 'shadow-blue-500/10' },
  { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700/50', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'shadow-emerald-500/10' },
  { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700/50', text: 'text-violet-600 dark:text-violet-400', shadow: 'shadow-violet-500/10' },
  { bg: 'from-amber-500 to-orange-600', light: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700/50', text: 'text-amber-600 dark:text-amber-400', shadow: 'shadow-amber-500/10' },
  { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700/50', text: 'text-rose-600 dark:text-rose-400', shadow: 'shadow-rose-500/10' },
  { bg: 'from-sky-500 to-cyan-600', light: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700/50', text: 'text-sky-600 dark:text-sky-400', shadow: 'shadow-sky-500/10' },
];

const emptyForm = {
  name: '',
  description: '',
  reports_to_title_id: '',
  leader_id: '',
  assistant_leader_id: '',
  secretary_id: '',
  is_active: true,
};

const DepartmentsView = ({ allMembers = [], showMessage }) => {
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
  const selectedAddMember = useMemo(() => sortedMembers.find((m) => Number(m.id) === Number(selectedMemberToAdd)), [sortedMembers, selectedMemberToAdd]);

  // filteredMembers moved below sortedMembers to avoid TDZ

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
  }, []);

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
  }, [selectedDeptId, detailModalOpen]);

  // Alphabetically sorted members list for dropdowns
  const sortedMembers = useMemo(() => {
    return [...allMembers].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allMembers]);

  // Filtered members for search autocomplete
  const filteredMembers = useMemo(() => {
    const addedIds = new Set(deptMembers.map(m => m.member_id));
    if (!memberSearch.trim()) return sortedMembers.filter((m) => !addedIds.has(m.id)).slice(0, 20);
    const term = memberSearch.toLowerCase();
    return sortedMembers.filter(
      m => !addedIds.has(m.id) && (m.full_name || '').toLowerCase().includes(term)
    ).slice(0, 20);
  }, [memberSearch, sortedMembers, deptMembers]);

  // Filtered departments list
  const filteredDepartments = useMemo(() => {
    let list = departments;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(d => 
        (d.name || '').toLowerCase().includes(term) || 
        (d.description || '').toLowerCase().includes(term) ||
        (d.reports_to_title_name || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [departments, searchTerm]);

  // Stats calculation
  const totalMembersInDepts = useMemo(() => {
    return departments.reduce((acc, curr) => acc + (curr.member_count || 0), 0);
  }, [departments]);

  const activeDeptCount = useMemo(() => {
    return departments.filter(d => d.is_active).length;
  }, [departments]);

  // Helper to resolve member names
  const getMemberName = (id) => {
    if (!id) return '';
    const m = allMembers.find(mem => mem.id === id);
    return m ? m.full_name : `ID: ${id}`;
  };

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
      is_active: dept.is_active === 1 || dept.is_active === true,
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
        is_active: form.is_active,
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
    if (deptMembers.some(m => m.member_id === parseInt(selectedMemberToAdd))) {
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
    const pastoralTitles = titles.filter(t => t.category === 'Pastoral & Spiritual Care' || t.name.toLowerCase().includes('pastor') || t.name.toLowerCase().includes('elder'));
    
    // Build reporting lines
    const titleMap = {};
    titles.forEach(t => {
      titleMap[t.id] = { ...t, children: [], departments: [] };
    });

    departments.forEach(d => {
      if (d.reports_to_title_id && titleMap[d.reports_to_title_id]) {
        titleMap[d.reports_to_title_id].departments.push(d);
      }
    });

    const roots = [];
    titles.forEach(t => {
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
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 p-6 text-white shadow-xl shadow-emerald-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Departments & Ministry Teams</h1>
              <p className="text-sm text-teal-50/90 font-medium mt-0.5">
                {loading ? 'Loading ministries...' : `${departments.length} departments · ${totalMembersInDepts} active listings`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('grid')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'grid' 
                  ? 'bg-white text-teal-800 shadow-md' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Directory
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === 'chart' 
                  ? 'bg-white text-teal-800 shadow-md' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Org Chart
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Departments</span>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{departments.length}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Departments</span>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{activeDeptCount}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Listings</span>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalMembersInDepts}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leaders Appointed</span>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {departments.filter(d => d.leader_id).length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <UserCog className="w-5 h-5" />
          </div>
        </div>
      </div>

      {activeTab === 'grid' ? (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search department, description or pastor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 rounded-xl w-full h-11"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={handleOpenCreate}
              className="btn-primary rounded-xl h-11 w-full sm:w-auto px-5 font-semibold shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Add Department</span>
            </button>
          </div>

          {/* Department Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 h-64 animate-pulse flex flex-col p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 bg-slate-100 dark:bg-slate-700 rounded" />
                      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-9 w-full bg-slate-100 dark:bg-slate-700 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredDepartments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((dept, index) => {
                const colors = cardGradients[index % cardGradients.length];
                return (
                  <div 
                    key={dept.id} 
                    onClick={() => {
                      setSelectedDeptId(dept.id);
                      setDetailTab('overview');
                      setDetailModalOpen(true);
                    }}
                    className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col overflow-hidden relative"
                  >
                    {/* Top colored accent bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${colors.bg}`} />
                    
                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col space-y-4">
                      {/* Name & Reports to */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {dept.name}
                          </h3>
                          {dept.reports_to_title_name ? (
                            <Badge variant="info" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                              Reports to: {dept.reports_to_title_name}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                              Independent
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {dept.is_active === 0 || dept.is_active === false ? (
                            <Badge variant="neutral" className="text-[10px] font-bold px-2 py-0.5">Inactive</Badge>
                          ) : null}
                          <Badge variant="success" className="text-[11px] font-bold px-2 py-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{dept.member_count || 0}</span>
                          </Badge>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1">
                        {dept.description || 'No description provided.'}
                      </p>

                      {/* Leadership roles brief */}
                      <div className="bg-slate-50/60 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800/40 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Leader</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold max-w-[150px] truncate">
                            {dept.leader_name || <span className="text-slate-400 font-normal">Unassigned</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Assistant Leader</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold max-w-[150px] truncate">
                            {dept.assistant_leader_name || <span className="text-slate-400 font-normal">Unassigned</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Secretary</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold max-w-[150px] truncate">
                            {dept.secretary_name || <span className="text-slate-400 font-normal">Unassigned</span>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between"
                    >
                      <button
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          setDetailTab('overview');
                          setDetailModalOpen(true);
                        }}
                        className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors flex items-center gap-1 group/more"
                      >
                        <span>Manage & Members</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/more:translate-x-0.5 transition-transform" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(dept)}
                          className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-all"
                          title="Edit department settings"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(dept)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
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
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto mt-6">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 shadow-inner">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">No Departments Found</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                {searchTerm ? 'No departments match your search filter.' : 'Create a department or ministry team to get started.'}
              </p>
              <button 
                onClick={handleOpenCreate}
                className="btn-primary rounded-xl px-5 h-11"
              >
                Create Department
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Org Chart Tab */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700 p-6 shadow-sm overflow-x-auto">
          <div className="min-w-[900px] py-4 space-y-12">
            <h2 className="text-center font-bold text-slate-800 dark:text-slate-100 text-lg mb-8 flex items-center justify-center gap-2">
              <GitBranch className="w-5 h-5 text-teal-600" />
              <span>Leadership & Reporting Hierarchy Structure</span>
            </h2>

            {/* Tree Root */}
            {orgChartHierarchy.length > 0 ? (
              <div className="space-y-12">
                {orgChartHierarchy.map((rootNode) => (
                  <div key={rootNode.id} className="flex flex-col items-center">
                    {/* Pastor Node */}
                    <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white rounded-2xl p-4 shadow-md text-center max-w-sm w-72 border border-teal-500/20 relative z-10 hover:shadow-lg transition-shadow">
                      <Award className="w-6 h-6 mx-auto mb-1 text-teal-200" />
                      <h4 className="font-bold text-sm leading-tight">{rootNode.name}</h4>
                      <p className="text-xs text-teal-100/90 font-medium mt-1">
                        {rootNode.description || 'Spiritual oversight'}
                      </p>
                    </div>

                    {/* Root level departments directly under head pastor */}
                    {rootNode.departments.length > 0 && (
                      <div className="relative mt-8 w-full flex flex-col items-center">
                        <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 justify-center">
                          {rootNode.departments.map(dept => (
                            <div 
                              key={dept.id} 
                              onClick={() => {
                                setSelectedDeptId(dept.id);
                                setDetailTab('overview');
                                setDetailModalOpen(true);
                              }}
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center cursor-pointer hover:border-teal-500 dark:hover:border-teal-500 transition-colors w-48 shadow-sm flex flex-col justify-between"
                            >
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Department</span>
                              <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1 truncate">{dept.name}</h5>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                                Leader: {dept.leader_name || 'Unassigned'}
                              </p>
                              <div className="mt-2 text-[10px] text-teal-600 font-bold">
                                {dept.member_count || 0} members
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Children nodes (Subordinate Pastors) */}
                    {rootNode.children.length > 0 && (
                      <div className="relative mt-8 w-full flex flex-col items-center">
                        {/* Connector line down */}
                        <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700" />
                        
                        <div className="flex items-start gap-12 mt-4">
                          {rootNode.children.map(child => (
                            <div key={child.id} className="flex flex-col items-center">
                              {/* Sub-Pastor Node */}
                              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-850 rounded-2xl p-4 shadow-sm text-center max-w-sm w-64 relative z-10">
                                <Award className="w-5 h-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight">{child.name}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold inline-block mt-1">
                                  {child.category}
                                </span>
                              </div>

                              {/* Departments reporting to this child pastor */}
                              {child.departments.length > 0 ? (
                                <div className="relative mt-6 flex flex-col items-center w-full">
                                  <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />
                                  <div className="flex flex-col gap-2 mt-2 w-full items-center">
                                    {child.departments.map(dept => (
                                      <div 
                                        key={dept.id}
                                        onClick={() => {
                                          setSelectedDeptId(dept.id);
                                          setDetailTab('overview');
                                          setDetailModalOpen(true);
                                        }}
                                        className="bg-teal-50/50 dark:bg-slate-900/80 border border-teal-100 dark:border-slate-800 rounded-xl p-3 text-center cursor-pointer hover:border-teal-500 transition-colors w-48 shadow-sm"
                                      >
                                        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{dept.name}</h5>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                          Leader: {dept.leader_name || 'Unassigned'}
                                        </p>
                                        <div className="mt-1.5 text-[9px] bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 font-bold px-2 py-0.5 rounded-full inline-block">
                                          {dept.member_count || 0} Members
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-6 text-[10px] text-slate-400 dark:text-slate-500 italic">No departments report here</div>
                              )}

                              {/* Recursion for grandchildren pastors if they exist */}
                              {child.children.length > 0 && (
                                <div className="relative mt-6 flex flex-col items-center">
                                  <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />
                                  <div className="flex gap-4 mt-2">
                                    {child.children.map(grand => (
                                      <div key={grand.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center w-48 shadow-sm">
                                        <h6 className="font-semibold text-xs text-slate-800 dark:text-slate-100">{grand.name}</h6>
                                        <p className="text-[10px] text-slate-400 mt-1">
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
              <div className="text-center text-slate-400 py-8 italic">No reporting pastor titles available. Define them under Titles.</div>
            )}
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Department' : 'Create New Department'}
        subtitle={editingId ? 'Update department metadata and direct reporting lines.' : 'Register a new department or ministry team.'}
        size="md"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="input-label">Department Name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  required
                  type="text"
                  placeholder="e.g. Youth Department, Prayer Ministry"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input pl-11 rounded-xl"
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
                className="input py-2.5 rounded-xl text-sm"
              />
            </div>

            {/* Reports to title */}
            <div className="md:col-span-2">
              <label className="input-label">Reports to Pastor / Title</label>
              <div className="relative">
                <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <select
                  value={form.reports_to_title_id}
                  onChange={(e) => setForm({ ...form, reports_to_title_id: e.target.value })}
                  className="input pl-11 rounded-xl appearance-none"
                >
                  <option value="">-- No Direct Pastoral Report (Independent) --</option>
                  {titles.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Leader assignment */}
            <div>
              <label className="input-label">Department Leader</label>
              <div className="relative">
                <UserCog className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <select
                  value={form.leader_id}
                  onChange={(e) => setForm({ ...form, leader_id: e.target.value })}
                  className="input pl-11 rounded-xl appearance-none"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assistant Leader assignment */}
            <div>
              <label className="input-label">Assistant Leader</label>
              <div className="relative">
                <UserCog className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <select
                  value={form.assistant_leader_id}
                  onChange={(e) => setForm({ ...form, assistant_leader_id: e.target.value })}
                  className="input pl-11 rounded-xl appearance-none"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secretary assignment */}
            <div className="md:col-span-2">
              <label className="input-label">Department Secretary</label>
              <div className="relative">
                <UserCog className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <select
                  value={form.secretary_id}
                  onChange={(e) => setForm({ ...form, secretary_id: e.target.value })}
                  className="input pl-11 rounded-xl appearance-none"
                >
                  <option value="">-- Unassigned --</option>
                  {sortedMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status toggle */}
            <div className="md:col-span-2 flex items-center gap-3 py-2 bg-slate-50 dark:bg-slate-900 px-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <input
                id="dept-active-toggle"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-teal-600 focus:ring-teal-500 rounded border-slate-350"
              />
              <label htmlFor="dept-active-toggle" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                Department is active and operating
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="btn-secondary rounded-xl h-11"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary min-w-[120px] rounded-xl h-11 justify-center font-semibold"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        subtitle={detailDept && (detailDept.reports_to_title_name ? `Reports to: ${detailDept.reports_to_title_name}` : 'Independent ministry team')}
        size="lg"
      >
        {detailLoading || !detailDept ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">Retrieving members and audit logs...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex border-b border-slate-150 dark:border-slate-700">
              <button
                onClick={() => setDetailTab('overview')}
                className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
                  detailTab === 'overview' 
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Overview & Leadership
              </button>
              <button
                onClick={() => setDetailTab('members')}
                className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'members' 
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span>Members List</span>
                <Badge variant="neutral" className="text-[10px] font-bold px-1.5 py-0.5">{deptMembers.length}</Badge>
              </button>
              <button
                onClick={() => setDetailTab('history')}
                className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'history' 
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
              </button>
            </div>

            {/* Overview Tab Content */}
            {detailTab === 'overview' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vision Statement / Description</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    {detailDept.description || 'No vision statement registered for this department.'}
                  </p>
                </div>

                {/* Main Leadership Officers */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Officers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Leader Card */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[100px]">
                      <div className="absolute top-0 right-0 h-1 bg-teal-500 w-full" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Department Leader</span>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 truncate">
                        {detailDept.leader_name || 'Unassigned'}
                      </p>
                    </div>

                    {/* Assistant Leader Card */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[100px]">
                      <div className="absolute top-0 right-0 h-1 bg-sky-500 w-full" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Assistant Leader</span>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 truncate">
                        {detailDept.assistant_leader_name || 'Unassigned'}
                      </p>
                    </div>

                    {/* Secretary Card */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[100px]">
                      <div className="absolute top-0 right-0 h-1 bg-indigo-500 w-full" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Secretary</span>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 truncate">
                        {detailDept.secretary_name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => handleOpenEdit(detailDept)}
                    className="btn-secondary rounded-xl flex items-center gap-1.5 h-10"
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
                <form onSubmit={handleAddMemberSubmit} className="flex flex-col sm:flex-row items-end gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 w-full relative" ref={memberSearchRef}>
                    <label className="input-label">Add Member to Department</label>
                    <input
                      required
                      type="text"
                      value={memberFocused ? memberSearch : (selectedAddMember ? selectedAddMember.full_name : memberSearch)}
                      onChange={(e) => { setMemberSearch(e.target.value); setShowMemberDropdown(true); if (selectedMemberToAdd) setSelectedMemberToAdd(''); }}
                      onFocus={() => { setMemberFocused(true); setShowMemberDropdown(true); }}
                      onBlur={() => { setTimeout(() => { setMemberFocused(false); if (!selectedMemberToAdd) setMemberSearch(''); }, 200); }}
                      placeholder="Search member name..."
                      className="input rounded-xl w-full"
                    />
                    {showMemberDropdown && filteredMembers.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/10 max-h-48 overflow-y-auto animate-fade-in">
                        {filteredMembers.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberToAdd(String(m.id));
                              setMemberSearch('');
                              setMemberFocused(false);
                              setShowMemberDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                              Number(m.id) === Number(selectedMemberToAdd)
                                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            <span className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {(m.full_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="truncate font-medium">{m.full_name}</span>
                            {m.section_name && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto shrink-0">{m.section_name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {memberFocused && !selectedMemberToAdd && !showMemberDropdown && memberSearch.trim() && (
                      <p className="text-[11px] text-rose-500 mt-1">Please select a member from the list</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={addingMember || !selectedMemberToAdd}
                    className="btn-primary rounded-xl h-11 w-full sm:w-auto font-semibold px-5 shadow-lg shadow-teal-500/10 flex items-center justify-center gap-1.5"
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </form>

                {/* Members List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Department Members ({deptMembers.length})</h4>
                  {deptMembers.length > 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm max-h-80 overflow-y-auto">
                      {deptMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                              {member.member_name ? member.member_name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                            </div>
                            <div>
                              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{member.member_name}</h5>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {member.member_section || 'No Section'} · Joined {new Date(member.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.member_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-xs font-medium flex items-center gap-1"
                            title="Remove member from department"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-slate-50/40 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Users className="w-8 h-8 mx-auto text-slate-350 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">No general members in this department yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Use the search box above to add members.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* History / Audit Log Tab */}
            {detailTab === 'history' && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department Operations & Leadership History</h4>
                {deptHistory.length > 0 ? (
                  <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3.5 pl-6 space-y-6 max-h-80 overflow-y-auto py-2">
                    {deptHistory.map((log) => (
                      <div key={log.id} className="relative">
                        {/* Dot indicator */}
                        <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 ring-4 ring-white dark:ring-slate-800">
                          <Clock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                        </span>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                              {log.entity_type.replace('_', ' ')} {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                          {log.operator_name && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Action by: <span className="font-semibold">{log.operator_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50/40 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Clock className="w-8 h-8 mx-auto text-slate-350 dark:text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No actions recorded for this department yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={!!deletingDept} onClose={() => setDeletingDept(null)} size="sm">
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Department?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-2">
            Are you sure you want to permanently delete the <strong className="text-slate-800 dark:text-slate-200">{deletingDept?.name}</strong> department? This will remove all department memberships and history record logs.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeletingDept(null)} className="btn-secondary flex-1 h-11 rounded-xl">
              Cancel
            </button>
            <button onClick={handleConfirmDelete} disabled={deleting} className="btn-danger flex-1 h-11 rounded-xl">
              {deleting ? 'Deleting...' : 'Delete Department'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DepartmentsView;
