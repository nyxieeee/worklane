import { deriveCardProgress } from '../utils';
import type { TaskWithScheduleForSCurve } from '../components/RoadmapSCurve';

export const localReportDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** All reports compare calendar dates at local midnight, including scheduled end dates. */
export function plannedFraction(task: TaskWithScheduleForSCurve, asOf: Date): number {
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const start = midnight(task.targetStartDate), end = midnight(task.targetEndDate), report = midnight(asOf);
  const pauses = new Set<number>();
  for (const pause of task.card.workSuspensions || []) {
    const from = new Date(`${pause.from.slice(0, 10)}T00:00:00`);
    const to = new Date(`${pause.to.slice(0, 10)}T00:00:00`);
    for (const date = new Date(Math.max(start, from.getTime())); date.getTime() <= Math.min(report, to.getTime()); date.setDate(date.getDate() + 1)) pauses.add(date.getTime());
  }
  const elapsed = report - start - pauses.size * 86400000;
  if (elapsed < 0) return 0;
  return Math.max(0, Math.min(1, end <= start ? 1 : elapsed / (end - start)));
}

/** Accomplishment is the recorded snapshot, independent of inferred completion dates. */
export const recordedFraction = (task: TaskWithScheduleForSCurve) => deriveCardProgress(task.card, task.columnName) / 100;

export function summarizeProgress(entries: { task: TaskWithScheduleForSCurve; value: number }[], asOf: Date, budget: number) {
  let plannedValue = 0, actualValue = 0, plannedCount = 0, actualCount = 0;
  for (const { task, value } of entries) {
    const planned = plannedFraction(task, asOf), actual = recordedFraction(task);
    plannedValue += Math.round(value * planned);
    actualValue += Math.round(value * actual);
    plannedCount += planned;
    actualCount += actual;
  }
  const pct = (value: number) => budget > 0 ? Math.round(value / budget * 1000) / 10 : 0;
  const plannedPct = pct(plannedValue), actualPct = pct(actualValue);
  return { plannedValue, actualValue, plannedPct, actualPct, plannedCount, actualCount,
    variancePct: Math.round((actualPct - plannedPct) * 10) / 10,
    spi: plannedPct > 0 ? Math.round(actualPct / plannedPct * 100) / 100 : 1 };
}
