import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Plus, Save, Trash2, UsersRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { calendarAPI } from '../services/api';

const months = Array.from({ length: 12 }, (_, index) => (
  new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' })
));

const emptyForm = (year) => ({
  title: '',
  event_date: `${year}-01-01`,
  event_time: '',
  event_type: 'service',
  role_title: '',
  assigned_to: '',
  section_name: '',
  location: '',
  notes: '',
});

const typeStyles = {
  service: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  training: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
  outreach: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  conference: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  meeting: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const ChurchCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => emptyForm(currentYear));

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await calendarAPI.getEvents(year);
      setEvents(res.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to load church calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [year]);

  useEffect(() => {
    setForm((current) => ({ ...current, event_date: `${year}-01-01` }));
  }, [year]);

  const groupedEvents = useMemo(() => {
    const groups = months.map((month, index) => ({ month, index, events: [] }));
    events.forEach((event) => {
      const monthIndex = Number(event.event_date?.slice(5, 7)) - 1;
      if (groups[monthIndex]) groups[monthIndex].events.push(event);
    });
    return groups;
  }, [events]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!form.title.trim()) {
      setMessage('Event title is required.');
      return;
    }

    setSaving(true);
    try {
      await calendarAPI.createEvent({
        ...form,
        title: form.title.trim(),
      });
      setForm(emptyForm(year));
      setMessage('Calendar event saved.');
      await loadEvents();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to save calendar event.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await calendarAPI.deleteEvent(id);
      setEvents((current) => current.filter((event) => event.id !== id));
      setMessage('Calendar event removed.');
    } catch (error) {
      setMessage('Failed to remove calendar event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white shadow-lg shadow-sky-500/20">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Church Calendar</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Yearly events, role assignments, and ministry responsibilities.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Year</label>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="select h-10 w-32">
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={saveEvent} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-sky-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Calendar Event</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <input value={form.title} onChange={(event) => updateField('title', event.target.value)} className="input" placeholder="Event title" />
            <input type="date" value={form.event_date} onChange={(event) => updateField('event_date', event.target.value)} className="input" />
            <input type="time" value={form.event_time} onChange={(event) => updateField('event_time', event.target.value)} className="input" />
            <select value={form.event_type} onChange={(event) => updateField('event_type', event.target.value)} className="select">
              <option value="service">Service</option>
              <option value="training">Training</option>
              <option value="outreach">Outreach</option>
              <option value="conference">Conference</option>
              <option value="meeting">Meeting</option>
            </select>
            <input value={form.role_title} onChange={(event) => updateField('role_title', event.target.value)} className="input" placeholder="Role e.g. Ushering Lead" />
            <input value={form.assigned_to} onChange={(event) => updateField('assigned_to', event.target.value)} className="input" placeholder="Assigned person/team" />
            <input value={form.section_name} onChange={(event) => updateField('section_name', event.target.value)} className="input" placeholder="Section / ministry" />
            <input value={form.location} onChange={(event) => updateField('location', event.target.value)} className="input" placeholder="Location" />
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="input min-h-[88px] resize-y lg:col-span-3" placeholder="Notes or preparation details" />
            <button disabled={saving} type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-700 disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {groupedEvents.map((group) => (
          <section key={group.month} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{group.month}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {group.events.length} event{group.events.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Loading calendar...
              </div>
            ) : group.events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No events planned.
              </div>
            ) : (
              <div className="space-y-3">
                {group.events.map((event) => (
                  <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${typeStyles[event.event_type] || typeStyles.meeting}`}>
                            {event.event_type}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {new Date(`${event.event_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{event.title}</h4>
                      </div>
                      {isAdmin && (
                        <button disabled={saving} onClick={() => deleteEvent(event.id)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-500 disabled:opacity-60 dark:hover:bg-slate-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                      {event.event_time && <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{event.event_time}</span>}
                      {event.location && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{event.location}</span>}
                      {(event.role_title || event.assigned_to) && (
                        <span className="inline-flex items-center gap-2 md:col-span-2">
                          <UsersRound className="h-4 w-4 text-slate-400" />
                          {[event.role_title, event.assigned_to].filter(Boolean).join(' - ')}
                        </span>
                      )}
                      {event.section_name && <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{event.section_name}</span>}
                    </div>
                    {event.notes && <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{event.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default ChurchCalendar;
