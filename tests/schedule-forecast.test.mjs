import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const exports = {};
new Function('exports', ts.transpile(readFileSync(new URL('../src/scheduling/calendarSchedule.ts', import.meta.url), 'utf8'), { module: ts.ModuleKind.CommonJS }))(exports);
const { forecastScheduledEnd, reallocateBoardDates, scheduledDays } = exports;
const date = value => new Date(`${value}T00:00:00`);

test('small nonzero percentages cannot extrapolate a live allocated task into 2032', () => {
  for (const progress of [0, 0.01, 0.05, 0.1, 1, 5, 20, 33.4, 75, 100]) {
    const forecast = forecastScheduledEnd(date('2026-10-24'), date('2027-01-13'), date('2026-11-12'), progress);
    assert.equal(exports.dateKey(forecast), '2027-01-13', `progress ${progress}`);
  }
});

test('all 45 tasks remain within the 82-day project horizon after reallocation, including tiny recorded progress', () => {
  const board = { id: 'board', columns: Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, name: `Building ${i}`, cards: Array.from({ length: 9 }, (_, j) => ({
    id: `${i}-${j}`, startDate: '2026-10-24', dueDate: '2027-01-13', progress: [0, 0.01, 0.05, 0.1, 1, 20, 50, 75, 100][j], completed: j === 8,
  })) })) };
  const allocated = reallocateBoardDates(board, 'all', '2026-10-24', '2027-01-13');
  assert.equal(scheduledDays(allocated.startDate, allocated.endDate), 82);
  for (const col of allocated.columns) for (const card of col.cards) {
    assert.ok(card.startDate >= '2026-10-24');
    assert.ok(card.dueDate <= '2027-01-13');
    const forecast = forecastScheduledEnd(date(card.startDate), date(card.dueDate), date('2026-11-12'), card.progress);
    assert.ok(exports.dateKey(forecast) <= '2027-01-13', `${card.id}: ${exports.dateKey(forecast)}`);
  }
});

test('recorded pauses and overdue remaining scope still extend the forecast honestly', () => {
  assert.equal(exports.dateKey(forecastScheduledEnd(date('2026-10-24'), date('2027-01-13'), date('2026-11-12'), 0.01, 3)), '2027-01-16');
  const overdue = forecastScheduledEnd(date('2026-11-01'), date('2026-11-10'), date('2026-11-12'), 50);
  assert.equal(exports.dateKey(overdue), '2026-11-17');
});
