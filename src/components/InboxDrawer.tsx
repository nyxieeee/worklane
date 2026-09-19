import React, { useState } from 'react';
import {
  Inbox, Plus, X, Search, ChevronLeft,
  MessageSquare, Paperclip, Calendar, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card as CardType, Board, LABELS } from '../types';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { formatDueDate, useIsMobile } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  board: Board | null;
  onOpenCard: (cardId: string) => void;
  onDragStart?: (e: React.DragEvent, cardId: string) => void;
  onDragEnd?: () => void;
  dragState?: { cardId: string; fromColId: string; fromInbox?: boolean } | null;
  docked?: boolean;
}

export function InboxDrawer({
  isOpen,
  onClose,
  board,
  onOpenCard,
  onDragStart,
  onDragEnd,
  dragState,
  docked = false,
}: Props) {
  const isMobile = useIsMobile(860);
  const isDocked = docked && !isMobile;

  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isHoveredDrop, setIsHoveredDrop] = useState(false);

  const addInboxCard = useWorkStore(s => s.addInboxCard);
  const deleteInboxCard = useWorkStore(s => s.deleteInboxCard);
  const moveColumnCardToInbox = useWorkStore(s => s.moveColumnCardToInbox);
  const moveInboxCardToColumn = useWorkStore(s => s.moveInboxCardToColumn);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);

  const inboxCards: CardType[] = board?.inboxCards || [];

  const filteredCards = inboxCards.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  // Drag over inbox panel
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragState && !dragState.fromInbox) {
      setIsHoveredDrop(true);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the panel entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsHoveredDrop(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveredDrop(false);
    if (!dragState || dragState.fromInbox || !board) return;

    moveColumnCardToInbox(dragState.cardId, dragState.fromColId);
    showToast('Moved card to Inbox', 'info');
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !board) return;
    addInboxCard(newTitle.trim(), board.id);
    setNewTitle('');
    showToast('Employee request added to Inbox', 'success');
  };

  const handleDeleteCard = (e: React.MouseEvent, card: CardType) => {
    e.stopPropagation();
    showConfirm({
      title: `Delete "${card.title}"?`,
      message: `Are you sure you want to permanently delete this concern from your Inbox? This action cannot be undone.`,
      confirmText: 'Delete Concern',
      variant: 'danger',
      icon: 'trash',
      onConfirm: () => {
        deleteInboxCard(card.id);
        showToast('Inbox concern deleted', 'info');
      }
    });
  };

  const handleQuickMove = (card: CardType) => {
    if (!board || !defaultTargetCol) return;
    moveInboxCardToColumn(card.id, defaultTargetCol.id);
    showToast(`Prioritized to "${defaultTargetCol.name}"`, 'success');
  };

  // Find first non-done column for quick move button
  const defaultTargetCol = board?.columns?.find(
    c => !c.name.toLowerCase().includes('done')
  ) || board?.columns?.[0];

  return (
    <AnimatePresence>
      {isOpen && isMobile && (
        <motion.div
          key="inbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="inbox-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 14, 22, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 140,
          }}
        />
      )}
      {isOpen && (
        <motion.aside
          key="inbox-drawer-panel"
          initial={
              isMobile
                ? { x: '-100%' }
                : isDocked
                ? { width: 0, opacity: 0, rotateY: -18, translateZ: -35, scale: 0.94 }
                : { x: -340, opacity: 0, rotateY: -15 }
            }
            animate={
              isMobile
                ? { x: 0 }
                : isDocked
                ? { width: 320, opacity: 1, rotateY: 0, translateZ: 0, scale: 1 }
                : { x: 0, opacity: 1, rotateY: 0 }
            }
            exit={
              isMobile
                ? { x: '-100%' }
                : isDocked
                ? { width: 0, opacity: 0, rotateY: -18, translateZ: -35, scale: 0.94 }
                : { x: -340, opacity: 0, rotateY: -15 }
            }
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 240,
              mass: 0.85,
            }}
            className={`inbox-drawer-panel ${isDocked ? 'inbox-docked' : ''}`}
            style={
              isMobile ? {
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: 'min(320px, 86vw)',
                maxWidth: '86vw',
                height: '100dvh',
                zIndex: 150,
                paddingTop: 'max(8px, var(--sat))',
                paddingBottom: 'max(14px, var(--sab))',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--card))',
                boxShadow: '10px 0 35px rgba(0, 0, 0, 0.45)',
                borderRight: '1px solid hsl(var(--border) / 0.6)',
                borderRadius: 0,
                overflow: 'hidden',
              } : (isDocked ? {
                position: 'relative',
                width: 320,
                minWidth: 0,
                height: '100%',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--card))',
                border: '1.5px solid hsl(var(--primary) / 0.35)',
                borderRadius: 14,
                boxShadow: 'var(--neu-shadow-raised)',
                overflow: 'hidden',
                transformOrigin: 'left center',
                transformStyle: 'preserve-3d',
                perspective: 1200,
              } : {
                position: 'absolute',
                top: 16,
                left: 16,
                bottom: 16,
                width: 'min(320px, calc(100vw - 32px))',
                maxWidth: 'calc(100vw - 32px)',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                background: 'hsl(var(--card) / 0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid hsl(var(--border) / 0.8)',
                borderRadius: 16,
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.35), 0 0 0 1px hsl(var(--border) / 0.4)',
                overflow: 'hidden',
                transformOrigin: 'left center',
                transformStyle: 'preserve-3d',
              })
            }
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div
              style={{
                padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid hsl(var(--border) / 0.6)',
              background: 'hsl(var(--muted) / 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Inbox size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  Inbox
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                  }}
                >
                  {inboxCards.length}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close Inbox"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Info Banner */}
          <div
            style={{
              padding: '8px 14px',
              fontSize: 11.5,
              color: 'hsl(var(--muted-foreground))',
              background: 'hsl(var(--muted) / 0.15)',
              borderBottom: '1px solid hsl(var(--border) / 0.4)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span>Employee concerns & backlog. Drag to board to prioritize.</span>
          </div>

          {/* Search Box if cards > 3 */}
          {inboxCards.length > 3 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: 'hsl(var(--muted) / 0.3)',
                  border: '1px solid hsl(var(--border) / 0.5)',
                }}
              >
                <Search size={13} color="hsl(var(--muted-foreground))" />
                <input
                  type="text"
                  placeholder="Filter concerns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 12,
                    color: 'hsl(var(--foreground))',
                    width: '100%',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cards List / Drop Target */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: isHoveredDrop ? 'hsl(var(--primary) / 0.08)' : 'transparent',
              transition: 'background 0.2s ease',
            }}
          >
            {isHoveredDrop && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '2px dashed hsl(var(--primary))',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Inbox size={14} /> Drop card here to move to Inbox
              </div>
            )}

            {filteredCards.length === 0 && !isHoveredDrop && (
              <div
                style={{
                  padding: '30px 16px',
                  textAlign: 'center',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Inbox size={28} style={{ opacity: 0.35 }} />
                <span>No inbox items yet.</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  Add a new concern below or drag a card here from the board.
                </span>
              </div>
            )}

            {filteredCards.map((card) => {
              return (
                <div
                  key={card.id}
                  draggable={!!onDragStart}
                  onDragStart={(e) => onDragStart?.(e, card.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenCard(card.id)}
                  style={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'grab',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    flexShrink: 0,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'hsl(var(--border))';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Labels */}
                  {card.labels?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {card.labels.map(lId => {
                        const lbl = LABELS.find(l => l.id === lId);
                        if (!lbl) return null;
                        return (
                          <span
                            key={lId}
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: `${lbl.color}22`,
                              color: lbl.color,
                              border: `1px solid ${lbl.color}44`,
                            }}
                          >
                            {lbl.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Title */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.35 }}>
                    {card.title}
                  </div>

                  {/* Description preview */}
                  {card.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'hsl(var(--muted-foreground))',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.description}
                    </div>
                  )}

                  {/* Badges & Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {card.attachments?.length > 0 && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'hsl(var(--primary) / 0.12)',
                            color: 'hsl(var(--primary))',
                          }}
                          title="Task Guide / Attachment"
                        >
                          <Paperclip size={10} /> {card.attachments.length}
                        </span>
                      )}

                      {card.comments?.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                          <MessageSquare size={10} /> {card.comments.length}
                        </span>
                      )}

                      {card.dueDate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                          <Calendar size={10} /> {formatDueDate(card.dueDate)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteCard(e, card)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'hsl(var(--muted-foreground))',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease, background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'hsl(var(--destructive))';
                          e.currentTarget.style.background = 'hsl(var(--destructive) / 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Delete Concern"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Quick Move to column button */}
                      {defaultTargetCol && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveInboxCardToColumn(card.id, defaultTargetCol.id);
                          }}
                          style={{
                            background: 'hsl(var(--muted) / 0.4)',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 6,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'hsl(var(--muted-foreground))',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title={`Move to ${defaultTargetCol.name}`}
                        >
                          <span>→ {defaultTargetCol.name}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Concern Form */}
          <form
            onSubmit={handleAddCard}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid hsl(var(--border) / 0.6)',
              background: 'hsl(var(--muted) / 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              <input
                type="text"
                placeholder="Add employee concern or task..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 12.5,
                  color: 'hsl(var(--foreground))',
                  width: '100%',
                }}
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                style={{
                  background: newTitle.trim() ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  color: newTitle.trim() ? '#fff' : 'hsl(var(--muted-foreground))',
                  border: 'none',
                  borderRadius: 6,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: newTitle.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
                title="Add to Inbox"
              >
                <Plus size={14} />
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', textAlign: 'right' }}>
              Press <kbd style={{ padding: '1px 4px', borderRadius: 4, background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>Enter</kbd> to add
            </div>
          </form>
        </div>
      </motion.aside>
    )}
  </AnimatePresence>
  );
}
