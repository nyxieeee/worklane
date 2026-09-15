import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Milestone, ChevronLeft, ChevronRight,
  CheckSquare, Square, Clock, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, User, Layers, Plus, Search, Filter,
  Play, Check, Trash2, Edit3, Tag,
  X, Target, BarChart2, Kanban, Link2, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board, Card as CardType, Member, Sprint } from '../types';
import { LABELS } from '../types';
import { formatDueDate, avatarInitials, uid } from '../utils';
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

export function deriveCardProgress(card: CardType, columnName: string): number {
  if (card.completed) return 100;
  const col = (columnName || '').toLowerCase();
  // 100% - Handover / Closeout / Approved / Delivered / Done / Signed-off
  if (col.includes('done') || col.includes('complete') || col.includes('handover') || col.includes('closeout') || col.includes('delivered') || col.includes('approved') || col.includes('finished') || col.includes('sign-off') || col.includes('signed off')) return 100;
  // 80% - Testing / Commissioning / Inspection / Review / QA / Punch List / Validation / SAT / FAT
  if (col.includes('review') || col.includes('qa') || col.includes('test') || col.includes('inspection') || col.includes('commissioning') || col.includes('punch list') || col.includes('validation') || col.includes('sat') || col.includes('fat') || col.includes('audit')) return 80;
  // 50% - In Progress / Installation / Assembly / Construction / Rough-In / Field Work / Integration
  if (col.includes('in progress') || col.includes('doing') || col.includes('active') || col.includes('install') || col.includes('assembly') || col.includes('construction') || col.includes('execution') || col.includes('fabrication') || col.includes('wiring') || col.includes('rough-in') || col.includes('integration') || col.includes('field work') || col.includes('site work')) return 50;
  // 25% - Procurement / Ordering / Permits / Mobilization / Staging / Engineering / Submittal
  if (col.includes('urgent') || col.includes('critical') || col.includes('procurement') || col.includes('ordering') || col.includes('permit') || col.includes('mobilization') || col.includes('engineering') || col.includes('staging') || col.includes('submittal') || col.includes('triage')) return 25;
  // 10% - To Do / Planning / Design / Schematic / Backlog / Queued
  if (col.includes('to do') || col.includes('todo') || col.includes('backlog') || col.includes('planning') || col.includes('design') || col.includes('schematic') || col.includes('draft') || col.includes('queued') || col.includes('scope')) return 10;
  if (card.progress !== undefined && card.progress !== null) return card.progress;
  return 0;
}

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
  const [showProjectionComparison, setShowProjectionComparison] = useState(true);
  const [mobileTab, setMobileTab] = useState<'deliverables' | 'timeline'>('deliverables');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Group By options with Lucide icons (Universal across Construction, Systems Integration & Business PM)
  const groupByOptions: SelectOption<GroupByMode>[] = useMemo(() => [
    {
      value: 'column',
      label: 'By Stage / Phase',
      icon: <Kanban size={13} color="#3b82f6" />,
    },
    {
      value: 'sprint',
      label: 'By Project Phase',
      icon: <Layers size={13} color="#6366f1" />,
    },
    {
      value: 'assignee',
      label: 'By Assignee / Lead',
      icon: <User size={13} color="#10b981" />,
    },
    {
      value: 'label',
      label: 'By Workstream',
      icon: <Tag size={13} color="#f59e0b" />,
    },
  ], []);

  // Status Filter options with Lucide icons (No emojis, high contrast in dark mode)
  const statusFilterOptions: SelectOption<StatusFilter>[] = useMemo(() => [
    {
      value: 'all',
      label: 'All Status',
      icon: <Filter size={12} color="hsl(var(--muted-foreground))" />,
    },
    {
      value: 'active',
      label: 'Active Only',
      icon: <Clock size={12} color="#3b82f6" />,
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <CheckCircle2 size={12} color="#10b981" />,
    },
    {
      value: 'overdue',
      label: 'Overdue',
      icon: <AlertCircle size={12} color="#ef4444" />,
    },
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
        sprintId: quickTaskSprintId || null,
        assignees: quickTaskAssignee ? [quickTaskAssignee] : [],
        isMilestone: quickTaskIsMilestone,
      });
      showToast(`Added task "${quickTaskTitle.trim()}"`, 'success');
    }

    setShowQuickAddModal(false);
    setQuickTaskTitle('');
    setQuickTaskStartDate('');
    setQuickTaskDueDate('');
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

  return (
    <div className={`roadmap-view-container roadmap-mobile-mode-${mobileTab}`}>
      {/* Top Header & Toolbar */}
      <div className="roadmap-header-bar">
        <div className="roadmap-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'hsl(var(--primary) / 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--neu-shadow-raised-sm)',
              }}
            >
              <Milestone size={18} color="hsl(var(--primary))" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
                  Roadmap & Gantt
                </h2>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  PROJECT SCHEDULE
                </span>
              </div>
              <span className="roadmap-header-subtitle" style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                Milestone tracking, work packages & timeline scheduling
              </span>
            </div>
          </div>

          {/* Quick Statistics Chips */}
          <div className="roadmap-stats-chips">
            <span className="roadmap-stat-pill" title="Total Tasks on Roadmap">
              <strong>{totalCount}</strong> tasks
            </span>
            <span className="roadmap-stat-pill success" title="Completed Tasks">
              <CheckCircle2 size={12} />
              <span>{completedCount} done ({totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%)</span>
            </span>
            {milestonesCount > 0 && (
              <span className="roadmap-stat-pill" style={{ background: 'hsl(280 84% 60% / 0.15)', color: '#a855f7' }} title="Business Milestones">
                <Target size={12} />
                <span>{milestonesCount} milestones</span>
              </span>
            )}
            {overdueCount > 0 && (
              <span className="roadmap-stat-pill warning" title="Overdue Tasks">
                <AlertCircle size={12} />
                <span>{overdueCount} overdue</span>
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Action Buttons (Aligned to top header row on desktop) */}
        <div className="roadmap-toolbar-row-3">
          {!isObserver && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                className="btn btn-secondary roadmap-btn-phase"
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
                title="Create a new project delivery phase"
              >
                <span>+ Phase</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                className="btn btn-primary roadmap-btn-add-task"
                onClick={() => setShowQuickAddModal(true)}
                title="Quick add a new task to roadmap"
              >
                <span className="hide-on-mobile-inline">+ Add Task</span>
                <span className="show-on-mobile-inline">+ Task</span>
              </motion.button>
            </>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            className={`btn ${showProjectionComparison ? 'btn-primary' : 'btn-secondary'} roadmap-btn-compare`}
            onClick={() => setShowProjectionComparison(s => !s)}
            title="Switch between comparing the original plan vs actual work, or showing a clean simple bar"
          >
            <span className="hide-on-mobile-inline">{showProjectionComparison ? 'Plan vs Actual (Dual)' : 'Simple View'}</span>
            <span className="show-on-mobile-inline">{showProjectionComparison ? 'Dual' : 'Simple'}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            className="btn btn-secondary roadmap-btn-export"
            onClick={handleExportCSV}
            title="Export complete Gantt chart timeline and task data as CSV for Microsoft Excel"
          >
            <span>Export Gantt CSV</span>
          </motion.button>
        </div>
      </div>

      {/* Mobile Segmented View Switcher Tabs (Only displayed on mobile screens) */}
      <div className="roadmap-mobile-view-tabs" role="tablist" aria-label="Roadmap View Options">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'deliverables'}
          className={`mobile-view-tab ${mobileTab === 'deliverables' ? 'active' : ''}`}
          onClick={() => setMobileTab('deliverables')}
        >
          <span>Deliverables ({totalCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'timeline'}
          className={`mobile-view-tab ${mobileTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setMobileTab('timeline')}
        >
          <span>Gantt Timeline</span>
        </button>
      </div>

      {/* Controls Bar: Search, GroupBy, Status, Scale, Navigation, Legend */}
      <div className="roadmap-controls-bar">
        {/* Row 1: Search & Filter Selectors */}
        <div className="roadmap-toolbar-row-1">
          {/* Search bar */}
          <div className="roadmap-search-box">
            <Search size={13} color="hsl(var(--muted-foreground))" />
            <input
              type="text"
              placeholder="Search roadmap..."
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

          {/* Group By Selector */}
          <NeumorphicSelect<GroupByMode>
            value={groupBy}
            options={groupByOptions}
            onChange={setGroupBy}
            prefix="Group:"
            size="sm"
            style={{ minWidth: 140, flex: '1 1 auto' }}
          />

          {/* Status Filter */}
          <NeumorphicSelect<StatusFilter>
            value={statusFilter}
            options={statusFilterOptions}
            onChange={setStatusFilter}
            size="sm"
            style={{ minWidth: 125, flex: '1 1 auto' }}
          />
        </div>

        {/* Row 2: Scale Switcher & Time Navigation & Legend */}
        <div className="roadmap-toolbar-row-2">
          {/* Scale Switcher */}
          <div className="roadmap-scale-group">
            <button
              type="button"
              className={`scale-btn ${scale === 'days' ? 'active' : ''}`}
              onClick={() => setScale('days')}
            >
              Days
            </button>
            <button
              type="button"
              className={`scale-btn ${scale === 'weeks' ? 'active' : ''}`}
              onClick={() => setScale('weeks')}
            >
              Weeks
            </button>
            <button
              type="button"
              className={`scale-btn ${scale === 'months' ? 'active' : ''}`}
              onClick={() => setScale('months')}
            >
              Months
            </button>
          </div>

          {/* Time Navigation */}
          <div className="roadmap-nav-group">
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              className="btn btn-secondary today-btn"
              onClick={handleJumpToday}
              title="Jump to Today"
            >
              Today
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              className="icon-btn"
              onClick={() => handleNav('prev')}
              title="Previous window"
              style={{ width: 28, height: 28, minWidth: 28 }}
            >
              <ChevronLeft size={15} />
            </motion.button>
            <span className="roadmap-date-label">
              {viewStart.toLocaleDateString([], { month: 'short', year: 'numeric' })}
              {viewStart.getMonth() !== viewEnd.getMonth() && (
                <span> – {viewEnd.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
              )}
            </span>
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              className="icon-btn"
              onClick={() => handleNav('next')}
              title="Next window"
              style={{ width: 28, height: 28, minWidth: 28 }}
            >
              <ChevronRight size={15} />
            </motion.button>
          </div>

          {/* Visual Legend with Friendly Non-Technical Labels & Help Trigger */}
          <div className="roadmap-legend-container" title="Schedule Tracking Legend">
            <div className="roadmap-legend-item">
              <div className="roadmap-legend-swatch" style={{ backgroundColor: '#10b981' }} />
              <span>Planned Goal</span>
            </div>
            <div className="roadmap-legend-item">
              <div className="roadmap-legend-swatch" style={{ backgroundColor: '#f97316' }} />
              <span>Work Done</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpGuide(s => !s)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                fontWeight: 600,
                color: showHelpGuide ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                background: showHelpGuide ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                border: '1px solid hsl(var(--border) / 0.6)',
                borderRadius: 6,
                padding: '2px 7px',
                cursor: 'pointer',
                marginLeft: 4,
              }}
              title="Click for a quick explanation of this chart"
            >
              <HelpCircle size={12} />
              <span>{showHelpGuide ? 'Hide Guide' : 'How it works'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Friendly Explainer Guide for Non-Technical Stakeholders */}
      <AnimatePresence>
        {showHelpGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{
              overflow: 'hidden',
              margin: '6px 16px 10px',
              padding: '12px 16px',
              borderRadius: 10,
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--primary) / 0.35)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={14} color="hsl(var(--primary))" />
                How to read this chart (Quick 10-second guide)
              </span>
              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}
                title="Close guide"
              >
                <X size={13} />
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 12,
            }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10b981', marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Top Green Bar = The Plan</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>The agreed deadline. Stays fixed so everyone knows what was promised.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#f97316', marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Bottom Orange Bar = Work Done</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Real progress. Automatically pauses if no work or comments happened today.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Blue Vertical Line = Today</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Current day. If the orange bar is behind this line, the task is running late.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, transform: 'rotate(45deg)', backgroundColor: '#a855f7', marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Purple Diamond = Key Milestone</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Major checkpoints (e.g. client sign-off, permits, releases).</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Phase Highlights Bar (When an active phase exists) */}
      {activeSprint && (
        <div className="roadmap-active-sprint-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div className="sprint-status-dot pulse" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--foreground))' }}>
                  {activeSprint.name}
                </span>
                <span className="sprint-active-badge">CURRENT PHASE</span>
                <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                  {formatDueDate(activeSprint.startDate)} – {formatDueDate(activeSprint.endDate)}
                </span>
              </div>
              {activeSprint.goal && (
                <div style={{ fontSize: 12, color: 'hsl(var(--foreground) / 0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>Scope:</strong> {activeSprint.goal}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <BarChart2 size={14} color="hsl(var(--primary))" />
              <span>
                <strong>{activeSprintCompleted}</strong> / {activeSprintTasks.length} deliverables done
              </span>
              <div className="sprint-mini-progress-bar">
                <div
                  className="sprint-mini-progress-fill"
                  style={{
                    width: `${activeSprintTasks.length > 0 ? (activeSprintCompleted / activeSprintTasks.length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {!isObserver && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '3px 9px', height: 26 }}
                onClick={() => {
                  completeSprint(board.id, activeSprint.id);
                  showToast(`Completed phase "${activeSprint.name}"!`, 'success');
                }}
              >
                Complete Phase
              </button>
            )}
          </div>
        </div>
      )}

      {/* Split-Pane: Left Task Hierarchy & Right Timeline Canvas */}
      <div className={`roadmap-split-pane mobile-tab-${mobileTab}`}>
        {/* Left Side: Tasks Table */}
        <div className="roadmap-tasks-pane">
          <div className="roadmap-pane-header">
            <span style={{ flex: 1, paddingLeft: 8 }}>Task Name</span>
            <span className="hide-on-mobile-inline" style={{ width: 38, textAlign: 'center' }}>Done</span>
            <span className="hide-on-mobile-inline" style={{ width: 68, textAlign: 'center' }}>Due Date</span>
            <span className="hide-on-mobile-inline" style={{ width: 95, textAlign: 'right', paddingRight: 8 }}>Status</span>
            <span className="show-on-mobile-inline" style={{ width: 95, textAlign: 'right', paddingRight: 8 }}>Status & Due</span>
          </div>

          <div
            className="roadmap-tasks-list"
            ref={taskListRef}
            onScroll={handleTaskListScroll}
          >
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
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: section.color || 'hsl(var(--primary))',
                          flexShrink: 0
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {section.title}
                      </span>
                      {section.badge && (
                        <span className="roadmap-col-badge" style={{ fontSize: 9.5 }}>
                          {section.badge}
                        </span>
                      )}
                      <span className="roadmap-col-badge">{tasks.length}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tasks.length > 0 && (
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                          {sectionCompleted}/{tasks.length}
                        </span>
                      )}

                      {/* Sprint action menu */}
                      {section.sprint && !isObserver && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                          {section.sprint.status === 'planned' && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Start Sprint"
                              style={{ width: 22, height: 22 }}
                              onClick={() => {
                                startSprint(board.id, section.sprint!.id);
                                showToast(`Started sprint "${section.sprint!.name}"`, 'success');
                              }}
                            >
                              <Play size={11} color="#10b981" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit Sprint"
                            style={{ width: 22, height: 22 }}
                            onClick={() => {
                              setEditingSprint(section.sprint!);
                              setSprintName(section.sprint!.name);
                              setSprintGoal(section.sprint!.goal || '');
                              setSprintStartDate(section.sprint!.startDate);
                              setSprintEndDate(section.sprint!.endDate);
                              setSprintColor(section.sprint!.color || '#6366f1');
                              setShowSprintModal(true);
                            }}
                          >
                            <Edit3 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="roadmap-col-rows">
                      {tasks.length === 0 ? (
                        <div className="roadmap-empty-col-row">
                          No tasks scheduled in this group
                        </div>
                      ) : (
                        tasks.map(t => {
                          const isOverdue = !t.card.completed && t.endDate < today;
                          const assignees = (t.card.assignees || []).map(id =>
                            board.members?.find((m: Member) => m.id === id)
                          ).filter(Boolean);

                          const progressPct = deriveCardProgress(t.card, t.columnName);
                          const isMilestone = isMilestoneTask(t.card);

                          return (
                            <div
                              key={t.card.id}
                              className={`roadmap-task-row ${t.card.completed ? 'completed' : ''}`}
                              onClick={() => onOpenCard(t.card.id)}
                              title={`Open details for "${t.card.title}"`}
                            >
                              <button
                                type="button"
                                className="roadmap-check-btn"
                                onClick={(e) => handleToggleComplete(e, t.card)}
                              >
                                {t.card.completed ? (
                                  <CheckSquare size={15} color="hsl(var(--primary))" />
                                ) : (
                                  <Square size={15} color="hsl(var(--muted-foreground))" />
                                )}
                              </button>

                              {/* Milestone Diamond Badge */}
                              {isMilestone && (
                                <div
                                  title="Major Business Milestone"
                                  style={{
                                    width: 14,
                                    height: 14,
                                    transform: 'rotate(45deg)',
                                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                    borderRadius: 2,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 0 6px rgba(168, 85, 247, 0.4)'
                                  }}
                                />
                              )}

                              <span className="roadmap-task-title" title={t.card.title}>
                                {t.card.title}
                              </span>

                              {/* Dependency Indicator */}
                              {t.card.dependencies && t.card.dependencies.length > 0 && (
                                <span className="roadmap-dep-badge" title={`Depends on ${t.card.dependencies.length} tasks`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Link2 size={10} />
                                  <span>{t.card.dependencies.length}</span>
                                </span>
                              )}

                              {/* Member Avatars */}
                              {assignees.length > 0 && (
                                <div className="roadmap-task-assignees">
                                  {assignees.slice(0, 2).map((m: any) => (
                                    <AvatarBorder key={m.id} size={18} title={m.name}>
                                      {m.avatarUrl ? (
                                        <img src={m.avatarUrl} alt={m.name} style={{ width: 18, height: 18, borderRadius: '50%' }} />
                                      ) : (
                                        <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {avatarInitials(m.name)}
                                        </div>
                                      )}
                                    </AvatarBorder>
                                  ))}
                                </div>
                              )}

                              {/* Progress % (Desktop) */}
                              <span className="hide-on-mobile-inline" style={{ width: 38, fontSize: 10.5, fontWeight: 600, textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                                {progressPct}%
                              </span>

                              {/* Target Date (Desktop) */}
                              <span
                                className="hide-on-mobile-inline"
                                style={{
                                  width: 68,
                                  fontSize: 10.5,
                                  fontWeight: 500,
                                  textAlign: 'center',
                                  color: 'hsl(var(--foreground) / 0.8)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={`Target Date: ${t.targetEndDate.toLocaleDateString()}`}
                              >
                                {formatShortDate(t.targetEndDate)}
                              </span>

                              {/* Actual / Projected Date with variance (Desktop) */}
                              <div className="hide-on-mobile-flex" style={{ width: 95, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 8, whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {!t.card.completed && (
                                    <span
                                      title={t.isWorkedToday ? 'Work confirmed for today' : `Work not marked today (line held at ${formatShortDate(t.lastWorkedDate)})`}
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        backgroundColor: t.isWorkedToday ? '#10b981' : '#f59e0b',
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: t.card.completed ? '#10b981' : (t.varianceDays > 0 ? '#ef4444' : 'hsl(var(--foreground))') }}>
                                    {formatShortDate(t.actualOrProjectedEndDate)}
                                  </span>
                                </div>
                                {t.varianceDays !== 0 && (
                                  <span className={`variance-tag ${t.varianceDays > 0 ? 'delay' : 'early'}`}>
                                    {t.varianceDays > 0 ? `${t.varianceDays}d late` : `${Math.abs(t.varianceDays)}d ahead`}
                                  </span>
                                )}
                                {t.varianceDays === 0 && (
                                  <span className="variance-tag on-track">
                                    {t.card.completed ? 'On Time' : 'On schedule'}
                                  </span>
                                )}
                              </div>

                              {/* Mobile Status & Date Stack */}
                              <div className="roadmap-task-mobile-meta show-on-mobile-flex">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: progressPct === 100 ? '#10b981' : 'hsl(var(--primary))' }}>
                                    {progressPct}%
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                    {formatShortDate(t.targetEndDate)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                  {t.card.completed ? (
                                    <span style={{ fontSize: 9.5, fontWeight: 600, color: '#10b981' }}>Done</span>
                                  ) : t.varianceDays !== 0 ? (
                                    <span className={`variance-tag ${t.varianceDays > 0 ? 'delay' : 'early'}`} style={{ fontSize: 9, padding: '1px 4px' }}>
                                      {t.varianceDays > 0 ? `${t.varianceDays}d late` : `${Math.abs(t.varianceDays)}d ahead`}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>On schedule</span>
                                  )}
                                </div>
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

        {/* Right Side: Interactive Gantt Canvas */}
        <div
          className="roadmap-canvas-pane"
          ref={timelineContainerRef}
          onScroll={handleTimelineScroll}
        >
          {/* Fixed Timeline Header with Days/Weeks columns */}
          <div
            className="roadmap-timeline-header"
            style={{ width: totalTimelineWidth }}
          >
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
                <div
                  key={i}
                  className={`roadmap-timeline-cell ${isToday ? 'is-today' : ''}`}
                  style={{ width: intervalWidthPx }}
                >
                  <span className="cell-day">{label}</span>
                  <span className={`cell-num ${isToday ? 'today-pill' : ''}`}>{subLabel}</span>
                </div>
              );
            })}
          </div>

          {/* Timeline Bars Grid */}
          <div
            className="roadmap-bars-area"
            style={{ width: totalTimelineWidth }}
          >
            {/* Background Grid Lines */}
            <div className="roadmap-grid-background">
              {intervals.map((_, i) => (
                <div
                  key={i}
                  className="roadmap-grid-col"
                  style={{ width: intervalWidthPx }}
                />
              ))}
            </div>

            {/* Vertical "Today" Marker Line */}
            {isTodayInView && (
              <div
                className="roadmap-today-marker"
                style={{ left: todayXPos }}
              >
                <div className="today-badge">TODAY</div>
              </div>
            )}

            {/* Gantt Bar Rows aligned 1:1 with left table */}
            <div className="roadmap-bars-rows">
              {groupedSections.map(section => {
                const tasks = section.tasks;
                const isCollapsed = collapsedGroups[section.id];

                // If this section is a sprint, calculate its duration band across the timeline
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
                    {/* Header spacer matches column header height (34px) with optional sprint span badge */}
                    <div style={{ height: 34, position: 'relative', overflow: 'hidden' }}>
                      {sprintBand && (
                        <div
                          className="roadmap-sprint-span-indicator"
                          style={{
                            left: `${sprintBand.left}%`,
                            width: `${sprintBand.width}%`,
                            borderColor: section.color || 'hsl(var(--primary))',
                            backgroundColor: `${section.color || 'hsl(var(--primary))'}14`
                          }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 700, color: section.color || 'hsl(var(--primary))' }}>
                            {section.sprint?.name} Span
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

                          // Target baseline positions (Top Track: Planned Schedule)
                          const targetStartMs = Math.max(viewStart.getTime(), t.targetStartDate.getTime());
                          const targetEndMs = Math.min(viewEnd.getTime(), t.targetEndDate.getTime());
                          const targetLeftPct = Math.max(0, Math.min(100, ((targetStartMs - viewStart.getTime()) / totalViewMs) * 100));
                          const targetRightPct = Math.max(0, Math.min(100, ((targetEndMs - viewStart.getTime()) / totalViewMs) * 100));
                          const targetWidthPct = Math.max(2.0, targetRightPct - targetLeftPct);

                          // Actual schedule positions (Bottom Track: Accomplished / Done)
                          const actualStartMs = Math.max(viewStart.getTime(), t.actualStartDate.getTime());
                          const actualEndMs = Math.min(viewEnd.getTime(), t.actualOrProjectedEndDate.getTime());
                          const actualLeftPct = Math.max(0, Math.min(100, ((actualStartMs - viewStart.getTime()) / totalViewMs) * 100));
                          const actualRightPct = Math.max(0, Math.min(100, ((actualEndMs - viewStart.getTime()) / totalViewMs) * 100));
                          const actualTotalWidthPct = Math.max(2.0, actualRightPct - actualLeftPct);
                          const actualWidthPct = actualTotalWidthPct;

                          // For the orange fill:
                          // 1. If completed: full bar to actualEndMs
                          // 2. If active AND worked today: fills up to today
                          // 3. If active AND NOT worked today: fills up to lastWorkedDate (does NOT move to today!)
                          let fillCapMs: number;
                          if (t.card.completed) {
                            fillCapMs = actualEndMs;
                          } else if (t.isWorkedToday) {
                            fillCapMs = Math.min(actualEndMs, today.getTime() + 12 * 3600000);
                          } else if (t.lastWorkedDate) {
                            fillCapMs = Math.min(actualEndMs, Math.max(actualStartMs, t.lastWorkedDate.getTime()));
                          } else {
                            // Work has not started or not marked yet
                            fillCapMs = actualStartMs;
                          }
                          const fillRightPct = Math.max(actualLeftPct, Math.min(actualRightPct, ((fillCapMs - viewStart.getTime()) / totalViewMs) * 100));
                          // doneRatio within the track width
                          const doneRatio = t.card.completed
                            ? 1
                            : (actualTotalWidthPct > 0
                                ? Math.max(0, Math.min(1, (fillRightPct - actualLeftPct) / actualTotalWidthPct))
                                : 0);

                          const friendlyStatus = t.card.completed
                            ? 'Completed on time'
                            : t.varianceDays > 0
                              ? `Behind schedule by ${t.varianceDays} ${t.varianceDays === 1 ? 'day' : 'days'}`
                              : t.varianceDays < 0
                                ? `Ahead of schedule by ${Math.abs(t.varianceDays)} ${Math.abs(t.varianceDays) === 1 ? 'day' : 'days'}`
                                : 'On schedule';

                          const actualTooltip = [
                            `📋 Task: ${t.card.title}`,
                            `📅 Planned Goal: ${formatShortDate(t.targetStartDate)} to ${formatShortDate(t.targetEndDate)}`,
                            `📊 Work Accomplished: ${progressPct}%`,
                            `🚦 Status: ${friendlyStatus}`,
                            !t.card.completed
                              ? (t.isWorkedToday
                                  ? '✅ Daily Work: Confirmed for today'
                                  : `⏸️ Daily Work: Paused today (held at ${formatShortDate(t.lastWorkedDate)})`)
                              : null,
                            t.suspendedDays > 0
                              ? `⏸️ Paused / Suspended: ${t.suspendedDays} ${t.suspendedDays === 1 ? 'day' : 'days'}`
                              : null,
                          ].filter(Boolean).join('\n');

                          return (
                            <div key={t.card.id} className="roadmap-bar-row">
                              {/* Mobile-only sticky task title pill so user knows which row is which during horizontal scroll */}
                              <div className="roadmap-mobile-row-label" title={t.card.title}>
                                <span className="mobile-row-title">{t.card.title}</span>
                              </div>

                              {showProjectionComparison ? (
                                <>
                                  {/* Top Track: Target Baseline (Solid Green Bar matching Excel reference) */}
                                  <div
                                    className="roadmap-target-baseline-bar"
                                    style={{
                                      left: `${targetLeftPct}%`,
                                      width: `${targetWidthPct}%`,
                                    }}
                                    onClick={() => onOpenCard(t.card.id)}
                                    title={`Planned Goal: ${formatShortDate(t.targetStartDate)} to ${formatShortDate(t.targetEndDate)}`}
                                  >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      {isMilestone && (
                                        <span
                                          style={{
                                            width: 7,
                                            height: 7,
                                            transform: 'rotate(45deg)',
                                            backgroundColor: '#fff',
                                            borderRadius: 1,
                                            flexShrink: 0,
                                          }}
                                          title="Milestone Deliverable"
                                        />
                                      )}
                                      Goal: {formatShortDate(t.targetEndDate)}
                                    </span>
                                  </div>

                                  {/* Bottom Track: Actual / Accomplished (Fills ONLY for deliverables/tasks done for that day) */}
                                  <div
                                    className="roadmap-actual-track"
                                    style={{
                                      left: `${actualLeftPct}%`,
                                      width: `${actualTotalWidthPct}%`,
                                    }}
                                    onClick={() => onOpenCard(t.card.id)}
                                    title={actualTooltip}
                                  >
                                    {/* Filled portion: Fills ONLY for task or deliverable done for that day */}
                                    <div
                                      className={`roadmap-actual-filled-bar ${t.card.completed ? 'completed' : ''}`}
                                      style={{
                                        width: `${doneRatio * 100}%`,
                                        ...((!t.card.completed && !t.isWorkedToday) ? { opacity: 0.85 } : {}),
                                      }}
                                    >
                                      {doneRatio > 0 && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          {t.card.completed ? (
                                            <>
                                              <span>Done</span>
                                              <CheckCircle2 size={10} color="#fff" />
                                            </>
                                          ) : (
                                            <>
                                              <span>{progressPct}%</span>
                                              {!t.isWorkedToday && (
                                                <span style={{ fontSize: 8.5, opacity: 0.9, backgroundColor: 'rgba(0,0,0,0.35)', padding: '1px 3.5px', borderRadius: 3 }} title="Work paused today: mark worked today or add a comment/attachment to advance">
                                                  Paused
                                                </span>
                                              )}
                                            </>
                                          )}
                                          {isMilestone && (
                                            <span
                                              style={{
                                                width: 7,
                                                height: 7,
                                                transform: 'rotate(45deg)',
                                                backgroundColor: '#fff',
                                                borderRadius: 1,
                                                flexShrink: 0,
                                                marginLeft: 2,
                                              }}
                                              title="Milestone Accomplishment"
                                            />
                                          )}
                                        </span>
                                      )}
                                    </div>

                                    {/* Slipped extension striped zone if delayed */}
                                    {t.varianceDays > 0 && !t.card.completed && targetRightPct < actualRightPct && (
                                      <div
                                        className="roadmap-slipped-extension"
                                        style={{
                                          left: `${Math.max(0, ((targetRightPct - actualLeftPct) / actualTotalWidthPct) * 100)}%`,
                                          right: 0,
                                        }}
                                        title={`Behind schedule by ${t.varianceDays} ${t.varianceDays === 1 ? 'day' : 'days'}`}
                                      />
                                    )}

                                    {/* Unfilled track label if progress < 60% */}
                                    {doneRatio < 0.6 && (
                                      <span className="roadmap-actual-track-label">
                                        {doneRatio === 0 ? '0% done' : `${progressPct}%`}
                                        {t.varianceDays > 0 && !t.card.completed && ` (${t.varianceDays}d late)`}
                                      </span>
                                    )}

                                    {/* Milestone indicator badge if task is a milestone */}
                                    {isMilestone && (
                                      <div
                                        title={`Milestone deliverable: ${t.card.title}`}
                                        style={{
                                          position: 'absolute',
                                          right: 4,
                                          width: 8,
                                          height: 8,
                                          transform: 'rotate(45deg)',
                                          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                          borderRadius: 1,
                                          border: '1px solid #fff',
                                          boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                                          zIndex: 5,
                                          pointerEvents: 'none',
                                        }}
                                      />
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* Standard Single Bar Fallback */
                                isMilestone ? (
                                  <motion.div
                                    whileHover={{ scale: 1.2, y: -2 }}
                                    className="roadmap-milestone-marker"
                                    style={{
                                      left: `${actualLeftPct}%`,
                                    }}
                                    onClick={() => onOpenCard(t.card.id)}
                                    title={`Milestone: ${t.card.title} (${formatShortDate(t.actualOrProjectedEndDate)})`}
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
                                      width: `${actualWidthPct}%`,
                                      top: 13,
                                      backgroundColor: t.card.completed
                                        ? '#10b981'
                                        : (section.color || t.columnColor || 'hsl(var(--primary))'),
                                    }}
                                    onClick={() => onOpenCard(t.card.id)}
                                    title={`${t.card.title}\nDue: ${formatShortDate(t.targetEndDate)}\nStatus: ${t.card.completed ? 'Completed' : `${progressPct}% done (${friendlyStatus})`}`}
                                  >
                                    <div
                                      className="roadmap-bar-progress-fill"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                    <div className="roadmap-bar-content">
                                      <span className="bar-title">{t.card.title}</span>
                                      {t.card.completed && <CheckCircle2 size={12} color="#fff" style={{ flexShrink: 0 }} />}
                                      {!t.card.completed && progressPct > 0 && (
                                        <span className="bar-progress-tag">{progressPct}%</span>
                                      )}
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

      {/* Unscheduled Tasks Bottom Drawer / Tray */}
      {unscheduledTasks.length > 0 && (
        <div className="roadmap-unscheduled-tray">
          <div
            className="tray-toggle-header"
            onClick={() => setShowUnscheduled(s => !s)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={14} color="hsl(var(--muted-foreground))" />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                Unscheduled Tasks ({unscheduledTasks.length})
              </span>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                — click task to set start/due dates or assign to a sprint
              </span>
            </div>
            {showUnscheduled ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>

          <AnimatePresence>
            {showUnscheduled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="tray-content"
              >
                <div className="unscheduled-cards-grid">
                  {unscheduledTasks.map(t => (
                    <div
                      key={t.card.id}
                      className="unscheduled-card-pill"
                      onClick={() => onOpenCard(t.card.id)}
                      title="Click to schedule onto Gantt"
                    >
                      <span className="dot" style={{ backgroundColor: t.columnColor || 'hsl(var(--primary))' }} />
                      <span className="title">{t.card.title}</span>
                      <span className="col-name">{t.columnName}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
                        Add Task / Milestone to Roadmap
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
                      <label className="field-label">Task Title</label>
                      <input
                        type="text"
                        value={quickTaskTitle}
                        onChange={e => setQuickTaskTitle(e.target.value)}
                        placeholder="e.g. Implement user authentication flow"
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
                        <label className="field-label">Start Date</label>
                        <NeumorphicDatePicker
                          value={quickTaskStartDate || null}
                          onChange={val => setQuickTaskStartDate(val ? val.split('T')[0] : '')}
                          align="left"
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Due Date</label>
                        <NeumorphicDatePicker
                          value={quickTaskDueDate || null}
                          onChange={val => setQuickTaskDueDate(val ? val.split('T')[0] : '')}
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
