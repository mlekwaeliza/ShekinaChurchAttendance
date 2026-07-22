import jsPDF from 'jspdf';
import 'jspdf-autotable';

// PDF Report Generator for Executive Reporting Center
// Generates printable PDF reports from report data

export class PDFReportGenerator {
  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = 20;
  }

  // Add header to each page
  addHeader(title, subtitle) {
    this.doc.setFillColor(99, 102, 241); // Indigo
    this.doc.rect(0, 0, this.pageWidth, 35, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, 18);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle || `Generated: ${new Date().toLocaleDateString()}`, this.margin, 28);
    
    this.currentY = 45;
  }

  // Add section title
  addSectionTitle(title) {
    this.doc.setTextColor(51, 51, 51);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    
    // Add underline
    this.doc.setDrawColor(99, 102, 241);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
  }

  // Add stat card
  addStatCard(label, value, x, y, width = 40) {
    this.doc.setFillColor(248, 250, 252); // Light gray
    this.doc.roundedRect(x, y, width, 25, 3, 3, 'F');
    
    this.doc.setTextColor(100, 116, 139); // Slate-500
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(label, x + 5, y + 8);
    
    this.doc.setTextColor(30, 41, 59); // Slate-800
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(String(value), x + 5, y + 18);
  }

  // Add table
  addTable(headers, data, startY) {
    if (startY) this.currentY = startY;
    
    this.doc.autoTable({
      head: [headers],
      body: data,
      startY: this.currentY,
      margin: { left: this.margin, right: this.margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
      },
    });
    
    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  // Add footer
  addFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(148, 163, 184); // Slate-400
      this.doc.text(
        `Page ${i} of ${pageCount} | Shekina Church Management System`,
        this.margin,
        this.pageHeight - 10
      );
    }
  }

  // Check if we need a new page
  checkPageBreak(neededHeight = 40) {
    if (this.currentY + neededHeight > this.pageHeight - 30) {
      this.doc.addPage();
      this.currentY = 20;
      return true;
    }
    return false;
  }

  // Generate Attendance Report PDF
  generateAttendanceReport(data) {
    this.addHeader('Attendance Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Attendees', data.overall?.total_attendees || 0, this.margin, statsY);
    this.addStatCard('Present', data.overall?.present_count || 0, this.margin + 45, statsY);
    this.addStatCard('Absent', data.overall?.absent_count || 0, this.margin + 90, statsY);
    this.addStatCard('Attendance Rate', `${data.overall?.attendance_rate || 0}%`, this.margin + 135, statsY);
    this.currentY = statsY + 35;

    // Section breakdown
    if (data.bySection?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Attendance by Section');
      const headers = ['Section', 'Attendees', 'Present', 'Rate'];
      const tableData = data.bySection.map(s => [
        s.section_name,
        s.total_attendees,
        s.present_count,
        `${s.attendance_rate}%`
      ]);
      this.addTable(headers, tableData);
    }

    // Top performers
    if (data.topPerformers?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Top Performers (Top 10)');
      const headers = ['#', 'Name', 'Section', 'Rate'];
      const tableData = data.topPerformers.slice(0, 10).map((p, i) => [
        i + 1,
        p.name,
        p.section_name,
        `${p.rate}%`
      ]);
      this.addTable(headers, tableData);
    }

    // Risk members
    if (data.riskMembers?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('At-Risk Members (Below 30% Attendance)');
      const headers = ['Name', 'Section', 'Rate'];
      const tableData = data.riskMembers.map(m => [
        m.name,
        m.section_name,
        `${m.rate}%`
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Membership Report PDF
  generateMembershipReport(data) {
    this.addHeader('Membership Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Members', data.overview?.total_members || 0, this.margin, statsY);
    this.addStatCard('Active', data.overview?.active_members || 0, this.margin + 45, statsY);
    this.addStatCard('New Joins', data.overview?.new_joins || 0, this.margin + 90, statsY);
    this.addStatCard('Inactive', data.overview?.inactive_members || 0, this.margin + 135, statsY);
    this.currentY = statsY + 35;

    // Section breakdown
    if (data.bySection?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Members by Section');
      const headers = ['Section', 'Total', 'Active', 'New Joins'];
      const tableData = data.bySection.map(s => [
        s.section_name,
        s.total,
        s.active,
        s.new_joins
      ]);
      this.addTable(headers, tableData);
    }

    // Gender distribution
    if (data.byGender?.length > 0) {
      this.checkPageBreak(40);
      this.addSectionTitle('Gender Distribution');
      const headers = ['Gender', 'Count'];
      const tableData = data.byGender.map(g => [g.gender, g.count]);
      this.addTable(headers, tableData);
    }

    // Age groups
    if (data.byAgeGroup?.length > 0) {
      this.checkPageBreak(40);
      this.addSectionTitle('Age Distribution');
      const headers = ['Age Group', 'Count'];
      const tableData = data.byAgeGroup.map(a => [a.age_group, a.count]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Finance Report PDF
  generateFinanceReport(data) {
    this.addHeader('Finance Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Contributions', `₦${(data.overview?.total_contributions || 0).toLocaleString()}`, this.margin, statsY, 55);
    this.addStatCard('Contributors', data.overview?.unique_contributors || 0, this.margin + 60, statsY, 45);
    this.addStatCard('Avg/Day', `₦${(data.overview?.avg_per_day || 0).toLocaleString()}`, this.margin + 110, statsY, 45);
    this.currentY = statsY + 35;

    // By type
    if (data.byType?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Contributions by Type');
      const headers = ['Type', 'Total', 'Count'];
      const tableData = data.byType.map(t => [
        t.type_name,
        `₦${t.total.toLocaleString()}`,
        t.count
      ]);
      this.addTable(headers, tableData);
    }

    // Top contributors
    if (data.topContributors?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Top Contributors');
      const headers = ['#', 'Name', 'Total', 'Count'];
      const tableData = data.topContributors.slice(0, 10).map((c, i) => [
        i + 1,
        c.name,
        `₦${c.total_contributed.toLocaleString()}`,
        c.contribution_count
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Leadership Report PDF
  generateLeadershipReport(data) {
    this.addHeader('Leadership Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Leaders', data.overview?.total_leaders || 0, this.margin, statsY);
    this.addStatCard('Head Leaders', data.overview?.head_leaders || 0, this.margin + 45, statsY);
    this.addStatCard('Active Leaders', data.overview?.active_leaders || 0, this.margin + 90, statsY);
    this.currentY = statsY + 35;

    // Rankings
    if (data.rankings?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Leader Rankings');
      const headers = ['#', 'Name', 'Section', 'Submissions'];
      const tableData = data.rankings.slice(0, 15).map((l, i) => [
        i + 1,
        l.name,
        l.section_name,
        l.submissions
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Evangelism Report PDF
  generateEvangelismReport(data) {
    this.addHeader('Evangelism Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Souls Won', data.overview?.total_souls_won || 0, this.margin, statsY);
    this.addStatCard('Follow-ups Done', data.overview?.follow_ups_completed || 0, this.margin + 45, statsY);
    this.addStatCard('Follow-ups Pending', data.overview?.follow_ups_pending || 0, this.margin + 90, statsY);
    this.addStatCard('Baptisms', data.baptisms?.completed || 0, this.margin + 135, statsY);
    this.currentY = statsY + 35;

    // Monthly breakdown
    if (data.byMonth?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Souls Won by Month');
      const headers = ['Month', 'Souls Won'];
      const tableData = data.byMonth.map(m => [m.month, m.souls_won]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate New Members Report PDF
  generateNewMembersReport(data) {
    this.addHeader('New Members Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total New Members', data.overview?.total_new_members || 0, this.margin, statsY);
    this.addStatCard('Active', data.overview?.active || 0, this.margin + 50, statsY);
    this.addStatCard('Conversion Rate', `${(data.conversionRates?.conversion_rate || 0).toFixed(1)}%`, this.margin + 100, statsY);
    this.currentY = statsY + 35;

    // By stage
    if (data.byStage?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('By Pipeline Stage');
      const headers = ['Stage', 'Count'];
      const tableData = data.byStage.map(s => [s.stage, s.count]);
      this.addTable(headers, tableData);
    }

    // Recent members
    if (data.recentMembers?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Recent New Members');
      const headers = ['Name', 'Stage', 'Join Date'];
      const tableData = data.recentMembers.map(m => [
        m.name,
        m.stage,
        new Date(m.join_date).toLocaleDateString()
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Children Report PDF
  generateChildrenReport(data) {
    this.addHeader('Children Ministry Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Children', data.overview?.total_children || 0, this.margin, statsY);
    this.addStatCard('Active Classes', data.overview?.total_classes || 0, this.margin + 50, statsY);
    this.addStatCard('Active Teachers', data.overview?.total_teachers || 0, this.margin + 100, statsY);
    this.currentY = statsY + 35;

    // By class
    if (data.byClass?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Enrollment by Class');
      const headers = ['Class', 'Age Group', 'Enrolled', 'Capacity'];
      const tableData = data.byClass.map(c => [
        c.class_name,
        c.age_group || 'N/A',
        c.enrolled,
        c.max_capacity || 'N/A'
      ]);
      this.addTable(headers, tableData);
    }

    // Medical alerts
    if (data.medicalAlerts?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Medical Alerts');
      const headers = ['Name', 'Allergies', 'Medical Notes'];
      const tableData = data.medicalAlerts.map(c => [
        c.full_name,
        c.allergies || 'None',
        c.medical_notes || 'None'
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Generate Home Cells Report PDF
  generateHomeCellsReport(data) {
    this.addHeader('Home Cells Report', `Period: ${data.period.start} to ${data.period.end}`);

    // Stats
    this.addSectionTitle('Summary');
    const statsY = this.currentY;
    this.addStatCard('Total Cells', data.overview?.total_cells || 0, this.margin, statsY);
    this.addStatCard('Total Members', data.overview?.total_members || 0, this.margin + 50, statsY);
    this.addStatCard('Total Leaders', data.overview?.total_leaders || 0, this.margin + 100, statsY);
    this.currentY = statsY + 35;

    // By cell
    if (data.byCell?.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Home Cells');
      const headers = ['Cell Name', 'Cell #', 'Members', 'Leaders'];
      const tableData = data.byCell.map(c => [
        c.cell_name,
        c.cell_number,
        c.member_count,
        c.leaders || 'N/A'
      ]);
      this.addTable(headers, tableData);
    }

    this.addFooter();
    return this.doc;
  }

  // Save PDF
  save(filename) {
    this.doc.save(filename);
  }
}

export default PDFReportGenerator;
