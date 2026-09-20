import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Brain,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Flame,
  Heart,
  RefreshCw,
  Search,
  Shield,
  Star,
  Target,
  UserRound,
  UserCheck,
  UserX,
  Users,
  X,
  XCircle
} from 'lucide-react';
import Badge from '../../ui/Badge';
import { fdate, fdatetime } from '../../../utils/date';
import { asArray, weekToDate } from './reportShared';

const MembersTab = ({ data, actions: tabActions }) => {
  const {
    memberIntelligence,
    sectionRankings,
    memberCategory,
    memberRiskFilter,
    memberSectionFilter,
    memberLeaderFilter,
    memberSearch,
    memberView,
    memberWeeksCount,
    memberWeeklyMatrix,
    memberWeeklyMatrixWeeks,
    memberWeeklyLoading,
    selectedMemberDetails,
    memberDetailsLoading,
    memberDetailsError,
    serviceLabel
  } = data;
  const {
    setMemberCategory,
    setMemberSearch,
    setMemberRiskFilter,
    setMemberSectionFilter,
    setMemberLeaderFilter,
    setMemberView,
    setMemberWeeksCount,
    loadMemberWeeklyMatrix,
    openMemberAttendanceDetails,
    setSelectedMemberDetails
  } = tabActions;
  const rawMembers = memberIntelligence;
  const [groupByOwner, setGroupByOwner] = useState(false);
  const daysBetween = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };
  const durationLabel = (dateStr) => {
    const days = daysBetween(dateStr);
    if (days == null) return 'Unknown';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  };
  const riskInfo = (member) => {
    const absences = Number(member.consecutive_absences || 0);
    const rate = Number(member.attendance_rate || 0);
    const daysSince = Number(member.days_since_last_attendance || 9999);
    if (absences >= 12 || daysSince >= 180 || (rate < 20 && member.total_records > 0))
      return { label: 'Critical', variant: 'danger', score: 4 };
    if (absences >= 4 || daysSince >= 60 || rate < 40)
      return { label: 'High', variant: 'danger', score: 3 };
    if (absences >= 2 || daysSince >= 21 || rate < 60)
      return { label: 'Medium', variant: 'warning', score: 2 };
    return { label: 'Low', variant: 'success', score: 1 };
  };
  const members = rawMembers
    .map((m, index) => {
      const attendanceRate = Number(m.attendance_rate || 0);
      const previousRate = Number(m.previous_attendance_rate || 0);
      const presentCount = Number(m.present_count || 0);
      const absentCount = Number(m.absent_count || 0);
      const excusedCount = Number(m.excused_count || 0);
      const totalRecords = Number(m.total_records || 0);
      const weeklyGrowthValue =
        Number(m.weekly_present || 0) - Number(m.previous_weekly_present || 0);
      const monthlyGrowthValue =
        Number(m.monthly_present || 0) - Number(m.previous_monthly_present || 0);
      const daysSince = daysBetween(m.last_attendance_date);
      const retentionScore = Number(m.retention_score || attendanceRate || 0);
      const engagementScore = Number(
        m.engagement_score || Math.round(attendanceRate * 0.8 + Math.min(20, presentCount)) || 0
      );
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            attendanceRate * 0.35 +
              retentionScore * 0.25 +
              engagementScore * 0.25 +
              Math.max(0, 15 - Number(m.consecutive_absences || 0) * 3)
          )
        )
      );
      const enriched = {
        ...m,
        current_rank: index + 1,
        previous_rank: index + 1,
        rank_movement: 0,
        membership_duration: durationLabel(m.registered_date),
        attendance_rate: attendanceRate,
        present_count: presentCount,
        absent_count: absentCount,
        excused_count: excusedCount,
        previous_attendance_rate: previousRate,
        attendance_difference: attendanceRate - previousRate,
        weekly_growth: weeklyGrowthValue,
        monthly_growth: monthlyGrowthValue,
        longest_attendance_streak: Number(
          m.longest_attendance_streak || m.current_attendance_streak || 0
        ),
        current_attendance_streak: Number(m.current_attendance_streak || 0),
        consecutive_absences: Number(m.consecutive_absences || 0),
        days_since_last_attendance: daysSince == null ? 9999 : daysSince,
        active_status: Number(m.is_active) === 0 ? 'Inactive' : 'Active',
        follow_up_status:
          m.follow_up_status ||
          (Number(m.consecutive_absences || 0) > 0 ? 'Pending' : 'Not Required'),
        prayer_request_status:
          m.prayer_requests && m.prayer_requests !== '[]' ? 'Has Prayer Request' : 'None',
        notes: m.follow_up_notes || '',
        retention_score: retentionScore,
        engagement_score: engagementScore,
        overall_member_health_score: healthScore,
        visitor_conversion: Boolean(m.visitor_date),
        no_attendance_history: totalRecords === 0
      };
      const risk = riskInfo(enriched);
      return {
        ...enriched,
        risk_level: risk.label,
        risk_variant: risk.variant,
        risk_score: risk.score
      };
    })
    .sort((a, b) => {
      const issueDiff =
        b.absent_count +
        b.excused_count +
        b.risk_score -
        (a.absent_count + a.excused_count + a.risk_score);
      if (issueDiff !== 0) return issueDiff;
      return a.attendance_rate - b.attendance_rate;
    });

  members.forEach((member, index) => {
    member.current_rank = index + 1;
    member.previous_rank =
      index +
      1 +
      (member.attendance_difference < -5 ? -1 : member.attendance_difference > 5 ? 1 : 0);
    member.rank_movement = member.previous_rank - member.current_rank;
  });

  const categoryDefinitions = [
    { id: 'all', label: 'All Members', test: () => true },
    { id: 'most-active', label: 'Most Active Members', test: (m) => m.attendance_rate >= 80 },
    {
      id: 'perfect',
      label: 'Perfect Attendance Members',
      test: (m) => m.attendance_rate >= 100 && m.total_records > 0
    },
    {
      id: 'consistent',
      label: 'Consistent Members',
      test: (m) => m.current_attendance_streak >= 3 || m.engagement_score >= 75
    },
    { id: 'improving', label: 'Improving Members', test: (m) => m.attendance_difference >= 10 },
    { id: 'declining', label: 'Declining Members', test: (m) => m.attendance_difference <= -10 },
    {
      id: 'new',
      label: 'New Members',
      test: (m) => daysBetween(m.registered_date) != null && daysBetween(m.registered_date) <= 30
    },
    {
      id: 'returning',
      label: 'Returning Members',
      test: (m) => m.previous_attendance_rate < 30 && m.attendance_rate >= 50
    },
    { id: 'visitors', label: 'Visitors', test: (m) => m.visitor_conversion },
    {
      id: 'recently-baptized',
      label: 'Recently Baptized Members',
      test: (m) =>
        String(m.flags || '')
          .toLowerCase()
          .includes('bapt')
    },
    {
      id: 'youth',
      label: 'Youth Members',
      test: (m) =>
        String(m.age_group || '')
          .toLowerCase()
          .includes('youth')
    },
    {
      id: 'adult',
      label: 'Adult Members',
      test: (m) =>
        String(m.age_group || '')
          .toLowerCase()
          .includes('adult')
    },
    {
      id: 'senior',
      label: 'Senior Members',
      test: (m) =>
        String(m.age_group || '')
          .toLowerCase()
          .includes('senior')
    },
    {
      id: 'men',
      label: 'Men',
      test: (m) =>
        String(m.gender || '')
          .toLowerCase()
          .startsWith('m')
    },
    {
      id: 'women',
      label: 'Women',
      test: (m) =>
        String(m.gender || '')
          .toLowerCase()
          .startsWith('f') ||
        String(m.gender || '')
          .toLowerCase()
          .startsWith('w')
    },
    {
      id: 'missing-1',
      label: 'Members Missing One Service',
      test: (m) => m.consecutive_absences === 1
    },
    {
      id: 'missing-2',
      label: 'Members Missing Two Consecutive Services',
      test: (m) => m.consecutive_absences === 2
    },
    {
      id: 'missing-3',
      label: 'Members Missing Three Consecutive Services',
      test: (m) => m.consecutive_absences === 3
    },
    {
      id: 'missing-1m',
      label: 'Members Missing One Month',
      test: (m) => m.consecutive_absences >= 4 && m.consecutive_absences < 12
    },
    {
      id: 'missing-3m',
      label: 'Members Missing Three Months',
      test: (m) => m.consecutive_absences >= 12
    },
    {
      id: 'visitation',
      label: 'Members Requiring Visitation',
      test: (m) => m.consecutive_absences >= 3 || m.days_since_last_attendance >= 30
    },
    {
      id: 'counseling',
      label: 'Members Requiring Counseling',
      test: (m) =>
        m.consecutive_absences >= 4 ||
        String(m.notes || '')
          .toLowerCase()
          .includes('counsel')
    },
    {
      id: 'prayer',
      label: 'Members Requiring Prayer Support',
      test: (m) => m.prayer_request_status !== 'None' || m.risk_level !== 'Low'
    },
    {
      id: 'leaving-risk',
      label: 'Members at Risk of Leaving Church',
      test: (m) => ['High', 'Critical'].includes(m.risk_level)
    },
    {
      id: 'no-history',
      label: 'Members with No Attendance History',
      test: (m) => m.no_attendance_history
    }
  ];
  const categories = categoryDefinitions.map((cat) => ({
    ...cat,
    members: members.filter(cat.test)
  }));
  const activeCategory = categories.find((c) => c.id === memberCategory) || categories[0];
  const byRisk =
    memberRiskFilter === 'all'
      ? activeCategory.members
      : activeCategory.members.filter((m) => m.risk_level === memberRiskFilter);
  const followUpOwner = (member) => member.leader_name || member.head_leader_name || 'Unassigned';
  const sections = [...new Set(members.map((m) => m.section_name).filter(Boolean))].sort();
  // Keep ownership meaningful: an administrator who narrows to a section
  // should only see the leaders responsible for members in that section.
  // "Unassigned" is intentionally included so no critical member falls out
  // of the follow-up workflow because their leader record is incomplete.
  const leaders = [
    ...new Set(
      members
        .filter((m) => !memberSectionFilter || m.section_name === memberSectionFilter)
        .map(followUpOwner)
    )
  ].sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });
  const filteredMembers = byRisk.filter((m) => {
    if (memberSectionFilter && m.section_name !== memberSectionFilter) return false;
    if (memberLeaderFilter && followUpOwner(m) !== memberLeaderFilter) return false;
    if (!memberSearch) return true;
    const haystack = [
      m.full_name,
      m.gender,
      m.age_group,
      m.section_name,
      m.head_leader_name,
      m.leader_name,
      m.risk_level,
      m.follow_up_status
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(memberSearch.toLowerCase());
  });
  const ownershipGroupLabel = (member) =>
    `${member.section_name || 'Unassigned section'} · ${followUpOwner(member)}`;
  const displayedMembers = groupByOwner
    ? [...filteredMembers].sort((a, b) => {
        const groupOrder = ownershipGroupLabel(a).localeCompare(ownershipGroupLabel(b));
        return groupOrder || a.full_name.localeCompare(b.full_name);
      })
    : filteredMembers;
  const countMembersBy = (list, labelFor) =>
    [...list.reduce((counts, member) => {
      const label = labelFor(member);
      counts.set(label, (counts.get(label) || 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([firstLabel], [secondLabel]) =>
      firstLabel.localeCompare(secondLabel)
    );
  const sectionMemberCounts = countMembersBy(
    filteredMembers,
    (member) => member.section_name || 'Unassigned section'
  );
  const leaderMemberCounts = countMembersBy(filteredMembers, followUpOwner);
  const displayedGroupCounts = new Map(
    countMembersBy(displayedMembers, ownershipGroupLabel)
  );

  const followUpQueues = leaders
    .map((leader) => {
      const ownedMembers = members.filter((m) => followUpOwner(m) === leader);
      const urgentMembers = ownedMembers.filter((m) => ['Critical', 'High'].includes(m.risk_level));
      return {
        leader,
        sections: [...new Set(ownedMembers.map((m) => m.section_name).filter(Boolean))],
        total: ownedMembers.length,
        urgent: urgentMembers.length,
        critical: urgentMembers.filter((m) => m.risk_level === 'Critical').length
      };
    })
    .filter((queue) => queue.urgent > 0)
    .sort(
      (a, b) => b.critical - a.critical || b.urgent - a.urgent || a.leader.localeCompare(b.leader)
    );

  const avg = (list) =>
    list.length
      ? Math.round(list.reduce((sum, m) => sum + (Number(m.attendance_rate) || 0), 0) / list.length)
      : 0;
  const activeMembers = members.filter((m) => m.active_status === 'Active');
  const newMembers = categories.find((c) => c.id === 'new')?.members || [];
  const returningMembers = categories.find((c) => c.id === 'returning')?.members || [];
  const visitorConversions = categories.find((c) => c.id === 'visitors')?.members || [];
  const perfectMembers = categories.find((c) => c.id === 'perfect')?.members || [];
  const consistentMembers = categories.find((c) => c.id === 'consistent')?.members || [];
  const atRiskMembers = categories.find((c) => c.id === 'leaving-risk')?.members || [];
  const inactiveMembers = members.filter(
    (m) =>
      m.active_status === 'Inactive' || m.days_since_last_attendance >= 90 || m.attendance_rate < 20
  );
  const immediateFollowUp = members.filter(
    (m) => m.risk_level === 'Critical' || m.consecutive_absences >= 3
  );
  const visitationMembers = categories.find((c) => c.id === 'visitation')?.members || [];
  const counselingMembers = categories.find((c) => c.id === 'counseling')?.members || [];
  const longestStreak = members.reduce(
    (max, m) => Math.max(max, m.longest_attendance_streak || 0),
    0
  );
  const weeklyRetention = activeMembers.length
    ? Math.round(
        (activeMembers.filter((m) => m.weekly_present > 0).length / activeMembers.length) * 100
      )
    : 0;
  const monthlyRetention = activeMembers.length
    ? Math.round(
        (activeMembers.filter((m) => m.monthly_present > 0).length / activeMembers.length) * 100
      )
    : 0;
  const overallHealth = members.length
    ? Math.round(
        members.reduce((sum, m) => sum + m.overall_member_health_score, 0) / members.length
      )
    : 0;
  const memberRecordTotals = {
    present: members.reduce((sum, m) => sum + (Number(m.present_count) || 0), 0),
    absent: members.reduce((sum, m) => sum + (Number(m.absent_count) || 0), 0),
    excused: members.reduce((sum, m) => sum + (Number(m.excused_count) || 0), 0)
  };
  const memberRecordTotal =
    memberRecordTotals.present + memberRecordTotals.absent + memberRecordTotals.excused;
  const retainedMembers = members.filter((m) => m.retention_score >= 60);
  const lostMembers = members.filter((m) => m.risk_level === 'Critical');
  const recoveredMembers = returningMembers;
  const recoveryPct = lostMembers.length
    ? Math.round((recoveredMembers.length / lostMembers.length) * 100)
    : 0;
  const topRiskSection = sectionRankings.length
    ? sectionRankings
        .map((s) => ({
          name: s.name,
          count: atRiskMembers.filter((m) => m.section_name === s.name).length
        }))
        .sort((a, b) => b.count - a.count)[0]
    : null;
  const topRetentionSection = sectionRankings.length
    ? sectionRankings
        .map((s) => ({
          name: s.name,
          rate: avg(members.filter((m) => m.section_name === s.name))
        }))
        .sort((a, b) => b.rate - a.rate)[0]
    : null;

  const kpis = [
    { label: 'Total Active Members', value: activeMembers.length, category: 'all', icon: Users },
    {
      label: 'New Members This Period',
      value: newMembers.length,
      category: 'new',
      icon: UserCheck
    },
    {
      label: 'Returning Members',
      value: returningMembers.length,
      category: 'returning',
      icon: RefreshCw
    },
    {
      label: 'Visitor Conversions',
      value: visitorConversions.length,
      category: 'visitors',
      icon: Star
    },
    {
      label: 'Perfect Attendance',
      value: perfectMembers.length,
      category: 'perfect',
      icon: Award
    },
    {
      label: 'Most Consistent Members',
      value: consistentMembers.length,
      category: 'consistent',
      icon: CheckCircle2
    },
    {
      label: 'Members at Risk',
      value: atRiskMembers.length,
      category: 'leaving-risk',
      icon: AlertTriangle
    },
    {
      label: 'Inactive Members',
      value: inactiveMembers.length,
      category: 'leaving-risk',
      icon: UserX
    },
    {
      label: 'Immediate Follow-up',
      value: immediateFollowUp.length,
      category: 'missing-3',
      icon: Target
    },
    {
      label: 'Require Visitation',
      value: visitationMembers.length,
      category: 'visitation',
      icon: Heart
    },
    {
      label: 'Require Counseling',
      value: counselingMembers.length,
      category: 'counseling',
      icon: Brain
    },
    { label: 'Longest Streak', value: longestStreak, category: 'most-active', icon: Flame },
    {
      label: 'Average Attendance Rate',
      value: `${avg(members)}%`,
      category: 'all',
      icon: Activity
    },
    {
      label: 'Weekly Retention Rate',
      value: `${weeklyRetention}%`,
      category: 'all',
      icon: Calendar
    },
    {
      label: 'Monthly Retention Rate',
      value: `${monthlyRetention}%`,
      category: 'all',
      icon: Shield
    },
    { label: 'Member Health Score', value: `${overallHealth}/100`, category: 'all', icon: Heart }
  ];

  const insights = [
    members.length
      ? `Average member attendance is ${avg(members)}% across ${members.length} tracked member records.`
      : 'No member attendance history is available for this period.',
    returningMembers.length
      ? `${returningMembers.length} members have returned after weak previous attendance.`
      : 'No returning-member recovery pattern detected yet.',
    perfectMembers.length
      ? `${perfectMembers.length} members maintained perfect attendance in the selected period.`
      : 'No perfect-attendance members detected for this period.',
    topRiskSection?.count > 0
      ? `${topRiskSection.name} has the highest number of at-risk members (${topRiskSection.count}).`
      : 'No section currently dominates at-risk member pressure.',
    topRetentionSection
      ? `${topRetentionSection.name} has the strongest member retention profile at ${topRetentionSection.rate}%.`
      : 'Section retention cannot be ranked until member data is available.',
    immediateFollowUp.length
      ? `${immediateFollowUp.length} members require immediate pastoral follow-up or visitation.`
      : 'No immediate critical follow-up queue detected.',
    categories.find((c) => c.id === 'women')?.members.length &&
    categories.find((c) => c.id === 'youth')?.members.length
      ? `Women's attendance averages ${avg(categories.find((c) => c.id === 'women').members)}% while youth attendance averages ${avg(categories.find((c) => c.id === 'youth').members)}%.`
      : 'Gender and age-group attendance comparisons need more member profile data.'
  ];
  const actions = [
    {
      title: 'Visit Members',
      category: 'visitation',
      members: visitationMembers,
      priority: visitationMembers.length ? 'high' : 'low'
    },
    {
      title: 'Make Follow-up Calls',
      category: 'missing-2',
      members: members.filter((m) => m.consecutive_absences >= 2),
      priority: 'high'
    },
    {
      title: 'Assign Prayer Support',
      category: 'prayer',
      members: categories.find((c) => c.id === 'prayer')?.members || [],
      priority: 'medium'
    },
    {
      title: 'Schedule Counseling',
      category: 'counseling',
      members: counselingMembers,
      priority: 'high'
    },
    {
      title: 'Recognize Perfect Attendance Members',
      category: 'perfect',
      members: perfectMembers,
      priority: 'low'
    },
    { title: 'Welcome New Members', category: 'new', members: newMembers, priority: 'medium' },
    {
      title: 'Encourage Returning Members',
      category: 'returning',
      members: returningMembers,
      priority: 'medium'
    },
    {
      title: 'Review At-Risk Members with Section Leaders',
      category: 'leaving-risk',
      members: atRiskMembers,
      priority: 'high'
    },
    {
      title: 'Meet with Sections Showing Declining Engagement',
      category: 'declining',
      members: categories.find((c) => c.id === 'declining')?.members || [],
      priority: 'medium'
    }
  ];
  const openCategory = (id) => setMemberCategory(id);
  const renderPriorityBadge = (p) => (
    <Badge variant={p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'success'}>{p}</Badge>
  );

  // Weekly matrix can span hundreds of members — render progressively so
  // the tab paints fast and reveals more on demand.
  const [matrixLimit, setMatrixLimit] = useState(50);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfExportError, setPdfExportError] = useState('');
  useEffect(() => {
    setMatrixLimit(50);
  }, [memberSearch, memberWeeklyMatrix]);
  const filteredMemberIds = new Set(filteredMembers.map((member) => String(member.id)));
  const matrixRows = (memberWeeklyMatrix || []).filter((member) =>
    filteredMemberIds.has(String(member.member_id))
  );
  const orderedMatrixRows = groupByOwner
    ? [...matrixRows].sort((a, b) => {
        const groupOrder = ownershipGroupLabel(a).localeCompare(ownershipGroupLabel(b));
        return groupOrder || a.full_name.localeCompare(b.full_name);
      })
    : matrixRows;
  const matrixGroupCounts = new Map(countMembersBy(orderedMatrixRows, ownershipGroupLabel));
  const visibleMatrixRows = orderedMatrixRows.slice(0, matrixLimit);
  const priorityCategoryIds = [
    'all',
    'leaving-risk',
    'visitation',
    'missing-3',
    'counseling',
    'new',
    'returning',
    'perfect'
  ];
  const visibleCategories = showAllCategories
    ? categories
    : categories.filter(
        (category) => priorityCategoryIds.includes(category.id) || category.id === memberCategory
      );

  const exportMemberIntelligencePdf = useCallback(async () => {
    if (!filteredMembers.length) return;

    setPdfExporting(true);
    setPdfExportError('');
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      const includeMatrix = memberView === 'matrix' && matrixRows.length > 0;
      // Phone numbers and ownership details make this a working follow-up
      // report, so use landscape orientation to keep every field readable.
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const filters = [
        `Group: ${activeCategory.label}`,
        memberRiskFilter === 'all' ? 'Risk: all levels' : `Risk: ${memberRiskFilter}`,
        memberSectionFilter ? `Section: ${memberSectionFilter}` : null,
        memberLeaderFilter ? `Leader: ${memberLeaderFilter}` : null,
        groupByOwner ? 'Grouped by: section and follow-up leader' : null,
        memberSearch.trim() ? `Search: ${memberSearch.trim()}` : null,
        `Service: ${serviceLabel}`
      ]
        .filter(Boolean)
        .join(' | ');

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 31, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Member Intelligence Drill-down', margin, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Filtered member attendance and pastoral intelligence', margin, 22);
      if (includeMatrix) {
        const legend = [
          { label: 'P Present', color: [34, 197, 94] },
          { label: 'A Absent', color: [239, 68, 68] },
          { label: 'E Excused', color: [245, 158, 11] }
        ];
        let legendX = pageWidth - 116;
        legend.forEach(({ label, color }) => {
          doc.setFillColor(...color);
          doc.roundedRect(legendX, 18, 4, 4, 0.6, 0.6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(label, legendX + 6, 21.5);
          legendX += 36;
        });
      }

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      const filterLines = doc.splitTextToSize(filters, pageWidth - margin * 2);
      doc.text(filterLines, margin, 39);
      const tableStartY = 42 + filterLines.length * 4;

      const tableOptions = includeMatrix
        ? {
            head: [
              [
                'Member',
                'Section',
                'Phone',
                'Follow-up owner',
                ...memberWeeklyMatrixWeeks.map((week) => weekToDate(week))
              ]
            ],
            body: orderedMatrixRows.map((member) => [
              member.full_name,
              member.section_name || '—',
              member.phone || '—',
              followUpOwner(member),
              ...asArray(member.weekly).map((status) =>
                status === 'present'
                  ? 'P'
                  : status === 'absent'
                    ? 'A'
                    : status === 'excused'
                      ? 'E'
                      : '—'
              )
            ]),
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 28 },
              2: { cellWidth: 30 },
              3: { cellWidth: 35 }
            }
          }
        : {
            head: [
              [
                '#',
                'Member',
                'Phone',
                'Section',
                'Follow-up owner',
                'P',
                'A',
                'E',
                'Rate',
                'Streak',
                'Risk'
              ]
            ],
            body: displayedMembers.map((member, index) => [
              index + 1,
              member.full_name,
              member.phone || '—',
              member.section_name || '—',
              member.leader_name || member.head_leader_name || 'Unassigned',
              member.present_count || 0,
              member.absent_count || 0,
              member.excused_count || 0,
              `${member.attendance_rate || 0}%`,
              member.current_attendance_streak || 0,
              member.risk_level || 'Low'
            ])
          };

      autoTable(doc, {
        ...tableOptions,
        startY: tableStartY,
        margin: { left: margin, right: margin, bottom: 16 },
        styles: {
          font: 'helvetica',
          fontSize: includeMatrix ? 6.5 : 8,
          cellPadding: includeMatrix ? 1.5 : 2
        },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (cell) => {
          // Weekly status columns begin after member, section, phone, and
          // follow-up owner. Their colour mirrors the on-screen legend.
          if (!includeMatrix || cell.section !== 'body' || cell.column.index < 4) return;
          const status = String(cell.cell.raw || '');
          if (status === 'P') {
            cell.cell.styles.fillColor = [220, 252, 231];
            cell.cell.styles.textColor = [21, 128, 61];
          } else if (status === 'A') {
            cell.cell.styles.fillColor = [254, 226, 226];
            cell.cell.styles.textColor = [185, 28, 28];
          } else if (status === 'E') {
            cell.cell.styles.fillColor = [254, 243, 199];
            cell.cell.styles.textColor = [180, 83, 9];
          }
        }
      });

      const pages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Shekina Church Management System | Page ${page} of ${pages}`,
          margin,
          pageHeight - 8
        );
      }

      const categorySlug = activeCategory.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      doc.save(`member-intelligence-${categorySlug}.pdf`);
    } catch (error) {
      console.error('Member intelligence PDF export failed:', error);
      setPdfExportError('The PDF could not be created. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  }, [
    activeCategory.id,
    activeCategory.label,
    displayedMembers,
    filteredMembers.length,
    orderedMatrixRows,
    matrixRows.length,
    memberRiskFilter,
    memberSectionFilter,
    memberLeaderFilter,
    memberSearch,
    memberView,
    groupByOwner,
    memberWeeklyMatrixWeeks,
    serviceLabel
  ]);

  useEffect(() => {
    window.addEventListener('member-intelligence-download-pdf', exportMemberIntelligencePdf);
    return () =>
      window.removeEventListener('member-intelligence-download-pdf', exportMemberIntelligencePdf);
  }, [exportMemberIntelligencePdf]);

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950 dark:text-white">
              Member intelligence workspace
            </h3>
            <p className="text-xs text-slate-500">
              Search a member first, then open the supporting operational picture only when needed.
            </p>
          </div>
        </div>
      </div>

      <details className="order-3 rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-bold text-slate-900 marker:hidden dark:text-white">
          <span>Operational overview</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            KPIs, pastoral priorities, insights and action queues
          </span>
        </summary>
        <div className="space-y-6 border-t border-slate-100 p-4 dark:border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpis.map(({ label, value, category, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => openCategory(category)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${memberCategory === category ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20' : 'border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {label}
                  </span>
                  <Icon className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-xl font-black text-slate-950 dark:text-white mt-2">{value}</p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  Member Intelligence Record Window
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Counts below are calculated from member attendance history for the last 180 days -{' '}
                  {serviceLabel}.
                </p>
              </div>
              <Badge variant="info">{memberRecordTotal.toLocaleString()} tracked records</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
                <p className="text-[9px] font-bold uppercase text-slate-400">Historical Present</p>
                <p className="text-xl font-black text-emerald-600">{memberRecordTotals.present}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
                <p className="text-[9px] font-bold uppercase text-slate-400">Historical Absent</p>
                <p className="text-xl font-black text-rose-600">{memberRecordTotals.absent}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
                <p className="text-[9px] font-bold uppercase text-slate-400">Historical Excused</p>
                <p className="text-xl font-black text-amber-600">{memberRecordTotals.excused}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Attendance Behavior Analysis
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Average Attendance</p>
                  <p className="text-lg font-black">{avg(members)}%</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Improving</p>
                  <p className="text-lg font-black text-emerald-600">
                    {categories.find((c) => c.id === 'improving')?.members.length || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Declining</p>
                  <p className="text-lg font-black text-rose-600">
                    {categories.find((c) => c.id === 'declining')?.members.length || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Consistency</p>
                  <p className="text-lg font-black">{consistentMembers.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Member Retention Intelligence
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Retained</p>
                  <p className="text-lg font-black text-emerald-600">{retainedMembers.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Lost/Critical</p>
                  <p className="text-lg font-black text-rose-600">{lostMembers.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Recovered</p>
                  <p className="text-lg font-black text-indigo-600">{recoveredMembers.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Recovery %</p>
                  <p className="text-lg font-black">{recoveryPct}%</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Member Movement Analysis
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">New Registrations</p>
                  <p className="text-lg font-black">{newMembers.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Conversions</p>
                  <p className="text-lg font-black">{visitorConversions.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Returning</p>
                  <p className="text-lg font-black">{returningMembers.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3">
                  <p className="text-slate-400">Removed/Inactive</p>
                  <p className="text-lg font-black">{inactiveMembers.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Pastoral Care Intelligence
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  'missing-1',
                  'missing-2',
                  'missing-3',
                  'missing-1m',
                  'missing-3m',
                  'visitation',
                  'counseling',
                  'prayer'
                ].map((id) => {
                  const cat = categories.find((c) => c.id === id);
                  return (
                    <button
                      key={id}
                      onClick={() => openCategory(id)}
                      className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3 text-left"
                    >
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{cat?.label}</p>
                      <p className="text-lg font-black mt-1">{cat?.members.length || 0}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Executive Insights
              </h3>
              <div className="space-y-2">
                {insights.map((text, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-3 text-xs text-slate-600 dark:text-slate-300"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Action Center</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {actions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => openCategory(action.category)}
                  className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3 text-left hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    {renderPriorityBadge(action.priority)}
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {action.members.length} members
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                    {action.title}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Open drill-down list for affected members.
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div className="order-1 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-900/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Member Intelligence Drill-down
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {activeCategory.label}: {filteredMembers.length} member(s) · Select a row for the
                full attendance history and pastoral profile.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <button
                type="button"
                onClick={exportMemberIntelligencePdf}
                disabled={pdfExporting || filteredMembers.length === 0}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {pdfExporting ? 'Creating PDF…' : 'Download PDF'}
              </button>
              <div className="relative flex-1 lg:w-72 lg:flex-none">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search member, leader, section..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          {pdfExportError && <p className="text-xs font-medium text-rose-600">{pdfExportError}</p>}
          <div className="flex flex-wrap gap-1.5">
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setMemberCategory(cat.id)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${memberCategory === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
              >
                {cat.label} · {cat.members.length}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAllCategories((visible) => !visible)}
              className="rounded-full border border-dashed border-indigo-300 px-2.5 py-1 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
            >
              {showAllCategories
                ? 'Show fewer filters'
                : `More filters (${categories.length - visibleCategories.length})`}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Risk:
            </span>
            {['all', 'Low', 'Medium', 'High', 'Critical'].map((r) => (
              <button
                key={r}
                onClick={() => setMemberRiskFilter(r)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${memberRiskFilter === r ? (r === 'Critical' ? 'bg-rose-600 text-white border-rose-600' : r === 'High' ? 'bg-amber-500 text-white border-amber-500' : r === 'Medium' ? 'bg-blue-600 text-white border-blue-600' : r === 'Low' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-700 text-white border-slate-700') : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <label className="relative">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Section
              </span>
              <Building2 className="pointer-events-none absolute bottom-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <select
                value={memberSectionFilter}
                onChange={(e) => {
                  const nextSection = e.target.value;
                  setMemberSectionFilter(nextSection);
                  if (
                    memberLeaderFilter &&
                    !members.some(
                      (m) =>
                        m.section_name === nextSection && followUpOwner(m) === memberLeaderFilter
                    )
                  ) {
                    setMemberLeaderFilter('');
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">All sections</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Follow-up owner
              </span>
              <UserRound className="pointer-events-none absolute bottom-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <select
                value={memberLeaderFilter}
                onChange={(e) => setMemberLeaderFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">All leaders</option>
                {leaders.map((leader) => (
                  <option key={leader} value={leader}>
                    {leader}
                  </option>
                ))}
              </select>
            </label>
            {(memberSectionFilter || memberLeaderFilter) && (
              <button
                type="button"
                onClick={() => {
                  setMemberSectionFilter('');
                  setMemberLeaderFilter('');
                }}
                className="self-end rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Clear ownership filters
              </button>
            )}
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Attendance overview counts
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Based on the current member category and filters.
                </p>
              </div>
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-black text-white">
                Total: {filteredMembers.length}
              </span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  By section
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sectionMemberCounts.length ? (
                    sectionMemberCounts.map(([section, count]) => (
                      <span
                        key={section}
                        className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-indigo-900/50 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {section}: <strong className="text-indigo-700 dark:text-indigo-300">{count}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">No members</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  By leader
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {leaderMemberCounts.length ? (
                    leaderMemberCounts.map(([leader, count]) => (
                      <span
                        key={leader}
                        className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-indigo-900/50 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {leader}: <strong className="text-indigo-700 dark:text-indigo-300">{count}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">No members</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {followUpQueues.length > 0 && (
          <div className="border-b border-slate-100 bg-rose-50/50 px-4 py-3 dark:border-slate-700 dark:bg-rose-950/10">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Follow-up ownership queue
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {followUpQueues.slice(0, 8).map((queue) => (
                <button
                  key={queue.leader}
                  type="button"
                  onClick={() => {
                    setMemberLeaderFilter(queue.leader);
                    setMemberRiskFilter('all');
                  }}
                  className={`min-w-[175px] rounded-xl border px-3 py-2 text-left transition-colors ${memberLeaderFilter === queue.leader ? 'border-rose-400 bg-white shadow-sm dark:bg-slate-800' : 'border-rose-100 bg-white/70 hover:border-rose-300 dark:border-rose-900/60 dark:bg-slate-800/70'}`}
                >
                  <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    {queue.leader}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {queue.sections.join(' · ') || 'No section assigned'}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold text-rose-600 dark:text-rose-300">
                    {queue.urgent} at risk{queue.critical ? ` · ${queue.critical} critical` : ''} ·{' '}
                    {queue.total} members
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              {memberView === 'summary' ? 'Member P/A/E Summary' : 'Weekly Attendance Matrix'}
            </h4>
            <button
              onClick={() => setMemberView(memberView === 'summary' ? 'matrix' : 'summary')}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              {memberView === 'summary' ? (
                <>
                  <BarChart3 className="w-3 h-3" /> Show Weekly Matrix
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" /> Show Summary
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setGroupByOwner((grouped) => !grouped)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                groupByOwner
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20'
              }`}
              title="Organize members by their section and follow-up leader"
            >
              <Users className="h-3 w-3" />
              {groupByOwner ? 'Grouped by leader' : 'Group by leader'}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {memberView === 'matrix' && (
              <div className="flex flex-col">
                <label className="text-[9px] font-medium text-slate-400 mb-0.5">Weeks</label>
                <select
                  value={memberWeeksCount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setMemberWeeksCount(n);
                    loadMemberWeeklyMatrix(n);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value={4}>4 weeks</option>
                  <option value={8}>8 weeks</option>
                  <option value={12}>12 weeks</option>
                  <option value={16}>16 weeks</option>
                  <option value={24}>24 weeks</option>
                  <option value={52}>52 weeks</option>
                </select>
              </div>
            )}
            {memberView === 'matrix' && (
              <div className="flex items-center gap-2 ml-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Legend:
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="w-3 h-3 rounded bg-emerald-500" />P
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                  <span className="w-3 h-3 rounded bg-rose-500" />A
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                  <span className="w-3 h-3 rounded bg-amber-500" />E
                </span>
              </div>
            )}
          </div>
        </div>
        {memberView === 'summary' ? (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-[1040px] text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-right py-2 px-3 font-semibold text-slate-500 w-12">#</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Member</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Phone</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Section</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">
                    Follow-up owner
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-emerald-600">Present</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-600">Absent</th>
                  <th className="text-right py-2 px-3 font-semibold text-amber-600">Excused</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Rate</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-500">Streak</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Movement</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan="12" className="py-12 text-center text-slate-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      {rawMembers.length === 0
                        ? 'No member intelligence data available. Try changing the date range or service filter.'
                        : 'No members match the current filters.'}
                    </td>
                  </tr>
                )}
                {displayedMembers.map((m, index) => {
                  const streak = Number(m.current_attendance_streak || 0);
                  const absences = Number(m.consecutive_absences || 0);
                  const showGroupHeading =
                    groupByOwner &&
                    (index === 0 ||
                      ownershipGroupLabel(m) !== ownershipGroupLabel(displayedMembers[index - 1]));
                  return (
                    <React.Fragment key={m.id}>
                      {showGroupHeading && (
                        <tr className="border-y border-indigo-100 bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                          <td
                            colSpan="12"
                            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
                          >
                            {ownershipGroupLabel(m)} · {displayedGroupCounts.get(ownershipGroupLabel(m)) || 0}{' '}
                            member(s)
                          </td>
                        </tr>
                      )}
                      <tr
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_41px]"
                        onClick={() => openMemberAttendanceDetails(m)}
                      >
                        <td className="py-2 px-3 text-right">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-slate-500"
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {m.full_name}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {m.phone ? (
                            <a
                              href={`tel:${m.phone}`}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-300 dark:hover:text-indigo-200"
                              title={`Call ${m.full_name}`}
                            >
                              {m.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{m.section_name || '—'}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-700 dark:text-slate-200">
                            {m.leader_name || m.head_leader_name || 'Unassigned'}
                          </div>
                          {m.leader_name &&
                            m.head_leader_name &&
                            m.leader_name !== m.head_leader_name && (
                              <div className="text-[10px] text-slate-400">
                                Section head: {m.head_leader_name}
                              </div>
                            )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          {Number(m.present_count) || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">
                          {Number(m.absent_count) || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-600">
                          {Number(m.excused_count) || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-indigo-600">
                          {m.attendance_rate || 0}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          {streak > 0 ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full"
                              title={`${streak} consecutive present`}
                            >
                              <Flame className="w-3 h-3" />
                              {streak}
                            </span>
                          ) : absences > 0 ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300 px-1.5 py-0.5 rounded-full"
                              title={`${absences} consecutive absences`}
                            >
                              <XCircle className="w-3 h-3" />
                              {absences}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {m.rank_movement > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold text-[10px]">
                              <ArrowUp className="w-3 h-3" />
                              {m.rank_movement}
                            </span>
                          )}
                          {m.rank_movement < 0 && (
                            <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold text-[10px]">
                              <ArrowDown className="w-3 h-3" />
                              {Math.abs(m.rank_movement)}
                            </span>
                          )}
                          {(!m.rank_movement || m.rank_movement === 0) && (
                            <span className="text-slate-300 dark:text-slate-600 text-[10px]">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.risk_level === 'Critical'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                : m.risk_level === 'High'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : m.risk_level === 'Medium'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            }`}
                          >
                            {m.risk_level || 'Low'}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : memberWeeklyMatrix && memberWeeklyMatrix.length > 0 ? (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <div className="min-w-max">
              {/* Header row */}
              <div className="flex bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase text-slate-500 sticky top-0 z-20">
                <div className="sticky left-0 z-10 w-12 shrink-0 bg-slate-50 px-3 py-2 text-right dark:bg-slate-900/40">
                  #
                </div>
                <div className="sticky left-12 z-10 bg-slate-50 dark:bg-slate-900/40 w-40 shrink-0 px-3 py-2">
                  Member
                </div>
                <div className="w-28 shrink-0 px-3 py-2">Phone</div>
                <div className="w-24 shrink-0 px-3 py-2">Section</div>
                <div className="w-36 shrink-0 px-3 py-2">Follow-up owner</div>
                {memberWeeklyMatrixWeeks.map((w) => (
                  <div key={w} className="w-14 shrink-0 px-1 py-2 text-center" title={w}>
                    {weekToDate(w)}
                  </div>
                ))}
              </div>
              {/* Data rows */}
              {visibleMatrixRows.map((m, index) => {
                const showGroupHeading =
                  groupByOwner &&
                  (index === 0 ||
                    ownershipGroupLabel(m) !== ownershipGroupLabel(visibleMatrixRows[index - 1]));
                return (
                  <React.Fragment key={m.member_id}>
                    {showGroupHeading && (
                      <div className="sticky left-0 z-10 border-y border-indigo-100 bg-indigo-50/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {ownershipGroupLabel(m)} · {matrixGroupCounts.get(ownershipGroupLabel(m)) || 0}{' '}
                        member(s)
                      </div>
                    )}
                    <div className="flex border-b border-slate-100 dark:border-slate-700/50 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <div className="sticky left-0 z-10 w-12 shrink-0 bg-white px-3 py-2.5 text-right font-bold text-slate-400 dark:bg-slate-800">
                        {index + 1}
                      </div>
                      <div className="sticky left-12 z-10 bg-white dark:bg-slate-800 w-40 shrink-0 px-3 py-2.5 font-semibold text-slate-900 dark:text-white truncate">
                        {m.full_name}
                      </div>
                      <div className="w-28 shrink-0 px-3 py-2.5 truncate">
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                            title={`Call ${m.full_name}`}
                          >
                            {m.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      <div
                        className="w-24 shrink-0 px-3 py-2.5 text-slate-500 truncate"
                        title={m.section_name || ''}
                      >
                        {m.section_name || '—'}
                      </div>
                      <div
                        className="w-36 shrink-0 px-3 py-2.5 text-slate-600 dark:text-slate-300 truncate"
                        title={followUpOwner(m)}
                      >
                        {followUpOwner(m)}
                      </div>
                      {asArray(m.weekly).map((status, wi) => (
                        <div key={wi} className="w-14 shrink-0 px-1 py-2 text-center">
                          {status === 'present' && (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 text-[10px] font-bold"
                              title="Present"
                            >
                              P
                            </span>
                          )}
                          {status === 'absent' && (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-700 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-200 text-[10px] font-bold"
                              title="Absent"
                            >
                              A
                            </span>
                          )}
                          {status === 'excused' && (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 text-[10px] font-bold"
                              title="Excused"
                            >
                              E
                            </span>
                          )}
                          {!status && <span className="text-slate-300 dark:text-slate-600">·</span>}
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                );
              })}
              {matrixRows.length > matrixLimit && (
                <button
                  type="button"
                  onClick={() => setMatrixLimit((l) => l + 50)}
                  className="m-3 inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Show more ({matrixRows.length - matrixLimit} remaining)
                </button>
              )}
            </div>
          </div>
        ) : memberWeeklyLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Loading member attendance matrix...
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            No weekly attendance data available. Select a different period or service.
          </div>
        )}
      </div>

      {selectedMemberDetails &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 pt-8 backdrop-blur-sm"
            onClick={() => setSelectedMemberDetails(null)}
          >
            <div
              className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    {selectedMemberDetails.member?.full_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedMemberDetails.member?.section_name || 'No section'} ·{' '}
                    {selectedMemberDetails.member?.leader_name || 'No leader'} ·{' '}
                    {selectedMemberDetails.member?.membership_id || 'No membership ID'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberDetails(null)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(90vh-90px)] space-y-4">
                {memberDetailsError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300">
                    {memberDetailsError}
                  </div>
                )}

                {memberDetailsLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Loading member attendance information...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Records</p>
                        <p className="text-xl font-black text-slate-950 dark:text-white">
                          {selectedMemberDetails.stats?.total || 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Present</p>
                        <p className="text-xl font-black text-emerald-600">
                          {selectedMemberDetails.stats?.present || 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Absent</p>
                        <p className="text-xl font-black text-rose-600">
                          {selectedMemberDetails.stats?.absent || 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Excused</p>
                        <p className="text-xl font-black text-amber-600">
                          {selectedMemberDetails.stats?.excused || 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400">Rate</p>
                        <p className="text-xl font-black text-indigo-600">
                          {selectedMemberDetails.stats?.attendance_rate || 0}%
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Attendance Records
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {fdate(selectedMemberDetails.date_range?.start)} to{' '}
                          {fdate(selectedMemberDetails.date_range?.end)} · {serviceLabel}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              {['Date', 'Status', 'Service', 'Submitted By', 'Submitted At'].map(
                                (h) => (
                                  <th
                                    key={h}
                                    className="py-2.5 px-3 text-left text-[10px] font-bold uppercase text-slate-400"
                                  >
                                    {h}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedMemberDetails.records || []).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-10 text-center text-sm text-slate-400"
                                >
                                  No attendance records found for this member in the selected
                                  window.
                                </td>
                              </tr>
                            ) : (
                              selectedMemberDetails.records.map((record) => {
                                return (
                                  <tr
                                    key={record.id}
                                    className="border-b border-slate-50 dark:border-slate-800"
                                  >
                                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                      {fdate(record.date)}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <Badge
                                        variant={
                                          record.status === 'present'
                                            ? 'success'
                                            : record.status === 'excused'
                                              ? 'warning'
                                              : 'danger'
                                        }
                                      >
                                        {record.status}
                                      </Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                      {record.service_name}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500">
                                      {record.submitted_by_name || 'Unknown'}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                      <div className="font-medium text-slate-700 dark:text-slate-200">
                                        {fdatetime(record.submitted_at)}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MembersTab;
