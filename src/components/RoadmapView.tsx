import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Milestone, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckSquare, Square, Clock, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, User, Layers, Plus, Search, Filter,
  Download, Play, Check, Trash2, Edit3, Flag, ArrowRight, Tag,
  Sparkles, X, Target, BarChart2, Kanban, Link2
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

interface TaskWithSchedule {
  card: CardType;
  columnId: string;
  columnName: string;
  columnColor?: string;
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
  if (card.progress !== undefined && card.progress !== null) return card.progress;
  if (card.completed) return 100;
  const col = (columnName || '').toLowerCase();
  if (col.includes('done') || col.includes('complete')) return 100;
  if (col.includes('review') || col.includes('qa') || col.includes('test')) return 80;
  if (col.includes('in progress') || col.includes('doing') || col.includes('active')) return 50;
  if (col.includes('urgent') || col.includes('critical')) return 25;
  if (col.includes('to do') || col.includes('todo') || col.includes('backlog')) return 10;
  return 0;
}

export function isMilestoneTask(card: CardType): boolean {
  if (card.isMilestone) return true;
  if (card.priority === 'urgent') return true;
  if ((card.labels || []).some(l => l === 'urgent' || l === 'planning')) return true;
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

  // View state
  const [scale, setScale] = useState<TimeScale>('weeks');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [groupBy, setGroupBy] = useState<GroupByMode>(() =>
    board.sprints && board.sprints.length > 0 ? 'sprint' : 'column'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Group By options with Lucide icons (No emojis, sleek neumorphic style)
  const groupByOptions: SelectOption<GroupByMode>[] = useMemo(() => [
    {
      value: 'sprint',
      label: 'By Sprint',
      icon: <Layers size={13} color="#6366f1" />,
    },
    {
      value: 'column',
      label: 'By Stage',
      icon: <Kanban size={13} color="#3b82f6" />,
    },
    {
      value: 'assignee',
      label: 'By Assignee',
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

        let end: Date;
        if (card.dueDate) {
          end = new Date(card.dueDate);
        } else if (sprint?.endDate) {
          end = new Date(sprint.endDate);
        } else if (card.createdAt) {
          end = new Date(card.createdAt);
          end.setDate(end.getDate() + 4);
        } else {
          end = new Date();
          end.setDate(end.getDate() + 4);
        }
        end.setHours(23, 59, 59, 999);

        let start: Date;
        if (card.startDate) {
          start = new Date(card.startDate);
        } else if (sprint?.startDate) {
          start = new Date(sprint.startDate);
        } else if (card.dueDate && card.createdAt) {
          const created = new Date(card.createdAt);
          const daysDiff = (end.getTime() - created.getTime()) / (1000 * 3600 * 24);
          if (daysDiff > 21) {
            start = new Date(end.getTime() - 14 * 86400000);
          } else {
            start = created;
          }
        } else if (card.createdAt) {
          start = new Date(card.createdAt);
        } else {
          start = new Date(end.getTime() - 4 * 86400000);
        }
        start.setHours(0, 0, 0, 0);

        if (start > end) {
          start = new Date(end.getTime() - 3 * 86400000);
        }

        list.push({
          card,
          columnId: col.id,
          columnName: col.name,
          columnColor: colColor,
          startDate: start,
          endDate: end,
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
            badge: sp.status === 'active' ? 'ACTIVE SPRINT' : sp.status.toUpperCase(),
            sprint: sp,
            tasks,
          });
        });

        // Backlog / Unassigned Sprint
        const backlogTasks = scheduledTasks.filter(t => !t.card.sprintId);
        if (backlogTasks.length > 0) {
          sections.push({
            id: 'backlog',
            title: 'Product Backlog / Ongoing Work',
            subtitle: 'Tasks scheduled on timeline without specific sprint assignment',
            color: '#64748b',
            badge: 'BACKLOG',
            tasks: backlogTasks,
          });
        }
      } else {
        // When no sprints have been explicitly created yet, partition using existing column stages
        const activeTasks = scheduledTasks.filter(t => {
          const c = t.columnName.toLowerCase();
          return !t.card.completed && (c.includes('in progress') || c.includes('active') || c.includes('doing') || t.card.priority === 'urgent');
        });
        const upcomingTasks = scheduledTasks.filter(t => {
          const c = t.columnName.toLowerCase();
          return !t.card.completed && !activeTasks.includes(t) && !c.includes('done');
        });
        const completedTasks = scheduledTasks.filter(t => t.card.completed || t.columnName.toLowerCase().includes('done'));

        if (activeTasks.length > 0 || (upcomingTasks.length === 0 && completedTasks.length === 0)) {
          sections.push({
            id: 'current-sprint',
            title: 'Sprint 1 (Active & In Progress)',
            subtitle: 'Active deliverables running in current work cycle',
            color: '#3b82f6',
            badge: 'ACTIVE SPRINT',
            tasks: activeTasks,
          });
        }

        if (upcomingTasks.length > 0) {
          sections.push({
            id: 'upcoming-sprint',
            title: 'Sprint 2 (Upcoming Backlog)',
            subtitle: 'Queued deliverables prepared for next sprint release',
            color: '#8b5cf6',
            badge: 'NEXT SPRINT',
            tasks: upcomingTasks,
          });
        }

        if (completedTasks.length > 0) {
          sections.push({
            id: 'completed-sprint',
            title: 'Completed Deliverables',
            subtitle: 'Shipped tasks and completed roadmap milestones',
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

  // Export Roadmap as CSV
  const handleExportCSV = () => {
    const headers = ['Title', 'Group / Column', 'Sprint', 'Assignee', 'Start Date', 'Due Date', 'Progress %', 'Status', 'Milestone'];
    const rows = allTasks.map(t => [
      `"${t.card.title.replace(/"/g, '""')}"`,
      `"${t.columnName}"`,
      `"${t.sprint ? t.sprint.name : 'Backlog'}"`,
      `"${(t.card.assignees || []).map(id => board.members?.find(m => m.id === id)?.name || id).join(', ')}"`,
      t.card.startDate || t.startDate.toISOString().split('T')[0],
      t.card.dueDate || t.endDate.toISOString().split('T')[0],
      t.card.progress ?? (t.card.completed ? 100 : 0),
      t.card.completed ? 'Completed' : (t.endDate < today ? 'Overdue' : 'In Progress'),
      t.card.isMilestone ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
                  Sprint PM
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                Agile sprint development & business timeline management
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
            style={{ minWidth: 155 }}
          />

          {/* Status Filter */}
          <NeumorphicSelect<StatusFilter>
            value={statusFilter}
            options={statusFilterOptions}
            onChange={setStatusFilter}
            size="sm"
            style={{ minWidth: 135 }}
          />

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

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  title="Create a new sprint"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                >
                  <Layers size={13} />
                  <span>+ Sprint</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowQuickAddModal(true)}
                  title="Quick add a new task to roadmap"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12 }}
                >
                  <Plus size={14} />
                  <span>Add Task</span>
                </motion.button>
              </>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              title="Export Roadmap report as CSV"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', fontSize: 12 }}
            >
              <Download size={13} />
              <span>Export</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Active Sprint Highlights Bar (When an active sprint exists) */}
      {activeSprint && (
        <div className="roadmap-active-sprint-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div className="sprint-status-dot pulse" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--foreground))' }}>
                  {activeSprint.name}
                </span>
                <span className="sprint-active-badge">CURRENT SPRINT</span>
                <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                  {formatDueDate(activeSprint.startDate)} – {formatDueDate(activeSprint.endDate)}
                </span>
              </div>
              {activeSprint.goal && (
                <div style={{ fontSize: 12, color: 'hsl(var(--foreground) / 0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>Goal:</strong> {activeSprint.goal}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <BarChart2 size={14} color="hsl(var(--primary))" />
              <span>
                <strong>{activeSprintCompleted}</strong> / {activeSprintTasks.length} tasks done
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
                  showToast(`Completed sprint "${activeSprint.name}"!`, 'success');
                }}
              >
                Complete Sprint
              </button>
            )}
          </div>
        </div>
      )}

      {/* Split-Pane: Left Task Hierarchy & Right Timeline Canvas */}
      <div className="roadmap-split-pane">
        {/* Left Side: Tasks Table */}
        <div className="roadmap-tasks-pane">
          <div className="roadmap-pane-header">
            <span style={{ flex: 1, paddingLeft: 8 }}>Task & Deliverable</span>
            <span style={{ width: 48, textAlign: 'center' }}>Prog</span>
            <span style={{ width: 85, textAlign: 'right', paddingRight: 8 }}>Timeline</span>
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
                              <span style={{ width: 36, fontSize: 10.5, fontWeight: 600, textAlign: 'right', color: 'hsl(var(--muted-foreground))' }}>
                                {progressPct}%
                              </span>

                              {/* Timeline dates */}
                              <span className={`roadmap-task-due ${isOverdue ? 'overdue' : ''}`}>
                                {formatDueDate(t.card.dueDate || t.endDate.toISOString())}
                              </span>
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
                          const taskStartMs = Math.max(viewStart.getTime(), t.startDate.getTime());
                          const taskEndMs = Math.min(viewEnd.getTime(), t.endDate.getTime());

                          // Position percentages across timeline
                          const leftPct = Math.max(0, Math.min(100, ((taskStartMs - viewStart.getTime()) / totalViewMs) * 100));
                          const rightPct = Math.max(0, Math.min(100, ((taskEndMs - viewStart.getTime()) / totalViewMs) * 100));
                          const widthPct = Math.max(1.8, rightPct - leftPct);

                          const isOverdue = !t.card.completed && t.endDate < today;
                          const progressPct = deriveCardProgress(t.card, t.columnName);
                          const isMilestone = isMilestoneTask(t.card);

                          return (
                            <div key={t.card.id} className="roadmap-bar-row">
                              {/* Milestone Diamond Marker vs Regular Bar */}
                              {isMilestone ? (
                                <motion.div
                                  whileHover={{ scale: 1.2, y: -2 }}
                                  className="roadmap-milestone-marker"
                                  style={{
                                    left: `${leftPct}%`,
                                  }}
                                  onClick={() => onOpenCard(t.card.id)}
                                  title={`Milestone: ${t.card.title} (${formatDueDate(t.card.dueDate || t.endDate.toISOString())})`}
                                >
                                  <div className="milestone-diamond" />
                                  <span className="milestone-label">{t.card.title}</span>
                                </motion.div>
                              ) : (
                                <motion.div
                                  whileHover={{ y: -1.5, scale: 1.01 }}
                                  className={`roadmap-gantt-bar ${t.card.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    backgroundColor: t.card.completed
                                      ? 'hsl(142 76% 36%)'
                                      : isOverdue
                                      ? '#ef4444'
                                      : (section.color || t.columnColor || 'hsl(var(--primary))'),
                                  }}
                                  onClick={() => onOpenCard(t.card.id)}
                                >
                                  {/* Progress Fill Layer */}
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
                    {editingSprint ? 'Edit Sprint' : 'Create Sprint'}
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
                  <label className="field-label">Sprint Name</label>
                  <input
                    type="text"
                    value={sprintName}
                    onChange={e => setSprintName(e.target.value)}
                    placeholder="e.g. Sprint 1 - Core MVP"
                    className="text-input"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">Sprint Goal</label>
                  <textarea
                    value={sprintGoal}
                    onChange={e => setSprintGoal(e.target.value)}
                    placeholder="What is the objective of this sprint?"
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
                        showToast(`Deleted sprint "${editingSprint.name}"`, 'info');
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
                    {editingSprint ? 'Save Changes' : 'Create Sprint'}
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
                    <label className="field-label">Assign Sprint</label>
                    <NeumorphicSelect
                      value={quickTaskSprintId}
                      options={[
                        { value: '', label: 'No Sprint (Backlog)', icon: <Layers size={12} /> },
                        ...(board.sprints || []).map(s => ({
                          value: s.id,
                          label: `${s.name}${s.status === 'active' ? ' (Active)' : ''}`,
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
                    <label className="field-label">Start Date</label>
                    <NeumorphicDatePicker
                      value={quickTaskStartDate || null}
                      onChange={val => setQuickTaskStartDate(val || '')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Due Date</label>
                    <NeumorphicDatePicker
                      value={quickTaskDueDate || null}
                      onChange={val => setQuickTaskDueDate(val || '')}
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
