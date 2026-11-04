import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Send, Users, CalendarClock, CheckCircle2, Trash2 } from 'lucide-react';
import { adminAPI } from '../../services/api';

const AnnouncementCenter = ({ sections = [], leaders = [], showMessage }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [priority, setPriority] = useState('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAnnouncements();
      setDrafts(res.data || []);
    } catch (error) {
      console.error('Failed to load announcements:', error);
      showMessage?.('Failed to load announcements.', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const audienceOptions = useMemo(
    () => [
      { value: 'all', label: 'All leaders and sections' },
      { value: 'leaders', label: `All leaders (${leaders.length})` },
      ...sections.map((section) => ({ value: `section:${section.id}`, label: section.name }))
    ],
    [leaders.length, sections]
  );

  const saveAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      showMessage?.('Add a title and message before saving the announcement.', 4000);
      return;
    }

    setSaving(true);
    try {
      await adminAPI.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        audience,
        priority,
        scheduled_at: scheduledDate || null
      });
      setTitle('');
      setMessage('');
      setAudience('all');
      setPriority('normal');
      setScheduledDate('');
      await loadDrafts();
      showMessage?.('Announcement saved.');
    } catch (error) {
      showMessage?.(error.response?.data?.error || 'Failed to save announcement.', 4000);
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async (id) => {
    try {
      await adminAPI.deleteAnnouncement(id);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
      showMessage?.('Announcement removed.');
    } catch (error) {
      showMessage?.('Failed to remove announcement.', 4000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
          <Megaphone className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
        <div>
          <h2 className="text-title-2 font-semibold text-label">Announcements</h2>
          <p className="mt-0.5 text-footnote text-secondary-label">
            Prepare clear notices for leaders, sections, or the whole church team.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                Title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input w-full"
                placeholder="Sunday service reminder"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                Message
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="input min-h-[150px] w-full resize-y"
                placeholder="Write the announcement..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Audience
                </label>
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  className="select w-full"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="select w-full"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Schedule
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={saveAnnouncement}
              disabled={saving}
              className="btn-primary h-11 w-full md:w-auto"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Announcement'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-subheadline font-semibold text-label">Prepared Notices</h3>
              <p className="text-footnote text-secondary-label">
                {drafts.length} saved announcement{drafts.length === 1 ? '' : 's'}
              </p>
            </div>
            <Users className="h-5 w-5 text-tertiary-label" />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <CalendarClock className="mx-auto mb-3 h-8 w-8 text-tertiary-label" />
                <p className="text-footnote font-medium text-secondary-label">
                  Loading announcements...
                </p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center dark:border-white/[0.08]">
                <CalendarClock className="mx-auto mb-3 h-8 w-8 text-tertiary-label" />
                <p className="text-footnote font-medium text-secondary-label">
                  No announcements prepared yet.
                </p>
              </div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border border-black/[0.06] bg-system-fill p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-label">{draft.title}</p>
                      <p className="mt-1 line-clamp-2 text-footnote text-secondary-label">
                        {draft.message}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDraft(draft.id)}
                      className="rounded-lg p-2 text-tertiary-label hover:bg-secondary-system-grouped-background hover:text-rose-500 dark:hover:bg-white/[0.04]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-caption-1">
                    <span className="rounded-full bg-secondary-system-grouped-background px-2.5 py-1 font-semibold text-secondary-label dark:text-tertiary-label">
                      {draft.priority}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Ready
                    </span>
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

export default AnnouncementCenter;
