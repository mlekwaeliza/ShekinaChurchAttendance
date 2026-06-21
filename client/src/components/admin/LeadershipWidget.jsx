import React, { useEffect, useState } from 'react';
import { Award, Users, UserCheck, UserX, ChevronRight } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import StatCard from '../ui/StatCard';

const LeadershipWidget = ({ onNavigate }) => {
  const [stats, setStats] = useState({ stats: [], totalLeaders: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    adminAPI.getLeadershipStats()
      .then((res) => { if (!cancelled) setStats(res.data || { stats: [], totalLeaders: 0 }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="card-stat p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="h-48 skeleton rounded-2xl" />
      </div>
    );
  }

  const active = stats.stats.reduce((s, t) => s + Number(t.active_count), 0);
  const inactive = stats.stats.reduce((s, t) => s + Number(t.inactive_count), 0);

  const handleNavigate = (filter = {}) => {
    if (onNavigate) {
      onNavigate(filter);
    } else {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => params.set(k, v));
      navigate(`/admin/leadership?${params.toString()}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Leadership Roles</h3>
            <p className="text-xs text-slate-400">Overview of all title assignments</p>
          </div>
        </div>
        <button
          onClick={() => handleNavigate()}
          className="btn-sm btn-ghost text-primary-600 dark:text-primary-400"
        >
          View all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Award}
          label="Total Leadership Roles"
          value={stats.totalLeaders}
          variant="default"
          onClick={() => handleNavigate()}
        />
        <StatCard
          icon={UserCheck}
          label="Active"
          value={active}
          variant="success"
          onClick={() => handleNavigate({ status: 'active' })}
        />
        <StatCard
          icon={UserX}
          label="Inactive"
          value={inactive}
          variant="warning"
          onClick={() => handleNavigate({ status: 'inactive' })}
        />
      </div>

      {stats.stats.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-500" />
              Roles Breakdown
            </h4>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {stats.stats.map((s) => (
              <button
                key={s.id}
                onClick={() => handleNavigate({ title_id: s.id })}
                className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group"
              >
                <span className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                  {s.name}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 -ml-1 transition-all group-hover:ml-0" />
                </span>
                <div className="flex items-center gap-4">
                  {s.description && <span className="text-xs text-slate-400 hidden sm:inline">{s.description}</span>}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">{s.active_count}</span>
                  </span>
                  {s.inactive_count > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="text-slate-400 dark:text-slate-500 tabular-nums">{s.inactive_count}</span>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.stats.length === 0 && (
        <div className="card p-8 text-center">
          <Award className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No titles created yet</p>
        </div>
      )}
    </div>
  );
};

export default LeadershipWidget;
