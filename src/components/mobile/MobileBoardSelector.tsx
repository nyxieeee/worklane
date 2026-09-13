import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanSquare, Plus, X, Check, ArrowRight } from 'lucide-react';
import type { Board } from '../../types';

interface MobileBoardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
}

export default function MobileBoardSelector({
  isOpen,
  onClose,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
}: MobileBoardSelectorProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(10, 10, 12, 0.68)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '85dvh',
              backgroundColor: 'hsl(var(--card))',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTop: '1px solid hsl(var(--border) / 0.6)',
              boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingBottom: 'max(16px, var(--sab))',
              zIndex: 121,
            }}
          >
            {/* Drag Handle Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <div
                style={{
                  width: 38,
                  height: 4.5,
                  borderRadius: 999,
                  backgroundColor: 'hsl(var(--muted-foreground) / 0.35)',
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 18px 14px 18px',
                borderBottom: '1px solid hsl(var(--border) / 0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KanbanSquare size={18} color="hsl(var(--primary))" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', margin: 0 }}>
                  Select a Board
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 9999,
                    backgroundColor: 'hsl(var(--secondary))',
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  {boards.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateBoard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  <Plus size={14} />
                  <span>New</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  className="icon-btn"
                  onClick={onClose}
                  style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }}
                  title="Close"
                >
                  <X size={16} />
                </motion.button>
              </div>
            </div>

            {/* Boards List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {boards.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                  <KanbanSquare size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 4 }}>
                    No boards yet
                  </div>
                  <p style={{ fontSize: 12.5, margin: 0 }}>Create your first board to start managing tasks.</p>
                </div>
              ) : (
                boards.map(board => {
                  const isActive = board.id === activeBoardId;
                  const totalCards = board.columns?.reduce((sum, col) => sum + (col.cards?.length || 0), 0) || 0;
                  const doneCards = board.columns?.reduce((sum, col) => sum + (col.cards?.filter(c => c.completed)?.length || 0), 0) || 0;
                  const progress = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;

                  return (
                    <motion.div
                      key={board.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectBoard(board.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '13px 14px',
                        borderRadius: 14,
                        backgroundColor: isActive ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                        border: isActive ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                        boxShadow: isActive ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: '50%',
                            backgroundColor: board.color || 'hsl(var(--primary))',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: 'hsl(var(--foreground))',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {board.name}
                            </span>
                            {isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  backgroundColor: 'hsl(var(--primary))',
                                  color: 'hsl(var(--primary-foreground))',
                                  flexShrink: 0,
                                }}
                              >
                                Active
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 11.5,
                              color: 'hsl(var(--muted-foreground))',
                              marginTop: 3,
                            }}
                          >
                            <span>{board.columns?.length || 0} cols</span>
                            <span>•</span>
                            <span>{totalCards} tasks ({progress}% done)</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 8 }}>
                        {isActive ? (
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: 'hsl(var(--primary))',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: 'hsl(var(--secondary))',
                              color: 'hsl(var(--muted-foreground))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ArrowRight size={14} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
