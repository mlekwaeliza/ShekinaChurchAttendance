import React, { useEffect } from 'react';
import { Trophy, Award, Star, Crown } from 'lucide-react';

const RewardsView = ({
  rewardsYear,
  setRewardsYear,
  rewardsMode,
  setRewardsMode,
  rewardsWeek,
  setRewardsWeek,
  topMembers,
  topLeaders,
  rewardsLoading,
  loadRewards,
}) => {
  useEffect(() => {
    loadRewards();
  }, [rewardsYear, rewardsMode, rewardsWeek]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Hall of Fame</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Celebrating top performers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="tab-pills">
            <button
              onClick={() => setRewardsMode('year')}
              className={`tab-pill ${rewardsMode === 'year' ? 'active' : ''}`}
            >
              Fiscal Year
            </button>
            <button
              onClick={() => setRewardsMode('week')}
              className={`tab-pill ${rewardsMode === 'week' ? 'active' : ''}`}
            >
              Weekly
            </button>
          </div>

          <select
            value={rewardsYear}
            onChange={(e) => setRewardsYear(e.target.value)}
            className="select w-auto"
          >
            {Array.from(
              { length: Math.max(3, new Date().getFullYear() - 2024 + 2) },
              (_, i) => 2024 + i
            ).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {rewardsMode === 'week' && (
            <input
              type="week"
              value={rewardsWeek}
              onChange={(e) => setRewardsWeek(e.target.value)}
              className="input w-auto"
            />
          )}
        </div>
      </div>

      {rewardsLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (topMembers?.members?.length > 0 || topLeaders?.leaders?.length > 0) ? (
        <>
          {/* Hero Banner */}
          {rewardsMode === 'year' && (
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 lg:p-10 border border-slate-700/50">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.08),transparent_60%)]" />

              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20 mb-4">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Excellence {rewardsYear}
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">
                    Celebrating Outstanding{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                      Ministry
                    </span>
                  </h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Recognizing leaders and members who demonstrated exceptional commitment throughout the year.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full lg:w-auto">
                  {/* Top Member */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                      Top Member
                    </p>
                    {topMembers.members
                      .filter((m) => m.rank === 1)
                      .slice(0, 1)
                      .map((m) => (
                        <div key={m.id}>
                          <p className="text-lg font-bold text-white">{m.full_name}</p>
                          <p className="text-xs text-slate-400 mt-1">{m.section_name}</p>
                          <div className="flex items-center gap-2 mt-4">
                            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                                style={{ width: `${m.attendance_rate}%` }}
                              />
                            </div>
                            <span className="text-amber-400 font-semibold text-xs tabular-nums">
                              {m.attendance_rate}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Top Leader */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3">
                      Top Leader
                    </p>
                    {topLeaders.leaders
                      .filter((l) => l.rank === 1)
                      .slice(0, 1)
                      .map((l) => (
                        <div key={l.id}>
                          <p className="text-lg font-bold text-white">{l.leader_name}</p>
                          <p className="text-xs text-slate-400 mt-1">{l.section_name}</p>
                          <div className="flex items-center gap-2 mt-4">
                            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full"
                                style={{ width: `${l.submission_rate}%` }}
                              />
                            </div>
                            <span className="text-primary-400 font-semibold text-xs tabular-nums">
                              {l.submission_rate}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Members Leaderboard */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-3">
                <Award className="w-4 h-4" />
                Attendance Leaderboard
              </h4>
              <div className="space-y-2">
                {topMembers.members.slice(0, 5).map((m, i) => (
                  <div
                    key={m.id}
                    className="card-hover p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold tabular-nums w-7 ${
                          i < 3 ? 'text-amber-500' : 'text-slate-300'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{m.full_name}</p>
                        <p className="text-xs text-slate-500">{m.section_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 tabular-nums">{m.attendance_rate}%</p>
                      <p className="text-[10px] text-emerald-500 font-medium uppercase">
                        Consistency
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leaders Leaderboard */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-3">
                <Crown className="w-4 h-4" />
                Leadership Ranking
              </h4>
              <div className="space-y-2">
                {topLeaders.leaders.slice(0, 5).map((l, i) => (
                  <div
                    key={l.id}
                    className="card-hover p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold tabular-nums w-7 ${
                          i < 3 ? 'text-primary-500' : 'text-slate-300'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{l.leader_name}</p>
                        <p className="text-xs text-slate-500">{l.section_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 tabular-nums">{l.submission_rate}%</p>
                      <p className="text-[10px] text-primary-500 font-medium uppercase">
                        Submission Rate
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">No rewards data yet</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            The Hall of Fame is built from attendance submissions. Once leaders start submitting attendance records, top performers will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default RewardsView;
