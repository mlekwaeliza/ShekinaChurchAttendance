import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { evangelismAPI } from '../services/api';
import SettingsView from '../components/admin/SettingsView';
import {
  Heart, TrendingUp, Users, Calendar, Target, UserPlus, Church, BookOpen,
  BarChart3, Phone, Mail, MapPin, Cross, Award, CheckCircle2, Clock,
  Loader2, X, Plus, Search, Filter, ChevronDown, ChevronUp, Edit3, Trash2,
  Activity, UserCheck, HandHeart, Megaphone, MessageSquare, DollarSign,
  Sparkles, Trophy, Download, Bell
} from 'lucide-react';

const YEAR = new Date().getFullYear();

const STAT_STYLE = 'rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm';

const EvangelistDashboard = ({ subtab: propTab }) => {
  const { tab } = useParams();
  const { user } = useAuth();
  const activeTab = propTab || tab || 'overview';
  const [toast, setToast] = useState(null);

  const showMessage = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  switch (activeTab) {
    case 'settings': return (
      <div className="space-y-6 animate-fade-in">
        {toast && (
          <div className="toast-success mb-6">
            <span>{toast}</span>
          </div>
        )}
        <SettingsView
          leaders={[]}
          loadCoreData={() => {}}
          loadLeaders={() => {}}
          showMessage={showMessage}
        />
      </div>
    );
    case 'outreach': return <OutreachEvents />;
    case 'souls': return <SoulsWonRegistry />;
    case 'follow-ups': return <FollowUpManagement />;
    case 'team': return <EvangelismTeam />;
    case 'baptism': return <BaptismTracking />;
    case 'reports': return <EvangelismReports />;
    default: return <Overview />;
  }
};

// ── Overview ────────────────────────────────────────────────────────
const Overview = () => {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [recentConverts, setRecentConverts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, trendRes, funnelRes, soulsRes] = await Promise.all([
        evangelismAPI.getStats(),
        evangelismAPI.getTrend(),
        evangelismAPI.getFunnel(),
        evangelismAPI.getSoulsWon({ status: 'new_convert' })
      ]);
      setStats(statsRes.data);
      setTrend(trendRes.data);
      setFunnel(funnelRes.data);
      setRecentConverts(soulsRes.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load evangelism data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading dashboard...
    </div>
  );

  const statCards = [
    { label: 'Souls Won This Month', value: stats?.souls_won_month || 0, icon: Heart, color: 'text-rose-600 bg-rose-100' },
    { label: 'Souls Won This Year', value: stats?.souls_won_year || 0, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'New Converts This Week', value: stats?.new_converts_week || 0, icon: UserPlus, color: 'text-blue-600 bg-blue-100' },
    { label: 'New Converts This Month', value: stats?.new_converts_month || 0, icon: Users, color: 'text-violet-600 bg-violet-100' },
    { label: 'Baptisms', value: stats?.baptisms || 0, icon: Cross, color: 'text-amber-600 bg-amber-100' },
    { label: 'Active Outreach', value: stats?.active_outreach || 0, icon: Megaphone, color: 'text-cyan-600 bg-cyan-100' },
    { label: 'Pending Follow-Ups', value: stats?.pending_follow_ups || 0, icon: MessageSquare, color: 'text-orange-600 bg-orange-100' },
    { label: 'Conversion Rate', value: `${stats?.conversion_rate || 0}%`, icon: Activity, color: 'text-indigo-600 bg-indigo-100' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-500 p-8 text-white shadow-xl shadow-amber-500/20">
        <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full bg-white/5 translate-y-24" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight">
            Evangelism Department Report
          </h2>
          <p className="mt-2 max-w-lg text-base text-white/80">
            Overview of souls won, outreach events, follow-ups, and evangelism team performance.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setShowConvertModal(true)} className="btn-primary flex items-center gap-2"><UserPlus className="w-4 h-4" /> Register New Convert</button>
        <button onClick={() => setShowEventModal(true)} className="btn-primary flex items-center gap-2"><Calendar className="w-4 h-4" /> Create Outreach Event</button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={STAT_STYLE}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
                <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Trend Chart + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SoulWinningTrendChart data={trend} />
        <ConversionFunnelChart data={funnel} />
      </div>

      {/* New Converts This Week */}
      <div className={STAT_STYLE}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" /> New Converts This Week
        </h3>
        {recentConverts.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No new converts this week</p>
        ) : (
          <div className="space-y-3">
            {recentConverts.map((soul) => (
              <div key={soul.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold">
                    {soul.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{soul.full_name}</p>
                    <p className="text-xs text-slate-500">Saved: {soul.date_saved ? new Date(soul.date_saved).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  soul.follow_up_status === 'new_convert' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {soul.follow_up_status === 'new_convert' ? 'Follow-Up Pending' : 'Contacted'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConvertModal && <ConvertModal onClose={() => setShowConvertModal(false)} onSaved={load} />}
      {showEventModal && <EventModal onClose={() => setShowEventModal(false)} onSaved={load} />}
    </div>
  );
};

// ── Soul Winning Trend Chart ────────────────────────────────────────
const SoulWinningTrendChart = ({ data }) => (
  <div className={STAT_STYLE}>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
      <TrendingUp className="w-5 h-5 text-primary-500" /> Soul Winning Trend
    </h3>
    {data.length === 0 ? (
      <p className="text-sm text-slate-400 py-8 text-center">No data available</p>
    ) : (
      <div className="space-y-2">
        {data.map((point, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-16">{point.month}</span>
            <div className="flex-1 h-6 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all"
                style={{ width: `${Math.min((point.count / Math.max(...data.map(d => d.count))) * 100, 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{point.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Conversion Funnel Chart ─────────────────────────────────────────
const ConversionFunnelChart = ({ data }) => {
  if (!data) return <div className={STAT_STYLE}><p className="text-sm text-slate-400 py-8 text-center">Loading...</p></div>;
  const stages = [
    { label: 'Visitors', value: data.visitors, color: 'bg-slate-400' },
    { label: 'Saved', value: data.saved, color: 'bg-blue-400' },
    { label: 'Followed Up', value: data.followed_up, color: 'bg-cyan-400' },
    { label: 'Baptized', value: data.baptized, color: 'bg-emerald-400' },
    { label: 'Members', value: data.members, color: 'bg-primary-500' },
  ];
  const maxVal = Math.max(...stages.map(s => s.value), 1);
  return (
    <div className={STAT_STYLE}>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-500" /> Conversion Funnel
      </h3>
      <div className="space-y-3">
        {stages.map((stage, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">{stage.label}</span>
              <span className="font-bold text-slate-900 dark:text-white">{stage.value}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full ${stage.color} transition-all`}
                style={{ width: `${(stage.value / maxVal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Outreach Events ─────────────────────────────────────────────────
const OutreachEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', date: '', location: '', event_type: '', organizer: '', volunteers: '', budget: '', results: '' });

  const load = useCallback(async () => {
    try {
      const res = await evangelismAPI.getOutreachEvents();
      setEvents(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await evangelismAPI.updateOutreachEvent(editing.id, form);
      } else {
        await evangelismAPI.createOutreachEvent(form);
      }
      setShowForm(false); setEditing(null);
      setForm({ name: '', date: '', location: '', event_type: '', organizer: '', volunteers: '', budget: '', results: '' });
      load();
    } catch (err) { alert('Failed to save event'); }
  };

  const handleEdit = (ev) => {
    setEditing(ev);
    setForm({ name: ev.name, date: ev.date?.split('T')[0] || '', location: ev.location || '', event_type: ev.event_type || '', organizer: ev.organizer || '', volunteers: ev.volunteers || '', budget: ev.budget || '', results: ev.results || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try { await evangelismAPI.deleteOutreachEvent(id); load(); }
    catch (err) { alert('Failed to delete'); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Outreach Events</h2>
        <button onClick={() => { setEditing(null); setForm({ name: '', date: '', location: '', event_type: '', organizer: '', volunteers: '', budget: '', results: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Event</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={STAT_STYLE + ' space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label><input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label><input type="text" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})} className="input w-full" placeholder="e.g. Crusade, Door-to-Door" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Organizer</label><input type="text" value={form.organizer} onChange={e => setForm({...form, organizer: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Volunteers</label><input type="number" value={form.volunteers} onChange={e => setForm({...form, volunteers: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Budget</label><input type="number" step="0.01" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="input w-full" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Results</label><input type="text" value={form.results} onChange={e => setForm({...form, results: e.target.value})} className="input w-full" placeholder="e.g. 15 souls won" /></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Save'} Event</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-center py-12 text-slate-400">No outreach events yet</p>
        ) : events.map(ev => (
          <div key={ev.id} className={STAT_STYLE}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{ev.name}</h3>
                  <p className="text-xs text-slate-500">
                    {ev.date ? new Date(ev.date).toLocaleDateString() : ''} {ev.location ? `\u00B7 ${ev.location}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(ev)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {ev.event_type && <span className="px-2 py-1 rounded-full bg-slate-100">{ev.event_type}</span>}
              {ev.organizer && <span><Megaphone className="w-3 h-3 inline mr-1" />{ev.organizer}</span>}
              {ev.volunteers > 0 && <span><Users className="w-3 h-3 inline mr-1" />{ev.volunteers} volunteers</span>}
              {ev.budget > 0 && <span><DollarSign className="w-3 h-3 inline mr-1" />{ev.budget}</span>}
              {ev.results && <span className="text-emerald-600 font-medium">{ev.results}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Souls Won Registry ──────────────────────────────────────────────
const SoulsWonRegistry = () => {
  const [souls, setSouls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '', gender: '', age_group: '', location: '', date_saved: new Date().toISOString().split('T')[0], outreach_event_id: '', soul_winner: '', follow_up_status: 'new_convert', assigned_leader_id: '' });

  const load = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await evangelismAPI.getSoulsWon(params);
      setSouls(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await evangelismAPI.updateSoulWon(editing.id, form);
      } else {
        await evangelismAPI.createSoulWon(form);
      }
      setShowForm(false); setEditing(null);
      setForm({ full_name: '', phone: '', gender: '', age_group: '', location: '', date_saved: new Date().toISOString().split('T')[0], outreach_event_id: '', soul_winner: '', follow_up_status: 'new_convert', assigned_leader_id: '' });
      load();
    } catch (err) { alert('Failed to save record'); }
  };

  const statusOptions = [
    { value: 'new_convert', label: 'New Convert', color: 'bg-amber-100 text-amber-700' },
    { value: 'under_follow_up', label: 'Under Follow-Up', color: 'bg-blue-100 text-blue-700' },
    { value: 'joined_cell', label: 'Joined Cell', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'joined_church', label: 'Joined Church', color: 'bg-violet-100 text-violet-700' },
    { value: 'baptized', label: 'Baptized', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'active_member', label: 'Active Member', color: 'bg-primary-100 text-primary-700' },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Souls Won Registry</h2>
        <div className="flex gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input">
            <option value="">All Statuses</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => { setEditing(null); setForm({ full_name: '', phone: '', gender: '', age_group: '', location: '', date_saved: new Date().toISOString().split('T')[0], outreach_event_id: '', soul_winner: '', follow_up_status: 'new_convert', assigned_leader_id: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Record</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={STAT_STYLE + ' space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label><input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input w-full"><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Age Group</label><select value={form.age_group} onChange={e => setForm({...form, age_group: e.target.value})} className="input w-full"><option value="">Select...</option><option>0-12</option><option>13-17</option><option>18-25</option><option>26-35</option><option>36-50</option><option>50+</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label><input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Date Saved *</label><input type="date" value={form.date_saved} onChange={e => setForm({...form, date_saved: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Soul Winner</label><input type="text" value={form.soul_winner} onChange={e => setForm({...form, soul_winner: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label><select value={form.follow_up_status} onChange={e => setForm({...form, follow_up_status: e.target.value})} className="input w-full">{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Save'} Record</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Contact</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Date Saved</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Soul Winner</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {souls.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No records found</td></tr>
            ) : souls.map(s => {
              const status = statusOptions.find(o => o.value === s.follow_up_status);
              return (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{s.full_name}</td>
                  <td className="py-3 px-4 text-slate-500">{s.phone || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{s.date_saved ? new Date(s.date_saved).toLocaleDateString() : '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{s.soul_winner || '-'}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status?.color || ''}`}>{status?.label || s.follow_up_status}</span></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => { setEditing(s); setForm({ full_name: s.full_name, phone: s.phone || '', gender: s.gender || '', age_group: s.age_group || '', location: s.location || '', date_saved: s.date_saved?.split('T')[0] || '', outreach_event_id: s.outreach_event_id || '', soul_winner: s.soul_winner || '', follow_up_status: s.follow_up_status || 'new_convert', assigned_leader_id: s.assigned_leader_id || '' }); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={async () => { if (window.confirm('Delete this record?')) { try { await evangelismAPI.deleteSoulWon(s.id); load(); } catch (err) { alert('Failed to delete'); } }}} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Follow-Up Management ────────────────────────────────────────────
const FollowUpManagement = () => {
  const [souls, setSouls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [followUps, setFollowUps] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ soul_won_id: '', first_contact_date: '', last_contact_date: '', follow_up_officer: '', home_visit_status: '', counseling_status: '', prayer_needs: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const res = await evangelismAPI.getSoulsWon({});
      setSouls(res.data.filter(s => ['new_convert', 'under_follow_up'].includes(s.follow_up_status)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (soulId) => {
    if (expanded === soulId) { setExpanded(null); return; }
    setExpanded(soulId);
    try {
      const res = await evangelismAPI.getFollowUps(soulId);
      setFollowUps(prev => ({ ...prev, [soulId]: res.data }));
    } catch (err) { console.error(err); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await evangelismAPI.createFollowUp(form);
      setShowForm(false);
      setForm({ soul_won_id: '', first_contact_date: '', last_contact_date: '', follow_up_officer: '', home_visit_status: '', counseling_status: '', prayer_needs: '', notes: '' });
      if (form.soul_won_id) {
        const res = await evangelismAPI.getFollowUps(form.soul_won_id);
        setFollowUps(prev => ({ ...prev, [form.soul_won_id]: res.data }));
      }
      load();
    } catch (err) { alert('Failed to save follow-up'); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Follow-Up Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Follow-Up</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={STAT_STYLE + ' space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Soul Won *</label>
              <select value={form.soul_won_id} onChange={e => setForm({...form, soul_won_id: e.target.value})} className="input w-full" required>
                <option value="">Select...</option>
                {souls.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">First Contact Date</label><input type="date" value={form.first_contact_date} onChange={e => setForm({...form, first_contact_date: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Last Contact Date</label><input type="date" value={form.last_contact_date} onChange={e => setForm({...form, last_contact_date: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Follow-Up Officer</label><input type="text" value={form.follow_up_officer} onChange={e => setForm({...form, follow_up_officer: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Home Visit Status</label><input type="text" value={form.home_visit_status} onChange={e => setForm({...form, home_visit_status: e.target.value})} className="input w-full" placeholder="e.g. Completed, Pending" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Counseling Status</label><input type="text" value={form.counseling_status} onChange={e => setForm({...form, counseling_status: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Prayer Needs</label><input type="text" value={form.prayer_needs} onChange={e => setForm({...form, prayer_needs: e.target.value})} className="input w-full" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label><input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input w-full" /></div>
          </div>
          <button type="submit" className="btn-primary">Save Follow-Up</button>
        </form>
      )}

      <div className="space-y-3">
        {souls.length === 0 ? (
          <p className="text-center py-12 text-slate-400">No souls awaiting follow-up</p>
        ) : souls.map(soul => (
          <div key={soul.id} className={STAT_STYLE}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(soul.id)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">
                  {soul.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{soul.full_name}</p>
                  <p className="text-xs text-slate-500">Saved: {soul.date_saved ? new Date(soul.date_saved).toLocaleDateString() : 'N/A'} {soul.soul_winner ? `\u00B7 ${soul.soul_winner}` : ''}</p>
                </div>
              </div>
              {expanded === soul.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
            {expanded === soul.id && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                {(followUps[soul.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No follow-up records yet</p>
                ) : followUps[soul.id].map(fu => (
                  <div key={fu.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span><UserCheck className="w-3 h-3 inline mr-1" />{fu.follow_up_officer || 'Unassigned'}</span>
                      <span><Clock className="w-3 h-3 inline mr-1" />{fu.last_contact_date ? new Date(fu.last_contact_date).toLocaleDateString() : 'No contact'}</span>
                    </div>
                    {fu.home_visit_status && <span className="inline-block mr-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{fu.home_visit_status}</span>}
                    {fu.counseling_status && <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">{fu.counseling_status}</span>}
                    {fu.prayer_needs && <p className="mt-2 text-slate-600"><HandHeart className="w-3 h-3 inline mr-1" />{fu.prayer_needs}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Evangelism Team ─────────────────────────────────────────────────
const EvangelismTeam = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: '', role: 'evangelist', phone: '', email: '', section: '', souls_won: 0 });

  const load = useCallback(async () => {
    try { const res = await evangelismAPI.getTeam(); setTeam(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await evangelismAPI.updateTeamMember(editing.id, form); }
      else { await evangelismAPI.createTeamMember(form); }
      setShowForm(false); setEditing(null);
      setForm({ full_name: '', role: 'evangelist', phone: '', email: '', section: '', souls_won: 0 });
      load();
    } catch (err) { alert('Failed to save'); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const roleOptions = [
    { value: 'evangelist', label: 'Evangelist' },
    { value: 'section_evangelist', label: 'Section Evangelist' },
    { value: 'volunteer', label: 'Outreach Volunteer' },
    { value: 'soul_winner', label: 'Soul Winner' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Evangelism Team</h2>
        <button onClick={() => { setEditing(null); setForm({ full_name: '', role: 'evangelist', phone: '', email: '', section: '', souls_won: 0 }); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Member</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={STAT_STYLE + ' space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label><input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Role</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input w-full">{roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Section</label><input type="text" value={form.section} onChange={e => setForm({...form, section: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Souls Won</label><input type="number" value={form.souls_won} onChange={e => setForm({...form, souls_won: parseInt(e.target.value) || 0})} className="input w-full" /></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add'} Member</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Leaderboard */}
      <div className={STAT_STYLE}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Soul Winner Leaderboard
        </h3>
        {team.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No team members yet</p>
        ) : (
          <div className="space-y-2">
            {[...team].sort((a, b) => b.souls_won - a.souls_won).map((member, i) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{member.full_name}</p>
                    <p className="text-xs text-slate-500">{roleOptions.find(o => o.value === member.role)?.label || member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600">{member.souls_won}</p>
                  <p className="text-xs text-slate-400">souls won</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team List */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Section</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Contact</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600">Souls Won</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {team.map(m => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">{m.full_name}</td>
                <td className="py-3 px-4"><span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700">{roleOptions.find(o => o.value === m.role)?.label || m.role}</span></td>
                <td className="py-3 px-4 text-slate-600">{m.section || '-'}</td>
                <td className="py-3 px-4 text-slate-500">{m.phone || m.email || '-'}</td>
                <td className="py-3 px-4 text-right font-bold text-primary-600">{m.souls_won}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => { setEditing(m); setForm({ full_name: m.full_name, role: m.role, phone: m.phone || '', email: m.email || '', section: m.section || '', souls_won: m.souls_won }); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={async () => { if (window.confirm('Remove this member?')) { try { await evangelismAPI.deleteTeamMember(m.id); load(); } catch (err) { alert('Failed to delete'); } }}} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Baptism Tracking ────────────────────────────────────────────────
const BaptismTracking = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ soul_won_id: '', candidate_name: '', salvation_date: '', baptism_date: '', baptized_by: '', status: 'candidate' });

  const load = useCallback(async () => {
    try { const res = await evangelismAPI.getBaptismRecords(); setRecords(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await evangelismAPI.updateBaptismRecord(editing.id, form); }
      else { await evangelismAPI.createBaptismRecord(form); }
      setShowForm(false); setEditing(null);
      setForm({ soul_won_id: '', candidate_name: '', salvation_date: '', baptism_date: '', baptized_by: '', status: 'candidate' });
      load();
    } catch (err) { alert('Failed to save'); }
  };

  const statusOptions = [
    { value: 'candidate', label: 'Candidate', color: 'bg-amber-100 text-amber-700' },
    { value: 'class', label: 'In Class', color: 'bg-blue-100 text-blue-700' },
    { value: 'scheduled', label: 'Scheduled', color: 'bg-violet-100 text-violet-700' },
    { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Baptism Tracking</h2>
        <button onClick={() => { setEditing(null); setForm({ soul_won_id: '', candidate_name: '', salvation_date: '', baptism_date: '', baptized_by: '', status: 'candidate' }); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Candidate</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={STAT_STYLE + ' space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name *</label><input type="text" value={form.candidate_name} onChange={e => setForm({...form, candidate_name: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Salvation Date</label><input type="date" value={form.salvation_date} onChange={e => setForm({...form, salvation_date: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Baptism Date</label><input type="date" value={form.baptism_date} onChange={e => setForm({...form, baptism_date: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Baptized By</label><input type="text" value={form.baptized_by} onChange={e => setForm({...form, baptized_by: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input w-full">{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add'} Candidate</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Candidate</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Salvation Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Baptism Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Baptized By</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No baptism records yet</td></tr>
            ) : records.map(r => {
              const st = statusOptions.find(o => o.value === r.status);
              return (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{r.candidate_name}</td>
                  <td className="py-3 px-4 text-slate-600">{r.salvation_date ? new Date(r.salvation_date).toLocaleDateString() : '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{r.baptism_date ? new Date(r.baptism_date).toLocaleDateString() : '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{r.baptized_by || '-'}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st?.color || ''}`}>{st?.label || r.status}</span></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => { setEditing(r); setForm({ soul_won_id: r.soul_won_id || '', candidate_name: r.candidate_name, salvation_date: r.salvation_date?.split('T')[0] || '', baptism_date: r.baptism_date?.split('T')[0] || '', baptized_by: r.baptized_by || '', status: r.status }); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={async () => { if (window.confirm('Delete this record?')) { try { await evangelismAPI.deleteBaptismRecord(r.id); load(); } catch { alert('Failed to delete'); } }}} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Evangelism Reports ──────────────────────────────────────────────
const EvangelismReports = () => {
  const [year, setYear] = useState(YEAR);
  const [monthly, setMonthly] = useState([]);
  const [annual, setAnnual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [monthlyRes, annualRes] = await Promise.all([
          evangelismAPI.getMonthlyReport(year),
          evangelismAPI.getAnnualReport(year)
        ]);
        setMonthly(monthlyRes.data);
        setAnnual(annualRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [year]);

  const totalSouls = monthly.reduce((sum, m) => sum + m.souls_won, 0);
  const totalMembers = monthly.reduce((sum, m) => sum + (m.members_added || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Evangelism Reports</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input w-32">
          {Array.from({ length: 5 }, (_, i) => YEAR - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={STAT_STYLE}>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Outreach Events</p>
          <p className="text-2xl font-bold text-slate-900">{monthly.length}</p>
        </div>
        <div className={STAT_STYLE}>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Souls Won</p>
          <p className="text-2xl font-bold text-emerald-600">{totalSouls}</p>
        </div>
        <div className={STAT_STYLE}>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Baptized</p>
          <p className="text-2xl font-bold text-blue-600">{annual?.baptisms || 0}</p>
        </div>
        <div className={STAT_STYLE}>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Members Added</p>
          <p className="text-2xl font-bold text-primary-600">{totalMembers}</p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className={STAT_STYLE}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Monthly Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Month</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Souls Won</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Members Added</th>
              </tr>
            </thead>
            <tbody>
              {monthly.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-slate-400">No data for {year}</td></tr>
              ) : monthly.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="py-3 px-4 text-slate-800 font-medium">
                    {new Date(parseInt(row.month) - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 font-bold">{row.souls_won}</td>
                  <td className="py-3 px-4 text-right text-primary-600 font-bold">{row.members_added || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Annual Summary */}
      {annual && (
        <div className={STAT_STYLE}>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Annual Report {year}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-center">
              <p className="text-2xl font-bold text-slate-900">{annual.souls_won || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Souls Won</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-center">
              <p className="text-2xl font-bold text-primary-600">{annual.members_added || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Members Added</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Convert Modal ──────────────────────────────────────────────────
const ConvertModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ full_name: '', phone: '', gender: '', age_group: '', location: '', date_saved: new Date().toISOString().split('T')[0], soul_winner: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await evangelismAPI.createSoulWon(form);
      onSaved();
      onClose();
    } catch (err) { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-modal">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Register New Convert</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label><input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input w-full" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input w-full"><option value="">Select</option><option>Male</option><option>Female</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Age Group</label><select value={form.age_group} onChange={e => setForm({...form, age_group: e.target.value})} className="input w-full"><option value="">Select</option><option>0-12</option><option>13-17</option><option>18-25</option><option>26-35</option><option>36-50</option><option>50+</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Date Saved</label><input type="date" value={form.date_saved} onChange={e => setForm({...form, date_saved: e.target.value})} className="input w-full" required /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Soul Winner</label><input type="text" value={form.soul_winner} onChange={e => setForm({...form, soul_winner: e.target.value})} className="input w-full" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label><input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input w-full" /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Register Convert'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Event Modal (quick create) ──────────────────────────────────────
const EventModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', date: '', location: '', event_type: '', organizer: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await evangelismAPI.createOutreachEvent(form);
      onSaved();
      onClose();
    } catch (err) { alert('Failed to create'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-modal">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Outreach Event</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Event Name *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input w-full" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input w-full" required /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Location</label><input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input w-full" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label><input type="text" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})} className="input w-full" placeholder="e.g. Crusade" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Organizer</label><input type="text" value={form.organizer} onChange={e => setForm({...form, organizer: e.target.value})} className="input w-full" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create Event'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvangelistDashboard;
