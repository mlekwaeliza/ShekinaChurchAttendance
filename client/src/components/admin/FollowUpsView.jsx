import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Search,
  UserX,
  CalendarCheck,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { fdate } from '../../utils/date';

const FollowUpsView = ({ dashboardMetrics, leaders = [], showMessage }) => {
  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [tasksLoading, setTasksLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const absentees = useMemo(
    () => dashboardMetrics?.needsAttention?.absentees || [],
    [dashboardMetrics]
  );
  const visitors = useMemo(
    () => dashboardMetrics?.needsAttention?.visitors || [],
    [dashboardMetrics]
  );

  const candidates = useMemo(() => {
    const byId = new Map();
    absentees.forEach((member) =>
      byId.set(`member-${member.id}`, { ...member, type: 'Member', reason: 'Repeated absence' })
    );
    visitors.forEach((visitor) =>
      byId.set(`visitor-${visitor.id}`, { ...visitor, type: 'Visitor', reason: 'New visitor' })
    );
    return Array.from(byId.values());
  }, [absentees, visitors]);

  const filteredCandidates = candidates.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      item.full_name?.toLowerCase().includes(term) ||
      item.section_name?.toLowerCase().includes(term)
    );
  });

  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await adminAPI.getFollowUpTasks();
      setTasks(res.data || []);
    } catch (error) {
      console.error('Failed to load follow-up tasks:', error);
      showMessage?.('Failed to load follow-up tasks.', 4000);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createTask = async (person) => {
    const buttonId = `${person.type}-${person.id}`;
    setSavingId(buttonId);
    try {
      await adminAPI.createFollowUpTask({
        person_type: person.type,
        person_id: person.id,
        full_name: person.full_name,
        section_name: person.section_name || 'Unassigned',
        reason: person.reason,
        owner_id: ownerId || null
      });
      await loadTasks();
      showMessage?.(`Follow-up created for ${person.full_name}.`);
    } catch (error) {
      showMessage?.(error.response?.data?.error || 'Failed to create follow-up.', 4000);
    } finally {
      setSavingId(null);
    }
  };

  const closeTask = async (id) => {
    setSavingId(id);
    try {
      await adminAPI.updateFollowUpTask(id, { status: 'done' });
      setTasks((current) =>
        current.map((task) =>
          task.id === id
            ? { ...task, status: 'done', completed_at: new Date().toISOString() }
            : task
        )
      );
    } catch (error) {
      showMessage?.('Failed to update follow-up task.', 4000);
    } finally {
      setSavingId(null);
    }
  };

  const openTasks = tasks.filter((task) => task.status !== 'done');
  const completedTasks = tasks.filter((task) => task.status === 'done');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
          <ClipboardCheck className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
        <div>
          <h2 className="text-title-2 font-semibold text-label">Follow-ups</h2>
          <p className="mt-0.5 text-footnote text-secondary-label">
            Turn attendance concerns and visitor moments into owned next steps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search people needing follow-up..."
                className="input h-10 w-full pl-10"
              />
            </div>
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="select h-10 md:w-56"
            >
              <option value="">Assign later</option>
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredCandidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <UserX className="mx-auto mb-3 h-8 w-8 text-tertiary-label" />
                <p className="text-footnote font-medium text-secondary-label">
                  No urgent follow-up candidates right now.
                </p>
              </div>
            ) : (
              filteredCandidates.map((person) => {
                const buttonId = `${person.type}-${person.id}`;
                return (
                  <div
                    key={buttonId}
                    className="rounded-xl border border-black/[0.06] bg-system-fill p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-label">{person.full_name}</p>
                        <p className="text-footnote text-secondary-label">
                          {person.section_name ||
                            (person.date ? fdate(person.date) : '') ||
                            'Unassigned'}{' '}
                          - {person.reason}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => createTask(person)}
                        disabled={savingId === buttonId}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-caption-1 font-semibold text-white shadow-card transition-all hover:bg-amber-600 disabled:opacity-60"
                      >
                        {savingId === buttonId ? 'Saving...' : 'Create'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-subheadline font-semibold text-label">Follow-up Board</h3>
              <p className="text-footnote text-secondary-label">
                {openTasks.length} open - {completedTasks.length} completed
              </p>
            </div>
            <CalendarCheck className="h-5 w-5 text-tertiary-label" />
          </div>

          <div className="space-y-3">
            {tasksLoading ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-tertiary-label" />
                <p className="text-footnote font-medium text-secondary-label">
                  Loading follow-ups...
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-tertiary-label" />
                <p className="text-footnote font-medium text-secondary-label">
                  Created follow-ups will appear here.
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-black/[0.06] bg-system-fill p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-label">{task.full_name || task.fullName}</p>
                      <p className="text-footnote text-secondary-label">
                        {task.section_name || task.sectionName || 'Unassigned'} - {task.reason}
                      </p>
                    </div>
                    {task.status === 'done' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-caption-1 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => closeTask(task.id)}
                        disabled={savingId === task.id}
                        className="rounded-xl border border-black/[0.06] bg-secondary-system-grouped-background px-3 py-2 text-caption-1 font-semibold text-secondary-label transition-all hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-60 dark:border-white/[0.08] dark:text-label"
                      >
                        {savingId === task.id ? 'Saving...' : 'Mark done'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FollowUpsView;
