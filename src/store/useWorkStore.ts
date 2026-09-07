import { create } from 'zustand';
import type { Board, Column, Card, Member, MemberRole, Attachment, Comment } from '../types';
import { AVATAR_COLORS, LABELS } from '../types';
import { uid, avatarInitials, sortMembersWithOwnerFirst } from '../utils';
import { useEmailStore } from './useEmailStore';
import { useAuthStore } from './useAuthStore';
import { useNotifStore } from './useNotifStore';
import { supabaseService } from '../services/supabaseService';

interface WorkState {
  boards: Board[];
  activeBoardId: string | null;
  lastMoveSnapshot: Board | null;
  isLoadingCloud: boolean;
  hasLoadedOnce: boolean;

  // Cloud sync actions
  loadBoardsFromCloud: (userEmail: string) => Promise<void>;
  syncBoardToCloud: (boardId: string) => Promise<void>;

  // Board actions
  createBoard: (name: string, color: string, createdBy?: string, creatorName?: string) => Promise<Board>;
  deleteBoard: (boardId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  updateBoardColor: (boardId: string, color: string) => void;
  leaveBoard: (boardId: string, userEmail: string) => void;
  switchBoard: (boardId: string) => void;
  joinBoardFromCloud: (boardId: string, role: MemberRole, user: { name?: string; email: string; avatarUrl?: string }) => Promise<Board | null>;
  syncCurrentUserProfile: (user: { name?: string; email?: string; avatarUrl?: string; borderStyle?: string }) => void;
  removeUserFromAllBoards: (userEmail: string) => void;

  // Visibility selector
  getVisibleBoards: (userEmail?: string) => Board[];

  // Column actions
  addColumn: (name: string) => void;
  deleteColumn: (colId: string) => void;
  renameColumn: (colId: string, name: string) => void;

  // Card actions
  addCard: (colId: string, title: string) => Card;
  updateCard: (cardId: string, patch: Partial<Card>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, fromColId: string, toColId: string, afterCardId?: string) => void;
  undoLastMove: () => void;
  toggleCardComplete: (cardId: string) => void;
  toggleCardLabel: (cardId: string, labelId: string) => void;
  toggleCardAssignee: (cardId: string, memberId: string) => void;

  // Inbox actions
  addInboxCard: (title: string, boardId?: string) => Card;
  deleteInboxCard: (cardId: string) => void;
  moveInboxCardToColumn: (cardId: string, toColId: string, afterCardId?: string) => void;
  moveColumnCardToInbox: (cardId: string, fromColId: string) => void;

  // Attachment actions
  addAttachment: (cardId: string, att: Attachment) => void;
  removeAttachment: (cardId: string, attId: string) => void;

  // Comment actions
  addComment: (cardId: string, text: string, parentId?: string | null, replyToAuthor?: string | null, attachments?: Attachment[]) => void;
  deleteComment: (cardId: string, commentId: string) => void;

  // Member actions
  addMember: (name: string, email: string, avatarUrl?: string, role?: MemberRole, userId?: string, borderStyle?: string) => Promise<string | null>;
  updateMember: (memberId: string, patch: Partial<Member>) => void;
  updateMemberRole: (boardId: string, memberId: string, role: MemberRole) => void;
  removeMember: (memberId: string) => void;

  // Helpers (read-only selectors)
  getActiveBoard: () => Board | undefined;
  getBoard: (boardId: string) => Board | undefined;
  findCard: (cardId: string, boardId?: string) => { card: Card; column?: Column; board: Board; isInbox?: boolean } | null;
}

const COLUMN_ORDER_MAP: Record<string, number> = {
  urgent: 0, critical: 0,
  'to do': 1, todo: 1, backlog: 1,
  'in progress': 2, active: 2, doing: 2,
  review: 3, qa: 3, testing: 3,
  done: 4, complete: 4, completed: 4,
};

function getColOrder(name: string): number {
  const n = name.trim().toLowerCase();
  for (const [key, val] of Object.entries(COLUMN_ORDER_MAP)) {
    if (n.includes(key)) return val;
  }
  return 99;
}

export function sortColumnsByWorkflow(columns: Column[]): Column[] {
  return [...columns].sort((a, b) => getColOrder(a.name) - getColOrder(b.name));
}

function findCardInBoard(board: Board, cardId: string): { card: Card; column?: Column; isInbox?: boolean } | null {
  for (const col of board.columns || []) {
    const card = col.cards?.find(c => c.id === cardId);
    if (card) return { card, column: col, isInbox: false };
  }
  const inboxCard = (board.inboxCards || []).find(c => c.id === cardId);
  if (inboxCard) return { card: inboxCard, isInbox: true };
  return null;
}

function updateBoards(boards: Board[], targetBoardId: string, updater: (b: Board) => Board): Board[] {
  return boards.map(b => (b.id === targetBoardId ? updater(b) : b));
}

function updateColumns(board: Board, targetColId: string, updater: (col: Column) => Column): Board {
  return {
    ...board,
    columns: (board.columns || []).map(c => (c.id === targetColId ? updater(c) : c)),
  };
}

function updateCardInBoard(board: Board, cardId: string, updater: (c: Card) => Card): Board {
  return {
    ...board,
    columns: (board.columns || []).map(col => ({
      ...col,
      cards: (col.cards || []).map(c => c.id === cardId ? updater(c) : c),
    })),
    inboxCards: (board.inboxCards || []).map(c => c.id === cardId ? updater(c) : c),
  };
}

const syncTimers = new Map<string, number>();
const activeSyncBoards = new Set<string>();
const lastLocalMutationTimes = new Map<string, number>(); // boardId -> timestamp ms
const recentlyRemovedEmails = new Map<string, number>(); // email -> timestamp ms
const recentlyAddedMembers = new Map<string, number>(); // email -> timestamp ms
const recentlyUpdatedMemberStyles = new Map<string, { borderStyle: string; timestamp: number }>(); // id or email -> { borderStyle, timestamp }
const recentlyUpdatedMemberAvatars = new Map<string, { avatarUrl: string; timestamp: number }>(); // id or email -> { avatarUrl, timestamp }
const recentlyDeletedCommentIds = new Map<string, number>(); // commentId -> timestamp ms

export function markLocalBoardMutation(boardId: string) {
  if (!boardId) return;
  lastLocalMutationTimes.set(boardId, Date.now());
}

export function scheduleBoardSync(board: Board, delayMs = 60) {
  if (!board || !board.id) return;

  const boardId = board.id;
  markLocalBoardMutation(boardId);

  const existing = syncTimers.get(boardId);
  if (existing) clearTimeout(existing);

  const timer = window.setTimeout(async () => {
    syncTimers.delete(boardId);
    activeSyncBoards.add(boardId);
    try {
      const freshBoard = useWorkStore.getState().boards.find(b => b.id === boardId) || board;
      await supabaseService.syncBoard(freshBoard);
    } finally {
      activeSyncBoards.delete(boardId);
      markLocalBoardMutation(boardId);
    }
  }, delayMs);

  syncTimers.set(boardId, timer);
}

// ── Zustand Store (Cloud-Only, No localStorage) ─────────────────────────────

export const useWorkStore = create<WorkState>()(
  (set, get) => ({
      boards: [],
      activeBoardId: null,
      lastMoveSnapshot: null,
      isLoadingCloud: false,
      hasLoadedOnce: false,

      // ── Cloud Sync Actions ─────────────────────────────
      loadBoardsFromCloud: async (userEmail: string) => {
        if (!userEmail || !supabaseService.isConfigured()) return;
        const cleanEmail = userEmail.toLowerCase().trim();

        set({ isLoadingCloud: true });

        try {
          const cloudBoards = await supabaseService.getBoardsForUser(cleanEmail);

          if (!cloudBoards) {
            set({ isLoadingCloud: false });
            return;
          }

          // Supabase is the single source of truth, but we must never drop local in-flight members or edits
          set(s => {
            const now = Date.now();
            for (const [em, t] of recentlyRemovedEmails.entries()) {
              if (now - t > 6000) recentlyRemovedEmails.delete(em);
            }
            for (const [em, t] of recentlyAddedMembers.entries()) {
              if (now - t > 6000) recentlyAddedMembers.delete(em);
            }
            for (const [key, val] of recentlyUpdatedMemberStyles.entries()) {
              if (now - val.timestamp > 8000) recentlyUpdatedMemberStyles.delete(key);
            }
            for (const [key, val] of recentlyUpdatedMemberAvatars.entries()) {
              if (now - val.timestamp > 8000) recentlyUpdatedMemberAvatars.delete(key);
            }
            for (const [bId, t] of lastLocalMutationTimes.entries()) {
              if (now - t > 10000) lastLocalMutationTimes.delete(bId);
            }
            for (const [cId, t] of recentlyDeletedCommentIds.entries()) {
              if (now - t > 10000) recentlyDeletedCommentIds.delete(cId);
            }

            const sanitizeCardComments = (card: Card): Card => {
              if (!card.comments || card.comments.length === 0 || recentlyDeletedCommentIds.size === 0) return card;
              return {
                ...card,
                comments: card.comments.filter(
                  cm => !recentlyDeletedCommentIds.has(cm.id) && (!cm.parentId || !recentlyDeletedCommentIds.has(cm.parentId))
                )
              };
            };

            const finalBoards = cloudBoards.map(cb => {
              const memBoard = s.boards.find(lb => lb.id === cb.id);
              if (!memBoard) {
                const cleanMembers = (cb.members || []).filter(
                  m => !m.email || !recentlyRemovedEmails.has(m.email.toLowerCase().trim())
                ).map(m => {
                  const recentStyleById = recentlyUpdatedMemberStyles.get(m.id);
                  const recentStyleByEmail = m.email ? recentlyUpdatedMemberStyles.get(m.email.toLowerCase().trim()) : undefined;
                  const recentStyle = recentStyleById || recentStyleByEmail;

                  const recentAvatarById = recentlyUpdatedMemberAvatars.get(m.id);
                  const recentAvatarByEmail = m.email ? recentlyUpdatedMemberAvatars.get(m.email.toLowerCase().trim()) : undefined;
                  const recentAvatar = recentAvatarById || recentAvatarByEmail;

                  let memberObj = m;
                  if (recentStyle && now - recentStyle.timestamp < 8000) {
                    memberObj = { ...memberObj, borderStyle: recentStyle.borderStyle };
                  }
                  if (recentAvatar && now - recentAvatar.timestamp < 8000) {
                    memberObj = { ...memberObj, avatarUrl: recentAvatar.avatarUrl };
                  }
                  return memberObj;
                });
                return { ...cb, members: cleanMembers };
              }

              const hasPendingSync = syncTimers.has(cb.id);
              const isActivelySyncing = activeSyncBoards.has(cb.id);
              const lastEdit = lastLocalMutationTimes.get(cb.id) || 0;
              const isRecentLocalEdit = (now - lastEdit) < 3000;

              // Filter out recently removed members and preserve optimistic styles and avatars
              const cloudMembersFiltered = (cb.members || []).filter(
                m => !m.email || !recentlyRemovedEmails.has(m.email.toLowerCase().trim())
              ).map(m => {
                const recentStyleById = recentlyUpdatedMemberStyles.get(m.id);
                const recentStyleByEmail = m.email ? recentlyUpdatedMemberStyles.get(m.email.toLowerCase().trim()) : undefined;
                const recentStyle = recentStyleById || recentStyleByEmail;

                const recentAvatarById = recentlyUpdatedMemberAvatars.get(m.id);
                const recentAvatarByEmail = m.email ? recentlyUpdatedMemberAvatars.get(m.email.toLowerCase().trim()) : undefined;
                const recentAvatar = recentAvatarById || recentAvatarByEmail;

                let memberObj = m;
                if (recentStyle && now - recentStyle.timestamp < 8000) {
                  memberObj = { ...memberObj, borderStyle: recentStyle.borderStyle };
                }
                if (recentAvatar && now - recentAvatar.timestamp < 8000) {
                  memberObj = { ...memberObj, avatarUrl: recentAvatar.avatarUrl };
                }
                return memberObj;
              });

              // ONLY preserve locally added members if this client explicitly added them in the last 6s and cloud hasn't returned them yet
              const cloudEmails = new Set(cloudMembersFiltered.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean));
              const localPendingMembers = (memBoard.members || []).filter(
                m => m.email && !cloudEmails.has(m.email.toLowerCase().trim()) && recentlyAddedMembers.has(m.email.toLowerCase().trim()) && !recentlyRemovedEmails.has(m.email.toLowerCase().trim())
              );

              const mergedMembers = sortMembersWithOwnerFirst(
                [...cloudMembersFiltered, ...localPendingMembers],
                cb.createdBy
              );

              if (hasPendingSync || isActivelySyncing || isRecentLocalEdit) {
                return {
                  ...cb,
                  name: memBoard.name,
                  color: memBoard.color,
                  columns: memBoard.columns?.map(col => ({ ...col, cards: (col.cards || []).map(sanitizeCardComments) })),
                  inboxCards: memBoard.inboxCards?.map(sanitizeCardComments),
                  members: memBoard.members?.length ? memBoard.members : mergedMembers,
                };
              }

              return {
                ...cb,
                columns: (cb.columns || []).map(col => ({ ...col, cards: (col.cards || []).map(sanitizeCardComments) })),
                inboxCards: (cb.inboxCards || []).map(sanitizeCardComments),
                members: mergedMembers,
              };
            });

            // Include newly created boards that haven't propagated to cloud yet
            s.boards.forEach(lb => {
              const hasPendingSync = syncTimers.has(lb.id) || activeSyncBoards.has(lb.id);
              if (hasPendingSync && !finalBoards.some(b => b.id === lb.id)) {
                finalBoards.push(lb);
              }
            });

            const activeBoardId = s.activeBoardId && finalBoards.some(b => b.id === s.activeBoardId)
              ? s.activeBoardId
              : (finalBoards[0]?.id ?? null);

            return { boards: finalBoards, activeBoardId, isLoadingCloud: false, hasLoadedOnce: true };
          });
        } catch (err) {
          console.warn('[useWorkStore] Cloud load error:', err);
          set({ isLoadingCloud: false, hasLoadedOnce: true });
        }
      },

      syncBoardToCloud: async (boardId: string) => {
        const board = get().boards.find(b => b.id === boardId);
        if (board) {
          await supabaseService.syncBoard(board);
        }
      },

      // ── Board actions ──────────────────────────────────
      createBoard: async (name, color, createdBy, creatorName) => {
        const creatorEmail = createdBy ? createdBy.toLowerCase().trim() : '';
        const creatorMember: Member | null = creatorEmail
          ? {
              id: uid(),
              name: creatorName && creatorName.trim() ? creatorName.trim() : creatorEmail.split('@')[0],
              email: creatorEmail,
              color: AVATAR_COLORS[0]
            }
          : null;

        const board: Board = {
          id: uid(),
          name,
          color,
          createdBy: creatorEmail,
          members: creatorMember ? [creatorMember] : [],
          columns: [
            { id: uid(), name: 'Urgent',      cards: [] },
            { id: uid(), name: 'To Do',       cards: [] },
            { id: uid(), name: 'In Progress', cards: [] },
            { id: uid(), name: 'Review',      cards: [] },
            { id: uid(), name: 'Done',        cards: [] },
          ],
        };

        set(s => ({
          boards: [...s.boards.filter(b => b.id !== board.id), board],
          activeBoardId: board.id
        }));
        await supabaseService.syncBoard(board);
        return board;
      },

      syncCurrentUserProfile: (user) => {
        if (!user || !user.email) return;
        const email = user.email.toLowerCase().trim();
        const fullName = user.name?.trim();
        if (!fullName) return;

        if (user.avatarUrl) {
          recentlyUpdatedMemberAvatars.set(email, { avatarUrl: user.avatarUrl, timestamp: Date.now() });
        }

        set(s => {
          const updatedBoards = s.boards.map(b => ({
            ...b,
            members: b.members.map(m => {
              if (m.email && m.email.toLowerCase().trim() === email) {
                return {
                  ...m,
                  name: fullName,
                  avatarUrl: user.avatarUrl !== undefined ? user.avatarUrl : m.avatarUrl,
                };
              }
              return m;
            })
          }));
          return { boards: updatedBoards };
        });
      },

      removeUserFromAllBoards: (userEmail: string) => {
        if (!userEmail) return;
        const cleanEmail = userEmail.toLowerCase().trim();

        set(s => {
          const updatedBoards = s.boards
            .filter(b => {
              const isCreator = b.createdBy?.toLowerCase().trim() === cleanEmail;
              const otherMembers = (b.members || []).filter(m => m.email?.toLowerCase().trim() !== cleanEmail);
              // If user is the solo creator and no other members, remove the board
              return !(isCreator && otherMembers.length === 0);
            })
            .map(b => {
              const userMemberIds = new Set(
                (b.members || [])
                  .filter(m => m.email?.toLowerCase().trim() === cleanEmail)
                  .map(m => m.id)
              );

              if (userMemberIds.size === 0) return b;

              const newMembers = (b.members || []).filter(m => !userMemberIds.has(m.id));
              const newColumns = (b.columns || []).map(col => ({
                ...col,
                cards: (col.cards || []).map(c => ({
                  ...c,
                  assignees: (c.assignees || []).filter(a => !userMemberIds.has(a)),
                })),
              }));
              const newInbox = (b.inboxCards || []).map(c => ({
                ...c,
                assignees: (c.assignees || []).filter(a => !userMemberIds.has(a)),
              }));

              const updatedBoard: Board = {
                ...b,
                members: newMembers,
                columns: newColumns,
                inboxCards: newInbox,
              };

              scheduleBoardSync(updatedBoard, 100);
              return updatedBoard;
            });

          return {
            boards: updatedBoards,
            activeBoardId: updatedBoards.some(b => b.id === s.activeBoardId)
              ? s.activeBoardId
              : (updatedBoards[0]?.id || null),
          };
        });
      },

      getVisibleBoards: (userEmail) => {
        const { boards } = get();
        if (!userEmail) return boards;
        const email = userEmail.toLowerCase().trim();
        return boards.filter(b => {
          if (b.createdBy && b.createdBy.toLowerCase().trim() === email) return true;
          if (b.members && b.members.some(m => m.email && m.email.toLowerCase().trim() === email)) return true;
          if (!b.createdBy && (!b.members || b.members.length === 0)) return true;
          return false;
        });
      },

      deleteBoard: (boardId) => {
        set(s => {
          const boards = s.boards.filter(b => b.id !== boardId);
          const activeBoardId = s.activeBoardId === boardId
            ? (boards[0]?.id ?? null)
            : s.activeBoardId;
          return { boards, activeBoardId };
        });
        supabaseService.deleteBoard(boardId);
      },

      renameBoard: (boardId, name) => {
        const cleanName = name.trim();
        if (!cleanName) return;
        let targetBoard: Board | undefined;
        set(s => {
          const updatedBoards = updateBoards(s.boards, boardId, b => ({
            ...b,
            name: cleanName,
          }));
          targetBoard = updatedBoards.find(b => b.id === boardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) {
          scheduleBoardSync(targetBoard, 30);
          if (supabaseService.isConfigured()) {
            supabaseService.updateBoard(boardId, { name: cleanName });
          }
        }
      },

      updateBoardColor: (boardId, color) => {
        if (!color) return;
        let targetBoard: Board | undefined;
        set(s => {
          const updatedBoards = updateBoards(s.boards, boardId, b => ({
            ...b,
            color,
          }));
          targetBoard = updatedBoards.find(b => b.id === boardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) {
          scheduleBoardSync(targetBoard, 30);
          if (supabaseService.isConfigured()) {
            supabaseService.updateBoard(boardId, { color });
          }
        }
      },

      leaveBoard: (boardId, userEmail) => {
        const email = userEmail.toLowerCase().trim();
        let memberId: string | undefined;

        recentlyRemovedEmails.set(email, Date.now());
        recentlyAddedMembers.delete(email);

        set(s => {
          const board = s.boards.find(b => b.id === boardId);
          if (!board) return s;
          const memberToRemove = board.members.find(m => m.email?.toLowerCase().trim() === email);
          memberId = memberToRemove?.id;

          // For the leaving user, immediately remove this board from their active store state
          const remainingBoards = s.boards.filter(b => b.id !== boardId);
          const activeBoardId = s.activeBoardId === boardId
            ? (remainingBoards[0]?.id ?? null)
            : s.activeBoardId;

          return { boards: remainingBoards, activeBoardId };
        });

        // Delete the membership row in Supabase so it won't be returned on next sync
        supabaseService.removeMemberFromBoard(boardId, email, memberId);
      },

      switchBoard: (boardId) => set({ activeBoardId: boardId }),

      joinBoardFromCloud: async (boardId, role, user) => {
        const cleanEmail = user.email.toLowerCase().trim();
        recentlyAddedMembers.set(cleanEmail, Date.now());
        recentlyRemovedEmails.delete(cleanEmail);

        const memberId = uid();
        const newMember: Member = {
          id: memberId,
          name: user.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          color: '#6366f1',
          avatarUrl: user.avatarUrl,
          role: role || 'member',
        };

        // 1. Add member to Supabase database
        await supabaseService.addMember(boardId, newMember);

        // 2. Fetch full board with columns, cards, and tasks directly from Supabase
        let joinedBoard = await supabaseService.getBoardById(boardId);

        // 3. Fallback: if getBoardById returned null, try loadBoardsFromCloud
        if (!joinedBoard) {
          await get().loadBoardsFromCloud(cleanEmail);
          joinedBoard = get().boards.find(b => b.id === boardId) || null;
        }

        // 4. If we have the joinedBoard, ensure member is in members list & merge directly into local store
        if (joinedBoard) {
          if (!joinedBoard.members.some(m => m.email?.toLowerCase().trim() === cleanEmail)) {
            joinedBoard.members.push(newMember);
          }
          set(s => {
            const otherBoards = s.boards.filter(b => b.id !== boardId);
            return {
              boards: [joinedBoard!, ...otherBoards],
              activeBoardId: boardId,
            };
          });
        }

        return joinedBoard;
      },

      // ── Column actions ─────────────────────────────────
      addColumn: (name) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const col: Column = { id: uid(), name, cards: [] };
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b, columns: [...b.columns, col],
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      deleteColumn: (colId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b, columns: b.columns.filter(c => c.id !== colId),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      renameColumn: (colId, name) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b =>
            updateColumns(b, colId, c => ({ ...c, name }))
          );
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      addCard: (colId, title) => {
        const card: Card = {
          id: uid(), title,
          description: '', comments: [],
          attachments: [], labels: [],
          assignees: [], dueDate: null,
          completed: false, completedAt: null,
          createdAt: new Date().toISOString(),
        };
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b => b.columns?.some(c => c.id === colId)) || s.boards.find(b => b.id === s.activeBoardId);
          if (!tb) return s;
          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateColumns(b, colId, c => ({ ...c, cards: [...(c.cards || []), card] }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
        return card;
      },

      updateCard: (cardId, patch) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({ ...c, ...patch }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      deleteCard: (cardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId)) ||
            (b.inboxCards || []).some(c => c.id === cardId)
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b => ({
            ...b,
            columns: (b.columns || []).map(col => ({
              ...col,
              cards: (col.cards || []).filter(c => c.id !== cardId),
            })),
            inboxCards: (b.inboxCards || []).filter(c => c.id !== cardId),
          }));
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        supabaseService.deleteCard(cardId);
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      undoLastMove: () => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.lastMoveSnapshot || !s.activeBoardId) return s;
          const snapshot = s.lastMoveSnapshot;
          const updatedBoards = s.boards.map(b => b.id === s.activeBoardId ? snapshot : b);
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return {
            boards: updatedBoards,
            lastMoveSnapshot: null,
          };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      moveCard: (cardId, fromColId, toColId, afterCardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const currentBoard = s.boards.find(b => b.id === s.activeBoardId);
          const snapshot = currentBoard ? JSON.parse(JSON.stringify(currentBoard)) as Board : null;

          const updatedBoards = updateBoards(s.boards, s.activeBoardId, board => {
            const fromCol = board.columns.find(c => c.id === fromColId);
            if (!fromCol) return board;
            const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
            if (cardIdx === -1) return board;
            const sourceCard = fromCol.cards[cardIdx];
            const toCol = board.columns.find(c => c.id === toColId);

            const isDoneTarget = toCol?.name.trim().toLowerCase() === 'done';
            const isDoneSource = fromCol.name.trim().toLowerCase() === 'done';
            const isMovingColumns = fromColId !== toColId;
            let updatedCard = sourceCard;
            if (isMovingColumns) {
              if (isDoneTarget && !sourceCard.completed) {
                updatedCard = { ...sourceCard, completed: true, completedAt: new Date().toISOString() };
              } else if (!isDoneTarget && isDoneSource && sourceCard.completed) {
                updatedCard = { ...sourceCard, completed: false, completedAt: null };
              }
            }

            const newColumns = board.columns.map(col => {
              if (col.id === fromColId && col.id === toColId) {
                const cards = [...col.cards];
                cards.splice(cardIdx, 1);
                const afterIdx = afterCardId ? cards.findIndex(c => c.id === afterCardId) : -1;
                if (afterIdx === -1) cards.push(updatedCard);
                else cards.splice(afterIdx, 0, updatedCard);
                return { ...col, cards };
              }
              if (col.id === fromColId) {
                return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
              }
              if (col.id === toColId) {
                const cards = [...col.cards];
                const afterIdx = afterCardId ? cards.findIndex(c => c.id === afterCardId) : -1;
                if (afterIdx === -1) cards.push(updatedCard);
                else cards.splice(afterIdx, 0, updatedCard);
                return { ...col, cards };
              }
              return col;
            });

            return { ...board, columns: newColumns };
          });

          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards, lastMoveSnapshot: snapshot };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      addInboxCard: (title, boardId) => {
        const card: Card = {
          id: uid(),
          title,
          description: '',
          comments: [],
          attachments: [],
          labels: [],
          assignees: [],
          dueDate: null,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          isInbox: true,
        };

        let targetBoard: Board | undefined;
        set(s => {
          const bId = boardId || s.activeBoardId;
          if (!bId) return s;
          const updatedBoards = updateBoards(s.boards, bId, b => ({
            ...b,
            inboxCards: [card, ...(b.inboxCards || [])],
          }));
          targetBoard = updatedBoards.find(b => b.id === bId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
        return card;
      },

      deleteInboxCard: (cardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            (b.inboxCards || []).some(c => c.id === cardId)
          ) || s.boards.find(b => b.id === s.activeBoardId);
          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b => ({
            ...b,
            inboxCards: (b.inboxCards || []).filter(c => c.id !== cardId),
          }));
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      moveInboxCardToColumn: (cardId, toColId, afterCardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const currentBoard = s.boards.find(b => b.id === s.activeBoardId);
          if (!currentBoard) return s;

          const card = (currentBoard.inboxCards || []).find(c => c.id === cardId);
          if (!card) return s;

          const updatedCard: Card = { ...card, isInbox: false };
          const toCol = currentBoard.columns.find(c => c.id === toColId);
          if (!toCol) return s;

          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => {
            const remainingInbox = (b.inboxCards || []).filter(c => c.id !== cardId);
            const newColumns = b.columns.map(col => {
              if (col.id !== toColId) return col;
              const cards = [...col.cards];
              const afterIdx = afterCardId ? cards.findIndex(c => c.id === afterCardId) : -1;
              if (afterIdx === -1) cards.push(updatedCard);
              else cards.splice(afterIdx, 0, updatedCard);
              return { ...col, cards };
            });
            return { ...b, columns: newColumns, inboxCards: remainingInbox };
          });

          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      moveColumnCardToInbox: (cardId, fromColId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const currentBoard = s.boards.find(b => b.id === s.activeBoardId);
          if (!currentBoard) return s;

          const fromCol = currentBoard.columns.find(c => c.id === fromColId);
          const card = fromCol?.cards.find(c => c.id === cardId);
          if (!card) return s;

          const updatedCard: Card = { ...card, isInbox: true };

          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => {
            const newColumns = b.columns.map(col => {
              if (col.id !== fromColId) return col;
              return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
            });
            const newInbox = [updatedCard, ...(b.inboxCards || [])];
            return { ...b, columns: newColumns, inboxCards: newInbox };
          });

          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      toggleCardComplete: (cardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          let isNowComplete = false;
          let updatedTitle = '';
          let cardAssignees: string[] = [];

          const resultBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              isNowComplete = !c.completed;
              updatedTitle = c.title;
              cardAssignees = c.assignees || [];
              return {
                ...c,
                completed: isNowComplete,
                completedAt: isNowComplete ? new Date().toISOString() : null,
              };
            })
          );

          targetBoard = resultBoards.find(b => b.id === tb.id);

          const currentUser = useAuthStore.getState().user;
          cardAssignees.forEach(mId => {
            const member = tb.members?.find(m => m.id === mId || (m.email && m.email.toLowerCase().trim() === mId.toLowerCase().trim()));
            if (member && member.email) {
              if (member.email.toLowerCase().trim() !== currentUser?.email?.toLowerCase().trim()) {
                useNotifStore.getState().addNotification(
                  `Task ${isNowComplete ? 'Completed' : 'Reopened'}: ${updatedTitle}`,
                  `"${updatedTitle}" was marked as ${isNowComplete ? 'done' : 'incomplete'} on board "${tb.name}"`,
                  isNowComplete ? 'check' : 'clock',
                  cardId, tb.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Status Update: ${updatedTitle} is ${isNowComplete ? 'Completed' : 'Reopened'}`,
                  body: `Hi ${member.name},\n\nThe task "${updatedTitle}" was marked as ${isNowComplete ? 'completed' : 'incomplete'} on board "${tb.name}".\n\nBest regards,\nWorklane Team`,
                  eventType: 'status_changed',
                  metadata: {
                    cardTitle: updatedTitle,
                    boardName: tb.name,
                    cardId,
                    boardId: tb.id,
                  },
                });
              }
            }
          });

          return { boards: resultBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      toggleCardLabel: (cardId, labelId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              const current = c.labels || [];
              const labels = current.includes(labelId)
                ? current.filter(l => l !== labelId)
                : [...current, labelId];
              return { ...c, labels };
            })
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      toggleCardAssignee: (cardId, memberId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId)) ||
            (b.inboxCards || []).some(c => c.id === cardId)
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const member = tb.members?.find(m =>
            m.id === memberId || (m.email && m.email.toLowerCase().trim() === memberId.toLowerCase().trim())
          );
          let assignedCardTitle = '';
          let isAssigning = false;

          const result = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              assignedCardTitle = c.title;
              const currentAssignees = c.assignees || [];
              const matchesMember = (a: string) =>
                a === memberId ||
                (member && (a === member.id || (member.email && a.toLowerCase().trim() === member.email.toLowerCase().trim())));

              isAssigning = !currentAssignees.some(matchesMember);
              const canonicalId = member?.id || memberId;
              const assignees = isAssigning
                ? [...currentAssignees.filter(a => !matchesMember(a)), canonicalId]
                : currentAssignees.filter(a => !matchesMember(a));
              
              return { ...c, assignees };
            })
          );

          targetBoard = result.find(b => b.id === tb.id);

          if (isAssigning && member && member.email) {
            useNotifStore.getState().addNotification(
              `Assigned: ${assignedCardTitle}`,
              `You were assigned to "${assignedCardTitle}" on board "${tb.name}"`,
              'users', cardId, tb.id, member.email
            );
            useEmailStore.getState().sendEmailNotification({
              recipient: member,
              subject: `New Task Assigned: ${assignedCardTitle}`,
              body: `Hi ${member.name},\n\nYou have been assigned to the card "${assignedCardTitle}" on board "${tb.name}".\n\nBest regards,\nWorklane Team`,
              eventType: 'card_assigned',
              metadata: {
                cardTitle: assignedCardTitle,
                boardName: tb.name,
                cardId,
                boardId: tb.id,
              },
            });
          }

          return { boards: result };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      // ── Attachment actions ────────────────────────────
      addAttachment: (cardId, att) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c, attachments: [...(c.attachments || []), att],
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      removeAttachment: (cardId, attId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c,
              attachments: (c.attachments || []).filter(a => a.id !== attId),
              coverAttachmentId: c.coverAttachmentId === attId ? null : c.coverAttachmentId,
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (supabaseService.isConfigured()) {
          supabaseService.deleteAttachment(attId);
        }
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      // ── Comment actions ───────────────────────────────
      addComment: (cardId, text, parentId = null, replyToAuthor = null, attachments = []) => {
        const currentUser = useAuthStore.getState().user;
        const authorName = (currentUser?.name && currentUser.name.trim()) ? currentUser.name : 'Me';
        const authorInitialsStr = avatarInitials(authorName);

        const comment: Comment = {
          id: uid(),
          author: authorName,
          authorInitials: authorInitialsStr,
          avatarColor: '#6366f1',
          text,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          parentId: parentId || null,
          replyToAuthor: replyToAuthor || null,
          authorEmail: currentUser?.email || undefined,
          authorId: currentUser?.id || undefined,
          createdAt: new Date().toISOString(),
        };

        let targetBoard: Board | undefined;

        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId)) ||
            (b.inboxCards || []).some(c => c.id === cardId)
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          let cardTitle = '';
          let cardAssignees: string[] = [];

          const resultBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              cardTitle = c.title;
              cardAssignees = c.assignees || [];
              return { ...c, comments: [...(c.comments || []), comment] };
            })
          );

          targetBoard = resultBoards.find(b => b.id === tb.id);

          const lowerText = text.toLowerCase();
          const mentionedMembers = (tb.members || []).filter(m => {
            const nameMatch = m.name && lowerText.includes(`@${m.name.toLowerCase()}`);
            const emailMatch = m.email && lowerText.includes(`@${m.email.toLowerCase()}`);
            const firstWordMatch = m.name && lowerText.includes(`@${m.name.split(' ')[0].toLowerCase()}`);
            return nameMatch || emailMatch || firstWordMatch;
          });

          const notifiedEmails = new Set<string>();
          mentionedMembers.forEach(m => {
            if (m.email) {
              notifiedEmails.add(m.email.toLowerCase().trim());
              useNotifStore.getState().addNotification(
                `Mentioned: ${cardTitle}`,
                `${authorName} mentioned you in a comment on "${cardTitle}"`,
                'message', cardId, tb.id, m.email
              );
              useEmailStore.getState().sendEmailNotification({
                recipient: m,
                subject: `[Mention] ${authorName} mentioned you on "${cardTitle}"`,
                body: `Hi ${m.name},\n\n${authorName} mentioned you in a comment on card "${cardTitle}" in board "${tb.name}":\n\n"${text}"\n\nBest regards,\nWorklane Team`,
                eventType: 'mention',
                metadata: {
                  cardTitle,
                  boardName: tb.name,
                  cardId,
                  boardId: tb.id,
                  actorName: authorName,
                },
              });
            }
          });

          // If this is a reply, also notify the person being replied to
          if (replyToAuthor) {
            const repliedMember = (tb.members || []).find(m =>
              (m.name && m.name.toLowerCase().trim() === replyToAuthor.toLowerCase().trim()) ||
              (m.email && m.email.toLowerCase().trim() === replyToAuthor.toLowerCase().trim())
            );
            if (repliedMember && repliedMember.email) {
              const rEmail = repliedMember.email.toLowerCase().trim();
              const isSelf = currentUser?.email && rEmail === currentUser.email.toLowerCase().trim();
              if (!isSelf && !notifiedEmails.has(rEmail)) {
                notifiedEmails.add(rEmail);
                useNotifStore.getState().addNotification(
                  `Reply: ${cardTitle}`,
                  `${authorName} replied to your comment on "${cardTitle}"`,
                  'message', cardId, tb.id, repliedMember.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: repliedMember,
                  subject: `[Reply] ${authorName} replied to your comment on "${cardTitle}"`,
                  body: `Hi ${repliedMember.name},\n\n${authorName} replied to your comment on card "${cardTitle}" in board "${tb.name}":\n\n"${text}"\n\nBest regards,\nWorklane Team`,
                  eventType: 'comment_added',
                  metadata: {
                    cardTitle,
                    boardName: tb.name,
                    cardId,
                    boardId: tb.id,
                    actorName: authorName,
                  },
                });
              }
            }
          }

          cardAssignees.forEach(mId => {
            const member = tb.members?.find(m => m.id === mId || (m.email && m.email.toLowerCase().trim() === mId.toLowerCase().trim()));
            if (member && member.email) {
              const memEmail = member.email.toLowerCase().trim();
              const isAuthor = currentUser?.email && memEmail === currentUser.email.toLowerCase().trim();
              if (!isAuthor && !notifiedEmails.has(memEmail)) {
                notifiedEmails.add(memEmail);
                useNotifStore.getState().addNotification(
                  `New Comment: ${cardTitle}`,
                  `${authorName} commented on "${cardTitle}"`,
                  'message', cardId, tb.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `New Comment on "${cardTitle}"`,
                  body: `Hi ${member.name},\n\n${authorName} commented on task "${cardTitle}" in board "${tb.name}":\n\n"${text}"\n\nBest regards,\nWorklane Team`,
                  eventType: 'comment_added',
                  metadata: {
                    cardTitle,
                    boardName: tb.name,
                    cardId,
                    boardId: tb.id,
                    actorName: authorName,
                  },
                });
              }
            }
          });

          return { boards: resultBoards };
        });
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      deleteComment: (cardId, commentId) => {
        let targetBoard: Board | undefined;
        const now = Date.now();
        recentlyDeletedCommentIds.set(commentId, now);

        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId)) ||
            (b.inboxCards || []).some(c => c.id === cardId)
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          // Track any child replies of this comment as recently deleted as well
          const currentCard = tb.columns?.flatMap(col => col.cards || []).find(c => c.id === cardId)
            || (tb.inboxCards || []).find(c => c.id === cardId);
          if (currentCard?.comments) {
            currentCard.comments.forEach(cm => {
              if (cm.parentId === commentId) {
                recentlyDeletedCommentIds.set(cm.id, now);
              }
            });
          }

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c, comments: (c.comments || []).filter(cm => cm.id !== commentId && cm.parentId !== commentId),
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });

        if (supabaseService.isConfigured()) {
          supabaseService.deleteComment(commentId);
        }
        if (targetBoard) scheduleBoardSync(targetBoard, 50);
      },

      // ── Member actions ────────────────────────────────
      addMember: async (name, email, avatarUrl, role = 'member', userId?: string, borderStyle = 'none') => {
        let newId: string | null = null;
        let newMember: Member | null = null;
        const currentActiveId = get().activeBoardId;
        if (!currentActiveId) return null;

        const cleanEmail = email ? email.toLowerCase().trim() : '';

        // If it was recently marked removed, clear it from the removal blocklist
        if (cleanEmail) {
          recentlyRemovedEmails.delete(cleanEmail);
          recentlyAddedMembers.set(cleanEmail, Date.now());
        }

        set(s => {
          const currentBoard = s.boards.find(b => b.id === currentActiveId);
          if (!currentBoard) return s;
          if (cleanEmail && currentBoard.members.some(m => m.email && m.email.toLowerCase().trim() === cleanEmail)) {
            return s;
          }
          const color = AVATAR_COLORS[currentBoard.members.length % AVATAR_COLORS.length];
          newId = uid();
          newMember = { id: newId!, name: name.trim(), email: cleanEmail, color, avatarUrl, role, borderStyle };

          const updatedBoards = s.boards.map(b => {
            if (b.id !== currentActiveId) return b;
            return { ...b, members: [...b.members, newMember!] };
          });

          return { boards: updatedBoards };
        });

        if (newMember) {
          if (supabaseService.isConfigured()) {
            await supabaseService.addMember(currentActiveId, newMember, userId);
          }
        }

        return newId;
      },

      updateMember: (memberId, patch) => {
        let targetBoard: Board | undefined;
        let updatedMember: Member | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b,
            members: b.members.map(m => {
              if (m.id === memberId) {
                updatedMember = { ...m, ...patch };
                return updatedMember;
              }
              return m;
            }),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) {
          scheduleBoardSync(targetBoard, 50);
          if (updatedMember?.borderStyle !== undefined) {
            recentlyUpdatedMemberStyles.set(memberId, { borderStyle: updatedMember.borderStyle, timestamp: Date.now() });
            if (updatedMember.email) {
              recentlyUpdatedMemberStyles.set(updatedMember.email.toLowerCase().trim(), { borderStyle: updatedMember.borderStyle, timestamp: Date.now() });
            }
            supabaseService.updateMemberBorderStyle(targetBoard.id, memberId, updatedMember.borderStyle, updatedMember.email);
          }
          if (updatedMember?.avatarUrl !== undefined) {
            recentlyUpdatedMemberAvatars.set(memberId, { avatarUrl: updatedMember.avatarUrl, timestamp: Date.now() });
            if (updatedMember.email) {
              recentlyUpdatedMemberAvatars.set(updatedMember.email.toLowerCase().trim(), { avatarUrl: updatedMember.avatarUrl, timestamp: Date.now() });
            }
            supabaseService.updateMemberAvatar(targetBoard.id, memberId, updatedMember.avatarUrl, updatedMember.email);
          }
        }
      },

      updateMemberRole: (boardId, memberId, role) => {
        let targetBoard: Board | undefined;
        let updatedMember: Member | undefined;
        set(s => {
          const updatedBoards = updateBoards(s.boards, boardId, b => ({
            ...b,
            members: b.members.map(m => {
              if (m.id === memberId) {
                updatedMember = { ...m, role };
                return updatedMember;
              }
              return m;
            }),
          }));
          targetBoard = updatedBoards.find(b => b.id === boardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) {
          scheduleBoardSync(targetBoard, 50);
          supabaseService.updateMemberRole(boardId, memberId, role, updatedMember?.email);
        }
      },

      removeMember: (memberId) => {
        let targetBoard: Board | undefined;
        let removedEmail: string | undefined;
        const activeId = get().activeBoardId;

        set(s => {
          if (!s.activeBoardId) return s;
          const currentBoard = s.boards.find(b => b.id === s.activeBoardId);
          const memberObj = currentBoard?.members.find(m => m.id === memberId);
          removedEmail = memberObj?.email;
          if (removedEmail) {
            const cleanRemoved = removedEmail.toLowerCase().trim();
            recentlyRemovedEmails.set(cleanRemoved, Date.now());
            recentlyAddedMembers.delete(cleanRemoved);
          }

          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b,
            members: b.members.filter(m => m.id !== memberId),
            columns: b.columns.map(col => ({
              ...col,
              cards: col.cards.map(c => ({
                ...c, assignees: c.assignees.filter(a => a !== memberId),
              })),
            })),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });

        if (activeId) {
          supabaseService.removeMemberFromBoard(activeId, removedEmail, memberId);
        }
        if (targetBoard) {
          scheduleBoardSync(targetBoard, 50);
        }
      },

      // ── Helpers (read-only selectors) ─────────────────
      getActiveBoard: () => {
        const s = get();
        return s.boards.find(b => b.id === s.activeBoardId);
      },

      getBoard: (boardId: string) => {
        return get().boards.find(b => b.id === boardId);
      },

      findCard: (cardId: string, boardId?: string) => {
        const s = get();
        const targetBoard = boardId
          ? s.boards.find(b => b.id === boardId)
          : (s.boards.find(b => b.id === s.activeBoardId) || s.boards.find(b =>
              b.columns?.some(col => col.cards?.some(c => c.id === cardId)) ||
              (b.inboxCards || []).some(c => c.id === cardId)
            ));
        if (!targetBoard) return null;
        const res = findCardInBoard(targetBoard, cardId);
        if (!res) return null;
        return { card: res.card, column: res.column, board: targetBoard, isInbox: res.isInbox };
      },
    })
);
