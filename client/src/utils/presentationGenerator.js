import pptxgen from 'pptxgenjs';

const COLORS = {
  primary: '4F46E5',
  primaryLight: '818CF8',
  primaryDark: '3730A3',
  white: 'FFFFFF',
  black: '1E293B',
  slate50: 'F8FAFC',
  slate100: 'F1F5F9',
  slate200: 'E2E8F0',
  slate400: '94A3B8',
  slate500: '64748B',
  slate700: '334155',
  emerald: '10B981',
  emeraldLight: 'D1FAE5',
  rose: 'F43F5E',
  roseLight: 'FFE4E6',
  amber: 'F59E0B',
  amberLight: 'FEF3C7',
  sky: '0EA5E9',
  skyLight: 'E0F2FE',
  violet: '8B5CF6',
  violetLight: 'EDE9FE',
  indigo: '6366F1',
  indigoLight: 'E0E7FF',
  cyan: '06B6D4',
  cyanLight: 'CFFAFE',
  purple: 'A855F7',
  purpleLight: 'F3E8FF',
  orange: 'F97316',
  orangeLight: 'FFF7ED',
};

const CHART_COLORS = [COLORS.indigo, COLORS.emerald, COLORS.sky, COLORS.amber, COLORS.rose, COLORS.violet, COLORS.cyan, COLORS.orange];

export class PresentationGenerator {
  constructor() {
    this.pptx = new pptxgen();
    this.pptx.layout = 'LAYOUT_WIDE';
    this.pptx.author = 'Shekina Church Management System';
    this.pptx.subject = 'Church Report';
  }

  setTitle(title) {
    this.pptx.title = title;
  }

  addTitleSlide(title, subtitle, dateRange) {
    const slide = this.pptx.addSlide();
    slide.background = { color: COLORS.primary };

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: COLORS.primary },
    });

    slide.addShape(this.pptx.ShapeType.ellipse, {
      x: 8.5, y: -1, w: 6, h: 6,
      fill: { color: COLORS.primaryLight, transparency: 70 },
    });
    slide.addShape(this.pptx.ShapeType.ellipse, {
      x: -2, y: 4, w: 5, h: 5,
      fill: { color: COLORS.primaryLight, transparency: 80 },
    });

    slide.addText(title, {
      x: 0.8, y: 1.5, w: 11, h: 1.2,
      fontSize: 36, fontFace: 'Arial', color: COLORS.white,
      bold: true, align: 'left',
    });

    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.8, y: 2.7, w: 11, h: 0.6,
        fontSize: 18, fontFace: 'Arial', color: COLORS.white,
        transparency: 20, align: 'left',
      });
    }

    if (dateRange) {
      slide.addText(dateRange, {
        x: 0.8, y: 3.5, w: 11, h: 0.5,
        fontSize: 14, fontFace: 'Arial', color: COLORS.white,
        transparency: 30, align: 'left',
      });
    }

    slide.addText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 0.8, y: 6.5, w: 11, h: 0.4,
      fontSize: 11, fontFace: 'Arial', color: COLORS.white,
      transparency: 40, align: 'left',
    });

    slide.addText('Shekina Church Management System', {
      x: 0.8, y: 6.9, w: 11, h: 0.4,
      fontSize: 10, fontFace: 'Arial', color: COLORS.white,
      transparency: 50, align: 'left',
    });
  }

  addSectionDivider(title, icon) {
    const slide = this.pptx.addSlide();
    slide.background = { color: COLORS.slate50 };

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.15, h: '100%',
      fill: { color: COLORS.primary },
    });

    slide.addText(title, {
      x: 1, y: 2.5, w: 10, h: 1.2,
      fontSize: 32, fontFace: 'Arial', color: COLORS.primary,
      bold: true, align: 'left',
    });

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 1, y: 3.8, w: 2, h: 0.06,
      fill: { color: COLORS.primary },
    });
  }

  addSummarySlide(title, stats, dateRange) {
    const slide = this.pptx.addSlide();
    slide.background = { color: COLORS.white };

    slide.addText(title, {
      x: 0.5, y: 0.3, w: 12, h: 0.6,
      fontSize: 24, fontFace: 'Arial', color: COLORS.primary,
      bold: true,
    });

    if (dateRange) {
      slide.addText(dateRange, {
        x: 0.5, y: 0.85, w: 12, h: 0.35,
        fontSize: 11, fontFace: 'Arial', color: COLORS.slate500,
      });
    }

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 0.5, y: 1.25, w: 12, h: 0.02,
      fill: { color: COLORS.slate200 },
    });

    const cardWidth = Math.min(2.8, (12 - 0.5 * (stats.length - 1)) / stats.length);
    const startX = 0.5;

    stats.forEach((stat, i) => {
      const x = startX + i * (cardWidth + 0.5);
      const color = CHART_COLORS[i % CHART_COLORS.length];

      slide.addShape(this.pptx.ShapeType.roundRect, {
        x, y: 1.6, w: cardWidth, h: 1.8,
        fill: { color: COLORS.slate50 },
        line: { color: COLORS.slate200, width: 1 },
        rectRadius: 0.1,
      });

      slide.addText(stat.label, {
        x: x + 0.2, y: 1.8, w: cardWidth - 0.4, h: 0.4,
        fontSize: 10, fontFace: 'Arial', color: COLORS.slate500,
        bold: true,
      });

      slide.addText(String(stat.value), {
        x: x + 0.2, y: 2.2, w: cardWidth - 0.4, h: 0.8,
        fontSize: 28, fontFace: 'Arial', color,
        bold: true,
      });

      if (stat.subtitle) {
        slide.addText(stat.subtitle, {
          x: x + 0.2, y: 3.0, w: cardWidth - 0.4, h: 0.3,
          fontSize: 9, fontFace: 'Arial', color: COLORS.slate400,
        });
      }
    });
  }

  addTableSlide(title, headers, rows, dateRange) {
    const slide = this.pptx.addSlide();
    slide.background = { color: COLORS.white };

    slide.addText(title, {
      x: 0.5, y: 0.3, w: 12, h: 0.6,
      fontSize: 24, fontFace: 'Arial', color: COLORS.primary,
      bold: true,
    });

    if (dateRange) {
      slide.addText(dateRange, {
        x: 0.5, y: 0.85, w: 12, h: 0.35,
        fontSize: 11, fontFace: 'Arial', color: COLORS.slate500,
      });
    }

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 0.5, y: 1.25, w: 12, h: 0.02,
      fill: { color: COLORS.slate200 },
    });

    if (!rows || rows.length === 0) {
      slide.addText('No data available', {
        x: 0.5, y: 2.5, w: 12, h: 1,
        fontSize: 14, fontFace: 'Arial', color: COLORS.slate400,
        align: 'center',
      });
      return;
    }

    const colWidth = (12 - 0.5) / headers.length;
    const tableRows = [
      headers.map(h => ({ text: h, options: { bold: true, color: COLORS.white, fontSize: 10, fontFace: 'Arial' } })),
      ...rows.map(row => row.map(cell => ({
        text: String(cell ?? '—'),
        options: { fontSize: 9, fontFace: 'Arial', color: COLORS.black },
      }))),
    ];

    slide.addTable(tableRows, {
      x: 0.5, y: 1.4, w: 12,
      colW: headers.map(() => colWidth),
      border: { type: 'solid', pt: 0.5, color: COLORS.slate200 },
      rowH: 0.35,
      autoPage: true,
      autoPageRepeatHeader: true,
      autoPageLineWeight: 0,
      fill: { color: COLORS.white },
      headerRow: true,
    });

    const headerRow = tableRows[0];
    headerRow.forEach(cell => {
      cell.options.fill = { color: COLORS.primary };
    });
  }

  addBarChartSlide(title, chartData, dateRange) {
    const slide = this.pptx.addSlide();
    slide.background = { color: COLORS.white };

    slide.addText(title, {
      x: 0.5, y: 0.3, w: 12, h: 0.6,
      fontSize: 24, fontFace: 'Arial', color: COLORS.primary,
      bold: true,
    });

    if (dateRange) {
      slide.addText(dateRange, {
        x: 0.5, y: 0.85, w: 12, h: 0.35,
        fontSize: 11, fontFace: 'Arial', color: COLORS.slate500,
      });
    }

    slide.addShape(this.pptx.ShapeType.rect, {
      x: 0.5, y: 1.25, w: 12, h: 0.02,
      fill: { color: COLORS.slate200 },
    });

    if (!chartData || chartData.length === 0) {
      slide.addText('No data available', {
        x: 0.5, y: 2.5, w: 12, h: 1,
        fontSize: 14, fontFace: 'Arial', color: COLORS.slate400,
        align: 'center',
      });
      return;
    }

    const labels = chartData.map(d => d.label);
    const values = chartData.map(d => d.value);

    slide.addChart(this.pptx.ChartType.bar, [{
      name: 'Value',
      labels,
      values,
    }], {
      x: 0.5, y: 1.4, w: 12, h: 5.2,
      showTitle: false,
      showValue: true,
      valueFontSize: 9,
      catAxisLabelFontSize: 9,
      valAxisHidden: true,
      catGridLine: { style: 'none' },
      valGridLine: { style: 'none' },
      chartColors: [COLORS.indigo],
      barDir: 'bar',
      barGapWidthPct: 80,
    });
  }

  generateAttendanceReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Attendance Report', 'Church attendance analysis and trends', dateRange);

    const overall = data.overall || {};
    this.addSummarySlide('Attendance Summary', [
      { label: 'Total Attendees', value: overall.total_attendees || 0, subtitle: 'Unique members' },
      { label: 'Present', value: overall.present_count || 0, subtitle: 'Attended services' },
      { label: 'Absent', value: overall.absent_count || 0, subtitle: 'Requires follow-up' },
      { label: 'Attendance Rate', value: `${overall.attendance_rate || 0}%`, subtitle: 'Overall rate' },
    ], dateRange);

    if (data.bySection?.length > 0) {
      this.addTableSlide('Attendance by Section',
        ['Section', 'Attendees', 'Present', 'Rate'],
        data.bySection.map(s => [s.section_name, s.total_attendees, s.present_count, `${s.attendance_rate}%`]),
        dateRange
      );
    }

    if (data.bySection?.length > 0) {
      this.addBarChartSlide('Section Attendance', data.bySection.map(s => ({
        label: s.section_name, value: s.total_attendees,
      })), dateRange);
    }

    if (data.topPerformers?.length > 0) {
      this.addTableSlide('Top Performers (Top 10)',
        ['#', 'Name', 'Section', 'Rate'],
        data.topPerformers.slice(0, 10).map((p, i) => [i + 1, p.name, p.section_name, `${p.rate}%`]),
        dateRange
      );
    }

    if (data.riskMembers?.length > 0) {
      this.addTableSlide('At-Risk Members (Below 30% Attendance)',
        ['Name', 'Section', 'Rate'],
        data.riskMembers.map(m => [m.name, m.section_name, `${m.rate}%`]),
        dateRange
      );
    }
  }

  generateMembershipReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Membership Report', 'Church membership overview and demographics', dateRange);

    const overview = data.overview || {};
    this.addSummarySlide('Membership Summary', [
      { label: 'Total Members', value: overview.total_members || 0, subtitle: 'All registered' },
      { label: 'Active', value: overview.active_members || 0, subtitle: 'Currently active' },
      { label: 'New Joins', value: overview.new_joins || 0, subtitle: 'This period' },
      { label: 'Inactive', value: overview.inactive_members || 0, subtitle: 'Need re-engagement' },
    ], dateRange);

    if (data.bySection?.length > 0) {
      this.addTableSlide('Members by Section',
        ['Section', 'Total', 'Active', 'New Joins'],
        data.bySection.map(s => [s.section_name, s.total, s.active, s.new_joins]),
        dateRange
      );
    }

    if (data.byGender?.length > 0) {
      this.addBarChartSlide('Gender Distribution', data.byGender.map(g => ({
        label: g.gender, value: g.count,
      })), dateRange);
    }

    if (data.byAgeGroup?.length > 0) {
      this.addBarChartSlide('Age Distribution', data.byAgeGroup.map(a => ({
        label: a.age_group, value: a.count,
      })), dateRange);
    }
  }

  generateFinanceReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Finance Report', 'Financial overview and contributions', dateRange);

    const overview = data.overview || {};
    this.addSummarySlide('Finance Summary', [
      { label: 'Total Contributions', value: `₦${(overview.total_contributions || 0).toLocaleString()}`, subtitle: 'All types' },
      { label: 'Contributors', value: overview.unique_contributors || 0, subtitle: 'Unique givers' },
      { label: 'Avg/Day', value: `₦${(overview.avg_per_day || 0).toLocaleString()}`, subtitle: 'Daily average' },
    ], dateRange);

    if (data.byType?.length > 0) {
      this.addTableSlide('Contributions by Type',
        ['Type', 'Total', 'Count'],
        data.byType.map(t => [t.type_name, `₦${t.total.toLocaleString()}`, t.count]),
        dateRange
      );
    }

    if (data.byType?.length > 0) {
      this.addBarChartSlide('Contributions by Type', data.byType.map(t => ({
        label: t.type_name, value: t.total,
      })), dateRange);
    }

    if (data.topContributors?.length > 0) {
      this.addTableSlide('Top Contributors',
        ['#', 'Name', 'Total', 'Count'],
        data.topContributors.slice(0, 10).map((c, i) => [
          i + 1, c.name, `₦${c.total_contributed.toLocaleString()}`, c.contribution_count,
        ]),
        dateRange
      );
    }
  }

  generateLeadershipReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Leadership Report', 'Leadership overview and performance', dateRange);

    const overview = data.overview || {};
    this.addSummarySlide('Leadership Summary', [
      { label: 'Total Leaders', value: overview.total_leaders || 0, subtitle: 'All leaders' },
      { label: 'Head Leaders', value: overview.head_leaders || 0, subtitle: 'Section heads' },
      { label: 'Active Leaders', value: overview.active_leaders || 0, subtitle: 'Currently active' },
    ], dateRange);

    if (data.rankings?.length > 0) {
      this.addTableSlide('Leader Rankings',
        ['#', 'Name', 'Section', 'Submissions'],
        data.rankings.slice(0, 15).map((l, i) => [i + 1, l.name, l.section_name, l.submissions]),
        dateRange
      );
    }
  }

  generateEvangelismReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Evangelism Report', 'Evangelism outreach and follow-ups', dateRange);

    const overview = data.overview || {};
    const baptisms = data.baptisms || {};
    this.addSummarySlide('Evangelism Summary', [
      { label: 'Souls Won', value: overview.total_souls_won || 0, subtitle: 'New converts' },
      { label: 'Follow-ups Done', value: overview.follow_ups_completed || 0, subtitle: 'Completed' },
      { label: 'Follow-ups Pending', value: overview.follow_ups_pending || 0, subtitle: 'Awaiting' },
      { label: 'Baptisms', value: baptisms.completed || 0, subtitle: 'Completed' },
    ], dateRange);

    if (data.byMonth?.length > 0) {
      this.addBarChartSlide('Souls Won by Month', data.byMonth.map(m => ({
        label: m.month, value: m.souls_won,
      })), dateRange);
    }
  }

  generateNewMembersReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('New Members Report', 'New member pipeline and onboarding', dateRange);

    const overview = data.overview || {};
    const rates = data.conversionRates || {};
    this.addSummarySlide('New Members Summary', [
      { label: 'Total New', value: overview.total_new_members || 0, subtitle: 'This period' },
      { label: 'Active', value: overview.active || 0, subtitle: 'Currently active' },
      { label: 'Conversion Rate', value: `${(rates.conversion_rate || 0).toFixed(1)}%`, subtitle: 'Visitor to member' },
    ], dateRange);

    if (data.byStage?.length > 0) {
      this.addBarChartSlide('Pipeline Stages', data.byStage.map(s => ({
        label: s.stage, value: s.count,
      })), dateRange);
    }

    if (data.recentMembers?.length > 0) {
      this.addTableSlide('Recent New Members',
        ['Name', 'Stage', 'Join Date'],
        data.recentMembers.map(m => [m.name, m.stage, new Date(m.join_date).toLocaleDateString()]),
        dateRange
      );
    }
  }

  generateChildrenReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Children Ministry Report', 'Children ministry overview and enrollment', dateRange);

    const overview = data.overview || {};
    this.addSummarySlide('Children Ministry Summary', [
      { label: 'Total Children', value: overview.total_children || 0, subtitle: 'All enrolled' },
      { label: 'Active Classes', value: overview.total_classes || 0, subtitle: 'Running classes' },
      { label: 'Active Teachers', value: overview.total_teachers || 0, subtitle: 'Background checked' },
    ], dateRange);

    if (data.byClass?.length > 0) {
      this.addTableSlide('Enrollment by Class',
        ['Class', 'Age Group', 'Enrolled', 'Capacity'],
        data.byClass.map(c => [c.class_name, c.age_group || 'N/A', c.enrolled, c.max_capacity || 'N/A']),
        dateRange
      );
    }

    if (data.medicalAlerts?.length > 0) {
      this.addTableSlide('Medical Alerts',
        ['Name', 'Allergies', 'Medical Notes'],
        data.medicalAlerts.map(c => [c.full_name, c.allergies || 'None', c.medical_notes || 'None']),
        dateRange
      );
    }
  }

  generateHomeCellsReport(data) {
    const period = data.period || {};
    const dateRange = period.start && period.end ? `${period.start} to ${period.end}` : '';
    this.addTitleSlide('Home Cells Report', 'Home cell groups and membership', dateRange);

    const overview = data.overview || {};
    this.addSummarySlide('Home Cells Summary', [
      { label: 'Total Cells', value: overview.total_cells || 0, subtitle: 'Active cells' },
      { label: 'Total Members', value: overview.total_members || 0, subtitle: 'Across all cells' },
      { label: 'Total Leaders', value: overview.total_leaders || 0, subtitle: 'Cell leaders' },
    ], dateRange);

    if (data.byCell?.length > 0) {
      this.addTableSlide('Home Cells',
        ['Cell Name', 'Cell #', 'Members', 'Leaders'],
        data.byCell.map(c => [c.cell_name, c.cell_number, c.member_count, c.leaders || 'N/A']),
        dateRange
      );
    }
  }

  generateFullPresentation(allData) {
    const dateRange = allData.attendance?.data?.period
      ? `${allData.attendance.data.period.start} to ${allData.attendance.data.period.end}`
      : `${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`;

    this.addTitleSlide('Executive Report', 'Comprehensive church management overview', dateRange);

    const overviewStats = [];
    if (allData.attendance?.data?.overall) {
      const o = allData.attendance.data.overall;
      overviewStats.push({ label: 'Attendance Rate', value: `${o.attendance_rate || 0}%`, subtitle: `${o.total_attendees || 0} total` });
    }
    if (allData.membership?.data?.overview) {
      const m = allData.membership.data.overview;
      overviewStats.push({ label: 'Total Members', value: m.total_members || 0, subtitle: `${m.active_members || 0} active` });
    }
    if (allData.finance?.data?.overview) {
      const f = allData.finance.data.overview;
      overviewStats.push({ label: 'Total Contributions', value: `₦${(f.total_contributions || 0).toLocaleString()}`, subtitle: `${f.unique_contributors || 0} contributors` });
    }
    if (allData.leadership?.data?.overview) {
      const l = allData.leadership.data.overview;
      overviewStats.push({ label: 'Total Leaders', value: l.total_leaders || 0, subtitle: `${l.active_leaders || 0} active` });
    }
    if (overviewStats.length > 0) {
      this.addSummarySlide('Executive Overview', overviewStats.slice(0, 4), dateRange);
    }

    const sections = [
      { key: 'attendance', label: 'Attendance', generator: 'generateAttendanceReport' },
      { key: 'membership', label: 'Membership', generator: 'generateMembershipReport' },
      { key: 'finance', label: 'Finance', generator: 'generateFinanceReport' },
      { key: 'leadership', label: 'Leadership', generator: 'generateLeadershipReport' },
      { key: 'evangelism', label: 'Evangelism', generator: 'generateEvangelismReport' },
      { key: 'newMembers', label: 'New Members', generator: 'generateNewMembersReport' },
      { key: 'homeCells', label: 'Home Cells', generator: 'generateHomeCellsReport' },
      { key: 'children', label: 'Children', generator: 'generateChildrenReport' },
    ];

    sections.forEach(({ key, label, generator }) => {
      const sectionData = allData[key]?.data;
      if (sectionData) {
        this.addSectionDivider(label);
        this[generator](sectionData);
      }
    });
  }

  generateDashboardSummary(metrics, sections, leaders) {
    this.addTitleSlide('Church Dashboard', 'Church overview and key metrics', new Date().toLocaleDateString());

    const stats = [];
    if (metrics) {
      const ts = metrics.todayStats || {};
      stats.push({ label: 'Present Today', value: ts.present || 0, subtitle: 'Active attendance' });
      stats.push({ label: 'Absent Today', value: ts.absent || 0, subtitle: 'Requires follow-up' });
      const total = (ts.present || 0) + (ts.absent || 0) + (ts.excused || 0);
      const rate = total > 0 ? Math.round(((ts.present || 0) / total) * 100) : 0;
      stats.push({ label: 'Attendance Rate', value: `${rate}%`, subtitle: `${total} total` });
    }
    if (metrics?.totalMembers !== undefined) {
      stats.push({ label: 'Total Members', value: metrics.totalMembers, subtitle: 'All registered' });
    }
    if (stats.length > 0) {
      this.addSummarySlide('Key Statistics', stats.slice(0, 4), new Date().toLocaleDateString());
    }

    if (sections && sections.length > 0) {
      this.addTableSlide('Sections',
        ['Section', 'Members'],
        sections.map(s => [s.name, String(s.member_count || 0)]),
        new Date().toLocaleDateString()
      );
    }

    if (leaders && leaders.length > 0) {
      this.addTableSlide('Leadership Directory',
        ['Name', 'Section', 'Role'],
        leaders.slice(0, 20).map(l => [
          l.full_name || l.leader_name || 'N/A',
          l.section_name || 'N/A',
          l.is_head ? 'Head' : 'Leader',
        ]),
        new Date().toLocaleDateString()
      );
    }

    if (metrics?.needsAttention?.length > 0) {
      this.addTableSlide('Needs Attention',
        ['Name', 'Section', 'Status', 'Last Seen'],
        metrics.needsAttention.map(m => [
          m.full_name || m.name || 'N/A',
          m.section_name || 'N/A',
          m.status || 'absent',
          m.last_attendance || 'N/A',
        ]),
        new Date().toLocaleDateString()
      );
    }
  }

  save(filename) {
    this.pptx.writeFile({ fileName: filename });
  }
}

export default PresentationGenerator;
