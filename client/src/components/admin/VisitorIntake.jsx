import React, { useEffect, useState } from 'react';
import { UserPlus, Save, Phone, Mail, MapPin } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { handlePhoneChange, capitalizeName } from '../../utils/phone';

const VisitorIntake = ({ showMessage }) => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    invitation_source: '',
    address: '',
    notes: ''
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (key, value) => {
    if (key === 'full_name') value = capitalizeName(value);
    if (key === 'phone') value = handlePhoneChange(value);
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
        full_name: form.full_name.trim()
      });
      setForm({
        full_name: '',
        phone: '',
        email: '',
        invitation_source: '',
        address: '',
        notes: ''
      });
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
      <div className="card flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
          <UserPlus className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
        <div>
          <h2 className="text-title-2 font-semibold text-label">Visitor Intake</h2>
          <p className="mt-0.5 text-footnote text-secondary-label">
            Capture first-time visitors and keep follow-up visible.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={saveVisitor}
          className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]"
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                Full Name
              </label>
              <input
                value={form.full_name}
                onChange={(event) => updateField('full_name', event.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const v = capitalizeName(e.clipboardData.getData('text'));
                  updateField('full_name', v);
                }}
                className="input w-full"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Email
                </label>
                <input
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Invitation Source
                </label>
                <select
                  value={form.invitation_source}
                  onChange={(event) => updateField('invitation_source', event.target.value)}
                  className="select w-full"
                >
                  <option value="">Select...</option>
                  <option value="Friend">Friend</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Church Outreach">Church Outreach</option>
                  <option value="Family Member">Family Member</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                  Address
                </label>
                <input
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  className="input w-full"
                  placeholder="e.g. 123 Main St"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-caption-1 font-semibold uppercase tracking-[0.06em] text-secondary-label">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className="input min-h-[120px] w-full resize-y"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-footnote font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Visitor'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-5 shadow-card dark:border-white/[0.08]">
          <div className="mb-4">
            <h3 className="text-subheadline font-semibold text-label">Recent Visitors</h3>
            <p className="text-footnote text-secondary-label">
              {visitors.length} captured visitor{visitors.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center text-footnote font-medium text-secondary-label dark:border-white/[0.08] dark:text-tertiary-label">
                Loading visitors...
              </div>
            ) : visitors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/[0.06] p-8 text-center text-footnote font-medium text-secondary-label dark:border-white/[0.08] dark:text-tertiary-label">
                No visitors captured yet.
              </div>
            ) : (
              visitors.map((visitor) => (
                <div
                  key={visitor.id}
                  className="rounded-xl border border-black/[0.06] bg-system-fill p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <p className="font-semibold text-label">{visitor.full_name}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-caption-1 text-secondary-label">
                    {visitor.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {visitor.phone}
                      </span>
                    )}
                    {visitor.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {visitor.email}
                      </span>
                    )}
                    {visitor.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {visitor.address}
                      </span>
                    )}
                    {visitor.invitation_source && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {visitor.invitation_source}
                      </span>
                    )}
                  </div>
                  {visitor.notes && (
                    <p className="mt-2 text-footnote text-secondary-label">{visitor.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VisitorIntake;
