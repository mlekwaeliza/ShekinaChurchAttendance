import React, { useState, useMemo } from 'react';
import { Layers, Plus, Pencil, Trash2, Users, UserCog, Search, Layout, ChevronRight, Building2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { fdate } from '../../utils/date';

const sectionGradients = [
  { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700/50', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-100 dark:ring-violet-800/50', shadow: 'shadow-violet-500/10' },
  { bg: 'from-sky-500 to-blue-600', light: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700/50', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-100 dark:ring-sky-800/50', shadow: 'shadow-sky-500/10' },
  { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700/50', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-100 dark:ring-emerald-800/50', shadow: 'shadow-emerald-500/10' },
  { bg: 'from-amber-500 to-orange-600', light: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700/50', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-100 dark:ring-amber-800/50', shadow: 'shadow-amber-500/10' },
  { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700/50', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-100 dark:ring-rose-800/50', shadow: 'shadow-rose-500/10' },
  { bg: 'from-indigo-500 to-blue-600', light: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-700/50', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-100 dark:ring-indigo-800/50', shadow: 'shadow-indigo-500/10' },
];

const SectionManagement = ({
  sections,
  allMembers,
  leaders,
  editingSection,
  setEditingSection,
  isSectionModalOpen,
  setIsSectionModalOpen,
  deletingSection,
  setDeletingSection,
  sectionSaving,
  onSave,
  onDelete,
  onViewLeaders,
  onViewMembers,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const openNewSectionModal = () => {
    setDeletingSection(null);
    setEditingSection(null);
    setIsSectionModalOpen(true);
  };

  const openEditSectionModal = (section) => {
    setDeletingSection(null);
    setEditingSection(section);
    setIsSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    setIsSectionModalOpen(false);
    setEditingSection(null);
  };

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sections;
    const term = searchTerm.toLowerCase();
    return sections.filter((s) => s.name?.toLowerCase().includes(term));
  }, [sections, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-purple-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Sections</h2>
            <p className="text-sm text-white/80">
              {loading ? 'Loading sections...' : `${sections.length} sections · ${leaders.length} leaders`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sections..."
              className="input h-10 w-full rounded-xl pl-10"
            />
          </div>
          <button
            type="button"
            onClick={openNewSectionModal}
            className="group inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-500/30 active:translate-y-0 sm:w-auto"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/18 ring-1 ring-white/20 transition-colors group-hover:bg-white/24">
              <Plus className="w-4 h-4" />
            </span>
            <span className="whitespace-nowrap tracking-tight">New Section</span>
          </button>
        </div>

      {/* Section Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="h-1.5 rounded-t-2xl bg-slate-100 dark:bg-slate-700" />
              <div className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                  <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                </div>
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                  <div className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredSections.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSections.map((section, idx) => {
            const memberCount = allMembers.filter((m) => m.section_name === section.name).length;
            const leaderCount = leaders.filter((l) => l.section_name === section.name).length;
            const colors = sectionGradients[idx % sectionGradients.length];

            return (
              <div
                key={section.id}
                className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Colored top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${colors.bg}`} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center text-white shadow-md ${colors.shadow}`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {section.name}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {fdate(section.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSectionModal(section);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingSection(section); }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-xl ${colors.light} border ${colors.border} p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className={`w-3.5 h-3.5 ${colors.text}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Members</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{memberCount}</p>
                    </div>
                    <div className={`rounded-xl ${colors.light} border ${colors.border} p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <UserCog className={`w-3.5 h-3.5 ${colors.text}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Leaders</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{leaderCount}</p>
                    </div>
                  </div>

                  {/* View Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onViewMembers(section.name)}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border ${colors.border} ${colors.light} hover:shadow-md transition-all group/btn`}
                    >
                      <span className={`text-sm font-medium ${colors.text}`}>View Members</span>
                      <ChevronRight className={`w-4 h-4 ${colors.text} group-hover/btn:translate-x-0.5 transition-transform`} />
                    </button>
                    <button
                      onClick={() => onViewLeaders(section.name)}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border ${colors.border} ${colors.light} hover:shadow-md transition-all group/btn`}
                    >
                      <span className={`text-sm font-medium ${colors.text}`}>View Leaders</span>
                      <ChevronRight className={`w-4 h-4 ${colors.text} group-hover/btn:translate-x-0.5 transition-transform`} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">No sections found</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            {searchTerm ? 'No sections match your search.' : 'Create your first section to start organizing your church.'}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={closeSectionModal}
        title={editingSection ? 'Edit Section' : 'New Section'}
        subtitle={editingSection ? 'Update the section name below.' : 'Create a new section to organize members and leaders.'}
        size="sm"
      >
        <form key={editingSection?.id ?? 'new-section'} onSubmit={onSave} className="space-y-5">
          <div>
            <label className="input-label">Section Name</label>
            <div className="relative">
              <Layout className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                required
                name="name"
                defaultValue={editingSection?.name}
                placeholder="e.g. Choir, Youth, Adults"
                className="input pl-11 rounded-xl"
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={closeSectionModal} className="btn-secondary rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={sectionSaving} className="btn-primary min-w-[110px] justify-center rounded-xl">
              {sectionSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : editingSection ? 'Save Changes' : 'Create Section'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deletingSection} onClose={() => setDeletingSection(null)} size="sm">
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Section?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-2">
            Removing <strong className="text-slate-800 dark:text-slate-200">{deletingSection?.name}</strong> will permanently delete all associated leaders, members, and data.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeletingSection(null)} className="btn-secondary flex-1 h-11 rounded-xl">
              Cancel
            </button>
            <button onClick={onDelete} disabled={sectionSaving} className="btn-danger flex-1 h-11 rounded-xl">
              {sectionSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SectionManagement;
