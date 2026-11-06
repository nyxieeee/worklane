import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, WandSparkles } from 'lucide-react';
import type { Board } from '../types';
import { dateKey, scheduledDays } from '../scheduling/calendarSchedule';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';

export default function ScheduleReallocationModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const [scope, setScope] = useState('all');
  const [start, setStart] = useState(dateKey(board.startDate));
  const [end, setEnd] = useState(dateKey(board.endDate));
  const [error, setError] = useState('');
  const reallocate = useWorkStore(state => state.reallocateSchedule);
  const toast = useToastStore(state => state.showToast);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); return () => previous?.focus(); }, []);
  const columns = board.columns.filter(column => column.cards.length > 0);
  const selected = columns.filter(column => scope === 'all' || column.id === scope);
  const count = selected.reduce((sum, column) => sum + column.cards.length, 0);
  const changeScope = (value: string) => {
    setScope(value); setError('');
    if (value === 'all') { setStart(dateKey(board.startDate)); setEnd(dateKey(board.endDate)); return; }
    const column = columns.find(item => item.id === value)!;
    const sprint = board.sprints?.find(item => item.id === column.id || item.name.toLowerCase() === column.name.toLowerCase());
    const starts = column.cards.map(card => dateKey(card.startDate)).filter(Boolean).sort();
    const ends = column.cards.map(card => dateKey(card.dueDate)).filter(Boolean).sort();
    setStart(dateKey(sprint?.startDate) || starts[0] || '');
    setEnd(dateKey(sprint?.endDate) || ends[ends.length - 1] || '');
  };
  return createPortal(<div className="modal-overlay" style={{ zIndex: 1600 }} onClick={onClose}>
    <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="reallocation-title" tabIndex={-1}
      style={{ width: 'min(480px, 94vw)', padding: 24 }} onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab' && ref.current) {
          const controls = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select');
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3 id="reallocation-title" style={{ margin: 0 }}>Auto Reallocate Schedule</h3>
        <button type="button" className="icon-btn" aria-label="Close auto reallocation" onClick={onClose}><X size={16} /></button>
      </div>
      <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Fit tasks into the scheduled date range using their current order and relative allotted durations.</p>
      <label className="field-label">Scope
        <select className="text-input" value={scope} onChange={event => changeScope(event.target.value)}>
          <option value="all">Entire roadmap</option>
          {columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <label className="field-label">Scheduled start<input className="text-input" type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label className="field-label">Scheduled end<input className="text-input" type="date" value={end} min={start} onChange={event => setEnd(event.target.value)} /></label>
      </div>
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{count} tasks in {selected.length} building(s). {start && end && end >= start ? `${scheduledDays(start, end)} calendar days.` : 'Choose a valid date range.'}</p>
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Buildings and tasks are scheduled in order. Short ranges may put multiple tasks on the same day. Actual dates, progress, pauses, and values stay unchanged.</p>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={!count} onClick={() => {
          if (!start || !end || end < start) { setError('Set a scheduled end on or after the scheduled start.'); return; }
          if (!reallocate(board.id, scope, start, end)) { setError('No tasks were available to reallocate.'); return; }
          toast('Schedule reallocated; saving to database…', 'info'); onClose();
        }}><WandSparkles size={14} /> Auto Reallocate</button>
      </div>
    </div>
  </div>, document.body);
}
