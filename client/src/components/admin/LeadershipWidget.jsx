import React, { useEffect, useState } from 'react';
import { Award, Users, UserCheck, UserX } from 'lucide-react';
import { adminAPI } from '../../services/api';
import StatCard from '../ui/StatCard';

const LeadershipWidget = ({ onNavigate }) => {
  const [stats, setStats] = useState({ stats: [], totalLeaders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminAPI.getLeadershipStats()
      .then((res) => { if (!cancelled) setStats(res.data || { stats: [], totalLeaders: 0 }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  const active = stats.stats.reduce((s, t) => s + t.active_count, 0);
  const inactive = stats.stats.reduce((s, t) => s + t.inactive_count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Award}
          label="Total Leadership Roles"
          value={stats.totalLeaders}
          color="primary"
          onClick={onNavigate}
        />
        <StatCard
          icon={UserCheck}
          label="Active"
          value={active}
          color="success"
          onClick={onNavigate}
        />
        <StatCard
          icon={UserX}
          label="Inactive"
          value={inactive}
          color="warning"
          onClick={onNavigate}
        />
      </div>
      {stats.stats.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-500" />
            Roles Breakdown
          </h4>
          <div className="space-y-2">
            {stats.stats.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{s.description || ''}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-700 font-semibold tabular-nums">{s.active_count}</span>
                  </span>
                  {s.inactive_count > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-slate-400 tabular-nums">{s.inactive_count}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadershipWidget;
