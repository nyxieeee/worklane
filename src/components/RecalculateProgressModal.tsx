import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Board } from '../types';
import type { TaskWithScheduleForSCurve } from './RoadmapSCurve';
import { analyzeReportNarrative } from './DailyReportAnalyzerModal';
import { recordedFraction, summarizeProgress } from '../reports/projectProgress';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';

interface Props {
  board: Board;
  entries: { task: TaskWithScheduleForSCurve; value: number }[];
  budget: number;
  onClose: () => void;
}

export default function RecalculateProgressModal({ board, entries, budget, onClose }: Props) {
  const updateCard = useWorkStore(s => s.updateCard);
  const showToast = useToastStore(s => s.showToast);
  const [rows, setRows] = useState(() => entries.map(({ task }) => {
    const card = board.columns.flatMap(c => c.cards).find(c => c.id === task.card.id);
    const audit = [...(card?.comments || [])].reverse().find(c => c.text.includes('[Daily Field Report Evaluation -'));
    const current = recordedFraction(task) * 100;
    const auditPct = audit?.text.match(/Evaluation - (\d+(?:\.\d+)?)%/);
    const snippet = audit?.text.match(/%\]:\n"([\s\S]*)"\n\(Reason:/)?.[1];
    // Only propose replacing an old report value when it still matches the saved value.
    const reportValue = auditPct && Number(auditPct[1]) === current;
    const match = snippet && reportValue ? analyzeReportNarrative(snippet, [task]).matches[0] : undefined;
    const measurable = match && match.confidence === 'high';
    const proposed = reportValue ? (measurable ? match.suggestedProgress : 0) : current;
    return { id: task.card.id, title: task.card.title, current, proposed, selected: false,
      reason: reportValue ? (measurable ? match.matchedReason : 'Old report estimate is unverified. Proposed 0% excludes it until measured.')
        : 'Retain saved progress; edit if you have verified quantities.' };
  }));
  const updateRow = (id: string, patch: Partial<typeof rows[number]>) => setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  const changed = rows.filter(r => r.selected && r.proposed !== r.current);
  const previewEntries = entries.map(entry => {
    const row = changed.find(r => r.id === entry.task.card.id);
    return row ? { ...entry, task: { ...entry.task, card: { ...entry.task.card, progress: row.proposed, completed: row.proposed === 100 } } } : entry;
  });
  const now = new Date();
  const before = summarizeProgress(entries, now, budget).actualPct;
  const after = summarizeProgress(previewEntries, now, budget).actualPct;
  const apply = () => {
    for (const row of changed) {
      updateCard(row.id, { progress: row.proposed, completed: row.proposed === 100,
        completedAt: row.proposed === 100 ? new Date().toISOString() : null,
        ...(row.proposed < 100 ? { actualEndDate: null } : {}) });
    }
    showToast(`Recalculated progress: ${changed.length} item(s) updated`, 'success');
    onClose();
  };
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="modal large-modal" role="dialog" aria-modal="true" aria-labelledby="recalculate-title" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="recalculate-title">Recalculate Progress</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">
          <p>Review all project items. Select the corrections to apply. Drilling only earns progress on drilling tasks. A quantity needs its total scope to calculate a percentage.</p>
          <strong>Overall accomplishment: {before.toFixed(1)}% → {after.toFixed(1)}%</strong>
          <p>Unverified report estimates propose 0% for review; this means no verified credit, not proof that no work happened. Saved values remain until you select and apply a correction.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th>Apply</th><th>Item</th><th>Current</th><th>Proposed %</th><th>Review</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id}>
                <td style={{ padding: 8 }}><input type="checkbox" aria-label={`Apply correction for ${row.title}`} checked={row.selected} onChange={e => updateRow(row.id, { selected: e.target.checked })} /></td>
                <td style={{ padding: 8 }}>{row.title}</td>
                <td style={{ padding: 8 }}>{row.current}%</td>
                <td style={{ padding: 8 }}><input type="number" min={0} max={100} step="any" aria-label={`Proposed progress for ${row.title}`} value={row.proposed} style={{ width: 80 }} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) updateRow(row.id, { proposed: Math.max(0, Math.min(100, value)), selected: true }); }} /></td>
                <td style={{ padding: 8 }}>{row.reason}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {rows.length === 0 && <p>No scheduled project items to recalculate.</p>}
        </div>
        <div className="modal-header">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={changed.length === 0} onClick={apply}>Apply {changed.length} correction(s)</button>
        </div>
      </div>
    </div>, document.body
  );
}
