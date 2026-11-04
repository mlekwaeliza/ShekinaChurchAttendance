import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Phone,
  Home,
  Calendar,
  Search,
  Users,
  TrendingUp,
  Activity,
  CheckCircle,
  Flag,
  Stethoscope,
  Heart,
  Info,
  Clock,
  CheckSquare
} from 'lucide-react';
import DataTable from '../ui/DataTable';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { outreachAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'absent', label: 'Absent Last Service' },
  { id: 'default_not_contacted', label: 'Not Contacted' },
  { id: 'birthdays', label: 'Birthdays This Week' },
  { id: 'visitors', label: 'New Visitors' },
  { id: 'flagged', label: 'Sick/Flagged' },
  { id: 'overdue', label: 'Overdue Follow-ups' },
  { id: 'all', label: 'All My Members' }
];

export default function LeaderOutreach({ serviceTypes, currentServiceId }) {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState('log'); // 'log' | 'history'
  const [activeFilterTab, setActiveFilterTab] = useState('absent');
  const [search, setSearch] = useState('');

  const [stats, setStats] = useState({
    thisWeek: 0,
    membersContacted: 0,
    notContacted: 0,
    totalLogs: 0
  });
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
  }, [activeFilterTab, currentServiceId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const payload = {
        ...logForm,
        member_id: selectedMember.id,
        points:
          logForm.contact_method === 'Visitor Follow-up'
            ? 20
            : logForm.contact_method === 'Hospital Visit'
              ? 15
              : logForm.contact_method === 'Counseling'
                ? 10
                : 5
      };
      if (logForm.add_flag && logForm.flag_reason) {
        payload.new_flags = [
          { reason: logForm.flag_reason, expires_at: logForm.flag_expires_at || null }
        ];
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
    return members.filter(
      (m) => m.full_name?.toLowerCase().includes(q) || m.membership_id?.toLowerCase().includes(q)
    );
  }, [members, search]);

  const getMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'call':
      case 'phone':
        return <Phone className="h-4 w-4 text-purple-700 dark:text-system-purple" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-700 dark:text-system-green" />;
      case 'visit':
        return <Home className="h-4 w-4 text-rose-700 dark:text-system-red" />;
      case 'hospital visit':
        return <Stethoscope className="h-4 w-4 text-rose-700 dark:text-system-red" />;
      case 'prayer':
        return <Heart className="h-4 w-4 text-amber-700 dark:text-system-orange" />;
      default:
        return <MessageSquare className="h-4 w-4 text-blue-700 dark:text-system-blue" />;
    }
  };

  const actionButton =
    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-ring';

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Activity} label="This Week Logs" value={stats.thisWeek} variant="default" />
        <StatCard
          icon={Users}
          label="Members Contacted"
          value={stats.membersContacted}
          variant="success"
        />
        <StatCard
          icon={Info}
          label="Uncontacted Assigned"
          value={stats.notContacted}
          variant={stats.notContacted > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Logs History"
          value={stats.totalLogs}
          variant="info"
          trendLabel="View history →"
          onClick={() => setActiveMainTab('history')}
        />
      </div>

      {/* Main tabs */}
      <div className="tab-pills w-full sm:w-auto">
        <button
          onClick={() => setActiveMainTab('log')}
          className={`tab-pill flex-1 justify-center sm:flex-none ${activeMainTab === 'log' ? 'active' : ''}`}
        >
          Log Outreach
        </button>
        <button
          onClick={() => setActiveMainTab('history')}
          className={`tab-pill flex-1 justify-center sm:flex-none ${activeMainTab === 'history' ? 'active' : ''}`}
        >
          History
        </button>
      </div>

      {activeMainTab === 'log' && (
        <div className="space-y-5">
          {/* Filter + search */}
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilterTab(tab.id)}
                  aria-pressed={activeFilterTab === tab.id}
                  className={`focus-ring rounded-full px-3 py-1.5 text-caption-1 font-semibold transition-colors ${
                    activeFilterTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-system-fill text-secondary-label hover:text-label'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-label" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input h-10 w-full pl-9"
              />
            </div>
          </div>

          {/* Members */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-separator/70 px-6 py-14 text-center dark:border-white/[0.12]">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-system-green/15">
                <CheckCircle className="h-7 w-7 text-emerald-700 dark:text-system-green" />
              </div>
              <h3 className="text-headline font-semibold text-label">Everyone is covered</h3>
              <p className="mt-1 text-footnote text-secondary-label">
                No members match the current filter.
              </p>
              <button
                className="btn-secondary btn-sm mt-4"
                onClick={() => setActiveMainTab('history')}
              >
                View History
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="card flex flex-col items-start justify-between gap-4 p-4 transition-shadow hover:shadow-card-hover md:flex-row md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500/[0.12] text-headline font-semibold text-primary-700 dark:text-primary-300">
                      {member.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="flex flex-wrap items-center gap-2 text-footnote font-semibold text-label">
                        {member.full_name}
                        {member.status === 'Visitor' && (
                          <span className="badge-warning">Visitor</span>
                        )}
                      </h4>
                      <p className="mb-2 mt-0.5 truncate text-caption-1 text-secondary-label">
                        {member.membership_id} • {member.section_name}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption-1 text-secondary-label">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {member.latest_contact_date
                            ? `Last: ${new Date(member.latest_contact_date).toLocaleDateString()} by ${member.latest_contact_by.split(' ')[0]}`
                            : 'Never Contacted'}
                        </span>

                        {member.flags?.length > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-system-red/10 px-2 py-0.5 font-medium text-rose-700 dark:text-system-red">
                            <Flag className="h-3 w-3" /> {member.flags.length} flag
                            {member.flags.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {member.prayer_requests?.length > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-full bg-system-indigo/10 px-2 py-0.5 font-medium text-primary-700 dark:text-primary-300"
                            title={member.prayer_requests[0].request}
                          >
                            <Heart className="h-3 w-3" /> Prayer req
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-1.5 md:w-auto">
                    <button
                      onClick={() => handleOpenLog(member, 'Call')}
                      className={`${actionButton} bg-system-fill text-purple-700 hover:bg-system-purple/15 dark:text-system-purple`}
                      title="Log Call"
                      aria-label={`Log call for ${member.full_name}`}
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenLog(member, 'WhatsApp')}
                      className={`${actionButton} bg-system-fill text-emerald-700 hover:bg-system-green/15 dark:text-system-green`}
                      title="Log WhatsApp"
                      aria-label={`Log WhatsApp for ${member.full_name}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenLog(member, 'Visit')}
                      className={`${actionButton} bg-system-fill text-rose-700 hover:bg-system-red/15 dark:text-system-red`}
                      title="Log Visit"
                      aria-label={`Log visit for ${member.full_name}`}
                    >
                      <Home className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenLog(member, '')}
                      className="btn-primary btn-sm ml-1 gap-1.5"
                    >
                      <CheckSquare className="h-4 w-4 opacity-80" /> Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {activeMainTab === 'history' && (
        <div className="card">
          <DataTable
            columns={[
              {
                accessor: 'created_at',
                header: 'Date',
                render: (row) => (
                  <span className="tabular-nums text-secondary-label">
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                )
              },
              {
                accessor: 'member_name',
                header: 'Member',
                render: (row) => <span className="font-semibold text-label">{row.member_name}</span>
              },
              {
                accessor: 'contact_method',
                header: 'Type',
                render: (row) => (
                  <span className="flex items-center gap-1.5 text-secondary-label">
                    {getMethodIcon(row.contact_method)} {row.contact_method}
                  </span>
                )
              },
              {
                accessor: 'outcome',
                header: 'Outcome',
                render: (row) => (
                  <span className={row.outcome === 'Reached' ? 'badge-success' : 'badge-neutral'}>
                    {row.outcome}
                  </span>
                )
              },
              { accessor: 'logger_name', header: 'By' },
              {
                accessor: 'message',
                header: 'Notes',
                render: (row) => (
                  <span className="block max-w-[200px] truncate text-footnote" title={row.message}>
                    {row.message || '—'}
                  </span>
                )
              },
              {
                accessor: 'awarded_points',
                header: 'HOF',
                render: (row) =>
                  row.awarded_points ? (
                    <span className="text-caption-1 font-semibold tabular-nums text-amber-700 dark:text-system-orange">
                      +{row.awarded_points} pts
                    </span>
                  ) : (
                    <span className="text-tertiary-label">—</span>
                  )
              }
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

      {/* Log outreach modal */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title={`Log Outreach - ${selectedMember?.full_name}`}
        subtitle={`${selectedMember?.section_name} • Last contact: ${selectedMember?.latest_contact_date ? new Date(selectedMember.latest_contact_date).toLocaleDateString() : 'Never'}`}
        size="lg"
        className="max-h-[90vh] flex flex-col max-sm:fixed max-sm:bottom-0 max-sm:m-0 max-sm:w-full max-sm:max-h-[95vh] max-sm:rounded-none max-sm:rounded-t-3xl"
        footer={
          <div className="flex w-full justify-end gap-2">
            <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              form="log-outreach-form"
              disabled={saving || !logForm.contact_method || !logForm.outcome}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Log'}
            </button>
          </div>
        }
      >
        <form id="log-outreach-form" onSubmit={handleSaveLog} className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">
                Type <span className="text-system-red">*</span>
              </label>
              <select
                className="select w-full"
                required
                value={logForm.contact_method}
                onChange={(e) => setLogForm({ ...logForm, contact_method: e.target.value })}
              >
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
              <label className="input-label">
                Outcome <span className="text-system-red">*</span>
              </label>
              <select
                className="select w-full"
                required
                value={logForm.outcome}
                onChange={(e) => setLogForm({ ...logForm, outcome: e.target.value })}
              >
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
            <select
              className="select w-full"
              value={logForm.service_id}
              onChange={(e) => setLogForm({ ...logForm, service_id: e.target.value })}
            >
              <option value="all">Not related to a service</option>
              {serviceTypes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label">Notes</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="What did you discuss? Any action items?"
              value={logForm.message}
              onChange={(e) => setLogForm({ ...logForm, message: e.target.value })}
            />
          </div>

          <div>
            <label className="input-label">New Prayer Request (Optional)</label>
            <input
              className="input"
              placeholder="Record a prayer need..."
              value={logForm.new_prayer_request}
              onChange={(e) => setLogForm({ ...logForm, new_prayer_request: e.target.value })}
            />
          </div>

          {/* Follow-up */}
          <div className="rounded-xl bg-system-grouped-background/70 p-4 dark:bg-white/[0.03]">
            <label className="flex cursor-pointer items-center gap-3 text-footnote font-medium text-label">
              <input
                type="checkbox"
                checked={logForm.follow_up_needed}
                onChange={(e) => setLogForm({ ...logForm, follow_up_needed: e.target.checked })}
                className="h-4 w-4 cursor-pointer rounded accent-primary-600"
              />
              Require Follow-up Queue Assignment
            </label>

            {logForm.follow_up_needed && (
              <div className="mt-4 grid animate-fade-in grid-cols-1 gap-4 pl-7 sm:grid-cols-2">
                <div>
                  <label className="input-label">
                    Assign To <span className="text-system-red">*</span>
                  </label>
                  <select
                    required
                    className="select w-full"
                    value={logForm.assigned_to_user_id}
                    onChange={(e) =>
                      setLogForm({ ...logForm, assigned_to_user_id: e.target.value })
                    }
                  >
                    <option value="">Select Leader...</option>
                    {leaders.map((l) => (
                      <option key={l.user_id} value={l.user_id}>
                        {l.full_name} ({l.section_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">
                    Due Date <span className="text-system-red">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={logForm.due_date}
                    onChange={(e) => setLogForm({ ...logForm, due_date: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {/* Flag member */}
            <div className="rounded-xl bg-system-red/[0.06] p-4">
              <label className="flex cursor-pointer items-center gap-3 text-footnote font-medium text-rose-700 dark:text-system-red">
                <input
                  type="checkbox"
                  checked={logForm.add_flag}
                  onChange={(e) => setLogForm({ ...logForm, add_flag: e.target.checked })}
                  className="h-4 w-4 cursor-pointer rounded accent-rose-600"
                />
                Flag Member Temporarily
              </label>
              {logForm.add_flag && (
                <div className="mt-4 grid animate-fade-in grid-cols-1 gap-4 pl-7 sm:grid-cols-2">
                  <div>
                    <label className="input-label">
                      Flag Type <span className="text-system-red">*</span>
                    </label>
                    <select
                      required
                      className="select w-full"
                      value={logForm.flag_reason}
                      onChange={(e) => setLogForm({ ...logForm, flag_reason: e.target.value })}
                    >
                      <option value="">Select Type...</option>
                      <option value="Sick">Sick</option>
                      <option value="Grieving">Grieving</option>
                      <option value="Hospitalized">Hospitalized</option>
                      <option value="New Parent">New Parent</option>
                      <option value="Financial Need">Financial Need</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Expires At</label>
                    <input
                      type="date"
                      className="input"
                      value={logForm.flag_expires_at || ''}
                      onChange={(e) => setLogForm({ ...logForm, flag_expires_at: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hall of fame */}
            <div
              className="flex cursor-pointer items-center justify-between rounded-xl bg-system-yellow/[0.12] p-4"
              onClick={() =>
                setLogForm({ ...logForm, add_to_hall_of_fame: !logForm.add_to_hall_of_fame })
              }
            >
              <label className="pointer-events-none flex cursor-pointer items-center gap-3 text-footnote font-medium text-amber-800 dark:text-system-yellow">
                <input
                  type="checkbox"
                  checked={logForm.add_to_hall_of_fame}
                  readOnly
                  className="h-4 w-4 rounded accent-amber-600"
                />
                Submit for Recognition
              </label>
              {logForm.add_to_hall_of_fame && (
                <span className="animate-scale-in rounded-full bg-system-yellow/25 px-2.5 py-1 text-caption-1 font-semibold tabular-nums text-amber-800 dark:text-system-yellow">
                  +
                  {logForm.contact_method === 'Visitor Follow-up'
                    ? 20
                    : logForm.contact_method === 'Hospital Visit'
                      ? 15
                      : logForm.contact_method === 'Counseling'
                        ? 10
                        : 5}{' '}
                  pts
                </span>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
