import React, { useState, useEffect } from 'react';
import { pastorAPI } from '../../services/api';
import { Calendar, CheckCircle, XCircle, MessageSquare, AlertTriangle, Cake } from 'lucide-react';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { addDays, formatDisplayDate, formatLocalDate, getWeekStartString } from '../../utils/date';

const PastorWeeklySummary = () => {
  const [summary, setSummary] = useState(null);
  const [followUpAlerts, setFollowUpAlerts] = useState([]);
  const [birthdayAlerts, setBirthdayAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStartString());

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, followUpRes, birthdayRes] = await Promise.all([
        pastorAPI.getWeeklySummary(weekStart),
        pastorAPI.getFollowUpAlerts(),
        pastorAPI.getBirthdayAlerts(),
      ]);
      setSummary(summaryRes.data);
      setFollowUpAlerts(followUpRes.data);
      setBirthdayAlerts(birthdayRes.data);
    } catch (e) {
      console.error('Failed to load weekly summary:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  const leaders = summary?.leaders || [];
  const submitted = leaders.filter(l => l.submitted > 0).length;
  const total = leaders.length;
  const totalOutreach = leaders.reduce((sum, l) => sum + Number(l.outreach_count), 0);
  const totalAbsent = leaders.reduce((sum, l) => sum + Number(l.absent_members), 0);

  const weekEnd = addDays(weekStart, 6);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Weekly Summary</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatDisplayDate(weekStart)} — {formatDisplayDate(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setWeekStart(formatLocalDate(addDays(weekStart, -7)));
            }}
            className="btn-secondary btn-sm"
          >
            Previous Week
          </button>
          <button
            onClick={() => setWeekStart(getWeekStartString())}
            className="btn-primary btn-sm"
          >
            This Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Submitted</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{submitted}/{total}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Not Submitted</span>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{total - submitted}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span>Outreach Logs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalOutreach}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Absent Members</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalAbsent}</p>
        </div>
      </div>

      {followUpAlerts.length > 0 && (
        <div className="card border-l-4 border-amber-400 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Members Needing Follow-Up</h3>
            <Badge variant="warning">{followUpAlerts.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {followUpAlerts.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{m.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.section_name} · {m.recent_absences} absences</p>
                </div>
                <Badge variant="warning">{m.leader_name}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {birthdayAlerts.length > 0 && (
        <div className="card border-l-4 border-pink-400 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cake className="w-5 h-5 text-pink-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Today's Birthdays</h3>
            <Badge variant="info">{birthdayAlerts.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {birthdayAlerts.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{m.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.section_name}{m.phone ? ` · ${m.phone}` : ''}</p>
                </div>
                <Badge variant="info">{m.leader_name}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <DataTable
          columns={[
            {
              accessor: 'section_name',
              header: 'Section',
              sortable: true,
              render: (row) => <span className="font-medium text-slate-900 dark:text-white">{row.section_name}</span>
            },
            {
              accessor: 'leader_name',
              header: 'Leader',
              sortable: true,
              render: (row) => <span className="text-slate-700 dark:text-slate-300">{row.leader_name}</span>
            },
            {
              accessor: 'submitted',
              header: 'Attendance',
              sortable: true,
              align: 'center',
              render: (row) => row.submitted > 0
                ? <Badge variant="success">Submitted</Badge>
                : <Badge variant="danger">Not Submitted</Badge>
            },
            {
              accessor: 'outreach_count',
              header: 'Outreach',
              sortable: true,
              align: 'center',
              render: (row) => (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {row.outreach_count}
                </span>
              )
            },
            {
              accessor: 'members_contacted',
              header: 'Members Reached',
              sortable: true,
              align: 'center',
              render: (row) => <span className="text-sm text-slate-600 dark:text-slate-400">{row.members_contacted}</span>
            },
            {
              accessor: 'absent_members',
              header: 'Absent',
              sortable: true,
              align: 'center',
              render: (row) => (
                <span className={`text-sm font-medium ${row.absent_members > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                  {row.absent_members}
                </span>
              )
            },
          ]}
          data={leaders}
          searchable={true}
          searchPlaceholder="Search sections or leaders..."
          searchKeys={['section_name', 'leader_name']}
          emptyTitle="No summary data"
          emptyDescription="Weekly summary will appear once leaders start submitting."
        />
      </div>
    </div>
  );
};

export default PastorWeeklySummary;
