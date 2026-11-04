import React, { useEffect, useState } from 'react';
import { Award, UserCheck, UserX, ChevronRight } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import StatCard from '../ui/StatCard';

const LeadershipWidget = ({ onNavigate }) => {
  const [stats, setStats] = useState({ stats: [], totalLeaders: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    adminAPI
      .getLeadershipStats()
      .then((res) => {
        if (!cancelled) setStats(res.data || { stats: [], totalLeaders: 0 });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12] text-primary-700 dark:text-primary-300">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-title-3 font-semibold text-label">Leadership Roles</h3>
            <p className="text-footnote text-secondary-label">Overview of all title assignments</p>
          </div>
        </div>
        <button
          onClick={() => handleNavigate()}
          className="btn-sm btn-ghost text-primary-700 dark:text-primary-300"
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
          <div className="px-5 py-4 border-b border-separator/60 dark:border-white/[0.08]">
            <h4 className="flex items-center gap-2 text-subheadline font-semibold text-label">
              <Award className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              Roles Breakdown
            </h4>
          </div>
          <div className="divide-y divide-separator/60 dark:divide-white/[0.08]">
            {stats.stats.map((s) => (
              <button
                key={s.id}
                onClick={() => handleNavigate({ title_id: s.id })}
                className="group flex w-full items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-system-grouped-background/70 dark:hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2 font-medium text-label">
                  {s.name}
                  <ChevronRight className="-ml-1 h-3.5 w-3.5 text-tertiary-label opacity-0 transition-all group-hover:ml-0 group-hover:opacity-100" />
                </span>
                <div className="flex items-center gap-4">
                  {s.description && (
                    <span className="hidden text-caption-1 text-secondary-label sm:inline">
                      {s.description}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-system-green" />
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-system-green">
                      {s.active_count}
                    </span>
                  </span>
                  {s.inactive_count > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-system-gray-3 dark:bg-system-gray-5" />
                      <span className="tabular-nums text-tertiary-label">{s.inactive_count}</span>
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
          <Award className="mx-auto mb-3 h-10 w-10 text-tertiary-label" />
          <p className="text-footnote text-secondary-label">No titles created yet</p>
        </div>
      )}
    </div>
  );
};

export default LeadershipWidget;
