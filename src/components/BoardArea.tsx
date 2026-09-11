import React, { useState, useMemo } from 'react';
import {
  Plus, Edit3, Trash2, Layout, Check, X, Inbox,
  Calendar, CheckSquare, Square, Filter, ChevronRight, ChevronLeft, User, Eye
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';
import Column from './Column';
import { InboxDrawer } from './InboxDrawer';
import { formatDueDate, avatarInitials, useIsMobile } from '../utils';
import { LABELS, type Member, type Card, type Column as ColumnType } from '../types';
import { sortColumnsByWorkflow } from '../store/useWorkStore';

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface DragState {
  cardId: string;
  fromColId: string;
  fromInbox?: boolean;
}

interface ContextMenu {
  colId: string;
  x: number;
  y: number;
}

interface Props {
  viewMode: 'board' | 'list' | 'calendar';
  filterMemberId: string | null;
  onClearFilter: () => void;
  onOpenCard: (cardId: string) => void;
  onAddColumn: () => void;
  onCreateBoard: () => void;
  showInbox?: boolean;
  onToggleInbox?: () => void;
}

const view3DVariants: Variants = {
  initial: { opacity: 0, rotateY: -6, translateZ: -30 },
  animate: { opacity: 1, rotateY: 0, translateZ: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, rotateY: 6, translateZ: -30, transition: { duration: 0.15 } }
};

export default function BoardArea({
  viewMode,
  filterMemberId,
  onClearFilter,
  onOpenCard,
  onAddColumn,
  onCreateBoard,
  showInbox: controlledShowInbox,
  onToggleInbox: controlledToggleInbox,
}: Props) {
  const boards             = useWorkStore(s => s.boards);
  const activeBoardId      = useWorkStore(s => s.activeBoardId);
  const board              = useMemo(() => boards.find(b => b.id === activeBoardId) || null, [boards, activeBoardId]);
  const deleteColumn       = useWorkStore(s => s.deleteColumn);
  const renameColumn       = useWorkStore(s => s.renameColumn);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const showToast          = useToastStore(s => s.showToast);
  const currentUser        = useAuthStore(s => s.user);
  const isMobile           = useIsMobile(860);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [internalShowInbox, setInternalShowInbox] = useState(false);
  const showInbox = controlledShowInbox !== undefined ? controlledShowInbox : internalShowInbox;
  const toggleInbox = controlledToggleInbox || (() => setInternalShowInbox(v => !v));
  const [renameColId, setRenameColId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  // Calendar navigation: tracks year+month offset from today
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());

  const goPrevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };
  const goToday = () => { setCalendarYear(today.getFullYear()); setCalendarMonth(today.getMonth()); };

  // Build the full month grid (leading + current + trailing days to fill 7-col rows)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay  = new Date(calendarYear, calendarMonth + 1, 0);
    const leadingDays  = firstDay.getDay(); // 0=Sun
    const trailingDays = 6 - lastDay.getDay();
    const days: Date[] = [];
    for (let i = leadingDays; i > 0; i--) {
      days.push(new Date(calendarYear, calendarMonth, 1 - i));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(calendarYear, calendarMonth, d));
    }
    for (let i = 1; i <= trailingDays; i++) {
      days.push(new Date(calendarYear, calendarMonth + 1, i));
    }
    return days;
  }, [calendarYear, calendarMonth]);

  const handleRenameConfirm = () => {
    if (!renameColId || !renameValue.trim()) return;
    renameColumn(renameColId, renameValue.trim());
    setShowRenameModal(false);
    setRenameColId(null);
  };

  if (!board) {
    return (
      <div className="board-area" style={{ alignItems: 'center', justifyContent: 'center', perspective: 1000 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          style={{ textAlign: 'center', maxWidth: 420, padding: 36, borderRadius: 'var(--radius)', boxShadow: 'var(--neu-shadow-raised)', backgroundColor: 'hsl(var(--card))', transformStyle: 'preserve-3d' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--primary))',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <Layout size={26} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 6 }}>
            Welcome to Worklane
          </h2>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5, marginBottom: 20 }}>
            Create your first board from the sidebar or click below to organize your workspace.
          </p>
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onCreateBoard}>
            <Plus size={15} /> Create First Board
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Sort columns by fixed workflow order (Urgent first)
  const sortedColumns = sortColumnsByWorkflow(board.columns || []);

  // Filter columns and cards if filterMemberId is active
  const filteredColumns = sortedColumns.map(col => ({
    ...col,
    cards: filterMemberId
      ? (col.cards || []).filter(c => (c.assignees || []).includes(filterMemberId))
      : (col.cards || [])
  }));

  // Determine next column in workflow for quick "Move to Next"
  const getNextColId = (currentColId: string): string | null => {
    const idx = sortedColumns.findIndex(c => c.id === currentColId);
    if (idx === -1 || idx >= sortedColumns.length - 1) return null;
    return sortedColumns[idx + 1].id;
  };
  const nextColId = dragState ? getNextColId(dragState.fromColId) : null;

  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const isOwner = !!(board?.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail);
  const currentMemberObj = board?.members?.find(m => m.email && m.email.toLowerCase().trim() === currentEmail);
  const isObserver = !isOwner && currentMemberObj?.role === 'observer';

  const activeMember = board.members?.find((m: Member) => m.id === filterMemberId);

  return (
    <div className="board-view-container" style={{ perspective: 1200, position: 'relative' }}>
      {/* Board View Subheader with Inbox Toggle & Badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '6px 12px' : '8px 18px',
          background: 'hsl(var(--card) / 0.6)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Inbox Toggle Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className={`btn ${showInbox ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 8,
              boxShadow: showInbox ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
            }}
            onClick={toggleInbox}
            title="Toggle Inbox Drawer"
          >
            <Inbox size={14} />
            <span>Inbox</span>
            {(board.inboxCards?.length || 0) > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: showInbox ? 'rgba(255,255,255,0.25)' : 'hsl(var(--primary) / 0.18)',
                  color: showInbox ? '#fff' : 'hsl(var(--primary))',
                }}
              >
                {board.inboxCards?.length}
              </span>
            )}
          </motion.button>

            {/* Observer Role Indicator */}
            {isObserver && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'hsl(38 92% 50% / 0.15)',
                  color: '#d97706',
                  border: '1px solid hsl(38 92% 50% / 0.3)',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <Eye size={13} />
                <span>Observer Mode (View Only)</span>
              </div>
            )}
          </div>

          {/* Filter Info if active */}
          {activeMember && (
            <div className="board-filter-banner" style={{ margin: 0, padding: '4px 10px' }}>
              <div className="board-filter-left">
                <Filter size={12} color="hsl(var(--primary))" />
                <span style={{ fontSize: 12 }}>Showing tasks for <strong>{activeMember.name}</strong></span>
              </div>
              <button onClick={onClearFilter} className="filter-clear-btn-pill" style={{ padding: '2px 8px', fontSize: 11 }}>
                <X size={11} /> Clear
              </button>
            </div>
          )}
        </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <motion.div
            key="list-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="list-view-container"
          >
            <div className="view-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>List View</span>
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', padding: '2px 8px', borderRadius: 9999 }}>
                  {filteredColumns.reduce((sum, c) => sum + c.cards.length, 0)} tasks
                </span>
              </div>
              {!isObserver && (
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onAddColumn} style={{ fontSize: 12, padding: '6px 12px' }}>
                  <Plus size={13} /> Add Row
                </motion.button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredColumns.map(col => (
                <div key={col.id} className="glass-list-group">
                  <div className="glass-list-group-header">
                    <span>{col.name}</span>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>
                      {col.cards.length}
                    </span>
                  </div>
                  {col.cards.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12.5, color: 'hsl(var(--muted-foreground))' }}>
                      No tasks in this row
                    </div>
                  ) : (
                    col.cards.map(card => {
                      const assignees = (card.assignees || []).map(id => board.members?.find((m: Member) => m.id === id)).filter(Boolean);
                      const labels = (card.labels || []).map(lid => LABELS.find(l => l.id === lid)).filter(Boolean);

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ x: 3 }}
                          className="glass-list-row"
                          onClick={() => onOpenCard(card.id)}
                        >
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: card.completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                              display: 'flex'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardComplete(card.id);
                            }}
                          >
                            {card.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, textDecoration: card.completed ? 'line-through' : 'none', color: card.completed ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))' }}>
                              {card.title}
                            </span>
                            {card.description && (
                              <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                                {card.description}
                              </span>
                            )}
                          </div>

                          {labels.length > 0 && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {labels.map(l => l && (
                                <span
                                  key={l.id}
                                  className="card-label-badge"
                                  style={{ backgroundColor: `${l.color}15`, color: l.color }}
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {card.dueDate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                              <Calendar size={12} />
                              <span>{formatDueDate(card.dueDate)}</span>
                            </div>
                          )}

                          <div className="card-assignees">
                            {assignees.map(m => m && (
                              m.avatarUrl ? (
                                <img key={m.id} src={m.avatarUrl} alt={m.name} className="card-avatar" title={m.name} />
                              ) : (
                                <div key={m.id} className="card-avatar" style={{ backgroundColor: m.color }} title={m.name}>
                                  {avatarInitials(m.name)}
                                </div>
                              )
                            ))}
                          </div>

                          <ChevronRight size={15} color="hsl(var(--muted-foreground))" />
                        </motion.div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {viewMode === 'calendar' && (
          <motion.div
            key="calendar-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="calendar-view-container"
          >
            <div className="view-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Calendar View</span>
                {activeMember && (
                  <span className="filter-clear-btn-pill">
                    <User size={12} />
                    <span>Filtered: {activeMember.name}</span>
                    <button onClick={onClearFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={11} /></button>
                  </span>
                )}
              </div>
              {/* Month navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={goToday}
                  title="Jump to current month"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: (calendarYear === today.getFullYear() && calendarMonth === today.getMonth())
                      ? 'hsl(var(--muted-foreground))'
                      : 'hsl(var(--primary))',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    opacity: (calendarYear === today.getFullYear() && calendarMonth === today.getMonth()) ? 0.7 : 1,
                  }}
                >
                  Today
                </motion.button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={goPrevMonth}
                    title="Previous month"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, boxShadow: 'var(--neu-shadow-raised-sm)', color: 'hsl(var(--foreground))' }}
                  >
                    <ChevronLeft size={15} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={goNextMonth}
                    title="Next month"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, boxShadow: 'var(--neu-shadow-raised-sm)', color: 'hsl(var(--foreground))' }}
                  >
                    <ChevronRight size={15} />
                  </motion.button>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 125, color: 'hsl(var(--foreground))' }}>
                  {new Date(calendarYear, calendarMonth).toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Day-of-week header row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0 10px', paddingBottom: 4 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textAlign: 'center', paddingBottom: 4 }}>{d}</div>
              ))}
            </div>

            <div className="glass-calendar-grid">
              {calendarDays.map((d, i) => {
                const isCurrentMonth = d.getMonth() === calendarMonth;
                const isToday = d.toDateString() === today.toDateString();
                const dateStr = formatLocalDate(d);
                const dayCards = filteredColumns.flatMap(c => c.cards).filter(c => c.dueDate && c.dueDate.slice(0, 10) === dateStr);

                return (
                  <div
                    key={i}
                    className={`glass-calendar-day ${isToday ? 'is-today' : ''}`}
                    style={{ opacity: isCurrentMonth ? 1 : 0.38 }}
                    onClick={() => setSelectedCalendarDate(d)}
                    title={`Click to view all tasks for ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {dayCards.length > 0 ? (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 999,
                            backgroundColor: 'hsl(var(--primary) / 0.15)',
                            color: 'hsl(var(--primary))',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {dayCards.length} {dayCards.length === 1 ? 'task' : 'tasks'}
                        </span>
                      ) : <span />}

                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isToday ? 'hsl(var(--primary))' : 'transparent',
                          color: isToday ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                          boxShadow: isToday ? 'var(--neu-shadow-raised-sm)' : 'none',
                        }}
                      >
                        {d.getDate()}
                      </span>
                    </div>

                    {/* Preview up to 2 tasks max - tightly bounded so it never stretches rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                      {dayCards.slice(0, 2).map(card => (
                        <div
                          key={card.id}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 6,
                            backgroundColor: 'hsl(var(--card))',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            fontSize: 10.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                            color: 'hsl(var(--foreground))',
                            textDecoration: card.completed ? 'line-through' : 'none',
                            opacity: card.completed ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              backgroundColor: card.completed ? '#10b981' : 'hsl(var(--primary))',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.title}
                          </span>
                        </div>
                      ))}
                      {dayCards.length > 2 && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--primary))', paddingLeft: 2 }}>
                          +{dayCards.length - 2} more...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {viewMode === 'board' && (
          <motion.div
            key="board-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="board-area"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Docked Inbox Drawer - sits as first column, shifting all columns to the right (Desktop only) */}
            {!isMobile && (
              <InboxDrawer
                isOpen={showInbox}
                onClose={() => controlledToggleInbox ? controlledToggleInbox() : setInternalShowInbox(false)}
                board={board}
                onOpenCard={onOpenCard}
                onDragStart={(e, cardId) => {
                  if (isObserver) return;
                  setDragState({ cardId, fromColId: 'inbox', fromInbox: true });
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragState(null)}
                dragState={dragState}
                docked={true}
              />
            )}

            {filteredColumns.map((col, idx) => (
              <motion.div
                key={col.id}
                layout
                initial={{ opacity: 0, y: 15, rotateY: -8, translateZ: -20 }}
                animate={{ opacity: 1, y: 0, rotateY: 0, translateZ: 0 }}
                transition={{
                  layout: { type: 'spring', damping: 26, stiffness: 220, mass: 0.8 },
                  duration: 0.3,
                  delay: idx * 0.04,
                  ease: [0.25, 1, 0.5, 1]
                }}
                style={{ maxHeight: '100%', minHeight: 0, flexShrink: 0, display: 'flex', flexDirection: 'column', transformStyle: 'preserve-3d' }}
              >
                <Column
                  col={col}
                  colIndex={idx}
                  dragState={dragState}
                  setDragState={setDragState}
                  onOpenCard={onOpenCard}
                  onStartRename={(colId, name) => {
                    setRenameColId(colId);
                    setRenameValue(name);
                    setShowRenameModal(true);
                  }}
                  isNextColumn={dragState !== null && col.id === nextColId}
                  isObserver={isObserver}
                />
              </motion.div>
            ))}
            {!isObserver && (
              <motion.button
                layout
                whileTap={{ scale: 0.96 }}
                className="add-column-btn"
                onClick={onAddColumn}
                transition={{ layout: { type: 'spring', damping: 26, stiffness: 220, mass: 0.8 } }}
              >
                <Plus size={15} /> Add Column
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Column Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
              transition={{ duration: 0.2 }}
              className="modal small-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">Rename Column</h2>
                <button className="icon-btn" onClick={() => setShowRenameModal(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="field-label">New Column Name</label>
                  <input
                    type="text"
                    className="text-input"
                    maxLength={40}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => setShowRenameModal(false)}>Cancel</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={handleRenameConfirm}>
                  <Check size={14} /> Rename
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Day Tasks Modal */}
      <AnimatePresence>
        {selectedCalendarDate && (
          <div className="modal-overlay" onClick={() => setSelectedCalendarDate(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="modal"
              style={{ maxWidth: 540, width: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: 'hsl(var(--primary) / 0.12)',
                      color: 'hsl(var(--primary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'var(--neu-shadow-raised-sm)',
                    }}
                  >
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h2 className="modal-title" style={{ fontSize: 15, margin: 0 }}>
                      {selectedCalendarDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </h2>
                    <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                      {(() => {
                        const dateStr = formatLocalDate(selectedCalendarDate);
                        const count = filteredColumns.flatMap(c => c.cards).filter(c => c.dueDate && c.dueDate.slice(0, 10) === dateStr).length;
                        return count === 0 ? 'No tasks scheduled' : `${count} task${count > 1 ? 's' : ''} scheduled`;
                      })()}
                    </span>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setSelectedCalendarDate(null)}>
                  <X size={15} />
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {(() => {
                  const dateStr = formatLocalDate(selectedCalendarDate);
                  const matchingTasks: Array<{ card: Card; column: ColumnType }> = [];
                  for (const col of filteredColumns) {
                    for (const card of col.cards) {
                      if (card.dueDate && card.dueDate.slice(0, 10) === dateStr) {
                        matchingTasks.push({ card, column: col });
                      }
                    }
                  }

                  if (matchingTasks.length === 0) {
                    return (
                      <div style={{ padding: '36px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Calendar size={32} style={{ opacity: 0.35 }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>No tasks due on this date</span>
                      </div>
                    );
                  }

                  return matchingTasks.map(({ card, column }) => (
                    <motion.div
                      key={card.id}
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        setSelectedCalendarDate(null);
                        onOpenCard(card.id);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: 'var(--neu-shadow-raised-sm)',
                        border: '1px solid hsl(var(--border) / 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardComplete(card.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: card.completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={card.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {card.completed ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'hsl(var(--foreground))',
                              textDecoration: card.completed ? 'line-through' : 'none',
                              opacity: card.completed ? 0.65 : 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {card.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                backgroundColor: 'hsl(var(--secondary))',
                                color: 'hsl(var(--muted-foreground))',
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {column.name}
                            </span>
                            {card.labels?.slice(0, 2).map(lId => {
                              const label = LABELS.find(l => l.id === lId);
                              if (!label) return null;
                              return (
                                <span
                                  key={label.id}
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    backgroundColor: `${label.color}22`,
                                    color: label.color,
                                  }}
                                >
                                  {label.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {card.assignees?.length > 0 && (
                          <div style={{ display: 'flex', marginLeft: -4 }}>
                            {card.assignees.slice(0, 3).map((mId, idx) => {
                              const m = board?.members?.find(mem => mem.id === mId || mem.email === mId);
                              if (!m) return null;
                              return (
                                <div
                                  key={m.id || idx}
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    marginLeft: idx === 0 ? 0 : -6,
                                    border: '1.5px solid hsl(var(--card))',
                                    backgroundColor: m.color || '#6366f1',
                                    color: '#fff',
                                    fontSize: 8.5,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                  }}
                                  title={m.name}
                                >
                                  {m.avatarUrl ? (
                                    <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    avatarInitials(m.name)
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <ChevronRight size={15} style={{ color: 'hsl(var(--muted-foreground))' }} />
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>

              <div className="modal-footer" style={{ justifyContent: 'flex-end', padding: '10px 18px' }}>
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => setSelectedCalendarDate(null)}>
                  Close
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
