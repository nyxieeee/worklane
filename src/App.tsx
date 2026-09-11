import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { LayoutDashboard, KanbanSquare, List, Calendar, Inbox } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import BoardArea from './components/BoardArea';
import CardModal from './components/CardModal';
import MembersModal from './components/MembersModal';
import EmailNotifModal from './components/EmailNotifModal';
import LoginPage from './components/LoginPage';
import NotifPanel from './components/NotifPanel';
import Toast from './components/Toast';
import Dashboard from './components/Dashboard';
import CreateBoardModal from './components/modals/CreateBoardModal';
import AddColumnModal from './components/modals/AddColumnModal';
import SearchModal from './components/modals/SearchModal';
import PrivacyModal from './components/modals/PrivacyModal';
import SettingsModal from './components/modals/SettingsModal';
import ConfirmModal from './components/modals/ConfirmModal';
import { InboxDrawer } from './components/InboxDrawer';
import InviteLandingPage from './components/InviteLandingPage';
import AppLoadingScreen from './components/AppLoadingScreen';
import { useWorkStore } from './store/useWorkStore';
import { useNotifStore } from './store/useNotifStore';
import { useEmailStore } from './store/useEmailStore';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import { useToastStore } from './store/useToastStore';
import { useSettingsStore } from './store/useSettingsStore';
import { supabaseService } from './services/supabaseService';
import { formatDueDate, uid, useIsMobile } from './utils';
import type { MemberRole } from './types';

const CHECK_INTERVAL_MS = 10_000;

const page3DVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, rotateY: -8, translateZ: -40 },
  animate: { opacity: 1, scale: 1, rotateY: 0, translateZ: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, rotateY: 8, translateZ: -40, transition: { duration: 0.18 } }
};

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const initializeAuth = useAuthStore(s => s.initializeAuth);
  const boards = useWorkStore(s => s.boards);
  const activeBoardId = useWorkStore(s => s.activeBoardId);
  const switchBoard = useWorkStore(s => s.switchBoard);
  const updateCard = useWorkStore(s => s.updateCard);
  const syncCurrentUserProfile = useWorkStore(s => s.syncCurrentUserProfile);
  const loadBoardsFromCloud = useWorkStore(s => s.loadBoardsFromCloud);
  const isLoadingCloud = useWorkStore(s => s.isLoadingCloud);
  const hasLoadedOnce = useWorkStore(s => s.hasLoadedOnce);
  const loadNotificationsFromCloud = useNotifStore(s => s.loadNotificationsFromCloud);
  const addNotification = useNotifStore(s => s.addNotification);
  const showToast = useToastStore(s => s.showToast);
  const isDark = useThemeStore(s => s.isDark);
  const currentUser = useAuthStore(s => s.user);

  // Track whether auth has been resolved (prevents login-page flash on reload)
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize Supabase Auth session & listener on mount
  useEffect(() => {
    initializeAuth().finally(() => setAuthInitialized(true));
  }, [initializeAuth]);

  // Pending invite link state
  const [pendingInvite, setPendingInvite] = useState<{ boardId: string; role: MemberRole } | null>(null);

  // Check URL or session for board invite link (?joinBoard=... or ?invite=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinBoardId = params.get('joinBoard') || params.get('invite');
    const inviteRole = (params.get('role') as MemberRole) || 'member';

    if (joinBoardId) {
      const inviteObj = { boardId: joinBoardId, role: inviteRole };
      setPendingInvite(inviteObj);
      try {
        localStorage.setItem('worklane_pending_invite', JSON.stringify(inviteObj));
        sessionStorage.setItem('worklane_pending_invite', JSON.stringify(inviteObj));
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem('worklane_pending_invite') || sessionStorage.getItem('worklane_pending_invite');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.boardId) {
            setPendingInvite(parsed);
          }
        }
      } catch {}
    }
  }, []);

  // Intercept and handle OAuth redirect errors (e.g. bad_oauth_state after session clear)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorDesc = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');
      const errorCode = searchParams.get('error_code') || hashParams.get('error_code');

      if (errorDesc) {
        console.error('[Supabase Auth] OAuth redirect error in URL:', {
          errorCode,
          errorDesc,
          search: window.location.search,
          hash: window.location.hash
        });
        // Clean URL to prevent infinite error loops on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        useToastStore.getState().showToast(
          errorDesc.includes('bad_oauth_state') || errorDesc.includes('expired')
            ? 'Google Sign In failed (bad_oauth_state). An ad-blocker may be blocking cookies, or check Supabase Redirect URLs.'
            : decodeURIComponent(errorDesc.replace(/\+/g, ' ')),
          'warning',
          7000
        );
      }
    } catch {}
  }, []);

  // Load cloud boards, notifications & custom labels when user is logged in
  useEffect(() => {
    if (currentUser?.email) {
      const email = currentUser.email.toLowerCase().trim();
      loadBoardsFromCloud(email);
      loadNotificationsFromCloud(email);
      useSettingsStore.getState().loadCustomLabelsFromCloud(email);
    }
  }, [currentUser?.email, loadBoardsFromCloud, loadNotificationsFromCloud]);

  // Realtime subscription: auto-refresh boards & notifications when changes happen on Supabase
  useEffect(() => {
    if (!currentUser?.email) return;
    const email = currentUser.email;

    let boardsDebounceTimer: number | undefined;

    const unsub = supabaseService.subscribeToAll(
      email,
      () => {
        if (boardsDebounceTimer) clearTimeout(boardsDebounceTimer);
        boardsDebounceTimer = window.setTimeout(() => {
          loadBoardsFromCloud(email);
        }, 350);
      },
      () => {
        loadNotificationsFromCloud(email);
      },
      () => {
        useSettingsStore.getState().loadCustomLabelsFromCloud(email);
      }
    );

    // Fast sync on tab focus or visibility change
    const handleFocusSync = () => {
      loadBoardsFromCloud(email);
      loadNotificationsFromCloud(email);
    };

    window.addEventListener('focus', handleFocusSync);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleFocusSync();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic safety sync (every 4 seconds) to guarantee 100% realtime sync across devices
    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadBoardsFromCloud(email);
        loadNotificationsFromCloud(email);
      }
    }, 4000);

    return () => {
      if (boardsDebounceTimer) clearTimeout(boardsDebounceTimer);
      clearInterval(pollInterval);
      unsub();
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.email, loadBoardsFromCloud, loadNotificationsFromCloud]);

  // Sync user profile name with board memberships
  useEffect(() => {
    if (currentUser?.email && currentUser?.name) {
      syncCurrentUserProfile(currentUser);
    }
  }, [currentUser, syncCurrentUserProfile]);

  // Apply / remove dark class on <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Helper to read initial navigation state on load/refresh
  const getInitialRouting = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPage = params.get('page');
      const urlBoard = params.get('board') || params.get('b');
      const urlView = params.get('view') as 'board' | 'list' | 'calendar' | null;
      const urlCard = params.get('card') || params.get('c');

      const savedPage = localStorage.getItem('worklane_current_page_v1') as 'dashboard' | 'board' | null;
      const savedView = localStorage.getItem('worklane_current_view_mode_v1') as 'board' | 'list' | 'calendar' | null;
      const savedCard = localStorage.getItem('worklane_current_card_v1');

      let initialPage: 'dashboard' | 'board' = 'dashboard';
      if (urlPage === 'board' || urlBoard || (urlPage !== 'dashboard' && savedPage === 'board')) {
        initialPage = 'board';
      }

      const validViews: Array<'board' | 'list' | 'calendar'> = ['board', 'list', 'calendar'];
      const initialView = validViews.includes(urlView as any)
        ? (urlView as 'board' | 'list' | 'calendar')
        : validViews.includes(savedView as any)
        ? (savedView as 'board' | 'list' | 'calendar')
        : 'board';

      return {
        page: initialPage,
        boardId: urlBoard || null,
        viewMode: initialView,
        cardId: urlCard || savedCard || null,
      };
    } catch {
      return {
        page: 'dashboard' as const,
        boardId: null,
        viewMode: 'board' as const,
        cardId: null,
      };
    }
  };

  const initialRouting = useMemo(() => getInitialRouting(), []);

  // Page routing: dashboard (home) or board (active board view)
  const isMobile = useIsMobile(860);
  const [page, setPage] = useState<'dashboard' | 'board'>(initialRouting.page);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [openCardId, setOpenCardId] = useState<string | null>(initialRouting.cardId);
  const [openCardBoardId, setOpenCardBoardId] = useState<string | null>(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels'>('profile');
  const [notifOpen, setNotifOpen] = useState(false);

  const handleOpenSettings = useCallback((tab: 'profile' | 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels' = 'profile') => {
    setSettingsTab(tab);
    setShowSettings(true);
  }, []);

  // Active view layout & team member filter
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>(initialRouting.viewMode);
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  // Synchronize board from URL on initial mount
  useEffect(() => {
    if (initialRouting.boardId) {
      switchBoard(initialRouting.boardId);
    }
  }, [initialRouting.boardId, switchBoard]);

  // Keep URL search params and localStorage in sync as user navigates
  useEffect(() => {
    try {
      if (!isAuthenticated) {
        // If not logged in and not on invite/reset flow, keep the URL clean
        const params = new URLSearchParams(window.location.search);
        if (!params.has('joinBoard') && !params.has('invite') && !params.has('reset') && !params.has('error')) {
          if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
        return;
      }

      localStorage.setItem('worklane_current_page_v1', page);
      localStorage.setItem('worklane_current_view_mode_v1', viewMode);
      if (openCardId) {
        localStorage.setItem('worklane_current_card_v1', openCardId);
      } else {
        localStorage.removeItem('worklane_current_card_v1');
      }

      const params = new URLSearchParams(window.location.search);
      // Preserve invite and password reset flows if active
      if (!params.has('joinBoard') && !params.has('invite') && !params.has('reset')) {
        if (page === 'dashboard') {
          // Dashboard is the default root view - keep URL clean without ugly ?page=dashboard
          params.delete('page');
          params.delete('board');
          params.delete('b');
          params.delete('card');
          params.delete('c');
          params.delete('view');
        } else if (page === 'board') {
          params.delete('page');
          if (activeBoardId) params.set('board', activeBoardId);
          if (viewMode !== 'board') params.set('view', viewMode);
          else params.delete('view');
          if (openCardId) params.set('card', openCardId);
          else params.delete('card');
        }

        const newSearch = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, document.title, newSearch);
      }
    } catch {}
  }, [page, activeBoardId, viewMode, openCardId, isAuthenticated]);

  // When user logs out, reset to dashboard and clean storage/URL
  useEffect(() => {
    if (!isAuthenticated) {
      setPage('dashboard');
      try {
        localStorage.setItem('worklane_current_page_v1', 'dashboard');
        localStorage.removeItem('worklane_current_card_v1');
        const params = new URLSearchParams(window.location.search);
        if (!params.has('joinBoard') && !params.has('invite') && !params.has('reset') && !params.has('error')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {}
    }
  }, [isAuthenticated]);

  // If currently on a board that gets deleted or left, safely switch to next board or return to overview
  useEffect(() => {
    if (page === 'board') {
      const boardExists = boards.some(b => b.id === activeBoardId);
      if (!boardExists) {
        if (boards.length > 0) {
          switchBoard(boards[0].id);
        } else {
          setPage('dashboard');
        }
      }
    }
  }, [page, activeBoardId, boards, switchBoard]);

  const handleSelectBoard = useCallback((boardId: string) => {
    switchBoard(boardId);
    setPage('board');
    try {
      localStorage.setItem('worklane_current_page_v1', 'board');
    } catch {}
  }, [switchBoard]);

  const handleGoToDashboard = useCallback(() => {
    setPage('dashboard');
    try {
      localStorage.setItem('worklane_current_page_v1', 'dashboard');
    } catch {}
  }, []);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

const ALERTED_SOON_KEY = 'worklane_alerted_soon_v1';
const ALERTED_OVERDUE_KEY = 'worklane_alerted_overdue_v1';

function getAlertedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveAlertedSet(key: string, setObj: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(setObj).slice(-300)));
  } catch {
    // ignore
  }
}

  // Due-date checker
  const checkDueDates = useCallback(() => {
    const now = new Date();
    const storeBoards = useWorkStore.getState().boards;
    const alertedSoon = getAlertedSet(ALERTED_SOON_KEY);
    const alertedOverdue = getAlertedSet(ALERTED_OVERDUE_KEY);
    let soonChanged = false;
    let overdueChanged = false;

    storeBoards.forEach(board => {
      board.columns?.forEach(col => {
        col.cards?.forEach(card => {
          if (!card.dueDate || card.completed) return;
          const due = new Date(card.dueDate);
          const diff = due.getTime() - now.getTime();
          const alertId = `${card.id}_${card.dueDate}`;

          // If due within 24h and not yet overdue
          if (diff > 0 && diff < 86400000 && !alertedSoon.has(alertId)) {
            alertedSoon.add(alertId);
            soonChanged = true;

            const targetRecipients = (card.assignees && card.assignees.length > 0)
              ? (card.assignees || []).map(mId => board.members?.find(m => m.id === mId)).filter(Boolean)
              : (board.members || []);

            targetRecipients.forEach(member => {
              if (member && member.email) {
                addNotification(
                  `Due soon: ${card.title}`,
                  `Due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
                  'clock', card.id, board.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Reminder: Task Due Soon - ${card.title}`,
                  body: `Hi ${member.name},\n\nThe task "${card.title}" is due soon (${formatDueDate(card.dueDate)}) on board "${board.name}".\n\nWorklane Team`,
                  eventType: 'due_reminder',
                  metadata: {
                    cardTitle: card.title,
                    boardName: board.name,
                    cardId: card.id,
                    boardId: board.id,
                    dueDate: card.dueDate || undefined,
                  },
                });
              }
            });
          }

          // If overdue (diff <= 0)
          if (diff <= 0 && !alertedOverdue.has(alertId)) {
            alertedOverdue.add(alertId);
            overdueChanged = true;

            const targetRecipients = (card.assignees && card.assignees.length > 0)
              ? (card.assignees || []).map(mId => board.members?.find(m => m.id === mId || (m.email && m.email.toLowerCase().trim() === mId.toLowerCase().trim()))).filter(Boolean)
              : (board.members || []);

            targetRecipients.forEach(member => {
              if (member && member.email) {
                addNotification(
                  `Overdue: ${card.title}`,
                  `Was due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
                  'alert', card.id, board.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Alert: Task is Overdue - ${card.title}`,
                  body: `Hi ${member.name},\n\nThe task "${card.title}" was due on ${formatDueDate(card.dueDate)} and is now overdue on board "${board.name}".\n\nWorklane Team`,
                  eventType: 'due_reminder',
                  metadata: {
                    cardTitle: card.title,
                    boardName: board.name,
                    cardId: card.id,
                    boardId: board.id,
                    dueDate: card.dueDate || undefined,
                  },
                });
              }
            });
          }
        });
      });
    });

    if (soonChanged) saveAlertedSet(ALERTED_SOON_KEY, alertedSoon);
    if (overdueChanged) saveAlertedSet(ALERTED_OVERDUE_KEY, alertedOverdue);
  }, [addNotification]);

  useEffect(() => {
    checkDueDates();
    const interval = setInterval(checkDueDates, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkDueDates]);

  // Card modal opener
  const handleOpenCard = (cardId: string, boardId?: string) => {
    setOpenCardId(cardId);
    setOpenCardBoardId(boardId || activeBoardId);
  };

  // ── Dedicated Board Invite Landing Page ──
  if (pendingInvite) {
    return (
      <div className="app-layout">
        <InviteLandingPage
          boardId={pendingInvite.boardId}
          role={pendingInvite.role}
          onAcceptJoin={(boardId) => {
            try {
              localStorage.removeItem('worklane_pending_invite');
              sessionStorage.removeItem('worklane_pending_invite');
            } catch {}
            window.history.replaceState({}, document.title, window.location.pathname);
            setPendingInvite(null);
            handleSelectBoard(boardId);
          }}
          onDecline={() => {
            try {
              localStorage.removeItem('worklane_pending_invite');
              sessionStorage.removeItem('worklane_pending_invite');
            } catch {}
            window.history.replaceState({}, document.title, window.location.pathname);
            setPendingInvite(null);
            setPage('dashboard');
          }}
        />
        <Toast />
      </div>
    );
  }

  // ── Global Loading Screen ──
  // (1) Auth session not yet resolved, OR (2) first cloud fetch not done yet
  if (!authInitialized || (isAuthenticated && !hasLoadedOnce)) {
    return (
      <div className="app-layout">
        <AppLoadingScreen isDark={isDark} />
        <Toast />
      </div>
    );
  }

  // ── Authentication Check ──
  if (!isAuthenticated) {
    return (
      <div className="app-layout">
        <LoginPage />
        <Toast />
      </div>
    );
  }

  return (
    <div className="app-layout" style={{ perspective: 1400 }}>
      {/* Mobile Sidebar Backdrop Overlay */}
      <div
        className={`sidebar-backdrop${mobileMenuOpen ? ' open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <div className={`app-window${(!isMobile && sidebarCollapsed) ? ' sidebar-collapsed-layout' : ''}`}>
        <Sidebar
          page={page}
          activeView={viewMode}
          onSelectView={setViewMode}
          onOpenInbox={() => setShowInbox(s => !s)}
          isInboxOpen={showInbox}
          filterMemberId={filterMemberId}
          onFilterMember={setFilterMemberId}
          onManageMembers={() => setShowMembers(true)}
          onOpenSettings={handleOpenSettings}
          onCreateBoard={() => setShowCreateBoard(true)}
          onGoToDashboard={handleGoToDashboard}
          onSelectBoard={handleSelectBoard}
          collapsed={!isMobile && sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="app-main-content" style={{ transformStyle: 'preserve-3d' }}>
          <AnimatePresence mode="wait">
            {page === 'dashboard' ? (
              <motion.div
                key="page-dashboard"
                variants={page3DVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <Topbar
                  page="dashboard"
                  onOpenSearch={() => setShowSearch(true)}
                  onOpenInbox={() => setShowInbox(s => !s)}
                  onManageMembers={() => setShowMembers(true)}
                  onManageEmail={() => handleOpenSettings('email')}
                  onOpenPrivacy={() => handleOpenSettings('privacy')}
                  onOpenSettings={handleOpenSettings}
                  onToggleNotif={() => setNotifOpen(o => !o)}
                  notifOpen={notifOpen}
                  onToggleMobileMenu={() => setMobileMenuOpen(o => !o)}
                />
                <Dashboard
                  onSelectBoard={handleSelectBoard}
                  onCreateBoard={() => setShowCreateBoard(true)}
                  onOpenCard={handleOpenCard}
                />
                <InboxDrawer
                  isOpen={showInbox}
                  onClose={() => setShowInbox(false)}
                  board={useWorkStore.getState().getActiveBoard() || useWorkStore.getState().boards[0] || null}
                  onOpenCard={cardId => handleOpenCard(cardId)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="page-board"
                variants={page3DVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <Topbar
                  onOpenSearch={() => setShowSearch(true)}
                  onOpenInbox={() => setShowInbox(s => !s)}
                  onManageMembers={() => setShowMembers(true)}
                  onManageEmail={() => handleOpenSettings('email')}
                  onOpenPrivacy={() => handleOpenSettings('privacy')}
                  onOpenSettings={handleOpenSettings}
                  onToggleNotif={() => setNotifOpen(o => !o)}
                  notifOpen={notifOpen}
                  onToggleMobileMenu={() => setMobileMenuOpen(o => !o)}
                />

                <BoardArea
                  viewMode={viewMode}
                  filterMemberId={filterMemberId}
                  onClearFilter={() => setFilterMemberId(null)}
                  onOpenCard={cardId => handleOpenCard(cardId)}
                  onAddColumn={() => setShowAddColumn(true)}
                  onCreateBoard={() => setShowCreateBoard(true)}
                  showInbox={showInbox}
                  onToggleInbox={() => setShowInbox(s => !s)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals with 3D Depth Entrance */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onOpenCard={(cardId, boardId) => handleOpenCard(cardId, boardId)}
          onSelectBoard={boardId => {
            handleSelectBoard(boardId);
            setShowSearch(false);
          }}
          onFilterMember={memberId => {
            setFilterMemberId(memberId);
            setShowSearch(false);
          }}
          scope={page === 'board' ? 'board' : 'global'}
          activeBoardId={page === 'board' ? activeBoardId : null}
        />
      )}
      {showSettings && (
        <SettingsModal
          initialTab={settingsTab}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showCreateBoard && (
        <CreateBoardModal
          onClose={(createdBoardId?: string) => {
            setShowCreateBoard(false);
            if (createdBoardId) {
              switchBoard(createdBoardId);
              setPage('board');
            }
          }}
        />
      )}
      {showAddColumn && (
        <AddColumnModal
          onClose={() => setShowAddColumn(false)}
          mode={viewMode === 'list' ? 'row' : 'column'}
        />
      )}
      {showMembers && <MembersModal onClose={() => setShowMembers(false)} />}
      {showEmail && <EmailNotifModal onClose={() => setShowEmail(false)} />}

      {/* Card Detail */}
      {openCardId && (
        <CardModal
          cardId={openCardId}
          boardId={openCardBoardId}
          onClose={() => { setOpenCardId(null); setOpenCardBoardId(null); }}
        />
      )}

      {/* Notification Panel */}
      <NotifPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onOpenCard={(cardId, boardId) => {
          handleOpenCard(cardId, boardId);
          if (boardId && boardId !== activeBoardId) {
            useWorkStore.getState().switchBoard(boardId);
          }
        }}
      />

      {/* Mobile Quick Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Quick Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-tab ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => {
            handleGoToDashboard();
            setMobileMenuOpen(false);
          }}
          title="Dashboard"
        >
          <LayoutDashboard size={17} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${page === 'board' && viewMode === 'board' ? 'active' : ''}`}
          onClick={() => {
            setPage('board');
            setViewMode('board');
            setMobileMenuOpen(false);
          }}
          title="Board View"
        >
          <KanbanSquare size={17} />
          <span>Board</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${page === 'board' && viewMode === 'list' ? 'active' : ''}`}
          onClick={() => {
            setPage('board');
            setViewMode('list');
            setMobileMenuOpen(false);
          }}
          title="List View"
        >
          <List size={17} />
          <span>List</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${page === 'board' && viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => {
            setPage('board');
            setViewMode('calendar');
            setMobileMenuOpen(false);
          }}
          title="Calendar View"
        >
          <Calendar size={17} />
          <span>Calendar</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${showInbox ? 'active' : ''}`}
          onClick={() => {
            setShowInbox(s => !s);
            setMobileMenuOpen(false);
          }}
          title="Inbox"
        >
          <Inbox size={17} />
          <span>Inbox</span>
        </button>
      </nav>

      {/* Toasts */}
      <Toast />

      {/* Global Centered Confirmation Dialog */}
      <ConfirmModal />
    </div>
  );
}
