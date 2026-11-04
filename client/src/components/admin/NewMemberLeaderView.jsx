import React, { useState, useEffect, useCallback } from 'react';
import { newMemberLeaderAPI } from '../../services/api';
import VisitorIntake from './VisitorIntake';
import { fdate, fdatetime } from '../../utils/date';
import { capitalizeName } from '../../utils/phone';
import { handlePhoneChange } from '../../utils/phone';
import {
  Users,
  UserPlus,
  GraduationCap,
  BarChart3,
  Calendar,
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock
} from 'lucide-react';

const TABS = [
  { key: 'probation', label: 'Probationary Members', icon: Users },
  { key: 'graduated', label: 'Graduated Members', icon: GraduationCap },
  { key: 'permanent', label: 'Permanent Members', icon: CheckCircle2 },
  { key: 'visitors', label: 'Visitors', icon: UserPlus },
  { key: 'reports', label: 'Reports', icon: BarChart3 }
];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const ReportsView = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await newMemberLeaderAPI.getReport({ year });
        setData(result.data);
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-tertiary-label" />
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="input w-32"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-footnote text-secondary-label">New Members Report</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-tertiary-label">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-tertiary-label">No data for {year}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-footnote">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <th className="text-left py-3 px-4 font-medium text-secondary-label">Month</th>
                <th className="text-right py-3 px-4 font-medium text-secondary-label">Probation</th>
                <th className="text-right py-3 px-4 font-medium text-secondary-label">Graduated</th>
                <th className="text-right py-3 px-4 font-medium text-secondary-label">Permanent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.month}
                  className="border-b border-separator/60 hover:bg-system-grouped-background/60"
                >
                  <td className="py-3 px-4 text-label">{fdate(row.month + '-01')}</td>
                  <td className="py-3 px-4 text-right text-secondary-label">
                    {row.probation || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                    {row.graduated || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-600 font-medium">
                    {row.permanent || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const NewMemberLeaderView = () => {
  const [activeTab, setActiveTab] = useState('probation');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, setSections] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    date_joined: new Date().toISOString().split('T')[0],
    decision_type: '',
    marital_status: '',
    date_of_birth: '',
    occupation: '',
    invitation_source: '',
    mentor_id: '',
    notes: ''
  });

  const showMessage = useCallback((text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const loadMembers = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await newMemberLeaderAPI.getNewMembers(status);
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSections = useCallback(async () => {
    try {
      const res = await newMemberLeaderAPI.getSections();
      setSections(res.data);
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'reports') {
      loadMembers(activeTab);
    }
  }, [activeTab, loadMembers]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    try {
      await newMemberLeaderAPI.createNewMember(form);
      showMessage('New member added successfully');
      setShowForm(false);
      setForm({
        full_name: '',
        phone: '',
        email: '',
        address: '',
        date_joined: new Date().toISOString().split('T')[0],
        decision_type: '',
        marital_status: '',
        date_of_birth: '',
        occupation: '',
        invitation_source: '',
        mentor_id: '',
        notes: ''
      });
      loadMembers(activeTab);
    } catch (err) {
      alert('Failed to add member: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleExpand = async (memberId) => {
    if (expanded === memberId) {
      setExpanded(null);
      return;
    }
    setExpanded(memberId);
    try {
      const res = await newMemberLeaderAPI.getAttendance(memberId);
      const attMap = {};
      res.data.forEach((r) => {
        attMap[r.week_start] = r;
      });
      setAttendance((prev) => ({ ...prev, [memberId]: attMap }));
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  const toggleAttendance = async (memberId, weekStart, currentValue) => {
    const newValue = currentValue ? 0 : 1;
    try {
      await newMemberLeaderAPI.recordAttendance(memberId, weekStart, newValue, '');
      setAttendance((prev) => ({
        ...prev,
        [memberId]: {
          ...prev[memberId],
          [weekStart]: { week_start: weekStart, attended: newValue }
        }
      }));
    } catch (err) {
      console.error('Failed to update attendance:', err);
    }
  };

  const handleGraduate = async (memberId) => {
    try {
      const res = await newMemberLeaderAPI.getSectionWithLeastMembers();
      const suggested = res.data;
      if (!suggested) {
        alert('No sections available');
        return;
      }
      await newMemberLeaderAPI.graduateNewMember(memberId, suggested.id);
      showMessage(`Member graduated to ${suggested.name} section`);
      loadMembers(activeTab);
    } catch (err) {
      alert('Failed to graduate: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleMakePermanent = async (memberId) => {
    try {
      await newMemberLeaderAPI.makePermanent(memberId);
      showMessage('Member marked as permanent');
      loadMembers(activeTab);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm('Delete this new member record?')) return;
    try {
      await newMemberLeaderAPI.deleteNewMember(memberId);
      showMessage('Member record deleted');
      loadMembers(activeTab);
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  const weeks = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i * 7);
    return getWeekStart(d);
  });

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-footnote">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="card flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/10">
            <GraduationCap className="h-5 w-5 text-primary-700 dark:text-primary-300" />
          </div>
          <div>
            <h1 className="text-title-1 font-semibold tracking-tight text-label">
              New Members Department
            </h1>
            <p className="mt-0.5 text-footnote font-medium text-secondary-label">
              Manage probationary, graduated, and permanent members
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0">
          <UserPlus className="h-4 w-4" /> Add New Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: capitalizeName(e.target.value) })}
                onPaste={(e) => {
                  e.preventDefault();
                  setForm({ ...form, full_name: capitalizeName(e.clipboardData.getData('text')) });
                }}
                className="input w-full"
                required
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: handlePhoneChange(e.target.value) })}
                className="input w-full"
                placeholder="+255 XXX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input w-full"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Date Joined
              </label>
              <input
                type="date"
                value={form.date_joined}
                onChange={(e) => setForm({ ...form, date_joined: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Decision Type
              </label>
              <select
                value={form.decision_type}
                onChange={(e) => setForm({ ...form, decision_type: e.target.value })}
                className="input w-full"
              >
                <option value="">Select...</option>
                <option value="Salvation">Salvation</option>
                <option value="Transfer">Transfer</option>
                <option value="Restoration">Restoration</option>
                <option value="Visitor">Visitor</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Marital Status
              </label>
              <select
                value={form.marital_status}
                onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
                className="input w-full"
              >
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Occupation
              </label>
              <input
                type="text"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                className="input w-full"
                placeholder="e.g. Student, Engineer"
              />
            </div>
            <div>
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Invitation Source
              </label>
              <select
                value={form.invitation_source}
                onChange={(e) => setForm({ ...form, invitation_source: e.target.value })}
                className="input w-full"
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
              <label className="block text-footnote font-medium text-secondary-label mb-1">
                Notes
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input w-full"
                placeholder="Any notes"
              />
            </div>
          </div>
          <div>
            <label className="block text-footnote font-medium text-secondary-label mb-1">
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input w-full"
              placeholder="Physical address"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">
              Save Member
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-1 border-b border-black/[0.06] overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-footnote font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-secondary-label hover:text-secondary-label'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'reports' ? (
        <ReportsView />
      ) : activeTab === 'visitors' ? (
        <VisitorIntake showMessage={showMessage} />
      ) : (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-tertiary-label">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-tertiary-label">
              No {activeTab} members found
            </div>
          ) : (
            members.map((member) => {
              const memberAttendance = attendance[member.id] || {};
              const attendedCount = weeks.filter((w) => memberAttendance[w]?.attended).length;
              const readyToGraduate =
                activeTab === 'probation' && attendedCount >= 3 && weeks.length > 0;

              return (
                <div key={member.id} className="card">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(member.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-footnote font-semibold">
                          {member.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-label">{member.full_name}</h3>
                          <p className="text-caption-1 text-secondary-label">
                            Joined: {fdatetime(member.date_joined)}
                            {member.decision_type ? ` \u00B7 ${member.decision_type}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {activeTab === 'probation' && (
                        <span
                          className={`text-caption-1 font-medium px-2 py-1 rounded-full ${
                            attendedCount >= 3
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {attendedCount}/4 weeks
                        </span>
                      )}
                      {activeTab === 'graduated' && member.section_name && (
                        <span className="text-caption-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {member.section_name}
                        </span>
                      )}
                      {expanded === member.id ? (
                        <ChevronUp className="w-4 h-4 text-tertiary-label" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-tertiary-label" />
                      )}
                    </div>
                  </div>

                  {expanded === member.id && (
                    <div className="border-t border-separator/60 px-4 py-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-footnote">
                        {member.phone && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <Phone className="w-3.5 h-3.5 text-tertiary-label" /> {member.phone}
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <Mail className="w-3.5 h-3.5 text-tertiary-label" /> {member.email}
                          </div>
                        )}
                        {member.address && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <MapPin className="w-3.5 h-3.5 text-tertiary-label" /> {member.address}
                          </div>
                        )}
                        {member.marital_status && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <span className="font-semibold text-tertiary-label text-caption-1">
                              Marital:
                            </span>{' '}
                            {member.marital_status}
                          </div>
                        )}
                        {member.date_of_birth && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <span className="font-semibold text-tertiary-label text-caption-1">
                              DOB:
                            </span>{' '}
                            {fdate(member.date_of_birth)}
                          </div>
                        )}
                        {member.occupation && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <span className="font-semibold text-tertiary-label text-caption-1">
                              Occupation:
                            </span>{' '}
                            {member.occupation}
                          </div>
                        )}
                        {member.invitation_source && (
                          <div className="flex items-center gap-2 text-secondary-label">
                            <span className="font-semibold text-tertiary-label text-caption-1">
                              Source:
                            </span>{' '}
                            {member.invitation_source}
                          </div>
                        )}
                      </div>
                      {member.notes && (
                        <p className="text-footnote text-secondary-label flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-tertiary-label mt-0.5 shrink-0" />{' '}
                          {member.notes}
                        </p>
                      )}

                      {activeTab === 'probation' && (
                        <div>
                          <h4 className="text-footnote font-medium text-secondary-label mb-2 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> Weekly Attendance (4 weeks)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {weeks.map((week) => {
                              const record = memberAttendance[week];
                              const att = record?.attended || 0;
                              return (
                                <button
                                  key={week}
                                  onClick={() => toggleAttendance(member.id, week, att)}
                                  className={`px-3 py-1.5 text-caption-1 rounded-lg border transition-colors ${
                                    att
                                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                      : 'bg-system-fill border-black/[0.06] text-secondary-label hover:bg-system-fill'
                                  }`}
                                >
                                  {fdate(week)}
                                  {att ? ' \u2713' : ''}
                                </button>
                              );
                            })}
                          </div>
                          {readyToGraduate && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleGraduate(member.id)}
                                className="btn-primary text-caption-1 flex items-center gap-1.5"
                              >
                                <GraduationCap className="w-3.5 h-3.5" /> Graduate to Section
                              </button>
                              <button
                                onClick={() => handleMakePermanent(member.id)}
                                className="btn-secondary text-caption-1 flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Permanent
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-separator/60">
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="text-caption-1 text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
export default NewMemberLeaderView;
