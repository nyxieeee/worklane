import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Milestone, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckSquare, Square, Clock, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, User, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board, Card as CardType, Member } from '../types';
import { formatDueDate, avatarInitials, getDueStatus } from '../utils';
import { useWorkStore } from '../store/useWorkStore';
import AvatarBorder from './ui/AvatarBorder';

interface Props {
  board: Board;
  onOpenCard: (cardId: string) => void;
  isObserver?: boolean;
}

type TimeScale = 'days' | 'weeks' | 'months';

interface TaskWithCol {
  card: CardType;
  columnId: string;
  columnName: string;
  columnColor?: string;
  startDate: Date;
  endDate: Date;
  hasDueDate: boolean;
}

export default function RoadmapView({ board, onOpenCard, isObserver }: Props) {
  const updateCard = useWorkStore(s => s.updateCard);
  const [scale, setScale] = useState<TimeScale>('days');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Sync scroll between left task list and right timeline canvas
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
      // 28-day window centered or spanning from 7 days before base
      const start = new Date(base);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 27);

      const days: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        days.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return { startDate: start, endDate: end, intervals: days };
    } else if (scale === 'weeks') {
      // 12 weeks window
      const start = new Date(base);
      start.setDate(start.getDate() - start.getDay() - 14); // 2 weeks prior
      const end = new Date(start);
      end.setDate(end.getDate() + (12 * 7) - 1);

      const weeks: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        weeks.push(new Date(curr));
        curr.setDate(curr.getDate() + 7);
      }
      return { startDate: start, endDate: end, intervals: weeks };
    } else {
      // 6 months window
      const start = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 5, 0);

      const months: Date[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
      }
      return { startDate: start, endDate: end, intervals: months };
    }
  }, [currentDate, scale]);

  // Total milliseconds in view
  const totalViewMs = Math.max(1, viewEnd.getTime() - viewStart.getTime());

  // Flatten cards and calculate start & end dates
  const { scheduledTasks, unscheduledTasks, tasksByColumn } = useMemo(() => {
    const scheduled: TaskWithCol[] = [];
    const unscheduled: TaskWithCol[] = [];
    const byCol: Record<string, TaskWithCol[]> = {};

    board.columns?.forEach((col, colIdx) => {
      byCol[col.id] = [];
      col.cards?.forEach(card => {
        const hasDueDate = Boolean(card.dueDate);
        let end = card.dueDate ? new Date(card.dueDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let start: Date;
        if (card.createdAt) {
          start = new Date(card.createdAt);
          start.setHours(0, 0, 0, 0);
          if (start > end) {
            start = new Date(end);
            start.setDate(start.getDate() - 3);
          }
        } else {
          start = new Date(end);
          start.setDate(start.getDate() - 3);
        }

        // Palette accent per column index
        const colColors = [
          '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899'
        ];
        const columnColor = colColors[colIdx % colColors.length];

        const item: TaskWithCol = {
          card,
          columnId: col.id,
          columnName: col.name,
          columnColor,
          startDate: start,
          endDate: end,
          hasDueDate,
        };

        if (hasDueDate) {
          scheduled.push(item);
          byCol[col.id].push(item);
        } else {
          unscheduled.push(item);
        }
      });
    });

    return { scheduledTasks: scheduled, unscheduledTasks: unscheduled, tasksByColumn: byCol };
  }, [board]);

  // Quick stats
  const totalCount = scheduledTasks.length + unscheduledTasks.length;
  const completedCount = scheduledTasks.filter(t => t.card.completed).length + unscheduledTasks.filter(t => t.card.completed).length;
  const overdueCount = scheduledTasks.filter(t => !t.card.completed && t.endDate < today).length;

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
    });
  };

  const toggleCol = (colId: string) => {
    setCollapsedCols(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  // Calculate pixel width per interval based on scale
  const intervalWidthPx = scale === 'days' ? 52 : scale === 'weeks' ? 90 : 130;
  const totalTimelineWidth = intervals.length * intervalWidthPx;

  // Calculate Today marker X position percentage
  const todayMs = today.getTime() + 12 * 3600 * 1000;
  const todayProgress = (todayMs - viewStart.getTime()) / totalViewMs;
  const isTodayInView = todayProgress >= 0 && todayProgress <= 1;
  const todayXPos = todayProgress * totalTimelineWidth;

  return (
    <div className="roadmap-view-container">
      {/* Top Header & Toolbar */}
      <div className="roadmap-header-bar">
        <div className="roadmap-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Milestone size={18} color="hsl(var(--primary))" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
              Roadmap
            </h2>
          </div>

          <div className="roadmap-stats-chips">
            <span className="roadmap-stat-pill" title="Total Tasks">
              <strong>{totalCount}</strong> tasks
            </span>
            <span className="roadmap-stat-pill success" title="Completed Tasks">
              <CheckCircle2 size={12} />
              <span>{completedCount} done</span>
            </span>
            {overdueCount > 0 && (
              <span className="roadmap-stat-pill warning" title="Overdue Tasks">
                <AlertCircle size={12} />
                <span>{overdueCount} overdue</span>
              </span>
            )}
          </div>
        </div>

        <div className="roadmap-header-right">
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
              title="Previous interval"
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
              title="Next interval"
              style={{ width: 28, height: 28, minWidth: 28 }}
            >
              <ChevronRight size={15} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Split-Pane: Left Task Hierarchy & Right Timeline Canvas */}
      <div className="roadmap-split-pane">
        {/* Left Side: Tasks Table */}
        <div className="roadmap-tasks-pane">
          <div className="roadmap-pane-header">
            <span style={{ flex: 1, paddingLeft: 8 }}>Task</span>
            <span style={{ width: 85, textAlign: 'right', paddingRight: 8 }}>Due</span>
          </div>

          <div
            className="roadmap-tasks-list"
            ref={taskListRef}
            onScroll={handleTaskListScroll}
          >
            {board.columns?.map(col => {
              const tasks = tasksByColumn[col.id] || [];
              const isCollapsed = collapsedCols[col.id];

              return (
                <div key={col.id} className="roadmap-col-group">
                  <div
                    className="roadmap-col-header"
                    onClick={() => toggleCol(col.id)}
                    title="Click to collapse/expand"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{col.name}</span>
                      <span className="roadmap-col-badge">{tasks.length}</span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="roadmap-col-rows">
                      {tasks.length === 0 ? (
                        <div className="roadmap-empty-col-row">
                          No scheduled tasks
                        </div>
                      ) : (
                        tasks.map(t => {
                          const isOverdue = !t.card.completed && t.endDate < today;
                          const assignees = (t.card.assignees || []).map(id =>
                            board.members?.find((m: Member) => m.id === id)
                          ).filter(Boolean);

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

                              <span className="roadmap-task-title" title={t.card.title}>
                                {t.card.title}
                              </span>

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

                              <span className={`roadmap-task-due ${isOverdue ? 'overdue' : ''}`}>
                                {formatDueDate(t.card.dueDate)}
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
              {board.columns?.map(col => {
                const tasks = tasksByColumn[col.id] || [];
                const isCollapsed = collapsedCols[col.id];

                return (
                  <div key={col.id} className="roadmap-col-bars-group">
                    {/* Header spacer matches column header height (34px) */}
                    <div style={{ height: 34 }} />

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

                          return (
                            <div key={t.card.id} className="roadmap-bar-row">
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
                                    : (t.columnColor || 'hsl(var(--primary))'),
                                }}
                                onClick={() => onOpenCard(t.card.id)}
                              >
                                <span className="bar-title">{t.card.title}</span>
                                {t.card.completed && <CheckCircle2 size={12} color="#fff" style={{ flexShrink: 0 }} />}
                              </motion.div>
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
                — click task to set a due date and map on Gantt
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
                      title="Click to open and set due date"
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
    </div>
  );
}
