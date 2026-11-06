import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const table = (head: string[], body: (string | number)[][], startY = 44) => autoTable(pdf, {
    head: [head], body, startY, margin: { top: 44, bottom: 18, left: margin, right: margin },
    theme: 'striped', styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: [35, 45, 60] },
    headStyles: { fillColor: [30, 64, 110], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 246, 250] }, rowPageBreak: 'avoid',
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
      for (let i = 1; i < curve.length; i++) {
        const previous = curve[i - 1][key], current = curve[i][key];
        if (previous == null || current == null) continue;
        pdf.line(x0 + (curve[i - 1].date.getTime() - min) / span * chartW, y0 + chartH * (1 - previous / 100),
          x0 + (curve[i].date.getTime() - min) / span * chartW, y0 + chartH * (1 - current / 100));
      }
    };
    series('plannedPct', [5, 150, 105]); series('actualPct', [217, 119, 6]); series('projectedPct', [65, 105, 190]);
    text(curve[0].date.toLocaleDateString(), x0, y0 + chartH + 5, 8);
    pdf.text(curve[curve.length - 1].date.toLocaleDateString(), x0 + chartW, y0 + chartH + 5, { align: 'right' });
  }
  text('Green: planned   |   Amber: accomplished   |   Blue: forecast', x0, y0 + chartH + 12, 8);

  pdf.addPage(); section('Schedule of Values', 'Building totals and individual deliverables. Amounts and accomplishment use the selected report data.');
  table(['WBS', 'Building / deliverable', 'Contract value', 'Weight', 'Accomplished', 'Earned value', 'Status'], report.phases.flatMap(phase => [
    [phase.code, phase.name, money(phase.budget), `${(report.budget > 0 ? phase.budget / report.budget * 100 : 0).toFixed(2)}%`, `${phase.progress.toFixed(1)}%`, money(phase.tasks.reduce((sum, t) => sum + t.value * t.progress / 100, 0)), 'Building total'],
    ...phase.tasks.map(t => [t.code, t.title, money(t.value), `${(report.budget > 0 ? t.value / report.budget * 100 : 0).toFixed(2)}%`, `${t.progress.toFixed(1)}%`, money(t.value * t.progress / 100), t.status]),
  ]));

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
