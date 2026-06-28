import React, { useState, useEffect, useCallback } from 'react';
import { newMemberLeaderAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import VisitorIntake from './VisitorIntake';
import { fdate, fdatetime } from '../../utils/date';
import {
  Users, UserPlus, GraduationCap, BarChart3, Calendar, CheckCircle2, X, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Search, Phone, Mail, MapPin, FileText, Clock, BookOpen
} from 'lucide-react';

const TABS = [
  { key: 'probation', label: 'Probationary Members', icon: Users },
  { key: 'graduated', label: 'Graduated Members', icon: GraduationCap },
  { key: 'permanent', label: 'Permanent Members', icon: CheckCircle2 },
  { key: 'visitors', label: 'Visitors', icon: UserPlus },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

const WEEK_OFFSETS = [0, 1, 2, 3];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const NewMemberLeaderView = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('probation');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', address: '',
    date_joined: new Date().toISOString().split('T')[0],
    decision_type: '', marital_status: '', date_of_birth: '', occupation: '', invitation_source: '', mentor_id: '', notes: ''
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
        full_name: '', phone: '', email: '', address: '',
        date_joined: new Date().toISOString().split('T')[0],
        decision_type: '', marital_status: '', date_of_birth: '', occupation: '', invitation_source: '', mentor_id: '', notes: ''
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
      res.data.forEach(r => { attMap[r.week_start] = r; });
      setAttendance(prev => ({ ...prev, [memberId]: attMap }));
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  const toggleAttendance = async (memberId, weekStart, currentValue) => {
    const newValue = currentValue ? 0 : 1;
    try {
      await newMemberLeaderAPI.recordAttendance(memberId, weekStart, newValue, '');
      setAttendance(prev => ({
        ...prev,
        [memberId]: { ...prev[memberId], [weekStart]: { week_start: weekStart, attended: newValue } }
      }));
    } catch (err) {
      console.error('Failed to update attendance:', err);
    }
  };

  const handleGraduate = async (memberId) => {
    try {
      const res = await newMemberLeaderAPI.getSectionWithLeastMembers();
      const suggested = res.data;
      if (!suggested) { alert('No sections available'); return; }
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
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-purple-500/20">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New Members Department</h1>
              <p className="text-sm text-white/80 font-medium mt-0.5">
                Manage probationary, graduated, and permanent members
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-purple-700 font-semibold text-sm shadow-lg hover:bg-purple-50 transition-colors">
            <UserPlus className="w-4 h-4" /> Add New Member
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="input w-full" required placeholder="e.g. John Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="input w-full" placeholder="e.g. +254 7XX XXX XXX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="input w-full" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date Joined</label>
              <input type="date" value={form.date_joined} onChange={e => setForm({ ...form, date_joined: e.target.value })}
                className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Decision Type</label>
              <select value={form.decision_type} onChange={e => setForm({ ...form, decision_type: e.target.value })}
                className="input w-full">
                <option value="">Select...</option>
                <option value="Salvation">Salvation</option>
                <option value="Transfer">Transfer</option>
                <option value="Restoration">Restoration</option>
                <option value="Visitor">Visitor</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marital Status</label>
              <select value={form.marital_status} onChange={e => setForm({ ...form, marital_status: e.target.value })}
                className="input w-full">
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
              <input type="text" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })}
                className="input w-full" placeholder="e.g. Student, Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invitation Source</label>
              <select value={form.invitation_source} onChange={e => setForm({ ...form, invitation_source: e.target.value })}
                className="input w-full">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="input w-full" placeholder="Any notes" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="input w-full" placeholder="Physical address" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">Save Member</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
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
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No {activeTab} members found</div>
          ) : members.map(member => {
            const memberAttendance = attendance[member.id] || {};
            const attendedCount = weeks.filter(w => memberAttendance[w]?.attended).length;
            const readyToGraduate = activeTab === 'probation' && attendedCount >= 3 && weeks.length > 0;

            return (
              <div key={member.id} className="card">
                <div className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(member.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold">
                        {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{member.full_name}</h3>
                        <p className="text-xs text-slate-500">
                          Joined: {fdate(member.date_joined)}
                          {member.decision_type ? ` \u00B7 ${member.decision_type}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {activeTab === 'probation' && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        attendedCount >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {attendedCount}/4 weeks
                      </span>
                    )}
                    {activeTab === 'graduated' && member.section_name && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {member.section_name}
                      </span>
                    )}
                    {expanded === member.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {expanded === member.id && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      {member.phone && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {member.phone}
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {member.email}
                        </div>
                      )}
                      {member.address && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {member.address}
                        </div>
                      )}
                      {member.marital_status && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-semibold text-slate-400 text-xs">Marital:</span> {member.marital_status}
                        </div>
                      )}
                      {member.date_of_birth && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-semibold text-slate-400 text-xs">DOB:</span> {fdate(member.date_of_birth)}
                        </div>
                      )}
                      {member.occupation && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-semibold text-slate-400 text-xs">Occupation:</span> {member.occupation}
                        </div>
                      )}
                      {member.invitation_source && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-semibold text-slate-400 text-xs">Source:</span> {member.invitation_source}
                        </div>
                      )}
                    </div>
                    {member.notes && (
                      <p className="text-sm text-slate-500 flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" /> {member.notes}
                      </p>
                    )}

                    {activeTab === 'probation' && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" /> Weekly Attendance (4 weeks)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {weeks.map(week => {
                            const record = memberAttendance[week];
                            const att = record?.attended || 0;
                            return (
                              <button key={week} onClick={() => toggleAttendance(member.id, week, att)}
                                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                                  att ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}>
                                {fdate(week)}
                                {att ? ' \u2713' : ''}
                              </button>
                            );
                          })}
                        </div>
                        {readyToGraduate && (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => handleGraduate(member.id)}
                              className="btn-primary text-xs flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Graduate to Section
                            </button>
                            <button onClick={() => handleMakePermanent(member.id)}
                              className="btn-secondary text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Permanent
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button onClick={() => handleDelete(member.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1">
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
        <Clock className="w-4 h-4 text-slate-400" />
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input w-32">
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">New Members Report</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No data for {year}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">Month</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Probation</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Graduated</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Permanent</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-800">
                    {fdate(row.month + '-01')}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">{row.probation || 0}</td>
                  <td className="py-3 px-4 text-right text-emerald-600 font-medium">{row.graduated || 0}</td>
                  <td className="py-3 px-4 text-right text-blue-600 font-medium">{row.permanent || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NewMemberLeaderView;
