import type { Card } from '../types';

export function dateKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const ordinal = (value: string | Date) => {
  const [year, month, day] = dateKey(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
export const scheduledDays = (start: string | Date, end: string | Date) => Math.max(1, ordinal(end) - ordinal(start) + 1);
export function addScheduledDays(start: string | Date, count: number): string {
  const [year, month, day] = dateKey(start).split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + count));
}

/** Reflow only scheduled fields in the current task order. */
export function shiftFollowingTasks(cards: Card[], cardId: string, start: string, end: string, cascade: boolean): Card[] {
  const index = cards.findIndex(card => card.id === cardId);
  if (index < 0) return cards;
  let cursor = addScheduledDays(end, 1);
  return cards.map((card, i) => {
    if (i < index || (i > index && !cascade)) return card;
    if (i === index) return { ...card, startDate: start, dueDate: end };
    const duration = card.startDate && card.dueDate ? scheduledDays(card.startDate, card.dueDate) : 1;
    const dueDate = addScheduledDays(cursor, duration - 1);
    const updated = { ...card, startDate: cursor, dueDate };
    cursor = addScheduledDays(dueDate, 1);
    return updated;
  });
}

/** Proportional allocation fills the selected range; short ranges allow tasks to share a day. */
export function allocateTaskDates<T extends Pick<Card, 'startDate' | 'dueDate'>>(cards: T[], start: string, end: string): T[] {
  if (!cards.length) return cards;
  const days = scheduledDays(start, end);
  const weights = cards.map(card => card.startDate && card.dueDate ? scheduledDays(card.startDate, card.dueDate) : 1);
  const total = weights.reduce((a, b) => a + b, 0);
  if (days < cards.length) return cards.map((card, i) => {
    const offset = Math.floor(i * days / cards.length);
    return { ...card, startDate: addScheduledDays(start, offset), dueDate: addScheduledDays(start, offset) };
  });
  const raw = weights.map(weight => weight / total * days);
  const lengths = raw.map(length => Math.max(1, Math.floor(length)));
  let difference = days - lengths.reduce((a, b) => a + b, 0);
  while (difference !== 0) {
    const candidates = lengths.map((length, i) => ({ i, error: raw[i] - length }))
      .filter(item => difference > 0 || lengths[item.i] > 1)
      .sort((a, b) => difference > 0 ? b.error - a.error || a.i - b.i : a.error - b.error || a.i - b.i);
    const index = candidates[0].i;
    lengths[index] += difference > 0 ? 1 : -1;
    difference += difference > 0 ? -1 : 1;
  }
  let cursor = start;
  return cards.map((card, i) => {
    const dueDate = addScheduledDays(cursor, lengths[i] - 1);
    const updated = { ...card, startDate: cursor, dueDate };
    cursor = addScheduledDays(dueDate, 1);
    return updated;
  });
}

/** Allocate in stored building/task order, preserving every field except scheduled dates. */
export function reallocateBoardDates(board: import('../types').Board, scope: string, start: string, end: string): import('../types').Board | null {
  if (!start || !end || end < start) return null;
  const selected = board.columns.filter(column => column.cards.length > 0 && (scope === 'all' || column.id === scope));
  if (!selected.length) return null;
  const phases = selected.map(column => {
    const sprint = board.sprints?.find(item => item.id === column.id || item.name.toLowerCase() === column.name.toLowerCase());
    const starts = column.cards.map(card => dateKey(card.startDate)).filter(Boolean).sort();
    const ends = column.cards.map(card => dateKey(card.dueDate)).filter(Boolean).sort();
    return { id: column.id, startDate: dateKey(sprint?.startDate) || starts[0] || start,
      dueDate: dateKey(sprint?.endDate) || ends[ends.length - 1] || start, sprint };
  });
  const allocated = allocateTaskDates(phases, start, end);
  const sprints = [...(board.sprints || [])];
  const columns = board.columns.map(column => {
    const span = allocated.find(item => item.id === column.id);
    if (!span) return column;
    const sprintId = span.sprint?.id || column.id;
    const sprint = span.sprint ? { ...span.sprint, startDate: span.startDate, endDate: span.dueDate }
      : { id: sprintId, name: column.name, startDate: span.startDate, endDate: span.dueDate, status: 'planned' as const };
    const existing = sprints.findIndex(item => item.id === sprintId);
    if (existing >= 0) sprints[existing] = sprint; else sprints.push(sprint);
    return { ...column, cards: allocateTaskDates(column.cards, span.startDate, span.dueDate).map(card => ({ ...card, sprintId })) };
  });
  return { ...board, columns, sprints, ...(scope === 'all' ? { startDate: start, endDate: end } : {}) };
}
