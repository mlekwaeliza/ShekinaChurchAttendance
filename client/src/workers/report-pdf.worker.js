// report-pdf.worker.js
//
// Web Worker that builds attendance/leader report PDFs off the main
// thread. The main thread posts a payload describing the report, and
// the worker returns the raw PDF bytes as a Uint8Array plus a
// suggested filename. The main thread turns that into a Blob and
// triggers a download.
//
// Two report shapes are supported (selected by `payload.report`):
//   - 'attendance' : admin Reports page (summary + leader breakdown)
//   - 'pastor'     : pastor dashboard multi-section narrative report
//
// Adding a new report shape means adding a new branch to build() below.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function safeFilename(s) {
  return String(s || '').replace(/[^a-z0-9-]/gi, '_').toLowerCase();
}

function buildAttendanceReport(p) {
  const { overviewData, leaders, serviceLabel, periodLabel, filterValue } = p;
  const stats = overviewData.stats || {};
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const generatedAt = new Date();

  // Header bar
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Church Attendance Report', margin, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${generatedAt.toLocaleString()}`, margin, 62);
  doc.text(`${serviceLabel} | ${periodLabel}`, margin, 78);

  // Summary table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, 126);

  autoTable(doc, {
    startY: 142,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 8 },
    head: [['Metric', 'Value']],
    body: [
      ['Service', serviceLabel],
      ['Period', periodLabel],
      ['Submitted leaders', stats.total_submitted_leaders ?? 0],
      ['Present', stats.present ?? 0],
      ['Absent', stats.absent ?? 0],
      ['Excused', stats.excused ?? 0],
      ['Total records', (stats.present ?? 0) + (stats.absent ?? 0) + (stats.excused ?? 0)],
    ],
  });

  // Leader breakdown table
  const leaderRows = (leaders || []).map((leader) => {
    const present = leader.stats?.present ?? 0;
    const absent = leader.stats?.absent ?? 0;
    const excused = leader.stats?.excused ?? 0;
    return [
      leader.leader_name || 'Unassigned',
      leader.section_name || '',
      leader.submissions_count ?? 0,
      present, absent, excused,
      present + absent + excused,
    ];
  });

  const tableY = (doc.lastAutoTable?.finalY || 260) + 28;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Leader Breakdown', margin, tableY);

  autoTable(doc, {
    startY: tableY + 16,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 110 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    head: [['Leader', 'Section', 'Logs', 'Present', 'Absent', 'Excused', 'Total']],
    body: leaderRows.length > 0 ? leaderRows : [['No leader rows found', '', '', '', '', '', '']],
    didDrawPage: () => {
      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${pageNumber}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 22, { align: 'right' });
    },
  });

  const filename = `attendance-report-${safeFilename(serviceLabel)}-${safeFilename(filterValue)}.pdf`;
  return { doc, filename };
}

function buildPastorReport(p) {
  const {
    form, reportSummary, summaryMetrics, sectionBreakdown,
    prioritizedMembers, generatedOn, formatDisplayDate, formatLocalDate,
    sanitizeFilename, numberOrZero
  } = p;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  let cursorY = 56;

  const ensureSpace = (heightNeeded = 80) => {
    if (cursorY + heightNeeded <= pageHeight - 42) return;
    doc.addPage();
    cursorY = 56;
  };

  const addHeading = (label) => {
    ensureSpace(48);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(label, margin, cursorY);
    cursorY += 14;
  };

  const addParagraph = (text) => {
    ensureSpace(40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 13 + 8;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(form.title, margin, cursorY);
  cursorY += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Window: ${reportSummary.windowLabel}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Generated: ${generatedOn}`, margin, cursorY);
  cursorY += 14;

  if (form.preparedBy && form.preparedBy.trim()) {
    doc.text(`Prepared by: ${form.preparedBy.trim()}`, margin, cursorY);
    cursorY += 14;
  }
  cursorY += 10;

  autoTable(doc, {
    startY: cursorY,
    theme: 'grid',
    head: [['Metric', 'Value']],
    body: [
      ['Latest attendance day', summaryMetrics.latestDateLabel],
      ['Average attendance', `${summaryMetrics.averageAttendance}%`],
      ['Submission rate', `${summaryMetrics.submissionRate}% (${summaryMetrics.leadersSubmitted}/${summaryMetrics.totalLeaders})`],
      ['Tracked sections', String(summaryMetrics.trackedSections)],
      ['Members needing attention', String(prioritizedMembers.length)],
      ['Trend delta', `${reportSummary.trendDelta > 0 ? '+' : ''}${reportSummary.trendDelta}%`],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [37, 99, 235] },
  });
  cursorY = doc.lastAutoTable.finalY + 26;

  if (form.includeActionItems) {
    addHeading('Priority Actions');
    reportSummary.actionItems.forEach((item) => addParagraph(`- ${item}`));
  }

  if (form.includeSectionBreakdown && sectionBreakdown.length > 0) {
    addHeading('Section Breakdown');
    autoTable(doc, {
      startY: cursorY,
      theme: 'striped',
      head: [['Section', 'Attendance Rate', 'Present', 'Total']],
      body: sectionBreakdown.map((section) => [
        section.section_name,
        `${numberOrZero(section.attendance_rate)}%`,
        String(numberOrZero(section.present)),
        String(numberOrZero(section.total)),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    cursorY = doc.lastAutoTable.finalY + 26;
  }

  if (form.includeLeaderPerformance && reportSummary.topLeaders.length > 0) {
    addHeading('Leader Performance');
    autoTable(doc, {
      startY: cursorY,
      theme: 'striped',
      head: [['Leader', 'Section', 'Attendance Rate', 'Reporting Days', 'Records']],
      body: reportSummary.topLeaders.map((leader) => [
        leader.leader_name,
        leader.section_name,
        `${numberOrZero(leader.attendance_rate)}%`,
        String(numberOrZero(leader.reporting_days)),
        String(numberOrZero(leader.total_records)),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 7 },
      headStyles: { fillColor: [13, 148, 136] },
    });
    cursorY = doc.lastAutoTable.finalY + 26;
  }

  if (form.includeAtRiskMembers && reportSummary.atRiskMembers.length > 0) {
    addHeading('Members Requiring Follow-Up');
    autoTable(doc, {
      startY: cursorY,
      theme: 'striped',
      head: [['Member', 'Section', 'Leader', 'Absences']],
      body: reportSummary.atRiskMembers.map((member) => [
        member.full_name,
        member.section_name,
        member.leader_name,
        String(numberOrZero(member.absence_count)),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 7 },
      headStyles: { fillColor: [225, 29, 72] },
    });
  }

  const filename = `${sanitizeFilename(form.title)}-${formatLocalDate()}.pdf`;
  return { doc, filename };
}

function build(payload) {
  switch (payload.report) {
    case 'attendance': return buildAttendanceReport(payload);
    case 'pastor':     return buildPastorReport(payload);
    default: throw new Error(`Unknown report type: ${payload.report}`);
  }
}

self.addEventListener('message', async (event) => {
  const { id, payload } = event.data || {};
  try {
    const { doc, filename } = build(payload);
    // jsPDF.output('arraybuffer') gives us a transferable ArrayBuffer
    // we can post back to the main thread without copying.
    const ab = doc.output('arraybuffer');
    const bytes = new Uint8Array(ab);
    self.postMessage(
      { id, ok: true, pdf: bytes, filename },
      [bytes.buffer]
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message || String(err) });
  }
});
