import React, { useState } from 'react';
import { Save, Calendar, MapPin, Users } from 'lucide-react';
import { adminAPI } from '../../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HCSettings = ({ cells = [], onRefresh }) => {
  const [editingRow, setEditingRow] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');

  const toast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleChange = (cellId, field, value) => {
    setEditingRow((curr) => ({
      ...curr,
      [cellId]: {
        ...curr[cellId],
        [field]: value
      }
    }));
  };

  const handleSave = async (cell) => {
    const changes = editingRow[cell.id];
    if (!changes) return;

    setSavingId(cell.id);
    try {
      const payload = {
        meeting_day:
          changes.meeting_day !== undefined ? changes.meeting_day || null : cell.meeting_day,
        location: changes.location !== undefined ? changes.location.trim() || null : cell.location,
        max_capacity:
          changes.max_capacity !== undefined
            ? changes.max_capacity
              ? Number(changes.max_capacity)
              : null
            : cell.max_capacity
      };

      await adminAPI.updateHomeCell(cell.id, payload);
      toast(`${cell.name} settings updated successfully`);

      // Clear the local state for this row since it's saved
      setEditingRow((curr) => {
        const next = { ...curr };
        delete next[cell.id];
        return next;
      });
      onRefresh();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to update settings');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-footnote font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
        <h3 className="text-footnote font-semibold text-label mb-2">Home Cell Settings</h3>
        <p className="text-caption-1 text-secondary-label mb-5">
          Configure default capacity limits, meeting schedules, and venue locations for each home
          cell. Changes will reflect instantly on dashboards and profiles.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-separator/60 dark:border-white/[0.08] bg-system-grouped-background/60 dark:bg-white/[0.03]">
                <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label w-16">
                  Cell #
                </th>
                <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label w-1/4">
                  Cell Name
                </th>
                <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label w-48">
                  Meeting Day
                </th>
                <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label w-32">
                  Max Capacity
                </th>
                <th className="px-4 py-3 text-left text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label">
                  Location / Venue
                </th>
                <th className="px-4 py-3 text-right text-caption-1 font-semibold uppercase tracking-[0.06em] text-tertiary-label w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator/50 dark:divide-white/[0.06]">
              {cells.map((cell) => {
                const cellEdits = editingRow[cell.id] || {};
                const meetingDay =
                  cellEdits.meeting_day !== undefined
                    ? cellEdits.meeting_day
                    : cell.meeting_day || '';
                const maxCapacity =
                  cellEdits.max_capacity !== undefined
                    ? cellEdits.max_capacity
                    : cell.max_capacity || '';
                const location =
                  cellEdits.location !== undefined ? cellEdits.location : cell.location || '';
                const hasChanges =
                  editingRow[cell.id] && Object.keys(editingRow[cell.id]).length > 0;

                return (
                  <tr key={cell.id} className="hover:bg-system-fill/10 transition-colors">
                    <td className="px-4 py-3 text-footnote font-medium text-secondary-label">
                      #{cell.cell_number}
                    </td>
                    <td className="px-4 py-3 text-footnote font-semibold text-label">
                      {cell.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary-label" />
                        <select
                          value={meetingDay}
                          onChange={(e) => handleChange(cell.id, 'meeting_day', e.target.value)}
                          className="select pl-8 py-1 h-8 text-caption-1 font-semibold"
                        >
                          <option value="">— Not Set —</option>
                          {DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <Users className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary-label" />
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={maxCapacity}
                          onChange={(e) => handleChange(cell.id, 'max_capacity', e.target.value)}
                          placeholder="No limit"
                          className="input pl-8 py-1 h-8 text-caption-1 font-semibold w-24"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary-label" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => handleChange(cell.id, 'location', e.target.value)}
                          placeholder="e.g. Leader's residence"
                          className="input pl-8 py-1 h-8 text-caption-1 font-semibold w-full"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSave(cell)}
                        disabled={!hasChanges || savingId === cell.id}
                        className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-caption-1 font-semibold transition-colors ${hasChanges ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-card' : 'bg-system-fill text-tertiary-label cursor-not-allowed'}`}
                      >
                        <Save className="h-3 w-3" />
                        {savingId === cell.id ? '...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {cells.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-footnote text-tertiary-label"
                  >
                    No home cells available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HCSettings;
