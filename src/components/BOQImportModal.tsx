import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Board } from '../types';
import { boqHeaders, findBOQColumns, parseBOQRows, parseCSV } from '../imports/boq';
import type { BOQRow } from '../imports/boq';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { tableToCSV } from '../imports/boqPDF';

export default function BOQImportModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const importBOQ = useWorkStore(s => s.importBOQ);
  const toast = useToastStore(s => s.showToast);
  const [sheets, setSheets] = useState<{ sheet: string; data: unknown[][] }[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [columns, setColumns] = useState<number[]>(Array(6).fill(-1));
  const [rows, setRows] = useState<(BOQRow & { targetCardId: string })[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pdfText, setPDFText] = useState<string | null>(null);
  const [readingStatus, setReadingStatus] = useState('Reading BOQ…');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const reader = useRef<AbortController | null>(null);
  useEffect(() => () => reader.current?.abort(), []);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  const data = sheets[sheetIndex]?.data || [];
  const tasks = board.columns.flatMap(c => c.cards.map(card => ({ card, location: c.name })));
  const money = (value: number) => `${board.currency || '₱'} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const chooseData = (data: unknown[][]) => {
    let best = 0, score = -1;
    data.slice(0, 40).forEach((row, i) => { const count = findBOQColumns(row).filter(n => n >= 0).length; if (count > score) { best = i; score = count; } });
    setHeaderIndex(best); setColumns(findBOQColumns(data[best] || [])); setRows([]); setError('');
  };
  const load = async (file: File) => {
    reader.current?.abort();
    const controller = new AbortController();
    reader.current = controller;
    setBusy(true); setError(''); setSheets([]); setRows([]); setPDFText(null); setImagePreview(null); setReadingStatus('Reading BOQ…');
    try {
      let result: typeof sheets;
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readExcel } = await import('read-excel-file/browser');
        result = await readExcel(file);
      } else if (/\.csv$/i.test(file.name)) result = [{ sheet: file.name, data: parseCSV(await file.text()) }];
      else if (/\.pdf$/i.test(file.name)) {
        const { readBOQPDF } = await import('../imports/boqPDF');
        const data = await readBOQPDF(file);
        result = [{ sheet: 'PDF table', data }];
        setPDFText(tableToCSV(data));
      } else if (/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
        setImagePreview(URL.createObjectURL(file));
        const { readBOQImage } = await import('../imports/boqImage');
        const data = await readBOQImage(file, setReadingStatus, controller.signal);
        result = [{ sheet: 'Picture table', data }];
        setPDFText(tableToCSV(data));
      } else throw new Error('Choose Excel, PDF, CSV, or a JPG, PNG, WebP or BMP picture.');
      if (controller.signal.aborted) return;
      if (!result.length || !result.some(s => s.data.length)) throw new Error('The workbook has no readable rows.');
      const index = result.findIndex(s => s.data.length > 0);
      setSheets(result); setSheetIndex(index); setFileName(file.name); chooseData(result[index].data);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not read this BOQ.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const review = () => {
    try {
      const parsed = parseBOQRows(data, headerIndex, columns);
      setRows(parsed.map(row => {
        const exact = tasks.filter(({ card, location }) =>
          (row.reference && card.boq?.reference === row.reference || card.title.toLowerCase().trim() === row.description.toLowerCase().trim()) &&
          (!row.location || location.toLowerCase().trim() === row.location.toLowerCase().trim()));
        return { ...row, targetCardId: exact.length === 1 ? exact[0].card.id : '' };
      })); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the selected columns.'); }
  };
  const included = rows.filter(row => row.targetCardId);
  const targets = included.filter(row => row.targetCardId !== '__new__').map(row => row.targetCardId);
  const duplicate = new Set(targets).size !== targets.length;
  const total = included.reduce((sum, row) => sum + row.quantity * row.unitRate, 0);
  return createPortal(<div className="modal-overlay" style={{ zIndex: 1400 }} onClick={onClose}>
    <div className="modal large-modal" role="dialog" aria-modal="true" aria-labelledby="boq-title" onClick={e => e.stopPropagation()}>
      <div className="modal-header"><h2 id="boq-title">Upload Final BOQ</h2><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></div>
      <div className="modal-body">
        <p>Define the project’s agreed quantities and values. Check the extracted columns, then link each item to a task.</p>
        <label className="field-label">Excel, PDF, CSV or a BOQ picture
          <input type="file" accept=".xlsx,.pdf,.csv,.jpg,.jpeg,.png,.webp,.bmp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void load(file); e.target.value = ''; }} />
        </label>
        <p style={{ fontSize: 12 }}>Pictures: JPG, PNG, WebP or BMP. Use a clear, upright photo showing the entire table.</p>
        {busy && <p role="status">{readingStatus}</p>}
        {imagePreview && <img src={imagePreview} alt="Uploaded BOQ for comparison with extracted quantities" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', alignSelf: 'flex-start' }} />}
        {pdfText !== null && <div>
          <p>Check {imagePreview ? 'picture OCR' : 'PDF extraction'} carefully, especially quantities, decimal points, rates and wrapped descriptions. Correct any reading errors before importing.{!imagePreview && ' Scanned PDFs require OCR first.'}</p>
          <details><summary>Review or correct extracted table</summary>
            <p>Each line is a table row. Keep commas between columns and quotes around text containing commas.</p>
            <textarea className="text-input" aria-label="Extracted BOQ table as CSV" rows={10} value={pdfText} onChange={e => { setPDFText(e.target.value); setRows([]); setSheets([]); }} />
            <button type="button" className="btn btn-secondary" onClick={() => {
              try { const data = parseCSV(pdfText); setSheets([{ sheet: imagePreview ? 'Picture table' : 'PDF table', data }]); setSheetIndex(0); chooseData(data); }
              catch (err) { setError(err instanceof Error ? err.message : 'Check the table formatting.'); }
            }}>Use Corrected Table</button>
          </details>
        </div>}
        {sheets.length > 0 && <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label>Worksheet <select className="text-input" value={sheetIndex} onChange={e => { const i = Number(e.target.value); setSheetIndex(i); chooseData(sheets[i].data); }}>{sheets.map((s, i) => <option key={i} value={i}>{s.sheet}</option>)}</select></label>
            <label>Header row <input className="text-input" type="number" min={1} max={data.length} value={headerIndex + 1} onChange={e => { const i = Math.max(0, Math.min(data.length - 1, Number(e.target.value) - 1)); setHeaderIndex(i); setColumns(findBOQColumns(data[i] || [])); setRows([]); }} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {boqHeaders.map((label, i) => <label key={label}>{label}{i === 0 || i === 2 ? ' (optional)' : ''}
              <select className="text-input" value={columns[i]} onChange={e => { setColumns(prev => prev.map((n, j) => j === i ? Number(e.target.value) : n)); setRows([]); }}>
                <option value={-1}>Choose column</option>{(data[headerIndex] || []).map((value, j) => <option key={j} value={j}>{j + 1}: {String(value ?? '')}</option>)}
              </select>
            </label>)}
          </div>
          <button type="button" className="btn btn-secondary" onClick={review}>Preview BOQ Items</button>
        </>}
        {rows.length > 0 && <>
          <p><strong>{included.length} of {rows.length} items selected · BOQ value: {money(total)}</strong></p>
          <p>Link existing tasks to avoid counting the same scope twice. New items start at 0%. Existing progress and the project’s date range are retained. Item values become the progress weights; other tasks remain in the project with their saved costs.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setRows(prev => prev.map(row => row.targetCardId ? row : { ...row, targetCardId: '__new__' }))}>Create items for unmatched rows</button>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Ref / Location', 'Description', 'Quantity', 'Unit rate', 'Amount', 'Link to task'].map(title => <th key={title} style={{ textAlign: 'left', padding: 8 }}>{title}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>
              <td style={{ padding: 8 }}>{row.reference}<br />{row.location}</td><td style={{ padding: 8 }}>{row.description}</td><td style={{ padding: 8 }}>{row.quantity.toLocaleString()} {row.unit}</td><td style={{ padding: 8 }}>{money(row.unitRate)}</td><td style={{ padding: 8 }}>{money(row.quantity * row.unitRate)}</td>
              <td style={{ padding: 8 }}><select className="text-input" aria-label={`Task for BOQ row ${i + 1}`} value={row.targetCardId} onChange={e => setRows(prev => prev.map((r, j) => i === j ? { ...r, targetCardId: e.target.value } : r))}>
                <option value="">Skip / choose task</option><option value="__new__">Create new BOQ item</option>{tasks.map(({ card, location }) => <option key={card.id} value={card.id}>{location} · {card.title}</option>)}
              </select></td>
            </tr>)}</tbody>
          </table></div>
          {duplicate && <p role="alert">Each task can link to one BOQ row. Split the task or consolidate the source rows first.</p>}
        </>}
        {error && <p role="alert" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      <div className="modal-header"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy || !included.length || duplicate} onClick={() => {
          if (!importBOQ(board.id, included, fileName)) { setError('The project changed. Check task links and try again.'); return; }
          toast(`Imported ${included.length} BOQ items`, 'success'); onClose();
        }}>Import {included.length} BOQ Items</button>
      </div>
    </div>
  </div>, document.body);
}
