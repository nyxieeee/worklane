import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp, Calendar, CheckCircle2, AlertTriangle, Clock,
  ChevronDown, Layers, Target, Info, Sparkles, Filter, X, FileText,
  DollarSign, Check
} from 'lucide-react';
import RoadmapSituationerModal from './RoadmapSituationerModal';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board, Member, Sprint } from '../types';
import { avatarInitials } from '../utils';
import AvatarBorder from './ui/AvatarBorder';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';

export interface TaskWithScheduleForSCurve {
  card: {
    id: string;
    title: string;
    completed: boolean;
    completedAt?: string | null;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    dueDate?: string | null;
    startDate?: string | null;
    progress?: number;
    cost?: number;
    isMilestone?: boolean;
    assignees?: string[];
  };
  columnId: string;
  columnName: string;
  targetStartDate: Date;
  targetEndDate: Date;
  actualStartDate: Date;
  actualOrProjectedEndDate: Date;
  isProjected: boolean;
  varianceDays: number;
  sprint?: Sprint;
}

interface Props {
  board: Board;
  tasks: TaskWithScheduleForSCurve[];
  onOpenCard?: (cardId: string) => void;
  onClose?: () => void;
}

interface SPoint {
  date: Date;
  dateStr: string;
  label: string;
  isToday: boolean;
  isPastOrToday: boolean;
  plannedPct: number;
  plannedCount: number;
  actualPct: number | null; // null for dates after Today
  actualCount: number | null;
  projectedPct: number | null; // for dates after Today
  projectedCount: number | null;
  milestones: string[];
}

interface TodayMetrics {
  plannedVal: number;
  actualVal: number;
  variance: number;
  spi: number;
  targetFinishDate: Date | null;
  projectedFinishDate: Date | null;
  finishVarianceDays: number;
  completedCount: number;
  totalCount: number;
  // Financial metrics
  plannedCost: number;
  actualCost: number;
  costVariance: number;
}

export default function RoadmapSCurve({ board, tasks, onOpenCard, onClose }: Props) {
  const updateBoardBudget = useWorkStore(s => s.updateBoardBudget);
  const updateColumnBudget = useWorkStore(s => s.updateColumnBudget);
  const showToast = useToastStore(s => s.showToast);

  const [metricMode, setMetricMode] = useState<'percent' | 'cost' | 'count'>('percent');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('all');
  const [hoveredPoint, setHoveredPoint] = useState<SPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showTable, setShowTable] = useState<boolean>(true);
  const [showSituationer, setShowSituationer] = useState<boolean>(false);
  const [isHoveringSvg, setIsHoveringSvg] = useState<boolean>(false);

  const [editingColBudgetId, setEditingColBudgetId] = useState<string | null>(null);
  const [tempColBudgetInput, setTempColBudgetInput] = useState<string>('');

  const svgRef = useRef<SVGSVGElement>(null);
  const currency = board.currency || '₱';

  // Filter tasks if specific phase/sprint is selected
  const filteredTasks = useMemo(() => {
    if (selectedSprintId === 'all') return tasks;
    return tasks.filter(t => t.sprint?.id === selectedSprintId || t.columnId === selectedSprintId);
  }, [tasks, selectedSprintId]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 1. Resolve column budgets consistently across all columns
  const resolvedColumnBudgets = useMemo(() => {
    const map: Record<string, number> = {};
    const cols = board.columns || [];
    const totalCols = Math.max(1, cols.length);
    const initialBase = board.totalBudget && board.totalBudget > 0 ? board.totalBudget : 1000000;
    const defaultSplit = Math.round((initialBase / totalCols) * 100) / 100;

    cols.forEach(col => {
      const colTasks = tasks.filter(t => t.columnId === col.id);
      const hasTaskCosts = colTasks.some(t => t.card.cost !== undefined && t.card.cost > 0);
      if (hasTaskCosts) {
        map[col.id] = colTasks.reduce((acc, t) => acc + (t.card.cost || 0), 0);
      } else if (col.budget !== undefined && col.budget !== null && col.budget > 0) {
        map[col.id] = col.budget;
      } else {
        map[col.id] = defaultSplit;
      }
    });
    return map;
  }, [board.columns, board.totalBudget, tasks]);

  // 2. Compute total contract price / BAC: exact sum of columns or board.totalBudget
  const totalContractPrice = useMemo(() => {
    if (board.totalBudget && board.totalBudget > 0) return board.totalBudget;
    const colSum = Object.values(resolvedColumnBudgets).reduce((acc, b) => acc + (b || 0), 0);
    return colSum > 0 ? colSum : 1000000;
  }, [board.totalBudget, resolvedColumnBudgets]);

  // 3. Compute weight map per column (sum of weights always 100.00%)
  const columnWeights = useMemo(() => {
    const map: Record<string, { budget: number; weightPct: number }> = {};
    const cols = board.columns || [];

    cols.forEach(col => {
      const budget = resolvedColumnBudgets[col.id] || 0;
      const weightPct = totalContractPrice > 0 ? (budget / totalContractPrice) * 100 : (100 / Math.max(1, cols.length));
      map[col.id] = { budget, weightPct };
    });
    return map;
  }, [board.columns, resolvedColumnBudgets, totalContractPrice]);

  // Handle phase budget update directly from table
  const handleSaveColBudget = (colId: string) => {
    const val = parseFloat(tempColBudgetInput);
    if (!isNaN(val) && val >= 0) {
      updateColumnBudget(colId, val);
      showToast('Phase contract value updated', 'success');
    }
    setEditingColBudgetId(null);
  };

  // Format currency helper
  const fmtMoney = (val: number) => {
    return `${currency} ${Math.round(val).toLocaleString()}`;
  };

  // Compute overall timeline bounds across tasks
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const s = new Date(today);
      s.setDate(s.getDate() - 7);
      const e = new Date(today);
      e.setDate(e.getDate() + 21);
      return { minDate: s, maxDate: e, totalDays: 28 };
    }

    let min = Infinity;
    let max = -Infinity;

    filteredTasks.forEach(t => {
      min = Math.min(min, t.targetStartDate.getTime(), t.actualStartDate.getTime());
      max = Math.max(max, t.targetEndDate.getTime(), t.actualOrProjectedEndDate.getTime());
    });

    const s = new Date(min);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - 2);

    const e = new Date(max);
    e.setHours(23, 59, 59, 999);
    e.setDate(e.getDate() + 3);

    const days = Math.max(7, Math.round((e.getTime() - s.getTime()) / 86400000));
    return { minDate: s, maxDate: e, totalDays: days };
  }, [filteredTasks, today]);

  // Generate continuous timeline points (Weighted by Cost / Schedule)
  const curvePoints: SPoint[] = useMemo(() => {
    if (filteredTasks.length === 0) return [];

    const totalDeliverables = filteredTasks.length;

    // Weight calculation: combine task cost or column weight with duration
    const getTaskWeight = (t: TaskWithScheduleForSCurve) => {
      if (t.card.cost && t.card.cost > 0) return t.card.cost;
      const colMeta = columnWeights[t.columnId];
      if (colMeta) {
        const siblingCount = filteredTasks.filter(item => item.columnId === t.columnId).length;
        return colMeta.budget / Math.max(1, siblingCount);
      }
      return 1;
    };

    const totalWeight = filteredTasks.reduce((acc, t) => acc + getTaskWeight(t), 0);

    // Sample daily or sub-weekly points depending on range
    const stepDays = totalDays > 120 ? 3 : totalDays > 60 ? 2 : 1;
    const points: SPoint[] = [];

    const curr = new Date(minDate);
    const todayTime = today.getTime();

    // Map milestones to dates
    const milestonesByDate: Record<string, string[]> = {};
    filteredTasks.forEach(t => {
      if (t.card.isMilestone) {
        const dStr = t.targetEndDate.toISOString().split('T')[0];
        if (!milestonesByDate[dStr]) milestonesByDate[dStr] = [];
        milestonesByDate[dStr].push(t.card.title);
      }
    });

    while (curr.getTime() <= maxDate.getTime() + 86400000) {
      const tTime = curr.getTime();
      const dateStr = curr.toISOString().split('T')[0];
      const isPastOrToday = tTime <= todayTime;
      const isToday = Math.abs(tTime - todayTime) < 43200000;

      // 1. Planned Cumulative Value on date curr
      let plannedWeightAcc = 0;
      let plannedCountAcc = 0;

      filteredTasks.forEach(t => {
        const tStart = t.targetStartDate.getTime();
        const tEnd = t.targetEndDate.getTime();
        const tWeight = getTaskWeight(t);

        if (tTime >= tEnd) {
          plannedWeightAcc += tWeight;
          plannedCountAcc += 1;
        } else if (tTime > tStart) {
          const frac = (tTime - tStart) / (tEnd - tStart);
          plannedWeightAcc += tWeight * frac;
          plannedCountAcc += frac;
        }
      });

      const plannedPct = totalWeight > 0 ? Math.min(100, (plannedWeightAcc / totalWeight) * 100) : 0;
      const plannedCount = Math.min(totalDeliverables, plannedCountAcc);

      // 2. Actual Accomplishment Value (only up to Today)
      let actualPct: number | null = null;
      let actualCount: number | null = null;

      if (isPastOrToday) {
        let actualWeightAcc = 0;
        let actualCountAcc = 0;

        filteredTasks.forEach(t => {
          const actStart = t.actualStartDate.getTime();
          const tWeight = getTaskWeight(t);

          if (t.card.completed) {
            const compTime = t.card.actualEndDate
              ? new Date(t.card.actualEndDate).getTime()
              : t.card.completedAt
              ? new Date(t.card.completedAt).getTime()
              : t.actualOrProjectedEndDate.getTime();

            if (tTime >= compTime) {
              actualWeightAcc += tWeight;
              actualCountAcc += 1;
            } else if (tTime >= actStart) {
              const span = Math.max(1, compTime - actStart);
              const frac = Math.min(1, Math.max(0, (tTime - actStart) / span));
              actualWeightAcc += tWeight * frac;
              actualCountAcc += frac;
            }
          } else {
            const rawProgress = (t.card.progress || 0) / 100;
            if (rawProgress > 0 && tTime >= actStart) {
              const elapsed = Math.max(1, todayTime - actStart);
              const currentT = Math.max(0, tTime - actStart);
              const frac = Math.min(rawProgress, (currentT / elapsed) * rawProgress);
              actualWeightAcc += tWeight * frac;
              actualCountAcc += frac;
            }
          }
        });

        actualPct = totalWeight > 0 ? Math.min(100, (actualWeightAcc / totalWeight) * 100) : 0;
        actualCount = Math.min(totalDeliverables, actualCountAcc);
      }

      // 3. Projected Curve (from Today to Forecast end)
      let projectedPct: number | null = null;
      let projectedCount: number | null = null;

      points.push({
        date: new Date(curr),
        dateStr,
        label: curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isToday,
        isPastOrToday,
        plannedPct: Math.round(plannedPct * 10) / 10,
        plannedCount: Math.round(plannedCount * 10) / 10,
        actualPct: actualPct !== null ? Math.round(actualPct * 10) / 10 : null,
        actualCount: actualCount !== null ? Math.round(actualCount * 10) / 10 : null,
        projectedPct,
        projectedCount,
        milestones: milestonesByDate[dateStr] || []
      });

      curr.setDate(curr.getDate() + stepDays);
    }

    // Connect Today's actual value smoothly to the projected forecast curve
    const todayPt = points.find(p => p.isToday) || points.filter(p => p.isPastOrToday).slice(-1)[0];
    const startActualPct = todayPt?.actualPct ?? 0;
    const startActualCount = todayPt?.actualCount ?? 0;

    const futurePoints = points.filter(p => p.date.getTime() > todayTime);
    const futureLength = futurePoints.length;

    if (futureLength > 0 && todayPt) {
      futurePoints.forEach((p, idx) => {
        const progressT = (idx + 1) / futureLength;
        const eased = progressT < 0.5 ? 2 * progressT * progressT : -1 + (4 - 2 * progressT) * progressT;
        const projPct = startActualPct + (100 - startActualPct) * Math.min(1, Math.max(0, eased));
        const projCount = startActualCount + (totalDeliverables - startActualCount) * Math.min(1, Math.max(0, eased));

        p.projectedPct = Math.round(projPct * 10) / 10;
        p.projectedCount = Math.round(projCount * 10) / 10;
      });
      todayPt.projectedPct = todayPt.actualPct;
      todayPt.projectedCount = todayPt.actualCount;
    }

    return points;
  }, [filteredTasks, minDate, maxDate, totalDays, today, columnWeights]);

  // Today metrics & Earned Value
  const todayMetrics: TodayMetrics = useMemo(() => {
    if (curvePoints.length === 0) {
      return {
        plannedVal: 0,
        actualVal: 0,
        variance: 0,
        spi: 1.0,
        targetFinishDate: null,
        projectedFinishDate: null,
        finishVarianceDays: 0,
        completedCount: 0,
        totalCount: 0,
        plannedCost: 0,
        actualCost: 0,
        costVariance: 0,
      };
    }

    const todayPt = curvePoints.find(p => p.isToday) || curvePoints.filter(p => p.isPastOrToday).slice(-1)[0] || curvePoints[0];
    const plannedPct = todayPt.plannedPct;
    const actualPct = todayPt.actualPct ?? 0;

    const plannedVal = metricMode === 'percent'
      ? plannedPct
      : metricMode === 'cost'
      ? Math.round(totalContractPrice * (plannedPct / 100))
      : todayPt.plannedCount;

    const actualVal = metricMode === 'percent'
      ? actualPct
      : metricMode === 'cost'
      ? Math.round(totalContractPrice * (actualPct / 100))
      : (todayPt.actualCount ?? 0);

    const variance = Math.round((actualVal - plannedVal) * 10) / 10;
    const spi = plannedPct > 0 ? Math.round((actualPct / plannedPct) * 100) / 100 : 1.0;

    const plannedCost = Math.round(totalContractPrice * (plannedPct / 100));
    const actualCost = Math.round(totalContractPrice * (actualPct / 100));
    const costVariance = actualCost - plannedCost;

    let targetFinish: Date | null = null;
    let projFinish: Date | null = null;

    for (const t of filteredTasks) {
      if (!targetFinish || t.targetEndDate.getTime() > targetFinish.getTime()) {
        targetFinish = t.targetEndDate;
      }
      if (!projFinish || t.actualOrProjectedEndDate.getTime() > projFinish.getTime()) {
        projFinish = t.actualOrProjectedEndDate;
      }
    }

    const tFinishDate = targetFinish as Date | null;
    const pFinishDate = projFinish as Date | null;
    const finishVarianceDays = (tFinishDate && pFinishDate)
      ? Math.round((pFinishDate.getTime() - tFinishDate.getTime()) / 86400000)
      : 0;

    const completedCount = filteredTasks.filter(t => t.card.completed).length;

    return {
      plannedVal,
      actualVal,
      variance,
      spi,
      targetFinishDate: targetFinish,
      projectedFinishDate: projFinish,
      finishVarianceDays,
      completedCount,
      totalCount: filteredTasks.length,
      plannedCost,
      actualCost,
      costVariance,
    };
  }, [curvePoints, metricMode, filteredTasks, totalContractPrice]);

  // SVG Chart Dimensions & Scale
  const svgWidth = 850;
  const svgHeight = 280;
  const margin = { top: 25, right: 35, bottom: 40, left: 65 };
  const chartW = svgWidth - margin.left - margin.right;
  const chartH = svgHeight - margin.top - margin.bottom;

  const maxYValue = metricMode === 'percent' ? 100 : metricMode === 'cost' ? totalContractPrice : Math.max(1, filteredTasks.length);

  const getX = (index: number) => {
    if (curvePoints.length <= 1) return margin.left;
    return margin.left + (index / (curvePoints.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxYValue, val));
    return margin.top + chartH - (clamped / maxYValue) * chartH;
  };

  const getValForPoint = (p: SPoint, type: 'planned' | 'actual' | 'projected') => {
    if (type === 'planned') {
      return metricMode === 'percent' ? p.plannedPct : metricMode === 'cost' ? Math.round(totalContractPrice * (p.plannedPct / 100)) : p.plannedCount;
    }
    if (type === 'actual') {
      if (p.actualPct === null) return 0;
      return metricMode === 'percent' ? p.actualPct : metricMode === 'cost' ? Math.round(totalContractPrice * (p.actualPct / 100)) : (p.actualCount ?? 0);
    }
    if (type === 'projected') {
      if (p.projectedPct === null) return 0;
      return metricMode === 'percent' ? p.projectedPct : metricMode === 'cost' ? Math.round(totalContractPrice * (p.projectedPct / 100)) : (p.projectedCount ?? 0);
    }
    return 0;
  };

  // Build SVG Path strings
  const plannedPath = useMemo(() => {
    if (curvePoints.length === 0) return '';
    return curvePoints.map((p, i) => {
      const x = getX(i);
      const y = getY(getValForPoint(p, 'planned'));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [curvePoints, metricMode, chartW, chartH, totalContractPrice]);

  const plannedAreaPath = useMemo(() => {
    if (curvePoints.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(curvePoints.length - 1);
    const bottomY = margin.top + chartH;
    return `${plannedPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [plannedPath, curvePoints, chartW, chartH]);

  const actualPoints = useMemo(() => curvePoints.filter(p => p.actualPct !== null), [curvePoints]);

  const actualPath = useMemo(() => {
    if (actualPoints.length === 0) return '';
    return actualPoints.map((p, i) => {
      const idx = curvePoints.indexOf(p);
      const x = getX(idx);
      const y = getY(getValForPoint(p, 'actual'));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [actualPoints, curvePoints, metricMode, chartW, chartH, totalContractPrice]);

  const actualAreaPath = useMemo(() => {
    if (actualPoints.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(actualPoints.length - 1);
    const bottomY = margin.top + chartH;
    return `${actualPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [actualPath, actualPoints, chartW, chartH]);

  const projectedPoints = useMemo(() => curvePoints.filter(p => p.projectedPct !== null), [curvePoints]);

  const projectedPath = useMemo(() => {
    if (projectedPoints.length === 0) return '';
    const startIndex = curvePoints.findIndex(p => p.projectedPct !== null);
    return projectedPoints.map((p, i) => {
      const idx = startIndex + i;
      const x = getX(idx);
      const y = getY(getValForPoint(p, 'projected'));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [projectedPoints, curvePoints, metricMode, chartW, chartH, totalContractPrice]);

  // Today marker line position
  const todayIndex = curvePoints.findIndex(p => p.isToday);
  const todayX = todayIndex >= 0 ? getX(todayIndex) : null;

  // Milestone points on the planned curve
  const milestoneMarkers = useMemo(() => {
    const list: { x: number; y: number; title: string; date: string }[] = [];
    curvePoints.forEach((p, i) => {
      if (p.milestones && p.milestones.length > 0) {
        const x = getX(i);
        const y = getY(getValForPoint(p, 'planned'));
        p.milestones.forEach(m => list.push({ x, y, title: m, date: p.label }));
      }
    });
    return list;
  }, [curvePoints, metricMode, chartW, chartH, totalContractPrice]);

  // Mouse hover calculation
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || curvePoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgRelX = (mouseX / rect.width) * svgWidth;

    if (svgRelX < margin.left || svgRelX > margin.left + chartW) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const ratio = (svgRelX - margin.left) / chartW;
    const index = Math.round(ratio * (curvePoints.length - 1));
    const clampedIndex = Math.max(0, Math.min(curvePoints.length - 1, index));

    setHoveredPoint(curvePoints[clampedIndex]);
    setHoverX(getX(clampedIndex));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
    setIsHoveringSvg(false);
  };

  return (
    <div className="roadmap-scurve-section" style={{
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 12,
      padding: '16px 18px',
      margin: '8px 0 16px',
      boxShadow: 'var(--neu-shadow-raised-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* ── 1. Header Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        borderBottom: '1px solid hsl(var(--border) / 0.6)',
        paddingBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'hsl(var(--primary) / 0.15)',
            color: 'hsl(var(--primary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
                Project S-Curve &amp; Earned Progress
              </h2>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: todayMetrics.spi >= 1.0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: todayMetrics.spi >= 1.0 ? '#10b981' : '#ef4444',
                textTransform: 'uppercase',
              }}>
                {todayMetrics.variance >= 0 ? `● ${todayMetrics.variance > 0 ? '+' : ''}${todayMetrics.variance}% Ahead of Target` : `● ${Math.abs(todayMetrics.variance)}% Behind Schedule`}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
              Cumulative planned baseline schedule vs. actual work accomplishment &amp; projected delivery.
            </p>
          </div>
        </div>

        {/* Controls: Mode Switcher & Sprint Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Phase / Sprint Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Filter:</span>
            <select
              value={selectedSprintId}
              onChange={e => setSelectedSprintId(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
              }}
            >
              <option value="all">Entire Project (All Phases)</option>
              {(board.sprints && board.sprints.length > 0) ? (
                board.sprints.map(s => (
                  <option key={s.id} value={s.id}>Sprint: {s.name}</option>
                ))
              ) : (
                board.columns?.map(col => (
                  <option key={col.id} value={col.id}>Phase: {col.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Metric Toggle: Progress (%) vs Cost/Money ($) vs Tasks (#) */}
          <div style={{
            display: 'inline-flex',
            background: 'hsl(var(--muted) / 0.5)',
            padding: 2,
            borderRadius: 6,
            border: '1px solid hsl(var(--border))',
          }}>
            <button
              type="button"
              onClick={() => setMetricMode('percent')}
              style={{
                border: 'none',
                background: metricMode === 'percent' ? 'hsl(var(--primary))' : 'transparent',
                color: metricMode === 'percent' ? '#fff' : 'hsl(var(--muted-foreground))',
                padding: '4px 9px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Progress %
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('cost')}
              style={{
                border: 'none',
                background: metricMode === 'cost' ? 'hsl(var(--primary))' : 'transparent',
                color: metricMode === 'cost' ? '#fff' : 'hsl(var(--muted-foreground))',
                padding: '4px 9px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Cost-Weighted Financial S-Curve (Contract Value)"
            >
              Cost ({currency})
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('count')}
              style={{
                border: 'none',
                background: metricMode === 'count' ? 'hsl(var(--primary))' : 'transparent',
                color: metricMode === 'count' ? '#fff' : 'hsl(var(--muted-foreground))',
                padding: '4px 9px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Tasks (#)
            </button>
          </div>

          {/* Situationer Report (SITREP) Modal Button */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              height: 28,
              fontSize: 11,
              padding: '0 9px',
              gap: 5,
              fontWeight: 600,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={() => setShowSituationer(true)}
            title="Generate Cost-Weighted Project Situationer Report (SITREP)"
          >
            <FileText size={12} color="hsl(var(--primary))" />
            <span>Situationer</span>
          </button>

          {/* Toggle breakdown table */}
          <button
            type="button"
            className="icon-btn"
            style={{ width: 28, height: 28, borderRadius: 6 }}
            onClick={() => setShowTable(s => !s)}
            title={showTable ? 'Hide phase breakdown' : 'Show phase breakdown'}
          >
            <Layers size={14} color={showTable ? 'hsl(var(--primary))' : 'currentColor'} />
          </button>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 28, height: 28, borderRadius: 6 }}
              onClick={onClose}
              title="Close S-Curve section"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Top Executive Summary Metrics ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
      }}>
        {/* Metric 1: Planned Baseline */}
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.8)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Target Schedule (Today)</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
              {metricMode === 'percent'
                ? `${todayMetrics.plannedVal}%`
                : metricMode === 'cost'
                ? fmtMoney(todayMetrics.plannedVal)
                : `${todayMetrics.plannedVal} items`}
            </span>
            <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>target schedule</span>
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(16,185,129,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, metricMode === 'percent' ? todayMetrics.plannedVal : metricMode === 'cost' ? (todayMetrics.plannedVal / Math.max(1, totalContractPrice)) * 100 : (todayMetrics.plannedVal / Math.max(1, todayMetrics.totalCount)) * 100)}%`,
              height: '100%',
              background: '#10b981'
            }} />
          </div>
        </div>

        {/* Metric 2: Actual Accomplishment */}
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.8)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Work Accomplished (Today)</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
              {metricMode === 'percent'
                ? `${todayMetrics.actualVal}%`
                : metricMode === 'cost'
                ? fmtMoney(todayMetrics.actualVal)
                : `${todayMetrics.actualVal} items`}
            </span>
            <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>earned value</span>
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(245,158,11,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, metricMode === 'percent' ? todayMetrics.actualVal : metricMode === 'cost' ? (todayMetrics.actualVal / Math.max(1, totalContractPrice)) * 100 : (todayMetrics.actualVal / Math.max(1, todayMetrics.totalCount)) * 100)}%`,
              height: '100%',
              background: '#f59e0b'
            }} />
          </div>
        </div>

        {/* Metric 3: Schedule Variance */}
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.8)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Schedule Health</span>
            {todayMetrics.variance >= 0 ? (
              <CheckCircle2 size={13} color="#10b981" />
            ) : (
              <AlertTriangle size={13} color="#ef4444" />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 20,
              fontWeight: 800,
              color: todayMetrics.variance >= 0 ? '#10b981' : '#ef4444',
              lineHeight: 1
            }}>
              {todayMetrics.variance > 0 ? `+${todayMetrics.variance}` : todayMetrics.variance}
              {metricMode === 'percent' ? '%' : metricMode === 'cost' ? ` ${currency}` : ' items'}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: todayMetrics.variance >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: todayMetrics.variance >= 0 ? '#10b981' : '#ef4444'
            }}>
              {todayMetrics.variance >= 0 ? 'Ahead of Schedule' : 'Behind Schedule'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
            SPI: <strong>{todayMetrics.spi}</strong> ({todayMetrics.spi >= 1 ? 'Efficiency > 100%' : 'Lagging baseline'})
          </span>
        </div>

        {/* Metric 4: Forecast vs Target Delivery */}
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.8)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Delivery Forecast</span>
            <Clock size={13} color="hsl(var(--primary))" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--foreground))', lineHeight: 1 }}>
              {todayMetrics.projectedFinishDate ? todayMetrics.projectedFinishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            </span>
            {todayMetrics.finishVarianceDays !== 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: todayMetrics.finishVarianceDays > 0 ? '#ef4444' : '#10b981'
              }}>
                {todayMetrics.finishVarianceDays > 0 ? `+${todayMetrics.finishVarianceDays}d delay` : `${todayMetrics.finishVarianceDays}d early`}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
            Baseline Target: {todayMetrics.targetFinishDate ? todayMetrics.targetFinishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
        </div>
      </div>

      {/* ── 3. Interactive SVG S-Curve Chart ── */}
      <div style={{
        position: 'relative',
        background: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border) / 0.8)',
        borderRadius: 10,
        padding: '14px 10px 8px',
      }}>
        {/* Chart Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontSize: 11,
          fontWeight: 600,
          color: 'hsl(var(--muted-foreground))',
          marginBottom: 8,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, backgroundColor: '#10b981', borderRadius: 2 }} />
            <span>Target Planned Baseline (S-Curve)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, backgroundColor: '#f59e0b', borderRadius: 2 }} />
            <span>Actual Accomplished (to Today)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 2, borderTop: '2px dashed #f59e0b' }} />
            <span>Projected Forecast</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, borderTop: '2px dashed #ef4444' }} />
            <span>Today ({today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span>
          </div>
          {milestoneMarkers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, backgroundColor: '#8b5cf6', transform: 'rotate(45deg)' }} />
              <span>Milestones (◆)</span>
            </div>
          )}
        </div>

        {/* SVG Canvas */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', minWidth: 600, display: 'block', overflow: 'visible' }}
            onMouseMove={(e) => { setIsHoveringSvg(true); handleMouseMove(e); }}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines & Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const yVal = pct * maxYValue;
              const y = getY(yVal);
              return (
                <g key={idx}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + chartW}
                    y2={y}
                    stroke="hsl(var(--border) / 0.5)"
                    strokeDasharray={idx === 0 || idx === 4 ? undefined : '3,3'}
                    strokeWidth="1"
                  />
                  <text
                    x={margin.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {metricMode === 'percent'
                      ? `${Math.round(pct * 100)}%`
                      : metricMode === 'cost'
                      ? `${currency}${Math.round(yVal / 1000)}k`
                      : Math.round(yVal)}
                  </text>
                </g>
              );
            })}

            {/* X-axis date labels */}
            {curvePoints.filter((_, idx) => {
              const count = curvePoints.length;
              const step = Math.max(1, Math.floor(count / 7));
              return idx % step === 0 || idx === count - 1;
            }).map((p, idx) => {
              const x = getX(curvePoints.indexOf(p));
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={margin.top + chartH}
                    x2={x}
                    y2={margin.top + chartH + 4}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={margin.top + chartH + 16}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}

            {/* Planned Baseline Area & Path */}
            {plannedAreaPath && <path d={plannedAreaPath} fill="url(#plannedGradient)" />}
            {plannedPath && (
              <path
                d={plannedPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Actual Accomplishment Area & Path */}
            {actualAreaPath && <path d={actualAreaPath} fill="url(#actualGradient)" />}
            {actualPath && (
              <path
                d={actualPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Projected Forecast Curve */}
            {projectedPath && (
              <path
                d={projectedPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4,4"
                strokeLinecap="round"
              />
            )}

            {/* Today Line */}
            {todayX !== null && (
              <g>
                <line
                  x1={todayX}
                  y1={margin.top}
                  x2={todayX}
                  y2={margin.top + chartH}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                <rect
                  x={todayX - 18}
                  y={margin.top - 12}
                  width="36"
                  height="14"
                  rx="3"
                  fill="#ef4444"
                />
                <text
                  x={todayX}
                  y={margin.top - 2}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="800"
                >
                  TODAY
                </text>
              </g>
            )}

            {/* Milestone Markers */}
            {milestoneMarkers.map((m, idx) => (
              <g key={idx}>
                <polygon
                  points={`${m.x},${m.y - 5} ${m.x + 5},${m.y} ${m.x},${m.y + 5} ${m.x - 5},${m.y}`}
                  fill="#8b5cf6"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              </g>
            ))}

            {/* Hover Guide line */}
            {isHoveringSvg && hoverX !== null && (
              <line
                x1={hoverX}
                y1={margin.top}
                x2={hoverX}
                y2={margin.top + chartH}
                stroke="hsl(var(--foreground))"
                strokeWidth="1"
                strokeOpacity="0.4"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>

        {/* Hover Tooltip Card */}
        <AnimatePresence>
          {hoveredPoint && hoverX !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'absolute',
                top: 38,
                left: Math.max(margin.left, Math.min(svgWidth - 180, hoverX - 85)),
                pointerEvents: 'none',
                zIndex: 30,
              }}
            >
              <div style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: 'var(--neu-shadow-raised)',
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 160,
              }}>
                <div style={{ fontWeight: 700, color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: 3 }}>
                  {hoveredPoint.label} {hoveredPoint.isToday && <span style={{ color: '#ef4444', fontSize: 9 }}>(Today)</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Planned Baseline:
                  </span>
                  <strong>
                    {metricMode === 'percent'
                      ? `${hoveredPoint.plannedPct}%`
                      : metricMode === 'cost'
                      ? fmtMoney(Math.round(totalContractPrice * (hoveredPoint.plannedPct / 100)))
                      : `${hoveredPoint.plannedCount} items`}
                  </strong>
                </div>

                {hoveredPoint.actualPct !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                      Actual Accomplished:
                    </span>
                    <strong>
                      {metricMode === 'percent'
                        ? `${hoveredPoint.actualPct}%`
                        : metricMode === 'cost'
                        ? fmtMoney(Math.round(totalContractPrice * (hoveredPoint.actualPct / 100)))
                        : `${hoveredPoint.actualCount} items`}
                    </strong>
                  </div>
                ) : hoveredPoint.projectedPct !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px dashed #f59e0b' }} />
                      Projected Forecast:
                    </span>
                    <strong>
                      {metricMode === 'percent'
                        ? `${hoveredPoint.projectedPct}%`
                        : metricMode === 'cost'
                        ? fmtMoney(Math.round(totalContractPrice * (hoveredPoint.projectedPct / 100)))
                        : `${hoveredPoint.projectedCount} items`}
                    </strong>
                  </div>
                ) : null}

                {hoveredPoint.actualPct !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Variance:</span>
                    <strong style={{ color: hoveredPoint.actualPct >= hoveredPoint.plannedPct ? '#10b981' : '#ef4444' }}>
                      {hoveredPoint.actualPct >= hoveredPoint.plannedPct ? '+' : ''}
                      {metricMode === 'percent'
                        ? `${Math.round((hoveredPoint.actualPct - hoveredPoint.plannedPct) * 10) / 10}%`
                        : metricMode === 'cost'
                        ? fmtMoney(Math.round(totalContractPrice * ((hoveredPoint.actualPct - hoveredPoint.plannedPct) / 100)))
                        : `${Math.round(((hoveredPoint.actualCount ?? 0) - hoveredPoint.plannedCount) * 10) / 10} items`}
                    </strong>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 4. Phase Breakdown & Contract Value Weight Table ── */}
      {showTable && (
        <div style={{
          marginTop: 2,
          border: '1px solid hsl(var(--border) / 0.6)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'hsl(var(--card))',
        }}>
          <div style={{
            padding: '8px 12px',
            background: 'hsl(var(--muted) / 0.3)',
            borderBottom: '1px solid hsl(var(--border) / 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              Phase &amp; Scope Schedule of Values (SOV)
            </span>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              Total Contract Price: <strong>{fmtMoney(totalContractPrice)}</strong> (100.00% Weight)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border) / 0.6)', color: 'hsl(var(--muted-foreground))', textAlign: 'left' }}>
                  <th style={{ padding: '7px 12px', fontWeight: 600 }}>Phase / Group</th>
                  <th style={{ padding: '7px 10px', fontWeight: 600, textAlign: 'right' }}>Contract Value ({currency})</th>
                  <th style={{ padding: '7px 10px', fontWeight: 600, textAlign: 'right' }}>Weight (%)</th>
                  <th style={{ padding: '7px 10px', fontWeight: 600 }}>Deliverables</th>
                  <th style={{ padding: '7px 10px', fontWeight: 600, minWidth: 160 }}>Target vs Actual Earned</th>
                  <th style={{ padding: '7px 12px', fontWeight: 600, textAlign: 'right' }}>Variance Status</th>
                </tr>
              </thead>
              <tbody>
                {(board.columns || []).map(col => {
                  const colTasks = filteredTasks.filter(t => t.columnId === col.id);
                  if (colTasks.length === 0) return null;

                  const doneCount = colTasks.filter(t => t.card.completed).length;
                  const total = colTasks.length;
                  const colProgress = Math.round((doneCount / total) * 100);

                  const meta = columnWeights[col.id] || { budget: 0, weightPct: 0 };
                  const isEditingThisCol = editingColBudgetId === col.id;

                  // Compute average planned progress
                  let plannedAcc = 0;
                  colTasks.forEach(t => {
                    const tStart = t.targetStartDate.getTime();
                    const tEnd = t.targetEndDate.getTime();
                    if (today.getTime() >= tEnd) plannedAcc += 100;
                    else if (today.getTime() > tStart) {
                      plannedAcc += ((today.getTime() - tStart) / (tEnd - tStart)) * 100;
                    }
                  });
                  const avgPlanned = Math.round(plannedAcc / total);
                  const varDiff = colProgress - avgPlanned;

                  return (
                    <tr key={col.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        {col.name}
                      </td>

                      {/* Editable Contract Budget */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {isEditingThisCol ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              autoFocus
                              value={tempColBudgetInput}
                              onChange={e => setTempColBudgetInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveColBudget(col.id);
                                if (e.key === 'Escape') setEditingColBudgetId(null);
                              }}
                              style={{
                                width: 80,
                                height: 20,
                                fontSize: 11,
                                padding: '1px 3px',
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
                              onClick={() => handleSaveColBudget(col.id)}
                            >
                              <Check size={11} color="#10b981" />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingColBudgetId(col.id);
                              setTempColBudgetInput(String(meta.budget));
                            }}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed hsl(var(--border))' }}
                            title="Click to edit phase contract budget"
                          >
                            {fmtMoney(meta.budget)}
                          </span>
                        )}
                      </td>

                      {/* Weight % */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                        {meta.weightPct.toFixed(1)}%
                      </td>

                      {/* Deliverables count */}
                      <td style={{ padding: '8px 10px', color: 'hsl(var(--muted-foreground))' }}>
                        {doneCount} / {total} done ({colProgress}%)
                      </td>

                      {/* Target vs Actual Progress */}
                      <td style={{ padding: '8px 10px', minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'hsl(var(--muted))', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                              position: 'absolute',
                              left: `${avgPlanned}%`,
                              top: 0,
                              bottom: 0,
                              width: 2,
                              background: '#10b981',
                              zIndex: 2,
                            }} title={`Planned: ${avgPlanned}%`} />
                            <div style={{
                              width: `${colProgress}%`,
                              height: '100%',
                              background: colProgress >= avgPlanned ? '#10b981' : '#f59e0b',
                            }} />
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--foreground))', minWidth: 50 }}>
                            {colProgress}% <span style={{ color: '#10b981', fontSize: 9.5 }}>({avgPlanned}% pl.)</span>
                          </span>
                        </div>
                      </td>

                      {/* Variance Status */}
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: varDiff >= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                          color: varDiff >= 0 ? '#10b981' : '#ef4444',
                        }}>
                          {varDiff > 0 ? `+${varDiff}% Ahead` : varDiff === 0 ? 'On Track' : `${varDiff}% Lagging`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Situationer Report Modal */}
      {showSituationer && (
        <RoadmapSituationerModal
          board={board}
          tasks={tasks}
          onClose={() => setShowSituationer(false)}
        />
      )}
    </div>
  );
}
