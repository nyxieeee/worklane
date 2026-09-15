import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight,
  CheckSquare, Square,
  ChevronDown, ChevronUp, Layers, Plus,
  X, Milestone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board, Card as CardType, Member, Sprint } from '../types';
import { LABELS } from '../types';
import { formatDueDate, avatarInitials, uid, deriveCardProgress } from '../utils';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';
import AvatarBorder from './ui/AvatarBorder';
import NeumorphicDatePicker from './ui/NeumorphicDatePicker';
import { NeumorphicSelect, SelectOption } from './ui/NeumorphicSelect';

interface Props {
  board: Board;
  onOpenCard: (cardId: string) => void;
  isObserver?: boolean;
}

type TimeScale = 'days' | 'weeks' | 'months';
type GroupByMode = 'sprint' | 'column' | 'assignee' | 'label';
type StatusFilter = 'all' | 'active' | 'completed' | 'overdue';

export function formatShortDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateForExport(val: string | Date | null | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('T')) {
      const datePart = trimmed.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return trimmed;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

interface TaskWithSchedule {
  card: CardType;
  columnId: string;
  columnName: string;
  columnColor?: string;
  // Target Baseline Schedule
  targetStartDate: Date;
  targetEndDate: Date;
  // Actual / Projected Schedule
  actualStartDate: Date;
  actualOrProjectedEndDate: Date;
  isProjected: boolean;
  varianceDays: number;
  startVarianceDays: number;
  /** Total suspended (paused) calendar days already factored into variance */
  suspendedDays: number;
  /** Whether work was confirmed today (via check-in or activity) */
  isWorkedToday: boolean;
  /** Number of confirmed worked days */
  workedDaysCount: number;
  /** Most recent date work occurred */
  lastWorkedDate: Date | null;
  startDate: Date;
  endDate: Date;
  hasExplicitDates: boolean;
  sprint?: Sprint;
}


interface GroupSection {
  id: string;
  title: string;
  subtitle?: string;
  color?: string;
  badge?: string;
  sprint?: Sprint;
  tasks: TaskWithSchedule[];
}

export { deriveCardProgress };

export function isMilestoneTask(card: CardType): boolean {
  if (card.isMilestone) return true;
  if (card.priority === 'urgent') return true;
  if ((card.labels || []).some(l => l.toLowerCase() === 'urgent' || l.toLowerCase() === 'planning')) return true;
  return false;
}

/**
 * Returns the total number of suspended calendar days that fall between
 * a task's actual start date and the given reference date (usually today).
 * Days in suspension ranges are excluded from elapsed-time variance calc.
 */
export function computeSuspendedDays(card: CardType, from: Date, upTo: Date): number {
  const suspensions = card.workSuspensions;
  if (!suspensions || suspensions.length === 0) return 0;
  let total = 0;
  for (const s of suspensions) {
    const sFrom = new Date(s.from);
    sFrom.setHours(0, 0, 0, 0);
    const sTo = new Date(s.to);
    sTo.setHours(23, 59, 59, 999);
    // Clamp to [from, upTo] window
    const overlapStart = Math.max(from.getTime(), sFrom.getTime());
    const overlapEnd = Math.min(upTo.getTime(), sTo.getTime());
    if (overlapEnd > overlapStart) {
      total += Math.round((overlapEnd - overlapStart) / 86400000);
    }
  }
  return total;
}

export interface CardWorkStatus {
  isWorkedToday: boolean;
  workedDaysCount: number;
  lastWorkedDate: Date | null;
  /** Days between actualStartDate and today that had NO work or activity */
  automatedSuspendedDays: number;
  workedDatesSet: Set<string>;
}

/**
 * Evaluates whether a card has work registered (via Option A: manual check-in or
 * Option B: card activity detection like comments, attachments, or updates).
 * Days with zero work or activity are automatically treated as paused/suspended.
 */
export function getCardWorkStatus(card: CardType, actualStartDate: Date, today: Date): CardWorkStatus {
  const workedSet = new Set<string>();

  // 1. Option A: Explicitly logged worked days
  if (card.workedDays && card.workedDays.length > 0) {
    for (const d of card.workedDays) {
      workedSet.add(d);
    }
  }

  // 2. Option B: Activity Detection
  if (card.comments && card.comments.length > 0) {
    for (const c of card.comments) {
      if (c.createdAt) workedSet.add(c.createdAt.slice(0, 10));
    }
  }
  if (card.attachments && card.attachments.length > 0) {
    for (const a of card.attachments) {
      if (a.addedAt) workedSet.add(a.addedAt.slice(0, 10));
    }
  }
  if (card.completedAt) {
    workedSet.add(card.completedAt.slice(0, 10));
  }
  if (card.createdAt) {
    const createdStr = card.createdAt.slice(0, 10);
    const createdDate = new Date(createdStr);
    createdDate.setHours(0, 0, 0, 0);
    if (createdDate.getTime() >= actualStartDate.getTime()) {
      workedSet.add(createdStr);
    }
  }

  // Remove dates that fall within explicit manual workSuspensions
  if (card.workSuspensions && card.workSuspensions.length > 0) {
    for (const s of card.workSuspensions) {
      const cur = new Date(s.from);
      const toDate = new Date(s.to);
      cur.setHours(0, 0, 0, 0);
      toDate.setHours(0, 0, 0, 0);
      while (cur <= toDate) {
        workedSet.delete(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const todayStr = today.toISOString().slice(0, 10);
  const isWorkedToday = workedSet.has(todayStr);

  // Find latest worked date <= today
  let lastWorkedDate: Date | null = null;
  const sortedDates = Array.from(workedSet)
    .filter(d => d <= todayStr)
    .sort();

  if (sortedDates.length > 0) {
    const lastStr = sortedDates[sortedDates.length - 1];
    const d = new Date(lastStr);
    d.setHours(23, 59, 59, 999);
    lastWorkedDate = d;
  }

  // Total calendar days between actualStartDate and today that had NO work or activity
  let automatedSuspendedDays = 0;
  const startDay = new Date(actualStartDate);
  startDay.setHours(0, 0, 0, 0);
  const todayDay = new Date(today);
  todayDay.setHours(0, 0, 0, 0);

  if (todayDay.getTime() >= startDay.getTime() && !card.completed) {
    const cursor = new Date(startDay);
    while (cursor <= todayDay) {
      const dStr = cursor.toISOString().slice(0, 10);
      if (!workedSet.has(dStr)) {
        automatedSuspendedDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    isWorkedToday,
    workedDaysCount: sortedDates.length,
    lastWorkedDate,
    automatedSuspendedDays,
    workedDatesSet: workedSet,
  };
}

export default function RoadmapView({ board, onOpenCard, isObserver }: Props) {
  const updateCard = useWorkStore(s => s.updateCard);
  const addCard = useWorkStore(s => s.addCard);
  const createSprint = useWorkStore(s => s.createSprint);
  const updateSprint = useWorkStore(s => s.updateSprint);
  const deleteSprint = useWorkStore(s => s.deleteSprint);
  const startSprint = useWorkStore(s => s.startSprint);
  const completeSprint = useWorkStore(s => s.completeSprint);
  const showToast = useToastStore(s => s.showToast);
  const currentUser = useAuthStore(s => s.user);

  // View state: default to 'column' (By Stage / Phase) which maps directly to physical project stages
  const [scale, setScale] = useState<TimeScale>('weeks');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [groupBy, setGroupBy] = useState<GroupByMode>('column');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showProjectionComparison, setShowProjectionComparison] = useState(false);
  const [mobileTab, setMobileTab] = useState<'deliverables' | 'timeline'>('deliverables');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Group By options
  const groupByOptions: SelectOption<GroupByMode>[] = useMemo(() => [
    { value: 'column', label: 'By Stage / Phase', icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'sprint', label: 'By Project Phase', icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'assignee', label: 'By Assignee / Lead', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'label', label: 'By Workstream', icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} /> },
  ], []);

  // Status Filter options
  const statusFilterOptions: SelectOption<StatusFilter>[] = useMemo(() => [
    { value: 'all', label: 'All Status', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--muted-foreground))', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'active', label: 'Active Only', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'completed', label: 'Completed', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} /> },
    { value: 'overdue', label: 'Overdue', icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} /> },
  ], []);

  // Modals / Dialogs
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStartDate, setSprintStartDate] = useState('');
  const [sprintEndDate, setSprintEndDate] = useState('');
  const [sprintColor, setSprintColor] = useState('#6366f1');

  // Quick Task Add dialog
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskColumnId, setQuickTaskColumnId] = useState(board.columns?.[0]?.id || '');
  const [quickTaskSprintId, setQuickTaskSprintId] = useState('');
  const [quickTaskStartDate, setQuickTaskStartDate] = useState('');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState('');
  const [quickTaskActualStartDate, setQuickTaskActualStartDate] = useState('');
  const [quickTaskActualEndDate, setQuickTaskActualEndDate] = useState('');
  const [quickTaskAssignee, setQuickTaskAssignee] = useState('');
  const [quickTaskIsMilestone, setQuickTaskIsMilestone] = useState(false);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Sync scrolling between left task list and right timeline canvas
  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (taskListRef.current) {
      taskListRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Today marker calculation
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Compute view date range
  const { startDate: viewStart, endDate: viewEnd, intervals } = useMemo(() => {
    const base = new Date(currentDate);
    base.setHours(0, 0, 0, 0);

    if (scale === 'days') {
      // 30-day window centered 7 days prior
      const start = new Date(base);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 29);

      const days: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        days.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return { startDate: start, endDate: end, intervals: days };
    } else if (scale === 'weeks') {
      // 14 weeks window (standard 3-month sprint planning view)
      const start = new Date(base);
      start.setDate(start.getDate() - start.getDay() - 14);
      const end = new Date(start);
      end.setDate(end.getDate() + (14 * 7) - 1);

      const weeks: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        weeks.push(new Date(curr));
        curr.setDate(curr.getDate() + 7);
      }
      return { startDate: start, endDate: end, intervals: weeks };
    } else {
      // 8 months window (executive business roadmap view)
      const start = new Date(base.getFullYear(), base.getMonth() - 2, 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 6, 0);

      const months: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
      }
      return { startDate: start, endDate: end, intervals: months };
    }
  }, [currentDate, scale]);

  const totalViewMs = Math.max(1, viewEnd.getTime() - viewStart.getTime());

  // Flatten all cards with calculated schedule
  const allTasks = useMemo(() => {
    const list: TaskWithSchedule[] = [];
    const colPalette = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899'];

    board.columns?.forEach((col, colIdx) => {
      const colColor = colPalette[colIdx % colPalette.length];
      col.cards?.forEach(card => {
        const hasDueDate = Boolean(card.dueDate);
        const hasStartDate = Boolean(card.startDate);
        const sprint = board.sprints?.find(s => s.id === card.sprintId);

        // 1. Target End Date (Baseline Target Date)
        let targetEnd: Date;
        if (card.dueDate) {
          targetEnd = new Date(card.dueDate);
        } else if (sprint?.endDate) {
          targetEnd = new Date(sprint.endDate);
        } else if (card.createdAt) {
          targetEnd = new Date(card.createdAt);
          targetEnd.setDate(targetEnd.getDate() + 4);
        } else {
          targetEnd = new Date();
          targetEnd.setDate(targetEnd.getDate() + 4);
        }
        targetEnd.setHours(23, 59, 59, 999);

        // 2. Target Start Date (Baseline Target Start)
        let targetStart: Date;
        if (card.startDate) {
          targetStart = new Date(card.startDate);
        } else if (sprint?.startDate) {
          targetStart = new Date(sprint.startDate);
        } else if (card.dueDate && card.createdAt) {
          const created = new Date(card.createdAt);
          const daysDiff = (targetEnd.getTime() - created.getTime()) / (1000 * 3600 * 24);
          if (daysDiff > 21) {
            targetStart = new Date(targetEnd.getTime() - 14 * 86400000);
          } else {
            targetStart = created;
          }
        } else if (card.createdAt) {
          targetStart = new Date(card.createdAt);
        } else {
          targetStart = new Date(targetEnd.getTime() - 4 * 86400000);
        }
        targetStart.setHours(0, 0, 0, 0);

        if (targetStart > targetEnd) {
          targetStart = new Date(targetEnd.getTime() - 1 * 86400000);
        }

        // 3. Actual Start Date
        let actStart: Date;
        if (card.actualStartDate) {
          actStart = new Date(card.actualStartDate);
        } else {
          actStart = new Date(targetStart);
        }
        actStart.setHours(0, 0, 0, 0);

        // 4. Actual / Projected End Date
        let actOrProjEnd: Date;
        let isProjected = false;
        const progressPct = deriveCardProgress(card, col.name);

        // Evaluate work status (Option A: manual check-in + Option B: activity detection)
        const workStatus = getCardWorkStatus(card, actStart, today);
        const manualSuspendedDays = computeSuspendedDays(card, actStart, today);
        // Total suspended calendar days combines manual pauses and automated inactive days
        const suspendedDays = Math.max(manualSuspendedDays, workStatus.automatedSuspendedDays);

        if (card.completed) {
          if (card.actualEndDate) {
            actOrProjEnd = new Date(card.actualEndDate);
          } else if (card.completedAt) {
            actOrProjEnd = new Date(card.completedAt);
          } else {
            actOrProjEnd = new Date(targetEnd);
          }
          isProjected = false;
        } else {
          if (card.actualEndDate) {
            actOrProjEnd = new Date(card.actualEndDate);
            isProjected = false;
          } else {
            isProjected = true;
            const plannedDays = Math.max(1, Math.round((targetEnd.getTime() - targetStart.getTime()) / 86400000));
            if (today.getTime() > targetEnd.getTime()) {
              // Task past target date: projected date extends from today based on remaining progress.
              // Subtract suspended days so paused periods don't inflate the delay.
              const remainingPct = Math.max(0.1, (100 - progressPct) / 100);
              const extraDays = Math.max(1, Math.ceil(plannedDays * remainingPct) - suspendedDays);
              actOrProjEnd = new Date(today.getTime() + extraDays * 86400000);
            } else if (today.getTime() > targetStart.getTime()) {
              // Task in flight: project slippage if pace is lagging.
              // Use net elapsed days (calendar days minus suspended days) for pace calculation.
              const calendarElapsed = Math.max(1, Math.round((today.getTime() - targetStart.getTime()) / 86400000));
              const netElapsedDays = Math.max(1, calendarElapsed - suspendedDays);
              const expectedPct = Math.min(100, Math.round((netElapsedDays / plannedDays) * 100));
              if (progressPct < expectedPct - 15) {
                const pace = Math.max(0.05, progressPct / netElapsedDays);
                const totalProjDays = Math.ceil(100 / pace);
                // Add suspended days back so the projected end date falls on a real calendar day
                const slip = Math.max(1, (totalProjDays - plannedDays) + suspendedDays);
                actOrProjEnd = new Date(targetEnd.getTime() + slip * 86400000);
              } else {
                // On track: project end == target end + any suspension time that still lies ahead
                const futureSuspended = computeSuspendedDays(card, today, targetEnd);
                actOrProjEnd = new Date(targetEnd.getTime() + futureSuspended * 86400000);
              }
            } else {
              actOrProjEnd = new Date(targetEnd);
            }
          }
        }
        actOrProjEnd.setHours(23, 59, 59, 999);

        // 5. Variance (in days) = Actual/Projected End − Target End
        //    Suspended days are already factored into actOrProjEnd, so the
        //    variance naturally reflects only real work-time delay.
        const varianceDays = Math.round((actOrProjEnd.getTime() - targetEnd.getTime()) / 86400000);
        const startVarianceDays = card.actualStartDate
          ? Math.round((actStart.getTime() - targetStart.getTime()) / 86400000)
          : 0;

        list.push({
          card,
          columnId: col.id,
          columnName: col.name,
          columnColor: colColor,
          targetStartDate: targetStart,
          targetEndDate: targetEnd,
          actualStartDate: actStart,
          actualOrProjectedEndDate: actOrProjEnd,
          isProjected,
          varianceDays,
          startVarianceDays,
          suspendedDays,
          isWorkedToday: workStatus.isWorkedToday,
          workedDaysCount: workStatus.workedDaysCount,
          lastWorkedDate: workStatus.lastWorkedDate,
          startDate: targetStart,
          endDate: actOrProjEnd,
          hasExplicitDates: hasDueDate || hasStartDate,
          sprint,
        });
      });
    });

    return list;
  }, [board]);

  // Filter tasks based on Search query & Status Filter
  const filteredTasks = useMemo(() => {
    return allTasks.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.card.title.toLowerCase().includes(q);
        const matchCol = item.columnName.toLowerCase().includes(q);
        const matchSprint = item.sprint?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchCol && !matchSprint) return false;
      }

      // Status
      if (statusFilter === 'active' && item.card.completed) return false;
      if (statusFilter === 'completed' && !item.card.completed) return false;
      if (statusFilter === 'overdue') {
        if (item.card.completed || item.endDate >= today) return false;
      }

      return true;
    });
  }, [allTasks, searchQuery, statusFilter, today]);

  // Include all existing tasks on the Gantt timeline
  const { scheduledTasks, unscheduledTasks } = useMemo<{
    scheduledTasks: TaskWithSchedule[];
    unscheduledTasks: TaskWithSchedule[];
  }>(() => {
    return { scheduledTasks: filteredTasks, unscheduledTasks: [] };
  }, [filteredTasks]);

  // Group scheduled tasks based on chosen GroupByMode
  const groupedSections: GroupSection[] = useMemo(() => {
    if (groupBy === 'sprint') {
      const sections: GroupSection[] = [];
      const sprints = board.sprints || [];

      if (sprints.length > 0) {
        // Sprints in order: Active first, then Planned, then Completed
        const sortedSprints = [...sprints].sort((a, b) => {
          const rank = (st: string) => st === 'active' ? 0 : st === 'planned' ? 1 : 2;
          return rank(a.status) - rank(b.status);
        });

        sortedSprints.forEach(sp => {
          const tasks = scheduledTasks.filter(t => t.card.sprintId === sp.id);
          sections.push({
            id: sp.id,
            title: sp.name,
            subtitle: sp.goal || `${formatDueDate(sp.startDate)} – ${formatDueDate(sp.endDate)}`,
            color: sp.color || '#6366f1',
            badge: sp.status === 'active' ? 'CURRENT PHASE' : sp.status.toUpperCase(),
            sprint: sp,
            tasks,
          });
        });

        // Unassigned Phase / Ongoing Work Packages
        const backlogTasks = scheduledTasks.filter(t => !t.card.sprintId);
        if (backlogTasks.length > 0) {
          sections.push({
            id: 'backlog',
            title: 'Unassigned Phase / Ongoing Deliverables',
            subtitle: 'Tasks scheduled on timeline across general work packages',
            color: '#64748b',
            badge: 'GENERAL',
            tasks: backlogTasks,
          });
        }
      } else {
        // When no explicit phases have been created yet, partition using existing column stages
        const activeTasks = scheduledTasks.filter(t => {
          const c = t.columnName.toLowerCase();
          return !t.card.completed && (c.includes('in progress') || c.includes('active') || c.includes('doing') || c.includes('install') || c.includes('construction') || t.card.priority === 'urgent');
        });
        const upcomingTasks = scheduledTasks.filter(t => {
          const c = t.columnName.toLowerCase();
          return !t.card.completed && !activeTasks.includes(t) && !c.includes('done') && !c.includes('handover');
        });
        const completedTasks = scheduledTasks.filter(t => t.card.completed || t.columnName.toLowerCase().includes('done') || t.columnName.toLowerCase().includes('handover'));

        if (activeTasks.length > 0 || (upcomingTasks.length === 0 && completedTasks.length === 0)) {
          sections.push({
            id: 'current-sprint',
            title: 'Phase 1: Active Execution',
            subtitle: 'Active deliverables and installations in current work cycle',
            color: '#3b82f6',
            badge: 'ACTIVE PHASE',
            tasks: activeTasks,
          });
        }

        if (upcomingTasks.length > 0) {
          sections.push({
            id: 'upcoming-sprint',
            title: 'Phase 2: Upcoming Work Packages',
            subtitle: 'Queued deliverables and scheduled milestones for upcoming phase',
            color: '#8b5cf6',
            badge: 'UPCOMING PHASE',
            tasks: upcomingTasks,
          });
        }

        if (completedTasks.length > 0) {
          sections.push({
            id: 'completed-sprint',
            title: 'Completed Phases & Deliverables',
            subtitle: 'Completed project milestones, closeouts, and accepted handovers',
            color: '#10b981',
            badge: 'COMPLETED',
            tasks: completedTasks,
          });
        }
      }

      return sections;
    }

    if (groupBy === 'column') {
      return (board.columns || []).map((col, idx) => {
        const colPalette = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899'];
        return {
          id: col.id,
          title: col.name,
          color: colPalette[idx % colPalette.length],
          tasks: scheduledTasks.filter(t => t.columnId === col.id),
        };
      });
    }

    if (groupBy === 'assignee') {
      const sections: GroupSection[] = [];
      const members = board.members || [];

      members.forEach(m => {
        const tasks = scheduledTasks.filter(t => (t.card.assignees || []).includes(m.id));
        if (tasks.length > 0) {
          sections.push({
            id: m.id,
            title: m.name,
            subtitle: m.email,
            color: m.color || '#6366f1',
            badge: `${tasks.length} tasks`,
            tasks,
          });
        }
      });

      const unassigned = scheduledTasks.filter(t => (!t.card.assignees || t.card.assignees.length === 0));
      if (unassigned.length > 0) {
        sections.push({
          id: 'unassigned',
          title: 'Unassigned Tasks',
          subtitle: 'Available for team pickup',
          color: '#94a3b8',
          badge: `${unassigned.length} tasks`,
          tasks: unassigned,
        });
      }

      return sections;
    }

    // groupBy === 'label'
    const sections: GroupSection[] = [];
    LABELS.forEach(lbl => {
      const tasks = scheduledTasks.filter(t => (t.card.labels || []).includes(lbl.id));
      if (tasks.length > 0) {
        sections.push({
          id: lbl.id,
          title: lbl.name,
          color: lbl.color,
          badge: `${tasks.length} tasks`,
          tasks,
        });
      }
    });

    const otherTasks = scheduledTasks.filter(t => (!t.card.labels || t.card.labels.length === 0));
    if (otherTasks.length > 0) {
      sections.push({
        id: 'no-label',
        title: 'General / No Workstream Label',
        color: '#64748b',
        tasks: otherTasks,
      });
    }

    return sections;
  }, [groupBy, board, scheduledTasks]);

  // Overall Roadmap Metrics
  const totalCount = allTasks.length;
  const completedCount = allTasks.filter(t => t.card.completed).length;
  const overdueCount = allTasks.filter(t => !t.card.completed && t.endDate < today).length;
  const milestonesCount = allTasks.filter(t => t.card.isMilestone).length;
  const activeSprint = board.sprints?.find(s => s.status === 'active');
  const activeSprintTasks = activeSprint ? allTasks.filter(t => t.card.sprintId === activeSprint.id) : [];
  const activeSprintCompleted = activeSprintTasks.filter(t => t.card.completed).length;

  // Toggle Collapse
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Jump to Today
  const handleJumpToday = () => {
    setCurrentDate(new Date());
  };

  // Escape key listener for roadmap modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (showSprintModal || showQuickAddModal)) {
        setShowSprintModal(false);
        setShowQuickAddModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSprintModal, showQuickAddModal]);

  // Nav prev/next
  const handleNav = (direction: 'prev' | 'next') => {
    const delta = direction === 'next' ? 1 : -1;
    const next = new Date(currentDate);
    if (scale === 'days') {
      next.setDate(next.getDate() + (delta * 14));
    } else if (scale === 'weeks') {
      next.setDate(next.getDate() + (delta * 28));
    } else {
      next.setMonth(next.getMonth() + (delta * 3));
    }
    setCurrentDate(next);
  };

  // Toggle card completion
  const handleToggleComplete = (e: React.MouseEvent, card: CardType) => {
    e.stopPropagation();
    if (isObserver) return;
    const nextCompleted = !card.completed;
    updateCard(card.id, {
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
      progress: nextCompleted ? 100 : (card.progress === 100 ? 0 : card.progress),
    });
  };

  // Save Sprint Handler
  const handleSaveSprint = () => {
    if (!sprintName.trim()) {
      showToast('Phase name is required', 'warning');
      return;
    }
    if (!sprintStartDate || !sprintEndDate) {
      showToast('Start and end dates are required for a phase', 'warning');
      return;
    }

    if (editingSprint) {
      updateSprint(board.id, editingSprint.id, {
        name: sprintName.trim(),
        goal: sprintGoal.trim(),
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        color: sprintColor,
      });
      showToast(`Updated phase "${sprintName.trim()}"`, 'success');
    } else {
      const created = createSprint(
        board.id,
        sprintName.trim(),
        sprintStartDate,
        sprintEndDate,
        sprintGoal.trim(),
        sprintColor
      );
      if (created?.id) {
        setQuickTaskSprintId(created.id);
      }
      showToast(`Created new phase "${sprintName.trim()}"`, 'success');
    }

    setShowSprintModal(false);
    setEditingSprint(null);
  };

  // Quick Add Task Handler
  const handleQuickAddTask = () => {
    if (!quickTaskTitle.trim()) {
      showToast('Task title is required', 'warning');
      return;
    }

    const newCard = addCard(quickTaskColumnId, quickTaskTitle.trim());
    if (newCard) {
      updateCard(newCard.id, {
        startDate: quickTaskStartDate || null,
        dueDate: quickTaskDueDate || null,
        actualStartDate: quickTaskActualStartDate || null,
        actualEndDate: quickTaskActualEndDate || null,
        sprintId: quickTaskSprintId || null,
        assignees: quickTaskAssignee ? [quickTaskAssignee] : [],
        isMilestone: quickTaskIsMilestone,
      });
      showToast(`Added "${quickTaskTitle.trim()}"`, 'success');
    }

    setShowQuickAddModal(false);
    setQuickTaskTitle('');
    setQuickTaskStartDate('');
    setQuickTaskDueDate('');
    setQuickTaskActualStartDate('');
    setQuickTaskActualEndDate('');
    setQuickTaskAssignee('');
    setQuickTaskIsMilestone(false);
  };

  // Export Roadmap & Gantt Chart Timeline as CSV (formatted for clean Microsoft Excel display)
  const handleExportCSV = () => {
    // 1. Calculate the calendar timeline columns spanning across all scheduled tasks
    let minTime = today.getTime();
    let maxTime = today.getTime();

    if (allTasks.length > 0) {
      allTasks.forEach(t => {
        minTime = Math.min(minTime, t.targetStartDate.getTime(), t.actualStartDate.getTime());
        maxTime = Math.max(maxTime, t.targetEndDate.getTime(), t.actualOrProjectedEndDate.getTime());
      });
      minTime = Math.min(minTime, today.getTime());
      maxTime = Math.max(maxTime, today.getTime());
    } else {
      minTime = viewStart.getTime();
      maxTime = viewEnd.getTime();
    }

    const timelineStart = new Date(minTime);
    timelineStart.setHours(0, 0, 0, 0);
    timelineStart.setDate(timelineStart.getDate() - 2); // 2 days buffer on left

    const timelineEnd = new Date(maxTime);
    timelineEnd.setHours(23, 59, 59, 999);
    timelineEnd.setDate(timelineEnd.getDate() + 3); // 3 days buffer on right

    // Generate daily date columns (up to 120 days to keep spreadsheet fast and responsive)
    const exportDates: Date[] = [];
    const cur = new Date(timelineStart);
    const maxColumns = 120;
    while (cur <= timelineEnd && exportDates.length < maxColumns) {
      exportDates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const baseHeaders = [
      'Task Name',
      'Phase / Group',
      'Sprint',
      'Assignee',
      'Track',
      'Start Date',
      'Due Date',
      'Actual / Projected End',
      'Done %',
      'Schedule Health',
      'Status',
      'Milestone',
      'Worked Days',
      'Work Suspensions'
    ];

    const dateHeaders = exportDates.map(d => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const isToday = d.toDateString() === today.toDateString();
      return isToday ? `"${yyyy}-${mm}-${dd} (${dayName}) [TODAY]"` : `"${yyyy}-${mm}-${dd} (${dayName})"`;
    });

    const headers = [...baseHeaders, ...dateHeaders];

    const rows: string[][] = [];

    allTasks.forEach(t => {
      const progressPct = t.card.progress ?? (t.card.completed ? 100 : deriveCardProgress(t.card, t.columnName));
      const vDays = t.varianceDays;
      const varianceStr = vDays > 0 ? `${vDays}d late` : vDays < 0 ? `${Math.abs(vDays)}d ahead` : 'On schedule';

      const suspensionItems = (t.card.workSuspensions || []).map(s =>
        `${s.from} to ${s.to}${s.reason ? ` (${s.reason})` : ''}`
      );
      if (t.suspendedDays > (t.card.workSuspensions?.length || 0)) {
        suspensionItems.push(`${t.suspendedDays} paused days`);
      }
      const suspensionsStr = suspensionItems.join('; ') || 'None';

      const targetStartDay = new Date(t.targetStartDate);
      targetStartDay.setHours(0, 0, 0, 0);
      const targetEndDay = new Date(t.targetEndDate);
      targetEndDay.setHours(23, 59, 59, 999);

      const actualStartDay = new Date(t.actualStartDate);
      actualStartDay.setHours(0, 0, 0, 0);
      const actualEndDay = new Date(t.actualOrProjectedEndDate);
      actualEndDay.setHours(23, 59, 59, 999);

      // Determine effective filled work cap for this card
      const fillCapMs = t.card.completed
        ? actualEndDay.getTime()
        : (t.isWorkedToday
            ? today.getTime() + 24 * 3600 * 1000
            : (t.lastWorkedDate ? t.lastWorkedDate.getTime() + 24 * 3600 * 1000 : actualStartDay.getTime()));

      if (showProjectionComparison) {
        // --- ROW 1: Planned Goal ---
        const planRowMeta = [
          `"${(t.card.title || '').replace(/"/g, '""')}"`,
          `"${(t.columnName || '').replace(/"/g, '""')}"`,
          `"${(t.sprint ? t.sprint.name : 'Backlog').replace(/"/g, '""')}"`,
          `"${(t.card.assignees || []).map(id => board.members?.find(m => m.id === id)?.name || id).join(', ').replace(/"/g, '""')}"`,
          '"Planned Goal"',
          formatDateForExport(t.card.startDate || t.targetStartDate),
          formatDateForExport(t.card.dueDate || t.targetEndDate),
          formatDateForExport(t.actualOrProjectedEndDate),
          `"${progressPct}%"`,
          `"${varianceStr}"`,
          `"${t.card.completed ? 'Completed' : (t.targetEndDate < today ? 'Overdue' : 'In Progress')}"`,
          `"${t.card.isMilestone ? 'Yes' : 'No'}"`,
          String(t.workedDaysCount),
          `"${suspensionsStr.replace(/"/g, '""')}"`
        ];

        const planCells = exportDates.map(d => {
          const dTime = d.getTime();
          if (t.card.isMilestone) {
            return d.toDateString() === t.targetEndDate.toDateString() ? '"◆ Milestone"' : '""';
          }
          if (dTime >= targetStartDay.getTime() && dTime <= targetEndDay.getTime()) {
            return '"■ Plan"';
          }
          return '""';
        });

        rows.push([...planRowMeta, ...planCells]);

        // --- ROW 2: Work Done ---
        const actualRowMeta = [
          `"  ↳ ${(t.card.title || '').replace(/"/g, '""')}"`,
          `"${(t.columnName || '').replace(/"/g, '""')}"`,
          `"${(t.sprint ? t.sprint.name : 'Backlog').replace(/"/g, '""')}"`,
          `"${(t.card.assignees || []).map(id => board.members?.find(m => m.id === id)?.name || id).join(', ').replace(/"/g, '""')}"`,
          '"Work Done"',
          formatDateForExport(t.card.actualStartDate || t.actualStartDate),
          formatDateForExport(t.card.dueDate || t.targetEndDate),
          formatDateForExport(t.actualOrProjectedEndDate),
          `"${progressPct}%"`,
          `"${varianceStr}"`,
          `"${t.card.completed ? 'Completed' : (t.targetEndDate < today ? 'Overdue' : 'In Progress')}"`,
          `"${t.card.isMilestone ? 'Yes' : 'No'}"`,
          String(t.workedDaysCount),
          `"${suspensionsStr.replace(/"/g, '""')}"`
        ];

        const actualCells = exportDates.map(d => {
          const dTime = d.getTime();
          if (dTime < actualStartDay.getTime() || dTime > actualEndDay.getTime()) {
            return '""';
          }

          if (t.card.isMilestone) {
            return d.toDateString() === t.actualOrProjectedEndDate.toDateString() ? '"◆ Done"' : '""';
          }

          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;

          const isSuspended = (t.card.workSuspensions || []).some(s => dateStr >= s.from && dateStr <= s.to);
          if (isSuspended) {
            return '"⏸ Paused"';
          }

          if (t.card.completed) {
            return dTime > targetEndDay.getTime() ? '"■ Done (Late)"' : '"■ Done"';
          }

          if (dTime > targetEndDay.getTime()) {
            return '"░ Delayed"';
          }

          if (dTime <= today.getTime()) {
            if (dTime <= fillCapMs) {
              return '"■ Done"';
            } else {
              return '"⏸ Paused"';
            }
          }

          return '"░ Projected"';
        });

        rows.push([...actualRowMeta, ...actualCells]);
      } else {
        // --- Single Unified Row ---
        const singleRowMeta = [
          `"${(t.card.title || '').replace(/"/g, '""')}"`,
          `"${(t.columnName || '').replace(/"/g, '""')}"`,
          `"${(t.sprint ? t.sprint.name : 'Backlog').replace(/"/g, '""')}"`,
          `"${(t.card.assignees || []).map(id => board.members?.find(m => m.id === id)?.name || id).join(', ').replace(/"/g, '""')}"`,
          '"Timeline"',
          formatDateForExport(t.card.startDate || t.targetStartDate),
          formatDateForExport(t.card.dueDate || t.targetEndDate),
          formatDateForExport(t.actualOrProjectedEndDate),
          `"${progressPct}%"`,
          `"${varianceStr}"`,
          `"${t.card.completed ? 'Completed' : (t.targetEndDate < today ? 'Overdue' : 'In Progress')}"`,
          `"${t.card.isMilestone ? 'Yes' : 'No'}"`,
          String(t.workedDaysCount),
          `"${suspensionsStr.replace(/"/g, '""')}"`
        ];

        const singleCells = exportDates.map(d => {
          const dTime = d.getTime();
          if (t.card.isMilestone) {
            return d.toDateString() === t.actualOrProjectedEndDate.toDateString() ? '"◆ Milestone"' : '""';
          }
          if (dTime >= actualStartDay.getTime() && dTime <= actualEndDay.getTime()) {
            if (t.card.completed) return '"■ Completed"';
            if (dTime > targetEndDay.getTime()) return '"░ Delayed"';
            if (dTime <= today.getTime() && dTime <= fillCapMs) return '"■ Done"';
            return '"■ Plan"';
          }
          return '""';
        });

        rows.push([...singleRowMeta, ...singleCells]);
      }
    });

    // Append visual legend for Excel users
    const legendRows: string[][] = [
      [],
      ['"=== GANTT CHART TIMELINE LEGEND ==="'],
      ['"Marker"', '"Meaning"'],
      ['"[TODAY]"', '"Today reference column marker"'],
      ['"■ Plan"', '"Planned Goal duration bar"'],
      ['"■ Done"', '"Confirmed worked / completed days"'],
      ['"■ Done (Late)"', '"Work completed after the agreed deadline"'],
      ['"⏸ Paused"', '"Work paused or suspended (unworked day or approved stoppage)"'],
      ['"░ Delayed"', '"Projected schedule delay extension beyond the due date"'],
      ['"░ Projected"', '"Scheduled upcoming work days before the due date"'],
      ['"◆ Milestone"', '"Milestone checkpoint deliverable"']
    ];

    const allCsvLines = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      ...legendRows.map(r => r.join(','))
    ];

    const csvContent = allCsvLines.join('\n');
    // Prepend UTF-8 BOM so Microsoft Excel automatically recognizes character encoding and dates
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${board.name.toLowerCase().replace(/\s+/g, '-')}-gantt-roadmap.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Gantt chart and Roadmap exported to CSV successfully', 'success');
  };

  // Pixel sizing per interval
  const intervalWidthPx = scale === 'days' ? 52 : scale === 'weeks' ? 90 : 130;
  const totalTimelineWidth = intervals.length * intervalWidthPx;

  // Today marker X position percentage
  const todayMs = today.getTime() + 12 * 3600 * 1000;
  const todayProgress = (todayMs - viewStart.getTime()) / totalViewMs;
  const isTodayInView = todayProgress >= 0 && todayProgress <= 1;
  const todayXPos = todayProgress * totalTimelineWidth;

  // Plain-English status helper
  const getStatusPill = (t: TaskWithSchedule) => {
    if (t.card.completed) {
      if (t.startVarianceDays < 0) {
        return { label: `Done (started ${Math.abs(t.startVarianceDays)}d early)`, color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
      }
      return { label: 'Done', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    }
    if (!t.card.completed && t.endDate < today) return { label: `${t.varianceDays}d overdue`, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    if (t.startVarianceDays < 0 && t.varianceDays <= 0) {
      return { label: `Started ${Math.abs(t.startVarianceDays)}d early`, color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
    }
    if (t.varianceDays > 0) return { label: `${t.varianceDays}d behind`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    if (t.varianceDays < 0) return { label: `${Math.abs(t.varianceDays)}d ahead`, color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    return { label: 'On track', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  };

  const behindCount = allTasks.filter(t => !t.card.completed && t.varianceDays > 0).length;

  return (
    <div className={`roadmap-view-container roadmap-mobile-mode-${mobileTab}`}>

      {/* ── Project Roadmap Header (When viewing a Roadmap) ── */}
      {board.type === 'roadmap' && (
        <div style={{
          padding: '14px 16px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
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
              flexShrink: 0,
            }}>
              <Milestone size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
                  {board.name}
                </h1>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Project Roadmap
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                {board.description || 'Track deliverables, scheduled milestones, and actual start/completion dates.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Summary Cards ── */}
      <div style={{
        display: 'flex',
        gap: 10,
        padding: '12px 16px 0',
        flexWrap: 'wrap',
        alignItems: 'stretch',
      }}>
        {[
          { value: totalCount, label: board.type === 'roadmap' ? 'Deliverables & Phases' : 'Total Tasks', color: 'hsl(var(--foreground))', accent: 'hsl(var(--primary) / 0.12)' },
          { value: completedCount, label: 'Completed', color: '#10b981', accent: 'rgba(16,185,129,0.1)' },
          { value: overdueCount, label: 'Overdue', color: '#ef4444', accent: 'rgba(239,68,68,0.1)' },
          { value: behindCount, label: 'Behind Schedule', color: '#f59e0b', accent: 'rgba(245,158,11,0.1)' },
        ].map(card => (
          <div key={card.label} style={{
            flex: '1 1 100px',
            minWidth: 90,
            maxWidth: 160,
            background: card.accent,
            border: `1px solid ${card.color}30`,
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</span>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>{card.label}</span>
          </div>
        ))}

        {/* Spacer + Action Buttons */}
        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
          {activeSprint && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, padding: '5px 10px', fontSize: 12,
            }}>
              <span className="sprint-status-dot pulse" />
              <span style={{ fontWeight: 600 }}>{activeSprint.name}</span>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                {activeSprintCompleted}/{activeSprintTasks.length} done
              </span>
              {!isObserver && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 10.5, padding: '2px 7px', height: 22, borderRadius: 5 }}
                  onClick={() => {
                    completeSprint(board.id, activeSprint.id);
                    showToast(`Completed phase "${activeSprint.name}"!`, 'success');
                  }}
                >Finish Phase</button>
              )}
            </div>
          )}

          {!isObserver && (
            <>
              <motion.button whileTap={{ scale: 0.95 }} type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingSprint(null);
                  setSprintName(`Phase ${(board.sprints?.length || 0) + 1}`);
                  setSprintGoal('');
                  const now = new Date();
                  setSprintStartDate(now.toISOString().split('T')[0]);
                  const twoWeeks = new Date(now);
                  twoWeeks.setDate(twoWeeks.getDate() + 14);
                  setSprintEndDate(twoWeeks.toISOString().split('T')[0]);
                  setShowSprintModal(true);
                }}
                title="Create a new project phase"
              >+ Phase</motion.button>

              <motion.button whileTap={{ scale: 0.95 }} type="button"
                className="btn btn-primary"
                onClick={() => setShowQuickAddModal(true)}
                title={board.type === 'roadmap' ? "Add a new phase or subtask" : "Quick add a new task"}
              >
                {board.type === 'roadmap' ? '+ Add Phase / Subtask' : '+ Add Task'}
              </motion.button>
            </>
          )}

          <motion.button whileTap={{ scale: 0.95 }} type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            title="Export Gantt chart as CSV for Excel"
          >Export CSV</motion.button>
        </div>
      </div>

      {/* Mobile Segmented View Switcher */}
      <div className="roadmap-mobile-view-tabs" role="tablist" aria-label="Roadmap View Options">
        <button type="button" role="tab" aria-selected={mobileTab === 'deliverables'}
          className={`mobile-view-tab ${mobileTab === 'deliverables' ? 'active' : ''}`}
          onClick={() => setMobileTab('deliverables')}>
          <span>Tasks ({totalCount})</span>
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === 'timeline'}
          className={`mobile-view-tab ${mobileTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setMobileTab('timeline')}>
          <span>Timeline</span>
        </button>
      </div>

      {/* ── Single Controls Row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        flexWrap: 'wrap',
        borderBottom: '1px solid hsl(var(--border) / 0.5)',
      }}>
        {/* Search */}
        <div className="roadmap-search-box" style={{ flex: '1 1 160px', minWidth: 120 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="roadmap-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="roadmap-search-clear">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Scale Switcher */}
        <div className="roadmap-scale-group" style={{ flexShrink: 0 }}>
          <button type="button" className={`scale-btn ${scale === 'days' ? 'active' : ''}`} onClick={() => setScale('days')}>Days</button>
          <button type="button" className={`scale-btn ${scale === 'weeks' ? 'active' : ''}`} onClick={() => setScale('weeks')}>Weeks</button>
          <button type="button" className={`scale-btn ${scale === 'months' ? 'active' : ''}`} onClick={() => setScale('months')}>Months</button>
        </div>

        {/* Group By */}
        <NeumorphicSelect<GroupByMode>
          value={groupBy}
          options={groupByOptions}
          onChange={setGroupBy}
          prefix="Group:"
          size="sm"
          style={{ minWidth: 135, flex: '0 0 auto' }}
        />

        {/* Status Filter */}
        <NeumorphicSelect<StatusFilter>
          value={statusFilter}
          options={statusFilterOptions}
          onChange={setStatusFilter}
          size="sm"
          style={{ minWidth: 120, flex: '0 0 auto' }}
        />

        {/* Dual View toggle */}
        <button
          type="button"
          className={`btn ${showProjectionComparison ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 11.5, flexShrink: 0 }}
          onClick={() => setShowProjectionComparison(s => !s)}
          title="Show both the original plan and actual work done as two separate bars"
        >
          {showProjectionComparison ? 'Dual View: On' : 'Dual View'}
        </button>
      </div>

      {/* ── Split Pane ── */}
      <div className={`roadmap-split-pane mobile-tab-${mobileTab}`}>

        {/* Left Side: Tasks Table */}
        <div className="roadmap-tasks-pane">
          <div className="roadmap-pane-header">
            <span style={{ flex: 1, paddingLeft: 8 }}>Task</span>
            <span className="hide-on-mobile-inline" style={{ width: 120, textAlign: 'right', paddingRight: 8 }}>Progress &amp; Status</span>
            <span className="show-on-mobile-inline" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>Status</span>
          </div>

          <div className="roadmap-tasks-list" ref={taskListRef} onScroll={handleTaskListScroll}>
            {groupedSections.map(section => {
              const tasks = section.tasks;
              const isCollapsed = collapsedGroups[section.id] !== undefined
                ? collapsedGroups[section.id]
                : (isMobile && tasks.length === 0);
              const sectionCompleted = tasks.filter(t => t.card.completed).length;

              return (
                <div key={section.id} className="roadmap-col-group">
                  <div
                    className="roadmap-col-header"
                    onClick={() => toggleGroup(section.id)}
                    title="Click to collapse/expand"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {isCollapsed
                        ? <ChevronRight size={14} />
                        : <ChevronDown size={14} />
                      }
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: section.color || 'hsl(var(--primary))',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {section.title}
                      </span>
                      <span className="roadmap-col-badge">{tasks.length}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tasks.length > 0 && (
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                          {sectionCompleted}/{tasks.length}
                        </span>
                      )}
                      {section.sprint && !isObserver && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                          {section.sprint.status === 'planned' && (
                            <button type="button" className="icon-btn" title="Start Phase"
                              style={{ width: 22, height: 22, fontSize: 10, fontWeight: 700 }}
                              onClick={() => {
                                startSprint(board.id, section.sprint!.id);
                                showToast(`Started phase "${section.sprint!.name}"`, 'success');
                              }}
                            >▶</button>
                          )}
                          <button type="button" className="icon-btn" title="Edit Phase"
                            style={{ width: 22, height: 22, fontSize: 11 }}
                            onClick={() => {
                              setEditingSprint(section.sprint!);
                              setSprintName(section.sprint!.name);
                              setSprintGoal(section.sprint!.goal || '');
                              setSprintStartDate(section.sprint!.startDate);
                              setSprintEndDate(section.sprint!.endDate);
                              setSprintColor(section.sprint!.color || '#6366f1');
                              setShowSprintModal(true);
                            }}
                          >✎</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="roadmap-col-rows">
                      {tasks.length === 0 ? (
                        <div className="roadmap-empty-col-row">No tasks in this group</div>
                      ) : (
                        tasks.map(t => {
                          const progressPct = deriveCardProgress(t.card, t.columnName);
                          const isMilestone = isMilestoneTask(t.card);
                          const statusPill = getStatusPill(t);
                          const assignees = (t.card.assignees || []).map(id =>
                            board.members?.find((m: Member) => m.id === id)
                          ).filter(Boolean);

                          return (
                            <div
                              key={t.card.id}
                              className={`roadmap-task-row ${t.card.completed ? 'completed' : ''}`}
                              onClick={() => onOpenCard(t.card.id)}
                              title={`Open "${t.card.title}"`}
                            >
                              <button type="button" className="roadmap-check-btn"
                                onClick={(e) => handleToggleComplete(e, t.card)}
                              >
                                {t.card.completed
                                  ? <CheckSquare size={15} color="hsl(var(--primary))" />
                                  : <Square size={15} color="hsl(var(--muted-foreground))" />
                                }
                              </button>

                              {isMilestone && (
                                <div title="Key Milestone" style={{
                                  width: 10, height: 10,
                                  transform: 'rotate(45deg)',
                                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                  borderRadius: 2, flexShrink: 0,
                                  boxShadow: '0 0 5px rgba(168,85,247,0.4)'
                                }} />
                              )}

                              <span className="roadmap-task-title" title={t.card.title}>
                                {t.card.title}
                              </span>

                              {t.startVarianceDays < 0 && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(16,185,129,0.18)',
                                    color: '#10b981',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                  title={`Scheduled to start ${formatShortDate(t.targetStartDate)}, but work started early on ${formatShortDate(t.actualStartDate)}`}
                                >
                                  🟢 Started {Math.abs(t.startVarianceDays)}d early
                                </span>
                              )}

                              {assignees.length > 0 && (
                                <div className="roadmap-task-assignees">
                                  {assignees.slice(0, 2).map((m: any) => (
                                    <AvatarBorder key={m.id} size={18} title={m.name}>
                                      {m.avatarUrl
                                        ? <img src={m.avatarUrl} alt={m.name} style={{ width: 18, height: 18, borderRadius: '50%' }} />
                                        : <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{avatarInitials(m.name)}</div>
                                      }
                                    </AvatarBorder>
                                  ))}
                                </div>
                              )}

                              {/* Progress + Status — Desktop */}
                              <div className="hide-on-mobile-flex" style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', paddingRight: 8 }}>
                                {/* Mini progress bar */}
                                <div style={{ width: '100%', height: 4, borderRadius: 4, background: 'hsl(var(--border))', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: 4, background: t.card.completed ? '#10b981' : 'hsl(var(--primary))', transition: 'width 0.4s ease' }} />
                                </div>
                                {/* Status pill */}
                                <span style={{
                                  fontSize: 10, fontWeight: 700,
                                  padding: '1px 6px', borderRadius: 20,
                                  background: statusPill.bg,
                                  color: statusPill.color,
                                  whiteSpace: 'nowrap',
                                }}>{statusPill.label}</span>
                              </div>

                              {/* Mobile status */}
                              <div className="show-on-mobile-flex" style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', paddingRight: 6 }}>
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: statusPill.bg, color: statusPill.color, whiteSpace: 'nowrap' }}>{statusPill.label}</span>
                                <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>{formatShortDate(t.targetEndDate)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Gantt Canvas */}
        <div className="roadmap-canvas-pane" ref={timelineContainerRef} onScroll={handleTimelineScroll}>

          {/* Canvas Header: Date nav + legend strip */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 15,
            background: 'hsl(var(--card))',
            borderBottom: '1px solid hsl(var(--border) / 0.5)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Nav row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderBottom: '1px solid hsl(var(--border) / 0.3)',
            }}>
              <motion.button whileTap={{ scale: 0.92 }} type="button" className="icon-btn"
                onClick={() => handleNav('prev')} title="Go back" style={{ width: 26, height: 26, minWidth: 26 }}>
                <ChevronLeft size={14} />
              </motion.button>
              <span className="roadmap-date-label" style={{ fontSize: 11.5, fontWeight: 600, flex: 1, textAlign: 'center' }}>
                {viewStart.toLocaleDateString([], { month: 'short', year: 'numeric' })}
                {viewStart.getMonth() !== viewEnd.getMonth() && (
                  <span> – {viewEnd.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
                )}
              </span>
              <motion.button whileTap={{ scale: 0.92 }} type="button" className="icon-btn"
                onClick={() => handleNav('next')} title="Go forward" style={{ width: 26, height: 26, minWidth: 26 }}>
                <ChevronRight size={14} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} type="button"
                className="btn btn-secondary today-btn" onClick={handleJumpToday} title="Jump to today"
                style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
              >Today</motion.button>
            </div>

            {/* Legend strip — always visible */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '5px 10px',
              fontSize: 10.5, color: 'hsl(var(--muted-foreground))'
            }}>
              {showProjectionComparison ? (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                    Original plan
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: '#f97316', display: 'inline-block' }} />
                    Work done
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: 'repeating-linear-gradient(90deg,#ef444460 0,#ef444460 4px,transparent 4px,transparent 8px)', display: 'inline-block' }} />
                    Behind schedule
                  </span>
                </>
              ) : (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                    Completed
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: 'hsl(var(--primary))', display: 'inline-block' }} />
                    In progress
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} />
                    Overdue
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 2, height: 14, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} />
                    Today
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Scrollable timeline canvas */}
          <div style={{ overflowX: 'auto' }}>
            {/* Timeline column headers */}
            <div className="roadmap-timeline-header" style={{ width: totalTimelineWidth }}>
              {intervals.map((intDate, i) => {
                const isToday = intDate.toDateString() === today.toDateString();
                let label = '';
                let subLabel = '';
                if (scale === 'days') {
                  label = intDate.toLocaleDateString([], { weekday: 'short' });
                  subLabel = intDate.getDate().toString();
                } else if (scale === 'weeks') {
                  label = `W${Math.ceil(intDate.getDate() / 7)}`;
                  subLabel = intDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                } else {
                  label = intDate.toLocaleDateString([], { month: 'short' });
                  subLabel = intDate.getFullYear().toString();
                }
                return (
                  <div key={i} className={`roadmap-timeline-cell ${isToday ? 'is-today' : ''}`} style={{ width: intervalWidthPx }}>
                    <span className="cell-day">{label}</span>
                    <span className={`cell-num ${isToday ? 'today-pill' : ''}`}>{subLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Bars area */}
            <div className="roadmap-bars-area" style={{ width: totalTimelineWidth }}>
              {/* Grid background */}
              <div className="roadmap-grid-background">
                {intervals.map((_, i) => (
                  <div key={i} className="roadmap-grid-col" style={{ width: intervalWidthPx }} />
                ))}
              </div>

              {/* Today marker */}
              {isTodayInView && (
                <div className="roadmap-today-marker" style={{ left: todayXPos }}>
                  <div className="today-badge">TODAY</div>
                </div>
              )}

              {/* Bar rows */}
              <div className="roadmap-bars-rows">
                {groupedSections.map(section => {
                  const tasks = section.tasks;
                  const isCollapsed = collapsedGroups[section.id];

                  let sprintBand = null;
                  if (section.sprint) {
                    const spStart = new Date(section.sprint.startDate).getTime();
                    const spEnd = new Date(section.sprint.endDate).getTime();
                    const spLeftPct = Math.max(0, Math.min(100, ((spStart - viewStart.getTime()) / totalViewMs) * 100));
                    const spRightPct = Math.max(0, Math.min(100, ((spEnd - viewStart.getTime()) / totalViewMs) * 100));
                    const spWidthPct = Math.max(1, spRightPct - spLeftPct);
                    sprintBand = { left: spLeftPct, width: spWidthPct };
                  }

                  return (
                    <div key={section.id} className="roadmap-col-bars-group">
                      <div style={{ height: 34, position: 'relative', overflow: 'hidden' }}>
                        {sprintBand && (
                          <div className="roadmap-sprint-span-indicator" style={{
                            left: `${sprintBand.left}%`, width: `${sprintBand.width}%`,
                            borderColor: section.color || 'hsl(var(--primary))',
                            backgroundColor: `${section.color || 'hsl(var(--primary))'}14`
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: section.color || 'hsl(var(--primary))' }}>
                              {section.sprint?.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {!isCollapsed && (
                        tasks.length === 0 ? (
                          <div style={{ height: 38 }} />
                        ) : (
                          tasks.map(t => {
                            const progressPct = deriveCardProgress(t.card, t.columnName);
                            const isMilestone = isMilestoneTask(t.card);
                            const statusPill = getStatusPill(t);

                            // Positions
                            const targetStartMs = Math.max(viewStart.getTime(), t.targetStartDate.getTime());
                            const targetEndMs = Math.min(viewEnd.getTime(), t.targetEndDate.getTime());
                            const targetLeftPct = Math.max(0, Math.min(100, ((targetStartMs - viewStart.getTime()) / totalViewMs) * 100));
                            const targetRightPct = Math.max(0, Math.min(100, ((targetEndMs - viewStart.getTime()) / totalViewMs) * 100));
                            const targetWidthPct = Math.max(2.0, targetRightPct - targetLeftPct);

                            const actualStartMs = Math.max(viewStart.getTime(), t.actualStartDate.getTime());
                            const actualEndMs = Math.min(viewEnd.getTime(), t.actualOrProjectedEndDate.getTime());
                            const actualLeftPct = Math.max(0, Math.min(100, ((actualStartMs - viewStart.getTime()) / totalViewMs) * 100));
                            const actualRightPct = Math.max(0, Math.min(100, ((actualEndMs - viewStart.getTime()) / totalViewMs) * 100));
                            const actualTotalWidthPct = Math.max(2.0, actualRightPct - actualLeftPct);

                            let fillCapMs: number;
                            if (t.card.completed) {
                              fillCapMs = actualEndMs;
                            } else if (t.isWorkedToday) {
                              fillCapMs = Math.min(actualEndMs, today.getTime() + 12 * 3600000);
                            } else if (t.lastWorkedDate) {
                              fillCapMs = Math.min(actualEndMs, Math.max(actualStartMs, t.lastWorkedDate.getTime()));
                            } else {
                              fillCapMs = actualStartMs;
                            }
                            const fillRightPct = Math.max(actualLeftPct, Math.min(actualRightPct, ((fillCapMs - viewStart.getTime()) / totalViewMs) * 100));
                            const doneRatio = t.card.completed
                              ? 1
                              : (actualTotalWidthPct > 0
                                  ? Math.max(0, Math.min(1, (fillRightPct - actualLeftPct) / actualTotalWidthPct))
                                  : 0);

                            // Plain-English tooltip
                            const tooltipText = [
                              t.card.title,
                              `Start: ${formatShortDate(t.targetStartDate)}  ·  Due: ${formatShortDate(t.targetEndDate)}`,
                              t.card.completed
                                ? 'Status: Completed'
                                : t.varianceDays > 0
                                  ? `Status: ${t.varianceDays} day${t.varianceDays === 1 ? '' : 's'} behind schedule`
                                  : t.varianceDays < 0
                                    ? `Status: ${Math.abs(t.varianceDays)} day${Math.abs(t.varianceDays) === 1 ? '' : 's'} ahead of schedule`
                                    : 'Status: On track',
                              !t.card.completed && (
                                t.isWorkedToday
                                  ? 'Work confirmed for today'
                                  : t.lastWorkedDate
                                    ? `Last worked: ${formatShortDate(t.lastWorkedDate)}`
                                    : 'No work recorded yet'
                              ),
                            ].filter(Boolean).join('\n');

                            // Bar color for simple view
                            const simpleBarColor = t.card.completed
                              ? '#10b981'
                              : (!t.card.completed && t.endDate < today)
                                ? '#ef4444'
                                : (section.color || t.columnColor || 'hsl(var(--primary))');

                            return (
                              <div key={t.card.id} className="roadmap-bar-row">
                                <div className="roadmap-mobile-row-label" title={t.card.title}>
                                  <span className="mobile-row-title">{t.card.title}</span>
                                </div>

                                {showProjectionComparison ? (
                                  <>
                                    {/* Top Track: Planned Goal */}
                                    <div
                                      className="roadmap-target-baseline-bar"
                                      style={{ left: `${targetLeftPct}%`, width: `${targetWidthPct}%` }}
                                      onClick={() => onOpenCard(t.card.id)}
                                      title={`Original plan: ${formatShortDate(t.targetStartDate)} to ${formatShortDate(t.targetEndDate)}`}
                                    >
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        {isMilestone && <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', backgroundColor: '#fff', borderRadius: 1, flexShrink: 0 }} />}
                                        Plan: {formatShortDate(t.targetEndDate)}
                                      </span>
                                    </div>

                                    {/* Bottom Track: Work Done */}
                                    <div
                                      className="roadmap-actual-track"
                                      style={{ left: `${actualLeftPct}%`, width: `${actualTotalWidthPct}%` }}
                                      onClick={() => onOpenCard(t.card.id)}
                                      title={tooltipText}
                                    >
                                      {t.startVarianceDays < 0 && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            width: `${Math.min(100, Math.max(0, ((targetLeftPct - actualLeftPct) / actualTotalWidthPct) * 100))}%`,
                                            top: 0,
                                            bottom: 0,
                                            background: 'rgba(16,185,129,0.25)',
                                            borderRight: '1.5px dashed #10b981',
                                            borderRadius: '4px 0 0 4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            paddingLeft: 4,
                                            zIndex: 2,
                                            pointerEvents: 'none',
                                          }}
                                          title={`Started ${Math.abs(t.startVarianceDays)} day(s) before scheduled date`}
                                        >
                                          <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>
                                            Early Start
                                          </span>
                                        </div>
                                      )}
                                      <div
                                        className={`roadmap-actual-filled-bar ${t.card.completed ? 'completed' : ''}`}
                                        style={{ width: `${doneRatio * 100}%`, ...(!t.card.completed && !t.isWorkedToday ? { opacity: 0.85 } : {}) }}
                                      >
                                        {doneRatio > 0 && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {t.card.completed ? 'Done' : `${progressPct}%`}
                                            {!t.card.completed && !t.isWorkedToday && (
                                              <span style={{ fontSize: 8.5, opacity: 0.9, backgroundColor: 'rgba(0,0,0,0.35)', padding: '1px 3.5px', borderRadius: 3 }}>Paused</span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      {t.varianceDays > 0 && !t.card.completed && targetRightPct < actualRightPct && (
                                        <div
                                          className="roadmap-slipped-extension"
                                          style={{
                                            left: `${Math.max(0, ((targetRightPct - actualLeftPct) / actualTotalWidthPct) * 100)}%`,
                                            right: 0,
                                          }}
                                          title={`${t.varianceDays} day${t.varianceDays === 1 ? '' : 's'} behind schedule`}
                                        />
                                      )}
                                      {doneRatio < 0.6 && (
                                        <span className="roadmap-actual-track-label">
                                          {doneRatio === 0 ? 'Not started' : `${progressPct}%`}
                                          {t.varianceDays > 0 && !t.card.completed && ` · ${t.varianceDays}d behind`}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  /* Simple single bar */
                                  isMilestone ? (
                                    <motion.div
                                      whileHover={{ scale: 1.2, y: -2 }}
                                      className="roadmap-milestone-marker"
                                      style={{ left: `${actualLeftPct}%` }}
                                      onClick={() => onOpenCard(t.card.id)}
                                      title={tooltipText}
                                    >
                                      <div className="milestone-diamond" />
                                      <span className="milestone-label">{t.card.title}</span>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      whileHover={{ y: -1.5, scale: 1.01 }}
                                      className={`roadmap-gantt-bar ${t.card.completed ? 'completed' : ''}`}
                                      style={{
                                        left: `${actualLeftPct}%`,
                                        width: `${actualTotalWidthPct}%`,
                                        top: 13,
                                        backgroundColor: simpleBarColor,
                                      }}
                                      onClick={() => onOpenCard(t.card.id)}
                                      title={tooltipText}
                                    >
                                      <div className="roadmap-bar-progress-fill" style={{ width: `${progressPct}%` }} />
                                      <div className="roadmap-bar-content">
                                        <span className="bar-title">{t.card.title}</span>
                                        <span style={{
                                          fontSize: 9.5, fontWeight: 700,
                                          background: 'rgba(0,0,0,0.25)',
                                          borderRadius: 3, padding: '1px 4px',
                                          flexShrink: 0,
                                        }}>{statusPill.label}</span>
                                      </div>
                                    </motion.div>
                                  )
                                )}
                              </div>
                            );
                          })
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ── Roadmap Modals (Side-by-Side & Centered) ── */}
      <AnimatePresence>
        {(showSprintModal || showQuickAddModal) && (
          <div
            className="roadmap-modal-overlay"
          >
            <div
              className="roadmap-modal-container"
              onClick={e => e.stopPropagation()}
            >
              {/* Sprint / Phase Modal Card */}
              {showSprintModal && (
                <motion.div
                  key="sprint-modal"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="roadmap-modal-card"
                  style={{ width: 440, maxWidth: '100%' }}
                >
                  <div className="roadmap-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={18} color="hsl(var(--primary))" />
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                        {editingSprint ? 'Edit Phase' : 'Create Project Phase'}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!showQuickAddModal && !isObserver && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 9px', height: 26, borderRadius: 6 }}
                          onClick={() => setShowQuickAddModal(true)}
                          title="Open Add Task side-by-side"
                        >
                          <span>+ Add Task</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setShowSprintModal(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="roadmap-modal-body">
                    <div className="form-group">
                      <label className="field-label">Phase / Package Name</label>
                      <input
                        type="text"
                        value={sprintName}
                        onChange={e => setSprintName(e.target.value)}
                        placeholder="e.g. Phase 1 - Foundation & Rough-In"
                        className="text-input"
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="field-label">Scope & Key Objectives</label>
                      <textarea
                        value={sprintGoal}
                        onChange={e => setSprintGoal(e.target.value)}
                        placeholder="What are the main deliverables and scope for this phase?"
                        className="text-input"
                        rows={2}
                        style={{ resize: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="field-label">Start Date</label>
                        <NeumorphicDatePicker
                          value={sprintStartDate || null}
                          onChange={val => setSprintStartDate(val ? val.split('T')[0] : '')}
                          align="left"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">End Date</label>
                        <NeumorphicDatePicker
                          value={sprintEndDate || null}
                          onChange={val => setSprintEndDate(val ? val.split('T')[0] : '')}
                          align="right"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="field-label">Color Theme</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'].map(col => (
                          <div
                            key={col}
                            onClick={() => setSprintColor(col)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: col,
                              cursor: 'pointer',
                              boxShadow: sprintColor === col ? '0 0 0 2px hsl(var(--card)), 0 0 0 4px ' + col : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="roadmap-modal-footer">
                    {editingSprint && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: 'hsl(var(--destructive))', marginRight: 'auto' }}
                        onClick={() => {
                          deleteSprint(board.id, editingSprint.id);
                          showToast(`Deleted phase "${editingSprint.name}"`, 'info');
                          setShowSprintModal(false);
                        }}
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowSprintModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveSprint}
                    >
                      {editingSprint ? 'Save Changes' : 'Create Phase'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Quick Add Task Modal Card */}
              {showQuickAddModal && (
                <motion.div
                  key="task-modal"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="roadmap-modal-card"
                  style={{ width: 460, maxWidth: '100%' }}
                >
                  <div className="roadmap-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={18} color="hsl(var(--primary))" />
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                        {board.type === 'roadmap' ? 'Add Phase / Subtask to Roadmap' : 'Add Task / Milestone to Roadmap'}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!showSprintModal && !isObserver && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 9px', height: 26, borderRadius: 6 }}
                          onClick={() => {
                            setEditingSprint(null);
                            setSprintName(`Sprint ${(board.sprints?.length || 0) + 1}`);
                            setSprintGoal('');
                            const now = new Date();
                            setSprintStartDate(now.toISOString().split('T')[0]);
                            const twoWeeks = new Date(now);
                            twoWeeks.setDate(twoWeeks.getDate() + 14);
                            setSprintEndDate(twoWeeks.toISOString().split('T')[0]);
                            setShowSprintModal(true);
                          }}
                          title="Open Create Phase side-by-side"
                        >
                          <span>+ Phase</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setShowQuickAddModal(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="roadmap-modal-body">
                    <div className="form-group">
                      <label className="field-label">
                        {board.type === 'roadmap' ? 'Phase / Subtask Name' : 'Task Title'}
                      </label>
                      <input
                        type="text"
                        value={quickTaskTitle}
                        onChange={e => setQuickTaskTitle(e.target.value)}
                        placeholder={board.type === 'roadmap' ? "e.g. Planning, Making the UI, Making the frontend..." : "e.g. Implement user authentication flow"}
                        className="text-input"
                        autoFocus
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="field-label">Stage / Column</label>
                        <NeumorphicSelect
                          value={quickTaskColumnId}
                          options={(board.columns || []).map(c => ({
                            value: c.id,
                            label: c.name,
                          }))}
                          onChange={setQuickTaskColumnId}
                          size="sm"
                        />
                      </div>
                      <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label className="field-label" style={{ margin: 0 }}>Assign Phase</label>
                          {!showSprintModal && !isObserver && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSprint(null);
                                setSprintName(`Sprint ${(board.sprints?.length || 0) + 1}`);
                                setSprintGoal('');
                                const now = new Date();
                                setSprintStartDate(now.toISOString().split('T')[0]);
                                const twoWeeks = new Date(now);
                                twoWeeks.setDate(twoWeeks.getDate() + 14);
                                setSprintEndDate(twoWeeks.toISOString().split('T')[0]);
                                setShowSprintModal(true);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'hsl(var(--primary))',
                                fontSize: 11,
                                cursor: 'pointer',
                                fontWeight: 600,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                              title="Create a new phase side-by-side"
                            >
                              <span>+ New</span>
                            </button>
                          )}
                        </div>
                        <NeumorphicSelect
                          value={quickTaskSprintId}
                          options={[
                            { value: '', label: 'No Phase (General Timeline)' },
                            ...(board.sprints || []).map(s => ({
                              value: s.id,
                              label: `${s.name}${s.status === 'active' ? ' (Current Phase)' : ''}`,
                              color: s.color || undefined,
                            }))
                          ]}
                          onChange={setQuickTaskSprintId}
                          size="sm"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="field-label">Scheduled Start</label>
                        <NeumorphicDatePicker
                          value={quickTaskStartDate || null}
                          onChange={val => setQuickTaskStartDate(val ? val.split('T')[0] : '')}
                          align="left"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Scheduled Date</label>
                        <NeumorphicDatePicker
                          value={quickTaskDueDate || null}
                          onChange={val => setQuickTaskDueDate(val ? val.split('T')[0] : '')}
                          align="right"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>Actual Start</span>
                          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
                        </label>
                        <NeumorphicDatePicker
                          value={quickTaskActualStartDate || null}
                          onChange={val => setQuickTaskActualStartDate(val ? val.split('T')[0] : '')}
                          align="left"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>Actual End</span>
                          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
                        </label>
                        <NeumorphicDatePicker
                          value={quickTaskActualEndDate || null}
                          onChange={val => setQuickTaskActualEndDate(val ? val.split('T')[0] : '')}
                          align="right"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', position: 'relative', zIndex: 30 }}>
                      <div className="form-group" style={{ marginBottom: 0, position: 'relative', zIndex: 30 }}>
                        <label className="field-label">Assignee</label>
                        <NeumorphicSelect
                          value={quickTaskAssignee}
                          options={[
                            { value: '', label: 'Unassigned' },
                            ...(board.members || []).map(m => ({
                              value: m.id,
                              label: m.name,
                              color: m.color || undefined,
                            }))
                          ]}
                          onChange={setQuickTaskAssignee}
                          size="sm"
                          placement="top"
                        />
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        className={`btn ${quickTaskIsMilestone ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          height: 32,
                          fontSize: 11.5,
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          borderRadius: 8,
                        }}
                        onClick={() => setQuickTaskIsMilestone(s => !s)}
                      >
                        <span>{quickTaskIsMilestone ? 'Milestone' : 'Set Milestone'}</span>
                      </motion.button>
                    </div>
                  </div>

                  <div className="roadmap-modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowQuickAddModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleQuickAddTask}
                    >
                      Add to Roadmap
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
