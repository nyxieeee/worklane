import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Milestone, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckSquare, Square, Clock, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, User, Layers, Plus, Search, Filter,
  Download, Play, Check, Trash2, Edit3, Flag, ArrowRight, Tag,
  Sparkles, X, Target, BarChart2, Kanban, Link2, GitCompare, TrendingUp
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
              // Task past target date: projected date extends from today based on remaining progress
              const remainingPct = Math.max(0.1, (100 - progressPct) / 100);
              const extraDays = Math.max(1, Math.ceil(plannedDays * remainingPct));
              actOrProjEnd = new Date(today.getTime() + extraDays * 86400000);
            } else if (today.getTime() > targetStart.getTime()) {
              // Task in flight: project slippage if pace is lagging
              const elapsedDays = Math.max(1, Math.round((today.getTime() - targetStart.getTime()) / 86400000));
              const expectedPct = Math.min(100, Math.round((elapsedDays / plannedDays) * 100));
              if (progressPct < expectedPct - 15) {
                const pace = Math.max(0.05, progressPct / elapsedDays);
                const totalProjDays = Math.ceil(100 / pace);
                const slip = Math.max(1, totalProjDays - plannedDays);
                actOrProjEnd = new Date(targetEnd.getTime() + slip * 86400000);
              } else {
                actOrProjEnd = new Date(targetEnd);
              }
            } else {
              actOrProjEnd = new Date(targetEnd);
            }
          }
        }
        actOrProjEnd.setHours(23, 59, 59, 999);

        // 5. Variance (in days)
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
      showToast('Sprint name is required', 'warning');
      return;
    }
    if (!sprintStartDate || !sprintEndDate) {
      showToast('Start and end dates are required for a sprint', 'warning');
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
      showToast(`Updated sprint "${sprintName.trim()}"`, 'success');
    } else {
      createSprint(
        board.id,
        sprintName.trim(),
        sprintStartDate,
        sprintEndDate,
        sprintGoal.trim(),
        sprintColor
      );
      showToast(`Created new sprint "${sprintName.trim()}"`, 'success');
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

  // Export Roadmap as CSV (formatted for clean Microsoft Excel display)
  const handleExportCSV = () => {
    const headers = [
      'Title',
      'Group / Column',
      'Sprint',
      'Assignee',
      'Start Date',
      'Due Date',
      'Progress %',
      'Status',
      'Milestone',
      'Actual / Projected Date'
    ];
    const rows = allTasks.map(t => [
      `"${(t.card.title || '').replace(/"/g, '""')}"`,
      `"${(t.columnName || '').replace(/"/g, '""')}"`,
      `"${(t.sprint ? t.sprint.name : 'Backlog').replace(/"/g, '""')}"`,
      `"${(t.card.assignees || []).map(id => board.members?.find(m => m.id === id)?.name || id).join(', ').replace(/"/g, '""')}"`,
      formatDateForExport(t.card.startDate || t.targetStartDate),
      formatDateForExport(t.card.dueDate || t.targetEndDate),
      t.card.progress ?? (t.card.completed ? 100 : deriveCardProgress(t.card, t.columnName)),
      t.card.completed ? 'Completed' : (t.targetEndDate < today ? 'Overdue' : 'In Progress'),
      t.card.isMilestone ? 'Yes' : 'No',
      formatDateForExport(t.actualOrProjectedEndDate)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    // Prepend UTF-8 BOM so Microsoft Excel automatically recognizes character encoding and dates
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${board.name.toLowerCase().replace(/\s+/g, '-')}-roadmap-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Roadmap CSV exported successfully', 'success');
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
    <div className="roadmap-view-container">
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
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
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

        {/* Header Right: GroupBy, Search, Scales, Actions */}
        <div className="roadmap-header-right">
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

          {/* Row 2: Scale Switcher & Time Navigation */}
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

            {/* Visual Legend matching Excel S-curve reference (Target on top in Green, Actual on bottom in Orange) */}
            <div className="roadmap-legend-container" title="Schedule Tracking Legend">
              <div className="roadmap-legend-item">
                <div className="roadmap-legend-swatch" style={{ backgroundColor: '#10b981' }} />
                <span>Target (Planned)</span>
              </div>
              <div className="roadmap-legend-item">
                <div className="roadmap-legend-swatch" style={{ backgroundColor: '#f97316' }} />
                <span>Actual (Accomplished)</span>
              </div>
            </div>
          </div>

          {/* Row 3: Action Buttons */}
          <div className="roadmap-toolbar-row-3">
            {!isObserver && (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="btn btn-secondary"
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
                  <Layers size={13} />
                  <span>+ Phase</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="btn btn-primary roadmap-btn-add-task"
                  onClick={() => setShowQuickAddModal(true)}
                  title="Quick add a new task to roadmap"
                >
                  <Plus size={13} />
                  <span className="hide-on-mobile-inline">Add Task</span>
                  <span className="show-on-mobile-inline">Task</span>
                </motion.button>
              </>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className={`btn ${showProjectionComparison ? 'btn-primary' : 'btn-secondary'} roadmap-btn-compare`}
              onClick={() => setShowProjectionComparison(s => !s)}
              title="Toggle Target Baseline vs Actual / Projected Schedule Comparison"
            >
              <GitCompare size={13} />
              <span className="hide-on-mobile-inline">{showProjectionComparison ? 'Target vs Actual: ON' : 'Single Bar'}</span>
              <span className="show-on-mobile-inline">{showProjectionComparison ? 'Target/Actual' : 'Single'}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn btn-secondary roadmap-btn-export"
              onClick={handleExportCSV}
              title="Export Roadmap report as CSV"
            >
              <Download size={13} />
              <span>Export</span>
            </motion.button>
          </div>
        </div>
      </div>

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

      {/* Mobile Segmented View Switcher Tabs (Only displayed on mobile screens) */}
      <div className="roadmap-mobile-view-tabs" role="tablist" aria-label="Roadmap View Options">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'deliverables'}
          className={`mobile-view-tab ${mobileTab === 'deliverables' ? 'active' : ''}`}
          onClick={() => setMobileTab('deliverables')}
        >
          <CheckSquare size={13} />
          <span>Deliverables ({totalCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'timeline'}
          className={`mobile-view-tab ${mobileTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setMobileTab('timeline')}
        >
          <CalendarIcon size={13} />
          <span>Gantt Timeline</span>
        </button>
      </div>

      {/* Split-Pane: Left Task Hierarchy & Right Timeline Canvas */}
      <div className={`roadmap-split-pane mobile-tab-${mobileTab}`}>
        {/* Left Side: Tasks Table */}
        <div className="roadmap-tasks-pane">
          <div className="roadmap-pane-header">
            <span style={{ flex: 1, paddingLeft: 8 }}>Task & Deliverable</span>
            <span style={{ width: 38, textAlign: 'center' }}>Prog</span>
            <span style={{ width: 68, textAlign: 'center' }}>Target</span>
            <span style={{ width: 95, textAlign: 'right', paddingRight: 8 }}>Actual / Proj</span>
          </div>

          <div
            className="roadmap-tasks-list"
            ref={taskListRef}
            onScroll={handleTaskListScroll}
          >
            {groupedSections.map(section => {
              const tasks = section.tasks;
              const isCollapsed = collapsedGroups[section.id];
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

                              {/* Progress % */}
                              <span style={{ width: 38, fontSize: 10.5, fontWeight: 600, textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                                {progressPct}%
                              </span>

                              {/* Target Date */}
                              <span
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

                              {/* Actual / Projected Date with variance */}
                              <div style={{ width: 95, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: 8, whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: t.card.completed ? '#10b981' : (t.varianceDays > 0 ? '#ef4444' : 'hsl(var(--foreground))') }}>
                                  {formatShortDate(t.actualOrProjectedEndDate)}
                                </span>
                                {t.varianceDays !== 0 && (
                                  <span className={`variance-tag ${t.varianceDays > 0 ? 'delay' : 'early'}`}>
                                    {t.varianceDays > 0 ? `+${t.varianceDays}d` : `${t.varianceDays}d`}
                                  </span>
                                )}
                                {t.varianceDays === 0 && (
                                  <span className="variance-tag on-track">
                                    {t.card.completed ? 'On Time' : 'On Track'}
                                  </span>
                                )}
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

                          // Ratio of work actually completed (0.0 to 1.0)
                          // The actual will only fill for every task or deliverable done for that day
                          const doneRatio = t.card.completed ? 1 : Math.max(0, Math.min(1, progressPct / 100));

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
                                    title={`Target (Planned): ${formatShortDate(t.targetStartDate)} → ${formatShortDate(t.targetEndDate)}`}
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
                                      Target: {formatShortDate(t.targetEndDate)}
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
                                    title={`Actual Schedule: ${formatShortDate(t.actualStartDate)} → ${formatShortDate(t.actualOrProjectedEndDate)}\nStatus: ${t.card.completed ? 'Completed' : (doneRatio > 0 ? `${progressPct}% accomplished` : 'Not started (0% done)')}`}
                                  >
                                    {/* Filled portion: Fills ONLY for task or deliverable done for that day */}
                                    <div
                                      className={`roadmap-actual-filled-bar ${t.card.completed ? 'completed' : ''}`}
                                      style={{
                                        width: `${doneRatio * 100}%`,
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
                                            <span>{progressPct}%</span>
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
                                        title={`Projected Delay: +${t.varianceDays} days`}
                                      />
                                    )}

                                    {/* Unfilled track label if progress < 60% */}
                                    {doneRatio < 0.6 && (
                                      <span className="roadmap-actual-track-label">
                                        {doneRatio === 0 ? '0% done' : `${progressPct}%`}
                                        {t.varianceDays > 0 && !t.card.completed && ` (+${t.varianceDays}d)`}
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

      {/* ── Sprint Create / Edit Modal ── */}
      <AnimatePresence>
        {showSprintModal && (
          <div className="modal-backdrop" onClick={() => setShowSprintModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-card"
              style={{ maxWidth: 440, padding: 22 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} color="hsl(var(--primary))" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {editingSprint ? 'Edit Phase' : 'Create Project Phase'}
                  </h3>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowSprintModal(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    <input
                      type="date"
                      value={sprintStartDate}
                      onChange={e => setSprintStartDate(e.target.value)}
                      className="text-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">End Date</label>
                    <input
                      type="date"
                      value={sprintEndDate}
                      onChange={e => setSprintEndDate(e.target.value)}
                      className="text-input"
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  {editingSprint && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ color: 'hsl(var(--destructive))' }}
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Quick Add Task Modal ── */}
      <AnimatePresence>
        {showQuickAddModal && (
          <div className="modal-backdrop" onClick={() => setShowQuickAddModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-card"
              style={{ maxWidth: 460, padding: 22 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} color="hsl(var(--primary))" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Add Task / Milestone to Roadmap
                  </h3>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowQuickAddModal(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                        icon: <Kanban size={12} color="hsl(var(--primary))" />,
                      }))}
                      onChange={setQuickTaskColumnId}
                      size="sm"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Assign Project Phase</label>
                    <NeumorphicSelect
                      value={quickTaskSprintId}
                      options={[
                        { value: '', label: 'No Phase (General Timeline)', icon: <Layers size={12} /> },
                        ...(board.sprints || []).map(s => ({
                          value: s.id,
                          label: `${s.name}${s.status === 'active' ? ' (Current Phase)' : ''}`,
                          icon: <Layers size={12} color={s.color || '#6366f1'} />,
                        }))
                      ]}
                      onChange={setQuickTaskSprintId}
                      size="sm"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="field-label">Target Start</label>
                    <NeumorphicDatePicker
                      value={quickTaskStartDate || null}
                      onChange={val => setQuickTaskStartDate(val || '')}
                      align="left"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Target Date (Due)</label>
                    <NeumorphicDatePicker
                      value={quickTaskDueDate || null}
                      onChange={val => setQuickTaskDueDate(val || '')}
                      align="right"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="field-label">Assignee</label>
                    <NeumorphicSelect
                      value={quickTaskAssignee}
                      options={[
                        { value: '', label: 'Unassigned', icon: <User size={12} /> },
                        ...(board.members || []).map(m => ({
                          value: m.id,
                          label: m.name,
                          icon: <User size={12} color={m.color || '#6366f1'} />,
                        }))
                      ]}
                      onChange={setQuickTaskAssignee}
                      size="sm"
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
                    <Milestone size={13} color={quickTaskIsMilestone ? '#fff' : 'hsl(var(--primary))'} />
                    <span>{quickTaskIsMilestone ? 'Milestone' : 'Set Milestone'}</span>
                  </motion.button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
