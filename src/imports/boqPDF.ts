import pdfWorkerURL from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { findBOQColumns } from './boq';

export interface PDFCell { text: string; x: number; y: number; width: number; height: number }

/** Reconstruct rows from PDF coordinates; reading order alone loses table columns. */
export function pdfTableRows(pages: PDFCell[][]): string[][] {
  const lines = pages.map(cells => {
    const rows: PDFCell[][] = [];
    for (const cell of [...cells].filter(c => c.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find(row => Math.abs(row[0].y - cell.y) <= Math.max(2, Math.min(row[0].height, cell.height) * 0.35));
      if (row) row.push(cell); else rows.push([cell]);
    }
    return rows.map(row => row.sort((a, b) => a.x - b.x));
  });
  // Merge split words in column headings, e.g. "Unit" and "Rate".
  const merge = (row: PDFCell[]) => {
    const cells: PDFCell[] = [];
    for (const cell of row) {
      const prev = cells[cells.length - 1];
      if (prev && cell.x - (prev.x + prev.width) < Math.max(6, cell.height * 0.7)) {
        prev.text += ` ${cell.text}`; prev.width = cell.x + cell.width - prev.x;
      } else cells.push({ ...cell });
    }
    return cells;
  };
  let header: PDFCell[] | undefined;
  for (const row of lines.flat()) {
    const merged = merge(row);
    const columns = findBOQColumns(merged.map(c => c.text));
    if ([1, 3, 4, 5].every(i => columns[i] >= 0)) { header = merged; break; }
  }
  if (!header) {
    // Keep all text available for manual column correction instead of inventing quantities.
    return lines.flatMap(page => page.map(row => merge(row).map(c => c.text)));
  }
  const result: string[][] = [header.map(c => c.text)];
  const descriptionIndex = findBOQColumns(result[0])[1];
  for (const page of lines) {
    let started = false;
    const hasHeader = page.some(r => findBOQColumns(merge(r).map(c => c.text)).filter(i => i >= 0).length >= 4);
    for (const row of page) {
      const merged = merge(row);
      if (findBOQColumns(merged.map(c => c.text)).filter(i => i >= 0).length >= 4) { started = true; continue; }
      if (!started && hasHeader) continue;
      const values = header.map(() => '');
      for (const cell of row) {
        let index = 0, distance = Infinity;
        header.forEach((h, i) => {
          const d = Math.abs(cell.x + cell.width / 2 - (h.x + h.width / 2));
          if (d < distance) { distance = d; index = i; }
        });
        // Long description text should stay in its column regardless of its visual center.
        const desc = header[descriptionIndex], next = header[descriptionIndex + 1];
        if (desc && cell.x >= desc.x - 5 && (!next || cell.x < next.x - 15)) index = descriptionIndex;
        values[index] = [values[index], cell.text].filter(Boolean).join(' ');
      }
      result.push(values);
    }
  }
  return result;
}

export async function readBOQPDF(file: File): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerURL;
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pages: PDFCell[][] = [];
  try {
    const document = await loadingTask.promise;
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.flatMap(item => 'str' in item ? [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }] : []));
      page.cleanup();
    }
    if (!pages.some(page => page.some(cell => cell.text.trim()))) throw new Error('This PDF contains no selectable text. Scanned BOQs need OCR first, or upload the Excel version.');
    return pdfTableRows(pages);
  } finally { await loadingTask.destroy(); }
}

export const tableToCSV = (rows: unknown[][]) => rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
