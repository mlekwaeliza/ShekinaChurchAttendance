import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCog,
  Search,
  Layout,
  ChevronRight,
  Building2,
  BarChart2
} from 'lucide-react';
import Modal from '../ui/Modal';
import { fdatetime } from '../../utils/date';

// Flat tint rotation for section icon wells (no gradients): a low-alpha
// wash of one accent with its dark-mode-aware text pair.
const sectionTints = [
  {
    bg: 'bg-primary-500/[0.12]',
    well: 'bg-primary-500/[0.08]',
    text: 'text-primary-700 dark:text-primary-300'
  },
  {
    bg: 'bg-system-blue/15',
    well: 'bg-system-blue/10',
    text: 'text-blue-700 dark:text-system-blue'
  },
  {
    bg: 'bg-system-green/15',
    well: 'bg-system-green/10',
    text: 'text-emerald-700 dark:text-system-green'
  },
  {
    bg: 'bg-system-orange/15',
    well: 'bg-system-orange/10',
    text: 'text-amber-700 dark:text-system-orange'
  },
  {
    bg: 'bg-system-red/15',
    well: 'bg-system-red/10',
    text: 'text-rose-700 dark:text-system-red'
  }
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
  loading = false
}) => {
  const navigate = useNavigate();
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
      <section className="product-surface px-5 py-6 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
            <Layers className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="section-eyebrow">Ministry structure</p>
            <h2 className="text-title-2 font-semibold text-label">Sections</h2>
            <p className="mt-0.5 text-subheadline text-secondary-label">
              {loading
                ? 'Loading sections...'
                : `${sections.length} sections · ${leaders.length} leaders`}
            </p>
          </div>
        </div>
      </section>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary-label" />
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
          className="btn-primary h-11 w-full gap-2.5 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="whitespace-nowrap">New Section</span>
        </button>
      </div>

      {/* Section Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((item) => (
            <div key={item} className="card">
              <div className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-system-fill animate-pulse rounded-[10px]" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-system-fill animate-pulse rounded" />
                    <div className="h-3 w-20 bg-system-fill animate-pulse rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 bg-system-fill animate-pulse rounded-xl" />
                  <div className="h-20 bg-system-fill animate-pulse rounded-xl" />
                </div>
                <div className="space-y-2">
                  <div className="h-10 bg-system-fill animate-pulse rounded-xl" />
                  <div className="h-10 bg-system-fill animate-pulse rounded-xl" />
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
            // Flat tint rotation: a low-alpha accent wash for the icon well.
            const tint = sectionTints[idx % sectionTints.length];

            return (
              <div
                key={section.id}
                className="card group overflow-hidden transition-shadow hover:shadow-card-hover"
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tint.bg} ${tint.text}`}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-label transition-colors">
                          {section.name}
                        </h3>
                        <p className="text-caption-1 text-tertiary-label">
                          {fdatetime(section.created_at)}
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
                        className="btn-icon btn-sm btn-ghost text-secondary-label hover:text-label"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSection(section);
                        }}
                        className="btn-icon btn-sm btn-ghost text-secondary-label hover:text-rose-700 dark:hover:text-system-red"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-xl ${tint.well} p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className={`h-3.5 w-3.5 ${tint.text}`} />
                        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                          Members
                        </span>
                      </div>
                      <p className="text-metric-sm text-label tabular-nums">{memberCount}</p>
                    </div>
                    <div className={`rounded-xl ${tint.well} p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <UserCog className={`h-3.5 w-3.5 ${tint.text}`} />
                        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                          Leaders
                        </span>
                      </div>
                      <p className="text-metric-sm text-label tabular-nums">{leaderCount}</p>
                    </div>
                  </div>

                  {/* View Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/sections?profile=${section.id}`)}
                      className="btn-primary text-xs group/btn justify-between px-4 py-2"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <BarChart2 className="h-3.5 w-3.5" /> View Section Profile
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onViewMembers(section.name)}
                        className={`btn-secondary btn-sm px-3 py-1.5 justify-between ${tint.text}`}
                      >
                        <span className="text-xs font-medium">Members</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewLeaders(section.name)}
                        className={`btn-secondary btn-sm px-3 py-1.5 justify-between ${tint.text}`}
                      >
                        <span className="text-xs font-medium">Leaders</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-system-fill">
              <Layers className="h-6 w-6 text-secondary-label" />
            </div>
            <p className="empty-state-title">No sections found</p>
            <p className="empty-state-desc">
              {searchTerm
                ? 'No sections match your search.'
                : 'Create your first section to start organizing your church.'}
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={closeSectionModal}
        title={editingSection ? 'Edit Section' : 'New Section'}
        subtitle={
          editingSection
            ? 'Update the section name below.'
            : 'Create a new section to organize members and leaders.'
        }
        size="sm"
      >
        <form key={editingSection?.id ?? 'new-section'} onSubmit={onSave} className="space-y-5">
          <div>
            <label className="input-label">Section Name</label>
            <div className="relative">
              <Layout className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary-label" />
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
          <div className="flex justify-end gap-3 pt-4 border-t border-separator/60 dark:border-white/[0.08]">
            <button type="button" onClick={closeSectionModal} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sectionSaving}
              className="btn-primary min-w-[110px] justify-center"
            >
              {sectionSaving ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : editingSection ? (
                'Save Changes'
              ) : (
                'Create Section'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deletingSection} onClose={() => setDeletingSection(null)} size="sm">
        <div className="text-center py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-system-red/15 mx-auto mb-4">
            <Trash2 className="h-6 w-6 text-rose-700 dark:text-system-red" />
          </div>
          <h3 className="text-title-3 font-semibold text-label mb-2">Delete Section?</h3>
          <p className="text-footnote text-secondary-label mb-6 px-2 leading-relaxed">
            Removing <strong className="text-label">{deletingSection?.name}</strong> will
            permanently delete all associated leaders, members, and data.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeletingSection(null)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={onDelete} disabled={sectionSaving} className="btn-danger flex-1">
              {sectionSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SectionManagement;
