import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  KanbanSquare, Plus, CheckSquare, Clock,
  Layers, Zap, CheckCircle2,
  Calendar, Activity, ArrowUpRight, Sparkles, Trash2, LogOut, Pencil, Check, X, Palette
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNotifStore } from '../store/useNotifStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatDueDate, avatarInitials } from '../utils';
import { LABELS, type Card, type Board } from '../types';
import Tilt3D from './ui/Tilt3D';
import BoardColorPicker from './ui/BoardColorPicker';

interface Props {
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onOpenCard?: (cardId: string, boardId?: string) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    }
  }
};

const item3DVariants: Variants = {
  hidden: { opacity: 0, y: 16, rotateX: 8, translateZ: -30 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    translateZ: 0,
    transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] }
  }
};

type TaskFilter = 'all' | 'assigned' | 'dueSoon' | 'urgent' | 'completed';

export default function Dashboard({ onSelectBoard, onCreateBoard, onOpenCard }: Props) {
  const user               = useAuthStore(s => s.user);
  const allBoards          = useWorkStore(s => s.boards);
  const getVisibleBoards   = useWorkStore(s => s.getVisibleBoards);
  const deleteBoard        = useWorkStore(s => s.deleteBoard);
  const leaveBoard         = useWorkStore(s => s.leaveBoard);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const rawNotifications   = useNotifStore(s => s.notifications);
  const showToast          = useToastStore(s => s.showToast);
  const showConfirm        = useConfirmStore(s => s.showConfirm);
  const customLabels       = useSettingsStore(s => s.customLabels);
  const renameBoard        = useWorkStore(s => s.renameBoard);
  const updateBoardColor   = useWorkStore(s => s.updateBoardColor);

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [colorPickerBoardId, setColorPickerBoardId] = useState<string | null>(null);

  const allLabels = useMemo(() => [...LABELS, ...customLabels], [customLabels]);

  const getLabelInfo = useCallback((lblId: string) => {
    const found = allLabels.find(l => l.id === lblId);
    if (found) {
      return { label: found.name, color: found.color };
    }
    return { label: lblId, color: '#6366f1' };
  }, [allLabels]);

  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const boards: Board[] = useMemo(() => getVisibleBoards(user?.email), [allBoards, user?.email, getVisibleBoards]);
  const notifications = useMemo(() => {
    if (!user?.email) return rawNotifications.filter(n => !n.recipientEmail);
    const email = user.email.toLowerCase().trim();
    return rawNotifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
  }, [rawNotifications, user?.email]);

  // Flatten all cards across visible boards with their parent board and column info
  const allCardsWithMeta = useMemo(() => {
    const list: Array<{ card: Card; board: Board; columnName: string }> = [];
    boards.forEach(b => {
      b.columns?.forEach(c => {
        c.cards?.forEach(card => {
          list.push({ card, board: b, columnName: c.name });
        });
      });
    });
    return list;
  }, [boards]);

  // Aggregate Metrics
  const totalTasks = allCardsWithMeta.length;
  const completedTasks = allCardsWithMeta.filter(item => item.card.completed).length;
  const inProgressTasks = totalTasks - completedTasks;
  const overdueTasks = allCardsWithMeta.filter(item => {
    if (!item.card.dueDate || item.card.completed) return false;
    return new Date(item.card.dueDate) < new Date();
  }).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filter tasks for "My Tasks & Upcoming Deadlines"
  const filteredTasks = useMemo(() => {
    return allCardsWithMeta.filter(({ card, board }) => {
      if (taskFilter === 'completed') return card.completed;
      if (taskFilter === 'assigned') {
        const isAssignedToUser = (card.assignees || []).some(aId => {
          const m = board.members?.find(bm => bm.id === aId);
          if (!m) return false;
          const emailMatch = user?.email && m.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim();
          const nameMatch = user?.name && m.name && m.name.toLowerCase().trim() === user.name.toLowerCase().trim();
          return Boolean(emailMatch || nameMatch);
        });
        return isAssignedToUser && !card.completed;
      }
      if (taskFilter === 'dueSoon') {
        if (!card.dueDate || card.completed) return false;
        const due = new Date(card.dueDate).getTime();
        const now = Date.now();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        return due - now < threeDays; // due soon or overdue
      }
      if (taskFilter === 'urgent') {
        return (
          (card.labels || []).some(l => l.toLowerCase().includes('urgent') || l.toLowerCase().includes('bug')) ||
          (card.dueDate && new Date(card.dueDate) < new Date() && !card.completed)
        );
      }
      // 'all' active tasks
      return !card.completed;
    });
  }, [allCardsWithMeta, taskFilter, user]);

  // Label breakdown for analytics
  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCardsWithMeta.forEach(({ card }) => {
      (card.labels || []).forEach(l => {
        counts[l] = (counts[l] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allCardsWithMeta]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getHourGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="dashboard-view"
      style={{ perspective: 1200 }}
    >
      {/* Header Greeting & Overview Hero */}
      <motion.div variants={item3DVariants} className="dashboard-hero" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="dashboard-greeting">
            {getHourGreeting()}, {firstName}
          </h1>
          <p className="dashboard-greeting-sub">
            Here is an overview of your active boards, team workload, and upcoming deadlines.
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn btn-primary"
          onClick={onCreateBoard}
          style={{ fontSize: 13, padding: '8px 18px', boxShadow: 'var(--neu-shadow-raised-sm)' }}
        >
          <Plus size={15} /> New Board
        </motion.button>
      </motion.div>

      {/* 4-Metric Overview Cards Row */}
      <motion.div variants={item3DVariants} className="dashboard-stats-row">
        <Tilt3D maxTilt={8} scale={1.02}>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <Layers size={18} />
            </div>
            <div>
              <div className="dashboard-stat-value">{boards.length}</div>
              <div className="dashboard-stat-label">Active Boards</div>
            </div>
          </div>
        </Tilt3D>

        <Tilt3D maxTilt={8} scale={1.02}>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon" style={{ color: '#10b981' }}>
              <CheckSquare size={18} />
            </div>
            <div>
              <div className="dashboard-stat-value">{completedTasks}</div>
              <div className="dashboard-stat-label">Tasks Completed</div>
            </div>
          </div>
        </Tilt3D>

        <Tilt3D maxTilt={8} scale={1.02}>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon" style={{ color: '#3b82f6' }}>
              <Zap size={18} />
            </div>
            <div>
              <div className="dashboard-stat-value">{inProgressTasks}</div>
              <div className="dashboard-stat-label">In Progress</div>
            </div>
          </div>
        </Tilt3D>

        <Tilt3D maxTilt={8} scale={1.02}>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon" style={{ color: overdueTasks > 0 ? '#ef4444' : 'hsl(var(--muted-foreground))' }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="dashboard-stat-value" style={{ color: overdueTasks > 0 ? '#ef4444' : undefined }}>{overdueTasks}</span>
                {overdueTasks > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                    Action needed
                  </span>
                )}
              </div>
              <div className="dashboard-stat-label">Overdue Tasks</div>
            </div>
          </div>
        </Tilt3D>
      </motion.div>

      {/* Main Two-Column Content Area */}
      <div className="dashboard-layout-grid">
        {/* Left Column: Boards + My Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Boards Section */}
          <motion.div variants={item3DVariants} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KanbanSquare size={16} color="hsl(var(--primary))" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Your Boards</h2>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', color: 'hsl(var(--muted-foreground))' }}>
                  {boards.length}
                </span>
              </div>
            </div>

            {boards.length === 0 ? (
              <div
                style={{
                  padding: 36,
                  textAlign: 'center',
                  boxShadow: 'var(--neu-shadow-input)',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'hsl(var(--card))'
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 4 }}>
                  No boards yet
                </div>
                <div style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))', marginBottom: 14 }}>
                  Create your first board to start managing your projects.
                </div>
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onCreateBoard}>
                  <Plus size={14} /> Create First Board
                </motion.button>
              </div>
            ) : (
              <div className="dashboard-boards-grid">
                {boards.map(board => {
                  const totalCards  = board.columns.reduce((s, c) => s + c.cards.length, 0);
                  const doneCards   = board.columns.reduce((s, c) => s + c.cards.filter(card => card.completed).length, 0);
                  const progress    = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;
                  const memberCount = board.members?.length ?? 0;

                  return (
                    <motion.div
                      key={board.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="dashboard-board-card"
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => onSelectBoard(board.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingBoardId === board.id ? (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingBoardName}
                              onChange={e => setEditingBoardName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  if (editingBoardName.trim() && editingBoardName.trim() !== board.name) {
                                    renameBoard(board.id, editingBoardName.trim());
                                    showToast(`Renamed to "${editingBoardName.trim()}"`, 'success');
                                  }
                                  setEditingBoardId(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingBoardId(null);
                                }
                              }}
                              autoFocus
                              className="text-input"
                              style={{ fontSize: 13.5, fontWeight: 600, padding: '2px 8px', height: 28, borderRadius: 6, width: '100%', maxWidth: 200 }}
                            />
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              className="icon-btn"
                              style={{ width: 26, height: 26, color: 'hsl(var(--primary))' }}
                              onClick={() => {
                                if (editingBoardName.trim() && editingBoardName.trim() !== board.name) {
                                  renameBoard(board.id, editingBoardName.trim());
                                  showToast(`Renamed to "${editingBoardName.trim()}"`, 'success');
                                }
                                setEditingBoardId(null);
                              }}
                              title="Save name"
                            >
                              <Check size={13} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              className="icon-btn"
                              style={{ width: 26, height: 26 }}
                              onClick={() => setEditingBoardId(null)}
                              title="Cancel"
                            >
                              <X size={13} />
                            </motion.button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: board.color,
                                boxShadow: 'var(--neu-shadow-raised-sm)',
                                cursor: (!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (board.members && board.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer'))) ? 'pointer' : 'default',
                              }}
                              title={(!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (board.members && board.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer'))) ? "Change board color" : undefined}
                              onClick={(!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (board.members && board.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer'))) ? (e) => {
                                e.stopPropagation();
                                setColorPickerBoardId(colorPickerBoardId === board.id ? null : board.id);
                              } : undefined}
                            />
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                              {board.name}
                            </span>
                          </div>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 20 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Color & Rename board */}
                          {(!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (board.members && board.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer'))) && (
                            <>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                className="icon-btn"
                                style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, cursor: 'pointer' }}
                                title="Change board color"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColorPickerBoardId(colorPickerBoardId === board.id ? null : board.id);
                                }}
                              >
                                <Palette size={13} />
                              </motion.button>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                className="icon-btn"
                                style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, cursor: 'pointer' }}
                                title="Rename board"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBoardId(board.id);
                                  setEditingBoardName(board.name);
                                }}
                              >
                                <Pencil size={13} />
                              </motion.button>
                            </>
                          )}
                          <AnimatePresence>
                            {colorPickerBoardId === board.id && (
                              <BoardColorPicker
                                currentColor={board.color}
                                onSelectColor={(col) => {
                                  updateBoardColor(board.id, col);
                                  showToast(`Board color updated`, 'success');
                                }}
                                onClose={() => setColorPickerBoardId(null)}
                                align="right"
                              />
                            )}
                          </AnimatePresence>
                          {!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) ? (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.88 }}
                              className="icon-btn"
                              style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, color: 'hsl(var(--destructive))', cursor: 'pointer' }}
                              title="Delete board"
                              onClick={(e) => {
                                e.stopPropagation();
                                showConfirm({
                                  title: `Delete "${board.name}"?`,
                                  message: `Are you sure you want to permanently delete this board and all its tasks? This action cannot be undone.`,
                                  confirmText: 'Delete Board',
                                  variant: 'danger',
                                  icon: 'trash',
                                  onConfirm: () => {
                                    deleteBoard(board.id);
                                    showToast(`Deleted board "${board.name}"`, 'info');
                                  }
                                });
                              }}
                            >
                              <Trash2 size={13} />
                            </motion.button>
                          ) : (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.88 }}
                              className="icon-btn"
                              style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, color: 'hsl(var(--destructive))', cursor: 'pointer' }}
                              title="Leave board"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (user?.email) {
                                  showConfirm({
                                    title: `Leave "${board.name}"?`,
                                    message: `Are you sure you want to leave this board? You will need an invite from the owner to rejoin.`,
                                    confirmText: 'Leave Board',
                                    variant: 'danger',
                                    icon: 'logout',
                                    onConfirm: () => {
                                      if (user?.email) {
                                        leaveBoard(board.id, user.email);
                                        showToast(`You left "${board.name}"`, 'info');
                                      }
                                    }
                                  });
                                }
                              }}
                            >
                              <LogOut size={13} />
                            </motion.button>
                          )}
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.88 }}
                            className="icon-btn"
                            style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, cursor: 'pointer' }}
                            title="Open board"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBoard(board.id);
                            }}
                          >
                            <ArrowUpRight size={14} />
                          </motion.button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                          <span>{doneCards}/{totalCards} tasks done</span>
                          <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>{progress}%</span>
                        </div>

                        <div style={{ width: '100%', height: 6, borderRadius: 9999, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                              height: '100%',
                              backgroundColor: board.color,
                              borderRadius: 9999
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--muted-foreground))', paddingTop: 6 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <KanbanSquare size={12} /> {board.columns?.length ?? 0} columns
                          </span>

                          {/* Member Avatars */}
                          {memberCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {board.members.slice(0, 3).map((m, idx) => (
                                <div
                                  key={m.id}
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    backgroundColor: m.color,
                                    color: '#fff',
                                    fontSize: 8.5,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: idx === 0 ? 0 : -6,
                                    border: '2px solid hsl(var(--card))',
                                    boxShadow: 'var(--neu-shadow-raised-sm)',
                                    overflow: 'hidden'
                                  }}
                                  title={m.name}
                                >
                                  {m.avatarUrl ? (
                                    <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    avatarInitials(m.name)
                                  )}
                                </div>
                              ))}
                              {memberCount > 3 && (
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    backgroundColor: 'hsl(var(--secondary))',
                                    color: 'hsl(var(--secondary-foreground))',
                                    fontSize: 8,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: -6,
                                    border: '2px solid hsl(var(--card))'
                                  }}
                                >
                                  +{memberCount - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Section: My Tasks & Upcoming Deadlines */}
          <motion.div variants={item3DVariants} className="dashboard-widget-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={16} color="#10b981" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Tasks & Upcoming Deadlines</h3>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', color: 'hsl(var(--muted-foreground))' }}>
                  {filteredTasks.length}
                </span>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'hsl(var(--card))', padding: '3px 4px', borderRadius: 9999, boxShadow: 'var(--neu-shadow-input)' }}>
                {(['all', 'assigned', 'dueSoon', 'urgent', 'completed'] as TaskFilter[]).map(f => {
                  const labels: Record<TaskFilter, string> = {
                    all: 'All',
                    assigned: 'Assigned to Me',
                    dueSoon: 'Due Soon',
                    urgent: 'Urgent',
                    completed: 'Completed'
                  };
                  return (
                    <button
                      key={f}
                      className={`dashboard-filter-pill ${taskFilter === f ? 'active' : ''}`}
                      onClick={() => setTaskFilter(f)}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', borderRadius: 'var(--radius)', boxShadow: 'var(--neu-shadow-input)' }}>
                <Sparkles size={20} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                No tasks match this filter. You're all caught up!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', padding: '4px 2px' }}>
                {filteredTasks.map(({ card, board, columnName }) => {
                  const isOverdue = card.dueDate && !card.completed && new Date(card.dueDate) < new Date();

                  return (
                    <div
                      key={card.id}
                      className="dashboard-task-item"
                      onClick={() => onOpenCard ? onOpenCard(card.id, board.id) : onSelectBoard(board.id)}
                    >
                      {/* Checkbox */}
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: card.completed ? '#10b981' : 'hsl(var(--muted-foreground))' }}
                        onClick={e => {
                          e.stopPropagation();
                          toggleCardComplete(card.id);
                          showToast(card.completed ? `Task marked active` : `Task completed!`, 'success');
                        }}
                      >
                        {card.completed ? <CheckCircle2 size={17} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid hsl(var(--muted-foreground))' }} />}
                      </button>

                      {/* Title & Board Tag */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'hsl(var(--foreground))',
                            textDecoration: card.completed ? 'line-through' : 'none',
                            opacity: card.completed ? 0.6 : 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {card.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: board.color }} />
                            {board.name}
                          </span>
                          <span>•</span>
                          <span>{columnName}</span>
                        </div>
                      </div>

                      {/* Labels */}
                      {card.labels && card.labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {card.labels.map(lblId => {
                            const lbl = getLabelInfo(lblId);
                            return (
                              <span
                                key={lblId}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: `${lbl.color}18`,
                                  color: lbl.color,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {lbl.label}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Due Date */}
                      {card.dueDate && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0,
                            backgroundColor: isOverdue ? '#fef2f2' : 'hsl(var(--secondary))',
                            color: isOverdue ? '#b91c1c' : 'hsl(var(--muted-foreground))'
                          }}
                        >
                          <Clock size={11} />
                          <span>{formatDueDate(card.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Analytics & Live Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Priority & Workload Analytics Breakdown */}
          <motion.div variants={item3DVariants} className="dashboard-widget-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="hsl(var(--primary))" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Workload & Analytics</h3>
            </div>

            {/* Overall Completion Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Workspace Completion</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{completionRate}%</span>
              </div>
              <div style={{ width: '100%', height: 8, borderRadius: 9999, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 0.6 }}
                  style={{ height: '100%', backgroundColor: '#10b981', borderRadius: 9999 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                <span>{completedTasks} completed</span>
                <span>{inProgressTasks} remaining</span>
              </div>
            </div>

            {/* Top Categories / Labels */}
            {labelCounts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>Tasks by Category</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {labelCounts.map(([lblId, count]) => {
                    const lbl = getLabelInfo(lblId);
                    const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;

                    return (
                      <div key={lblId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 8px', borderRadius: 8, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: lbl.color }} />
                          <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{lbl.label}</span>
                        </div>
                        <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Recent Activity & Changelog Feed */}
          <motion.div variants={item3DVariants} className="dashboard-widget-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#6366f1" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Recent Activity</h3>
              </div>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                {notifications.length} updates
              </span>
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', borderRadius: 'var(--radius)', boxShadow: 'var(--neu-shadow-input)' }}>
                No recent activity logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', padding: '4px 2px' }}>
                {notifications.slice(0, 6).map(n => (
                  <div key={n.id} className="dashboard-activity-item">
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'hsl(var(--primary))' }}>
                      <Activity size={12} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: 12 }}>{n.title}</div>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>{n.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
