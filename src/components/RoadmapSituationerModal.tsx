import React, { useState, useRef, useMemo } from 'react';
import {
  X, Printer, DollarSign, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Calendar, Layers, FileText, Check, Plus, Edit2,
  ChevronDown, ChevronRight, BarChart2, Calculator, Eye, SlidersHorizontal,
  FileCheck, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board } from '../types';
import type { TaskWithScheduleForSCurve } from './RoadmapSCurve';
import { formatDueDate } from '../utils';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';

interface Props {
  board: Board;
  tasks: TaskWithScheduleForSCurve[];
  onClose: () => void;
}

// Convert index (0, 1, 2...) to WBS Item Letter: A, B, C... AA, AB...
function getWBSLetter(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < 26) return letters[index];
  const first = letters[Math.floor(index / 26) - 1];
  const second = letters[index % 26];
  return `${first}${second}`;
}

type TabType = 'overview' | 'gantt' | 'budget' | 'notes' | 'full';

export default function RoadmapSituationerModal({ board, tasks, onClose }: Props) {
  const updateBoardBudget = useWorkStore(s => s.updateBoardBudget);
  const updateColumnBudget = useWorkStore(s => s.updateColumnBudget);
  const updateCard = useWorkStore(s => s.updateCard);
  const showToast = useToastStore(s => s.showToast);

  // Active Tab: 'overview' | 'gantt' | 'budget' | 'notes' | 'full'
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Friendly Simple View vs Detailed Engineering View
  const [isDetailedView, setIsDetailedView] = useState<boolean>(false);

  const [currency, setCurrency] = useState(() => board.currency || '₱');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportingPeriod, setReportingPeriod] = useState('Current Reporting Cycle');
  const [preparedBy, setPreparedBy] = useState(() => board.createdBy || 'Project Lead');
  const [executiveNotes, setExecutiveNotes] = useState(
    'Overall deliverables are progressing according to project schedule. Critical path and financial accomplishment are tracked against contract baseline.'
  );

  // S-Curve metric switcher: 'percent' | 'cost'
  const [scurveMetric, setScurveMetric] = useState<'percent' | 'cost'>('cost');

  // Expand / collapse for SOV phases
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    (board.columns || []).forEach(col => { init[col.id] = true; });
    return init;
  });

  const allExpanded = useMemo(() => {
    return (board.columns || []).every(c => expandedPhases[c.id]);
  }, [board.columns, expandedPhases]);

  const toggleAllPhases = () => {
    const nextState = !allExpanded;
    const nextMap: Record<string, boolean> = {};
    (board.columns || []).forEach(c => { nextMap[c.id] = nextState; });
    setExpandedPhases(nextMap);
  };

  const togglePhase = (colId: string) => {
    setExpandedPhases(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  // Local state for editable task costs
  const [taskCosts, setTaskCosts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.card.cost !== undefined && t.card.cost !== null) {
        map[t.card.id] = t.card.cost;
      }
    });
    return map;
  });

  // 1. Initial Phase Budgets:
  // Ensure every column starts with an explicit, known value (no missing keys, no fallback circularity)
  const [phaseBudgets, setPhaseBudgets] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const cols = board.columns || [];
    const totalCols = Math.max(1, cols.length);
    const initialBaseTotal = board.totalBudget && board.totalBudget > 0 ? board.totalBudget : 1000000;
    const defaultSplit = Math.round((initialBaseTotal / totalCols) * 100) / 100;

    cols.forEach(col => {
      if (col.budget !== undefined && col.budget !== null && col.budget > 0) {
        map[col.id] = col.budget;
      } else {
        map[col.id] = defaultSplit;
      }
    });
    return map;
  });

  // Editable total budget
  const [customTotalBudget, setCustomTotalBudget] = useState<number | null>(() => {
    return board.totalBudget && board.totalBudget > 0 ? board.totalBudget : null;
  });

  const [isEditingTotalBudget, setIsEditingTotalBudget] = useState(false);
  const [tempTotalBudgetInput, setTempTotalBudgetInput] = useState('');

  const [editingBudgetColId, setEditingBudgetColId] = useState<string | null>(null);
  const [tempBudgetInput, setTempBudgetInput] = useState<string>('');

  const [editingCostCardId, setEditingCostCardId] = useState<string | null>(null);
  const [tempTaskCostInput, setTempTaskCostInput] = useState<string>('');

  const [editingDaysCardId, setEditingDaysCardId] = useState<string | null>(null);
  const [tempDaysInput, setTempDaysInput] = useState<number>(1);

  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date(reportDate);

  // 2. Resolved column budgets:
  // If tasks in a column have explicit costs entered, those sum up to form the phase budget.
  // Otherwise, use the explicit phase budget from phaseBudgets.
  const resolvedPhaseBudgets = useMemo(() => {
    const map: Record<string, number> = {};
    (board.columns || []).forEach(col => {
      const colTasks = tasks.filter(t => t.columnId === col.id);
      const hasExplicitSubtaskCosts = colTasks.some(t => {
        const c = taskCosts[t.card.id] !== undefined ? taskCosts[t.card.id] : t.card.cost;
        return c !== undefined && c > 0;
      });

      if (hasExplicitSubtaskCosts) {
        const subSum = colTasks.reduce((acc, t) => {
          const c = taskCosts[t.card.id] !== undefined ? taskCosts[t.card.id] : (t.card.cost || 0);
          return acc + c;
        }, 0);
        map[col.id] = subSum;
      } else {
        map[col.id] = phaseBudgets[col.id] !== undefined ? phaseBudgets[col.id] : 0;
      }
    });
    return map;
  }, [board.columns, tasks, taskCosts, phaseBudgets]);

  // 3. Overall Contract Price / Budget (BAC):
  // ALWAYS equals either user's explicitly entered total budget OR the exact sum of resolved phase budgets!
  const effectiveTotalBudget = useMemo(() => {
    if (customTotalBudget && customTotalBudget > 0) return customTotalBudget;
    const sum = Object.values(resolvedPhaseBudgets).reduce((acc, v) => acc + (v || 0), 0);
    return sum > 0 ? sum : 1000000;
  }, [customTotalBudget, resolvedPhaseBudgets]);

  // Currency helper
  const fmtMoney = (val: number) => {
    return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Save Total Budget
  const handleSaveTotalBudget = () => {
    const num = parseFloat(tempTotalBudgetInput.replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      setCustomTotalBudget(num);
      updateBoardBudget(board.id, num, currency);

      // Re-scale phase budgets proportionally so weights are maintained
      const cols = board.columns || [];
      const currentSum = Object.values(resolvedPhaseBudgets).reduce((acc, v) => acc + (v || 0), 0);
      if (currentSum > 0 && cols.length > 0) {
        const nextPhaseBudgets: Record<string, number> = {};
        cols.forEach(col => {
          const curBudget = resolvedPhaseBudgets[col.id] || 0;
          const ratio = curBudget / currentSum;
          const newColBudget = Math.round(num * ratio * 100) / 100;
          nextPhaseBudgets[col.id] = newColBudget;
          updateColumnBudget(col.id, newColBudget);
        });
        setPhaseBudgets(nextPhaseBudgets);
      }

      showToast('Project Total Contract Price updated', 'success');
    }
    setIsEditingTotalBudget(false);
  };

  // Auto-calculate Total Contract Price from Phase budgets
  const handleAutoSumTotal = () => {
    const sum = Object.values(resolvedPhaseBudgets).reduce((acc, b) => acc + (b || 0), 0);
    if (sum > 0) {
      setCustomTotalBudget(sum);
      updateBoardBudget(board.id, sum, currency);
      showToast(`Total Contract Price updated to ${fmtMoney(sum)}`, 'success');
    } else {
      showToast('No phase or task budgets set to sum yet', 'info');
    }
  };

  // Save Phase Budget
  const handleSavePhaseBudget = (colId: string) => {
    const num = parseFloat(tempBudgetInput.replace(/,/g, ''));
    if (!isNaN(num) && num >= 0) {
      setPhaseBudgets(prev => {
        const next = { ...prev, [colId]: num };
        if (!customTotalBudget) {
          const sum = Object.values(next).reduce((acc, v) => acc + (v || 0), 0);
          updateBoardBudget(board.id, sum, currency);
        }
        return next;
      });
      updateColumnBudget(colId, num);
      showToast('Phase contract value updated', 'success');
    }
    setEditingBudgetColId(null);
  };

  // Save Task Cost
  const handleSaveTaskCost = (cardId: string, colId: string) => {
    const num = parseFloat(tempTaskCostInput.replace(/,/g, ''));
    if (!isNaN(num) && num >= 0) {
      setTaskCosts(prev => ({ ...prev, [cardId]: num }));
      updateCard(cardId, { cost: num });

      // Automatically recalculate parent phase's budget
      const colTasks = tasks.filter(t => t.columnId === colId);
      const nextColSum = colTasks.reduce((acc, t) => {
        const c = t.card.id === cardId ? num : (taskCosts[t.card.id] !== undefined ? taskCosts[t.card.id] : (t.card.cost || 0));
        return acc + c;
      }, 0);

      setPhaseBudgets(prev => {
        const next = { ...prev, [colId]: nextColSum };
        if (!customTotalBudget) {
          const sum = Object.values(next).reduce((acc, v) => acc + (v || 0), 0);
          updateBoardBudget(board.id, sum, currency);
        }
        return next;
      });
      updateColumnBudget(colId, nextColSum);

      showToast('Deliverable contract value updated', 'success');
    }
    setEditingCostCardId(null);
  };

  const handleSaveSubtaskDays = (cardId: string, currentStartDate: Date, newDays: number) => {
    const days = Math.max(1, newDays);
    const startIso = currentStartDate.toISOString().split('T')[0];
    const newDueDate = new Date(currentStartDate);
    newDueDate.setDate(newDueDate.getDate() + days - 1);
    const dueDateIso = newDueDate.toISOString().split('T')[0];
    updateCard(cardId, { startDate: startIso, dueDate: dueDateIso });
    showToast(`Updated deliverable duration to ${days} day${days > 1 ? 's' : ''}`, 'success');
    setEditingDaysCardId(null);
  };

  const handleUpdateCurrency = (newCurr: string) => {
    setCurrency(newCurr);
    updateBoardBudget(board.id, effectiveTotalBudget, newCurr);
  };

  // ── Work Breakdown Structure (WBS) & Schedule of Values Data ──
  const { phasesList, overallPlannedPct, overallActualPct, overallPlannedValue, overallActualValue, overallVariancePct, overallVarianceValue, spi } = useMemo(() => {
    const cols = board.columns || [];
    const reportT = now.getTime();

    const list = cols.map((col, colIdx) => {
      const wbsLetter = getWBSLetter(colIdx);
      const colTasks = tasks.filter(t => t.columnId === col.id);
      const phaseBudget = resolvedPhaseBudgets[col.id] || 0;

      // Weight is phaseBudget / effectiveTotalBudget * 100
      const phaseWeightPct = effectiveTotalBudget > 0 ? (phaseBudget / effectiveTotalBudget) * 100 : 0;
      const defaultTaskCost = colTasks.length > 0 ? phaseBudget / colTasks.length : 0;

      // Map subtasks with WBS numbering
      const subtasks = colTasks.map((t, taskIdx) => {
        const subtaskWBS = `Item ${wbsLetter}.${taskIdx + 1}`;
        const explicitCost = taskCosts[t.card.id] !== undefined ? taskCosts[t.card.id] : t.card.cost;
        const taskCost = explicitCost !== undefined && explicitCost > 0 ? explicitCost : defaultTaskCost;
        const taskWeightPct = effectiveTotalBudget > 0 ? (taskCost / effectiveTotalBudget) * 100 : 0;

        // Planned fraction up to report date (0.0 to 1.0)
        const sT = t.targetStartDate.getTime();
        const eT = t.targetEndDate.getTime();
        let plannedFrac = 0;
        if (reportT >= eT) {
          plannedFrac = 1;
        } else if (reportT > sT) {
          plannedFrac = Math.min(1, Math.max(0, (reportT - sT) / Math.max(1, eT - sT)));
        }

        // Actual fraction (0.0 to 1.0)
        let actualFrac = 0;
        if (t.card.completed) {
          actualFrac = 1;
        } else {
          actualFrac = (t.card.progress || 0) / 100;
        }

        const plannedVal = Math.round(taskCost * plannedFrac);
        const actualVal = Math.round(taskCost * actualFrac);
        const plannedWeightPct = taskWeightPct * plannedFrac;
        const actualWeightPct = taskWeightPct * actualFrac;
        const varianceWeightPct = actualWeightPct - plannedWeightPct;
        const varianceVal = actualVal - plannedVal;

        // Friendly Status Badge
        let statusBadge = { label: 'On Track', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
        if (t.card.completed) {
          statusBadge = { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.2)' };
        } else if (varianceWeightPct > 0.05) {
          statusBadge = { label: 'Ahead', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
        } else if (varianceWeightPct < -0.05 || (t.targetEndDate < now && !t.card.completed)) {
          statusBadge = { label: 'Delayed', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
        }

        return {
          task: t,
          wbsCode: subtaskWBS,
          title: t.card.title,
          cost: taskCost,
          isExplicitCost: explicitCost !== undefined && explicitCost > 0,
          weightPct: taskWeightPct,
          plannedFrac,
          actualFrac,
          plannedWeightPct,
          actualWeightPct,
          plannedValue: plannedVal,
          actualValue: actualVal,
          varianceWeightPct,
          varianceValue: varianceVal,
          statusBadge,
        };
      });

      // Roll up phase totals
      const phasePlannedVal = subtasks.reduce((acc, st) => acc + st.plannedValue, 0);
      const phaseActualVal = subtasks.reduce((acc, st) => acc + st.actualValue, 0);
      const phasePlannedWeightPct = subtasks.reduce((acc, st) => acc + st.plannedWeightPct, 0);
      const phaseActualWeightPct = subtasks.reduce((acc, st) => acc + st.actualWeightPct, 0);
      const phaseVarianceWeightPct = phaseActualWeightPct - phasePlannedWeightPct;
      const phaseVarianceVal = phaseActualVal - phasePlannedVal;

      const completedCount = colTasks.filter(t => t.card.completed).length;

      // Calculate the physical % of this phase (0 to 100%)
      const phasePhysicalTargetPct = phaseBudget > 0 ? (phasePlannedVal / phaseBudget) * 100 : 0;
      const phasePhysicalActualPct = phaseBudget > 0 ? (phaseActualVal / phaseBudget) * 100 : 0;

      // Friendly Phase Status Badge
      let phaseStatus = { label: 'On Track', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
      if (completedCount === colTasks.length && colTasks.length > 0) {
        phaseStatus = { label: 'Finished', color: '#10b981', bg: 'rgba(16,185,129,0.2)' };
      } else if (phaseActualVal > phasePlannedVal) {
        phaseStatus = { label: 'Ahead', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
      } else if (phaseActualVal < phasePlannedVal) {
        phaseStatus = { label: 'Behind Target', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
      }

      return {
        id: col.id,
        wbsLetter,
        wbsCode: `Item ${wbsLetter}.`,
        name: col.name,
        total: colTasks.length,
        completed: completedCount,
        budget: phaseBudget,
        weightPct: phaseWeightPct,
        physicalTargetPct: phasePhysicalTargetPct,
        physicalActualPct: phasePhysicalActualPct,
        plannedWeightPct: phasePlannedWeightPct,
        actualWeightPct: phaseActualWeightPct,
        plannedValue: phasePlannedVal,
        actualValue: phaseActualVal,
        varianceWeightPct: phaseVarianceWeightPct,
        varianceValue: phaseVarianceVal,
        phaseStatus,
        subtasks,
      };
    });

    const sumPlannedVal = list.reduce((acc, p) => acc + p.plannedValue, 0);
    const sumActualVal = list.reduce((acc, p) => acc + p.actualValue, 0);
    const sumPlannedPct = effectiveTotalBudget > 0 ? Math.round((sumPlannedVal / effectiveTotalBudget) * 1000) / 10 : 0;
    const sumActualPct = effectiveTotalBudget > 0 ? Math.round((sumActualVal / effectiveTotalBudget) * 1000) / 10 : 0;
    const sumVariancePct = Math.round((sumActualPct - sumPlannedPct) * 10) / 10;
    const sumVarianceVal = sumActualVal - sumPlannedVal;
    const computedSPI = sumPlannedPct > 0 ? Math.round((sumActualPct / sumPlannedPct) * 100) / 100 : 1.0;

    return {
      phasesList: list,
      overallPlannedPct: sumPlannedPct,
      overallActualPct: sumActualPct,
      overallPlannedValue: sumPlannedVal,
      overallActualValue: sumActualVal,
      overallVariancePct: sumVariancePct,
      overallVarianceValue: sumVarianceVal,
      spi: computedSPI,
    };
  }, [board.columns, resolvedPhaseBudgets, effectiveTotalBudget, tasks, taskCosts, now]);

  // ── S-Curve Calculation Points (Baseline Planned S-Curve vs Actual Accomplished) ──
  const scurvePoints = useMemo(() => {
    if (tasks.length === 0) return [];

    let minDate = board.startDate ? new Date(board.startDate) : new Date();
    let maxDate = board.endDate ? new Date(board.endDate) : new Date();

    tasks.forEach(t => {
      if (t.targetStartDate < minDate) minDate = new Date(t.targetStartDate);
      if (t.targetEndDate > maxDate) maxDate = new Date(t.targetEndDate);
      if (t.actualOrProjectedEndDate > maxDate) maxDate = new Date(t.actualOrProjectedEndDate);
    });

    minDate = new Date(minDate);
    minDate.setHours(0, 0, 0, 0);
    maxDate = new Date(maxDate);
    maxDate.setHours(23, 59, 59, 999);

    const totalSpanMs = Math.max(86400000, maxDate.getTime() - minDate.getTime());
    const days = Math.ceil(totalSpanMs / 86400000);
    const stepDays = Math.max(1, Math.ceil(days / 40));

    const points: Array<{
      date: Date;
      dateStr: string;
      label: string;
      plannedPct: number;
      plannedValue: number;
      actualPct: number | null;
      actualValue: number | null;
      projectedPct: number | null;
      projectedValue: number | null;
      isToday: boolean;
    }> = [];

    const reportT = now.getTime();

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + stepDays)) {
      const curT = d.getTime();
      const isPastOrToday = curT <= reportT;

      let plannedFracSum = 0;
      let actualFracSum = 0;
      let projectedFracSum = 0;

      phasesList.forEach(phase => {
        phase.subtasks.forEach(st => {
          const sT = st.task.targetStartDate.getTime();
          const eT = st.task.targetEndDate.getTime();
          const pT = st.task.actualOrProjectedEndDate.getTime();

          // Planned
          if (curT >= eT) {
            plannedFracSum += st.weightPct;
          } else if (curT > sT) {
            plannedFracSum += st.weightPct * ((curT - sT) / Math.max(1, eT - sT));
          }

          // Actual (up to report date)
          if (isPastOrToday) {
            if (st.task.card.completed) {
              const compT = st.task.card.completedAt ? new Date(st.task.card.completedAt).getTime() : eT;
              if (curT >= compT) actualFracSum += st.weightPct;
              else if (curT > sT) actualFracSum += st.weightPct * ((curT - sT) / Math.max(1, compT - sT));
            } else {
              const prog = (st.task.card.progress || 0) / 100;
              if (curT >= reportT) actualFracSum += st.weightPct * prog;
              else if (curT > sT) actualFracSum += st.weightPct * prog * ((curT - sT) / Math.max(1, reportT - sT));
            }
          }

          // Projected
          if (curT >= pT) {
            projectedFracSum += st.weightPct;
          } else if (curT > sT) {
            projectedFracSum += st.weightPct * ((curT - sT) / Math.max(1, pT - sT));
          }
        });
      });

      const pPct = Math.min(100, Math.max(0, Math.round(plannedFracSum * 10) / 10));
      const aPct = isPastOrToday ? Math.min(100, Math.max(0, Math.round(actualFracSum * 10) / 10)) : null;
      const projPct = !isPastOrToday ? Math.min(100, Math.max(0, Math.round(projectedFracSum * 10) / 10)) : null;

      const pVal = Math.round((pPct / 100) * effectiveTotalBudget);
      const aVal = aPct !== null ? Math.round((aPct / 100) * effectiveTotalBudget) : null;
      const projVal = projPct !== null ? Math.round((projPct / 100) * effectiveTotalBudget) : null;

      const diffFromToday = Math.abs(curT - reportT);
      const isToday = diffFromToday <= (stepDays * 86400000) / 2;

      points.push({
        date: new Date(d),
        dateStr: d.toISOString().split('T')[0],
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        plannedPct: pPct,
        plannedValue: pVal,
        actualPct: aPct,
        actualValue: aVal,
        projectedPct: projPct,
        projectedValue: projVal,
        isToday,
      });
    }

    return points;
  }, [tasks, board.startDate, board.endDate, now, phasesList, effectiveTotalBudget]);

  // S-Curve SVG Dimensions
  const svgWidth = 860;
  const svgHeight = 240;
  const padding = { top: 25, right: 35, bottom: 35, left: 75 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  // Build SVG Path helper
  const { plannedPath, actualPath, projectedPath, todayX, todayYPlanned, todayYActual } = useMemo(() => {
    if (scurvePoints.length < 2) return { plannedPath: '', actualPath: '', projectedPath: '', todayX: 0, todayYPlanned: 0, todayYActual: 0 };

    const n = scurvePoints.length;
    let pPath = '';
    let aPath = '';
    let projPath = '';
    let tX = 0;
    let tYPlan = 0;
    let tYAct = 0;

    scurvePoints.forEach((pt, i) => {
      const x = padding.left + (i / (n - 1)) * chartW;
      const yPlan = padding.top + chartH - (pt.plannedPct / 100) * chartH;

      if (i === 0) pPath += `M ${x} ${yPlan}`;
      else pPath += ` L ${x} ${yPlan}`;

      if (pt.actualPct !== null) {
        const yAct = padding.top + chartH - (pt.actualPct / 100) * chartH;
        if (i === 0) aPath += `M ${x} ${yAct}`;
        else aPath += ` L ${x} ${yAct}`;
        tX = x;
        tYPlan = yPlan;
        tYAct = yAct;
      }

      if (pt.projectedPct !== null) {
        const yProj = padding.top + chartH - (pt.projectedPct / 100) * chartH;
        if (!projPath) {
          projPath += `M ${tX} ${tYAct} L ${x} ${yProj}`;
        } else {
          projPath += ` L ${x} ${yProj}`;
        }
      }
    });

    return {
      plannedPath: pPath,
      actualPath: aPath,
      projectedPath: projPath,
      todayX: tX,
      todayYPlanned: tYPlan,
      todayYActual: tYAct,
    };
  }, [scurvePoints, chartW, chartH]);

  // Gantt Timeline Span for the Situationer Gantt Chart
  const ganttTimeSpan = useMemo(() => {
    if (tasks.length === 0) return { start: new Date(), end: new Date(), days: 30 };
    let start = board.startDate ? new Date(board.startDate) : new Date();
    let end = board.endDate ? new Date(board.endDate) : new Date();

    tasks.forEach(t => {
      if (t.targetStartDate < start) start = new Date(t.targetStartDate);
      if (t.targetEndDate > end) end = new Date(t.targetEndDate);
    });

    start = new Date(start); start.setHours(0, 0, 0, 0);
    end = new Date(end); end.setHours(23, 59, 59, 999);
    const days = Math.max(7, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    return { start, end, days };
  }, [tasks, board.startDate, board.endDate]);

  // Critical risks & delayed tasks
  const criticalDelayedTasks = tasks.filter(t => !t.card.completed && (t.varianceDays > 2 || (t.targetEndDate < now && !t.card.completed)));

  const handlePrint = () => {
    // Switch to full document view before print
    setActiveTab('full');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200, zIndex: 1100 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="modal"
        style={{
          maxWidth: 1060,
          width: '96%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: 'hsl(var(--card))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Friendly Modal Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--secondary) / 0.35)',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'hsl(var(--primary) / 0.15)',
              color: 'hsl(var(--primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'hsl(var(--foreground))' }}>
                  Project Situationer Report (SITREP)
                </h2>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: overallVariancePct >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: overallVariancePct >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {overallVariancePct >= 0 ? `● ${overallVariancePct}% Ahead of Target` : `● ${Math.abs(overallVariancePct)}% Behind Schedule`}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                Executive progress, contract budget tracking, S-Curve &amp; milestone schedule
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View Mode Toggle: Simple vs Detailed */}
            <button
              type="button"
              className={`btn ${isDetailedView ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: 30, fontSize: 11, padding: '0 10px', gap: 5 }}
              onClick={() => setIsDetailedView(s => !s)}
              title={isDetailedView ? 'Switch to Simple Non-Engineer View' : 'Switch to Detailed Engineering View (PV, EV, SPI)'}
            >
              <SlidersHorizontal size={12} />
              <span>{isDetailedView ? 'Detailed View' : 'Simple View'}</span>
            </button>

            {/* Currency selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '2px 5px' }}>
              {['₱', '$', '€', '¥'].map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleUpdateCurrency(curr)}
                  style={{
                    border: 'none',
                    background: currency === curr ? 'hsl(var(--primary))' : 'transparent',
                    color: currency === curr ? '#fff' : 'hsl(var(--foreground))',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Print Button */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 30, fontSize: 11, gap: 5, padding: '0 10px' }}
              onClick={handlePrint}
              title="Print or Save as Official PDF"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close Report"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Intuitive Navigation Tabs ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 20px',
          background: 'hsl(var(--card))',
          borderBottom: '1px solid hsl(var(--border) / 0.6)',
          overflow: 'hidden',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {[
            { id: 'overview', label: 'Overview & S-Curve', icon: TrendingUp },
            { id: 'gantt', label: 'Gantt Timeline', icon: Calendar },
            { id: 'budget', label: 'Budget & Values', icon: Layers },
            { id: 'notes', label: 'Site Notes & Risks', icon: ShieldAlert, badge: criticalDelayedTasks.length > 0 ? criticalDelayedTasks.length : undefined },
            { id: 'full', label: 'Full Document (All)', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: isActive ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                  color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '0 5px',
                    borderRadius: 10,
                    background: '#ef4444',
                    color: '#fff',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Report Body ── */}
        <div ref={printRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          backgroundColor: 'hsl(var(--background))',
        }}>

          {/* ── Friendly Executive Metadata Header ── */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 12,
            padding: '14px 18px',
            boxShadow: 'var(--neu-shadow-raised-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Project Status Report
              </span>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 3px', color: 'hsl(var(--foreground))' }}>
                {board.name}
              </h1>
              <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                {board.description || 'Schedule of values, physical accomplishment & timeline status'}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 11.5,
              background: 'hsl(var(--secondary) / 0.35)',
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid hsl(var(--border) / 0.6)',
              flexWrap: 'wrap',
            }}>
              <div>
                <span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: 10, fontWeight: 600 }}>As of Date:</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'hsl(var(--foreground))',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              </div>

              <div style={{ width: 1, height: 26, background: 'hsl(var(--border) / 0.6)' }} />

              <div>
                <span style={{ color: 'hsl(var(--muted-foreground))', display: 'block', fontSize: 10, fontWeight: 600 }}>Total Contract Price:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--primary))' }}>
                    {fmtMoney(effectiveTotalBudget)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 18, height: 18, padding: 0 }}
                    onClick={() => {
                      setIsEditingTotalBudget(true);
                      setTempTotalBudgetInput(String(effectiveTotalBudget));
                    }}
                    title="Click to edit Contract Price"
                  >
                    <Edit2 size={10} color="hsl(var(--primary))" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4 Friendly Headline KPI Cards (Plain Language for Everyone) ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {/* 1. Contract Price */}
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '14px 16px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                Contract Budget
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--foreground))', margin: '4px 0 2px' }}>
                {fmtMoney(effectiveTotalBudget)}
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--primary))', fontWeight: 600 }}>
                {fmtMoney(overallActualValue)} completed to date
              </span>
            </div>

            {/* 2. Target vs Actual Done */}
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '14px 16px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                Work Accomplished
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: overallActualPct >= overallPlannedPct ? '#10b981' : '#f59e0b', margin: '4px 0 2px' }}>
                {overallActualPct}% <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>done</span>
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                Target for today was <strong>{overallPlannedPct}%</strong>
              </span>
            </div>

            {/* 3. Project Schedule Health */}
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '14px 16px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                Schedule Status
              </span>
              <div style={{
                fontSize: 18,
                fontWeight: 800,
                color: overallVariancePct >= 0 ? '#10b981' : '#ef4444',
                margin: '6px 0 2px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                {overallVariancePct >= 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{overallVariancePct >= 0 ? `${overallVariancePct}% Ahead` : `${Math.abs(overallVariancePct)}% Behind`}</span>
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                {overallVariancePct >= 0 ? 'Pacing smoothly on schedule' : 'Needs attention to recover target'}
              </span>
            </div>

            {/* 4. Remaining Balance */}
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '14px 16px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                Remaining Balance
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--foreground))', margin: '4px 0 2px' }}>
                {Math.max(0, Math.round((100 - overallActualPct) * 10) / 10)}%
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                {fmtMoney(Math.max(0, effectiveTotalBudget - overallActualValue))} unearned balance
              </span>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              TAB 1: S-CURVE & VISUAL OVERVIEW
              ════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'overview' || activeTab === 'full') && (
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} color="hsl(var(--primary))" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>
                    Project Progress S-Curve
                  </h3>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                    (Target baseline vs. actual progress accomplished)
                  </span>
                </div>

                {/* S-Curve Mode Toggle */}
                <div style={{ display: 'inline-flex', alignItems: 'center', background: 'hsl(var(--secondary) / 0.5)', padding: 2, borderRadius: 6 }}>
                  <button
                    type="button"
                    onClick={() => setScurveMetric('cost')}
                    style={{
                      border: 'none',
                      background: scurveMetric === 'cost' ? 'hsl(var(--primary))' : 'transparent',
                      color: scurveMetric === 'cost' ? '#fff' : 'hsl(var(--foreground))',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Money ({currency})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScurveMetric('percent')}
                    style={{
                      border: 'none',
                      background: scurveMetric === 'percent' ? 'hsl(var(--primary))' : 'transparent',
                      color: scurveMetric === 'percent' ? '#fff' : 'hsl(var(--foreground))',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Percentage %
                  </button>
                </div>
              </div>

              {/* S-Curve Canvas */}
              <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', minWidth: 600, display: 'block' }}
                >
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map(pct => {
                    const y = padding.top + chartH - (pct / 100) * chartH;
                    const label = scurveMetric === 'percent'
                      ? `${pct}%`
                      : `${currency}${Math.round((pct / 100) * (effectiveTotalBudget / 1000))}k`;
                    return (
                      <g key={pct}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke="hsl(var(--border) / 0.4)"
                          strokeDasharray={pct === 0 || pct === 100 ? undefined : '3,3'}
                          strokeWidth={1}
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fontSize={9.5}
                          fill="hsl(var(--muted-foreground))"
                          fontWeight={600}
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Target Baseline Curve (Green S-Curve) */}
                  {plannedPath && (
                    <path
                      d={plannedPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Actual Accomplished Curve (Amber S-Curve) */}
                  {actualPath && (
                    <path
                      d={actualPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Projected Forecast Curve (Dashed) */}
                  {projectedPath && (
                    <path
                      d={projectedPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4,4"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Today Marker */}
                  {todayX > 0 && (
                    <g>
                      <line
                        x1={todayX}
                        y1={padding.top}
                        x2={todayX}
                        y2={svgHeight - padding.bottom}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                      />
                      <circle cx={todayX} cy={todayYPlanned} r={4.5} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
                      <circle cx={todayX} cy={todayYActual} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
                      <rect x={todayX - 24} y={padding.top - 18} width={48} height={16} rx={4} fill="#ef4444" />
                      <text x={todayX} y={padding.top - 7} textAnchor="middle" fill="#fff" fontSize={8.5} fontWeight={800}>
                        AS OF DATE
                      </text>
                    </g>
                  )}

                  {/* X-Axis Date Labels */}
                  {scurvePoints.filter((_, idx) => idx % Math.ceil(scurvePoints.length / 7) === 0).map(pt => {
                    const idx = scurvePoints.indexOf(pt);
                    const x = padding.left + (idx / (scurvePoints.length - 1)) * chartW;
                    return (
                      <text
                        key={pt.dateStr}
                        x={x}
                        y={svgHeight - padding.bottom + 16}
                        textAnchor="middle"
                        fontSize={9}
                        fill="hsl(var(--muted-foreground))"
                        fontWeight={500}
                      >
                        {pt.label}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Plain-English S-Curve Legend */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 4, background: '#10b981', borderRadius: 2 }} />
                  <span style={{ fontWeight: 600 }}>Planned Target</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 4, background: '#f59e0b', borderRadius: 2 }} />
                  <span style={{ fontWeight: 600 }}>Actual Accomplished</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 14, height: 4, borderTop: '2px dashed #f59e0b' }} />
                  <span style={{ fontWeight: 600 }}>Projected Delivery</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 2, height: 11, background: '#ef4444' }} />
                  <span style={{ fontWeight: 600 }}>Report Date ({reportDate})</span>
                </span>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 2: GANTT TIMELINE SCHEDULE
              ════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'gantt' || activeTab === 'full') && (
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={16} color="hsl(var(--primary))" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>
                    Milestones &amp; Gantt Schedule Timeline
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 6, borderRadius: 2, background: '#10b981' }} />
                    <span style={{ fontWeight: 700, color: '#10b981' }}>[S]</span> Planned Dates
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 6, borderRadius: 2, background: '#f59e0b' }} />
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>[A]</span> Actual Progress
                  </span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 680 }}>
                  {/* Gantt Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '240px 150px 70px 1fr',
                    gap: 8,
                    padding: '8px 10px',
                    borderBottom: '1.5px solid hsl(var(--border))',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'hsl(var(--muted-foreground))',
                    textTransform: 'uppercase',
                  }}>
                    <div>Deliverable</div>
                    <div>Schedule Dates</div>
                    <div>Done %</div>
                    <div>Timeline Bar Span ({ganttTimeSpan.start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – {ganttTimeSpan.end.toLocaleDateString([], { month: 'short', day: 'numeric' })})</div>
                  </div>

                  {/* Gantt Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {phasesList.map(phase => (
                      <div key={phase.id} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Phase Header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '240px 150px 70px 1fr',
                          gap: 8,
                          padding: '7px 10px',
                          background: 'hsl(var(--secondary) / 0.25)',
                          borderBottom: '1px solid hsl(var(--border) / 0.4)',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}>
                          <div>{phase.wbsCode} {phase.name}</div>
                          <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>{phase.completed}/{phase.total} completed</div>
                          <div style={{ color: 'hsl(var(--primary))' }}>{phase.weightPct.toFixed(1)}% share</div>
                          <div style={{ position: 'relative', height: 16 }}>
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: 4,
                              height: 8,
                              borderRadius: 4,
                              background: 'hsl(var(--border) / 0.4)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${Math.min(100, phase.physicalActualPct)}%`,
                                height: '100%',
                                background: '#10b981',
                              }} />
                            </div>
                          </div>
                        </div>

                        {/* Subtask Gantt Rows */}
                        {phase.subtasks.map(st => {
                          const totalMs = Math.max(1, ganttTimeSpan.end.getTime() - ganttTimeSpan.start.getTime());
                          const sT = st.task.targetStartDate.getTime();
                          const eT = st.task.targetEndDate.getTime();
                          const leftPct = Math.max(0, Math.min(100, ((sT - ganttTimeSpan.start.getTime()) / totalMs) * 100));
                          const widthPct = Math.max(2, Math.min(100 - leftPct, ((eT - sT) / totalMs) * 100));
                          const progPct = st.task.card.completed ? 100 : (st.task.card.progress || 0);

                          return (
                            <div
                              key={st.task.card.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '240px 150px 70px 1fr',
                                gap: 8,
                                padding: '6px 10px',
                                borderBottom: '1px solid hsl(var(--border) / 0.2)',
                                fontSize: 11.5,
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginRight: 5 }}>
                                  {st.wbsCode}
                                </span>
                                <span>{st.title}</span>
                              </div>

                              <div style={{ fontSize: 10.5 }}>
                                {editingDaysCardId === st.task.card.id ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <input
                                      type="number"
                                      min={1}
                                      max={365}
                                      autoFocus
                                      value={tempDaysInput}
                                      onChange={e => setTempDaysInput(parseInt(e.target.value, 10) || 1)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveSubtaskDays(st.task.card.id, st.task.targetStartDate, tempDaysInput);
                                        if (e.key === 'Escape') setEditingDaysCardId(null);
                                      }}
                                      style={{
                                        width: 44,
                                        height: 20,
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        padding: '1px 2px',
                                        borderRadius: 4,
                                        border: '1px solid hsl(var(--primary))',
                                        background: 'hsl(var(--card))',
                                        color: 'hsl(var(--foreground))',
                                      }}
                                    />
                                    <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>days</span>
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      style={{ width: 18, height: 18, padding: 0 }}
                                      onClick={() => handleSaveSubtaskDays(st.task.card.id, st.task.targetStartDate, tempDaysInput)}
                                    >
                                      <Check size={11} color="#10b981" />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => {
                                      const curDays = Math.max(1, Math.round((st.task.targetEndDate.getTime() - st.task.targetStartDate.getTime()) / 86400000) + 1);
                                      setEditingDaysCardId(st.task.card.id);
                                      setTempDaysInput(curDays);
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                    title="Click to change allotted days for this sub-item"
                                  >
                                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                                      {formatDueDate(st.task.targetStartDate.toISOString())} – {formatDueDate(st.task.targetEndDate.toISOString())}
                                    </span>
                                    <span style={{
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      background: 'hsl(var(--primary) / 0.12)',
                                      color: 'hsl(var(--primary))',
                                      borderBottom: '1px dashed hsl(var(--primary))',
                                    }}>
                                      {Math.max(1, Math.round((st.task.targetEndDate.getTime() - st.task.targetStartDate.getTime()) / 86400000) + 1)}d
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div style={{ fontWeight: 700, color: progPct === 100 ? '#10b981' : 'hsl(var(--foreground))' }}>
                                {progPct}%
                              </div>

                              {/* Horizontal Gantt Bar */}
                              <div style={{ position: 'relative', height: 18, background: 'hsl(var(--border) / 0.15)', borderRadius: 3 }}>
                                {/* Planned Bar [S] */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: 2,
                                    height: 6,
                                    borderRadius: 2,
                                    background: '#10b981',
                                    opacity: 0.85,
                                  }}
                                  title={`Planned: ${formatDueDate(st.task.targetStartDate.toISOString())} to ${formatDueDate(st.task.targetEndDate.toISOString())}`}
                                />

                                {/* Actual Progress Bar [A] */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct * (progPct / 100)}%`,
                                    top: 10,
                                    height: 6,
                                    borderRadius: 2,
                                    background: progPct === 100 ? '#10b981' : '#f59e0b',
                                  }}
                                  title={`Actual: ${progPct}% completed`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 3: BUDGET & SCHEDULE OF VALUES (SOV)
              ════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'budget' || activeTab === 'full') && (
            <div style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={16} color="hsl(var(--primary))" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>
                    {isDetailedView ? 'Schedule of Values (SOV) & EVM Breakdown' : 'Scope & Budget Breakdown'}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: 26, fontSize: 11, padding: '0 8px', gap: 4 }}
                    onClick={toggleAllPhases}
                  >
                    {allExpanded ? 'Collapse All' : 'Expand All Deliverables'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: 26, fontSize: 11, padding: '0 8px', gap: 4 }}
                    onClick={handleAutoSumTotal}
                    title="Sum Phase/Deliverable values to Total Contract Price"
                  >
                    <Calculator size={11} color="hsl(var(--primary))" />
                    <span>Auto-Sum Total</span>
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                      <th style={{ padding: '8px 8px', fontWeight: 700, width: 260 }}>Phase / Deliverable</th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Budget ({currency})</th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Share (%)</th>

                      {/* Simple Mode vs Detailed Mode Columns */}
                      {!isDetailedView ? (
                        <>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'center', width: 140 }}>Progress Done</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Value Done ({currency})</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Status</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Target (PV %)</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Actual (EV %)</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Planned Value ({currency})</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Earned Value ({currency})</th>
                          <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Variance (%)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {phasesList.map(phase => {
                      const isExpanded = expandedPhases[phase.id] ?? true;
                      const isEditingPhaseBudget = editingBudgetColId === phase.id;

                      return (
                        <React.Fragment key={phase.id}>
                          {/* Phase Header Row */}
                          <tr style={{
                            borderBottom: '1px solid hsl(var(--border) / 0.5)',
                            background: 'hsl(var(--secondary) / 0.18)',
                          }}>
                            <td style={{ padding: '9px 8px', fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  style={{ width: 18, height: 18, padding: 0 }}
                                  onClick={() => togglePhase(phase.id)}
                                >
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                                <span style={{ color: 'hsl(var(--primary))', fontWeight: 800 }}>
                                  {phase.wbsCode}
                                </span>
                                <span>{phase.name}</span>
                                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>
                                  ({phase.completed}/{phase.total} done)
                                </span>
                              </div>
                            </td>

                            {/* Phase Budget Value (Editable) */}
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>
                              {isEditingPhaseBudget ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="number"
                                    autoFocus
                                    value={tempBudgetInput}
                                    onChange={e => setTempBudgetInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSavePhaseBudget(phase.id);
                                      if (e.key === 'Escape') setEditingBudgetColId(null);
                                    }}
                                    style={{
                                      width: 100,
                                      height: 22,
                                      fontSize: 11,
                                      padding: '1px 4px',
                                      borderRadius: 4,
                                      border: '1px solid hsl(var(--primary))',
                                      background: 'hsl(var(--card))',
                                      color: 'hsl(var(--foreground))',
                                      textAlign: 'right',
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    style={{ width: 20, height: 20, padding: 0 }}
                                    onClick={() => handleSavePhaseBudget(phase.id)}
                                  >
                                    <Check size={12} color="#10b981" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingBudgetColId(phase.id);
                                    setTempBudgetInput(String(phase.budget));
                                  }}
                                  style={{ cursor: 'pointer', borderBottom: '1px dashed hsl(var(--border))' }}
                                  title="Click to edit phase contract value"
                                >
                                  {phase.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </td>

                            {/* Share Weight (%) */}
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                              {phase.weightPct.toFixed(2)}%
                            </td>

                            {!isDetailedView ? (
                              <>
                                {/* Simple View: Progress Bar */}
                                <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    <div style={{ width: 70, height: 7, borderRadius: 4, background: 'hsl(var(--border) / 0.4)', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${Math.min(100, phase.physicalActualPct)}%`,
                                        height: '100%',
                                        background: phase.physicalActualPct >= phase.physicalTargetPct ? '#10b981' : '#f59e0b',
                                      }} />
                                    </div>
                                    <span style={{ fontSize: 10.5, fontWeight: 700 }}>
                                      {Math.round(phase.physicalActualPct)}%
                                    </span>
                                  </div>
                                </td>

                                {/* Simple View: Value Done */}
                                <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 600 }}>
                                  {phase.actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* Simple View: Status Badge */}
                                <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    background: phase.phaseStatus.bg,
                                    color: phase.phaseStatus.color,
                                  }}>
                                    {phase.phaseStatus.label}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                {/* Detailed View Columns */}
                                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                  {phase.physicalTargetPct.toFixed(2)}%
                                </td>
                                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                                  {phase.physicalActualPct.toFixed(2)}%
                                </td>
                                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                                  {phase.plannedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '9px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                                  {phase.actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    background: phase.varianceWeightPct >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                    color: phase.varianceWeightPct >= 0 ? '#10b981' : '#ef4444',
                                  }}>
                                    {phase.varianceWeightPct >= 0 ? `+${(phase.physicalActualPct - phase.physicalTargetPct).toFixed(2)}%` : `${(phase.physicalActualPct - phase.physicalTargetPct).toFixed(2)}%`}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>

                          {/* Child Deliverables Rows */}
                          {isExpanded && phase.subtasks.map(st => {
                            const isEditingTaskCost = editingCostCardId === st.task.card.id;
                            const progPct = st.task.card.completed ? 100 : (st.task.card.progress || 0);

                            return (
                              <tr
                                key={st.task.card.id}
                                style={{
                                  borderBottom: '1px solid hsl(var(--border) / 0.2)',
                                  background: 'transparent',
                                }}
                              >
                                <td style={{ padding: '7px 8px 7px 32px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                                      {st.wbsCode}
                                    </span>
                                    <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                                      {st.title}
                                    </span>
                                    {st.task.card.completed && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 3, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                        DONE
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Subtask Cost (Editable) */}
                                <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 11 }}>
                                  {isEditingTaskCost ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <input
                                        type="number"
                                        autoFocus
                                        value={tempTaskCostInput}
                                        onChange={e => setTempTaskCostInput(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleSaveTaskCost(st.task.card.id, phase.id);
                                          if (e.key === 'Escape') setEditingCostCardId(null);
                                        }}
                                        style={{
                                          width: 90,
                                          height: 20,
                                          fontSize: 10.5,
                                          padding: '1px 4px',
                                          borderRadius: 4,
                                          border: '1px solid hsl(var(--primary))',
                                          background: 'hsl(var(--card))',
                                          color: 'hsl(var(--foreground))',
                                          textAlign: 'right',
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        style={{ width: 18, height: 18, padding: 0 }}
                                        onClick={() => handleSaveTaskCost(st.task.card.id, phase.id)}
                                      >
                                        <Check size={11} color="#10b981" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingCostCardId(st.task.card.id);
                                        setTempTaskCostInput(String(st.cost));
                                      }}
                                      style={{
                                        cursor: 'pointer',
                                        borderBottom: '1px dashed hsl(var(--border))',
                                        color: st.isExplicitCost ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                        fontWeight: st.isExplicitCost ? 600 : 400,
                                      }}
                                      title="Click to edit subtask contract value"
                                    >
                                      {st.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </td>

                                {/* Subtask Weight % */}
                                <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                                  {st.weightPct.toFixed(2)}%
                                </td>

                                {!isDetailedView ? (
                                  <>
                                    {/* Simple View: Progress Bar */}
                                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                        <div style={{ width: 60, height: 6, borderRadius: 3, background: 'hsl(var(--border) / 0.3)', overflow: 'hidden' }}>
                                          <div style={{
                                            width: `${progPct}%`,
                                            height: '100%',
                                            background: progPct === 100 ? '#10b981' : '#f59e0b',
                                          }} />
                                        </div>
                                        <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                                          {progPct}%
                                        </span>
                                      </div>
                                    </td>

                                    {/* Simple View: Earned Value */}
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                                      {st.actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>

                                    {/* Simple View: Status */}
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                                      <span style={{
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 3,
                                        background: st.statusBadge.bg,
                                        color: st.statusBadge.color,
                                      }}>
                                        {st.statusBadge.label}
                                      </span>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {/* Detailed View Columns */}
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: '#10b981' }}>
                                      {Math.round(st.plannedFrac * 100)}%
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: '#f59e0b' }}>
                                      {Math.round(st.actualFrac * 100)}%
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: '#10b981' }}>
                                      {st.plannedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5, color: '#f59e0b' }}>
                                      {st.actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10.5 }}>
                                      <span style={{
                                        fontSize: 9.5,
                                        fontWeight: 600,
                                        color: st.varianceWeightPct >= 0 ? '#10b981' : '#ef4444',
                                      }}>
                                        {st.varianceWeightPct >= 0 ? `+${(st.actualFrac * 100 - st.plannedFrac * 100).toFixed(0)}%` : `${(st.actualFrac * 100 - st.plannedFrac * 100).toFixed(0)}%`}
                                      </span>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}

                    {/* Summary Total Row */}
                    <tr style={{ borderTop: '2px solid hsl(var(--border))', background: 'hsl(var(--secondary) / 0.3)', fontWeight: 800 }}>
                      <td style={{ padding: '11px 8px', textTransform: 'uppercase' }}>
                        PROJECT TOTAL / CONTRACT PRICE
                      </td>

                      <td style={{ padding: '11px 8px', textAlign: 'right' }}>
                        {isEditingTotalBudget ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              autoFocus
                              value={tempTotalBudgetInput}
                              onChange={e => setTempTotalBudgetInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveTotalBudget();
                                if (e.key === 'Escape') setIsEditingTotalBudget(false);
                              }}
                              style={{
                                width: 110,
                                height: 22,
                                fontSize: 11,
                                padding: '1px 4px',
                                borderRadius: 4,
                                border: '1px solid hsl(var(--primary))',
                                background: 'hsl(var(--card))',
                                color: 'hsl(var(--foreground))',
                                textAlign: 'right',
                                fontWeight: 800,
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ width: 20, height: 20, padding: 0 }}
                              onClick={handleSaveTotalBudget}
                            >
                              <Check size={12} color="#10b981" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setIsEditingTotalBudget(true);
                              setTempTotalBudgetInput(String(effectiveTotalBudget));
                            }}
                            style={{
                              cursor: 'pointer',
                              borderBottom: '1px dashed hsl(var(--primary))',
                              color: 'hsl(var(--primary))',
                            }}
                            title="Click to edit Total Contract Price"
                          >
                            {effectiveTotalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '11px 8px', textAlign: 'right', color: 'hsl(var(--primary))' }}>100.00%</td>

                      {!isDetailedView ? (
                        <>
                          <td style={{ padding: '11px 8px', textAlign: 'center', color: '#10b981' }}>
                            {overallActualPct}% done
                          </td>
                          <td style={{ padding: '11px 8px', textAlign: 'right', color: '#f59e0b' }}>
                            {overallActualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '11px 8px', textAlign: 'right' }}>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: overallVariancePct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                              color: overallVariancePct >= 0 ? '#10b981' : '#ef4444',
                            }}>
                              {overallVariancePct >= 0 ? 'Ahead of Schedule' : 'Needs Recovery'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '11px 8px', textAlign: 'right', color: '#10b981' }}>{overallPlannedPct.toFixed(2)}%</td>
                          <td style={{ padding: '11px 8px', textAlign: 'right', color: '#f59e0b' }}>{overallActualPct.toFixed(2)}%</td>
                          <td style={{ padding: '11px 8px', textAlign: 'right', color: '#10b981' }}>
                            {overallPlannedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '11px 8px', textAlign: 'right', color: '#f59e0b' }}>
                            {overallActualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '11px 8px', textAlign: 'right' }}>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 3,
                              background: overallVariancePct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                              color: overallVariancePct >= 0 ? '#10b981' : '#ef4444',
                            }}>
                              {overallVariancePct >= 0 ? `+${overallVariancePct}% Ahead` : `${overallVariancePct}% Delay`}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 4: SITE OBSERVATIONS, RISKS & SIGN-OFF
              ════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'notes' || activeTab === 'full') && (
            <>
              {/* Executive Assessment & Site Remarks */}
              <div style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                padding: '16px 20px',
                boxShadow: 'var(--neu-shadow-raised-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp size={15} color="hsl(var(--primary))" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>
                    Executive Observations &amp; Notes
                  </h3>
                </div>
                <textarea
                  className="text-input"
                  rows={3}
                  value={executiveNotes}
                  onChange={e => setExecutiveNotes(e.target.value)}
                  placeholder="Enter site observations, operational bottlenecks, supply shortages, or milestone notes..."
                  style={{ fontSize: 12.5, lineHeight: 1.5, resize: 'vertical' }}
                />
              </div>

              {/* Critical Delayed Items */}
              <div style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                padding: '16px 20px',
                boxShadow: 'var(--neu-shadow-raised-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <AlertTriangle size={16} color="#ef4444" />
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>
                    Delayed Items &amp; Risks ({criticalDelayedTasks.length})
                  </h3>
                </div>

                {criticalDelayedTasks.length === 0 ? (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10b981',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <CheckCircle2 size={16} />
                    <span>No schedule delays detected. All tasks are tracking on or ahead of baseline.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {criticalDelayedTasks.map(t => (
                      <div key={t.card.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        fontSize: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: '#ef4444',
                            color: '#fff',
                          }}>
                            +{t.varianceDays}d DELAY
                          </span>
                          <span style={{ fontWeight: 600 }}>{t.card.title}</span>
                          <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                            ({t.columnName})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                            Target: {formatDueDate(t.targetEndDate.toISOString())}
                          </span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            Projected: {formatDueDate(t.actualOrProjectedEndDate.toISOString())}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Certification & Sign-off Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                padding: '14px 6px 4px',
                fontSize: 11.5,
                color: 'hsl(var(--muted-foreground))',
                borderTop: '1px dashed hsl(var(--border))',
              }}>
                <div>
                  <span style={{ display: 'block', fontWeight: 600 }}>Prepared By:</span>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={e => setPreparedBy(e.target.value)}
                    style={{
                      border: 'none',
                      borderBottom: '1px solid hsl(var(--border))',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'hsl(var(--foreground))',
                      padding: '2px 0',
                      marginTop: 4,
                      minWidth: 160,
                    }}
                  />
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>Reviewed &amp; Certified:</span>
                  <div style={{
                    marginTop: 20,
                    borderTop: '1px solid hsl(var(--border))',
                    width: 170,
                    textAlign: 'center',
                    paddingTop: 4,
                    fontSize: 10.5,
                  }}>
                    Project Lead / Client Representative
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}
