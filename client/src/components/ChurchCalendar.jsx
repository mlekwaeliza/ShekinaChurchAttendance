import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Plus, Save, Trash2, UsersRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { calendarAPI } from '../services/api';

const months = Array.from({ length: 12 }, (_, index) =>
  new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' })
);

const emptyForm = (year) => ({
  title: '',
  event_date: `${year}-01-01`,
  event_time: '',
  event_type: 'service',
  role_title: '',
  assigned_to: '',
  section_name: '',
  location: '',
  notes: ''
});

const typeStyles = {
  service: 'bg-system-green/15 text-emerald-700 dark:text-system-green',
  training: 'bg-system-blue/15 text-blue-700 dark:text-system-blue',
  outreach: 'bg-system-orange/15 text-amber-700 dark:text-system-orange',
  conference: 'bg-system-purple/15 text-purple-700 dark:text-system-purple',
  meeting: 'bg-system-fill text-secondary-label'
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
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

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
        title: form.title.trim()
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
        <div className="rounded-xl bg-system-green/10 px-4 py-3 text-footnote font-medium text-emerald-700 dark:text-system-green">
          {message}
        </div>
      )}

      <div className="card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-system-blue/15">
            <CalendarDays className="h-5 w-5 text-blue-700 dark:text-system-blue" />
          </div>
          <div>
            <h2 className="text-title-2 font-semibold text-label">Church Calendar</h2>
            <p className="text-footnote text-secondary-label">
              Yearly events, role assignments, and ministry responsibilities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-secondary-label">
            Year
          </label>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="select h-9 w-28"
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={saveEvent} className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-700 dark:text-system-blue" />
            <h3 className="text-headline font-semibold text-label">Add Calendar Event</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              className="input"
              placeholder="Event title"
            />
            <input
              type="date"
              value={form.event_date}
              onChange={(event) => updateField('event_date', event.target.value)}
              className="input"
            />
            <input
              type="time"
              value={form.event_time}
              onChange={(event) => updateField('event_time', event.target.value)}
              className="input"
            />
            <select
              value={form.event_type}
              onChange={(event) => updateField('event_type', event.target.value)}
              className="select"
            >
              <option value="service">Service</option>
              <option value="training">Training</option>
              <option value="outreach">Outreach</option>
              <option value="conference">Conference</option>
              <option value="meeting">Meeting</option>
            </select>
            <input
              value={form.role_title}
              onChange={(event) => updateField('role_title', event.target.value)}
              className="input"
              placeholder="Role e.g. Ushering Lead"
            />
            <input
              value={form.assigned_to}
              onChange={(event) => updateField('assigned_to', event.target.value)}
              className="input"
              placeholder="Assigned person/team"
            />
            <input
              value={form.section_name}
              onChange={(event) => updateField('section_name', event.target.value)}
              className="input"
              placeholder="Section / ministry"
            />
            <input
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              className="input"
              placeholder="Location"
            />
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className="input min-h-[88px] resize-y lg:col-span-3"
              placeholder="Notes or preparation details"
            />
            <button
              disabled={saving}
              type="submit"
              className="btn-primary flex h-11 items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {groupedEvents.map((group) => (
          <section key={group.month} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-headline font-semibold text-label">{group.month}</h3>
              <span className="rounded-full bg-system-fill px-2.5 py-1 text-caption-1 font-semibold text-secondary-label">
                {group.events.length} event{group.events.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-separator/70 p-6 text-center text-footnote font-medium text-secondary-label dark:border-white/[0.12]">
                Loading calendar...
              </div>
            ) : group.events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-separator/70 p-6 text-center text-footnote font-medium text-secondary-label dark:border-white/[0.12]">
                No events planned.
              </div>
            ) : (
              <div className="space-y-3">
                {group.events.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-xl bg-system-grouped-background/70 p-4 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-caption-1 font-semibold capitalize ${typeStyles[event.event_type] || typeStyles.meeting}`}
                          >
                            {event.event_type}
                          </span>
                          <span className="text-caption-1 font-semibold text-secondary-label">
                            {new Date(`${event.event_date}T12:00:00`).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <h4 className="break-words font-semibold text-label">{event.title}</h4>
                      </div>
                      {isAdmin && (
                        <button
                          disabled={saving}
                          onClick={() => deleteEvent(event.id)}
                          aria-label={`Delete ${event.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 text-tertiary-label transition-colors hover:bg-system-red/10 hover:text-rose-700 disabled:opacity-60 dark:hover:text-system-red"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-footnote text-secondary-label md:grid-cols-2">
                      {event.event_time && (
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-tertiary-label" />
                          {event.event_time}
                        </span>
                      )}
                      {event.location && (
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-tertiary-label" />
                          {event.location}
                        </span>
                      )}
                      {(event.role_title || event.assigned_to) && (
                        <span className="inline-flex items-center gap-2 md:col-span-2">
                          <UsersRound className="h-4 w-4 text-tertiary-label" />
                          {[event.role_title, event.assigned_to].filter(Boolean).join(' - ')}
                        </span>
                      )}
                      {event.section_name && (
                        <span className="text-caption-2 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                          {event.section_name}
                        </span>
                      )}
                    </div>
                    {event.notes && (
                      <p className="mt-3 text-footnote leading-relaxed text-secondary-label">
                        {event.notes}
                      </p>
                    )}
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
