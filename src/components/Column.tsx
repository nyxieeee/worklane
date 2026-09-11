import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Plus, Edit3, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import type { Column as ColType } from '../types';
import CardComponent from './Card';

interface DragState {
  cardId: string;
  fromColId: string;
  fromInbox?: boolean;
}

interface Props {
  col: ColType;
  colIndex: number;
  dragState: DragState | null;
  setDragState: (d: DragState | null) => void;
  onOpenCard: (cardId: string) => void;
  onStartRename: (colId: string, name: string) => void;
  isNextColumn?: boolean;
  isObserver?: boolean;
}

function getColDotColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('done') || n.includes('complete'))             return '#10b981';
  if (n.includes('urgent') || n.includes('critical'))           return '#ef4444';
  if (n.includes('progress') || n.includes('active') || n.includes('doing')) return '#3b82f6';
  if (n.includes('review') || n.includes('qa') || n.includes('testing'))     return '#f59e0b';
  if (n.includes('todo') || n.includes('to do') || n.includes('backlog'))    return '#8b5cf6';
  return '#64748b';
}

export default function Column({ col, colIndex, dragState, setDragState, onOpenCard, onStartRename, isObserver }: Props) {
  const addCard            = useWorkStore(s => s.addCard);
  const deleteColumn       = useWorkStore(s => s.deleteColumn);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const moveCard           = useWorkStore(s => s.moveCard);
  const moveInboxCardToColumn = useWorkStore(s => s.moveInboxCardToColumn);
  const undoLastMove       = useWorkStore(s => s.undoLastMove);
  const showToast          = useToastStore(s => s.showToast);
  const showConfirm        = useConfirmStore(s => s.showConfirm);

  const [showAddCard,   setShowAddCard]   = useState(false);
  const [newCardTitle,  setNewCardTitle]  = useState('');
  const [isDragOver,    setIsDragOver]    = useState(false);
  const [activeDropIdx, setActiveDropIdx] = useState<number | null>(null);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const menuRef     = useRef<HTMLDivElement>(null);
  const cardsRef    = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const dotColor       = getColDotColor(col.name);
  const completedCount = col.cards.filter(c => c.completed).length;
  const isUrgentCol    = col.name.toLowerCase().includes('urgent') || col.name.toLowerCase().includes('critical');

  const handleAddCard = () => {
    const title = newCardTitle.trim();
    if (!title) { textareaRef.current?.focus(); return; }
    addCard(col.id, title);
    showToast('Card created', 'success');
    setNewCardTitle('');
    setShowAddCard(false);
  };

  const handleDrop = (afterCardId: string | undefined, e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setActiveDropIdx(null);
    if (!dragState) return;

    if (dragState.fromInbox) {
      moveInboxCardToColumn(dragState.cardId, col.id, afterCardId);
      setDragState(null);
      showToast(`Moved to ${col.name}`, 'info');
      return;
    }

    moveCard(dragState.cardId, dragState.fromColId, col.id, afterCardId);
    setDragState(null);
    showToast('Card moved', 'info', 5000, {
      label: 'Undo',
      onClick: undoLastMove,
    });
  };

  const dropZoneProps = (afterCardId: string | undefined, idx: number) => ({
    className: `drop-zone${activeDropIdx === idx ? ' active' : ''}`,
    style: {
      height: activeDropIdx === idx ? 28 : 6,
      margin: '2px 0',
      borderRadius: 8,
      border: activeDropIdx === idx ? '1px dashed hsl(var(--primary))' : 'none',
      backgroundColor: activeDropIdx === idx ? 'hsl(var(--primary) / 0.1)' : 'transparent',
      transition: 'all 0.15s ease'
    },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setActiveDropIdx(idx); },
    onDragLeave: () => setActiveDropIdx(null),
    onDrop: (e: React.DragEvent) => handleDrop(afterCardId, e),
  });

  return (
    <div
      className="column"
      data-col-id={col.id}
    >
      {/* Header */}
      <div className="column-header">
        <div className="column-title-group">
          <span className="column-color-indicator" style={{ backgroundColor: dotColor }} />
          <span className="column-title">{col.name}</span>
          <span className="column-badge">
            {completedCount > 0 ? `${completedCount}/${col.cards.length}` : col.cards.length}
          </span>
        </div>
        {!isObserver && (
          <div className="column-actions">
            <div style={{ position: 'relative' }} ref={menuRef}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                title="Column options"
                onClick={e => {
                  e.stopPropagation();
                  setMenuOpen(o => !o);
                }}
              >
                <MoreHorizontal size={14} />
              </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -4 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    backgroundColor: 'hsl(var(--popover))',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--neu-shadow-floating)',
                    padding: 6,
                    zIndex: 70,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 150
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="sidebar-nav-item"
                    style={{ width: '100%', fontSize: 12.5, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setMenuOpen(false);
                      onStartRename(col.id, col.name);
                    }}
                  >
                    <Edit3 size={13} />
                    <span>Rename</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="sidebar-nav-item"
                    style={{ width: '100%', fontSize: 12.5, color: 'hsl(var(--destructive))', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setMenuOpen(false);
                      showConfirm({
                        title: `Delete Column "${col.name}"?`,
                        message: col.cards.length > 0
                          ? `Are you sure you want to delete this column and its ${col.cards.length} task(s)? This action cannot be undone.`
                          : `Are you sure you want to delete this column?`,
                        confirmText: 'Delete Column',
                        variant: 'danger',
                        icon: 'trash',
                        onConfirm: () => {
                          deleteColumn(col.id);
                          showToast(`Deleted column "${col.name}"`, 'info');
                        }
                      });
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Delete Column</span>
                  </motion.button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Cards container */}
      <div
        ref={cardsRef}
        className={`column-cards ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={e => { if (!cardsRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          if (!dragState || activeDropIdx !== null) return;
          handleDrop(undefined, e);
        }}
      >
        {dragState && <div {...dropZoneProps(col.cards[0]?.id, 0)} />}

        {col.cards.map((card, idx) => (
          <React.Fragment key={card.id}>
            <CardComponent
              card={card}
              cardIndex={idx}
              colId={col.id}
              accentColor={dotColor}
              isUrgent={isUrgentCol}
              isObserver={isObserver}
              onClick={() => onOpenCard(card.id)}
              onToggleComplete={e => {
                e.stopPropagation();
                if (!isObserver) toggleCardComplete(card.id);
              }}
              onDragStart={e => {
                if (isObserver) return;
                setDragState({ cardId: card.id, fromColId: col.id });
                (e.currentTarget as HTMLElement).classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => { setDragState(null); }}
            />
            {dragState && !isObserver && <div {...dropZoneProps(col.cards[idx + 1]?.id, idx + 1)} />}
          </React.Fragment>
        ))}

        {col.cards.length === 0 && !dragState && !showAddCard && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'hsl(var(--muted-foreground))',
              fontSize: 12,
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--neu-shadow-input)'
            }}
          >
            No tasks in this column
          </div>
        )}
      </div>

      {/* Footer / Add Card Form */}
      {!isObserver && (
        <div style={{ padding: '8px 12px 10px 12px', flexShrink: 0 }}>
          {showAddCard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                ref={textareaRef}
                className="textarea-input"
                placeholder="What needs to be done?"
                maxLength={140}
                rows={2}
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCard(); }
                  if (e.key === 'Escape') { setShowAddCard(false); setNewCardTitle(''); }
                }}
                autoFocus
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => { setShowAddCard(false); setNewCardTitle(''); }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={newCardTitle.trim() ? { scale: 0.95 } : undefined}
                  className="btn btn-primary"
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    opacity: newCardTitle.trim() ? 1 : 0.5,
                    cursor: newCardTitle.trim() ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!newCardTitle.trim()}
                  onClick={handleAddCard}
                >
                  Add Card
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="btn btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: 12.5,
                color: 'hsl(var(--muted-foreground))',
                padding: '6px 8px',
              }}
              onClick={() => setShowAddCard(true)}
            >
              <Plus size={13} />
              <span>Add a card...</span>
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
