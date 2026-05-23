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
  }, []);

  const audienceOptions = useMemo(() => [
    { value: 'all', label: 'All leaders and sections' },
    { value: 'leaders', label: `All leaders (${leaders.length})` },
    ...sections.map((section) => ({ value: `section:${section.id}`, label: section.name })),
  ], [leaders.length, sections]);

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
        scheduled_at: scheduledDate || null,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Announcements</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Prepare clear notices for leaders, sections, or the whole church team.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input w-full"
                placeholder="Sunday service reminder"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Message</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="input min-h-[150px] w-full resize-y"
                placeholder="Write the announcement..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Audience</label>
                <select value={audience} onChange={(event) => setAudience(event.target.value)} className="select w-full">
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</label>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="select w-full">
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Schedule</label>
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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-700 md:w-auto"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Announcement'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Prepared Notices</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{drafts.length} saved announcement{drafts.length === 1 ? '' : 's'}</p>
            </div>
            <Users className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
                <CalendarClock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading announcements...</p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
                <CalendarClock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No announcements prepared yet.</p>
              </div>
            ) : drafts.map((draft) => (
              <div key={draft.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{draft.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{draft.message}</p>
                  </div>
                  <button onClick={() => removeDraft(draft.id)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-slate-800">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{draft.priority}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AnnouncementCenter;
