import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, X, Calendar, ArrowRight, Layout, Users, CheckSquare,
  Columns, User, CheckCircle2, ChevronRight, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { formatDueDate, avatarInitials } from '../../utils';
import { LABELS, type Card, type Board, type Member } from '../../types';

interface Props {
  onClose: () => void;
  onOpenCard: (cardId: string, boardId: string) => void;
  onSelectBoard?: (boardId: string) => void;
  onFilterMember?: (memberId: string) => void;
  scope?: 'board' | 'global';
  activeBoardId?: string | null;
}

type FilterCategory = 'all' | 'boards' | 'tasks' | 'members' | 'columns';

export default function SearchModal({
  onClose,
  onOpenCard,
  onSelectBoard,
  onFilterMember,
  scope = 'global',
  activeBoardId
}: Props) {
  const [query, setQuery] = useState('');
  const [currentScope, setCurrentScope] = useState<'board' | 'global'>(
    scope === 'board' && activeBoardId ? 'board' : 'global'
  );
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allBoards = useWorkStore(s => s.boards);
  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const switchBoard = useWorkStore(s => s.switchBoard);
  const storeActiveBoardId = useWorkStore(s => s.activeBoardId);
  const user = useAuthStore(s => s.user);
  const customLabels = useSettingsStore(s => s.customLabels);

  const allLabels = useMemo(() => [...LABELS, ...customLabels], [customLabels]);
  const visibleBoards = useMemo(() => getVisibleBoards(user?.email), [getVisibleBoards, user?.email, allBoards]);

  const targetBoardId = activeBoardId || storeActiveBoardId;
  const currentBoard = useMemo(
    () => visibleBoards.find(b => b.id === targetBoardId) || visibleBoards[0] || null,
    [visibleBoards, targetBoardId]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset category and selection when scope or query changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query, currentScope, activeCategory]);

  const trimmed = query.trim().toLowerCase();

  // ── Results Search Logic ──────────────────────────────────
  const searchResults = useMemo(() => {
    const matchedBoards: Array<{ board: Board; totalCards: number; membersCount: number }> = [];
    const matchedTasks: Array<{ card: Card; colName: string; boardId: string; boardName: string; boardColor: string }> = [];
    const matchedMembers: Array<{ member: Member; boardId: string; boardName: string; assignedCardsCount: number }> = [];
    const matchedColumns: Array<{ colId: string; colName: string; boardId: string; boardName: string; cardCount: number }> = [];

    if (currentScope === 'board' && currentBoard) {
      // ── INSIDE BOARD: Only search tasks, members, and columns inside currentBoard ──
      const b = currentBoard;

      // 1. Columns & Tasks in this board
      (b.columns || []).forEach(col => {
        if (trimmed && col.name.toLowerCase().includes(trimmed)) {
          matchedColumns.push({
            colId: col.id,
            colName: col.name,
            boardId: b.id,
            boardName: b.name,
            cardCount: col.cards?.length || 0,
          });
        }

        (col.cards || []).forEach(card => {
          if (!trimmed) return;
          const matchTitle = card.title.toLowerCase().includes(trimmed);
          const matchDesc = card.description?.toLowerCase().includes(trimmed);
          const matchLabels = (card.labels || []).some(l => {
            const lbl = allLabels.find(x => x.id === l);
            return lbl?.name.toLowerCase().includes(trimmed);
          });
          const matchAssignees = (card.assignees || []).some(mId => {
            const m = b.members?.find(mem => mem.id === mId);
            return m?.name.toLowerCase().includes(trimmed) || m?.email.toLowerCase().includes(trimmed);
          });
          const matchCol = col.name.toLowerCase().includes(trimmed);

          if (matchTitle || matchDesc || matchLabels || matchAssignees || matchCol) {
            matchedTasks.push({
              card,
              colName: col.name,
              boardId: b.id,
              boardName: b.name,
              boardColor: b.color || '#6366f1',
            });
          }
        });
      });

      // Inbox cards in this board
      (b.inboxCards || []).forEach(card => {
        if (!trimmed) return;
        const matchTitle = card.title.toLowerCase().includes(trimmed);
        const matchDesc = card.description?.toLowerCase().includes(trimmed);
        if (matchTitle || matchDesc) {
          matchedTasks.push({
            card,
            colName: 'Inbox',
            boardId: b.id,
            boardName: b.name,
            boardColor: b.color || '#6366f1',
          });
        }
      });

      // 2. Members in this board
      (b.members || []).forEach(m => {
        if (!trimmed) return;
        const matchName = m.name?.toLowerCase().includes(trimmed);
        const matchEmail = m.email?.toLowerCase().includes(trimmed);
        const matchRole = m.role?.toLowerCase().includes(trimmed);

        if (matchName || matchEmail || matchRole) {
          let assignedCount = 0;
          (b.columns || []).forEach(col => {
            (col.cards || []).forEach(c => {
              if (c.assignees?.includes(m.id)) assignedCount++;
            });
          });
          matchedMembers.push({
            member: m,
            boardId: b.id,
            boardName: b.name,
            assignedCardsCount: assignedCount,
          });
        }
      });
    } else {
      // ── GLOBAL OVERVIEW: Search across ALL boards ──
      visibleBoards.forEach(b => {
        const totalCardsInBoard = (b.columns || []).reduce((acc, col) => acc + (col.cards?.length || 0), 0) + (b.inboxCards?.length || 0);

        // 1. Board matches
        if (trimmed && (b.name.toLowerCase().includes(trimmed) || (b.createdBy && b.createdBy.toLowerCase().includes(trimmed)))) {
          matchedBoards.push({
            board: b,
            totalCards: totalCardsInBoard,
            membersCount: b.members?.length || 0,
          });
        }

        // 2. Tasks across boards
        (b.columns || []).forEach(col => {
          (col.cards || []).forEach(card => {
            if (!trimmed) return;
            const matchTitle = card.title.toLowerCase().includes(trimmed);
            const matchDesc = card.description?.toLowerCase().includes(trimmed);
            const matchLabels = (card.labels || []).some(l => {
              const lbl = allLabels.find(x => x.id === l);
              return lbl?.name.toLowerCase().includes(trimmed);
            });
            const matchAssignees = (card.assignees || []).some(mId => {
              const m = b.members?.find(mem => mem.id === mId);
              return m?.name.toLowerCase().includes(trimmed) || m?.email.toLowerCase().includes(trimmed);
            });
            const matchBoardName = b.name.toLowerCase().includes(trimmed);

            if (matchTitle || matchDesc || matchLabels || matchAssignees || matchBoardName) {
              matchedTasks.push({
                card,
                colName: col.name,
                boardId: b.id,
                boardName: b.name,
                boardColor: b.color || '#6366f1',
              });
            }
          });
        });

        // 3. Members across boards
        (b.members || []).forEach(m => {
          if (!trimmed) return;
          const matchName = m.name?.toLowerCase().includes(trimmed);
          const matchEmail = m.email?.toLowerCase().includes(trimmed);
          if (matchName || matchEmail) {
            // Avoid duplicates across multiple boards
            const existing = matchedMembers.find(item => item.member.email?.toLowerCase() === m.email?.toLowerCase());
            if (!existing) {
              matchedMembers.push({
                member: m,
                boardId: b.id,
                boardName: b.name,
                assignedCardsCount: 1,
              });
            }
          }
        });
      });
    }

    return {
      boards: matchedBoards,
      tasks: matchedTasks,
      members: matchedMembers,
      columns: matchedColumns,
    };
  }, [currentScope, currentBoard, visibleBoards, trimmed, allLabels]);

  // Combined flat list of navigable items based on activeCategory
  const flatItems = useMemo(() => {
    const items: Array<
      | { type: 'board'; data: { board: Board; totalCards: number; membersCount: number } }
      | { type: 'task'; data: { card: Card; colName: string; boardId: string; boardName: string; boardColor: string } }
      | { type: 'member'; data: { member: Member; boardId: string; boardName: string; assignedCardsCount: number } }
      | { type: 'column'; data: { colId: string; colName: string; boardId: string; boardName: string; cardCount: number } }
    > = [];

    if (activeCategory === 'all' || activeCategory === 'boards') {
      searchResults.boards.forEach(b => items.push({ type: 'board', data: b }));
    }
    if (activeCategory === 'all' || activeCategory === 'tasks') {
      searchResults.tasks.forEach(t => items.push({ type: 'task', data: t }));
    }
    if (activeCategory === 'all' || activeCategory === 'members') {
      searchResults.members.forEach(m => items.push({ type: 'member', data: m }));
    }
    if (activeCategory === 'all' || activeCategory === 'columns') {
      searchResults.columns.forEach(c => items.push({ type: 'column', data: c }));
    }

    return items;
  }, [searchResults, activeCategory]);

  const totalResultsCount =
    searchResults.boards.length +
    searchResults.tasks.length +
    searchResults.members.length +
    searchResults.columns.length;

  const handleSelectItem = (item: (typeof flatItems)[0]) => {
    if (!item) return;
    if (item.type === 'board') {
      if (onSelectBoard) {
        onSelectBoard(item.data.board.id);
      } else {
        switchBoard(item.data.board.id);
      }
      onClose();
    } else if (item.type === 'task') {
      if (item.data.boardId !== storeActiveBoardId) {
        switchBoard(item.data.boardId);
      }
      onOpenCard(item.data.card.id, item.data.boardId);
      onClose();
    } else if (item.type === 'member') {
      if (item.data.boardId !== storeActiveBoardId) {
        switchBoard(item.data.boardId);
      }
      if (onFilterMember) {
        onFilterMember(item.data.member.id);
      }
      onClose();
    } else if (item.type === 'column') {
      if (item.data.boardId !== storeActiveBoardId) {
        switchBoard(item.data.boardId);
      }
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => (flatItems.length ? (prev + 1) % flatItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => (flatItems.length ? (prev - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === 'Enter' && flatItems.length > 0) {
      e.preventDefault();
      handleSelectItem(flatItems[selectedIdx] || flatItems[0]);
    }
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 10, translateZ: -40 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 10, translateZ: -40 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 640, maxHeight: '82vh', transformStyle: 'preserve-3d', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 10 }}>
            <Search size={17} color="hsl(var(--primary))" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              className="text-input"
              style={{
                flex: 1,
                fontSize: 14.5,
                color: 'hsl(var(--foreground))',
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                padding: '4px 0',
              }}
              placeholder={
                currentScope === 'board' && currentBoard
                  ? `Search tasks, members, columns in "${currentBoard.name}"...`
                  : 'Search across all boards, tasks, and members...'
              }
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                className="icon-btn"
                style={{ width: 26, height: 26 }}
                onClick={() => setQuery('')}
              >
                <X size={13} />
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}>
              <X size={15} />
            </motion.button>
          </div>

          {/* Scope indicator and toggle pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 10px 18px', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {currentBoard && scope === 'board' ? (
                <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--secondary) / 0.5)', padding: 3, borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCurrentScope('board')}
                    style={{
                      border: 'none',
                      background: currentScope === 'board' ? 'hsl(var(--primary))' : 'transparent',
                      color: currentScope === 'board' ? '#fff' : 'hsl(var(--muted-foreground))',
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Layout size={11} /> This Board ({currentBoard.name})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentScope('global')}
                    style={{
                      border: 'none',
                      background: currentScope === 'global' ? 'hsl(var(--primary))' : 'transparent',
                      color: currentScope === 'global' ? '#fff' : 'hsl(var(--muted-foreground))',
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckSquare size={11} /> All Boards ({visibleBoards.length})
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                    Overview Search
                  </span>
                  <span>Searching all {visibleBoards.length} boards</span>
                </div>
              )}
            </div>

            {/* Category Filter Tabs */}
            {trimmed && totalResultsCount > 0 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  style={{
                    border: 'none',
                    background: activeCategory === 'all' ? 'hsl(var(--card))' : 'transparent',
                    boxShadow: activeCategory === 'all' ? 'var(--neu-shadow-raised-sm)' : 'none',
                    color: activeCategory === 'all' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  All ({totalResultsCount})
                </button>
                {currentScope === 'global' && searchResults.boards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('boards')}
                    style={{
                      border: 'none',
                      background: activeCategory === 'boards' ? 'hsl(var(--card))' : 'transparent',
                      boxShadow: activeCategory === 'boards' ? 'var(--neu-shadow-raised-sm)' : 'none',
                      color: activeCategory === 'boards' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Boards ({searchResults.boards.length})
                  </button>
                )}
                {searchResults.tasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('tasks')}
                    style={{
                      border: 'none',
                      background: activeCategory === 'tasks' ? 'hsl(var(--card))' : 'transparent',
                      boxShadow: activeCategory === 'tasks' ? 'var(--neu-shadow-raised-sm)' : 'none',
                      color: activeCategory === 'tasks' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Tasks ({searchResults.tasks.length})
                  </button>
                )}
                {searchResults.members.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('members')}
                    style={{
                      border: 'none',
                      background: activeCategory === 'members' ? 'hsl(var(--card))' : 'transparent',
                      boxShadow: activeCategory === 'members' ? 'var(--neu-shadow-raised-sm)' : 'none',
                      color: activeCategory === 'members' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Members ({searchResults.members.length})
                  </button>
                )}
                {currentScope === 'board' && searchResults.columns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('columns')}
                    style={{
                      border: 'none',
                      background: activeCategory === 'columns' ? 'hsl(var(--card))' : 'transparent',
                      boxShadow: activeCategory === 'columns' ? 'var(--neu-shadow-raised-sm)' : 'none',
                      color: activeCategory === 'columns' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Columns ({searchResults.columns.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body / Results List */}
        <div className="modal-body" style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          {!trimmed ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <Search size={28} style={{ opacity: 0.35, marginBottom: 10 }} />
              {currentScope === 'board' && currentBoard ? (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    Searching inside "{currentBoard.name}"
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Type to find tasks, team members, and columns in this board...
                  </div>
                  {/* Quick member shortcuts */}
                  {(currentBoard.members || []).length > 0 && (
                    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Board Members
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                        {currentBoard.members.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 20, height: 26 }}
                            onClick={() => {
                              setQuery(m.name);
                            }}
                          >
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                            ) : (
                              <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {avatarInitials(m.name)}
                              </div>
                            )}
                            <span>{m.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    Overview Search
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Type to search across all {visibleBoards.length} boards, tasks, descriptions, and members...
                  </div>
                  {/* Quick boards shortcut */}
                  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Available Boards
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      {visibleBoards.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 20, height: 26 }}
                          onClick={() => {
                            if (onSelectBoard) onSelectBoard(b.id);
                            else switchBoard(b.id);
                            onClose();
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: b.color || '#6366f1' }} />
                          <span>{b.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : totalResultsCount === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>No results found for "{query}"</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {currentScope === 'board'
                  ? 'No tasks, members, or columns match in this board. Try switching to "All Boards" above.'
                  : 'Check your spelling or try searching with a different keyword.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Section 1: Boards (when in global overview mode) */}
              {currentScope === 'global' && (activeCategory === 'all' || activeCategory === 'boards') && searchResults.boards.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layout size={12} /> Boards ({searchResults.boards.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.boards.map(({ board, totalCards, membersCount }) => {
                      const isSelected = flatItems[selectedIdx]?.type === 'board' && (flatItems[selectedIdx]?.data as any)?.board?.id === board.id;
                      return (
                        <motion.div
                          key={board.id}
                          whileTap={{ scale: 0.98 }}
                          className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            backgroundColor: isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
                            border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (onSelectBoard) onSelectBoard(board.id);
                            else switchBoard(board.id);
                            onClose();
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: `${board.color || '#6366f1'}20`,
                              border: `1.5px solid ${board.color || '#6366f1'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Layout size={16} style={{ color: board.color || '#6366f1' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                {board.name}
                              </span>
                              {board.id === storeActiveBoardId && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                                  Active
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                              <span>{totalCards} {totalCards === 1 ? 'task' : 'tasks'}</span>
                              <span>•</span>
                              <span>{board.columns?.length || 0} columns</span>
                              <span>•</span>
                              <span>{membersCount} {membersCount === 1 ? 'member' : 'members'}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'hsl(var(--primary))' }}>
                            <span>Open Board</span>
                            <ArrowRight size={13} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: Members / Users */}
              {(activeCategory === 'all' || activeCategory === 'members') && searchResults.members.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={12} /> Team Members ({searchResults.members.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.members.map(({ member, boardId, boardName, assignedCardsCount }) => {
                      const isSelected = flatItems[selectedIdx]?.type === 'member' && (flatItems[selectedIdx]?.data as any)?.member?.id === member.id;
                      return (
                        <motion.div
                          key={`${boardId}-${member.id}`}
                          whileTap={{ scale: 0.98 }}
                          className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            backgroundColor: isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
                            border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (boardId !== storeActiveBoardId) switchBoard(boardId);
                            if (onFilterMember) onFilterMember(member.id);
                            onClose();
                          }}
                        >
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: member.color || '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {avatarInitials(member.name)}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                {member.name}
                              </span>
                              {member.role && (
                                <span style={{ fontSize: 10, textTransform: 'capitalize', padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}>
                                  {member.role}
                                </span>
                              )}
                              {currentScope === 'global' && (
                                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>
                                  in {boardName}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.email}
                            </div>
                          </div>
                          {assignedCardsCount > 0 && (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                              {assignedCardsCount} {assignedCardsCount === 1 ? 'task' : 'tasks'}
                            </span>
                          )}
                          <ArrowRight size={13} color="hsl(var(--muted-foreground))" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Columns (in board scope) */}
              {currentScope === 'board' && (activeCategory === 'all' || activeCategory === 'columns') && searchResults.columns.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Columns size={12} /> Columns ({searchResults.columns.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.columns.map(col => (
                      <div
                        key={col.colId}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border) / 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Columns size={13} color="hsl(var(--primary))" />
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{col.colName}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          {col.cardCount} {col.cardCount === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Tasks / Cards */}
              {(activeCategory === 'all' || activeCategory === 'tasks') && searchResults.tasks.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckSquare size={12} /> Tasks ({searchResults.tasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.tasks.map(({ card, colName, boardId, boardName, boardColor }) => {
                      const isSelected = flatItems[selectedIdx]?.type === 'task' && (flatItems[selectedIdx]?.data as any)?.card?.id === card.id;
                      return (
                        <motion.div
                          key={card.id}
                          whileTap={{ scale: 0.98 }}
                          className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            alignItems: 'flex-start',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            backgroundColor: isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
                            border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (boardId !== storeActiveBoardId) switchBoard(boardId);
                            onOpenCard(card.id, boardId);
                            onClose();
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                              {currentScope === 'global' && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    backgroundColor: `${boardColor}18`,
                                    color: boardColor,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Layout size={10} /> {boardName}
                                </span>
                              )}
                              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                                in <strong>{colName}</strong>
                              </span>
                              {card.completed && (
                                <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                                  <CheckCircle2 size={11} /> Done
                                </span>
                              )}
                              {card.dueDate && (
                                <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Calendar size={10} />
                                  {formatDueDate(card.dueDate)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ textDecoration: card.completed ? 'line-through' : 'none', opacity: card.completed ? 0.75 : 1 }}>
                                {card.title}
                              </span>
                            </div>
                            {card.description && (
                              <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                                {card.description}
                              </div>
                            )}
                          </div>
                          <ArrowRight size={13} style={{ marginTop: 4 }} color="hsl(var(--muted-foreground))" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Keyboard Shortcuts Info */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid hsl(var(--border) / 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span><kbd className="topbar-shortcut-pill">↑</kbd> <kbd className="topbar-shortcut-pill">↓</kbd> Navigate</span>
            <span><kbd className="topbar-shortcut-pill">↵</kbd> Select</span>
            <span><kbd className="topbar-shortcut-pill">Esc</kbd> Close</span>
          </div>
          <div>
            {currentScope === 'board' && currentBoard
              ? `Scoped to ${currentBoard.name}`
              : `Searching across all ${visibleBoards.length} boards`}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
