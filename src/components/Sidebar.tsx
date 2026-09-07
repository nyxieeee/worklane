import React, { useEffect, useMemo, useState } from 'react';
import {
  KanbanSquare, List, Calendar, Users, Inbox,
  Mail, Shield, Plus, X, ChevronLeft, ChevronRight,
  ArrowLeft, Check, Sun, Moon, LayoutDashboard,
  Eye, EyeOff, LogOut, Settings, Sliders, Pencil, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useThemeStore } from '../store/useThemeStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { avatarInitials, sortMembersWithOwnerFirst, getTeamBadgeInfo } from '../utils';
import AvatarBorder from './ui/AvatarBorder';
import BoardColorPicker from './ui/BoardColorPicker';
import sidebarImg from '../assets/sidebar.png';
import sidebarDarkImg from '../assets/sidebar-dark.png';
import logoImg from '../assets/logo.png';

interface Props {
  page: 'dashboard' | 'board';
  activeView: 'board' | 'list' | 'calendar';
  onSelectView: (view: 'board' | 'list' | 'calendar') => void;
  onOpenInbox: () => void;
  isInboxOpen?: boolean;
  onManageMembers: () => void;
  onOpenSettings: (tab?: 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels') => void;
  onFilterMember: (memberId: string | null) => void;
  filterMemberId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onGoToDashboard: () => void;
  onCreateBoard: () => void;
  onSelectBoard: (boardId: string) => void;
}

export default function Sidebar({
  page,
  activeView,
  onSelectView,
  onOpenInbox,
  isInboxOpen = false,
  onManageMembers,
  onOpenSettings,
  onFilterMember,
  filterMemberId,
  collapsed,
  onToggleCollapse,
  onGoToDashboard,
  onCreateBoard,
  onSelectBoard,
}: Props) {
  const allBoards        = useWorkStore(s => s.boards);
  const activeBoardId    = useWorkStore(s => s.activeBoardId);
  const deleteBoard = useWorkStore(s => s.deleteBoard);
  const leaveBoard  = useWorkStore(s => s.leaveBoard);
  const renameBoard = useWorkStore(s => s.renameBoard);
  const updateBoardColor = useWorkStore(s => s.updateBoardColor);

  const [editingSidebarBoardId, setEditingSidebarBoardId] = React.useState<string | null>(null);
  const [editingSidebarBoardName, setEditingSidebarBoardName] = React.useState('');
  const [colorPickerBoardId, setColorPickerBoardId] = React.useState<string | null>(null);
  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const user             = useAuthStore(s => s.user);
  const logout           = useAuthStore(s => s.logout);
  const labelMode        = useSettingsStore(s => s.labelMode);
  const setLabelMode     = useSettingsStore(s => s.setLabelMode);
  const showToast        = useToastStore(s => s.showToast);
  const showConfirm      = useConfirmStore(s => s.showConfirm);

  const boards = useMemo(() => getVisibleBoards(user?.email), [allBoards, user?.email, getVisibleBoards]);
  const isDark  = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);

  const activeBoard = useMemo(() => allBoards.find(b => b.id === activeBoardId), [allBoards, activeBoardId]);
  const teamMembers = useMemo(
    () => sortMembersWithOwnerFirst(activeBoard?.members ?? [], activeBoard?.createdBy),
    [activeBoard?.members, activeBoard?.createdBy]
  );

  // ── Collapsed Sidebar ──
  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-header" style={{ justifyContent: 'center', height: 62, padding: '0 8px', flexDirection: 'column', gap: 4 }}>
          <img
            src={logoImg}
            alt="Worklane"
            style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', objectFit: 'contain' }}
            onClick={onGoToDashboard}
            title="Worklane"
          />
        </div>
        <div className="sidebar-scrollable" style={{ alignItems: 'center' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            style={{ marginBottom: 4 }}
          >
            <ChevronRight size={15} />
          </motion.button>
          {page === 'dashboard' ? (
            <>
              {boards.map(b => (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  key={b.id}
                  className="icon-btn"
                  title={b.name}
                  onClick={() => onSelectBoard(b.id)}
                >
                  <div className="sidebar-board-dot" style={{ backgroundColor: b.color }} />
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Create Board"
                onClick={onCreateBoard}
              >
                <Plus size={16} />
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Back to Dashboard"
                onClick={onGoToDashboard}
              >
                <ArrowLeft size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'board' ? 'active' : ''}`}
                title="Board View"
                onClick={() => onSelectView('board')}
              >
                <KanbanSquare size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'list' ? 'active' : ''}`}
                title="List View"
                onClick={() => onSelectView('list')}
              >
                <List size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'calendar' ? 'active' : ''}`}
                title="Calendar View"
                onClick={() => onSelectView('calendar')}
              >
                <Calendar size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Team Members"
                onClick={onManageMembers}
              >
                <Users size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Settings"
                onClick={() => onOpenSettings()}
              >
                <Settings size={16} />
              </motion.button>
            </>
          )}
        </div>
      </aside>
    );
  }

  // ── Expanded Neumorphic Sidebar ──
  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 62, padding: '0 16px' }}>
        <div className="sidebar-logo" onClick={onGoToDashboard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img
            src={isDark ? sidebarDarkImg : sidebarImg}
            alt="Worklane"
            style={{
              height: 42,
              width: 'auto',
              maxHeight: 44,
              maxWidth: 165,
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          style={{ position: 'absolute', right: 12 }}
        >
          <ChevronLeft size={15} />
        </motion.button>
      </div>

      <div className="sidebar-scrollable">
        {/* Dashboard Navigation */}
        {page === 'dashboard' ? (
          <>
            <div className="sidebar-section">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="sidebar-nav-item active"
                onClick={onGoToDashboard}
              >
                <LayoutDashboard size={15} />
                <span>Overview</span>
              </motion.button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Boards</span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="sidebar-action-icon-btn"
                  onClick={onCreateBoard}
                  title="Create Board"
                >
                  <Plus size={13} />
                </motion.button>
              </div>

              {boards.map(b => (
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  key={b.id}
                  className="sidebar-board-item"
                  onClick={() => onSelectBoard(b.id)}
                >
                  {editingSidebarBoardId === b.id ? (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingSidebarBoardName}
                        onChange={e => setEditingSidebarBoardName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (editingSidebarBoardName.trim() && editingSidebarBoardName.trim() !== b.name) {
                              renameBoard(b.id, editingSidebarBoardName.trim());
                              showToast(`Renamed to "${editingSidebarBoardName.trim()}"`, 'success');
                            }
                            setEditingSidebarBoardId(null);
                          }
                          if (e.key === 'Escape') {
                            setEditingSidebarBoardId(null);
                          }
                        }}
                        autoFocus
                        className="text-input"
                        style={{ fontSize: 12, padding: '2px 6px', height: 24, borderRadius: 4, flex: 1 }}
                      />
                      <button
                        type="button"
                        className="sidebar-action-icon-btn"
                        style={{ color: 'hsl(var(--primary))' }}
                        onClick={() => {
                          if (editingSidebarBoardName.trim() && editingSidebarBoardName.trim() !== b.name) {
                            renameBoard(b.id, editingSidebarBoardName.trim());
                            showToast(`Renamed to "${editingSidebarBoardName.trim()}"`, 'success');
                          }
                          setEditingSidebarBoardId(null);
                        }}
                        title="Save"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        type="button"
                        className="sidebar-action-icon-btn"
                        onClick={() => setEditingSidebarBoardId(null)}
                        title="Cancel"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const canEditB = (!b.createdBy || (user?.email && b.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (b.members && b.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer')));
                        return (
                          <>
                            <div
                              className="sidebar-board-dot"
                              style={{ backgroundColor: b.color, cursor: canEditB ? 'pointer' : 'default' }}
                              title={canEditB ? "Change board color" : undefined}
                              onClick={canEditB ? (e) => {
                                e.stopPropagation();
                                setColorPickerBoardId(colorPickerBoardId === b.id ? null : b.id);
                              } : undefined}
                            />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.name}
                            </span>
                            <div className="sidebar-board-actions">
                              {canEditB && (
                                <>
                                  <button
                                    className="sidebar-action-icon-btn"
                                    title="Change Board Color"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setColorPickerBoardId(colorPickerBoardId === b.id ? null : b.id);
                                    }}
                                  >
                                    <Palette size={11} />
                                  </button>
                                  <button
                                    className="sidebar-action-icon-btn"
                                    title="Rename Board"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSidebarBoardId(b.id);
                                      setEditingSidebarBoardName(b.name);
                                    }}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </>
                              )}
                              {!b.createdBy || (user?.email && b.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) ? (
                                <button
                                  className="sidebar-action-icon-btn"
                                  title="Delete Board"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showConfirm({
                                      title: `Delete "${b.name}"?`,
                                      message: `Are you sure you want to permanently delete this board and all its tasks? This action cannot be undone.`,
                                      confirmText: 'Delete Board',
                                      variant: 'danger',
                                      icon: 'trash',
                                      onConfirm: () => {
                                        deleteBoard(b.id);
                                        showToast(`Deleted board "${b.name}"`, 'info');
                                      }
                                    });
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              ) : (
                                <button
                                  className="sidebar-action-icon-btn"
                                  title="Leave Board"
                                  style={{ color: 'hsl(var(--destructive))' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (user?.email) {
                                      showConfirm({
                                        title: `Leave "${b.name}"?`,
                                        message: `Are you sure you want to leave this board? You will need an invite from the owner to rejoin.`,
                                        confirmText: 'Leave Board',
                                        variant: 'danger',
                                        icon: 'logout',
                                        onConfirm: () => {
                                          if (user?.email) {
                                            leaveBoard(b.id, user.email);
                                            showToast(`You left "${b.name}"`, 'info');
                                          }
                                        }
                                      });
                                    }
                                  }}
                                >
                                  <LogOut size={12} />
                                </button>
                              )}
                            </div>
                            <AnimatePresence>
                              {colorPickerBoardId === b.id && (
                                <BoardColorPicker
                                  currentColor={b.color}
                                  onSelectColor={(newCol) => {
                                    updateBoardColor(b.id, newCol);
                                    showToast(`Board color updated`, 'success');
                                  }}
                                  onClose={() => setColorPickerBoardId(null)}
                                  align="left"
                                />
                              )}
                            </AnimatePresence>
                          </>
                        );
                      })()}
                    </>
              )}
            </motion.div>
          ))}
            </div>
          </>
        ) : (
          <>
            {/* Active Board Header & Return */}
            <div className="sidebar-section">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="sidebar-nav-item"
                onClick={onGoToDashboard}
              >
                <ArrowLeft size={14} />
                <span>All Boards</span>
              </motion.button>
              {activeBoard && (
                editingSidebarBoardId === activeBoard.id ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', marginTop: 2 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editingSidebarBoardName}
                      onChange={e => setEditingSidebarBoardName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (editingSidebarBoardName.trim() && editingSidebarBoardName.trim() !== activeBoard.name) {
                            renameBoard(activeBoard.id, editingSidebarBoardName.trim());
                            showToast(`Renamed to "${editingSidebarBoardName.trim()}"`, 'success');
                          }
                          setEditingSidebarBoardId(null);
                        }
                        if (e.key === 'Escape') {
                          setEditingSidebarBoardId(null);
                        }
                      }}
                      autoFocus
                      className="text-input"
                      style={{ fontSize: 12, padding: '2px 6px', height: 24, borderRadius: 4, flex: 1 }}
                    />
                    <button
                      type="button"
                      className="sidebar-action-icon-btn"
                      style={{ color: 'hsl(var(--primary))' }}
                      onClick={() => {
                        if (editingSidebarBoardName.trim() && editingSidebarBoardName.trim() !== activeBoard.name) {
                          renameBoard(activeBoard.id, editingSidebarBoardName.trim());
                          showToast(`Renamed to "${editingSidebarBoardName.trim()}"`, 'success');
                        }
                        setEditingSidebarBoardId(null);
                      }}
                      title="Save"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-action-icon-btn"
                      onClick={() => setEditingSidebarBoardId(null)}
                      title="Cancel"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="sidebar-board-item active"
                    style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}
                  >
                    {(() => {
                      const canEditActive = (!activeBoard.createdBy || (user?.email && activeBoard.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) || (activeBoard.members && activeBoard.members.some(m => m.email && user?.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim() && m.role !== 'observer')));
                      return (
                        <>
                          <div
                            className="sidebar-board-dot"
                            style={{ backgroundColor: activeBoard.color, cursor: canEditActive ? 'pointer' : 'default' }}
                            title={canEditActive ? "Change board color" : undefined}
                            onClick={canEditActive ? (e) => {
                              e.stopPropagation();
                              setColorPickerBoardId(colorPickerBoardId === activeBoard.id ? null : activeBoard.id);
                            } : undefined}
                          />
                          <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeBoard.name}
                          </span>
                          {canEditActive && (
                            <>
                              <button
                                className="sidebar-action-icon-btn"
                                title="Change Board Color"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColorPickerBoardId(colorPickerBoardId === activeBoard.id ? null : activeBoard.id);
                                }}
                              >
                                <Palette size={11} />
                              </button>
                              <button
                                className="sidebar-action-icon-btn"
                                title="Rename Board"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSidebarBoardId(activeBoard.id);
                                  setEditingSidebarBoardName(activeBoard.name);
                                }}
                              >
                                <Pencil size={11} />
                              </button>
                            </>
                          )}
                          <AnimatePresence>
                            {colorPickerBoardId === activeBoard.id && (
                              <BoardColorPicker
                                currentColor={activeBoard.color}
                                onSelectColor={(newCol) => {
                                  updateBoardColor(activeBoard.id, newCol);
                                  showToast(`Board color updated`, 'success');
                                }}
                                onClose={() => setColorPickerBoardId(null)}
                                align="left"
                                style={{ top: 'calc(100% + 4px)', left: 0 }}
                              />
                            )}
                          </AnimatePresence>
                        </>
                      );
                    })()}
                  </div>
                )
              )}
            </div>

            {/* Views */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Views</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'board' ? 'active' : ''}`}
                onClick={() => onSelectView('board')}
              >
                <KanbanSquare size={14} />
                <span style={{ flex: 1 }}>Board</span>
                {activeView === 'board' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'list' ? 'active' : ''}`}
                onClick={() => onSelectView('list')}
              >
                <List size={14} />
                <span style={{ flex: 1 }}>List</span>
                {activeView === 'list' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
                onClick={() => onSelectView('calendar')}
              >
                <Calendar size={14} />
                <span style={{ flex: 1 }}>Calendar</span>
                {activeView === 'calendar' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
            </div>

            {/* Team Filter */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Team</span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="sidebar-action-icon-btn"
                  onClick={onManageMembers}
                  title="Manage Team"
                >
                  <Plus size={13} />
                </motion.button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${filterMemberId === null ? 'active' : ''}`}
                onClick={() => onFilterMember(null)}
              >
                <Users size={14} />
                <span style={{ flex: 1 }}>All Members</span>
                {filterMemberId === null && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              {teamMembers.map(m => {
                const displayName = (user?.email && m.email?.toLowerCase().trim() === user.email.toLowerCase().trim() && user.name)
                  ? user.name
                  : m.name;

                const badge = getTeamBadgeInfo(m.borderStyle);

                return (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    key={m.id}
                    className={`sidebar-nav-item ${filterMemberId === m.id ? 'active' : ''}`}
                    onClick={() => onFilterMember(filterMemberId === m.id ? null : m.id)}
                    style={{ gap: 8 }}
                  >
                    <AvatarBorder borderStyle={m.borderStyle} size={18}>
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={displayName} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {avatarInitials(displayName)}
                        </div>
                      )}
                    </AvatarBorder>
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </span>
                    {badge && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: badge.bg, color: badge.color,
                        flexShrink: 0
                      }}>
                        {badge.label.replace(' Dev', '')}
                      </span>
                    )}
                    {filterMemberId === m.id && <Check size={13} color="hsl(var(--primary))" />}
                  </motion.button>
                );
              })}
            </div>

          </>
        )}
      </div>

      {/* Fixed Bottom Footer: Settings, Theme & User Profile */}
      <div className="sidebar-footer">


        <motion.button
          whileTap={{ scale: 0.97 }}
          className="sidebar-nav-item"
          style={{ width: '100%' }}
          onClick={() => onOpenSettings()}
        >
          <Settings size={14} />
          {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>}
        </motion.button>

        {!collapsed ? (
          <div className="theme-segmented-control">
            <button
              className={`theme-seg-btn ${!isDark ? 'active' : ''}`}
              onClick={() => { if (isDark) toggleTheme(); }}
            >
              <Sun size={13} />
              <span>Light</span>
            </button>
            <button
              className={`theme-seg-btn ${isDark ? 'active' : ''}`}
              onClick={() => { if (!isDark) toggleTheme(); }}
            >
              <Moon size={13} />
              <span>Dark</span>
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="icon-btn"
            style={{ width: 32, height: 32, margin: '0 auto' }}
            onClick={() => toggleTheme()}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </motion.button>
        )}
      </div>
    </aside>
  );
}
