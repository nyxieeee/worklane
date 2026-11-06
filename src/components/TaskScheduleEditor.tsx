import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { addScheduledDays, dateKey, scheduledDays } from '../scheduling/calendarSchedule';
import { useWorkStore } from '../store/useWorkStore';

export default function TaskScheduleEditor({ boardId, cardId, title, startDate, endDate, onClose }: {
  boardId: string; cardId: string; title: string; startDate: Date; endDate: Date; onClose: () => void;
}) {
  const reschedule = useWorkStore(state => state.rescheduleCard);
  const [start, setStart] = useState(dateKey(startDate));
  const [end, setEnd] = useState(dateKey(endDate));
  const [days, setDays] = useState<number | ''>(scheduledDays(startDate, endDate));
  const [cascade, setCascade] = useState(true);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const save = (nextStart: string, nextEnd: string) => {
    if (!nextStart || !nextEnd || nextEnd < nextStart) { setError('Scheduled end must be on or after scheduled start.'); return; }
    setError('');
    reschedule(boardId, cardId, nextStart, nextEnd, cascade);
  };
  return createPortal(<div className="modal-overlay" style={{ zIndex: 1600 }} onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-schedule-title" ref={dialogRef} tabIndex={-1}
      style={{ width: 'min(440px, 94vw)', padding: 24 }} onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Tab' && dialogRef.current) {
          const controls = dialogRef.current.querySelectorAll<HTMLElement>('button, input');
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3 id="task-schedule-title" style={{ margin: 0 }}>Edit task schedule</h3>
        <button type="button" className="icon-btn" aria-label="Close schedule editor" onClick={onClose}><X size={16} /></button>
      </div>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="field-label">Scheduled start
          <input className="text-input" type="date" value={start} onChange={event => {
            const next = event.target.value;
            setStart(next);
            if (!next) return;
            const due = addScheduledDays(next, (days || 1) - 1);
            setEnd(due); save(next, due);
          }} />
        </label>
        <label className="field-label">Scheduled end
          <input className="text-input" type="date" value={end} min={start} onChange={event => {
            const next = event.target.value;
            setEnd(next);
            if (start && next >= start) setDays(scheduledDays(start, next));
            save(start, next);
          }} />
        </label>
      </div>
      <label className="field-label" style={{ display: 'block', marginTop: 14 }}>Allotted calendar days
        <input className="text-input" type="number" min={1} step={1} value={days} onChange={event => {
          const count = event.target.value === '' ? '' : Number(event.target.value);
          setDays(count);
          if (count === '' || !Number.isInteger(count) || count < 1 || !start) return;
          const due = addScheduledDays(start, count - 1); setEnd(due); save(start, due);
        }} />
      </label>
      <label style={{ display: 'flex', gap: 8, marginTop: 16, fontSize: 13 }}>
        <input type="checkbox" checked={cascade} onChange={event => setCascade(event.target.checked)} />
        Shift following tasks in this building
      </label>
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Valid changes save automatically. Following tasks start the next day and keep their durations. Actual work dates and progress stay unchanged.</p>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
    </div>
  </div>, document.body);
}
