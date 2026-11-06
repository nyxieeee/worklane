import { jsPDF } from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';

interface ReportTask {
  code: string; title: string; value: number; progress: number; status: string;
  start: string; end: string; actualStart: string; actualEnd: string;
  pauses: string;
}
export interface SituationerReport {
  project: string; description: string; date: string; currency: string; preparedBy: string;
  period: string; budget: number; planned: number; actual: number; notes: string;
  phases: { code: string; name: string; budget: number; progress: number; tasks: ReportTask[] }[];
  curve: { date: Date; plannedPct: number; actualPct: number | null; projectedPct: number | null }[];
}

/** Build a paginated document from report data, independent of the app viewport. */
export async function downloadSituationerPdf(report: SituationerReport) {
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const currency = report.currency === '₱' ? 'PHP' : report.currency === '€' ? 'EUR' : report.currency === '¥' ? 'JPY' : report.currency;
  const money = (value: number) => `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const text = (value: string | string[], x: number, y: number, size = 10) => {
    pdf.setFontSize(size); pdf.setTextColor(35, 45, 60); pdf.text(value, x, y);
  };
  const section = (name: string, subtitle: string) => {
    text(name, margin, 28, 19);
    text(subtitle, margin, 36, 9);
  };
  const table = (head: string[], body: (string | number)[][], startY = 44, options: UserOptions = {}) => autoTable(pdf, {
    head: [head], body, startY, margin: { top: 44, bottom: 18, left: margin, right: margin },
    theme: 'striped', styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: [35, 45, 60] },
    headStyles: { fillColor: [30, 64, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] }, rowPageBreak: 'avoid',
    ...options,
  });

  section('Project Situationer Report', report.project);
  const description = pdf.splitTextToSize(report.description, width - margin * 2);
  text(description, margin, 46, 10);
  const summaryY = 52 + description.length * 4;
  table(['Report date', 'Contract value', 'Planned to date', 'Overall accomplished', 'Variance'], [[
    report.date, money(report.budget), `${report.planned.toFixed(1)}%`, `${report.actual.toFixed(1)}%`,
    `${(report.actual - report.planned).toFixed(1)} percentage points`,
  ]], summaryY);
  const chartY = summaryY + 38;
  text('Cumulative Project Progress', margin, chartY - 6, 12);
  const x0 = margin + 12, y0 = chartY, chartW = width - margin * 2 - 16;
  const chartH = Math.max(35, height - chartY - 36);
  for (let percent = 0; percent <= 100; percent += 25) {
    const y = y0 + chartH * (1 - percent / 100);
    pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(0.2); pdf.line(x0, y, x0 + chartW, y);
    text(`${percent}%`, margin, y + 1, 8);
  }
  const curve = report.curve;
  if (curve.length > 1) {
    const min = curve[0].date.getTime(), span = Math.max(1, curve[curve.length - 1].date.getTime() - min);
    const series = (key: 'plannedPct' | 'actualPct' | 'projectedPct', color: [number, number, number]) => {
      pdf.setDrawColor(...color); pdf.setLineWidth(0.65);
      pdf.setLineDashPattern(key === 'projectedPct' ? [2, 1.2] : [], 0);
      for (let i = 1; i < curve.length; i++) {
        const previous = curve[i - 1][key], current = curve[i][key];
        if (previous == null || current == null) continue;
        pdf.line(x0 + (curve[i - 1].date.getTime() - min) / span * chartW, y0 + chartH * (1 - previous / 100),
          x0 + (curve[i].date.getTime() - min) / span * chartW, y0 + chartH * (1 - current / 100));
      }
    };
    series('plannedPct', [5, 150, 105]); series('actualPct', [217, 119, 6]); series('projectedPct', [65, 105, 190]);
    pdf.setLineDashPattern([], 0);
    // Mark the selected reporting date and the actual/forecast junction.
    const reportTime = new Date(`${report.date}T00:00:00`).getTime();
    const anchor = curve.find(point => point.date.getTime() === reportTime);
    if (anchor) {
      const x = x0 + (reportTime - min) / span * chartW;
      pdf.setDrawColor(120, 130, 145); pdf.setLineWidth(0.25); pdf.setLineDashPattern([1, 1], 0);
      pdf.line(x, y0, x, y0 + chartH); pdf.setLineDashPattern([], 0);
      text(`As of ${report.date}`, Math.min(x + 2, x0 + chartW - 36), y0 - 2, 8);
      pdf.setFillColor(217, 119, 6);
      pdf.circle(x, y0 + chartH * (1 - report.actual / 100), 1, 'F');
    }
    text(curve[0].date.toLocaleDateString(), x0, y0 + chartH + 5, 8);
    pdf.text(curve[curve.length - 1].date.toLocaleDateString(), x0 + chartW, y0 + chartH + 5, { align: 'right' });
  }
  text('Green: planned   |   Amber: accomplished   |   Blue: forecast', x0, y0 + chartH + 12, 8);

  pdf.addPage();
  const valuesSubtitle = `${report.project}  |  As of ${report.date}  |  All amounts in ${currency}`;
  section('Schedule of Values', valuesSubtitle);
  const amount = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const code = (value: string) => value.replace(/^Item\s*/i, '').replace(/\.$/, '');
  const buildingRows = new Set<number>();
  const valueRows: (string | number)[][] = [];
  report.phases.forEach(phase => {
    buildingRows.add(valueRows.length);
    valueRows.push([code(phase.code), phase.name, amount(phase.budget),
      `${(report.budget > 0 ? phase.budget / report.budget * 100 : 0).toFixed(2)}%`, `${phase.progress.toFixed(1)}%`,
      amount(phase.tasks.reduce((sum, t) => sum + t.value * t.progress / 100, 0)), 'Subtotal']);
    phase.tasks.forEach(t => valueRows.push([code(t.code), t.title, amount(t.value),
      `${(report.budget > 0 ? t.value / report.budget * 100 : 0).toFixed(2)}%`, `${t.progress.toFixed(1)}%`,
      amount(t.value * t.progress / 100), t.status]));
  });
  const allocated = report.phases.reduce((sum, phase) => sum + phase.budget, 0);
  const earned = report.phases.reduce((sum, phase) => sum + phase.tasks.reduce((sub, task) => sub + task.value * task.progress / 100, 0), 0);
  table(['WBS', 'Building / deliverable', `Contract (${currency})`, 'Weight', 'Progress', `Earned (${currency})`, 'Status'], valueRows, 44, {
    tableWidth: width - margin * 2,
    styles: { fontSize: 8, cellPadding: { top: 2.7, bottom: 2.7, left: 3, right: 3 },
      textColor: [35, 45, 60], valign: 'middle', overflow: 'linebreak', minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: width - margin * 2 - 165 },
      2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 38, halign: 'right' }, 6: { cellWidth: 28 },
    },
    foot: [['', 'Allocated total', amount(allocated), `${(report.budget > 0 ? allocated / report.budget * 100 : 0).toFixed(2)}%`,
      `${(allocated > 0 ? earned / allocated * 100 : 0).toFixed(1)}%`, amount(earned), '']],
    showFoot: 'lastPage', footStyles: { fillColor: [30, 64, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    didParseCell: data => {
      if (data.column.index >= 2 && data.column.index <= 5) data.cell.styles.halign = 'right';
      if (data.section === 'body' && buildingRows.has(data.row.index)) {
        data.cell.styles.fillColor = [226, 235, 246];
        data.cell.styles.textColor = [25, 55, 95];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.minCellHeight = 10;
      } else if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.cellPadding = { top: 2.7, bottom: 2.7, left: 6, right: 3 };
      }
    },
    didDrawPage: data => {
      if (data.pageNumber > 1) section('Schedule of Values', `${valuesSubtitle}  |  Continued`);
    },
  });

  pdf.addPage(); section('Work Schedule & Pauses', 'Preparation and installation retain separate schedules; work may proceed across buildings.');
  table(['WBS', 'Building / deliverable', 'Scheduled start', 'Scheduled end', 'Actual start', 'Actual end', 'Work pauses'], report.phases.flatMap(phase => phase.tasks.map(t => [
    t.code, `${phase.name} / ${t.title}`, t.start, t.end, t.actualStart, t.actualEnd, t.pauses,
  ])));

  pdf.addPage(); section('Observations & Sign-off', report.period);
  table(['Field', 'Details'], [['Executive observations', report.notes || 'No observations recorded.'], ['Prepared by', report.preparedBy], ['Report date', report.date]]);

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setDrawColor(215, 220, 228); pdf.line(margin, 13, width - margin, 13);
    text('WORKLANE  /  PROJECT SITUATIONER', margin, 10, 8);
    text(report.project, margin, height - 9, 8);
    pdf.text(`${i} / ${pages}`, width - margin, height - 9, { align: 'right' });
  }
  const filename = `${report.project.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'Project'}-Situationer-${report.date}.pdf`;
  await pdf.save(filename, { returnPromise: true });
}
