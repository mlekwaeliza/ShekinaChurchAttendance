import React, { useEffect, useState } from 'react';
import { UserPlus, Save, Phone, Mail, MapPin } from 'lucide-react';
import { adminAPI } from '../../services/api';

const VisitorIntake = ({ sections = [], showMessage }) => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    section_interest: '',
    notes: '',
  });

  const loadVisitors = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVisitors();
      setVisitors(res.data || []);
    } catch (error) {
      console.error('Failed to load visitors:', error);
      showMessage?.('Failed to load visitor intake.', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
  }, []);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveVisitor = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim()) {
      showMessage?.('Visitor name is required.', 4000);
      return;
    }

    setSaving(true);
    try {
      await adminAPI.createVisitor({
        ...form,
        full_name: form.full_name.trim(),
      });
      setForm({ full_name: '', phone: '', email: '', section_interest: '', notes: '' });
      await loadVisitors();
      showMessage?.(`${form.full_name.trim()} added to visitor intake.`);
    } catch (error) {
      showMessage?.(error.response?.data?.error || 'Failed to save visitor.', 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Visitor Intake</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Capture first-time visitors and keep follow-up visible.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={saveVisitor} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Full Name</label>
              <input value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} className="input w-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Phone</label>
                <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email</label>
                <input value={form.email} onChange={(event) => updateField('email', event.target.value)} className="input w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Section Interest</label>
              <select value={form.section_interest} onChange={(event) => updateField('section_interest', event.target.value)} className="select w-full">
                <option value="">Not assigned yet</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.name}>{section.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notes</label>
              <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="input min-h-[120px] w-full resize-y" />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Visitor'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Recent Visitors</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{visitors.length} captured visitor{visitors.length === 1 ? '' : 's'}</p>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Loading visitors...
              </div>
            ) : visitors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No visitors captured yet.
              </div>
            ) : visitors.map((visitor) => (
              <div key={visitor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
                <p className="font-bold text-slate-900 dark:text-slate-100">{visitor.full_name}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {visitor.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{visitor.phone}</span>}
                  {visitor.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{visitor.email}</span>}
                  {visitor.section_interest && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{visitor.section_interest}</span>}
                </div>
                {visitor.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{visitor.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VisitorIntake;
