import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, MessageSquare, Paperclip,
  Square, CheckSquare,
  Lock, Smartphone, Settings, Code, Paintbrush,
  Zap, BookOpen, Globe, Database, ShieldCheck, Layers,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LABELS, type Card as CardType, type Member } from '../types';
import { getDueStatus, formatDueDate, avatarInitials, getColDotColor } from '../utils';
import { useWorkStore } from '../store/useWorkStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import AvatarBorder from './ui/AvatarBorder';

interface Props {
  card: CardType;
  cardIndex: number;
  colId: string;
  accentColor: string;
  isUrgent?: boolean;
  cardDelay?: number;
  isObserver?: boolean;
  onClick: () => void;
  onToggleComplete: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function getCardIcon(card: CardType): React.ReactNode {
  const labels = card.labels || [];
  const t = card.title.toLowerCase();
  if (labels.includes('bug'))      return <ShieldCheck size={14} />;
  if (labels.includes('design'))   return <Paintbrush size={14} />;
  if (labels.includes('backend'))  return <Database size={14} />;
  if (labels.includes('frontend')) return <Globe size={14} />;
  if (labels.includes('feature'))  return <Zap size={14} />;
  if (labels.includes('urgent'))   return <Zap size={14} />;
  if (t.includes('auth') || t.includes('login') || t.includes('password')) return <Lock size={14} />;
  if (t.includes('mobile') || t.includes('ios') || t.includes('android'))  return <Smartphone size={14} />;
  if (t.includes('api') || t.includes('backend') || t.includes('server'))  return <Database size={14} />;
  if (t.includes('ci') || t.includes('deploy') || t.includes('pipeline'))  return <Settings size={14} />;
  if (t.includes('review') || t.includes('code'))                           return <Code size={14} />;
  if (t.includes('design') || t.includes('ui') || t.includes('ux'))        return <Paintbrush size={14} />;
  if (t.includes('doc') || t.includes('readme') || t.includes('wiki'))     return <BookOpen size={14} />;
  return <Layers size={14} />;
}

function getDisplayId(card: CardType, index?: number): string {
  if (typeof index === 'number') return `#${index + 1}`;
  let hash = 0;
  for (let i = 0; i < card.id.length; i++) {
    hash = ((hash << 5) - hash) + card.id.charCodeAt(i);
    hash |= 0;
  }
  const num = (Math.abs(hash) % 900) + 100;
  return `#${num}`;
}

function getPriority(card: CardType): { label: string; color: string } {
  const labels = card.labels || [];
  const t = card.title.toLowerCase();
  if (labels.includes('urgent') || t.includes('urgent') || t.includes('critical')) {
    return { label: 'High', color: '#ef4444' };
  }
  if (labels.includes('bug') || labels.includes('feature')) {
    return { label: 'Medium', color: '#f59e0b' };
  }
  return { label: 'Low', color: '#64748b' };
}

export default function Card({
  card, cardIndex, colId, accentColor, isUrgent, isObserver,
  onClick, onToggleComplete, onDragStart, onDragEnd
}: Props) {
  const boards       = useWorkStore(s => s.boards);
  const activeBoardId= useWorkStore(s => s.activeBoardId);
  const board        = boards.find(b => b.id === activeBoardId) || null;
  const moveCard     = useWorkStore(s => s.moveCard);
  const undoLastMove = useWorkStore(s => s.undoLastMove);
  const showToast    = useToastStore(s => s.showToast);

  const labelMode    = useSettingsStore(s => s.labelMode);
  const customLabels = useSettingsStore(s => s.customLabels);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDelta, setTouchDelta] = useState({ x: 0, y: 0 });

  const touchTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingActiveRef = useRef(false);
  const wasDraggingRef = useRef(false);

  const otherColumns = (board?.columns || []).filter(c => c.id !== colId);

  useEffect(() => {
    if (!card.dueDate || card.completed) return;
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 10_000);
    return () => clearInterval(interval);
  }, [card.dueDate, card.completed]);

  const dueStatus    = getDueStatus(card.dueDate);

  const allLabels = [...LABELS, ...customLabels];
  const labelHtml = (card.labels || []).map(lid => allLabels.find(l => l.id === lid)).filter(Boolean);
  const assignees = (card.assignees || [])
    .map(uid => (board?.members || []).find(m =>
      m.id === uid || (m.email && m.email.toLowerCase().trim() === uid.toLowerCase().trim())
    ))
    .filter(Boolean) as Member[];

  const isImageAttachment = (att: { type?: string; dataUrl?: string; name?: string }) => {
    return (
      att.type?.startsWith('image/') ||
      att.dataUrl?.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(att.name || '')
    );
  };

  const coverAttachment = card.attachments?.find(a =>
    card.coverAttachmentId ? a.id === card.coverAttachmentId : isImageAttachment(a)
  );
  const priority  = getPriority(card);
  const icon      = getCardIcon(card);

  // Touch Drag & Drop for Mobile Phones
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isObserver) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isDraggingActiveRef.current = false;
    setTouchDelta({ x: 0, y: 0 });

    touchTimerRef.current = window.setTimeout(() => {
      isDraggingActiveRef.current = true;
      setIsTouchDragging(true);
      document.querySelector('.board-area')?.classList.add('touch-dragging-active');
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      onDragStart({
        dataTransfer: { effectAllowed: 'move', setData: () => {} },
        currentTarget: e.currentTarget
      } as any);
    }, 180);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isObserver) return;
    const touch = e.touches[0];
    if (!isDraggingActiveRef.current) {
      if (touchStartRef.current) {
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);
        if (dx > 8 || dy > 8) {
          if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
          }
        }
      }
      return;
    }

    if (e.cancelable) e.preventDefault();

    if (touchStartRef.current) {
      setTouchDelta({
        x: touch.clientX - touchStartRef.current.x,
        y: touch.clientY - touchStartRef.current.y,
      });
    }

    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCol = el?.closest('.column');
    document.querySelectorAll('.column.drag-over').forEach(c => {
      if (c !== targetCol) c.classList.remove('drag-over');
    });
    if (targetCol) {
      targetCol.classList.add('drag-over');
    }

    const boardArea = document.querySelector('.board-area');
    if (boardArea) {
      if (touch.clientX < 70) {
        boardArea.scrollBy({ left: -16, behavior: 'auto' });
      } else if (touch.clientX > window.innerWidth - 70) {
        boardArea.scrollBy({ left: 16, behavior: 'auto' });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    if (isDraggingActiveRef.current) {
      wasDraggingRef.current = true;
      setTimeout(() => { wasDraggingRef.current = false; }, 150);
      isDraggingActiveRef.current = false;
      setIsTouchDragging(false);
      setTouchDelta({ x: 0, y: 0 });
      document.querySelector('.board-area')?.classList.remove('touch-dragging-active');
      document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetCol = el?.closest('.column');
      const targetColId = targetCol?.getAttribute('data-col-id');

      if (targetColId && targetColId !== colId) {
        moveCard(card.id, colId, targetColId);
        const targetColName = board?.columns.find(c => c.id === targetColId)?.name || 'another column';
        showToast(`Moved to "${targetColName}"`, 'info', 4500, {
          label: 'Undo',
          onClick: undoLastMove,
        });
      }
      onDragEnd();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.82, y: 12, filter: 'blur(6px)', transition: { duration: 0.22 } }}
      transition={{ duration: 0.2 }}
      className={`card ${card.completed ? 'completed' : ''}${isTouchDragging ? ' touch-dragging' : ''}`}
      data-card-id={card.id}
      draggable={!isObserver}
      onDragStart={(e: any) => (isObserver ? undefined : onDragStart(e))}
      onDragEnd={isObserver ? undefined : onDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (wasDraggingRef.current) return;
        onClick();
      }}
      style={{
        cursor: isObserver ? 'pointer' : 'grab',
        ...(isTouchDragging ? {
          transform: `translate3d(${touchDelta.x}px, ${touchDelta.y}px, 0) scale(1.04) rotate(1.5deg)`,
          opacity: 0.92,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'none',
          border: '1.5px solid hsl(var(--primary))'
        } : {})
      }}
    >
      {/* Cover Image Thumbnail */}
      {coverAttachment && (
        <div style={{ margin: '-14px -14px 10px -14px', borderRadius: '12px 12px 0 0', overflow: 'hidden', backgroundColor: 'hsl(var(--secondary))' }}>
          <img
            src={coverAttachment.dataUrl}
            alt={coverAttachment.name}
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Title + Icon */}
      <div className="card-header-row">
        <span className="card-type-icon">{icon}</span>
        <div className="card-title">{card.title}</div>
      </div>

      {/* Badges / Labels row */}
      <div className="card-meta-row">
        <div className="card-labels">
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: `${priority.color}18`,
              color: priority.color,
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
            title={`Priority: ${priority.label}`}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: priority.color }} />
            {priority.label}
          </span>
          {labelHtml.map(lbl => lbl && (
            labelMode === 'dot' ? (
              <span
                key={lbl.id}
                className="card-label-dot"
                style={{ backgroundColor: lbl.color }}
                title={lbl.name}
              />
            ) : (
              <span
                key={lbl.id}
                className="card-label-badge"
                style={{
                  backgroundColor: `${lbl.color}15`,
                  color: lbl.color
                }}
              >
                {lbl.name}
              </span>
            )
          ))}
        </div>
      </div>

      {/* Footer: Due date + counters + Assignees */}
      <div className="card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {card.dueDate && (
            <span
              className={`card-due-tag ${dueStatus === 'overdue' ? 'overdue' : dueStatus === 'due-soon' ? 'due-soon' : ''}`}
            >
              <Calendar size={11} />
              <span>{formatDueDate(card.dueDate)}</span>
            </span>
          )}
          {card.comments?.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              <MessageSquare size={11} /> {card.comments.length}
            </span>
          )}
          {card.attachments?.length > 0 && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10.5,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 5,
                background: 'hsl(var(--primary) / 0.12)',
                color: 'hsl(var(--primary))',
                border: '1px solid hsl(var(--primary) / 0.25)',
              }}
              title="Task Guide / Attachment"
            >
              <Paperclip size={10.5} /> {card.attachments.length} {card.attachments.length === 1 ? 'Guide' : 'Guides'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {assignees.length > 0 && (
            <div className="card-assignees">
              {assignees.slice(0, 3).map(m => m && (
                <AvatarBorder key={m.id} borderStyle={m.borderStyle} size={22} title={m.name}>
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                      {avatarInitials(m.name)}
                    </div>
                  )}
                </AvatarBorder>
              ))}
              {assignees.length > 3 && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 4px',
                    borderRadius: 6,
                    backgroundColor: 'hsl(var(--secondary))',
                    color: 'hsl(var(--muted-foreground))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`${assignees.length - 3} more assignees`}
                >
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
          {/* Quick Move Popover Button */}
          {!isObserver && otherColumns.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="icon-btn"
                style={{
                  width: 22,
                  height: 22,
                  background: 'transparent',
                  boxShadow: 'none',
                  color: showMoveMenu ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title="Move card to column"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(s => !s);
                }}
              >
                <ArrowRightLeft size={13} />
              </button>

              <AnimatePresence>
                {showMoveMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      right: 0,
                      marginBottom: 6,
                      backgroundColor: 'hsl(var(--popover))',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--neu-shadow-floating)',
                      border: '1px solid hsl(var(--border) / 0.8)',
                      padding: 6,
                      zIndex: 80,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      minWidth: 155,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px 4px', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                      Move to column:
                    </div>
                    {otherColumns.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="sidebar-nav-item"
                        style={{
                          width: '100%',
                          fontSize: 12,
                          padding: '5px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderRadius: 6,
                          textAlign: 'left'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMoveMenu(false);
                          moveCard(card.id, colId, c.id);
                          showToast(`Moved to "${c.name}"`, 'success', 4500, {
                            label: 'Undo',
                            onClick: undoLastMove
                          });
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: getColDotColor(c.name), flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: card.completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              display: 'flex',
              alignItems: 'center',
              padding: 2
            }}
            onClick={onToggleComplete}
            title={card.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {card.completed ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
