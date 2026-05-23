import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Phone, Mail, Home, Calendar, Search, User, Users, 
  TrendingUp, Activity, Check, CheckCircle, Flag, Stethoscope, Heart, Info, Clock, CheckSquare 
} from 'lucide-react';
import DataTable from '../ui/DataTable';
import Modal from '../ui/Modal';
import { outreachAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'absent', label: 'Absent Last Service' },
  { id: 'default_not_contacted', label: 'Not Contacted' },
  { id: 'birthdays', label: 'Birthdays This Week' },
  { id: 'visitors', label: 'New Visitors' },
  { id: 'flagged', label: 'Sick/Flagged' },
  { id: 'overdue', label: 'Overdue Follow-ups' },
  { id: 'all', label: 'All My Members' },
];

export default function LeaderOutreach({ serviceTypes, currentServiceId }) {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState('log'); // 'log' | 'history'
  const [activeFilterTab, setActiveFilterTab] = useState('absent');
  const [search, setSearch] = useState('');
  
  const [stats, setStats] = useState({ thisWeek: 0, membersContacted: 0, notContacted: 0, totalLogs: 0 });
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaders, setLeaders] = useState([]);
  
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [logForm, setLogForm] = useState({
    contact_method: '',
    outcome: '',
    service_id: currentServiceId || 'all',
    message: '',
    new_prayer_request: '',
    follow_up_needed: false,
    assigned_to_user_id: '',
    due_date: '',
    add_to_hall_of_fame: false,
    add_flag: false,
    flag_reason: '',
    flag_expires_at: ''
  });

  useEffect(() => {
    loadData();
    loadLeaders();
  }, [activeFilterTab, currentServiceId]);

  useEffect(() => {
    if (activeMainTab === 'history') loadHistory();
  }, [activeMainTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, membersRes] = await Promise.all([
        outreachAPI.getStats(),
        outreachAPI.getMembers({ filter: activeFilterTab, service_id: currentServiceId })
      ]);
      setStats(statsRes.data);
      setMembers(membersRes.data);
    } catch (e) {
      console.error('Failed to load outreach data', e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await outreachAPI.getHistory();
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLeaders = async () => {
    try {
      const res = await outreachAPI.getLeaders();
      setLeaders(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenLog = (member, defaultMethod = '') => {
    setSelectedMember(member);
    setLogForm({
      contact_method: defaultMethod,
      outcome: '',
      service_id: currentServiceId || 'all',
      message: '',
      new_prayer_request: '',
      follow_up_needed: false,
      assigned_to_user_id: user?.id || '',
      due_date: '',
      add_to_hall_of_fame: defaultMethod === 'Hospital Visit' || member.status === 'Visitor',
      add_flag: false,
      flag_reason: '',
      flag_expires_at: ''
    });
    setShowLogModal(true);
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!selectedMember || !logForm.contact_method || !logForm.outcome) return;

    setSaving(true);
    try {
      const payload = { ...logForm, member_id: selectedMember.id, points: logForm.contact_method === 'Visitor Follow-up' ? 20 : logForm.contact_method === 'Hospital Visit' ? 15 : logForm.contact_method === 'Counseling' ? 10 : 5 };
      if (logForm.add_flag && logForm.flag_reason) {
        payload.new_flags = [{ reason: logForm.flag_reason, expires_at: logForm.flag_expires_at || null }];
      }
      
      await outreachAPI.logOutreach(payload);
      setShowLogModal(false);
      loadData();
    } catch (e) {
      console.error('Failed to save log', e);
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.full_name?.toLowerCase().includes(q) || m.membership_id?.toLowerCase().includes(q));
  }, [members, search]);

  const getMethodIcon = (method) => {
    switch(method?.toLowerCase()) {
      case 'call': case 'phone': return <Phone className="w-4 h-4 text-violet-500" />;
      case 'whatsapp': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'visit': return <Home className="w-4 h-4 text-rose-500" />;
      case 'hospital visit': return <Stethoscope className="w-4 h-4 text-rose-600" />;
      case 'prayer': return <Heart className="w-4 h-4 text-amber-500" />;
      default: return <MessageSquare className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* 1. HEADER STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 hover:-translate-y-1 transition-transform border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Activity className="w-4 h-4" /> This Week Logs
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.thisWeek}</p>
        </div>
        <div className="card p-4 hover:-translate-y-1 transition-transform border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Users className="w-4 h-4" /> Members Contacted
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.membersContacted}</p>
        </div>
        <div className={`card p-4 hover:-translate-y-1 transition-transform border-l-4 ${stats.notContacted > 0 ? 'border-amber-500' : 'border-slate-300'}`}>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Info className="w-4 h-4" /> Uncontacted Assigned
          </div>
          <p className={`text-2xl font-bold ${stats.notContacted > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{stats.notContacted}</p>
        </div>
        <div className="card p-4 hover:-translate-y-1 transition-transform border-l-4 border-blue-500" onClick={() => setActiveMainTab('history')} role="button">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4" /> Total Logs History
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalLogs} <span className="text-xs font-normal">view &rarr;</span></p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button onClick={() => setActiveMainTab('log')} className={`px-4 py-2 font-medium border-b-2 ${activeMainTab === 'log' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Log Outreach</button>
        <button onClick={() => setActiveMainTab('history')} className={`px-4 py-2 font-medium border-b-2 ${activeMainTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>History</button>
      </div>

      {activeMainTab === 'log' && (
        <div className="space-y-6">
          {/* 2. FILTER + SEARCH BAR */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex flex-wrap gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeFilterTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 h-10 w-full"
              />
            </div>
          </div>

          {/* 3. MEMBER LIST */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-2 bg-slate-50/50">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">Awesome! Everyone is covered.</h3>
              <p className="text-slate-500 mt-1">No members match the current filter.</p>
              <button className="btn-secondary mt-4" onClick={() => setActiveMainTab('history')}>View History</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMembers.map(member => (
                <div key={member.id} className="card p-4 flex flex-col md:flex-row items-start md:items-center justify-between hover:shadow-lg transition-all border-l-4 border-indigo-200 hover:border-indigo-500 dark:border-indigo-900 group">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                      {member.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                        {member.full_name}
                        {member.status === 'Visitor' && <span className="ml-2 text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Visitor</span>}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mb-2">{member.membership_id} • {member.section_name}</p>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {member.latest_contact_date ? `Last: ${new Date(member.latest_contact_date).toLocaleDateString()} by ${member.latest_contact_by.split(' ')[0]}` : 'Never Contacted'}
                        </span>
                        
                        {member.flags?.length > 0 && (
                          <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 rounded">
                            <Flag className="w-3 h-3" /> {member.flags.length} Flag(s)
                          </span>
                        )}
                        {member.prayer_requests?.length > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 rounded" title={member.prayer_requests[0].request}>
                            <Heart className="w-3 h-3" /> Prayer Req
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto justify-end">
                    <button onClick={() => handleOpenLog(member, 'Call')} className="p-2 bg-slate-100 hover:bg-violet-100 text-violet-600 rounded-lg transition-colors border border-transparent hover:border-violet-200" title="Log Call">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenLog(member, 'WhatsApp')} className="p-2 bg-slate-100 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors border border-transparent hover:border-emerald-200" title="Log WhatsApp">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenLog(member, 'Visit')} className="p-2 bg-slate-100 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-transparent hover:border-rose-200" title="Log Visit">
                      <Home className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenLog(member, '')} className="btn-primary pl-3 pr-4 group-hover:shadow-md">
                      <CheckSquare className="w-4 h-4 mr-1.5 opacity-70" /> Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeMainTab === 'history' && (
        <div className="card">
          <DataTable
            columns={[
              { accessor: 'created_at', header: 'Date', render: (row) => new Date(row.created_at).toLocaleDateString() },
              { accessor: 'member_name', header: 'Member', render: (row) => <span className="font-semibold text-indigo-900 dark:text-indigo-200">{row.member_name}</span> },
              { accessor: 'contact_method', header: 'Type', render: (row) => (
                  <span className="flex items-center gap-1">
                    {getMethodIcon(row.contact_method)} {row.contact_method}
                  </span>
                ) 
              },
              { accessor: 'outcome', header: 'Outcome', render: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.outcome === 'Reached' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {row.outcome}
                </span>
              )},
              { accessor: 'logger_name', header: 'By' },
              { accessor: 'message', header: 'Notes', render: (row) => <span className="truncate max-w-[200px] block text-sm" title={row.message}>{row.message || '—'}</span> },
              { accessor: 'awarded_points', header: 'HOF', render: (row) => row.awarded_points ? <span className="text-amber-600 text-xs font-bold">+{row.awarded_points}pts</span> : '—' }
            ]}
            data={history}
            searchable={true}
            searchKeys={['member_name', 'message', 'logger_name', 'contact_method']}
            emptyIcon={Calendar}
            emptyTitle="No Outreach Logs"
            emptyDescription="Historical data will appear here once you log an outreach."
          />
        </div>
      )}

      {/* 4. LOG OUTREACH MODAL */}
      <Modal 
        isOpen={showLogModal} 
        onClose={() => setShowLogModal(false)} 
        title={`Log Outreach - ${selectedMember?.full_name}`}
        subtitle={`${selectedMember?.section_name} • Last contact: ${selectedMember?.latest_contact_date ? new Date(selectedMember.latest_contact_date).toLocaleDateString() : 'Never'}`}
        size="lg"
        className="max-h-[90vh] flex flex-col max-sm:fixed max-sm:bottom-0 max-sm:w-full max-sm:max-h-[95vh] max-sm:rounded-none max-sm:rounded-t-3xl max-sm:m-0"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary">Cancel</button>
            <button 
              type="submit" 
              form="log-outreach-form"
              disabled={saving || !logForm.contact_method || !logForm.outcome} 
              className="btn-primary shadow-lg shadow-indigo-200"
            >
              {saving ? 'Saving...' : 'Save Log'}
            </button>
          </div>
        }
      >
        <form id="log-outreach-form" onSubmit={handleSaveLog} className="space-y-6 pb-2 p-6" style={{ padding: '24px' }}>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="input-label">Type <span className="text-rose-500">*</span></label>
              <select className="select" required value={logForm.contact_method} onChange={(e) => setLogForm({...logForm, contact_method: e.target.value})}>
                <option value="">Select...</option>
                <option value="Call">Phone Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="Visit">Home Visit</option>
                <option value="Hospital Visit">Hospital Visit</option>
                <option value="Counseling">Counseling</option>
                <option value="Prayer">Prayer</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="input-label">Outcome <span className="text-rose-500">*</span></label>
              <select className="select" required value={logForm.outcome} onChange={(e) => setLogForm({...logForm, outcome: e.target.value})}>
                <option value="">Select...</option>
                <option value="Reached">Reached - Successful</option>
                <option value="Voicemail">Left Voicemail</option>
                <option value="No Answer">No Answer</option>
                <option value="Busy - call back">Busy - Call back</option>
                <option value="Message Sent">Message Sent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Service Context</label>
            <select className="select" value={logForm.service_id} onChange={(e) => setLogForm({...logForm, service_id: e.target.value})}>
              <option value="all">Not related to a service</option>
              {serviceTypes?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="input-label">Notes</label>
            <textarea 
              className="input bg-amber-50 focus:bg-white min-h-[100px]" 
              placeholder="What did you discuss? Any action items?"
              value={logForm.message}
              onChange={(e) => setLogForm({...logForm, message: e.target.value})}
            />
          </div>

          <div>
            <label className="input-label">New Prayer Request (Optional)</label>
            <input 
              className="input" 
              placeholder="Record a prayer need..."
              value={logForm.new_prayer_request}
              onChange={(e) => setLogForm({...logForm, new_prayer_request: e.target.value})}
            />
          </div>

          {/* Follow Up */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-3 font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={logForm.follow_up_needed} onChange={(e) => setLogForm({...logForm, follow_up_needed: e.target.checked})} className="rounded text-indigo-600 w-5 h-5 cursor-pointer focus:ring-indigo-500" />
              Require Follow-up Queue Assignment
            </label>
            
            {logForm.follow_up_needed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in mt-4 pl-8">
                <div>
                  <label className="input-label text-xs">Assign To <span className="text-rose-500">*</span></label>
                  <select required className="select bg-white h-10 text-sm" value={logForm.assigned_to_user_id} onChange={(e) => setLogForm({...logForm, assigned_to_user_id: e.target.value})}>
                    <option value="">Select Leader...</option>
                    {leaders.map(l => <option key={l.user_id} value={l.user_id}>{l.full_name} ({l.section_name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label text-xs">Due Date <span className="text-rose-500">*</span></label>
                  <input type="date" required className="input bg-white h-10 text-sm" value={logForm.due_date} onChange={(e) => setLogForm({...logForm, due_date: e.target.value})}/>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
             {/* Flag Member */}
             <div className="p-5 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/50">
                <label className="flex items-center gap-3 font-medium text-rose-800 dark:text-rose-400 cursor-pointer">
                  <input type="checkbox" checked={logForm.add_flag} onChange={(e) => setLogForm({...logForm, add_flag: e.target.checked})} className="rounded text-rose-600 w-5 h-5 cursor-pointer border-rose-300 focus:ring-rose-500" />
                  Flag Member Temporarily
                </label>
                {logForm.add_flag && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in mt-4 pl-8">
                    <div>
                      <label className="input-label text-xs text-rose-700 dark:text-rose-400">Flag Type <span className="text-rose-500">*</span></label>
                      <select required className="select bg-white border-rose-200 h-10 text-sm" value={logForm.flag_reason} onChange={(e)=>setLogForm({...logForm, flag_reason: e.target.value})}>
                        <option value="">Select Type...</option>
                        <option value="Sick">Sick</option>
                        <option value="Grieving">Grieving</option>
                        <option value="Hospitalized">Hospitalized</option>
                        <option value="New Parent">New Parent</option>
                        <option value="Financial Need">Financial Need</option>
                      </select>
                    </div>
                    <div>
                      <label className="input-label text-xs text-rose-700 dark:text-rose-400">Expires At</label>
                      <input type="date" className="input bg-white border-rose-200 h-10 text-sm" value={logForm.flag_expires_at || ''} onChange={(e)=>setLogForm({...logForm, flag_expires_at: e.target.value})} />
                    </div>
                  </div>
                )}
             </div>

            {/* Hall of Fame */}
            <div className="p-5 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/50 flex items-center justify-between cursor-pointer" onClick={() => setLogForm({...logForm, add_to_hall_of_fame: !logForm.add_to_hall_of_fame})}>
              <label className="flex items-center gap-3 font-medium text-amber-800 dark:text-amber-400 cursor-pointer pointer-events-none">
                <input type="checkbox" checked={logForm.add_to_hall_of_fame} readOnly className="rounded text-amber-600 w-5 h-5 border-amber-300 focus:ring-amber-500" />
                Submit to Hall of Fame
              </label>
              {logForm.add_to_hall_of_fame && <span className="text-sm font-bold bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-full animate-scale-in">+{logForm.contact_method === 'Visitor Follow-up' ? 20 : logForm.contact_method === 'Hospital Visit' ? 15 : logForm.contact_method === 'Counseling' ? 10 : 5} pts</span>}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
