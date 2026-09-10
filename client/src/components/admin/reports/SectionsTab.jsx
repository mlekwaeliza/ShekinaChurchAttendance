import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  Info,
  Layers,
  Minus,
  RefreshCw,
  Search,
  Shield,
  Target,
  UserX,
  Users
} from 'lucide-react';
import Badge from '../../ui/Badge';
import { escapeHtml, R } from './reportShared';

const SectionsTab = ({ data, actions }) => {
  const {
    secRankings,
    secHeadLeaders,
    secLeaderRankings,
    absentStreaks,
    secPeriod,
    secP1Start,
    secP1End,
    secP2Start,
    secP2End,
    secLoading,
    secError,
    secSearch,
    secSortField,
    secSortOrder,
    leadSortField,
    leadSortOrder,
    expandedSectionId,
    showExtraKPIs,
    sectionSubTab,
    showAllColumns,
    leaderRankData
  } = data;
  const {
    setSecPeriod,
    setSecP1Start,
    setSecP1End,
    setSecP2Start,
    setSecP2End,
    setSecSearch,
    setShowExtraKPIs,
    setSectionSubTab,
    setShowAllColumns,
    setExpandedSectionId,
    setSecSortField,
    setSecSortOrder,
    setLeadSortField,
    setLeadSortOrder
  } = actions;
  const navigate = useNavigate();
  // Sorting helpers
  const handleSortSec = (field) => {
    if (secSortField === field) {
      setSecSortOrder(secSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSecSortField(field);
      setSecSortOrder('desc');
    }
  };

  const handleSortLead = (field) => {
    if (leadSortField === field) {
      setLeadSortOrder(leadSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setLeadSortField(field);
      setLeadSortOrder('desc');
    }
  };

  const renderSortHeader = (label, field, align = 'left') => {
    const isSorted = secSortField === field;
    return (
      <th
        onClick={() => handleSortSec(field)}
        className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors whitespace-nowrap ${
          align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div
          className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
        >
          <span>{label}</span>
          {isSorted ? (
            secSortOrder === 'asc' ? (
              <ChevronUp className="w-2.5 h-2.5 text-indigo-500" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5 text-indigo-500" />
            )
          ) : (
            <ChevronDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  const renderLeadSortHeader = (label, field, align = 'left') => {
    const isSorted = leadSortField === field;
    return (
      <th
        onClick={() => handleSortLead(field)}
        className={`px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors whitespace-nowrap ${
          align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div
          className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
        >
          <span>{label}</span>
          {isSorted ? (
            leadSortOrder === 'asc' ? (
              <ChevronUp className="w-2.5 h-2.5 text-indigo-500" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5 text-indigo-500" />
            )
          ) : (
            <ChevronDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  // 1. Calculations & Filters for Section rankings table
  const sortedRankings = [...secRankings];
  const filteredRankings = sortedRankings.filter(
    (s) => !secSearch || s.name?.toLowerCase().includes(secSearch.toLowerCase())
  );

  // Apply sorting to Rankings
  filteredRankings.sort((a, b) => {
    let valA = a[secSortField];
    let valB = b[secSortField];

    // calculate diff field on the fly if needed
    if (secSortField === 'attendance_diff') {
      valA = (a.attendance_rate || 0) - (a.prev_rate || 0);
      valB = (b.attendance_rate || 0) - (b.prev_rate || 0);
    }

    if (valA == null) return secSortOrder === 'asc' ? -1 : 1;
    if (valB == null) return secSortOrder === 'asc' ? 1 : -1;

    if (typeof valA === 'string') {
      return secSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return secSortOrder === 'asc' ? valA - valB : valB - valA;
    }
  });

  // Apply sorting to Leadership Table
  const sortedHeadLeaders = [...secHeadLeaders].sort((a, b) => {
    let valA = a[leadSortField];
    let valB = b[leadSortField];

    if (valA == null) return leadSortOrder === 'asc' ? -1 : 1;
    if (valB == null) return leadSortOrder === 'asc' ? 1 : -1;

    if (typeof valA === 'string') {
      return leadSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return leadSortOrder === 'asc' ? valA - valB : valB - valA;
    }
  });

  // Highlights & KPI Cards computations
  const avgHealthScore =
    secRankings.length > 0
      ? Math.round(
          secRankings.reduce((sum, s) => sum + (s.performance_score || 0), 0) / secRankings.length
        )
      : 0;

  let healthStatus = 'Critical';
  let healthColor =
    'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30';
  let healthBadge = 'danger';
  if (avgHealthScore >= 85) {
    healthStatus = 'Elite';
    healthColor =
      'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/30';
    healthBadge = 'success';
  } else if (avgHealthScore >= 75) {
    healthStatus = 'Excellent';
    healthColor =
      'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30';
    healthBadge = 'success';
  } else if (avgHealthScore >= 65) {
    healthStatus = 'Good';
    healthColor =
      'text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30';
    healthBadge = 'info';
  } else if (avgHealthScore >= 50) {
    healthStatus = 'Fair';
    healthColor =
      'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30';
    healthBadge = 'warning';
  }

  const bestSection =
    secRankings.length > 0
      ? secRankings.reduce((a, b) =>
          (a.performance_score || 0) > (b.performance_score || 0) ? a : b
        )
      : null;

  const fastestGrowing =
    secRankings.length > 0
      ? secRankings.reduce((a, b) => ((a.new_members || 0) > (b.new_members || 0) ? a : b))
      : null;

  const mostImproved =
    secRankings.length > 0
      ? secRankings.reduce((a, b) => {
          const diffA = (a.attendance_rate || 0) - (a.prev_rate || 0);
          const diffB = (b.attendance_rate || 0) - (b.prev_rate || 0);
          return diffA > diffB ? a : b;
        })
      : null;

  const highestRetention =
    secRankings.length > 0
      ? secRankings.reduce((a, b) => ((a.retention_rate || 0) > (b.retention_rate || 0) ? a : b))
      : null;

  const mostConsistent =
    secRankings.length > 0
      ? secRankings.reduce((a, b) =>
          (a.consistency_score || 0) > (b.consistency_score || 0) ? a : b
        )
      : null;

  const attentionSection =
    secRankings.length > 0
      ? secRankings.reduce((a, b) =>
          (a.performance_score || 0) < (b.performance_score || 0) ? a : b
        )
      : null;

  // AI insights generator
  const getAIExecutiveInsights = () => {
    if (!secRankings.length) return [];
    const list = [];

    if (bestSection) {
      list.push({
        type: 'success',
        text: `**${bestSection.name}** stands as the top-performing section with a stellar Overall Performance Score of **${bestSection.performance_score}/100**, driven by a strong **${R(bestSection.attendance_rate)}%** attendance rate and **${R(bestSection.retention_rate)}%** member retention.`,
        icon: Award
      });
    }

    if (fastestGrowing && fastestGrowing.new_members > 0) {
      list.push({
        type: 'info',
        text: `**${fastestGrowing.name}** is leading numerical growth with **${fastestGrowing.new_members}** new members registered during this period. This momentum highlights active local outreach.`,
        icon: Users
      });
    }

    if (mostConsistent) {
      list.push({
        type: 'success',
        text: `**${mostConsistent.name}** demonstrates exceptional stability with a consistency score of **${mostConsistent.consistency_score}%**, indicating highly predictable weekly attendance patterns.`,
        icon: CheckCircle2
      });
    }

    if (mostImproved) {
      const diff = (mostImproved.attendance_rate || 0) - (mostImproved.prev_rate || 0);
      if (diff > 0) {
        list.push({
          type: 'success',
          text: `**${mostImproved.name}** has shown the most significant recovery, improving its attendance rate by **+${R(diff)}%** compared to the previous period.`,
          icon: ArrowUp
        });
      }
    }

    if (attentionSection && attentionSection.performance_score < 60) {
      list.push({
        type: 'danger',
        text: `**${attentionSection.name}** requires urgent pastoral support. Its performance score is low (**${attentionSection.performance_score}/100**) due to an attendance rate of **${R(attentionSection.attendance_rate)}%** and a follow-up completion rate of only **${attentionSection.follow_up_rate || 0}%**.`,
        icon: AlertTriangle
      });
    }

    return list;
  };

  // Action Center Recommendations
  const getActionCenterRecommendations = () => {
    if (!secRankings.length) return [];
    const list = [];

    secRankings.forEach((s) => {
      if (s.attendance_rate < 60) {
        list.push({
          priority: 'high',
          category: 'Intervention',
          title: `Pastoral Intervention: ${s.name}`,
          description: `Attendance has fallen to ${R(s.attendance_rate)}%. Schedule a direct meeting with the Head Leader to review barriers.`
        });
      }
      if (s.follow_up_rate < 50 && s.total_absent > 3) {
        list.push({
          priority: 'high',
          category: 'Follow-up',
          title: `Boost Follow-up: ${s.name}`,
          description: `Only ${s.follow_up_rate || 0}% of absentees have been contacted. Mobilize section leaders to reach out to the ${s.total_absent} absent members.`
        });
      }
    });

    if (absentStreaks.length > 0) {
      const criticalStreaks = absentStreaks.filter((st) => st.current_streak >= 4);
      if (criticalStreaks.length > 0) {
        list.push({
          priority: 'high',
          category: 'Visitation',
          title: `Critical Home Visitations`,
          description: `${criticalStreaks.length} members have missed 4+ consecutive services. Assign home visitations to Sector Pastors immediately.`
        });
      }
    }

    secHeadLeaders.forEach((lh) => {
      if (lh.submission_rate < 80) {
        list.push({
          priority: 'medium',
          category: 'Leadership',
          title: `Submission Reminder: ${lh.leader_name}`,
          description: `Submission rate is currently at ${lh.submission_rate}%. Request submission of outstanding attendance reports.`
        });
      }
    });

    secRankings.forEach((s) => {
      if (s.performance_score >= 85) {
        list.push({
          priority: 'low',
          category: 'Recognition',
          title: `Commend Section: ${s.name}`,
          description: `Outstanding overall score of ${s.performance_score}/100. Send a letter of appreciation to the head leader and team.`
        });
      }
    });

    if (list.length === 0) {
      list.push({
        priority: 'low',
        category: 'Engagement',
        title: 'System Healthy',
        description:
          'All sections are currently meeting performance benchmarks. Maintain current leader support protocols.'
      });
    }

    return list.slice(0, 5); // display top 5 most critical items
  };

  // Absent streak categorization
  const streaks1W = absentStreaks.filter((s) => s.current_streak === 1);
  const streaks2W = absentStreaks.filter((s) => s.current_streak === 2);
  const streaks3W = absentStreaks.filter((s) => s.current_streak === 3);
  const streaks1M = absentStreaks.filter((s) => s.current_streak >= 4 && s.current_streak < 12);
  const streaks3M = absentStreaks.filter((s) => s.current_streak >= 12);

  const execInsights = getAIExecutiveInsights();
  const actionRecommendations = getActionCenterRecommendations();
  const activeLeaderRows = secLeaderRankings.length ? secLeaderRankings : leaderRankData;
  const normalizeName = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();
  const rankMovement = (value) => {
    if (value > 0) return { label: `Up ${value}`, className: 'text-emerald-600', icon: ArrowUp };
    if (value < 0)
      return { label: `Down ${Math.abs(value)}`, className: 'text-rose-600', icon: ArrowDown };
    return { label: 'No change', className: 'text-slate-500', icon: Minus };
  };
  const sectionStatus = (score, rate, followUpRate) => {
    if (score >= 80 && rate >= 75) return { label: 'Healthy', variant: 'success' };
    if (score >= 60 || rate >= 60 || followUpRate >= 60)
      return { label: 'Watch', variant: 'warning' };
    return { label: 'Intervention', variant: 'danger' };
  };
  const sectionIntelligence = filteredRankings.map((section) => {
    const sectionKey = normalizeName(section.name);
    const headLeader =
      secHeadLeaders.find((l) => normalizeName(l.section_name) === sectionKey) || null;
    const sectionLeaders = activeLeaderRows
      .filter((l) => normalizeName(l.section_name) === sectionKey)
      .map((leader, index) => {
        const assigned = Number(leader.assigned_members ?? leader.member_count ?? 0) || 0;
        const active = Number(leader.active_members ?? leader.unique_attendees ?? 0) || 0;
        const inactive = Number(leader.inactive_members ?? Math.max(0, assigned - active)) || 0;
        const present =
          Number(leader.total_present ?? leader.present ?? leader.unique_attendees ?? 0) || 0;
        const absent =
          Number(leader.total_absent ?? leader.absent ?? Math.max(0, assigned - active)) || 0;
        const excused = Number(leader.total_excused ?? leader.excused ?? 0) || 0;
        const rate = Number(leader.attendance_rate ?? leader.avg_rate ?? 0) || 0;
        const previousRate = Number(leader.prev_rate ?? 0) || 0;
        const followUpRequired = Number(leader.follow_up_required ?? absent) || 0;
        const followUpCompleted = Number(leader.follow_up_completed ?? 0) || 0;
        const followUpCompletion =
          followUpRequired > 0
            ? Math.round((followUpCompleted / followUpRequired) * 100)
            : Number(leader.follow_up_completion ?? 100) || 0;
        const retentionPct =
          Number(leader.retention_rate ?? (assigned > 0 ? (active / assigned) * 100 : 0)) || 0;
        const consistencyPct =
          Number(leader.consistency_score ?? Math.max(0, 100 - Math.abs(rate - previousRate))) || 0;
        const leadershipScore =
          Number(
            leader.efficiency_score ??
              leader.performance_score ??
              Math.round(
                rate * 0.35 + retentionPct * 0.25 + consistencyPct * 0.2 + followUpCompletion * 0.2
              )
          ) || 0;
        const status = sectionStatus(leadershipScore, rate, followUpCompletion);
        return {
          ...leader,
          rank: leader.rank || index + 1,
          assigned_members: assigned,
          active_members: active,
          inactive_members: inactive,
          total_present: present,
          total_absent: absent,
          total_excused: excused,
          attendance_rate: rate,
          prev_rate: previousRate,
          weekly_growth: Number(leader.weekly_growth ?? 0) || 0,
          monthly_growth: Number(leader.monthly_growth ?? 0) || 0,
          yearly_growth: Number(leader.yearly_growth ?? 0) || 0,
          retention_rate: retentionPct,
          consistency_score: consistencyPct,
          follow_up_required: followUpRequired,
          follow_up_completed: followUpCompleted,
          follow_up_completion: followUpCompletion,
          visits_completed: Number(leader.visits_completed ?? 0) || 0,
          counseling_cases: Number(leader.counseling_cases ?? 0) || 0,
          leadership_score: leadershipScore,
          status,
          rank_change: Number(leader.rank_change ?? 0) || 0
        };
      })
      .sort((a, b) => (b.leadership_score || 0) - (a.leadership_score || 0));
    const sectionStreaks = absentStreaks.filter(
      (m) => normalizeName(m.section_name) === sectionKey
    );
    const absent1wCount = sectionStreaks.filter((m) => m.current_streak === 1).length;
    const absent2wCount = sectionStreaks.filter((m) => m.current_streak === 2).length;
    const absent3wCount = sectionStreaks.filter((m) => m.current_streak === 3).length;
    const absent1mCount = sectionStreaks.filter(
      (m) => m.current_streak >= 4 && m.current_streak < 12
    ).length;
    const absent3mCount = sectionStreaks.filter((m) => m.current_streak >= 12).length;
    const totalLeaders = sectionLeaders.length;
    const avgLeaderScore = totalLeaders
      ? Math.round(
          sectionLeaders.reduce((sum, l) => sum + (l.leadership_score || 0), 0) / totalLeaders
        )
      : 0;
    const sectionHealthScore =
      Number(
        section.performance_score ??
          Math.round(
            (Number(section.attendance_rate) || 0) * 0.35 +
              (Number(section.retention_rate) || 0) * 0.25 +
              (Number(section.consistency_score) || 0) * 0.2 +
              (Number(section.follow_up_rate) || 0) * 0.2
          )
      ) || 0;
    const status = sectionStatus(
      sectionHealthScore,
      section.attendance_rate || 0,
      section.follow_up_rate || 0
    );
    const previousRank = Number(section.rank || 0) + Number(section.rank_change || 0);
    const weakestLeader = sectionLeaders[sectionLeaders.length - 1];
    const strongestLeader = sectionLeaders[0];
    const recommendations = [
      section.attendance_rate < 60
        ? `Meet with ${headLeader?.leader_name || `${section.name} head leader`} before the next service to review attendance barriers.`
        : `Maintain the practices keeping ${section.name} at ${R(section.attendance_rate)}% attendance.`,
      section.follow_up_rate < 70 && section.total_absent > 0
        ? `Close follow-up gaps for ${section.total_absent} absent markings; assign calls and visits today.`
        : 'Keep follow-up completion visible in leader check-ins.',
      weakestLeader
        ? `Coach ${weakestLeader.leader_name} first; current leadership score is ${weakestLeader.leadership_score}/100.`
        : 'Assign section leaders so member care is not carried by the head leader alone.',
      absent3wCount + absent1mCount + absent3mCount > 0
        ? `Prioritize ${absent3wCount + absent1mCount + absent3mCount} members absent three weeks or longer for pastoral care.`
        : 'No long-streak absentee pressure detected in this section.'
    ];
    return {
      section,
      headLeader,
      sectionLeaders,
      sectionStreaks,
      sectionHealthScore,
      avgLeaderScore,
      status,
      previousRank,
      strongestLeader,
      weakestLeader,
      absent1wCount,
      absent2wCount,
      absent3wCount,
      absent1mCount,
      absent3mCount,
      recommendations
    };
  });
  const toggleSection = (id) => {
    if (expandedSectionId === id) setExpandedSectionId(null);
    else {
      setExpandedSectionId(id);
      setSectionSubTab('overview');
    }
  };
  const MiniMetric = ({ label, value, suffix = '', tone = 'slate' }) => {
    const toneMap = {
      slate: 'text-slate-900 dark:text-white',
      green: 'text-emerald-600 dark:text-emerald-400',
      red: 'text-rose-600 dark:text-rose-400',
      amber: 'text-amber-600 dark:text-amber-400',
      indigo: 'text-indigo-600 dark:text-indigo-400'
    };
    return (
      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-lg font-black mt-1 ${toneMap[tone] || toneMap.slate}`}>
          {value ?? 0}
          {suffix}
        </p>
      </div>
    );
  };
  const renderRankMovement = (value) => {
    const movement = rankMovement(value);
    const Icon = movement.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold ${movement.className}`}
      >
        <Icon className="w-3 h-3" />
        {movement.label}
      </span>
    );
  };
  const renderSectionLeaderRows = (leaders) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700">
            {[
              'Rank',
              'Section Leader',
              'Active',
              'Att %',
              'Retention',
              'Score',
              'Movement',
              'Status',
              'AI Recommendation'
            ].map((h, i) => (
              <th
                key={h}
                className={`py-2 px-2 text-[9px] font-bold uppercase text-slate-400 ${i === 1 || i === 8 ? 'text-left' : 'text-right'} whitespace-nowrap`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, i) => {
            const diff = (leader.attendance_rate || 0) - (leader.prev_rate || 0);
            const aiText =
              leader.leadership_score < 60
                ? 'Immediate coaching, follow-up audit, and member contact list review required.'
                : diff < -5
                  ? 'Attendance is declining; ask for cause and recovery plan before next service.'
                  : leader.follow_up_completion < 70
                    ? 'Improve absentee follow-up completion and confirm visits for long absences.'
                    : 'Stable leadership pattern; document practices and maintain cadence.';
            return (
              <tr
                key={leader.leader_id || leader.leader_name || i}
                className="border-b border-slate-50 dark:border-slate-700/50"
              >
                <td className="py-2 px-2 text-right font-bold text-slate-500">
                  #{leader.rank || i + 1}
                </td>
                <td className="py-2 px-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  {leader.leader_name}
                </td>
                <td className="py-2 px-2 text-right text-emerald-600">{leader.active_members}</td>
                <td className="py-2 px-2 text-right">
                  <Badge
                    variant={
                      leader.attendance_rate >= 75
                        ? 'success'
                        : leader.attendance_rate >= 55
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {R(leader.attendance_rate)}%
                  </Badge>
                </td>
                <td className="py-2 px-2 text-right font-bold">{R(leader.retention_rate)}%</td>
                <td className="py-2 px-2 text-right">
                  <Badge
                    variant={
                      leader.leadership_score >= 75
                        ? 'success'
                        : leader.leadership_score >= 55
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {leader.leadership_score}/100
                  </Badge>
                </td>
                <td className="py-2 px-2 text-right">{renderRankMovement(leader.rank_change)}</td>
                <td className="py-2 px-2 text-right">
                  <Badge variant={leader.status.variant}>{leader.status.label}</Badge>
                </td>
                <td className="py-2 px-2 text-left min-w-[180px] text-slate-500">{aiText}</td>
              </tr>
            );
          })}
          {leaders.length === 0 && (
            <tr>
              <td colSpan="9" className="py-6 text-center text-slate-400">
                No section leaders assigned or no leader attendance data found for this section.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Period Selection Controls */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="text-[10px] text-slate-500 font-medium">Period comparison</p>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'week', label: 'This Week vs Last Week' },
              { id: 'month', label: 'This Month vs Last Month' },
              { id: 'quarter', label: 'This Quarter vs Last Quarter' },
              { id: 'year', label: 'This Year vs Last Year' },
              { id: 'custom', label: 'Custom Date Ranges' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSecPeriod(p.id)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                  secPeriod === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {secPeriod === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-750">
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Period 1 (Current Period)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={secP1Start}
                    onChange={(e) => setSecP1Start(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400">End Date</label>
                  <input
                    type="date"
                    value={secP1End}
                    onChange={(e) => setSecP1End(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Period 2 (Comparison Period)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={secP2Start}
                    onChange={(e) => setSecP2Start(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400">End Date</label>
                  <input
                    type="date"
                    value={secP2End}
                    onChange={(e) => setSecP2End(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loaders and error states */}
      {secLoading && (
        <div className="flex items-center justify-center p-12 text-slate-500 text-xs">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin text-indigo-500" />
          Loading Section Intelligence & Performance metrics...
        </div>
      )}

      {secError && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 inline mr-2 text-rose-600" />
          {secError}
        </div>
      )}

      {!secLoading && !secError && secRankings.length > 0 && (
        <>
          {/* Key Highlights — 4 primary KPIs, 3 secondary on toggle */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`rounded-2xl border p-4 shadow-sm ${healthColor}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500/80">
                  Roster Health
                </p>
                <p className="text-2xl font-black mt-1">
                  {avgHealthScore}
                  <span className="text-xs font-semibold">/100</span>
                </p>
                <div className="mt-2">
                  <Badge variant={healthBadge}>{healthStatus}</Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Average section performance across all metrics
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Performance Leader
                </p>
                <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">
                  {bestSection?.name || '—'}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: bestSection?.performance_score >= 75 ? '#10b981' : '#f59e0b' }}
                >
                  {bestSection?.performance_score || 0} / 100 score ·{' '}
                  {R(bestSection?.attendance_rate)}% attendance
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Growth Leader
                </p>
                <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">
                  {fastestGrowing?.name || '—'}
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                  +{fastestGrowing?.new_members || 0} new members added
                </p>
              </div>

              <div className="rounded-2xl border border-red-200/60 bg-red-50/50 dark:bg-red-950/15 dark:border-red-900/30 p-4 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wider text-red-600/80">
                  Requires Review
                </p>
                <p className="text-base font-bold text-red-900 dark:text-red-400 truncate mt-1">
                  {attentionSection?.name || '—'}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
                  {attentionSection?.performance_score || 0} / 100 score ·{' '}
                  {R(attentionSection?.attendance_rate)}% attendance
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowExtraKPIs(!showExtraKPIs)}
              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              {showExtraKPIs ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showExtraKPIs
                ? 'Hide detailed metrics'
                : 'Show detailed metrics (Most Improved, Retention Leader, Consistency Leader)'}
            </button>

            {showExtraKPIs && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Most Improved
                  </p>
                  <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">
                    {mostImproved?.name || '—'}
                  </p>
                  {mostImproved && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      +{R((mostImproved.attendance_rate || 0) - (mostImproved.prev_rate || 0))}%
                      rate improvement
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Retention Leader
                  </p>
                  <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">
                    {highestRetention?.name || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {R(highestRetention?.retention_rate)}% active retention
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Consistency Leader
                  </p>
                  <p className="text-base font-bold text-slate-950 dark:text-white truncate mt-1">
                    {mostConsistent?.name || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mostConsistent?.consistency_score}% stability index
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Decision Support — merged insights + actions */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Decision Support
                </h3>
                <span className="text-[10px] text-slate-400 font-medium ml-1">
                  · {execInsights.length} insights · {actionRecommendations.length} actions
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                AI-powered analysis with prioritized recommendations for leadership action
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {execInsights.map((ins, i) => {
                const Icon = ins.icon || Info;
                const typeClass =
                  ins.type === 'danger'
                    ? 'border-l-2 border-l-rose-400 bg-rose-50/30 dark:bg-rose-950/10'
                    : ins.type === 'success'
                      ? 'border-l-2 border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'border-l-2 border-l-blue-400 bg-blue-50/30 dark:bg-blue-950/10';
                return (
                  <div key={i} className={`p-3.5 flex items-start gap-3 ${typeClass}`}>
                    <Icon
                      className="w-4 h-4 mt-0.5 shrink-0"
                      style={{
                        color:
                          ins.type === 'danger'
                            ? '#f43f5e'
                            : ins.type === 'success'
                              ? '#10b981'
                              : '#6366f1'
                      }}
                    />
                    <p
                      className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300"
                      dangerouslySetInnerHTML={{
                        __html: escapeHtml(ins.text).replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong>$1</strong>'
                        )
                      }}
                    />
                  </div>
                );
              })}
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {actionRecommendations.map((act, i) => {
                  const borderColor =
                    act.priority === 'high'
                      ? 'border-l-2 border-l-rose-400'
                      : act.priority === 'medium'
                        ? 'border-l-2 border-l-amber-400'
                        : 'border-l-2 border-l-emerald-400';
                  return (
                    <div key={i} className={`p-3.5 flex items-start gap-3 ${borderColor}`}>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${act.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : act.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}
                      >
                        <span className="text-[8px] font-black">
                          {act.priority === 'high' ? '!' : act.priority === 'medium' ? '→' : '✓'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[8px] font-black uppercase px-1 py-0.5 rounded ${act.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : act.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
                          >
                            {act.priority}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-400 uppercase">
                            {act.category}
                          </span>
                          <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                            {act.title}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 360-degree Section Performance Dashboard */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  360-degree Section Performance Dashboard
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Each section contains head leader, section leaders, member intelligence,
                  retention, follow-up, AI insights, and immediate actions.
                </p>
              </div>
              <Badge variant="info">{sectionIntelligence.length} Sections Analyzed</Badge>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sectionIntelligence.map((item, idx) => {
                const { section, headLeader, sectionLeaders, sectionStreaks } = item;
                const isOpen = expandedSectionId === (section.id || section.name);
                const diff = (section.attendance_rate || 0) - (section.prev_rate || 0);
                const longAbsentees = item.absent3wCount + item.absent1mCount + item.absent3mCount;
                const MovementIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
                return (
                  <div
                    key={section.id || section.name}
                    id={`section-card-${section.id || section.name}`}
                    className="bg-white dark:bg-slate-800 scroll-mt-4"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id || section.name)}
                      className="w-full p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black shrink-0">
                          {section.rank || idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-slate-950 dark:text-white truncate">
                              {section.name}
                            </h4>
                            <Badge variant={item.status.variant}>{item.status.label}</Badge>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                            >
                              <MovementIcon className="w-3 h-3" />
                              {diff >= 0 ? '+' : ''}
                              {R(diff)}% attendance movement
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Head Leader:{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {headLeader?.leader_name || 'Not assigned'}
                            </span>{' '}
                            • {sectionLeaders.length} section leaders • {section.member_count || 0}{' '}
                            active members • {longAbsentees} high-risk absentees
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 lg:min-w-[560px]">
                        <MiniMetric
                          label="Health"
                          value={item.sectionHealthScore}
                          suffix="/100"
                          tone={
                            item.sectionHealthScore >= 75
                              ? 'green'
                              : item.sectionHealthScore >= 55
                                ? 'amber'
                                : 'red'
                          }
                        />
                        <MiniMetric
                          label="Leader Score"
                          value={item.avgLeaderScore}
                          suffix="/100"
                          tone={
                            item.avgLeaderScore >= 75
                              ? 'green'
                              : item.avgLeaderScore >= 55
                                ? 'amber'
                                : 'red'
                          }
                        />
                        <MiniMetric
                          label="Attendance"
                          value={R(section.attendance_rate)}
                          suffix="%"
                          tone={
                            section.attendance_rate >= 75
                              ? 'green'
                              : section.attendance_rate >= 55
                                ? 'amber'
                                : 'red'
                          }
                        />
                        <MiniMetric
                          label="Retention"
                          value={R(section.retention_rate)}
                          suffix="%"
                          tone={
                            section.retention_rate >= 75
                              ? 'green'
                              : section.retention_rate >= 55
                                ? 'amber'
                                : 'red'
                          }
                        />
                        <MiniMetric
                          label="Follow-up"
                          value={R(section.follow_up_rate)}
                          suffix="%"
                          tone={
                            section.follow_up_rate >= 75
                              ? 'green'
                              : section.follow_up_rate >= 55
                                ? 'amber'
                                : 'red'
                          }
                        />
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {section.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/sections?profile=${section.id}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                            title="View full section profile"
                          >
                            <Layers className="w-3 h-3" /> View Profile
                          </button>
                        )}
                        <div className="text-slate-400">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-5 space-y-4">
                        {/* Sub-tab navigation */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-0.5 rounded-xl w-fit">
                          {['overview', 'leaders', 'members', 'insights'].map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setSectionSubTab(tab)}
                              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg capitalize transition-all ${
                                sectionSubTab === tab
                                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              {tab === 'overview' && (
                                <>
                                  <BarChart3 className="w-3 h-3 inline mr-1" />
                                  Overview
                                </>
                              )}
                              {tab === 'leaders' && (
                                <>
                                  <Award className="w-3 h-3 inline mr-1" />
                                  Leaders
                                </>
                              )}
                              {tab === 'members' && (
                                <>
                                  <UserX className="w-3 h-3 inline mr-1" />
                                  Members
                                </>
                              )}
                              {tab === 'insights' && (
                                <>
                                  <Brain className="w-3 h-3 inline mr-1" />
                                  Insights
                                </>
                              )}
                            </button>
                          ))}
                        </div>

                        {sectionSubTab === 'overview' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <BarChart3 className="w-4 h-4 text-indigo-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Section Statistics
                                </h5>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MiniMetric
                                  label="Registered"
                                  value={section.registered_members || 0}
                                />
                                <MiniMetric
                                  label="Active"
                                  value={section.member_count || 0}
                                  tone="green"
                                />
                                <MiniMetric
                                  label="Inactive"
                                  value={section.inactive_members || 0}
                                  tone="red"
                                />
                                <MiniMetric
                                  label="Visitors"
                                  value={section.visitors || 0}
                                  tone="amber"
                                />
                                <MiniMetric
                                  label="New Members"
                                  value={section.new_members || 0}
                                  tone="indigo"
                                />
                                <MiniMetric
                                  label="Excused"
                                  value={section.total_excused || 0}
                                  tone="amber"
                                />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Award className="w-4 h-4 text-amber-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Rankings
                                </h5>
                              </div>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Current Rank</span>
                                  <span className="font-black">#{section.rank}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Previous Rank</span>
                                  <span className="font-black">
                                    #{item.previousRank || section.rank}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Movement</span>
                                  {renderRankMovement(section.rank_change || 0)}
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Strongest Leader</span>
                                  <span className="font-semibold text-right">
                                    {item.strongestLeader?.leader_name || '—'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Needs Coaching</span>
                                  <span className="font-semibold text-right">
                                    {item.weakestLeader?.leader_name || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-4 h-4 text-emerald-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Head Leader
                                </h5>
                              </div>
                              {headLeader ? (
                                <div className="space-y-2 text-xs">
                                  <p className="font-black text-slate-900 dark:text-white">
                                    {headLeader.leader_name}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <MiniMetric
                                      label="Managed"
                                      value={headLeader.members_managed || 0}
                                    />
                                    <MiniMetric
                                      label="Leaders"
                                      value={headLeader.leaders_supervised || 0}
                                    />
                                    <MiniMetric
                                      label="Attendance"
                                      value={R(headLeader.overall_attendance)}
                                      suffix="%"
                                      tone="green"
                                    />
                                    <MiniMetric
                                      label="Submission"
                                      value={R(headLeader.submission_rate)}
                                      suffix="%"
                                      tone="indigo"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400">No head leader record</p>
                              )}
                            </div>

                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <UserX className="w-4 h-4 text-rose-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Absence Intelligence
                                </h5>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MiniMetric
                                  label="1 Week"
                                  value={item.absent1wCount}
                                  tone="indigo"
                                />
                                <MiniMetric
                                  label="2 Weeks"
                                  value={item.absent2wCount}
                                  tone="amber"
                                />
                                <MiniMetric label="3 Weeks" value={item.absent3wCount} tone="red" />
                                <MiniMetric label="1 Month" value={item.absent1mCount} tone="red" />
                                <MiniMetric
                                  label="3 Months"
                                  value={item.absent3mCount}
                                  tone="red"
                                />
                                <MiniMetric
                                  label="Follow-up Needed"
                                  value={sectionStreaks.length}
                                  tone="red"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {sectionSubTab === 'leaders' && (
                          <div>
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Section Leader Performance
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Metrics from assigned members, attendance, submissions, and
                                  follow-up records
                                </p>
                              </div>
                              {renderSectionLeaderRows(sectionLeaders)}
                            </div>
                          </div>
                        )}

                        {sectionSubTab === 'members' && (
                          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Heart className="w-4 h-4 text-rose-500" />
                              <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                Member Intelligence & Follow-up
                              </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                              {sectionStreaks.slice(0, 8).map((member) => (
                                <div
                                  key={member.member_id}
                                  className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                      {member.full_name}
                                    </p>
                                    <Badge
                                      variant={
                                        member.current_streak >= 3
                                          ? 'danger'
                                          : member.current_streak === 2
                                            ? 'warning'
                                            : 'info'
                                      }
                                    >
                                      {member.current_streak}w
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    Last absent: {member.last_absent_date || 'Not recorded'}
                                  </p>
                                  <p className="text-[10px] text-indigo-600 dark:text-indigo-300 mt-1">
                                    {member.current_streak >= 3
                                      ? 'Assign visit or pastoral call immediately.'
                                      : 'Leader phone call and prayer request check.'}
                                  </p>
                                </div>
                              ))}
                              {sectionStreaks.length === 0 && (
                                <p className="text-xs text-slate-400">No active absentee streaks</p>
                              )}
                            </div>
                          </div>
                        )}

                        {sectionSubTab === 'insights' && (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="w-4 h-4 text-indigo-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  AI Executive Insights
                                </h5>
                              </div>
                              <div className="space-y-2 text-[10px] text-slate-600 dark:text-slate-300">
                                <p>
                                  <span className="font-black text-slate-900 dark:text-white">
                                    {section.name}
                                  </span>{' '}
                                  is ranked #{section.rank} with a {item.sectionHealthScore}/100
                                  health score and {R(section.attendance_rate)}% attendance.
                                </p>
                                <p>
                                  {diff >= 0
                                    ? 'Attendance is improving or stable compared with the previous period.'
                                    : 'Attendance declined compared with the previous period and requires leadership review.'}
                                </p>
                                <p>
                                  {longAbsentees > 0
                                    ? `${longAbsentees} members have been absent three weeks or longer; pastoral follow-up should be prioritized.`
                                    : 'No long-term absentee cluster is currently visible from attendance history.'}
                                </p>
                                <p>
                                  {item.weakestLeader
                                    ? `${item.weakestLeader.leader_name} is the first coaching priority based on leadership score and attendance movement.`
                                    : 'Leader assignment data is incomplete for this section.'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Target className="w-4 h-4 text-emerald-500" />
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                  Recommended Actions
                                </h5>
                              </div>
                              <div className="space-y-2">
                                {item.recommendations.map((rec, recIdx) => (
                                  <div
                                    key={recIdx}
                                    className="flex gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0">
                                      {recIdx + 1}
                                    </span>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-300">
                                      {rec}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Roster Rankings Table — core columns by default, toggle for extras */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/10">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Roster Rankings & Comparisons
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Click column headers to sort.{' '}
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    Click any row to expand the full section breakdown above
                  </span>{' '}
                  (members, leaders, AI insights, follow-up).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAllColumns(!showAllColumns)}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {showAllColumns ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {showAllColumns ? 'Fewer columns' : 'All columns'}
                </button>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search sections..."
                    value={secSearch}
                    onChange={(e) => setSecSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/80">
                    <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500 text-center w-12">
                      Rank
                    </th>
                    {renderSortHeader('Section Name', 'name')}
                    {renderSortHeader('Active', 'member_count', 'right')}
                    {renderSortHeader('Att %', 'attendance_rate', 'right')}
                    {renderSortHeader('Retention %', 'retention_rate', 'right')}
                    {renderSortHeader('Score', 'performance_score', 'right')}
                    {renderSortHeader('Movement', 'rank_change', 'right')}
                    {showAllColumns && (
                      <>
                        {renderSortHeader('Registered', 'registered_members', 'right')}
                        {renderSortHeader('Inactive', 'inactive_members', 'right')}
                        {renderSortHeader('Visitors', 'visitors', 'right')}
                        {renderSortHeader('New', 'new_members', 'right')}
                        {renderSortHeader('Present', 'total_present', 'right')}
                        {renderSortHeader('Absent', 'total_absent', 'right')}
                        {renderSortHeader('Excused', 'total_excused', 'right')}
                        {renderSortHeader('Prev %', 'prev_rate', 'right')}
                        {renderSortHeader('Diff %', 'attendance_diff', 'right')}
                        {renderSortHeader('W.Growth', 'weekly_growth', 'right')}
                        {renderSortHeader('M.Growth', 'monthly_growth', 'right')}
                        {renderSortHeader('Y.Growth', 'yearly_growth', 'right')}
                        {renderSortHeader('Consistency %', 'consistency_score', 'right')}
                        {renderSortHeader('Follow-up %', 'follow_up_rate', 'right')}
                        <th className="px-3 py-2 text-[9px] font-black uppercase text-slate-500 text-right">
                          Prev Rank
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings.map((row, i) => {
                    const diff = (row.attendance_rate || 0) - (row.prev_rate || 0);
                    const prevRank = row.rank + row.rank_change;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-50 dark:border-slate-750/30 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors"
                        onClick={() => {
                          const secKey = row.id || row.name;
                          if (expandedSectionId !== secKey) {
                            setExpandedSectionId(secKey);
                            setSectionSubTab('overview');
                            document
                              .getElementById(`section-card-${secKey}`)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          } else {
                            setExpandedSectionId(null);
                          }
                        }}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`text-[10px] font-black w-6 h-6 inline-flex items-center justify-center rounded-full ${
                              i === 0
                                ? 'bg-amber-100 text-amber-800'
                                : i === 1
                                  ? 'bg-slate-200 text-slate-700'
                                  : i === 2
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'text-slate-400'
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                          {row.member_count || 0}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                          <Badge
                            variant={
                              row.attendance_rate >= 80
                                ? 'success'
                                : row.attendance_rate >= 60
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {R(row.attendance_rate)}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                          {R(row.retention_rate)}%
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs">
                          <Badge
                            variant={
                              row.performance_score >= 80
                                ? 'success'
                                : row.performance_score >= 60
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {row.performance_score}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                          {row.rank_change > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                              <ArrowUp className="w-2.5 h-2.5" /> +{row.rank_change}
                            </span>
                          )}
                          {row.rank_change < 0 && (
                            <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                              <ArrowDown className="w-2.5 h-2.5" /> {row.rank_change}
                            </span>
                          )}
                          {row.rank_change === 0 && (
                            <span className="inline-flex items-center gap-0.5 text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              <Minus className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </td>
                        {showAllColumns && (
                          <>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">
                              {row.registered_members || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-rose-500 text-xs">
                              {row.inactive_members || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-amber-600 text-xs">
                              {row.visitors || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-indigo-500 text-xs">
                              +{row.new_members || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-emerald-600 text-xs">
                              {row.total_present?.toLocaleString() || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-rose-500 text-xs">
                              {row.total_absent?.toLocaleString() || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-amber-500 text-xs">
                              {row.total_excused || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-400 text-xs">
                              {row.prev_rate != null ? `${R(row.prev_rate)}%` : '—'}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-bold text-xs whitespace-nowrap ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                            >
                              {diff >= 0 ? '+' : ''}
                              {R(diff)}%
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                              +{row.weekly_growth || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                              +{row.monthly_growth || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
                              +{row.yearly_growth || 0}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-xs text-slate-700 dark:text-slate-300">
                              {row.consistency_score}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-xs text-indigo-600 dark:text-indigo-400">
                              {row.follow_up_rate || 0}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-400 text-xs">
                              #{prevRank}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Follow-up Intelligence Panel */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-750 pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-sans">
                  Roster Follow-up Intelligence
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Consecutive absentees grouped by streak duration with specific visitation &
                  counseling actions
                </p>
              </div>
              <Badge variant="danger">{absentStreaks.length} Total Absentees</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* 1 Week Streak */}
              <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/20 p-3 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      1 Week Absent
                    </span>
                    <Badge variant="info">{streaks1W.length}</Badge>
                  </div>
                  <div className="p-2 rounded bg-blue-50/60 dark:bg-blue-950/10 text-[9px] text-blue-700 dark:text-blue-400 font-medium">
                    Action: Send automated wellness SMS check.
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {streaks1W.slice(0, 5).map((m) => (
                      <div
                        key={m.member_id}
                        className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate"
                      >
                        <span className="font-bold text-slate-850 dark:text-slate-200">
                          {m.full_name}
                        </span>
                        <span className="text-slate-400 ml-1">({m.section_name})</span>
                      </div>
                    ))}
                    {streaks1W.length > 5 && (
                      <p className="text-[8px] text-slate-400 text-center font-bold">
                        +{streaks1W.length - 5} more members
                      </p>
                    )}
                    {streaks1W.length === 0 && (
                      <p className="text-[9px] text-slate-400 text-center py-2">
                        No active streaks
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2 Weeks Streak */}
              <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/20 p-3 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      2 Weeks Absent
                    </span>
                    <Badge variant="warning">{streaks2W.length}</Badge>
                  </div>
                  <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/10 text-[9px] text-amber-700 dark:text-amber-400 font-medium">
                    Action: Section leader phone call for prayer request intake.
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {streaks2W.slice(0, 5).map((m) => (
                      <div
                        key={m.member_id}
                        className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate"
                      >
                        <span className="font-bold text-slate-850 dark:text-slate-200">
                          {m.full_name}
                        </span>
                        <span className="text-slate-400 ml-1">({m.section_name})</span>
                      </div>
                    ))}
                    {streaks2W.length > 5 && (
                      <p className="text-[8px] text-slate-400 text-center font-bold">
                        +{streaks2W.length - 5} more members
                      </p>
                    )}
                    {streaks2W.length === 0 && (
                      <p className="text-[9px] text-slate-400 text-center py-2">
                        No active streaks
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 Weeks Streak */}
              <div className="rounded-xl border border-red-200/40 dark:border-red-900/20 bg-red-50/10 p-3 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-red-700 dark:text-red-300">
                      3 Weeks Absent
                    </span>
                    <Badge variant="danger">{streaks3W.length}</Badge>
                  </div>
                  <div className="p-2 rounded bg-rose-50/60 dark:bg-rose-950/10 text-[9px] text-rose-700 dark:text-rose-400 font-medium">
                    Action: Head Leader visitation assignment; queue pastoral care.
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {streaks3W.slice(0, 5).map((m) => (
                      <div
                        key={m.member_id}
                        className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate"
                      >
                        <span className="font-bold text-slate-850 dark:text-slate-200">
                          {m.full_name}
                        </span>
                        <span className="text-slate-400 ml-1">({m.section_name})</span>
                      </div>
                    ))}
                    {streaks3W.length > 5 && (
                      <p className="text-[8px] text-slate-400 text-center font-bold">
                        +{streaks3W.length - 5} more members
                      </p>
                    )}
                    {streaks3W.length === 0 && (
                      <p className="text-[9px] text-slate-400 text-center py-2">
                        No active streaks
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 1 Month Streak */}
              <div className="rounded-xl border border-red-300/40 dark:border-red-900/35 bg-red-50/15 p-3 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-red-800 dark:text-red-400">
                      1 Month Absent
                    </span>
                    <Badge variant="danger">{streaks1M.length}</Badge>
                  </div>
                  <div className="p-2 rounded bg-red-100/60 dark:bg-red-950/20 text-[9px] text-red-800 dark:text-red-300 font-medium">
                    Action: Home visit by Sector Pastor; counseling requirement.
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {streaks1M.slice(0, 5).map((m) => (
                      <div
                        key={m.member_id}
                        className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate"
                      >
                        <span className="font-bold text-slate-850 dark:text-slate-200">
                          {m.full_name}
                        </span>
                        <span className="text-slate-400 ml-1">({m.section_name})</span>
                      </div>
                    ))}
                    {streaks1M.length > 5 && (
                      <p className="text-[8px] text-slate-400 text-center font-bold">
                        +{streaks1M.length - 5} more members
                      </p>
                    )}
                    {streaks1M.length === 0 && (
                      <p className="text-[9px] text-slate-400 text-center py-2">
                        No active streaks
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 Months Streak */}
              <div className="rounded-xl border border-slate-300 dark:border-slate-650 bg-slate-200/20 p-3 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-850 dark:text-slate-200">
                      3 Months+ Inactive
                    </span>
                    <Badge variant="danger">{streaks3M.length}</Badge>
                  </div>
                  <div className="p-2 rounded bg-slate-200 dark:bg-slate-700 text-[9px] text-slate-800 dark:text-slate-200 font-medium">
                    Action: Official inactivity review; wellness check visitation.
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {streaks3M.slice(0, 5).map((m) => (
                      <div
                        key={m.member_id}
                        className="text-[9px] p-1 border-b border-slate-100 dark:border-slate-850 truncate"
                      >
                        <span className="font-bold text-slate-850 dark:text-slate-200">
                          {m.full_name}
                        </span>
                        <span className="text-slate-400 ml-1">({m.section_name})</span>
                      </div>
                    ))}
                    {streaks3M.length > 5 && (
                      <p className="text-[8px] text-slate-400 text-center font-bold">
                        +{streaks3M.length - 5} more members
                      </p>
                    )}
                    {streaks3M.length === 0 && (
                      <p className="text-[9px] text-slate-400 text-center py-2">
                        No inactive streaks
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Leadership Analytics Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Section Leadership Performance
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Head leader metrics including members managed, submission records, and overall
                leadership score
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/80">
                    {renderLeadSortHeader('Head Leader', 'leader_name')}
                    {renderLeadSortHeader('Section Managed', 'section_name')}
                    {renderLeadSortHeader('Members Managed', 'members_managed', 'right')}
                    {renderLeadSortHeader('Supervised Leaders', 'leaders_supervised', 'right')}
                    {renderLeadSortHeader('Attendance Perform.', 'overall_attendance', 'right')}
                    {renderLeadSortHeader('Report Submission Rate', 'submission_rate', 'right')}
                    {renderLeadSortHeader('Leadership Score', 'performance_score', 'right')}
                  </tr>
                </thead>
                <tbody>
                  {sortedHeadLeaders.map((lh) => (
                    <tr
                      key={lh.leader_id}
                      className="border-b border-slate-50 dark:border-slate-750/30 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white text-xs">
                        {lh.leader_name}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-500 text-xs">
                        {lh.section_name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700 dark:text-slate-350 text-xs">
                        {lh.members_managed}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-500 text-xs">
                        {lh.leaders_supervised}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        <Badge
                          variant={
                            lh.overall_attendance >= 80
                              ? 'success'
                              : lh.overall_attendance >= 60
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {R(lh.overall_attendance)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        <Badge
                          variant={
                            lh.submission_rate >= 90
                              ? 'success'
                              : lh.submission_rate >= 70
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {lh.submission_rate}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        <Badge
                          variant={
                            lh.performance_score >= 80
                              ? 'success'
                              : lh.performance_score >= 60
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {lh.performance_score}/100
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {sortedHeadLeaders.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-6 text-slate-400 text-xs">
                        No section leadership data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!secLoading && !secError && secRankings.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No section attendance data available for the current period selection.
        </div>
      )}
    </div>
  );
};

export default SectionsTab;
