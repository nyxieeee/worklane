import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Mail, Search, LogOut, Shield, ChevronRight, ChevronDown, Settings, Inbox, Crown, Eye, User, Menu, Calendar, Clock, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { useThemeStore } from '../store/useThemeStore';
import { avatarInitials, sortMembersWithOwnerFirst, useIsMobile } from '../utils';
import AvatarBorder from './ui/AvatarBorder';
import BoardColorPicker from './ui/BoardColorPicker';
import logoImg from '../assets/logo.png';
import type { Member } from '../types';

interface Props {
  page?: 'dashboard' | 'board' | 'roadmap';
  title?: string;
  onOpenSearch: () => void;
  onOpenInbox?: () => void;
  onManageMembers?: () => void;
  onManageEmail?: () => void;
  onOpenPrivacy?: () => void;
  onOpenSettings?: (tab?: 'profile' | 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels') => void;
  onToggleNotif: () => void;
  notifOpen: boolean;
  onToggleMobileMenu?: () => void;
  onOpenBoardSelector?: () => void;
}

export default function Topbar({
  page = 'board',
  title,
  onOpenSearch,
  onOpenInbox,
  onManageMembers,
  onManageEmail,
  onOpenPrivacy,
  onOpenSettings,
  onToggleNotif,
  notifOpen,
  onToggleMobileMenu,
  onOpenBoardSelector,
}: Props) {
  const getVisibleBoards  = useWorkStore(s => s.getVisibleBoards);
  const boards            = useWorkStore(s => s.boards);
  const activeBoardId     = useWorkStore(s => s.activeBoardId);
  const updateBoardColor  = useWorkStore(s => s.updateBoardColor);
  const showToast         = useToastStore(s => s.showToast);
  const user              = useAuthStore(s => s.user);
  const logout            = useAuthStore(s => s.logout);
  const visibleBoards     = useMemo(() => getVisibleBoards(user?.email), [getVisibleBoards, user?.email, boards]);
  const activeBoard       = useMemo(() => visibleBoards.find(b => b.id === activeBoardId) || null, [visibleBoards, activeBoardId]);
  const board             = page === 'dashboard' ? null : activeBoard;
  const rawNotifications  = useNotifStore(s => s.notifications);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const canEditBoard = board ? (!board.createdBy || (user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (board.members && board.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer'))) : false;

  const notifications = useMemo(() => {
    if (!user?.email) return rawNotifications.filter(n => !n.recipientEmail);
    const email = user.email.toLowerCase().trim();
    return rawNotifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
  }, [rawNotifications, user?.email]);

  const [userDropOpen, setUserDropOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  // If on dashboard, aggregate distinct members across all boards
  const members: Member[] = useMemo(() => {
    if (board) return sortMembersWithOwnerFirst(board.members || [], board.createdBy);
    const map = new Map<string, Member>();
    boards.forEach(b => {
      (b.members || []).forEach(m => {
        if (!map.has(m.id || m.name)) map.set(m.id || m.name, m);
      });
    });
    return Array.from(map.values());
  }, [board, boards]);

  const shown   = members.slice(0, 3);
  const extra   = members.length > 3 ? members.length - 3 : 0;

  const isMobile = useIsMobile(860);
  const isDark = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayFormatted = currentTime.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const timeFormatted = currentTime.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Close user dropdown on outside click
  useEffect(() => {
    if (!userDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (!chipRef.current?.contains(e.target as Node)) setUserDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userDropOpen]);

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div className="topbar-left">
        {onToggleMobileMenu && page !== 'dashboard' && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="icon-btn show-on-mobile"
            onClick={onToggleMobileMenu}
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
            style={{ width: 34, height: 34, flexShrink: 0, display: isMobile ? 'flex' : undefined }}
          >
            <Menu size={18} />
          </motion.button>
        )}
        <div className="topbar-breadcrumbs">
          {!isMobile && (
            <>
              <span className="topbar-crumb-root">Workspace</span>
              <ChevronRight size={13} className="topbar-crumb-sep" />
            </>
          )}
          {(page === 'board' || page === 'roadmap') && board ? (
            <span className="topbar-crumb-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, position: 'relative', zIndex: showColorPicker ? 40 : undefined }}>
              <button
                type="button"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: board.color,
                  border: 'none',
                  padding: 0,
                  cursor: canEditBoard ? 'pointer' : 'default',
                  boxShadow: 'var(--neu-shadow-raised-sm)',
                  display: 'inline-block',
                }}
                title={canEditBoard ? (board.type === 'roadmap' ? "Change roadmap color" : "Change board color") : undefined}
                onClick={canEditBoard ? (e) => {
                  e.stopPropagation();
                  setShowColorPicker(s => !s);
                } : undefined}
              />
              {isMobile && onOpenBoardSelector ? (
                <button
                  type="button"
                  onClick={onOpenBoardSelector}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    font: 'inherit',
                    color: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    maxWidth: 160,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title="Switch board"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {board.name}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.65, flexShrink: 0 }} />
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>{board.name}</span>
                  {board.type === 'roadmap' && <span className="sidebar-beta-tag">BETA</span>}
                </span>
              )}
              <AnimatePresence>
                {showColorPicker && (
                  <BoardColorPicker
                    currentColor={board.color}
                    onSelectColor={(col) => {
                      updateBoardColor(board.id, col);
                      showToast(board.type === 'roadmap' ? 'Roadmap color updated' : 'Board color updated', 'success');
                    }}
                    onClose={() => setShowColorPicker(false)}
                    align="left"
                    style={{ top: 'calc(100% + 8px)' }}
                  />
                )}
              </AnimatePresence>
            </span>
          ) : (
            <span className="topbar-crumb-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {isMobile && (
                <img
                  src={logoImg}
                  alt="Worklane"
                  style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'contain' }}
                />
              )}
              <span>Overview</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Tools */}
      <div className="topbar-right">
        {/* Search trigger */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          className="topbar-search-trigger"
          onClick={onOpenSearch}
          title={page === 'board' && board ? `Search in ${board.name}` : 'Search all boards'}
          style={isMobile ? { minWidth: 34, width: 34, height: 34, padding: 0, justifyContent: 'center' } : undefined}
        >
          <Search size={15} />
          {!isMobile && (
            <>
              <span>{page === 'board' && board ? `Search in ${board.name}...` : 'Search all boards...'}</span>
              <kbd className="topbar-shortcut-pill">⌘K</kbd>
            </>
          )}
        </motion.button>

        {/* Member avatar stack (Board context only) */}
        {page === 'board' && board && members.length > 0 && (
          <div
            className="card-assignees hide-on-mobile"
            onClick={onManageMembers}
            title="Manage Team Members"
            style={{ cursor: 'pointer', paddingRight: 4 }}
          >
            {shown.map(m => (
              <AvatarBorder key={m.id} borderStyle={m.borderStyle} size={26} title={m.name}>
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt={m.name}
                    style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      backgroundColor: m.color || '#6366f1',
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                      margin: 0,
                    }}
                  >
                    {avatarInitials(m.name)}
                  </div>
                )}
              </AvatarBorder>
            ))}
            {extra > 0 && (
              <div className="card-avatar" style={{ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                +{extra}
              </div>
            )}
          </div>
        )}

        {page === 'board' && onManageEmail && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="icon-btn hide-on-mobile"
            title="Email Updates"
            onClick={onManageEmail}
          >
            <Mail size={15} />
          </motion.button>
        )}

        {/* Bell Notifications */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            className={`icon-btn ${notifOpen ? 'active' : ''}`}
            onClick={onToggleNotif}
            title="Notifications"
          >
            <Bell size={15} />
            {notifications.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'hsl(var(--primary))'
                }}
              />
            )}
          </motion.button>
        </div>

        {/* User Account Menu */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={chipRef}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            className="icon-btn"
            style={{
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              flexShrink: 0,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              color: 'hsl(var(--primary-foreground))',
              fontSize: 11,
              fontWeight: 700,
              padding: 0,
              overflow: 'visible',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 2,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setUserDropOpen(o => !o);
            }}
            title="User Profile"
          >
            <AvatarBorder borderStyle={user?.borderStyle} size={32} style={{ pointerEvents: 'none' }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.name || 'User'}
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  {avatarInitials(user?.name || 'U')}
                </div>
              )}
            </AvatarBorder>
          </motion.button>

          <AnimatePresence>
            {userDropOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute',
                  top: 38,
                  right: 0,
                  width: 236,
                  maxWidth: 'calc(100vw - 24px)',
                  backgroundColor: 'hsl(var(--popover))',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--neu-shadow-floating)',
                  padding: '8px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderBottom: '1px solid hsl(var(--border) / 0.5)', marginBottom: 2 }}>
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user?.name || 'User'}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {avatarInitials(user?.name || 'U')}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.name || 'User'}
                    </div>
                    {user?.email && (
                      <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                    )}
                    {board && (
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                        {board.createdBy && user?.email && board.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim() ? (
                          <span style={{ color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Crown size={11} /> Board Owner
                          </span>
                        ) : board.members?.find(m => m.email && m.email.toLowerCase().trim() === user?.email?.toLowerCase().trim())?.role === 'admin' ? (
                          <span style={{ color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={11} /> Admin
                          </span>
                        ) : board.members?.find(m => m.email && m.email.toLowerCase().trim() === user?.email?.toLowerCase().trim())?.role === 'observer' ? (
                          <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={11} /> Observer (View Only)
                          </span>
                        ) : (
                          <span style={{ color: 'hsl(var(--muted-foreground))', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <User size={11} /> Team Member
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="sidebar-nav-item"
                  style={{ width: '100%', fontSize: 12.5, cursor: 'pointer' }}
                  onClick={() => { onOpenSettings?.('profile'); setUserDropOpen(false); }}
                >
                  <User size={13} />
                  <span>Edit Profile & Avatar</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="sidebar-nav-item"
                  style={{ width: '100%', fontSize: 12.5, color: 'hsl(var(--destructive))', cursor: 'pointer' }}
                  onClick={() => { logout(); setUserDropOpen(false); }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
